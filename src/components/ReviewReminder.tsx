import React, { useEffect, useState } from "react";
import { db, collection, query, where, getDocs, collectionGroup, serverTimestamp, addDoc, doc, getDoc } from "@/src/firebase";
import { useAuth } from "./AuthProvider";
import { toast } from "sonner";
import { Star, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

export function ReviewReminder() {
  const { user, profile } = useAuth();
  const [lastChecked, setLastChecked] = useState<number>(0);

  useEffect(() => {
    if (!user || !profile) return;

    // Throttle checks to once per session or every hour
    const now = Date.now();
    if (now - lastChecked < 3600000) return; // 1 hour
    setLastChecked(now);

    const checkPendingReviews = async () => {
      const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

      if (profile.role === "homeowner") {
        // Check jobs where homeowner hasn't reviewed
        const q = query(
          collection(db, "jobs"),
          where("homeownerId", "==", user.uid),
          where("status", "==", "completed"),
          where("hasReview", "==", false)
        );

        const snapshot = await getDocs(q);
        snapshot.docs.forEach(async (jobDoc) => {
          const jobData = jobDoc.data();
          const completedAt = jobData.completedAt?.toDate?.() || (jobData.completedAt ? new Date(jobData.completedAt) : null);
          
          if (completedAt && !isNaN(completedAt.getTime()) && completedAt < fourteenDaysAgo) {
            triggerReminder(jobDoc.id, jobData.title, "homeowner");
          }
        });
      } else if (profile.role === "tradesperson") {
        // Check jobs where tradesperson hasn't reviewed homeowner
        const quotesQ = query(
          collectionGroup(db, "quotes"),
          where("tradespersonId", "==", user.uid),
          where("status", "==", "accepted")
        );

        const quotesSnapshot = await getDocs(quotesQ);
        for (const quoteDoc of quotesSnapshot.docs) {
          const quoteData = quoteDoc.data();
          const jobRef = doc(db, "jobs", quoteData.jobId);
          const jobSnap = await getDoc(jobRef);
          
          if (jobSnap.exists()) {
            const jobData = jobSnap.data();
            if (jobData.status === "completed" && !jobData.hasTradespersonReview) {
              const completedAt = jobData.completedAt?.toDate?.() || (jobData.completedAt ? new Date(jobData.completedAt) : null);
              if (completedAt && !isNaN(completedAt.getTime()) && completedAt < fourteenDaysAgo) {
                triggerReminder(jobSnap.id, jobData.title, "tradesperson");
              }
            }
          }
        }
      }
    };

    const triggerReminder = async (jobId: string, jobTitle: string, role: string) => {
      // 1. Show Toast
      toast.info(`Pending Review: ${jobTitle}`, {
        description: "It's been over 14 days since this job was completed. Please leave a review!",
        action: {
          label: "Review Now",
          onClick: () => window.location.href = `/job/${jobId}`
        },
        duration: 10000,
      });

      // 2. Send Notification (if not sent today)
      const todayStr = new Date().toISOString().split('T')[0];
      const reminderKey = `reminder_${jobId}_${user.uid}_${todayStr}`;
      
      // We can use a simple check in localStorage to avoid spamming notifications in the same day
      // but a real notification in the DB is better.
      const hasRemindedToday = localStorage.getItem(reminderKey);
      if (!hasRemindedToday) {
        await addDoc(collection(db, "notifications"), {
          userId: user.uid,
          title: "Review Reminder",
          message: `Please leave a review for "${jobTitle}". It's been over 14 days since completion.`,
          type: "status",
          link: `/job/${jobId}`,
          read: false,
          createdAt: serverTimestamp()
        });
        localStorage.setItem(reminderKey, "true");
      }
    };

    checkPendingReviews();
  }, [user, profile, lastChecked]);

  return null;
}
