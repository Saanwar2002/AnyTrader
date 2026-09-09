import { describe, it, expect, beforeEach } from "vitest";
import {
  assertCanManageEstate,
  assertCanManageRide,
  assertCanSubmitDirectQuote,
  assertCanAccessTenantReport,
  assertCanManageMilestone,
  assertCanSubmitReview,
  sanitizeClientPayload,
  assertResourceOwner,
  assertCanAccessProperty,
  assertCanModifyProperty,
  type AuthenticatedUser
} from "../../src/server/authorization.ts";
import {
  validateJobTransition,
  validateMilestoneTransition,
  validatePaymentTransition,
  validateRideTransition,
  validateDisputeTransition
} from "../../src/server/stateMachine.ts";
import {
  ConcurrencyLockEngine
} from "../../src/server/concurrencyLock.ts";
import {
  BusinessLogicDefense
} from "../../src/server/businessLogicDefense.ts";
import {
  ForbiddenError,
  BadRequestError,
  ConflictError,
  UnauthorizedError
} from "../../src/server/httpErrors.ts";

describe("Adversarial Platform Security & Exploit Penetration Suite", () => {
  let userA: AuthenticatedUser;
  let userB: AuthenticatedUser;
  let adminUser: AuthenticatedUser;
  let traderA: AuthenticatedUser;
  let traderB: AuthenticatedUser;

  beforeEach(() => {
    userA = { uid: "victim_customer_A", email: "alice@example.com", role: "homeowner" };
    userB = { uid: "attacker_customer_B", email: "bob_attacker@evil.com", role: "homeowner" };
    adminUser = { uid: "super_admin_1", email: "admin@anytrader.com", role: "admin", isAdmin: true };
    traderA = { uid: "legit_trader_A", email: "trader_a@trades.com", role: "tradesperson" };
    traderB = { uid: "malicious_trader_B", email: "trader_b@evil.com", role: "tradesperson" };
  });

  // =========================================================================
  // VECTOR 1: Multi-Tenant / Gotham Layer Estate IDOR & Privilege Escalation
  // =========================================================================
  describe("Vector 1: Multi-Tenant Estate & B2B SaaS IDOR Defense", () => {
    const estateManagerA = { uid: "manager_alpha", email: "alpha@housing.gov.uk", role: "estate_manager" };
    const estateManagerB = { uid: "manager_beta_attacker", email: "beta@rogue.com", role: "estate_manager" };

    const estateAlpha = {
      estateId: "estate_101",
      managerId: "manager_alpha",
      name: "St George Housing Estate",
      doorsCount: 250,
      monthlyPlan: "Gotham Growth (£3.50/door)",
      tenantCount: 500,
      totalRentCollected: 150000
    };

    it("REJECTS rogue manager B attempting to access or modify manager A's housing estate", () => {
      expect(() => {
        assertCanManageEstate(estateManagerB, estateAlpha);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS legitimate estate manager A to manage their own estate", () => {
      expect(() => {
        assertCanManageEstate(estateManagerA, estateAlpha);
      }).not.toThrow();
    });

    it("ALLOWS platform administrator to access estate for audit and billing support", () => {
      expect(() => {
        assertCanManageEstate(adminUser, estateAlpha);
      }).not.toThrow();
    });

    it("STRIPS client-injected B2B SaaS subscription and verification overrides", () => {
      const maliciousPayload = {
        name: "Rogue Property",
        gothamSubscription: "Enterprise_Unlimited_Free",
        isPro: true,
        subscriptionStatus: "active",
        subscriptionId: "sub_free_bypass",
        videoVerified: true,
        verifiedBadges: ["SUPER_PRO", "ID_VERIFIED", "POLICE_CHECKED"]
      };

      const sanitized = sanitizeClientPayload(maliciousPayload);

      expect(sanitized.name).toBe("Rogue Property");
      expect((sanitized as any).gothamSubscription).toBeUndefined();
      expect((sanitized as any).isPro).toBeUndefined();
      expect((sanitized as any).subscriptionStatus).toBeUndefined();
      expect((sanitized as any).videoVerified).toBeUndefined();
      expect((sanitized as any).verifiedBadges).toBeUndefined();
    });
  });

  // =========================================================================
  // VECTOR 2: AnyRoller Taxi Ride BOLA, Hijack & Lifecycle Attacks
  // =========================================================================
  describe("Vector 2: AnyRoller Taxi Ride BOLA & Lifecycle Security", () => {
    const passengerAlice: AuthenticatedUser = { uid: "passenger_alice", email: "alice@ride.com", role: "passenger" };
    const passengerBob: AuthenticatedUser = { uid: "passenger_bob", email: "bob@ride.com", role: "passenger" };
    const driverDave: AuthenticatedUser = { uid: "driver_dave", email: "dave@taxi.com", role: "driver" };
    const driverEve: AuthenticatedUser = { uid: "driver_eve_hijacker", email: "eve@taxi.com", role: "driver" };

    const activeTrip = {
      tripId: "trip_999",
      passengerId: "passenger_alice",
      driverId: "driver_dave",
      status: "in_progress",
      fare: 28.50,
      pickup: "Paddington Station",
      dropoff: "Canary Wharf"
    };

    const searchingTrip = {
      tripId: "trip_888",
      passengerId: "passenger_alice",
      status: "searching",
      fare: 15.00
    };

    it("BLOCKS passenger Bob from viewing or cancelling passenger Alice's trip", () => {
      expect(() => {
        assertCanManageRide(passengerBob, activeTrip, "view");
      }).toThrow(ForbiddenError);

      expect(() => {
        assertCanManageRide(passengerBob, activeTrip, "cancel");
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS rogue driver Eve from updating status on driver Dave's assigned trip", () => {
      expect(() => {
        assertCanManageRide(driverEve, activeTrip, "update_status");
      }).toThrow(ForbiddenError);
    });

    it("BLOCKS accepting a trip that is already assigned / in_progress", () => {
      expect(() => {
        assertCanManageRide(driverEve, activeTrip, "accept");
      }).toThrow(ConflictError);
    });

    it("BLOCKS a passenger from accepting their own ride request as a driver", () => {
      expect(() => {
        assertCanManageRide(passengerAlice, searchingTrip, "accept");
      }).toThrow(BadRequestError);
    });

    it("BLOCKS cancelling an already completed taxi trip", () => {
      const completedTrip = { ...activeTrip, status: "completed" };
      expect(() => {
        assertCanManageRide(passengerAlice, completedTrip, "cancel");
      }).toThrow(BadRequestError);
    });

    it("ENFORCES state machine rejection on illegal taxi transition shortcuts", () => {
      expect(() => {
        validateRideTransition("draft" as any, "completed" as any);
      }).toThrow();

      expect(() => {
        validateRideTransition("cancelled" as any, "in_progress" as any);
      }).toThrow();

      expect(() => {
        validateRideTransition("completed" as any, "arrived" as any);
      }).toThrow();
    });
  });

  // =========================================================================
  // VECTOR 3: 1-to-1 Direct Quote Request Interception & Hijack Defense
  // =========================================================================
  describe("Vector 3: Direct 1-to-1 Quote Request Interception Defense", () => {
    const direct1to1Job = {
      jobId: "job_direct_123",
      homeownerId: "victim_customer_A",
      title: "Boiler Installation",
      targetTraderId: "legit_trader_A",
      status: "open"
    };

    const broadcastJob = {
      jobId: "job_broadcast_456",
      homeownerId: "victim_customer_A",
      title: "Garden Landscaping",
      status: "open"
    };

    it("ALLOWS requested Trader A to submit quote on 1-to-1 direct quote request", () => {
      expect(() => {
        assertCanSubmitDirectQuote(traderA, direct1to1Job);
      }).not.toThrow();
    });

    it("BLOCKS uninvited Trader B from intercepting or quoting 1-to-1 direct quote request", () => {
      expect(() => {
        assertCanSubmitDirectQuote(traderB, direct1to1Job);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS any valid trader to quote a public broadcast job", () => {
      expect(() => {
        assertCanSubmitDirectQuote(traderB, broadcastJob);
      }).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 4: Tenant Repair Report & PII Access Protection
  // =========================================================================
  describe("Vector 4: Tenant Repair Report & PII Access Defense", () => {
    const tenantAlice = { uid: "tenant_alice", email: "alice.tenant@domain.com", role: "tenant" };
    const tenantBob = { uid: "tenant_bob_snoop", email: "bob.snoop@domain.com", role: "tenant" };
    const landlordCharles = { uid: "landlord_charles", email: "charles@properties.com", role: "landlord" };

    const repairReport = {
      reportId: "report_777",
      propertyId: "prop_99",
      tenantId: "tenant_alice",
      tenantEmail: "alice.tenant@domain.com",
      landlordId: "landlord_charles",
      issueDescription: "Severe damp in master bedroom",
      tenantPhoneNumber: "+44 7700 900077",
      accessInstructions: "Key under front mat, ring 2x"
    };

    it("BLOCKS snooping Tenant Bob from reading Tenant Alice's repair report and PII", () => {
      expect(() => {
        assertCanAccessTenantReport(tenantBob, repairReport);
      }).toThrow(ForbiddenError);
    });

    it("ALLOWS reporting Tenant Alice to access her own repair report", () => {
      expect(() => {
        assertCanAccessTenantReport(tenantAlice, repairReport);
      }).not.toThrow();
    });

    it("ALLOWS property Landlord Charles to access repair reports for his properties", () => {
      expect(() => {
        assertCanAccessTenantReport(landlordCharles, repairReport);
      }).not.toThrow();
    });
  });

  // =========================================================================
  // VECTOR 5: Concurrent Race Conditions & Multi-Request Concurrency Defense
  // =========================================================================
  describe("Vector 5: Multi-Request Concurrency & Atomic Action Invariants", () => {
    let mockStore: Map<string, any>;
    let storeAdapter: any;

    beforeEach(() => {
      ConcurrencyLockEngine._resetLocksForTesting();
      mockStore = new Map();
      storeAdapter = {
        get: (key: string) => mockStore.get(key),
        set: (key: string, val: any) => mockStore.set(key, val)
      };
    });

    it("HANDLES simultaneous double-accept race conditions deterministically", async () => {
      const jobId = "race_job_concurrent_1";
      mockStore.set(`jobs/${jobId}`, {
        id: jobId,
        status: "open",
        acceptedTraderId: null
      });

      const acceptAttempt1 = ConcurrencyLockEngine.atomicAcceptJob(
        storeAdapter,
        jobId,
        "quote_1",
        "trader_alpha"
      );

      const acceptAttempt2 = ConcurrencyLockEngine.atomicAcceptJob(
        storeAdapter,
        jobId,
        "quote_2",
        "trader_beta"
      );

      const results = await Promise.allSettled([acceptAttempt1, acceptAttempt2]);
      const successes = results.filter(r => r.status === "fulfilled");
      const failures = results.filter(r => r.status === "rejected");

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      
      const savedJob = mockStore.get(`jobs/${jobId}`);
      expect(savedJob.status).toBe("in_progress");
      expect(["trader_alpha", "trader_beta"]).toContain(savedJob.acceptedTraderId);
    });

    it("PREVENTS concurrent double-spend on wallet balances", async () => {
      const userId = "wallet_user_race_1";
      mockStore.set(`users/${userId}`, {
        uid: userId,
        balance: 100
      });

      const withdraw = async (amount: number) => {
        return ConcurrencyLockEngine.atomicWithdrawFunds(
          storeAdapter,
          userId,
          amount,
          async (amt) => ({ payoutId: `payout_${Date.now()}_${amt}` })
        );
      };

      const w1 = withdraw(100);
      const w2 = withdraw(100);

      const results = await Promise.allSettled([w1, w2]);
      const successful = results.filter(r => r.status === "fulfilled");
      const rejected = results.filter(r => r.status === "rejected");

      expect(successful.length).toBe(1);
      expect(rejected.length).toBe(1);
      
      const savedUser = mockStore.get(`users/${userId}`);
      expect(savedUser.balance).toBe(0); // Zero balance deficit created
    });

    it("PREVENTS concurrent property ownership transfer conflict", async () => {
      const propertyId = "prop_transfer_race_1";
      mockStore.set(`properties/${propertyId}`, {
        id: propertyId,
        ownerId: "owner_original_alice"
      });

      const transfer1 = ConcurrencyLockEngine.atomicTransferOwnership(
        storeAdapter,
        propertyId,
        "owner_original_alice",
        "new_owner_bob"
      );

      const transfer2 = ConcurrencyLockEngine.atomicTransferOwnership(
        storeAdapter,
        propertyId,
        "owner_original_alice",
        "new_owner_charlie"
      );

      const results = await Promise.allSettled([transfer1, transfer2]);
      const successful = results.filter(r => r.status === "fulfilled");
      const rejected = results.filter(r => r.status === "rejected");

      expect(successful.length).toBe(1);
      expect(failures => failures).toBeDefined();
      expect(rejected.length).toBe(1);

      const savedProp = mockStore.get(`properties/${propertyId}`);
      expect(["new_owner_bob", "new_owner_charlie"]).toContain(savedProp.ownerId);
      expect(savedProp.transferStatus).toBe("completed");
    });
  });
});
