/**
 * AnyTrader V8.1 — Async Intelligence Task Queue & Orchestration
 * 
 * Invariants:
 * - Asynchronous execution: Never blocks core user transactions.
 * - Authoritative Firestore: Firestore task record is the single source of truth in production.
 * - Atomic claiming: Worker claims task transactionally via Firestore runTransaction.
 * - Stale task recovery: Processing tasks with expired leases are safely reclaimed transactionally.
 * - Deterministic durable idempotency: Document ID derived from idempotency key eliminates creation race window.
 * - Worker discovery: Worker discovers pending/retrying tasks directly from Firestore after restart.
 * - Lifecycle: pending -> processing -> succeeded | retrying -> dead_letter
 * - Bounded retries: Exponential backoff, maximum 3 attempts by default.
 * - Zero Silent Failure: Critical Firestore writes throw/propagate rather than falsely succeeding.
 */

import { createHash } from 'node:crypto';
import { IntelligenceTask, TaskStatus, TaskType, IntelligenceAggregateType } from './types';

export type TaskHandler = (task: IntelligenceTask) => Promise<Record<string, unknown>>;

export interface FirestoreTaskDb {
  collection(name: string): any;
  runTransaction?<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T>;
}

/**
 * Derives a deterministic Firestore document ID from the idempotency key.
 * This guarantees atomic uniqueness at the database layer.
 */
export function taskDocumentId(idempotencyKey: string): string {
  const digest = createHash('sha256').update(idempotencyKey).digest('hex');
  return `idem_${digest.slice(0, 32)}`;
}

export class IntelligenceTaskQueue {
  /**
   * Local in-memory cache for fast lookups.
   * NEVER authoritative in production when Firestore is configured.
   */
  private tasks = new Map<string, IntelligenceTask>();
  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> taskId
  private handlers = new Map<TaskType, TaskHandler>();
  private isWorkerRunning = false;
  private workerIntervalTimer: NodeJS.Timeout | null = null;
  private firestoreDb: FirestoreTaskDb | null = null;
  private workerId: string;

  constructor(
    private maxRetries: number = 3,
    private defaultLeaseDurationMs: number = 300000, // 5 minutes
    workerId?: string
  ) {
    this.workerId = workerId || `worker_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Gets the worker identifier for this queue instance
   */
  public getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Sets the worker identifier for this queue instance
   */
  public setWorkerId(id: string): void {
    this.workerId = id;
  }

  /**
   * Sets the authoritative Firestore database instance for durable task persistence
   */
  public setFirestoreDb(db: FirestoreTaskDb | null): void {
    this.firestoreDb = db;
  }

  /**
   * Gets the current Firestore database instance
   */
  public getFirestoreDb(): FirestoreTaskDb | null {
    return this.firestoreDb;
  }

  /**
   * Registers a task handler for a specific task type
   */
  public registerHandler(type: TaskType, handler: TaskHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Checks if a handler is registered for the specified task type
   */
  public hasHandler(type: TaskType): boolean {
    return this.handlers.has(type);
  }

  /**
   * Gets list of registered handler task types
   */
  public getRegisteredHandlers(): TaskType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Starts the background worker loop discovering runnable tasks from Firestore.
   * Fails closed if Firestore database instance is not configured.
   * Idempotent if worker is already running.
   */
  public startWorker(pollIntervalMs: number = 5000): void {
    if (this.workerIntervalTimer) return;
    if (!this.firestoreDb) {
      throw new Error("[IntelligenceTaskQueue] Cannot start worker: Firestore task store is not configured or not ready.");
    }
    this.workerIntervalTimer = setInterval(() => {
      this.workerTick().catch((err) => {
        console.error('[IntelligenceTaskQueue] Worker tick error:', err);
      });
    }, pollIntervalMs);
  }

  /**
   * Returns whether the background worker is currently running
   */
  public isWorkerActive(): boolean {
    return this.workerIntervalTimer !== null;
  }

  /**
   * Stops the background worker loop
   */
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
      throw new Error("Firestore task store is not ready");
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
   * Drains runnable tasks directly from Firestore
   */
  private async drainFromFirestore(): Promise<void> {
    const tasks = await this.getRunnableTasksFromFirestore(10);
    for (const task of tasks) {
      try {
        await this.executeTask(task.taskId);
      } catch (error) {
        console.error(`[IntelligenceTaskQueue] Worker failed for task ${task.taskId}:`, error);
      }
    }
  }

  /**
   * Worker tick combining stale lease recovery and task draining
   */
  public async workerTick(): Promise<void> {
    if (!this.firestoreDb) {
      return;
    }
    if (this.isWorkerRunning) return;
    this.isWorkerRunning = true;

    try {
      await this.recoverStaleTasksAsync();
      await this.drainFromFirestore();
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
      throw new Error("Firestore task store is not ready");
    }

    const taskId = taskDocumentId(idempotencyKey);
    const now = new Date().toISOString();
    const taskRef = this.firestoreDb.collection('intelligence_tasks').doc(taskId);

    try {
      if (typeof this.firestoreDb.runTransaction === 'function') {
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

          transaction.set(taskRef, newTask);
          return newTask;
        });

        this.tasks.set(task.taskId, task);
        this.idempotencyIndex.set(idempotencyKey, task.taskId);
        return task;
      } else {
        // Fallback if runTransaction not implemented
        const existingDoc = await taskRef.get();
        if (existingDoc && existingDoc.exists) {
          const data = existingDoc.data() as IntelligenceTask;
          this.tasks.set(data.taskId, data);
          this.idempotencyIndex.set(idempotencyKey, data.taskId);
          return data;
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

        await taskRef.set(newTask);
        this.tasks.set(taskId, newTask);
        this.idempotencyIndex.set(idempotencyKey, taskId);
        return newTask;
      }
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
    leaseDurationMs: number = this.defaultLeaseDurationMs
  ): Promise<boolean> {
    if (!this.firestoreDb) {
      throw new Error("Firestore task store is not ready");
    }

    if (typeof this.firestoreDb.runTransaction !== 'function') {
      throw new Error("Firestore instance does not support runTransaction");
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const leaseExpiresAt = new Date(now + leaseDurationMs).toISOString();
    const taskRef = this.firestoreDb.collection('intelligence_tasks').doc(taskId);

    try {
      const claimed = await this.firestoreDb.runTransaction(async (transaction: any) => {
        const docSnap = await transaction.get(taskRef);
        if (!docSnap || !docSnap.exists) {
          return false;
        }

        const data = docSnap.data() as IntelligenceTask;

        // Completed, dead-letter, or cancelled tasks cannot be claimed
        if (
          data.status === 'succeeded' ||
          data.status === 'dead_letter' ||
          (data.status as string) === 'cancelled'
        ) {
          return false;
        }

        const maxAttempts = data.maxAttempts || this.maxRetries;
        if ((data.attempts || 0) >= maxAttempts) {
          return false;
        }

        const isLeaseExpired = data.leaseExpiresAt ? new Date(data.leaseExpiresAt).getTime() <= now : true;

        const canClaim =
          data.status === 'pending' ||
          (data.status === 'retrying' && (!data.nextAttemptAt || new Date(data.nextAttemptAt).getTime() <= now)) ||
          (data.status === 'processing' && isLeaseExpired);

        if (!canClaim) {
          return false;
        }

        const newAttempts = (data.attempts || 0) + 1;
        transaction.update(taskRef, {
          status: 'processing',
          attempts: newAttempts,
          startedAt: nowIso,
          workerId: workerId,
          leaseExpiresAt: leaseExpiresAt,
          updatedAt: nowIso,
        });

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
        local.leaseExpiresAt = leaseExpiresAt;
        local.updatedAt = nowIso;
        this.tasks.set(taskId, local);
      }

      return claimed;
    } catch (err: any) {
      console.error(`[IntelligenceTaskQueue] Transactional claim error for task ${taskId}:`, err?.message || err);
      throw err;
    }
  }


  /**
   * Recovers stale tasks synchronously (memory cache only)
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
      throw new Error("Firestore task store is not ready");
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

          if (typeof this.firestoreDb.runTransaction === 'function') {
            try {
              const recoveredTask = await this.firestoreDb.runTransaction(async (transaction: any) => {
                const currentSnap = await transaction.get(taskRef);
                if (!currentSnap || !currentSnap.exists) return null;

                const task = currentSnap.data() as IntelligenceTask;
                if (task.status !== 'processing') return null;

                const isExpired = !task.leaseExpiresAt || new Date(task.leaseExpiresAt).getTime() <= now;
                if (!isExpired) return null;

                const nextStatus: TaskStatus = task.attempts < task.maxAttempts ? 'retrying' : 'dead_letter';
                const updates: Partial<IntelligenceTask> = {
                  status: nextStatus,
                  nextAttemptAt: nextStatus === 'retrying' ? nowIso : undefined,
                  nextRetryAt: nextStatus === 'retrying' ? nowIso : undefined,
                  lastError: nextStatus === 'retrying' ? 'Lease expired / Worker timeout recovered' : 'Exceeded attempts during stale lease recovery',
                  errorCode: nextStatus === 'retrying' ? 'STALE_LEASE_RECOVERED' : 'STALE_LEASE_EXHAUSTED',
                  leaseExpiresAt: undefined,
                  workerId: undefined,
                  updatedAt: nowIso,
                };

                transaction.update(taskRef, updates);
                return { ...task, ...updates };
              });

              if (recoveredTask) {
                this.tasks.set(taskId, recoveredTask);
                recovered.push(recoveredTask);
              }
            } catch (txErr) {
              console.warn(`[IntelligenceTaskQueue] Transaction recovery error for task ${taskId}:`, txErr);
            }
          } else {
            const task = doc.data() as IntelligenceTask;
            const isExpired = !task.leaseExpiresAt || new Date(task.leaseExpiresAt).getTime() <= now;

            if (isExpired) {
              const nextStatus: TaskStatus = task.attempts < task.maxAttempts ? 'retrying' : 'dead_letter';
              const updates: Partial<IntelligenceTask> = {
                status: nextStatus,
                nextAttemptAt: nextStatus === 'retrying' ? nowIso : undefined,
                lastError: nextStatus === 'retrying' ? 'Lease expired / Worker timeout recovered' : 'Exceeded attempts during stale lease recovery',
                errorCode: nextStatus === 'retrying' ? 'STALE_LEASE_RECOVERED' : 'STALE_LEASE_EXHAUSTED',
                updatedAt: nowIso,
              };

              await taskRef.update(updates);
              const merged = { ...task, ...updates };
              this.tasks.set(taskId, merged);
              recovered.push(merged);
            }
          }
        }
      }
      return recovered;
    } catch (err: any) {
      console.error('[IntelligenceTaskQueue] Async stale recovery scan error:', err?.message || err);
      throw err;
    }
  }

  /**
   * Retrieves a task by ID (memory cache)
   */
  public getTask(taskId: string): IntelligenceTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Retrieves a task by ID asynchronously with authoritative Firestore lookup.
   * Throws if Firestore is not ready or if Firestore read fails.
   */
  public async getTaskAsync(taskId: string): Promise<IntelligenceTask | undefined> {
    if (!this.firestoreDb) {
      throw new Error("Firestore task store is not ready");
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

  /**
   * Retrieves a task by its deterministic idempotency key (memory cache)
   */
  public getByIdempotencyKey(key: string): IntelligenceTask | undefined {
    const taskId = this.idempotencyIndex.get(key) || taskDocumentId(key);
    return this.tasks.get(taskId);
  }

  /**
   * Retrieves a task by its deterministic idempotency key asynchronously from Firestore
   */
  public async getByIdempotencyKeyAsync(key: string): Promise<IntelligenceTask | undefined> {
    const taskId = taskDocumentId(key);
    return this.getTaskAsync(taskId);
  }

  /**
   * Executes a single task step through its handler with authoritative Firestore lease & ownership gating.
   * 
   * Invariants:
   * - A worker MUST NEVER execute a task merely because it knows the taskId.
   * - Execution is only allowed if the task is successfully claimed or already legitimately owned
   *   by the executing worker with an active lease.
   * - If the claim fails (e.g. active lease owned by another worker, completed, retry not due),
   *   the handler MUST NOT execute.
   * - No force or bypass parameter exists.
   */
  public async executeTask(
    taskId: string,
    workerId?: string
  ): Promise<IntelligenceTask> {
    if (!this.firestoreDb) {
      throw new Error("Firestore task store is not ready");
    }

    const effectiveWorkerId = (typeof workerId === 'string' && workerId) ? workerId : this.workerId;
    let task = await this.getTaskAsync(taskId);

    if (!task) {
      throw new Error(`[TaskQueue Error] Task ${taskId} not found`);
    }

    // Terminal or cancelled tasks must never execute
    if (
      task.status === 'succeeded' ||
      task.status === 'dead_letter' ||
      (task.status as string) === 'cancelled'
    ) {
      return task;
    }

    const handler = this.handlers.get(task.taskType);
    if (!handler) {
      task.status = 'dead_letter';
      task.errorCode = 'MISSING_HANDLER';
      task.lastError = `No handler registered for task type: ${task.taskType}`;
      task.error = {
        classification: 'MISSING_HANDLER',
        message: task.lastError,
        timestamp: new Date().toISOString(),
      };
      task.updatedAt = new Date().toISOString();
      await this.firestoreDb.collection('intelligence_tasks').doc(taskId).update({
        status: task.status,
        errorCode: task.errorCode,
        lastError: task.lastError,
        error: task.error,
        updatedAt: task.updatedAt,
      });
      this.tasks.set(taskId, task);
      return task;
    }

    // Lease & Ownership verification:
    // If the task is already processing, execution is allowed ONLY if the current worker legitimately owns the active lease.
    const now = Date.now();
    const isOwnerWithActiveLease =
      task.status === 'processing' &&
      task.workerId === effectiveWorkerId &&
      !!task.leaseExpiresAt &&
      new Date(task.leaseExpiresAt).getTime() > now;

    if (!isOwnerWithActiveLease) {
      // Must atomically claim the task in Firestore before handler can execute.
      const claimed = await this.claimTaskTransactional(taskId, effectiveWorkerId, this.defaultLeaseDurationMs);
      if (!claimed) {
        // A failed claim MUST mean: DO NOT EXECUTE THE HANDLER.
        return (await this.getTaskAsync(taskId)) || task;
      }
      task = (await this.getTaskAsync(taskId)) || task;
    }

    // Final boundary guard: Handler invocation occurs ONLY after verified ownership and active lease.
    const verifiedNow = Date.now();
    const verifiedOwner =
      task.status === 'processing' &&
      task.workerId === effectiveWorkerId &&
      !!task.leaseExpiresAt &&
      new Date(task.leaseExpiresAt).getTime() > verifiedNow;

    if (!verifiedOwner) {
      return task;
    }

    const startTime = Date.now();

    try {
      const result = await handler(task);
      const nowIso = new Date().toISOString();
      task.status = 'succeeded';
      task.payload = { ...task.payload, ...result };
      task.completedAt = nowIso;
      task.processingDurationMs = Date.now() - startTime;
      task.updatedAt = nowIso;
      delete task.nextAttemptAt;
      delete task.nextRetryAt;
      delete task.leaseExpiresAt;

      // Durable Firestore update - throw if fails so false success is not reported
      await this.firestoreDb.collection('intelligence_tasks').doc(taskId).update({
        status: 'succeeded',
        completedAt: task.completedAt,
        processingDurationMs: task.processingDurationMs,
        updatedAt: task.updatedAt,
        payload: task.payload,
      });

      this.tasks.set(taskId, task);
      return task;
    } catch (err) {
      const duration = Date.now() - startTime;
      task.processingDurationMs = duration;
      const errorMsg = (err as Error).message || 'Unknown processing error';
      task.lastError = errorMsg;
      task.errorCode = 'PROCESSING_ERROR';

      if (task.attempts < task.maxAttempts) {
        task.status = 'retrying';
        const backoffSec = Math.pow(2, task.attempts);
        task.nextAttemptAt = new Date(Date.now() + backoffSec * 1000).toISOString();
        task.nextRetryAt = task.nextAttemptAt;
        task.error = {
          classification: 'TRANSIENT_FAILURE',
          message: errorMsg,
          timestamp: new Date().toISOString(),
        };
      } else {
        task.status = 'dead_letter';
        delete task.nextAttemptAt;
        delete task.nextRetryAt;
        task.errorCode = 'MAX_RETRIES_EXCEEDED';
        task.error = {
          classification: 'MAX_RETRIES_EXCEEDED',
          message: `Exceeded ${task.maxAttempts} attempts. Last error: ${errorMsg}`,
          timestamp: new Date().toISOString(),
        };
      }
      task.updatedAt = new Date().toISOString();
      delete task.leaseExpiresAt;
      delete task.workerId;

      await this.firestoreDb.collection('intelligence_tasks').doc(taskId).update({
        status: task.status,
        attempts: task.attempts,
        nextAttemptAt: task.nextAttemptAt || null,
        lastError: task.lastError,
        errorCode: task.errorCode,
        error: task.error,
        updatedAt: task.updatedAt,
        workerId: null,
      });

      this.tasks.set(taskId, task);
      return task;
    }
  }

  /**
   * Lists tasks by status
   */
  public listByStatus(status: TaskStatus): IntelligenceTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === status);
  }

  /**
   * Clears in-memory queue (for test isolation)
   */
  public clear(): void {
    this.tasks.clear();
    this.idempotencyIndex.clear();
  }
}

export const intelligenceTaskQueue = new IntelligenceTaskQueue();
