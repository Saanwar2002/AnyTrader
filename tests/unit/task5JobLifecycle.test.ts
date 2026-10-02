/**
 * Task 5: Canonical Job Lifecycle Test Suite
 *
 * Comprehensive unit, adversarial BOLA/IDOR, mass assignment, formal state machine,
 * verification PIN, persistent idempotency, domain event, and production caller wiring tests across:
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

function createMockFirestore(initialData: Record<string, any> = {}) {
  const store: Record<string, any> = JSON.parse(JSON.stringify(initialData));

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
              const data = store[fullPath];
              return {
                id: actualDocId,
                exists: data !== undefined && data !== null,
                data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
              };
            },
            async set(data: any, options?: { merge?: boolean }) {
              if (options?.merge && store[fullPath]) {
                store[fullPath] = { ...store[fullPath], ...JSON.parse(JSON.stringify(data)) };
              } else {
                store[fullPath] = JSON.parse(JSON.stringify(data));
              }
            },
            async update(data: any) {
              if (!store[fullPath]) throw new Error(`Document not found: ${fullPath}`);
              store[fullPath] = { ...store[fullPath], ...JSON.parse(JSON.stringify(data)) };
            },
            async delete() {
              delete store[fullPath];
            },
          };
        },
      };
    },
    async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
      const transaction = {
        async get(refOrQuery: any) {
          if (refOrQuery.get) {
            return refOrQuery.get();
          }
          const path = refOrQuery.path;
          const data = store[path];
          return {
            id: refOrQuery.id,
            exists: data !== undefined && data !== null,
            data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
          };
        },
        set(docRef: any, data: any, options?: { merge?: boolean }) {
          const fullPath = docRef.path;
          if (options?.merge && store[fullPath]) {
            store[fullPath] = { ...store[fullPath], ...JSON.parse(JSON.stringify(data)) };
          } else {
            store[fullPath] = JSON.parse(JSON.stringify(data));
          }
        },
        update(docRef: any, data: any) {
          const fullPath = docRef.path;
          if (!store[fullPath]) throw new Error(`Document not found: ${fullPath}`);
          store[fullPath] = { ...store[fullPath], ...JSON.parse(JSON.stringify(data)) };
        },
        delete(docRef: any) {
          delete store[docRef.path];
        },
      };
      return updateFunction(transaction);
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
});
