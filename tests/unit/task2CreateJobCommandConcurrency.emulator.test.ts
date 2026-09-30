process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8088";

import { describe, it, expect, beforeAll } from "vitest";
import * as admin from "firebase-admin";
import { executeCreateJobCommand } from "../../src/server/createJobCommand.ts";
import { ForbiddenError } from "../../src/server/httpErrors.ts";
import { CanonicalIdentity } from "../../src/server/identity.ts";

describe("Task 2: CreateJob Command Real Firestore Emulator Concurrency Test", () => {
  const PROJECT_ID = "demo-anytrader";
  let db: admin.firestore.Firestore;

  const homeownerIdentity: CanonicalIdentity = {
    uid: "real_emulator_homeowner_123",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "verified", credentials: [] },
    subscription: { tierId: "PAYG", status: "active", isFoundingMember: false },
  };

  const validJobPayload = {
    title: "Concurrent Emergency Leak Fix",
    description: "Urgent pipe burst in basement requiring immediate attention.",
    category: "Plumbing",
    postcode: "SW1A 1AA",
    urgency: "standard" as const,
  };

  beforeAll(() => {
    if (admin.apps.length > 0) {
      db = admin.apps[0]!.firestore();
    } else {
      const app = admin.initializeApp({ projectId: PROJECT_ID });
      db = app.firestore();
    }
  });

  it("enforces real Firestore transaction contention when two CreateJob commands race simultaneously under quota=1", async () => {
    const quotaConfig = {
      enabled: true,
      limit: 1,
      periodKey: "2026-09",
      periodStart: "2026-09-01T00:00:00.000Z",
      tierId: "strict_race_tier",
      isUnlimited: false,
    };

    // 1. Seed/clean quota document state and previous jobs for this user
    const quotaRef = db.collection("user_job_quotas").doc(`${homeownerIdentity.uid}_${quotaConfig.periodKey}`);
    await quotaRef.delete().catch(() => {});

    const existingJobs = await db
      .collection("jobs")
      .where("homeownerId", "==", homeownerIdentity.uid)
      .get();
    for (const doc of existingJobs.docs) {
      await doc.ref.delete();
    }

    // 2. Create two distinct idempotency keys
    const idempotencyKey1 = `real_race_key_1_${Date.now()}`;
    const idempotencyKey2 = `real_race_key_2_${Date.now()}`;

    // 3. Call executeCreateJobCommand() simultaneously using the same real Admin Firestore instance
    const results = await Promise.allSettled([
      executeCreateJobCommand({
        db,
        identity: homeownerIdentity,
        rawPayload: { ...validJobPayload, title: "Racing Job 1" },
        idempotencyKey: idempotencyKey1,
        quota: quotaConfig,
      }),
      executeCreateJobCommand({
        db,
        identity: homeownerIdentity,
        rawPayload: { ...validJobPayload, title: "Racing Job 2" },
        idempotencyKey: idempotencyKey2,
        quota: quotaConfig,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    // 4. Assert exactly one succeeds
    expect(fulfilled.length).toBe(1);
    expect(fulfilled[0].value.jobId).toBeDefined();

    // 5. Assert exactly one receives the quota rejection
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason).toBeInstanceOf(ForbiddenError);
    expect(rejected[0].reason.message).toMatch(/quota exceeded/i);

    // 6. Read the actual quota document from Firestore and assert count === 1
    const quotaSnap = await quotaRef.get();
    expect(quotaSnap.exists).toBe(true);
    expect(quotaSnap.data()?.count).toBe(1);

    // 7. Query actual /jobs collection and assert exactly one job exists
    const jobsSnap = await db
      .collection("jobs")
      .where("homeownerId", "==", homeownerIdentity.uid)
      .get();
    expect(jobsSnap.size).toBe(1);
    expect(jobsSnap.docs[0].id).toBe(fulfilled[0].value.jobId);
  }, 30000);
});
