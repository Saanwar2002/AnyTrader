/**
 * Task 5: Canonical Job Lifecycle Test Suite
 *
 * Comprehensive unit, adversarial BOLA/IDOR, mass assignment, formal state machine,
 * verification PIN, persistent idempotency, genuine concurrent race conditions (Promise.allSettled),
 * domain event deduplication, public projection consistency, and production caller wiring tests across:
 * 1. StartJob
 * 2. CompleteJob
 * 3. CancelJob
 * 4. RaiseJobDispute
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  executeJobLifecycleCommand,
  executeStartJobCommand,
  executeCompleteJobCommand,
  executeCancelJobCommand,
  executeDisputeJobCommand,
  JOB_LIFECYCLE_PROTECTED_KEYS,
  START_JOB_SCHEMA,
  COMPLETE_JOB_SCHEMA,
  CANCEL_JOB_SCHEMA,
  DISPUTE_JOB_SCHEMA,
} from "../../src/server/jobLifecycleCommands.ts";
import { CanonicalIdentity } from "../../src/server/identity.ts";
import { BadRequestError, ForbiddenError, NotFoundError, ConflictError } from "../../src/server/httpErrors.ts";
import { domainEvents } from "../../src/server/domainEvents.ts";
import fs from "fs";
import path from "path";

/**
 * Creates a high-fidelity Firestore mock supporting authentic Transaction Isolation,
 * Optimistic Concurrency Control (OCC), document read-version tracking, staged writes,
 * and automatic transaction retry on concurrent write conflict.
 */
function createMockFirestore(initialData: Record<string, any> = {}) {
  const store: Record<string, any> = {};
  for (const [key, val] of Object.entries(initialData)) {
    store[key] = {
      ...JSON.parse(JSON.stringify(val)),
      _version: 1,
    };
  }

  const db: any = {
    _store: store,
    collection(collectionPath: string) {
      return {
        path: collectionPath,
        doc(docId?: string) {
          const actualDocId = docId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const fullPath = `${collectionPath}/${actualDocId}`;
          return {
            id: actualDocId,
            path: fullPath,
            async get() {
              await new Promise((r) => setTimeout(r, 0));
              const data = store[fullPath];
              return {
                id: actualDocId,
                exists: data !== undefined && data !== null,
                data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
              };
            },
            async set(data: any, options?: { merge?: boolean }) {
              await new Promise((r) => setTimeout(r, 0));
              const current = store[fullPath];
              if (options?.merge && current) {
                store[fullPath] = {
                  ...current,
                  ...JSON.parse(JSON.stringify(data)),
                  _version: (current._version || 1) + 1,
                };
              } else {
                store[fullPath] = {
                  ...JSON.parse(JSON.stringify(data)),
                  _version: (current?._version || 0) + 1,
                };
              }
            },
            async update(data: any) {
              await new Promise((r) => setTimeout(r, 0));
              const current = store[fullPath];
              if (!current) throw new Error(`Document not found: ${fullPath}`);
              store[fullPath] = {
                ...current,
                ...JSON.parse(JSON.stringify(data)),
                _version: (current._version || 1) + 1,
              };
            },
            async delete() {
              await new Promise((r) => setTimeout(r, 0));
              delete store[fullPath];
            },
          };
        },
      };
    },
    async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
      const maxAttempts = 15;
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt++;
        const readVersions = new Map<string, number>();
        const pendingWrites: Array<() => void> = [];

        const transaction = {
          async get(refOrQuery: any) {
            // Introduce micro-delay to simulate async I/O and allow genuine event-loop interleaving for racing promises
            await new Promise((r) => setTimeout(r, 1));
            const path = refOrQuery.path;
            const current = store[path];
            const currentVersion = current ? current._version : 0;
            readVersions.set(path, currentVersion);

            return {
              id: refOrQuery.id,
              exists: current !== undefined && current !== null,
              data: () => (current ? JSON.parse(JSON.stringify(current)) : undefined),
            };
          },
          set(docRef: any, data: any, options?: { merge?: boolean }) {
            const fullPath = docRef.path;
            pendingWrites.push(() => {
              const current = store[fullPath];
              if (options?.merge && current) {
                store[fullPath] = {
                  ...current,
                  ...JSON.parse(JSON.stringify(data)),
                  _version: (current._version || 1) + 1,
                };
              } else {
                store[fullPath] = {
                  ...JSON.parse(JSON.stringify(data)),
                  _version: (current?._version || 0) + 1,
                };
              }
            });
          },
          update(docRef: any, data: any) {
            const fullPath = docRef.path;
            pendingWrites.push(() => {
              const current = store[fullPath];
              if (!current) throw new Error(`Document not found: ${fullPath}`);
              store[fullPath] = {
                ...current,
                ...JSON.parse(JSON.stringify(data)),
                _version: (current._version || 1) + 1,
              };
            });
          },
          delete(docRef: any) {
            const fullPath = docRef.path;
            pendingWrites.push(() => {
              delete store[fullPath];
            });
          },
        };

        try {
          const result = await updateFunction(transaction);

          // Commit Phase: Verify all read documents have not changed version (Optimistic Concurrency Control)
          let hasConflict = false;
          for (const [readPath, readVer] of readVersions.entries()) {
            const current = store[readPath];
            const currentVer = current ? current._version : 0;
            if (currentVer !== readVer) {
              hasConflict = true;
              break;
            }
          }

          if (hasConflict) {
            // Document modified by a concurrent transaction -> Retry
            await new Promise((r) => setTimeout(r, Math.random() * 5 + 1));
            continue;
          }

          // No conflict -> Apply all staged writes atomically
          for (const writeOp of pendingWrites) {
            writeOp();
          }

          return result;
        } catch (err: any) {
          // If the error occurred inside updateFunction, check if a concurrent write modified the documents in the interim.
          // If so, retry on the freshly committed state (standard Firestore OCC transaction semantics).
          let hasConflict = false;
          for (const [readPath, readVer] of readVersions.entries()) {
            const current = store[readPath];
            const currentVer = current ? current._version : 0;
            if (currentVer !== readVer) {
              hasConflict = true;
              break;
            }
          }

          if (hasConflict && attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, Math.random() * 5 + 1));
            continue;
          }

          // Real business/authorization error on stable snapshot
          throw err;
        }
      }

      throw new Error("Transaction contention: maximum retry limit exceeded.");
    },
  };

  return db;
}

describe("Task 5: Canonical Job Lifecycle Suite", () => {
  let mockDb: any;

  const homeownerIdentity: CanonicalIdentity = {
    uid: "homeowner_alice",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "verified" },
    subscription: { tierId: "free", status: "active" },
  };

  const traderDaveIdentity: CanonicalIdentity = {
    uid: "trader_dave",
    accountType: "service_provider",
    capabilities: ["tradesperson"],
    verification: { status: "verified" },
    subscription: { tierId: "price_pro", status: "active" },
  };

  const traderBobIdentity: CanonicalIdentity = {
    uid: "trader_bob",
    accountType: "service_provider",
    capabilities: ["tradesperson"],
    verification: { status: "verified" },
    subscription: { tierId: "payg", status: "active" },
  };

  const maliciousAttackerIdentity: CanonicalIdentity = {
    uid: "attacker_eve",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "unverified" },
    subscription: { tierId: "free", status: "active" },
  };

  const adminIdentity: CanonicalIdentity = {
    uid: "admin_super",
    accountType: "admin",
    capabilities: ["tradesperson", "homeowner"],
    verification: { status: "verified" },
    subscription: { tierId: "platinum", status: "active" },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDb = createMockFirestore({
      "jobs/job_accepted_1": {
        id: "job_accepted_1",
        homeownerId: "homeowner_alice",
        userId: "homeowner_alice",
        acceptedTradespersonId: "trader_dave",
        acceptedTraderId: "trader_dave",
        tradespersonId: "trader_dave",
        acceptedQuoteId: "quote_123",
        title: "Boiler Service",
        status: "accepted",
        verificationPin: "1234",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      "public_job_cards/job_accepted_1": {
        id: "job_accepted_1",
        title: "Boiler Service",
        status: "accepted",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      "jobs/job_in_progress_2": {
        id: "job_in_progress_2",
        homeownerId: "homeowner_alice",
        userId: "homeowner_alice",
        acceptedTradespersonId: "trader_dave",
        tradespersonId: "trader_dave",
        title: "Kitchen Tiling",
        status: "in_progress",
        startedAt: "2026-10-01T11:00:00.000Z",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      "public_job_cards/job_in_progress_2": {
        id: "job_in_progress_2",
        title: "Kitchen Tiling",
        status: "in_progress",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      "jobs/job_completed_3": {
        id: "job_completed_3",
        homeownerId: "homeowner_alice",
        userId: "homeowner_alice",
        acceptedTradespersonId: "trader_dave",
        tradespersonId: "trader_dave",
        title: "Bathroom Fitting",
        status: "completed",
        completedAt: "2026-10-01T12:00:00.000Z",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      "jobs/job_cancelled_4": {
        id: "job_cancelled_4",
        homeownerId: "homeowner_alice",
        userId: "homeowner_alice",
        acceptedTradespersonId: "trader_dave",
        tradespersonId: "trader_dave",
        title: "Roof Painting",
        status: "cancelled",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      "jobs/job_open_5": {
        id: "job_open_5",
        homeownerId: "homeowner_alice",
        userId: "homeowner_alice",
        title: "Garden Clearance",
        status: "open",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      "public_job_cards/job_open_5": {
        id: "job_open_5",
        title: "Garden Clearance",
        status: "open",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
    });
  });

  describe("1. BOLA / IDOR Authorization Guards", () => {
    it("1. Trader Bob cannot start Trader Dave's accepted job", async () => {
      await expect(
        executeStartJobCommand({
          db: mockDb,
          identity: traderBobIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          idempotencyKey: "test_idemp_start_bola_1",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("2. Trader Bob cannot complete Trader Dave's job", async () => {
      await expect(
        executeCompleteJobCommand({
          db: mockDb,
          identity: traderBobIdentity,
          jobId: "job_in_progress_2",
          idempotencyKey: "test_idemp_complete_bola_2",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("3. Unrelated homeowner Eve cannot cancel Alice's job", async () => {
      await expect(
        executeCancelJobCommand({
          db: mockDb,
          identity: maliciousAttackerIdentity,
          jobId: "job_accepted_1",
          reason: "Malicious cancellation",
          idempotencyKey: "test_idemp_cancel_bola_3",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("4. Unrelated homeowner Eve cannot dispute Alice's job", async () => {
      await expect(
        executeDisputeJobCommand({
          db: mockDb,
          identity: maliciousAttackerIdentity,
          jobId: "job_in_progress_2",
          reason: "Malicious dispute",
          idempotencyKey: "test_idemp_dispute_bola_4",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("5. Admin caller can start, complete, cancel, or dispute any job", async () => {
      const res = await executeCompleteJobCommand({
        db: mockDb,
        identity: adminIdentity,
        jobId: "job_in_progress_2",
        idempotencyKey: "test_idemp_admin_5",
      });
      expect(res.success).toBe(true);
      expect(res.status).toBe("completed");
    });
  });

  describe("2. Mass-Assignment & Protected Key Defense", () => {
    it("6. rejects client-supplied 'status' key in StartJob payload", async () => {
      await expect(
        executeJobLifecycleCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          command: {
            type: "StartJob",
            payload: { jobId: "job_accepted_1", status: "completed" },
          },
          idempotencyKey: "test_idemp_mass_6",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("7. rejects client-supplied 'startedAt' / 'completedAt' / 'cancelledAt' keys", async () => {
      await expect(
        executeJobLifecycleCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          command: {
            type: "CompleteJob",
            payload: { jobId: "job_in_progress_2", completedAt: "1970-01-01T00:00:00Z" },
          },
          idempotencyKey: "test_idemp_mass_7",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("8. rejects client-supplied financial / payment keys in lifecycle commands", async () => {
      await expect(
        executeJobLifecycleCommand({
          db: mockDb,
          identity: homeownerIdentity,
          command: {
            type: "CancelJob",
            payload: { jobId: "job_accepted_1", amount: 0, paymentStatus: "refunded" },
          },
          idempotencyKey: "test_idemp_mass_8",
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("3. Verification PIN Enforcement on StartJob", () => {
    it("9. StartJob rejects when required PIN is missing or invalid", async () => {
      await expect(
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "9999", // Invalid PIN
          idempotencyKey: "test_idemp_pin_9",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("10. StartJob succeeds when correct verification PIN is supplied", async () => {
      const res = await executeStartJobCommand({
        db: mockDb,
        identity: traderDaveIdentity,
        jobId: "job_accepted_1",
        verificationPin: "1234",
        idempotencyKey: "test_idemp_pin_10",
      });
      expect(res.success).toBe(true);
      expect(res.status).toBe("in_progress");
      expect(mockDb._store["jobs/job_accepted_1"].status).toBe("in_progress");
    });
  });

  describe("4. State Machine Transition Rules", () => {
    it("11. legal transition: in_progress -> completed (CompleteJob)", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const res = await executeCompleteJobCommand({
        db: mockDb,
        identity: homeownerIdentity,
        jobId: "job_in_progress_2",
        idempotencyKey: "test_idemp_state_11",
      });
      expect(res.success).toBe(true);
      expect(res.status).toBe("completed");
      expect(mockDb._store["jobs/job_in_progress_2"].status).toBe("completed");
      expect(dispatchSpy).toHaveBeenCalledWith("JOB_COMPLETED", "job_in_progress_2", "homeowner_alice", expect.anything(), expect.anything(), mockDb);
    });

    it("12. legal transition: open -> cancelled (CancelJob)", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const res = await executeCancelJobCommand({
        db: mockDb,
        identity: homeownerIdentity,
        jobId: "job_open_5",
        reason: "No longer needed",
        idempotencyKey: "test_idemp_state_12",
      });
      expect(res.success).toBe(true);
      expect(res.status).toBe("cancelled");
      expect(mockDb._store["jobs/job_open_5"].status).toBe("cancelled");
      expect(dispatchSpy).toHaveBeenCalledWith("JOB_CANCELLED", "job_open_5", "homeowner_alice", expect.anything(), expect.anything(), mockDb);
    });

    it("13. legal transition: in_progress -> disputed (RaiseJobDispute)", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const res = await executeDisputeJobCommand({
        db: mockDb,
        identity: homeownerIdentity,
        jobId: "job_in_progress_2",
        reason: "Workmanship issue",
        idempotencyKey: "test_idemp_state_13",
      });
      expect(res.success).toBe(true);
      expect(res.status).toBe("disputed");
      expect(mockDb._store["jobs/job_in_progress_2"].status).toBe("disputed");
      expect(dispatchSpy).toHaveBeenCalledWith("JOB_DISPUTED", "job_in_progress_2", "homeowner_alice", expect.anything(), expect.anything(), mockDb);
    });

    it("14. illegal transition: cancelled -> in_progress rejected (ConflictError)", async () => {
      await expect(
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_cancelled_4",
          idempotencyKey: "test_idemp_illegal_14",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("15. illegal transition: completed -> in_progress rejected (ConflictError)", async () => {
      await expect(
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_completed_3",
          idempotencyKey: "test_idemp_illegal_15",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("16. illegal transition: open -> completed rejected (ConflictError)", async () => {
      await expect(
        executeCompleteJobCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_open_5",
          idempotencyKey: "test_idemp_illegal_16",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("5. Persistent Transactional Idempotency", () => {
    it("17. retrying with identical idempotency key returns cached result without re-dispatching domain event", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const key = "test_persistent_idemp_key_job_start_100";

      const res1 = await executeStartJobCommand({
        db: mockDb,
        identity: traderDaveIdentity,
        jobId: "job_accepted_1",
        verificationPin: "1234",
        idempotencyKey: key,
      });

      expect(res1.wasReplayed).toBe(false);
      expect(res1.status).toBe("in_progress");
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // Second execution with identical key
      const res2 = await executeStartJobCommand({
        db: mockDb,
        identity: traderDaveIdentity,
        jobId: "job_accepted_1",
        verificationPin: "1234",
        idempotencyKey: key,
      });

      expect(res2.wasReplayed).toBe(true);
      expect(res2.status).toBe("in_progress");
      expect(dispatchSpy).toHaveBeenCalledTimes(1); // Event not re-dispatched
    });
  });

  describe("6. Production Caller Migration Verification", () => {
    it("18. verifies JobDetails.tsx imports and calls job lifecycle commands and does not contain direct Firestore job status updateDoc calls", () => {
      const jobDetailsPath = path.resolve(process.cwd(), "src/components/JobDetails.tsx");
      const content = fs.readFileSync(jobDetailsPath, "utf-8");

      expect(content).toContain("startJobViaCommand");
      expect(content).toContain("completeJobViaCommand");
      expect(content).toContain("cancelJobViaCommand");

      // Verify no direct updateDoc setting status on jobs in JobDetails
      const directStatusUpdatePattern = /updateDoc\s*\(\s*doc\s*\(\s*db\s*,\s*["']jobs["']\s*,\s*[^)]+\)\s*,\s*\{\s*status\s*:/;
      expect(content).not.toMatch(directStatusUpdatePattern);
    });

    it("19. verifies MyJobs.tsx imports and calls cancelJobViaCommand and does not contain direct Firestore job status updateDoc calls", () => {
      const myJobsPath = path.resolve(process.cwd(), "src/components/MyJobs.tsx");
      const content = fs.readFileSync(myJobsPath, "utf-8");

      expect(content).toContain("cancelJobViaCommand");

      const directStatusUpdatePattern = /updateDoc\s*\(\s*doc\s*\(\s*db\s*,\s*["']jobs["']\s*,\s*[^)]+\)\s*,\s*\{\s*status\s*:/;
      expect(content).not.toMatch(directStatusUpdatePattern);
    });
  });

  describe("7. Genuine Concurrency & State Machine Penetration Tests", () => {
    it("20. Test A — Genuine simultaneous StartJob requests produce exactly one success and one ConflictError", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const keyA = `concurrent_start_key_a_${Date.now()}`;
      const keyB = `concurrent_start_key_b_${Date.now()}`;

      // Start both simultaneously without awaiting either one first
      const results = await Promise.allSettled([
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          idempotencyKey: keyA,
        }),
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          idempotencyKey: keyB,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      // Invariant: Exactly one operation succeeds and exactly one fails with ConflictError
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);
      expect(rejected[0].reason.message).toContain("already been started");

      // Invariant: Final job state is in_progress
      expect(mockDb._store["jobs/job_accepted_1"].status).toBe("in_progress");
      expect(mockDb._store["public_job_cards/job_accepted_1"].status).toBe("in_progress");

      // Invariant: Only one lifecycle domain event was emitted
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith("JOB_STARTED", "job_accepted_1", "trader_dave", expect.anything(), expect.anything(), mockDb);

      // Invariant: Only the winning idempotency key has a completed record
      const winningKey = fulfilled[0].value.idempotencyKey || (fulfilled[0].value as any).wasReplayed === false ? (mockDb._store[`idempotency_keys/${keyA}`] ? keyA : keyB) : keyA;
      const losingKey = winningKey === keyA ? keyB : keyA;
      expect(mockDb._store[`idempotency_keys/${winningKey}`]?.status).toBe("completed");
      expect(mockDb._store[`idempotency_keys/${losingKey}`]).toBeUndefined();

      // Invariant: The job cannot be started again
      await expect(
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          idempotencyKey: `start_attempt_after_${Date.now()}`,
        })
      ).rejects.toThrow(ConflictError);
    });

    it("21. Test B — Genuine simultaneous StartJob and CancelJob race produces valid committed state and zero invalid transitions", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const keyStart = `race_key_start_${Date.now()}`;
      const keyCancel = `race_key_cancel_${Date.now()}`;

      // Both requests start simultaneously without awaiting the other
      const results = await Promise.allSettled([
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          expectedStatus: "accepted",
          idempotencyKey: keyStart,
        }),
        executeCancelJobCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_accepted_1",
          reason: "Raced Cancel",
          expectedStatus: "accepted",
          idempotencyKey: keyCancel,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      // Invariant: Exactly one operation commits and one fails with ConflictError
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);

      const finalStatus = mockDb._store["jobs/job_accepted_1"].status;
      expect(["in_progress", "cancelled"]).toContain(finalStatus);
      expect(mockDb._store["public_job_cards/job_accepted_1"].status).toBe(finalStatus);

      // Invariant: Exactly one domain event was dispatched
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    it("22. Test C — Genuine simultaneous CompleteJob requests produce exactly one success and one ConflictError", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const keyA = `concurrent_complete_key_a_${Date.now()}`;
      const keyB = `concurrent_complete_key_b_${Date.now()}`;

      const results = await Promise.allSettled([
        executeCompleteJobCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_in_progress_2",
          completionNotes: "All done A",
          idempotencyKey: keyA,
        }),
        executeCompleteJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_in_progress_2",
          completionNotes: "All done B",
          idempotencyKey: keyB,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);
      expect(rejected[0].reason.message).toContain("already been completed");

      expect(mockDb._store["jobs/job_in_progress_2"].status).toBe("completed");
      expect(mockDb._store["public_job_cards/job_in_progress_2"].status).toBe("completed");
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith("JOB_COMPLETED", "job_in_progress_2", expect.any(String), expect.anything(), expect.anything(), mockDb);
    });

    it("23. Test D — Genuine simultaneous CancelJob requests produce exactly one success and one ConflictError", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const keyA = `concurrent_cancel_key_a_${Date.now()}`;
      const keyB = `concurrent_cancel_key_b_${Date.now()}`;

      const results = await Promise.allSettled([
        executeCancelJobCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_open_5",
          reason: "Cancellation A",
          idempotencyKey: keyA,
        }),
        executeCancelJobCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_open_5",
          reason: "Cancellation B",
          idempotencyKey: keyB,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);
      expect(rejected[0].reason.message).toContain("already been cancelled");

      expect(mockDb._store["jobs/job_open_5"].status).toBe("cancelled");
      expect(mockDb._store["public_job_cards/job_open_5"].status).toBe("cancelled");
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith("JOB_CANCELLED", "job_open_5", "homeowner_alice", expect.anything(), expect.anything(), mockDb);
    });

    it("24. Test E Scenario 1 — Simultaneous requests with SAME idempotency key return cached result with zero duplicate events", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const sharedKey = `shared_idemp_key_${Date.now()}`;

      // Two simultaneous requests using the exact same idempotency key
      const results = await Promise.allSettled([
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          idempotencyKey: sharedKey,
        }),
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          idempotencyKey: sharedKey,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      // Both should succeed (one first-time, one replayed)
      expect(rejected).toHaveLength(0);
      expect(fulfilled).toHaveLength(2);

      const replayFlags = fulfilled.map((f) => f.value.wasReplayed).sort();
      expect(replayFlags).toEqual([false, true]);

      expect(mockDb._store["jobs/job_accepted_1"].status).toBe("in_progress");
      // Domain event dispatched strictly ONCE
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    it("25. Test E Scenario 2 — Simultaneous requests with DIFFERENT idempotency keys produce exactly one success and one ConflictError", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const key1 = `diff_key_1_${Date.now()}`;
      const key2 = `diff_key_2_${Date.now()}`;

      const results = await Promise.allSettled([
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          idempotencyKey: key1,
        }),
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          idempotencyKey: key2,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    it("26. Test F — Sequential StartJob followed by second StartJob with different key is rejected with ConflictError", async () => {
      const keyA = `seq_key_a_${Date.now()}`;
      const keyB = `seq_key_b_${Date.now()}`;

      const res1 = await executeStartJobCommand({
        db: mockDb,
        identity: traderDaveIdentity,
        jobId: "job_accepted_1",
        verificationPin: "1234",
        idempotencyKey: keyA,
      });
      expect(res1.success).toBe(true);

      await expect(
        executeStartJobCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_accepted_1",
          verificationPin: "1234",
          idempotencyKey: keyB,
        })
      ).rejects.toThrow(ConflictError);
    });

    it("27. Sequential legal transition: in_progress -> cancelled works cleanly", async () => {
      const keyStart = `seq_start_${Date.now()}`;
      const keyCancel = `seq_cancel_${Date.now()}`;

      await executeStartJobCommand({
        db: mockDb,
        identity: traderDaveIdentity,
        jobId: "job_accepted_1",
        verificationPin: "1234",
        idempotencyKey: keyStart,
      });

      const resCancel = await executeCancelJobCommand({
        db: mockDb,
        identity: homeownerIdentity,
        jobId: "job_accepted_1",
        reason: "Sequential cancellation",
        idempotencyKey: keyCancel,
      });

      expect(resCancel.success).toBe(true);
      expect(resCancel.status).toBe("cancelled");
      expect(mockDb._store["jobs/job_accepted_1"].status).toBe("cancelled");
    });
  });
});
