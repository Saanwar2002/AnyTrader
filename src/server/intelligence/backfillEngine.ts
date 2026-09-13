/**
 * AnyTrader V8.1 — Controlled Historical Backfill Engine
 * 
 * Invariants:
 * - Never runs automatically on startup/deployment.
 * - Dry-run mode by default.
 * - Task-First Pattern: Enqueues intelligence task before running extraction.
 * - No Direct Fallback Bypass: If task execution fails, it records an error and NEVER bypasses the queue.
 * - Durable Checkpointing: Persists run status and checkpoint cursor to /intelligence_backfill_runs/{runId}.
 * - Deterministic, Ordered Queries: Ordered query on source collection with bounded batch sizes.
 * - Resumable execution via cursor checkpointing.
 */

import { buildIdempotencyKey } from './provenance';
import { JobSourceInput } from './jobIntelligence';
import { intelligenceTaskQueue } from './intelligenceTaskQueue';

export interface BackfillOptions {
  batchSize: number;       // Default 100
  dryRun: boolean;         // Default true (safe mode)
  maxCostUsd?: number;     // Stop if estimated cost exceeds this amount
  cursor?: string;         // Checkpoint cursor for resumable execution (e.g. jobId)
  rateLimitDelayMs?: number; // Throttle between items (ms)
  runId?: string;          // Optional durable run ID
}

export interface BackfillRun {
  runId: string;
  status: 'dry_run' | 'running' | 'paused' | 'completed' | 'failed';
  collection: 'jobs';
  batchSize: number;
  cursor?: string | null;
  scanned: number;
  processed: number;
  skipped: number;
  errors: number;
  estimatedCostUsd: number;
  maxCostUsd?: number;
  rateLimitDelayMs: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  lastError?: string;
}

export interface BackfillProgress {
  runId: string;
  totalScanned: number;
  processedCount: number;
  skippedIdempotentCount: number;
  errorCount: number;
  estimatedCostUsd: number;
  nextCursor?: string;
  isComplete: boolean;
}

export class ControlledBackfillEngine {
  /**
   * Runs a controlled, bounded, resumable backfill across historical jobs in an array
   */
  public async executeBackfill(
    jobs: JobSourceInput[],
    options: BackfillOptions
  ): Promise<BackfillProgress> {
    const {
      batchSize = 100,
      dryRun = true,
      maxCostUsd = 10.0,
      cursor,
      rateLimitDelayMs = 20,
      runId = `bf_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    } = options;

    let startIndex = 0;
    if (cursor) {
      const idx = jobs.findIndex((j) => j.jobId === cursor);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    const batch = jobs.slice(startIndex, startIndex + batchSize);

    const progress: BackfillProgress = {
      runId,
      totalScanned: batch.length,
      processedCount: 0,
      skippedIdempotentCount: 0,
      errorCount: 0,
      estimatedCostUsd: 0,
      isComplete: startIndex + batch.length >= jobs.length,
    };

    for (const job of batch) {
      // Check cost cap
      if (progress.estimatedCostUsd >= maxCostUsd) {
        progress.nextCursor = job.jobId;
        progress.isComplete = false;
        break;
      }

      const idempotencyKey = buildIdempotencyKey(job.jobId, 'JOB_ANALYSIS_COMPLETED', 'v1');

      // Check if already processed
      const existingTask = await intelligenceTaskQueue.getByIdempotencyKeyAsync(idempotencyKey);

      if (existingTask && existingTask.status === 'succeeded') {
        progress.skippedIdempotentCount += 1;
        progress.nextCursor = job.jobId;
        continue;
      }

      if (dryRun) {
        // Dry-run mode: simulate execution without making writes or API calls
        progress.processedCount += 1;
        progress.estimatedCostUsd += 0.00005; // Simulated cost
      } else {
        try {
          // Task-First Pattern: Enqueue task record first
          const task = await intelligenceTaskQueue.enqueueTaskAsync(
            'job_extraction',
            'job',
            job.jobId,
            idempotencyKey,
            { job, isBackfill: true }
          );

          const executed = await intelligenceTaskQueue.executeTask(task.taskId);
          if (executed.status === 'succeeded') {
            progress.processedCount += 1;
            const tokens = (executed.payload?.tokenMetrics || executed.payload?.event) as { estimatedCostUsd?: number } | undefined;
            progress.estimatedCostUsd += tokens?.estimatedCostUsd || 0.00005;
          } else {
            // Task failed - do NOT bypass task system with direct fallback!
            progress.errorCount += 1;
          }
        } catch {
          progress.errorCount += 1;
        }
      }

      // Throttle rate limit
      if (rateLimitDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs));
      }

      progress.nextCursor = job.jobId;
    }

    return progress;
  }

  /**
   * Executes a controlled, cursor-based backfill directly against Firestore collections
   * with durable run tracking and checkpoint persistence in /intelligence_backfill_runs.
   */
  public async executeFirestoreBackfill(
    firestoreDb: any,
    options: BackfillOptions
  ): Promise<BackfillProgress> {
    const {
      batchSize = 100,
      dryRun = true,
      maxCostUsd = 10.0,
      cursor,
      rateLimitDelayMs = 20,
      runId = `bf_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    } = options;

    const progress: BackfillProgress = {
      runId,
      totalScanned: 0,
      processedCount: 0,
      skippedIdempotentCount: 0,
      errorCount: 0,
      estimatedCostUsd: 0,
      isComplete: false,
    };

    if (!firestoreDb) {
      throw new Error('[BackfillEngine] Firestore DB instance required for executeFirestoreBackfill');
    }

    if (!intelligenceTaskQueue.getFirestoreDb()) {
      intelligenceTaskQueue.setFirestoreDb(firestoreDb);
    }

    const nowIso = new Date().toISOString();
    const runRef = firestoreDb.collection('intelligence_backfill_runs').doc(runId);

    // 1. Initialize durable run record
    try {
      await runRef.set({
        runId,
        status: dryRun ? 'dry_run' : 'running',
        collection: 'jobs',
        batchSize,
        cursor: cursor || null,
        scanned: 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        estimatedCostUsd: 0,
        maxCostUsd,
        rateLimitDelayMs,
        createdAt: nowIso,
        updatedAt: nowIso,
      }, { merge: true });
    } catch (runErr) {
      console.error(`[BackfillEngine] Failed to initialize durable backfill run record ${runId}:`, runErr);
      throw new Error(`[BackfillEngine] Checkpoint initialization failed for run '${runId}': ${(runErr as Error)?.message || runErr}`);
    }

    try {
      let query: any = firestoreDb.collection('jobs');
      if (typeof query.orderBy === 'function') {
        query = query.orderBy('__name__');
      }
      query = query.limit(batchSize);

      if (cursor) {
        const cursorDoc = await firestoreDb.collection('jobs').doc(cursor).get();
        if (cursorDoc && cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snapshot = await query.get();
      progress.totalScanned = snapshot.docs.length;

      if (snapshot.empty) {
        progress.isComplete = true;
        await runRef.update({
          status: 'completed',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return progress;
      }

      for (const doc of snapshot.docs) {
        const jobId = doc.id;
        const jobData = doc.data() as any;
        const jobInput: JobSourceInput = {
          jobId,
          title: jobData.title || '',
          description: jobData.description || '',
          category: jobData.category || '',
          postcode: jobData.postcode || '',
          createdAt: typeof jobData.createdAt === 'string' ? jobData.createdAt : undefined,
          photos: Array.isArray(jobData.photos) ? jobData.photos : undefined,
          documents: Array.isArray(jobData.documents) ? jobData.documents : undefined,
        };

        if (progress.estimatedCostUsd >= maxCostUsd) {
          progress.nextCursor = jobId;
          progress.isComplete = false;
          break;
        }

        const idempotencyKey = buildIdempotencyKey(jobId, 'JOB_ANALYSIS_COMPLETED', 'v1');

        // Check idempotency against queue
        const existingTask = await intelligenceTaskQueue.getByIdempotencyKeyAsync(idempotencyKey);
        if (existingTask && existingTask.status === 'succeeded') {
          progress.skippedIdempotentCount += 1;
          progress.nextCursor = jobId;

          // Save checkpoint: must not be swallowed
          await runRef.update({
            cursor: jobId,
            scanned: progress.totalScanned,
            skipped: progress.skippedIdempotentCount,
            updatedAt: new Date().toISOString(),
          });

          continue;
        }

        if (dryRun) {
          progress.processedCount += 1;
          progress.estimatedCostUsd += 0.00005;
        } else {
          try {
            // Task-First: Enqueue task into queue first
            const task = await intelligenceTaskQueue.enqueueTaskAsync(
              'job_extraction',
              'job',
              jobId,
              idempotencyKey,
              { job: jobInput, isBackfill: true }
            );

            const executed = await intelligenceTaskQueue.executeTask(task.taskId);
            if (executed.status === 'succeeded') {
              progress.processedCount += 1;
              progress.estimatedCostUsd += 0.00005;
            } else {
              // Task failed: do NOT bypass task system with direct extraction!
              progress.errorCount += 1;
            }
          } catch {
            progress.errorCount += 1;
          }
        }

        // Save durable checkpoint after item handled: must not be swallowed
        await runRef.update({
          cursor: jobId,
          scanned: progress.totalScanned,
          processed: progress.processedCount,
          errors: progress.errorCount,
          estimatedCostUsd: progress.estimatedCostUsd,
          updatedAt: new Date().toISOString(),
        });

        if (rateLimitDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs));
        }

        progress.nextCursor = jobId;
      }

      progress.isComplete = snapshot.docs.length < batchSize;

      await runRef.update({
        status: progress.isComplete ? 'completed' : 'paused',
        cursor: progress.nextCursor || null,
        completedAt: progress.isComplete ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      });

      return progress;
    } catch (err) {
      console.error('[BackfillEngine] Firestore backfill execution error:', err);
      try {
        await runRef.update({
          status: 'failed',
          lastError: (err as Error).message || 'Unknown backfill failure',
          updatedAt: new Date().toISOString(),
        });
      } catch (updateErr) {
        console.warn(`[BackfillEngine] Could not record failed status for run ${runId}:`, updateErr);
      }
      throw err;
    }
  }
}

export const controlledBackfillEngine = new ControlledBackfillEngine();
