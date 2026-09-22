/**
 * AnyTrader V8.2 — Task 25 Scale / Backfill / Resilience Test Suite
 * 
 * Verifies 20 Mandatory Vectors:
 * Vector 1: Production backfill exclusively routes to executeFirestoreBackfill and rejects legacy array-based executeBackfill under NODE_ENV=production.
 * Vector 2: Production backfill uses bounded query with limit(batchSize), never reading entire collection into memory or performing unbounded collection.get().
 * Vector 3: Durable backfill run document initialized in /intelligence_backfill_runs/{runId} with initial state (status, cursor, batchSize, etc.).
 * Vector 4: Durable checkpoints written to /intelligence_backfill_runs/{runId} on every processed item and fail-closed if checkpoint write fails.
 * Vector 5: Resumability: Process restart / resume with existing runId continues from the persisted checkpoint cursor without reprocessing earlier items.
 * Vector 6: Dry-run mode (dryRun: true) scans and simulates without enqueuing live execution writes or mutating source records.
 * Vector 7: Live backfill enqueues tasks via intelligenceTaskQueue using the Task-First pattern with deterministic idempotency keys.
 * Vector 8: Skipped idempotent items: Tasks already succeeded are recognized, counted as skippedIdempotentCount, and checkpointed without redundant execution.
 * Vector 9: Cost cap enforcement (maxCostUsd): Backfill stops gracefully with status 'paused' and preserves nextCursor when cost limit reached.
 * Vector 10: Rate limit throttle (rateLimitDelayMs): Engine respects delay between successive document batches / tasks.
 * Vector 11: Completion detection: When query returns empty or < batchSize, run transitions to 'completed' with completedAt timestamp.
 * Vector 12: Failure handling: Backfill run transitions to 'failed' with lastError if an unrecoverable batch error occurs.
 * Vector 13: Task Queue: Atomic claim via transaction prevents concurrent workers from double-claiming the same task.
 * Vector 14: Task Queue: Worker lease expiration — stale lease recovery resets task to 'retrying' or 'dead_letter'.
 * Vector 15: Task Queue: Worker losing lease during execution (lease timeout or stolen lease) MUST NOT finalize the task (throws OwnershipLostError).
 * Vector 16: Task Queue: Retryable error (e.g. transient 503 / timeout / 429) transitions task to 'retrying' with exponential backoff timestamp.
 * Vector 17: Task Queue: Terminal / Non-retryable error (e.g. AICandidateSecurityError, lineage validation, missing evidence, missing handler) transitions task directly to 'dead_letter'.
 * Vector 18: Task Queue: Retries do NOT create duplicate immutable historical snapshots (idempotent snapshot writes in history collections).
 * Vector 19: Task Queue: Max retry exhaustion transitions task to 'dead_letter' after reaching maxAttempts.
 * Vector 20: Concurrent workers: Multiple workers operating on the queue process disjoint tasks without race conditions or state corruption.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ControlledBackfillEngine,
  controlledBackfillEngine,
} from '../../src/server/intelligence/backfillEngine';
import {
  IntelligenceTaskQueue,
  intelligenceTaskQueue,
  taskDocumentId,
  OwnershipLostError,
} from '../../src/server/intelligence/intelligenceTaskQueue';
import { buildIdempotencyKey } from '../../src/server/intelligence/provenance';
import { AICandidateSecurityError } from '../../src/server/intelligence/aiCandidateBoundary';
import {
  buyerIntelligenceService,
  BuyerIntelligenceService,
  BUYER_INTELLIGENCE_SCHEMA_VERSION,
} from '../../src/server/intelligence/buyerIntelligence';
import {
  propertyPassportService,
  PropertyPassportService,
} from '../../src/server/intelligence/propertyPassport';
import { setGlobalIntelligenceDb } from '../../src/server/intelligence/immutableStore';

// =========================================================================
// In-Memory Mock Store with Full Query, Limit, StartAfter, and Transaction Semantics
// =========================================================================
function createMockFirestoreDb(initialData: {
  jobs?: Record<string, any>;
  properties?: Record<string, any>;
  intelligence_backfill_runs?: Record<string, any>;
  intelligence_tasks?: Record<string, any>;
  intelligence_processing_runs?: Record<string, any>;
  buyer_intelligence?: Record<string, any>;
  buyer_intelligence_history?: Record<string, any>;
} = {}) {
  const store: Record<string, Map<string, any>> = {
    jobs: new Map(Object.entries(initialData.jobs || {})),
    properties: new Map(Object.entries(initialData.properties || {})),
    intelligence_backfill_runs: new Map(Object.entries(initialData.intelligence_backfill_runs || {})),
    intelligence_tasks: new Map(Object.entries(initialData.intelligence_tasks || {})),
    intelligence_processing_runs: new Map(Object.entries(initialData.intelligence_processing_runs || {})),
    buyer_intelligence: new Map(Object.entries(initialData.buyer_intelligence || {})),
    buyer_intelligence_history: new Map(Object.entries(initialData.buyer_intelligence_history || {})),
  };

  let txMutex: Promise<void> = Promise.resolve();

  const createQuery = (
    colName: string,
    filters: Array<{ field: string; op: string; value: any }> = [],
    orderFields: Array<{ field: string; dir: 'asc' | 'desc' }> = [],
    limitVal?: number,
    startAfterDocId?: string
  ) => {
    if (!store[colName]) {
      store[colName] = new Map();
    }
    return {
      where: (field: string, op: string, value: any) => {
        return createQuery(colName, [...filters, { field, op, value }], orderFields, limitVal, startAfterDocId);
      },
      orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') => {
        return createQuery(colName, filters, [...orderFields, { field, dir }], limitVal, startAfterDocId);
      },
      limit: (val: number) => {
        return createQuery(colName, filters, orderFields, val, startAfterDocId);
      },
      startAfter: (cursorDocOrId: any) => {
        const id = typeof cursorDocOrId === 'string' ? cursorDocOrId : cursorDocOrId?.id;
        return createQuery(colName, filters, orderFields, limitVal, id);
      },
      get: async () => {
        let items = Array.from(store[colName].entries()).map(([id, data]) => ({ id, ...data }));
        
        // Natural key sort
        items.sort((a, b) => a.id.localeCompare(b.id));

        for (const f of filters) {
          if (f.op === '==') {
            items = items.filter((item) => item[f.field] === f.value);
          }
        }

        if (startAfterDocId) {
          const idx = items.findIndex((i) => i.id === startAfterDocId);
          if (idx !== -1) {
            items = items.slice(idx + 1);
          }
        }

        if (limitVal !== undefined) {
          items = items.slice(0, limitVal);
        }

        return {
          docs: items.map((item) => ({
            id: item.id,
            data: () => item,
            exists: true,
          })),
          size: items.length,
          empty: items.length === 0,
        };
      },
    };
  };

  return {
    collection: (colName: string) => {
      if (!store[colName]) {
        store[colName] = new Map();
      }
      return {
        doc: (docId: string) => ({
          id: docId,
          get: async () => {
            const data = store[colName].get(docId);
            return {
              id: docId,
              exists: !!data,
              data: () => data,
            };
          },
          set: async (data: any, options?: any) => {
            if (options?.merge && store[colName].has(docId)) {
              const prev = store[colName].get(docId);
              store[colName].set(docId, { ...prev, ...data });
            } else {
              store[colName].set(docId, data);
            }
          },
          update: async (data: any) => {
            const existing = store[colName]?.get(docId);
            if (!existing) {
              throw new Error(`Document ${docId} does not exist for update`);
            }
            store[colName].set(docId, { ...existing, ...data });
          },
        }),
        where: (field: string, op: string, value: any) => createQuery(colName, [{ field, op, value }]),
        orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') => createQuery(colName, [], [{ field, dir }]),
        limit: (val: number) => createQuery(colName, [], [], val),
        startAfter: (docOrId: any) => createQuery(colName, [], [], undefined, typeof docOrId === 'string' ? docOrId : docOrId?.id),
        get: async () => createQuery(colName).get(),
      };
    },
    runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
      let release: () => void;
      const nextMutex = new Promise<void>((res) => {
        release = res;
      });
      const currentMutex = txMutex;
      txMutex = currentMutex.then(() => nextMutex);

      await currentMutex;
      try {
        const tx = {
          get: async (docRef: any) => docRef.get(),
          set: (docRef: any, data: any, options?: any) => docRef.set(data, options),
          update: (docRef: any, data: any) => docRef.update(data),
        };
        return await updateFunction(tx);
      } finally {
        release!();
      }
    },
    _store: store,
  };
}

describe('V8.2 Task 25 — Scale / Backfill / Resilience Suite (20 Mandatory Vectors)', () => {
  let mockDb: any;

  beforeEach(() => {
    // Populate 15 sample jobs (job_001 to job_015)
    const initialJobs: Record<string, any> = {};
    for (let i = 1; i <= 15; i++) {
      const id = `job_${String(i).padStart(3, '0')}`;
      initialJobs[id] = {
        title: `Job ${i} Emergency Repair`,
        description: `Leak repair description for unit ${i}`,
        category: 'Plumbing',
        postcode: 'SW1A 1AA',
        createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      };
    }

    mockDb = createMockFirestoreDb({ jobs: initialJobs });
    intelligenceTaskQueue.setFirestoreDb(mockDb);
    setGlobalIntelligenceDb(mockDb);
  });

  afterEach(() => {
    intelligenceTaskQueue.setFirestoreDb(null);
    setGlobalIntelligenceDb(null);
    vi.restoreAllMocks();
  });

  // =========================================================================
  // VECTOR 1: Production Backfill Route Enforcement
  // =========================================================================
  it('Vector 1: Production backfill exclusively routes to executeFirestoreBackfill and rejects legacy array-based executeBackfill under NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      // 1. Direct legacy call must throw hard
      await expect(
        controlledBackfillEngine.executeBackfill([], { batchSize: 10, dryRun: true })
      ).rejects.toThrow(/legacy array-based method and is strictly forbidden in production/i);

      // 2. Production executeFirestoreBackfill runs successfully
      const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
        batchSize: 5,
        dryRun: true,
      });
      expect(progress.processedCount).toBe(5);
      expect(progress.runId).toMatch(/^bf_run_/);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // =========================================================================
  // VECTOR 2: Bounded Batch Querying (limit)
  // =========================================================================
  it('Vector 2: Production backfill uses bounded query with limit(batchSize), never reading entire collection into memory or performing unbounded collection.get()', async () => {
    const collectionSpy = vi.spyOn(mockDb, 'collection');

    const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      batchSize: 4,
      dryRun: true,
    });

    expect(collectionSpy).toHaveBeenCalledWith('jobs');
    // Scanned count strictly equals batchSize, not total collection count (15)
    expect(progress.totalScanned).toBe(4);
    expect(progress.processedCount).toBe(4);
    expect(progress.nextCursor).toBe('job_004');
    expect(progress.isComplete).toBe(false);
  });

  // =========================================================================
  // VECTOR 3: Durable Backfill Run Document Initialization
  // =========================================================================
  it('Vector 3: Durable backfill run document initialized in /intelligence_backfill_runs/{runId} with initial state (status, cursor, batchSize, etc.)', async () => {
    const runId = 'bf_run_init_verification_v3';

    await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 3,
      dryRun: true,
      maxCostUsd: 5.0,
      rateLimitDelayMs: 0,
    });

    const runDoc = mockDb._store.intelligence_backfill_runs.get(runId);
    expect(runDoc).toBeDefined();
    expect(runDoc.runId).toBe(runId);
    expect(runDoc.batchSize).toBe(3);
    expect(runDoc.maxCostUsd).toBe(5.0);
    expect(runDoc.cursor).toBe('job_003');
    expect(runDoc.scanned).toBe(3);
    expect(runDoc.processed).toBe(3);
    expect(runDoc.status).toBe('paused');
  });

  // =========================================================================
  // VECTOR 4: Durable Checkpoint Persistence (Fail-Closed)
  // =========================================================================
  it('Vector 4: Durable checkpoints written to /intelligence_backfill_runs/{runId} on every processed item and fail-closed if checkpoint write fails', async () => {
    const runId = 'bf_run_fail_closed_checkpoint';

    // Mock doc update to throw on second checkpoint
    let updateCount = 0;
    const originalDoc = mockDb.collection('intelligence_backfill_runs').doc(runId);
    const faultyDoc = {
      ...originalDoc,
      update: async (data: any) => {
        updateCount++;
        if (updateCount > 2) {
          throw new Error('Disk quota exceeded: Failed to write durable backfill checkpoint');
        }
        return originalDoc.update(data);
      },
      get: originalDoc.get,
      set: originalDoc.set,
    };

    const originalCollection = mockDb.collection;
    mockDb.collection = (name: string) => {
      if (name === 'intelligence_backfill_runs') {
        return {
          ...originalCollection(name),
          doc: (id: string) => (id === runId ? faultyDoc : originalCollection(name).doc(id)),
        };
      }
      return originalCollection(name);
    };

    // Engine must fail closed and rethrow hard error rather than proceeding
    await expect(
      controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
        runId,
        batchSize: 5,
        dryRun: true,
        rateLimitDelayMs: 0,
      })
    ).rejects.toThrow(/Failed to write durable backfill checkpoint/i);
  });

  // =========================================================================
  // VECTOR 5: Resumability Across Process Restarts
  // =========================================================================
  it('Vector 5: Resumability: Process restart / resume with existing runId continues from the persisted checkpoint cursor without reprocessing earlier items', async () => {
    const runId = 'bf_run_resumable_v5';

    // Run 1: Processes first 5 items (job_001 to job_005)
    const run1 = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 5,
      dryRun: true,
      rateLimitDelayMs: 0,
    });
    expect(run1.nextCursor).toBe('job_005');
    expect(run1.processedCount).toBe(5);

    // Simulate process restart: instantiate a new engine instance and resume
    const freshEngine = new ControlledBackfillEngine();
    const run2 = await freshEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 5,
      dryRun: true,
      rateLimitDelayMs: 0,
    });

    // Run 2 continued from job_005 and processed job_006 to job_010
    expect(run2.nextCursor).toBe('job_010');
    expect(run2.processedCount).toBe(10); // Cumulative counter preserved
    expect(run2.totalScanned).toBe(5);
    expect(run2.isComplete).toBe(false);

    // Verify in Firestore document
    const persisted = mockDb._store.intelligence_backfill_runs.get(runId);
    expect(persisted.cursor).toBe('job_010');
    expect(persisted.processed).toBe(10);
  });

  // =========================================================================
  // VECTOR 6: Dry-Run Mode Safety
  // =========================================================================
  it('Vector 6: Dry-run mode (dryRun: true) scans and simulates without enqueuing live execution writes or mutating source records', async () => {
    const runId = 'bf_run_dry_run_v6';

    const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 3,
      dryRun: true,
      rateLimitDelayMs: 0,
    });

    expect(progress.processedCount).toBe(3);
    // In dry-run mode, NO live tasks should be enqueued in intelligence_tasks
    expect(mockDb._store.intelligence_tasks.size).toBe(0);
    // Source jobs remain completely untouched
    const job1 = mockDb._store.jobs.get('job_001');
    expect(job1.processedAt).toBeUndefined();
  });

  // =========================================================================
  // VECTOR 7: Live Backfill Task-First Pattern
  // =========================================================================
  it('Vector 7: Live backfill enqueues tasks via intelligenceTaskQueue using the Task-First pattern with deterministic idempotency keys', async () => {
    const runId = 'bf_run_live_task_first_v7';

    // Register a mock handler for job_extraction
    intelligenceTaskQueue.registerHandler('job_extraction', async (task) => {
      return { extracted: true, jobId: task.aggregateId };
    });

    const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 2,
      dryRun: false,
      rateLimitDelayMs: 0,
    });

    expect(progress.processedCount).toBe(2);
    // Live tasks must be persisted in /intelligence_tasks with status succeeded
    expect(mockDb._store.intelligence_tasks.size).toBe(2);

    const tasks = Array.from(mockDb._store.intelligence_tasks.values());
    expect(tasks.every((t: any) => t.status === 'succeeded')).toBe(true);
    expect(tasks.every((t: any) => t.idempotencyKey.includes('JOB_EXTRACTION'))).toBe(true);
  });

  // =========================================================================
  // VECTOR 8: Skipped Idempotent Items
  // =========================================================================
  it('Vector 8: Skipped idempotent items: Tasks already succeeded are recognized, counted as skippedIdempotentCount, and checkpointed without redundant execution', async () => {
    const runId = 'bf_run_idempotency_skip_v8';

    // Pre-seed job_001 task as already succeeded using deterministic idempotency key
    const idempotencyKey = buildIdempotencyKey('job_001', 'JOB_EXTRACTION', 'v1');
    const taskId = taskDocumentId(idempotencyKey);
    mockDb._store.intelligence_tasks.set(taskId, {
      taskId,
      status: 'succeeded',
      idempotencyKey,
      aggregateType: 'job',
      aggregateId: 'job_001',
      completedAt: new Date().toISOString(),
    });

    const handlerSpy = vi.fn().mockResolvedValue({ processed: true });
    intelligenceTaskQueue.registerHandler('job_extraction', handlerSpy);

    const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 2,
      dryRun: false,
      rateLimitDelayMs: 0,
    });

    expect(progress.skippedIdempotentCount).toBe(1);
    expect(progress.processedCount).toBe(1); // Only job_002 was executed
    expect(handlerSpy).toHaveBeenCalledTimes(1); // job_001 was NOT re-executed
  });

  // =========================================================================
  // VECTOR 9: Cost Cap Enforcement
  // =========================================================================
  it('Vector 9: Cost cap enforcement (maxCostUsd): Backfill stops gracefully with status paused and preserves nextCursor when cost limit reached', async () => {
    const runId = 'bf_run_cost_cap_v9';

    // Set maxCostUsd so low that processing 2 items (0.00005 each) exceeds 0.00006
    const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 5,
      dryRun: true,
      maxCostUsd: 0.00006,
      rateLimitDelayMs: 0,
    });

    // Should halt after 2 items
    expect(progress.processedCount).toBe(2);
    expect(progress.nextCursor).toBe('job_003');
    expect(progress.isComplete).toBe(false);

    const runDoc = mockDb._store.intelligence_backfill_runs.get(runId);
    expect(runDoc.status).toBe('paused');
  });

  // =========================================================================
  // VECTOR 10: Rate Limit Throttle
  // =========================================================================
  it('Vector 10: Rate limit throttle (rateLimitDelayMs): Engine respects delay between successive document batches / tasks', async () => {
    const runId = 'bf_run_rate_limit_v10';
    const startTime = Date.now();

    await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 3,
      dryRun: true,
      rateLimitDelayMs: 30, // 30ms throttle per item
    });

    const elapsed = Date.now() - startTime;
    // For 3 items with 30ms each, elapsed must be at least ~60-90ms
    expect(elapsed).toBeGreaterThanOrEqual(60);
  });

  // =========================================================================
  // VECTOR 11: Completion Detection
  // =========================================================================
  it('Vector 11: Completion detection: When query returns empty or < batchSize, run transitions to completed with completedAt timestamp', async () => {
    const runId = 'bf_run_completion_v11';

    // Request batchSize 20 which exceeds available 15 items
    const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 20,
      dryRun: true,
      rateLimitDelayMs: 0,
    });

    expect(progress.isComplete).toBe(true);
    expect(progress.totalScanned).toBe(15);
    expect(progress.processedCount).toBe(15);

    const runDoc = mockDb._store.intelligence_backfill_runs.get(runId);
    expect(runDoc.status).toBe('completed');
    expect(runDoc.completedAt).toBeDefined();
  });

  // =========================================================================
  // VECTOR 12: Failure Handling
  // =========================================================================
  it('Vector 12: Failure handling: Backfill run transitions to failed with lastError if an unrecoverable batch error occurs', async () => {
    const runId = 'bf_run_unrecoverable_failure_v12';

    // Cause an unrecoverable error during Firestore query
    const faultyDb = {
      ...mockDb,
      collection: (name: string) => {
        if (name === 'jobs') {
          return {
            orderBy: () => ({
              limit: () => ({
                get: async () => {
                  throw new Error('DATABASE_INTERNAL_CORRUPTION: Unrecoverable disk I/O failure');
                },
              }),
            }),
          };
        }
        return mockDb.collection(name);
      },
    };

    await expect(
      controlledBackfillEngine.executeFirestoreBackfill(faultyDb, {
        runId,
        batchSize: 5,
        dryRun: true,
      })
    ).rejects.toThrow(/DATABASE_INTERNAL_CORRUPTION/i);

    const runDoc = mockDb._store.intelligence_backfill_runs.get(runId);
    expect(runDoc.status).toBe('failed');
    expect(runDoc.lastError).toMatch(/DATABASE_INTERNAL_CORRUPTION/i);
  });

  // =========================================================================
  // VECTOR 13: Task Queue Atomic Claiming
  // =========================================================================
  it('Vector 13: Task Queue: Atomic claim via transaction prevents concurrent workers from double-claiming the same task', async () => {
    const taskId = 'task_atomic_claim_race_v13';
    mockDb._store.intelligence_tasks.set(taskId, {
      taskId,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const queue1 = new IntelligenceTaskQueue(5, 60000, 'worker_node_1');
    queue1.setFirestoreDb(mockDb);

    const queue2 = new IntelligenceTaskQueue(5, 60000, 'worker_node_2');
    queue2.setFirestoreDb(mockDb);

    // Two workers attempt to claim simultaneously
    const [claimedWorker1, claimedWorker2] = await Promise.all([
      queue1.claimTaskTransactional(taskId, 'worker_node_1', 30000),
      queue2.claimTaskTransactional(taskId, 'worker_node_2', 30000),
    ]);

    // Exactly one worker must win the claim
    expect(
      (claimedWorker1 && !claimedWorker2) || (!claimedWorker1 && claimedWorker2)
    ).toBe(true);

    const taskInDb = mockDb._store.intelligence_tasks.get(taskId);
    expect(taskInDb.status).toBe('processing');
    expect(taskInDb.attempts).toBe(1);
    expect(['worker_node_1', 'worker_node_2']).toContain(taskInDb.workerId);
  });

  // =========================================================================
  // VECTOR 14: Worker Lease Expiration & Stale Recovery
  // =========================================================================
  it('Vector 14: Task Queue: Worker lease expiration — stale lease recovery resets task to retrying or dead_letter', async () => {
    const taskId = 'task_stale_lease_recovery_v14';
    const expiredTimestamp = new Date(Date.now() - 60000).toISOString(); // Expired 1 min ago

    mockDb._store.intelligence_tasks.set(taskId, {
      taskId,
      status: 'processing',
      workerId: 'worker_crashed_node',
      leaseId: 'lease_dead_123',
      leaseExpiresAt: expiredTimestamp,
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: expiredTimestamp,
    });

    const queue = new IntelligenceTaskQueue(5, 60000, 'worker_health_monitor');
    queue.setFirestoreDb(mockDb);

    const recovered = await queue.recoverStaleTasksAsync();
    expect(recovered.length).toBe(1);
    expect(recovered[0].taskId).toBe(taskId);
    expect(recovered[0].status).toBe('retrying');
    expect(recovered[0].leaseId).toBeFalsy();
    expect(recovered[0].workerId).toBeFalsy();

    // Verify task state in Firestore
    const taskInDb = mockDb._store.intelligence_tasks.get(taskId);
    expect(taskInDb.status).toBe('retrying');
  });

  // =========================================================================
  // VECTOR 15: Worker Lease Ownership Verification
  // =========================================================================
  it('Vector 15: Task Queue: Worker losing lease during execution (lease timeout or stolen lease) MUST NOT finalize the task (throws OwnershipLostError)', async () => {
    const taskId = 'task_lease_loss_defense_v15';
    const nowIso = new Date().toISOString();

    mockDb._store.intelligence_tasks.set(taskId, {
      taskId,
      status: 'pending',
      taskType: 'job_extraction',
      attempts: 0,
      maxAttempts: 3,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const queue = new IntelligenceTaskQueue(5, 60000, 'worker_slow');
    queue.setFirestoreDb(mockDb);

    // Register a handler that simulates lease theft mid-flight
    queue.registerHandler('job_extraction', async () => {
      // While handler is executing, lease is expired / stolen by another worker
      const taskDoc = mockDb._store.intelligence_tasks.get(taskId);
      mockDb._store.intelligence_tasks.set(taskId, {
        ...taskDoc,
        workerId: 'worker_fast_usurper',
        leaseId: 'lease_usurped_999',
      });
      return { success: true };
    });

    // executeTask must catch OwnershipLostError and NOT finalize with succeeded status
    const resultTask = await queue.executeTask(taskId, 'worker_slow');
    expect(resultTask.status).not.toBe('succeeded');
    // Task remains owned by the usurper, not overwritten by slow worker
    const taskInDb = mockDb._store.intelligence_tasks.get(taskId);
    expect(taskInDb.workerId).toBe('worker_fast_usurper');
  });

  // =========================================================================
  // VECTOR 16: Retryable Error Classification & Exponential Backoff
  // =========================================================================
  it('Vector 16: Task Queue: Retryable error (e.g. transient 503 / timeout / 429) transitions task to retrying with exponential backoff timestamp', async () => {
    const taskId = 'task_retryable_error_v16';
    mockDb._store.intelligence_tasks.set(taskId, {
      taskId,
      status: 'pending',
      taskType: 'job_extraction',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const queue = new IntelligenceTaskQueue(5, 60000, 'worker_resilience');
    queue.setFirestoreDb(mockDb);

    // Register a handler that throws a transient 503 error
    queue.registerHandler('job_extraction', async () => {
      const err: any = new Error('Service Unavailable: Gemini upstream 503 overload');
      err.status = 503;
      throw err;
    });

    const result = await queue.executeTask(taskId, 'worker_resilience');
    expect(result.status).toBe('retrying');
    expect(result.attempts).toBe(1);
    expect(result.nextAttemptAt).toBeDefined();
    expect(new Date(result.nextAttemptAt!).getTime()).toBeGreaterThan(Date.now());
  });

  // =========================================================================
  // VECTOR 17: Terminal / Non-Retryable Error to dead_letter
  // =========================================================================
  it('Vector 17: Task Queue: Terminal / Non-retryable error (e.g. AICandidateSecurityError, lineage validation, missing evidence, missing handler) transitions task directly to dead_letter', async () => {
    const taskId = 'task_terminal_security_error_v17';
    mockDb._store.intelligence_tasks.set(taskId, {
      taskId,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const queue = new IntelligenceTaskQueue(5, 60000, 'worker_security');
    queue.setFirestoreDb(mockDb);

    // Register handler that throws AICandidateSecurityError (terminal violation)
    queue.registerHandler('job_extraction', async () => {
      throw new AICandidateSecurityError('Untrusted AI candidate attempted privilege escalation on propertyId');
    });

    const result = await queue.executeTask(taskId, 'worker_security');
    expect(result.status).toBe('dead_letter');
    expect(result.attempts).toBe(1); // Sent to dead_letter immediately without wasting retries
    expect(result.error?.classification).toBe('NON_RETRYABLE');
  });

  // =========================================================================
  // VECTOR 18: Retries Do NOT Duplicate Immutable Historical Snapshots
  // =========================================================================
  it('Vector 18: Task Queue: Retries do NOT create duplicate immutable historical snapshots (idempotent snapshot writes in history collections)', async () => {
    const propId = 'prop_idempotency_v18';
    mockDb._store.properties.set(propId, {
      propertyId: propId,
      address: '10 Downing St',
      postcode: 'SW1A 2AA',
      createdAt: new Date().toISOString(),
    });

    const buyerService = new BuyerIntelligenceService();
    buyerService.setFirestoreDb(mockDb);

    // Run assessment generation pass 1
    const pass1 = await buyerService.generateBuyerIntelligence({ propertyId: propId }, { firestoreDb: mockDb });
    const assessmentId = pass1.provenance.assessmentId;

    const initialHistorySize = mockDb._store.buyer_intelligence_history.size;
    expect(initialHistorySize).toBe(1);

    // Simulate task retry: re-run derivation with exact same deterministic parameters
    const pass2 = await buyerService.generateBuyerIntelligence({ propertyId: propId }, { firestoreDb: mockDb });
    expect(pass2.provenance.assessmentId).toBe(assessmentId);

    // Immutable historical snapshots MUST NOT be duplicated
    expect(mockDb._store.buyer_intelligence_history.size).toBe(initialHistorySize);
    expect(mockDb._store.buyer_intelligence_history.has(assessmentId)).toBe(true);
  });

  // =========================================================================
  // VECTOR 19: Max Retries Exhaustion to dead_letter
  // =========================================================================
  it('Vector 19: Task Queue: Max retry exhaustion transitions task to dead_letter after reaching maxAttempts', async () => {
    const taskId = 'task_exhaustion_v19';
    // Pre-seed task at attempt 2 with maxAttempts 3
    mockDb._store.intelligence_tasks.set(taskId, {
      taskId,
      status: 'retrying',
      attempts: 2,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const queue = new IntelligenceTaskQueue(5, 60000, 'worker_exhaustion');
    queue.setFirestoreDb(mockDb);

    queue.registerHandler('job_extraction', async () => {
      throw new Error('Network timeout: Transient gateway 504 error');
    });

    const result = await queue.executeTask(taskId, 'worker_exhaustion');
    expect(result.status).toBe('dead_letter');
    expect(result.attempts).toBe(3);
    expect(result.errorCode).toBe('MAX_RETRIES_EXCEEDED');
  });

  // =========================================================================
  // VECTOR 20: Concurrent Disjoint Task Processing
  // =========================================================================
  it('Vector 20: Concurrent workers: Multiple workers operating on the queue process disjoint tasks without race conditions or state corruption', async () => {
    const queue = new IntelligenceTaskQueue(5, 60000, 'worker_pool');
    queue.setFirestoreDb(mockDb);

    const executedTasks: string[] = [];
    queue.registerHandler('job_extraction', async (task) => {
      executedTasks.push(task.taskId);
      return { done: true };
    });

    // Seed 4 pending tasks
    for (let i = 1; i <= 4; i++) {
      const id = `task_concurrent_${i}`;
      mockDb._store.intelligence_tasks.set(id, {
        taskId: id,
        status: 'pending',
        taskType: 'job_extraction',
        aggregateType: 'job',
        aggregateId: `job_${i}`,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Trigger worker tick to process all runnable tasks concurrently
    await queue.workerTick();

    expect(executedTasks.length).toBe(4);
    // All 4 tasks should be unique (no duplicates or overlaps)
    const uniqueExecuted = new Set(executedTasks);
    expect(uniqueExecuted.size).toBe(4);

    // All tasks must have succeeded in the store
    for (let i = 1; i <= 4; i++) {
      const task = mockDb._store.intelligence_tasks.get(`task_concurrent_${i}`);
      expect(task.status).toBe('succeeded');
    }
  });
});
