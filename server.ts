import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { GoogleGenAI } from "@google/genai";
import jwt from "jsonwebtoken";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let db: admin.firestore.Firestore | null = null;
try {
  const app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
  console.log("Firebase Admin initialized successfully.");
  
  db = admin.firestore(app);
  // Note: admin.firestore() doesn't directly take a databaseId in the same way as the client SDK.
  // For now, we use the default database.
  console.log("Firestore initialized.");
  console.log("Firestore database ID:", db.databaseId);
} catch (error) {
  console.error("Error initializing Firebase:", error);
  // Do not exit, allow server to start even if Firebase fails
}

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
        if (err.code === 5) { // NOT_FOUND
          console.info("trader_notifications collection not found (expected if empty).");
        } else {
          console.error("Error querying trader_notifications:", err);
        }
        return; // Skip this iteration if collection not found or other error
      }
        
      if (snapshot.docs.length > 0) {
        console.log(`Found ${snapshot.docs.length} notifications.`);
      }

      // Fetch global config for monetization check
      let globalConfig: any = { paywallEnabled: true };
      try {
        const configDoc = await db.collection("platform_config").doc("global").get();
        if (configDoc.exists) {
          globalConfig = configDoc.data();
        }
      } catch (err) {
        console.error("Error fetching global config:", err);
      }
      
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

import Stripe from 'stripe';

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

async function startServer() {
  const app = express();
  const PORT = 3000;

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
          if (session.metadata?.type === 'boost' && session.metadata?.jobId && db) {
            const boostExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
            await db.collection("jobs").doc(session.metadata.jobId).update({
              isBoosted: true,
              boostExpiresAt,
              postedDate: admin.firestore.FieldValue.serverTimestamp(),
              retryCount: 0
            });
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

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "TradeQuote UK API is running" });
  });

  // Stripe Checkout Session
  app.post("/api/create-checkout-session", async (req, res) => {
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
             await db.collection("users").doc(userId).update({
               hasExclusiveAddon: true,
               isExclusiveActive: true,
               exclusiveSubscriptionId: "mock_sub_" + Math.random().toString(36).substring(7),
               updatedAt: admin.firestore.FieldValue.serverTimestamp()
             });
           }
           else if (mode === 'subscription') {
             await db.collection("users").doc(userId).update({
                tierId: tierName || "Pro",
                subscriptionStatus: "active",
                subscriptionId: "mock_sub_" + Math.random().toString(36).substring(7),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
             });
           } else if (mode === 'payment') {
             // For one-off payments like job boosts
             if (metadata.jobId && metadata.type === 'boost') {
                const boostExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
                await db.collection("jobs").doc(metadata.jobId).update({
                  isBoosted: true,
                  boostExpiresAt,
                  postedDate: admin.firestore.FieldValue.serverTimestamp(),
                  retryCount: 0
                });
             }
           }
        }
        return res.json({ url: finalSuccessUrl.replace("{CHECKOUT_SESSION_ID}", "mock_session_success") });
      }

      // Real Stripe Flow
      const session = await stripe.checkout.sessions.create({
        mode: mode as any,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId, // Note: Expects an actual Stripe Price ID
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
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  // Check job posting limit
  app.post("/api/check-job-limit", async (req, res) => {
    try {
      const { userId, isEmergency, requestedCount = 1 } = req.body;
      if (!db) return res.status(500).json({ error: "Database not initialized" });

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
      
      const platformConfig = (await db.collection("platform_config").doc("global").get()).data();
      
      if (platformConfig?.paywallEnabled === false) {
        return res.json({ allowed: true, count: 0, limit: Infinity, betaMode: true });
      }

      let tier;
      if (isBusiness) {
        if (!hasActiveSubscription) {
          tier = defaultBusinessTier;
        } else {
          tier = platformConfig?.businessTiers?.find((t: any) => t.name === tierId);
        }
      } else {
        tier = platformConfig?.feeTiers?.find((t: any) => t.name === tierId);
      }
      
      if (!tier) return res.json({ allowed: true }); // No tier found, allow by default or handle as needed

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
      if (!db) return res.status(500).json({ error: "Database not initialized" });

      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const userData = userDoc.data() || {};
      const platformConfig = (await db.collection("platform_config").doc("global").get()).data();
      
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

      // 2. Check Standard Tier Limits
      const tierId = userData.tierId || "Basic";
      
      if (platformConfig?.paywallEnabled === false) {
        return res.json({ allowed: true, count: 0, limit: Infinity, betaMode: true, isJobExclusive });
      }

      const tier = platformConfig?.feeTiers?.find((t: any) => t.name === tierId);
      
      if (!tier || !tier.maxQuotes) return res.json({ allowed: true, isJobExclusive }); // No limit defined

      const isLifetime = tier.limitPeriod === "lifetime";
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Count quotes
      let quotesQuery = db.collection("quotes")
        .where("tradespersonId", "==", userId);
      
      if (!isLifetime) {
        quotesQuery = quotesQuery.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfMonth));
      }

      const quotesSnapshot = await quotesQuery.get();

      const count = quotesSnapshot.size;
      res.json({ allowed: count < tier.maxQuotes, count, limit: tier.maxQuotes, isJobExclusive });
    } catch (error: any) {
      console.error("Quote Limit Check Error:", error);
      res.status(500).json({ error: error.message || "Failed to check quote limit" });
    }
  });

  // Postcode lookup proxy
  app.get("/api/postcode/:postcode", async (req, res) => {
    try {
      const { postcode } = req.params;
      const response = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to lookup postcode" });
    }
  });

  // AI Proxy Routes
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { prompt, model = "gemini-1.5-flash", config } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "AI API Key not configured on server" });
      }

      const client = new GoogleGenAI({ apiKey });
      
      const result = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: config
      });
      
      res.json({ text: result.text });
    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      
      // Check for specific API key errors
      if (error.message && error.message.includes("API key not valid")) {
        return res.status(401).json({ 
          error: "The configured Gemini API key is invalid or expired. Please check your AI Studio settings." 
        });
      }
      
      res.status(500).json({ error: error.message || "AI generation failed" });
    }
  });

  // AI Shop Recommendations Route
  app.post("/api/shop-recommendations", async (req, res) => {
    try {
      const { role, category } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
         // Fallback if no Gemini Key
         return res.json({ recommendations: [
            { name: "Safety Boots", reason: "Standard site requirement", icon: "Shield" },
            { name: "Heavy Duty Gloves", reason: "Protect your hands on the job", icon: "PenTool" },
            { name: "First Aid Kit", reason: "Essential for any worksite", icon: "Briefcase" }
         ]});
      }

      const client = new GoogleGenAI({ apiKey });
      const prompt = `You are a smart equipment and workwear recommender for an e-commerce store. 
A user with the role "${role}" and trade/business category "${category}" is opening the store popup.
Suggest exactly 3 highly specific, highly relevant categories of equipment, workwear, or tools they are likely to need.
Focus on safety gear, consumables, or core tools.
Return a RAW JSON array (no markdown block, no markdown formatting) of 3 objects with properties:
- 'name': short product category name (e.g., 'VDE Insulated Tools', 'Knee Pads', 'Bulk Solvents')
- 'reason': a very short and punchy reason why they need it (no more than 8 words)
- 'icon': a reasonably matching Lucide icon name (e.g., 'Wrench', 'Hammer', 'HardHat', 'Shield', 'Zap', 'Droplets', 'Paintbrush', 'Truck', 'Scissors', 'Wind', 'Thermometer', 'Briefcase', 'PenTool', 'Box')`;

      const result = await client.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
        }
      });
      
      let recommendations = [];
      try {
        if (result.text) {
          recommendations = JSON.parse(result.text.replace(/```json/g, "").replace(/```/g, "").trim());
        }
      } catch (parseError) {
        console.error("Failed to parse Gemini recommendation JSON:", parseError);
        recommendations = [
            { name: "Site Equipment", reason: "Based on your recent jobs", icon: "Box" },
            { name: "Protective Gear", reason: "Stay safe on site", icon: "Shield" },
            { name: "Trade Supplies", reason: "Restock your essential materials", icon: "Wrench" }
        ];
      }

      res.json({ recommendations });
    } catch (error: any) {
      console.error("AI Shop Recommendation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate recommendations" });
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
        
        const platformConfig = (await db.collection("platform_config").doc("global").get()).data();
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

      // 1. Get accepted quotes (Revenue)
      let totalRevenue = 0;
      let quoteCount = 0;
      try {
        const quotesSnapshot = await db.collectionGroup("quotes")
          .where("tradespersonId", "==", uid)
          .where("status", "==", "accepted")
          .get();
        
        quotesSnapshot.forEach(doc => {
          totalRevenue += doc.data().amount || 0;
        });
        quoteCount = quotesSnapshot.size;
      } catch (e: any) {
        if (e.code === 5) {
          console.info("Info: Collections for analytics not found (expected for new accounts).");
        } else {
          console.warn("Error fetching quotes for analytics:", e);
        }
      }

      // 2. Get shop orders (Expenses)
      let totalSpend = 0;
      let orderCount = 0;
      try {
        const ordersSnapshot = await db.collection("shop_orders")
          .where("userId", "==", uid)
          .get();
        
        ordersSnapshot.forEach(doc => {
          totalSpend += doc.data().totalAmount || 0;
        });
        orderCount = ordersSnapshot.size;
      } catch (e: any) {
        if (e.code === 5) {
          console.info("Info: Shop orders collection not found (expected for new accounts).");
        } else {
          console.warn("Error fetching shop orders for analytics:", e);
        }
      }

      res.json({
        totalRevenue,
        totalSpend,
        netProfit: totalRevenue - totalSpend,
        orderCount,
        quoteCount,
        replenishmentAlert: totalSpend > 500
      });
    } catch (error: any) {
      console.error("Analytics Error:", error);
      res.status(500).json({ error: "Failed to generate analytics" });
    }
  });

  // Smart Job Procurement Material Detection Route
  app.post("/api/job/procure-materials", async (req, res) => {
    try {
      const { description } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) return res.status(500).json({ error: "AI not configured" });

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

      const parsedResult = JSON.parse(result.text.replace(/```json/g, "").replace(/```/g, "").trim());
      res.json({ materials: parsedResult });
    } catch (error: any) {
      console.error("Procure Materials Error:", error);
      res.status(500).json({ error: "Failed to detect materials" });
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
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TradeQuote UK server running on http://localhost:${PORT}`);
  });
}

startServer();
