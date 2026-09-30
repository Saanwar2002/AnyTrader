import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  JOB_CREATE_PROTECTED_KEYS,
  JOB_CREATE_INPUT_SCHEMA,
  validateCreateJobInput,
  resolveCreateJobQuota,
  executeCreateJobCommand,
} from "../../src/server/createJobCommand.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../src/server/httpErrors.ts";
import { CanonicalIdentity } from "../../src/server/identity.ts";
import { domainEvents } from "../../src/server/domainEvents.ts";
import * as admin from "firebase-admin";

describe("Task 2: Canonical CreateJob Command Test Suite", () => {
  const homeownerIdentity: CanonicalIdentity = {
    uid: "test_homeowner_123",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "verified", credentials: [] },
    subscription: { tierId: "PAYG", status: "active", isFoundingMember: false },
  };

  const traderIdentity: CanonicalIdentity = {
    uid: "test_trader_456",
    accountType: "service_provider",
    capabilities: ["tradesperson"],
    verification: { status: "verified", credentials: [] },
    subscription: { tierId: "gold_pro", status: "active", isFoundingMember: false },
  };

  const strangerIdentity: CanonicalIdentity = {
    uid: "test_stranger_789",
    accountType: "consumer",
    capabilities: ["homeowner"],
    verification: { status: "verified", credentials: [] },
    subscription: { tierId: "PAYG", status: "active", isFoundingMember: false },
  };

  const validJobPayload = {
    title: "Fix leaking radiator in kitchen",
    description: "Leaking valve on ground floor radiator requires replacement.",
    category: "Plumbing",
    postcode: "SW1A 1AA",
    urgency: "standard" as const,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Protected Fields Rejection & Strict Schema Validation", () => {
    it("rejects client attempts to supply server-owned protected keys with BadRequestError", () => {
      const protectedKeysToTest = [
        "status",
        "homeownerId",
        "userId",
        "posterId",
        "customerId",
        "ownerId",
        "id",
        "jobNo",
        "completed",
        "payoutStatus",
        "quoteCount",
        "quotesCount",
        "isEmergencyBoost",
        "isBoosted",
        "boostTier",
        "boostExpiresAt",
        "role",
        "isAdmin",
        "admin",
        "platformFee",
        "amount",
        "payoutTransferred",
        "balance",
        "credits",
      ];

      for (const key of protectedKeysToTest) {
        const payloadWithProtected = {
          ...validJobPayload,
          [key]: key === "status" ? "completed" : "malicious_override",
        };

        expect(() => validateCreateJobInput(payloadWithProtected)).toThrow(BadRequestError);
        expect(() => validateCreateJobInput(payloadWithProtected)).toThrow(
          /Protected server-owned fields cannot be supplied/
        );
      }
    });

    it("rejects unknown arbitrary fields smuggled into the payload via strict schema", () => {
      const payloadWithSmuggledField = {
        ...validJobPayload,
        unrecognizedHackerField: "injection_payload",
      };

      expect(() => validateCreateJobInput(payloadWithSmuggledField)).toThrow(BadRequestError);
      expect(() => validateCreateJobInput(payloadWithSmuggledField)).toThrow(/Invalid job creation input schema/);
    });

    it("accepts valid schema payload with business fields only", () => {
      const validated = validateCreateJobInput(validJobPayload);
      expect(validated.title).toBe(validJobPayload.title);
      expect(validated.category).toBe(validJobPayload.category);
      expect(validated.postcode).toBe(validJobPayload.postcode);
    });
  });

  describe("2. Deterministic Quota Resolution with Real Global Tiers Structure", () => {
    it("returns unlimited quota when paywall is disabled", () => {
      const quota = resolveCreateJobQuota({}, { paywallEnabled: false });
      expect(quota.isUnlimited).toBe(true);
      expect(quota.limit).toBe(Infinity);
      expect(quota.enabled).toBe(false);
    });

    it("resolves default consumer quota (5 jobs) when no active subscription", () => {
      const quota = resolveCreateJobQuota({ accountType: "consumer" }, { paywallEnabled: true });
      expect(quota.isUnlimited).toBe(false);
      expect(quota.limit).toBe(5);
      expect(quota.enabled).toBe(true);
      expect(quota.periodKey).toMatch(/^\d{4}-\d{2}$/);
    });

    it("resolves structured global_tiers provider models with monthly and lifetime periods", () => {
      const globalTiersConfig = {
        providerModels: {
          b2b_saas: {
            tiers: {
              business_starter: { jobPostsLimit: 10, limitPeriod: "monthly" },
              business_pro: { jobPostsLimit: 50, limitPeriod: "monthly" },
              lifetime_tier: { jobPostsLimit: 100, limitPeriod: "lifetime" },
            },
          },
        },
      };

      const starterQuota = resolveCreateJobQuota(
        { tierId: "business_starter" },
        { paywallEnabled: true },
        globalTiersConfig
      );
      expect(starterQuota.limit).toBe(10);
      expect(starterQuota.periodKey).toMatch(/^\d{4}-\d{2}$/);

      const proQuota = resolveCreateJobQuota(
        { tierId: "business_pro" },
        { paywallEnabled: true },
        globalTiersConfig
      );
      expect(proQuota.limit).toBe(50);

      const lifetimeQuota = resolveCreateJobQuota(
        { tierId: "lifetime_tier" },
        { paywallEnabled: true },
        globalTiersConfig
      );
      expect(lifetimeQuota.limit).toBe(100);
      expect(lifetimeQuota.periodKey).toBe("lifetime");
      expect(lifetimeQuota.periodStart).toBe(new Date(0).toISOString());
    });
  });

  describe("3. Capability Enforcement & Persisted-Record Derived-Job Authorization", () => {
    function createMockFirestore() {
      const store = new Map<string, any>();
      let transactionQueue = Promise.resolve();

      const mockDb: any = {
        collection: (colName: string) => ({
          doc: (docId?: string) => {
            const id = docId || `doc_${Math.random().toString(36).substring(2, 9)}`;
            const path = `${colName}/${id}`;
            return {
              id,
              path,
              get: async () => ({
                exists: store.has(path),
                id,
                data: () => store.get(path),
              }),
              set: async (data: any, options?: any) => {
                if (options?.merge && store.has(path)) {
                  store.set(path, { ...store.get(path), ...data });
                } else {
                  store.set(path, data);
                }
              },
            };
          },
        }),
        runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
          return new Promise((resolve, reject) => {
            transactionQueue = transactionQueue.then(async () => {
              try {
                const transaction = {
                  get: async (ref: any) => ref.get(),
                  set: (ref: any, data: any, options?: any) => {
                    if (options?.merge && store.has(ref.path)) {
                      store.set(ref.path, { ...store.get(ref.path), ...data });
                    } else {
                      store.set(ref.path, data);
                    }
                  },
                };
                const result = await updateFunction(transaction);
                resolve(result);
              } catch (err) {
                reject(err);
              }
            });
          });
        },
      };

      return { mockDb, store };
    }

    it("requires 'homeowner' capability for standard job creation, rejecting pure tradesperson identity", async () => {
      const { mockDb } = createMockFirestore();

      await expect(
        executeCreateJobCommand({
          db: mockDb,
          identity: traderIdentity,
          rawPayload: validJobPayload,
          idempotencyKey: "trader_forbidden_key_1",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("enforces persisted parent job authorization for BOM delivery derived jobs", async () => {
      const { mockDb, store } = createMockFirestore();

      // Seed parent job owned by homeowner, with assigned trader
      store.set("jobs/parent_job_100", {
        id: "parent_job_100",
        homeownerId: homeownerIdentity.uid,
        acceptedTraderId: traderIdentity.uid,
        status: "in_progress",
      });

      // 1. Unrelated stranger cannot create BOM delivery for this parent job
      await expect(
        executeCreateJobCommand({
          db: mockDb,
          identity: strangerIdentity,
          rawPayload: {
            ...validJobPayload,
            title: "BOM Delivery Courier",
            parentJobId: "parent_job_100",
            isBOMDeliveryJob: true,
          },
          idempotencyKey: "stranger_bom_key_1",
        })
      ).rejects.toThrow(ForbiddenError);

      // 2. Assigned trader CAN create BOM delivery and owner binds to parent homeowner
      const traderBomResult = await executeCreateJobCommand({
        db: mockDb,
        identity: traderIdentity,
        rawPayload: {
          ...validJobPayload,
          title: "BOM Delivery Courier by Trader",
          parentJobId: "parent_job_100",
          isBOMDeliveryJob: true,
        },
        idempotencyKey: "trader_bom_key_1",
      });
      expect(traderBomResult.jobId).toBeDefined();
      expect(traderBomResult.job.homeownerId).toBe(homeownerIdentity.uid);
      expect(traderBomResult.job.createdByUid).toBe(traderIdentity.uid);

      // 3. Parent homeowner CAN also create BOM delivery
      const homeownerBomResult = await executeCreateJobCommand({
        db: mockDb,
        identity: homeownerIdentity,
        rawPayload: {
          ...validJobPayload,
          title: "BOM Delivery Courier by Homeowner",
          parentJobId: "parent_job_100",
          isBOMDeliveryJob: true,
        },
        idempotencyKey: "homeowner_bom_key_1",
      });
      expect(homeownerBomResult.jobId).toBeDefined();
    });

    it("enforces persisted schedule authorization for recurring schedule derived jobs", async () => {
      const { mockDb, store } = createMockFirestore();

      // Seed recurring schedule owned by homeowner with trader
      store.set("recurring_schedules/sched_200", {
        id: "sched_200",
        homeownerId: homeownerIdentity.uid,
        tradespersonId: traderIdentity.uid,
        frequency: "monthly",
      });

      // 1. Unrelated stranger cannot trigger recurring job for this schedule
      await expect(
        executeCreateJobCommand({
          db: mockDb,
          identity: strangerIdentity,
          rawPayload: {
            ...validJobPayload,
            title: "Monthly Service Trigger",
            recurringScheduleId: "sched_200",
            isRecurringInstance: true,
          },
          idempotencyKey: "stranger_rec_key_1",
        })
      ).rejects.toThrow(ForbiddenError);

      // 2. Schedule trader CAN create recurring job instance
      const recResult = await executeCreateJobCommand({
        db: mockDb,
        identity: traderIdentity,
        rawPayload: {
          ...validJobPayload,
          title: "Monthly Boiler Check",
          recurringScheduleId: "sched_200",
          isRecurringInstance: true,
        },
        idempotencyKey: "trader_rec_key_1",
      });
      expect(recResult.jobId).toBeDefined();
      expect(recResult.job.homeownerId).toBe(homeownerIdentity.uid);
      expect(recResult.job.createdByUid).toBe(traderIdentity.uid);
    });
  });

  describe("4. Authoritative Creation, Persistent Idempotency, Projection & Real Concurrency", () => {
    function createMockFirestore() {
      const store = new Map<string, any>();
      let transactionQueue = Promise.resolve();

      const mockDb: any = {
        collection: (colName: string) => ({
          doc: (docId?: string) => {
            const id = docId || `doc_${Math.random().toString(36).substring(2, 9)}`;
            const path = `${colName}/${id}`;
            return {
              id,
              path,
              get: async () => ({
                exists: store.has(path),
                id,
                data: () => store.get(path),
              }),
              set: async (data: any, options?: any) => {
                if (options?.merge && store.has(path)) {
                  store.set(path, { ...store.get(path), ...data });
                } else {
                  store.set(path, data);
                }
              },
            };
          },
        }),
        runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
          return new Promise((resolve, reject) => {
            transactionQueue = transactionQueue.then(async () => {
              try {
                const transaction = {
                  get: async (ref: any) => ref.get(),
                  set: (ref: any, data: any, options?: any) => {
                    if (options?.merge && store.has(ref.path)) {
                      store.set(ref.path, { ...store.get(ref.path), ...data });
                    } else {
                      store.set(ref.path, data);
                    }
                  },
                };
                const result = await updateFunction(transaction);
                resolve(result);
              } catch (err) {
                reject(err);
              }
            });
          });
        },
      };

      return { mockDb, store };
    }

    it("requires a valid non-empty idempotencyKey (min 8 chars), rejecting invalid keys", async () => {
      const { mockDb } = createMockFirestore();

      await expect(
        executeCreateJobCommand({
          db: mockDb,
          identity: homeownerIdentity,
          rawPayload: validJobPayload,
          idempotencyKey: "",
        })
      ).rejects.toThrow(BadRequestError);

      await expect(
        executeCreateJobCommand({
          db: mockDb,
          identity: homeownerIdentity,
          rawPayload: validJobPayload,
          idempotencyKey: "short",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("creates job with server-owned ID, jobNo, timestamps, status='open' and binds owner strictly to identity.uid", async () => {
      const { mockDb, store } = createMockFirestore();
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");

      const result = await executeCreateJobCommand({
        db: mockDb,
        identity: homeownerIdentity,
        rawPayload: validJobPayload,
        idempotencyKey: "test_fresh_create_1234",
        quota: { enabled: true, limit: 5, periodKey: "2026-09", periodStart: "2026-09-01T00:00:00.000Z", isUnlimited: false, tierId: "consumer_standard" },
      });

      expect(result.wasReplayed).toBe(false);
      expect(result.jobId).toBeDefined();
      expect(result.job.homeownerId).toBe(homeownerIdentity.uid);
      expect(result.job.createdByUid).toBe(homeownerIdentity.uid);
      expect(result.job.status).toBe("open");
      expect(result.job.quoteCount).toBe(0);
      expect(result.job.jobNo).toMatch(/^JOB-\d{6}$/);

      // Verify public projection was created
      const publicCard = store.get(`public_job_cards/${result.jobId}`);
      expect(publicCard).toBeDefined();
      expect(publicCard.title).toBe(validJobPayload.title);
      expect(publicCard.category).toBe(validJobPayload.category);

      // Verify exactly one JOB_CREATED domain event was dispatched
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(
        "JOB_CREATED",
        result.jobId,
        homeownerIdentity.uid,
        expect.objectContaining({
          jobId: result.jobId,
          homeownerId: homeownerIdentity.uid,
          title: validJobPayload.title,
        }),
        undefined,
        mockDb
      );
    });

    it("replays idempotent requests returning the original job and does not emit a duplicate event", async () => {
      const { mockDb } = createMockFirestore();
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const idempotencyKey = "unique_idem_test_key_replay_1";

      // 1. Initial fresh job creation
      const firstResult = await executeCreateJobCommand({
        db: mockDb,
        identity: homeownerIdentity,
        rawPayload: validJobPayload,
        idempotencyKey,
        quota: { enabled: true, limit: 5, periodKey: "2026-09", periodStart: "2026-09-01T00:00:00.000Z", isUnlimited: false, tierId: "consumer_standard" },
      });
      expect(firstResult.wasReplayed).toBe(false);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // 2. Replay with identical idempotency key
      const secondResult = await executeCreateJobCommand({
        db: mockDb,
        identity: homeownerIdentity,
        rawPayload: validJobPayload,
        idempotencyKey,
        quota: { enabled: true, limit: 5, periodKey: "2026-09", periodStart: "2026-09-01T00:00:00.000Z", isUnlimited: false, tierId: "consumer_standard" },
      });

      expect(secondResult.wasReplayed).toBe(true);
      expect(secondResult.jobId).toBe(firstResult.jobId);
      // Domain event MUST NOT be dispatched a second time
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    it("enforces real transactional quota contention when two CreateJob commands race under quota=1", async () => {
      const { mockDb, store } = createMockFirestore();
      const strictQuota = { enabled: true, limit: 1, periodKey: "2026-09", periodStart: "2026-09-01T00:00:00.000Z", isUnlimited: false, tierId: "race_tier" };

      // Launch two commands concurrently with distinct idempotency keys
      const results = await Promise.allSettled([
        executeCreateJobCommand({
          db: mockDb,
          identity: homeownerIdentity,
          rawPayload: { ...validJobPayload, title: "Racing Job Alpha" },
          idempotencyKey: "race_key_alpha_123",
          quota: strictQuota,
        }),
        executeCreateJobCommand({
          db: mockDb,
          identity: homeownerIdentity,
          rawPayload: { ...validJobPayload, title: "Racing Job Beta" },
          idempotencyKey: "race_key_beta_456",
          quota: strictQuota,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly one must succeed and one must be rejected by quota limit
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify the quota document in store has count === 1
      const quotaDoc = store.get(`user_job_quotas/${homeownerIdentity.uid}_${strictQuota.periodKey}`);
      expect(quotaDoc).toBeDefined();
      expect(quotaDoc.count).toBe(1);
    });
  });
});
