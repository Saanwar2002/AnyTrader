/**
 * AnyTrader V8.1 — Controlled Historical Backfill Engine
 * 
 * Invariants:
 * - Never runs automatically on startup/deployment.
 * - Dry-run mode by default.
 * - Task-First Pattern: Enqueues intelligence task before running extraction.
 * - Bounded batches (e.g. 100, 500) with rate-limiting and cost limits.
 * - Resumable checkpointing via cursors.
 * - Full idempotency and progress reporting across both in-memory and Firestore collections.
 */

import { buildIdempotencyKey } from './provenance';
import { JobSourceInput, jobIntelligenceService } from './jobIntelligence';
import { intelligenceTaskQueue } from './intelligenceTaskQueue';

export interface BackfillOptions {
  batchSize: number;       // Default 100
  dryRun: boolean;         // Default true (safe mode)
  maxCostUsd?: number;     // Stop if estimated cost exceeds this amount
  cursor?: string;         // Checkpoint cursor for resumable execution (e.g. jobId)
  rateLimitDelayMs?: number; // Throttle between items (ms)
}

export interface BackfillProgress {
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
      const existingTask = await intelligenceTaskQueue.getByIdempotencyKeyAsync(idempotencyKey) ||
        intelligenceTaskQueue.getByIdempotencyKey(idempotencyKey);

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

          // Register job extraction task handler if not already present
          const executed = await intelligenceTaskQueue.executeTask(task.taskId);
          if (executed.status === 'succeeded') {
            progress.processedCount += 1;
            const tokens = (executed.payload?.tokenMetrics || executed.payload?.event) as { estimatedCostUsd?: number } | undefined;
            progress.estimatedCostUsd += tokens?.estimatedCostUsd || 0.00005;
          } else {
            // Also attempt direct service fallback if task queue handler was unconfigured
            const result = await jobIntelligenceService.deriveJobIntelligence(job);
            progress.processedCount += 1;
            const tokens = result.event.payload.tokenMetrics as { estimatedCostUsd?: number } | undefined;
            progress.estimatedCostUsd += tokens?.estimatedCostUsd || 0.00005;
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
    } = options;

    const progress: BackfillProgress = {
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

    try {
      let query = firestoreDb.collection('jobs').limit(batchSize);

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
              // Direct extraction fallback
              const result = await jobIntelligenceService.deriveJobIntelligence(jobInput);
              progress.processedCount += 1;
              const tokens = result.event.payload.tokenMetrics as { estimatedCostUsd?: number } | undefined;
              progress.estimatedCostUsd += tokens?.estimatedCostUsd || 0.00005;
            }
          } catch {
            progress.errorCount += 1;
          }
        }

        if (rateLimitDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs));
        }

        progress.nextCursor = jobId;
      }

      progress.isComplete = snapshot.docs.length < batchSize;
      return progress;
    } catch (err) {
      console.error('[BackfillEngine] Firestore backfill execution error:', err);
      throw err;
    }
  }
}

export const controlledBackfillEngine = new ControlledBackfillEngine();

