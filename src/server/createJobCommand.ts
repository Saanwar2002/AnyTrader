/**
 * Server-Authoritative CreateJob Command for AnyTrader V2 (Task 2)
 *
 * Implements strict input schema validation, protected-field rejection inheriting
 * Task 1's SERVER_OWNED_PROTECTED_KEYS, authoritative capability & persisted-record
 * authorization, atomic transactional quota enforcement, persistent idempotency,
 * public card projection, and domain event dispatch.
 */

import { z } from "zod";
import crypto from "crypto";
import type admin from "firebase-admin";
import { BadRequestError, ForbiddenError, NotFoundError } from "./httpErrors.ts";
import { CanonicalIdentity, requireCapability, hasCapability } from "./identity.ts";
import { SERVER_OWNED_PROTECTED_KEYS } from "./authorization.ts";
import { validateJobTransition, JobStatus } from "./stateMachine.ts";
import { domainEvents } from "./domainEvents.ts";
import { sanitizeJobToPublicCard, isDirectJob } from "./projectionSync.ts";

/**
 * Server-owned & privileged fields that clients are strictly forbidden from supplying.
 * Inherits Task 1's SERVER_OWNED_PROTECTED_KEYS and augments with job-creation specific protected keys.
 * Supplying any of these keys results in an immediate BadRequestError rejection (OWASP API mass-assignment defense).
 */
export const JOB_CREATE_PROTECTED_KEYS = new Set([
  ...SERVER_OWNED_PROTECTED_KEYS,
  "id",
  "jobNo",
  "createdByUid",
  "postedDate",
  "exclusiveUntil",
  "quoteCount",
  "quotesCount",
  "clientDeleted",
  "viewsCount",
  "retryCount",
  "hasReview",
  "isBoosted",
  "isEmergencyBoost",
  "boostTier",
  "boostExpiresAt",
]);

/**
 * Strict Zod schema for CreateJob client payload.
 * Any unrecognized or smuggled attributes are rejected via .strict().
 */
export const JOB_CREATE_INPUT_SCHEMA = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().min(5, "Description must be at least 5 characters").max(10000),
  category: z.string().min(1, "Category is required"),
  subCategory: z.string().optional().nullable(),
  subcategories: z.array(z.string()).optional(),
  postcode: z.string().min(2, "Postcode is required").max(12),
  postcodeArea: z.string().optional(),
  urgency: z.enum(["emergency", "urgent", "standard", "flexible"]).default("standard"),
  isEmergency: z.boolean().optional(),
  budget: z.union([z.number(), z.string(), z.record(z.any())]).optional().nullable(),
  estimateMin: z.number().optional().nullable(),
  estimateMax: z.number().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  propertyPassportId: z.string().optional().nullable(),
  location: z.record(z.any()).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  photos: z.array(z.string()).optional(),
  photosCount: z.number().optional(),
  videosCount: z.number().optional(),
  documentsCount: z.number().optional(),
  voiceNoteUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  directTraderId: z.string().optional().nullable(),
  targetTraderId: z.string().optional().nullable(),
  isDirectQuote: z.boolean().optional(),
  bomOrderId: z.string().optional().nullable(),
  parentJobId: z.string().optional().nullable(),
  isBOMDeliveryJob: z.boolean().optional(),
  recurringScheduleId: z.string().optional().nullable(),
  isRecurringInstance: z.boolean().optional(),
  preferredDate: z.string().optional().nullable(),
  requiredCertifications: z.array(z.string()).optional(),
  tenancyReference: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
  isInstantMatch: z.boolean().optional(),
}).strict();

export type CreateJobInput = z.infer<typeof JOB_CREATE_INPUT_SCHEMA>;

/**
 * Validates raw client input for job creation:
 * 1. Rejects payload if any protected/server-owned keys are present.
 * 2. Parses against strict Zod schema, rejecting unknown attributes.
 */
export function validateCreateJobInput(payload: unknown): CreateJobInput {
  if (!payload || typeof payload !== "object") {
    throw new BadRequestError("Job creation payload must be a non-empty object.");
  }

  const raw = payload as Record<string, any>;
  const suppliedProtectedKeys = Object.keys(raw).filter((key) => JOB_CREATE_PROTECTED_KEYS.has(key));

  if (suppliedProtectedKeys.length > 0) {
    throw new BadRequestError(
      `Protected server-owned fields cannot be supplied in job creation request: ${suppliedProtectedKeys.join(", ")}`
    );
  }

  const result = JOB_CREATE_INPUT_SCHEMA.safeParse(raw);
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join(".") || "field"}: ${e.message}`).join("; ");
    throw new BadRequestError(`Invalid job creation input schema: ${errorDetails}`);
  }

  return result.data;
}

export interface CreateJobQuotaConfig {
  enabled: boolean;
  limit: number;
  periodKey: string;
  periodStart: string;
  tierId: string;
  isUnlimited: boolean;
  monthlyLimit?: number;
}

/**
 * Resolves job posting quota based on user profile and platform tier settings.
 * Supports nested global_tiers.providerModels.[model].tiers.[tierId] structure with monthly/lifetime period semantics.
 */
export function resolveCreateJobQuota(
  profile?: Record<string, any> | null,
  platformConfig?: Record<string, any> | null,
  globalTiersConfig?: Record<string, any> | null
): CreateJobQuotaConfig {
  const now = new Date();
  const utcMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const utcMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  if (platformConfig?.paywallEnabled === false) {
    return {
      enabled: false,
      limit: Infinity,
      periodKey: utcMonthKey,
      periodStart: utcMonthStart,
      tierId: "free",
      isUnlimited: true,
      monthlyLimit: Infinity,
    };
  }

  const isBusiness = profile?.subscriptionType === "business" || profile?.accountType === "business";
  const hasActiveSubscription = Boolean(profile?.subscriptionId && profile?.subscriptionStatus === "active");
  const tierId =
    profile?.tierId ||
    profile?.tier ||
    (isBusiness ? (hasActiveSubscription ? "business_pro" : "business_starter") : "consumer_standard");

  let limit = isBusiness ? (hasActiveSubscription ? 50 : 10) : 5;
  let limitPeriod = "monthly";

  // Check structured global_tiers configuration
  if (globalTiersConfig) {
    let matchedTierConfig: any = null;

    if (globalTiersConfig.providerModels) {
      for (const model of Object.values(globalTiersConfig.providerModels) as any[]) {
        if (model?.tiers && model.tiers[tierId]) {
          matchedTierConfig = model.tiers[tierId];
          break;
        }
      }
    }

    if (!matchedTierConfig && globalTiersConfig.tiers) {
      if (Array.isArray(globalTiersConfig.tiers)) {
        matchedTierConfig = globalTiersConfig.tiers.find((t: any) => t.id === tierId || t.name === tierId);
      } else if (typeof globalTiersConfig.tiers === "object") {
        matchedTierConfig = globalTiersConfig.tiers[tierId];
      }
    }

    if (matchedTierConfig) {
      if (typeof matchedTierConfig.jobPostsLimit === "number") {
        limit = matchedTierConfig.jobPostsLimit;
      } else if (typeof matchedTierConfig.monthlyJobLimit === "number") {
        limit = matchedTierConfig.monthlyJobLimit;
      }

      if (typeof matchedTierConfig.limitPeriod === "string") {
        limitPeriod = matchedTierConfig.limitPeriod;
      }
    }
  }

  const isLifetime = limitPeriod === "lifetime";
  const periodKey = isLifetime ? "lifetime" : utcMonthKey;
  const periodStart = isLifetime ? new Date(0).toISOString() : utcMonthStart;
  const isUnlimited = limit === Infinity || limit < 0;

  return {
    enabled: true,
    limit,
    periodKey,
    periodStart,
    tierId,
    isUnlimited,
    monthlyLimit: isUnlimited ? Infinity : limit,
  };
}

export interface ExecuteCreateJobCommandParams {
  db: admin.firestore.Firestore;
  identity: CanonicalIdentity;
  rawPayload: Record<string, any>;
  idempotencyKey: string;
  quota?: CreateJobQuotaConfig;
}

export interface ExecuteCreateJobCommandResult {
  jobId: string;
  job: Record<string, any>;
  wasReplayed: boolean;
}

/**
 * Server-authoritative CreateJob Command executor.
 *
 * Runs inside a Firestore transaction:
 * - Checks and commits persistent idempotency record.
 * - Enforces standard-job homeowner capability requirement or derived-job record authorization.
 * - Enforces atomic quota limit against concurrent creation races.
 * - Binds ownership to trusted homeowner / derived parent owner identity.
 * - Writes server-owned ID, job number, initial status, and server timestamps.
 * - Creates sanitized public card projection.
 * - Emits JOB_CREATED domain event post-transaction.
 */
export async function executeCreateJobCommand(
  params: ExecuteCreateJobCommandParams
): Promise<ExecuteCreateJobCommandResult> {
  const { db, identity, rawPayload, idempotencyKey, quota } = params;

  if (!db) {
    throw new BadRequestError("Database service is not initialized.");
  }

  // 1. Mandatory Persistent Idempotency Key Validation
  const normalizedIdempotencyKey = idempotencyKey ? idempotencyKey.trim() : "";
  if (normalizedIdempotencyKey.length < 8 || normalizedIdempotencyKey.length > 200) {
    throw new BadRequestError("A valid idempotency key is required for job creation.");
  }

  // 2. Strict schema validation & protected key rejection
  const validatedInput = validateCreateJobInput(rawPayload);

  // 3. Derived-job / system-job path evaluation & emergency detection
  const isDerivedSystemJob = Boolean(validatedInput.isBOMDeliveryJob || validatedInput.isRecurringInstance);
  const isEmergency = validatedInput.urgency === "emergency" || validatedInput.isEmergency === true;

  // 4. Standard Job Authorization: Ordinary jobs require 'homeowner' capability
  if (!isDerivedSystemJob) {
    requireCapability(identity, "homeowner");
  }

  // 5. Initial state validation
  const initialStatus: JobStatus = "open";
  validateJobTransition("draft", initialStatus);

  // 6. Pre-generate server-authoritative Job ID and human-friendly Job Number
  const jobRef = db.collection("jobs").doc();
  const jobId = jobRef.id;
  const jobNo = `JOB-${Math.floor(100000 + Math.random() * 900000)}`;

  // 7. Compute persistent idempotency hash
  const hash = crypto.createHash("sha256").update(`${identity.uid}:${normalizedIdempotencyKey}`).digest("hex");
  const idempotencyRef = db.collection("job_creation_idempotency").doc(hash);

  // 8. Atomic transaction for Authorization + Idempotency + Quota + Job Write + Public Projection
  let transactionResult: {
    replayed: boolean;
    jobId: string;
    job: Record<string, any>;
  };

  transactionResult = await db.runTransaction(async (transaction) => {
    // A. Check Idempotency Record
    const existingIdempotency = await transaction.get(idempotencyRef);
    if (existingIdempotency.exists) {
      const recorded = existingIdempotency.data();
      if (recorded?.jobId) {
        const recordedJobSnap = await transaction.get(db.collection("jobs").doc(recorded.jobId));
        if (recordedJobSnap.exists) {
          return {
            replayed: true,
            jobId: recorded.jobId,
            job: recordedJobSnap.data() || { id: recorded.jobId, status: initialStatus },
          };
        }
      }
    }

    // B. Derived Job Persisted-Record Authorization
    let targetHomeownerId = identity.uid;

    if (validatedInput.isBOMDeliveryJob) {
      if (!validatedInput.parentJobId) {
        throw new BadRequestError("parentJobId is required for BOM delivery job creation.");
      }
      const parentRef = db.collection("jobs").doc(validatedInput.parentJobId);
      const parentSnap = await transaction.get(parentRef);
      if (!parentSnap.exists) {
        throw new NotFoundError(`Parent job ${validatedInput.parentJobId} not found.`);
      }
      const parentData = parentSnap.data() || {};
      const parentHomeownerId = parentData.homeownerId || parentData.userId;
      const parentTraderId =
        parentData.acceptedTraderId ||
        parentData.acceptedTradespersonId ||
        parentData.tradespersonId ||
        parentData.assignedTraderId;

      const isAuthorized =
        identity.accountType === "admin" ||
        identity.uid === parentHomeownerId ||
        identity.uid === parentTraderId;

      if (!isAuthorized) {
        throw new ForbiddenError("Not authorized to create BOM delivery job for this parent job.");
      }
      targetHomeownerId = parentHomeownerId || identity.uid;
    } else if (validatedInput.isRecurringInstance) {
      if (!validatedInput.recurringScheduleId) {
        throw new BadRequestError("recurringScheduleId is required for recurring job creation.");
      }
      const scheduleRef = db.collection("recurring_schedules").doc(validatedInput.recurringScheduleId);
      const scheduleSnap = await transaction.get(scheduleRef);
      if (!scheduleSnap.exists) {
        throw new NotFoundError(`Recurring schedule ${validatedInput.recurringScheduleId} not found.`);
      }
      const scheduleData = scheduleSnap.data() || {};
      const scheduleHomeownerId = scheduleData.homeownerId || scheduleData.userId;
      const scheduleTraderId = scheduleData.tradespersonId || scheduleData.traderId;

      const isAuthorized =
        identity.accountType === "admin" ||
        identity.uid === scheduleHomeownerId ||
        identity.uid === scheduleTraderId;

      if (!isAuthorized) {
        throw new ForbiddenError("Not authorized to create job instance for this recurring schedule.");
      }
      targetHomeownerId = scheduleHomeownerId || identity.uid;
    }

    // C. Atomic Quota Enforcement (Skipped for emergencies and derived system jobs)
    if (!isEmergency && !isDerivedSystemJob && quota && quota.enabled && !quota.isUnlimited) {
      const quotaRef = db.collection("user_job_quotas").doc(`${identity.uid}_${quota.periodKey}`);
      const quotaSnap = await transaction.get(quotaRef);
      let currentCount = 0;
      if (quotaSnap.exists) {
        currentCount = Number(quotaSnap.data()?.count || 0);
      }
      if (currentCount >= quota.limit) {
        throw new ForbiddenError(
          `Job posting quota exceeded. Current: ${currentCount}, Limit: ${quota.limit} (${quota.periodKey})`
        );
      }
      transaction.set(
        quotaRef,
        {
          uid: identity.uid,
          periodKey: quota.periodKey,
          periodStart: quota.periodStart,
          count: currentCount + 1,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    // D. Persist Idempotency Record Transactionally
    transaction.set(idempotencyRef, {
      idempotencyKey: normalizedIdempotencyKey,
      uid: identity.uid,
      jobId,
      createdAt: new Date().toISOString(),
    });

    // E. Assemble Server-Owned Job Record
    const nowIso = new Date().toISOString();
    const jobDocData: Record<string, any> = {
      ...validatedInput,
      id: jobId,
      jobNo,
      homeownerId: targetHomeownerId,
      createdByUid: identity.uid,
      status: initialStatus,
      quoteCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      postedDate: nowIso,
    };

    transaction.set(jobRef, jobDocData);

    // F. Create Public Card Projection Atomically for Standard/Broadcast Jobs
    if (!isDirectJob(jobDocData)) {
      const publicCardRef = db.collection("public_job_cards").doc(jobId);
      const publicCardData = sanitizeJobToPublicCard(jobId, jobDocData);
      transaction.set(publicCardRef, publicCardData);
    }

    return {
      replayed: false,
      jobId,
      job: jobDocData,
    };
  });

  // 9. Dispatch JOB_CREATED domain event post-commit (if freshly created)
  if (!transactionResult.replayed) {
    try {
      await domainEvents.dispatch(
        "JOB_CREATED",
        transactionResult.jobId,
        identity.uid,
        {
          jobId: transactionResult.jobId,
          homeownerId: transactionResult.job.homeownerId,
          title: transactionResult.job.title,
          category: transactionResult.job.category,
          urgency: transactionResult.job.urgency,
          isEmergency,
          isDerivedSystemJob,
        },
        undefined,
        db
      );
    } catch (eventErr) {
      console.error("[DomainEvents] Failed to dispatch JOB_CREATED event:", eventErr);
    }
  }

  return {
    jobId: transactionResult.jobId,
    job: transactionResult.job,
    wasReplayed: transactionResult.replayed,
  };
}
