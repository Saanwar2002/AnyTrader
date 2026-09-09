import { describe, it, expect, beforeEach } from "vitest";
import { 
  validateJobTransition, 
  validateMilestoneTransition, 
  validateRideTransition, 
  InvalidStateTransitionError 
} from "../../src/server/stateMachine.ts";
import { 
  assertResourceOwner, 
  assertCanManageMilestone, 
  assertCanAccessJob,
  assertCanModifyJob,
  assertCanAccessProperty,
  assertCanModifyProperty,
  assertCanModifyQuote,
  assertCanDeleteQuote,
  assertCanAccessDispute,
  assertCanModifyDispute,
  assertCanAccessConversation,
  sanitizeClientPayload 
} from "../../src/server/authorization.ts";
import { 
  ForbiddenError, 
  BadRequestError,
  ConflictError,
  TooManyRequestsError
} from "../../src/server/httpErrors.ts";
import { PaymentLedgerEngine } from "../../src/server/paymentLedger.ts";
import { BusinessLogicDefense } from "../../src/server/businessLogicDefense.ts";
import { ConcurrencyLockEngine } from "../../src/server/concurrencyLock.ts";
import { AbuseDefenseEngine } from "../../src/server/abuseDefense.ts";

describe("Adversarial Red-Team & Exploit Verification Suite", () => {
  beforeEach(() => {
    BusinessLogicDefense._resetNoncesForTesting();
    ConcurrencyLockEngine._resetLocksForTesting();
    AbuseDefenseEngine._resetLogsForTesting();
  });

  // =========================================================================
  // RISK CATEGORY 1: IDOR / BOLA (Broken Object-Level Authorization)
  // =========================================================================
  describe("1. IDOR / BOLA (Broken Object-Level Authorization Defense)", () => {
    it("BLOCKS attacker changing jobId=A to jobId=B to read or modify a private job", () => {
      const attacker = { uid: "attacker_user_666", role: "user" };
      const privateJobB = { 
        id: "job_B", 
        homeownerId: "homeowner_victim_111", 
        status: "in_progress",
        tradespersonId: "assigned_trader_222" 
      };

      // Attacker cannot read private in-progress job B
      expect(() => {
        assertCanAccessJob(attacker, privateJobB);
      }).toThrow(ForbiddenError);

      // Attacker cannot modify job B
      expect(() => {
        assertCanModifyJob(attacker, privateJobB);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS malicious trader from altering or deleting another trader's quote", () => {
      const maliciousTrader = { uid: "trader_malicious_888", role: "tradesperson" };
      const legitimateTraderQuote = {
        id: "quote_456",
        tradespersonId: "trader_legitimate_999",
        jobId: "job_123",
        homeownerId: "homeowner_123",
        amount: 350
      };

      expect(() => {
        assertCanModifyQuote(maliciousTrader, legitimateTraderQuote);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanDeleteQuote(maliciousTrader, legitimateTraderQuote);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS eavesdropping and injection into conversation threads by non-participants", () => {
      const attacker = { uid: "snooper_user_404", role: "user" };
      const authorizedParticipants = ["user_alice_1", "trader_bob_2"];

      expect(() => {
        assertCanAccessConversation(attacker, authorizedParticipants);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS attacker changing propertyId=A to propertyId=B to modify property passports", () => {
      const attacker = { uid: "attacker_landlord_999", role: "landlord" };
      const victimPropertyB = {
        id: "prop_B",
        ownerId: "legitimate_landlord_777",
        postcode: "SW1A 1AA",
        boilerBrand: "Worcester Bosch",
        isPublicPassport: false
      };

      expect(() => {
        assertCanAccessProperty(attacker, victimPropertyB);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanModifyProperty(attacker, victimPropertyB);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS unauthorized users from snooping on or resolving tenant disputes", () => {
      const unrelatedUser = { uid: "random_bystander_333", role: "user", email: "bystander@example.com" };
      const tenantDispute = {
        id: "dispute_89",
        landlordOwnerId: "landlord_444",
        claimantId: "tenant_555",
        tenantEmail: "tenant@example.com",
        respondentId: "trader_666",
        status: "open"
      };

      expect(() => {
        assertCanAccessDispute(unrelatedUser, tenantDispute);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanModifyDispute(unrelatedUser, tenantDispute);
      }).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // RISK CATEGORY 2: Property-Level Privilege Escalation (Mass-Assignment)
  // =========================================================================
  describe("2. Property-Level Privilege Escalation Defense", () => {
    it("STRIPS role, isAdmin, verified, and payout status keys injected into frontend payload", () => {
      const maliciousPayload = {
        title: "Kitchen renovation",
        description: "Repainting cabinets",
        role: "admin",
        isAdmin: true,
        verified: true,
        isVerified: true,
        idVerified: true,
        verifiedTrader: true,
        paymentStatus: "funded",
        payoutStatus: "transferred",
        ownerId: "hijacked_admin_id",
        homeownerId: "spoofed_homeowner",
        completed: true,
        isCompleted: true,
        funded: true,
        balance: 999999,
        credits: 50000,
        payoutTransferred: true
      };

      const sanitized = sanitizeClientPayload(maliciousPayload);

      // Only safe domain fields survive
      expect(sanitized.title).toBe("Kitchen renovation");
      expect(sanitized.description).toBe("Repainting cabinets");

      // Critical privilege & verification fields are strictly purged
      expect(sanitized.role).toBeUndefined();
      expect(sanitized.isAdmin).toBeUndefined();
      expect(sanitized.verified).toBeUndefined();
      expect(sanitized.isVerified).toBeUndefined();
      expect(sanitized.idVerified).toBeUndefined();
      expect(sanitized.verifiedTrader).toBeUndefined();

      // Financial and ownership forgery fields are purged
      expect(sanitized.paymentStatus).toBeUndefined();
      expect(sanitized.payoutStatus).toBeUndefined();
      expect(sanitized.ownerId).toBeUndefined();
      expect(sanitized.homeownerId).toBeUndefined();
      expect(sanitized.completed).toBeUndefined();
      expect(sanitized.isCompleted).toBeUndefined();
      expect(sanitized.funded).toBeUndefined();
      expect(sanitized.balance).toBeUndefined();
      expect(sanitized.credits).toBeUndefined();
      expect(sanitized.payoutTransferred).toBeUndefined();
    });

    it("REJECTS client attempting illegal jump directly from draft to completed", () => {
      expect(() => {
        validateJobTransition("draft", "completed");
      }).toThrow(InvalidStateTransitionError);
    });
  });

  // =========================================================================
  // RISK CATEGORY 3: Business-Logic Abuse & Sequence Integrity
  // =========================================================================
  describe("3. Business-Logic Abuse & Macro-Sequence Defense", () => {
    it("BLOCKS macro-sequence attack: Create -> Cancel -> Refund -> Recreate -> Trigger Payout", () => {
      const abusedMilestone = {
        id: "ms_attack_1",
        status: "refunded",
        isRefunded: true,
        refundId: "re_123456",
        amount: 800,
        lifecycleHistory: ["pending", "funded", "cancelled", "refunded"]
      };

      const cancelledJob = {
        id: "job_attack_1",
        status: "cancelled",
        isCancelled: true
      };

      // Payout eligibility is blocked because milestone is refunded and job is cancelled
      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(abusedMilestone, cancelledJob);
      }).toThrow(ConflictError);

      // Attempting to revive milestone state sequence is blocked
      expect(() => {
        BusinessLogicDefense.validateLifecycleSequence("refunded", "released", abusedMilestone.lifecycleHistory);
      }).toThrow(ConflictError);
    });

    it("BLOCKS releasing milestone when escrow was never actively funded", () => {
      const unfundedMilestone = {
        id: "ms_unfunded",
        status: "pending",
        amount: 400,
        escrowFunded: false
      };

      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(unfundedMilestone);
      }).toThrow(BadRequestError);
    });

    it("BLOCKS double-dip payout when milestone funds were already disbursed", () => {
      const alreadyPaidMilestone = {
        id: "ms_paid",
        status: "released",
        payoutTransferred: true,
        payoutId: "po_already_done",
        amount: 600
      };

      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(alreadyPaidMilestone);
      }).toThrow(ConflictError);
    });

    it("BLOCKS recycling / replaying consumed transaction nonces", () => {
      const transactionId = "txn_stripe_charge_999";

      // First consumption succeeds
      expect(() => {
        BusinessLogicDefense.verifyAndConsumeTransactionNonce(transactionId, "REFUND");
      }).not.toThrow();

      // Second replay attempt with same transaction ID is strictly rejected
      expect(() => {
        BusinessLogicDefense.verifyAndConsumeTransactionNonce(transactionId, "REFUND");
      }).toThrow(ConflictError);
    });
  });

  // =========================================================================
  // RISK CATEGORY 4: Race Conditions & Concurrent Execution
  // =========================================================================
  describe("4. Race Conditions & Concurrent Execution Defense", () => {
    it("HANDLES concurrent money release requests: Exactly 1 succeeds, concurrent racer rejected", async () => {
      const mockDatabase = new Map<string, any>();
      mockDatabase.set("milestones/ms_conc_1", {
        id: "ms_conc_1",
        status: "funded",
        amount: 500
      });

      const store = {
        get: async (key: string) => mockDatabase.get(key),
        set: async (key: string, val: any) => { mockDatabase.set(key, val); }
      };

      let sideEffectReleaseCount = 0;
      const releaseFn = async (ms: any) => {
        sideEffectReleaseCount += 1;
        return { releasedAmount: ms.amount };
      };

      // Launch 2 simultaneous release requests for the exact same milestone
      const [attempt1, attempt2] = await Promise.allSettled([
        ConcurrencyLockEngine.atomicReleaseMilestone(store, "ms_conc_1", releaseFn),
        ConcurrencyLockEngine.atomicReleaseMilestone(store, "ms_conc_1", releaseFn),
      ]);

      const successCount = [attempt1, attempt2].filter(r => r.status === "fulfilled").length;
      const rejectedCount = [attempt1, attempt2].filter(r => r.status === "rejected").length;

      expect(successCount).toBe(1);
      expect(rejectedCount).toBe(1);
      expect(sideEffectReleaseCount).toBe(1); // Never doubles funds!

      const finalState = mockDatabase.get("milestones/ms_conc_1");
      expect(finalState.status).toBe("released");
    });

    it("HANDLES concurrent job quote acceptance: Exactly 1 trader assigned, second quote rejected", async () => {
      const mockDatabase = new Map<string, any>();
      mockDatabase.set("jobs/job_race_1", {
        id: "job_race_1",
        status: "open",
        acceptedTraderId: null
      });

      const store = {
        get: async (key: string) => mockDatabase.get(key),
        set: async (key: string, val: any) => { mockDatabase.set(key, val); }
      };

      // 2 simultaneous accept calls for different quotes
      const [res1, res2] = await Promise.allSettled([
        ConcurrencyLockEngine.atomicAcceptJob(store, "job_race_1", "quote_A", "trader_A"),
        ConcurrencyLockEngine.atomicAcceptJob(store, "job_race_1", "quote_B", "trader_B")
      ]);

      const winners = [res1, res2].filter(r => r.status === "fulfilled");
      const losers = [res1, res2].filter(r => r.status === "rejected");

      expect(winners.length).toBe(1);
      expect(losers.length).toBe(1);

      const jobFinal = mockDatabase.get("jobs/job_race_1");
      expect(jobFinal.status).toBe("in_progress");
      expect(["trader_A", "trader_B"]).toContain(jobFinal.acceptedTraderId);
    });

    it("PREVENTS double-spend withdrawal race condition: Balance cannot be drawn below zero", async () => {
      const mockDatabase = new Map<string, any>();
      mockDatabase.set("users/driver_wallet_1", {
        id: "driver_wallet_1",
        balance: 100 // Driver only has £100
      });

      const store = {
        get: async (key: string) => mockDatabase.get(key),
        set: async (key: string, val: any) => { mockDatabase.set(key, val); }
      };

      let actualPayoutCalls = 0;
      const payoutFn = async (amount: number) => {
        actualPayoutCalls += 1;
        return { payoutId: `po_${Date.now()}` };
      };

      // Driver fires 2 simultaneous withdrawal requests of £100 each
      const [w1, w2] = await Promise.allSettled([
        ConcurrencyLockEngine.atomicWithdrawFunds(store, "driver_wallet_1", 100, payoutFn),
        ConcurrencyLockEngine.atomicWithdrawFunds(store, "driver_wallet_1", 100, payoutFn)
      ]);

      const successfulWithdrawals = [w1, w2].filter(r => r.status === "fulfilled");
      const rejectedWithdrawals = [w1, w2].filter(r => r.status === "rejected");

      expect(successfulWithdrawals.length).toBe(1);
      expect(rejectedWithdrawals.length).toBe(1);
      expect(actualPayoutCalls).toBe(1); // Only £100 paid out, not £200!

      const finalWallet = mockDatabase.get("users/driver_wallet_1");
      expect(finalWallet.balance).toBe(0); // Zero balance remaining, not negative!
    });

    it("PREVENTS concurrent property ownership transfer collision", async () => {
      const mockDatabase = new Map<string, any>();
      mockDatabase.set("properties/prop_race_1", {
        id: "prop_race_1",
        ownerId: "original_owner_1"
      });

      const store = {
        get: async (key: string) => mockDatabase.get(key),
        set: async (key: string, val: any) => { mockDatabase.set(key, val); }
      };

      // 2 simultaneous transfers to different new owners
      const [t1, t2] = await Promise.allSettled([
        ConcurrencyLockEngine.atomicTransferOwnership(store, "prop_race_1", "original_owner_1", "buyer_A"),
        ConcurrencyLockEngine.atomicTransferOwnership(store, "prop_race_1", "original_owner_1", "buyer_B")
      ]);

      const wins = [t1, t2].filter(r => r.status === "fulfilled");
      const fails = [t1, t2].filter(r => r.status === "rejected");

      expect(wins.length).toBe(1);
      expect(fails.length).toBe(1);
    });
  });

  // =========================================================================
  // RISK CATEGORY 5: Abuse & Automation Defense (Unrestricted Resource Consumption)
  // =========================================================================
  describe("5. Abuse & Automation Defense (OWASP Unrestricted Consumption)", () => {
    it("THROTTLES automated rapid job creation spam (>10 jobs/min)", () => {
      const botUid = "spammer_user_001";

      // 10 permitted job creations
      for (let i = 0; i < 10; i++) {
        const result = AbuseDefenseEngine.checkAndConsumeQuota("JOB_CREATION", botUid);
        expect(result.allowed).toBe(true);
      }

      // 11th job creation in same window is rejected with HTTP 429 TooManyRequests
      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("JOB_CREATION", botUid);
      }).toThrow(TooManyRequestsError);
    });

    it("THROTTLES chat messaging flood bots (>30 msgs/min)", () => {
      const chatFlooderUid = "flooder_bot_002";

      for (let i = 0; i < 30; i++) {
        expect(AbuseDefenseEngine.checkAndConsumeQuota("MESSAGE_SEND", chatFlooderUid).allowed).toBe(true);
      }

      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("MESSAGE_SEND", chatFlooderUid);
      }).toThrow(TooManyRequestsError);
    });

    it("THROTTLES automated marketplace search scraping (>60 searches/min)", () => {
      const scraperIp = "192.168.1.100";

      for (let i = 0; i < 60; i++) {
        expect(AbuseDefenseEngine.checkAndConsumeQuota("SEARCH_QUERY", scraperIp).allowed).toBe(true);
      }

      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("SEARCH_QUERY", scraperIp);
      }).toThrow(TooManyRequestsError);
    });

    it("THROTTLES AI Copilot calls to prevent Denial-of-Wallet (>20 calls/min)", () => {
      const abuserUid = "ai_wallet_attacker";

      for (let i = 0; i < 20; i++) {
        expect(AbuseDefenseEngine.checkAndConsumeQuota("AI_INFERENCE", abuserUid).allowed).toBe(true);
      }

      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("AI_INFERENCE", abuserUid);
      }).toThrow(TooManyRequestsError);
    });

    it("THROTTLES automated payment attempts to prevent card testing / bin cycling (>5 attempts/10min)", () => {
      const cardTesterUid = "card_testing_bot";

      for (let i = 0; i < 5; i++) {
        expect(AbuseDefenseEngine.checkAndConsumeQuota("PAYMENT_ATTEMPT", cardTesterUid).allowed).toBe(true);
      }

      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("PAYMENT_ATTEMPT", cardTesterUid);
      }).toThrow(TooManyRequestsError);
    });

    it("THROTTLES mass account creation from identical IP (>5 accounts/15min)", () => {
      const botnetIp = "203.0.113.45";

      for (let i = 0; i < 5; i++) {
        expect(AbuseDefenseEngine.checkAndConsumeQuota("ACCOUNT_CREATION", botnetIp).allowed).toBe(true);
      }

      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("ACCOUNT_CREATION", botnetIp);
      }).toThrow(TooManyRequestsError);
    });

    it("THROTTLES mass file upload denial-of-service attempts (>10 uploads/min)", () => {
      const uploaderUid = "file_spammer_333";

      for (let i = 0; i < 10; i++) {
        expect(AbuseDefenseEngine.checkAndConsumeQuota("FILE_UPLOAD", uploaderUid).allowed).toBe(true);
      }

      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("FILE_UPLOAD", uploaderUid);
      }).toThrow(TooManyRequestsError);
    });
  });

  // =========================================================================
  // FINANCIAL IDEMPOTENCY & REPLAY DEFENSE
  // =========================================================================
  describe("6. Financial Idempotency & Replay Attack Defense", () => {
    it("REPLAYS cached execution safely without duplicating side-effects", async () => {
      let sideEffectCounter = 0;
      const fakeStore = new Map<string, any>();

      const mockDb: any = {
        runTransaction: async (cb: any) => {
          const transaction: any = {
            get: async (ref: any) => ({
              exists: fakeStore.has(ref.path),
              data: () => fakeStore.get(ref.path)
            }),
            set: (ref: any, data: any) => {
              fakeStore.set(ref.path, data);
            },
            update: (ref: any, data: any) => {
              const current = fakeStore.get(ref.path) || {};
              fakeStore.set(ref.path, { ...current, ...data });
            },
            delete: (ref: any) => {
              fakeStore.delete(ref.path);
            }
          };
          return cb(transaction);
        },
        collection: (colName: string) => ({
          doc: (docId: string) => ({
            path: `${colName}/${docId}`,
            get: async () => ({
              exists: fakeStore.has(`${colName}/${docId}`),
              data: () => fakeStore.get(`${colName}/${docId}`)
            }),
            set: async (data: any) => {
              fakeStore.set(`${colName}/${docId}`, data);
            }
          })
        })
      };

      const idempotencyKey = "red_team_attack_key_1";

      // First run: executes side-effect
      const run1 = await PaymentLedgerEngine.executeIdempotentOperation(
        mockDb,
        idempotencyKey,
        "RELEASE_FUNDS",
        async () => {
          sideEffectCounter += 1;
          return { amountReleased: 500 };
        }
      );

      expect(run1.wasReplayed).toBe(false);
      expect(run1.result.amountReleased).toBe(500);
      expect(sideEffectCounter).toBe(1);

      // Second run (Replay attack): MUST NOT invoke side-effect
      const run2 = await PaymentLedgerEngine.executeIdempotentOperation(
        mockDb,
        idempotencyKey,
        "RELEASE_FUNDS",
        async () => {
          sideEffectCounter += 1;
          return { amountReleased: 500 };
        }
      );

      expect(run2.wasReplayed).toBe(true);
      expect(run2.result.amountReleased).toBe(500);
      expect(sideEffectCounter).toBe(1); // Still 1! No duplicate payout
    });
  });
});
