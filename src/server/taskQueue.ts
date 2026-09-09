/**
 * Asynchronous Task Queue & Background Worker for AnyTrader V6
 * Manages background work with exponential backoff and audit persistence.
 */
import crypto from "crypto";

export interface Task<T = any> {
  taskId: string;
  taskType: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  error?: string;
}

export type TaskHandler<T = any> = (payload: T) => Promise<void>;

export class TaskQueue {
  private handlers = new Map<string, TaskHandler>();

  public registerHandler<T = any>(taskType: string, handler: TaskHandler<T>): void {
    this.handlers.set(taskType, handler);
  }

  public async enqueue<T = any>(
    taskType: string,
    payload: T,
    maxAttempts: number = 3,
    db?: any
  ): Promise<Task<T>> {
    const task: Task<T> = {
      taskId: `task_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      taskType,
      payload,
      attempts: 0,
      maxAttempts,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    if (db) {
      try {
        await db.collection("task_queue").doc(task.taskId).set(task);
      } catch (err: any) {
        console.warn(`[TaskQueue] Could not persist task ${task.taskId}:`, err?.message);
      }
    }

    // Process immediately in the background
    this.processTask(task, db).catch((err) => {
      console.error(`[TaskQueue Error] Background execution failed for ${task.taskId}:`, err);
    });

    return task;
  }

  private async processTask(task: Task, db?: any): Promise<void> {
    const handler = this.handlers.get(task.taskType);
    if (!handler) {
      console.warn(`[TaskQueue] No handler registered for task type: ${task.taskType}`);
      return;
    }

    task.status = "processing";
    task.attempts += 1;

    try {
      await handler(task.payload);
      task.status = "completed";
      if (db) {
        await db.collection("task_queue").doc(task.taskId).update({
          status: "completed",
          completedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (err: any) {
      task.error = err?.message || String(err);
      if (task.attempts < task.maxAttempts) {
        task.status = "queued";
        const delay = Math.pow(2, task.attempts) * 1000;
        setTimeout(() => this.processTask(task, db), delay);
      } else {
        task.status = "failed";
        if (db) {
          await db.collection("task_queue").doc(task.taskId).update({
            status: "failed",
            error: task.error,
            failedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    }
  }
}

export const taskQueue = new TaskQueue();
