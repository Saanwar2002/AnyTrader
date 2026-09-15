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

/**
 * Validates that an object contains no forbidden privacy-violating attributes.
 */
export function validateRunPrivacy(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    const lowerKey = key.toLowerCase();
    for (const forbidden of FORBIDDEN_PRIVACY_KEYS) {
      if (lowerKey === forbidden.toLowerCase() || lowerKey.includes(forbidden.toLowerCase())) {
        throw new ProcessingRunPrivacyViolationError(
          `Processing run record contains forbidden privacy-violating field '${key}'. Raw AI data/secrets must not be stored.`
        );
      }
    }
  }

  // Check diagnostic for raw prompts or keys
  if (record.sanitizedDiagnostic && typeof record.sanitizedDiagnostic === 'string') {
    if (
      record.sanitizedDiagnostic.includes('AIza') ||
      record.sanitizedDiagnostic.includes('sk-') ||
      record.sanitizedDiagnostic.includes('Bearer ')
    ) {
      throw new ProcessingRunPrivacyViolationError(
        'Sanitized diagnostic contains sensitive key or auth tokens. Redaction required.'
      );
    }
  }
}

/**
 * Strictly validates a complete IntelligenceProcessingRun record against the schema.
 */
export function validateProcessingRunRecord(run: Partial<IntelligenceProcessingRun>): IntelligenceProcessingRun {
  if (!run.runId || typeof run.runId !== 'string' || run.runId.trim().length === 0) {
    throw new ProcessingRunValidationError("Missing required field 'runId'");
  }
  if (!run.taskId || typeof run.taskId !== 'string' || run.taskId.trim().length === 0) {
    throw new ProcessingRunValidationError("Missing required field 'taskId'");
  }
  if (!run.aggregateType || typeof run.aggregateType !== 'string' || run.aggregateType.trim().length === 0) {
    throw new ProcessingRunValidationError("Missing required field 'aggregateType'");
  }
  if (!run.aggregateId || typeof run.aggregateId !== 'string' || run.aggregateId.trim().length === 0) {
    throw new ProcessingRunValidationError("Missing required field 'aggregateId'");
  }
  if (!run.taskType || typeof run.taskType !== 'string' || run.taskType.trim().length === 0) {
    throw new ProcessingRunValidationError("Missing required field 'taskType'");
  }
  if (!run.status || !VALID_STATUSES.has(run.status as ProcessingRunStatus)) {
    throw new ProcessingRunValidationError(`Invalid processing run status: '${run.status}'`);
  }
  if (typeof run.attempt !== 'number' || run.attempt < 1 || !Number.isInteger(run.attempt) || Number.isNaN(run.attempt) || !Number.isFinite(run.attempt)) {
    throw new ProcessingRunValidationError(`Invalid attempt: '${run.attempt}'. Must be an integer >= 1.`);
  }
  if (!run.workerId || typeof run.workerId !== 'string' || run.workerId.trim().length === 0) {
    throw new ProcessingRunValidationError("Missing required field 'workerId'");
  }
  if (!run.leaseId || typeof run.leaseId !== 'string' || run.leaseId.trim().length === 0) {
    throw new ProcessingRunValidationError("Missing required field 'leaseId'");
  }
  if (!run.startedAt || typeof run.startedAt !== 'string' || run.startedAt.trim().length === 0) {
    throw new ProcessingRunValidationError("Missing required field 'startedAt'");
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
      costCurrency: run.costCurrency,
      pricingVersion: run.pricingVersion,
    },
    run.provider || 'google_genai',
    run.modelVersion || 'gemini-3.8-flash'
  );

  // Validate privacy & data minimization
  validateRunPrivacy(run as Record<string, unknown>);

  const now = new Date().toISOString();

  const validated: IntelligenceProcessingRun = {
    runId: run.runId.trim(),
    taskId: run.taskId.trim(),
    aggregateType: run.aggregateType as IntelligenceAggregateType,
    aggregateId: run.aggregateId.trim(),
    taskType: run.taskType.trim(),
    status: run.status as ProcessingRunStatus,
    attempt: run.attempt,
    workerId: run.workerId.trim(),
    leaseId: run.leaseId.trim(),
    startedAt: run.startedAt.trim(),
    finishedAt: run.finishedAt ? String(run.finishedAt).trim() : undefined,
    durationMs: run.durationMs !== undefined ? normalizedMetrics.durationMs : undefined,
    pipelineVersion: run.pipelineVersion ? String(run.pipelineVersion).trim() : 'v8.1.0',
    schemaVersion: run.schemaVersion ? String(run.schemaVersion).trim() : 'v8.1.0',
    provider: run.provider ? String(run.provider).trim() : 'google_genai',
    modelVersion: run.modelVersion ? String(run.modelVersion).trim() : 'gemini-3.8-flash',
    promptVersion: run.promptVersion ? String(run.promptVersion).trim() : 'default_v8.1',
    inputEvidenceCount: normalizedMetrics.inputEvidenceCount,
    inputBytes: normalizedMetrics.inputBytes,
    outputBytes: normalizedMetrics.outputBytes,
    inputTokens: normalizedMetrics.inputTokens,
    outputTokens: normalizedMetrics.outputTokens,
    totalTokens: normalizedMetrics.totalTokens,
    estimatedCost: normalizedMetrics.estimatedCost,
    costCurrency: normalizedMetrics.costCurrency || DEFAULT_COST_CURRENCY,
    pricingVersion: normalizedMetrics.pricingVersion || DEFAULT_PRICING_VERSION,
    errorCode: run.errorCode ? String(run.errorCode).trim() : undefined,
    errorClass: run.errorClass ? String(run.errorClass).trim() : undefined,
    retryable: typeof run.retryable === 'boolean' ? run.retryable : undefined,
    sanitizedDiagnostic: run.sanitizedDiagnostic ? String(run.sanitizedDiagnostic).trim() : undefined,
    createdAt: run.createdAt ? String(run.createdAt).trim() : now,
  };

  return validated;
}

export class IntelligenceProcessingRunStore {
  /**
   * Records the initial 'started' execution attempt record in Firestore.
   * Fails closed if Firestore is unavailable.
   */
  public async recordRunStarted(
    runInput: Partial<IntelligenceProcessingRun>,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceProcessingRun> {
    const effectiveDb = db !== undefined ? db : globalProcessingRunDb;
    if (!effectiveDb || typeof effectiveDb.runTransaction !== 'function') {
      throw new Error('[ProcessingRunStore] Firestore database or transaction support is unavailable (Fail Closed).');
    }

    const runId = runInput.runId || (
      runInput.taskId && runInput.attempt && runInput.leaseId
        ? buildProcessingRunId(runInput.taskId, runInput.attempt, runInput.leaseId)
        : undefined
    );

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

    await effectiveDb.runTransaction(async (transaction: any) => {
      if (!transaction || typeof transaction.set !== 'function') {
        throw new Error('[ProcessingRunStore] Transaction object missing set method (Fail Closed).');
      }
      const snap = typeof transaction.get === 'function' ? await transaction.get(docRef) : null;
      if (snap && snap.exists) {
        transaction.set(docRef, sanitized, { merge: true });
      } else {
        transaction.set(docRef, sanitized);
      }
    });

    return validated;
  }

  /**
   * Marks a processing execution record as 'succeeded' after immutable intelligence persistence confirms.
   * Fails closed if Firestore is unavailable.
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
      };

      const validated = validateProcessingRunRecord(mergedRaw);
      const sanitized = cleanUndefinedFields(validated);
      transaction.set(docRef, sanitized, { merge: true });
      return validated;
    });
  }

  /**
   * Marks a processing execution record as 'failed' / 'retrying' / 'dead_letter' with sanitized error telemetry.
   * Fails closed if Firestore is unavailable.
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
        : {
            runId,
            taskId: updates?.taskId || 'unknown_task',
            aggregateType: updates?.aggregateType || 'job',
            aggregateId: updates?.aggregateId || 'unknown',
            taskType: updates?.taskType || 'job_extraction',
            status: 'started',
            attempt: updates?.attempt || 1,
            workerId: updates?.workerId || 'unknown_worker',
            leaseId: updates?.leaseId || 'unknown_lease',
            startedAt: updates?.startedAt || now,
            createdAt: now,
            ...(updates || {}),
          };

      const startedAtTime = new Date(existing.startedAt || now).getTime();
      const finishedAt = updates?.finishedAt || now;
      const durationMs = updates?.durationMs !== undefined
        ? validateNonNegativeFiniteNumber(updates.durationMs, 'durationMs', 86_400_000)
        : Math.max(0, new Date(finishedAt).getTime() - startedAtTime);

      const targetStatus: ProcessingRunStatus = updates?.status && VALID_STATUSES.has(updates.status as ProcessingRunStatus)
        ? (updates.status as ProcessingRunStatus)
        : (errorClassification.retryable ? 'retrying' : 'dead_letter');

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
      };

      const validated = validateProcessingRunRecord(mergedRaw);
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
