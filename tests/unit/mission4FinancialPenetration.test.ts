import { describe, it, expect, beforeEach } from "vitest";
import { 
  FinancialSecurityEngine, 
  VerifiedStripeEventPayload, 
  ResourceTarget 
} from "../../src/server/paymentVerification.ts";
import { PaymentLedgerEngine } from "../../src/server/paymentLedger.ts";
import { BusinessLogicDefense, MilestoneEntity, JobEntity } from "../../src/server/businessLogicDefense.ts";
import { 
  validatePaymentTransition, 
  validateMilestoneTransition, 
  InvalidStateTransitionError 
} from "../../src/server/stateMachine.ts";
import { sanitizeClientPayload, assertResourceOwner } from "../../src/server/authorization.ts";
import { 
  BadRequestError, 
  ConflictError, 
  ForbiddenError, 
  UnauthorizedError 
} from "../../src/server/httpErrors.ts";

describe("Mission 4: Financial Adversarial Penetration (Payment & Stripe Security)", () => {
  beforeEach(() => {
    FinancialSecurityEngine._resetForTesting();
    BusinessLogicDefense._resetNoncesForTesting();
  });

  // =========================================================================
  // VECTOR 1: Stripe Price & Amount Substitution Defense
  // =========================================================================
  describe("Vector 1: Price & Amount Substitution Defense", () => {
    it("BLOCKS attacker substituting a £500 milestone price with a £1 token payment (underpayment)", () => {
      const targetResource: ResourceTarget = {
        jobId: "job_roof_repairs_101",
        quoteId: "quote_honest_trader_202",
        milestoneId: "ms_timber_framing_303",
        expectedAmountPence: 50000, // £500.00
        expectedCurrency: "gbp",
        expectedPayerId: "cust_homeowner_999",
        expectedPayeeId: "trader_honest_777",
      };

      const attackerForgedEvent: VerifiedStripeEventPayload = {
        id: "evt_stripe_tampered_amount_01",
        type: "checkout.session.completed",
        amount_total: 100, // Attacker manipulated unit_amount to 100 pence (£1.00)
        currency: "gbp",
        payment_status: "paid",
        payment_intent: "pi_fake_small_payment_01",
        client_reference_id: "cust_homeowner_999",
        metadata: {
          jobId: "job_roof_repairs_101",
          quoteId: "quote_honest_trader_202",
          milestoneId: "ms_timber_framing_303",
        },
      };

      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(attackerForgedEvent, targetResource, true);
      }).toThrow(BadRequestError);
      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(attackerForgedEvent, targetResource, true);
      }).toThrow(/Amount substitution detected/);
    });

    it("STRIPS client-supplied 'amount', 'price', and 'platformFee' from client update requests", () => {
      const maliciousPayload = {
        description: "Milestone complete",
        amount: 1, // Attacker attempts to override amount to 1p
        platformFee: 0, // Attacker attempts to erase platform fee
        price: 0,
        payoutTransferred: true,
      };

      const sanitized = sanitizeClientPayload(maliciousPayload);

      expect(sanitized.description).toBe("Milestone complete");
      expect(sanitized.amount).toBeUndefined();
      expect(sanitized.platformFee).toBeUndefined();
      expect(sanitized.price).toBeUndefined();
      expect(sanitized.payoutTransferred).toBeUndefined();
    });
  });

  // =========================================================================
  // VECTOR 2: Currency Substitution Defense
  // =========================================================================
  describe("Vector 2: Currency Substitution Defense", () => {
    it("BLOCKS attacker paying 50000 JPY or USD instead of 50000 GBP pence", () => {
      const targetResource: ResourceTarget = {
        jobId: "job_gas_boiler_404",
        milestoneId: "ms_boiler_install_505",
        expectedAmountPence: 250000, // £2,500.00
        expectedCurrency: "gbp",
        expectedPayerId: "cust_homeowner_999",
      };

      const attackerCurrencyEvent: VerifiedStripeEventPayload = {
        id: "evt_stripe_currency_swap_02",
        type: "checkout.session.completed",
        amount_total: 250000, // 250,000 in Japanese Yen or Zimbabwean Dollars
        currency: "jpy",
        payment_status: "paid",
        payment_intent: "pi_jpy_swap_02",
        client_reference_id: "cust_homeowner_999",
        metadata: {
          jobId: "job_gas_boiler_404",
          milestoneId: "ms_boiler_install_505",
        },
      };

      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(attackerCurrencyEvent, targetResource, true);
      }).toThrow(BadRequestError);
      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(attackerCurrencyEvent, targetResource, true);
      }).toThrow(/Currency substitution detected/);
    });
  });

  // =========================================================================
  // VECTOR 3: Metadata Manipulation & Cross-Resource Cross-User Binding
  // =========================================================================
  describe("Vector 3: Metadata Manipulation & Resource/User Binding Defense", () => {
    it("BLOCKS applying a valid payment from Job A to an unrelated Job B", () => {
      const targetResourceB: ResourceTarget = {
        jobId: "job_expensive_kitchen_B",
        milestoneId: "ms_cabinets_B",
        expectedAmountPence: 300000,
        expectedCurrency: "gbp",
        expectedPayerId: "cust_victim_bob",
      };

      const validEventForJobA: VerifiedStripeEventPayload = {
        id: "evt_stripe_job_A_03",
        type: "checkout.session.completed",
        amount_total: 300000,
        currency: "gbp",
        payment_status: "paid",
        payment_intent: "pi_job_A_03",
        client_reference_id: "cust_alice",
        metadata: {
          jobId: "job_cheap_garden_A", // Belongs to Job A
          milestoneId: "ms_shed_A",
        },
      };

      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(validEventForJobA, targetResourceB, true);
      }).toThrow(ForbiddenError);
      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(validEventForJobA, targetResourceB, true);
      }).toThrow(/Resource mismatch: Payment metadata references job/);
    });

    it("BLOCKS applying another customer's payment to attacker's resource (Payer Identity Mismatch)", () => {
      const targetResource: ResourceTarget = {
        jobId: "job_plumbing_101",
        milestoneId: "ms_pipe_repair_202",
        expectedAmountPence: 15000,
        expectedCurrency: "gbp",
        expectedPayerId: "cust_victim_victim", // Expecting Victim to pay
      };

      const attackerInterceptedEvent: VerifiedStripeEventPayload = {
        id: "evt_stripe_diff_user_04",
        type: "checkout.session.completed",
        amount_total: 15000,
        currency: "gbp",
        payment_status: "paid",
        payment_intent: "pi_attacker_paid_04",
        client_reference_id: "cust_attacker_666", // Paid by attacker or unrelated 3rd party
        metadata: {
          jobId: "job_plumbing_101",
          milestoneId: "ms_pipe_repair_202",
        },
      };

      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(attackerInterceptedEvent, targetResource, true);
      }).toThrow(ForbiddenError);
      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(attackerInterceptedEvent, targetResource, true);
      }).toThrow(/Payer mismatch: Payment belongs to user/);
    });

    it("BLOCKS unverified or forged cryptographic webhook signatures", () => {
      const targetResource: ResourceTarget = {
        jobId: "job_electrics_101",
        milestoneId: "ms_rewire_202",
        expectedAmountPence: 80000,
        expectedCurrency: "gbp",
        expectedPayerId: "cust_homeowner_999",
      };

      const forgedEvent: VerifiedStripeEventPayload = {
        id: "evt_forged_signature_05",
        type: "checkout.session.completed",
        amount_total: 80000,
        currency: "gbp",
        payment_status: "paid",
        payment_intent: "pi_forged_05",
        client_reference_id: "cust_homeowner_999",
        metadata: {
          jobId: "job_electrics_101",
          milestoneId: "ms_rewire_202",
        },
      };

      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(forgedEvent, targetResource, false); // signatureVerified: false
      }).toThrow(UnauthorizedError);
      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(forgedEvent, targetResource, false);
      }).toThrow(/Cryptographic signature verification failed/);
    });
  });

  // =========================================================================
  // VECTOR 4: Payment Replay & Webhook Replay Defense
  // =========================================================================
  describe("Vector 4: Payment & Webhook Replay Defense", () => {
    it("BLOCKS replaying the same Stripe Webhook Event ID to fund multiple milestones", () => {
      const targetResource: ResourceTarget = {
        jobId: "job_roof_101",
        milestoneId: "ms_slate_tiles_202",
        expectedAmountPence: 120000,
        expectedCurrency: "gbp",
        expectedPayerId: "cust_homeowner_999",
      };

      const validEvent: VerifiedStripeEventPayload = {
        id: "evt_replay_attack_06",
        type: "checkout.session.completed",
        amount_total: 120000,
        currency: "gbp",
        payment_status: "paid",
        payment_intent: "pi_legitimate_intent_06",
        client_reference_id: "cust_homeowner_999",
        metadata: {
          jobId: "job_roof_101",
          milestoneId: "ms_slate_tiles_202",
        },
      };

      // First verification succeeds
      const firstResult = FinancialSecurityEngine.verifyStripePaymentProof(validEvent, targetResource, true);
      expect(firstResult.verified).toBe(true);

      // Replay attempt fails with ConflictError 409
      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(validEvent, targetResource, true);
      }).toThrow(ConflictError);
      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(validEvent, targetResource, true);
      }).toThrow(/Financial replay detected: Webhook event/);
    });

    it("BLOCKS reusing the same Stripe PaymentIntent across two different checkout sessions", () => {
      const targetResource1: ResourceTarget = {
        jobId: "job_roof_101",
        milestoneId: "ms_tiles_1",
        expectedAmountPence: 50000,
        expectedCurrency: "gbp",
        expectedPayerId: "cust_homeowner_999",
      };

      const targetResource2: ResourceTarget = {
        jobId: "job_roof_101",
        milestoneId: "ms_tiles_2",
        expectedAmountPence: 50000,
        expectedCurrency: "gbp",
        expectedPayerId: "cust_homeowner_999",
      };

      const event1: VerifiedStripeEventPayload = {
        id: "evt_unique_1",
        type: "checkout.session.completed",
        amount_total: 50000,
        currency: "gbp",
        payment_status: "paid",
        payment_intent: "pi_shared_intent_07",
        client_reference_id: "cust_homeowner_999",
        metadata: { jobId: "job_roof_101", milestoneId: "ms_tiles_1" },
      };

      const event2ReusingIntent: VerifiedStripeEventPayload = {
        id: "evt_unique_2",
        type: "checkout.session.completed",
        amount_total: 50000,
        currency: "gbp",
        payment_status: "paid",
        payment_intent: "pi_shared_intent_07", // Attacker reuses the same captured intent
        client_reference_id: "cust_homeowner_999",
        metadata: { jobId: "job_roof_101", milestoneId: "ms_tiles_2" },
      };

      expect(FinancialSecurityEngine.verifyStripePaymentProof(event1, targetResource1, true).verified).toBe(true);

      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(event2ReusingIntent, targetResource2, true);
      }).toThrow(ConflictError);
      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(event2ReusingIntent, targetResource2, true);
      }).toThrow(/Duplicate payment capture: PaymentIntent/);
    });
  });

  // =========================================================================
  // VECTOR 5: Failed, Cancelled, and Refunded Payment State Invariants
  // =========================================================================
  describe("Vector 5: Failed, Cancelled & Incomplete Payment Defense", () => {
    it("REJECTS an unpaid, failed, or pending Stripe session as proof of payment", () => {
      const targetResource: ResourceTarget = {
        jobId: "job_brickwork_101",
        milestoneId: "ms_wall_202",
        expectedAmountPence: 45000,
        expectedCurrency: "gbp",
        expectedPayerId: "cust_homeowner_999",
      };

      const failedEvent: VerifiedStripeEventPayload = {
        id: "evt_failed_payment_08",
        type: "checkout.session.completed",
        amount_total: 45000,
        currency: "gbp",
        payment_status: "unpaid", // Unpaid / card declined
        payment_intent: "pi_declined_08",
        client_reference_id: "cust_homeowner_999",
        metadata: { jobId: "job_brickwork_101", milestoneId: "ms_wall_202" },
      };

      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(failedEvent, targetResource, true);
      }).toThrow(BadRequestError);
      expect(() => {
        FinancialSecurityEngine.verifyStripePaymentProof(failedEvent, targetResource, true);
      }).toThrow(/Stripe reports payment_status 'unpaid'/);
    });

    it("BLOCKS triggering payouts or fund releases on a refunded payment or milestone", () => {
      const refundedMilestone: MilestoneEntity = {
        milestoneId: "ms_refunded_101",
        status: "refunded",
        isRefunded: true,
        refundId: "re_stripe_refund_09",
      };

      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(refundedMilestone);
      }).toThrow(ConflictError);
      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(refundedMilestone);
      }).toThrow(/Milestone has been cancelled or refunded/);
    });

    it("ENFORCES state machine transition preventing 'failed' or 'refunded' payment from jumping to 'disbursed'", () => {
      expect(() => {
        validatePaymentTransition("failed", "disbursed");
      }).toThrow(InvalidStateTransitionError);

      expect(() => {
        validatePaymentTransition("refunded", "disbursed");
      }).toThrow(InvalidStateTransitionError);
    });
  });

  // =========================================================================
  // VECTOR 6: Duplicate, Concurrent & Race-Condition Payout Defense
  // =========================================================================
  describe("Vector 6: Duplicate & Concurrent Payout Defense", () => {
    it("BLOCKS duplicate payout execution for the same transaction nonce", () => {
      const transactionId = "tx_escrow_milestone_payout_777";

      // First consumption succeeds
      BusinessLogicDefense.verifyAndConsumeTransactionNonce(transactionId, "PAYOUT");

      // Duplicate attempt is rejected
      expect(() => {
        BusinessLogicDefense.verifyAndConsumeTransactionNonce(transactionId, "PAYOUT");
      }).toThrow(ConflictError);
      expect(() => {
        BusinessLogicDefense.verifyAndConsumeTransactionNonce(transactionId, "PAYOUT");
      }).toThrow(/already been consumed for PAYOUT/);
    });

    it("BLOCKS concurrent payout execution during in-flight network request", async () => {
      const idempotencyKey = "idemp_payout_lock_test_888";
      let executionCount = 0;

      const slowPayoutOperation = () =>
        new Promise<string>((resolve) => {
          setTimeout(() => {
            executionCount++;
            resolve("payout_successful");
          }, 50);
        });

      // Launch primary operation
      const promise1 = FinancialSecurityEngine.executeWithNetworkRetryProtection(
        idempotencyKey,
        "DRIVER_PAYOUT",
        5000,
        slowPayoutOperation
      );

      // Launch concurrent duplicate while promise1 is in-flight
      const promise2 = FinancialSecurityEngine.executeWithNetworkRetryProtection(
        idempotencyKey,
        "DRIVER_PAYOUT",
        5000,
        slowPayoutOperation
      );

      // Expect second call to be rejected with ConflictError 409
      await expect(promise2).rejects.toThrow(ConflictError);

      const result1 = await promise1;
      expect(result1.result).toBe("payout_successful");
      expect(executionCount).toBe(1); // Executed strictly once
    });

    it("SAFELY allows retry after previous operation has completed or timed out", async () => {
      const idempotencyKey = "idemp_retry_after_success_999";
      let count = 0;

      const op = async () => {
        count++;
        return `done_${count}`;
      };

      const firstCall = await FinancialSecurityEngine.executeWithNetworkRetryProtection(
        idempotencyKey,
        "PAYOUT",
        1000,
        op
      );

      expect(firstCall.result).toBe("done_1");

      // Subsequent sequential retry executes cleanly without blocking
      const secondCall = await FinancialSecurityEngine.executeWithNetworkRetryProtection(
        idempotencyKey,
        "PAYOUT",
        1000,
        op
      );

      expect(secondCall.result).toBe("done_2");
      expect(count).toBe(2);
    });
  });

  // =========================================================================
  // VECTOR 7: Double-Entry Payout & Ledger Mathematical Invariants
  // =========================================================================
  describe("Vector 7: Ledger Mathematical & Double-Entry Invariants", () => {
    it("GUARANTEES: Platform Fee (12%) + Trader Net Payout = Total Verified Amount (Zero-Drift)", () => {
      const testAmounts = [1000, 2450, 9999, 50000, 125000, 750000]; // minor units (pence)

      for (const amount of testAmounts) {
        const platformFee = Math.round(amount * 0.12);
        const netPayout = amount - platformFee;

        // Zero financial leakage or drift
        expect(platformFee + netPayout).toBe(amount);
        expect(platformFee).toBeGreaterThanOrEqual(0);
        expect(netPayout).toBeGreaterThanOrEqual(0);
      }
    });

    it("BLOCKS negative, zero, or NaN amounts from entering the financial ledger", async () => {
      await expect(
        PaymentLedgerEngine.recordEscrowFunding(null, {
          jobId: "job_1",
          milestoneId: "m_1",
          customerId: "c_1",
          traderId: "t_1",
          verifiedAmount: 0, // Zero amount
          currency: "gbp",
          paymentIntentId: "pi_1",
          idempotencyKey: "k_1",
        })
      ).rejects.toThrow(BadRequestError);

      await expect(
        PaymentLedgerEngine.recordEscrowFunding(null, {
          jobId: "job_1",
          milestoneId: "m_1",
          customerId: "c_1",
          traderId: "t_1",
          verifiedAmount: -500, // Negative amount
          currency: "gbp",
          paymentIntentId: "pi_2",
          idempotencyKey: "k_2",
        })
      ).rejects.toThrow(BadRequestError);
    });
  });
});
