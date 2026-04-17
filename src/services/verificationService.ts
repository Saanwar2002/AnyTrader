import { db, doc, updateDoc, getDoc, addDoc, collection, handleFirestoreError, OperationType } from "../firebase";

export interface AutoCheckResult {
  status: "passed" | "failed" | "manual_required";
  message: string;
  timestamp: string;
  provider: string;
}

/**
 * Simulates an automated check against public records (Gas Safe, NICEIC, etc.)
 * In a real-world scenario, this would call external APIs.
 */
export const performInitialPublicRecordCheck = async (userId: string, certType: string): Promise<AutoCheckResult> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  const providers: Record<string, string> = {
    "Gas Safe Register ID": "Gas Safe Register API",
    "NICEIC Certification": "NICEIC Public Database",
    "FENSA Certification": "FENSA Register",
    "HETAS Certification": "HETAS Official API",
    "NAPIT Certification": "NAPIT Search",
    "Public Liability Insurance": "Insurance Database (Mock)",
    "Identity Verification (Passport/Driving License)": "Government ID Verification API",
  };

  const provider = providers[certType] || "General Trade Register";
  
  // Mock logic: 80% pass rate for the simulation
  const random = Math.random();
  let result: AutoCheckResult;

  if (random > 0.2) {
    result = {
      status: "passed",
      message: `Successfully matched certification in ${provider}. Details: Active, No sanctions found.`,
      timestamp: new Date().toISOString(),
      provider
    };
  } else if (random > 0.05) {
    result = {
      status: "manual_required",
      message: `Found potential match in ${provider} but details require manual review (e.g., name variation).`,
      timestamp: new Date().toISOString(),
      provider
    };
  } else {
    result = {
      status: "failed",
      message: `No active record found in ${provider} for the provided details.`,
      timestamp: new Date().toISOString(),
      provider
    };
  }

  // Update the document in Firestore with the auto-check result
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const verificationDocs = userData.verificationDocs || [];
      
      const updatedDocs = verificationDocs.map((doc: any) => {
        if (doc.type === certType) {
          return {
            ...doc,
            autoCheck: result,
            status: result.status === "passed" ? "approved" : 
                    result.status === "failed" ? "rejected" : "pending",
            rejectionReason: result.status === "failed" ? result.message : doc.rejectionReason
          };
        }
        return doc;
      });

      // Check if all required docs are now approved
      const allApproved = updatedDocs.every((d: any) => d.status === "approved");
      const newStatus = allApproved ? "verified" : "pending";
      
      await updateDoc(userRef, {
        verificationDocs: updatedDocs,
        verificationStatus: newStatus
      });

      // Handle Referral Reward
      if (newStatus === "verified" && userData.role === "tradesperson" && userData.referredBy && !userData.referralRewardProcessed) {
        try {
          // Get platform config for boost duration
          const configRef = doc(db, "platform_config", "global");
          const configSnap = await getDoc(configRef);
          const boostDays = configSnap.exists() ? (configSnap.data().referralBoostDays || 7) : 7;
          
          const referrerRef = doc(db, "users", userData.referredBy);
          const referrerSnap = await getDoc(referrerRef);
          
          if (referrerSnap.exists()) {
            const now = new Date();
            const boostUntil = new Date(now.getTime() + boostDays * 24 * 60 * 60 * 1000);
            
            await updateDoc(referrerRef, {
              referralBoostUntil: boostUntil.toISOString()
            });
            
            await updateDoc(userRef, {
              referralRewardProcessed: true
            });

            // Notify referrer
            await addDoc(collection(db, "notifications"), {
              userId: userData.referredBy,
              title: "Referral Reward Granted!",
              message: `Your referral ${userData.name} has been verified. You've received a ${boostDays}-day profile boost!`,
              type: "system",
              read: false,
              createdAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("Error processing referral reward:", err);
        }
      }

      // Create an audit log entry
      await addDoc(collection(db, "audit_logs"), {
        adminId: "system_auto_check",
        action: "verification_auto_check",
        targetId: userId,
        targetType: "user",
        details: `Automated ${certType} check resulted in: ${result.status}. Provider: ${result.provider}`,
        createdAt: new Date().toISOString()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }

  return result;
};
