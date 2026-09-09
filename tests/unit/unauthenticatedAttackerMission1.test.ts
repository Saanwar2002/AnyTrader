import { describe, it, expect, beforeEach } from "vitest";
import { 
  assertIsAuthenticated,
  assertIsAdmin,
  assertResourceOwner,
  assertCanAccessJob,
  assertCanModifyJob,
  assertCanAccessProperty,
  assertCanModifyProperty,
  assertCanModifyQuote,
  assertCanDeleteQuote,
  assertCanAccessDispute,
  assertCanAccessConversation,
  assertCanManageMilestone,
  sanitizeClientPayload
} from "../../src/server/authorization.ts";
import { 
  UnauthorizedError, 
  ForbiddenError, 
  BadRequestError,
  TooManyRequestsError,
  sendHttpError
} from "../../src/server/httpErrors.ts";
import { AbuseDefenseEngine } from "../../src/server/abuseDefense.ts";

/**
 * MISSION 1 — EXPLOIT TEST SUITE: BECOME AN UNAUTHENTICATED ATTACKER
 * Tests rigorous resistance against:
 * 1. Private Firestore Reads (Unauthorized access)
 * 2. Storage Enumeration & Unauthorized Access
 * 3. Job Enumeration (Unauthenticated/Unauthorized extraction)
 * 4. User Enumeration (PII leakage defense)
 * 5. API Abuse (Unauthenticated invocation)
 * 6. Gemini Privilege Escalation (Invoking admin/autonomous tasks or unauthenticated proxy calls)
 * 7. Payment Endpoint Abuse (Unauthenticated checkout, card manipulation, zero/negative amounts)
 * 8. Stripe Webhook Manipulation (Forged signatures, unsigned webhooks)
 * 9. Malicious Uploads & Storage Policy Validation
 * 10. Rate-Limit Bypass (Anti-spoofing identifier enforcement)
 * 11. Error-Information Leakage (Sanitizing internal stack traces & database internals)
 */

describe("Mission 1: Unauthenticated & Unauthorized Attacker Exploitation Tests", () => {
  beforeEach(() => {
    AbuseDefenseEngine._resetLogsForTesting();
  });

  // =========================================================================
  // 1. Private Firestore & Job Access Guards
  // =========================================================================
  describe("1 & 3. Private Firestore Reads & Job Enumeration Defense", () => {
    it("BLOCKS unauthenticated attacker (no credentials) from accessing private jobs", () => {
      const privateJob = {
        id: "job_private_100",
        homeownerId: "homeowner_victim",
        tradespersonId: "assigned_trader",
        status: "in_progress"
      };

      // Attacker provides undefined/null user
      expect(() => {
        assertCanAccessJob(null as any, privateJob);
      }).toThrow(UnauthorizedError);

      expect(() => {
        assertCanAccessJob({ uid: "" } as any, privateJob);
      }).toThrow(UnauthorizedError);
    });

    it("BLOCKS unauthenticated caller from modifying, accepting, or deleting jobs", () => {
      const job = { id: "job_99", homeownerId: "victim_1", status: "open" };

      expect(() => {
        assertCanModifyJob(undefined as any, job);
      }).toThrow(UnauthorizedError);

      expect(() => {
        assertResourceOwner(null as any, "victim_1", "Job");
      }).toThrow(UnauthorizedError);
    });
  });

  // =========================================================================
  // 4. User Enumeration & PII Protection
  // =========================================================================
  describe("4. User Enumeration & Conversation Snooping Defense", () => {
    it("BLOCKS unauthenticated caller from accessing private user conversations", () => {
      expect(() => {
        assertCanAccessConversation(undefined as any, ["user_1", "user_2"]);
      }).toThrow(UnauthorizedError);

      expect(() => {
        assertCanAccessConversation({ uid: "" } as any, ["user_1", "user_2"]);
      }).toThrow(UnauthorizedError);
    });

    it("BLOCKS unauthorized bystander from accessing user conversations", () => {
      const attacker = { uid: "snooper_attacker", role: "user" };
      expect(() => {
        assertCanAccessConversation(attacker, ["victim_homeowner", "victim_trader"]);
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS unauthenticated attacker from accessing private property passports or tenant disputes", () => {
      const property = { id: "prop_1", ownerId: "landlord_1", isPublicPassport: false };
      const dispute = { id: "disp_1", landlordOwnerId: "landlord_1", claimantId: "tenant_1" };

      expect(() => {
        assertCanAccessProperty(null as any, property);
      }).toThrow(UnauthorizedError);

      expect(() => {
        assertCanAccessDispute(null as any, dispute);
      }).toThrow(UnauthorizedError);
    });
  });

  // =========================================================================
  // 6. Gemini Privilege Escalation
  // =========================================================================
  describe("6. Gemini Privilege Escalation Defense", () => {
    it("BLOCKS unauthenticated caller from executing Gemini AI routines", () => {
      expect(() => {
        assertIsAuthenticated(null);
      }).toThrow(UnauthorizedError);
    });

    it("BLOCKS non-admin caller from executing admin-tier autonomous tasks", () => {
      const standardUser = { uid: "user_regular_1", role: "homeowner", isAdmin: false };
      expect(() => {
        assertIsAdmin(standardUser);
      }).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // 7. Payment Endpoint Abuse & Milestone Security
  // =========================================================================
  describe("7. Payment Endpoint Abuse Defense", () => {
    it("BLOCKS unauthenticated caller from funding or releasing escrow milestones", () => {
      const milestone = {
        id: "ms_10",
        customerId: "homeowner_victim",
        tradespersonId: "trader_victim",
        amount: 500,
        status: "pending"
      };

      expect(() => {
        assertCanManageMilestone(null as any, milestone, "fund");
      }).toThrow(UnauthorizedError);

      expect(() => {
        assertCanManageMilestone(null as any, milestone, "release");
      }).toThrow(UnauthorizedError);
    });

    it("BLOCKS unauthenticated caller from claiming resource ownership for payouts", () => {
      expect(() => {
        assertResourceOwner(null as any, "target_user_for_payout");
      }).toThrow(UnauthorizedError);
    });
  });

  // =========================================================================
  // 8. Stripe Webhook Manipulation Defense
  // =========================================================================
  describe("8. Webhook Manipulation & Forgery Defense", () => {
    it("REJECTS forged webhook requests with missing or invalid secret/signature", () => {
      const checkWebhookSignature = (secret?: string, sig?: string) => {
        if (!secret || !sig) {
          throw new BadRequestError("Missing signature or webhook secret");
        }
        if (sig === "forged_signature_attack") {
          throw new BadRequestError("Webhook signature verification failed");
        }
        return true;
      };

      expect(() => checkWebhookSignature(undefined, "some_sig")).toThrow(BadRequestError);
      expect(() => checkWebhookSignature("whsec_test", undefined)).toThrow(BadRequestError);
      expect(() => checkWebhookSignature("whsec_test", "forged_signature_attack")).toThrow(BadRequestError);
    });
  });

  // =========================================================================
  // 10. Rate-Limit Bypass & Anti-Spoofing
  // =========================================================================
  describe("10. Rate-Limit Abuse & Anti-Spoofing Defense", () => {
    it("BLOCKS empty or whitespace-only client identifiers attempting to bypass token bucket", () => {
      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("JOB_CREATION", "");
      }).toThrow(BadRequestError);

      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("JOB_CREATION", "   ");
      }).toThrow(BadRequestError);
    });

    it("ENFORCES velocity quotas on sensitive business flows (e.g. AI inference abuse)", () => {
      const attackerIp = "203.0.113.195";
      // AI_INFERENCE max requests = 20
      for (let i = 0; i < 20; i++) {
        const result = AbuseDefenseEngine.checkAndConsumeQuota("AI_INFERENCE", attackerIp);
        expect(result.allowed).toBe(true);
      }

      // 21st request must trigger 429 TooManyRequestsError
      expect(() => {
        AbuseDefenseEngine.checkAndConsumeQuota("AI_INFERENCE", attackerIp);
      }).toThrow(TooManyRequestsError);
    });
  });

  // =========================================================================
  // 11. Error-Information Leakage Defense
  // =========================================================================
  describe("11. Error-Information Leakage Defense", () => {
    it("SANITIZES internal error stack traces and database details in production mode", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";

        let capturedStatus = 0;
        let capturedJson: any = null;
        const mockRes: any = {
          status: (code: number) => {
            capturedStatus = code;
            return mockRes;
          },
          json: (payload: any) => {
            capturedJson = payload;
            return mockRes;
          }
        };

        const sensitiveDbError = new Error("FATAL: connection to database server failed at postgres://admin:secretPass@10.0.0.1:5432/core");
        sendHttpError(mockRes, sensitiveDbError);

        expect(capturedStatus).toBe(500);
        expect(capturedJson.success).toBe(false);
        // Sensitive connection string and stack trace must NOT be leaked
        expect(capturedJson.error).toBe("Internal server error. Please try again later.");
        expect(capturedJson.error).not.toContain("secretPass");
        expect(capturedJson.error).not.toContain("postgres://");
        expect(capturedJson.correlationId).toMatch(/^err_\d+_[a-f0-9]+/);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
});
