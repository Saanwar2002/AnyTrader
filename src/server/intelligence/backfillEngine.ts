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

export const HARD_MAX_BATCH_SIZE = 500;
export const HARD_MAX_COST_USD = 100.0;

export class DuplicateActiveRunError extends Error {
  constructor(public readonly runScopeId: string, public readonly activeRunId: string) {
    super(
      `[BackfillEngine] Another active backfill run '${activeRunId}' is already running for scope '${runScopeId}'. Concurrent runs for the same target are forbidden.`
    );
    this.name = 'DuplicateActiveRunError';
  }
}

export interface BackfillOptions {
  batchSize?: number;       // Default 100, clamped to HARD_MAX_BATCH_SIZE (500)
  dryRun?: boolean;         // Default true (safe mode)
  maxCostUsd?: number;     // Stop if estimated cost exceeds this amount, clamped to HARD_MAX_COST_USD (100.0)
  cursor?: string;         // Checkpoint cursor for resumable execution (e.g. jobId)
  rateLimitDelayMs?: number; // Throttle between items (ms)
  runId?: string;          // Optional durable run ID
  collection?: 'jobs' | 'properties'; // Target collection (default 'jobs')
  targetTaskType?: TaskType; // Optional target task type
  tenantId?: string;       // Optional authoritative tenant / estate isolation filter
}

export type BackfillTerminationReason =
  | 'exhausted'
  | 'cost_limited'
  | 'item_failed'
  | 'batch_boundary'
  | 'checkpoint_failed'
  | 'cancelled'
  | 'fatal_error';

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
  runScopeId?: string;
  tenantId?: string | null;
  terminationReason?: BackfillTerminationReason;
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
  terminationReason?: BackfillTerminationReason;
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
      batchSize: rawBatchSize = 100,
      dryRun = true,
      maxCostUsd: rawMaxCostUsd = 10.0,
      cursor,
      rateLimitDelayMs = 20,
      runId = `bf_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      collection: targetCollection = 'jobs',
      targetTaskType,
      tenantId,
    } = options;

    // Enforce robust number validation & hard server-side ceilings
    const parsedBatch = typeof rawBatchSize === 'number' ? rawBatchSize : Number(rawBatchSize);
    const safeBatchSize = !Number.isFinite(parsedBatch) || parsedBatch <= 0
      ? 100
      : Math.min(Math.max(1, Math.floor(parsedBatch)), HARD_MAX_BATCH_SIZE);

    const parsedCost = typeof rawMaxCostUsd === 'number' ? rawMaxCostUsd : Number(rawMaxCostUsd);
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      throw new Error('[BackfillEngine] Invalid maxCostUsd: must be a finite positive number');
    }
    const safeMaxCostUsd = Math.min(parsedCost, HARD_MAX_COST_USD);

    const batchSize = safeBatchSize;
    const maxCostUsd = safeMaxCostUsd;

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

    // Scope locking: target collection + optional target task type + optional tenantId
    const effectiveTaskType: TaskType = targetTaskType || (targetCollection === 'properties' ? 'property_rollup' : 'job_extraction');
    const tenantSuffix = tenantId ? `_${tenantId}` : '';
    const runScopeId = `${targetCollection}_${effectiveTaskType}${tenantSuffix}`;
    const scopeLockRef = firestoreDb.collection('intelligence_backfill_scopes').doc(runScopeId);

    // 1. Transactional check: Prevent duplicate concurrent active runs for the same scope
    if (typeof firestoreDb.runTransaction === 'function') {
      await firestoreDb.runTransaction(async (tx: any) => {
        const lockSnap = await tx.get(scopeLockRef);
        if (lockSnap && lockSnap.exists) {
          const lockData = lockSnap.data() as any;
          if (lockData.status === 'running' && lockData.activeRunId !== runId) {
            throw new DuplicateActiveRunError(runScopeId, lockData.activeRunId);
          }
        }
        tx.set(scopeLockRef, {
          scopeId: runScopeId,
          activeRunId: runId,
          status: 'running',
          collection: targetCollection,
          tenantId: tenantId || null,
          updatedAt: nowIso,
        }, { merge: true });
      });
    }

    // 2. Initialize durable run record or resume existing run
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
        if (existingData.cursor) {
          progress.nextCursor = existingData.cursor;
        }

        await runRef.update({
          status: dryRun ? 'dry_run' : 'running',
          batchSize,
          maxCostUsd: Math.min(maxCostUsd, existingData.maxCostUsd ?? HARD_MAX_COST_USD),
          rateLimitDelayMs,
          runScopeId,
          tenantId: tenantId || existingData.tenantId || null,
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
          runScopeId,
          tenantId: tenantId || null,
          createdAt: nowIso,
          updatedAt: nowIso,
        }, { merge: true });
      }
    } catch (runErr) {
      console.error(`[BackfillEngine] Failed to initialize durable backfill run record ${runId}:`, runErr);
      try {
        await scopeLockRef.set({ status: 'failed', activeRunId: null, updatedAt: new Date().toISOString() }, { merge: true });
      } catch {}
      throw runErr;
    }

    try {
      let query: any = firestoreDb.collection(targetCollection);

      // Apply authoritative tenant isolation filter if tenantId is provided
      if (tenantId) {
        if (targetCollection === 'jobs') {
          query = query.where('estateId', '==', tenantId);
        } else if (targetCollection === 'properties') {
          query = query.where('estateId', '==', tenantId);
        }
      }

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

      if (!snapshot || !snapshot.docs || snapshot.docs.length === 0) {
        progress.isComplete = true;
        progress.terminationReason = 'exhausted';
        await runRef.update({
          status: 'completed',
          terminationReason: 'exhausted',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        try {
          await scopeLockRef.set({ status: 'completed', activeRunId: null, updatedAt: new Date().toISOString() }, { merge: true });
        } catch {}
        return progress;
      }

      let terminationReason: BackfillTerminationReason = 'batch_boundary';
      let shouldHaltBatch = false;

      for (const doc of snapshot.docs) {
        const docId = doc.id;
        const docData = doc.data() as any;

        // Verify tenant match if tenantId specified (defense-in-depth)
        if (tenantId && docData.estateId && docData.estateId !== tenantId) {
          continue;
        }

        // Check cost ceiling before processing item
        if (progress.estimatedCostUsd >= maxCostUsd) {
          terminationReason = 'cost_limited';
          shouldHaltBatch = true;
          break;
        }

        progress.totalScanned += 1;

        const idempotencyKey = buildIdempotencyKey(docId, effectiveTaskType.toUpperCase(), 'v1');

        // Check idempotency against queue
        const existingTask = await intelligenceTaskQueue.getByIdempotencyKeyAsync(idempotencyKey);
        if (existingTask && existingTask.status === 'succeeded') {
          progress.skippedIdempotentCount += 1;
          progress.nextCursor = docId;

          // Save checkpoint: fail-closed if persistence fails
          await runRef.update({
            cursor: docId,
            scanned: progress.totalScanned,
            skipped: progress.skippedIdempotentCount,
            updatedAt: new Date().toISOString(),
          });

          continue;
        }

        let itemSucceeded = false;

        if (dryRun) {
          progress.processedCount += 1;
          progress.estimatedCostUsd += 0.00005;
          itemSucceeded = true;
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
              itemSucceeded = true;
            } else {
              // Task failed: Halting rule — cursor MUST NOT advance beyond failed docId
              progress.errorCount += 1;
              itemSucceeded = false;
              terminationReason = 'item_failed';
              shouldHaltBatch = true;
            }
          } catch {
            progress.errorCount += 1;
            itemSucceeded = false;
            terminationReason = 'item_failed';
            shouldHaltBatch = true;
          }
        }

        if (itemSucceeded) {
          progress.nextCursor = docId;
          // Save durable checkpoint only for confirmed successful item
          await runRef.update({
            cursor: docId,
            scanned: progress.totalScanned,
            processed: progress.processedCount,
            skipped: progress.skippedIdempotentCount,
            errors: progress.errorCount,
            estimatedCostUsd: progress.estimatedCostUsd,
            updatedAt: new Date().toISOString(),
          });
        } else {
          // Record error counts in run record WITHOUT advancing cursor
          await runRef.update({
            cursor: progress.nextCursor || null,
            scanned: progress.totalScanned,
            processed: progress.processedCount,
            skipped: progress.skippedIdempotentCount,
            errors: progress.errorCount,
            estimatedCostUsd: progress.estimatedCostUsd,
            updatedAt: new Date().toISOString(),
          });
          // Stop batch immediately so later items cannot skip past this failure
          break;
        }

        if (rateLimitDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs));
        }

        if (shouldHaltBatch) {
          break;
        }
      }

      // Determine completion status:
      // A run is ONLY 'completed' if all documents in collection were naturally exhausted
      // (i.e. snapshot had fewer docs than batchSize AND processing did not stop due to cost or failure).
      if (!shouldHaltBatch && snapshot.docs.length < batchSize) {
        progress.isComplete = true;
        terminationReason = 'exhausted';
      } else {
        progress.isComplete = false;
      }

      progress.terminationReason = terminationReason;

      const finalStatus = progress.isComplete
        ? 'completed'
        : (terminationReason === 'item_failed' ? 'failed' : 'paused');

      await runRef.update({
        status: finalStatus,
        terminationReason,
        cursor: progress.nextCursor || null,
        completedAt: progress.isComplete ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      });

      if (progress.isComplete) {
        try {
          await scopeLockRef.set({ status: 'completed', activeRunId: null, updatedAt: new Date().toISOString() }, { merge: true });
        } catch {}
      } else {
        try {
          await scopeLockRef.set({ status: finalStatus, activeRunId: runId, updatedAt: new Date().toISOString() }, { merge: true });
        } catch {}
      }

      return progress;
    } catch (err) {
      console.error('[BackfillEngine] Firestore backfill execution error:', err);
      try {
        await runRef.update({
          status: 'failed',
          terminationReason: 'fatal_error',
          lastError: (err as Error).message || 'Unknown backfill failure',
          updatedAt: new Date().toISOString(),
        });
        await scopeLockRef.set({ status: 'failed', activeRunId: null, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (updateErr) {
        console.warn(`[BackfillEngine] Could not record failed status for run ${runId}:`, updateErr);
      }
      throw err;
    }
  }
}

export const controlledBackfillEngine = new ControlledBackfillEngine();
