/**
 * AnyTrader V8.1 — Async Intelligence Task Queue & Orchestration
 * 
 * Invariants:
 * - Asynchronous execution: Never blocks core user transactions.
 * - Idempotency: Duplicate task submissions with same idempotencyKey are safely resolved without duplicate processing.
 * - Lifecycle: pending -> processing -> succeeded | retrying -> dead_letter
 * - Bounded retries: Exponential backoff, maximum 3 attempts by default.
 */

import { IntelligenceTask, TaskStatus, TaskType, IntelligenceAggregateType } from './types';

export type TaskHandler = (task: IntelligenceTask) => Promise<Record<string, unknown>>;

export class IntelligenceTaskQueue {
  private tasks = new Map<string, IntelligenceTask>();
  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> taskId
  private handlers = new Map<TaskType, TaskHandler>();
  private isWorkerRunning = false;

  constructor(private maxRetries: number = 3) {}

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
    // Replay Safety: Check if identical task already exists
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

    // Trigger async non-blocking drain
    setImmediate(() => this.processNext());

    return task;
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
   * Executes a single task step through its handler
   */
  public async executeTask(taskId: string): Promise<IntelligenceTask> {
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
      task.error = {
        classification: 'MISSING_HANDLER',
        message: `No handler registered for task type: ${task.taskType}`,
        timestamp: new Date().toISOString(),
      };
      task.updatedAt = new Date().toISOString();
      return task;
    }

    task.status = 'processing';
    task.attempts += 1;
    task.updatedAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      const result = await handler(task);
      task.status = 'succeeded';
      task.payload = { ...task.payload, ...result };
      task.processingDurationMs = Date.now() - startTime;
      task.updatedAt = new Date().toISOString();
      delete task.nextRetryAt;
      return task;
    } catch (err) {
      const duration = Date.now() - startTime;
      task.processingDurationMs = duration;
      const errorMsg = (err as Error).message || 'Unknown processing error';

      if (task.attempts < task.maxAttempts) {
        task.status = 'retrying';
        const backoffSec = Math.pow(2, task.attempts);
        task.nextRetryAt = new Date(Date.now() + backoffSec * 1000).toISOString();
        task.error = {
          classification: 'TRANSIENT_FAILURE',
          message: errorMsg,
          timestamp: new Date().toISOString(),
        };
      } else {
        task.status = 'dead_letter';
        delete task.nextRetryAt;
        task.error = {
          classification: 'MAX_RETRIES_EXCEEDED',
          message: `Exceeded ${task.maxAttempts} attempts. Last error: ${errorMsg}`,
          timestamp: new Date().toISOString(),
        };
      }
      task.updatedAt = new Date().toISOString();
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
        } else if (task.status === 'retrying' && task.nextRetryAt) {
          if (new Date(task.nextRetryAt).getTime() <= now) {
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
