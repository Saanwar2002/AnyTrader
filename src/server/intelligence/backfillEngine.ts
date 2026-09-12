/**
 * AnyTrader V8.1 — Controlled Historical Backfill Engine
 * 
 * Invariants:
 * - Never runs automatically on startup/deployment.
 * - Dry-run mode by default.
 * - Bounded batches (e.g. 100, 500) with rate-limiting and cost limits.
 * - Resumable checkpointing via cursors.
 * - Full idempotency and progress reporting.
 */

import { buildIdempotencyKey } from './provenance';
import { JobSourceInput, jobIntelligenceService } from './jobIntelligence';
import { intelligenceTaskQueue } from './intelligenceTaskQueue';

export interface BackfillOptions {
  batchSize: number;       // Default 100
  dryRun: boolean;         // Default true (safe mode)
  maxCostUsd?: number;     // Stop if estimated cost exceeds this amount
  cursor?: string;         // Checkpoint cursor for resumable execution
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
   * Runs a controlled, bounded, resumable backfill across historical jobs
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
      const existingTask = intelligenceTaskQueue.getByIdempotencyKey(idempotencyKey);
      if (existingTask && existingTask.status === 'succeeded') {
        progress.skippedIdempotentCount += 1;
        continue;
      }

      if (dryRun) {
        // Dry-run mode: simulate execution without making writes or API calls
        progress.processedCount += 1;
        progress.estimatedCostUsd += 0.00005; // Simulated cost
      } else {
        try {
          const result = await jobIntelligenceService.deriveJobIntelligence(job);
          progress.processedCount += 1;
          const tokens = result.event.payload.tokenMetrics as { estimatedCostUsd?: number } | undefined;
          progress.estimatedCostUsd += tokens?.estimatedCostUsd || 0.00005;

          // Enqueue task record for audit tracking
          intelligenceTaskQueue.enqueueTask(
            'job_extraction',
            'job',
            job.jobId,
            idempotencyKey,
            { derivedAt: new Date().toISOString() }
          );
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
}

export const controlledBackfillEngine = new ControlledBackfillEngine();
