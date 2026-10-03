/**
 * Server-Authoritative Canonical Job Lifecycle Commands for AnyTrader V2 (Task 5)
 *
 * Implements strict input validation, mass-assignment defense, authoritative
 * identity binding, multi-role object-level authorization, formal state machine
 * lifecycle validation, persistent transactional idempotency, atomic job status
 * transitions, public projection sync, and domain event dispatch across:
 * 1. StartJob
 * 2. CompleteJob
 * 3. CancelJob
 * 4. RaiseJobDispute
 */

import { z } from "zod";
import type admin from "firebase-admin";
import { BadRequestError, ForbiddenError, NotFoundError, ConflictError } from "./httpErrors.ts";
import { CanonicalIdentity, hasCapability } from "./identity.ts";
import { SERVER_OWNED_PROTECTED_KEYS } from "./authorization.ts";
import { validateJobTransition, JobStatus } from "./stateMachine.ts";
import { domainEvents } from "./domainEvents.ts";

/**
 * Server-owned & privileged fields that clients are strictly forbidden from supplying
 * in any job lifecycle command payload. Attempts to supply any of these keys trigger an immediate
 * BadRequestError (OWASP API Mass Assignment Defense).
 */
export const JOB_LIFECYCLE_PROTECTED_KEYS = new Set([
  ...SERVER_OWNED_PROTECTED_KEYS,
  "id",
  "status",
  "startedAt",
  "completedAt",
  "cancelledAt",
  "disputedAt",
  "updatedAt",
  "createdAt",
  "acceptedTradespersonId",
  "acceptedTraderId",
  "acceptedQuoteId",
  "tradespersonId",
  "traderId",
  "homeownerId",
  "userId",
  "ownerId",
  "posterId",
  "customerId",
  "paymentStatus",
  "payoutStatus",
  "payoutTransferred",
  "amount",
  "platformFee",
  "escrowStatus",
  "escrowBalance",
  "stripeCustomerId",
  "stripeAccountId",
  "rating",
  "trustScore",
  "isVerified",
  "verified",
  "role",
  "isAdmin",
]);

export type JobLifecycleCommandType = "StartJob" | "CompleteJob" | "CancelJob" | "RaiseJobDispute";

export const START_JOB_SCHEMA = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  verificationPin: z.string().optional().nullable(),
  pin: z.string().optional().nullable(),
  expectedStatus: z.string().optional(),
});

export const COMPLETE_JOB_SCHEMA = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  completionNotes: z.string().max(2000).optional(),
  expectedStatus: z.string().optional(),
});

export const CANCEL_JOB_SCHEMA = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  reason: z.string().max(1000).optional(),
  cancellationReason: z.string().max(1000).optional(),
  expectedStatus: z.string().optional(),
});

export const DISPUTE_JOB_SCHEMA = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  reason: z.string().max(2000).optional(),
  disputeReason: z.string().max(2000).optional(),
  technicalFaultReport: z.string().max(2000).optional(),
  expectedStatus: z.string().optional(),
});

export interface JobLifecycleCommandRequest {
  type: JobLifecycleCommandType;
  payload: Record<string, any>;
}

export interface ExecuteJobLifecycleCommandOptions {
  db: any;
  identity: CanonicalIdentity;
  command: JobLifecycleCommandRequest;
  idempotencyKey: string;
}

export interface JobLifecycleCommandResult {
  success: boolean;
  commandType: JobLifecycleCommandType;
  jobId: string;
  status: string;
  job?: Record<string, any>;
  wasReplayed?: boolean;
}

/**
 * Validates raw payload against protected key prohibition.
 */
function assertNoJobLifecycleProtectedKeys(payload: Record<string, any>): void {
  if (!payload || typeof payload !== "object") return;
  for (const key of Object.keys(payload)) {
    if (JOB_LIFECYCLE_PROTECTED_KEYS.has(key)) {
      throw new BadRequestError(`Supplying server-owned or privileged key '${key}' in lifecycle payload is strictly forbidden.`);
    }
  }
}

/**
 * Server-Authoritative Job Lifecycle Command Executor
 * Executes atomic Firestore transactions guaranteeing state machine validity,
 * authorization checks, persistent idempotency, and domain event emissions.
 */
export async function executeJobLifecycleCommand(
  options: ExecuteJobLifecycleCommandOptions
): Promise<JobLifecycleCommandResult> {
  const { db, identity, command, idempotencyKey } = options;

  if (!db) {
    throw new BadRequestError("Database service is not initialized");
  }
  if (!identity || !identity.uid) {
    throw new ForbiddenError("Authenticated canonical identity is required to perform job lifecycle actions.");
  }
  if (!command || !command.type) {
    throw new BadRequestError("Job lifecycle command 'type' is required.");
  }

  const rawIdempotencyKey = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
  if (!rawIdempotencyKey || rawIdempotencyKey.length < 8 || rawIdempotencyKey.length > 200) {
    throw new BadRequestError("Idempotency key is required and must be between 8 and 200 characters.");
  }

  const commandType = command.type;
  const rawPayload = command.payload || {};

  // Mass-assignment / protected field defense
  assertNoJobLifecycleProtectedKeys(rawPayload);

  let validatedJobId = "";
  if (commandType === "StartJob") {
    const parsed = START_JOB_SCHEMA.safeParse(rawPayload);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors.map(e => e.message).join("; "));
    }
    validatedJobId = parsed.data.jobId;
  } else if (commandType === "CompleteJob") {
    const parsed = COMPLETE_JOB_SCHEMA.safeParse(rawPayload);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors.map(e => e.message).join("; "));
    }
    validatedJobId = parsed.data.jobId;
  } else if (commandType === "CancelJob") {
    const parsed = CANCEL_JOB_SCHEMA.safeParse(rawPayload);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors.map(e => e.message).join("; "));
    }
    validatedJobId = parsed.data.jobId;
  } else if (commandType === "RaiseJobDispute") {
    const parsed = DISPUTE_JOB_SCHEMA.safeParse(rawPayload);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors.map(e => e.message).join("; "));
    }
    validatedJobId = parsed.data.jobId;
  } else {
    throw new BadRequestError(`Unsupported job lifecycle command type '${commandType}'.`);
  }

  const jobId = validatedJobId;
  const idempotencyRef = db.collection("idempotency_keys").doc(rawIdempotencyKey);
  const nowIso = new Date().toISOString();

  // Execute atomic Firestore transaction
  const transactionResult = await db.runTransaction(async (transaction: any) => {
    // 1. Idempotency Check
    const idempSnap = await transaction.get(idempotencyRef);
    if (idempSnap.exists) {
      const idempData = idempSnap.data() || {};
      if (idempData.status === "completed" && idempData.response) {
        return {
          ...idempData.response,
          wasReplayed: true,
        };
      }
    }

    // 2. Load Job Record
    const jobRef = db.collection("jobs").doc(jobId);
    const jobSnap = await transaction.get(jobRef);

    if (!jobSnap.exists) {
      throw new NotFoundError(`Job with ID '${jobId}' was not found.`);
    }

    const jobData = jobSnap.data() || {};
    const currentStatus: JobStatus = (jobData.status as JobStatus) || "open";

    // Concurrency Expected-Status Check
    if (rawPayload.expectedStatus && currentStatus !== rawPayload.expectedStatus) {
      throw new ConflictError(
        `Job status '${currentStatus}' does not match expected status '${rawPayload.expectedStatus}'.`
      );
    }

    // Same-state transition different-key defense
    if (commandType === "StartJob" && currentStatus === "in_progress") {
      throw new ConflictError("Job has already been started by another request");
    }
    if (commandType === "CompleteJob" && currentStatus === "completed") {
      throw new ConflictError("Job has already been completed");
    }
    if (commandType === "CancelJob" && currentStatus === "cancelled") {
      throw new ConflictError("Job has already been cancelled");
    }
    if (commandType === "RaiseJobDispute" && currentStatus === "disputed") {
      throw new ConflictError("Job has already been disputed");
    }

    const publicCardRef = db.collection("public_job_cards").doc(jobId);
    const publicCardSnap = await transaction.get(publicCardRef);

    const isAdmin = identity.accountType === "admin" || (identity as any).isAdmin === true;
    const isHomeowner = identity.uid === (jobData.homeownerId || jobData.userId || jobData.ownerId);
    const isAcceptedTrader =
      identity.uid === (jobData.acceptedTradespersonId || jobData.acceptedTraderId || jobData.tradespersonId || jobData.traderId);

    let targetStatus: JobStatus;
    let updateData: Record<string, any> = {};

    switch (commandType) {
      case "StartJob": {
        if (!isAcceptedTrader && !isAdmin) {
          throw new ForbiddenError("Only the assigned tradesperson can start this job.");
        }

        targetStatus = "in_progress";
        validateJobTransition(currentStatus, targetStatus);

        // Verification PIN check if required on job
        if (jobData.verificationPin && jobData.verificationPin.toString().trim() !== "") {
          const suppliedPin = (rawPayload.verificationPin || rawPayload.pin || "").toString().trim();
          if (!suppliedPin || (suppliedPin !== jobData.verificationPin.toString().trim() && !isAdmin)) {
            throw new BadRequestError("Invalid or missing verification PIN.");
          }
        }

        updateData = {
          status: targetStatus,
          startedAt: nowIso,
          isConfirmedByTradesperson: true,
          updatedAt: nowIso,
        };
        break;
      }

      case "CompleteJob": {
        if (!isHomeowner && !isAcceptedTrader && !isAdmin) {
          throw new ForbiddenError("You are not an authorized participant on this job.");
        }

        targetStatus = "completed";
        validateJobTransition(currentStatus, targetStatus);

        updateData = {
          status: targetStatus,
          completedAt: nowIso,
          updatedAt: nowIso,
        };
        if (rawPayload.completionNotes) {
          updateData.completionNotes = String(rawPayload.completionNotes).substring(0, 2000);
        }
        break;
      }

      case "CancelJob": {
        if (!isHomeowner && !isAcceptedTrader && !isAdmin) {
          throw new ForbiddenError("You are not authorized to cancel this job.");
        }

        targetStatus = "cancelled";
        validateJobTransition(currentStatus, targetStatus);

        const cancellationReason = (rawPayload.reason || rawPayload.cancellationReason || "Cancelled by user").toString().substring(0, 500);

        updateData = {
          status: targetStatus,
          cancelledAt: nowIso,
          cancellationReason,
          updatedAt: nowIso,
        };
        break;
      }

      case "RaiseJobDispute": {
        if (!isHomeowner && !isAcceptedTrader && !isAdmin) {
          throw new ForbiddenError("You are not authorized to raise a dispute on this job.");
        }

        targetStatus = "disputed";
        validateJobTransition(currentStatus, targetStatus);

        const disputeReason = (rawPayload.reason || rawPayload.disputeReason || "Dispute raised by participant").toString().substring(0, 1000);

        updateData = {
          status: targetStatus,
          disputedAt: nowIso,
          disputeReason,
          dispute: {
            status: "opened",
            raisedBy: identity.uid,
            reason: disputeReason,
            createdAt: nowIso,
          },
          updatedAt: nowIso,
        };
        break;
      }
    }

    // 3. Atomic Write: Update Job Record
    transaction.update(jobRef, updateData);

    // 4. Atomic Write: Update Public Job Card (if exists)
    if (publicCardSnap.exists) {
      transaction.update(publicCardRef, {
        status: targetStatus,
        updatedAt: nowIso,
      });
    }

    const commandResponse: JobLifecycleCommandResult = {
      success: true,
      commandType,
      jobId,
      status: targetStatus,
      job: {
        ...jobData,
        ...updateData,
      },
      wasReplayed: false,
    };

    // 5. Store Persistent Idempotency Record
    transaction.set(idempotencyRef, {
      idempotencyKey: rawIdempotencyKey,
      commandType,
      jobId,
      status: "completed",
      response: commandResponse,
      actorUid: identity.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    return commandResponse;
  });

  // 6. Post-Transaction Domain Event Dispatch
  if (!transactionResult.wasReplayed) {
    const eventTypeMap: Record<JobLifecycleCommandType, any> = {
      StartJob: "JOB_STARTED",
      CompleteJob: "JOB_COMPLETED",
      CancelJob: "JOB_CANCELLED",
      RaiseJobDispute: "JOB_DISPUTED",
    };

    await domainEvents.dispatch(
      eventTypeMap[commandType],
      jobId,
      identity.uid,
      {
        jobId,
        status: transactionResult.status,
        actorId: identity.uid,
        timestamp: nowIso,
        reason: transactionResult.job?.cancellationReason || transactionResult.job?.disputeReason || null,
      },
      rawIdempotencyKey,
      db
    );
  }

  return transactionResult;
}

export async function startJobViaCommand(options: {
  db: any;
  identity: CanonicalIdentity;
  jobId: string;
  verificationPin?: string;
  expectedStatus?: string;
  idempotencyKey?: string;
}): Promise<JobLifecycleCommandResult> {
  const { db, identity, jobId, verificationPin, expectedStatus, idempotencyKey } = options;
  return executeJobLifecycleCommand({
    db,
    identity,
    command: {
      type: "StartJob",
      payload: { jobId, verificationPin, expectedStatus },
    },
    idempotencyKey: idempotencyKey || `start_${jobId}_${identity.uid}`,
  });
}

export async function completeJobViaCommand(options: {
  db: any;
  identity: CanonicalIdentity;
  jobId: string;
  completionNotes?: string;
  expectedStatus?: string;
  idempotencyKey?: string;
}): Promise<JobLifecycleCommandResult> {
  const { db, identity, jobId, completionNotes, expectedStatus, idempotencyKey } = options;
  return executeJobLifecycleCommand({
    db,
    identity,
    command: {
      type: "CompleteJob",
      payload: { jobId, completionNotes, expectedStatus },
    },
    idempotencyKey: idempotencyKey || `complete_${jobId}_${identity.uid}`,
  });
}

export async function cancelJobViaCommand(options: {
  db: any;
  identity: CanonicalIdentity;
  jobId: string;
  reason?: string;
  expectedStatus?: string;
  idempotencyKey?: string;
}): Promise<JobLifecycleCommandResult> {
  const { db, identity, jobId, reason, expectedStatus, idempotencyKey } = options;
  return executeJobLifecycleCommand({
    db,
    identity,
    command: {
      type: "CancelJob",
      payload: { jobId, reason, expectedStatus },
    },
    idempotencyKey: idempotencyKey || `cancel_${jobId}_${identity.uid}`,
  });
}

export async function disputeJobViaCommand(options: {
  db: any;
  identity: CanonicalIdentity;
  jobId: string;
  reason: string;
  expectedStatus?: string;
  idempotencyKey?: string;
}): Promise<JobLifecycleCommandResult> {
  const { db, identity, jobId, reason, expectedStatus, idempotencyKey } = options;
  return executeJobLifecycleCommand({
    db,
    identity,
    command: {
      type: "RaiseJobDispute",
      payload: { jobId, reason, expectedStatus },
    },
    idempotencyKey: idempotencyKey || `dispute_${jobId}_${identity.uid}`,
  });
}

export const executeStartJobCommand = startJobViaCommand;
export const executeCompleteJobCommand = completeJobViaCommand;
export const executeCancelJobCommand = cancelJobViaCommand;
export const executeDisputeJobCommand = disputeJobViaCommand;

