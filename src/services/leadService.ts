import { db, collection, addDoc, serverTimestamp, updateDoc, doc, increment } from "@/src/firebase";

export async function generateLead(
  partnerId: string,
  campaignId: string,
  userId: string,
  userRole: string,
  data: any = {}
) {
  try {
    // 1. Create the lead
    await addDoc(collection(db, "leads"), {
      partnerId,
      campaignId,
      userId,
      userRole,
      status: "new",
      data,
      createdAt: serverTimestamp()
    });

    // 2. Increment campaign metrics
    if (campaignId) {
      await updateDoc(doc(db, "campaigns", campaignId), {
        leads: increment(1)
      });
    }

    // 3. Notify partner (Simulated for now, could be a real notification)
    // In a real app, this would trigger a cloud function to send an email/webhook
    console.log(`Lead distributed to partner ${partnerId}`);
    
    return true;
  } catch (error) {
    console.error("Error generating lead:", error);
    return false;
  }
}

export async function trackClick(campaignId: string) {
  try {
    if (campaignId) {
      await updateDoc(doc(db, "campaigns", campaignId), {
        clicks: increment(1)
      });
    }
  } catch (error) {
    console.error("Error tracking click:", error);
  }
}
