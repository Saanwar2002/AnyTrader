import { db, collection, getDocs, doc, setDoc, query, where, serverTimestamp } from "../firebase";

export async function distributeJobNotifications(jobId: string, category: string, postcode: string, urgency: string, isBoosted: boolean) {
  try {
    // 1. Fetch global tiers to determine priority rules
    // (This works as a fallback, but we'll also hardcode checks for common tier names just in case)
    
    // 2. Fetch all tradespeople in the target category (simplified, doing frontend filtering for category)
    const q = query(
      collection(db, "users"),
      where("role", "==", "tradesperson")
    );
    const snapshot = await getDocs(q);
    
    // 3. Create notifications for each matching trader
    const batchPromises = snapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const trades = userData.trades || [];
      const userPostcode = (userData.postcode || "").toUpperCase().split(' ')[0];
      const jobPostcode = (postcode || "").toUpperCase().split(' ')[0];
      
      // Match category
      if (!trades.includes(category) && category !== "All") return;
      
      // Basic postcode match (same prefix) - relaxed for demo
      if (userPostcode && jobPostcode && typeof userPostcode === 'string' && typeof jobPostcode === 'string' && userPostcode !== jobPostcode && !urgency.includes("emergency")) {
        // Just for demo, we'll notify everyone if they have the category, 
        // to make sure enough traders see it
      }

      const tierId = userData.tierId || "Basic";
      const isPriorityTier = [
        "Premium", "Pro", "Gold", "Platinum", "Enterprise", "Platinum Enterprise", "Gold Elite",
        "Business Professional", "Enterprise Powerhouse"
      ].some(t => tierId.includes(t));

      // Calculate time delay for standard users
      // Boosted jobs or emergencies always notify everyone instantly.
      let visibleAt: any = null;
      if (urgency !== "emergency" && !isBoosted && !isPriorityTier) {
        // Standard/Basic users get it 30 mins later
        visibleAt = new Date(Date.now() + 30 * 60000);
      }

      const notificationRef = doc(collection(db, "notifications"));
      await setDoc(notificationRef, {
        userId: userDoc.id,
        type: "new_job_lead",
        title: `New ${category} lead in ${postcode}`,
        message: isPriorityTier ? `Priority Lead: Tap to view and quote before others.` : `A new job was posted in your area.`,
        jobId: jobId,
        read: false,
        createdAt: serverTimestamp(),
        visibleAt: visibleAt ? visibleAt.getTime() : null, // Assuming number or timestamp
        actionPath: `/jobs/${jobId}`,
        icon: "Briefcase" // or maybe generic
      });
      
      // If it's an emergency, also send SMS nudge
      if (urgency === "emergency") {
        const smsRef = doc(collection(db, "sms_queue"));
        await setDoc(smsRef, {
            toUserId: userDoc.id,
            jobId: jobId,
            message: `EMERGENCY ALERT: New ${category} job near you. Accpet within 5 mins.`,
            status: "pending",
            createdAt: serverTimestamp()
        });
      }
    });

    await Promise.all(batchPromises);

  } catch (err) {
    console.error("Error distributing notifications:", err);
  }
}
