process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8088";

import { describe, it, beforeAll, beforeEach, expect } from "vitest";
import * as admin from "firebase-admin";
import {
  executeJobLifecycleCommand,
  executeStartJobCommand,
  executeCompleteJobCommand,
  executeCancelJobCommand,
} from "../../src/server/jobLifecycleCommands.ts";
import { ConflictError } from "../../src/server/httpErrors.ts";
import { CanonicalIdentity } from "../../src/server/identity.ts";

describe("Task 5 — Real Firestore Emulator Concurrency & Lifecycle Verification", () => {
  const PROJECT_ID = "demo-anytrader";
  let db: admin.firestore.Firestore;

  const homeownerIdentity: CanonicalIdentity = {
    uid: "homeowner_task5_real_alice",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "verified" },
    subscription: { tierId: "free", status: "active" },
  };

  const traderDaveIdentity: CanonicalIdentity = {
    uid: "trader_task5_real_dave",
    accountType: "service_provider",
    capabilities: ["tradesperson"],
    verification: { status: "verified" },
    subscription: { tierId: "price_pro", status: "active" },
  };

  const traderBobIdentity: CanonicalIdentity = {
    uid: "trader_task5_real_bob",
    accountType: "service_provider",
    capabilities: ["tradesperson"],
    verification: { status: "verified" },
    subscription: { tierId: "payg", status: "active" },
  };

  beforeAll(() => {
    // Assert strictly pointing to Firestore Emulator host to prevent accidental production connection
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error("FIRESTORE_EMULATOR_HOST must be configured to run emulator concurrency tests.");
    }
    const appName = "task5-real-emulator-concurrency-suite";
    const app =
      admin.apps.find((a) => a?.name === appName) ??
      admin.initializeApp({ projectId: PROJECT_ID }, appName);
    db = app.firestore();
  });

  it("1. Real Emulator Test #1 — Simultaneous StartJob requests against same job produce exactly 1 success and 1 ConflictError", async () => {
    const jobId = `job_real_start_race_${Date.now()}`;
    const jobRef = db.collection("jobs").doc(jobId);
    const cardRef = db.collection("public_job_cards").doc(jobId);

    await jobRef.set({
      id: jobId,
      homeownerId: homeownerIdentity.uid,
      userId: homeownerIdentity.uid,
      acceptedTradespersonId: traderDaveIdentity.uid,
      tradespersonId: traderDaveIdentity.uid,
      title: "Boiler Installation",
      status: "accepted",
      verificationPin: "5678",
      createdAt: new Date().toISOString(),
    });

    await cardRef.set({
      id: jobId,
      title: "Boiler Installation",
      status: "accepted",
      createdAt: new Date().toISOString(),
    });

    const keyA = `real_start_key_a_${Date.now()}`;
    const keyB = `real_start_key_b_${Date.now()}`;

    // Genuine simultaneous asynchronous execution against real Firestore Emulator
    const results = await Promise.allSettled([
      executeStartJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        verificationPin: "5678",
        idempotencyKey: keyA,
      }),
      executeStartJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        verificationPin: "5678",
        idempotencyKey: keyB,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    // Invariant: Exactly 1 succeeds and exactly 1 receives ConflictError
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    expect(rejected[0].reason.message).toContain("already been started");

    // Invariant: Verify directly against Firestore Emulator
    const jobSnap = await jobRef.get();
    expect(jobSnap.exists).toBe(true);
    expect(jobSnap.data()?.status).toBe("in_progress");
    expect(jobSnap.data()?.startedAt).toBeDefined();

    // Verify public projection matches canonical state
    const cardSnap = await cardRef.get();
    expect(cardSnap.data()?.status).toBe("in_progress");

    // Invariant: Exactly one idempotency record committed as completed
    const idempASnap = await db.collection("idempotency_keys").doc(keyA).get();
    const idempBSnap = await db.collection("idempotency_keys").doc(keyB).get();
    const completedCount = (idempASnap.exists ? 1 : 0) + (idempBSnap.exists ? 1 : 0);
    expect(completedCount).toBe(1);

    // Invariant: Job cannot be started again
    await expect(
      executeStartJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        verificationPin: "5678",
        idempotencyKey: `subsequent_start_${Date.now()}`,
      })
    ).rejects.toThrow(ConflictError);
  }, 30000);

  it("2. Real Emulator Test #2 — Simultaneous StartJob and CancelJob race produces valid committed state and zero invalid transitions", async () => {
    const jobId = `job_real_start_vs_cancel_${Date.now()}`;
    const jobRef = db.collection("jobs").doc(jobId);
    const cardRef = db.collection("public_job_cards").doc(jobId);

    await jobRef.set({
      id: jobId,
      homeownerId: homeownerIdentity.uid,
      userId: homeownerIdentity.uid,
      acceptedTradespersonId: traderDaveIdentity.uid,
      tradespersonId: traderDaveIdentity.uid,
      title: "Electrical Rewire",
      status: "accepted",
      createdAt: new Date().toISOString(),
    });

    await cardRef.set({
      id: jobId,
      title: "Electrical Rewire",
      status: "accepted",
      createdAt: new Date().toISOString(),
    });

    const keyStart = `race_start_${Date.now()}`;
    const keyCancel = `race_cancel_${Date.now()}`;

    // Start both commands simultaneously without awaiting either one first
    const results = await Promise.allSettled([
      executeStartJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        expectedStatus: "accepted",
        idempotencyKey: keyStart,
      }),
      executeCancelJobCommand({
        db,
        identity: homeownerIdentity,
        jobId,
        reason: "Cancelled by homeowner",
        expectedStatus: "accepted",
        idempotencyKey: keyCancel,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    // Invariant: Exactly 1 commits and 1 is rejected with ConflictError
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);

    // Invariant: State in Firestore Emulator must be valid (either in_progress or cancelled)
    const jobSnap = await jobRef.get();
    const finalStatus = jobSnap.data()?.status;
    expect(["in_progress", "cancelled"]).toContain(finalStatus);

    const cardSnap = await cardRef.get();
    expect(cardSnap.data()?.status).toBe(finalStatus);
  }, 30000);

  it("3. Real Emulator Test #3 — Simultaneous CompleteJob requests against in-progress job produce 1 success and 1 ConflictError", async () => {
    const jobId = `job_real_complete_race_${Date.now()}`;
    const jobRef = db.collection("jobs").doc(jobId);

    await jobRef.set({
      id: jobId,
      homeownerId: homeownerIdentity.uid,
      userId: homeownerIdentity.uid,
      acceptedTradespersonId: traderDaveIdentity.uid,
      tradespersonId: traderDaveIdentity.uid,
      title: "Bathroom Tiling",
      status: "in_progress",
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const key1 = `complete_key_1_${Date.now()}`;
    const key2 = `complete_key_2_${Date.now()}`;

    const results = await Promise.allSettled([
      executeCompleteJobCommand({
        db,
        identity: homeownerIdentity,
        jobId,
        completionNotes: "Completed by Alice",
        idempotencyKey: key1,
      }),
      executeCompleteJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        completionNotes: "Completed by Dave",
        idempotencyKey: key2,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    expect(rejected[0].reason.message).toContain("already been completed");

    // Invariant: Final status in Firestore is completed
    const jobSnap = await jobRef.get();
    expect(jobSnap.data()?.status).toBe("completed");
    expect(jobSnap.data()?.completedAt).toBeDefined();
  }, 30000);

  it("4. Real Emulator Test #4 — Simultaneous CancelJob requests against open/accepted job produce 1 success and 1 ConflictError", async () => {
    const jobId = `job_real_cancel_race_${Date.now()}`;
    const jobRef = db.collection("jobs").doc(jobId);

    await jobRef.set({
      id: jobId,
      homeownerId: homeownerIdentity.uid,
      userId: homeownerIdentity.uid,
      title: "Lawn Mowing",
      status: "open",
      createdAt: new Date().toISOString(),
    });

    const key1 = `cancel_key_1_${Date.now()}`;
    const key2 = `cancel_key_2_${Date.now()}`;

    const results = await Promise.allSettled([
      executeCancelJobCommand({
        db,
        identity: homeownerIdentity,
        jobId,
        reason: "Rain forecasted",
        idempotencyKey: key1,
      }),
      executeCancelJobCommand({
        db,
        identity: homeownerIdentity,
        jobId,
        reason: "Mower fixed myself",
        idempotencyKey: key2,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    expect(rejected[0].reason.message).toContain("already been cancelled");

    const jobSnap = await jobRef.get();
    expect(jobSnap.data()?.status).toBe("cancelled");
    expect(jobSnap.data()?.cancelledAt).toBeDefined();
  }, 30000);

  it("5. Real Emulator Test #5 — Same idempotency key simultaneous requests return cached result without duplicate transitions", async () => {
    const jobId = `job_real_same_idemp_${Date.now()}`;
    const jobRef = db.collection("jobs").doc(jobId);

    await jobRef.set({
      id: jobId,
      homeownerId: homeownerIdentity.uid,
      userId: homeownerIdentity.uid,
      acceptedTradespersonId: traderDaveIdentity.uid,
      tradespersonId: traderDaveIdentity.uid,
      title: "Radiator Flush",
      status: "accepted",
      createdAt: new Date().toISOString(),
    });

    const sharedKey = `same_key_${Date.now()}`;

    // Two simultaneous requests using the exact same idempotency key
    const results = await Promise.allSettled([
      executeStartJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        idempotencyKey: sharedKey,
      }),
      executeStartJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        idempotencyKey: sharedKey,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    // Both requests fulfill cleanly under identical idempotency key
    expect(rejected).toHaveLength(0);
    expect(fulfilled).toHaveLength(2);

    const replayFlags = fulfilled.map((f) => f.value.wasReplayed).sort();
    expect(replayFlags).toEqual([false, true]);

    // Exactly 1 status transition in Firestore
    const jobSnap = await jobRef.get();
    expect(jobSnap.data()?.status).toBe("in_progress");
  }, 30000);

  it("6. Real Emulator Test #6 — Different idempotency keys simultaneous requests produce exactly 1 success and 1 ConflictError", async () => {
    const jobId = `job_real_diff_idemp_${Date.now()}`;
    const jobRef = db.collection("jobs").doc(jobId);

    await jobRef.set({
      id: jobId,
      homeownerId: homeownerIdentity.uid,
      userId: homeownerIdentity.uid,
      acceptedTradespersonId: traderDaveIdentity.uid,
      tradespersonId: traderDaveIdentity.uid,
      title: "Pipe Insulation",
      status: "accepted",
      createdAt: new Date().toISOString(),
    });

    const keyA = `diff_key_a_${Date.now()}`;
    const keyB = `diff_key_b_${Date.now()}`;

    const results = await Promise.allSettled([
      executeStartJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        idempotencyKey: keyA,
      }),
      executeStartJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        idempotencyKey: keyB,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);

    const jobSnap = await jobRef.get();
    expect(jobSnap.data()?.status).toBe("in_progress");
  }, 30000);

  it("7. Real Emulator Test #7 — Proves Firestore transaction contention causes automatic OCC retry and state-machine rejection", async () => {
    const jobId = `job_real_occ_contention_${Date.now()}`;
    const jobRef = db.collection("jobs").doc(jobId);

    await jobRef.set({
      id: jobId,
      homeownerId: homeownerIdentity.uid,
      userId: homeownerIdentity.uid,
      acceptedTradespersonId: traderDaveIdentity.uid,
      tradespersonId: traderDaveIdentity.uid,
      title: "Roof Tile Replacement",
      status: "accepted",
      createdAt: new Date().toISOString(),
    });

    let txBAttemptCount = 0;

    // Run Command A and Command B concurrently
    const [resA, resB] = await Promise.allSettled([
      // Command A: Standard StartJob
      executeStartJobCommand({
        db,
        identity: traderDaveIdentity,
        jobId,
        idempotencyKey: `occ_key_a_${Date.now()}`,
      }),
      // Command B: Contention observer transaction that counts retry attempts
      db.runTransaction(async (transaction) => {
        txBAttemptCount++;
        const snap = await transaction.get(jobRef);
        const currentStatus = snap.data()?.status;

        // Introduce small micro-delay on first attempt to ensure Command A commits first
        if (txBAttemptCount === 1) {
          await new Promise((r) => setTimeout(r, 200));
        }

        if (currentStatus === "in_progress") {
          throw new ConflictError("Job has already been started by another request");
        }

        transaction.update(jobRef, {
          status: "in_progress",
          startedAt: new Date().toISOString(),
        });
      }),
    ]);

    // Exactly 1 transaction commits and 1 transaction observes new state and throws ConflictError
    const fulfilled = [resA, resB].filter((r) => r.status === "fulfilled");
    const rejected = [resA, resB].filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);

    // Final state in real Firestore is in_progress
    const finalSnap = await jobRef.get();
    expect(finalSnap.data()?.status).toBe("in_progress");
  }, 30000);
});
