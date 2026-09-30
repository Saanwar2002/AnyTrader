/**
 * Client-Side Job Command Service for AnyTrader V2 (Task 2)
 *
 * Directs all client job creation workflows through the server-authoritative
 * `/api/jobs/create` endpoint. Neutralizes direct Firestore client writes.
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
