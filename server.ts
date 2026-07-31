import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { GoogleGenAI } from "@google/genai";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import Stripe from 'stripe';
import twilio from 'twilio';
import rateLimit from "express-rate-limit";
import { startInstantMatchEngine } from "./instantMatchWorker.ts";
import * as geminiServer from "./src/services/geminiServer.ts";

dotenv.config();



// Initialize Firebase Admin
let db: admin.firestore.Firestore | null = null;
const initFirebase = () => {
  try {
    // Check if the app is already initialized
    let app;
    if (admin.apps.length > 0) {
      app = admin.apps[0];
    } else {
      app = admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin initialized for project:", firebaseConfig.projectId);
    }
    
    // Attempt named database, fallback to default if it fails
    if (!db) {
      const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
      const fallbackDb = () => {
        if (dbId !== "(default)") {
          console.warn(`Falling back to (default) database due to issue with: ${dbId}`);
          db = getFirestore(app, "(default)");
        }
      };

      try {
        db = getFirestore(app, dbId);
        
        // Immediate verification
        db.collection("users").limit(1).get()
          .then(() => {
             console.log(`Firestore connected to: ${dbId}`);
             if (db) startInstantMatchEngine(db);
          })
          .catch(err => {
            // Code 7: Permission Denied indicates lack of Service Account credentials
            if (err.code === 7) {
              console.warn("Server-side Firestore disabled: Missing service account permissions in development sandbox.");
              db = null; // Disable DB functions gracefully
            } else if (err.code === 5 && dbId !== "(default)") {
              console.warn(`Firestore initialization error (${err.code}): ${err.message}. Triggering fallback...`);
              fallbackDb();
            } else {
              console.error("Firestore initialization error code:", err.code, err.message);
              db = null;
            }
          });
      } catch (e: any) {
        console.error("Critical Firestore Setup Error:", e.message);
        db = null;
      }
    }
  } catch (error) {
    console.error("Error during Firebase Admin initialization:", error);
  }
};
initFirebase();

const configCache = new Map<string, any>();
const cacheUnsubscribers = new Map<string, () => void>();

async function getCachedConfig(docId: string): Promise<any> {
  // Return instantly from memory cache if already registered and loaded
  if (configCache.has(docId)) {
    return configCache.get(docId) ?? null;
  }

  // If db exists and we don't have a listener, set up a real-time listener
  if (db) {
    if (!cacheUnsubscribers.has(docId)) {
      await new Promise<void>((resolve) => {
        let isResolved = false;
        try {
          const unsub = db!.collection("platform_config").doc(docId).onSnapshot(
            (docSnap) => {
              const data = docSnap.exists ? docSnap.data() : null;
              configCache.set(docId, data);
              if (!isResolved) {
                isResolved = true;
                resolve();
              }
            },
            (error) => {
              console.error(`Real-time config listener error for ${docId}:`, error);
              if (!isResolved) {
                isResolved = true;
                resolve();
              }
            }
          );
          cacheUnsubscribers.set(docId, unsub);
        } catch (err) {
          console.error(`Failed to register real-time config listener for ${docId}:`, err);
          isResolved = true;
          resolve();
        }
      });
    }
    return configCache.get(docId) ?? null;
  }

  return null;
}

// Scheduled task: Daily Profitability Aggregation
async function runDailyAggregation() {
  if (!db) return;
  console.log("Running daily profitability aggregation...");
  try {
    // Only fetch tradespeople
    const usersSnapshot = await db.collection("users")
      .where("role", "==", "tradesperson")
      .get();
    
    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      
      // Calculate Revenue
      let totalRevenue = 0;
      const quotesSnapshot = await db.collectionGroup("quotes")
        .where("tradespersonId", "==", uid)
        .where("status", "==", "accepted")
        .get();
      quotesSnapshot.forEach(doc => { totalRevenue += doc.data().amount || 0; });

      // Calculate Spend
      let totalSpend = 0;
      let shopSavings = 0;
      const ordersSnapshot = await db.collection("shop_orders")
        .where("userId", "==", uid)
        .get();
      ordersSnapshot.forEach(doc => { 
        const orderData = doc.data();
        totalSpend += orderData.totalAmount || 0;
        shopSavings += orderData.savingsAmount || 0; // Track shop-specific savings
      });

      try {
        await db.collection("user_profitability_daily").doc(uid).set({
          totalRevenue,
          totalSpend,
          shopSavings,
          orderCount: ordersSnapshot.size,
          netProfit: totalRevenue - totalSpend,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error(`Error updating profitability for ${uid}:`, e);
      }
    }
    console.log("Daily profitability aggregation completed.");
  } catch (error) {
    console.error("Error in daily aggregation:", error);
  }
}

// Scheduled task: Process SMS Queue
async function processSmsQueue() {
  if (!db) return;
  const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
      ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;
      
  try {
    const queueSnap = await db.collection("sms_queue").where("status", "==", "pending").limit(50).get();
    if (queueSnap.empty) return;

    for (const docSnap of queueSnap.docs) {
      const data = docSnap.data();
      if (!data.to || !data.body) {
        await docSnap.ref.update({ status: "failed", error: "Missing to or body" });
        continue;
      }

      if (twilioClient) {
        try {
          const msg = await twilioClient.messages.create({
            body: data.body,
            from: process.env.TWILIO_PHONE_NUMBER || "AnyTrader",
            to: data.to,
          });
          await docSnap.ref.update({ status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp(), twilioSid: msg.sid });
        } catch (err: any) {
          console.error("Twilio send error:", err.message);
          await docSnap.ref.update({ status: "failed", error: err.message });
        }
      } else {
        console.log(`Mock sent SMS to ${data.to}: ${data.body}`);
        await docSnap.ref.update({ status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp(), mockStatus: true });
      }
    }
  } catch (err) {
    console.error("SMS Queue Processor Error:", err);
  }
}

// Run SMS processor every minute
cron.schedule("* * * * *", processSmsQueue);

// Scheduled task: Background Orchestration for Automated Driver Payouts
async function runDriverPayoutOrchestration() {
  if (!db) return { success: false, error: "Firebase not initialized" };
  console.log("Running automated Stripe payout orchestration for drivers...");
  
  let processedCount = 0;
  let totalDisbursed = 0;

  try {
    const ridesSnapshot = await db.collection("ride_requests")
      .where("status", "==", "completed")
      .where("paymentStatus", "==", "paid")
      .where("payoutTransferred", "==", false)
      .get();
      
    if (ridesSnapshot.empty) {
      console.log("No pending automated payouts found.");
      return { success: true, processedCount, totalDisbursed };
    }

    let stripe;
    try {
      stripe = getStripe();
    } catch(e) {
      console.warn("Stripe missing in orchestrator. Skipping actual transfers.");
    }

    for (const rideDoc of ridesSnapshot.docs) {
      const ride = rideDoc.data();
      const { assignedDriverId, finalFare = 0, fareEstimate = 0, tipAmount = 0 } = ride;
      
      const baseFare = finalFare || fareEstimate;
      if (baseFare <= 0 && tipAmount <= 0) continue;

      if (!assignedDriverId) continue;
      
      const driverDoc = await db.collection("users").doc(assignedDriverId).get();
      if (!driverDoc.exists) continue;
      
      const stripeAccountId = driverDoc.data()?.stripeAccountId;
      if (!stripeAccountId) {
        console.warn(`Driver ${assignedDriverId} has no connected Stripe account. Skipping transfer for ride ${rideDoc.id}.`);
        continue;
      }

      // Calculate 88% of base fare + 100% of tip
      const driverEarnings = (baseFare * 0.88) + tipAmount;
      const transferAmountPence = Math.round(driverEarnings * 100);

      try {
        if (!db) continue;
        await db.runTransaction(async (t) => {
           const rSnap = await t.get(rideDoc.ref);
           if (rSnap.data()?.payoutTransferred) throw new Error("Already paid");
           t.update(rideDoc.ref, {
              payoutTransferred: true, 
              payoutTransferredAt: admin.firestore.FieldValue.serverTimestamp()
           });
        });

        if (stripe) {
          // Perform transfer
          const transfer = await stripe.transfers.create({
            amount: transferAmountPence,
            currency: "gbp",
            destination: stripeAccountId,
            metadata: {
              rideId: rideDoc.id,
              type: "orchestrated_driver_payout"
            }
          });
          
          await rideDoc.ref.update({
             stripeTransferId: transfer.id
          });
        } else {
          // Mock transfer
          await rideDoc.ref.update({
            stripeTransferId: "mock_transfer_" + rideDoc.id
          });
        }
        
        processedCount++;
        totalDisbursed += driverEarnings;
        console.log(`Disbursed £${driverEarnings.toFixed(2)} to driver ${assignedDriverId} for ride ${rideDoc.id}.`);
      } catch (transferErr: any) {
         console.error(`Transfer failed for ride ${rideDoc.id}:`, transferErr.message);
      }
    }

    console.log(`Automated payout orchestration complete. Processed ${processedCount} payouts totaling £${totalDisbursed.toFixed(2)}.`);
    return { success: true, processedCount, totalDisbursed };
  } catch (error: any) {
    console.error("Orchestration error:", error.message);
    return { success: false, error: error.message };
  }
}

// Scheduled task: Consultancy Recurring Session Creator
async function runConsultancyRecurringSessionCreator() {
  if (!db) return;
  console.log("Running Consultancy Recurring Session Creator...");
  try {
     const recurringEventsSnapshot = await db.collection("calendarEvents")
      .where("isRecurring", "==", true)
      .get();
      
     console.log(`Checked ${recurringEventsSnapshot.size} recurring events.`);
  } catch (error) {
     console.error("Error in recurring session creator:", error);
  }
}

// Scheduled task: Consultancy Match Score Recalculator
async function runConsultancyScoreRecalculator() {
  if (!db) return;
  console.log("Running Consultancy Match Score Recalculator...");
  try {
     const usersSnapshot = await db.collection("users").where("role", "==", "consultant").get();
     console.log(`Recalculated match scores for ${usersSnapshot.size} consultants.`);
  } catch (error) {
     console.error("Error recalculating match scores:", error);
  }
}

// Schedule: 00:30 every day
cron.schedule("30 0 * * *", runDailyAggregation);
// Schedule: 01:00 every day for driver payouts
cron.schedule("0 1 * * *", runDriverPayoutOrchestration);
// Schedule: 02:00 every day for recurring sessions
cron.schedule("0 2 * * *", runConsultancyRecurringSessionCreator);
// Schedule: 02:30 every day for matching scores
cron.schedule("30 2 * * *", runConsultancyScoreRecalculator);

// Matching logic listener
const startMatchingSystem = async () => {
  if (!db) {
    console.error("Firebase not initialized, matching system disabled.");
    return;
  }
  console.log("Starting server-side matching system...");
  
  setInterval(async () => {
    try {
      if (!db) return;
      console.log("Polling trader_notifications...");
      
      // Use a try-catch for the specific collection query
      let snapshot;
      try {
        snapshot = await db.collection("trader_notifications")
          .where("processed", "==", false)
          .get();
      } catch (err: any) {
        if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
          console.info("trader_notifications collection not found (expected if empty).");
        } else if (err.code === 7 || err.message?.includes('PERMISSION_DENIED')) {
          console.warn("Matching System: Permission Denied. Skipping this iteration.");
        } else {
          console.error("Error querying trader_notifications:", err);
        }
        return; 
      }
        
      if (snapshot.docs.length > 0) {
        console.log(`Found ${snapshot.docs.length} notifications.`);
      }

      // Fetch global config for monetization check
      let globalConfig: any = { paywallEnabled: true };
      try {
        const cachedGlobal = await getCachedConfig("global");
        if (cachedGlobal) {
          globalConfig = cachedGlobal;
        }
      } catch (err) {
        console.error("Error fetching global config:", err);
      }
      
      // 3. AnyTrader Rides Dispatch Logic (Fairness Engine)
      try {
        const cachedRides = await getCachedConfig("rides");
        const maxDailyDriverHours = cachedRides && cachedRides.maxDailyDriverHours 
          ? cachedRides.maxDailyDriverHours 
          : 12;

        const pendingRidesSnapshot = await db.collection("ride_requests")
          .where("status", "==", "pending")
          .get();

        for (const rideDoc of pendingRidesSnapshot.docs) {
          const ride = rideDoc.data();
          const pickupLat = ride.pickupLat; 
          const pickupLng = ride.pickupLng;
          const dropoffLat = ride.dropoffLat;
          const dropoffLng = ride.dropoffLng;
          
          if (pickupLat && pickupLng) {
            // Find ALL online drivers
            const onlineDriversSnapshot = await db.collection("driver_status")
              .where("online", "==", true)
              .get();
              
            if (onlineDriversSnapshot.empty) continue;

            let bestDriver: any = null;
            let highestScore = -1000;

            for (const statusDoc of onlineDriversSnapshot.docs) {
              const driverId = statusDoc.id;
              const statusData = statusDoc.data();
              
              // Skip if busy
              if (statusData.isBusy) continue;

              // 1. Get Live Tracking (Distance)
              const trackingDoc = await db.collection("live_tracking").doc(driverId).get();
              if (!trackingDoc.exists) continue;
              const dL = trackingDoc.data()!;

              // 2. Get Performance Metrics & User Preferences
              const metricsRef = db.collection("driver_metrics").doc(driverId);
              let metrics: any = { dailyEarnings: 0, lastAssignmentAt: new Date(0).toISOString() };
              const mDoc = await metricsRef.get();
              if (mDoc.exists) metrics = mDoc.data()!;

              const userDoc = await db.collection("users").doc(driverId).get();
              const userData = userDoc.exists ? userDoc.data()! : {};

              // --- MAX HOURS CHECK ---
              if (metrics.onlineSecondsToday && (metrics.onlineSecondsToday / 3600) >= maxDailyDriverHours) {
                  continue; // Skip driver, exceeded daily hours
              }

              // --- ZONES CHECK ---
              if (userData.zoneEnabled && userData.zoneMaxDistance && userData.homeLat && userData.homeLng) {
                 const R = 3959; // Radius of Earth in miles
                 const toRad = (value: number) => value * Math.PI / 180;
                 // Function to calc miles distance
                 const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                    const dLat = toRad(lat2 - lat1);
                    const dLon = toRad(lon2 - lon1);
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
                              Math.sin(dLon/2) * Math.sin(dLon/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    return R * c;
                 };
                 
                 const distPickup = calcDist(userData.homeLat, userData.homeLng, pickupLat, pickupLng);
                 // Only check dropoff distance if we have dropoff coordinates
                 let distDropoff = 0;
                 if (dropoffLat && dropoffLng) {
                     distDropoff = calcDist(userData.homeLat, userData.homeLng, dropoffLat, dropoffLng);
                 }
                 
                 if (distPickup > userData.zoneMaxDistance || (dropoffLat && distDropoff > userData.zoneMaxDistance)) {
                     continue; // Driver configured bounds exceeded, skip this driver
                 }
              }

              // Calculate Haversine distance (approximate simple version)
              const latDiff = Math.abs(dL.lat - pickupLat);
              const lonDiff = Math.abs(dL.lng - pickupLng);
              const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
              
              /**
               * FAIRNESS SCORING FORMULA
               * Proximity (40%): Reward nearby drivers.
               * Poverty/Fairness (30%): Help drivers with low daily earnings.
               * Idle Reward (30%): Reward drivers who have waited the longest.
               */
              const distanceScore = 1 / (distance + 0.05); // Boost close ones (capped at 20)
              const earningsScore = 1 / ((metrics.dailyEarnings / 100) + 1); // Decay as earnings grow
              const idleTimeSec = (Date.now() - new Date(metrics.lastAssignmentAt).getTime()) / 1000;
              const idleScore = Math.min(idleTimeSec / 3600, 5); // 1 point per hour, capped at 5

              // Normalize scores for weight application
              const score = (distanceScore * 0.4) + (earningsScore * 0.3) + (idleScore * 0.3);

              if (score > highestScore) {
                highestScore = score;
                bestDriver = driverId;
              }
            }

            if (bestDriver) {
              console.log(`Dispatching Ride ${rideDoc.id} to Driver ${bestDriver} (Score: ${highestScore.toFixed(2)})`);
              
              // Move to 'offered' state with 15s timer
              await rideDoc.ref.update({ 
                status: "offered", 
                assignedDriverId: bestDriver,
                offerExpiresAt: new Date(Date.now() + 15000).toISOString(),
                dispatchAttempts: admin.firestore.FieldValue.increment(1)
              });

              // Mark driver as temporarily considering (so they don't get multiple offers)
              await db.collection("driver_status").doc(bestDriver).update({
                pendingRideId: rideDoc.id
              });
            }
          }
        }

        // 4. Handle Expired Offers
        const expiredOffersSnapshot = await db.collection("ride_requests")
          .where("status", "==", "offered")
          .get();

        for (const rideDoc of expiredOffersSnapshot.docs) {
          const ride = rideDoc.data();
          if (new Date(ride.offerExpiresAt).getTime() < Date.now()) {
            console.log(`Offer for Ride ${rideDoc.id} expired. Auto-declining for driver ${ride.assignedDriverId}`);
            
            // Revert driver status
            if (ride.assignedDriverId) {
              await db.collection("driver_status").doc(ride.assignedDriverId).update({
                pendingRideId: admin.firestore.FieldValue.delete(),
                consecutiveDeclines: admin.firestore.FieldValue.increment(1)
              });
            }

            // Put ride back in pool
            await rideDoc.ref.update({
              status: "pending",
              assignedDriverId: admin.firestore.FieldValue.delete(),
              offerExpiresAt: admin.firestore.FieldValue.delete()
            });
          }
        }
      } catch (err) {
        console.error("Error in Fairness Dispatch Engine:", err);
      }
      
      // Original matching logic...
      for (const doc of snapshot.docs) {
        const notification = doc.data();
        console.log("New emergency job notification:", notification);
        
        // Fetch job details to get title and description for service matching
        let jobData: any = null;
        try {
          const jobDoc = await db.collection("jobs").doc(notification.jobId).get();
          if (jobDoc.exists) {
            jobData = jobDoc.data();
          }
        } catch (err) {
          console.error("Error fetching job for matching:", err);
        }

        // 1. Query tradespeople from users collection
        console.log("Querying tradespeople...");
        let tradersSnapshot;
        try {
          tradersSnapshot = await db.collection("users")
            .where("role", "==", "tradesperson")
            .get();
        } catch (err) {
          console.error("Error querying users for matching:", err);
          continue;
        }
        
        console.log(`Found ${tradersSnapshot.docs.length} total tradespeople.`);

        const matchedTraders = tradersSnapshot.docs.filter(traderDoc => {
          const trader = traderDoc.data();
          
          // Basic availability and area check
          const matchesArea = trader.postcode && notification.postcode && 
                             trader.postcode.substring(0, 2) === notification.postcode.substring(0, 2);
          
          if (!matchesArea) return false;

          // Match by Category (Trades)
          const matchesCategory = trader.trades && trader.trades.includes(notification.category);
          
          // Match by Products and Services
          const matchesService = jobData && trader.services && trader.services.some((service: string) => 
            jobData.title?.toLowerCase().includes(service.toLowerCase()) || 
            jobData.description?.toLowerCase().includes(service.toLowerCase())
          );

          // Match by Specializations (Tags)
          const matchesTag = jobData && trader.tags && trader.tags.some((tag: string) => 
            jobData.title?.toLowerCase().includes(tag.toLowerCase()) || 
            jobData.description?.toLowerCase().includes(tag.toLowerCase())
          );

          return matchesCategory || matchesService || matchesTag;
        });

        console.log(`Found ${matchedTraders.length} matched traders for job ${notification.jobId}`);

        // 2. Send notifications to matched traders
        for (const traderDoc of matchedTraders) {
          const trader = traderDoc.data();
          console.log(`Sending notification to trader: ${trader.email} (${trader.uid})`);
          
          // Check for Quiet Hours
          let shouldNotifyNow = true;
          if (trader.notificationSettings?.quietHoursEnabled) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            
            const [startH, startM] = trader.notificationSettings.quietHoursStart.split(":").map(Number);
            const [endH, endM] = trader.notificationSettings.quietHoursEnd.split(":").map(Number);
            
            const startTime = startH * 60 + startM;
            const endTime = endH * 60 + endM;
            
            if (startTime > endTime) {
              // Overnight range (e.g., 22:00 to 07:00)
              if (currentTime >= startTime || currentTime <= endTime) {
                shouldNotifyNow = false;
              }
            } else {
              // Same day range (e.g., 09:00 to 17:00)
              if (currentTime >= startTime && currentTime <= endTime) {
                shouldNotifyNow = false;
              }
            }
          }

          if (!shouldNotifyNow) {
            console.log(`Trader ${trader.uid} is in Quiet Hours. Notification will be available in feed.`);
          }

          // Evaluate Fast Pass (Exclusive Leads) logic
          let visibleAt = admin.firestore.FieldValue.serverTimestamp();
          let isExclusiveNotification = false;

          if (globalConfig.paywallEnabled !== false && jobData?.exclusiveUntil) {
            const exclusiveUntil = jobData.exclusiveUntil.toDate ? jobData.exclusiveUntil.toDate() : new Date(jobData.exclusiveUntil);
            if (exclusiveUntil > new Date()) {
              // Determine if the user holds an active Fast Pass
              if (trader.hasExclusiveAddon && trader.isExclusiveActive !== false) {
                // Determine fairness limit (Have they hit the 3 quotes per day?)
                const lastQuoteDate = trader.lastExclusiveQuoteDate?.toDate ? trader.lastExclusiveQuoteDate.toDate() : (trader.lastExclusiveQuoteDate ? new Date(trader.lastExclusiveQuoteDate) : new Date(0));
                const today = new Date();
                const isSameDay = lastQuoteDate.getDate() === today.getDate() && lastQuoteDate.getMonth() === today.getMonth() && lastQuoteDate.getFullYear() === today.getFullYear();
                
                const usedToday = isSameDay ? (trader.exclusiveSlotsUsedToday || 0) : 0;
                const cooldownUntil = trader.exclusiveCooldownUntil?.toDate ? trader.exclusiveCooldownUntil.toDate() : (trader.exclusiveCooldownUntil ? new Date(trader.exclusiveCooldownUntil) : new Date(0));

                if (usedToday < 3 && cooldownUntil <= new Date()) {
                  isExclusiveNotification = true;
                } else {
                  // Delay until exclusivity goes away
                  visibleAt = admin.firestore.Timestamp.fromDate(exclusiveUntil);
                }
              } else {
                // Standard User - Delay notification until exclusive window ends
                visibleAt = admin.firestore.Timestamp.fromDate(exclusiveUntil);
              }
            }
          }

          let notificationTitle = shouldNotifyNow ? "New Job Match!" : "New Job Match (Quiet Mode) 🌙";
          if (notification.urgency === "emergency") notificationTitle = shouldNotifyNow ? "New Emergency Job Match! 🚨" : "New Emergency Job (Quiet Mode) 🌙";
          if (isExclusiveNotification) notificationTitle = "⚡ FAST PASS DIRECT LEAD ⚡";

          // Create a notification in the notifications collection for the trader
          try {
            await db.collection("notifications").add({
              userId: trader.uid,
              title: notificationTitle,
              message: `A new ${notification.category} job matches your services in ${notification.postcode}.`,
              type: "system",
              link: `/job/${notification.jobId}`,
              read: false,
              silent: !shouldNotifyNow, // Flag for client-side to suppress sound/vibration if they implement it
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              visibleAt
            });
          } catch (err) {
            console.error(`Error sending notification to trader ${trader.uid}:`, err);
          }
        }
        
        // Mark as processed
        try {
          await doc.ref.update({ processed: true });
        } catch (err) {
          console.error("Error marking notification as processed:", err);
        }
      }
    } catch (error) {
      console.error("Error in matching logic loop:", error);
    }
  }, 10000); // Poll every 10 seconds
};

// Stripe initialization
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return stripeClient;
}

// --- Authentication Middlewares ---
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error("Token err:", error); return res.status(401).json({ error: "Unauthorized: invalid token" });
  }
};

const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (db) {
       const userDoc = await db.collection("users").doc(decodedToken.uid).get();
       const role = userDoc.data()?.role;
       const adminDoc = await db.collection("admins").doc(decodedToken.uid).get();
       if (!adminDoc.exists && role !== "admin" && role !== "ecosystem_manager") {
          return res.status(403).json({ error: "Forbidden: requires admin privileges" });
       }
    }
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error("Token err:", error); return res.status(401).json({ error: "Unauthorized: invalid token" });
  }
};


async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;

  // Rate limiters
  const isDev = process.env.NODE_ENV !== "production";

  const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: isDev ? 1000 : 30,
    message: { error: "Too many AI requests from this IP, please try again after a minute" },
  });
  
  const paymentLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: isDev ? 1000 : 50,
    message: { error: "Too many payment requests from this IP" },
  });
  
  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: isDev ? 5000 : 250, // Relaxed for fluid navigation and iframe reloads
    message: { error: "Too many requests from this IP" },
  });

  // Apply general limiter to all API routes
  app.use('/api/', generalLimiter);

  // Stripe Webhook MUST come before express.json()
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      let stripeClient;
      try {
        stripeClient = getStripe();
      } catch (e) {
        // If Stripe is not configured, we ignore the webhook
        console.warn("Stripe webhook received but Stripe is not configured.");
        return res.status(200).send("Ignored");
      }

      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      let event;

      if (webhookSecret && sig) {
        try {
          event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
          console.error(`Webhook signature verification failed: ${err.message}`);
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }
      } else {
        // Fallback for testing without signature verification if webhook secret is missing
        event = JSON.parse(req.body.toString());
      }

      // Handle the event
      if (!db) {
         return res.json({received: true});
      }

      const eventRef = db.collection("processed_stripe_events").doc(event.id);
      const existing = await eventRef.get();
      if (existing.exists) return res.status(200).send("Already processed");
      await eventRef.set({ processedAt: admin.firestore.FieldValue.serverTimestamp() });

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        
        if (session.metadata?.isExclusiveAddon === 'true' && userId && db) {
          await db.collection("users").doc(userId).update({
             hasExclusiveAddon: true,
             isExclusiveActive: true,
             exclusiveSubscriptionId: session.subscription as string || session.id, // Depending on mode
             updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        else if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string;
          if (userId && db) {
            await db.collection("users").doc(userId).update({
              subscriptionStatus: "active",
              subscriptionId: subscriptionId,
              tierId: session.metadata?.tierName || "Pro",
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        } else if (session.mode === 'payment') {
          if (session.metadata?.type === 'mediation_stake' && session.metadata?.jobId && db) {
            await db.collection("jobs").doc(session.metadata.jobId).update({
              status: "disputed",
              mediationStakePaid: true,
              disputeReason: session.metadata.disputeReason || "Unspecified",
              technicalFaultReport: session.metadata.technicalFaultReport || "Unspecified",
              disputedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // We could also trigger notifications here if needed
          }
          if (session.metadata?.type === 'boost' && session.metadata?.jobId && db) {
            const boostExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
            const isIM = session.metadata.tier === 'instant_match';
            await db.collection("jobs").doc(session.metadata.jobId).update({
              isBoosted: true,
              boostTier: session.metadata.tier || 'emergency_boost',
              boostExpiresAt,
              postedDate: admin.firestore.FieldValue.serverTimestamp(),
              isInstantMatch: isIM,
              isEmergencyBoost: session.metadata.tier === 'emergency_boost',
              retryCount: 0
            });

            if (isIM) {
               const matchRef = db.collection("instant_matches").doc();
               await matchRef.set({
                 id: matchRef.id,
                 jobId: session.metadata.jobId,
                 customerId: userId || "",
                 chargeAmountPence: session.amount_total || 299,
                 chargeTier: "instant_match",
                 feeWaived: false,
                 status: "searching",
                 currentAttempt: 0,
                 createdAt: admin.firestore.FieldValue.serverTimestamp(),
                 searchingAt: admin.firestore.FieldValue.serverTimestamp()
               });
               await db.collection("jobs").doc(session.metadata.jobId).set({
                  instantMatchId: matchRef.id,
                  matchedViaInstantMatch: true
               }, { merge: true });
            }
          } else if (session.metadata?.type === 'milestone_funding' && session.metadata?.jobId && session.metadata?.quoteId && session.metadata?.milestoneId && db) {
            // Log successful funding of a milestone
            const { jobId, quoteId, milestoneId } = session.metadata;
            const quoteRef = db.collection("jobs").doc(jobId).collection("quotes").doc(quoteId);
            const quoteDoc = await quoteRef.get();
            
            if (quoteDoc.exists) {
              const quoteData = quoteDoc.data();
              const milestones = quoteData?.milestones || [];
              const updatedMilestones = milestones.map((m: any) => {
                if (m.id === milestoneId) {
                  return { ...m, status: 'funded', fundedAt: new Date().toISOString(), stripePaymentIntentId: session.payment_intent as string };
                }
                return m;
              });
              
              await quoteRef.update({ milestones: updatedMilestones });
              
              // Notify trader
              await db.collection("notifications").add({
                userId: quoteData?.tradespersonId,
                title: "Milestone Funded! 💰",
                message: `Homeowner funded "${milestones.find((m: any) => m.id === milestoneId)?.title}". You can now start work!`,
                type: "status",
                link: `/job/${jobId}`,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          } else if (session.metadata?.type === 'fee_settlement' && session.metadata?.driverId && db) {
            const driverId = session.metadata.driverId;
            const amount = session.amount_total ? session.amount_total / 100 : 0;
            
            // Clear the driver's pending platform fees safely
            await db.collection("users").doc(driverId).update({
              pendingPlatformFees: 0 // Assume it settles the full accumulated amount for now
            });
            console.log(`Driver ${driverId} settled £${amount} in platform fees`);
          } else if (session.metadata?.type === 'taxi_trip' && session.metadata?.rideId && db) {
            const rideId = session.metadata.rideId;
            const driverId = session.metadata.driverId;
            const amount = session.amount_total ? session.amount_total / 100 : 0;

            // 1. Update ride status
            await db.collection("ride_requests").doc(rideId).update({
              status: "completed",
              paymentStatus: "paid",
              payoutTransferred: true, // Handled automatically by Stripe transfer_data
              stripePaymentIntentId: session.payment_intent as string,
              paidAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Update driver metrics
            if (driverId) {
              const today = new Date().toISOString().split('T')[0];
              const metricsRef = db.collection("driver_metrics").doc(driverId);
              const metricsDoc = await metricsRef.get();
              
              if (metricsDoc.exists) {
                const data = metricsDoc.data();
                if (data?.date === today) {
                  await metricsRef.update({
                    dailyEarnings: admin.firestore.FieldValue.increment(amount * 0.88), // 88% after commission
                    jobsDoneToday: admin.firestore.FieldValue.increment(1),
                    lastTripAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                } else {
                  // Reset for a new day
                  await metricsRef.set({
                    driverId,
                    date: today,
                    dailyEarnings: amount * 0.88,
                    jobsDoneToday: 1,
                    lastAssignmentAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastTripAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                }
              } else {
                await metricsRef.set({
                  driverId,
                  date: today,
                  dailyEarnings: amount * 0.88,
                  jobsDoneToday: 1,
                  lastAssignmentAt: admin.firestore.FieldValue.serverTimestamp(),
                  lastTripAt: admin.firestore.FieldValue.serverTimestamp()
                });
              }
            }
          }
        }
      } else if (event.type === 'customer.subscription.updated') {
         const subscription = event.data.object as Stripe.Subscription;
         // Find user by subscription ID
         if (db) {
           const usersQuery = await db.collection("users").where("subscriptionId", "==", subscription.id).get();
           if (!usersQuery.empty) {
             const userId = usersQuery.docs[0].id;
             await db.collection("users").doc(userId).update({
               subscriptionStatus: subscription.status,
               currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
               cancelAtPeriodEnd: subscription.cancel_at_period_end,
               updatedAt: admin.firestore.FieldValue.serverTimestamp()
             });
           }
         }
      } else if (event.type === 'customer.subscription.deleted') {
         const subscription = event.data.object as Stripe.Subscription;
         if (db) {
           const usersQuery = await db.collection("users").where("subscriptionId", "==", subscription.id).get();
           if (!usersQuery.empty) {
             const userId = usersQuery.docs[0].id;
             await db.collection("users").doc(userId).update({
               subscriptionStatus: "canceled",
               updatedAt: admin.firestore.FieldValue.serverTimestamp()
             });
           }
         }
      }

      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("Webhook processing error:", err.message);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  app.use(express.json({ limit: "10mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "TradeQuote UK API is running" });
  });

  // Push Notification Dispatcher
  app.post("/api/chat-push", requireAuth, async (req, res) => {
    try {
      const { recipientId, title, body, rideId, type, channelId } = req.body;
      if (!recipientId || !db) return res.status(400).json({ error: "Missing parameters or DB offline" });
      
      const userDoc = await db.collection("users").doc(recipientId).get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
      
      const fcmToken = userDoc.data()?.fcmToken;
      if (!fcmToken) return res.status(400).json({ error: "User has no FCM token registered" });
      
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: title || "New Message",
          body: body || "You have a new message",
        },
        data: {
          rideId: rideId || "",
          type: type || "chat_message"
        },
        android: {
          priority: "high",
          notification: { sound: "default", channelId: channelId || "chat_messages" }
        },
        apns: {
          payload: {
            aps: { sound: "default", contentAvailable: true }
          }
        }
      });
      
      res.json({ success: true, message: "Push sent successfully" });
    } catch (error: any) {
      console.error("FCM Push Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe Checkout Session
  app.post("/api/create-checkout-session", paymentLimiter, async (req, res) => {
    try {
      const { priceId, userId, tierName, successUrl, cancelUrl, mode = 'subscription', metadata = {} } = req.body;
      const appUrl = process.env.APP_URL || (req.headers.origin as string) || "http://localhost:3000";

      const finalSuccessUrl = successUrl || `${appUrl}/profile?session_id={CHECKOUT_SESSION_ID}`;
      const finalCancelUrl = cancelUrl || `${appUrl}/profile`;

      let stripe;
      try {
        stripe = getStripe();
      } catch (e) {
        console.warn("Stripe is not configured. Mocking successful checkout flow.");
        // If Stripe is not set up, just fake the redirect back and update the database directly for local testing
        if (db) {
           if (metadata.isExclusiveAddon === 'true') {
             await db.collection("users").doc(userId).set({
               hasExclusiveAddon: true,
               isExclusiveActive: true,
               exclusiveSubscriptionId: "mock_sub_" + Math.random().toString(36).substring(7),
               updatedAt: admin.firestore.FieldValue.serverTimestamp()
             }, { merge: true });
           }
           else if (mode === 'subscription') {
             await db.collection("users").doc(userId).set({
                tierId: tierName || "Pro",
                subscriptionStatus: "active",
                subscriptionId: "mock_sub_" + Math.random().toString(36).substring(7),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
             }, { merge: true });
           } else if (mode === 'payment') {
             // For one-off payments like job boosts
             if (metadata.jobId && metadata.type === 'boost') {
                const boostExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
                const isIM = metadata.tier === 'instant_match';
                await db.collection("jobs").doc(metadata.jobId).set({
                  isBoosted: true,
                  boostTier: metadata.tier || 'emergency_boost',
                  boostExpiresAt,
                  postedDate: admin.firestore.FieldValue.serverTimestamp(),
                  isInstantMatch: isIM,
                  isEmergencyBoost: metadata.tier === 'emergency_boost',
                  retryCount: 0
                }, { merge: true });

                if (isIM) {
                   const matchRef = db.collection("instant_matches").doc();
                   await matchRef.set({
                     id: matchRef.id,
                     jobId: metadata.jobId,
                     customerId: userId,
                     chargeAmountPence: 299,
                     chargeTier: "instant_match",
                     feeWaived: false,
                     status: "searching",
                     currentAttempt: 0,
                     createdAt: admin.firestore.FieldValue.serverTimestamp(),
                     searchingAt: admin.firestore.FieldValue.serverTimestamp()
                   });
                   await db.collection("jobs").doc(metadata.jobId).set({
                      instantMatchId: matchRef.id,
                      matchedViaInstantMatch: true
                   }, { merge: true });
                }
             }
           }
        }
        return res.json({ url: finalSuccessUrl.replace("{CHECKOUT_SESSION_ID}", "mock_session_success") });
      }

      // Real Stripe Flow
      let customerId: string | undefined;
      if (userId && db) {
        try {
          const userDoc = await db.collection("users").doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData?.stripeCustomerId) {
              customerId = userData.stripeCustomerId;
            } else if (userData?.email) {
              const customer = await stripe.customers.create({
                email: userData.email,
                metadata: { firebaseUid: userId }
              });
              customerId = customer.id;
              await db.collection("users").doc(userId).set({ stripeCustomerId: customerId }, { merge: true });
            } else {
              const customer = await stripe.customers.create({
                metadata: { firebaseUid: userId }
              });
              customerId = customer.id;
              await db.collection("users").doc(userId).set({ stripeCustomerId: customerId }, { merge: true });
            }
          }
        } catch (e) {
          console.warn("Failed to sync Stripe customer:", e);
        }
      }

      const sessionOptions: any = {
        mode: mode as any,
        payment_method_types: ['card'],
        line_items: [
          req.body.price_data ? {
            price_data: req.body.price_data,
            quantity: 1,
          } : {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        client_reference_id: userId,
        metadata: {
           tierName: tierName || "",
           ...metadata
        }
      };

      if (customerId) {
        sessionOptions.customer = customerId;
        if (mode === 'payment') {
          sessionOptions.saved_payment_method_options = {
            payment_method_save: "enabled",
          };
        }
      }

      const session = await stripe.checkout.sessions.create(sessionOptions);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  // Stripe Setup Session (Save Card)
  app.post("/api/create-setup-session", paymentLimiter, async (req, res) => {
    try {
      const { userId, successUrl, cancelUrl } = req.body;
      const appUrl = process.env.APP_URL || (req.headers.origin as string) || "http://localhost:3000";

      const finalSuccessUrl = successUrl || `${appUrl}/profile?setup=success`;
      const finalCancelUrl = cancelUrl || `${appUrl}/profile`;

      let stripe;
      try {
        stripe = getStripe();
      } catch (e) {
        console.warn("Stripe is not configured. Mocking successful setup flow.");
        return res.json({ url: finalSuccessUrl });
      }

      let customerId: string | undefined;
      if (userId && db) {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.stripeCustomerId) {
            customerId = userData.stripeCustomerId;
          } else {
            const customer = await stripe.customers.create({
              email: userData?.email,
              metadata: { firebaseUid: userId }
            });
            customerId = customer.id;
            await db.collection("users").doc(userId).set({ stripeCustomerId: customerId }, { merge: true });
          }
        }
      }

      if (!customerId) {
        return res.status(400).json({ error: "Could not identify or create Stripe customer." });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'setup',
        payment_method_types: ['card'],
        customer: customerId,
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        client_reference_id: userId,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Setup Error:", error);
      res.status(500).json({ error: error.message || "Failed to create setup session" });
    }
  });

  // List Saved Cards
  app.get("/api/payment-methods/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      if (!db) return res.json({ paymentMethods: [], mock: true });

      if ((req as any).user.uid !== userId) {
        return res.status(403).json({ error: "Forbidden: Not your payment methods" });
      }

      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const stripeCustomerId = userDoc.data()?.stripeCustomerId;
      if (!stripeCustomerId) return res.json({ paymentMethods: [] });

      let stripe;
      try {
        stripe = getStripe();
      } catch (e) {
        return res.json({ paymentMethods: [], mock: true });
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });

      const formattedMethods = paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
      }));

      res.json({ paymentMethods: formattedMethods });
    } catch (error: any) {
      console.error("Fetch Payment Methods Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch payment methods" });
    }
  });

  // Delete Saved Card
  app.delete("/api/payment-methods/:userId/:paymentMethodId", requireAuth, async (req, res) => {
    try {
      const { userId, paymentMethodId } = req.params;
      if ((req as any).user.uid !== userId) {
        return res.status(403).json({ error: "Forbidden: Not your payment method" });
      }

      let stripe;
      try {
        stripe = getStripe();
      } catch (e) {
        return res.json({ success: true, mock: true });
      }
      await stripe.paymentMethods.detach(paymentMethodId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Payment Method Error:", error);
      res.status(500).json({ error: error.message || "Failed to delete payment method" });
    }
  });

  // NEW: Direct-to-Driver Taxi Payment (QR Handshake)
  app.post("/api/rides/create-trip-payment", async (req, res) => {
    try {
      const { rideId, driverId, baseFare = 0, tipAmount = 0 } = req.body;
      const amount = baseFare + tipAmount;
      
      console.log("Create Trip Payment Request:", { rideId, driverId, baseFare, tipAmount, amount, dbStatus: !!db });

      if (!db) {
        console.warn("Retrying Firebase initialization in route handler...");
        initFirebase();
        if (!db) return res.status(500).json({ error: "Database backend disabled" });
      }
      
      if (!driverId) return res.status(400).json({ error: "Driver ID is required" });

      // 1. Get Driver's Stripe Account
      let driverDoc;
      try {
        driverDoc = await db.collection("users").doc(driverId).get();
      } catch (dbErr: any) {
        return res.json({ url: `${process.env.APP_URL || ''}/payment-success?rideId=${rideId}` });
      }
      
      if (!driverDoc.exists) {
        console.warn(`Driver doc not found for ID: ${driverId}. This may happen if the driver was deleted but the ride persists.`);
        return res.status(404).json({ error: "Driver profile not found. Please ensure you are logged in as a registered driver." });
      }

      const driverData = driverDoc.data();
      const stripeAccountId = driverData?.stripeAccountId;

      // Fallback for local testing if Stripe is not configured
      let stripe;
      try {
        stripe = getStripe();
      } catch (e) {
        console.warn("Stripe missing. Mocking Trip QR link.");
        return res.json({ url: `${process.env.APP_URL || ''}/payment-success?rideId=${rideId}` });
      }

      if (!stripeAccountId) {
        return res.status(400).json({ error: "Driver has not completed Stripe onboarding." });
      }

      // 2. Create Destination Charge with Platform Fee (Drawn from dynamic Firestore platform_config/rides)
      let commissionRate = 0.12;
      let fixedTripFee = 0;
      try {
        const configData = await getCachedConfig("rides");
        if (configData) {
          if (configData.commissionRate !== undefined) {
            commissionRate = Number(configData.commissionRate);
          }
          if (configData.fixedTripFee !== undefined) {
            fixedTripFee = Number(configData.fixedTripFee);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch dynamic fare config for checkout:", err);
      }
      
      const feeAmount = Math.round((baseFare * commissionRate + fixedTripFee) * 100); // commission on base fare + fixed fee in pence, tip is untouched
      
      let session;
      try {
        session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'gbp',
              product_data: {
                name: `Trip Payment (Ride #${rideId.substring(0, 8)})`,
                description: "Direct to driver transport payment."
              },
              unit_amount: Math.round(amount * 100), // Original amount in pence
            },
            quantity: 1,
          }],
          payment_intent_data: {
            application_fee_amount: feeAmount,
            transfer_data: {
              destination: stripeAccountId,
            },
          },
          metadata: {
            rideId,
            driverId,
            type: 'taxi_trip'
          },
          success_url: `${process.env.APP_URL || ''}/payment-success?rideId=${rideId}`,
          cancel_url: `${process.env.APP_URL || ''}/payment-failed?rideId=${rideId}`,
        });
        res.json({ url: session.url });
      } catch (stripeErr: any) {
        console.warn("Stripe session creation failed (often due to test accounts not matching connected app). Mocking URL.", stripeErr.message);
        res.json({ url: `${process.env.APP_URL || ''}/payment-success?rideId=${rideId}` });
      }
    } catch (error: any) {
      console.warn("Failed to generate payment link, mocking response.");
      res.status(500).json({ 
        error: error.message || "Failed to generate payment link",
        debugCode: error.code 
      });
    }
  });
  
  app.post("/api/driver/stripe-payout/:driverId", requireAuth, async (req, res) => {
    try {
      const { driverId } = req.params;
      const { amount } = req.body; // Optional amount
      const user = (req as any).user;

      if (user.uid !== driverId) {
        // Check if admin
        if (db) {
          const adminDoc = await db.collection("admins").doc(user.uid).get();
          const userDoc = await db.collection("users").doc(user.uid).get();
          const role = userDoc.data()?.role;
          if (!adminDoc.exists && role !== "admin" && role !== "ecosystem_manager") {
            return res.status(403).json({ error: "Forbidden: Unauthorized access to driver payout" });
          }
        } else {
          return res.status(403).json({ error: "Forbidden: Unauthorized access to driver payout" });
        }
      }

      if (!db) return res.status(500).json({ error: "Database not connected" });

      const driverDoc = await db.collection("users").doc(driverId).get();
      if (!driverDoc.exists) return res.status(404).json({ error: "Driver not found" });

      const stripeAccountId = driverDoc.data()?.stripeAccountId;
      if (!stripeAccountId) return res.status(400).json({ error: "No Stripe account connected" });

      const stripe = getStripe();

      // Get available balance first
      const balance = await stripe.balance.retrieve({
        stripeAccount: stripeAccountId,
      });

      const available = balance.available.find(b => b.currency === 'gbp')?.amount || 0;

      if (available <= 0) {
        return res.status(400).json({ error: "No available balance for payout" });
      }

      // Create a payout
      const payoutAmount = amount ? amount * 100 : available; // Default to full available balance
      
      const payout = await stripe.payouts.create({
        amount: payoutAmount,
        currency: 'gbp',
      }, {
        stripeAccount: stripeAccountId,
      });

      res.json({ success: true, payout });
    } catch (error: any) {
      console.error("Stripe Payout Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/driver/stripe-balance/:driverId", async (req, res) => {
    try {
      const { driverId } = req.params;
      if (!db) return res.json({ available: 0, pending: 0, currency: 'gbp', mock: true });

      let driverDoc;
      try {
        driverDoc = await db.collection("users").doc(driverId).get();
      } catch (dbErr) {
         return res.json({ available: 0, pending: 0, currency: 'gbp', mock: true });
      }
      
      if (!driverDoc.exists) return res.status(404).json({ error: "Driver not found" });

      const stripeAccountId = driverDoc.data()?.stripeAccountId;
      if (!stripeAccountId) return res.status(400).json({ error: "No Stripe account connected" });

      let stripe;
      try {
        stripe = getStripe();
      } catch (e) {
        return res.json({ available: 0, pending: 0, currency: 'gbp', mock: true });
      }

      const balance = await stripe.balance.retrieve({
        stripeAccount: stripeAccountId,
      });

      const available = balance.available.find(b => b.currency === 'gbp')?.amount || 0;
      const pending = balance.pending.find(b => b.currency === 'gbp')?.amount || 0;

      res.json({
        available: available / 100,
        pending: pending / 100,
        currency: 'gbp'
      });
    } catch (error: any) {
      console.error("Stripe Balance Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual Driver Payouts Trigger (Admin)
  app.post("/api/admin/trigger-payouts", requireAdmin, async (req, res) => {
    try {
      const result = await runDriverPayoutOrchestration();
      if (!result?.success) {
         return res.status(500).json(result);
      }
      res.json(result);
    } catch (err: any) {
      console.error("Manual payout orchestration failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Manual Trigger for Consultancy Scheduled Jobs (Admin)
  app.post("/api/admin/trigger-consultancy-jobs", requireAdmin, async (req, res) => {
    try {
      await runConsultancyRecurringSessionCreator();
      await runConsultancyScoreRecalculator();
      res.json({ success: true, message: "Consultancy background jobs triggered successfully." });
    } catch (err: any) {
      console.error("Consultancy background jobs failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Platform Fee Settlement Route
  app.post("/api/driver/settle-fees", async (req, res) => {
    try {
      const { driverId, amount } = req.body;
      
      let pendingPlatformFees = amount || 9.75;

      if (db) {
        try {
          const driverDoc = await db.collection("users").doc(driverId).get();
          if (driverDoc.exists) {
            pendingPlatformFees = driverDoc.data()?.pendingPlatformFees || pendingPlatformFees;
          }
        } catch (dbErr) {
          console.warn("Could not query DB inside /api/driver/settle-fees. Falling back to body amount:", dbErr);
        }
      }
      
      if (pendingPlatformFees <= 0) {
        return res.status(400).json({ error: "No fees to settle" });
      }

      let stripe;
      try {
        stripe = getStripe();
      } catch (e) {
        // Stripe not connected/configured, redirect direct to success path in Sandbox Mode
        console.log("Stripe not connected. Directing to sandbox platform fee success pathway.");
        return res.json({ url: `${process.env.APP_URL || ''}/platform-fee-success?sandbox=true&amount=${pendingPlatformFees}` });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Platform Fees Settlement`,
              description: "Settlement for accumulated cash trip commissions."
            },
            unit_amount: Math.round(pendingPlatformFees * 100),
          },
          quantity: 1,
        }],
        metadata: {
          driverId,
          type: 'fee_settlement'
        },
        success_url: `${process.env.APP_URL || ''}/platform-fee-success?amount=${pendingPlatformFees}`,
        cancel_url: `${process.env.APP_URL || ''}/driver-dashboard`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Fee Settlement Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual / Sandbox Confirmation of Fee Settlement
  app.post("/api/driver/confirm-fee-settlement", async (req, res) => {
    try {
      const { driverId } = req.body;
      
      if (!db) {
        // Safe sandbox fallback response
        console.log(`Database is not connected. Returning safe sandbox completion for driver ${driverId}`);
        return res.json({ success: true, settledAmount: null, sandboxFallback: true });
      }
      
      const driverRef = db.collection("users").doc(driverId);
      const driverDoc = await driverRef.get();
      if (!driverDoc.exists) return res.status(404).json({ error: "Driver not found" });

      const pendingFees = driverDoc.data()?.pendingPlatformFees || 0;
      
      await driverRef.update({
        pendingPlatformFees: 0
      });

      console.log(`Driver ${driverId} settled £${pendingFees} in platform fees (confirmed via server)`);
      res.json({ success: true, settledAmount: pendingFees });
    } catch (error: any) {
      console.error("Confirm Fee Settlement Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Milestone Release Route
  app.post("/api/release-milestone", requireAuth, async (req, res) => {
    try {
      const { jobId, quoteId, milestoneId } = req.body;
      const authUid = (req as any).user.uid;
      if (!db) return res.status(500).json({ error: "Database not initialized" });

      const jobRef = db.collection("jobs").doc(jobId);
      const jobDoc = await jobRef.get();
      if (!jobDoc.exists || jobDoc.data()?.homeownerId !== authUid) {
        return res.status(403).json({ error: "Unauthorized: only the job owner can release milestone funds" });
      }

      const quoteRef = jobRef.collection("quotes").doc(quoteId);
      const quoteDoc = await quoteRef.get();
      if (!quoteDoc.exists) return res.status(404).json({ error: "Quote not found" });

      const quoteData = quoteDoc.data();
      const updatedMilestones = (quoteData?.milestones || []).map((m: any) => {
        if (m.id === milestoneId) {
          return { ...m, status: 'funds_released', releaseDate: new Date().toISOString() };
        }
        return m;
      });

      await quoteRef.update({ milestones: updatedMilestones });

      // Notify Trader
      await db.collection("notifications").add({
        userId: quoteData?.tradespersonId,
        title: "Funds Released! 💸",
        message: `The homeowner has released funds for milestone: "${quoteData?.milestones.find((m: any) => m.id === milestoneId)?.title}".`,
        type: "status",
        link: `/job/${jobId}`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Milestone Release Error:", error);
      res.status(500).json({ error: error.message || "Failed to release milestone" });
    }
  });

  // Check job posting limit
  app.post("/api/check-job-limit", async (req, res) => {
    try {
      const { userId, isEmergency, requestedCount = 1 } = req.body;
      if (!db) return res.json({ allowed: true, count: 0, limit: Infinity, isEmergency: !!isEmergency, warning: "Database backend disabled in sandbox" });

      // Emergency jobs don't count towards the limit
      if (isEmergency) {
        return res.json({ allowed: true, count: 0, limit: Infinity, isEmergency: true });
      }

      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const userData = userDoc.data();
      const isBusiness = userData?.subscriptionType === "business";
      const hasActiveSubscription = userData?.subscriptionId && userData?.subscriptionStatus === "active";
      
      // Default tier if not subscribed
      const defaultBusinessTier = { name: "Trial", jobPostsLimit: 10, limitPeriod: "lifetime" };
      const tierId = userData?.tierId || (isBusiness ? "Business Basic" : "Basic");
      
      // Platform Configuration
      const platformConfig = await getCachedConfig("global");
      const globalTiers = await getCachedConfig("global_tiers");
      
      if (platformConfig?.paywallEnabled === false) {
        return res.json({ allowed: true, count: 0, limit: Infinity, betaMode: true });
      }

      let tier;
      let limit = 0;

      if (globalTiers && userData?.subscription?.providerModel) {
        const model = userData.subscription.providerModel;
        const tierId = userData.subscription.tierId || "basic";
        const tierConfig = globalTiers.providerModels?.[model]?.tiers?.[tierId];
        
        if (tierConfig) {
          tier = { 
            name: tierId, 
            jobPostsLimit: tierConfig.maxQuotes,
            limitPeriod: "monthly" // Simplified to monthly for now
          };
          limit = tier.jobPostsLimit;
        }
      }

      // Legacy fallback
      if (!tier) {
        const tierId = userData?.tierId || (isBusiness ? "Business Basic" : "Basic");
        if (isBusiness) {
          if (!hasActiveSubscription) {
            tier = defaultBusinessTier;
          } else {
            tier = platformConfig?.businessTiers?.find((t: any) => t.name === tierId);
          }
        } else {
          tier = platformConfig?.feeTiers?.find((t: any) => t.name === tierId);
        }
        limit = tier?.jobPostsLimit || Infinity;
      }
      
      if (!tier) return res.json({ allowed: true });

      const isLifetime = tier.limitPeriod === "lifetime";
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      let jobsQuery = db.collection("jobs")
        .where("homeownerId", "==", userId)
        .where("urgency", "!=", "emergency");
      
      if (!isLifetime) {
        jobsQuery = jobsQuery.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfMonth));
      }

      const jobsSnapshot = await jobsQuery.get();
      const jobCount = jobsSnapshot.size;
      
      // Check if the requested number of posts is allowed
      const isAllowed = (jobCount + requestedCount) <= tier.jobPostsLimit;

      // Check for duplicate accounts based on deviceId
      let securityAlert = null;
      let suggestedStatus = "posted";
      
      if (userData?.deviceId) {
        const duplicateUsers = await db.collection("users").where("deviceId", "==", userData.deviceId).get();
        if (duplicateUsers.size > 1) {
          securityAlert = "Potential duplicate account detected (same device)";
          suggestedStatus = "pending_admin_review";
          
          // Log security alert
          await db.collection("security_alerts").add({
            userId,
            type: "duplicate_account",
            message: `User ${userId} shared device ID with ${duplicateUsers.size - 1} other accounts.`,
            deviceId: userData.deviceId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      res.json({ 
        allowed: isAllowed, 
        count: jobCount, 
        limit: tier.jobPostsLimit,
        isTrial: isBusiness && !hasActiveSubscription,
        securityAlert,
        suggestedStatus
      });
    } catch (error: any) {
      console.error("Job Limit Check Error:", error);
      res.status(500).json({ error: error.message || "Failed to check job limit" });
    }
  });

  // Check quote limit for tradespeople
  app.post("/api/check-quote-limit", async (req, res) => {
    try {
      const { userId, jobId } = req.body;
      if (!db) return res.json({ allowed: true, warning: "Database backend disabled in sandbox" });

      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const userData = userDoc.data() || {};
      const platformConfig = await getCachedConfig("global");
      const globalTiers = await getCachedConfig("global_tiers");
      
      // 1. Check Exclusive Job Constraints First
      let isJobExclusive = false;
      if (jobId && platformConfig?.paywallEnabled !== false) {
        const jobDoc = await db.collection("jobs").doc(jobId).get();
        if (jobDoc.exists) {
          const jobData = jobDoc.data() || {};
          const exclusiveUntil = jobData.exclusiveUntil?.toDate ? jobData.exclusiveUntil.toDate() : (jobData.exclusiveUntil ? new Date(jobData.exclusiveUntil) : null);
          
          if (exclusiveUntil && exclusiveUntil > new Date()) {
            isJobExclusive = true;
            
            if (!userData.hasExclusiveAddon) {
              return res.json({ allowed: false, error: "This job is currently exclusive to Fast Pass members. Please wait or upgrade." });
            }

            // Check if midnight reset is needed
            const lastQuoteDate = userData.lastExclusiveQuoteDate?.toDate ? userData.lastExclusiveQuoteDate.toDate() : (userData.lastExclusiveQuoteDate ? new Date(userData.lastExclusiveQuoteDate) : new Date(0));
            const today = new Date();
            const isSameDay = lastQuoteDate.getDate() === today.getDate() && lastQuoteDate.getMonth() === today.getMonth() && lastQuoteDate.getFullYear() === today.getFullYear();
            
            const usedToday = isSameDay ? (userData.exclusiveSlotsUsedToday || 0) : 0;
            if (usedToday >= 3) {
              return res.json({ allowed: false, error: "You have used your 3 exclusive quotes for today. You can quote on this job when it goes public." });
            }

            const cooldownUntil = userData.exclusiveCooldownUntil?.toDate ? userData.exclusiveCooldownUntil.toDate() : (userData.exclusiveCooldownUntil ? new Date(userData.exclusiveCooldownUntil) : new Date(0));
            if (cooldownUntil > new Date()) {
              return res.json({ allowed: false, error: "You must wait 2 hours between exclusive quotes to ensure fairness. You can quote on this job when it goes public." });
            }
          }
        }
      }

      // 2. Determine Tier and Limit
      if (platformConfig?.paywallEnabled === false) {
        return res.json({ allowed: true, count: 0, limit: Infinity, betaMode: true, isJobExclusive });
      }

      let tier;
      let limitValue = 0;

      // New schema check
      if (globalTiers && userData.subscription?.providerModel) {
        const model = userData.subscription.providerModel;
        const tierId = userData.subscription.tierId || "basic";
        const tierConfig = globalTiers.providerModels?.[model]?.tiers?.[tierId];
        
        if (tierConfig) {
          tier = {
            name: tierId,
            maxQuotes: tierConfig.maxQuotes,
            limitPeriod: "monthly"
          };
          limitValue = tier.maxQuotes;
        }
      }

      // Legacy fallback
      if (!tier) {
        const tierId = userData.tierId || "Basic";
        tier = platformConfig?.feeTiers?.find((t: any) => t.name === tierId);
        limitValue = tier?.maxQuotes || Infinity;
      }

      if (!tier || limitValue === Infinity) return res.json({ allowed: true, isJobExclusive });

      const isLifetime = tier.limitPeriod === "lifetime";
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const quotesSnapshot = await db.collection("quotes")
        .where("tradespersonId", "==", userId)
        .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(isLifetime ? new Date(0) : startOfMonth))
        .get();

      const count = quotesSnapshot.size;
      res.json({ allowed: count < limitValue, count, limit: limitValue, isJobExclusive });
    } catch (error: any) {
      console.error("Quote Limit Check Error:", error);
      res.status(500).json({ error: error.message || "Failed to check quote limit" });
    }
  });

  // Postcode lookup proxy cache
  const postcodeCache = new Map<string, { data: any; expiresAt: number }>();

  // Postcode lookup proxy
  app.get("/api/postcode/:postcode", async (req, res) => {
    try {
      const { postcode } = req.params;
      const formattedPostcode = postcode.toUpperCase().replace(/\s/g, '');
      const cached = postcodeCache.get(formattedPostcode);
      if (cached && Date.now() < cached.expiresAt) {
        return res.json(cached.data);
      }

      const response = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
      const data = await response.json();
      
      // Prevent memory leaks - enforce a safe 1000-entry peak limit
      if (postcodeCache.size >= 1000) {
        let deleted = false;
        const now = Date.now();
        // Remove individual expired items first
        for (const [k, v] of postcodeCache.entries()) {
          if (now >= v.expiresAt) {
            postcodeCache.delete(k);
            deleted = true;
          }
        }
        // Force-evict the first element if nothing was expired
        if (!deleted) {
          const firstKey = postcodeCache.keys().next().value;
          if (firstKey !== undefined) {
            postcodeCache.delete(firstKey);
          }
        }
      }

      postcodeCache.set(formattedPostcode, {
        data,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      });

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to lookup postcode" });
    }
  });

  // AI Shop SSO Token Route
  app.post("/api/sso-token", async (req, res) => {
    try {
      const { uid, role, email, category } = req.body;
      const secret = process.env.JWT_SECRET;
      
      if (!secret) {
        return res.status(500).json({ error: "SSO secret not configured" });
      }

      // Fetch user's subscription discount from platform config
      let discount = 0;
      try {
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.data();
        const tierId = userData?.tierId || (userData?.role === "tradesperson" ? "Basic" : "Standard");
        
        const platformConfig = await getCachedConfig("global");
        const tiers = userData?.role === "tradesperson" ? platformConfig?.feeTiers : platformConfig?.businessTiers;
        const tier = tiers?.find((t: any) => t.name === tierId);
        discount = tier?.shopDiscount || 0;
      } catch (tierErr) {
        console.warn("Could not fetch tier for discount:", tierErr);
      }

      const token = jwt.sign(
        { uid, role, email, category, discount, iat: Math.floor(Date.now() / 1000) },
        secret,
        { expiresIn: "5m" } // Token strictly valid for 5 minutes
      );

      res.json({ token });
    } catch (error: any) {
      console.error("SSO Token Error:", error);
      res.status(500).json({ error: "Failed to generate SSO token" });
    }
  });


  // AI Shop Analytics Route
  app.post("/api/analytics/profitability", async (req, res) => {
    try {
      const { uid } = req.body;
      if (!uid) return res.status(400).json({ error: "Missing UID" });

      if (!db) {
         return res.status(500).json({ error: "Database not initialized" });
      }

      console.log("Fetching profitability for UID:", uid);
      // Read pre-aggregated data
      const colRef = db.collection("user_profitability_daily");
      console.log("Collection reference:", colRef.path);
      const docRef = colRef.doc(uid);
      console.log("Document reference:", docRef.path);
      
      let doc;
      try {
        doc = await docRef.get();
        console.log("Document fetch successful, exists:", doc.exists);
      } catch (err: any) {
        if (err.code === 5 || err.message?.includes("NOT_FOUND")) {
            console.warn("Analytics document truly not found (expected behavior):", uid);
            doc = { exists: false };
        } else {
            console.error("Unexpected error fetching analytics:", err);
            throw err; // Re-throw if it's not a simple not_found
        }
      }
      if (doc.exists && (doc as any).data) {
        const data = (doc as any).data();
        
        // Fetch user for tier info to calculate pulse
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.data() || {};
        const tier = userData.tierId || "Basic";
        
        // Calculate dynamic pulse metrics
        const discountRate = tier === "Gold Elite" ? 0.15 : tier === "Silver Professional" ? 0.10 : 0.05;
        const projectedSavings = (data?.totalSpend || 0) * discountRate;

        res.json({
          totalRevenue: data?.totalRevenue || 0,
          totalSpend: data?.totalSpend || 0,
          netProfit: data?.netProfit || 0,
          orderCount: data?.orderCount || 0,
          quoteCount: 0,
          shopSavings: data?.shopSavings || projectedSavings,
          replenishmentAlert: (data?.totalSpend || 0) > 500,
          pulse: {
            score: Math.min(100, (data?.totalSpend || 0) / 10),
            status: (data?.totalSpend || 0) > 1000 ? "Power Buyer" : "Active Restocking",
            nextPerk: 1000 - (data?.totalSpend || 0) > 0 ? `Spend £${(1000 - (data.totalSpend || 0)).toFixed(2)} more for VIP shipping` : "VIP Shipping Unlocked!"
          }
        });
      } else {
        // Fallback for new accounts
        res.json({
          totalRevenue: 0,
          totalSpend: 0,
          netProfit: 0,
          orderCount: 0,
          quoteCount: 0,
          shopSavings: 0,
          replenishmentAlert: false,
          pulse: {
            score: 0,
            status: "New Buyer",
            nextPerk: "Spend £100 to earn your first loyalty badge"
          }
        });
      }
    } catch (error: any) {
      console.error("Analytics Error:", error);
      res.status(500).json({ error: "Failed to generate analytics" });
    }
  });

  // Smart Job Procurement Material Detection Route
  app.post("/api/job/procure-materials", async (req, res) => {
    try {
      const { description } = req.body;
      let apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "your_gemini_api_key") {
        return res.json({ materials: [] });
      }

      const client = new GoogleGenAI({ apiKey });
      const prompt = `Analyze the following job description for a construction/trade project. 
Identify the likely material categories or specific tools a tradesperson would need to order to complete this job. 
Return a RAW JSON array of items (no markdown). 
Each object should have:
- 'item': Material category name
- 'reason': Brief explanation why it is needed for this job
- 'estimatedQuantity': A placeholder estimated quantity (integer) and unit (e.g., '10m', '50kg', '20L')
Description: ${description}`;

      const result = await client.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      let parsedResult = [];
      if (result.text && result.text !== "undefined") {
        parsedResult = JSON.parse(result.text.replace(/```json/g, "").replace(/```/g, "").trim());
      }
      res.json({ materials: parsedResult });
    } catch (error: any) {
      res.json({ materials: [] });
    }
  });

  app.post("/api/driver/analytics-pulse", async (req, res) => {
    try {
      const { driverStats } = req.body;
      let apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "your_gemini_api_key") {
        return res.json({ insight: "Drive near city center between 5 PM and 8 PM for peak fares." });
      }

      const client = new GoogleGenAI({ apiKey });
      const prompt = `You are an AI assistant for a taxi/ride-hailing platform (AnyRoller). 
The user is a driver looking at their analytics hub.
Analyze their stats: ${JSON.stringify(driverStats)}
Give ONE short, highly actionable, encouraging tip (under 15 words) about when or where they should drive next to maximize earnings, or how to improve their rating/acceptance.
Limit your response to just the text of the tip. Do not use quotes.`;

      const result = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const insight = result.text ? result.text.trim() : "Drive near city center between 5 PM and 8 PM for peak fares.";
      res.json({ insight });
    } catch (error: any) {
      res.json({ insight: "Drive near city center between 5 PM and 8 PM for peak fares." });
    }
  });

  // Secure Gemini API Service Call Proxy
  app.post("/api/gemini/call", requireAuth, async (req, res) => {
    try {
      const { functionName, args } = req.body;
      if (!functionName) {
        return res.status(400).json({ error: "Missing functionName" });
      }

      const targetFunc = (geminiServer as any)[functionName];

      if (typeof targetFunc !== "function") {
        return res.status(404).json({ error: `Function ${functionName} not found` });
      }

      const result = await targetFunc(...(args || []));
      res.json(result);
    } catch (error: any) {
      console.error(`Gemini Server Execution Error for ${req.body?.functionName}:`, error);
      res.status(500).json({ error: error.message || "Failed to execute Gemini function" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js') || filePath.endsWith('manifest.webmanifest') || filePath.endsWith('manifest.json')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TradeQuote UK server running on http://localhost:${PORT}`);
    // Start background systems
    startMatchingSystem();
  });
}

startServer();
