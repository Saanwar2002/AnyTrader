/**
 * AnyTrader V8.1 — Task 13B: Async Intelligence Task Queue & Worker Concurrency Regression Suite
 * 
 * Verifies all required Task 13B concurrency & state machine invariants:
 * 1. Max-attempt transition respects active foreign lease:
 *    - claimTaskTransactional() called by Worker B on a task owned by Worker A with an active lease
 *      (status === 'processing', leaseExpiresAt > now) and attempts >= maxAttempts returns false
 *      WITHOUT dead-lettering or mutating Worker A's active task.
 * 2. Atomic task claiming:
 *    - Concurrent claims on a pending task permit exactly 1 worker to succeed.
 * 3. Stale lease atomic recovery:
 *    - recoverStaleTasksAsync() recovers expired leases to 'retrying' or 'dead_letter'.
 * 4. Error propagation on stale recovery:
 *    - Scan errors during stale recovery bubble up cleanly without silent swallowing.
 * 5. Missing-handler transactional ownership check:
 *    - Executing an unregistered task handler validates worker lease ownership transactionally.
 * 6. Concurrency limits & state machine immutability.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IntelligenceTaskQueue,
  taskDocumentId,
  isValidTaskStateTransition,
  OwnershipLostError,
} from '../../src/server/intelligence/intelligenceTaskQueue';
import { IntelligenceTask } from '../../src/server/intelligence/types';

describe('Task 13B: Async Intelligence Task Queue & Worker Concurrency Regression Suite', () => {
  let queue: IntelligenceTaskQueue;

  beforeEach(() => {
    queue = new IntelligenceTaskQueue(3, 300000, 'worker_task13b_test', 5);
  });

  // ==========================================================
  // 1. MAX-ATTEMPT TRANSITION & ACTIVE FOREIGN LEASE PROTECTION
  // ==========================================================
  describe('1. Active Foreign Lease & Max-Attempt Protection', () => {
    it('prevents claimTaskTransactional from dead-lettering a task owned by another worker with an active lease when attempts >= maxAttempts', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_13b_max_attempts_active_lease_1';
      const activeLeaseTime = new Date(Date.now() + 120000).toISOString();

      mockDocs.set(taskId, {
        taskId,
        status: 'processing',
        workerId: 'worker_alpha',
        leaseId: 'lease_alpha_999',
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
                  const existing = mockDocs.get(id) || {};
                  const merged = { ...existing };
                  for (const [k, v] of Object.entries(data)) {
                    if (v === undefined || (v && typeof v === 'object' && (v.constructor?.name === 'DeleteTransform' || (v as any)._methodName === 'FieldValue.delete'))) {
                      delete merged[k];
                    } else {
                      merged[k] = v;
                    }
                  }
                  mockDocs.set(id, merged);
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

      const queueBeta = new IntelligenceTaskQueue(3, 300000, 'worker_beta');
      queueBeta.setFirestoreDb(mockDb as any);

      // Worker Beta attempts to claim Worker Alpha's active task
      const claimedBeta = await queueBeta.claimTaskTransactional(taskId, 'worker_beta', 60000);

      // Worker Beta must NOT claim the task, and must NOT dead-letter Worker Alpha's running task
      expect(claimedBeta).toBe(false);

      const taskState = mockDocs.get(taskId);
      expect(taskState.status).toBe('processing');
      expect(taskState.workerId).toBe('worker_alpha');
      expect(taskState.leaseId).toBe('lease_alpha_999');
      expect(taskState.errorCode).toBeUndefined();
    });

    it('allows claiming a task when attempts >= maxAttempts ONLY IF the previous lease IS expired', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_13b_expired_lease_dead_letter_1';
      const expiredLeaseTime = new Date(Date.now() - 60000).toISOString();

      mockDocs.set(taskId, {
        taskId,
        status: 'processing',
        workerId: 'worker_old',
        leaseId: 'lease_old_111',
        leaseExpiresAt: expiredLeaseTime,
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

      const queueNew = new IntelligenceTaskQueue(3, 300000, 'worker_new');
      queueNew.setFirestoreDb(mockDb as any);

      // Worker New attempts to claim an expired lease task with exhausted attempts
      const claimedNew = await queueNew.claimTaskTransactional(taskId, 'worker_new', 60000);

      // Since lease expired AND attempts >= maxAttempts, it must transition to dead_letter and return false
      expect(claimedNew).toBe(false);

      const taskState = mockDocs.get(taskId);
      expect(taskState.status).toBe('dead_letter');
      expect(taskState.errorCode).toBe('MAX_RETRIES_EXCEEDED');
    });
  });

  // ==========================================================
  // 2. ATOMIC CLAIMING & CONCURRENCY
  // ==========================================================
  describe('2. Atomic Claiming & Worker Concurrency', () => {
    it('permits exactly one worker to claim a pending task among concurrent racers', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_13b_atomic_claim_race';
      mockDocs.set(taskId, {
        taskId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
      });

      const mockDb = {
        collection() {
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

      const qA = new IntelligenceTaskQueue();
      const qB = new IntelligenceTaskQueue();
      qA.setFirestoreDb(mockDb as any);
      qB.setFirestoreDb(mockDb as any);

      const [resA, resB] = await Promise.all([
        qA.claimTaskTransactional(taskId, 'worker_A', 60000),
        qB.claimTaskTransactional(taskId, 'worker_B', 60000),
      ]);

      const successCount = [resA, resB].filter(Boolean).length;
      expect(successCount).toBe(1);

      const taskState = mockDocs.get(taskId);
      expect(taskState.status).toBe('processing');
      expect(taskState.attempts).toBe(1);
    });

    it('enforces worker maxConcurrency limit', async () => {
      const q = new IntelligenceTaskQueue(3, 300000, 'worker_limit_test', 2);
      expect(q.getMaxConcurrency()).toBe(2);

      q.setMaxConcurrency(4);
      expect(q.getMaxConcurrency()).toBe(4);

      q.setMaxConcurrency(1);
      expect(q.getMaxConcurrency()).toBe(1);
    });
  });

  // ==========================================================
  // 3. STALE LEASE RECOVERY & ERROR PROPAGATION
  // ==========================================================
  describe('3. Stale Lease Recovery & Fail-Closed Error Propagation', () => {
    it('recovers expired processing leases to retrying or dead_letter', async () => {
      const mockDocs = new Map<string, any>();
      const pastLease = new Date(Date.now() - 30000).toISOString();

      mockDocs.set('stale_1', {
        taskId: 'stale_1',
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        leaseExpiresAt: pastLease,
        createdAt: new Date().toISOString(),
      });

      mockDocs.set('stale_exhausted_1', {
        taskId: 'stale_exhausted_1',
        status: 'processing',
        attempts: 3,
        maxAttempts: 3,
        leaseExpiresAt: pastLease,
        createdAt: new Date().toISOString(),
      });

      const mockDb = {
        collection() {
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

      const q = new IntelligenceTaskQueue();
      q.setFirestoreDb(mockDb as any);

      const recovered = await q.recoverStaleTasksAsync();
      expect(recovered.length).toBe(2);

      expect(mockDocs.get('stale_1').status).toBe('retrying');
      expect(mockDocs.get('stale_1').errorCode).toBe('STALE_LEASE_RECOVERED');

      expect(mockDocs.get('stale_exhausted_1').status).toBe('dead_letter');
      expect(mockDocs.get('stale_exhausted_1').errorCode).toBe('STALE_LEASE_EXHAUSTED');
    });

    it('propagates transaction errors during stale recovery scan without swallowing', async () => {
      const failingDb = {
        collection() {
          return {
            where() {
              return {
                get: async () => ({
                  empty: false,
                  docs: [{ id: 'stale_err_task' }],
                }),
              };
            },
            doc() {
              return {};
            },
          };
        },
        runTransaction: async () => {
          throw new Error('Firestore transaction conflict during recovery');
        },
      };

      const q = new IntelligenceTaskQueue();
      q.setFirestoreDb(failingDb as any);

      await expect(q.recoverStaleTasksAsync(0)).rejects.toThrow(
        /Firestore transaction conflict during recovery/
      );
    });
  });

  // ==========================================================
  // 4. MISSING-HANDLER TRANSACTIONAL OWNERSHIP VALIDATION
  // ==========================================================
  describe('4. Missing-Handler Transactional Ownership Check', () => {
    it('aborts missing-handler finalization if non-owner worker attempts execution', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_13b_missing_handler_race';
      const leaseExpiry = new Date(Date.now() + 60000).toISOString();

      mockDocs.set(taskId, {
        taskId,
        taskType: 'unknown_type_unregistered',
        status: 'processing',
        workerId: 'worker_legit_owner',
        leaseId: 'lease_legit_123',
        leaseExpiresAt: leaseExpiry,
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
      });

      const mockDb = {
        collection() {
          return {
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                set: async (data: any, options?: any) => {
                  const existing = mockDocs.get(id) || {};
                  mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
                },
                update: async (data: any) => {
                  const existing = mockDocs.get(id) || {};
                  mockDocs.set(id, { ...existing, ...data });
                },
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any, options?: any) => {
              const id = ref.id;
              const existing = mockDocs.get(id) || {};
              mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
            },
            update: (ref: any, data: any) => {
              const id = ref.id;
              const existing = mockDocs.get(id) || {};
              mockDocs.set(id, { ...existing, ...data });
            },
          };
          return fn(transaction);
        },
      };

      const qImposter = new IntelligenceTaskQueue();
      qImposter.setFirestoreDb(mockDb as any);

      // Imposter worker without handler attempts to execute legit worker's task
      const result = await qImposter.executeTask(taskId, 'worker_imposter');

      // Task in store MUST remain owned by worker_legit_owner and processing
      const currentTask = mockDocs.get(taskId);
      expect(currentTask.status).toBe('processing');
      expect(currentTask.workerId).toBe('worker_legit_owner');
      expect(result.status).toBe('processing');
    });
  });

  // ==========================================================
  // 5. STATE MACHINE INVARIANTS
  // ==========================================================
  describe('5. Task State Machine Transitions', () => {
    it('validates legal and illegal state transitions', () => {
      // Legal transitions
      expect(isValidTaskStateTransition('pending', 'processing')).toBe(true);
      expect(isValidTaskStateTransition('processing', 'succeeded')).toBe(true);
      expect(isValidTaskStateTransition('processing', 'retrying')).toBe(true);
      expect(isValidTaskStateTransition('processing', 'dead_letter')).toBe(true);
      expect(isValidTaskStateTransition('retrying', 'processing')).toBe(true);

      // Illegal transitions (terminal states are immutable)
      expect(isValidTaskStateTransition('succeeded', 'processing')).toBe(false);
      expect(isValidTaskStateTransition('succeeded', 'pending')).toBe(false);
      expect(isValidTaskStateTransition('dead_letter', 'processing')).toBe(false);
      expect(isValidTaskStateTransition('dead_letter', 'retrying')).toBe(false);
      expect(isValidTaskStateTransition('cancelled', 'processing')).toBe(false);
    });
  });

  // ==========================================================
  // 6. TASK 13D: FINAL LEASE-ID OWNERSHIP HARDENING
  // ==========================================================
  describe('6. Task 13D: Final Lease-ID Ownership Hardening', () => {
    it('Task 13D: SAME WORKER ID, DIFFERENT LEASE ID (Failure path) fails to finalize', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_13d_fail_mock_1';
      const nowIso = new Date().toISOString();

      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        workerId: 'worker-A',
        leaseId: 'lease-A',
        leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const mockDb = {
        collection(name: string) {
          return {
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                set: async (data: any, options?: any) => {
                  const existing = mockDocs.get(id) || {};
                  mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
                },
                update: async (data: any) => {
                  const existing = mockDocs.get(id) || {};
                  mockDocs.set(id, { ...existing, ...data });
                },
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any, options?: any) => {
              const id = ref.id;
              const existing = mockDocs.get(id) || {};
              mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
            },
            update: (ref: any, data: any) => {
              const id = ref.id;
              const existing = mockDocs.get(id) || {};
              mockDocs.set(id, { ...existing, ...data });
            },
          };
          return fn(transaction);
        },
      };

      const queueA = new IntelligenceTaskQueue(3, 300000, 'worker-A');
      queueA.setFirestoreDb(mockDb as any);

      let handlerReleasePromiseResolve: any;
      const handlerReleasePromise = new Promise((resolve) => {
        handlerReleasePromiseResolve = resolve;
      });

      queueA.registerHandler('job_extraction', async () => {
        mockDocs.set(taskId, {
          ...mockDocs.get(taskId),
          leaseId: 'lease-B',
          attempts: 2,
        });

        await handlerReleasePromise;
        throw new Error('Simulated failure');
      });

      // Start executing. Since workerId matches in queueA configuration, it initiates execution.
      const execPromise = queueA.executeTask(taskId);

      // Let handler complete (fail)
      handlerReleasePromiseResolve();

      await execPromise;

      // Assert database state is unmodified by the failure finalization (no errorCode, no lastError, status stays processing)
      const finalDoc = mockDocs.get(taskId);
      expect(finalDoc.status).toBe('processing');
      expect(finalDoc.workerId).toBe('worker-A');
      expect(finalDoc.leaseId).toBe('lease-B');
      expect(finalDoc.attempts).toBe(2);
      expect(finalDoc.errorCode).toBeUndefined();
    });

    it('Task 13D: SAME WORKER ID, DIFFERENT LEASE ID (Success path) fails to finalize', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_13d_succ_mock_1';
      const nowIso = new Date().toISOString();

      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        workerId: 'worker-A',
        leaseId: 'lease-A',
        leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const mockDb = {
        collection(name: string) {
          return {
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                set: async (data: any, options?: any) => {
                  const existing = mockDocs.get(id) || {};
                  mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
                },
                update: async (data: any) => mockDocs.set(id, { ...mockDocs.get(id), ...data }),
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any, options?: any) => {
              const id = ref.id;
              const existing = mockDocs.get(id) || {};
              mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
            },
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(transaction);
        },
      };

      const queueA = new IntelligenceTaskQueue(3, 300000, 'worker-A');
      queueA.setFirestoreDb(mockDb as any);

      let handlerReleasePromiseResolve: any;
      const handlerReleasePromise = new Promise((resolve) => {
        handlerReleasePromiseResolve = resolve;
      });

      queueA.registerHandler('job_extraction', async () => {
        // Concurrently simulate lease reclaim: leaseId becomes lease-B AFTER executeTask has resolved activeLeaseId
        mockDocs.set(taskId, {
          ...mockDocs.get(taskId),
          leaseId: 'lease-B',
          attempts: 2,
        });

        await handlerReleasePromise;
        return { success: true };
      });

      const execPromise = queueA.executeTask(taskId);

      handlerReleasePromiseResolve();

      await execPromise;

      const finalDoc = mockDocs.get(taskId);
      expect(finalDoc.status).toBe('processing');
      expect(finalDoc.workerId).toBe('worker-A');
      expect(finalDoc.leaseId).toBe('lease-B');
      expect(finalDoc.attempts).toBe(2);
    });

    it('Task 13D: DIFFERENT WORKER, DIFFERENT LEASE cannot finalize success or failure', async () => {
      const mockDocs = new Map<string, any>();
      const taskSuccessId = 'task_13d_diff_succ_mock';
      const taskFailureId = 'task_13d_diff_fail_mock';
      const nowIso = new Date().toISOString();

      mockDocs.set(taskSuccessId, {
        taskId: taskSuccessId,
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

      mockDocs.set(taskFailureId, {
        taskId: taskFailureId,
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

      const mockDb = {
        collection(name: string) {
          return {
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                set: async (data: any, options?: any) => {
                  const existing = mockDocs.get(id) || {};
                  mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
                },
                update: async (data: any) => mockDocs.set(id, { ...mockDocs.get(id), ...data }),
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any, options?: any) => {
              const id = ref.id;
              const existing = mockDocs.get(id) || {};
              mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
            },
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(transaction);
        },
      };

      const queueA = new IntelligenceTaskQueue(3, 300000, 'worker-A');
      queueA.setFirestoreDb(mockDb as any);

      let releaseSuccess: any;
      const successPromise = new Promise((resolve) => { releaseSuccess = resolve; });
      queueA.registerHandler('job_extraction', async (task) => {
        if (task.taskId === taskSuccessId) {
          await successPromise;
          return { done: true };
        } else {
          await successPromise;
          throw new Error('Failure route');
        }
      });

      const execSuccess = queueA.executeTask(taskSuccessId);
      const execFailure = queueA.executeTask(taskFailureId);

      releaseSuccess();

      await Promise.all([execSuccess, execFailure]);

      const snapSucc = mockDocs.get(taskSuccessId);
      const snapFail = mockDocs.get(taskFailureId);

      expect(snapSucc.status).toBe('processing');
      expect(snapSucc.workerId).toBe('worker-B');
      expect(snapSucc.leaseId).toBe('lease-B');

      expect(snapFail.status).toBe('processing');
      expect(snapFail.workerId).toBe('worker-B');
      expect(snapFail.leaseId).toBe('lease-B');
    });
  });

  // ==========================================================
  // 7. TASK 13E: END-TO-END STALE RECOVERY TAKEOVER & OLD-WORKER REJECTION
  // ==========================================================
  describe('7. Task 13E: End-to-End Stale Recovery Takeover & Old-Worker Rejection', () => {
    it('exercises full production recovery: Worker A lease expires -> recoverStaleTasksAsync() reclaims -> Worker B claims -> Worker A late success cannot overwrite', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_13e_stale_recovery_succ_takeover';
      const nowIso = new Date().toISOString();
      const expiredLeaseTime = new Date(Date.now() - 60000).toISOString();

      // Seed task initially pending ready for Worker A
      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const mockDb = {
        collection(name: string) {
          return {
            where(field: string, op: string, val: any) {
              return {
                get: async () => {
                  const matchingDocs = Array.from(mockDocs.entries())
                    .filter(([_, d]) => d[field] === val)
                    .map(([id, d]) => ({
                      id,
                      data: () => d,
                    }));
                  return {
                    empty: matchingDocs.length === 0,
                    docs: matchingDocs,
                  };
                },
              };
            },
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                set: async (data: any, options?: any) => {
                  const existing = mockDocs.get(id) || {};
                  mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
                },
                update: async (data: any) => mockDocs.set(id, { ...mockDocs.get(id), ...data }),
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any, options?: any) => {
              const id = ref.id;
              const existing = mockDocs.get(id) || {};
              mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
            },
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(transaction);
        },
      };

      const queueA = new IntelligenceTaskQueue(3, 50, 'worker-A');
      queueA.setFirestoreDb(mockDb as any);

      let releaseHandlerResolve: any;
      let handlerStartedResolve: any;
      const releaseHandlerPromise = new Promise((resolve) => {
        releaseHandlerResolve = resolve;
      });
      const handlerStartedPromise = new Promise((resolve) => {
        handlerStartedResolve = resolve;
      });

      queueA.registerHandler('job_extraction', async () => {
        handlerStartedResolve();
        // Wait for recovery scan and Worker B takeover before finishing
        await releaseHandlerPromise;
        return { extracted: true, result: 'late_success_from_stale_worker_A' };
      });

      // 1. Worker A begins execution on the task
      const execPromise = queueA.executeTask(taskId, 'worker-A');
      await handlerStartedPromise;

      // Allow lease to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      // 2. Recovery Worker / Queue B runs recoverStaleTasksAsync()
      const queueB = new IntelligenceTaskQueue(3, 300000, 'worker-B');
      queueB.setFirestoreDb(mockDb as any);

      const recovered = await queueB.recoverStaleTasksAsync();
      expect(recovered.some((t) => t.taskId === taskId)).toBe(true);

      // Verify the task was recovered: status is 'retrying', and workerId/leaseId are stripped
      const intermediateDoc = mockDocs.get(taskId);
      expect(intermediateDoc.status).toBe('retrying');
      expect(intermediateDoc.workerId).toBeUndefined();
      expect(intermediateDoc.leaseId).toBeUndefined();
      expect(intermediateDoc.errorCode).toBe('STALE_LEASE_RECOVERED');

      // 3. Worker B claims the task transactionally under a fresh lease
      const claimedB = await queueB.claimTaskTransactional(taskId, 'worker-B', 60000);
      expect(claimedB).toBe(true);

      const claimedDoc = mockDocs.get(taskId);
      expect(claimedDoc.status).toBe('processing');
      expect(claimedDoc.workerId).toBe('worker-B');
      expect(claimedDoc.leaseId).toBeDefined();
      expect(claimedDoc.attempts).toBe(2);

      // 4. Release Worker A's late-finishing handler
      releaseHandlerResolve();
      const resA = await execPromise;

      // Worker A must abort finalization because ownership was lost
      expect(resA.workerId).toBe('worker-B');
      expect(resA.status).toBe('processing');

      // Final authoritative state in Firestore must remain Worker B's active processing lease
      const finalDoc = mockDocs.get(taskId);
      expect(finalDoc.status).toBe('processing');
      expect(finalDoc.workerId).toBe('worker-B');
      expect(finalDoc.attempts).toBe(2);
      expect(finalDoc.completedAt).toBeUndefined();
    });

    it('exercises full production recovery: Worker A lease expires -> recoverStaleTasksAsync() reclaims -> Worker B claims -> Worker A late failure cannot overwrite', async () => {
      const mockDocs = new Map<string, any>();
      const taskId = 'task_13e_stale_recovery_fail_takeover';
      const nowIso = new Date().toISOString();
      const expiredLeaseTime = new Date(Date.now() - 60000).toISOString();

      // Seed task initially pending ready for Worker A
      mockDocs.set(taskId, {
        taskId,
        taskType: 'job_extraction',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const mockDb = {
        collection(name: string) {
          return {
            where(field: string, op: string, val: any) {
              return {
                get: async () => {
                  const matchingDocs = Array.from(mockDocs.entries())
                    .filter(([_, d]) => d[field] === val)
                    .map(([id, d]) => ({
                      id,
                      data: () => d,
                    }));
                  return {
                    empty: matchingDocs.length === 0,
                    docs: matchingDocs,
                  };
                },
              };
            },
            doc(id: string) {
              return {
                id,
                get: async () => ({ exists: mockDocs.has(id), data: () => mockDocs.get(id) }),
                set: async (data: any, options?: any) => {
                  const existing = mockDocs.get(id) || {};
                  mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
                },
                update: async (data: any) => {
                  const existing = mockDocs.get(id) || {};
                  const merged = { ...existing };
                  for (const [k, v] of Object.entries(data)) {
                    if (v === undefined || (v && typeof v === 'object' && (v.constructor?.name === 'DeleteTransform' || (v as any)._methodName === 'FieldValue.delete'))) {
                      delete merged[k];
                    } else {
                      merged[k] = v;
                    }
                  }
                  mockDocs.set(id, merged);
                },
              };
            },
          };
        },
        runTransaction: async <T>(fn: (t: any) => Promise<T>): Promise<T> => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any, options?: any) => {
              const id = ref.id;
              const existing = mockDocs.get(id) || {};
              mockDocs.set(id, options?.merge ? { ...existing, ...data } : data);
            },
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(transaction);
        },
      };

      const queueA = new IntelligenceTaskQueue(3, 50, 'worker-A');
      queueA.setFirestoreDb(mockDb as any);

      let releaseHandlerResolve: any;
      let handlerStartedResolve: any;
      const releaseHandlerPromise = new Promise((resolve) => {
        releaseHandlerResolve = resolve;
      });
      const handlerStartedPromise = new Promise((resolve) => {
        handlerStartedResolve = resolve;
      });

      queueA.registerHandler('job_extraction', async () => {
        handlerStartedResolve();
        await releaseHandlerPromise;
        throw new Error('Late failure from stale worker A');
      });

      // 1. Worker A begins execution on the task
      const execPromise = queueA.executeTask(taskId, 'worker-A');
      await handlerStartedPromise;

      // Allow lease to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      // 2. Recovery Worker / Queue B runs recoverStaleTasksAsync()
      const queueB = new IntelligenceTaskQueue(3, 300000, 'worker-B');
      queueB.setFirestoreDb(mockDb as any);

      const recovered = await queueB.recoverStaleTasksAsync();
      expect(recovered.some((t) => t.taskId === taskId)).toBe(true);

      // 3. Worker B claims the task transactionally under a fresh lease
      const claimedB = await queueB.claimTaskTransactional(taskId, 'worker-B', 60000);
      expect(claimedB).toBe(true);

      // 4. Release Worker A's late failing handler
      releaseHandlerResolve();
      const resA = await execPromise;

      // Worker A must abort finalization because ownership was lost
      expect(resA.workerId).toBe('worker-B');
      expect(resA.status).toBe('processing');

      // Final authoritative state must remain Worker B's active processing lease with no error from Worker A
      const finalDoc = mockDocs.get(taskId);
      expect(finalDoc.status).toBe('processing');
      expect(finalDoc.workerId).toBe('worker-B');
      expect(finalDoc.attempts).toBe(2);
      expect(finalDoc.lastError).toBeUndefined();
    });
  });
});
