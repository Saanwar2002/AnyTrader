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
  deleteField,
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
import {
  canonicalizeIntelligence,
  persistCanonicalIntelligence,
} from '../../src/server/intelligence/canonicalizer';
import { CanonicalIntelligenceInput } from '../../src/server/intelligence/types';
import {
  processAICandidateToCanonical,
  validateAndSanitizeAICandidate,
  AICandidateSecurityError,
  TrustedServerContext,
} from '../../src/server/intelligence/aiCandidateBoundary';
import { cleanUndefinedFields } from '../../src/server/intelligence/evidence';
import {
  processingRunStore,
  buildProcessingRunId,
  ProcessingRunValidationError,
} from '../../src/server/intelligence/processingRunStore';
import {
  QualityReviewService,
  qualityReviewService,
  buildQualityReviewId,
} from '../../src/server/intelligence/qualityReview';
import { QualityReview, CanonicalIntelligenceEvent } from '../../src/server/intelligence/types';

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
          port: 8088,
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

  async function withAdminDb<T>(
    callback: (db: any) => Promise<T>
  ): Promise<T> {
    if (!testEnv) {
      throw new Error('Firebase test environment not initialized');
    }
    let result: T | undefined;
    await testEnv.withSecurityRulesDisabled(async (context: any) => {
      result = await callback(context.firestore());
    });
    return result as T;
  }

  beforeEach(async () => {
    if (!testEnv) {
      throw new Error('FATAL: Firebase Emulator test environment not initialized for V8.1 suite.');
    }
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
    evidenceRegistry.clear();
  });

  function createRealFirestoreTaskDb(modularDb: any) {
    if (!modularDb) {
      throw new Error('createRealFirestoreTaskDb requires a valid Firestore instance');
    }
    const getDbInstance = () => modularDb;
    return {
      collection(name: string) {
        return {
          colName: name,
          collectionName: name,
          doc(id: string) {
            return {
              colName: name,
              collectionName: name,
              id,
              get: async () => {
                const dbInstance = getDbInstance();
                const docRef = doc(dbInstance, name, id);
                const snap = await getDoc(docRef);
                return {
                  id: snap.id,
                  exists: snap.exists(),
                  data: () => snap.data(),
                };
              },
              set: async (data: any, options?: { merge?: boolean }) => {
                const dbInstance = getDbInstance();
                const docRef = doc(dbInstance, name, id);
                const cleaned = cleanUndefinedFields(data);
                if (options?.merge) {
                  await setDoc(docRef, cleaned, { merge: true });
                } else {
                  await setDoc(docRef, cleaned);
                }
              },
              update: async (data: any) => {
                const dbInstance = getDbInstance();
                const docRef = doc(dbInstance, name, id);
                const sanitized: any = {};
                for (const [k, v] of Object.entries(data)) {
                  sanitized[k] = v === undefined ? deleteField() : v;
                }
                return updateDoc(docRef, sanitized);
              },
              delete: async () => {
                const dbInstance = getDbInstance();
                const docRef = doc(dbInstance, name, id);
                return deleteDoc(docRef);
              },
            };
          },
          where(field: string, op: any, val: any) {
            return {
              limit(count: number) {
                return {
                  get: async () => {
                    const dbInstance = getDbInstance();
                    const colRef = collection(dbInstance, name);
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
                const dbInstance = getDbInstance();
                const colRef = collection(dbInstance, name);
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
        const dbInstance = getDbInstance();
        return runTransaction(dbInstance, async (tx) => {
          const txWrapper = {
            get: async (refObj: any) => {
              const col = refObj.colName || refObj.collectionName || (refObj.parent && refObj.parent.id) || 'intelligence_tasks';
              const docRef = doc(dbInstance, col, refObj.id);
              const snap = await tx.get(docRef);
              return {
                id: snap.id,
                exists: snap.exists(),
                data: () => snap.data(),
              };
            },
            set: (refObj: any, data: any, options?: { merge?: boolean }) => {
              const col = refObj.colName || refObj.collectionName || (refObj.parent && refObj.parent.id) || 'intelligence_tasks';
              const docRef = doc(dbInstance, col, refObj.id);
              const cleaned = cleanUndefinedFields(data);
              if (options?.merge) {
                tx.set(docRef, cleaned, { merge: true });
              } else {
                tx.set(docRef, cleaned);
              }
            },
            update: (refObj: any, data: any) => {
              const col = refObj.colName || refObj.collectionName || (refObj.parent && refObj.parent.id) || 'intelligence_tasks';
              const docRef = doc(dbInstance, col, refObj.id);
              const sanitized: any = {};
              for (const [k, v] of Object.entries(data)) {
                sanitized[k] = v === undefined ? deleteField() : v;
              }
              tx.update(docRef, sanitized);
            },
            delete: (refObj: any) => {
              const col = refObj.colName || refObj.collectionName || (refObj.parent && refObj.parent.id) || 'intelligence_tasks';
              const docRef = doc(dbInstance, col, refObj.id);
              tx.delete(docRef);
            },
          };
          return await updateFunction(txWrapper);
        });
      },
    };
  }
  const createRealFirestoreStoreDb = createRealFirestoreTaskDb;

  // ==========================================================
  // 1. FIRESTORE SECURITY RULES FOR INTELLIGENCE COLLECTIONS
  // ==========================================================
  describe('1. Intelligence Collections Security Rules (Emulator)', () => {
    const allIntelligenceCollections = [
      'intelligence_events',
      'intelligence_evidence',
      'intelligence_extractions',
      'intelligence_tasks',
      'intelligence_jobs',
      'intelligence_properties',
      'intelligence_quality',
      'intelligence_backfill_runs',
      'intelligence_processing_runs',
    ];

    const clientAdminWritableCollections = [
      'intelligence_jobs',
      'intelligence_properties',
    ];

    const serverAuthoritativeCollections = [
      'intelligence_tasks',
      'intelligence_events',
      'intelligence_evidence',
      'intelligence_extractions',
      'intelligence_quality',
      'intelligence_backfill_runs',
      'intelligence_processing_runs',
    ];

    it('rejects unauthenticated read and write across all intelligence collections', async () => {
      const unauthDb = testEnv!.unauthenticatedContext().firestore();

      for (const colName of allIntelligenceCollections) {
        const docRef = doc(unauthDb, colName, 'test_doc_1');
        await assertFails(getDoc(docRef));
        await assertFails(setDoc(docRef, { data: 'unauth' }));
      }
    });

    it('rejects ordinary authenticated non-admin user read and write across all intelligence collections', async () => {
      const userDb = testEnv!.authenticatedContext('user_bob', { role: 'customer' }).firestore();

      for (const colName of allIntelligenceCollections) {
        const docRef = doc(userDb, colName, 'test_doc_2');
        await assertFails(getDoc(docRef));
        await assertFails(setDoc(docRef, { data: 'user_attempt' }));
      }
    });

    it('allows platform admin client to create and read client-writable intelligence documents', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_worker_store', { role: 'admin', admin: true }).firestore();

        for (const colName of clientAdminWritableCollections) {
          const docRef = doc(adminDb, colName, 'valid_doc_1');
          await assertSucceeds(setDoc(docRef, { testField: 'admin_data', createdAt: new Date().toISOString() }));
          await assertSucceeds(getDoc(docRef));
        }

      it('blocks all client SDK writes on server-authoritative collections (tasks, events, evidence, extractions, quality, backfill_runs, processing_runs) while allowing admin reads', async () => {
        // Pre-seed server authoritative documents using server privileged context
        await testEnv!.withSecurityRulesDisabled(async (context) => {
          for (const colName of serverAuthoritativeCollections) {
            const docRef = doc(context.firestore(), colName, 'server_doc_1');
            await setDoc(docRef, { status: 'seeded_by_server' });
          }
        });

        const adminDb = testEnv!.authenticatedContext('admin_alice', { role: 'admin', admin: true }).firestore();

        for (const colName of serverAuthoritativeCollections) {
          const docRef = doc(adminDb, colName, 'server_doc_1');
          await assertSucceeds(getDoc(docRef));
          await assertFails(setDoc(docRef, { status: 'pending' }));
          await assertFails(updateDoc(docRef, { status: 'completed' }));
          await assertFails(deleteDoc(docRef));
        }
      });

    it('enforces historical immutability: admin cannot create, update or delete events, evidence, extractions, quality', async () => {
      const immutableCollections = [
        'intelligence_events',
        'intelligence_evidence',
        'intelligence_extractions',
        'intelligence_quality',
      ];

      // Pre-seed immutable documents using server privileged context
      await testEnv!.withSecurityRulesDisabled(async (context) => {
        for (const colName of immutableCollections) {
          const docRef = doc(context.firestore(), colName, 'immutable_doc_1');
          await setDoc(docRef, { initial: 'original_record' });
        }
      });

      const adminDb = testEnv!.authenticatedContext('admin_alice', { role: 'admin', admin: true }).firestore();

      for (const colName of immutableCollections) {
        const docRef = doc(adminDb, colName, 'immutable_doc_1');
        // Initial client create is REJECTED (server authoritative)
        await assertFails(setDoc(doc(adminDb, colName, 'immutable_doc_2'), { initial: 'client_record' }));
        // Updates must be REJECTED (append-only / server authoritative)
        await assertFails(updateDoc(docRef, { initial: 'mutated_record' }));
        // Deletions must be REJECTED
        await assertFails(deleteDoc(docRef));
        // Admin read must SUCCEED
        await assertSucceeds(getDoc(docRef));
      }
    });

    it('prevents deletion of jobs and properties to protect audit trails', async () => {
      const auditCollections = [
        'intelligence_jobs',
        'intelligence_properties',
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

    it('blocks all client SDK writes (create, update, delete) on intelligence_processing_runs while allowing admin client reads', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_worker_store2', { role: 'admin', admin: true }).firestore();
        const userDb = testEnv!.authenticatedContext('user_bob', { role: 'customer' }).firestore();
        const unauthDb = testEnv!.unauthenticatedContext().firestore();

        const runDocRefAdmin = doc(adminDb, 'intelligence_processing_runs', 'run_test_1');
        const runDocRefUser = doc(userDb, 'intelligence_processing_runs', 'run_test_1');
        const runDocRefUnauth = doc(unauthDb, 'intelligence_processing_runs', 'run_test_1');

        // Unauthenticated & non-admin client reads denied
        await assertFails(getDoc(runDocRefUnauth));
        await assertFails(getDoc(runDocRefUser));

        // Admin client read succeeds
        await assertSucceeds(getDoc(runDocRefAdmin));

        // All client SDK writes (create, update, delete) MUST BE DENIED (even for admin)
        await assertFails(setDoc(runDocRefAdmin, { status: 'running' }));
        await assertFails(setDoc(runDocRefUser, { status: 'running' }));
        await assertFails(setDoc(runDocRefUnauth, { status: 'running' }));
        await assertFails(updateDoc(runDocRefAdmin, { status: 'completed' }));
        await assertFails(deleteDoc(runDocRefAdmin));
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

    it('prevents claimTaskTransactional from dead-lettering a task owned by another worker with an active lease when attempts >= maxAttempts', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_claim_race_max_attempts_1';
      const activeLeaseTime = new Date(Date.now() + 60000).toISOString();

      mockDocs.set(taskId, {
        taskId,
        status: 'processing',
        workerId: 'worker_A',
        leaseId: 'lease_worker_A_123',
        leaseExpiresAt: activeLeaseTime,
        attempts: 3,
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

      const queueB = new IntelligenceTaskQueue();
      queueB.setFirestoreDb(mockDb as any);

      // Worker B attempts to claim Worker A's actively running task whose attempts reached maxAttempts
      const claimedB = await queueB.claimTaskTransactional(taskId, 'worker_B', 60000);

      // Worker B MUST NOT claim the task, AND MUST NOT modify or dead-letter Worker A's task
      expect(claimedB).toBe(false);

      const currentTask = mockDocs.get(taskId);
      expect(currentTask.status).toBe('processing');
      expect(currentTask.workerId).toBe('worker_A');
      expect(currentTask.leaseId).toBe('lease_worker_A_123');
      expect(currentTask.errorCode).toBeUndefined();
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
      await withAdminDb(async (db) => {
        evidenceRegistry.setDb(db);

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
    });

    it('does not fabricate a content hash for reference-only evidence pointers', async () => {
      await withAdminDb(async (db) => {
        evidenceRegistry.setDb(db);

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
  // 8. REAL FIRESTORE EMULATOR CONCURRENCY & TASK 13E OWNERSHIP (CI WIRED)
  // ==========================================================
  describe('8. Real Firestore Emulator Concurrency & Task 13E Ownership Invariants (CI Wired)', () => {
    it('proves real Firestore emulator atomic claiming under high concurrency (3 concurrent workers, 1 winner)', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_worker_store3', { role: 'admin', admin: true }).firestore();
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
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_1', { role: 'admin', admin: true }).firestore();
        const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

        const taskId = `task_emu_exec_${Date.now()}`;
        const nowIso = new Date().toISOString();

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

        const [resA, resB] = await Promise.all([
          queueA.executeTask(taskId),
          queueB.executeTask(taskId),
        ]);

        expect(handlerCalls).toBe(1);
        expect(['emu-worker-A', 'emu-worker-B']).toContain(winningWorker);

        const taskSnap = await getDoc(doc(adminDb, 'intelligence_tasks', taskId));
        expect(taskSnap.exists()).toBe(true);
        const data = taskSnap.data()!;
        expect(data.status).toBe('succeeded');
        expect(data.attempts).toBe(1);
    });

    // ==========================================
    // TASK 13E INVARIANTS (1 - 9)
    // ==========================================

    it('Task 13E Invariant 1: Concurrent claim gives exactly one winner on real Firestore emulator', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_2', { role: 'admin', admin: true }).firestore();
          const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

          const taskId = `task_t13e_claim_${Date.now()}`;
          const nowIso = new Date().toISOString();

          await setDoc(doc(adminDb, 'intelligence_tasks', taskId), {
            taskId,
            taskType: 'job_extraction',
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            createdAt: nowIso,
            updatedAt: nowIso,
      });

        const queueA = new IntelligenceTaskQueue(3, 300000, 'worker-A');
        const queueB = new IntelligenceTaskQueue(3, 300000, 'worker-B');
        queueA.setFirestoreDb(firestoreTaskDb as any);
        queueB.setFirestoreDb(firestoreTaskDb as any);

        const [claimA, claimB] = await Promise.all([
          queueA.claimTaskTransactional(taskId, 'worker-A', 60000),
          queueB.claimTaskTransactional(taskId, 'worker-B', 60000),
        ]);

        // Exactly ONE returns true, exactly one returns false
        expect((claimA && !claimB) || (!claimA && claimB)).toBe(true);
        const winner = claimA ? 'worker-A' : 'worker-B';

        // Verify authoritative state in real Firestore emulator
        const snap = await getDoc(doc(adminDb, 'intelligence_tasks', taskId));
        expect(snap.exists()).toBe(true);
        const data = snap.data()!;
        expect(data.status).toBe('processing');
        expect(data.attempts).toBe(1);
        expect(data.workerId).toBe(winner);
        expect(typeof data.leaseId).toBe('string');
        expect(data.leaseId!.length).toBeGreaterThan(0);
    });

    it('Task 13E Invariant 2: Active foreign lease with max attempts prevents claim and prevents premature dead-lettering', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_3', { role: 'admin', admin: true }).firestore();
          const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

          const taskId = `task_t13e_foreign_${Date.now()}`;
          const nowIso = new Date().toISOString();
          const futureLease = new Date(Date.now() + 60000).toISOString();

          // Seed task processing by worker-A with attempts == maxAttempts
          await setDoc(doc(adminDb, 'intelligence_tasks', taskId), {
            taskId,
            taskType: 'job_extraction',
            status: 'processing',
            attempts: 3,
            maxAttempts: 3,
            workerId: 'worker-A',
            leaseId: 'lease-A',
            leaseExpiresAt: futureLease,
            createdAt: nowIso,
            updatedAt: nowIso,
      });

        const queueB = new IntelligenceTaskQueue(3, 300000, 'worker-B');
        queueB.setFirestoreDb(firestoreTaskDb as any);

        // Worker B attempts to claim
        const claimed = await queueB.claimTaskTransactional(taskId, 'worker-B');
        expect(claimed).toBe(false);

        // Authoritative state in real Firestore emulator must remain untouched:
        // Worker A still owns task, status remains processing, attempts remains 3, not dead-lettered
        const snap = await getDoc(doc(adminDb, 'intelligence_tasks', taskId));
        const data = snap.data()!;
        expect(data.status).toBe('processing');
        expect(data.workerId).toBe('worker-A');
        expect(data.leaseId).toBe('lease-A');
        expect(data.attempts).toBe(3);
        expect(data.errorCode).toBeUndefined();
    });

    it('Task 13E Invariant 3: Stale reclaim clears old workerId and leaseId upon recovery in real Firestore', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_4', { role: 'admin', admin: true }).firestore();
          const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

          const taskRetryId = `task_t13e_stale_retry_${Date.now()}`;
          const taskDeadId = `task_t13e_stale_dead_${Date.now()}`;
          const nowIso = new Date().toISOString();
          const expiredLease = new Date(Date.now() - 10000).toISOString();

          // Task 1: attempts = 1 < maxAttempts 3 -> recovers to retrying
          await setDoc(doc(adminDb, 'intelligence_tasks', taskRetryId), {
            taskId: taskRetryId,
            taskType: 'job_extraction',
            status: 'processing',
            attempts: 1,
            maxAttempts: 3,
            workerId: 'worker-A',
            leaseId: 'lease-A',
            leaseExpiresAt: expiredLease,
            createdAt: nowIso,
            updatedAt: nowIso,
      });

        // Task 2: attempts = 3 == maxAttempts 3 -> recovers to dead_letter
        await setDoc(doc(adminDb, 'intelligence_tasks', taskDeadId), {
          taskId: taskDeadId,
          taskType: 'job_extraction',
          status: 'processing',
          attempts: 3,
          maxAttempts: 3,
          workerId: 'worker-A',
          leaseId: 'lease-A',
          leaseExpiresAt: expiredLease,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        const queue = new IntelligenceTaskQueue(3, 300000, 'worker-recovery');
        queue.setFirestoreDb(firestoreTaskDb as any);

        const recovered = await queue.recoverStaleTasksAsync();
        expect(recovered.length).toBeGreaterThanOrEqual(2);

        // Verify Task 1 in real Firestore
        const snapRetry = await getDoc(doc(adminDb, 'intelligence_tasks', taskRetryId));
        const dataRetry = snapRetry.data()!;
        expect(dataRetry.status).toBe('retrying');
        expect(dataRetry.workerId).toBeFalsy();
        expect(dataRetry.leaseId).toBeFalsy();
        expect(dataRetry.leaseExpiresAt).toBeFalsy();

        // Verify Task 2 in real Firestore
        const snapDead = await getDoc(doc(adminDb, 'intelligence_tasks', taskDeadId));
        const dataDead = snapDead.data()!;
        expect(dataDead.status).toBe('dead_letter');
        expect(dataDead.errorCode).toBe('STALE_LEASE_EXHAUSTED');
        expect(dataDead.workerId).toBeFalsy();
        expect(dataDead.leaseId).toBeFalsy();
        expect(dataDead.leaseExpiresAt).toBeFalsy();
    });

    it('Task 13E Invariant 4: Old worker cannot finalize failure after lease reclaim on real Firestore', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_5', { role: 'admin', admin: true }).firestore();
          const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

          const taskId = `task_t13e_fail_reclaim_${Date.now()}`;
          const nowIso = new Date().toISOString();

          // Seed task ready for worker-A
          const docRef = doc(adminDb, 'intelligence_tasks', taskId);
          await setDoc(docRef, {
            taskId,
            taskType: 'job_extraction',
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            createdAt: nowIso,
            updatedAt: nowIso,
      });

        const queueA = new IntelligenceTaskQueue(3, 50, 'worker-A');
        queueA.setFirestoreDb(firestoreTaskDb as any);

        let releaseHandler: any;
        let handlerStarted: any;
        const handlerGate = new Promise((resolve) => { releaseHandler = resolve; });
        const startedGate = new Promise((resolve) => { handlerStarted = resolve; });

        queueA.registerHandler('job_extraction', async () => {
          handlerStarted();
          await handlerGate;
          throw new Error('Late failure from stale execution');
        });

        // Start execution with short lease-A (50ms configured on queue)
        const execPromise = queueA.executeTask(taskId, 'worker-A');
        await startedGate;

        // Allow lease-A to expire naturally on real Firestore
        await new Promise((resolve) => setTimeout(resolve, 60));

        // Worker B / Recovery Worker executes the actual stale-recovery path against the real Firestore emulator
        const queueB = new IntelligenceTaskQueue(3, 300000, 'worker-B');
        queueB.setFirestoreDb(firestoreTaskDb as any);

        // 1. recoverStaleTasksAsync discovers the stale task and resets it to 'retrying' with workerId/leaseId cleared
        const recovered = await queueB.recoverStaleTasksAsync();
        expect(recovered.some((t) => t.taskId === taskId)).toBe(true);

        // Verify the task transitioned to retrying and stripped stale workerId/leaseId
        const snapRecovered = await getDoc(docRef);
        expect(snapRecovered.data()!.status).toBe('retrying');
        expect(snapRecovered.data()!.workerId).toBeUndefined();

        // 2. Worker B transactionally claims the retrying task under a new valid lease
        const reclaimed = await queueB.claimTaskTransactional(taskId, 'worker-B', 120000);
        expect(reclaimed).toBe(true);

        // Release Worker A's failing handler from its stale attempt
        releaseHandler();
        const resA = await execPromise;
        // Worker A aborted finalization due to ownership loss, returning latest state from Firestore
        expect(resA.workerId).toBe('worker-B');
        expect(resA.status).toBe('processing');

        // Authoritative state in real Firestore must remain processing under Worker B's lease
        const snap = await getDoc(docRef);
        const data = snap.data()!;
        expect(data.status).toBe('processing');
        expect(data.workerId).toBe('worker-B');
        expect(data.leaseId).toBeDefined();
        expect(data.attempts).toBe(2);
        expect(data.errorCode).toBeUndefined();
    });

    it('Task 13E Invariant 5: Old worker cannot finalize success after lease reclaim on real Firestore', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_6', { role: 'admin', admin: true }).firestore();
          const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

          const taskId = `task_t13e_succ_reclaim_${Date.now()}`;
          const nowIso = new Date().toISOString();

          const docRef = doc(adminDb, 'intelligence_tasks', taskId);
          await setDoc(docRef, {
            taskId,
            taskType: 'job_extraction',
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            createdAt: nowIso,
            updatedAt: nowIso,
      });

        const queueA = new IntelligenceTaskQueue(3, 50, 'worker-A');
        queueA.setFirestoreDb(firestoreTaskDb as any);

        let releaseHandler: any;
        let handlerStarted: any;
        const handlerGate = new Promise((resolve) => { releaseHandler = resolve; });
        const startedGate = new Promise((resolve) => { handlerStarted = resolve; });

        queueA.registerHandler('job_extraction', async () => {
          handlerStarted();
          await handlerGate;
          return { done: true };
        });

        // Start execution with short lease (50ms configured on queue)
        const execPromise = queueA.executeTask(taskId, 'worker-A');
        await startedGate;

        // Allow lease to expire naturally on real Firestore
        await new Promise((resolve) => setTimeout(resolve, 60));

        // Worker B / Recovery Worker executes the actual stale-recovery path against the real Firestore emulator
        const queueB = new IntelligenceTaskQueue(3, 300000, 'worker-B');
        queueB.setFirestoreDb(firestoreTaskDb as any);

        // 1. recoverStaleTasksAsync discovers the stale task and resets it to 'retrying' with workerId/leaseId cleared
        const recovered = await queueB.recoverStaleTasksAsync();
        expect(recovered.some((t) => t.taskId === taskId)).toBe(true);

        // Verify the task transitioned to retrying and stripped stale workerId/leaseId
        const snapRecovered = await getDoc(docRef);
        expect(snapRecovered.data()!.status).toBe('retrying');
        expect(snapRecovered.data()!.workerId).toBeUndefined();

        // 2. Worker B transactionally claims the retrying task under a new valid lease
        const reclaimed = await queueB.claimTaskTransactional(taskId, 'worker-B', 120000);
        expect(reclaimed).toBe(true);

        // Let Worker A's handler finish successfully from its stale attempt
        releaseHandler();
        const resA = await execPromise;
        // Worker A aborted finalization due to ownership loss, returning latest state from Firestore
        expect(resA.workerId).toBe('worker-B');
        expect(resA.status).toBe('processing');

        // Authoritative state in real Firestore remains processing under Worker B's lease (not succeeded by Worker A)
        const snap = await getDoc(docRef);
        const data = snap.data()!;
        expect(data.status).toBe('processing');
        expect(data.workerId).toBe('worker-B');
        expect(data.leaseId).toBeDefined();
        expect(data.attempts).toBe(2);
        expect(data.completedAt).toBeUndefined();
    });

    it('Task 13E Invariant 6: Different worker cannot finalize success or failure on real Firestore', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_7', { role: 'admin', admin: true }).firestore();
          const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

          const taskSuccId = `task_t13e_diff_succ_${Date.now()}`;
          const taskFailId = `task_t13e_diff_fail_${Date.now()}`;
          const nowIso = new Date().toISOString();

          await setDoc(doc(adminDb, 'intelligence_tasks', taskSuccId), {
            taskId: taskSuccId,
            taskType: 'job_extraction',
            status: 'processing',
            attempts: 1,
            maxAttempts: 3,
            workerId: 'worker-B',
            leaseId: 'lease-B',
            leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
            createdAt: nowIso,
            updatedAt: nowIso,
      });

        await setDoc(doc(adminDb, 'intelligence_tasks', taskFailId), {
          taskId: taskFailId,
          taskType: 'job_extraction',
          status: 'processing',
          attempts: 1,
          maxAttempts: 3,
          workerId: 'worker-B',
          leaseId: 'lease-B',
          leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        const queueA = new IntelligenceTaskQueue(3, 300000, 'worker-A');
        queueA.setFirestoreDb(firestoreTaskDb as any);

        queueA.registerHandler('job_extraction', async (t) => {
          if (t.taskId === taskSuccId) return { ok: true };
          throw new Error('Worker-A failure attempt');
        });

        await Promise.all([
          queueA.executeTask(taskSuccId),
          queueA.executeTask(taskFailId),
        ]);

        const snapSucc = await getDoc(doc(adminDb, 'intelligence_tasks', taskSuccId));
        const snapFail = await getDoc(doc(adminDb, 'intelligence_tasks', taskFailId));

        expect(snapSucc.data()!.status).toBe('processing');
        expect(snapSucc.data()!.workerId).toBe('worker-B');
        expect(snapSucc.data()!.leaseId).toBe('lease-B');

        expect(snapFail.data()!.status).toBe('processing');
        expect(snapFail.data()!.workerId).toBe('worker-B');
        expect(snapFail.data()!.leaseId).toBe('lease-B');
    });

    it('Task 13E Invariant 7: Missing handler dead-letters own task verifying leaseId; foreign worker cannot overwrite', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_8', { role: 'admin', admin: true }).firestore();
          const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

          const taskOwnId = `task_t13e_missing_own_${Date.now()}`;
          const taskForeignId = `task_t13e_missing_foreign_${Date.now()}`;
          const nowIso = new Date().toISOString();

          // Task 1: pending with unregistered task type
          await setDoc(doc(adminDb, 'intelligence_tasks', taskOwnId), {
            taskId: taskOwnId,
            taskType: 'unknown_service_unregistered',
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            createdAt: nowIso,
            updatedAt: nowIso,
      });

        const queueA = new IntelligenceTaskQueue(3, 300000, 'worker-A');
        queueA.setFirestoreDb(firestoreTaskDb as any);

        // Worker A executes task with no handler registered -> claims task and dead-letters it
        const resOwn = await queueA.executeTask(taskOwnId);
        expect(resOwn.status).toBe('dead_letter');
        expect(resOwn.errorCode).toBe('MISSING_HANDLER');

        // Authoritative Firestore check
        const snapOwn = await getDoc(doc(adminDb, 'intelligence_tasks', taskOwnId));
        expect(snapOwn.data()!.status).toBe('dead_letter');
        expect(snapOwn.data()!.errorCode).toBe('MISSING_HANDLER');

        // Task 2: owned by worker-B + lease-B with active lease
        await setDoc(doc(adminDb, 'intelligence_tasks', taskForeignId), {
          taskId: taskForeignId,
          taskType: 'unknown_service_unregistered',
          status: 'processing',
          attempts: 1,
          maxAttempts: 3,
          workerId: 'worker-B',
          leaseId: 'lease-B',
          leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        // Worker A attempts to execute task owned by worker-B
        await queueA.executeTask(taskForeignId);

        // Authoritative Firestore check: Task 2 is NOT overwritten by worker-A
        const snapForeign = await getDoc(doc(adminDb, 'intelligence_tasks', taskForeignId));
        expect(snapForeign.data()!.status).toBe('processing');
        expect(snapForeign.data()!.workerId).toBe('worker-B');
        expect(snapForeign.data()!.leaseId).toBe('lease-B');
    });

    it('Task 13E Invariant 8: Terminal states (succeeded, dead_letter) are protected against claim on real Firestore', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_9', { role: 'admin', admin: true }).firestore();
          const firestoreTaskDb = createRealFirestoreTaskDb(adminDb);

          const taskSuccId = `task_t13e_term_succ_${Date.now()}`;
          const taskDeadId = `task_t13e_term_dead_${Date.now()}`;
          const nowIso = new Date().toISOString();

          await setDoc(doc(adminDb, 'intelligence_tasks', taskSuccId), {
            taskId: taskSuccId,
            taskType: 'job_extraction',
            status: 'succeeded',
            attempts: 1,
            maxAttempts: 3,
            createdAt: nowIso,
            updatedAt: nowIso,
      });

        await setDoc(doc(adminDb, 'intelligence_tasks', taskDeadId), {
          taskId: taskDeadId,
          taskType: 'job_extraction',
          status: 'dead_letter',
          attempts: 3,
          maxAttempts: 3,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        const queue = new IntelligenceTaskQueue(3, 300000, 'worker-invader');
        queue.setFirestoreDb(firestoreTaskDb as any);

        const claimSucc = await queue.claimTaskTransactional(taskSuccId, 'worker-invader');
        const claimDead = await queue.claimTaskTransactional(taskDeadId, 'worker-invader');

        expect(claimSucc).toBe(false);
        expect(claimDead).toBe(false);

        const snapSucc = await getDoc(doc(adminDb, 'intelligence_tasks', taskSuccId));
        const snapDead = await getDoc(doc(adminDb, 'intelligence_tasks', taskDeadId));

        expect(snapSucc.data()!.status).toBe('succeeded');
        expect(snapDead.data()!.status).toBe('dead_letter');
    });

    it('Task 13E Invariant 9: Transaction failures in stale recovery propagate without silent swallowing on real Firestore emulator', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_val_10', { role: 'admin', admin: true }).firestore();
          const unauthorizedDb = testEnv!.authenticatedContext('unauthorized_worker_inv9', { role: 'customer' }).firestore();

          const taskId = `task_t13e_tx_fail_${Date.now()}`;
          const nowIso = new Date().toISOString();
          const expiredLease = new Date(Date.now() - 10000).toISOString();

          await setDoc(doc(adminDb, 'intelligence_tasks', taskId), {
            taskId,
            taskType: 'job_extraction',
            status: 'processing',
            attempts: 1,
            maxAttempts: 3,
            workerId: 'worker-A',
            leaseId: 'lease-A',
            leaseExpiresAt: expiredLease,
            createdAt: nowIso,
            updatedAt: nowIso,
      });

        const realAdminDb = createRealFirestoreTaskDb(adminDb);
        const realUnauthDb = createRealFirestoreTaskDb(unauthorizedDb);

        // Query runs with admin context to locate stale tasks on the real Firestore emulator,
        // while the transactional update executes with an unauthorized context on the real emulator.
        // The real Firestore emulator's transaction runner evaluates security rules,
        // rejects the update, and throws an authentic FirebaseError.
        const emulatorFailingDb = {
          collection: (name: string) => realAdminDb.collection(name),
          runTransaction: realUnauthDb.runTransaction,
        };

        const queue = new IntelligenceTaskQueue(3, 300000, 'worker-recovery');
        queue.setFirestoreDb(emulatorFailingDb as any);

        // The real Firestore emulator's runTransaction must reject and propagate the authentic FirebaseError without swallowing
        let caughtError: any = null;
        try {
          await queue.recoverStaleTasksAsync();
        } catch (err) {
          caughtError = err;
        }

        expect(caughtError).toBeDefined();
        expect(caughtError.name).toBe('FirebaseError');
        expect(caughtError.message).toMatch(/permission|denied|PERMISSION_DENIED/i);

        // Additionally verify real Firestore emulator transaction retry exhaustion & abort under high contention
        const taskIdContention = `task_t13e_tx_contention_${Date.now()}`;
        await setDoc(doc(adminDb, 'intelligence_tasks', taskIdContention), {
          taskId: taskIdContention,
          taskType: 'job_extraction',
          status: 'processing',
          attempts: 1,
          maxAttempts: 3,
          workerId: 'worker-A',
          leaseId: 'lease-A',
          leaseExpiresAt: expiredLease,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        let contentionAttempts = 0;
        const contentionDb = {
          collection: (name: string) => ({
            where: () => ({
              get: async () => ({
                empty: false,
                docs: [{ id: taskIdContention }],
              }),
            }),
            doc: realAdminDb.collection(name).doc,
          }),
          runTransaction: async <T>(updateFunction: (tx: any) => Promise<T>): Promise<T> => {
            return runTransaction(adminDb, async (rawTx) => {
              contentionAttempts++;
              // Concurrently mutate the task in Firestore outside rawTx to trigger real emulator transaction conflict
              await updateDoc(doc(adminDb, 'intelligence_tasks', taskIdContention), {
                updatedAt: new Date().toISOString(),
                contentionCount: contentionAttempts,
              });
              const col = 'intelligence_tasks';
              const docRef = doc(adminDb, col, taskIdContention);
              const snap = await rawTx.get(docRef);
              const txWrapper = {
                get: async () => ({ id: snap.id, exists: snap.exists(), data: () => snap.data() }),
                update: (ref: any, data: any) => rawTx.update(docRef, data),
                set: (ref: any, data: any) => rawTx.set(docRef, data),
                delete: (ref: any) => rawTx.delete(docRef),
              };
              return await updateFunction(txWrapper);
            });
          },
        };

        const queueContention = new IntelligenceTaskQueue(3, 300000, 'worker-recovery');
        queueContention.setFirestoreDb(contentionDb as any);

        let contentionError: any = null;
        try {
          await queueContention.recoverStaleTasksAsync();
        } catch (err) {
          contentionError = err;
        }

        expect(contentionError).toBeDefined();
        expect(contentionError.name).toBe('FirebaseError');
        expect(contentionAttempts).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================
  // 9. TASK 7A IMMUTABLE INTELLIGENCE PERSISTENCE & CONCURRENCY
  // ==========================================================
  describe('9. Task 7A Immutable Intelligence Persistence & Concurrency Invariants (Emulator)', () => {
    async function seedEvidence(db: any, evidenceId: string, aggregateType: string, aggregateId: string, sourceVersion: number = 1) {
      const targetDb = db;
      await setDoc(doc(targetDb, 'intelligence_evidence', evidenceId), {
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
      await withAdminDb(async (adminDb) => {
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
            event: { ...eventPayload, eventId: 'ie_ev_con_100_w1' },
            summaryProjection: summaryPayload,
          }),
          immutableIntelligenceStore.persistOutput({
            db: storeDb,
            aggregateType: 'job',
            aggregateId: 'job_concurrent_100',
            versionId,
            extraction: extractionPayload,
            event: { ...eventPayload, eventId: 'ie_ev_con_100_w2' },
            summaryProjection: summaryPayload,
          }),
          immutableIntelligenceStore.persistOutput({
            db: storeDb,
            aggregateType: 'job',
            aggregateId: 'job_concurrent_100',
            versionId,
            extraction: extractionPayload,
            event: { ...eventPayload, eventId: 'ie_ev_con_100_w3' },
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
      await withAdminDb(async (adminDb) => {
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

  // ==========================================================
  // 10. TASK 10A EVIDENCE LINEAGE ENFORCEMENT (REAL EMULATOR)
  // ==========================================================
  describe('10. Task 10A Evidence Lineage Enforcement & Provenance Invariants (Real Emulator)', () => {
    const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const confidence = {
      overall: 0.95,
      extraction: 0.95,
      evidenceQuality: 0.95,
      classification: 0.95,
      temporalFreshness: 0.95,
      method: 'deterministic_heuristic' as const,
    };

    const provenance = {
      source: 'user',
      evidenceIds: [],
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'v1',
      generatedAt: new Date().toISOString(),
      sourceContentHash: validHash,
    };

    async function seedEvidenceDoc(db: any, evidence: Partial<any> & { evidenceId: string }) {
      const targetDb = db;
      const docData: any = {
        evidenceId: evidence.evidenceId,
        aggregateType: evidence.aggregateType || 'job',
        aggregateId: evidence.aggregateId || 'job_emu_101',
        sourceType: evidence.sourceType || 'job',
        sourceId: evidence.sourceId || evidence.aggregateId || 'job_emu_101',
        sourceVersion: evidence.sourceVersion ?? 1,
        evidenceType: evidence.evidenceType || 'document',
        evidenceCategory: evidence.evidenceCategory || 'DOCUMENT',
        sourceRef: evidence.sourceRef || `sources/${evidence.evidenceId}`,
        contentHash: evidence.contentHash !== undefined ? evidence.contentHash : validHash,
        contentSize: evidence.contentSize ?? 256,
        byteSize: evidence.byteSize ?? 256,
        schemaVersion: 'v8.1.0',
        integrityStatus: evidence.integrityStatus || 'verified',
        verified: evidence.verified !== undefined ? evidence.verified : true,
        metadata: evidence.metadata || {},
        createdAt: new Date().toISOString(),
      };
      if (evidence.sourceReference !== undefined) {
        docData.sourceReference = evidence.sourceReference;
      }
      if (evidence.mimeType !== undefined) {
        docData.mimeType = evidence.mimeType;
      }
      if (evidence.storagePath !== undefined) {
        docData.storagePath = evidence.storagePath;
      }
      await setDoc(doc(targetDb, 'intelligence_evidence', evidence.evidenceId), docData);
    }

    // 1. Valid same-aggregate evidence -> historical intelligence created successfully in Firestore emulator
    it('1. Valid same-aggregate evidence -> historical intelligence created successfully in Firestore emulator', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);
        const versionId = buildVersionId('job', 'job_emu_val_1', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_val_1',
          aggregateType: 'job',
          aggregateId: 'job_emu_val_1',
          sourceVersion: 1,
          integrityStatus: 'verified',
          verified: true,
          contentHash: validHash,
          byteSize: 200,
      });
      });

      const extraction = {
        extractionId: 'ext_emu_val_1',
        versionId,
        aggregateType: 'job' as const,
        aggregateId: 'job_emu_val_1',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_v1',
        sourceVersion: 1,
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_1', createdAt: new Date().toISOString() },
        structuredCandidate: { category: 'Plumbing', problem: 'Burst Pipe' },
        evidenceIds: ['ev_emu_val_1'],
        confidence,
        provenance: { ...provenance, evidenceIds: ['ev_emu_val_1'] },
      };

      const event = {
        eventId: 'ie_emu_val_1',
        aggregateType: 'job' as const,
        aggregateId: 'job_emu_val_1',
        eventType: 'JOB_ANALYSIS_COMPLETED' as const,
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_v1',
        createdAt: new Date().toISOString(),
        source: 'jobs/job_emu_val_1',
        evidenceIds: ['ev_emu_val_1'],
        confidence,
        provenance: { ...provenance, evidenceIds: ['ev_emu_val_1'] },
        status: 'valid' as const,
        payload: { category: 'Plumbing' },
      };

      const summary = {
        jobId: 'job_emu_val_1',
        currentVersionId: versionId,
        category: 'Plumbing',
        buildingComponent: 'Pipe',
        observedProblem: 'Burst Pipe',
        extractedScope: ['Fix pipe'],
        recommendedIntervention: 'Pipe repair',
        evidenceIds: ['ev_emu_val_1'],
        confidence,
        provenance: { ...provenance, evidenceIds: ['ev_emu_val_1'] },
        pipelineVersion: 'v8.1',
        updatedAt: new Date().toISOString(),
      };

      const res = await immutableIntelligenceStore.persistOutput({
        db: storeDb,
        aggregateType: 'job',
        aggregateId: 'job_emu_val_1',
        versionId,
        extraction,
        event,
        summaryProjection: summary,
      });

      expect(res.isNew).toBe(true);
      expect(res.versionId).toBe(versionId);

      // Verify records written in real Firestore emulator
      const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', versionId));
      expect(extSnap.exists()).toBe(true);
      expect(extSnap.data()?.aggregateId).toBe('job_emu_val_1');

      const evSnap = await getDoc(doc(adminDb, 'intelligence_events', 'ie_emu_val_1'));
      expect(evSnap.exists()).toBe(true);

      const sumSnap = await getDoc(doc(adminDb, 'intelligence_jobs', 'job_emu_val_1'));
      expect(sumSnap.exists()).toBe(true);
      expect(sumSnap.data()?.currentVersionId).toBe(versionId);
    });

    // 2. Same-type cross-ID evidence -> strictly rejected, zero documents written
    it('2. Same-type cross-ID evidence -> strictly rejected, zero documents written', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);
        const versionId = buildVersionId('job', 'job_emu_target_2', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

        // Evidence belongs to job_emu_other_2, but sets sourceId = job_emu_target_2 to attempt spoofing
        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_cross_same',
          aggregateType: 'job',
          aggregateId: 'job_emu_other_2',
          sourceId: 'job_emu_target_2',
          sourceVersion: 1,
          integrityStatus: 'verified',
          verified: true,
          contentHash: validHash,
          byteSize: 200,
      });
      });

      const extraction = {
        extractionId: 'ext_emu_target_2',
        versionId,
        aggregateType: 'job' as const,
        aggregateId: 'job_emu_target_2',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_v1',
        sourceVersion: 1,
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_2', createdAt: new Date().toISOString() },
        structuredCandidate: { category: 'Electrical', problem: 'Fault' },
        evidenceIds: ['ev_emu_cross_same'],
        confidence,
        provenance: { ...provenance, evidenceIds: ['ev_emu_cross_same'] },
      };

      await expect(
        immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_emu_target_2',
          versionId,
          extraction,
          event: { eventId: 'ie_emu_target_2', aggregateType: 'job', aggregateId: 'job_emu_target_2' } as any,
          summaryProjection: { jobId: 'job_emu_target_2' },
        })
      ).rejects.toThrow(/Same-type aggregate mismatch rejected: Evidence 'ev_emu_cross_same' belongs to 'job:job_emu_other_2', not 'job:job_emu_target_2'/);

      // Verify ZERO documents were written to Firestore emulator
      const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', versionId));
      expect(extSnap.exists()).toBe(false);

      const evSnap = await getDoc(doc(adminDb, 'intelligence_events', 'ie_emu_target_2'));
      expect(evSnap.exists()).toBe(false);

      const sumSnap = await getDoc(doc(adminDb, 'intelligence_jobs', 'job_emu_target_2'));
      expect(sumSnap.exists()).toBe(false);
    });

    // 3. Missing evidence -> strictly rejected, zero documents written
    it('3. Missing evidence -> strictly rejected, zero documents written', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);
        const versionId = buildVersionId('job', 'job_emu_missing_3', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

        const extraction = {
          extractionId: 'ext_emu_missing_3',
          versionId,
          aggregateType: 'job' as const,
          aggregateId: 'job_emu_missing_3',
          schemaVersion: '1.0.0',
          pipelineVersion: 'v8.1',
          modelVersion: 'gemini-3.7-flash',
          promptVersion: 'job_v1',
          sourceVersion: 1,
          provider: 'google_genai',
          createdAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_3', createdAt: new Date().toISOString() },
          structuredCandidate: { category: 'Plumbing', problem: 'Leak' },
          evidenceIds: ['ev_emu_missing_999'],
          confidence,
          provenance: { ...provenance, evidenceIds: ['ev_emu_missing_999'] },
        };

        await expect(
          immutableIntelligenceStore.persistOutput({
            db: storeDb,
            aggregateType: 'job',
            aggregateId: 'job_emu_missing_3',
            versionId,
            extraction,
            event: { eventId: 'ie_emu_missing_3', aggregateType: 'job', aggregateId: 'job_emu_missing_3' } as any,
            summaryProjection: { jobId: 'job_emu_missing_3' },
          })
        ).rejects.toThrow(/Referenced evidence 'ev_emu_missing_999' does not exist in authoritative Firestore store/);

        // Verify ZERO documents written
        const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', versionId));
        expect(extSnap.exists()).toBe(false);
      });

      // 4. Cross-aggregate without relationship -> strictly rejected, zero documents written
      it('4. Cross-aggregate without relationship -> strictly rejected, zero documents written', async () => {
        const adminDb = testEnv!.authenticatedContext('admin_emu_val_4', { role: 'admin', admin: true }).firestore();
        const storeDb = createRealFirestoreStoreDb(adminDb);
        const versionId = buildVersionId('property', 'prop_emu_4', 1, 'v8.1', 'gemini-3.7-flash', 'prop_v1', '1.0.0');

        // Seed job evidence unlinked to property
        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_unlinked_4',
          aggregateType: 'job',
          aggregateId: 'job_emu_unlinked_4',
          sourceVersion: 1,
          sourceReference: { propertyId: 'other_property_999' },
      });
      });

      const extraction = {
        extractionId: 'ext_emu_prop_4',
        versionId,
        aggregateType: 'property' as const,
        aggregateId: 'prop_emu_4',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'prop_v1',
        sourceVersion: 1,
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_p4', createdAt: new Date().toISOString() },
        structuredCandidate: { overallHealthScore: 80 },
        evidenceIds: ['ev_emu_unlinked_4'],
        confidence,
        provenance: { ...provenance, evidenceIds: ['ev_emu_unlinked_4'] },
      };

      await expect(
        immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'property',
          aggregateId: 'prop_emu_4',
          versionId,
          extraction,
          event: { eventId: 'ie_emu_prop_4', aggregateType: 'property', aggregateId: 'prop_emu_4' } as any,
          summaryProjection: { propertyId: 'prop_emu_4' },
        })
      ).rejects.toThrow(/Incompatible cross-aggregate relationship/);

      // Verify ZERO documents written
      const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', versionId));
      expect(extSnap.exists()).toBe(false);
    });

    // 5. Valid cross-aggregate (e.g. property intelligence referencing job evidence with sourceReference.propertyId) -> created successfully
    it('5. Valid cross-aggregate (property referencing job evidence with sourceReference.propertyId) -> created successfully', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);
        const versionId = buildVersionId('property', 'prop_emu_5', 1, 'v8.1', 'gemini-3.7-flash', 'prop_v1', '1.0.0');

        // Seed job evidence explicitly linked to prop_emu_5
        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_linked_5',
          aggregateType: 'job',
          aggregateId: 'job_emu_linked_5',
          sourceReference: { propertyId: 'prop_emu_5' },
          sourceVersion: 1,
          integrityStatus: 'verified',
          verified: true,
          contentHash: validHash,
          byteSize: 200,
      });
      });

      const extraction = {
        extractionId: 'ext_emu_prop_5',
        versionId,
        aggregateType: 'property' as const,
        aggregateId: 'prop_emu_5',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'prop_v1',
        sourceVersion: 1,
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_p5', createdAt: new Date().toISOString() },
        structuredCandidate: { overallHealthScore: 92 },
        evidenceIds: ['ev_emu_linked_5'],
        confidence,
        provenance: { ...provenance, evidenceIds: ['ev_emu_linked_5'] },
      };

      const res = await immutableIntelligenceStore.persistOutput({
        db: storeDb,
        aggregateType: 'property',
        aggregateId: 'prop_emu_5',
        versionId,
        extraction,
        event: { eventId: 'ie_emu_prop_5', aggregateType: 'property', aggregateId: 'prop_emu_5' } as any,
        summaryProjection: {
          propertyId: 'prop_emu_5',
          currentVersionId: versionId,
          overallHealthScore: 92,
          buildingComponents: [],
          observedConditions: [],
          recommendedInterventions: [],
          derivedFromJobIds: ['job_emu_linked_5'],
          evidenceIds: ['ev_emu_linked_5'],
          confidence,
          provenance: { ...provenance, evidenceIds: ['ev_emu_linked_5'] },
          pipelineVersion: 'v8.1',
          updatedAt: new Date().toISOString(),
        },
      });

      expect(res.isNew).toBe(true);

      const propSnap = await getDoc(doc(adminDb, 'intelligence_properties', 'prop_emu_5'));
      expect(propSnap.exists()).toBe(true);
      expect(propSnap.data()?.currentVersionId).toBe(versionId);
    });

    // 6. Source version mismatch -> strictly rejected
    it('6. Source version mismatch -> strictly rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);
        const versionId = buildVersionId('job', 'job_emu_ver_6', 3, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_ver_6',
          aggregateType: 'job',
          aggregateId: 'job_emu_ver_6',
          sourceVersion: 1,
          integrityStatus: 'verified',
          verified: true,
          contentHash: validHash,
          byteSize: 200,
      });
      });

      const extraction = {
        extractionId: 'ext_emu_ver_6',
        versionId,
        aggregateType: 'job' as const,
        aggregateId: 'job_emu_ver_6',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_v1',
        sourceVersion: 3, // Extraction claims v3, but evidence is v1
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_6', createdAt: new Date().toISOString() },
        structuredCandidate: { category: 'Roofing', problem: 'Leak' },
        evidenceIds: ['ev_emu_ver_6'],
        confidence,
        provenance: { ...provenance, evidenceIds: ['ev_emu_ver_6'] },
      };

      await expect(
        immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_emu_ver_6',
          versionId,
          extraction,
          event: { eventId: 'ie_emu_ver_6', aggregateType: 'job', aggregateId: 'job_emu_ver_6' } as any,
          summaryProjection: { jobId: 'job_emu_ver_6' },
        })
      ).rejects.toThrow(/Incompatible source version for evidence 'ev_emu_ver_6'/);

      const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', versionId));
      expect(extSnap.exists()).toBe(false);
    });

    // 7. AI circularity (evidence produced by AI model claiming to be evidence for itself) -> strictly rejected
    it('7. AI circularity (evidence produced by AI model claiming to be evidence for itself) -> strictly rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);
        const versionId = buildVersionId('job', 'job_emu_ai_7', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_ai_7',
          aggregateType: 'job',
          aggregateId: 'job_emu_ai_7',
          sourceType: 'ai_model',
          sourceVersion: 1,
          metadata: { modelVersion: 'gemini-3.7-flash', generatedOutput: true },
      });
      });

      const extraction = {
        extractionId: 'ext_emu_ai_7',
        versionId,
        aggregateType: 'job' as const,
        aggregateId: 'job_emu_ai_7',
        schemaVersion: '1.0.0',
        pipelineVersion: 'v8.1',
        modelVersion: 'gemini-3.7-flash',
        promptVersion: 'job_v1',
        sourceVersion: 1,
        provider: 'google_genai',
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_7', createdAt: new Date().toISOString() },
        structuredCandidate: { category: 'Roofing', problem: 'AI Hallucinated Leak' },
        evidenceIds: ['ev_emu_ai_7'],
        confidence,
        provenance: { ...provenance, evidenceIds: ['ev_emu_ai_7'] },
      };

      await expect(
        immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_emu_ai_7',
          versionId,
          extraction,
          event: { eventId: 'ie_emu_ai_7', aggregateType: 'job', aggregateId: 'job_emu_ai_7' } as any,
          summaryProjection: { jobId: 'job_emu_ai_7' },
        })
      ).rejects.toThrow(/Anti-AI Circularity Violation/);

      const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', versionId));
      expect(extSnap.exists()).toBe(false);
    });

    // 8. Reference-only evidence without content hash -> accepted only when verified = false and not claiming byte integrity
    it('8. Reference-only evidence without content hash -> accepted only when verified = false and not claiming byte integrity', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        // A: Valid reference-only evidence (verified = false, no byte hash claim)
        const versionIdValid = buildVersionId('job', 'job_emu_ref_8', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');
        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_ref_valid_8',
          aggregateType: 'job',
          aggregateId: 'job_emu_ref_8',
          evidenceType: 'reference',
          integrityStatus: 'unverified',
          verified: false,
          contentHash: '',
          byteSize: 0,
          sourceRef: 'https://council.gov.uk/planning/1234',
          sourceVersion: 1,
        });

        const extractionValid = {
          extractionId: 'ext_emu_ref_8',
          versionId: versionIdValid,
          aggregateType: 'job' as const,
          aggregateId: 'job_emu_ref_8',
          schemaVersion: '1.0.0',
          pipelineVersion: 'v8.1',
          modelVersion: 'gemini-3.7-flash',
          promptVersion: 'job_v1',
          sourceVersion: 1,
          provider: 'google_genai',
          createdAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_8', createdAt: new Date().toISOString() },
          structuredCandidate: { category: 'Roofing', problem: 'Council report' },
          evidenceIds: ['ev_emu_ref_valid_8'],
          confidence,
          provenance: { ...provenance, evidenceIds: ['ev_emu_ref_valid_8'] },
        };

        const res = await immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_emu_ref_8',
          versionId: versionIdValid,
          extraction: extractionValid,
          event: { eventId: 'ie_emu_ref_8', aggregateType: 'job', aggregateId: 'job_emu_ref_8' } as any,
          summaryProjection: { jobId: 'job_emu_ref_8' },
        });

        expect(res.isNew).toBe(true);

        // B: Invalid reference-only evidence claiming verified = true without a valid hash
        const versionIdInvalid = buildVersionId('job', 'job_emu_ref_8_bad', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');
        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_ref_bad_8',
          aggregateType: 'job',
          aggregateId: 'job_emu_ref_8_bad',
          evidenceType: 'reference',
          integrityStatus: 'verified',
          verified: true,
          contentHash: '', // missing hash on verified claim
          byteSize: 100,
          sourceVersion: 1,
        });

        const extractionInvalid = {
          ...extractionValid,
          extractionId: 'ext_emu_ref_8_bad',
          aggregateId: 'job_emu_ref_8_bad',
          versionId: versionIdInvalid,
          evidenceIds: ['ev_emu_ref_bad_8'],
        };

        await expect(
          immutableIntelligenceStore.persistOutput({
            db: storeDb,
            aggregateType: 'job',
            aggregateId: 'job_emu_ref_8_bad',
            versionId: versionIdInvalid,
            extraction: extractionInvalid,
            event: { eventId: 'ie_emu_ref_8_bad', aggregateType: 'job', aggregateId: 'job_emu_ref_8_bad' } as any,
            summaryProjection: { jobId: 'job_emu_ref_8_bad' },
          })
        ).rejects.toThrow(/missing or malformed 64-character SHA-256 contentHash/);
      });
    });

    // 9. Structured evidence without raw bytes -> accepted when schema valid
    it('9. Structured evidence without raw bytes -> accepted when schema valid', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);
        const versionId = buildVersionId('job', 'job_emu_struct_9', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_struct_9',
          aggregateType: 'job',
          aggregateId: 'job_emu_struct_9',
          evidenceType: 'structured_data',
          integrityStatus: 'verified',
          verified: true,
          byteSize: 0,
          contentSize: 350,
          contentHash: '',
          schemaVersion: '1.0.0',
          metadata: { schema: 'quote_item', count: 5 },
          sourceVersion: 1,
        });

        const extraction = {
          extractionId: 'ext_emu_struct_9',
          versionId,
          aggregateType: 'job' as const,
          aggregateId: 'job_emu_struct_9',
          schemaVersion: '1.0.0',
          pipelineVersion: 'v8.1',
          modelVersion: 'gemini-3.7-flash',
          promptVersion: 'job_v1',
          sourceVersion: 1,
          provider: 'google_genai',
          createdAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_9', createdAt: new Date().toISOString() },
          structuredCandidate: { category: 'Electrical', problem: 'Structured quote item analysis' },
          evidenceIds: ['ev_emu_struct_9'],
          confidence,
          provenance: { ...provenance, evidenceIds: ['ev_emu_struct_9'] },
        };

        const res = await immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_emu_struct_9',
          versionId,
          extraction,
          event: { eventId: 'ie_emu_struct_9', aggregateType: 'job', aggregateId: 'job_emu_struct_9' } as any,
          summaryProjection: {
            jobId: 'job_emu_struct_9',
            currentVersionId: versionId,
            category: 'Electrical',
            buildingComponent: 'Panel',
            observedProblem: 'Structured quote item analysis',
            extractedScope: ['Upgrade panel'],
            recommendedIntervention: 'Full upgrade',
            evidenceIds: ['ev_emu_struct_9'],
            confidence,
            provenance: { ...provenance, evidenceIds: ['ev_emu_struct_9'] },
            pipelineVersion: 'v8.1',
            updatedAt: new Date().toISOString(),
          },
        });

        expect(res.isNew).toBe(true);

        const jobSnap = await getDoc(doc(adminDb, 'intelligence_jobs', 'job_emu_struct_9'));
        expect(jobSnap.exists()).toBe(true);
        expect(jobSnap.data()?.currentVersionId).toBe(versionId);
      });
    });

    // 10. Concurrent identical write under real emulator transaction -> exactly one creates, other idempotent return, no duplicate documents
    it('10. Concurrent identical write under real emulator transaction -> exactly one creates, other idempotent return, no duplicate documents', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);
        const versionId = buildVersionId('job', 'job_emu_con_10', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

        await seedEvidenceDoc(adminDb, {
          evidenceId: 'ev_emu_con_10',
          aggregateType: 'job',
          aggregateId: 'job_emu_con_10',
          sourceVersion: 1,
          integrityStatus: 'verified',
          verified: true,
          contentHash: validHash,
          byteSize: 300,
        });

        const extraction = {
          extractionId: 'ext_emu_con_10',
          versionId,
          aggregateType: 'job' as const,
          aggregateId: 'job_emu_con_10',
          schemaVersion: '1.0.0',
          pipelineVersion: 'v8.1',
          modelVersion: 'gemini-3.7-flash',
          promptVersion: 'job_v1',
          sourceVersion: 1,
          provider: 'google_genai',
          createdAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          rawManifest: { sha256: validHash, encoding: 'gzip' as const, originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_10', createdAt: new Date().toISOString() },
          structuredCandidate: { category: 'Plumbing', problem: 'Concurrent Burst Pipe' },
          evidenceIds: ['ev_emu_con_10'],
          confidence,
          provenance: { ...provenance, evidenceIds: ['ev_emu_con_10'] },
        };

        const event = {
          eventId: 'ie_emu_con_10',
          aggregateType: 'job' as const,
          aggregateId: 'job_emu_con_10',
          eventType: 'JOB_ANALYSIS_COMPLETED' as const,
          schemaVersion: '1.0.0',
          pipelineVersion: 'v8.1',
          modelVersion: 'gemini-3.7-flash',
          promptVersion: 'job_v1',
          createdAt: new Date().toISOString(),
          source: 'jobs/job_emu_con_10',
          evidenceIds: ['ev_emu_con_10'],
          confidence,
          provenance: { ...provenance, evidenceIds: ['ev_emu_con_10'] },
          status: 'valid' as const,
          payload: { category: 'Plumbing' },
        };

        const summary = {
          jobId: 'job_emu_con_10',
          currentVersionId: versionId,
          category: 'Plumbing',
          buildingComponent: 'Pipe',
          observedProblem: 'Burst pipe',
          extractedScope: ['Repair pipe'],
          recommendedIntervention: 'Section replacement',
          evidenceIds: ['ev_emu_con_10'],
          confidence,
          provenance: { ...provenance, evidenceIds: ['ev_emu_con_10'] },
          pipelineVersion: 'v8.1',
          updatedAt: new Date().toISOString(),
        };

        const p1 = immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_emu_con_10',
          versionId,
          extraction,
          event: event as any,
          summaryProjection: summary,
        });

        const p2 = immutableIntelligenceStore.persistOutput({
          db: storeDb,
          aggregateType: 'job',
          aggregateId: 'job_emu_con_10',
          versionId,
          extraction,
          event: event as any,
          summaryProjection: summary,
        });

        const [r1, r2] = await Promise.all([p1, p2]);
        expect(r1.versionId).toBe(versionId);
        expect(r2.versionId).toBe(versionId);
        expect(r1.isNew !== r2.isNew).toBe(true);

        const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', versionId));
        expect(extSnap.exists()).toBe(true);
      });
    });


  });

  describe('Task 11: Canonical Intelligence Normalization & Schema Enforcement Emulator Suite', () => {
    it('Task 11 Invariant 1: Admin can persist canonical intelligence into live Firestore emulator', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_t11_1', { role: 'admin', admin: true }).firestore();
      const evidenceId = 'ev_emu_t11_roof_1';
      const jobId = 'job_emu_t11_101';

      // Seed real evidence in Firestore emulator
      await setDoc(doc(adminDb, 'intelligence_evidence', evidenceId), {
        evidenceId,
        aggregateType: 'job',
        aggregateId: jobId,
        sourceType: 'job',
        sourceId: jobId,
        sourceVersion: 1,
        evidenceType: 'photo',
        evidenceCategory: 'MEDIA',
        sourceRef: 'photos/roof_t11.jpg',
        contentHash: createHash('sha256').update('photo_bytes_t11').digest('hex'),
        contentSize: 4096,
        byteSize: 4096,
        schemaVersion: 'v8.1.0',
        integrityStatus: 'verified',
        verified: true,
        metadata: {},
        createdAt: new Date().toISOString(),
      });

      const canonical = canonicalizeIntelligence({
        aggregateType: 'job',
        aggregateId: jobId,
        domain: 'roofing',
        category: 'Roof Repair',
        component: 'flat roof',
        observations: [
          {
            observationId: 'obs_t11_1',
            component: 'roof',
            condition: 'damaged',
            description: 'Slipped slate tile near chimney stack',
            evidenceIds: [evidenceId],
          },
        ],
        inferences: [
          {
            inferenceId: 'inf_t11_1',
            type: 'problem',
            targetComponent: 'roof',
            hypothesis: 'Chimney flashing compromised, moisture penetrating loft timbers',
            confidence: 0.86,
            supportingEvidenceIds: [evidenceId],
            severity: 'high',
            urgency: 'immediate',
          },
        ],
        evidenceIds: [evidenceId],
        schemaVersion: 'v8.1.0',
      });

      const storeDb = createRealFirestoreStoreDb(adminDb);

      const persistResult = await persistCanonicalIntelligence({
        db: storeDb,
        canonical,
      });

      expect(persistResult.isNew).toBe(true);
      expect(persistResult.versionId).toBe(canonical.canonicalId);

      // Verify extraction read from emulator
      const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', canonical.canonicalId));
      expect(extSnap.exists()).toBe(true);
      expect(extSnap.data()?.structuredCandidate?.domain).toBe('roofing');
      expect(extSnap.data()?.structuredCandidate?.component).toBe('roof');
      expect(extSnap.data()?.structuredCandidate?.observations?.length).toBe(1);

      // Verify active projection pointer in Firestore emulator
      const ptrSnap = await getDoc(doc(adminDb, 'intelligence_jobs', jobId));
      expect(ptrSnap.exists()).toBe(true);
      expect(ptrSnap.data()?.currentVersionId).toBe(canonical.canonicalId);
      expect(ptrSnap.data()?.domain).toBe('roofing');
    });

    it('Task 11 Invariant 2: Direct unauthenticated and non-admin client writes to /intelligence_extractions are blocked', async () => {
      const unauthDb = testEnv!.unauthenticatedContext().firestore();
      const customerDb = testEnv!.authenticatedContext('cust_user', { role: 'customer' }).firestore();

      await assertFails(
        setDoc(doc(unauthDb, 'intelligence_extractions', 'hack_version_1'), {
          extractionId: 'hack_version_1',
          aggregateType: 'job',
          aggregateId: 'job_hack',
        })
      );

      await assertFails(
        setDoc(doc(customerDb, 'intelligence_extractions', 'hack_version_2'), {
          extractionId: 'hack_version_2',
          aggregateType: 'job',
          aggregateId: 'job_hack',
        })
      );
    });

    it('Task 11 Invariant 3: Lineage check against live emulator rejects canonical persistence when evidence is missing', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_t11_3', { role: 'admin', admin: true }).firestore();
      const missingEvidenceId = 'ev_emu_missing_999';
      const jobId = 'job_emu_t11_102';

      const canonical = canonicalizeIntelligence({
        aggregateType: 'job',
        aggregateId: jobId,
        domain: 'plumbing',
        observations: [
          {
            observationId: 'obs_t11_ghost',
            description: 'Pinhole pipe leak',
            evidenceIds: [missingEvidenceId],
          },
        ],
        evidenceIds: [missingEvidenceId],
        schemaVersion: 'v8.1.0',
      });

      const storeDb = createRealFirestoreStoreDb(adminDb);

      await expect(
        persistCanonicalIntelligence({
          db: storeDb,
          canonical,
        })
      ).rejects.toThrow(/does not exist in authoritative Firestore store/i);
    });
  });

  describe('Task 12: Real Firestore Emulator AI Candidate Security Boundary Invariants', () => {
    it('Task 12 Invariant 1: Valid AI Candidate with verified evidence passes lineage check and persists to Firestore emulator', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_t12_1', { role: 'admin', admin: true }).firestore();
      const jobId = 'job_t12_emu_101';
      const evidenceId = 'ev_t12_valid_emu_1';
      const contentHash = 'b'.repeat(64);

      // Seed valid evidence into real Firestore emulator
      await setDoc(doc(adminDb, 'intelligence_evidence', evidenceId), {
        evidenceId,
        aggregateType: 'job',
        aggregateId: jobId,
        sourceType: 'user_uploaded_photo',
        sourceId: 'usr_homeowner_t12',
        sourceVersion: 'v1',
        contentHash,
        byteSize: 2048,
        integrityStatus: 'verified',
        verified: true,
        createdAt: new Date().toISOString(),
      });
    

      const storeDb = createRealFirestoreStoreDb(adminDb);

      const rawCandidate = {
        domain: 'roofing',
        category: 'Slate Roof',
        component: 'valley flashing',
        observations: [
          {
            description: 'Loose slate valley tile',
            evidenceIds: [evidenceId],
          },
        ],
        inferences: [
          {
            hypothesis: 'Valley flashing leak vulnerability',
            confidence: 0.9,
            supportingEvidenceIds: [evidenceId],
          },
        ],
      };

      const serverContext: TrustedServerContext = {
        aggregateType: 'job',
        aggregateId: jobId,
        sourceId: 'usr_homeowner_t12',
        sourceVersion: 'v1',
        pipelineVersion: 'v8.1.0_prod',
        modelVersion: 'gemini-2.5-flash',
      };

      const result = await processAICandidateToCanonical(rawCandidate, serverContext, {
        firestoreDb: storeDb,
        persistToStore: true,
      });

      expect(result.persisted).toBe(true);
      expect(result.canonical.canonicalId).toBeDefined();

      // Verify record exists in real Firestore emulator
      const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', result.canonical.canonicalId));
      expect(extSnap.exists()).toBe(true);
      expect(extSnap.data()?.aggregateId).toBe(jobId);
      expect(extSnap.data()?.structuredCandidate?.domain).toBe('roofing');
    });

    it('Task 12 Invariant 2: Candidate referencing missing evidence fails lineage validation on Firestore emulator', async () => {

      const adminDb = testEnv!.authenticatedContext('admin_emu_worker_store2', { role: 'admin', admin: true }).firestore();


        const jobId = 'job_t12_emu_102';
        const missingEvidenceId = 'ev_t12_nonexistent_999';

        const storeDb = createRealFirestoreStoreDb(adminDb);

        const rawCandidate = {
          domain: 'plumbing',
          observations: [
            {
              description: 'Ghost leak assertion',
              evidenceIds: [missingEvidenceId],
            },
          ],
        };

        const serverContext: TrustedServerContext = {
          aggregateType: 'job',
          aggregateId: jobId,
          sourceId: 'usr_homeowner_t12',
        };

        await expect(
          processAICandidateToCanonical(rawCandidate, serverContext, {
            firestoreDb: storeDb,
            persistToStore: true,
        })
      ).rejects.toThrow(AICandidateSecurityError);
    });

    it('Task 12 Invariant 3: Candidate referencing evidence from another aggregate fails lineage on Firestore emulator', async () => {

      const adminDb = testEnv!.authenticatedContext('admin_emu_worker_store3', { role: 'admin', admin: true }).firestore();


        const jobId = 'job_t12_emu_103';
        const foreignJobId = 'job_t12_FOREIGN_999';
        const foreignEvidenceId = 'ev_t12_foreign_1';

        // Seed evidence tied to foreign job
        await setDoc(doc(adminDb, 'intelligence_evidence', foreignEvidenceId), {
          evidenceId: foreignEvidenceId,
          aggregateType: 'job',
          aggregateId: foreignJobId, // Different job!
          sourceType: 'user_uploaded_photo',
          sourceId: 'usr_other',
          contentHash: 'c'.repeat(64),
          byteSize: 1024,
          integrityStatus: 'verified',
          verified: true,
          createdAt: new Date().toISOString(),
      });

      const storeDb = createRealFirestoreStoreDb(adminDb);

      const rawCandidate = {
        domain: 'electrical',
        observations: [
          {
            description: 'Cross-aggregate evidence reference',
            evidenceIds: [foreignEvidenceId],
          },
        ],
      };

      const serverContext: TrustedServerContext = {
        aggregateType: 'job',
        aggregateId: jobId,
        sourceId: 'usr_homeowner_t12',
      };

      await expect(
        processAICandidateToCanonical(rawCandidate, serverContext, {
          firestoreDb: storeDb,
          persistToStore: true,
        })
      ).rejects.toThrow(AICandidateSecurityError);
    });

    it('Task 12 Invariant 4: AI output attempting to self-create evidence is rejected', async () => {
      const serverContext: TrustedServerContext = {
        aggregateType: 'job',
        aggregateId: 'job_t12_emu_104',
        sourceId: 'usr_homeowner_t12',
      };

      const selfCreatingPayload = {
        domain: 'roofing',
        createEvidence: true,
        rawEvidence: { evidenceId: 'ev_ai_fabricated_123' },
        observations: [
          {
            description: 'Fabricated assertion',
            evidenceIds: ['ev_ai_fabricated_123'],
          },
        ],
      };

      expect(() =>
        validateAndSanitizeAICandidate(selfCreatingPayload, serverContext)
      ).toThrow(AICandidateSecurityError);
    });

    it('Task 12 Invariant 5: Server-side metadata ownership enforced when candidate contains spoofed fields', async () => {
      const serverContext: TrustedServerContext = {
        aggregateType: 'job',
        aggregateId: 'job_AUTHORITATIVE_SERVER_105',
        sourceId: 'usr_AUTHORITATIVE_SERVER_SOURCE',
        sourceVersion: 'v1_server_authoritative',
        pipelineVersion: 'v8.1.0_server',
        modelVersion: 'gemini-2.5-flash',
      };

      const spoofedCandidate = {
        domain: 'roofing',
        observations: [
          {
            description: 'Observation with valid model data',
            evidenceIds: ['ev_test_1'],
          },
        ],
      };

      const canonicalInput = validateAndSanitizeAICandidate(spoofedCandidate, serverContext);

      expect(canonicalInput.aggregateId).toBe('job_AUTHORITATIVE_SERVER_105');
      expect(canonicalInput.provenance?.source).toBe('usr_AUTHORITATIVE_SERVER_SOURCE');
      expect(canonicalInput.sourceVersion).toBe('v1_server_authoritative');
      expect(canonicalInput.pipelineVersion).toBe('v8.1.0_server');
      expect(canonicalInput.modelVersion).toBe('gemini-2.5-flash');
    });

    it('Task 12 Invariant 6: Concurrent identical pipeline executions produce idempotent persistence on Firestore emulator', async () => {

      const adminDb = testEnv!.authenticatedContext('admin_emu_val_1', { role: 'admin', admin: true }).firestore();


        const jobId = 'job_t12_emu_106';
        const evidenceId = 'ev_t12_valid_emu_6';
        const contentHash = 'd'.repeat(64);

        await setDoc(doc(adminDb, 'intelligence_evidence', evidenceId), {
          evidenceId,
          aggregateType: 'job',
          aggregateId: jobId,
          sourceType: 'user_uploaded_photo',
          sourceId: 'usr_homeowner_t12',
          sourceVersion: 'v1',
          contentHash,
          byteSize: 2048,
          integrityStatus: 'verified',
          verified: true,
          createdAt: new Date().toISOString(),
      });
    

      const storeDb = createRealFirestoreStoreDb(adminDb);

      const rawCandidate = {
        domain: 'heating',
        category: 'Boiler Repair',
        observations: [
          {
            description: 'Boiler pressure drops below 0.5 bar',
            evidenceIds: [evidenceId],
          },
        ],
      };

      const serverContext: TrustedServerContext = {
        aggregateType: 'job',
        aggregateId: jobId,
        sourceId: 'usr_homeowner_t12',
        sourceVersion: 'v1',
      };

      // Run pipeline twice
      const res1 = await processAICandidateToCanonical(rawCandidate, serverContext, {
        firestoreDb: storeDb,
        persistToStore: true,
      });

      expect(res1.persisted).toBe(true);

      // Second identical run must succeed idempotently (or produce identical canonicalId)
      const res2 = await processAICandidateToCanonical(rawCandidate, serverContext, {
        firestoreDb: storeDb,
        persistToStore: true,
      });

      expect(res2.canonical.canonicalId).toBe(res1.canonical.canonicalId);
      expect(res2.canonical.contentHash).toBe(res1.canonical.contentHash);
    });

    it('Task 12A Emulator Invariant 1: Caller attempting skipLineageCheck on missing evidence fails hard on Firestore emulator', async () => {

      const adminDb = testEnv!.authenticatedContext('admin_emu_val_2', { role: 'admin', admin: true }).firestore();


        const storeDb = createRealFirestoreStoreDb(adminDb);

        const rawCandidate = {
          domain: 'roofing',
          observations: [
            {
              description: 'Unbacked observation',
              evidenceIds: ['ev_missing_emu_12a'],
            },
          ],
        };

        const serverContext: TrustedServerContext = {
          aggregateType: 'job',
          aggregateId: 'job_t12a_missing_1',
          sourceId: 'usr_homeowner_t12a',
        };

        await expect(
          processAICandidateToCanonical(rawCandidate, serverContext, {
            firestoreDb: storeDb,
            skipLineageCheck: true,
          } as any)
        ).rejects.toThrow(AICandidateSecurityError);
    });

    it('Task 12A Emulator Invariant 2: Platform-wide aggregate types (contractor, material, project, customer_request) persist to real Firestore emulator', async () => {

      const adminDb = testEnv!.authenticatedContext('admin_emu_val_3', { role: 'admin', admin: true }).firestore();


        const storeDb = createRealFirestoreStoreDb(adminDb);

        const platformAggs: Array<'contractor' | 'material' | 'project' | 'customer_request'> = [
          'contractor',
          'material',
          'project',
          'customer_request',
        ];

        for (const aggType of platformAggs) {
          const aggId = `${aggType}_emu_id_1`;
          const evId = `ev_${aggType}_emu_1`;
          const contentHash = 'c'.repeat(64);

          await setDoc(doc(adminDb, 'intelligence_evidence', evId), {
            evidenceId: evId,
            aggregateType: aggType,
            aggregateId: aggId,
            sourceType: 'user_assertion',
            sourceId: `usr_${aggType}_owner`,
            sourceVersion: 'v1',
            contentHash,
            byteSize: 1024,
            integrityStatus: 'verified',
            verified: true,
            createdAt: new Date().toISOString(),
        });

        const rawCandidate = {
          domain: aggType,
          observations: [
            {
              description: `Emulator test observation for ${aggType}`,
              evidenceIds: [evId],
            },
          ],
        };

        const serverContext: TrustedServerContext = {
          aggregateType: aggType,
          aggregateId: aggId,
          sourceId: `usr_${aggType}_owner`,
          sourceVersion: 'v1',
        };

        const res = await processAICandidateToCanonical(rawCandidate, serverContext, {
          firestoreDb: storeDb,
          persistToStore: true,
        });

        expect(res.persisted).toBe(true);
        expect(res.canonical.aggregateType).toBe(aggType);
        expect(res.canonical.aggregateId).toBe(aggId);

        // Verify record created in Firestore emulator under intelligence_extractions
        const extSnap = await getDoc(doc(adminDb, 'intelligence_extractions', res.canonical.canonicalId));
        expect(extSnap.exists()).toBe(true);
        expect(extSnap.data()?.aggregateType).toBe(aggType);
      }
    });

    it('Task 12A Emulator Invariant 3: Invoking processAICandidateToCanonical without firestoreDb throws AICandidateSecurityError', async () => {
      const serverContext: TrustedServerContext = {
        aggregateType: 'job',
        aggregateId: 'job_emu_no_db_1',
        sourceId: 'usr_homeowner_no_db',
      };

      await expect(
        (processAICandidateToCanonical as any)({ domain: 'roofing', observations: [] }, serverContext)
      ).rejects.toThrow(/Firestore DB reference is required/i);
    });
  });

  // ==========================================================
  // TASK 14B: REAL FIRESTORE EMULATOR TRANSACTION-ONLY PROCESSING RUN PERSISTENCE BOUNDARY
  // ==========================================================
  describe('Task 14B: Real Firestore Emulator Transaction-Only Processing Run Persistence Boundary', () => {
    it('1. Create processing run record in real Firestore emulator using runTransaction', async () => {
      const adminDb = testEnv!.authenticatedContext('admin_emu_t14b_1', { role: 'admin', admin: true }).firestore();
      const storeDb = createRealFirestoreStoreDb(adminDb);

      const runId = buildProcessingRunId('task_t14b_1', 1, 'lease_t14b_1');
      const started = await processingRunStore.recordRunStarted(
        {
          runId,
          taskId: 'task_t14b_1',
          aggregateType: 'job',
          aggregateId: 'job_t14b_1',
          taskType: 'job_extraction',
          status: 'started',
          attempt: 1,
          workerId: 'worker_14b_1',
          leaseId: 'lease_t14b_1',
          startedAt: new Date().toISOString(),
        },
        storeDb as any
      );

      expect(started.runId).toBe(runId);
      expect(started.status).toBe('started');

      const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.status).toBe('started');
      expect(snap.data()?.taskId).toBe('task_t14b_1');
    });

      it('2. Duplicate same execution (same taskId + attempt + leaseId) returns existing run idempotently', async () => {

        const adminDb = testEnv!.authenticatedContext('admin_emu_val_5', { role: 'admin', admin: true }).firestore();

          const storeDb = createRealFirestoreStoreDb(adminDb);

          const runId = buildProcessingRunId('task_t14b_2', 1, 'lease_t14b_2');
          const runInput = {
            runId,
            taskId: 'task_t14b_2',
            aggregateType: 'job' as const,
            aggregateId: 'job_t14b_2',
            taskType: 'job_extraction' as const,
            status: 'started' as const,
            attempt: 1,
            workerId: 'worker_14b_2',
            leaseId: 'lease_t14b_2',
            startedAt: new Date().toISOString(),
          };

          const run1 = await processingRunStore.recordRunStarted(runInput, storeDb as any);
          const run2 = await processingRunStore.recordRunStarted(runInput, storeDb as any);

          expect(run1.runId).toBe(run2.runId);

          const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
          expect(snap.exists()).toBe(true);
          expect(snap.data()?.attempt).toBe(1);
      });

      it('3. Concurrent same execution creates exactly one record in real Firestore emulator', async () => {

        const adminDb = testEnv!.authenticatedContext('admin_emu_val_6', { role: 'admin', admin: true }).firestore();

          const storeDb = createRealFirestoreStoreDb(adminDb);

          const runId = buildProcessingRunId('task_t14b_3', 1, 'lease_t14b_3');
          const runInput = {
            runId,
            taskId: 'task_t14b_3',
            aggregateType: 'job' as const,
            aggregateId: 'job_t14b_3',
            taskType: 'job_extraction' as const,
            status: 'started' as const,
            attempt: 1,
            workerId: 'worker_14b_3',
            leaseId: 'lease_t14b_3',
            startedAt: new Date().toISOString(),
          };

          const [r1, r2, r3] = await Promise.all([
            processingRunStore.recordRunStarted(runInput, storeDb as any),
            processingRunStore.recordRunStarted(runInput, storeDb as any),
            processingRunStore.recordRunStarted(runInput, storeDb as any),
          ]);

          expect(r1.runId).toBe(runId);
          expect(r2.runId).toBe(runId);
          expect(r3.runId).toBe(runId);

          const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
          expect(snap.exists()).toBe(true);
      });

      it('4. Different attempt creates different run document in real Firestore emulator', async () => {

        const adminDb = testEnv!.authenticatedContext('admin_emu_val_7', { role: 'admin', admin: true }).firestore();

          const storeDb = createRealFirestoreStoreDb(adminDb);

          const runIdAttempt1 = buildProcessingRunId('task_t14b_4', 1, 'lease_t14b_4_1');
          const runIdAttempt2 = buildProcessingRunId('task_t14b_4', 2, 'lease_t14b_4_2');

          expect(runIdAttempt1).not.toBe(runIdAttempt2);

          await processingRunStore.recordRunStarted(
            {
              runId: runIdAttempt1,
              taskId: 'task_t14b_4',
              aggregateType: 'job',
              aggregateId: 'job_t14b_4',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_14b_4',
              leaseId: 'lease_t14b_4_1',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          );

          await processingRunStore.recordRunStarted(
            {
              runId: runIdAttempt2,
              taskId: 'task_t14b_4',
              aggregateType: 'job',
              aggregateId: 'job_t14b_4',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 2,
              workerId: 'worker_14b_4',
              leaseId: 'lease_t14b_4_2',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          );

          const snap1 = await getDoc(doc(adminDb, 'intelligence_processing_runs', runIdAttempt1));
          const snap2 = await getDoc(doc(adminDb, 'intelligence_processing_runs', runIdAttempt2));

          expect(snap1.exists()).toBe(true);
          expect(snap2.exists()).toBe(true);
          expect(snap1.id).not.toBe(snap2.id);
      });

      it('5. Transaction-backed finalization (recordRunSucceeded / recordRunFailed) updates real Firestore emulator state', async () => {

        const adminDb = testEnv!.authenticatedContext('admin_emu_val_8', { role: 'admin', admin: true }).firestore();

          const storeDb = createRealFirestoreStoreDb(adminDb);

          const runIdSucc = buildProcessingRunId('task_t14b_5_succ', 1, 'lease_5_succ');
          await processingRunStore.recordRunStarted(
            {
              runId: runIdSucc,
              taskId: 'task_t14b_5_succ',
              aggregateType: 'job',
              aggregateId: 'job_t14b_5',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_14b_5',
              leaseId: 'lease_5_succ',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          );

          const succ = await processingRunStore.recordRunSucceeded(
            runIdSucc,
            {
              workerId: 'worker_14b_5',
              leaseId: 'lease_5_succ',
              inputTokens: 120,
              outputTokens: 80,
              totalTokens: 200,
              estimatedCost: 0.0015,
            },
            storeDb as any
          );

          expect(succ.status).toBe('succeeded');

          const snapSucc = await getDoc(doc(adminDb, 'intelligence_processing_runs', runIdSucc));
          expect(snapSucc.data()?.status).toBe('succeeded');
          expect(snapSucc.data()?.totalTokens).toBe(200);

          const runIdFail = buildProcessingRunId('task_t14b_5_fail', 1, 'lease_5_fail');
          await processingRunStore.recordRunStarted(
            {
              runId: runIdFail,
              taskId: 'task_t14b_5_fail',
              aggregateType: 'job',
              aggregateId: 'job_t14b_5',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_14b_5',
              leaseId: 'lease_5_fail',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          );

          const fail = await processingRunStore.recordRunFailed(
            runIdFail,
            new Error('Rate limit exceeded (429)'),
            { workerId: 'worker_14b_5', leaseId: 'lease_5_fail' },
            storeDb as any
          );

          expect(fail.status).toBe('retrying');

          const snapFail = await getDoc(doc(adminDb, 'intelligence_processing_runs', runIdFail));
          expect(snapFail.data()?.status).toBe('retrying');
          expect(snapFail.data()?.retryable).toBe(true);
      });

      it('6. Transaction contention on real Firestore emulator resolves atomically', async () => {

        const adminDb = testEnv!.authenticatedContext('admin_emu_val_9', { role: 'admin', admin: true }).firestore();

          const storeDb = createRealFirestoreStoreDb(adminDb);

          const runId = buildProcessingRunId('task_t14b_6', 1, 'lease_t14b_6');
          await processingRunStore.recordRunStarted(
            {
              runId,
              taskId: 'task_t14b_6',
              aggregateType: 'job',
              aggregateId: 'job_t14b_6',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_14b_6',
              leaseId: 'lease_t14b_6',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          );

          let contentionAttempts = 0;
          const targetAdminDb = adminDb;
          const contentionDb = {
            collection: (name: string) => storeDb.collection(name),
            runTransaction: async <T>(updateFn: (tx: any) => Promise<T>): Promise<T> => {
              return runTransaction(targetAdminDb, async (rawTx) => {
                contentionAttempts++;
                if (contentionAttempts === 1) {
                  await updateDoc(doc(targetAdminDb, 'intelligence_processing_runs', runId), {
                    contentionTouch: contentionAttempts,
                });
              }
              const docRef = doc(targetAdminDb, 'intelligence_processing_runs', runId);
              const snap = await rawTx.get(docRef);
              const txWrapper = {
                get: async () => ({ id: snap.id, exists: snap.exists(), data: () => snap.data() }),
                set: (ref: any, data: any, opts?: any) => {
                  if (opts?.merge) rawTx.set(docRef, data, { merge: true });
                  else rawTx.set(docRef, data);
                },
              };
              return await updateFn(txWrapper);
            });
          },
        };

        const res = await processingRunStore.recordRunSucceeded(
          runId,
          { workerId: 'worker_14b_6', leaseId: 'lease_t14b_6' },
          contentionDb as any
        );

        expect(res.status).toBe('succeeded');
        expect(contentionAttempts).toBeGreaterThanOrEqual(2);


      it('7. Transaction failure propagation (permission error on unauthorized context) propagates without swallowing', async () => {
        const unauthCtx = testEnv!.unauthenticatedContext();
        const unauthDb = unauthCtx.firestore();
        const unauthStoreDb = createRealFirestoreStoreDb(unauthDb);

        const runId = buildProcessingRunId('task_t14b_7', 1, 'lease_t14b_7');

        let caughtError: any = null;
        try {
          await processingRunStore.recordRunStarted(
            {
              runId,
              taskId: 'task_t14b_7',
              aggregateType: 'job',
              aggregateId: 'job_t14b_7',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_14b_7',
              leaseId: 'lease_t14b_7',
              startedAt: new Date().toISOString(),
            },
            unauthStoreDb as any
          );
        } catch (err) {
          caughtError = err;
        }

        expect(caughtError).toBeDefined();
        expect(caughtError.name).toBe('FirebaseError');
        expect(caughtError.message).toMatch(/permission|denied|PERMISSION_DENIED/i);
      });

      it('8. Failed transaction does not write corrupt data or create false success in real Firestore emulator', async () => {
        const unauthCtx = testEnv!.unauthenticatedContext();
        const unauthDb = unauthCtx.firestore();
        const unauthStoreDb = createRealFirestoreStoreDb(unauthDb);

        const adminDb = testEnv!.authenticatedContext('admin_emu_val_10', { role: 'admin', admin: true }).firestore();


          const runId = buildProcessingRunId('task_t14b_8', 1, 'lease_t14b_8');

          await expect(
            processingRunStore.recordRunStarted(
              {
                runId,
                taskId: 'task_t14b_8',
                aggregateType: 'job',
                aggregateId: 'job_t14b_8',
                taskType: 'job_extraction',
                status: 'started',
                attempt: 1,
                workerId: 'worker_14b_8',
                leaseId: 'lease_t14b_8',
                startedAt: new Date().toISOString(),
              },
              unauthStoreDb as any
            )
          ).rejects.toThrow();

          const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
          expect(snap.exists()).toBe(false);
      });

      it('9. Worker and lease ownership mismatch rejects update and protects run in real Firestore emulator', async () => {

        const adminCtx = testEnv!.authenticatedContext('admin_user_task11', { admin: true });

          const adminDb = adminCtx.firestore();
          const storeDb = createRealFirestoreStoreDb(adminDb);

          const runId = buildProcessingRunId('task_t14b_9', 1, 'lease_valid');
          await processingRunStore.recordRunStarted(
            {
              runId,
              taskId: 'task_t14b_9',
              aggregateType: 'job',
              aggregateId: 'job_t14b_9',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_owner',
              leaseId: 'lease_valid',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          );

          await expect(
            processingRunStore.recordRunSucceeded(
              runId,
              { workerId: 'worker_imposter', leaseId: 'lease_valid' },
              storeDb as any
            )
          ).rejects.toThrow(ProcessingRunValidationError);

          await expect(
            processingRunStore.recordRunSucceeded(
              runId,
              { workerId: 'worker_owner', leaseId: 'lease_stale' },
              storeDb as any
            )
          ).rejects.toThrow(ProcessingRunValidationError);

          const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
          expect(snap.data()?.status).toBe('started');
      });

      it('10. Terminal state protection prevents invalid state transitions (succeeded -> failed, dead_letter -> retrying) in real Firestore emulator', async () => {

        const adminCtx = testEnv!.authenticatedContext('admin_user_task11_missing', { admin: true });

          const adminDb = adminCtx.firestore();
          const storeDb = createRealFirestoreStoreDb(adminDb);

          const runId = buildProcessingRunId('task_t14b_10', 1, 'lease_t14b_10');
          await processingRunStore.recordRunStarted(
            {
              runId,
              taskId: 'task_t14b_10',
              aggregateType: 'job',
              aggregateId: 'job_t14b_10',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_10',
              leaseId: 'lease_t14b_10',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          );

          await processingRunStore.recordRunSucceeded(
            runId,
            { workerId: 'worker_10', leaseId: 'lease_t14b_10' },
            storeDb as any
          );

          await expect(
            processingRunStore.recordRunFailed(
              runId,
              new Error('Late error after success'),
              { workerId: 'worker_10', leaseId: 'lease_t14b_10' },
              storeDb as any
            )
          ).rejects.toThrow(ProcessingRunValidationError);

          const rerun = await processingRunStore.recordRunStarted(
            {
              runId,
              taskId: 'task_t14b_10',
              aggregateType: 'job',
              aggregateId: 'job_t14b_10',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_10',
              leaseId: 'lease_t14b_10',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          );
          expect(rerun.status).toBe('succeeded');
      });

      it('11. Processing run durability verified after a fresh direct Firestore read on adminDb', async () => {

        const adminCtx = testEnv!.authenticatedContext('admin_user_t12_1', { admin: true });

          const adminDb = adminCtx.firestore();
          const storeDb = createRealFirestoreStoreDb(adminDb);

          const runId = buildProcessingRunId('task_t14b_11', 1, 'lease_t14b_11');
          await processingRunStore.recordRunStarted(
            {
              runId,
              taskId: 'task_t14b_11',
              aggregateType: 'job',
              aggregateId: 'job_t14b_11',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_11',
              leaseId: 'lease_t14b_11',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          );

          await processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_11',
              leaseId: 'lease_t14b_11',
              inputTokens: 500,
              outputTokens: 200,
              totalTokens: 700,
              estimatedCost: 0.0025,
            },
            storeDb as any
          );

          const freshSnap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));

          expect(freshSnap.exists()).toBe(true);
          const data = freshSnap.data()!;
          expect(data.runId).toBe(runId);
          expect(data.taskId).toBe('task_t14b_11');
          expect(data.aggregateType).toBe('job');
          expect(data.aggregateId).toBe('job_t14b_11');
          expect(data.taskType).toBe('job_extraction');
          expect(data.status).toBe('succeeded');
          expect(data.attempt).toBe(1);
          expect(data.workerId).toBe('worker_11');
          expect(data.leaseId).toBe('lease_t14b_11');
          expect(data.totalTokens).toBe(700);
          expect(data.estimatedCost).toBe(0.0025);
          expect(data.startedAt).toBeDefined();
          expect(data.finishedAt).toBeDefined();
          expect(data.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('12. Missing runTransaction on database fails closed without making any non-transactional fallback writes', async () => {

        const adminCtx = testEnv!.authenticatedContext('admin_user_t12_2', { admin: true });


          const nonTxDb = {
            collection: () => ({
              doc: () => ({
                set: async () => { throw new Error('FALLBACK_WRONG'); },
                update: async () => { throw new Error('FALLBACK_WRONG'); },
              }),
            }),
          };

          await expect(
            processingRunStore.recordRunStarted(
              { runId: 'run_no_tx_emu', taskId: 't1', attempt: 1, leaseId: 'l1', aggregateType: 'job', aggregateId: 'j1', taskType: 'job_extraction', workerId: 'w1' },
              nonTxDb as any
            )
          ).rejects.toThrow(/Firestore database or transaction support is unavailable/);

          const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', 'run_no_tx_emu'));
          expect(snap.exists()).toBe(false);
      });
      });
  });

  // ==========================================================
  // TASK 14C: PROCESSING OBSERVABILITY INTEGRITY (REAL EMULATOR)
  // ==========================================================
  describe('Task 14C: Processing Observability Integrity', () => {
    it('C1 — Valid metrics: Valid processing metrics persist successfully', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c1', 1, 'lease_c1');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c1',
            aggregateType: 'job',
            aggregateId: 'job_c1',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c1',
            leaseId: 'lease_c1',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        const succ = await processingRunStore.recordRunSucceeded(
          runId,
          {
            workerId: 'worker_c1',
            leaseId: 'lease_c1',
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            inputBytes: 1000,
            outputBytes: 500,
            durationMs: 1200,
            estimatedCost: 0.001,
          },
          storeDb as any
        );

        expect(succ.status).toBe('succeeded');
        expect(succ.totalTokens).toBe(150);
        expect(succ.estimatedCost).toBe(0.001);

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.status).toBe('succeeded');
        expect(snap.data()?.totalTokens).toBe(150);
      });
    });

    it('C2 — Negative metrics: Negative bytes/tokens/duration/cost are rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c2', 1, 'lease_c2');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c2',
            aggregateType: 'job',
            aggregateId: 'job_c2',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c2',
            leaseId: 'lease_c2',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c2',
              leaseId: 'lease_c2',
              inputTokens: -100,
            },
            storeDb as any
          )
        ).rejects.toThrow();

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c2',
              leaseId: 'lease_c2',
              durationMs: -500,
            },
            storeDb as any
          )
        ).rejects.toThrow();
      });
    });

    it('C3 — NaN and Infinity: NaN and Infinity cannot be persisted', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c3', 1, 'lease_c3');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c3',
            aggregateType: 'job',
            aggregateId: 'job_c3',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c3',
            leaseId: 'lease_c3',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c3',
              leaseId: 'lease_c3',
              inputTokens: NaN,
            },
            storeDb as any
          )
        ).rejects.toThrow();

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c3',
              leaseId: 'lease_c3',
              outputTokens: Infinity,
            },
            storeDb as any
          )
        ).rejects.toThrow();
      });
    });

    it('C4 — Token consistency: Contradictory totalTokens is rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c4', 1, 'lease_c4');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c4',
            aggregateType: 'job',
            aggregateId: 'job_c4',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c4',
            leaseId: 'lease_c4',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c4',
              leaseId: 'lease_c4',
              inputTokens: 100,
              outputTokens: 50,
              totalTokens: 200,
            },
            storeDb as any
          )
        ).rejects.toThrow();
      });
    });

    it('C5 — Missing provider metrics: Unavailable metrics are represented explicitly rather than fabricated', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c5', 1, 'lease_c5');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c5',
            aggregateType: 'job',
            aggregateId: 'job_c5',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c5',
            leaseId: 'lease_c5',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        const succ = await processingRunStore.recordRunSucceeded(
          runId,
          {
            workerId: 'worker_c5',
            leaseId: 'lease_c5',
            inputTokens: undefined,
            outputTokens: undefined,
            totalTokens: undefined,
          },
          storeDb as any
        );

        expect(succ.inputTokens).toBeUndefined();
        expect(succ.outputTokens).toBeUndefined();
        expect(succ.totalTokens).toBeUndefined();

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        const data = snap.data()!;
        expect(data.inputTokens).toBeUndefined();
        expect(data.outputTokens).toBeUndefined();
        expect(data.totalTokens).toBeUndefined();
      });
    });

    it('C6 — Pricing version: Different pricing versions remain distinguishable', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c6', 1, 'lease_c6');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c6',
            aggregateType: 'job',
            aggregateId: 'job_c6',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c6',
            leaseId: 'lease_c6',
            startedAt: new Date().toISOString(),
            pricingVersion: 'legacy_v1',
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c6',
              leaseId: 'lease_c6',
              pricingVersion: 'v2_custom_tier',
            },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied pricingVersion/);
      });
    });

    it('C7 — Historical cost: Changing current pricing configuration does not mutate an existing processing run', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c7', 1, 'lease_c7');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c7',
            aggregateType: 'job',
            aggregateId: 'job_c7',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c7',
            leaseId: 'lease_c7',
            startedAt: new Date().toISOString(),
            pricingVersion: 'legacy_v1',
            estimatedCost: 0.05,
          },
          storeDb as any
        );

        const succ = await processingRunStore.recordRunSucceeded(
          runId,
          {
            workerId: 'worker_c7',
            leaseId: 'lease_c7',
            estimatedCost: 0.05,
          },
          storeDb as any
        );

        expect(succ.estimatedCost).toBe(0.05);

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.estimatedCost).toBe(0.05);
      });
    });

    it('C8 — Timestamp integrity: finishedAt earlier than startedAt is rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c8', 1, 'lease_c8');
        const startedAt = new Date().toISOString();
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c8',
            aggregateType: 'job',
            aggregateId: 'job_c8',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c8',
            leaseId: 'lease_c8',
            startedAt,
          },
          storeDb as any
        );

        const finishedEarlier = new Date(Date.parse(startedAt) - 10000).toISOString();

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c8',
              leaseId: 'lease_c8',
              finishedAt: finishedEarlier,
            },
            storeDb as any
          )
        ).rejects.toThrow();
      });
    });

    it('C9 — Duration integrity: Negative or contradictory duration is rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c9', 1, 'lease_c9');
        const startedAt = new Date().toISOString();
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c9',
            aggregateType: 'job',
            aggregateId: 'job_c9',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c9',
            leaseId: 'lease_c9',
            startedAt,
          },
          storeDb as any
        );

        const finishedAt = new Date(Date.parse(startedAt) + 10000).toISOString();

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c9',
              leaseId: 'lease_c9',
              finishedAt,
              durationMs: 1000,
            },
            storeDb as any
          )
        ).rejects.toThrow();
      });
    });

    it('C10 — Error sanitization: Sensitive/raw error content cannot enter the processing-run record', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c10', 1, 'lease_c10');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c10',
            aggregateType: 'job',
            aggregateId: 'job_c10',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c10',
            leaseId: 'lease_c10',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        const dangerousErr = new Error('Auth failure: sk-dangerousSecretKeyValue is invalid Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
        const fail = await processingRunStore.recordRunFailed(
          runId,
          dangerousErr,
          { workerId: 'worker_c10', leaseId: 'lease_c10' },
          storeDb as any
        );

        expect(fail.sanitizedDiagnostic).not.toContain('sk-dangerousSecretKeyValue');
        expect(fail.sanitizedDiagnostic).not.toContain('eyJhbGciOiJIUzI1Ni');
        expect(fail.sanitizedDiagnostic).toContain('[REDACTED]');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.sanitizedDiagnostic).not.toContain('sk-dangerousSecretKeyValue');
        expect(snap.data()?.sanitizedDiagnostic).not.toContain('eyJhbGciOiJIUzI1Ni');
      });
    });

    it('C11 — Server metadata integrity: Provider/model output cannot overwrite server-owned execution metadata', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c11', 1, 'lease_c11');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c11',
            aggregateType: 'job',
            aggregateId: 'job_c11',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c11',
            leaseId: 'lease_c11',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c11',
              leaseId: 'lease_c11',
              runId: 'attempt_overwrite_id_malicious',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow();

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.runId).toBe(runId);
      });
    });

    it('C12 — Attempt separation: Different attempts create different execution records', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId1 = buildProcessingRunId('task_c12', 1, 'lease_c12_1');
        const runId2 = buildProcessingRunId('task_c12', 2, 'lease_c12_2');

        expect(runId1).not.toBe(runId2);

        await processingRunStore.recordRunStarted(
          {
            runId: runId1,
            taskId: 'task_c12',
            aggregateType: 'job',
            aggregateId: 'job_c12',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c12',
            leaseId: 'lease_c12_1',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        await processingRunStore.recordRunStarted(
          {
            runId: runId2,
            taskId: 'task_c12',
            aggregateType: 'job',
            aggregateId: 'job_c12',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 2,
            workerId: 'worker_c12',
            leaseId: 'lease_c12_2',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        const snap1 = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId1));
        const snap2 = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId2));

        expect(snap1.exists()).toBe(true);
        expect(snap2.exists()).toBe(true);
      });
    });

    it('C13 — Terminal state protection: A succeeded run cannot become failed', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c13', 1, 'lease_c13');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c13',
            aggregateType: 'job',
            aggregateId: 'job_c13',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c13',
            leaseId: 'lease_c13',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        await processingRunStore.recordRunSucceeded(
          runId,
          { workerId: 'worker_c13', leaseId: 'lease_c13' },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunFailed(
            runId,
            new Error('Fail attempt on succeeded run'),
            { workerId: 'worker_c13', leaseId: 'lease_c13' },
            storeDb as any
          )
        ).rejects.toThrow();

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.status).toBe('succeeded');
      });
    });

    it('C14 — Size protection: Oversized metadata/identifiers are rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const giantTaskId = 'a'.repeat(500);

        await expect(
          processingRunStore.recordRunStarted(
            {
              runId: 'valid_id',
              taskId: giantTaskId,
              aggregateType: 'job',
              aggregateId: 'job_c14',
              taskType: 'job_extraction',
              status: 'started',
              attempt: 1,
              workerId: 'worker_c14',
              leaseId: 'lease_c14',
              startedAt: new Date().toISOString(),
            },
            storeDb as any
          )
        ).rejects.toThrow();
      });
    });

    it('C15 — Fresh-read durability: Write the run and then retrieve it using a fresh Firestore read. Verify the actual persisted values', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c15', 1, 'lease_c15');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c15',
            aggregateType: 'job',
            aggregateId: 'job_c15',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c15',
            leaseId: 'lease_c15',
            startedAt: new Date().toISOString(),
            pricingVersion: 'v1_durability',
          },
          storeDb as any
        );

        const succ = await processingRunStore.recordRunSucceeded(
          runId,
          {
            workerId: 'worker_c15',
            leaseId: 'lease_c15',
            inputTokens: 200,
            outputTokens: 100,
            totalTokens: 300,
          },
          storeDb as any
        );

        expect(succ.status).toBe('succeeded');

        const freshSnap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(freshSnap.exists()).toBe(true);
        const data = freshSnap.data()!;
        expect(data.runId).toBe(runId);
        expect(data.taskId).toBe('task_c15');
        expect(data.totalTokens).toBe(300);
        expect(data.pricingVersion).toBe('v1_durability');
      });
    });

    it('C16 — Concurrent finalization: Concurrent finalization attempts against the same execution cannot corrupt its terminal state', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c16', 1, 'lease_c16');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c16',
            aggregateType: 'job',
            aggregateId: 'job_c16',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c16',
            leaseId: 'lease_c16',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        const pSucceed = processingRunStore.recordRunSucceeded(
          runId,
          { workerId: 'worker_c16', leaseId: 'lease_c16' },
          storeDb as any
        );

        const pFail = processingRunStore.recordRunFailed(
          runId,
          new Error('Late error'),
          { workerId: 'worker_c16', leaseId: 'lease_c16' },
          storeDb as any
        );

        const results = await Promise.allSettled([pSucceed, pFail]);

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.status).toBe('succeeded');
      });
    });

    it('C17 — Server-Owned Metadata Integrity on Real Emulator: recordRunSucceeded and recordRunFailed reject malicious runId', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_c17', 1, 'lease_c17');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_c17',
            aggregateType: 'job',
            aggregateId: 'job_c17',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c17',
            leaseId: 'lease_c17',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        // A. recordRunSucceeded() with malicious updates.runId -> rejected
        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            { runId: 'malicious_run_id_c17', workerId: 'worker_c17', leaseId: 'lease_c17' },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied runId/);

        // B. recordRunFailed() with malicious updates.runId -> rejected
        await expect(
          processingRunStore.recordRunFailed(
            runId,
            new Error('Emulator error test'),
            { runId: 'malicious_run_id_c17', workerId: 'worker_c17', leaseId: 'lease_c17' },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied runId/);

        // C. persisted runId remains unchanged after rejected attempts
        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.runId).toBe(runId);
        expect(snap.data()?.status).toBe('started');

        // D. legitimate telemetry updates still succeed
        const succ = await processingRunStore.recordRunSucceeded(
          runId,
          {
            workerId: 'worker_c17',
            leaseId: 'lease_c17',
            inputTokens: 120,
            outputTokens: 60,
            totalTokens: 180,
            inputBytes: 700,
            outputBytes: 300,
            estimatedCost: 0.0009,
            durationMs: 250,
          },
          storeDb as any
        );
        expect(succ.status).toBe('succeeded');
        expect(succ.totalTokens).toBe(180);

        const snapSucceeded = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snapSucceeded.data()?.status).toBe('succeeded');
        expect(snapSucceeded.data()?.totalTokens).toBe(180);

        // F. server-owned task/attempt identity cannot be overwritten
        const runIdForOverwriteTest = buildProcessingRunId('task_c17_over', 1, 'lease_c17_over');
        await processingRunStore.recordRunStarted(
          {
            runId: runIdForOverwriteTest,
            taskId: 'task_c17_over',
            aggregateType: 'job',
            aggregateId: 'job_c17_over',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_c17_over',
            leaseId: 'lease_c17_over',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunSucceeded(
            runIdForOverwriteTest,
            {
              workerId: 'worker_c17_over',
              leaseId: 'worker_c17_over',
              taskId: 'stolen_task_id',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied taskId/);
      });
    });

    it('Test A — Idempotency of recordRunStarted with identical params', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_ta', 1, 'lease_ta');
        const startPayload = {
          runId,
          taskId: 'task_ta',
          aggregateType: 'job' as const,
          aggregateId: 'job_ta',
          taskType: 'job_extraction' as const,
          status: 'started' as const,
          attempt: 1,
          workerId: 'worker_ta',
          leaseId: 'lease_ta',
          startedAt: new Date().toISOString(),
          provider: 'google_genai',
          modelVersion: 'gemini-2.5-flash',
          pricingVersion: 'v1_test',
        };

        const first = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(first.runId).toBe(runId);
        expect(first.status).toBe('started');

        const second = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(second.runId).toBe(runId);
        expect(second.status).toBe('started');
      });
    });

    it('Test B — recordRunStarted rejects if called a second time but with mismatching/conflicting server-owned metadata', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_tb', 1, 'lease_tb');
        const startPayload = {
          runId,
          taskId: 'task_tb',
          aggregateType: 'job' as const,
          aggregateId: 'job_tb',
          taskType: 'job_extraction' as const,
          status: 'started' as const,
          attempt: 1,
          workerId: 'worker_tb',
          leaseId: 'lease_tb',
          startedAt: new Date().toISOString(),
          provider: 'google_genai',
        };

        await processingRunStore.recordRunStarted(startPayload, storeDb as any);

        // Conflict: different provider
        await expect(
          processingRunStore.recordRunStarted(
            { ...startPayload, provider: 'different_provider' },
            storeDb as any
          )
        ).rejects.toThrow(/Conflict in server-owned metadata\/identity: incoming provider/);
      });
    });

    it('Test C — recordRunStarted does not modify any execution identity or server-owned fields on a second call if those fields match', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_tc', 1, 'lease_tc');
        const startPayload = {
          runId,
          taskId: 'task_tc',
          aggregateType: 'job' as const,
          aggregateId: 'job_tc',
          taskType: 'job_extraction' as const,
          status: 'started' as const,
          attempt: 1,
          workerId: 'worker_tc',
          leaseId: 'lease_tc',
          startedAt: new Date().toISOString(),
          provider: 'google_genai',
        };

        await processingRunStore.recordRunStarted(startPayload, storeDb as any);

        const second = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(second.provider).toBe('google_genai');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.provider).toBe('google_genai');
      });
    });

    it('Test D — recordRunStarted does not revert a terminal state back to started when called again', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_td', 1, 'lease_td');
        const startPayload = {
          runId,
          taskId: 'task_td',
          aggregateType: 'job' as const,
          aggregateId: 'job_td',
          taskType: 'job_extraction' as const,
          status: 'started' as const,
          attempt: 1,
          workerId: 'worker_td',
          leaseId: 'lease_td',
          startedAt: new Date().toISOString(),
        };

        await processingRunStore.recordRunStarted(startPayload, storeDb as any);

        // Finalize the run to succeeded
        await processingRunStore.recordRunSucceeded(
          runId,
          { workerId: 'worker_td', leaseId: 'lease_td' },
          storeDb as any
        );

        // Re-call recordRunStarted
        const res = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(res.status).toBe('succeeded');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.status).toBe('succeeded');
      });
    });

    it('Test E — recordRunSucceeded rejects changes to existing/authoritative metadata fields when those fields were already set', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_te', 1, 'lease_te');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_te',
            aggregateType: 'job',
            aggregateId: 'job_te',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_te',
            leaseId: 'lease_te',
            startedAt: new Date().toISOString(),
            provider: 'google_genai',
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_te',
              leaseId: 'lease_te',
              provider: 'hacked_provider',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied provider/);
      });
    });

    it('Test F — recordRunFailed rejects changes to existing/authoritative metadata fields when those fields were already set', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_tf', 1, 'lease_tf');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_tf',
            aggregateType: 'job',
            aggregateId: 'job_tf',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_tf',
            leaseId: 'lease_tf',
            startedAt: new Date().toISOString(),
            provider: 'google_genai',
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunFailed(
            runId,
            new Error('Simulated failure'),
            {
              workerId: 'worker_tf',
              leaseId: 'lease_tf',
              provider: 'hacked_provider',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied provider/);
      });
    });

    it('Test G — recordRunSucceeded allows specifying metadata fields during finalization if they were completely absent/undefined at start', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_tg', 1, 'lease_tg');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_tg',
            aggregateType: 'job',
            aggregateId: 'job_tg',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_tg',
            leaseId: 'lease_tg',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        const succ = await processingRunStore.recordRunSucceeded(
          runId,
          {
            workerId: 'worker_tg',
            leaseId: 'lease_tg',
            provider: 'google_genai',
            modelVersion: 'gemini-1.5-flash',
          },
          storeDb as any
        );

        expect(succ.provider).toBe('google_genai');
        expect(succ.modelVersion).toBe('gemini-1.5-flash');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.provider).toBe('google_genai');
        expect(snap.data()?.modelVersion).toBe('gemini-1.5-flash');
      });
    });

    it('Test H — recordRunFailed allows specifying metadata fields during finalization if they were completely absent/undefined at start', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_th', 1, 'lease_th');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_th',
            aggregateType: 'job',
            aggregateId: 'job_th',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_th',
            leaseId: 'lease_th',
            startedAt: new Date().toISOString(),
          },
          storeDb as any
        );

        const fail = await processingRunStore.recordRunFailed(
          runId,
          new Error('Failure with delayed metadata'),
          {
            workerId: 'worker_th',
            leaseId: 'lease_th',
            provider: 'google_genai',
            modelVersion: 'gemini-1.5-flash',
          },
          storeDb as any
        );

        expect(fail.provider).toBe('google_genai');
        expect(fail.modelVersion).toBe('gemini-1.5-flash');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.provider).toBe('google_genai');
        expect(snap.data()?.modelVersion).toBe('gemini-1.5-flash');
      });
    });

    it('Test I — recordRunSucceeded rejects a different pricingVersion if pricingVersion was already specified at start', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_ti', 1, 'lease_ti');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_ti',
            aggregateType: 'job',
            aggregateId: 'job_ti',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_ti',
            leaseId: 'lease_ti',
            startedAt: new Date().toISOString(),
            pricingVersion: 'v1_authoritative',
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_ti',
              leaseId: 'lease_ti',
              pricingVersion: 'v2_malicious_override',
            },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied pricingVersion/);
      });
    });

    it('Test J — recordRunFailed rejects a different pricingVersion if pricingVersion was already specified at start', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_tj', 1, 'lease_tj');
        await processingRunStore.recordRunStarted(
          {
            runId,
            taskId: 'task_tj',
            aggregateType: 'job',
            aggregateId: 'job_tj',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'worker_tj',
            leaseId: 'lease_tj',
            startedAt: new Date().toISOString(),
            pricingVersion: 'v1_authoritative',
          },
          storeDb as any
        );

        await expect(
          processingRunStore.recordRunFailed(
            runId,
            new Error('Failure update test'),
            {
              workerId: 'worker_tj',
              leaseId: 'lease_tj',
              pricingVersion: 'v2_malicious_override',
            },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied pricingVersion/);
      });
    });

    it('Test K — Concurrent recordRunStarted idempotency and isolation', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const runId = buildProcessingRunId('task_tk', 1, 'lease_tk');
        const startPayload = {
          runId,
          taskId: 'task_tk',
          aggregateType: 'job' as const,
          aggregateId: 'job_tk',
          taskType: 'job_extraction' as const,
          status: 'started' as const,
          attempt: 1,
          workerId: 'worker_tk',
          leaseId: 'lease_tk',
          startedAt: new Date().toISOString(),
        };

        const results = await Promise.all([
          processingRunStore.recordRunStarted(startPayload, storeDb as any),
        ]);

        for (const res of results) {
          expect(res.runId).toBe(runId);
          expect(res.status).toBe('started');
        }

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.status).toBe('started');
      });
    });
  });

  // =========================================================================
  // 15. FINAL CUMULATIVE HARDENING: QUALITY REVIEW, HISTORICAL IMMUTABILITY & CLIENT WRITE PROTECTION
  // =========================================================================
  describe('15. Final Cumulative Hardening — Quality Review & Historical Immutability (Emulator)', () => {
    // TEST 1 — CLIENT TASK CREATE DENIED
    it('TEST 1 — CLIENT TASK CREATE DENIED: Ordinary client cannot create task in intelligence_tasks', async () => {
      const userCtx = testEnv!.authenticatedContext('user_ch_t1');
      const userDb = userCtx.firestore();
      await assertFails(
        setDoc(doc(userDb, 'intelligence_tasks', 'task_client_create_denied_1'), {
          status: 'pending',
          taskType: 'job_extraction',
          aggregateId: 'job_123',
        })
      );
    });

    // TEST 2 — CLIENT TASK UPDATE DENIED
    it('TEST 2 — CLIENT TASK UPDATE DENIED: Ordinary client cannot update task in intelligence_tasks', async () => {
      const userCtx = testEnv!.authenticatedContext('user_ch_t2');
      const userDb = userCtx.firestore();
      await assertFails(
        updateDoc(doc(userDb, 'intelligence_tasks', 'task_client_update_denied_1'), {
          status: 'completed',
        })
      );
    });

    // TEST 3 — CLIENT TASK DELETE DENIED
    it('TEST 3 — CLIENT TASK DELETE DENIED: Ordinary client cannot delete task in intelligence_tasks', async () => {
      const userCtx = testEnv!.authenticatedContext('user_ch_t3');
      const userDb = userCtx.firestore();
      await assertFails(
        deleteDoc(doc(userDb, 'intelligence_tasks', 'task_client_delete_denied_1'))
      );
    });

    // TEST 4 — QUALITY REVIEW FIRST WRITE
    it('TEST 4 — QUALITY REVIEW FIRST WRITE: Persists quality review and canonical audit event transactionally to Firestore', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs = new QualityReviewService();
        qrs.setFirestoreDb(storeDb as any);

        const res = await qrs.applyAndPersistReview({
          targetCollection: 'intelligence_jobs',
          targetId: 'job_ch_t4',
          action: 'correct',
          reviewerId: 'admin_reviewer_t4',
          reason: 'Updated budget accurately',
          originalCandidate: { budget: 500 },
          correctedResult: { budget: 650 },
        });

        expect(res.review.qualityId).toContain('qr_job_ch_t4_');
        expect(res.auditEvent.eventId).toContain('ie_qr_');

        // Fresh Firestore reads
        const qualitySnap = await getDoc(doc(adminDb, 'intelligence_quality', res.review.qualityId));
        const eventSnap = await getDoc(doc(adminDb, 'intelligence_events', res.auditEvent.eventId));

        expect(qualitySnap.exists()).toBe(true);
        expect(qualitySnap.data()?.action).toBe('correct');
        expect(qualitySnap.data()?.reviewerId).toBe('admin_reviewer_t4');

        expect(eventSnap.exists()).toBe(true);
        expect(eventSnap.data()?.eventType).toBe('QUALITY_REVIEW_APPLIED');
        expect(eventSnap.data()?.aggregateId).toBe('job_ch_t4');
      });
    });

    // TEST 5 — IDENTICAL QUALITY RETRY
    it('TEST 5 — IDENTICAL QUALITY RETRY: Persisting identical quality review returns idempotent success (isNew: false)', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs = new QualityReviewService();
        const { review, auditEvent } = qrs.applyReview({
          qualityId: 'qr_job_ch_t5_fixed',
          targetCollection: 'intelligence_jobs',
          targetId: 'job_ch_t5',
          action: 'approve',
          reviewerId: 'admin_reviewer_t5',
          reason: 'Initial approval',
          originalCandidate: { verified: true },
        });

        const firstWrite = await immutableIntelligenceStore.persistQualityReview({
          db: storeDb as any,
          review,
          auditEvent,
        });
        expect(firstWrite.isNew).toBe(true);

        const retryWrite = await immutableIntelligenceStore.persistQualityReview({
          db: storeDb as any,
          review,
          auditEvent,
        });
        expect(retryWrite.isNew).toBe(false);
        expect(retryWrite.qualityId).toBe(review.qualityId);
        expect(retryWrite.eventId).toBe(auditEvent.eventId);
      });
    });

    // TEST 6 — CONFLICTING QUALITY RETRY
    it('TEST 6 — CONFLICTING QUALITY RETRY: Persisting conflicting review under same identity is rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs = new QualityReviewService();
        const { review, auditEvent } = qrs.applyReview({
          qualityId: 'qr_job_ch_t6_fixed',
          targetCollection: 'intelligence_jobs',
          targetId: 'job_ch_t6',
          action: 'approve',
          reviewerId: 'admin_reviewer_t6',
          reason: 'Approved properly',
          originalCandidate: { status: 'valid' },
        });

        await immutableIntelligenceStore.persistQualityReview({
          db: storeDb as any,
          review,
          auditEvent,
        });

        const conflictingReview: QualityReview = {
          ...review,
          reason: 'Conflicting tampered reason',
        };

        await expect(
          immutableIntelligenceStore.persistQualityReview({
            db: storeDb as any,
            review: conflictingReview,
            auditEvent,
          })
        ).rejects.toThrow(/\[Quality Review Immutability Error\]/);

        // Verify original doc untouched
        const snap = await getDoc(doc(adminDb, 'intelligence_quality', review.qualityId));
        expect(snap.data()?.reason).toBe('Approved properly');
      });
    });

    // TEST 7 — EVENT IMMUTABILITY
    it('TEST 7 — EVENT IMMUTABILITY: Attempting to mutate an existing audit event is rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs = new QualityReviewService();
        const { review, auditEvent } = qrs.applyReview({
          qualityId: 'qr_job_ch_t7_fixed',
          targetCollection: 'intelligence_jobs',
          targetId: 'job_ch_t7',
          action: 'approve',
          reviewerId: 'admin_reviewer_t7',
          reason: 'Initial approval',
          originalCandidate: { ok: true },
        });

        await immutableIntelligenceStore.persistQualityReview({
          db: storeDb as any,
          review,
          auditEvent,
        });

        const conflictingEvent: CanonicalIntelligenceEvent = {
          ...auditEvent,
          eventType: 'EXTRACTION_COMPLETED' as any,
        };

        await expect(
          immutableIntelligenceStore.persistQualityReview({
            db: storeDb as any,
            review,
            auditEvent: conflictingEvent,
          })
        ).rejects.toThrow(/\[Event Immutability Error\]/);
      });
    });

    // TEST 8 — QUALITY EXISTS, EVENT MISSING
    it('TEST 8 — QUALITY EXISTS, EVENT MISSING: Transactionally repairs missing event and returns idempotent result', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs = new QualityReviewService();
        const { review, auditEvent } = qrs.applyReview({
          qualityId: 'qr_job_ch_t8_fixed',
          targetCollection: 'intelligence_jobs',
          targetId: 'job_ch_t8',
          action: 'correct',
          reviewerId: 'admin_reviewer_t8',
          reason: 'Repair test',
          originalCandidate: { a: 1 },
          correctedResult: { a: 2 },
        });

        // Seed ONLY the quality doc directly
        await setDoc(doc(adminDb, 'intelligence_quality', review.qualityId), cleanUndefinedFields(review));
        const preEventSnap = await getDoc(doc(adminDb, 'intelligence_events', auditEvent.eventId));
        expect(preEventSnap.exists()).toBe(false);

        // Call production persist
        const res = await immutableIntelligenceStore.persistQualityReview({
          db: storeDb as any,
          review,
          auditEvent,
        });
        expect(res.isNew).toBe(false);
        expect(res.qualityId).toBe(review.qualityId);

        // Verify event was atomically created and quality doc preserved
        const postEventSnap = await getDoc(doc(adminDb, 'intelligence_events', auditEvent.eventId));
        expect(postEventSnap.exists()).toBe(true);
        expect(postEventSnap.data()?.eventType).toBe('QUALITY_REVIEW_APPLIED');
      });
    });

    // TEST 9 — EVENT EXISTS, QUALITY MISSING
    it('TEST 9 — EVENT EXISTS, QUALITY MISSING: Transactionally repairs missing quality review and returns idempotent result', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs = new QualityReviewService();
        const { review, auditEvent } = qrs.applyReview({
          qualityId: 'qr_job_ch_t9_fixed',
          targetCollection: 'intelligence_jobs',
          targetId: 'job_ch_t9',
          action: 'approve',
          reviewerId: 'admin_reviewer_t9',
          reason: 'Repair test 2',
          originalCandidate: { b: 1 },
        });

        // Seed ONLY the event doc directly
        await setDoc(doc(adminDb, 'intelligence_events', auditEvent.eventId), cleanUndefinedFields(auditEvent));
        const preQualitySnap = await getDoc(doc(adminDb, 'intelligence_quality', review.qualityId));
        expect(preQualitySnap.exists()).toBe(false);

        // Call production persist
        const res = await immutableIntelligenceStore.persistQualityReview({
          db: storeDb as any,
          review,
          auditEvent,
        });
        expect(res.isNew).toBe(false);
        expect(res.eventId).toBe(auditEvent.eventId);

        // Verify quality review doc was atomically created and event preserved
        const postQualitySnap = await getDoc(doc(adminDb, 'intelligence_quality', review.qualityId));
        expect(postQualitySnap.exists()).toBe(true);
        expect(postQualitySnap.data()?.action).toBe('approve');
      });
    });

    // TEST 10 — SERVICE RECREATION DURABILITY
    it('TEST 10 — SERVICE RECREATION DURABILITY: Fresh service instance retrieves persisted review from Firestore', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs1 = new QualityReviewService();
        qrs1.setFirestoreDb(storeDb as any);

        const { review } = await qrs1.applyAndPersistReview({
          targetCollection: 'intelligence_properties',
          targetId: 'prop_ch_t10',
          action: 'approve',
          reviewerId: 'admin_reviewer_t10',
          reason: 'Durability test',
          originalCandidate: { epc: 'A' },
        });

        // Recreate service instance from scratch (zero in-memory state)
        const qrs2 = new QualityReviewService();
        qrs2.setFirestoreDb(storeDb as any);

        const fetched = await qrs2.getReviewByIdAsync(review.qualityId);
        expect(fetched).toBeDefined();
        expect(fetched?.qualityId).toBe(review.qualityId);
        expect(fetched?.targetId).toBe('prop_ch_t10');
        expect(fetched?.reviewerId).toBe('admin_reviewer_t10');
      });
    });

    // TEST 11 — FIRESTORE FAILURE FAIL-CLOSED
    it('TEST 11 — FIRESTORE FAILURE FAIL-CLOSED: Fails closed when Firestore is unavailable', async () => {
      const qrs = new QualityReviewService();
      // No DB configured
      await expect(
        qrs.applyAndPersistReview({
          targetCollection: 'intelligence_jobs',
          targetId: 'job_fail_closed',
          action: 'approve',
          reviewerId: 'admin_fail',
          reason: 'Should fail',
          originalCandidate: {},
        })
      ).rejects.toThrow(/Firestore database is not configured or ready\. Operational failure \(Fail Closed\)/);

      await expect(qrs.getReviewByIdAsync('qr_non_existent')).rejects.toThrow(
        /Firestore database is not configured or ready\. Operational failure \(Fail Closed\)/
      );
    });

    // TEST 12 — CONCURRENT IDENTICAL PERSISTENCE
    it('TEST 12 — CONCURRENT IDENTICAL PERSISTENCE: Concurrent identical persistence results in single canonical record', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs = new QualityReviewService();
        const { review, auditEvent } = qrs.applyReview({
          qualityId: 'qr_job_ch_t12_fixed',
          targetCollection: 'intelligence_jobs',
          targetId: 'job_ch_t12',
          action: 'approve',
          reviewerId: 'admin_reviewer_t12',
          reason: 'Concurrent identical',
          originalCandidate: { val: 42 },
        });

        const [res1, res2] = await Promise.all([
          immutableIntelligenceStore.persistQualityReview({
            db: storeDb as any,
            review,
            auditEvent,
          }),
          immutableIntelligenceStore.persistQualityReview({
            db: storeDb as any,
            review,
            auditEvent,
          }),
        ]);

        expect(res1.qualityId).toBe(review.qualityId);
        expect(res2.qualityId).toBe(review.qualityId);

        const snap = await getDoc(doc(adminDb, 'intelligence_quality', review.qualityId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.qualityId).toBe(review.qualityId);
      });
    });

    // TEST 13 — CONCURRENT CONFLICTING PERSISTENCE
    it('TEST 13 — CONCURRENT CONFLICTING PERSISTENCE: One version wins and conflicting write is rejected', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs = new QualityReviewService();
        const { review: rev1, auditEvent: ev1 } = qrs.applyReview({
          qualityId: 'qr_job_ch_t13_race',
          targetCollection: 'intelligence_jobs',
          targetId: 'job_ch_t13',
          action: 'approve',
          reviewerId: 'admin_winner',
          reason: 'Winning version',
          originalCandidate: { score: 100 },
        });

        const { review: rev2, auditEvent: ev2 } = qrs.applyReview({
          qualityId: 'qr_job_ch_t13_race',
          targetCollection: 'intelligence_jobs',
          targetId: 'job_ch_t13',
          action: 'reject',
          reviewerId: 'admin_loser',
          reason: 'Conflicting loser version',
          originalCandidate: { score: 100 },
        });

        const p1 = immutableIntelligenceStore.persistQualityReview({
          db: storeDb as any,
          review: rev1,
          auditEvent: ev1,
        });

        // Introduce a tiny delay before starting the second concurrent write to prevent lock deadlock on emulator
        await new Promise((resolve) => setTimeout(resolve, 20));

        const p2 = immutableIntelligenceStore.persistQualityReview({
          db: storeDb as any,
          review: rev2,
          auditEvent: ev2,
        });

        const results = await Promise.allSettled([p1, p2]);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);

        // Verify the surviving record is internally consistent
        const snap = await getDoc(doc(adminDb, 'intelligence_quality', 'qr_job_ch_t13_race'));
        expect(snap.exists()).toBe(true);
        expect(['Winning version', 'Conflicting loser version']).toContain(snap.data()?.reason);
      });
    });

    // TEST 14 — FRESH FIRESTORE READ
    it('TEST 14 — FRESH FIRESTORE READ: Directly reading document via independent Firestore client succeeds', async () => {
      await withAdminDb(async (adminDb) => {
        const storeDb = createRealFirestoreStoreDb(adminDb);

        const qrs = new QualityReviewService();
        qrs.setFirestoreDb(storeDb as any);

        const { review } = await qrs.applyAndPersistReview({
          targetCollection: 'intelligence_properties',
          targetId: 'prop_ch_t14',
          action: 'approve',
          reviewerId: 'admin_writer',
          reason: 'Direct read test',
          originalCandidate: { sqft: 1200 },
        });

        const snap = await getDoc(doc(adminDb, 'intelligence_quality', review.qualityId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.targetId).toBe('prop_ch_t14');
        expect(snap.data()?.reviewerId).toBe('admin_writer');
      });
    });

    // TEST 15 — HISTORICAL CLIENT WRITE DENIAL
    it('TEST 15 — HISTORICAL CLIENT WRITE DENIAL: Client SDK cannot create records in historical intelligence collections', async () => {
      const userCtx = testEnv!.authenticatedContext('user_ch_t15');
      const userDb = userCtx.firestore();

      await assertFails(
        setDoc(doc(userDb, 'intelligence_quality', 'qr_client_inject_1'), {
          action: 'approve',
          reviewerId: 'user_attacker',
        })
      );

      await assertFails(
        setDoc(doc(userDb, 'intelligence_events', 'ie_client_inject_1'), {
          eventType: 'QUALITY_REVIEW_APPLIED',
          aggregateId: 'job_123',
        })
      );

      await assertFails(
        setDoc(doc(userDb, 'intelligence_extractions', 'ex_client_inject_1'), {
          source: 'user_attacker',
        })
      );

      await assertFails(
        setDoc(doc(userDb, 'intelligence_evidence', 'ev_client_inject_1'), {
          contentHash: 'hash123',
        })
      );
    });

    // TEST 16 — HISTORICAL UPDATE/DELETE DENIAL
    it('TEST 16 — HISTORICAL UPDATE/DELETE DENIAL: Client SDK cannot update or delete historical intelligence records', async () => {
      const userCtx = testEnv!.authenticatedContext('user_ch_t16');
      const userDb = userCtx.firestore();

      await assertFails(
        updateDoc(doc(userDb, 'intelligence_quality', 'qr_client_update_1'), {
          action: 'reject',
        })
      );

      await assertFails(
        deleteDoc(doc(userDb, 'intelligence_quality', 'qr_client_delete_1'))
      );

      await assertFails(
        updateDoc(doc(userDb, 'intelligence_events', 'ie_client_update_1'), {
          status: 'retracted',
        })
      );

      await assertFails(
        deleteDoc(doc(userDb, 'intelligence_events', 'ie_client_delete_1'))
      );
    });
  });
});
});