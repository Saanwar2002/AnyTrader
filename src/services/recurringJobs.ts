import { db, collection, query, where, or, and, getDocs, addDoc, updateDoc, setDoc, doc, serverTimestamp, sendNotification, handleFirestoreError, OperationType } from "@/src/firebase";

export async function processRecurringSchedules(userId: string) {
  try {
    // We check schedules where the user is a participant
    // Using and() and or() for complex rule-compliant queries
    const q = query(
      collection(db, "recurring_schedules"),
      and(
        where("status", "==", "active"),
        or(
          where("participants", "array-contains", userId),
          where("homeownerId", "==", userId),
          where("tradespersonId", "==", userId)
        )
      )
    );
    
    const snapshot = await getDocs(q);
    const now = new Date();
    
    for (const scheduleDoc of snapshot.docs) {
      const schedule = scheduleDoc.data();
      
      const lastGenerated = schedule.lastJobGeneratedAt?.toDate() || schedule.createdAt?.toDate() || now;
      const frequencyDays = schedule.frequency === "weekly" ? 7 : schedule.frequency === "fortnightly" ? 14 : 30;
      
      const nextJobDate = new Date(lastGenerated);
      nextJobDate.setDate(nextJobDate.getDate() + frequencyDays);

      // If the next job is within 3 days and we haven't generated it yet
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      if (nextJobDate <= threeDaysFromNow) {
        // Generate the job
        const jobRef = doc(collection(db, "jobs"));
        const jobData = {
          id: jobRef.id,
          title: `[Recurring] ${schedule.title}`,
          description: `Automatically generated recurring service (${schedule.frequency}).`,
          category: schedule.category,
          homeownerId: schedule.homeownerId,
          postcode: schedule.postcode || "N/A", // Fallback for older schedules
          status: "accepted", // Automatically accepted
          urgency: "specific_date",
          jobDate: nextJobDate.toISOString(),
          postedDate: serverTimestamp(),
          createdAt: serverTimestamp(),
          paymentPreference: schedule.paymentPreference || "negotiable",
          quoteScope: schedule.quoteScope || "labor_only",
          isRecurringInstance: true,
          recurringScheduleId: schedule.id,
          location: "As per previous arrangement"
        };

        try {
          await setDoc(jobRef, jobData);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `jobs/${jobRef.id} (recurring)`);
          throw e;
        }
        
        // Create the accepted quote automatically
        const quoteRef = doc(collection(db, "jobs", jobRef.id, "quotes"));
        try {
          await setDoc(quoteRef, {
            id: quoteRef.id,
            tradespersonId: schedule.tradespersonId,
            homeownerId: schedule.homeownerId, // Added for rule compliance
            amount: schedule.amount,
            status: "accepted",
            message: "Automatically generated recurring quote.",
            createdAt: serverTimestamp()
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `jobs/${jobRef.id}/quotes/${quoteRef.id} (recurring)`);
          throw e;
        }

        // Update schedule
        try {
          await updateDoc(doc(db, "recurring_schedules", schedule.id), {
            lastJobGeneratedAt: serverTimestamp()
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `recurring_schedules/${schedule.id} (update)`);
          throw e;
        }

        // Notify both parties
        await sendNotification(
          schedule.homeownerId,
          "Upcoming Recurring Job",
          `A new instance of "${schedule.title}" has been scheduled for ${nextJobDate.toLocaleDateString()}.`,
          "status",
          `/job/${jobRef.id}`
        );

        await sendNotification(
          schedule.tradespersonId,
          "New Recurring Job Instance",
          `You have a recurring job for "${schedule.title}" scheduled for ${nextJobDate.toLocaleDateString()}.`,
          "status",
          `/job/${jobRef.id}`
        );
      }
    }
  } catch (err) {
    console.error("Error processing recurring schedules:", err);
    handleFirestoreError(err, OperationType.WRITE, "recurring_schedules/processing");
  }
}
