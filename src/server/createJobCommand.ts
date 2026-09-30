/**
 * Server-Authoritative CreateJob Command for AnyTrader V2 (Task 2)
 *
 * Implements strict input schema validation, protected-field rejection,
 * authoritative identity binding, atomic transactional quota enforcement,
 * persistent idempotency, public card projection, and domain event dispatch.
 */

import { z } from "zod";
import crypto from "crypto";
import type admin from "firebase-admin";
import { BadRequestError, ForbiddenError } from "./httpErrors.ts";
import { CanonicalIdentity } from "./identity.ts";
import { validateJobTransition, JobStatus } from "./stateMachine.ts";
import { domainEvents } from "./domainEvents.ts";
import { sanitizeJobToPublicCard, isDirectJob } from "./projectionSync.ts";

/**
 * Server-owned & privileged fields that clients are strictly forbidden from supplying.
 * Supplying any of these keys results in an immediate BadRequestError rejection (OWASP API mass-assignment defense).
 */
export const JOB_CREATE_PROTECTED_KEYS = new Set([
  // Core server-owned identifiers & ownership
  "id",
  "jobId",
  "jobNo",
  "homeownerId",
  "userId",
  "posterId",
  "customerId",
  "ownerId",

  // Status, lifecycle & state-machine governed outcomes
  "status",
  "completed",
  "isCompleted",
  "payoutStatus",
  "quoteCount",
  "createdAt",
  "updatedAt",
  "postedDate",
  "fundingPaymentId",
  "escrowStatus",
  "platformFee",
  "amount",
  "payoutTransferred",
  "balance",
  "credits",
  "adSpendTotal",
  "quotes",
  "selectedQuoteId",
  "acceptedTradespersonId",
  "acceptedTraderId",
  "assignedTraderId",
  "disputeStatus",
  "refunded",
  "isRefunded",
  "funded",
  "isFunded",

  // Privilege, roles & badges
  "role",
  "isAdmin",
  "admin",
  "rating",
  "totalReviews",
  "reviewCount",
  "trustScore",
  "accountType",
  "capabilities",
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
  isEmergencyBoost: z.boolean().optional(),
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
  recurringScheduleId: z.string().optional().nullable(),
  preferredDate: z.string().optional().nullable(),
  requiredCertifications: z.array(z.string()).optional(),
  tenancyReference: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
  isInstantMatch: z.boolean().optional(),
  exclusiveUntil: z.any().optional(),
  isBoosted: z.boolean().optional(),
  boostTier: z.string().optional().nullable(),
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
  monthlyLimit: number;
  isUnlimited: boolean;
  tierId: string;
}

/**
 * Resolves job posting quota based on user profile and platform tier settings.
 */
export function resolveCreateJobQuota(
  profile?: Record<string, any> | null,
  platformConfig?: Record<string, any> | null,
  globalTiers?: Record<string, any>[] | null
): CreateJobQuotaConfig {
  if (platformConfig?.paywallEnabled === false) {
    return { monthlyLimit: Infinity, isUnlimited: true, tierId: "free" };
  }

  const isBusiness = profile?.subscriptionType === "business" || profile?.accountType === "business";
  const hasActiveSubscription = Boolean(profile?.subscriptionId && profile?.subscriptionStatus === "active");
  const tierId =
    profile?.tierId ||
    profile?.tier ||
    (isBusiness ? (hasActiveSubscription ? "business_pro" : "business_starter") : "consumer_standard");

  let monthlyLimit = isBusiness ? (hasActiveSubscription ? 50 : 10) : 5;

  if (globalTiers && Array.isArray(globalTiers)) {
    const matchedTier = globalTiers.find((t) => t.id === tierId || t.name === tierId);
    if (matchedTier && typeof matchedTier.monthlyJobLimit === "number") {
      monthlyLimit = matchedTier.monthlyJobLimit;
    }
  }

  return {
    monthlyLimit,
    isUnlimited: monthlyLimit === Infinity || monthlyLimit < 0,
    tierId,
  };
}

export interface ExecuteCreateJobCommandParams {
  db: admin.firestore.Firestore;
  identity: CanonicalIdentity;
  rawPayload: Record<string, any>;
  idempotencyKey?: string | null;
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
 * - Enforces atomic quota limit against concurrent creation races.
 * - Binds ownership to trusted identity.uid.
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

  // 1. Strict schema validation & protected key rejection
  const validatedInput = validateCreateJobInput(rawPayload);

  // 2. Authoritative identity binding
  const homeownerId = identity.uid;

  // 3. Emergency / Boost exemption detection
  const isEmergency =
    validatedInput.urgency === "emergency" ||
    validatedInput.isEmergency === true ||
    validatedInput.isEmergencyBoost === true;

  // 4. Initial state validation
  const initialStatus: JobStatus = "open";
  validateJobTransition("draft", initialStatus);

  // 5. Persistent Idempotency Setup
  let idempotencyRef: admin.firestore.DocumentReference | null = null;
  if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0) {
    const hash = crypto.createHash("sha256").update(`${homeownerId}:${idempotencyKey.trim()}`).digest("hex");
    idempotencyRef = db.collection("job_creation_idempotency").doc(hash);
  }

  // 6. Pre-generate server-authoritative Job ID and human-friendly Job Number
  const jobRef = db.collection("jobs").doc();
  const jobId = jobRef.id;
  const jobNo = `JOB-${Math.floor(100000 + Math.random() * 900000)}`;

  // 7. Atomic transaction for Idempotency + Quota + Job Write + Public Projection
  let transactionResult: {
    replayed: boolean;
    jobId: string;
    job: Record<string, any>;
  };

  transactionResult = await db.runTransaction(async (transaction) => {
    // A. Check Idempotency Record
    if (idempotencyRef) {
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
    }

    // B. Atomic Quota Enforcement
    if (!isEmergency && quota && !quota.isUnlimited) {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const quotaRef = db.collection("user_job_quotas").doc(`${homeownerId}_${monthKey}`);
      const quotaDoc = await transaction.get(quotaRef);

      let currentCount = 0;
      if (!quotaDoc.exists) {
        // Compute current count for this month from existing jobs
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const existingJobsSnap = await db
          .collection("jobs")
          .where("homeownerId", "==", homeownerId)
          .where("createdAt", ">=", monthStart)
          .get();
        currentCount = existingJobsSnap.size;
      } else {
        currentCount = quotaDoc.data()?.count || 0;
      }

      if (currentCount >= quota.monthlyLimit) {
        throw new ForbiddenError(
          `Monthly job posting quota of ${quota.monthlyLimit} reached for your tier (${quota.tierId}). Please upgrade your subscription to post more jobs.`
        );
      }

      // Increment quota count atomically in transaction
      transaction.set(
        quotaRef,
        {
          count: currentCount + 1,
          homeownerId,
          monthKey,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }

    // C. Construct authoritative server job document
    const nowIso = new Date().toISOString();
    const createdJobDocument: Record<string, any> = {
      ...validatedInput,
      id: jobId,
      jobNo,
      homeownerId,
      status: initialStatus,
      quoteCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      postedDate: nowIso,
    };

    // D. Persist Job document
    transaction.set(jobRef, createdJobDocument);

    // E. Persist Public Projection (for non-direct marketplace jobs)
    if (!isDirectJob(createdJobDocument)) {
      const publicCard = sanitizeJobToPublicCard(jobId, createdJobDocument);
      const publicCardRef = db.collection("public_job_cards").doc(jobId);
      transaction.set(publicCardRef, publicCard);
    }

    // F. Persist Idempotency Record
    if (idempotencyRef) {
      transaction.set(idempotencyRef, {
        jobId,
        homeownerId,
        idempotencyKey,
        createdAt: new Date(),
        jobData: {
          id: jobId,
          status: initialStatus,
        },
      });
    }

    return {
      replayed: false,
      jobId,
      job: createdJobDocument,
    };
  });

  // 8. Dispatch Domain Event outside transaction (only on fresh creation, not on replay)
  if (!transactionResult.replayed) {
    try {
      await domainEvents.dispatch(
        "JOB_CREATED",
        transactionResult.jobId,
        homeownerId,
        {
          jobId: transactionResult.jobId,
          jobNo,
          homeownerId,
          category: validatedInput.category,
          title: validatedInput.title,
          urgency: validatedInput.urgency,
          isEmergency,
        }
      );
    } catch (eventErr) {
      console.warn(`[DomainEvent Warning] Failed to dispatch JOB_CREATED for job ${jobId}:`, eventErr);
    }
  }

  return {
    jobId: transactionResult.jobId,
    job: transactionResult.job,
    wasReplayed: transactionResult.replayed,
  };
}
