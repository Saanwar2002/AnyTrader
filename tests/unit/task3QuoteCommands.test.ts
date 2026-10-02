/**
 * Canonical Quote Commands Test Suite for AnyTrader V2 (Task 3)
 *
 * Comprehensive unit and adversarial tests covering:
 * 1. Strict input validation & mass assignment defense (QUOTE_MUTATION_PROTECTED_KEYS)
 * 2. Authorization guards (anti-self quoting, direct quote targeting, cross-trader BOLA defense)
 * 3. Authoritative server-side financial calculations (12% commission, net payout, milestones)
 * 4. Formal state machine transitions (Create, Update, Withdraw, Reject, RequestRequote, RespondToRequote)
 * 5. Persistent transactional idempotency replay protection
 * 6. Parent job quote count and metadata synchronization
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  executeQuoteCommand,
  validateQuoteCommandPayload,
  QUOTE_MUTATION_PROTECTED_KEYS,
  QuoteCommandPayload,
} from "../../src/server/quoteCommands.ts";
import { CanonicalIdentity } from "../../src/server/identity.ts";
import { BadRequestError, ForbiddenError, NotFoundError, ConflictError } from "../../src/server/httpErrors.ts";
import { domainEvents } from "../../src/server/domainEvents.ts";

// In-memory Firestore test double supporting collection, doc, transactions, and where queries
function createMockFirestore(initialData: Record<string, any> = {}) {
  const store: Record<string, any> = JSON.parse(JSON.stringify(initialData));

  function getDocPath(path: string) {
    return path.replace(/^\/+|\/+$/g, "");
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
        async get(docRef: any) {
          return docRef.get();
        },
        set(docRef: any, data: any, options?: { merge?: boolean }) {
          docRef.set(data, options);
        },
        update(docRef: any, data: any) {
          docRef.update(data);
        },
        delete(docRef: any) {
          docRef.delete();
        },
      };
      return updateFunction(transaction);
    },
  };

  return db;
}

describe("Task 3: Canonical Quote Commands Test Suite", () => {
  let db: any;

  const traderIdentity: CanonicalIdentity = {
    uid: "trader_dave_123",
    accountType: "service_provider",
    capabilities: ["tradesperson"],
    verification: { status: "verified" },
    subscription: { tierId: "price_pro", status: "active" },
  };

  const homeownerIdentity: CanonicalIdentity = {
    uid: "homeowner_alice_456",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "verified" },
    subscription: { tierId: "price_payg", status: "active" },
  };

  const rivalTraderIdentity: CanonicalIdentity = {
    uid: "trader_malicious_789",
    accountType: "service_provider",
    capabilities: ["tradesperson"],
    verification: { status: "verified" },
    subscription: { tierId: "price_payg", status: "active" },
  };

  const attackerHomeownerIdentity: CanonicalIdentity = {
    uid: "attacker_eve_999",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "verified" },
    subscription: { tierId: "price_payg", status: "active" },
  };

  const adminIdentity: CanonicalIdentity = {
    uid: "platform_admin_000",
    accountType: "admin",
    capabilities: ["tradesperson", "homeowner"],
    verification: { status: "verified" },
    subscription: { tierId: "price_platinum", status: "active" },
  };

  beforeEach(() => {
    db = createMockFirestore({
      "jobs/job_roof_100": {
        id: "job_roof_100",
        homeownerId: "homeowner_alice_456",
        title: "Fix Leaking Slate Roof",
        status: "open",
        quoteCount: 0,
        quotesCount: 0,
      },
      "jobs/job_direct_200": {
        id: "job_direct_200",
        homeownerId: "homeowner_alice_456",
        title: "Direct Boiler Service",
        status: "open",
        targetTradespersonId: "trader_dave_123",
        isDirectQuote: true,
        quoteCount: 0,
      },
    });
  });

  describe("1. Input Schema & Mass Assignment Defense", () => {
    it("rejects client attempts to supply server-owned protected fields", () => {
      for (const protectedKey of [
        "tradespersonId",
        "homeownerId",
        "commission",
        "platformFee",
        "netPayout",
        "status",
        "createdAt",
        "revisionCount",
        "payoutTransferred",
        // Inherited Task 1 protected keys
        "accountType",
        "capabilities",
        "customClaims",
        "permissions",
        "tierId",
        "subscriptionStatus",
        "verified",
        "rating",
        "trustScore",
      ]) {
        expect(() =>
          validateQuoteCommandPayload("CreateQuote", {
            jobId: "job_roof_100",
            amount: 500,
            [protectedKey]: "malicious_override",
          })
        ).toThrow(BadRequestError);
      }
    });

    it("enforces mandatory idempotency key bounds (8 <= length <= 200)", async () => {
      // 1. Missing idempotency key
      await expect(
        executeQuoteCommand({
          db,
          identity: traderIdentity,
          command: {
            type: "CreateQuote",
            payload: { jobId: "job_roof_100", amount: 500 },
          },
          idempotencyKey: "",
        })
      ).rejects.toThrow(BadRequestError);

      // 2. Too short (< 8 chars)
      await expect(
        executeQuoteCommand({
          db,
          identity: traderIdentity,
          command: {
            type: "CreateQuote",
            payload: { jobId: "job_roof_100", amount: 500 },
          },
          idempotencyKey: "short",
        })
      ).rejects.toThrow(BadRequestError);

      // 3. Too long (> 200 chars)
      await expect(
        executeQuoteCommand({
          db,
          identity: traderIdentity,
          command: {
            type: "CreateQuote",
            payload: { jobId: "job_roof_100", amount: 500 },
          },
          idempotencyKey: "a".repeat(201),
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("rejects non-positive amounts or invalid schemas", () => {
      expect(() =>
        validateQuoteCommandPayload("CreateQuote", {
          jobId: "job_roof_100",
          amount: -50,
        })
      ).toThrow(BadRequestError);

      expect(() =>
        validateQuoteCommandPayload("CreateQuote", {
          jobId: "job_roof_100",
          amount: 0,
        })
      ).toThrow(BadRequestError);

      expect(() =>
        validateQuoteCommandPayload("CreateQuote", {
          amount: 500, // missing jobId
        })
      ).toThrow(BadRequestError);
    });
  });

  describe("2. Authorization & Governance Invariants", () => {
    it("forbids a homeowner from submitting a quote on their own job", async () => {
      const command: QuoteCommandPayload = {
        type: "CreateQuote",
        payload: {
          jobId: "job_roof_100",
          amount: 350,
          coverNote: "Self-quoting attempt",
        },
      };

      await expect(
        executeQuoteCommand({
          db,
          identity: homeownerIdentity,
          command,
          idempotencyKey: "test_idemp_self_quote_123",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("forbids non-targeted traders from quoting a private direct quote job", async () => {
      const command: QuoteCommandPayload = {
        type: "CreateQuote",
        payload: {
          jobId: "job_direct_200",
          amount: 400,
          coverNote: "Interception attempt by rival trader",
        },
      };

      await expect(
        executeQuoteCommand({
          db,
          identity: rivalTraderIdentity,
          command,
          idempotencyKey: "test_idemp_direct_intercept_123",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("allows the targeted trader to quote a direct quote job", async () => {
      const command: QuoteCommandPayload = {
        type: "CreateQuote",
        payload: {
          jobId: "job_direct_200",
          amount: 400,
          coverNote: "Legitimate direct quote from Dave",
        },
      };

      const result = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command,
        idempotencyKey: "test_idemp_direct_valid_123",
      });

      expect(result.success).toBe(true);
      expect(result.quoteId).toBeDefined();
      expect(result.status).toBe("pending");
    });

    it("forbids Trader A from modifying Trader B's quote (BOLA defense)", async () => {
      // 1. Dave creates a quote
      const createResult = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 500,
            coverNote: "Dave's roofing quote",
          },
        },
        idempotencyKey: "test_idemp_dave_create_123",
      });

      // 2. Rival trader tries to update Dave's quote
      const updateCommand: QuoteCommandPayload = {
        type: "UpdateQuote",
        payload: {
          jobId: "job_roof_100",
          quoteId: createResult.quoteId,
          amount: 1000,
          coverNote: "Malicious price hike by rival",
        },
      };

      await expect(
        executeQuoteCommand({
          db,
          identity: rivalTraderIdentity,
          command: updateCommand,
          idempotencyKey: "test_idemp_rival_update_123",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("forbids Trader A from withdrawing Trader B's quote", async () => {
      const createResult = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 500,
          },
        },
        idempotencyKey: "test_idemp_create_for_withdraw_123",
      });

      await expect(
        executeQuoteCommand({
          db,
          identity: rivalTraderIdentity,
          command: {
            type: "WithdrawQuote",
            payload: {
              jobId: "job_roof_100",
              quoteId: createResult.quoteId,
              reason: "Malicious withdrawal by competitor",
            },
          },
          idempotencyKey: "test_idemp_rival_withdraw_123",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("forbids an unrelated homeowner from rejecting or requesting requote", async () => {
      const createResult = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 500,
          },
        },
        idempotencyKey: "test_idemp_create_for_eve_123",
      });

      // Attacker Homeowner Eve tries to reject Alice's received quote
      await expect(
        executeQuoteCommand({
          db,
          identity: attackerHomeownerIdentity,
          command: {
            type: "RejectQuote",
            payload: {
              jobId: "job_roof_100",
              quoteId: createResult.quoteId,
              reason: "Unauthorized rejection",
            },
          },
          idempotencyKey: "test_idemp_eve_reject_123",
        })
      ).rejects.toThrow(ForbiddenError);

      // Attacker Homeowner Eve tries to request requote on Alice's job
      await expect(
        executeQuoteCommand({
          db,
          identity: attackerHomeownerIdentity,
          command: {
            type: "RequestRequote",
            payload: {
              jobId: "job_roof_100",
              quoteId: createResult.quoteId,
              message: "Unauthorized requote request",
            },
          },
          idempotencyKey: "test_idemp_eve_requote_123",
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("3. Authoritative Server Financial Calculations & Milestones", () => {
    it("calculates 12% standard platform commission and net payout deterministically", async () => {
      const result = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 1000,
            coverNote: "Full roofing overhaul",
          },
        },
        idempotencyKey: "test_idemp_calc_fee_123",
      });

      expect(result.quote).toBeDefined();
      expect(result.quote?.amount).toBe(1000);
      expect(result.quote?.platformFee).toBe(120); // 12% of £1000
      expect(result.quote?.netPayout).toBe(880); // £1000 - £120
      expect(result.quote?.milestones).toHaveLength(1);
      expect(result.quote?.milestones[0].amount).toBe(1000);
    });

    it("validates and validates custom multi-milestone distributions", async () => {
      const result = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 1000,
            milestones: [
              { title: "Stage 1: Teardown & Scaffolding", amount: 300, description: "Initial setup" },
              { title: "Stage 2: Timber & Underlayment", amount: 400, description: "Midpoint inspection" },
              { title: "Stage 3: Slate Laying & Cleanup", amount: 300, description: "Final delivery" },
            ],
          },
        },
        idempotencyKey: "test_idemp_multi_ms_123",
      });

      expect(result.quote?.milestones).toHaveLength(3);
      expect(result.quote?.milestones[0].amount).toBe(300);
      expect(result.quote?.milestones[1].amount).toBe(400);
      expect(result.quote?.milestones[2].amount).toBe(300);
    });

    it("rejects milestone configurations whose amounts do not sum to total quote amount", async () => {
      await expect(
        executeQuoteCommand({
          db,
          identity: traderIdentity,
          command: {
            type: "CreateQuote",
            payload: {
              jobId: "job_roof_100",
              amount: 1000,
              milestones: [
                { title: "Stage 1", amount: 300 },
                { title: "Stage 2", amount: 400 },
                { title: "Stage 3", amount: 200 }, // sum is 900 != 1000
              ],
            },
          },
          idempotencyKey: "test_idemp_invalid_ms_sum_123",
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("4. Lifecycle Transitions & State Machine Enforcement", () => {
    it("executes full CreateQuote -> RequestRequote -> RespondToRequote -> WithdrawQuote sequence", async () => {
      // 1. CreateQuote
      const createRes = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 600,
            coverNote: "Initial quote",
          },
        },
        idempotencyKey: "test_idemp_seq_create_123",
      });
      expect(createRes.status).toBe("pending");
      expect(createRes.quote?.revisionCount).toBe(1);

      // Verify parent job was updated to 'quoted' with quoteCount = 1
      const jobSnap1 = await db.collection("jobs").doc("job_roof_100").get();
      expect(jobSnap1.data().status).toBe("quoted");
      expect(jobSnap1.data().quoteCount).toBe(1);

      // 2. RequestRequote by Homeowner Alice
      const requoteRes = await executeQuoteCommand({
        db,
        identity: homeownerIdentity,
        command: {
          type: "RequestRequote",
          payload: {
            jobId: "job_roof_100",
            quoteId: createRes.quoteId,
            message: "Can you do £550 if we provide the tiles?",
            suggestedBudget: 550,
          },
        },
        idempotencyKey: "test_idemp_seq_requote_123",
      });
      expect(requoteRes.status).toBe("requote_requested");
      expect(requoteRes.quote?.requoteMessage).toBe("Can you do £550 if we provide the tiles?");

      // 3. RespondToRequote by Trader Dave
      const respondRes = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "RespondToRequote",
          payload: {
            jobId: "job_roof_100",
            quoteId: createRes.quoteId,
            amount: 550,
            coverNote: "Agreed, revised to £550 with homeowner-supplied tiles.",
          },
        },
        idempotencyKey: "test_idemp_seq_respond_123",
      });
      expect(respondRes.status).toBe("requoted");
      expect(respondRes.quote?.amount).toBe(550);
      expect(respondRes.quote?.platformFee).toBe(66); // 12% of 550
      expect(respondRes.quote?.netPayout).toBe(484);
      expect(respondRes.quote?.revisionCount).toBe(2);

      // 4. WithdrawQuote by Trader Dave
      const withdrawRes = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "WithdrawQuote",
          payload: {
            jobId: "job_roof_100",
            quoteId: createRes.quoteId,
            reason: "Fully booked next week",
          },
        },
        idempotencyKey: "test_idemp_seq_withdraw_123",
      });
      expect(withdrawRes.status).toBe("withdrawn");

      // Verify parent job quoteCount decremented to 0
      const jobSnap2 = await db.collection("jobs").doc("job_roof_100").get();
      expect(jobSnap2.data().quoteCount).toBe(0);
    });

    it("executes RejectQuote by Homeowner", async () => {
      const createRes = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 800,
          },
        },
        idempotencyKey: "test_idemp_create_reject_123",
      });

      const rejectRes = await executeQuoteCommand({
        db,
        identity: homeownerIdentity,
        command: {
          type: "RejectQuote",
          payload: {
            jobId: "job_roof_100",
            quoteId: createRes.quoteId,
            reason: "Found alternative contractor",
          },
        },
        idempotencyKey: "test_idemp_do_reject_123",
      });

      expect(rejectRes.status).toBe("rejected");
      expect(rejectRes.quote?.rejectReason).toBe("Found alternative contractor");
    });
  });

  describe("5. Persistent Idempotency & Replay Protection", () => {
    it("replays identical quote creation requests without duplicate writes or quote count increments", async () => {
      const idempotencyKey = "unique_quote_idemp_key_12345";

      const res1 = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 750,
            coverNote: "Idempotency test quote",
          },
        },
        idempotencyKey,
      });

      expect(res1.wasReplayed).toBe(false);
      const originalQuoteId = res1.quoteId;

      // Replay identical command
      const res2 = await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 750,
            coverNote: "Idempotency test quote",
          },
        },
        idempotencyKey,
      });

      expect(res2.wasReplayed).toBe(true);
      expect(res2.quoteId).toBe(originalQuoteId);

      // Assert job quote count was incremented only once
      const jobSnap = await db.collection("jobs").doc("job_roof_100").get();
      expect(jobSnap.data().quoteCount).toBe(1);
    });
  });

  describe("6. Anti-Spam & Concurrency Duplicate Protection", () => {
    it("prevents a trader from creating multiple active quotes on the same job", async () => {
      // 1. Dave creates first quote
      await executeQuoteCommand({
        db,
        identity: traderIdentity,
        command: {
          type: "CreateQuote",
          payload: {
            jobId: "job_roof_100",
            amount: 500,
          },
        },
        idempotencyKey: "test_idemp_spam_quote_1_123",
      });

      // 2. Dave tries to create a second quote without withdrawing the first
      await expect(
        executeQuoteCommand({
          db,
          identity: traderIdentity,
          command: {
            type: "CreateQuote",
            payload: {
              jobId: "job_roof_100",
              amount: 600,
            },
          },
          idempotencyKey: "test_idemp_spam_quote_2_123",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("7. Production Caller Regression Coverage (JobDetails.tsx)", () => {
    it("verifies JobDetails.tsx routes quote acceptance and rejection through authoritative server commands", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const jobDetailsPath = path.resolve(__dirname, "../../src/components/JobDetails.tsx");
      const jobDetailsCode = fs.readFileSync(jobDetailsPath, "utf-8");

      // 1. Authoritative acceptQuoteViaServer must be imported and invoked
      expect(jobDetailsCode).toContain("acceptQuoteViaServer");
      expect(jobDetailsCode).toMatch(/await\s+acceptQuoteViaServer\s*\(\s*\{/);

      // 2. Authoritative rejectQuoteViaCommand must be imported and invoked
      expect(jobDetailsCode).toContain("rejectQuoteViaCommand");
      expect(jobDetailsCode).toMatch(/await\s+rejectQuoteViaCommand\s*\(\s*\{/);

      // 3. Direct quote mutation patterns must be completely absent
      // Direct transaction quote update:
      expect(jobDetailsCode).not.toContain("t.update(quoteRef");
      expect(jobDetailsCode).not.toMatch(/t\.update\s*\(\s*quoteRef/);

      // Direct updateDoc on quotes subcollection:
      expect(jobDetailsCode).not.toMatch(/updateDoc\s*\(\s*doc\s*\(\s*db\s*,\s*["']jobs["']\s*,\s*\w+\s*,\s*["']quotes["']/);
      expect(jobDetailsCode).not.toMatch(/setDoc\s*\(\s*doc\s*\(\s*db\s*,\s*["']jobs["']\s*,\s*\w+\s*,\s*["']quotes["']/);
      expect(jobDetailsCode).not.toMatch(/deleteDoc\s*\(\s*doc\s*\(\s*db\s*,\s*["']jobs["']\s*,\s*\w+\s*,\s*["']quotes["']/);
    });

    it("verifies acceptQuoteViaServer adapter executes authoritative POST /api/jobs/:jobId/accept-quote", async () => {
      const { acceptQuoteViaServer } = await import("../../src/services/quoteCommandService.ts");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          jobId: "job_roof_100",
          quoteId: "quote_test_777",
          status: "accepted",
          acceptedTradespersonId: "trader_dave_123",
          scheduledDate: "2026-10-15",
          verificationPin: "4829",
          isConfirmedByTradesperson: false,
        }),
      });

      const originalFetch = global.fetch;
      global.fetch = mockFetch as any;

      try {
        const mockUser: any = {
          uid: "homeowner_alice_456",
          getIdToken: vi.fn().mockResolvedValue("mock_valid_token_123"),
        };

        const result = await acceptQuoteViaServer({
          user: mockUser,
          jobId: "job_roof_100",
          quoteId: "quote_test_777",
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0];
        expect(fetchUrl).toContain("/api/jobs/job_roof_100/accept-quote");
        expect(fetchOptions.method).toBe("POST");
        expect(fetchOptions.headers["Authorization"]).toBe("Bearer mock_valid_token_123");
        expect(JSON.parse(fetchOptions.body)).toMatchObject({ quoteId: "quote_test_777" });

        expect(result.success).toBe(true);
        expect(result.status).toBe("accepted");
        expect(result.verificationPin).toBe("4829");
        expect(result.scheduledDate).toBe("2026-10-15");
        expect(result.isConfirmedByTradesperson).toBe(false);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
