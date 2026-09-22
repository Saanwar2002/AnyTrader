/**
 * AnyTrader V8.2 — Task 25 Scale / Backfill / Resilience Test Suite
 * 
 * Includes:
 * SECTION 1: Unit & Deterministic Logic Tests (Mock Store & Circuit Breakers)
 * SECTION 2: Real Production Firebase Emulator Integration Tests (initializeTestEnvironment & real Firestore Admin DB)
 */

process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import * as admin from 'firebase-admin';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

import {
  ControlledBackfillEngine,
  controlledBackfillEngine,
  DuplicateActiveRunError,
  HARD_MAX_BATCH_SIZE,
  HARD_MAX_COST_USD,
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
import { registerIntelligenceTaskHandlers } from '../../server';

// =========================================================================
// In-Memory Mock Store for Deterministic Circuit Breaker & Unit Tests
// =========================================================================
function createMockFirestoreDb(initialData: {
  jobs?: Record<string, any>;
  properties?: Record<string, any>;
  intelligence_backfill_runs?: Record<string, any>;
  intelligence_backfill_scopes?: Record<string, any>;
  intelligence_tasks?: Record<string, any>;
  intelligence_processing_runs?: Record<string, any>;
  buyer_intelligence?: Record<string, any>;
  buyer_intelligence_history?: Record<string, any>;
} = {}) {
  const store: Record<string, Map<string, any>> = {
    jobs: new Map(Object.entries(initialData.jobs || {})),
    properties: new Map(Object.entries(initialData.properties || {})),
    intelligence_backfill_runs: new Map(Object.entries(initialData.intelligence_backfill_runs || {})),
    intelligence_backfill_scopes: new Map(Object.entries(initialData.intelligence_backfill_scopes || {})),
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

// =========================================================================
// SECTION 1: Unit & Logic Tests (Mock Store & Circuit Breakers)
// =========================================================================
describe('Task 25 — Scale / Backfill / Resilience Unit & Circuit Breaker Tests', () => {
  let mockDb: any;

  beforeEach(() => {
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

  it('Vector 1: Production backfill exclusively routes to executeFirestoreBackfill and rejects legacy array-based executeBackfill under NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      await expect(
        controlledBackfillEngine.executeBackfill([], { batchSize: 10, dryRun: true })
      ).rejects.toThrow(/legacy array-based method and is strictly forbidden in production/i);

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

  it('Vector 2: Production backfill uses bounded query with limit(batchSize), clamping to HARD_MAX_BATCH_SIZE', async () => {
    const collectionSpy = vi.spyOn(mockDb, 'collection');

    const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      batchSize: 4,
      dryRun: true,
    });

    expect(collectionSpy).toHaveBeenCalledWith('jobs');
    expect(progress.totalScanned).toBe(4);
    expect(progress.processedCount).toBe(4);
    expect(progress.nextCursor).toBe('job_004');
    expect(progress.isComplete).toBe(false);
  });

  it('Vector 2B: Hard ceilings enforce server-side clamping of batchSize and maxCostUsd', async () => {
    const runId = 'bf_run_ceilings_test';
    await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 999999, // Should clamp to HARD_MAX_BATCH_SIZE (500)
      maxCostUsd: 999999, // Should clamp to HARD_MAX_COST_USD (100)
      dryRun: true,
    });

    const runDoc = mockDb._store.intelligence_backfill_runs.get(runId);
    expect(runDoc.batchSize).toBe(HARD_MAX_BATCH_SIZE);
    expect(runDoc.maxCostUsd).toBe(HARD_MAX_COST_USD);
  });

  it('Vector 2C: Transactional protection against duplicate active backfill runs for the same scope', async () => {
    const runId1 = 'bf_run_scope_active_1';
    const runId2 = 'bf_run_scope_active_2';

    // Run 1 starts on jobs
    await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId: runId1,
      batchSize: 2,
      dryRun: true,
    });

    // Mark run 1 as currently running in scope lock
    mockDb._store.intelligence_backfill_scopes.set('jobs_job_extraction', {
      scopeId: 'jobs_job_extraction',
      activeRunId: runId1,
      status: 'running',
      updatedAt: new Date().toISOString(),
    });

    // Run 2 attempts to run on the same scope simultaneously
    await expect(
      controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
        runId: runId2,
        batchSize: 2,
        dryRun: true,
      })
    ).rejects.toThrow(DuplicateActiveRunError);
  });

  it('Vector 3: Durable backfill run document initialized in /intelligence_backfill_runs/{runId} with initial state', async () => {
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

  it('Vector 4: Durable checkpoints written to /intelligence_backfill_runs/{runId} on every processed item and fail-closed if checkpoint write fails', async () => {
    const runId = 'bf_run_fail_closed_checkpoint';

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

    await expect(
      controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
        runId,
        batchSize: 5,
        dryRun: true,
        rateLimitDelayMs: 0,
      })
    ).rejects.toThrow(/Failed to write durable backfill checkpoint/i);
  });

  it('Vector 5: Resumability: Process restart / resume with existing runId continues from the persisted checkpoint cursor without reprocessing earlier items', async () => {
    const runId = 'bf_run_resumable_v5';

    const run1 = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 5,
      dryRun: true,
      rateLimitDelayMs: 0,
    });
    expect(run1.nextCursor).toBe('job_005');
    expect(run1.processedCount).toBe(5);

    const freshEngine = new ControlledBackfillEngine();
    const run2 = await freshEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 5,
      dryRun: true,
      rateLimitDelayMs: 0,
    });

    expect(run2.nextCursor).toBe('job_010');
    expect(run2.processedCount).toBe(10);
    expect(run2.totalScanned).toBe(5);
    expect(run2.isComplete).toBe(false);

    const persisted = mockDb._store.intelligence_backfill_runs.get(runId);
    expect(persisted.cursor).toBe('job_010');
    expect(persisted.processed).toBe(10);
  });

  it('Vector 6: Dry-run mode (dryRun: true) scans and simulates without enqueuing live execution writes or mutating source records', async () => {
    const runId = 'bf_run_dry_run_v6';

    const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 3,
      dryRun: true,
      rateLimitDelayMs: 0,
    });

    expect(progress.processedCount).toBe(3);
    expect(mockDb._store.intelligence_tasks.size).toBe(0);
    const job1 = mockDb._store.jobs.get('job_001');
    expect(job1.processedAt).toBeUndefined();
  });

  it('Vector 7: Live backfill enqueues tasks via intelligenceTaskQueue using the Task-First pattern with deterministic idempotency keys', async () => {
    const runId = 'bf_run_live_task_first_v7';

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
    expect(mockDb._store.intelligence_tasks.size).toBe(2);

    const tasks = Array.from(mockDb._store.intelligence_tasks.values());
    expect(tasks.every((t: any) => t.status === 'succeeded')).toBe(true);
    expect(tasks.every((t: any) => t.idempotencyKey.includes('JOB_EXTRACTION'))).toBe(true);
  });

  it('Vector 8: Skipped idempotent items: Tasks already succeeded are recognized, counted as skippedIdempotentCount, and checkpointed without redundant execution', async () => {
    const runId = 'bf_run_idempotency_skip_v8';

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
    expect(progress.processedCount).toBe(1);
    expect(handlerSpy).toHaveBeenCalledTimes(1);
  });

  it('Vector 9: Cost cap enforcement (maxCostUsd): Backfill stops gracefully with status paused and preserves nextCursor when cost limit reached', async () => {
    const runId = 'bf_run_cost_cap_v9';

    const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 5,
      dryRun: true,
      maxCostUsd: 0.00006,
      rateLimitDelayMs: 0,
    });

    expect(progress.processedCount).toBe(2);
    expect(progress.nextCursor).toBe('job_003');
    expect(progress.isComplete).toBe(false);

    const runDoc = mockDb._store.intelligence_backfill_runs.get(runId);
    expect(runDoc.status).toBe('paused');
  });

  it('Vector 10: Rate limit throttle (rateLimitDelayMs): Engine respects delay between successive document batches / tasks', async () => {
    const runId = 'bf_run_rate_limit_v10';
    const startTime = Date.now();

    await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
      runId,
      batchSize: 3,
      dryRun: true,
      rateLimitDelayMs: 30,
    });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(60);
  });

  it('Vector 11: Completion detection: When query returns empty or < batchSize, run transitions to completed with completedAt timestamp', async () => {
    const runId = 'bf_run_completion_v11';

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

  it('Vector 12: Failure handling: Backfill run transitions to failed with lastError if an unrecoverable batch error occurs', async () => {
    const runId = 'bf_run_unrecoverable_failure_v12';

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

    const [claimedWorker1, claimedWorker2] = await Promise.all([
      queue1.claimTaskTransactional(taskId, 'worker_node_1', 30000),
      queue2.claimTaskTransactional(taskId, 'worker_node_2', 30000),
    ]);

    expect(
      (claimedWorker1 && !claimedWorker2) || (!claimedWorker1 && claimedWorker2)
    ).toBe(true);

    const taskInDb = mockDb._store.intelligence_tasks.get(taskId);
    expect(taskInDb.status).toBe('processing');
    expect(taskInDb.attempts).toBe(1);
    expect(['worker_node_1', 'worker_node_2']).toContain(taskInDb.workerId);
  });

  it('Vector 14: Task Queue: Worker lease expiration — stale lease recovery resets task to retrying or dead_letter', async () => {
    const taskId = 'task_stale_lease_recovery_v14';
    const expiredTimestamp = new Date(Date.now() - 60000).toISOString();

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

    const taskInDb = mockDb._store.intelligence_tasks.get(taskId);
    expect(taskInDb.status).toBe('retrying');
  });

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

    queue.registerHandler('job_extraction', async () => {
      const taskDoc = mockDb._store.intelligence_tasks.get(taskId);
      mockDb._store.intelligence_tasks.set(taskId, {
        ...taskDoc,
        workerId: 'worker_fast_usurper',
        leaseId: 'lease_usurped_999',
      });
      return { success: true };
    });

    const resultTask = await queue.executeTask(taskId, 'worker_slow');
    expect(resultTask.status).not.toBe('succeeded');
    const taskInDb = mockDb._store.intelligence_tasks.get(taskId);
    expect(taskInDb.workerId).toBe('worker_fast_usurper');
  });

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

    queue.registerHandler('job_extraction', async () => {
      throw new AICandidateSecurityError('Untrusted AI candidate attempted privilege escalation on propertyId');
    });

    const result = await queue.executeTask(taskId, 'worker_security');
    expect(result.status).toBe('dead_letter');
    expect(result.attempts).toBe(1);
    expect(result.error?.classification).toBe('NON_RETRYABLE');
  });

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

    const pass1 = await buyerService.generateBuyerIntelligence({ propertyId: propId }, { firestoreDb: mockDb });
    const assessmentId = pass1.provenance.assessmentId;

    const initialHistorySize = mockDb._store.buyer_intelligence_history.size;
    expect(initialHistorySize).toBe(1);

    const pass2 = await buyerService.generateBuyerIntelligence({ propertyId: propId }, { firestoreDb: mockDb });
    expect(pass2.provenance.assessmentId).toBe(assessmentId);

    expect(mockDb._store.buyer_intelligence_history.size).toBe(initialHistorySize);
    expect(mockDb._store.buyer_intelligence_history.has(assessmentId)).toBe(true);
  });

  it('Vector 19: Task Queue: Max retry exhaustion transitions task to dead_letter after reaching maxAttempts', async () => {
    const taskId = 'task_exhaustion_v19';
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

  it('Vector 20: Concurrent workers: Multiple workers operating on the queue process disjoint tasks without race conditions or state corruption', async () => {
    const queue = new IntelligenceTaskQueue(5, 60000, 'worker_pool');
    queue.setFirestoreDb(mockDb);

    const executedTasks: string[] = [];
    queue.registerHandler('job_extraction', async (task) => {
      executedTasks.push(task.taskId);
      return { done: true };
    });

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

    await queue.workerTick();

    expect(executedTasks.length).toBe(4);
    const uniqueExecuted = new Set(executedTasks);
    expect(uniqueExecuted.size).toBe(4);

    for (let i = 1; i <= 4; i++) {
      const task = mockDb._store.intelligence_tasks.get(`task_concurrent_${i}`);
      expect(task.status).toBe('succeeded');
    }
  });
});

// =========================================================================
// SECTION 2: Real Production Firebase Emulator Integration Tests
// =========================================================================
describe('Task 25 — Scale / Backfill / Resilience Production Firebase Emulator Integration Tests', () => {
  const PROJECT_ID = 'demo-anytrader';
  let testEnv: RulesTestEnvironment;
  let adminApp: admin.app.App;
  let adminDb: admin.firestore.Firestore;

  beforeAll(async () => {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

    try {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: { rules, host: '127.0.0.1', port: 8088 },
      });

      if (admin.apps.length > 0) {
        await Promise.all(admin.apps.map((app) => app?.delete()));
      }
      adminApp = admin.initializeApp({ projectId: PROJECT_ID });

      adminDb = adminApp.firestore();
      try {
        adminDb.settings({ ignoreUndefinedProperties: true });
      } catch {
        // settings already configured
      }

      setGlobalIntelligenceDb(adminDb);
      propertyPassportService.setFirestoreDb(adminDb);
      buyerIntelligenceService.setFirestoreDb(adminDb);
      intelligenceTaskQueue.setFirestoreDb(adminDb);
      registerIntelligenceTaskHandlers(adminDb);
    } catch (err: any) {
      console.error('[Task25 Test Setup] Real Firebase emulator error:', err);
      throw new Error(`[Task25 Test Setup] Failed to initialize real Firebase emulator environment: ${err?.message || err}`);
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
    if (adminApp) {
      await adminApp.delete();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed 10 test jobs in the real Firestore emulator
    for (let i = 1; i <= 10; i++) {
      const jobId = `job_emu_25_${String(i).padStart(3, '0')}`;
      await adminDb.collection('jobs').doc(jobId).set({
        id: jobId,
        title: `Job ${i} Pipe Fix`,
        description: `Fix leaking copper pipe unit ${i}`,
        category: 'Plumbing',
        postcode: 'SW1A 1AA',
        createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      });
    }
  });

  it('Production Emulator Vector 1: Real backfill against Firestore emulator executes in batches and persists durable runs & tasks', async () => {
    const runId = 'bf_run_emu_batch_1';

    const progress = await controlledBackfillEngine.executeFirestoreBackfill(adminDb, {
      runId,
      batchSize: 5,
      dryRun: false,
      rateLimitDelayMs: 0,
    });

    expect(progress.processedCount).toBe(5);
    expect(progress.totalScanned).toBe(5);
    expect(progress.nextCursor).toBe('job_emu_25_005');
    expect(progress.isComplete).toBe(false);

    // Verify durable run record in real emulator
    const runDocSnap = await adminDb.collection('intelligence_backfill_runs').doc(runId).get();
    expect(runDocSnap.exists).toBe(true);
    const runDoc = runDocSnap.data();
    expect(runDoc?.status).toBe('paused');
    expect(runDoc?.cursor).toBe('job_emu_25_005');
    expect(runDoc?.processed).toBe(5);

    // Verify scope lock in real emulator
    const scopeSnap = await adminDb.collection('intelligence_backfill_scopes').doc('jobs_job_extraction').get();
    expect(scopeSnap.exists).toBe(true);
    expect(scopeSnap.data()?.status).toBe('paused');
    expect(scopeSnap.data()?.activeRunId).toBe(runId);
  });

  it('Production Emulator Vector 2: Resuming backfill continues from saved cursor and finishes remaining items to completed state', async () => {
    const runId = 'bf_run_emu_resume_2';

    // Batch 1: first 6 items
    const run1 = await controlledBackfillEngine.executeFirestoreBackfill(adminDb, {
      runId,
      batchSize: 6,
      dryRun: false,
      rateLimitDelayMs: 0,
    });
    expect(run1.nextCursor).toBe('job_emu_25_006');
    expect(run1.processedCount).toBe(6);

    // Batch 2: next 6 items (should process remaining 4 items and complete)
    const run2 = await controlledBackfillEngine.executeFirestoreBackfill(adminDb, {
      runId,
      batchSize: 6,
      dryRun: false,
      rateLimitDelayMs: 0,
    });
    expect(run2.nextCursor).toBe('job_emu_25_010');
    expect(run2.processedCount).toBe(10);
    expect(run2.isComplete).toBe(true);

    const runDocSnap = await adminDb.collection('intelligence_backfill_runs').doc(runId).get();
    expect(runDocSnap.data()?.status).toBe('completed');
    expect(runDocSnap.data()?.completedAt).toBeDefined();

    const scopeSnap = await adminDb.collection('intelligence_backfill_scopes').doc('jobs_job_extraction').get();
    expect(scopeSnap.data()?.status).toBe('completed');
    expect(scopeSnap.data()?.activeRunId).toBeNull();
  });

  it('Production Emulator Vector 3: Security rules strictly deny unauthenticated and non-admin client writes to backfill collections', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const userDb = testEnv.authenticatedContext('user_homeowner_123').firestore();

    // Denial on intelligence_backfill_runs
    await assertFails(
      setDoc(doc(unauthDb, 'intelligence_backfill_runs', 'hacked_run'), {
        status: 'running',
      })
    );
    await assertFails(
      setDoc(doc(userDb, 'intelligence_backfill_runs', 'hacked_run'), {
        status: 'running',
      })
    );

    // Denial on intelligence_backfill_scopes
    await assertFails(
      setDoc(doc(unauthDb, 'intelligence_backfill_scopes', 'jobs_job_extraction'), {
        status: 'running',
      })
    );
    await assertFails(
      setDoc(doc(userDb, 'intelligence_backfill_scopes', 'jobs_job_extraction'), {
        status: 'running',
      })
    );
  });
});
