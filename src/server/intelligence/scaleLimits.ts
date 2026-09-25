/**
 * AnyTrader V8.3 — Task 33: Centralized Scale Limits & Configuration
 * 
 * Centralized, server-authoritative engineering constants and boundaries
 * preventing unbounded resource consumption, Firestore hotspotting, and memory starvation.
 */

export const SCALE_LIMITS = {
  /** Maximum tasks claimed per worker execution cycle */
  maxClaimBatch: 25,

  /** Maximum concurrent active worker loops per worker process */
  maxConcurrentTasks: 10,

  /** Maximum retry attempts before permanent dead-letter transition */
  maxRetryAttempts: 5,

  /** Standard worker lease duration (5 minutes) */
  defaultLeaseDurationMs: 5 * 60 * 1000,

  /** Hard cap on any extended lease duration (15 minutes) */
  maxLeaseDurationMs: 15 * 60 * 1000,

  /** Base delay for exponential backoff (2 seconds) */
  baseRetryDelayMs: 2 * 1000,

  /** Maximum backoff ceiling for transient retries (5 minutes) */
  maxRetryDelayMs: 5 * 60 * 1000,

  /** Maximum batch write operations per Firestore commit (under 500 limit) */
  maxFirestoreBatchWrites: 400,

  /** Maximum payload size in bytes per queue task (1MB limit with safety margin) */
  maxPayloadSizeBytes: 1024 * 1024, // 1 MB

  /** Maximum concurrent active tasks permitted for a single tenant (noisy neighbor protection) */
  maxTenantActiveTasks: 5,

  /** Standard cursor pagination page size */
  defaultCursorPageSize: 50,

  /** Hard cap on cursor pagination page size */
  maxCursorPageSize: 100,

  /** Maximum AI generation prompt character length */
  maxAiPromptChars: 32_000,

  /** Maximum timeout for external AI provider responses (60 seconds) */
  aiProviderTimeoutMs: 60 * 1000,
} as const;

export type ScaleLimits = typeof SCALE_LIMITS;
