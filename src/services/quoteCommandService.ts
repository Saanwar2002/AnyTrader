/**
 * Client-Side Quote Command Service for AnyTrader V2 (Task 3)
 *
 * Directs all client quote lifecycle actions (Create, Update, Withdraw, Reject,
 * RequestRequote, RespondToRequote) through the server-authoritative
 * `/api/quotes/command` endpoint. Neutralizes direct Firestore client writes.
 */

import { User } from "firebase/auth";
import { getApiUrl } from "../lib/apiUrl.ts";

export interface QuoteCommandResult {
  success: boolean;
  commandType: string;
  quoteId: string;
  jobId: string;
  status: string;
  quote?: Record<string, any>;
  wasReplayed?: boolean;
}

export interface BaseQuoteCommandOptions {
  user: User;
  jobId: string;
  idempotencyKey?: string;
}

export interface CreateQuoteOptions extends BaseQuoteCommandOptions {
  payload: {
    amount: number;
    coverNote?: string;
    message?: string;
    estimatedDuration?: string;
    estimatedDays?: number | null;
    startDate?: string | null;
    startDateType?: "immediate" | "flexible" | "specific";
    expiryDate?: string | null;
    isImmediateStart?: boolean;
    isEmergency?: boolean;
    paymentPreference?: "fixed_price" | "hourly" | "milestone" | "negotiable";
    paymentTrack?: "quick" | "project";
    quoteScope?: "labor_only" | "materials_included" | "custom" | "full_project";
    depositTerm?: string;
    guaranteeTerm?: string;
    partsWarranty?: string;
    milestones?: Array<{ id?: string; title: string; amount: number; description?: string }>;
    materialsIncluded?: boolean;
    materialsBreakdown?: Array<Record<string, any>>;
    attachments?: string[];
    metadata?: Record<string, any>;
  };
}

export interface UpdateQuoteOptions extends BaseQuoteCommandOptions {
  quoteId: string;
  payload: {
    amount?: number;
    coverNote?: string;
    message?: string;
    estimatedDuration?: string;
    estimatedDays?: number | null;
    startDate?: string | null;
    startDateType?: "immediate" | "flexible" | "specific";
    expiryDate?: string | null;
    paymentPreference?: "fixed_price" | "hourly" | "milestone" | "negotiable";
    paymentTrack?: "quick" | "project";
    quoteScope?: "labor_only" | "materials_included" | "custom" | "full_project";
    milestones?: Array<{ id?: string; title: string; amount: number; description?: string }>;
    materialsIncluded?: boolean;
    materialsBreakdown?: Array<Record<string, any>>;
    attachments?: string[];
    metadata?: Record<string, any>;
  };
}

export interface WithdrawQuoteOptions extends BaseQuoteCommandOptions {
  quoteId: string;
  reason?: string;
}

export interface RejectQuoteOptions extends BaseQuoteCommandOptions {
  quoteId: string;
  reason?: string;
}

export interface RequestRequoteOptions extends BaseQuoteCommandOptions {
  quoteId: string;
  message: string;
  suggestedBudget?: number | null;
}

export interface RespondToRequoteOptions extends BaseQuoteCommandOptions {
  quoteId: string;
  payload: {
    amount: number;
    coverNote?: string;
    message?: string;
    estimatedDuration?: string;
    estimatedDays?: number | null;
    startDate?: string | null;
    milestones?: Array<{ id?: string; title: string; amount: number; description?: string }>;
    materialsIncluded?: boolean;
    materialsBreakdown?: Array<Record<string, any>>;
    attachments?: string[];
    metadata?: Record<string, any>;
  };
}

/**
 * Low-level quote command dispatcher.
 */
async function dispatchQuoteCommand(
  user: User,
  commandType: string,
  payload: Record<string, any>,
  customIdempotencyKey?: string
): Promise<QuoteCommandResult> {
  if (!user || !user.uid) {
    throw new Error("Authentication required: you must be signed in to perform quote actions.");
  }

  const token = await user.getIdToken();
  const idempotency =
    customIdempotencyKey ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `quote_cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Idempotency-Key": idempotency,
    "Idempotency-Key": idempotency,
  };

  const response = await fetch(getApiUrl("/api/quotes/command"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: commandType,
      payload,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Quote command '${commandType}' failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    commandType: data.commandType || commandType,
    quoteId: data.quoteId,
    jobId: data.jobId,
    status: data.status,
    quote: data.quote,
    wasReplayed: data.wasReplayed,
  };
}

/**
 * 1. CreateQuote
 */
export async function createQuoteViaCommand(options: CreateQuoteOptions): Promise<QuoteCommandResult> {
  const { user, jobId, payload, idempotencyKey } = options;
  return dispatchQuoteCommand(
    user,
    "CreateQuote",
    {
      jobId,
      ...payload,
    },
    idempotencyKey
  );
}

/**
 * 2. UpdateQuote
 */
export async function updateQuoteViaCommand(options: UpdateQuoteOptions): Promise<QuoteCommandResult> {
  const { user, jobId, quoteId, payload, idempotencyKey } = options;
  return dispatchQuoteCommand(
    user,
    "UpdateQuote",
    {
      jobId,
      quoteId,
      ...payload,
    },
    idempotencyKey
  );
}

/**
 * 3. WithdrawQuote
 */
export async function withdrawQuoteViaCommand(options: WithdrawQuoteOptions): Promise<QuoteCommandResult> {
  const { user, jobId, quoteId, reason, idempotencyKey } = options;
  return dispatchQuoteCommand(
    user,
    "WithdrawQuote",
    {
      jobId,
      quoteId,
      reason,
    },
    idempotencyKey
  );
}

/**
 * 4. RejectQuote
 */
export async function rejectQuoteViaCommand(options: RejectQuoteOptions): Promise<QuoteCommandResult> {
  const { user, jobId, quoteId, reason, idempotencyKey } = options;
  return dispatchQuoteCommand(
    user,
    "RejectQuote",
    {
      jobId,
      quoteId,
      reason,
    },
    idempotencyKey
  );
}

/**
 * 5. RequestRequote
 */
export async function requestRequoteViaCommand(options: RequestRequoteOptions): Promise<QuoteCommandResult> {
  const { user, jobId, quoteId, message, suggestedBudget, idempotencyKey } = options;
  return dispatchQuoteCommand(
    user,
    "RequestRequote",
    {
      jobId,
      quoteId,
      message,
      suggestedBudget,
    },
    idempotencyKey
  );
}

/**
 * 6. RespondToRequote
 */
export async function respondToRequoteViaCommand(options: RespondToRequoteOptions): Promise<QuoteCommandResult> {
  const { user, jobId, quoteId, payload, idempotencyKey } = options;
  return dispatchQuoteCommand(
    user,
    "RespondToRequote",
    {
      jobId,
      quoteId,
      ...payload,
    },
    idempotencyKey
  );
}

export interface AcceptQuoteOptions {
  user: User;
  jobId: string;
  quoteId: string;
  idempotencyKey?: string;
}

export interface AcceptQuoteResult {
  success: boolean;
  jobId: string;
  quoteId: string;
  status: string;
  acceptedTradespersonId?: string;
  scheduledDate?: string;
  verificationPin?: string;
  isConfirmedByTradesperson?: boolean;
  wasReplayed?: boolean;
}

/**
 * Authoritative quote acceptance via the canonical backend endpoint:
 * POST /api/jobs/:jobId/accept-quote (Task 4)
 */
export async function acceptQuoteViaServer(options: AcceptQuoteOptions): Promise<AcceptQuoteResult> {
  const { user, jobId, quoteId, idempotencyKey } = options;

  if (!user || !user.uid) {
    throw new Error("Authentication required: you must be signed in to accept a quote.");
  }
  if (!jobId || !quoteId) {
    throw new Error("Both jobId and quoteId are required to accept a quote.");
  }

  const token = await user.getIdToken();
  const effectiveIdempotencyKey =
    idempotencyKey || `accept_${jobId}_${quoteId}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-idempotency-key": effectiveIdempotencyKey,
    "X-Idempotency-Key": effectiveIdempotencyKey,
    "Idempotency-Key": effectiveIdempotencyKey,
  };

  const response = await fetch(getApiUrl(`/api/jobs/${encodeURIComponent(jobId)}/accept-quote`), {
    method: "POST",
    headers,
    body: JSON.stringify({ quoteId, idempotencyKey: effectiveIdempotencyKey }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Failed to accept quote with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    jobId: data.jobId || jobId,
    quoteId: data.quoteId || quoteId,
    status: data.status || "accepted",
    acceptedTradespersonId: data.acceptedTradespersonId,
    scheduledDate: data.scheduledDate,
    verificationPin: data.verificationPin,
    isConfirmedByTradesperson: data.isConfirmedByTradesperson,
    wasReplayed: data.wasReplayed,
  };
}
