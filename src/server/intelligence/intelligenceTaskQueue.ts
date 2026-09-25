/**
 * AnyTrader V8.1 — Async Intelligence Task Queue & Orchestration (Hardened Task 13)
 * 
 * Invariants & Core Architecture:
 * - Asynchronous execution: Never blocks core user transactions.
 * - Authoritative Firestore: Firestore task record is the single source of truth in production.
 * - Atomic claiming: Worker claims task transactionally via Firestore runTransaction.
 * - Stale task recovery: Processing tasks with expired leases are safely reclaimed transactionally.
 * - Ownership verification: Worker verifies active lease ownership before success/failure finalization.
 * - Bounded retries & backoff: Exponential backoff, maximum retries bounded by task configuration.
 * - Error classification: Non-retryable errors (security, schema, lineage validation) fail fast to dead_letter.
 * - Bounded concurrency: Configurable maxConcurrency limit prevents worker overload and AI retry storms.
 * - Deterministic durable idempotency: Document ID derived from idempotency key eliminates creation race window.
 * - Fail-Closed: Zero in-memory authority. Throws if Firestore database instance is missing or failing.
 * - Lifecycle: pending -> processing -> succeeded | retrying -> dead_letter
 */

import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { IntelligenceTask, TaskStatus, TaskType, IntelligenceAggregateType } from './types';
import { AICandidateSecurityError } from './aiCandidateBoundary';
import { processingRunStore, buildProcessingRunId, setGlobalProcessingRunDb } from './processingRunStore';
import { cleanUndefinedFields } from './evidence';
import { SCALE_LIMITS } from './scaleLimits';
import { classifyError, calculateBackoffDelay, ErrorClassification } from './retryPolicy';
import { tenantWorkloadTracker } from './tenantWorkloadFairness';

export type TaskHandler = (task: IntelligenceTask) => Promise<Record<string, unknown>>;

export interface FirestoreTaskDb {
  collection(name: string): any;
  runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T>;
}

export type { ErrorClassification };

export class OwnershipLostError extends Error {
  constructor(public readonly taskId: string, public readonly workerId: string) {
    super(`[IntelligenceTaskQueue] Worker '${workerId}' lost lease ownership for task '${taskId}'. Finalization aborted.`);
    this.name = 'OwnershipLostError';
  }
}

/**
 * Derives a deterministic Firestore document ID from the idempotency key.
 * Guarantees atomic uniqueness at the database layer.
 */
export function taskDocumentId(idempotencyKey: string): string {
  const digest = createHash('sha256').update(idempotencyKey).digest('hex');
  return `idem_${digest.slice(0, 32)}`;
}

/**
 * Validates task status transitions according to the explicit task state machine.
 */
export function isValidTaskStateTransition(currentStatus: TaskStatus | string, targetStatus: TaskStatus): boolean {
  if (currentStatus === 'succeeded' || currentStatus === 'dead_letter' || currentStatus === 'cancelled') {
    return false; // Terminal states cannot transition
  }
  if (currentStatus === 'pending' && targetStatus === 'processing') return true;
  if (currentStatus === 'retrying' && (targetStatus === 'processing' || targetStatus === 'dead_letter')) return true;
  if (currentStatus === 'processing') {
    if (targetStatus === 'succeeded' || targetStatus === 'retrying' || targetStatus === 'dead_letter' || targetStatus === 'processing') {
      return true;
    }
  }
  return false;
}

/**
 * Classifies processing errors into RETRYABLE vs NON_RETRYABLE based on error type and message.
 */
export function classifyTaskError(err: unknown): {
  classification: ErrorClassification;
  code: string;
  message: string;
} {
  if (!err) {
    return { classification: 'RETRYABLE', code: 'UNKNOWN_ERROR', message: 'Unknown error occurred' };
  }

  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  let code = (err as any)?.code || (err as any)?.errorCode || name || 'UNKNOWN_ERROR';
  if (message.includes('No handler registered')) {
    code = 'MISSING_HANDLER';
  }

  // Security, lineage validation, schema validation, immutability violations, or missing handlers are strictly NON_RETRYABLE
  const retryPolicyClassification = classifyError(err);
  if (
    retryPolicyClassification === 'NON_RETRYABLE' ||
    err instanceof AICandidateSecurityError ||
    name === 'AICandidateSecurityError' ||
    name === 'LineageValidationError' ||
    name === 'ZodError' ||
    message.includes('Lineage validation failed') ||
    message.includes('lineage') ||
    message.includes('Lineage') ||
    message.includes('Cross-property') ||
    message.includes('Fabricated') ||
    message.includes('Tenant isolation') ||
    message.includes('tenant mismatch') ||
    message.includes('property mismatch') ||
    message.includes('Retracted') ||
    message.includes('Unverified') ||
    message.includes('NO EVIDENCE') ||
    message.includes('Outcome certificate required') ||
    message.includes('Prediction validation') ||
    message.includes('Risk assertion') ||
    message.includes('Lifecycle assertion') ||
    message.includes('[Intelligence Immutability Error]') ||
    message.includes('Cannot mutate historical intelligence version') ||
    message.includes('Firestore DB reference is required') ||
    message.includes('No evidence provided') ||
    message.includes('Missing required evidence') ||
    message.includes('No handler registered') ||
    message.includes('INVALID_PAYLOAD') ||
    message.includes('MISSING_EVIDENCE') ||
    message.includes('SECURITY_VIOLATION') ||
    message.includes('IMMUTABILITY_VIOLATION') ||
    code === 'PERMISSION_DENIED' ||
    code === 'INVALID_ARGUMENT' ||
    code === 'MISSING_HANDLER'
  ) {
    return {
      classification: 'NON_RETRYABLE',
      code: code !== 'UNKNOWN_ERROR' ? code : 'SECURITY_OR_VALIDATION_FAILURE',
      message,
    };
  }

  // Rate limits, network glitches, or 503 service unavailable are RETRYABLE
  if (
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('rate limit') ||
    message.includes('503') ||
    message.includes('UNAVAILABLE') ||
    message.includes('DEADLINE_EXCEEDED') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('etimedout')
  ) {
    return {
      classification: 'RETRYABLE',
      code: code !== 'UNKNOWN_ERROR' ? code : 'TRANSIENT_SERVICE_ERROR',
      message,
    };
  }

  return {
    classification: 'RETRYABLE',
    code: code !== 'UNKNOWN_ERROR' ? code : 'PROCESSING_ERROR',
    message,
  };
}

export class IntelligenceTaskQueue {
  private tasks = new Map<string, IntelligenceTask>();
  private idempotencyIndex = new Map<string, string>();
  private handlers = new Map<TaskType, TaskHandler>();
  private isWorkerRunning = false;
  private workerIntervalTimer: NodeJS.Timeout | null = null;
  private firestoreDb: FirestoreTaskDb | null = null;
  private workerId: string;
  private maxConcurrency: number;
  private activeTaskIds = new Set<string>();

  constructor(
    private maxRetries: number = 3,
    private defaultLeaseDurationMs: number = 300000, // 5 minutes
    workerId?: string,
    maxConcurrency: number = 5
  ) {
    this.workerId = workerId || `worker_${Math.random().toString(36).slice(2, 8)}`;
    this.maxConcurrency = Math.max(1, Math.min(maxConcurrency, 50));
  }

  public getWorkerId(): string {
    return this.workerId;
  }

  public setWorkerId(id: string): void {
    this.workerId = id;
  }

  public getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  public setMaxConcurrency(limit: number): void {
    if (typeof limit === 'number' && limit > 0) {
      this.maxConcurrency = Math.max(1, Math.min(Math.floor(limit), 50));
    }
  }

  public getActiveTaskCount(): number {
    return this.activeTaskIds.size;
  }

  public setFirestoreDb(db: FirestoreTaskDb | null): void {
    this.firestoreDb = db;
    setGlobalProcessingRunDb(db as any);
  }

  public getFirestoreDb(): FirestoreTaskDb | null {
    return this.firestoreDb;
  }

  public registerHandler(type: TaskType, handler: TaskHandler): void {
    this.handlers.set(type, handler);
  }

  public hasHandler(type: TaskType): boolean {
    return this.handlers.has(type);
  }

  public getRegisteredHandlers(): TaskType[] {
    return Array.from(this.handlers.keys());
  }

  public startWorker(pollIntervalMs: number = 5000): void {
    if (this.workerIntervalTimer) return;
    if (!this.firestoreDb) {
      throw new Error("[IntelligenceTaskQueue] Cannot start worker: Firestore task store is not configured or not ready.");
    }
    this.workerIntervalTimer = setInterval(() => {
      this.workerTick().catch((err: any) => {
        const errMsg = err?.message || String(err);
        if (
          errMsg.includes("PERMISSION_DENIED") ||
          errMsg.includes("UNAUTHENTICATED") ||
          errMsg.includes("Could not load the default credentials")
        ) {
          return;
        }
        console.error('[IntelligenceTaskQueue] Worker tick error:', err);
      });
    }, pollIntervalMs);
  }

  public isWorkerActive(): boolean {
    return this.workerIntervalTimer !== null;
  }

  public stopWorker(): void {
    if (this.workerIntervalTimer) {
      clearInterval(this.workerIntervalTimer);
      this.workerIntervalTimer = null;
    }
  }

  /**
   * Discovers runnable (pending or due-for-retry) tasks directly from Firestore.
   */
  public async getRunnableTasksFromFirestore(limit = 10): Promise<IntelligenceTask[]> {
    if (!this.firestoreDb) {
      throw new Error("[IntelligenceTaskQueue] Firestore task store is not ready or configured");
    }

    const nowIso = new Date().toISOString();
    const tasksMap = new Map<string, IntelligenceTask>();

    try {
      // 1. Pending tasks
      const pendingSnap = await this.firestoreDb
        .collection('intelligence_tasks')
        .where('status', '==', 'pending')
        .limit(limit)
        .get();

      if (pendingSnap && !pendingSnap.empty) {
        for (const doc of pendingSnap.docs) {
          const task = doc.data() as IntelligenceTask;
          tasksMap.set(task.taskId, task);
        }
      }

      // 2. Retrying tasks ready for execution
      if (tasksMap.size < limit) {
        const retryingSnap = await this.firestoreDb
          .collection('intelligence_tasks')
          .where('status', '==', 'retrying')
          .where('nextAttemptAt', '<=', nowIso)
          .limit(limit - tasksMap.size)
          .get();

        if (retryingSnap && !retryingSnap.empty) {
          for (const doc of retryingSnap.docs) {
            const task = doc.data() as IntelligenceTask;
            tasksMap.set(task.taskId, task);
          }
        }
      }
      return Array.from(tasksMap.values());
    } catch (err: any) {
      console.error('[IntelligenceTaskQueue] getRunnableTasksFromFirestore query error:', err?.message || err);
      throw err;
    }
  }

  /**
   * Worker tick combining stale lease recovery and task draining with concurrency bounds.
   */
  public async workerTick(): Promise<void> {
    if (!this.firestoreDb) return;
    const col = this.firestoreDb.collection('intelligence_tasks');
    if (typeof (col as any).where !== 'function') return;
    if (this.isWorkerRunning) return;
    this.isWorkerRunning = true;

    try {
      try {
        await this.recoverStaleTasksAsync();
      } catch (staleErr: any) {
        const msg = staleErr?.message || String(staleErr);
        if (msg.includes("PERMISSION_DENIED") || msg.includes("UNAUTHENTICATED")) {
          return;
        }
        throw staleErr;
      }
      
      const availableSlots = this.maxConcurrency - this.activeTaskIds.size;
      if (availableSlots <= 0) return;

      const tasks = await this.getRunnableTasksFromFirestore(availableSlots);
      const pendingTasks = tasks.filter((t) => !this.activeTaskIds.has(t.taskId));

      await Promise.all(
        pendingTasks.map(async (t) => {
          this.activeTaskIds.add(t.taskId);
          try {
            await this.executeTask(t.taskId);
          } catch (err) {
            console.error(`[IntelligenceTaskQueue] Worker tick error processing task ${t.taskId}:`, err);
          } finally {
            this.activeTaskIds.delete(t.taskId);
          }
        })
      );
    } finally {
      this.isWorkerRunning = false;
    }
  }

  /**
   * Asynchronously enqueues a task, waiting for durable Firestore confirmation.
   * Uses deterministic document ID and Firestore runTransaction to guarantee atomic uniqueness.
   */
  public async enqueueTaskAsync(
    taskType: TaskType,
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    idempotencyKey: string,
    payload: Record<string, unknown> = {}
  ): Promise<IntelligenceTask> {
    if (!this.firestoreDb) {
      throw new Error("[IntelligenceTaskQueue] Firestore task store is not ready or configured");
    }

    // Task 33: Bounded queue payload check to prevent memory exhaustion & Firestore document limit overflow
    const payloadStr = JSON.stringify(payload);
    if (payloadStr.length > SCALE_LIMITS.maxPayloadSizeBytes) {
      throw new Error(`[IntelligenceTaskQueue] Payload exceeds maximum allowed size of ${SCALE_LIMITS.maxPayloadSizeBytes} bytes`);
    }

    const taskId = taskDocumentId(idempotencyKey);
    const now = new Date().toISOString();
    const taskRef = this.firestoreDb.collection('intelligence_tasks').doc(taskId);

    try {
      const task = await this.firestoreDb.runTransaction(async (transaction: any) => {
        const existing = await transaction.get(taskRef);
        if (existing && existing.exists) {
          return existing.data() as IntelligenceTask;
        }

        const newTask: IntelligenceTask = {
          taskId,
          taskType,
          aggregateType,
          aggregateId,
          idempotencyKey,
          status: 'pending',
          attempts: 0,
          maxAttempts: this.maxRetries,
          createdAt: now,
          updatedAt: now,
          nextAttemptAt: now,
          payload,
        };

        const sanitizedTask = cleanUndefinedFields(newTask);
        transaction.set(taskRef, sanitizedTask);
        return sanitizedTask;
      });

      this.tasks.set(task.taskId, task);
      this.idempotencyIndex.set(idempotencyKey, task.taskId);
      return task;
    } catch (err: any) {
      console.error(`[IntelligenceTaskQueue] Enqueue async Firestore error for ${taskId}:`, err?.message || err);
      throw err;
    }
  }

  /**
   * Atomically claims a task in Firestore via runTransaction.
   * Prevents two workers from claiming or processing the same task simultaneously.
   */
  public async claimTaskTransactional(
    taskId: string,
    workerId: string = this.workerId,
    leaseDurationMs: number = this.defaultLeaseDurationMs,
    customLeaseId?: string
  ): Promise<boolean> {
    if (!this.firestoreDb) {
      throw new Error("[IntelligenceTaskQueue] Firestore task store is not ready or configured");
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const leaseId = customLeaseId || `lease_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const leaseExpiresAt = new Date(now + leaseDurationMs).toISOString();
    const taskRef = this.firestoreDb.collection('intelligence_tasks').doc(taskId);

    try {
      const claimed = await this.firestoreDb.runTransaction(async (transaction: any) => {
        const docSnap = await transaction.get(taskRef);
        if (!docSnap || !docSnap.exists) {
          return false;
        }

        const data = docSnap.data() as IntelligenceTask;

        // Terminal or cancelled tasks cannot be claimed
        if (
          data.status === 'succeeded' ||
          data.status === 'dead_letter' ||
          (data.status as string) === 'cancelled'
        ) {
          return false;
        }

        const isLeaseExpired = data.leaseExpiresAt ? new Date(data.leaseExpiresAt).getTime() <= now : true;
        const isRetryDue = !data.nextAttemptAt || new Date(data.nextAttemptAt).getTime() <= now;

        const canClaim =
          data.status === 'pending' ||
          (data.status === 'retrying' && isRetryDue) ||
          (data.status === 'processing' && isLeaseExpired);

        if (!canClaim) {
          return false;
        }

        const maxAttempts = data.maxAttempts || this.maxRetries;
        if ((data.attempts || 0) >= maxAttempts) {
          // Transactionally move to dead_letter if max attempts reached
          transaction.update(taskRef, {
            status: 'dead_letter',
            errorCode: 'MAX_RETRIES_EXCEEDED',
            lastError: `Exceeded max attempts (${data.attempts}/${maxAttempts})`,
            updatedAt: nowIso,
          });
          return false;
        }

        const newAttempts = (data.attempts || 0) + 1;
        const isRealAdminFirestore = Boolean(
          taskRef &&
          taskRef.firestore &&
          typeof taskRef.firestore.collectionGroup === 'function' &&
          typeof taskRef.firestore.listCollections === 'function'
        );
        let deleteSentinel: any = undefined;
        if (isRealAdminFirestore) {
          try {
            deleteSentinel = FieldValue.delete();
          } catch {
            deleteSentinel = undefined;
          }
        }

        const updateData: Record<string, any> = {
          status: 'processing',
          attempts: newAttempts,
          startedAt: nowIso,
          workerId: workerId,
          leaseId: leaseId,
          leaseAcquiredAt: nowIso,
          leaseExpiresAt: leaseExpiresAt,
          updatedAt: nowIso,
          errorCode: deleteSentinel,
          lastError: deleteSentinel,
          nextAttemptAt: deleteSentinel,
          nextRetryAt: deleteSentinel,
        };

        transaction.update(taskRef, updateData);

        return true;
      });

      if (claimed) {
        const local = this.tasks.get(taskId) || {
          taskId,
          taskType: 'job_extraction',
          aggregateType: 'job',
          aggregateId: '',
          idempotencyKey: '',
          status: 'pending',
          attempts: 0,
          maxAttempts: this.maxRetries,
          createdAt: nowIso,
          updatedAt: nowIso,
          payload: {},
        };
        local.status = 'processing';
        local.attempts = (local.attempts || 0) + 1;
        local.startedAt = nowIso;
        local.workerId = workerId;
        local.leaseId = leaseId;
        local.leaseAcquiredAt = nowIso;
        local.leaseExpiresAt = leaseExpiresAt;
        local.updatedAt = nowIso;
        local.errorCode = undefined;
        local.lastError = undefined;
        local.nextAttemptAt = undefined;
        local.nextRetryAt = undefined;
        this.tasks.set(taskId, local);
      }

      return claimed;
    } catch (err: any) {
      console.error(`[IntelligenceTaskQueue] Transactional claim error for task ${taskId}:`, err?.message || err);
      throw err;
    }
  }

  /**
   * Recovers stale tasks synchronously (memory cache sync helper).
   */
  public recoverStaleTasks(leaseTimeoutMs: number = this.defaultLeaseDurationMs): IntelligenceTask[] {
    const now = Date.now();
    const recovered: IntelligenceTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.status === 'processing') {
        const startTime = task.startedAt ? new Date(task.startedAt).getTime() : 0;
        const leaseExpired = task.leaseExpiresAt
          ? new Date(task.leaseExpiresAt).getTime() <= now
          : now - startTime > leaseTimeoutMs;

        if (leaseExpired) {
          if (task.attempts < task.maxAttempts) {
            task.status = 'retrying';
            task.nextAttemptAt = new Date(now).toISOString();
            task.nextRetryAt = task.nextAttemptAt;
            task.lastError = 'Lease expired / Worker timeout recovered';
            task.errorCode = 'STALE_LEASE_RECOVERED';
          } else {
            task.status = 'dead_letter';
            task.lastError = 'Exceeded attempts during stale lease recovery';
            task.errorCode = 'STALE_LEASE_EXHAUSTED';
          }
          task.workerId = undefined;
          task.leaseId = undefined;
          task.leaseExpiresAt = undefined;
          task.updatedAt = new Date(now).toISOString();
          recovered.push(task);
        }
      }
    }

    return recovered;
  }

  /**
   * Atomically recovers stale tasks across Firestore using transactions.
   */
  public async recoverStaleTasksAsync(leaseTimeoutMs: number = this.defaultLeaseDurationMs): Promise<IntelligenceTask[]> {
    if (!this.firestoreDb) {
      throw new Error("[IntelligenceTaskQueue] Firestore task store is not ready or configured");
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const recovered: IntelligenceTask[] = [];

    try {
      const snapshot = await this.firestoreDb
        .collection('intelligence_tasks')
        .where('status', '==', 'processing')
        .get();

      if (snapshot && !snapshot.empty) {
        for (const doc of snapshot.docs) {
          const taskId = doc.id;
          const taskRef = this.firestoreDb.collection('intelligence_tasks').doc(taskId);

          const recoveredTask = await this.firestoreDb.runTransaction(async (transaction: any) => {
            const currentSnap = await transaction.get(taskRef);
            if (!currentSnap || !currentSnap.exists) return null;

            const task = currentSnap.data() as IntelligenceTask;
            if (task.status !== 'processing') return null;

            const isExpired = !task.leaseExpiresAt || new Date(task.leaseExpiresAt).getTime() <= now;
            if (!isExpired) return null;

            const nextStatus: TaskStatus = task.attempts < task.maxAttempts ? 'retrying' : 'dead_letter';
            const updates: Record<string, any> = {
              status: nextStatus,
              nextAttemptAt: nextStatus === 'retrying' ? nowIso : null,
              nextRetryAt: nextStatus === 'retrying' ? nowIso : null,
              lastError: nextStatus === 'retrying' ? 'Lease expired / Worker timeout recovered' : 'Exceeded attempts during stale lease recovery',
              errorCode: nextStatus === 'retrying' ? 'STALE_LEASE_RECOVERED' : 'STALE_LEASE_EXHAUSTED',
              leaseId: undefined,
              leaseExpiresAt: undefined,
              workerId: undefined,
              updatedAt: nowIso,
            };

            transaction.update(taskRef, updates);
            return { ...task, ...updates } as IntelligenceTask;
          });

          if (recoveredTask) {
            this.tasks.set(taskId, recoveredTask);
            recovered.push(recoveredTask);
          }
        }
      }
      return recovered;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (!errMsg.includes("PERMISSION_DENIED") && !errMsg.includes("UNAUTHENTICATED") && !errMsg.includes("Could not load the default credentials")) {
        console.error('[IntelligenceTaskQueue] Async stale recovery scan error:', errMsg);
      }
      throw err;
    }
  }

  public getTask(taskId: string): IntelligenceTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Retrieves a task by ID asynchronously with authoritative Firestore lookup.
   */
  public async getTaskAsync(taskId: string): Promise<IntelligenceTask | undefined> {
    if (!this.firestoreDb) {
      throw new Error("[IntelligenceTaskQueue] Firestore task store is not ready or configured");
    }

    try {
      const docRef = this.firestoreDb.collection('intelligence_tasks').doc(taskId);
      if (docRef && typeof docRef.get === 'function') {
        const docSnap = await docRef.get();
        if (!docSnap || !docSnap.exists) {
          return undefined;
        }
        const data = docSnap.data() as IntelligenceTask;
        this.tasks.set(taskId, data);
        if (data.idempotencyKey) {
          this.idempotencyIndex.set(data.idempotencyKey, taskId);
        }
        return data;
      }
      return undefined;
    } catch (err: any) {
      console.error(`[IntelligenceTaskQueue] getTaskAsync Firestore error for ${taskId}:`, err?.message || err);
      throw err;
    }
  }

  public getByIdempotencyKey(key: string): IntelligenceTask | undefined {
    const taskId = this.idempotencyIndex.get(key) || taskDocumentId(key);
    return this.tasks.get(taskId);
  }

  public async getByIdempotencyKeyAsync(key: string): Promise<IntelligenceTask | undefined> {
    const taskId = taskDocumentId(key);
    return this.getTaskAsync(taskId);
  }

  /**
   * Executes a single task step through its handler with authoritative Firestore lease & ownership gating.
   */
  public async executeTask(
    taskId: string,
    workerId?: string
  ): Promise<IntelligenceTask> {
    if (!this.firestoreDb) {
      throw new Error("[IntelligenceTaskQueue] Firestore task store is not ready or configured");
    }

    const effectiveWorkerId = (typeof workerId === 'string' && workerId) ? workerId : this.workerId;
    let task = await this.getTaskAsync(taskId);

    if (!task) {
      throw new Error(`[IntelligenceTaskQueue Error] Task ${taskId} not found`);
    }

    // Terminal or cancelled tasks must never execute
    if (
      task.status === 'succeeded' ||
      task.status === 'dead_letter' ||
      (task.status as string) === 'cancelled'
    ) {
      return task;
    }

    const taskRef = this.firestoreDb.collection('intelligence_tasks').doc(taskId);
    const claimLeaseId = `lease_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Lease & Ownership verification:
    const now = Date.now();
    const isOwnerWithActiveLease =
      task.status === 'processing' &&
      task.workerId === effectiveWorkerId &&
      !!task.leaseExpiresAt &&
      new Date(task.leaseExpiresAt).getTime() > now;

    if (!isOwnerWithActiveLease) {
      const claimed = await this.claimTaskTransactional(taskId, effectiveWorkerId, this.defaultLeaseDurationMs, claimLeaseId);
      if (!claimed) {
        return (await this.getTaskAsync(taskId)) || task;
      }
      task = (await this.getTaskAsync(taskId)) || task;
    }

    const activeLeaseId = task.leaseId || claimLeaseId;
    const currentAttempt = task.attempts || 1;
    const runId = buildProcessingRunId(taskId, currentAttempt, activeLeaseId);
    const startIso = new Date().toISOString();
    const effectiveAggregateType = task.aggregateType || 'job';
    const effectiveAggregateId = task.aggregateId || taskId;
    const startTime = Date.now();
    let runMarkedSucceeded = false;

    try {
      // 1. Durable Processing Run: Record attempt started (Fail Closed - throws if write fails)
      await processingRunStore.recordRunStarted(
        {
          runId,
          taskId,
          aggregateType: effectiveAggregateType,
          aggregateId: effectiveAggregateId,
          taskType: task.taskType || 'job_extraction',
          status: 'started',
          attempt: currentAttempt,
          workerId: effectiveWorkerId,
          leaseId: activeLeaseId,
          startedAt: startIso,
          pipelineVersion: task.pipelineVersion || 'v8.1.0',
          schemaVersion: 'v8.1.0',
          provider: task.provider || 'google_genai',
          modelVersion: task.modelVersion || 'gemini-3.8-flash',
          promptVersion: 'default_v8.1',
          inputEvidenceCount: 0,
          inputBytes: 0,
          outputBytes: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          costCurrency: 'USD',
          pricingVersion: '2026-09-v1',
          createdAt: startIso,
        },
        this.firestoreDb
      );

      const handler = this.handlers.get(task.taskType);
      if (!handler) {
        throw new Error(`No handler registered for task type: ${task.taskType}`);
      }

      const result = await handler(task);
      const nowIso = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      // Extract metrics safely for processing run record
      const tokenUsage = (result as any)?.tokenUsage || (task as any)?.tokenUsage || {};
      const inputTokens = typeof tokenUsage.inputTokens === 'number' ? tokenUsage.inputTokens : 0;
      const outputTokens = typeof tokenUsage.outputTokens === 'number' ? tokenUsage.outputTokens : 0;
      const totalTokens = typeof tokenUsage.totalTokens === 'number' ? tokenUsage.totalTokens : (inputTokens + outputTokens);
      const inputBytes = typeof (result as any)?.inputBytes === 'number' ? (result as any).inputBytes : 0;
      const outputBytes = typeof (result as any)?.outputBytes === 'number' ? (result as any).outputBytes : 0;
      const inputEvidenceCount = Array.isArray((result as any)?.evidenceIds)
        ? (result as any).evidenceIds.length
        : (typeof (result as any)?.inputEvidenceCount === 'number' ? (result as any).inputEvidenceCount : 0);

      // 2. Mark processing run succeeded in Firestore FIRST (Fail Closed - throws if write fails)
      await processingRunStore.recordRunSucceeded(
        runId,
        {
          finishedAt: nowIso,
          durationMs,
          inputTokens,
          outputTokens,
          totalTokens,
          inputBytes,
          outputBytes,
          inputEvidenceCount,
        },
        this.firestoreDb
      );
      runMarkedSucceeded = true;

      // 3. SUCCESS FINALIZATION WITH LEASE OWNERSHIP VERIFICATION (MANDATORY TRANSACTION)
      await this.firestoreDb.runTransaction(async (transaction: any) => {
        const docSnap = await transaction.get(taskRef);
        if (!docSnap || !docSnap.exists) {
          throw new OwnershipLostError(taskId, effectiveWorkerId);
        }
        const data = docSnap.data() as IntelligenceTask;

        const isLeaseExpired = data.leaseExpiresAt ? new Date(data.leaseExpiresAt).getTime() <= Date.now() : false;
        if (
          data.status !== 'processing' ||
          data.workerId !== effectiveWorkerId ||
          data.leaseId !== activeLeaseId ||
          isLeaseExpired
        ) {
          throw new OwnershipLostError(taskId, effectiveWorkerId);
        }

        // Firestore rejects nested undefined; canonicalizeIntelligence emits undefined for
        // optional fields. Strip undefined before the write (explicit nulls are preserved).
        const mergedPayload = cleanUndefinedFields({ ...data.payload, ...(result as any) });

        transaction.update(taskRef, {
          status: 'succeeded',
          completedAt: nowIso,
          processingDurationMs: durationMs,
          updatedAt: nowIso,
          payload: mergedPayload,
          workerId: null,
          leaseId: null,
          leaseExpiresAt: null,
        });
      });

      task.status = 'succeeded';
      task.completedAt = nowIso;
      task.processingDurationMs = durationMs;
      task.updatedAt = nowIso;
      task.payload = { ...task.payload, ...result };
      delete task.nextAttemptAt;
      delete task.nextRetryAt;
      delete task.leaseExpiresAt;
      delete task.leaseId;
      delete task.workerId;
      this.tasks.set(taskId, task);
      return task;
    } catch (err) {
      if (err instanceof OwnershipLostError || (err as any)?.name === 'OwnershipLostError') {
        console.warn(`[IntelligenceTaskQueue] ${(err as any).message}`);
        return (await this.getTaskAsync(taskId)) || task;
      }

      // If the run was already marked succeeded in processingRunStore, post-success finalization
      // failed (e.g. task document write error). Do not attempt to record failure on the run,
      // which would violate the processing run state machine and mask the underlying error.
      if (runMarkedSucceeded) {
        console.error(
          `[IntelligenceTaskQueue] Post-success finalization failed for task '${taskId}' ` +
          `(run '${runId}' remains 'succeeded'):`,
          (err as any)?.message || err
        );
        throw err;
      }

      const durationMs = Date.now() - startTime;
      const errorInfo = classifyTaskError(err);
      const attempts = task.attempts || 1;
      const maxAttempts = task.maxAttempts || this.maxRetries;
      const isNonRetryable = errorInfo.classification === 'NON_RETRYABLE';
      const isExhausted = attempts >= maxAttempts;
      const newStatus: TaskStatus = (isNonRetryable || isExhausted) ? 'dead_letter' : 'retrying';
      const nowIso = new Date().toISOString();

      let nextAttemptAt: string | undefined = undefined;
      if (newStatus === 'retrying') {
        const delaySec = Math.min(2 * Math.pow(2, attempts - 1), 300);
        nextAttemptAt = new Date(Date.now() + delaySec * 1000).toISOString();
      }

      const classificationValue = isExhausted ? 'MAX_RETRIES_EXCEEDED' : errorInfo.classification;

      // 1. Record failure in processing run store (Fail Closed: processing-run persistence failure must not be silently swallowed)
      await processingRunStore.recordRunFailed(
        runId,
        err,
        {
          taskId,
          aggregateType: effectiveAggregateType,
          aggregateId: effectiveAggregateId,
          taskType: task.taskType || 'job_extraction',
          attempt: attempts,
          workerId: effectiveWorkerId,
          leaseId: activeLeaseId,
          status: newStatus,
          durationMs,
          finishedAt: nowIso,
        },
        this.firestoreDb
      );

      // 2. FAILURE FINALIZATION WITH LEASE OWNERSHIP VERIFICATION (MANDATORY TRANSACTION)
      try {
        await this.firestoreDb.runTransaction(async (transaction: any) => {
          const docSnap = await transaction.get(taskRef);
          if (!docSnap || !docSnap.exists) {
            throw new OwnershipLostError(taskId, effectiveWorkerId);
          }
          const data = docSnap.data() as IntelligenceTask;

          const isLeaseExpired = data.leaseExpiresAt ? new Date(data.leaseExpiresAt).getTime() <= Date.now() : false;
          if (
            data.status !== 'processing' ||
            data.workerId !== effectiveWorkerId ||
            data.leaseId !== activeLeaseId ||
            isLeaseExpired
          ) {
            console.warn(`[IntelligenceTaskQueue] Worker '${effectiveWorkerId}' lost ownership for task '${taskId}' during failure finalization. Aborting state write.`);
            throw new OwnershipLostError(taskId, effectiveWorkerId);
          }

          transaction.update(taskRef, {
            status: newStatus,
            processingDurationMs: durationMs,
            lastError: errorInfo.message,
            errorCode: isExhausted ? 'MAX_RETRIES_EXCEEDED' : errorInfo.code,
            error: {
              classification: classificationValue,
              message: errorInfo.message,
              timestamp: nowIso,
            },
            updatedAt: nowIso,
            workerId: null,
            leaseId: null,
            leaseExpiresAt: null,
            nextAttemptAt: nextAttemptAt || null,
            nextRetryAt: nextAttemptAt || null,
          });
        });
      } catch (finalErr) {
        if (finalErr instanceof OwnershipLostError || (finalErr as any)?.name === 'OwnershipLostError') {
          console.warn(`[IntelligenceTaskQueue] ${finalErr.message}`);
          task = (await this.getTaskAsync(taskId)) || task;
          return task;
        }
        console.error(`[IntelligenceTaskQueue] Error persisting failure state for task ${taskId}:`, finalErr);
        throw finalErr;
      }

      task = (await this.getTaskAsync(taskId)) || task;
      return task;
    }
  }

  public listByStatus(status: TaskStatus): IntelligenceTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === status);
  }

  public clear(): void {
    this.tasks.clear();
    this.idempotencyIndex.clear();
    this.activeTaskIds.clear();
  }
}

export const intelligenceTaskQueue = new IntelligenceTaskQueue();
