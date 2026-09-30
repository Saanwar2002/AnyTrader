import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  JOB_CREATE_PROTECTED_KEYS,
  JOB_CREATE_INPUT_SCHEMA,
  validateCreateJobInput,
  resolveCreateJobQuota,
  executeCreateJobCommand,
} from "../../src/server/createJobCommand.ts";
import { BadRequestError, ForbiddenError } from "../../src/server/httpErrors.ts";
import { CanonicalIdentity } from "../../src/server/identity.ts";
import { domainEvents } from "../../src/server/domainEvents.ts";

describe("Task 2: Canonical CreateJob Command Test Suite", () => {
  const dummyIdentity: CanonicalIdentity = {
    uid: "test_homeowner_123",
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
      const protectedKeysToTest = ["status", "homeownerId", "id", "jobNo", "completed", "payoutStatus", "quoteCount"];

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

  describe("2. Deterministic Quota Resolution", () => {
    it("returns unlimited quota when paywall is disabled", () => {
      const quota = resolveCreateJobQuota({}, { paywallEnabled: false });
      expect(quota.isUnlimited).toBe(true);
      expect(quota.monthlyLimit).toBe(Infinity);
    });

    it("resolves default consumer quota (5 jobs) when no active subscription", () => {
      const quota = resolveCreateJobQuota({ accountType: "consumer" }, { paywallEnabled: true });
      expect(quota.isUnlimited).toBe(false);
      expect(quota.monthlyLimit).toBe(5);
    });

    it("resolves business tier quotas correctly", () => {
      const starterBusinessQuota = resolveCreateJobQuota(
        { subscriptionType: "business", subscriptionStatus: "inactive" },
        { paywallEnabled: true }
      );
      expect(starterBusinessQuota.monthlyLimit).toBe(10);

      const proBusinessQuota = resolveCreateJobQuota(
        { subscriptionType: "business", subscriptionId: "sub_123", subscriptionStatus: "active" },
        { paywallEnabled: true }
      );
      expect(proBusinessQuota.monthlyLimit).toBe(50);
    });
  });

  describe("3. Authoritative Creation, Ownership Binding, Projection & Domain Event", () => {
    function createMockFirestore() {
      const store = new Map<string, any>();

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
          where: () => ({
            where: () => ({
              get: async () => ({ size: 0, docs: [] }),
            }),
            get: async () => ({ size: 0, docs: [] }),
          }),
        }),
        runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
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
          return updateFunction(transaction);
        },
      };

      return { mockDb, store };
    }

    it("creates job with server-owned ID, jobNo, timestamps, status='open' and binds owner strictly to identity.uid", async () => {
      const { mockDb, store } = createMockFirestore();
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");

      const result = await executeCreateJobCommand({
        db: mockDb,
        identity: dummyIdentity,
        rawPayload: validJobPayload,
        quota: { monthlyLimit: 5, isUnlimited: false, tierId: "consumer_standard" },
      });

      expect(result.wasReplayed).toBe(false);
      expect(result.jobId).toBeDefined();
      expect(result.job.homeownerId).toBe(dummyIdentity.uid);
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
        dummyIdentity.uid,
        expect.objectContaining({
          jobId: result.jobId,
          homeownerId: dummyIdentity.uid,
          title: validJobPayload.title,
        })
      );
    });

    it("replays idempotent requests returning the original job and does not emit a duplicate event", async () => {
      const { mockDb } = createMockFirestore();
      const dispatchSpy = vi.spyOn(domainEvents, "dispatch");
      const idempotencyKey = "unique_idem_test_key_1";

      // 1. Initial fresh job creation
      const firstResult = await executeCreateJobCommand({
        db: mockDb,
        identity: dummyIdentity,
        rawPayload: validJobPayload,
        idempotencyKey,
        quota: { monthlyLimit: 5, isUnlimited: false, tierId: "consumer_standard" },
      });
      expect(firstResult.wasReplayed).toBe(false);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // 2. Replay with identical idempotency key
      const secondResult = await executeCreateJobCommand({
        db: mockDb,
        identity: dummyIdentity,
        rawPayload: validJobPayload,
        idempotencyKey,
        quota: { monthlyLimit: 5, isUnlimited: false, tierId: "consumer_standard" },
      });

      expect(secondResult.wasReplayed).toBe(true);
      expect(secondResult.jobId).toBe(firstResult.jobId);
      // Domain event MUST NOT be dispatched a second time
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    it("enforces atomic quota in transaction, rejecting creation when quota is reached", async () => {
      const { mockDb } = createMockFirestore();

      // Set a strict quota of 1 job
      const strictQuota = { monthlyLimit: 1, isUnlimited: false, tierId: "test_strict_tier" };

      // Job 1 should succeed
      const firstResult = await executeCreateJobCommand({
        db: mockDb,
        identity: dummyIdentity,
        rawPayload: validJobPayload,
        quota: strictQuota,
      });
      expect(firstResult.jobId).toBeDefined();

      // Job 2 should throw ForbiddenError due to quota limit of 1 reached
      await expect(
        executeCreateJobCommand({
          db: mockDb,
          identity: dummyIdentity,
          rawPayload: { ...validJobPayload, title: "Second job attempt" },
          quota: strictQuota,
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
