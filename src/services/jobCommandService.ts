/**
 * Client-Side Job Command Service for AnyTrader V2 (Task 2 & Task 5)
 *
 * Directs all client job creation and job lifecycle workflows through server-authoritative
 * `/api/jobs/*` endpoints. Neutralizes direct Firestore client writes.
 */

import { User } from "firebase/auth";
import { getApiUrl } from "../lib/apiUrl.ts";

export interface CreateJobCommandResult {
  success: boolean;
  jobId: string;
  status: string;
  job?: Record<string, any>;
  wasReplayed?: boolean;
}

export interface CreateJobOptions {
  user: User;
  payload: Record<string, any>;
  idempotencyKey?: string;
}

export interface JobLifecycleResult {
  success: boolean;
  jobId: string;
  status: string;
  job?: Record<string, any>;
  wasReplayed?: boolean;
}

export interface StartJobOptions {
  user: User;
  jobId: string;
  verificationPin?: string;
  idempotencyKey?: string;
}

export interface CompleteJobOptions {
  user: User;
  jobId: string;
  completionNotes?: string;
  idempotencyKey?: string;
}

export interface CancelJobOptions {
  user: User;
  jobId: string;
  reason?: string;
  idempotencyKey?: string;
}

export interface DisputeJobOptions {
  user: User;
  jobId: string;
  reason: string;
  idempotencyKey?: string;
}

/**
 * Executes authoritative job creation via the backend canonical command.
 * Strictly requires an authenticated Firebase User.
 */
export async function createJobViaCommand(options: CreateJobOptions): Promise<CreateJobCommandResult> {
  const { user, payload, idempotencyKey } = options;

  if (!user || !user.uid) {
    throw new Error("Authentication required: you must be signed in to create a job.");
  }

  const token = await user.getIdToken();
  const idempotency = idempotencyKey || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Idempotency-Key": idempotency,
    "Idempotency-Key": idempotency,
  };

  const response = await fetch(getApiUrl("/api/jobs/create"), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Job creation failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    jobId: data.jobId,
    status: data.status || data.job?.status || "open",
    job: data.job,
    wasReplayed: data.wasReplayed,
  };
}

/**
 * Common helper for dispatching job lifecycle commands to /api/jobs/:jobId/:action
 */
async function dispatchJobLifecycleCommand(
  user: User,
  jobId: string,
  action: "start" | "complete" | "cancel" | "dispute",
  payload: Record<string, any>,
  customIdempotencyKey?: string
): Promise<JobLifecycleResult> {
  if (!user || !user.uid) {
    throw new Error(`Authentication required: you must be signed in to perform '${action}' on a job.`);
  }
  if (!jobId) {
    throw new Error("Job ID is required.");
  }

  const token = await user.getIdToken();
  const effectiveIdempotencyKey = customIdempotencyKey || `job_${action}_${jobId}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-idempotency-key": effectiveIdempotencyKey,
    "X-Idempotency-Key": effectiveIdempotencyKey,
    "Idempotency-Key": effectiveIdempotencyKey,
  };

  const response = await fetch(getApiUrl(`/api/jobs/${encodeURIComponent(jobId)}/${action}`), {
    method: "POST",
    headers,
    body: JSON.stringify({ ...payload, jobId, idempotencyKey: effectiveIdempotencyKey }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Failed to ${action} job with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    jobId: data.jobId || jobId,
    status: data.status,
    job: data.job,
    wasReplayed: data.wasReplayed,
  };
}

/**
 * Authoritative StartJob Command Client Adapter (Task 5)
 */
export async function startJobViaCommand(options: StartJobOptions): Promise<JobLifecycleResult> {
  const { user, jobId, verificationPin, idempotencyKey } = options;
  return dispatchJobLifecycleCommand(
    user,
    jobId,
    "start",
    { verificationPin },
    idempotencyKey
  );
}

/**
 * Authoritative CompleteJob Command Client Adapter (Task 5)
 */
export async function completeJobViaCommand(options: CompleteJobOptions): Promise<JobLifecycleResult> {
  const { user, jobId, completionNotes, idempotencyKey } = options;
  return dispatchJobLifecycleCommand(
    user,
    jobId,
    "complete",
    { completionNotes },
    idempotencyKey
  );
}

/**
 * Authoritative CancelJob Command Client Adapter (Task 5)
 */
export async function cancelJobViaCommand(options: CancelJobOptions): Promise<JobLifecycleResult> {
  const { user, jobId, reason, idempotencyKey } = options;
  return dispatchJobLifecycleCommand(
    user,
    jobId,
    "cancel",
    { reason },
    idempotencyKey
  );
}

/**
 * Authoritative DisputeJob Command Client Adapter (Task 5)
 */
export async function disputeJobViaCommand(options: DisputeJobOptions): Promise<JobLifecycleResult> {
  const { user, jobId, reason, idempotencyKey } = options;
  return dispatchJobLifecycleCommand(
    user,
    jobId,
    "dispute",
    { reason },
    idempotencyKey
  );
}
