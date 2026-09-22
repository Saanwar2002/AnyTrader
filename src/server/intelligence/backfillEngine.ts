/**
 * AnyTrader V8.1 — Controlled Historical Backfill Engine
 * 
 * Invariants:
 * - Authoritative Production Architecture:
 *     Firestore source data
 *           ↓
 *     durable backfill run (/intelligence_backfill_runs)
 *           ↓
 *     Firestore cursor/checkpoint
 *           ↓
 *     enqueue durable intelligence task
 *           ↓
 *     normal task claiming/lease
 *           ↓
 *     intelligence handler
 *           ↓
 *     durable checkpoint
 *           ↓
 *     next batch
 * - Production execution exclusively uses executeFirestoreBackfill().
 * - Production backfill MUST NOT load all documents into memory.
 * - Processing is strictly bounded by batches via Firestore queries (`limit(batchSize)`).
 * - Progress is persisted to durable Firestore checkpoints on every processed document.
 * - Restart/resume reads the persisted cursor from Firestore rather than starting from the beginning.
 * - Legacy in-memory array method is isolated for test compatibility and strictly forbidden in production.
 */

import { buildIdempotencyKey } from './provenance';
import { JobSourceInput } from './jobIntelligence';
import { intelligenceTaskQueue } from './intelligenceTaskQueue';
import { TaskType } from './types';

export interface BackfillOptions {
  batchSize?: number;       // Default 100
  dryRun?: boolean;         // Default true (safe mode)
  maxCostUsd?: number;     // Stop if estimated cost exceeds this amount
  cursor?: string;         // Checkpoint cursor for resumable execution (e.g. jobId)
  rateLimitDelayMs?: number; // Throttle between items (ms)
  runId?: string;          // Optional durable run ID
  collection?: 'jobs' | 'properties'; // Target collection (default 'jobs')
  targetTaskType?: TaskType; // Optional target task type
}

export interface BackfillRun {
  runId: string;
  status: 'dry_run' | 'running' | 'paused' | 'completed' | 'failed';
  collection: 'jobs' | 'properties' | string;
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
   * @deprecated TEST-ONLY LEGACY IMPLEMENTATION
   * Strictly forbidden in production. Retained solely for test compatibility.
   * Production backfill execution MUST use `executeFirestoreBackfill`.
   */
  public async executeBackfill(
    jobs: JobSourceInput[],
    options: BackfillOptions
  ): Promise<BackfillProgress> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[BackfillEngine] executeBackfill is a legacy array-based method and is strictly forbidden in production. Use executeFirestoreBackfill.'
      );
    }
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
      collection: targetCollection = 'jobs',
      targetTaskType,
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
    let effectiveCursor = cursor;

    // 1. Initialize durable run record or resume existing run
    try {
      const existingSnap = typeof runRef.get === 'function' ? await runRef.get() : null;
      if (existingSnap && existingSnap.exists) {
        const existingData = existingSnap.data() as BackfillRun;
        if (!effectiveCursor && existingData.cursor) {
          effectiveCursor = existingData.cursor;
        }
        progress.totalScanned = existingData.scanned || 0;
        progress.processedCount = existingData.processed || 0;
        progress.skippedIdempotentCount = existingData.skipped || 0;
        progress.errorCount = existingData.errors || 0;
        progress.estimatedCostUsd = existingData.estimatedCostUsd || 0;

        await runRef.update({
          status: dryRun ? 'dry_run' : 'running',
          batchSize,
          maxCostUsd: maxCostUsd ?? existingData.maxCostUsd,
          rateLimitDelayMs,
          updatedAt: nowIso,
        });
      } else {
        await runRef.set({
          runId,
          status: dryRun ? 'dry_run' : 'running',
          collection: targetCollection,
          batchSize,
          cursor: effectiveCursor || null,
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
      }
    } catch (runErr) {
      console.error(`[BackfillEngine] Failed to initialize durable backfill run record ${runId}:`, runErr);
      throw runErr;
    }

    try {
      let query: any = firestoreDb.collection(targetCollection);
      if (typeof query.orderBy === 'function') {
        query = query.orderBy('__name__');
      }
      query = query.limit(batchSize);

      if (effectiveCursor) {
        const cursorDoc = await firestoreDb.collection(targetCollection).doc(effectiveCursor).get();
        if (cursorDoc && cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        } else if (typeof query.startAfter === 'function') {
          try {
            query = query.startAfter(effectiveCursor);
          } catch {
            // startAfter with string id fallback if supported
          }
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
        const docId = doc.id;
        const docData = doc.data() as any;

        if (progress.estimatedCostUsd >= maxCostUsd) {
          progress.nextCursor = docId;
          progress.isComplete = false;
          break;
        }

        const effectiveTaskType: TaskType = targetTaskType || (targetCollection === 'properties' ? 'property_rollup' : 'job_extraction');
        const idempotencyKey = buildIdempotencyKey(docId, effectiveTaskType.toUpperCase(), 'v1');

        // Check idempotency against queue
        const existingTask = await intelligenceTaskQueue.getByIdempotencyKeyAsync(idempotencyKey);
        if (existingTask && existingTask.status === 'succeeded') {
          progress.skippedIdempotentCount += 1;
          progress.nextCursor = docId;

          // Save checkpoint: must not be swallowed (fail-closed)
          await runRef.update({
            cursor: docId,
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
            let taskPayload: Record<string, unknown>;
            if (targetCollection === 'properties') {
              taskPayload = { property: { propertyId: docId, ...docData }, isBackfill: true };
            } else {
              const jobInput: JobSourceInput = {
                jobId: docId,
                title: docData.title || '',
                description: docData.description || '',
                category: docData.category || '',
                postcode: docData.postcode || '',
                createdAt: typeof docData.createdAt === 'string' ? docData.createdAt : undefined,
                photos: Array.isArray(docData.photos) ? docData.photos : undefined,
                documents: Array.isArray(docData.documents) ? docData.documents : undefined,
              };
              taskPayload = { job: jobInput, isBackfill: true };
            }

            const task = await intelligenceTaskQueue.enqueueTaskAsync(
              effectiveTaskType,
              targetCollection === 'properties' ? 'property' : 'job',
              docId,
              idempotencyKey,
              taskPayload
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

        // Save durable checkpoint after item handled: must not be swallowed (fail-closed)
        await runRef.update({
          cursor: docId,
          scanned: progress.totalScanned,
          processed: progress.processedCount,
          skipped: progress.skippedIdempotentCount,
          errors: progress.errorCount,
          estimatedCostUsd: progress.estimatedCostUsd,
          updatedAt: new Date().toISOString(),
        });

        if (rateLimitDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs));
        }

        progress.nextCursor = docId;
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
