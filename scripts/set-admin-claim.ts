import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

// Initialize Firebase Admin SDK
const app = admin.apps.length > 0 ? admin.apps[0]! : admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
const db = getFirestore(app, dbId);

async function setAdminClaim() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("--"));
  const isRevoke = args.includes("--revoke");
  const roleArg = args.find((a) => a.startsWith("--role="));
  const assignedRole = roleArg ? roleArg.split("=")[1] : "admin";

  if (!target) {
    console.error("Usage: npx tsx scripts/set-admin-claim.ts <email-or-uid> [--revoke] [--role=admin|ecosystem_manager]");
    process.exit(1);
  }

  try {
    let user: admin.auth.UserRecord;
    if (target.includes("@")) {
      user = await admin.auth().getUserByEmail(target);
    } else {
      user = await admin.auth().getUser(target);
    }

    console.log(`Target user found: ${user.email} (UID: ${user.uid})`);

    const existingClaims = user.customClaims || {};

    if (isRevoke) {
      const updatedClaims = { ...existingClaims };
      delete updatedClaims.admin;
      delete updatedClaims.role;
      await admin.auth().setCustomUserClaims(user.uid, updatedClaims);
      console.log(`[REVOKED] Admin custom claims removed for ${user.email}`);

      // Sync Firestore user and admin collections
      await db.collection("users").doc(user.uid).set(
        {
          role: "homeowner",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await db.collection("admins").doc(user.uid).delete().catch(() => {});
      console.log(`[REVOKED] Firestore user role updated and admin doc removed.`);
    } else {
      const updatedClaims = {
        ...existingClaims,
        admin: true,
        role: assignedRole,
      };
      await admin.auth().setCustomUserClaims(user.uid, updatedClaims);
      console.log(`[GRANTED] Admin custom claims set for ${user.email}: { admin: true, role: '${assignedRole}' }`);

      // Sync Firestore user and admin collections
      await db.collection("users").doc(user.uid).set(
        {
          role: assignedRole,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await db.collection("admins").doc(user.uid).set({
        uid: user.uid,
        email: user.email,
        role: assignedRole,
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[GRANTED] Firestore user role updated and admins/${user.uid} record created.`);
    }

    console.log("\nNote: User must sign out and sign back in, or call auth.currentUser.getIdToken(true) to refresh token claims.");
  } catch (err: any) {
    console.error("Error setting custom claim:", err.message);
    process.exit(1);
  }
}

setAdminClaim();
