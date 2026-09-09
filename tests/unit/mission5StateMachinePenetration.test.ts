import { describe, it, expect, beforeEach } from "vitest";
import {
  validateJobTransition,
  validateMilestoneTransition,
  validatePaymentTransition,
  validateRideTransition,
  validateDisputeTransition,
  canTransitionJob,
  canTransitionMilestone,
  canTransitionPayment,
  canTransitionRide,
  canTransitionDispute,
  InvalidStateTransitionError,
  JobStatus,
  MilestoneStatus,
  PaymentLedgerStatus,
  RideStatus,
  DisputeStatus,
} from "../../src/server/stateMachine.ts";
import { BusinessLogicDefense, MilestoneEntity, JobEntity } from "../../src/server/businessLogicDefense.ts";
import { ConcurrencyLockEngine, MockDataStore } from "../../src/server/concurrencyLock.ts";
import { ConflictError, BadRequestError, ForbiddenError } from "../../src/server/httpErrors.ts";

describe("Mission 5: State Machine & Concurrent Sequence Adversarial Exploitation", () => {
  let mockDb: Map<string, any>;
  let store: MockDataStore;

  beforeEach(() => {
    mockDb = new Map<string, any>();
    store = {
      get: (key: string) => mockDb.get(key),
      set: (key: string, val: any) => {
        mockDb.set(key, val);
      },
    };
    BusinessLogicDefense._resetNoncesForTesting();
    ConcurrencyLockEngine._resetLocksForTesting();
  });

  // =========================================================================
  // SECTION 1: Illegal Sequence & Jump Attacks (Single-Entity State Machines)
  // =========================================================================
  describe("1. Illegal Sequence Attacks across All Entity Types", () => {
    describe("Job State Machine Illegal Sequences", () => {
      it("BLOCKS illegal jump: draft → completed", () => {
        expect(() => validateJobTransition("draft", "completed")).toThrow(InvalidStateTransitionError);
        expect(canTransitionJob("draft", "completed")).toBe(false);
      });

      it("BLOCKS illegal jump: cancelled → completed", () => {
        expect(() => validateJobTransition("cancelled", "completed")).toThrow(InvalidStateTransitionError);
        expect(canTransitionJob("cancelled", "completed")).toBe(false);
      });

      it("BLOCKS illegal jump: draft → in_progress", () => {
        expect(() => validateJobTransition("draft", "in_progress")).toThrow(InvalidStateTransitionError);
        expect(canTransitionJob("draft", "in_progress")).toBe(false);
      });

      it("BLOCKS illegal reverse transition: completed → open", () => {
        expect(() => validateJobTransition("completed", "open")).toThrow(InvalidStateTransitionError);
        expect(canTransitionJob("completed", "open")).toBe(false);
      });

      it("BLOCKS reviving a terminal cancelled job to open or accepted", () => {
        expect(() => validateJobTransition("cancelled", "open")).toThrow(InvalidStateTransitionError);
        expect(() => validateJobTransition("cancelled", "accepted")).toThrow(InvalidStateTransitionError);
      });
    });

    describe("Milestone & Escrow State Machine Illegal Sequences", () => {
      it("BLOCKS illegal jump: pending → released (unfunded release)", () => {
        expect(() => validateMilestoneTransition("pending", "released")).toThrow(InvalidStateTransitionError);
        expect(canTransitionMilestone("pending", "released")).toBe(false);
      });

      it("BLOCKS illegal jump: released → funded (re-funding disbursed money)", () => {
        expect(() => validateMilestoneTransition("released", "funded")).toThrow(InvalidStateTransitionError);
        expect(canTransitionMilestone("released", "funded")).toBe(false);
      });

      it("BLOCKS illegal jump: refunded → released (releasing refunded escrow)", () => {
        expect(() => validateMilestoneTransition("refunded", "released")).toThrow(InvalidStateTransitionError);
        expect(canTransitionMilestone("refunded", "released")).toBe(false);
      });

      it("BLOCKS illegal jump: refunded → funded (reviving refunded milestone)", () => {
        expect(() => validateMilestoneTransition("refunded", "funded")).toThrow(InvalidStateTransitionError);
        expect(canTransitionMilestone("refunded", "funded")).toBe(false);
      });

      it("BLOCKS illegal jump: completed/released → in_progress", () => {
        expect(() => validateMilestoneTransition("released", "in_progress")).toThrow(InvalidStateTransitionError);
      });
    });

    describe("Payment Ledger State Machine Illegal Sequences", () => {
      it("BLOCKS illegal jump: created → disbursed (draft → paid shortcut)", () => {
        expect(() => validatePaymentTransition("created", "disbursed")).toThrow(InvalidStateTransitionError);
        expect(canTransitionPayment("created", "disbursed")).toBe(false);
      });

      it("BLOCKS illegal jump: failed → disbursed", () => {
        expect(() => validatePaymentTransition("failed", "disbursed")).toThrow(InvalidStateTransitionError);
      });

      it("BLOCKS illegal jump: refunded → disbursed", () => {
        expect(() => validatePaymentTransition("refunded", "disbursed")).toThrow(InvalidStateTransitionError);
      });

      it("BLOCKS illegal jump: created → refunded (refunding uncaptured payment)", () => {
        expect(() => validatePaymentTransition("created", "refunded")).toThrow(InvalidStateTransitionError);
      });

      it("BLOCKS illegal jump: disbursed → escrowed or refunded", () => {
        expect(() => validatePaymentTransition("disbursed", "escrowed")).toThrow(InvalidStateTransitionError);
        expect(() => validatePaymentTransition("disbursed", "refunded")).toThrow(InvalidStateTransitionError);
      });
    });

    describe("AnyRoller Taxi Ride State Machine Illegal Sequences", () => {
      it("BLOCKS illegal jump: draft → completed", () => {
        expect(() => validateRideTransition("draft", "completed")).toThrow(InvalidStateTransitionError);
      });

      it("BLOCKS illegal jump: searching → completed", () => {
        expect(() => validateRideTransition("searching", "completed")).toThrow(InvalidStateTransitionError);
      });

      it("BLOCKS illegal jump: cancelled → in_progress or completed", () => {
        expect(() => validateRideTransition("cancelled", "in_progress")).toThrow(InvalidStateTransitionError);
        expect(() => validateRideTransition("cancelled", "completed")).toThrow(InvalidStateTransitionError);
      });

      it("BLOCKS illegal reverse transition: completed → arriving", () => {
        expect(() => validateRideTransition("completed", "arriving")).toThrow(InvalidStateTransitionError);
      });
    });

    describe("Dispute Resolution State Machine Illegal Sequences", () => {
      it("BLOCKS illegal jump: opened → resolved_customer directly skipping review", () => {
        expect(() => validateDisputeTransition("opened", "resolved_customer")).toThrow(InvalidStateTransitionError);
      });

      it("BLOCKS modifying terminal resolved dispute: resolved_customer → opened", () => {
        expect(() => validateDisputeTransition("resolved_customer", "opened")).toThrow(InvalidStateTransitionError);
      });
    });
  });

  // =========================================================================
  // SECTION 2: Macro-Sequence Business Logic Attacks
  // =========================================================================
  describe("2. Multi-Step Macro-Sequence Exploitation Defense", () => {
    it("BLOCKS Macro Attack: Create Job → Fund → Cancel Job → Release Milestone", () => {
      const cancelledJob: JobEntity = {
        jobId: "job_cancelled_101",
        status: "cancelled",
        isCancelled: true,
      };

      const milestone: MilestoneEntity = {
        milestoneId: "ms_101",
        status: "funded",
        escrowFunded: true,
      };

      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(milestone, cancelledJob);
      }).toThrow(ConflictError);
      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(milestone, cancelledJob);
      }).toThrow(/Job has been cancelled or refunded/);
    });

    it("BLOCKS Macro Attack: Create → Fund → Refund Milestone → Release Escrow", () => {
      const job: JobEntity = { jobId: "job_active_202", status: "in_progress" };
      const refundedMilestone: MilestoneEntity = {
        milestoneId: "ms_refunded_202",
        status: "refunded",
        isRefunded: true,
        refundId: "re_stripe_12345",
      };

      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(refundedMilestone, job);
      }).toThrow(ConflictError);
      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(refundedMilestone, job);
      }).toThrow(/Milestone has been cancelled or refunded/);
    });

    it("BLOCKS Macro Attack: Entity with Historical Cancellation in Lifecycle trying to Revive/Disburse", () => {
      expect(() => {
        BusinessLogicDefense.validateLifecycleSequence(
          "open",
          "payout_triggered",
          ["draft", "open", "cancelled", "open"] // Attacker tried to revive after cancellation
        );
      }).toThrow(ForbiddenError);
      expect(() => {
        BusinessLogicDefense.validateLifecycleSequence(
          "open",
          "payout_triggered",
          ["draft", "open", "cancelled", "open"]
        );
      }).toThrow(/Entity was previously terminated in history/);
    });
  });

  // =========================================================================
  // SECTION 3: Concurrent Request Attacks & Race-Condition Invariants
  // =========================================================================
  describe("3. Concurrent Request Attacks & State Machine Invariants", () => {
    // Scenario 1: Concurrent release() + release()
    it("Concurrent Attack 1: release() + release() — Strictly only ONE release succeeds, second is rejected", async () => {
      const milestoneId = "ms_race_release_01";
      await store.set(`milestones/${milestoneId}`, {
        id: milestoneId,
        status: "funded",
        amount: 500,
      });

      let actualDisbursements = 0;
      const releaseOperation = async (ms: any) => {
        actualDisbursements++;
        return { releasedAmount: ms.amount };
      };

      // Launch two simultaneous release requests
      const results = await Promise.allSettled([
        ConcurrencyLockEngine.atomicReleaseMilestone(store, milestoneId, releaseOperation),
        ConcurrencyLockEngine.atomicReleaseMilestone(store, milestoneId, releaseOperation),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(actualDisbursements).toBe(1); // Exactly one payout side-effect executed

      // Check final state
      const finalMs = await store.get(`milestones/${milestoneId}`);
      expect(finalMs.status).toBe("released");
      expect(finalMs.payoutTransferred).toBe(true);
    });

    // Scenario 2: Concurrent cancel() + release()
    it("Concurrent Attack 2: cancel() + release() — System remains consistent, payout cannot execute on cancelled entity", async () => {
      const milestoneId = "ms_race_cancel_release_02";
      const jobId = "job_race_cancel_02";

      await store.set(`milestones/${milestoneId}`, {
        id: milestoneId,
        jobId,
        status: "funded",
        amount: 1000,
      });

      await store.set(`jobs/${jobId}`, {
        id: jobId,
        status: "open",
      });

      // Cancellation executes first or simultaneously
      await store.set(`milestones/${milestoneId}`, {
        id: milestoneId,
        jobId,
        status: "cancelled",
        amount: 1000,
      });

      const releaseAttempt = ConcurrencyLockEngine.atomicReleaseMilestone(
        store,
        milestoneId,
        async (ms) => ({ releasedAmount: ms.amount })
      );

      await expect(releaseAttempt).rejects.toThrow(ConflictError);
      await expect(releaseAttempt).rejects.toThrow(/Cannot release milestone in status 'cancelled'/);
    });

    // Scenario 3: Concurrent accept() + accept()
    it("Concurrent Attack 3: accept() + accept() — Only one trader quote accepted, duplicate throws conflict", async () => {
      const jobId = "job_race_accept_03";
      await store.set(`jobs/${jobId}`, {
        id: jobId,
        status: "open",
      });

      let acceptSideEffects = 0;
      const acceptFn = async () => {
        acceptSideEffects++;
      };

      const results = await Promise.allSettled([
        ConcurrencyLockEngine.atomicAcceptJob(store, jobId, "quote_trader_A", "trader_A", acceptFn),
        ConcurrencyLockEngine.atomicAcceptJob(store, jobId, "quote_trader_B", "trader_B", acceptFn),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(acceptSideEffects).toBe(1);

      const finalJob = await store.get(`jobs/${jobId}`);
      expect(finalJob.status).toBe("in_progress");
      expect(["trader_A", "trader_B"]).toContain(finalJob.acceptedTraderId);
    });

    // Scenario 4: Concurrent fund() + refund() + release()
    it("Concurrent Attack 4: fund() + refund() + release() — Financial & logical consistency maintained", async () => {
      const milestoneId = "ms_multi_race_04";
      await store.set(`milestones/${milestoneId}`, {
        id: milestoneId,
        status: "pending",
        amount: 750,
      });

      // Step 1: Fund the milestone
      validateMilestoneTransition("pending", "funded");
      await store.set(`milestones/${milestoneId}`, {
        id: milestoneId,
        status: "funded",
        amount: 750,
        escrowFunded: true,
      });

      // Step 2: Refund occurs
      validateMilestoneTransition("funded", "refunded");
      BusinessLogicDefense.verifyAndConsumeTransactionNonce(`refund_${milestoneId}`, "REFUND");
      await store.set(`milestones/${milestoneId}`, {
        id: milestoneId,
        status: "refunded",
        isRefunded: true,
        amount: 750,
      });

      // Step 3: Attacker attempts release() on the refunded entity
      const msAfterRefund = await store.get(`milestones/${milestoneId}`);
      expect(() => {
        validateMilestoneTransition(msAfterRefund.status as MilestoneStatus, "released");
      }).toThrow(InvalidStateTransitionError);

      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(msAfterRefund);
      }).toThrow(ConflictError);

      const releaseAttempt = ConcurrencyLockEngine.atomicReleaseMilestone(
        store,
        milestoneId,
        async (ms) => ({ releasedAmount: ms.amount })
      );

      await expect(releaseAttempt).rejects.toThrow(ConflictError);
      await expect(releaseAttempt).rejects.toThrow(/Cannot release milestone in status 'refunded'/);

      // Verify that duplicate refund nonce reuse is also blocked
      expect(() => {
        BusinessLogicDefense.verifyAndConsumeTransactionNonce(`refund_${milestoneId}`, "REFUND");
      }).toThrow(ConflictError);
    });

    // Scenario 5: Concurrent Wallet Withdrawals (Double-Spend Simulation)
    it("Concurrent Attack 5: Simultaneous withdraw(£100) + withdraw(£100) on £100 balance — Double-spend prevented", async () => {
      const userId = "user_wallet_attacker_05";
      await store.set(`users/${userId}`, {
        id: userId,
        balance: 100, // Only £100 available
      });

      let payoutExecutions = 0;
      const processPayout = async () => {
        payoutExecutions++;
        return { payoutId: `po_${Date.now()}` };
      };

      const results = await Promise.allSettled([
        ConcurrencyLockEngine.atomicWithdrawFunds(store, userId, 100, processPayout),
        ConcurrencyLockEngine.atomicWithdrawFunds(store, userId, 100, processPayout),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(payoutExecutions).toBe(1);

      const finalUser = await store.get(`users/${userId}`);
      expect(finalUser.balance).toBe(0); // Balance decremented to 0, not -100
    });
  });
});
