/**
 * Task 4: Single Authoritative Atomic AcceptQuote Test Suite
 *
 * Comprehensive adversarial, lifecycle, authorization, idempotency, mass assignment,
 * competing quote closure, and production-wiring tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  executeAcceptQuoteCommand,
  executeQuoteCommand,
  validateQuoteCommandPayload,
  QUOTE_MUTATION_PROTECTED_KEYS,
  ACCEPT_QUOTE_SCHEMA,
} from "../../src/server/quoteCommands.ts";
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
            collection(subCollection: string) {
              return db.collection(`${fullPath}/${subCollection}`);
            },
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
        where(field: string, op: string, value: any) {
          return {
            async get() {
              const docs: any[] = [];
              const prefix = `${collectionPath}/`;
              for (const [k, v] of Object.entries(store)) {
                if (k.startsWith(prefix) && !k.substring(prefix.length).includes("/")) {
                  if (op === "==" && v && v[field] === value) {
                    docs.push({
                      id: k.substring(prefix.length),
                      exists: true,
                      data: () => JSON.parse(JSON.stringify(v)),
                    });
                  }
                }
              }
              return { docs, empty: docs.length === 0, size: docs.length };
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
          // If query/collection passed
          const path = refOrQuery.path;
          const docs: any[] = [];
          const prefix = `${path}/`;
          for (const [k, v] of Object.entries(store)) {
            if (k.startsWith(prefix) && !k.substring(prefix.length).includes("/")) {
              docs.push({
                id: k.substring(prefix.length),
                exists: true,
                ref: {
                  id: k.substring(prefix.length),
                  path: k,
                },
                data: () => JSON.parse(JSON.stringify(v)),
              });
            }
          }
          return { docs, empty: docs.length === 0, size: docs.length };
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

describe("Task 4: Single Authoritative Atomic AcceptQuote Suite", () => {
  let mockDb: any;
  const homeownerIdentity: CanonicalIdentity = {
    uid: "homeowner_alice",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "verified" },
    subscription: { tierId: "free", status: "active" },
  };

  const maliciousAttackerIdentity: CanonicalIdentity = {
    uid: "attacker_eve",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "unverified" },
    subscription: { tierId: "free", status: "active" },
  };

  const traderDaveIdentity: CanonicalIdentity = {
    uid: "trader_dave",
    accountType: "service_provider",
    capabilities: ["tradesperson"],
    verification: { status: "verified" },
    subscription: { tierId: "price_pro", status: "active" },
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
      "jobs/job_boiler_1": {
        id: "job_boiler_1",
        homeownerId: "homeowner_alice",
        userId: "homeowner_alice",
        title: "Fix Emergency Boiler",
        status: "open",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      "jobs/job_boiler_1/quotes/quote_dave_1": {
        id: "quote_dave_1",
        jobId: "job_boiler_1",
        tradespersonId: "trader_dave",
        traderId: "trader_dave",
        amount: 450,
        totalAmount: 450,
        status: "pending",
        startDate: "2026-10-05",
        createdAt: "2026-10-01T11:00:00.000Z",
      },
      "jobs/job_boiler_1/quotes/quote_bob_2": {
        id: "quote_bob_2",
        jobId: "job_boiler_1",
        tradespersonId: "trader_bob",
        traderId: "trader_bob",
        amount: 500,
        totalAmount: 500,
        status: "pending",
        startDate: "2026-10-06",
        createdAt: "2026-10-01T11:30:00.000Z",
      },
      "jobs/job_other_99": {
        id: "job_other_99",
        homeownerId: "homeowner_charlie",
        userId: "homeowner_charlie",
        title: "Roof repair",
        status: "open",
      },
      "jobs/job_other_99/quotes/quote_alien_1": {
        id: "quote_alien_1",
        jobId: "job_other_99",
        tradespersonId: "trader_alien",
        amount: 1200,
        status: "pending",
      },
    });
  });

  describe("1. Authorization Guards", () => {
    it("1. unrelated homeowner cannot accept a quote on another user's job", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: maliciousAttackerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          idempotencyKey: "test_idemp_auth_1",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("2. trader cannot accept their own quote as homeowner", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          idempotencyKey: "test_idemp_auth_2",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("3. trader A cannot cause acceptance of trader B's quote", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: traderDaveIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_bob_2",
          idempotencyKey: "test_idemp_auth_3",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("4. forged UID in body cannot change the authenticated actor", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: maliciousAttackerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          rawPayload: {
            homeownerId: "homeowner_alice", // Malicious body override
            userId: "homeowner_alice",
          },
          idempotencyKey: "test_idemp_auth_4",
        })
      ).rejects.toThrow(BadRequestError); // Rejected by mass-assignment defense
    });
  });

  describe("2. Relationship & Identity Invariants", () => {
    it("5. quote belonging to another job cannot be accepted", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_alien_1", // Belongs to job_other_99
          idempotencyKey: "test_idemp_rel_5",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("6. non-existent quote ID throws NotFoundError", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "non_existent_quote",
          idempotencyKey: "test_idemp_rel_6",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("3. Lifecycle & State Machine Validation", () => {
    it("7. already accepted quote cannot be accepted again (ConflictError)", async () => {
      // First acceptance succeeds
      const res1 = await executeAcceptQuoteCommand({
        db: mockDb,
        identity: homeownerIdentity,
        jobId: "job_boiler_1",
        quoteId: "quote_dave_1",
        idempotencyKey: "test_idemp_state_7a",
      });
      expect(res1.status).toBe("accepted");

      // Attempting to accept again with new idempotency key fails
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          idempotencyKey: "test_idemp_state_7b",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("8. withdrawn quote cannot be accepted", async () => {
      mockDb._store["jobs/job_boiler_1/quotes/quote_dave_1"].status = "withdrawn";

      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          idempotencyKey: "test_idemp_state_8",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("9. rejected quote cannot be accepted", async () => {
      mockDb._store["jobs/job_boiler_1/quotes/quote_dave_1"].status = "rejected";

      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          idempotencyKey: "test_idemp_state_9",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("10. cancelled/closed job cannot accept quotes", async () => {
      mockDb._store["jobs/job_boiler_1"].status = "cancelled";

      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          idempotencyKey: "test_idemp_state_10",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("4. Protected Fields & Mass Assignment Defense", () => {
    it("11. client-supplied accepted trader cannot override server identity", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          rawPayload: { acceptedTradespersonId: "attacker_eve" },
          idempotencyKey: "test_idemp_prot_11",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("12. client-supplied status cannot bypass lifecycle", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          rawPayload: { status: "completed" },
          idempotencyKey: "test_idemp_prot_12",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("13. client-supplied acceptedAt cannot override server timestamp", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          rawPayload: { acceptedAt: "1970-01-01T00:00:00.000Z" },
          idempotencyKey: "test_idemp_prot_13",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("14. client-supplied financial fields cannot alter authoritative acceptance", async () => {
      await expect(
        executeAcceptQuoteCommand({
          db: mockDb,
          identity: homeownerIdentity,
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          rawPayload: { commission: 0, platformFee: 0, netPayout: 10000 },
          idempotencyKey: "test_idemp_prot_14",
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("5. Competing Quotes & Atomic Result State", () => {
    it("15. atomically accepts target quote and rejects competing pending quotes", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");

      const result = await executeAcceptQuoteCommand({
        db: mockDb,
        identity: homeownerIdentity,
        jobId: "job_boiler_1",
        quoteId: "quote_dave_1",
        idempotencyKey: "test_idemp_comp_15",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("accepted");
      expect(result.acceptedTradespersonId).toBe("trader_dave");
      expect(result.verificationPin).toBeDefined();
      expect(result.scheduledDate).toBe("2026-10-05");

      // Verify Job in Firestore
      const jobInDb = mockDb._store["jobs/job_boiler_1"];
      expect(jobInDb.status).toBe("accepted");
      expect(jobInDb.acceptedQuoteId).toBe("quote_dave_1");
      expect(jobInDb.acceptedTradespersonId).toBe("trader_dave");
      expect(jobInDb.acceptedTraderId).toBe("trader_dave");
      expect(jobInDb.verificationPin).toBe(result.verificationPin);

      // Verify Target Quote in Firestore
      const targetQuoteInDb = mockDb._store["jobs/job_boiler_1/quotes/quote_dave_1"];
      expect(targetQuoteInDb.status).toBe("accepted");

      // Verify Competing Quote Bob was atomically rejected
      const competingQuoteInDb = mockDb._store["jobs/job_boiler_1/quotes/quote_bob_2"];
      expect(competingQuoteInDb.status).toBe("rejected");
      expect(competingQuoteInDb.rejectionReason).toBe("Job awarded to another trader");

      // Verify Domain Event was dispatched exactly once
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(
        "QUOTE_ACCEPTED",
        "quote_dave_1",
        "homeowner_alice",
        expect.objectContaining({
          jobId: "job_boiler_1",
          quoteId: "quote_dave_1",
          traderId: "trader_dave",
          amount: 450,
        }),
        undefined,
        mockDb
      );
    });
  });

  describe("6. Persistent Transactional Idempotency", () => {
    it("16. retrying with the same idempotency key returns cached result without re-executing", async () => {
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const key = "test_persistent_idemp_key_123456";

      const firstResult = await executeAcceptQuoteCommand({
        db: mockDb,
        identity: homeownerIdentity,
        jobId: "job_boiler_1",
        quoteId: "quote_dave_1",
        idempotencyKey: key,
      });

      expect(firstResult.wasReplayed).toBe(false);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // Replay with identical key
      const replayResult = await executeAcceptQuoteCommand({
        db: mockDb,
        identity: homeownerIdentity,
        jobId: "job_boiler_1",
        quoteId: "quote_dave_1",
        idempotencyKey: key,
      });

      expect(replayResult.wasReplayed).toBe(true);
      expect(replayResult.quoteId).toBe("quote_dave_1");
      expect(replayResult.status).toBe("accepted");
      expect(replayResult.verificationPin).toBe(firstResult.verificationPin);

      // Does not re-dispatch domain event on replay
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("7. Production Caller Wiring Verification", () => {
    it("17. verifies JobDetails.tsx imports and calls acceptQuoteViaServer and does not contain direct Firestore quote updates", () => {
      const jobDetailsPath = path.resolve(process.cwd(), "src/components/JobDetails.tsx");
      const content = fs.readFileSync(jobDetailsPath, "utf-8");

      // Verify import of acceptQuoteViaServer
      expect(content).toContain("acceptQuoteViaServer");

      // Verify call in handleAcceptQuote
      expect(content).toMatch(/acceptQuoteViaServer\s*\(\s*\{/);

      // Verify no direct updateDoc on quotes subcollection inside JobDetails
      const directQuoteUpdatePattern = /updateDoc\s*\(\s*doc\s*\(\s*db\s*,\s*["']jobs["']\s*,\s*[^,]+\s*,\s*["']quotes["']/;
      expect(content).not.toMatch(directQuoteUpdatePattern);
    });

    it("18. verifies JobDetails.tsx generates and passes a stable idempotencyKey to acceptQuoteViaServer", () => {
      const jobDetailsPath = path.resolve(process.cwd(), "src/components/JobDetails.tsx");
      const content = fs.readFileSync(jobDetailsPath, "utf-8");

      // Verify that acceptIdempotencyKey is defined and passed to acceptQuoteViaServer
      expect(content).toMatch(/const\s+acceptIdempotencyKey\s*=/);
      expect(content).toMatch(/idempotencyKey:\s*acceptIdempotencyKey/);
    });

    it("19. verifies acceptQuoteViaServer forwards the stable idempotency key in headers and payload", async () => {
      const quoteCommandServicePath = path.resolve(process.cwd(), "src/services/quoteCommandService.ts");
      const content = fs.readFileSync(quoteCommandServicePath, "utf-8");

      // Verify that acceptQuoteViaServer accepts and handles idempotencyKey
      expect(content).toContain("acceptQuoteViaServer");
      expect(content).toContain('"x-idempotency-key": effectiveIdempotencyKey');
      expect(content).toContain('"X-Idempotency-Key": effectiveIdempotencyKey');
      expect(content).toContain('"Idempotency-Key": effectiveIdempotencyKey');
      expect(content).toMatch(/body:\s*JSON\.stringify\(\s*\{\s*quoteId,\s*idempotencyKey:\s*effectiveIdempotencyKey\s*\}\s*\)/);
    });

    it("20. verifies JobDetails.tsx maintains acceptIdempotencyKeysRef for stable key retention across network retries", () => {
      const jobDetailsPath = path.resolve(process.cwd(), "src/components/JobDetails.tsx");
      const content = fs.readFileSync(jobDetailsPath, "utf-8");

      expect(content).toContain("acceptIdempotencyKeysRef");
      expect(content).toContain("acceptIdempotencyKeysRef.current[quote.id]");
    });
  });
});
