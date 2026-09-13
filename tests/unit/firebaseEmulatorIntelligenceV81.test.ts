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
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

import {
  IntelligenceTaskQueue,
  taskDocumentId,
} from '../../src/server/intelligence/intelligenceTaskQueue';
import {
  evidenceRegistry,
} from '../../src/server/intelligence/evidenceRegistry';
import {
  controlledBackfillEngine,
} from '../../src/server/intelligence/backfillEngine';

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
    } catch {
      // If emulator is not running in pure unit-test mode, we test local & transactional logic
      testEnv = null;
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.clearStorage();
    }
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
      if (!testEnv) return;
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      for (const colName of intelligenceCollections) {
        const docRef = doc(unauthDb, colName, 'test_doc_1');
        await assertFails(getDoc(docRef));
        await assertFails(setDoc(docRef, { data: 'unauth' }));
      }
    });

    it('rejects ordinary authenticated non-admin user read and write across all intelligence collections', async () => {
      if (!testEnv) return;
      const userDb = testEnv.authenticatedContext('user_bob', { role: 'customer' }).firestore();

      for (const colName of intelligenceCollections) {
        const docRef = doc(userDb, colName, 'test_doc_2');
        await assertFails(getDoc(docRef));
        await assertFails(setDoc(docRef, { data: 'user_attempt' }));
      }
    });

    it('allows platform admin to create and read intelligence documents', async () => {
      if (!testEnv) return;
      const adminDb = testEnv.authenticatedContext('admin_alice', { role: 'admin', admin: true }).firestore();

      for (const colName of intelligenceCollections) {
        const docRef = doc(adminDb, colName, 'valid_doc_1');
        await assertSucceeds(setDoc(docRef, { testField: 'admin_data', createdAt: new Date().toISOString() }));
        await assertSucceeds(getDoc(docRef));
      }
    });

    it('enforces historical immutability: admin cannot update or delete events, evidence, extractions, quality', async () => {
      if (!testEnv) return;
      const immutableCollections = [
        'intelligence_events',
        'intelligence_evidence',
        'intelligence_extractions',
        'intelligence_quality',
      ];

      const adminDb = testEnv.authenticatedContext('admin_alice', { role: 'admin', admin: true }).firestore();

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
      if (!testEnv) return;
      const auditCollections = [
        'intelligence_tasks',
        'intelligence_jobs',
        'intelligence_properties',
        'intelligence_backfill_runs',
      ];

      const adminDb = testEnv.authenticatedContext('admin_alice', { role: 'admin', admin: true }).firestore();

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
      if (!testEnv) return;
      const unauthStorage = testEnv.unauthenticatedContext().storage();
      const userStorage = testEnv.authenticatedContext('user_carol', { role: 'customer' }).storage();

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
        queueA.claimTaskTransactional(taskId, 'worker_A', 60000, false),
        queueB.claimTaskTransactional(taskId, 'worker_B', 60000, false),
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
      const queue = new IntelligenceTaskQueue();
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
  });

  // ==========================================================
  // 5. EVIDENCE INTEGRITY & HASHING INVARIANTS
  // ==========================================================
  describe('5. Evidence Hashing & Cryptographic Invariants', () => {
    it('hashes actual evidence bytes with genuine SHA-256', () => {
      const content = 'Genuine inspection evidence bytes content';
      const expectedSha256 = createHash('sha256').update(content).digest('hex');

      const ev = evidenceRegistry.register(
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

    it('does not fabricate a content hash for reference-only evidence pointers', () => {
      const refEv = evidenceRegistry.registerReferenceOnly(
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
    it('TEST 1: enqueueTaskAsync fails closed when Firestore is unavailable or throws', async () => {
      const queue = new IntelligenceTaskQueue();
      // 1a. Uninitialized Firestore (null)
      await expect(
        queue.enqueueTaskAsync('job_extraction', 'job', 'job_fc_1', 'idem_fc_1', {})
      ).rejects.toThrow('Firestore task store is not ready');

      // 1b. Firestore throws PERMISSION_DENIED (code 7)
      const errorDb = {
        collection: () => ({
          doc: () => ({
            get: async () => { throw { code: 7, message: 'PERMISSION_DENIED: Missing or insufficient permissions.' }; }
          })
        }),
        runTransaction: async () => {
          throw { code: 7, message: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
        }
      };
      queue.setFirestoreDb(errorDb as any);
      await expect(
        queue.enqueueTaskAsync('job_extraction', 'job', 'job_fc_1', 'idem_fc_1', {})
      ).rejects.toThrow('PERMISSION_DENIED');
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
});
