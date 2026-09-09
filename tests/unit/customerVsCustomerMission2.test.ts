import { describe, it, expect, beforeEach } from "vitest";
import { 
  AuthenticatedUser,
  assertCanAccessJob,
  assertCanModifyJob,
  assertCanAccessConversation,
  assertCanAccessProperty,
  assertCanModifyProperty,
  assertCanAccessDispute,
  assertCanModifyDispute,
  assertCanSubmitReview,
  assertCanManageMilestone,
  assertCanAccessUserStorage,
  assertResourceOwner,
  sanitizeClientPayload
} from "../../src/server/authorization.ts";
import { 
  ForbiddenError, 
  BadRequestError 
} from "../../src/server/httpErrors.ts";
import { AbuseDefenseEngine } from "../../src/server/abuseDefense.ts";

/**
 * MISSION 2 — ADVERSARIAL TEST SUITE: NORMAL CUSTOMER ATTACKING ANOTHER CUSTOMER
 * Rigorous verification of Object-Level Access Control (BOLA / IDOR Defense).
 * 
 * Scenario:
 * User A (Customer A - "cust_alice")
 * User B (Customer B - "cust_bob")
 * 
 * Systematic Attack Matrix:
 * 1. A -> access B's private in-progress job
 * 2. A -> modify / cancel B's job
 * 3. A -> read / intercept B's private conversation messages
 * 4. A -> access B's private property passport & documents
 * 5. A -> access / alter B's tenant/landlord dispute
 * 6. A -> submit a fake review impersonating B or on B's private job
 * 7. A -> release B's funded escrow milestone to steal/divert funds
 * 8. A -> manipulate B's payment / payout status via parameter injection
 * 9. A -> read / write B's private KYC & ID documents in storage
 * 
 * REVERSED MATRIX:
 * Re-execute all vectors for User B attacking User A (B -> A) to ensure symmetric enforcement.
 */

describe("Mission 2: Customer vs Customer Adversarial Exploitation (BOLA / IDOR Verification)", () => {
  const userA: AuthenticatedUser = {
    uid: "cust_alice_101",
    email: "alice@example.com",
    role: "homeowner",
    isAdmin: false
  };

  const userB: AuthenticatedUser = {
    uid: "cust_bob_202",
    email: "bob@example.com",
    role: "homeowner",
    isAdmin: false
  };

  const neutralTrader: AuthenticatedUser = {
    uid: "trader_dan_303",
    email: "dan@example.com",
    role: "tradesperson",
    isAdmin: false
  };

  beforeEach(() => {
    AbuseDefenseEngine._resetLogsForTesting();
  });

  // =========================================================================
  // VECTOR 1: A -> ACCESS B's JOB & B -> ACCESS A's JOB
  // =========================================================================
  describe("Vector 1: Private Job Access Defense (BOLA / IDOR)", () => {
    it("BLOCKS Customer A from accessing Customer B's private in-progress job", () => {
      const bPrivateJob = {
        id: "job_b_private",
        homeownerId: userB.uid,
        tradespersonId: neutralTrader.uid,
        status: "in_progress",
        title: "Private Full Bathroom Renovation"
      };

      expect(() => {
        assertCanAccessJob(userA, bPrivateJob);
      }).toThrow(ForbiddenError);
    });

    it("REVERSED: BLOCKS Customer B from accessing Customer A's private in-progress job", () => {
      const aPrivateJob = {
        id: "job_a_private",
        homeownerId: userA.uid,
        tradespersonId: neutralTrader.uid,
        status: "in_progress",
        title: "Private Rewiring"
      };

      expect(() => {
        assertCanAccessJob(userB, aPrivateJob);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS legitimate owner and assigned tradesperson to access the job", () => {
      const aJob = {
        id: "job_a_private",
        homeownerId: userA.uid,
        tradespersonId: neutralTrader.uid,
        status: "in_progress"
      };

      expect(() => assertCanAccessJob(userA, aJob)).not.toThrow();
      expect(() => assertCanAccessJob(neutralTrader, aJob)).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 2: A -> MODIFY B's JOB & B -> MODIFY A's JOB
  // =========================================================================
  describe("Vector 2: Job Modification & Cancellation Defense", () => {
    it("BLOCKS Customer A from modifying, editing, or cancelling Customer B's job", () => {
      const bJob = {
        id: "job_b_open",
        homeownerId: userB.uid,
        status: "open",
        budget: 1500
      };

      expect(() => {
        assertCanModifyJob(userA, bJob);
      }).toThrow(ForbiddenError);
    });

    it("REVERSED: BLOCKS Customer B from modifying Customer A's job", () => {
      const aJob = {
        id: "job_a_open",
        homeownerId: userA.uid,
        status: "open",
        budget: 2000
      };

      expect(() => {
        assertCanModifyJob(userB, aJob);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS legitimate creator to modify their own job", () => {
      const aJob = { id: "job_a_open", homeownerId: userA.uid, status: "open" };
      expect(() => assertCanModifyJob(userA, aJob)).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 3: A -> READ B's MESSAGES & B -> READ A's MESSAGES
  // =========================================================================
  describe("Vector 3: Private Conversation & Message Eavesdropping Defense", () => {
    it("BLOCKS Customer A from accessing Customer B's conversation with Trader Dan", () => {
      const bConversationParticipants = [userB.uid, neutralTrader.uid];

      expect(() => {
        assertCanAccessConversation(userA, bConversationParticipants);
      }).toThrow(ForbiddenError);
    });

    it("REVERSED: BLOCKS Customer B from accessing Customer A's conversation with Trader Dan", () => {
      const aConversationParticipants = [userA.uid, neutralTrader.uid];

      expect(() => {
        assertCanAccessConversation(userB, aConversationParticipants);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS valid participants to access the conversation thread", () => {
      const conversationParticipants = [userA.uid, neutralTrader.uid];
      expect(() => assertCanAccessConversation(userA, conversationParticipants)).not.toThrow();
      expect(() => assertCanAccessConversation(neutralTrader, conversationParticipants)).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 4: A -> ACCESS B's PROPERTY & B -> ACCESS A's PROPERTY
  // =========================================================================
  describe("Vector 4: Property Passport Privacy & Specs Defense", () => {
    it("BLOCKS Customer A from reading or modifying Customer B's private Property Passport", () => {
      const bProperty = {
        id: "prop_b_1",
        ownerId: userB.uid,
        isPublicPassport: false,
        address: "42 Wallaby Way, London",
        epcRating: "B",
        alarmCode: "9482"
      };

      expect(() => {
        assertCanAccessProperty(userA, bProperty);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanModifyProperty(userA, bProperty);
      }).toThrow(ForbiddenError);
    });

    it("REVERSED: BLOCKS Customer B from reading or modifying Customer A's private Property Passport", () => {
      const aProperty = {
        id: "prop_a_1",
        ownerId: userA.uid,
        isPublicPassport: false,
        address: "10 Downing Mews, London"
      };

      expect(() => {
        assertCanAccessProperty(userB, aProperty);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanModifyProperty(userB, aProperty);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS verified property owner to access and modify their property passport", () => {
      const aProperty = { id: "prop_a_1", ownerId: userA.uid, isPublicPassport: false };
      expect(() => assertCanAccessProperty(userA, aProperty)).not.toThrow();
      expect(() => assertCanModifyProperty(userA, aProperty)).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 5: A -> ACCESS B's DISPUTE & B -> ACCESS A's DISPUTE
  // =========================================================================
  describe("Vector 5: Dispute Resolution Access & Mutation Defense", () => {
    it("BLOCKS Customer A from viewing or modifying Customer B's dispute with landlord/trader", () => {
      const bDispute = {
        id: "dispute_b_1",
        landlordOwnerId: "landlord_smith",
        claimantId: userB.uid,
        respondentId: neutralTrader.uid,
        disputeAmount: 850
      };

      expect(() => {
        assertCanAccessDispute(userA, bDispute);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanModifyDispute(userA, bDispute);
      }).toThrow(ForbiddenError);
    });

    it("REVERSED: BLOCKS Customer B from viewing or modifying Customer A's dispute", () => {
      const aDispute = {
        id: "dispute_a_1",
        landlordOwnerId: "landlord_jones",
        claimantId: userA.uid,
        respondentId: neutralTrader.uid,
        disputeAmount: 1200
      };

      expect(() => {
        assertCanAccessDispute(userB, aDispute);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanModifyDispute(userB, aDispute);
      }).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // VECTOR 6: A -> SUBMIT B's REVIEW & B -> SUBMIT A's REVIEW
  // =========================================================================
  describe("Vector 6: Review Forgery & Identity Impersonation Defense", () => {
    it("BLOCKS Customer A from submitting a review under Customer B's identity", () => {
      const forgedReview = {
        reviewerId: userB.uid, // Alice pretending to be Bob
        traderId: neutralTrader.uid,
        rating: 1,
        comment: "Malicious 1-star fake review forged by Alice"
      };

      expect(() => {
        assertCanSubmitReview(userA, forgedReview);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS Customer A from submitting a review on Customer B's private job", () => {
      const bJob = {
        id: "job_b_completed",
        homeownerId: userB.uid,
        tradespersonId: neutralTrader.uid,
        status: "completed"
      };

      const unassociatedReview = {
        reviewerId: userA.uid,
        traderId: neutralTrader.uid,
        jobId: bJob.id,
        rating: 5
      };

      expect(() => {
        assertCanSubmitReview(userA, unassociatedReview, bJob);
      }).toThrow(ForbiddenError);
    });

    it("REVERSED: BLOCKS Customer B from submitting a review under Customer A's identity", () => {
      const forgedReview = {
        reviewerId: userA.uid, // Bob pretending to be Alice
        traderId: neutralTrader.uid,
        rating: 1
      };

      expect(() => {
        assertCanSubmitReview(userB, forgedReview);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS legitimate job participant to submit a review under their own identity", () => {
      const aJob = {
        id: "job_a_completed",
        homeownerId: userA.uid,
        tradespersonId: neutralTrader.uid,
        status: "completed"
      };

      const validReview = {
        reviewerId: userA.uid,
        traderId: neutralTrader.uid,
        jobId: aJob.id,
        rating: 5,
        comment: "Great work by Dan!"
      };

      expect(() => assertCanSubmitReview(userA, validReview, aJob)).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 7: A -> RELEASE B's MILESTONE & B -> RELEASE A's MILESTONE
  // =========================================================================
  describe("Vector 7: Milestone Escrow Fund Diversion Defense", () => {
    it("BLOCKS Customer A from funding or releasing Customer B's escrow milestone", () => {
      const bMilestone = {
        id: "ms_b_funded",
        customerId: userB.uid,
        tradespersonId: neutralTrader.uid,
        amount: 750,
        status: "funded"
      };

      // Alice tries to release Bob's money
      expect(() => {
        assertCanManageMilestone(userA, bMilestone, "release");
      }).toThrow(ForbiddenError);

      // Alice tries to fund Bob's milestone with forged authorization
      expect(() => {
        assertCanManageMilestone(userA, bMilestone, "fund");
      }).toThrow(ForbiddenError);
    });

    it("REVERSED: BLOCKS Customer B from releasing Customer A's escrow milestone", () => {
      const aMilestone = {
        id: "ms_a_funded",
        customerId: userA.uid,
        tradespersonId: neutralTrader.uid,
        amount: 1200,
        status: "funded"
      };

      expect(() => {
        assertCanManageMilestone(userB, aMilestone, "release");
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS the true paying customer to release milestone funds to their trader", () => {
      const aMilestone = {
        id: "ms_a_funded",
        customerId: userA.uid,
        tradespersonId: neutralTrader.uid,
        amount: 1200,
        status: "funded"
      };

      expect(() => assertCanManageMilestone(userA, aMilestone, "release")).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 8: A -> MANIPULATE B's PAYMENT & B -> MANIPULATE A's PAYMENT
  // =========================================================================
  describe("Vector 8: Payment Manipulation & Parameter Injection Defense", () => {
    it("BLOCKS Customer A from claiming ownership of Customer B's payment or payout target", () => {
      expect(() => {
        assertResourceOwner(userA, userB.uid, "Customer Payment");
      }).toThrow(ForbiddenError);
    });

    it("STRIPS client-injected financial, role, and payout overrides from payload", () => {
      const maliciousPayload = {
        title: "Valid job title update",
        // Injected fields attempting to mark B's job as paid or change payout recipient
        paymentStatus: "paid",
        payoutStatus: "transferred",
        payoutTransferred: true,
        customerId: userA.uid, // Attempting to divert customer ownership to Alice
        ownerId: userA.uid,
        amount: 0,
        platformFee: 0,
        role: "admin"
      };

      const sanitized = sanitizeClientPayload(maliciousPayload);

      expect(sanitized.title).toBe("Valid job title update");
      expect(sanitized.paymentStatus).toBeUndefined();
      expect(sanitized.payoutStatus).toBeUndefined();
      expect(sanitized.payoutTransferred).toBeUndefined();
      expect(sanitized.customerId).toBeUndefined();
      expect(sanitized.ownerId).toBeUndefined();
      expect(sanitized.amount).toBeUndefined();
      expect(sanitized.platformFee).toBeUndefined();
      expect(sanitized.role).toBeUndefined();
    });

    it("REVERSED: BLOCKS Customer B from claiming Customer A's payout target", () => {
      expect(() => {
        assertResourceOwner(userB, userA.uid, "Customer Payment");
      }).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // VECTOR 9: A -> ACCESS B's FILES & B -> ACCESS A's FILES
  // =========================================================================
  describe("Vector 9: Private User Storage & Document Isolation (KYC/ID Files)", () => {
    it("BLOCKS Customer A from reading or writing Customer B's private KYC documents", () => {
      expect(() => {
        assertCanAccessUserStorage(userA, userB.uid, "read", false);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanAccessUserStorage(userA, userB.uid, "write", false);
      }).toThrow(ForbiddenError);
    });

    it("REVERSED: BLOCKS Customer B from reading or writing Customer A's private KYC documents", () => {
      expect(() => {
        assertCanAccessUserStorage(userB, userA.uid, "read", false);
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanAccessUserStorage(userB, userA.uid, "write", false);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS Customer A to read and write their own private storage folder", () => {
      expect(() => assertCanAccessUserStorage(userA, userA.uid, "read", false)).not.toThrow();
      expect(() => assertCanAccessUserStorage(userA, userA.uid, "write", false)).not.toThrow();
    });

    it("ALLOWS reading public portfolio folders across users", () => {
      expect(() => assertCanAccessUserStorage(userA, userB.uid, "read", true)).not.toThrow();
      expect(() => assertCanAccessUserStorage(userB, userA.uid, "read", true)).not.toThrow();
    });
  });
});
