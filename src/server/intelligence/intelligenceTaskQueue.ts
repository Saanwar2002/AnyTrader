/**
 * AnyTrader V8.1 — Async Intelligence Task Queue & Orchestration
 * 
 * Invariants:
 * - Asynchronous execution: Never blocks core user transactions.
 * - Durable task state: Firestore task record is authoritative source of truth.
 * - Atomic claiming: Worker claims task atomically; prevents duplicate concurrent processing.
 * - Stale task recovery: Processing tasks with expired leases can be safely reclaimed.
 * - Idempotency: Duplicate task submissions with same idempotencyKey are safely resolved.
 * - Lifecycle: pending -> processing -> succeeded | retrying -> dead_letter
 * - Bounded retries: Exponential backoff, maximum 3 attempts by default.
 */

import { IntelligenceTask, TaskStatus, TaskType, IntelligenceAggregateType } from './types';

export type TaskHandler = (task: IntelligenceTask) => Promise<Record<string, unknown>>;

export interface FirestoreTaskDb {
  collection(name: string): any;
  runTransaction?<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T>;
}

export class IntelligenceTaskQueue {
  private tasks = new Map<string, IntelligenceTask>();
  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> taskId
  private handlers = new Map<TaskType, TaskHandler>();
  private isWorkerRunning = false;
  private firestoreDb: FirestoreTaskDb | null = null;

  constructor(
    private maxRetries: number = 3,
    private defaultLeaseDurationMs: number = 300000 // 5 minutes
  ) {}

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
   * Enqueues an intelligence task with deterministic idempotency replay safety
   */
  public enqueueTask(
    taskType: TaskType,
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    idempotencyKey: string,
    payload: Record<string, unknown> = {}
  ): IntelligenceTask {
    // Replay Safety: Check in-memory index first
    const existingTaskId = this.idempotencyIndex.get(idempotencyKey);
    if (existingTaskId) {
      const existing = this.tasks.get(existingTaskId);
      if (existing) {
        return existing;
      }
    }

    const taskId = `task_${taskType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const task: IntelligenceTask = {
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
      payload,
    };

    this.tasks.set(taskId, task);
    this.idempotencyIndex.set(idempotencyKey, taskId);

    // Persist to Firestore if initialized
    if (this.firestoreDb) {
      this.persistTaskToFirestore(task).catch((err) => {
        console.error(`[IntelligenceTaskQueue] Failed to persist task ${taskId} to Firestore:`, err);
      });
    }

    // Trigger async non-blocking drain
    setImmediate(() => this.processNext());

    return task;
  }

  /**
   * Asynchronously enqueues a task, waiting for durable Firestore confirmation
   */
  public async enqueueTaskAsync(
    taskType: TaskType,
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    idempotencyKey: string,
    payload: Record<string, unknown> = {}
  ): Promise<IntelligenceTask> {
    // Check in-memory index
    const existingTaskId = this.idempotencyIndex.get(idempotencyKey);
    if (existingTaskId) {
      const existing = this.tasks.get(existingTaskId);
      if (existing) {
        return existing;
      }
    }

    const taskId = `task_${taskType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const task: IntelligenceTask = {
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
      payload,
    };

    this.tasks.set(taskId, task);
    this.idempotencyIndex.set(idempotencyKey, taskId);

    if (this.firestoreDb) {
      await this.persistTaskToFirestore(task);
    }

    setImmediate(() => this.processNext());
    return task;
  }

  private async persistTaskToFirestore(task: IntelligenceTask): Promise<void> {
    if (!this.firestoreDb) return;
    await this.firestoreDb.collection('intelligence_tasks').doc(task.taskId).set(task);
  }

  /**
   * Atomically claims a task for processing with lease timeout protection.
   * Prevents two workers from processing the same task simultaneously.
   */
  public claimTask(
    taskId: string,
    workerId: string = `worker_${Math.random().toString(36).slice(2, 8)}`,
    leaseDurationMs: number = this.defaultLeaseDurationMs,
    force: boolean = false
  ): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const now = Date.now();
    const isLeaseExpired = task.leaseExpiresAt ? new Date(task.leaseExpiresAt).getTime() < now : false;

    // Can only claim if pending, or retrying due (or forced), or processing with expired lease
    const canClaim =
      force ||
      task.status === 'pending' ||
      (task.status === 'retrying' && (!task.nextAttemptAt || new Date(task.nextAttemptAt).getTime() <= now)) ||
      (task.status === 'processing' && isLeaseExpired);

    if (!canClaim) {
      return false; // Active claim exists
    }

    const nowIso = new Date(now).toISOString();
    task.status = 'processing';
    task.attempts += 1;
    task.startedAt = nowIso;
    task.workerId = workerId;
    task.leaseExpiresAt = new Date(now + leaseDurationMs).toISOString();
    task.updatedAt = nowIso;

    this.tasks.set(taskId, task);

    if (this.firestoreDb) {
      this.firestoreDb.collection('intelligence_tasks').doc(taskId).update({
        status: 'processing',
        attempts: task.attempts,
        startedAt: task.startedAt,
        workerId: task.workerId,
        leaseExpiresAt: task.leaseExpiresAt,
        updatedAt: task.updatedAt,
      }).catch((err: unknown) => {
        console.error(`[IntelligenceTaskQueue] Failed to update claimed state in Firestore for ${taskId}:`, err);
      });
    }

    return true;
  }

  /**
   * Atomically claims a task in Firestore via runTransaction
   */
  public async claimTaskTransactional(
    taskId: string,
    workerId: string = `worker_${Math.random().toString(36).slice(2, 8)}`,
    leaseDurationMs: number = this.defaultLeaseDurationMs,
    force: boolean = false
  ): Promise<boolean> {
    if (!this.firestoreDb || typeof this.firestoreDb.runTransaction !== 'function') {
      return this.claimTask(taskId, workerId, leaseDurationMs, force);
    }

    const taskRef = this.firestoreDb.collection('intelligence_tasks').doc(taskId);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const leaseExpiresAt = new Date(now + leaseDurationMs).toISOString();

    try {
      const claimed = await this.firestoreDb.runTransaction(async (transaction: any) => {
        const docSnap = await transaction.get(taskRef);
        if (!docSnap.exists) {
          return false;
        }

        const data = docSnap.data() as IntelligenceTask;
        const isLeaseExpired = data.leaseExpiresAt ? new Date(data.leaseExpiresAt).getTime() < now : false;

        const canClaim =
          force ||
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
        // Sync local memory state
        const local = this.tasks.get(taskId);
        if (local) {
          local.status = 'processing';
          local.attempts += 1;
          local.startedAt = nowIso;
          local.workerId = workerId;
          local.leaseExpiresAt = leaseExpiresAt;
          local.updatedAt = nowIso;
        }
      }

      return claimed;
    } catch (err) {
      console.error(`[IntelligenceTaskQueue] Transactional claim error for task ${taskId}:`, err);
      return false;
    }
  }

  /**
   * Recovers stale processing tasks whose lease has expired
   */
  public recoverStaleTasks(leaseTimeoutMs: number = this.defaultLeaseDurationMs): IntelligenceTask[] {
    const now = Date.now();
    const recovered: IntelligenceTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.status === 'processing') {
        const startTime = task.startedAt ? new Date(task.startedAt).getTime() : 0;
        const leaseExpired = task.leaseExpiresAt
          ? new Date(task.leaseExpiresAt).getTime() < now
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

          if (this.firestoreDb) {
            this.firestoreDb.collection('intelligence_tasks').doc(task.taskId).update({
              status: task.status,
              nextAttemptAt: task.nextAttemptAt || null,
              lastError: task.lastError,
              errorCode: task.errorCode,
              updatedAt: task.updatedAt,
            }).catch((err: unknown) => {
              console.error(`[IntelligenceTaskQueue] Failed to persist stale recovery for ${task.taskId}:`, err);
            });
          }
        }
      }
    }

    return recovered;
  }

  /**
   * Retrieves a task by ID
   */
  public getTask(taskId: string): IntelligenceTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Retrieves a task by its deterministic idempotency key
   */
  public getByIdempotencyKey(key: string): IntelligenceTask | undefined {
    const taskId = this.idempotencyIndex.get(key);
    return taskId ? this.tasks.get(taskId) : undefined;
  }

  /**
   * Executes a single task step through its handler with atomic claim protection
   */
  public async executeTask(taskId: string, force: boolean = true): Promise<IntelligenceTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`[TaskQueue Error] Task ${taskId} not found`);
    }

    if (task.status === 'succeeded' || task.status === 'dead_letter') {
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
      if (this.firestoreDb) {
        await this.firestoreDb.collection('intelligence_tasks').doc(taskId).update({
          status: task.status,
          errorCode: task.errorCode,
          lastError: task.lastError,
          error: task.error,
          updatedAt: task.updatedAt,
        });
      }
      return task;
    }

    // Atomic claim check
    if (task.status !== 'processing') {
      const claimed = this.claimTask(taskId, undefined, this.defaultLeaseDurationMs, force);
      if (!claimed) {
        return task; // Owned by another worker
      }
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

      if (this.firestoreDb) {
        await this.firestoreDb.collection('intelligence_tasks').doc(taskId).update({
          status: 'succeeded',
          completedAt: task.completedAt,
          processingDurationMs: task.processingDurationMs,
          updatedAt: task.updatedAt,
          payload: task.payload,
        });
      }

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

      if (this.firestoreDb) {
        await this.firestoreDb.collection('intelligence_tasks').doc(taskId).update({
          status: task.status,
          attempts: task.attempts,
          nextAttemptAt: task.nextAttemptAt || null,
          lastError: task.lastError,
          errorCode: task.errorCode,
          error: task.error,
          updatedAt: task.updatedAt,
        });
      }

      return task;
    }
  }

  /**
   * Background process loop that processes all pending or due retry tasks
   */
  private async processNext(): Promise<void> {
    if (this.isWorkerRunning) return;
    this.isWorkerRunning = true;

    try {
      const now = Date.now();
      for (const task of this.tasks.values()) {
        if (task.status === 'pending') {
          await this.executeTask(task.taskId);
        } else if (task.status === 'retrying' && (task.nextAttemptAt || task.nextRetryAt)) {
          const attemptTime = task.nextAttemptAt ? new Date(task.nextAttemptAt).getTime() : new Date(task.nextRetryAt!).getTime();
          if (attemptTime <= now) {
            await this.executeTask(task.taskId);
          }
        }
      }
    } finally {
      this.isWorkerRunning = false;
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
