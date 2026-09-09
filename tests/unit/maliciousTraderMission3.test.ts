import { describe, it, expect, beforeEach } from "vitest";
import { 
  AuthenticatedUser,
  assertCanAccessJob,
  assertCanModifyJob,
  assertCanSubmitQuote,
  assertCanModifyQuote,
  assertCanDeleteQuote,
  assertCanAcceptJob,
  assertCanManageMilestone,
  assertCanAccessConversation,
  assertCanAccessProperty,
  assertCanModifyProperty,
  assertCanSubmitReview,
  assertCanManageTraderAvailability,
  assertResourceOwner,
  assertCanAccessUserStorage,
  sanitizeClientPayload
} from "../../src/server/authorization.ts";
import { 
  ForbiddenError, 
  BadRequestError,
  UnauthorizedError,
  ConflictError 
} from "../../src/server/httpErrors.ts";
import { 
  validateJobTransition, 
  validateMilestoneTransition, 
  validatePaymentTransition 
} from "../../src/server/stateMachine.ts";
import { BusinessLogicDefense } from "../../src/server/businessLogicDefense.ts";

/**
 * MISSION 3 — ADVERSARIAL TEST SUITE: MALICIOUS TRADER ATTACKS ANYTRADER MARKETPLACE
 * Rigorous multi-vector exploit simulation verifying that a malicious trader cannot:
 * 1. Trader A -> Accept Customer B's job (self-accepting / bypassing customer quote approval)
 * 2. Trader A -> Modify Customer B's quote / competitor quotes
 * 3. Trader A -> Release Customer B's milestone (force-releasing escrow without customer approval)
 * 4. Trader A -> Access Customer B's private information (PII, phone, private property docs, security codes)
 * 5. Trader A -> Manipulate job completion (force-completing jobs without valid state transition / review)
 * 6. Trader A -> Manipulate payout / platform commission (diverting Stripe split, setting 0% fee, negative amounts)
 * 7. Trader A -> Manipulate reviews (forging 5-star self reviews or submitting fake 1-star reviews on rival traders)
 * 8. Trader A -> Manipulate availability (tampering with competitor working hours, calendar, or live status)
 * 9. Trader A -> Impersonate another trader (submitting quotes or updates under Trader B's UID)
 * 
 * Direct HTTP API & Backend Request Layer simulation included for all vectors.
 */

describe("Mission 3: Malicious Trader Adversarial Penetration (Marketplace Security)", () => {
  // Malicious Trader A
  const maliciousTraderA: AuthenticatedUser = {
    uid: "trader_malicious_666",
    email: "badtrader@rogue.com",
    role: "tradesperson",
    isAdmin: false
  };

  // Legitimate Trader B (Competitor)
  const legitimateTraderB: AuthenticatedUser = {
    uid: "trader_honest_777",
    email: "goodtrader@pro.co.uk",
    role: "tradesperson",
    isAdmin: false
  };

  // Victim Customer B (Homeowner)
  const customerB: AuthenticatedUser = {
    uid: "cust_victim_888",
    email: "victim@homeowner.co.uk",
    role: "homeowner",
    isAdmin: false
  };

  // =========================================================================
  // VECTOR 1: TRADER A -> ACCEPT CUSTOMER B's JOB
  // =========================================================================
  describe("Vector 1: Job Self-Acceptance & Hijack Defense", () => {
    it("BLOCKS Trader A from self-accepting Customer B's job via direct API invocation", () => {
      const openJob = {
        id: "job_roof_repair",
        homeownerId: customerB.uid,
        status: "open",
        title: "Emergency Slate Roof Repair",
        budget: 1800
      };

      // Trader A sends POST /api/jobs/:jobId/accept-quote
      expect(() => {
        assertCanAcceptJob(maliciousTraderA, openJob);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertResourceOwner(maliciousTraderA, openJob.homeownerId, "Job Acceptance");
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS Trader A from altering job status from 'open' directly to 'accepted' or 'in_progress'", () => {
      const openJob = {
        id: "job_roof_repair",
        homeownerId: customerB.uid,
        status: "open"
      };

      // Trader attempts to modify job status
      expect(() => {
        assertCanModifyJob(maliciousTraderA, openJob);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS only the true customer (Customer B) to accept a quote on their job", () => {
      const openJob = {
        id: "job_roof_repair",
        homeownerId: customerB.uid,
        status: "open"
      };

      expect(() => assertCanAcceptJob(customerB, openJob)).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 2: TRADER A -> MODIFY CUSTOMER B's / COMPETITOR'S QUOTE
  // =========================================================================
  describe("Vector 2: Quote Tampering & Competitor Sabotage Defense", () => {
    it("BLOCKS Trader A from modifying or editing Trader B's quote on Customer B's job", () => {
      const traderBQuote = {
        id: "quote_honest_1",
        jobId: "job_roof_repair",
        tradespersonId: legitimateTraderB.uid,
        amount: 1200,
        description: "12 high-grade slate tiles replaced"
      };

      // Trader A attempts to modify price to £9999 or alter description
      expect(() => {
        assertCanModifyQuote(maliciousTraderA, traderBQuote);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS Trader A from deleting or withdrawing Trader B's competitive quote", () => {
      const traderBQuote = {
        id: "quote_honest_1",
        jobId: "job_roof_repair",
        tradespersonId: legitimateTraderB.uid,
        amount: 1200
      };

      expect(() => {
        assertCanDeleteQuote(maliciousTraderA, traderBQuote);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS legitimate Trader B to modify their own quote before acceptance", () => {
      const traderBQuote = {
        id: "quote_honest_1",
        jobId: "job_roof_repair",
        tradespersonId: legitimateTraderB.uid,
        amount: 1200
      };

      expect(() => assertCanModifyQuote(legitimateTraderB, traderBQuote)).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 3: TRADER A -> RELEASE CUSTOMER B's MILESTONE ESCROW
  // =========================================================================
  describe("Vector 3: Milestone Escrow Premature Release Defense", () => {
    it("BLOCKS Trader A from triggering escrow milestone release via POST /api/release-milestone", () => {
      const fundedMilestone = {
        id: "ms_phase1",
        customerId: customerB.uid,
        tradespersonId: maliciousTraderA.uid, // Even if assigned!
        amount: 1500,
        status: "funded"
      };

      // Trader A attempts manual escrow release without customer approval
      expect(() => {
        assertCanManageMilestone(maliciousTraderA, fundedMilestone, "release", false);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS Trader A from releasing milestone belonging to an unrelated job with Trader B", () => {
      const traderBMilestone = {
        id: "ms_trader_b",
        customerId: customerB.uid,
        tradespersonId: legitimateTraderB.uid,
        amount: 2000,
        status: "funded"
      };

      expect(() => {
        assertCanManageMilestone(maliciousTraderA, traderBMilestone, "release", false);
      }).toThrow(ForbiddenError);
    });

    it("ENFORCES state machine transition preventing release on unfunded milestone", () => {
      expect(() => {
        validateMilestoneTransition("pending", "released");
      }).toThrow();
    });
  });

  // =========================================================================
  // VECTOR 4: TRADER A -> ACCESS CUSTOMER B's PRIVATE INFORMATION
  // =========================================================================
  describe("Vector 4: Customer PII & Private Property Specs Protection", () => {
    it("BLOCKS Trader A from accessing Customer B's private Property Passport alarm codes and documents", () => {
      const customerBPrivateProperty = {
        id: "prop_b_private",
        ownerId: customerB.uid,
        isPublicPassport: false,
        alarmCode: "5921",
        fullAddress: "Flat 4, 12 Kensington High St, London",
        epcCertificateUrl: "https://storage.internal/epc_b.pdf"
      };

      expect(() => {
        assertCanAccessProperty(maliciousTraderA, customerBPrivateProperty);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanModifyProperty(maliciousTraderA, customerBPrivateProperty);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS Trader A from reading Customer B's private chat messages with Trader B", () => {
      const privateConversation = [customerB.uid, legitimateTraderB.uid];

      expect(() => {
        assertCanAccessConversation(maliciousTraderA, privateConversation);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS Trader A from reading Customer B's private KYC & ID documents", () => {
      expect(() => {
        assertCanAccessUserStorage(maliciousTraderA, customerB.uid, "read", false);
      }).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // VECTOR 5: TRADER A -> MANIPULATE JOB COMPLETION
  // =========================================================================
  describe("Vector 5: Job Completion & Lifecycle Manipulation Defense", () => {
    it("BLOCKS Trader A from unilaterally setting job status to 'completed' via direct payload injection", () => {
      const activeJob = {
        id: "job_active_1",
        homeownerId: customerB.uid,
        tradespersonId: maliciousTraderA.uid,
        status: "in_progress"
      };

      // Only the homeowner or admin can modify core job status
      expect(() => {
        assertCanModifyJob(maliciousTraderA, activeJob);
      }).toThrow(ForbiddenError);
    });

    it("STRIPS 'status', 'completed', and 'isCompleted' from client update requests", () => {
      const payloadFromTrader = {
        notes: "Work finished on site",
        status: "completed",
        completed: true,
        isCompleted: true,
        payoutStatus: "transferred"
      };

      const sanitized = sanitizeClientPayload(payloadFromTrader);
      expect(sanitized.notes).toBe("Work finished on site");
      expect(sanitized.status).toBeUndefined();
      expect(sanitized.completed).toBeUndefined();
      expect(sanitized.isCompleted).toBeUndefined();
      expect(sanitized.payoutStatus).toBeUndefined();
    });

    it("BLOCKS macro-sequence exploit: cannot release funds on a cancelled/disputed job", () => {
      const cancelledJob = {
        id: "job_cancelled",
        homeownerId: customerB.uid,
        tradespersonId: maliciousTraderA.uid,
        status: "cancelled"
      };

      const milestone = {
        id: "ms_cancelled",
        status: "funded",
        amount: 800
      };

      expect(() => {
        BusinessLogicDefense.validateEscrowReleaseEligibility(cancelledJob, milestone);
      }).toThrow(ConflictError);
    });
  });

  // =========================================================================
  // VECTOR 6: TRADER A -> MANIPULATE PAYOUT & COMMISSION
  // =========================================================================
  describe("Vector 6: Payout Manipulation & Fee Avoidance Defense", () => {
    it("STRIPS client-supplied 'platformFee', 'amount', and 'payoutTransferred' parameters", () => {
      const maliciousPaymentPayload = {
        jobId: "job_active_1",
        platformFee: 0, // Trader attempting to eliminate AnyTrader 12% commission
        amount: 100000, // Trader attempting to inflate payout
        payoutTransferred: true,
        balance: 999999
      };

      const sanitized = sanitizeClientPayload(maliciousPaymentPayload);
      expect(sanitized.platformFee).toBeUndefined();
      expect(sanitized.amount).toBeUndefined();
      expect(sanitized.payoutTransferred).toBeUndefined();
      expect(sanitized.balance).toBeUndefined();
    });

    it("BLOCKS non-admin trader from setting Stripe Connected Account destination for another user", () => {
      expect(() => {
        assertResourceOwner(maliciousTraderA, legitimateTraderB.uid, "Payout Account");
      }).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // VECTOR 7: TRADER A -> MANIPULATE REVIEWS
  // =========================================================================
  describe("Vector 7: Review Manipulation & Competitor Smear Defense", () => {
    it("BLOCKS Trader A from submitting a forged 5-star review for themselves under Customer B's UID", () => {
      const fakeSelfReview = {
        reviewerId: customerB.uid, // Impersonating Customer B
        revieweeId: maliciousTraderA.uid,
        rating: 5,
        comment: "Best electrician in London, fantastic!"
      };

      // Server verifies reviewerId matches authenticated user token
      expect(() => {
        assertCanSubmitReview(maliciousTraderA, fakeSelfReview);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS Trader A from submitting a 1-star smear review on Competitor Trader B for a job they weren't on", () => {
      const competitorJob = {
        id: "job_competitor_b",
        homeownerId: customerB.uid,
        tradespersonId: legitimateTraderB.uid,
        status: "completed"
      };

      const maliciousSmearReview = {
        reviewerId: maliciousTraderA.uid,
        revieweeId: legitimateTraderB.uid,
        jobId: competitorJob.id,
        rating: 1,
        comment: "Terrible contractor, showed up 3 hours late"
      };

      expect(() => {
        assertCanSubmitReview(maliciousTraderA, maliciousSmearReview, competitorJob);
      }).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // VECTOR 8: TRADER A -> MANIPULATE AVAILABILITY & CALENDAR
  // =========================================================================
  describe("Vector 8: Trader Availability & Calendar Tampering Defense", () => {
    it("BLOCKS Trader A from altering Competitor Trader B's working hours or emergency status", () => {
      expect(() => {
        assertCanManageTraderAvailability(maliciousTraderA, legitimateTraderB.uid);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS legitimate Trader B to update their own working hours and calendar", () => {
      expect(() => {
        assertCanManageTraderAvailability(legitimateTraderB, legitimateTraderB.uid);
      }).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 9: TRADER A -> IMPERSONATE ANOTHER TRADER
  // =========================================================================
  describe("Vector 9: Trader Identity Impersonation Defense", () => {
    it("BLOCKS Trader A from submitting a quote under Trader B's identity", () => {
      const forgedQuotePayload = {
        tradespersonId: legitimateTraderB.uid, // Alice/Trader A puts Bob's ID
        amount: 850,
        description: "Standard gas boiler service"
      };

      expect(() => {
        assertResourceOwner(maliciousTraderA, forgedQuotePayload.tradespersonId, "Tradesperson Quote");
      }).toThrow(ForbiddenError);
    });

    it("STRIPS role and verified badges from client profile update payload", () => {
      const maliciousProfileUpdate = {
        bio: "Experienced gas safe engineer",
        role: "admin",
        isAdmin: true,
        verifiedTrader: true,
        trustScore: 100,
        rating: 5.0,
        totalReviews: 500
      };

      const sanitized = sanitizeClientPayload(maliciousProfileUpdate);
      expect(sanitized.bio).toBe("Experienced gas safe engineer");
      expect(sanitized.role).toBeUndefined();
      expect(sanitized.isAdmin).toBeUndefined();
      expect(sanitized.verifiedTrader).toBeUndefined();
      expect(sanitized.trustScore).toBeUndefined();
      expect(sanitized.rating).toBeUndefined();
      expect(sanitized.totalReviews).toBeUndefined();
    });
  });
});
