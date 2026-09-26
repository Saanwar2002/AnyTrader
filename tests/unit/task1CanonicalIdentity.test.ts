/**
 * Task 1 — Canonical Identity & Capability Model Test Suite
 *
 * Validates:
 * - Test A: Legacy role compatibility mapping to canonical accountType and capabilities
 * - Test B: Capability separation & client payload injection defense (sanitizeClientPayload)
 * - Test C: Portal & presentation state isolation (localStorage / activeContext cannot elevate server authority)
 * - Test D: Subscription separation (subscription tier does not grant unauthorized capabilities)
 * - Test E: Server-authoritative admin checks (cannot escalate to admin without custom claims)
 * - Test F: Cross-user IDOR/BOLA authorization enforcement
 */

import { describe, it, expect } from "vitest";
import {
  resolveAccountType,
  resolveCapabilities,
  resolveCanonicalIdentity,
  hasCapability,
  assertHasCapability,
  assertHasAccountType,
  CanonicalIdentity,
} from "../../src/server/identity.ts";
import {
  assertIsAdmin,
  assertUserRole,
  assertUserCapability,
  assertUserAccountType,
  assertResourceOwner,
  sanitizeClientPayload,
  SERVER_OWNED_PROTECTED_KEYS,
  AuthenticatedUser,
} from "../../src/server/authorization.ts";
import { ForbiddenError, UnauthorizedError } from "../../src/server/httpErrors.ts";

describe("Task 1: Canonical Identity & Capability Model", () => {
  describe("Test A: Legacy Role Compatibility Mapping", () => {
    it("maps legacy 'customer' and 'homeowner' roles to canonical consumer account with homeowner capability", () => {
      const identityCust = resolveCanonicalIdentity({ uid: "user_1", role: "customer" });
      expect(identityCust.accountType).toBe("consumer");
      expect(identityCust.capabilities).toContain("homeowner");

      const identityHome = resolveCanonicalIdentity({ uid: "user_2", role: "homeowner" });
      expect(identityHome.accountType).toBe("consumer");
      expect(identityHome.capabilities).toContain("homeowner");
    });

    it("maps legacy 'tradesperson' and 'trader' roles to service_provider with tradesperson capability", () => {
      const identityTrader = resolveCanonicalIdentity({ uid: "user_3", role: "tradesperson" });
      expect(identityTrader.accountType).toBe("service_provider");
      expect(identityTrader.capabilities).toContain("tradesperson");
      expect(identityTrader.capabilities).not.toContain("fleet_driver");

      const identityPro = resolveCanonicalIdentity({ uid: "user_4", role: "trader" });
      expect(identityPro.accountType).toBe("service_provider");
      expect(identityPro.capabilities).toContain("tradesperson");
    });

    it("maps legacy 'driver' and 'fleet_driver' roles to driver with fleet_driver capability", () => {
      const identityDriver = resolveCanonicalIdentity({ uid: "user_5", role: "fleet_driver" });
      expect(identityDriver.accountType).toBe("driver");
      expect(identityDriver.capabilities).toContain("fleet_driver");
      expect(identityDriver.capabilities).not.toContain("tradesperson");
    });

    it("maps legacy 'business' with properties layer to business with landlord, estate_agent, property_manager capabilities", () => {
      const identityBusinessProps = resolveCanonicalIdentity({
        uid: "user_6",
        role: "business",
        businessLayer: "properties",
      });
      expect(identityBusinessProps.accountType).toBe("business");
      expect(identityBusinessProps.capabilities).toContain("landlord");
      expect(identityBusinessProps.capabilities).toContain("property_manager");
      expect(identityBusinessProps.capabilities).toContain("estate_agent");
      expect(identityBusinessProps.capabilities).toContain("contractor");
    });

    it("maps legacy 'business' with consultancy layer to business with consultant and contractor capabilities", () => {
      const identityConsultant = resolveCanonicalIdentity({
        uid: "user_7",
        role: "business",
        businessLayer: "consultancy",
      });
      expect(identityConsultant.accountType).toBe("business");
      expect(identityConsultant.capabilities).toContain("consultant");
      expect(identityConsultant.capabilities).toContain("contractor");
    });

    it("maps 'admin' and 'ecosystem_manager' roles to admin account type with full supervisory capabilities", () => {
      const identityAdmin = resolveCanonicalIdentity({ uid: "user_8", role: "admin", isAdmin: true });
      expect(identityAdmin.accountType).toBe("admin");
      expect(hasCapability(identityAdmin, "homeowner")).toBe(true);
      expect(hasCapability(identityAdmin, "tradesperson")).toBe(true);
      expect(hasCapability(identityAdmin, "fleet_driver")).toBe(true);

      const identityEco = resolveCanonicalIdentity({ uid: "user_9", role: "ecosystem_manager", isAdmin: true });
      expect(identityEco.accountType).toBe("admin");
    });
  });

  describe("Test B: Capability Separation & Mass Assignment Defense", () => {
    it("strips client-injected accountType, capabilities, and activeContext from untrusted payloads", () => {
      const maliciousPayload = {
        title: "Fix My Boiler",
        budget: 500,
        accountType: "admin",
        capabilities: ["admin", "tradesperson", "fleet_driver"],
        activeContext: { portal: "anyroller", role: "admin" },
        role: "admin",
        isAdmin: true,
      };

      const sanitized = sanitizeClientPayload(maliciousPayload);

      expect(sanitized.title).toBe("Fix My Boiler");
      expect(sanitized.budget).toBe(500);
      expect((sanitized as any).accountType).toBeUndefined();
      expect((sanitized as any).capabilities).toBeUndefined();
      expect((sanitized as any).activeContext).toBeUndefined();
      expect((sanitized as any).role).toBeUndefined();
      expect((sanitized as any).isAdmin).toBeUndefined();
    });

    it("SERVER_OWNED_PROTECTED_KEYS contains all canonical identity attributes", () => {
      expect(SERVER_OWNED_PROTECTED_KEYS.has("accountType")).toBe(true);
      expect(SERVER_OWNED_PROTECTED_KEYS.has("capabilities")).toBe(true);
      expect(SERVER_OWNED_PROTECTED_KEYS.has("activeContext")).toBe(true);
      expect(SERVER_OWNED_PROTECTED_KEYS.has("customClaims")).toBe(true);
    });
  });

  describe("Test C: Portal & Presentation State Isolation", () => {
    it("assertUserCapability denies unauthorized actions even if presentation context claims a different persona", () => {
      const consumerUser: AuthenticatedUser = {
        uid: "cust_123",
        role: "customer",
        // Client tries to attach activeContext claiming to be a fleet driver
        identity: {
          uid: "cust_123",
          accountType: "consumer",
          capabilities: ["homeowner"],
          verification: { status: "unverified" },
          subscription: { tierId: "PAYG", status: "active" },
          activeContext: { portal: "anyroller", role: "driver" },
        },
      };

      // Customer can perform homeowner operations
      expect(() => assertUserCapability(consumerUser, "homeowner")).not.toThrow();

      // Customer CANNOT perform driver or tradesperson operations regardless of activeContext
      expect(() => assertUserCapability(consumerUser, "fleet_driver")).toThrow(ForbiddenError);
      expect(() => assertUserCapability(consumerUser, "tradesperson")).toThrow(ForbiddenError);
    });

    it("assertUserAccountType enforces authoritative account type over presentation role", () => {
      const consumerUser: AuthenticatedUser = {
        uid: "cust_123",
        role: "customer",
      };

      expect(() => assertUserAccountType(consumerUser, ["consumer"])).not.toThrow();
      expect(() => assertUserAccountType(consumerUser, ["driver", "service_provider"])).toThrow(ForbiddenError);
    });
  });

  describe("Test D: Subscription Separation", () => {
    it("commercial subscription tier does NOT grant unauthorized capabilities or admin rights", () => {
      const platinumConsumer: AuthenticatedUser = {
        uid: "consumer_premium",
        role: "customer",
      };

      const identity = resolveCanonicalIdentity({
        uid: "consumer_premium",
        role: "customer",
        tierId: "Platinum Enterprise",
        subscriptionStatus: "active",
        subscriptionType: "enterprise",
      });

      expect(identity.accountType).toBe("consumer");
      expect(identity.subscription.tierId).toBe("Platinum Enterprise");
      // Subscription does NOT elevate capabilities to tradesperson or admin
      expect(identity.capabilities).not.toContain("tradesperson");
      expect(identity.capabilities).not.toContain("fleet_driver");
      expect(identity.accountType).not.toBe("admin");

      expect(() => assertIsAdmin(platinumConsumer)).toThrow(ForbiddenError);
    });
  });

  describe("Test E: Server-Authoritative Admin Verification", () => {
    it("assertIsAdmin throws ForbiddenError if caller lacks authoritative admin custom claim", () => {
      const regularUser: AuthenticatedUser = {
        uid: "attacker_1",
        email: "attacker@test.com",
        role: "customer",
        isAdmin: false,
      };

      expect(() => assertIsAdmin(regularUser)).toThrow(ForbiddenError);
    });

    it("assertIsAdmin succeeds when custom claim isAdmin or admin is true", () => {
      const verifiedAdmin: AuthenticatedUser = {
        uid: "admin_1",
        email: "admin@anytrader.com",
        isAdmin: true,
      };

      expect(() => assertIsAdmin(verifiedAdmin)).not.toThrow();
    });

    it("assertIsAuthenticated throws UnauthorizedError when user is null or missing UID", () => {
      expect(() => assertUserCapability(null as any, "homeowner")).toThrow(UnauthorizedError);
      expect(() => assertUserCapability({ uid: "" } as any, "homeowner")).toThrow(UnauthorizedError);
    });
  });

  describe("Test F: Cross-User Resource Authorization (IDOR / BOLA)", () => {
    it("assertResourceOwner blocks User A from accessing or mutating User B's resources", () => {
      const userA: AuthenticatedUser = {
        uid: "user_A_id",
        role: "customer",
      };

      // Accessing own resource succeeds
      expect(() => assertResourceOwner(userA, "user_A_id", "Property")).not.toThrow();

      // Accessing User B's resource fails closed
      expect(() => assertResourceOwner(userA, "user_B_id", "Property")).toThrow(ForbiddenError);
      expect(() => assertResourceOwner(userA, "user_B_id", "Job")).toThrow(ForbiddenError);
    });
  });
});
