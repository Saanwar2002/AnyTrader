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

  describe("Test G: Multi-Vector Adversarial Escalation Defense (Task 1 Section 17)", () => {
    it("Vector 1: Capability Escalation — client injection of explicit capabilities filtered against accountType", () => {
      const forgedConsumer = resolveCanonicalIdentity({
        uid: "attacker_consumer",
        role: "customer",
        explicitCapabilities: ["fleet_driver", "contractor", "admin"],
      });

      expect(forgedConsumer.accountType).toBe("consumer");
      // Cannot claim fleet_driver or contractor because accountType is consumer
      expect(forgedConsumer.capabilities).not.toContain("fleet_driver");
      expect(forgedConsumer.capabilities).not.toContain("contractor");
      expect(forgedConsumer.capabilities).toContain("homeowner");
    });

    it("Vector 2: Account Type Escalation — untrusted accountType string without custom claim defaults safely", () => {
      const forgedPayload = {
        uid: "attacker_claim",
        accountType: "admin",
        role: "customer",
      };

      const identity = resolveCanonicalIdentity(forgedPayload);
      expect(identity.accountType).toBe("consumer");
      expect(identity.accountType).not.toBe("admin");
    });

    it("Vector 3: Role Escalation — raw role: 'admin' string without custom claims does not grant admin", () => {
      const forgedAdminRole = {
        uid: "attacker_fake_admin",
        role: "admin",
        isAdmin: false,
      };

      const identity = resolveCanonicalIdentity(forgedAdminRole);
      expect(identity.accountType).toBe("consumer");
      expect(() => assertIsAdmin(forgedAdminRole)).toThrow(ForbiddenError);
    });

    it("Vector 4: Portal & LocalStorage Manipulation — manipulating activeContext/localStorage leaves server auth unchanged", () => {
      // Simulate client localStorage having anytrader_active_role = "admin"
      const clientSideActiveContext = {
        portal: "anytrader" as const,
        role: "admin",
      };

      const authenticatedConsumer: AuthenticatedUser = {
        uid: "consumer_user",
        role: "customer",
        isAdmin: false,
      };

      // Server identity resolution uses authenticated server user context, not client localStorage
      const serverIdentity = resolveCanonicalIdentity({
        uid: authenticatedConsumer.uid,
        role: authenticatedConsumer.role,
        activeContext: clientSideActiveContext,
      });

      expect(serverIdentity.accountType).toBe("consumer");
      expect(serverIdentity.capabilities).toContain("homeowner");
      expect(serverIdentity.capabilities).not.toContain("fleet_driver");
      expect(() => assertIsAdmin(authenticatedConsumer)).toThrow(ForbiddenError);
      expect(() => assertUserCapability(authenticatedConsumer, "fleet_driver")).toThrow(ForbiddenError);
    });

    it("Vector 5: Subscription Manipulation — changing subscriptionType or plan does not grant admin or driver capabilities", () => {
      const maliciousSubscriptionPayload = {
        uid: "consumer_sub_attacker",
        role: "customer",
        subscriptionType: "gotham_b2b_enterprise",
        tierId: "Platinum Enterprise",
        subscriptionStatus: "active",
        plan: "enterprise_admin",
      };

      const identity = resolveCanonicalIdentity(maliciousSubscriptionPayload);
      expect(identity.accountType).toBe("consumer");
      expect(identity.subscription.tierId).toBe("Platinum Enterprise");
      expect(identity.capabilities).not.toContain("fleet_driver");
      expect(identity.capabilities).not.toContain("tradesperson");
      expect(identity.capabilities).toContain("homeowner");
      expect(() => assertIsAdmin({ uid: maliciousSubscriptionPayload.uid, role: maliciousSubscriptionPayload.role })).toThrow(ForbiddenError);
    });

    it("Vector 6: Cross-User Identity — submitting another user's uid in payload does not change authenticated context", () => {
      const authenticatedUser: AuthenticatedUser = {
        uid: "legitimate_auth_uid",
        role: "customer",
      };

      const untrustedPayload = {
        uid: "victim_uid",
        userId: "victim_uid",
        ownerId: "victim_uid",
        accountType: "admin",
        capabilities: ["admin"],
      };

      // sanitizeClientPayload strips server-owned keys
      const sanitized = sanitizeClientPayload(untrustedPayload);
      expect((sanitized as any).accountType).toBeUndefined();
      expect((sanitized as any).capabilities).toBeUndefined();

      // assertResourceOwner verifies against authenticatedUser.uid, not payload uid
      expect(() => assertResourceOwner(authenticatedUser, untrustedPayload.ownerId, "Document")).toThrow(ForbiddenError);
      expect(() => assertResourceOwner(authenticatedUser, authenticatedUser.uid, "Document")).not.toThrow();
    });

    it("Vector 7: Admin Escalation Matrix — all non-custom-claim escalation vectors fail closed", () => {
      const escalationVectors = [
        { uid: "e1", role: "admin", isAdmin: false },
        { uid: "e2", role: "ecosystem_manager", isAdmin: false },
        { uid: "e3", accountType: "admin" },
        { uid: "e4", capabilities: ["admin"] },
        { uid: "e5", subscriptionType: "admin_enterprise" },
        { uid: "e6", activeContext: { portal: "anytrader", role: "admin" } },
      ];

      for (const vec of escalationVectors) {
        const user: AuthenticatedUser = { uid: vec.uid, role: (vec as any).role };
        expect(() => assertIsAdmin(user)).toThrow(ForbiddenError);
        const resolved = resolveCanonicalIdentity(vec as any);
        expect(resolved.accountType).not.toBe("admin");
      }
    });
  });
});
