/**
 * AnyTrader V8.3 — Task 33: Retry Policy & Failure Classification
 * 
 * Server-authoritative classification of execution errors into:
 * - RETRYABLE: Transient network issues, rate limits (429), timeouts, service unavailable (503).
 * - NON_RETRYABLE: Security boundaries, permission denials, legal hold blocks, rights/provenance denials,
 *   classification blocks, validation errors, and deterministic state violations.
 * 
 * Enforces bounded exponential backoff with jitter and hard attempt ceilings.
 */

import { SCALE_LIMITS } from './scaleLimits';

export type ErrorClassification = 'RETRYABLE' | 'NON_RETRYABLE';

export interface RetryEvaluation {
  shouldRetry: boolean;
  classification: ErrorClassification;
  delayMs: number;
  reason: string;
}

/** Non-retryable error substrings that indicate permanent authorization or policy failure */
const NON_RETRYABLE_PATTERNS = [
  'DataRightsSecurityError',
  'ProvenanceSecurityError',
  'DataClassificationSecurityError',
  'AiUsageControlsSecurityError',
  'DataRetentionSecurityError',
  'DataRetentionValidationError',
  'DataRightsValidationError',
  'ProvenanceValidationError',
  'AiUsageControlsValidationError',
  'blocked_by_restriction',
  'blocked_by_provenance',
  'blocked_by_classification',
  'blocked_by_consent',
  'blocked_by_legal_hold',
  'blocked_by_dependency',
  'blocked_by_unknown_policy',
  'Cross-tenant',
  'OwnershipLostError',
  'Permission denied',
  'PERMISSION_DENIED',
  'UNAUTHENTICATED',
  'Unauthorized',
  'Forbidden',
  'invalid_status',
  'invalid_rights',
  'invalid_tenant',
  'Payload exceeds maximum',
] as const;

/**
 * Classifies an error into RETRYABLE vs NON_RETRYABLE.
 * Deterministic policy, authorization, security, and validation failures must never be retried.
 */
export function classifyError(error: unknown): ErrorClassification {
  if (!error) return 'NON_RETRYABLE';

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';

  // 1. Check for explicit non-retryable error names & patterns
  for (const pattern of NON_RETRYABLE_PATTERNS) {
    if (name.includes(pattern) || message.includes(pattern)) {
      return 'NON_RETRYABLE';
    }
  }

  // 2. Check for HTTP status codes on error objects (e.g. Axios/Fetch/gRPC)
  const status = (error as any)?.status || (error as any)?.code || (error as any)?.statusCode;
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) {
    return 'NON_RETRYABLE';
  }

  // 3. Transient errors (network, timeouts, 429, 503, DEADLINE_EXCEEDED, UNAVAILABLE)
  if (
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes('DEADLINE_EXCEEDED') ||
    message.includes('UNAVAILABLE') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNRESET') ||
    message.includes('ECONNREFUSED') ||
    message.includes('Rate limit') ||
    message.includes('ResourceExhausted') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('timeout') ||
    message.includes('overloaded')
  ) {
    return 'RETRYABLE';
  }

  // Conservative default: if unknown, do not retry indefinitely
  return 'RETRYABLE';
}

/**
 * Calculates bounded exponential backoff delay with random jitter.
 * delay = min(maxDelayMs, baseDelayMs * 2^(attempt - 1)) + jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number = SCALE_LIMITS.baseRetryDelayMs,
  maxDelayMs: number = SCALE_LIMITS.maxRetryDelayMs,
  jitterFraction: number = 0.2
): number {
  if (attempt <= 0) return 0;

  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const cappedDelay = Math.min(maxDelayMs, exponentialDelay);

  // Apply deterministic or randomized jitter (± fraction)
  const jitterRange = cappedDelay * jitterFraction;
  const jitter = (Math.random() * 2 - 1) * jitterRange;

  return Math.max(0, Math.floor(cappedDelay + jitter));
}

/**
 * Evaluates whether a failed task execution should be retried or moved to dead-letter.
 */
export function evaluateRetry(
  currentAttempt: number,
  error: unknown,
  maxAttempts: number = SCALE_LIMITS.maxRetryAttempts
): RetryEvaluation {
  const classification = classifyError(error);

  if (classification === 'NON_RETRYABLE') {
    return {
      shouldRetry: false,
      classification: 'NON_RETRYABLE',
      delayMs: 0,
      reason: `Non-retryable policy or validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (currentAttempt >= maxAttempts) {
    return {
      shouldRetry: false,
      classification: 'RETRYABLE',
      delayMs: 0,
      reason: `Maximum retry attempts (${maxAttempts}) exceeded`,
    };
  }

  const delayMs = calculateBackoffDelay(currentAttempt);

  return {
    shouldRetry: true,
    classification: 'RETRYABLE',
    delayMs,
    reason: `Transient failure on attempt ${currentAttempt}/${maxAttempts}; retrying after ${delayMs}ms`,
  };
}
