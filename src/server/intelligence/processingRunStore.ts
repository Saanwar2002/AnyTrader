/**
 * AnyTrader V8.1 — Task 14: Intelligence Processing Run Store & Observability Layer
 * 
 * Invariants & Core Architecture:
 * - Observability Layer: Records durable operational telemetry for every intelligence processing attempt.
 * - Single Source of Truth: Authoritative Firestore storage in `/intelligence_processing_runs/{runId}`.
 * - Fail-Closed: Zero in-memory fallback in production. Fails closed if Firestore is unavailable.
 * - Idempotency by Attempt: Deterministic identity derived from taskId + attempt + leaseId.
 * - Privacy & Data Minimization: Zero raw prompts, responses, PII, or secrets stored.
 * - Strict Validation: Rejects invalid statuses, negative numbers, NaNs, and malformed telemetry.
 * - Platform-Wide Aggregate Extensibility: Uses the single platform-wide IntelligenceAggregateType.
 */

import { computeSha256 } from './provenance';
import { cleanUndefinedFields } from './evidence';
import { classifyAndSanitizeProcessingError } from './processingErrorClassifier';
import {
  CostModelValidationError,
  DEFAULT_COST_CURRENCY,
  DEFAULT_PRICING_VERSION,
  validateAndNormalizeMetrics,
  validateNonNegativeFiniteNumber,
} from './costModel';
import {
  IntelligenceAggregateType,
  IntelligenceProcessingRun,
  ProcessingRunStatus,
} from './types';
import { FirestoreDbLike } from './immutableStore';

/**
 * Global default database instance for processing runs.
 */
let globalProcessingRunDb: FirestoreDbLike | null = null;

export function setGlobalProcessingRunDb(db: FirestoreDbLike | null): void {
  globalProcessingRunDb = db;
}

export function getGlobalProcessingRunDb(): FirestoreDbLike | null {
  return globalProcessingRunDb;
}

export class ProcessingRunValidationError extends Error {
  constructor(message: string) {
    super(`[ProcessingRunValidationError] ${message}`);
    this.name = 'ProcessingRunValidationError';
  }
}

export class ProcessingRunPrivacyViolationError extends Error {
  constructor(message: string) {
    super(`[ProcessingRunPrivacyViolationError] ${message}`);
    this.name = 'ProcessingRunPrivacyViolationError';
  }
}

const VALID_STATUSES = new Set<ProcessingRunStatus>([
  'started',
  'succeeded',
  'failed',
  'retrying',
  'dead_letter',
]);

const FORBIDDEN_PRIVACY_KEYS = [
  'rawResponse',
  'rawResponseText',
  'fullPrompt',
  'promptText',
  'rawPrompt',
  'password',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'authHeader',
  'creditCard',
  'paymentInfo',
  'rawPhoto',
  'rawDescription',
];

/**
 * Generates a deterministic processing run ID from taskId, attempt, and leaseId.
 */
export function buildProcessingRunId(taskId: string, attempt: number, leaseId: string): string {
  if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
    throw new ProcessingRunValidationError('taskId is required to build processing run ID');
  }
  if (!attempt || typeof attempt !== 'number' || attempt < 1 || !Number.isInteger(attempt)) {
    throw new ProcessingRunValidationError(`Valid integer attempt (>= 1) is required, received ${attempt}`);
  }
  if (!leaseId || typeof leaseId !== 'string' || leaseId.trim().length === 0) {
    throw new ProcessingRunValidationError('leaseId is required to build processing run ID');
  }

  const sanitizedTask = taskId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  const hash = computeSha256(`${taskId.trim()}:${attempt}:${leaseId.trim()}`).slice(0, 16);
  return `run_${sanitizedTask}_att${attempt}_${hash}`;
}

export function validateStringField(value: unknown, name: string, maxLength: number, isRequired: boolean = false): string {
  if (value === undefined || value === null) {
    if (isRequired) {
      throw new ProcessingRunValidationError(`Field '${name}' is required`);
    }
    return '';
  }
  if (typeof value !== 'string') {
    throw new ProcessingRunValidationError(`Field '${name}' must be a string, received ${typeof value}`);
  }
  const trimmed = value.trim();
  if (isRequired && trimmed.length === 0) {
    throw new ProcessingRunValidationError(`Field '${name}' is required and cannot be empty`);
  }
  if (trimmed.length > maxLength) {
    throw new ProcessingRunValidationError(`Field '${name}' exceeds maximum length of ${maxLength} characters`);
  }
  return trimmed;
}

/**
 * Validates that an object contains no forbidden privacy-violating attributes.
 */
export function validateRunPrivacy(record: Record<string, unknown>): void {
  // Enforce strict schema keys: no unknown fields allowed!
  const ALLOWED_KEYS = new Set([
    'runId', 'taskId', 'aggregateType', 'aggregateId', 'taskType', 'status', 'attempt', 'workerId', 'leaseId',
    'startedAt', 'finishedAt', 'durationMs', 'pipelineVersion', 'schemaVersion', 'provider', 'modelVersion',
    'promptVersion', 'inputEvidenceCount', 'inputBytes', 'outputBytes', 'inputTokens', 'outputTokens',
    'totalTokens', 'estimatedCost', 'costCurrency', 'pricingVersion', 'errorCode', 'errorClass', 'retryable',
    'sanitizedDiagnostic', 'createdAt', 'contentionTouch'
  ]);

  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new ProcessingRunPrivacyViolationError(
        `Field '${key}' is not allowed in processing run record. Only schema-defined observability attributes can be persisted.`
      );
    }

    const value = record[key];
    if (typeof value === 'string') {
      const lowerVal = value.toLowerCase();
      for (const forbidden of FORBIDDEN_PRIVACY_KEYS) {
        if (lowerVal.includes(forbidden.toLowerCase())) {
          throw new ProcessingRunPrivacyViolationError(
            `Field '${key}' contains forbidden privacy-violating string. Raw AI data/secrets must not be stored.`
          );
        }
      }
      if (
        value.includes('AIza') ||
        value.includes('sk-') ||
        value.includes('Bearer ')
      ) {
        throw new ProcessingRunPrivacyViolationError(
          `Field '${key}' contains sensitive key or auth tokens. Redaction required.`
        );
      }
    }
  }
}

/**
 * Strictly validates a complete IntelligenceProcessingRun record against the schema.
 */
export function validateProcessingRunRecord(run: Partial<IntelligenceProcessingRun>): IntelligenceProcessingRun {
  const runId = validateStringField(run.runId, 'runId', 128, true);
  const taskId = validateStringField(run.taskId, 'taskId', 64, true);
  const aggregateId = validateStringField(run.aggregateId, 'aggregateId', 64, true);
  const workerId = validateStringField(run.workerId, 'workerId', 64, true);
  const leaseId = validateStringField(run.leaseId, 'leaseId', 64, true);

  const pipelineVersion = validateStringField(run.pipelineVersion || 'v8.1.0', 'pipelineVersion', 16);
  const schemaVersion = validateStringField(run.schemaVersion || 'v8.1.0', 'schemaVersion', 16);
  const pricingVersion = validateStringField(run.pricingVersion, 'pricingVersion', 16);
  const costCurrency = validateStringField(run.costCurrency, 'costCurrency', 16);

  const statusStr = validateStringField(run.status, 'status', 32, true);
  if (!VALID_STATUSES.has(statusStr as ProcessingRunStatus)) {
    throw new ProcessingRunValidationError(`Invalid processing run status: '${statusStr}'`);
  }

  const taskType = validateStringField(run.taskType, 'taskType', 32, true);
  const aggregateType = validateStringField(run.aggregateType, 'aggregateType', 32, true);
  const provider = validateStringField(run.provider || 'google_genai', 'provider', 32);
  const modelVersion = validateStringField(run.modelVersion || 'gemini-3.8-flash', 'modelVersion', 32);
  const promptVersion = validateStringField(run.promptVersion || 'default_v8.1', 'promptVersion', 32);
  const errorCode = validateStringField(run.errorCode, 'errorCode', 32);
  const errorClass = validateStringField(run.errorClass, 'errorClass', 32);

  if (typeof run.attempt !== 'number' || run.attempt < 1 || !Number.isInteger(run.attempt) || Number.isNaN(run.attempt) || !Number.isFinite(run.attempt)) {
    throw new ProcessingRunValidationError(`Invalid attempt: '${run.attempt}'. Must be an integer >= 1.`);
  }

  const startedAt = validateStringField(run.startedAt, 'startedAt', 64, true);
  const finishedAt = run.finishedAt ? validateStringField(run.finishedAt, 'finishedAt', 64) : undefined;

  const startedTime = Date.parse(startedAt);
  if (Number.isNaN(startedTime)) {
    throw new ProcessingRunValidationError("Field 'startedAt' is not a valid ISO date string");
  }

  // Validate metrics and economics
  const normalizedMetrics = validateAndNormalizeMetrics(
    {
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      totalTokens: run.totalTokens,
      estimatedCost: run.estimatedCost,
      durationMs: run.durationMs,
      inputBytes: run.inputBytes,
      outputBytes: run.outputBytes,
      inputEvidenceCount: run.inputEvidenceCount,
      costCurrency: costCurrency || undefined,
      pricingVersion: pricingVersion || undefined,
    },
    provider,
    modelVersion
  );

  if (finishedAt) {
    const finishedTime = Date.parse(finishedAt);
    if (Number.isNaN(finishedTime)) {
      throw new ProcessingRunValidationError("Field 'finishedAt' is not a valid ISO date string");
    }
    if (finishedTime < startedTime) {
      throw new ProcessingRunValidationError("Field 'finishedAt' cannot be earlier than 'startedAt'");
    }
    const calculatedDuration = finishedTime - startedTime;
    if (normalizedMetrics.durationMs !== undefined) {
      const diff = Math.abs(normalizedMetrics.durationMs - calculatedDuration);
      if (diff > 5000) {
        throw new ProcessingRunValidationError(
          `Recorded durationMs (${normalizedMetrics.durationMs}) contradicts calculated interval (${calculatedDuration}ms) beyond 5000ms tolerance`
        );
      }
    }
  }

  // Validate privacy & data minimization
  validateRunPrivacy(run as Record<string, unknown>);

  const now = new Date().toISOString();

  const validated: IntelligenceProcessingRun = {
    runId,
    taskId,
    aggregateType: aggregateType as IntelligenceAggregateType,
    aggregateId,
    taskType,
    status: statusStr as ProcessingRunStatus,
    attempt: run.attempt,
    workerId,
    leaseId,
    startedAt,
    finishedAt,
    durationMs: run.durationMs !== undefined ? normalizedMetrics.durationMs : undefined,
    pipelineVersion,
    schemaVersion,
    provider,
    modelVersion,
    promptVersion,
    inputEvidenceCount: normalizedMetrics.inputEvidenceCount,
    inputBytes: normalizedMetrics.inputBytes,
    outputBytes: normalizedMetrics.outputBytes,
    inputTokens: normalizedMetrics.inputTokens,
    outputTokens: normalizedMetrics.outputTokens,
    totalTokens: normalizedMetrics.totalTokens,
    estimatedCost: normalizedMetrics.estimatedCost,
    costCurrency: normalizedMetrics.costCurrency,
    pricingVersion: normalizedMetrics.pricingVersion,
    errorCode: errorCode || undefined,
    errorClass: errorClass || undefined,
    retryable: typeof run.retryable === 'boolean' ? run.retryable : undefined,
    sanitizedDiagnostic: run.sanitizedDiagnostic ? String(run.sanitizedDiagnostic).trim() : undefined,
    createdAt: run.createdAt ? String(run.createdAt).trim() : now,
  };

  return validated;
}

export class IntelligenceProcessingRunStore {
  /**
   * Records the initial 'started' execution attempt record in Firestore.
   * Fails closed if Firestore is unavailable or transaction is unsupported.
   */
  public async recordRunStarted(
    runInput: Partial<IntelligenceProcessingRun>,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceProcessingRun> {
    const effectiveDb = db !== undefined ? db : globalProcessingRunDb;
    if (!effectiveDb || typeof effectiveDb.runTransaction !== 'function') {
      throw new Error('[ProcessingRunStore] Firestore database or transaction support is unavailable (Fail Closed).');
    }

    if (!runInput.taskId) {
      throw new ProcessingRunValidationError("Field 'taskId' is required to start a processing run");
    }
    if (runInput.attempt === undefined || runInput.attempt === null) {
      throw new ProcessingRunValidationError("Field 'attempt' is required to start a processing run");
    }
    if (!runInput.leaseId) {
      throw new ProcessingRunValidationError("Field 'leaseId' is required to start a processing run");
    }

    const expectedRunId = buildProcessingRunId(runInput.taskId, runInput.attempt, runInput.leaseId);
    if (runInput.runId !== undefined && runInput.runId !== null && runInput.runId !== expectedRunId) {
      throw new ProcessingRunValidationError(
        `Deterministic identity mismatch: supplied runId '${runInput.runId}' does not match expected deterministic runId '${expectedRunId}'`
      );
    }

    const runId = expectedRunId;

    const now = new Date().toISOString();
    const validated = validateProcessingRunRecord({
      ...runInput,
      runId,
      status: 'started',
      startedAt: runInput.startedAt || now,
      createdAt: runInput.createdAt || now,
    });

    const docRef = effectiveDb.collection('intelligence_processing_runs').doc(validated.runId);
    const sanitized = cleanUndefinedFields(validated);

    return await effectiveDb.runTransaction(async (transaction: any) => {
      if (!transaction || typeof transaction.set !== 'function') {
        throw new Error('[ProcessingRunStore] Transaction object missing required set method (Fail Closed).');
      }
      const snap = typeof transaction.get === 'function' ? await transaction.get(docRef) : null;
      if (snap && snap.exists) {
        const existing = (typeof snap.data === 'function' ? snap.data() : snap.data) as IntelligenceProcessingRun;
        
        // Worker & Lease Ownership Validation
        if (
          (runInput.workerId && existing.workerId && existing.workerId !== runInput.workerId) ||
          (runInput.leaseId && existing.leaseId && existing.leaseId !== runInput.leaseId)
        ) {
          throw new ProcessingRunValidationError(
            `Worker or lease mismatch for processing run '${validated.runId}': existing worker '${existing.workerId}' / lease '${existing.leaseId}' does not match incoming worker '${runInput.workerId}' / lease '${runInput.leaseId}'`
          );
        }

        // Terminal State Protection: If run is already completed/terminal, do NOT revert status to 'started'
        if (existing.status && existing.status !== 'started') {
          return existing;
        }

        // 14C.3 Check: Reject if incoming request attempts to change server-owned metadata
        const serverOwnedKeys = [
          'provider',
          'modelVersion',
          'promptVersion',
          'pipelineVersion',
          'schemaVersion',
          'pricingVersion',
          'taskId',
          'aggregateType',
          'aggregateId',
          'taskType',
          'attempt',
          'workerId',
          'leaseId',
          'runId'
        ];
        for (const key of serverOwnedKeys) {
          const incomingVal = runInput[key as keyof IntelligenceProcessingRun];
          const existingVal = existing[key as keyof IntelligenceProcessingRun];
          if (incomingVal !== undefined && incomingVal !== null && existingVal !== undefined && existingVal !== null) {
            if (incomingVal !== existingVal) {
              throw new ProcessingRunValidationError(
                `Conflict in server-owned metadata/identity: incoming ${key} '${incomingVal}' does not match existing '${existingVal}'`
              );
            }
          }
        }

        transaction.set(docRef, sanitized, { merge: true });
        return { ...existing, ...sanitized };
      }

      transaction.set(docRef, sanitized);
      return validated;
    });
  }

  /**
   * Marks a processing execution record as 'succeeded' after immutable intelligence persistence confirms.
   * Fails closed if Firestore is unavailable or transaction is unsupported.
   */
  public async recordRunSucceeded(
    runId: string,
    updates: Partial<IntelligenceProcessingRun>,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceProcessingRun> {
    const effectiveDb = db !== undefined ? db : globalProcessingRunDb;
    if (!effectiveDb || typeof effectiveDb.runTransaction !== 'function') {
      throw new Error('[ProcessingRunStore] Firestore database or transaction support is unavailable (Fail Closed).');
    }

    if (!runId || typeof runId !== 'string') {
      throw new ProcessingRunValidationError('Missing valid runId for recordRunSucceeded');
    }

    if (updates?.runId !== undefined && updates?.runId !== null) {
      if (updates.runId !== runId) {
        throw new ProcessingRunValidationError(
          `Malicious update rejected: caller-supplied runId '${updates.runId}' does not match authoritative runId '${runId}'`
        );
      }
    }

    const docRef = effectiveDb.collection('intelligence_processing_runs').doc(runId);
    const now = new Date().toISOString();

    return await effectiveDb.runTransaction(async (transaction: any) => {
      if (!transaction || typeof transaction.get !== 'function' || typeof transaction.set !== 'function') {
        throw new Error('[ProcessingRunStore] Transaction object missing required get or set method (Fail Closed).');
      }
      const snap = await transaction.get(docRef);
      if (!snap || !snap.exists) {
        throw new Error(`[ProcessingRunStore] Cannot mark nonexistent processing run '${runId}' as succeeded`);
      }

      const existing = (typeof snap.data === 'function' ? snap.data() : snap.data) as IntelligenceProcessingRun;

      // Identity Protection: If updates contains execution identity keys, reject if they differ from existing
      const identityKeys: Array<keyof IntelligenceProcessingRun> = [
        'taskId',
        'attempt',
        'aggregateType',
        'aggregateId',
        'taskType',
        'startedAt',
        'createdAt',
        'provider',
        'modelVersion',
        'promptVersion',
        'pipelineVersion',
        'schemaVersion',
        'pricingVersion',
      ];
      for (const key of identityKeys) {
        if (updates && updates[key] !== undefined && updates[key] !== null) {
          if (existing[key] !== undefined && existing[key] !== null) {
            if (updates[key] !== existing[key]) {
              throw new ProcessingRunValidationError(
                `Malicious update rejected: caller-supplied ${key} '${updates[key]}' does not match existing server-owned value '${existing[key]}'`
              );
            }
          }
        }
      }

      // Worker & Lease Ownership Validation
      if (
        (updates.workerId && existing.workerId && existing.workerId !== updates.workerId) ||
        (updates.leaseId && existing.leaseId && existing.leaseId !== updates.leaseId)
      ) {
        throw new ProcessingRunValidationError(
          `Worker or lease mismatch for processing run '${runId}': existing worker '${existing.workerId}' / lease '${existing.leaseId}' does not match update worker '${updates.workerId}' / lease '${updates.leaseId}'`
        );
      }

      // State Transition Integrity: Check if attempting invalid state transition
      if (existing.status && existing.status !== 'started' && existing.status !== 'succeeded') {
        throw new ProcessingRunValidationError(
          `Invalid state transition: cannot transition processing run '${runId}' from terminal/failed state '${existing.status}' to 'succeeded'`
        );
      }

      const startedAtTime = new Date(existing.startedAt || now).getTime();
      const finishedAt = updates.finishedAt || now;
      const durationMs = updates.durationMs !== undefined
        ? validateNonNegativeFiniteNumber(updates.durationMs, 'durationMs', 86_400_000)
        : Math.max(0, new Date(finishedAt).getTime() - startedAtTime);

      const mergedRaw: Partial<IntelligenceProcessingRun> = {
        ...existing,
        ...updates,
        status: 'succeeded',
        finishedAt,
        durationMs,
        errorCode: undefined,
        errorClass: undefined,
        retryable: undefined,
        sanitizedDiagnostic: undefined,
        // Override with strictly authoritative server-owned identity and execution metadata
        runId,
        taskId: existing.taskId,
        attempt: existing.attempt,
        aggregateType: existing.aggregateType,
        aggregateId: existing.aggregateId,
        taskType: existing.taskType,
        startedAt: existing.startedAt,
        createdAt: existing.createdAt,
        workerId: existing.workerId,
        leaseId: existing.leaseId,
        provider: existing.provider !== undefined ? existing.provider : updates?.provider,
        modelVersion: existing.modelVersion !== undefined ? existing.modelVersion : updates?.modelVersion,
        promptVersion: existing.promptVersion !== undefined ? existing.promptVersion : updates?.promptVersion,
        pipelineVersion: existing.pipelineVersion !== undefined ? existing.pipelineVersion : updates?.pipelineVersion,
        schemaVersion: existing.schemaVersion !== undefined ? existing.schemaVersion : updates?.schemaVersion,
        pricingVersion: existing.pricingVersion !== undefined ? existing.pricingVersion : updates?.pricingVersion,
      };

      const validated = validateProcessingRunRecord(mergedRaw);
      const sanitized = cleanUndefinedFields(validated);
      transaction.set(docRef, sanitized, { merge: true });
      return validated;
    });
  }

  /**
   * Marks a processing execution record as 'failed' / 'retrying' / 'dead_letter' with sanitized error telemetry.
   * Fails closed if Firestore is unavailable or transaction is unsupported.
   */
  public async recordRunFailed(
    runId: string,
    error: unknown,
    updates?: Partial<IntelligenceProcessingRun>,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceProcessingRun> {
    const effectiveDb = db !== undefined ? db : globalProcessingRunDb;
    if (!effectiveDb || typeof effectiveDb.runTransaction !== 'function') {
      throw new Error('[ProcessingRunStore] Firestore database or transaction support is unavailable (Fail Closed).');
    }

    if (!runId || typeof runId !== 'string') {
      throw new ProcessingRunValidationError('Missing valid runId for recordRunFailed');
    }

    if (updates?.runId !== undefined && updates?.runId !== null) {
      if (updates.runId !== runId) {
        throw new ProcessingRunValidationError(
          `Malicious update rejected: caller-supplied runId '${updates.runId}' does not match authoritative runId '${runId}'`
        );
      }
    }

    const errorClassification = classifyAndSanitizeProcessingError(error);
    const docRef = effectiveDb.collection('intelligence_processing_runs').doc(runId);
    const now = new Date().toISOString();

    return await effectiveDb.runTransaction(async (transaction: any) => {
      if (!transaction || typeof transaction.set !== 'function') {
        throw new Error('[ProcessingRunStore] Transaction object missing required set method (Fail Closed).');
      }
      const snap = typeof transaction.get === 'function' ? await transaction.get(docRef) : null;
      const existing = (snap && snap.exists && snap.data)
        ? ((typeof snap.data === 'function' ? snap.data() : snap.data) as IntelligenceProcessingRun)
        : null;

      if (existing) {
        // Identity Protection: If updates contains execution identity keys, reject if they differ from existing
        const identityKeys: Array<keyof IntelligenceProcessingRun> = [
          'taskId',
          'attempt',
          'aggregateType',
          'aggregateId',
          'taskType',
          'startedAt',
          'createdAt',
          'provider',
          'modelVersion',
          'promptVersion',
          'pipelineVersion',
          'schemaVersion',
          'pricingVersion',
        ];
        for (const key of identityKeys) {
          if (updates && updates[key] !== undefined && updates[key] !== null) {
            if (existing[key] !== undefined && existing[key] !== null) {
              if (updates[key] !== existing[key]) {
                throw new ProcessingRunValidationError(
                  `Malicious update rejected: caller-supplied ${key} '${updates[key]}' does not match existing server-owned value '${existing[key]}'`
                );
              }
            }
          }
        }

        // Worker & Lease Ownership Validation
        if (
          (updates?.workerId && existing.workerId && existing.workerId !== updates.workerId) ||
          (updates?.leaseId && existing.leaseId && existing.leaseId !== updates.leaseId)
        ) {
          throw new ProcessingRunValidationError(
            `Worker or lease mismatch for processing run '${runId}': existing worker '${existing.workerId}' / lease '${existing.leaseId}' does not match update worker '${updates.workerId}' / lease '${updates.leaseId}'`
          );
        }

        const targetStatus: ProcessingRunStatus = updates?.status && VALID_STATUSES.has(updates.status as ProcessingRunStatus)
          ? (updates.status as ProcessingRunStatus)
          : (errorClassification.retryable ? 'retrying' : 'dead_letter');

        // State Transition Integrity: Cannot transition from 'succeeded' to failed states, or from 'dead_letter' to 'retrying'
        if (existing.status === 'succeeded') {
          throw new ProcessingRunValidationError(
            `Invalid state transition: cannot transition processing run '${runId}' from 'succeeded' to '${targetStatus}'`
          );
        }
        if (existing.status === 'dead_letter' && targetStatus === 'retrying') {
          throw new ProcessingRunValidationError(
            `Invalid state transition: cannot transition processing run '${runId}' from 'dead_letter' to 'retrying'`
          );
        }

        const startedAtTime = new Date(existing.startedAt || now).getTime();
        const finishedAt = updates?.finishedAt || now;
        const durationMs = updates?.durationMs !== undefined
          ? validateNonNegativeFiniteNumber(updates.durationMs, 'durationMs', 86_400_000)
          : Math.max(0, new Date(finishedAt).getTime() - startedAtTime);

        const mergedRaw: Partial<IntelligenceProcessingRun> = {
          ...existing,
          ...updates,
          status: targetStatus,
          finishedAt,
          durationMs,
          errorCode: errorClassification.errorCode,
          errorClass: errorClassification.errorClass,
          retryable: errorClassification.retryable,
          sanitizedDiagnostic: errorClassification.sanitizedDiagnostic,
          // Override with strictly authoritative server-owned identity and execution metadata
          runId,
          taskId: existing.taskId,
          attempt: existing.attempt,
          aggregateType: existing.aggregateType,
          aggregateId: existing.aggregateId,
          taskType: existing.taskType,
          startedAt: existing.startedAt,
          createdAt: existing.createdAt,
          workerId: existing.workerId,
          leaseId: existing.leaseId,
          provider: existing.provider !== undefined ? existing.provider : updates?.provider,
          modelVersion: existing.modelVersion !== undefined ? existing.modelVersion : updates?.modelVersion,
          promptVersion: existing.promptVersion !== undefined ? existing.promptVersion : updates?.promptVersion,
          pipelineVersion: existing.pipelineVersion !== undefined ? existing.pipelineVersion : updates?.pipelineVersion,
          schemaVersion: existing.schemaVersion !== undefined ? existing.schemaVersion : updates?.schemaVersion,
          pricingVersion: existing.pricingVersion !== undefined ? existing.pricingVersion : updates?.pricingVersion,
        };

        const validated = validateProcessingRunRecord(mergedRaw);
        const sanitized = cleanUndefinedFields(validated);
        transaction.set(docRef, sanitized, { merge: true });
        return validated;
      }

      // Record does not exist yet: create initial failure record
      const initialRecord: Partial<IntelligenceProcessingRun> = {
        taskId: updates?.taskId || 'unknown_task',
        aggregateType: (updates?.aggregateType || 'job') as any,
        aggregateId: updates?.aggregateId || 'unknown',
        taskType: updates?.taskType || 'job_extraction',
        status: updates?.status && VALID_STATUSES.has(updates.status as ProcessingRunStatus)
          ? (updates.status as ProcessingRunStatus)
          : (errorClassification.retryable ? 'retrying' : 'dead_letter'),
        attempt: updates?.attempt || 1,
        workerId: updates?.workerId || 'unknown_worker',
        leaseId: updates?.leaseId || 'unknown_lease',
        startedAt: updates?.startedAt || (
          updates?.finishedAt
            ? new Date(new Date(updates.finishedAt).getTime() - (updates.durationMs || 0)).toISOString()
            : now
        ),
        finishedAt: updates?.finishedAt || now,
        durationMs: updates?.durationMs !== undefined ? updates.durationMs : 0,
        errorCode: errorClassification.errorCode,
        errorClass: errorClassification.errorClass,
        retryable: errorClassification.retryable,
        sanitizedDiagnostic: errorClassification.sanitizedDiagnostic,
        createdAt: now,
        ...(updates || {}),
        runId, // Ensure runId is strictly overridden and cannot be overwritten by updates
      };

      const validated = validateProcessingRunRecord(initialRecord);
      const sanitized = cleanUndefinedFields(validated);
      transaction.set(docRef, sanitized, { merge: true });
      return validated;
    });
  }

  /**
   * Retrieves a processing run by runId from authoritative Firestore.
   */
  public async getRun(
    runId: string,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceProcessingRun | undefined> {
    const effectiveDb = db !== undefined ? db : globalProcessingRunDb;
    if (!effectiveDb) {
      throw new Error('[ProcessingRunStore] Firestore database is not configured. Operational failure (Fail Closed).');
    }

    const docRef = effectiveDb.collection('intelligence_processing_runs').doc(runId);
    const snap = await docRef.get();
    if (!snap || !snap.exists) {
      return undefined;
    }
    return (typeof snap.data === 'function' ? snap.data() : snap.data) as IntelligenceProcessingRun;
  }

  /**
   * Lists all execution attempt records for a specific task.
   */
  public async listRunsForTask(
    taskId: string,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceProcessingRun[]> {
    const effectiveDb = db !== undefined ? db : globalProcessingRunDb;
    if (!effectiveDb) {
      throw new Error('[ProcessingRunStore] Firestore database is not configured. Operational failure (Fail Closed).');
    }

    const snap = await effectiveDb
      .collection('intelligence_processing_runs')
      .where('taskId', '==', taskId)
      .get();

    if (snap && snap.docs) {
      const docs = snap.docs.map((d: any) => (typeof d.data === 'function' ? d.data() : d.data || d));
      return docs.sort((a: IntelligenceProcessingRun, b: IntelligenceProcessingRun) => (a.attempt || 0) - (b.attempt || 0));
    }
    return [];
  }

  /**
   * Lists all processing run records for a specific aggregate.
   */
  public async listRunsForAggregate(
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceProcessingRun[]> {
    const effectiveDb = db !== undefined ? db : globalProcessingRunDb;
    if (!effectiveDb) {
      throw new Error('[ProcessingRunStore] Firestore database is not configured. Operational failure (Fail Closed).');
    }

    const snap = await effectiveDb
      .collection('intelligence_processing_runs')
      .where('aggregateId', '==', aggregateId)
      .where('aggregateType', '==', aggregateType)
      .get();

    if (snap && snap.docs) {
      const docs = snap.docs.map((d: any) => (typeof d.data === 'function' ? d.data() : d.data || d));
      return docs.sort((a: IntelligenceProcessingRun, b: IntelligenceProcessingRun) =>
        (a.startedAt || '').localeCompare(b.startedAt || '')
      );
    }
    return [];
  }
}

export const processingRunStore = new IntelligenceProcessingRunStore();
