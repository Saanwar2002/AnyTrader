import { describe, it, expect } from "vitest";
import {
  assertIsAuthenticated,
  assertIsAdmin,
  assertResourceOwner,
  assertCanAccessConversation,
  sanitizeClientPayload,
} from "../../src/server/authorization.ts";
import { UnauthorizedError, ForbiddenError } from "../../src/server/httpErrors.ts";

describe("Authorization & Security Guards", () => {
  describe("assertIsAuthenticated", () => {
    it("passes for valid user context", () => {
      expect(() => assertIsAuthenticated({ uid: "user_123" })).not.toThrow();
    });

    it("throws UnauthorizedError when user is missing or has empty uid", () => {
      expect(() => assertIsAuthenticated(null)).toThrow(UnauthorizedError);
      expect(() => assertIsAuthenticated(undefined)).toThrow(UnauthorizedError);
      expect(() => assertIsAuthenticated({ uid: "" })).toThrow(UnauthorizedError);
    });
  });

  describe("assertIsAdmin", () => {
    it("passes for super admin or admin/ecosystem_manager roles", () => {
      expect(() => assertIsAdmin({ uid: "admin_1", isAdmin: true })).not.toThrow();
      expect(() => assertIsAdmin({ uid: "admin_2", role: "admin" })).not.toThrow();
      expect(() => assertIsAdmin({ uid: "mgr_1", role: "ecosystem_manager" })).not.toThrow();
    });

    it("throws ForbiddenError for regular customers and tradespeople", () => {
      expect(() => assertIsAdmin({ uid: "cust_1", role: "customer" })).toThrow(ForbiddenError);
      expect(() => assertIsAdmin({ uid: "trad_1", role: "tradesperson" })).toThrow(ForbiddenError);
    });
  });

  describe("assertResourceOwner (IDOR / BOLA Prevention)", () => {
    it("allows the resource owner to access their resource", () => {
      const user = { uid: "user_abc" };
      expect(() => assertResourceOwner(user, "user_abc", "Profile")).not.toThrow();
    });

    it("blocks an attacker attempting to access another user's resource", () => {
      const attacker = { uid: "attacker_evil" };
      expect(() => assertResourceOwner(attacker, "victim_123", "Job")).toThrow(ForbiddenError);
    });

    it("allows administrative override for support operations", () => {
      const adminUser = { uid: "admin_1", isAdmin: true };
      expect(() => assertResourceOwner(adminUser, "victim_123", "Job")).not.toThrow();
    });
  });

  describe("assertCanAccessConversation (Chat Eavesdropping Prevention)", () => {
    it("allows message access to conversation participants", () => {
      const participant = { uid: "user_a" };
      expect(() => assertCanAccessConversation(participant, ["user_a", "user_b"])).not.toThrow();
    });

    it("blocks third-party snooping", () => {
      const eavesdropper = { uid: "user_c" };
      expect(() => assertCanAccessConversation(eavesdropper, ["user_a", "user_b"])).toThrow(ForbiddenError);
    });
  });

  describe("sanitizeClientPayload (Mass Assignment Defense)", () => {
    it("strips out server-owned and privileged keys", () => {
      const maliciousPayload = {
        name: "Honest Trader",
        bio: "Skilled plumber",
        role: "admin", // Priv escalation
        isAdmin: true, // Priv escalation
        rating: 5.0, // Rating tampering
        payoutTransferred: true, // Financial tampering
        platformFee: 0, // Fee bypass
      };

      const sanitized = sanitizeClientPayload(maliciousPayload);

      expect(sanitized.name).toBe("Honest Trader");
      expect(sanitized.bio).toBe("Skilled plumber");
      expect((sanitized as any).role).toBeUndefined();
      expect((sanitized as any).isAdmin).toBeUndefined();
      expect((sanitized as any).rating).toBeUndefined();
      expect((sanitized as any).payoutTransferred).toBeUndefined();
      expect((sanitized as any).platformFee).toBeUndefined();
    });
  });
});
