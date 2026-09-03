import { db, collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp, handleFirestoreError, OperationType } from "../firebase";
import { calculateDistanceMiles } from "../lib/utils";

export type MatchNotificationSchedule = "every_5_hours" | "morning_8am" | "afternoon_2pm" | "silent_in_app_only";

export interface TraderMatchNotificationSettings {
  schedule: MatchNotificationSchedule;
  radiusMiles: number; // e.g. 5, 10, 15, 25, 50
  bypassEmergency: boolean; // default true
  soundEnabled: boolean; // default true unless silent
  lastCheckedAt?: number;
  lastNotifiedAt?: number;
}

export const DEFAULT_NOTIFICATION_SETTINGS: TraderMatchNotificationSettings = {
  schedule: "every_5_hours",
  radiusMiles: 25,
  bypassEmergency: true,
  soundEnabled: true,
};

/**
 * Checks if the current time window aligns with the trader's schedule preferences.
 */
export function isScheduleWindowActive(
  schedule: MatchNotificationSchedule,
  lastNotifiedAt?: number
): boolean {
  if (schedule === "silent_in_app_only") {
    return false; // Does not trigger OS system/sound banner
  }

  const now = new Date();
  const currentHour = now.getHours();
  const nowMs = now.getTime();
  const lastTime = lastNotifiedAt || 0;
  const hoursSinceLast = (nowMs - lastTime) / (1000 * 60 * 60);

  if (schedule === "every_5_hours") {
    return hoursSinceLast >= 5;
  }

  if (schedule === "morning_8am") {
    // Active if in the morning window (08:00 - 10:00) and hasn't notified in the last 12 hours
    const isMorning = currentHour >= 8 && currentHour < 12;
    return isMorning && hoursSinceLast >= 12;
  }

  if (schedule === "afternoon_2pm") {
    // Active if in afternoon window (14:00 - 18:00) and hasn't notified in the last 12 hours
    const isAfternoon = currentHour >= 14 && currentHour < 18;
    return isAfternoon && hoursSinceLast >= 12;
  }

  return false;
}

/**
 * Evaluates whether a job strictly matches a trader's trade, services, and distance radius.
 */
export function isJobStrictMatch(job: any, traderProfile: any, radiusMiles: number = 25): { isMatch: boolean; distance: number; reason: string } {
  if (!job || !traderProfile) {
    return { isMatch: false, distance: 0, reason: "Missing job or trader data" };
  }

  // 1. Status Check: Must be posted & open
  if (job.status !== "posted" && job.status !== "open") {
    return { isMatch: false, distance: 0, reason: "Job is not open" };
  }

  // 2. Prevent notifying self
  if (job.userId && traderProfile.uid && job.userId === traderProfile.uid) {
    return { isMatch: false, distance: 0, reason: "Self-posted job" };
  }

  // 3. Exact Trade Category Matching
  const traderTrades: string[] = (traderProfile.trades || []).map((t: string) => t.trim().toLowerCase());
  const traderServices: string[] = (traderProfile.services || []).map((s: string) => s.trim().toLowerCase());
  const traderTags: string[] = (traderProfile.tags || []).map((tag: string) => tag.trim().toLowerCase());

  const jobCategory = (job.category || "").trim().toLowerCase();
  const jobSubcategory = (job.subcategory || "").trim().toLowerCase();
  const jobTitle = (job.title || "").toLowerCase();

  const tradeMatched = 
    traderTrades.length === 0 || // If trader has not set specific trades, lenient fallback
    traderTrades.includes(jobCategory) ||
    (jobSubcategory && traderServices.includes(jobSubcategory)) ||
    traderTrades.some(t => jobTitle.includes(t)) ||
    traderTags.some(tag => jobTitle.includes(tag) || jobCategory.includes(tag));

  if (!tradeMatched) {
    return { isMatch: false, distance: 0, reason: "Category mismatch" };
  }

  // 4. Distance Radius Check
  let distance = 0;
  if (job.lat && job.lng && traderProfile.lat && traderProfile.lng) {
    distance = calculateDistanceMiles(traderProfile.lat, traderProfile.lng, job.lat, job.lng);
    if (distance > radiusMiles) {
      return { isMatch: false, distance, reason: `Outside ${radiusMiles}mi radius (${distance}mi)` };
    }
  } else if (job.postcode && traderProfile.postcode) {
    // Postcode outward code match
    const jobPrefix = job.postcode.trim().split(" ")[0].toUpperCase();
    const traderPrefix = traderProfile.postcode.trim().split(" ")[0].toUpperCase();
    if (jobPrefix !== traderPrefix && radiusMiles < 15) {
      // Conservative estimation
      distance = 8;
    }
  }

  return { isMatch: true, distance, reason: "Exact trade and area match" };
}

/**
 * Triggers a native system / Web Push / Local notification if supported
 */
export async function triggerDeviceNotification(params: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
  silent?: boolean;
}): Promise<boolean> {
  const { title, body, icon = "/icon.png", tag = "trader-match", data = {}, silent = false } = params;

  // 1. Check Web Notification API
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            body,
            icon,
            badge: "/icon.png",
            tag,
            data: {
              url: "/trade-jobs",
              openSettings: false,
              ...data,
            },
            silent,
            vibrate: silent ? [] : [100, 50, 100],
            requireInteraction: false,
          } as any);
          return true;
        } else {
          // Standard browser Notification constructor fallback
          new Notification(title, {
            body,
            icon,
            tag,
            data: { url: "/trade-jobs", ...data },
            silent,
          });
          return true;
        }
      } catch (e) {
        console.warn("[TraderNotification] Web Notification failed:", e);
      }
    }
  }

  return false;
}

/**
 * Checks for newly matched jobs and delivers either an Emergency bypass alert or a periodic batch digest.
 */
export async function checkAndNotifyTraderMatches(
  traderProfile: any,
  options?: { forceCheck?: boolean; onOpenSettings?: () => void }
): Promise<{ matchedCount: number; notified: boolean; topJobs: any[] }> {
  if (!traderProfile || (traderProfile.role !== "tradesperson" && traderProfile.role !== "business")) {
    return { matchedCount: 0, notified: false, topJobs: [] };
  }

  const settings: TraderMatchNotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(traderProfile.matchNotificationSettings || {}),
  };

  const lastNotifiedAt = settings.lastNotifiedAt || 0;
  const isPeriodicDue = isScheduleWindowActive(settings.schedule, lastNotifiedAt);
  const force = options?.forceCheck || false;

  try {
    // Query recently posted jobs
    const q = query(
      collection(db, "jobs"),
      where("status", "in", ["posted", "open"])
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return { matchedCount: 0, notified: false, topJobs: [] };
    }

    const matchedJobs: any[] = [];
    let hasEmergency = false;

    snapshot.docs.forEach((d) => {
      const job: any = { id: d.id, ...d.data() };
      const evalResult = isJobStrictMatch(job, traderProfile, settings.radiusMiles);
      if (evalResult.isMatch) {
        matchedJobs.push({ ...job, distanceMiles: evalResult.distance });
        if (job.urgency === "emergency" || job.isEmergency) {
          hasEmergency = true;
        }
      }
    });

    if (matchedJobs.length === 0) {
      return { matchedCount: 0, notified: false, topJobs: [] };
    }

    // Sort by emergency first, then date
    matchedJobs.sort((a, b) => {
      if (a.isEmergency && !b.isEmergency) return -1;
      if (!a.isEmergency && b.isEmergency) return 1;
      const timeA = a.postedDate?.seconds || (a.postedDate ? new Date(a.postedDate).getTime() : 0);
      const timeB = b.postedDate?.seconds || (b.postedDate ? new Date(b.postedDate).getTime() : 0);
      return timeB - timeA;
    });

    // Check dispatch criteria:
    // 1. Emergency Bypass: If emergency exists and bypassEmergency is ON, notify immediately
    const shouldBypass = hasEmergency && settings.bypassEmergency;
    
    // 2. Periodic Schedule is due or Forced check
    const shouldNotify = shouldBypass || isPeriodicDue || force;

    if (shouldNotify && matchedJobs.length > 0) {
      const topJob = matchedJobs[0];
      const jobSample = matchedJobs
        .slice(0, 2)
        .map(j => `${j.title || "Trade Job"}${j.budget ? ` (£${j.budget})` : ""}`)
        .join(" • ");

      const locationSummary = topJob.location || topJob.city || topJob.postcode || "your area";
      const count = matchedJobs.length;

      const title = shouldBypass
        ? `⚡ URGENT Emergency Job in ${locationSummary} (${settings.radiusMiles}mi)`
        : `🔔 AnyTrader: ${count} New Matched Job${count > 1 ? "s" : ""} in Your Area (${settings.radiusMiles}mi)`;

      const body = shouldBypass
        ? `${topJob.title || "Emergency Repair"} needs immediate assistance in ${locationSummary}. Tap to view.`
        : `${jobSample}${count > 2 ? ` + ${count - 2} more` : ""} in ${locationSummary}. Tap to quote.`;

      const isSilent = settings.schedule === "silent_in_app_only";

      // 1. Deliver Device Notification
      await triggerDeviceNotification({
        title,
        body,
        tag: shouldBypass ? `emergency-${topJob.id}` : `match-digest-${Date.now()}`,
        data: {
          jobId: topJob.id,
          url: "/trade-jobs",
          count,
        },
        silent: isSilent,
      });

      // 2. Also ensure an in-app Alert document is saved in Firestore so ALERTS badge pulses
      const alertRef = doc(collection(db, "notifications"));
      await setDoc(alertRef, {
        userId: traderProfile.uid,
        type: shouldBypass ? "emergency_job_nearby" : "matched_jobs_digest",
        title,
        message: body,
        jobId: topJob.id,
        matchedCount: count,
        read: false,
        createdAt: serverTimestamp(),
        actionPath: `/trade-jobs`,
        isSilent,
      });

      // 3. Update Trader Profile lastNotifiedAt timestamp
      if (traderProfile.uid) {
        try {
          await updateDoc(doc(db, "users", traderProfile.uid), {
            "matchNotificationSettings.lastNotifiedAt": Date.now(),
            "matchNotificationSettings.lastCheckedAt": Date.now(),
          });
        } catch (e) {
          console.warn("Error updating matchNotificationSettings timestamp:", e);
        }
      }

      return { matchedCount: count, notified: true, topJobs: matchedJobs.slice(0, 3) };
    }

    return { matchedCount: matchedJobs.length, notified: false, topJobs: matchedJobs.slice(0, 3) };
  } catch (err) {
    console.error("Error evaluating trader matches:", err);
    return { matchedCount: 0, notified: false, topJobs: [] };
  }
}
