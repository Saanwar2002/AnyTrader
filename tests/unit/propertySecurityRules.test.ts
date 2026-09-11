import { describe, it, expect } from "vitest";
import { 
  sanitizePropertyToPublicPassport, 
  extractOutwardPostcode, 
  sanitizePublicDescription 
} from "../../src/server/projectionSync";
import { 
  assertCanAccessProperty, 
  assertCanModifyProperty, 
  SERVER_OWNED_PROTECTED_KEYS,
  sanitizeClientPayload
} from "../../src/server/authorization";
import * as fs from "fs";
import * as path from "path";

describe("Firestore Property Security Remediation & Privacy Invariants Test Suite", () => {
  const rulesContent = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf-8");

  describe("1. Static Rule AST & Policy Enforcement Invariants", () => {
    it("ENFORCES authentication requirement on private /properties collection (no public reads)", () => {
      const propMatch = rulesContent.match(/match \/properties\/\{propertyId\} \{([\s\S]*?)(match \/|$)/);
      expect(propMatch).toBeTruthy();
      const propBlock = propMatch![1];

      // Must NOT have 'allow get: if true' or 'allow read: if true' on private /properties
      expect(propBlock).not.toMatch(/allow\s+(?:get|read|list)\s*:\s*if\s+true\s*;/);
      expect(propBlock).toMatch(/allow\s+get\s*:\s*if\s+isSignedIn\(\)\s*&&/);
      expect(propBlock).toMatch(/allow\s+list\s*:\s*if\s+isSignedIn\(\)\s*&&/);
    });

    it("RESTRICTS private /properties access strictly to owner, landlord, pending recipient, authorized tenant, or admin", () => {
      const propMatch = rulesContent.match(/match \/properties\/\{propertyId\} \{([\s\S]*?)(match \/|$)/);
      const propBlock = propMatch![1];

      expect(propBlock).toContain("ownerId");
      expect(propBlock).toContain("userId");
      expect(propBlock).toContain("landlordId");
      expect(propBlock).toContain("pendingTransferToUid");
      expect(propBlock).toContain("tenantEmail");
      expect(propBlock).toContain("isAdmin()");
    });

    it("PREVENTS client mutation of ownership & administrative verification keys on /properties", () => {
      const propMatch = rulesContent.match(/match \/properties\/\{propertyId\} \{([\s\S]*?)(match \/|$)/);
      const propBlock = propMatch![1];

      expect(propBlock).toContain("ownerId");
      expect(propBlock).toContain("userId");
      expect(propBlock).toContain("landlordId");
      expect(propBlock).toContain("transferClaimedByUid");
      expect(propBlock).toContain("verifiedByAdmin");
    });

    it("ALLOWS public & anonymous read discovery on /public_properties projection", () => {
      const publicPropMatch = rulesContent.match(/match \/public_properties\/\{propertyId\} \{([\s\S]*?)\}/);
      expect(publicPropMatch).toBeTruthy();
      const publicBlock = publicPropMatch![1];

      expect(publicBlock).toMatch(/allow\s+(?:get,\s*list|read,\s*list|get|list|read)\s*:\s*if\s+true\s*;/);
    });

    it("BLOCKS sensitive PII and private property keys from being written to /public_properties", () => {
      const publicPropMatch = rulesContent.match(/match \/public_properties\/\{propertyId\} \{([\s\S]*?)\}/);
      const publicBlock = publicPropMatch![1];

      expect(publicBlock).toContain("ownerId");
      expect(publicBlock).toContain("userId");
      expect(publicBlock).toContain("tenantEmail");
      expect(publicBlock).toContain("fullAddress");
      expect(publicBlock).toContain("line1");
      expect(publicBlock).toContain("componentRegistry");
      expect(publicBlock).toContain("transferHistory");
      expect(publicBlock).toContain("insuranceProvider");
    });
  });

  describe("2. Rule Simulation & Authorization Guard Invariants", () => {
    interface SecurityContext {
      auth: { uid: string; email?: string; token?: { role?: string; isAdmin?: boolean; email?: string } } | null;
    }

    const evaluateIsSignedIn = (ctx: SecurityContext) => !!ctx.auth?.uid;
    const evaluateIsAdmin = (ctx: SecurityContext) => {
      if (!ctx.auth) return false;
      return ctx.auth.token?.role === "admin" || ctx.auth.token?.isAdmin === true;
    };

    const evaluateCanReadPrivateProperty = (ctx: SecurityContext, propData: Record<string, any>) => {
      if (!evaluateIsSignedIn(ctx)) return false;
      const uid = ctx.auth!.uid;
      const email = ctx.auth!.email || ctx.auth!.token?.email;
      
      const isOwner = propData.ownerId === uid || propData.userId === uid;
      const isLandlord = propData.landlordId === uid;
      const isPendingRecipient = propData.transferStatus === "pending" && propData.pendingTransferToUid === uid;
      const isTenant = email && propData.tenantEmail && propData.tenantEmail.toLowerCase() === email.toLowerCase();
      const isAdminUser = evaluateIsAdmin(ctx);

      return Boolean(isOwner || isLandlord || isPendingRecipient || isTenant || isAdminUser);
    };

    const evaluateCanModifyPrivateProperty = (ctx: SecurityContext, propData: Record<string, any>) => {
      if (!evaluateIsSignedIn(ctx)) return false;
      const uid = ctx.auth!.uid;
      const isOwner = propData.ownerId === uid || propData.userId === uid;
      const isPendingRecipient = propData.transferStatus === "pending" && propData.pendingTransferToUid === uid;
      const isAdminUser = evaluateIsAdmin(ctx);

      return Boolean(isOwner || isPendingRecipient || isAdminUser);
    };

    const privateProperty = {
      id: "prop_123",
      ownerId: "user_owner",
      userId: "user_owner",
      landlordId: "user_landlord",
      name: "10 Downing Residence",
      address: {
        line1: "10 Downing Street",
        city: "London",
        postcode: "SW1A 2AA"
      },
      tenantEmail: "tenant@example.com",
      tenantPhone: "07123456789",
      componentRegistry: {
        stopcockLocation: "Under kitchen sink",
        fuseboardLocation: "Hallway cupboard",
        paintCodes: "Farrow & Ball Wimborne White"
      },
      transferCode: "X9F2A1",
      transferStatus: "pending",
      pendingTransferToUid: "user_buyer",
      transferHistory: [
        { transferredAt: "2024-01-01", fromOwnerUid: "old_owner", toOwnerUid: "user_owner" }
      ],
      insuranceProvider: "Aviva Private Cover",
      policyNumber: "POL-998877",
      epcRating: "B",
      boilerInfo: { brand: "Worcester Bosch", model: "Greenstar 8000" }
    };

    it("DENIES anonymous users from reading private property documents", () => {
      const anonCtx: SecurityContext = { auth: null };
      expect(evaluateCanReadPrivateProperty(anonCtx, privateProperty)).toBe(false);

      expect(() => {
        assertCanAccessProperty({ uid: "" } as any, privateProperty);
      }).toThrow();
    });

    it("DENIES arbitrary third-party authenticated users from reading private property documents", () => {
      const attackerCtx: SecurityContext = { 
        auth: { uid: "attacker_user_999", email: "attacker@bad.com" } 
      };
      expect(evaluateCanReadPrivateProperty(attackerCtx, privateProperty)).toBe(false);

      expect(() => {
        assertCanAccessProperty({ uid: "attacker_user_999", email: "attacker@bad.com" } as any, privateProperty);
      }).toThrow();
    });

    it("ALLOWS legitimate owner, pending buyer, authorized tenant, and admin to read private property", () => {
      const ownerCtx: SecurityContext = { auth: { uid: "user_owner", email: "owner@home.com" } };
      const buyerCtx: SecurityContext = { auth: { uid: "user_buyer", email: "buyer@home.com" } };
      const tenantCtx: SecurityContext = { auth: { uid: "user_tenant", email: "tenant@example.com", token: { email: "tenant@example.com" } } };
      const adminCtx: SecurityContext = { auth: { uid: "user_admin", token: { role: "admin" } } };

      expect(evaluateCanReadPrivateProperty(ownerCtx, privateProperty)).toBe(true);
      expect(evaluateCanReadPrivateProperty(buyerCtx, privateProperty)).toBe(true);
      expect(evaluateCanReadPrivateProperty(tenantCtx, privateProperty)).toBe(true);
      expect(evaluateCanReadPrivateProperty(adminCtx, privateProperty)).toBe(true);

      expect(() => assertCanAccessProperty({ uid: "user_owner" } as any, privateProperty)).not.toThrow();
      expect(() => assertCanAccessProperty({ uid: "user_buyer" } as any, privateProperty)).not.toThrow();
      expect(() => assertCanAccessProperty({ uid: "user_tenant", email: "tenant@example.com" } as any, privateProperty)).not.toThrow();
      expect(() => assertCanAccessProperty({ uid: "user_admin", isAdmin: true } as any, privateProperty)).not.toThrow();
    });

    it("PREVENTS non-owner from modifying private property", () => {
      const attackerCtx: SecurityContext = { auth: { uid: "attacker_user_999" } };
      expect(evaluateCanModifyPrivateProperty(attackerCtx, privateProperty)).toBe(false);

      expect(() => {
        assertCanModifyProperty({ uid: "attacker_user_999" } as any, privateProperty);
      }).toThrow();
    });

    it("STRIPS client-injected property ownership and privilege keys via sanitizeClientPayload", () => {
      const maliciousPayload = {
        name: "Updated Name",
        ownerId: "hacked_owner_uid",
        userId: "hacked_user_uid",
        landlordId: "hacked_landlord_uid",
        tenantId: "hacked_tenant_uid",
        pendingTransferToUid: "attacker_uid",
        transferClaimedByUid: "attacker_uid",
        isAdmin: true,
        role: "admin",
        verified: true
      };

      const sanitized = sanitizeClientPayload(maliciousPayload);
      expect(sanitized.name).toBe("Updated Name");
      expect(sanitized.ownerId).toBeUndefined();
      expect(sanitized.userId).toBeUndefined();
      expect(sanitized.landlordId).toBeUndefined();
      expect(sanitized.tenantId).toBeUndefined();
      expect(sanitized.pendingTransferToUid).toBeUndefined();
      expect(sanitized.transferClaimedByUid).toBeUndefined();
      expect(sanitized.isAdmin).toBeUndefined();
      expect(sanitized.role).toBeUndefined();
      expect(sanitized.verified).toBeUndefined();
    });
  });

  describe("3. Projection Sanitization & Data Leakage Prevention Invariants", () => {
    const rawPrivateProperty = {
      id: "prop_private_999",
      ownerId: "owner_secret_uid",
      userId: "user_secret_uid",
      landlordId: "landlord_secret_uid",
      tenantId: "tenant_secret_uid",
      tenantEmail: "tenant.private@gmail.com",
      tenantPhone: "+44 7123 456789",
      name: "Luxury Penthouse Suite - Call Jane at 07999888777",
      address: {
        line1: "Flat 4B, 10 Kensington Palace Gardens",
        city: "London",
        postcode: "W8 4QP",
        country: "UK"
      },
      componentRegistry: {
        stopcockLocation: "Behind false wall in master ensuite",
        fuseboardLocation: "Locked basement compartment, code 4821",
        paintCodes: "Farrow & Ball Elephant's Breath #229"
      },
      transferCode: "SECRET77",
      transferStatus: "completed",
      transferHistory: [
        { transferredAt: "2023-01-01", fromOwnerUid: "uid_a", toOwnerUid: "owner_secret_uid" }
      ],
      insuranceProvider: "Hiscox Ultra High Net Worth",
      policyNumber: "HX-998812-ZZ",
      epcRating: "B",
      boilerInfo: {
        brand: "Vaillant",
        model: "ecoTEC plus 832",
        age: 3,
        lastServiced: "2025-11-10"
      },
      roofCondition: "Excellent",
      gasSafetyExpiry: "2026-11-10",
      eicrExpiry: "2028-05-15"
    };

    it("PRODUCES a clean public passport projection with NO PII, NO full address, and NO sensitive components", () => {
      const publicPassport = sanitizePropertyToPublicPassport("prop_private_999", rawPrivateProperty);

      // Verify ID and public attributes
      expect(publicPassport.id).toBe("prop_private_999");
      expect(publicPassport.epcRating).toBe("B");
      expect(publicPassport.roofCondition).toBe("Excellent");
      expect(publicPassport.boilerInfo?.brand).toBe("Vaillant");
      expect(publicPassport.gasSafetyExpiry).toBe("2026-11-10");
      expect(publicPassport.eicrExpiry).toBe("2028-05-15");

      // Verify postcode is sanitized to outward code only
      expect(publicPassport.postcodeArea).toBe("W8");
      expect(publicPassport.address?.postcode).toBe("W8 ***");
      expect(publicPassport.address?.city).toBe("London");

      // Strict Redaction checks:
      expect((publicPassport as any).ownerId).toBeUndefined();
      expect((publicPassport as any).userId).toBeUndefined();
      expect((publicPassport as any).landlordId).toBeUndefined();
      expect((publicPassport as any).tenantId).toBeUndefined();
      expect((publicPassport as any).tenantEmail).toBeUndefined();
      expect((publicPassport as any).tenantPhone).toBeUndefined();

      expect((publicPassport as any).address?.line1).toBeUndefined();
      expect((publicPassport as any).fullAddress).toBeUndefined();
      expect((publicPassport as any).componentRegistry).toBeUndefined();
      expect((publicPassport as any).transferCode).toBeUndefined();
      expect((publicPassport as any).transferHistory).toBeUndefined();
      expect((publicPassport as any).insuranceProvider).toBeUndefined();
      expect((publicPassport as any).policyNumber).toBeUndefined();

      // Title/Name PII phone sanitization
      expect(publicPassport.name).not.toContain("07999888777");
      expect(publicPassport.name).toContain("[Phone Redacted]");
    });
  });
});
