/**
 * AnyTrader V8.1 — Dedicated Intelligence Firestore & Storage Emulator & Invariant Test Suite
 * 
 * Tests:
 * 1. Intelligence Security Boundary (Firestore Rules):
 *    - Unauthenticated access denied across all 8 intelligence collections
 *    - Authenticated non-admin access denied across all 8 intelligence collections
 *    - Admin read/create permitted
 *    - Historical immutability: updates & deletes strictly forbidden on events, evidence, extractions, quality
 * 2. Storage Security Boundary (Storage Rules):
 *    - Ordinary client read/write to /intelligence_raw denied
 * 3. Durable Task Queue Invariants:
 *    - Deterministic doc ID prevents duplicate task creation races
 *    - Atomic claiming via runTransaction (only one concurrent worker wins)
 *    - Stale lease atomic recovery
 *    - Cross-restart discovery of runnable tasks
 *    - Persistence failure throws (no silent false success)
 * 4. Backfill Engine Invariants:
 *    - Task-first pattern
 *    - No direct fallback bypass on failed task
 *    - Durable backfill run tracking in /intelligence_backfill_runs
 * 5. Evidence Integrity & Hashing Invariants:
 *    - Actual bytes produce cryptographic SHA-256
 *    - Reference-only pointers do not fabricate hashes
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  runTransaction,
  query,
  where,
  limit,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

import {
  IntelligenceTaskQueue,
  intelligenceTaskQueue,
  taskDocumentId,
} from '../../src/server/intelligence/intelligenceTaskQueue';
import {
  evidenceRegistry,
} from '../../src/server/intelligence/evidenceRegistry';
import {
  controlledBackfillEngine,
} from '../../src/server/intelligence/backfillEngine';
import {
  immutableIntelligenceStore,
  getSummaryCollectionName,
} from '../../src/server/intelligence/immutableStore';
import {
  buildVersionId,
} from '../../src/server/intelligence/provenance';

describe('V8.1 Intelligence Firestore Emulator & Invariant Suite', () => {
  let testEnv: RulesTestEnvironment | null = null;
  const PROJECT_ID = 'demo-anytrader';

  beforeAll(async () => {
    try {
      const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
      const storageRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf-8');

      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: firestoreRules,
          host: '127.0.0.1',
          port: 8080,
        },
        storage: {
          rules: storageRules,
          host: '127.0.0.1',
          port: 9199,
        },
      });
    } catch (err) {
      console.error('FATAL ERROR: Failed to initialize Firebase Emulator test environment for V8.1 suite!', err);
      throw new Error(
        'FATAL: Firebase Emulator is not running or unreachable! V8.1 Intelligence Emulator suite requires live Firestore (127.0.0.1:8080) and Storage (127.0.0.1:9199) emulators. It must fail hard instead of silently skipping.'
      );
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (!testEnv) {
      throw new Error('FATAL: Firebase Emulator test environment not initialized for V8.1 suite.');
    }
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
    evidenceRegistry.clear();
  });

  // ==========================================================
  // 1. FIRESTORE SECURITY RULES FOR INTELLIGENCE COLLECTIONS
  // ==========================================================
  describe('1. Intelligence Collections Security Rules (Emulator)', () => {
    const intelligenceCollections = [
      'intelligence_events',
      'intelligence_evidence',
      'intelligence_extractions',
      'intelligence_tasks',
      'intelligence_jobs',
      'intelligence_properties',
      'intelligence_quality',
      'intelligence_backfill_runs',
    ];

    it('rejects unauthenticated read and write across all intelligence collections', async () => {
      const unauthDb = testEnv!.unauthenticatedContext().firestore();

      for (const colName of intelligenceCollections) {
        const docRef = doc(unauthDb, colName, 'test_doc_1');
        await assertFails(getDoc(docRef));
        await assertFails(setDoc(docRef, { data: 'unauth' }));
      }
    });

    it('rejects ordinary authenticated non-admin user read and write across all intelligence collections', async () => {
      const userDb = testEnv!.authenticatedContext('user_bob', { role: 'customer' }).firestore();

      for (const colName of intelligenceCollections) {
        const docRef = doc(userDb, colName, 'test_doc_2');
        await assertFails(getDoc(docRef));
        await assertFails(setDoc(docRef, { data: 'user_attempt' }));
      }
    });

    it('allows platform admin to create and read intelligence documents', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_alice', { role: 'admin', admin: true }).firestore();

      for (const colName of intelligenceCollections) {
        const docRef = doc(adminDb, colName, 'valid_doc_1');
        await assertSucceeds(setDoc(docRef, { testField: 'admin_data', createdAt: new Date().toISOString() }));
        await assertSucceeds(getDoc(docRef));
      }
    });

    it('enforces historical immutability: admin cannot update or delete events, evidence, extractions, quality', async () => {
      const immutableCollections = [
        'intelligence_events',
        'intelligence_evidence',
        'intelligence_extractions',
        'intelligence_quality',
      ];

      const adminDb = testEnv!.authenticatedContext('admin_alice', { role: 'admin', admin: true }).firestore();

      for (const colName of immutableCollections) {
        const docRef = doc(adminDb, colName, 'immutable_doc_1');
        // Initial create is allowed
        await assertSucceeds(setDoc(docRef, { initial: 'original_record' }));
        // Updates must be REJECTED (append-only)
        await assertFails(updateDoc(docRef, { initial: 'mutated_record' }));
        // Deletions must be REJECTED
        await assertFails(deleteDoc(docRef));
      }
    });

    it('prevents deletion of tasks, jobs, properties, and backfill runs to protect audit trails', async () => {
      const auditCollections = [
        'intelligence_tasks',
        'intelligence_jobs',
        'intelligence_properties',
        'intelligence_backfill_runs',
      ];

      const adminDb = testEnv!.authenticatedContext('admin_alice', { role: 'admin', admin: true }).firestore();

      for (const colName of auditCollections) {
        const docRef = doc(adminDb, colName, 'audit_doc_1');
        await assertSucceeds(setDoc(docRef, { status: 'pending' }));
        // Updates are allowed for status transitions
        await assertSucceeds(updateDoc(docRef, { status: 'processing' }));
        // Deletions are strictly FORBIDDEN
        await assertFails(deleteDoc(docRef));
      }
    });
  });

  // ==========================================================
  // 2. STORAGE RULES FOR INTELLIGENCE RAW ASSETS
  // ==========================================================
  describe('2. Storage Rules for Raw Intelligence (Emulator)', () => {
    it('denies unauthenticated and standard users direct write to raw intelligence paths', async () => {
      const unauthStorage = testEnv!.unauthenticatedContext().storage();
      const userStorage = testEnv!.authenticatedContext('user_carol', { role: 'customer' }).storage();

      const rawRefUnauth = unauthStorage.ref('intelligence_raw/job_123/payload.json.gz');
      const rawRefUser = userStorage.ref('intelligence_raw/job_123/payload.json.gz');

      // Unauthenticated / client reads & writes should fail
      await assertFails(Promise.resolve(rawRefUnauth.putString('test data')));
      await assertFails(Promise.resolve(rawRefUser.putString('test data')));
    });
  });

  // ==========================================================
  // 3. DURABLE TASK QUEUE & ATOMIC IDEMPOTENCY
  // ==========================================================
  describe('3. Durable Task Queue Invariants & Atomic Operations', () => {
    it('derives a deterministic document ID from the idempotency key', () => {
      const key = 'idem_job_999_analysis_v1';
      const docId1 = taskDocumentId(key);
      const docId2 = taskDocumentId(key);

      expect(docId1).toBe(docId2);
      expect(docId1).toMatch(/^idem_[a-f0-9]{32}$/);
    });

    it('creates exactly one task for concurrent duplicate submissions using Mock/Real Firestore DB', async () => {
      const mockDocs = new Map<string, any>();
      const mockDb = {
        collection(name: string) {
          return {
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                set: async (data: any) => mockDocs.set(id, data),
                update: async (data: any) => {
                  if (!mockDocs.has(id)) throw new Error('Not found');
                  mockDocs.set(id, { ...mockDocs.get(id), ...data });
                },
              };
            },
            where() {
              return {
                limit: () => ({
                  get: async () => ({
                    empty: mockDocs.size === 0,
                    docs: Array.from(mockDocs.entries()).map(([k, v]) => ({ id: k, data: () => v })),
                  }),
                }),
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any) => ref.set(data),
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(transaction);
        },
      };

      const queueA = new IntelligenceTaskQueue();
      const queueB = new IntelligenceTaskQueue();
      queueA.setFirestoreDb(mockDb as any);
      queueB.setFirestoreDb(mockDb as any);

      const idempotencyKey = 'concurrent-key-987';

      const [taskA, taskB] = await Promise.all([
        queueA.enqueueTaskAsync('job_extraction', 'job', 'job_987', idempotencyKey, { attempt: 'A' }),
        queueB.enqueueTaskAsync('job_extraction', 'job', 'job_987', idempotencyKey, { attempt: 'B' }),
      ]);

      expect(taskA.taskId).toBe(taskB.taskId);
      expect(mockDocs.size).toBe(1);
    });

    it('allows only one concurrent worker to claim a pending task (atomic claim)', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_claim_test_1';
      mockDocs.set(taskId, {
        taskId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
      });

      const mockDb = {
        collection(name: string) {
          return {
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                update: async (data: any) => {
                  mockDocs.set(id, { ...mockDocs.get(id), ...data });
                },
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(transaction);
        },
      };

      const queueA = new IntelligenceTaskQueue();
      const queueB = new IntelligenceTaskQueue();
      queueA.setFirestoreDb(mockDb as any);
      queueB.setFirestoreDb(mockDb as any);

      const [claimedA, claimedB] = await Promise.all([
        queueA.claimTaskTransactional(taskId, 'worker_A', 60000),
        queueB.claimTaskTransactional(taskId, 'worker_B', 60000),
      ]);

      // Exactly one worker must succeed in claiming the task
      const successCount = [claimedA, claimedB].filter(Boolean).length;
      expect(successCount).toBe(1);

      const savedTask = mockDocs.get(taskId);
      expect(savedTask.status).toBe('processing');
      expect(savedTask.attempts).toBe(1);
    });

    it('recovers stale leases atomically and sets status to retrying or dead_letter', async () => {
      const mockDocs = new Map<string, any>();
      const pastExpiredLease = new Date(Date.now() - 10000).toISOString();

      mockDocs.set('stale_task_1', {
        taskId: 'stale_task_1',
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        leaseExpiresAt: pastExpiredLease,
        createdAt: new Date().toISOString(),
      });

      mockDocs.set('exhausted_task_1', {
        taskId: 'exhausted_task_1',
        status: 'processing',
        attempts: 3,
        maxAttempts: 3,
        leaseExpiresAt: pastExpiredLease,
        createdAt: new Date().toISOString(),
      });

      const mockDb = {
        collection(name: string) {
          return {
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                update: async (data: any) => mockDocs.set(id, { ...mockDocs.get(id), ...data }),
              };
            },
            where(field: string, op: string, val: any) {
              return {
                get: async () => {
                  const matching = Array.from(mockDocs.values()).filter((d) => d[field] === val);
                  return {
                    empty: matching.length === 0,
                    docs: matching.map((d) => ({ id: d.taskId, data: () => d })),
                  };
                },
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(transaction);
        },
      };

      const queue = new IntelligenceTaskQueue();
      queue.setFirestoreDb(mockDb as any);

      const recovered = await queue.recoverStaleTasksAsync();

      expect(recovered.length).toBe(2);
      expect(mockDocs.get('stale_task_1').status).toBe('retrying');
      expect(mockDocs.get('stale_task_1').errorCode).toBe('STALE_LEASE_RECOVERED');
      expect(mockDocs.get('exhausted_task_1').status).toBe('dead_letter');
      expect(mockDocs.get('exhausted_task_1').errorCode).toBe('STALE_LEASE_EXHAUSTED');
    });

    it('throws when task persistence fails so false success is never reported', async () => {
      const failingDb = {
        collection() {
          return {
            doc() {
              return {
                set: async () => {
                  throw new Error('Firestore unavailable / quota exceeded');
                },
              };
            },
          };
        },
        runTransaction: async () => {
          throw new Error('Firestore unavailable / quota exceeded');
        },
      };

      const queue = new IntelligenceTaskQueue();
      queue.setFirestoreDb(failingDb as any);

      await expect(
        queue.enqueueTaskAsync('job_extraction', 'job', 'job_fail', 'idem_fail', {})
      ).rejects.toThrow(/Firestore unavailable/);
    });
  });

  // ==========================================================
  // 4. BACKFILL ENGINE INVARIANTS
  // ==========================================================
  describe('4. Controlled Backfill Invariants', () => {
    it('does not bypass task system with direct AI fallback when task execution fails', async () => {
      const mockDocs = new Map<string, any>();
      const mockDb = {
        collection(name: string) {
          return {
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                set: async (data: any) => mockDocs.set(id, data),
                update: async (data: any) => {
                  if (!mockDocs.has(id)) throw new Error('Not found');
                  mockDocs.set(id, { ...mockDocs.get(id), ...data });
                },
              };
            },
            where() {
              return {
                limit: () => ({
                  get: async () => ({
                    empty: mockDocs.size === 0,
                    docs: Array.from(mockDocs.entries()).map(([k, v]) => ({ id: k, data: () => v })),
                  }),
                }),
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any) => ref.set(data),
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(transaction);
        },
      };

      intelligenceTaskQueue.setFirestoreDb(mockDb as any);
      try {
        // Do not register handler for job_extraction -> task execution will result in dead_letter (missing handler)
        const jobs = [
          { jobId: 'job_backfill_1', title: 'Boiler Fix', description: 'Leaking boiler' },
        ];

        const progress = await controlledBackfillEngine.executeBackfill(jobs, {
          batchSize: 10,
          dryRun: false,
          maxCostUsd: 1.0,
        });

        // Failed task must be counted as error, NOT processed via bypass
        expect(progress.errorCount).toBe(1);
        expect(progress.processedCount).toBe(0);
      } finally {
        intelligenceTaskQueue.setFirestoreDb(null);
      }
    });

    it('persists durable checkpoint in /intelligence_backfill_runs for Firestore backfills', async () => {
      const mockRuns = new Map<string, any>();
      const mockJobs = new Map<string, any>();
      mockJobs.set('job_101', { title: 'Roof repair', category: 'Roofing' });

      const mockDb = {
        collection(name: string) {
          if (name === 'intelligence_backfill_runs') {
            return {
              doc(id: string) {
                return {
                  id,
                  set: async (data: any) => mockRuns.set(id, data),
                  update: async (data: any) => mockRuns.set(id, { ...mockRuns.get(id), ...data }),
                };
              },
            };
          }
          if (name === 'jobs') {
            return {
              doc(id: string) {
                return {
                  id,
                  get: async () => ({ exists: mockJobs.has(id), data: () => mockJobs.get(id) }),
                };
              },
              orderBy() {
                return {
                  limit: () => ({
                    get: async () => ({
                      empty: mockJobs.size === 0,
                      docs: Array.from(mockJobs.entries()).map(([id, d]) => ({ id, data: () => d })),
                    }),
                  }),
                };
              },
            };
          }
          return { doc: () => ({ get: async () => ({ exists: false }) }) };
        },
      };

      const runId = 'bf_test_run_1';
      const progress = await controlledBackfillEngine.executeFirestoreBackfill(mockDb, {
        batchSize: 10,
        dryRun: true,
        maxCostUsd: 1.0,
        runId,
      });

      expect(progress.runId).toBe(runId);
      expect(progress.totalScanned).toBe(1);
      expect(progress.processedCount).toBe(1);
      expect(mockRuns.has(runId)).toBe(true);
      expect(mockRuns.get(runId).status).toBe('completed');
    });

    it('propagates checkpoint write failures and fails closed without swallowing errors', async () => {
      const mockJobs = new Map<string, any>();
      mockJobs.set('job_fail_chk_1', { title: 'Emergency Leak', description: 'Major water leak', category: 'Plumbing' });

      const failingDb = {
        collection: (name: string) => {
          if (name === 'jobs') {
            return {
              orderBy: () => ({
                limit: () => ({
                  get: async () => ({
                    empty: false,
                    docs: [{ id: 'job_fail_chk_1', data: () => mockJobs.get('job_fail_chk_1') }],
                  }),
                }),
              }),
            };
          }
          return {
            doc: () => ({
              set: async () => {
                // Initialize succeeds
              },
              update: async () => {
                // Checkpoint write fails
                throw new Error('DEADLINE_EXCEEDED: Firestore checkpoint write stream timeout');
              },
              get: async () => ({ exists: false }),
            }),
          };
        },
      };

      await expect(
        controlledBackfillEngine.executeFirestoreBackfill(failingDb, {
          batchSize: 10,
          dryRun: true,
          runId: 'bf_fail_chk_run',
        })
      ).rejects.toThrow('DEADLINE_EXCEEDED: Firestore checkpoint write stream timeout');
    });
  });

  // ==========================================================
  // 5. EVIDENCE INTEGRITY & HASHING INVARIANTS
  // ==========================================================
  describe('5. Evidence Hashing & Cryptographic Invariants', () => {
    it('hashes actual evidence bytes with genuine SHA-256', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_evidence_sha', { role: 'admin', admin: true }).firestore();
      evidenceRegistry.setDb(adminDb as any);

      const content = 'Genuine inspection evidence bytes content';
      const expectedSha256 = createHash('sha256').update(content).digest('hex');

      const ev = await evidenceRegistry.register(
        'job',
        'job_sha_1',
        'user_description',
        'jobs/job_sha_1/desc',
        content,
        {},
        true
      );

      expect(ev.contentHash).toBe(expectedSha256);
      expect(ev.verified).toBe(true);
      expect(ev.integrityStatus).toBe('verified');
    });

    it('does not fabricate a content hash for reference-only evidence pointers', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_evidence_ref', { role: 'admin', admin: true }).firestore();
      evidenceRegistry.setDb(adminDb as any);

      const refEv = await evidenceRegistry.registerReferenceOnly(
        'job',
        'job_ref_1',
        'image',
        'https://storage.googleapis.com/test-bucket/image.png'
      );

      expect(refEv.contentHash).toBe('');
      expect(refEv.verified).toBe(false);
      expect(refEv.integrityStatus).toBe('reference_only');
    });
  });

  // ==========================================================
  // 6. PRODUCTION FAIL-CLOSED INVARIANTS (NO IN-MEMORY FALLBACK)
  // ==========================================================
  describe('6. Production Fail-Closed Invariants (No In-Memory Fallback)', () => {
    it('Test A: enqueueTaskAsync() rejects when Firestore is not configured', async () => {
      const queue = new IntelligenceTaskQueue();
      await expect(
        queue.enqueueTaskAsync('job_extraction', 'job', 'job_fc_1', 'idem_fc_1', {})
      ).rejects.toThrow('Firestore task store is not ready');
    });

    it('Test B: enqueueTaskAsync() propagates a Firestore write/transaction failure', async () => {
      const queue = new IntelligenceTaskQueue();
      const errorDb = {
        collection: () => ({
          doc: () => ({
            get: async () => { throw new Error('Firestore transaction failure: write rejected'); }
          })
        }),
        runTransaction: async () => {
          throw new Error('Firestore transaction failure: write rejected');
        }
      };
      queue.setFirestoreDb(errorDb as any);
      await expect(
        queue.enqueueTaskAsync('job_extraction', 'job', 'job_fc_1', 'idem_fc_1', {})
      ).rejects.toThrow('Firestore transaction failure: write rejected');
    });

    it('Test C: executeTask() rejects when Firestore is not configured', async () => {
      const queue = new IntelligenceTaskQueue();
      await expect(
        queue.executeTask('task_tc_1')
      ).rejects.toThrow('Firestore task store is not ready');
    });

    it('Test D: The removed synchronous enqueueTask() API is not available', () => {
      const queue = new IntelligenceTaskQueue();
      expect((queue as any).enqueueTask).toBeUndefined();
    });

    it('Test D2: The removed synchronous claimTask() API is not available', () => {
      const queue = new IntelligenceTaskQueue();
      expect((queue as any).claimTask).toBeUndefined();
    });

    it('Test E: getByIdempotencyKeyAsync() rejects when Firestore is unavailable, preventing backfill from silently switching to memory', async () => {
      const queue = new IntelligenceTaskQueue();
      await expect(
        queue.getByIdempotencyKeyAsync('idem_te_1')
      ).rejects.toThrow('Firestore task store is not ready');
    });

    it('Test F: A task persisted in Firestore can be discovered by a fresh queue instance whose in-memory Map starts empty', async () => {
      const mockDocs = new Map<string, any>();
      const mockDb = {
        collection: (colName: string) => ({
          doc: (docId: string) => {
            const key = `${colName}/${docId}`;
            return {
              id: docId,
              get: async () => ({
                exists: mockDocs.has(key),
                data: () => mockDocs.get(key),
              }),
              set: async (data: any) => {
                mockDocs.set(key, data);
              },
              update: async (data: any) => {
                if (!mockDocs.has(key)) throw new Error('Not found');
                mockDocs.set(key, { ...mockDocs.get(key), ...data });
              },
            };
          },
        }),
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any) => ref.set(data),
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(transaction);
        },
      };

      const queue1 = new IntelligenceTaskQueue();
      queue1.setFirestoreDb(mockDb as any);
      const task = await queue1.enqueueTaskAsync('job_extraction', 'job', 'job_tf_1', 'idem_tf_1', { hello: 'world' });

      // Fresh queue instance with completely empty in-memory Map
      const queue2 = new IntelligenceTaskQueue();
      queue2.setFirestoreDb(mockDb as any);
      expect(queue2.getTask(task.taskId)).toBeUndefined(); // in-memory Map starts empty

      const discovered = await queue2.getTaskAsync(task.taskId);
      expect(discovered).toBeDefined();
      expect(discovered?.taskId).toBe(task.taskId);
      expect(discovered?.idempotencyKey).toBe('idem_tf_1');
      expect(discovered?.payload).toEqual({ hello: 'world' });
    });

    it('TEST 2: claimTaskTransactional fails closed when Firestore is unavailable or throws', async () => {
      const queue = new IntelligenceTaskQueue();
      // 2a. Uninitialized Firestore (null)
      await expect(
        queue.claimTaskTransactional('task_fc_2', 'worker_1', 60000)
      ).rejects.toThrow('Firestore task store is not ready');

      // 2b. Firestore throws error during transaction
      const errorDb = {
        collection: () => ({
          doc: () => ({})
        }),
        runTransaction: async () => {
          throw new Error('Network error during transaction');
        }
      };
      queue.setFirestoreDb(errorDb as any);
      await expect(
        queue.claimTaskTransactional('task_fc_2', 'worker_1', 60000)
      ).rejects.toThrow('Network error during transaction');
    });

    it('TEST 3: getTaskAsync fails closed when Firestore is unavailable or throws', async () => {
      const queue = new IntelligenceTaskQueue();
      // 3a. Uninitialized Firestore (null)
      await expect(
        queue.getTaskAsync('task_fc_3')
      ).rejects.toThrow('Firestore task store is not ready');

      // 3b. Firestore throws error on read
      const errorDb = {
        collection: () => ({
          doc: () => ({
            get: async () => {
              throw new Error('Firestore connection timeout');
            }
          })
        })
      };
      queue.setFirestoreDb(errorDb as any);
      await expect(
        queue.getTaskAsync('task_fc_3')
      ).rejects.toThrow('Firestore connection timeout');
    });

    it('TEST 4: recoverStaleTasksAsync fails closed when Firestore is unavailable or throws', async () => {
      const queue = new IntelligenceTaskQueue();
      // 4a. Uninitialized Firestore (null)
      await expect(
        queue.recoverStaleTasksAsync()
      ).rejects.toThrow('Firestore task store is not ready');

      // 4b. Firestore throws on query
      const errorDb = {
        collection: () => ({
          where: () => ({
            get: async () => {
              throw new Error('Query index building / permission error');
            }
          })
        })
      };
      queue.setFirestoreDb(errorDb as any);
      await expect(
        queue.recoverStaleTasksAsync()
      ).rejects.toThrow('Query index building / permission error');
    });

    it('TEST 5: getRunnableTasksFromFirestore fails closed when Firestore is unavailable or throws', async () => {
      const queue = new IntelligenceTaskQueue();
      // 5a. Uninitialized Firestore (null)
      await expect(
        queue.getRunnableTasksFromFirestore()
      ).rejects.toThrow('Firestore task store is not ready');

      // 5b. Firestore throws PERMISSION_DENIED
      const errorDb = {
        collection: () => ({
          where: () => ({
            limit: () => ({
              get: async () => {
                throw { code: 7, message: 'PERMISSION_DENIED' };
              }
            })
          })
        })
      };
      queue.setFirestoreDb(errorDb as any);
      await expect(
        queue.getRunnableTasksFromFirestore()
      ).rejects.toThrow('PERMISSION_DENIED');
    });
  });

  describe('7. Task 2: Execute-Task Lease & Ownership Hardening', () => {
    // Helper to create mockDb with atomic transactional isolation
    const createTransactionalMockDb = () => {
      const mockDocs = new Map<string, any>();
      // Mutex for atomic transaction serialization
      let lockPromise = Promise.resolve();

      const mockDb = {
        collection(colName: string) {
          return {
            doc(id: string) {
              const fullKey = id;
              return {
                id,
                get: async () => ({
                  exists: mockDocs.has(fullKey),
                  data: () => mockDocs.get(fullKey),
                }),
                set: async (data: any) => {
                  mockDocs.set(fullKey, { ...data });
                },
                update: async (data: any) => {
                  mockDocs.set(fullKey, { ...mockDocs.get(fullKey), ...data });
                },
              };
            },
            where(field: string, op: string, val: any) {
              return {
                get: async () => {
                  const docs: any[] = [];
                  for (const [id, doc] of mockDocs.entries()) {
                    if (doc[field] === val) {
                      docs.push({ id, data: () => doc });
                    }
                  }
                  return { empty: docs.length === 0, docs };
                },
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          // Mutex chain ensuring atomic serial execution matching Firestore's lock manager
          const currentLock = lockPromise;
          let releaseLock: () => void;
          lockPromise = new Promise<void>((resolve) => {
            releaseLock = resolve;
          });

          await currentLock;
          try {
            const transaction = {
              get: async (ref: any) => ref.get(),
              update: (ref: any, data: any) => ref.update(data),
              set: (ref: any, data: any) => ref.set(data),
            };
            return await fn(transaction);
          } finally {
            releaseLock!();
          }
        },
      };

      return { mockDb, mockDocs };
    };

    it('TEST 1: Claim required - calling executeTask(taskId) claims task before handler executes', async () => {
      const { mockDb, mockDocs } = createTransactionalMockDb();
      const queue = new IntelligenceTaskQueue(3, 300000, 'worker-1');
      queue.setFirestoreDb(mockDb as any);

      const taskId = 'task_claim_required_1';
      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        payload: { title: 'Test Job' },
        createdAt: new Date().toISOString(),
      });

      let handlerSawStatus = '';
      let handlerSawWorker = '';
      let handlerSawLease: string | undefined = undefined;

      queue.registerHandler('job_extraction', async (task) => {
        handlerSawStatus = task.status;
        handlerSawWorker = task.workerId || '';
        handlerSawLease = task.leaseExpiresAt;
        return { extracted: true };
      });

      const result = await queue.executeTask(taskId);

      expect(handlerSawStatus).toBe('processing');
      expect(handlerSawWorker).toBe('worker-1');
      expect(handlerSawLease).toBeDefined();
      expect(new Date(handlerSawLease!).getTime()).toBeGreaterThan(Date.now());
      expect(result.status).toBe('succeeded');
    });

    it('TEST 2: Active lease prevents second worker - claim fails and handler is NOT called', async () => {
      const { mockDb, mockDocs } = createTransactionalMockDb();
      const queueB = new IntelligenceTaskQueue(3, 300000, 'worker-B');
      queueB.setFirestoreDb(mockDb as any);

      const taskId = 'task_active_lease_worker_A';
      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'processing',
        workerId: 'worker-A',
        leaseExpiresAt: new Date(Date.now() + 120000).toISOString(),
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
      });

      let handlerCalled = false;
      queueB.registerHandler('job_extraction', async () => {
        handlerCalled = true;
        return { shouldNotHappen: true };
      });

      await queueB.executeTask(taskId);

      expect(handlerCalled).toBe(false);
      const fsTask = mockDocs.get(taskId);
      expect(fsTask.status).toBe('processing');
      expect(fsTask.workerId).toBe('worker-A');
    });

    it('TEST 3: No force bypass - no API parameter or backdoor allows bypassing claiming or lease ownership', async () => {
      const { mockDb, mockDocs } = createTransactionalMockDb();
      const queueB = new IntelligenceTaskQueue(3, 300000, 'worker-B');
      queueB.setFirestoreDb(mockDb as any);

      const taskId = 'task_owned_by_worker_A';
      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'processing',
        workerId: 'worker-A',
        leaseExpiresAt: new Date(Date.now() + 120000).toISOString(),
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
      });

      let handlerCalled = false;
      queueB.registerHandler('job_extraction', async () => {
        handlerCalled = true;
        return { bypassed: true };
      });

      // Attempt previous unsafe signature executeTask(taskId, true)
      await (queueB as any).executeTask(taskId, true);

      // Must NOT execute handler
      expect(handlerCalled).toBe(false);
      expect(mockDocs.get(taskId).workerId).toBe('worker-A');
      expect(mockDocs.get(taskId).status).toBe('processing');
    });

    it('TEST 4: Completed task cannot execute - executeTask returns without invoking handler', async () => {
      const { mockDb, mockDocs } = createTransactionalMockDb();
      const queue = new IntelligenceTaskQueue(3, 300000, 'worker-1');
      queue.setFirestoreDb(mockDb as any);

      const taskId = 'task_completed_1';
      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'succeeded',
        completedAt: new Date().toISOString(),
        attempts: 1,
        maxAttempts: 3,
        payload: { done: true },
        createdAt: new Date().toISOString(),
      });

      let handlerCalled = false;
      queue.registerHandler('job_extraction', async () => {
        handlerCalled = true;
        return { doneAgain: true };
      });

      const res = await queue.executeTask(taskId);

      expect(handlerCalled).toBe(false);
      expect(res.status).toBe('succeeded');
    });

    it('TEST 5: Retry-not-due cannot execute - nextAttemptAt in future prevents claiming and handler execution', async () => {
      const { mockDb, mockDocs } = createTransactionalMockDb();
      const queue = new IntelligenceTaskQueue(3, 300000, 'worker-1');
      queue.setFirestoreDb(mockDb as any);

      const taskId = 'task_retry_future_1';
      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'retrying',
        nextAttemptAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes in future
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
      });

      let handlerCalled = false;
      queue.registerHandler('job_extraction', async () => {
        handlerCalled = true;
        return { retryExecutedEarly: true };
      });

      const res = await queue.executeTask(taskId);

      expect(handlerCalled).toBe(false);
      expect(res.status).toBe('retrying');
    });

    it('TEST 6: Stale lease behaviour - expired processing task executes only after legitimate reclamation', async () => {
      const { mockDb, mockDocs } = createTransactionalMockDb();
      const queue = new IntelligenceTaskQueue(3, 300000, 'worker-recovery');
      queue.setFirestoreDb(mockDb as any);

      const taskId = 'task_stale_lease_1';
      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'processing',
        workerId: 'crashed_worker',
        leaseExpiresAt: new Date(Date.now() - 30000).toISOString(), // Expired 30 seconds ago
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
      });

      let handlerCalled = false;
      let executingWorker = '';
      queue.registerHandler('job_extraction', async (task) => {
        handlerCalled = true;
        executingWorker = task.workerId || '';
        return { recovered: true };
      });

      // Execute task - since lease is expired, worker-recovery legitimately reclaims it via transaction
      const res = await queue.executeTask(taskId);

      expect(handlerCalled).toBe(true);
      expect(executingWorker).toBe('worker-recovery');
      expect(res.status).toBe('succeeded');
      expect(mockDocs.get(taskId).status).toBe('succeeded');
    });

    it('TEST 7: Concurrent claim - exactly ONE worker claims and executes handler among concurrent workers', async () => {
      const { mockDb, mockDocs } = createTransactionalMockDb();
      const queueA = new IntelligenceTaskQueue(3, 300000, 'worker-A');
      const queueB = new IntelligenceTaskQueue(3, 300000, 'worker-B');
      queueA.setFirestoreDb(mockDb as any);
      queueB.setFirestoreDb(mockDb as any);

      const taskId = 'task_concurrent_claim_race';
      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
      });

      let totalHandlerCalls = 0;
      let executedBy = '';

      queueA.registerHandler('job_extraction', async () => {
        totalHandlerCalls++;
        executedBy = 'worker-A';
        return { by: 'A' };
      });

      queueB.registerHandler('job_extraction', async () => {
        totalHandlerCalls++;
        executedBy = 'worker-B';
        return { by: 'B' };
      });

      // Both workers attempt to execute the exact same pending task simultaneously
      const [resA, resB] = await Promise.all([
        queueA.executeTask(taskId),
        queueB.executeTask(taskId),
      ]);

      // Exactly ONE handler execution
      expect(totalHandlerCalls).toBe(1);
      expect(['worker-A', 'worker-B']).toContain(executedBy);

      // The winner transitioned the task to succeeded
      const finalDoc = mockDocs.get(taskId);
      expect(finalDoc.status).toBe('succeeded');
      expect(finalDoc.attempts).toBe(1);

      // The other worker did not run handler and saw either processing or succeeded
      const otherRes = executedBy === 'worker-A' ? resB : resA;
      expect(['processing', 'succeeded']).toContain(otherRes.status);
    });
  });

  // ==========================================================
  // 8. REAL FIRESTORE EMULATOR CONCURRENCY & ATOMIC CLAIMING (CI WIRED)
  // ==========================================================
  describe('8. Real Firestore Emulator Concurrency & Atomic Claiming (CI Wired)', () => {
    function createRealFirestoreTaskDb(modularDb: any) {
      return {
        collection(name: string) {
          const colRef = collection(modularDb, name);
          return {
            doc(id: string) {
              const docRef = doc(modularDb, name, id);
              return {
                id,
                get: async () => {
                  const snap = await getDoc(docRef);
                  return {
                    id: snap.id,
                    exists: snap.exists(),
                    data: () => snap.data(),
                  };
                },
                set: async (data: any) => setDoc(docRef, data),
                update: async (data: any) => updateDoc(docRef, data),
              };
            },
            where(field: string, op: any, val: any) {
              return {
                limit(count: number) {
                  return {
                    get: async () => {
                      const q = query(colRef, where(field, op, val), limit(count));
                      const snap = await getDocs(q);
                      return {
                        empty: snap.empty,
                        docs: snap.docs.map((d) => ({
                          id: d.id,
                          data: () => d.data(),
                        })),
                      };
                    },
                  };
                },
                get: async () => {
                  const q = query(colRef, where(field, op, val));
                  const snap = await getDocs(q);
                  return {
                    empty: snap.empty,
                    docs: snap.docs.map((d) => ({
                      id: d.id,
                      data: () => d.data(),
                    })),
                  };
                },
              };
            },
          };
        },
        runTransaction: async <T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> => {
          return runTransaction(modularDb, async (tx) => {
            const txWrapper = {
              get: async (refObj: any) => {
                const docRef = doc(modularDb, 'intelligence_tasks', refObj.id);
                const snap = await tx.get(docRef);
                return {
                  id: snap.id,
                  exists: snap.exists(),
                  data: () => snap.data(),
                };
              },
              set: (refObj: any, data: any) => {
                const docRef = doc(modularDb, 'intelligence_tasks', refObj.id);
                tx.set(docRef, data);
              },
              update: (refObj: any, data: any) => {
                const docRef = doc(modularDb, 'intelligence_tasks', refObj.id);
                tx.update(docRef, data);
              },
            };
            return await updateFunction(txWrapper);
          });
        },
      };
    }

    it('proves real Firestore emulator atomic claiming under high concurrency (3 concurrent workers, 1 winner)', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_worker', { role: 'admin', admin: true }).firestore();
      const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

      const taskId = `task_emu_race_${Date.now()}`;
      const nowIso = new Date().toISOString();

      // Seed initial pending task in real Firestore emulator
      await setDoc(doc(adminDb, 'intelligence_tasks', taskId), {
        taskId,
        taskType: 'job_extraction',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const queueA = new IntelligenceTaskQueue(3, 300000, 'emu-worker-A');
      const queueB = new IntelligenceTaskQueue(3, 300000, 'emu-worker-B');
      const queueC = new IntelligenceTaskQueue(3, 300000, 'emu-worker-C');

      queueA.setFirestoreDb(firestoreTaskDb as any);
      queueB.setFirestoreDb(firestoreTaskDb as any);
      queueC.setFirestoreDb(firestoreTaskDb as any);

      // Concurrently race 3 workers via real Firestore transactions on the emulator
      const results = await Promise.all([
        queueA.claimTaskTransactional(taskId, 'emu-worker-A', 60000),
        queueB.claimTaskTransactional(taskId, 'emu-worker-B', 60000),
        queueC.claimTaskTransactional(taskId, 'emu-worker-C', 60000),
      ]);

      // Exactly ONE worker must have claimed the task
      const successCount = results.filter(Boolean).length;
      expect(successCount).toBe(1);

      // Read state back from real Firestore emulator
      const taskSnap = await getDoc(doc(adminDb, 'intelligence_tasks', taskId));
      expect(taskSnap.exists()).toBe(true);
      const data = taskSnap.data()!;
      expect(data.status).toBe('processing');
      expect(data.attempts).toBe(1);
      expect(['emu-worker-A', 'emu-worker-B', 'emu-worker-C']).toContain(data.workerId);
    });

    it('proves real Firestore emulator atomic executeTask() prevents duplicate handler execution under race', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_worker_exec', { role: 'admin', admin: true }).firestore();
      const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

      const taskId = `task_emu_exec_${Date.now()}`;
      const nowIso = new Date().toISOString();

      // Seed initial pending task in real Firestore emulator
      await setDoc(doc(adminDb, 'intelligence_tasks', taskId), {
        taskId,
        taskType: 'job_extraction',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const queueA = new IntelligenceTaskQueue(3, 300000, 'emu-worker-A');
      const queueB = new IntelligenceTaskQueue(3, 300000, 'emu-worker-B');

      queueA.setFirestoreDb(firestoreTaskDb as any);
      queueB.setFirestoreDb(firestoreTaskDb as any);

      let handlerCalls = 0;
      let winningWorker = '';

      queueA.registerHandler('job_extraction', async (task) => {
        handlerCalls++;
        winningWorker = task.workerId || 'emu-worker-A';
        return { extracted: true, worker: 'A' };
      });

      queueB.registerHandler('job_extraction', async (task) => {
        handlerCalls++;
        winningWorker = task.workerId || 'emu-worker-B';
        return { extracted: true, worker: 'B' };
      });

      // Concurrently execute task on both workers against real Firestore emulator
      const [resA, resB] = await Promise.all([
        queueA.executeTask(taskId),
        queueB.executeTask(taskId),
      ]);

      // Exactly ONE handler execution occurred
      expect(handlerCalls).toBe(1);
      expect(['emu-worker-A', 'emu-worker-B']).toContain(winningWorker);

      // Verify that real Firestore emulator recorded the succeeded state
      const taskSnap = await getDoc(doc(adminDb, 'intelligence_tasks', taskId));
      expect(taskSnap.exists()).toBe(true);
      const data = taskSnap.data()!;
      expect(data.status).toBe('succeeded');
      expect(data.attempts).toBe(1);
    });
  });

  // ==========================================================
  // 9. TASK 7A IMMUTABLE INTELLIGENCE PERSISTENCE & CONCURRENCY
  // ==========================================================
  describe('9. Task 7A Immutable Intelligence Persistence & Concurrency Invariants (Emulator)', () => {
    function createRealFirestoreStoreDb(modularDb: any) {
      return {
        collection(name: string) {
          const colRef = collection(modularDb, name);
          return {
            doc(id: string) {
              const docRef = doc(modularDb, name, id);
              return {
                colName: name,
                id,
                get: async () => {
                  const snap = await getDoc(docRef);
                  return {
                    id: snap.id,
                    exists: snap.exists(),
                    data: () => snap.data(),
                  };
                },
                set: async (data: any, options?: { merge?: boolean }) => {
                  if (options?.merge) {
                    await setDoc(docRef, data, { merge: true });
                  } else {
                    await setDoc(docRef, data);
                  }
                },
                update: async (data: any) => updateDoc(docRef, data),
              };
            },
            where(field: string, op: any, val: any) {
              return {
                get: async () => {
                  const q = query(colRef, where(field, op, val));
                  const snap = await getDocs(q);
                  return {
                    empty: snap.empty,
                    docs: snap.docs.map((d) => ({
                      id: d.id,
                      data: () => d.data(),
                    })),
                  };
                },
              };
            },
          };
        },
        runTransaction: async <T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> => {
          return runTransaction(modularDb, async (tx) => {
            const txWrapper = {
              get: async (refObj: any) => {
                const docRef = doc(modularDb, refObj.colName, refObj.id);
                const snap = await tx.get(docRef);
                return {
                  id: snap.id,
                  exists: snap.exists(),
                  data: () => snap.data(),
                };
              },
              set: (refObj: any, data: any, options?: { merge?: boolean }) => {
                const docRef = doc(modularDb, refObj.colName, refObj.id);
                if (options?.merge) {
                  tx.set(docRef, data, { merge: true });
                } else {
                  tx.set(docRef, data);
                }
              },
              update: (refObj: any, data: any) => {
                const docRef = doc(modularDb, refObj.colName, refObj.id);
                tx.update(docRef, data);
              },
            };
            return await updateFunction(txWrapper);
          });
        },
      };
    }

    async function seedEvidence(db: any, evidenceId: string, aggregateType: string, aggregateId: string, sourceVersion: number = 1) {
      await setDoc(doc(db, 'intelligence_evidence', evidenceId), {
        evidenceId,
        aggregateType,
        aggregateId,
        sourceType: aggregateType,
        sourceId: aggregateId,
        sourceVersion,
        evidenceType: 'document',
        evidenceCategory: 'DOCUMENT',
        sourceRef: `tests/${evidenceId}`,
        contentHash: 'a'.repeat(64),
        contentSize: 100,
        byteSize: 100,
        schemaVersion: 'v8.1.0',
        integrityStatus: 'verified',
        verified: true,
        metadata: {},
      });
    }

    it('proves atomic creation of identical historical extractions under high concurrency (3 concurrent workers, 1 created, 2 idempotent successes)', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_worker_store', { role: 'admin', admin: true }).firestore();
      await seedEvidence(adminDb, 'ev_con_1', 'job', 'job_concurrent_100', 1);
      const storeDb = createRealFirestoreStoreDb(adminDb);
      const versionId = buildVersionId('job', 'job_concurrent_100', 1, 'v8.1', 'gemini-3.7-flash', 'job_extraction_v8.1', '1.0.0');

      const confidence = { overall: 0.95, extraction: 0.95, evidenceQuality: 0.95, classification: 0.95, temporalFreshness: 0.95, method: 'deterministic_heuristic' as const };
      const provenance = { source: 'user', evidenceIds: ['ev_con_1'], pipelineVersion: 'v8.1', modelVersion: 'gemini-3.7-flash', promptVersion: 'v1', generatedAt: new Date().toISOString(), sourceContentHash: 'hash_con_1' };

      const extractionPayload = {
        extractionId: `ext_job_concurrent_100_1`,
        versionId,
        aggregateType: 'job' as const,
        aggregateId: 'job_concurrent_100',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_extraction_v8.1',
        sourceVersion: 1,
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: 'hcon', encoding: 'gzip' as const, originalBytes: 15, compressedBytes: 15, compressionRatio: 1.0, schemaVersion: '1.0.0', storagePath: 'path_con', createdAt: new Date().toISOString() },
        structuredCandidate: { category: 'Plumbing', problem: 'Burst Pipe Concurrent' },
        evidenceIds: ['ev_con_1'],
        confidence,
        provenance,
      };

      const eventPayload = {
        eventId: `ie_ev_con_1`,
        aggregateType: 'job' as const,
        aggregateId: 'job_concurrent_100',
        eventType: 'JOB_ANALYSIS_COMPLETED' as const,
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_extraction_v8.1',
        createdAt: new Date().toISOString(),
        source: 'jobs/job_concurrent_100',
        evidenceIds: ['ev_con_1'],
        confidence,
        provenance,
        status: 'valid' as const,
        payload: { category: 'Plumbing' },
      };

      const summaryPayload = {
        jobId: 'job_concurrent_100',
        currentVersionId: versionId,
        category: 'Plumbing',
        buildingComponent: 'Pipe',
        observedProblem: 'Burst Pipe Concurrent',
        extractedScope: ['Fix pipe'],
        recommendedIntervention: 'Replace pipe',
        evidenceIds: ['ev_con_1'],
        confidence,
        provenance,
        pipelineVersion: 'v8.1',
        updatedAt: new Date().toISOString(),
      };

      // Launch 3 concurrent persistence calls against real Firestore emulator
      const results = await Promise.all([
        immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_concurrent_100',
          versionId,
          extraction: extractionPayload,
          event: eventPayload,
          summaryProjection: summaryPayload,
        }),
        immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_concurrent_100',
          versionId,
          extraction: extractionPayload,
          event: eventPayload,
          summaryProjection: summaryPayload,
        }),
        immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_concurrent_100',
          versionId,
          extraction: extractionPayload,
          event: eventPayload,
          summaryProjection: summaryPayload,
        }),
      ]);

      expect(results.length).toBe(3);
      const newCount = results.filter((r) => r.isNew).length;
      const idempotentCount = results.filter((r) => !r.isNew).length;

      expect(newCount).toBe(1);
      expect(idempotentCount).toBe(2);

      // Verify Firestore emulator document exists
      const docSnap = await getDoc(doc(adminDb, 'intelligence_extractions', versionId));
      expect(docSnap.exists()).toBe(true);
      expect(docSnap.data()?.versionId).toBe(versionId);
    });

    it('proves atomic transaction rejects race condition attempt to overwrite historical extraction with different content with [Intelligence Immutability Error]', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_worker_store2', { role: 'admin', admin: true }).firestore();
      const storeDb = createRealFirestoreStoreDb(adminDb);
      const versionId = buildVersionId('job', 'job_immutability_200', 1, 'v8.1', 'gemini-3.7-flash', 'job_extraction_v8.1', '1.0.0');

      const confidence = { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: 'deterministic_heuristic' as const };
      const provenance = { source: 'user', evidenceIds: ['ev_200'], pipelineVersion: 'v8.1', modelVersion: 'gemini-3.7-flash', promptVersion: 'v1', generatedAt: new Date().toISOString(), sourceContentHash: 'hash_200' };

      const originalExtraction = {
        extractionId: `ext_job_immutability_200_1`,
        versionId,
        aggregateType: 'job' as const,
        aggregateId: 'job_immutability_200',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_extraction_v8.1',
        sourceVersion: 1,
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: 'h200', encoding: 'gzip' as const, originalBytes: 10, compressedBytes: 10, compressionRatio: 1.0, schemaVersion: '1.0.0', storagePath: 'path_200', createdAt: new Date().toISOString() },
        structuredCandidate: { category: 'Roofing', problem: 'Original Roof Leak' },
        evidenceIds: ['ev_200'],
        confidence,
        provenance,
      };

      const eventPayload = {
        eventId: `ie_ev_200`,
        aggregateType: 'job' as const,
        aggregateId: 'job_immutability_200',
        eventType: 'JOB_ANALYSIS_COMPLETED' as const,
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_extraction_v8.1',
        createdAt: new Date().toISOString(),
        source: 'jobs/job_immutability_200',
        evidenceIds: ['ev_200'],
        confidence,
        provenance,
        status: 'valid' as const,
        payload: { category: 'Roofing' },
      };

      const summaryPayload = {
        jobId: 'job_immutability_200',
        currentVersionId: versionId,
        category: 'Roofing',
        buildingComponent: 'Roof',
        observedProblem: 'Original Roof Leak',
        extractedScope: ['Fix roof'],
        recommendedIntervention: 'Tile replacement',
        evidenceIds: ['ev_200'],
        confidence,
        provenance,
        pipelineVersion: 'v8.1',
        updatedAt: new Date().toISOString(),
      };

      // 1. Initial write creates historical extraction
      await seedEvidence(adminDb, 'ev_200', 'job', 'job_immutability_200', 1);
      const res1 = await immutableIntelligenceStore.persistOutput({
        db: storeDb,
        aggregateType: 'job',
        aggregateId: 'job_immutability_200',
        versionId,
        extraction: originalExtraction,
        event: eventPayload,
        summaryProjection: summaryPayload,
      });
      expect(res1.isNew).toBe(true);

      // 2. Race attempt to write different content under same versionId must be rejected
      const tamperedExtraction = {
        ...originalExtraction,
        structuredCandidate: { category: 'Roofing', problem: 'TAMPERED ROOF LEAK' },
      };

      await expect(
        immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_immutability_200',
          versionId,
          extraction: tamperedExtraction,
          event: eventPayload,
          summaryProjection: summaryPayload,
        })
      ).rejects.toThrow(/\[Intelligence Immutability Error\] Cannot mutate historical intelligence version/);

      // Verify original content in Firestore was NOT mutated
      const docSnap = await getDoc(doc(adminDb, 'intelligence_extractions', versionId));
      expect(docSnap.data()?.structuredCandidate?.problem).toBe('Original Roof Leak');
    });

    it('proves atomic creation updates active pointer for generalized aggregates (e.g. contractor)', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_worker_store3', { role: 'admin', admin: true }).firestore();
      const storeDb = createRealFirestoreStoreDb(adminDb);
      const versionId = buildVersionId('contractor' as any, 'contractor_300', 1, 'v8.1', 'gemini-3.7-flash', 'contractor_extraction_v8.1', '1.0.0');

      expect(getSummaryCollectionName('contractor' as any)).toBe('intelligence_contractors');

      const confidence = { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: 'deterministic_heuristic' as const };
      const provenance = { source: 'user', evidenceIds: ['ev_300'], pipelineVersion: 'v8.1', modelVersion: 'gemini-3.7-flash', promptVersion: 'v1', generatedAt: new Date().toISOString(), sourceContentHash: 'hash_300' };

      const extractionPayload = {
        extractionId: `ext_contractor_300_1`,
        versionId,
        aggregateType: 'contractor' as any,
        aggregateId: 'contractor_300',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'contractor_extraction_v8.1',
        sourceVersion: 1,
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: 'h300', encoding: 'gzip' as const, originalBytes: 10, compressedBytes: 10, compressionRatio: 1.0, schemaVersion: '1.0.0', storagePath: 'path_300', createdAt: new Date().toISOString() },
        structuredCandidate: { trade: 'Electrical', rating: 4.9 },
        evidenceIds: ['ev_300'],
        confidence,
        provenance,
      };

      const eventPayload = {
        eventId: `ie_ev_300`,
        aggregateType: 'contractor' as any,
        aggregateId: 'contractor_300',
        eventType: 'JOB_ANALYSIS_COMPLETED' as const,
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'contractor_extraction_v8.1',
        createdAt: new Date().toISOString(),
        source: 'contractors/contractor_300',
        evidenceIds: ['ev_300'],
        confidence,
        provenance,
        status: 'valid' as const,
        payload: { trade: 'Electrical' },
      };

      const summaryPayload = {
        contractorId: 'contractor_300',
        currentVersionId: versionId,
        trade: 'Electrical',
        rating: 4.9,
      };

      await seedEvidence(adminDb, 'ev_300', 'contractor', 'contractor_300', 1);
      const result = await immutableIntelligenceStore.persistOutput({
        db: storeDb,
        aggregateType: 'contractor' as any,
        aggregateId: 'contractor_300',
        versionId,
        extraction: extractionPayload,
        event: eventPayload,
        summaryProjection: summaryPayload,
      });

      expect(result.isNew).toBe(true);

      // Read intelligence_contractors/contractor_300 from Firestore emulator
      const summarySnap = await getDoc(doc(adminDb, 'intelligence_contractors', 'contractor_300'));
      expect(summarySnap.exists()).toBe(true);
      expect(summarySnap.data()?.currentVersionId).toBe(versionId);
      expect(summarySnap.data()?.trade).toBe('Electrical');
    });

    it('proves production store fails closed when Firestore database is unavailable / null without falling back to in-memory Map', async () => {
      const versionId = 'fail_closed_ver_400';

      const extractionPayload: any = {
        extractionId: 'ext_400',
        versionId,
        aggregateType: 'job',
        aggregateId: 'job_400',
      };
      const eventPayload: any = { eventId: 'ev_400' };
      const summaryPayload: any = { jobId: 'job_400' };

      // Attempting to persist without a DB fails closed
      await expect(
        immutableIntelligenceStore.persistOutput({
          db: null,
          aggregateType: 'job',
          aggregateId: 'job_400',
          versionId,
          extraction: extractionPayload,
          event: eventPayload,
          summaryProjection: summaryPayload,
        })
      ).rejects.toThrow(/\[ImmutableStore\] Firestore database is not configured or ready. Operational failure \(Fail Closed\)\./);

      // Attempting to read without a DB fails closed
      await expect(
        immutableIntelligenceStore.getVersionById(null, versionId)
      ).rejects.toThrow(/\[ImmutableStore\] Firestore database is not configured or ready. Operational failure \(Fail Closed\)\./);

      await expect(
        immutableIntelligenceStore.getVersionsForAggregate(null, 'job', 'job_400')
      ).rejects.toThrow(/\[ImmutableStore\] Firestore database is not configured or ready. Operational failure \(Fail Closed\)\./);

      await expect(
        immutableIntelligenceStore.getCurrentPointer(null, 'job', 'job_400')
      ).rejects.toThrow(/\[ImmutableStore\] Firestore database is not configured or ready. Operational failure \(Fail Closed\)\./);
    });

    it('proves non-transaction DB fails closed when runTransaction is missing and writes zero documents', async () => {
      const writtenDocs = new Map<string, any>();
      const nonTxDb = {
        collection: (name: string) => ({
          doc: (id: string) => ({
            get: async () => ({ exists: writtenDocs.has(`${name}/${id}`), data: () => writtenDocs.get(`${name}/${id}`) }),
            set: async (data: any) => { writtenDocs.set(`${name}/${id}`, data); },
          }),
        }),
      };

      const confidence = { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: 'deterministic_heuristic' as const };
      const provenance = { source: 'user', evidenceIds: ['ev_notx'], pipelineVersion: 'v8.1', modelVersion: 'gemini-3.7-flash', promptVersion: 'v1', generatedAt: new Date().toISOString(), sourceContentHash: 'hash_notx' };
      const versionId = 'ver_no_tx_500';

      const extractionPayload: any = {
        extractionId: 'ext_no_tx_500',
        versionId,
        aggregateType: 'job',
        aggregateId: 'job_no_tx_500',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_extraction_v8.1',
        sourceVersion: 1,
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: 'h500', encoding: 'gzip' as const, originalBytes: 10, compressedBytes: 10, compressionRatio: 1.0, schemaVersion: '1.0.0', storagePath: 'path_500', createdAt: new Date().toISOString() },
        structuredCandidate: { category: 'Plumbing', problem: 'No Tx Pipe' },
        evidenceIds: ['ev_notx'],
        confidence,
        provenance,
      };

      const eventPayload: any = {
        eventId: 'ie_ev_notx',
        aggregateType: 'job',
        aggregateId: 'job_no_tx_500',
        eventType: 'JOB_ANALYSIS_COMPLETED',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_extraction_v8.1',
        createdAt: new Date().toISOString(),
        source: 'jobs/job_no_tx_500',
        evidenceIds: ['ev_notx'],
        confidence,
        provenance,
        status: 'valid',
        payload: { category: 'Plumbing' },
      };

      const summaryPayload: any = { jobId: 'job_no_tx_500' };

      await expect(
        immutableIntelligenceStore.persistOutput({
          db: nonTxDb as any,
          aggregateType: 'job',
          aggregateId: 'job_no_tx_500',
          versionId,
          extraction: extractionPayload,
          event: eventPayload,
          summaryProjection: summaryPayload,
        })
      ).rejects.toThrow(/\[ImmutableStore\] Firestore transaction capability \(runTransaction\) is required/);

      expect(writtenDocs.size).toBe(0);
    });
  });
});
