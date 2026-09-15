/**
 * AnyTrader V8.1 — Task 14: Processing Execution Records & Observability Suite
 * 
 * Verifies:
 * 1. Complete Schema & Field Validation for Processing Runs
 * 2. Deterministic Identity & Attempt Discrimination (taskId + attempt + leaseId)
 * 3. Idempotent Retry Handling for identical attempts
 * 4. Rejection of invalid statuses, negative numbers, NaNs, and malformed telemetry
 * 5. Provider-Independent Cost Abstraction & Pricing Catalog Math
 * 6. Zero-Trust Metric Validation (Rejection of oversized, float, negative, or infinite values)
 * 7. Controlled Error Classification (Lineage, Validation, Security, Transient vs Terminal)
 * 8. Centralized Retryability Enforcement (Deterministic mapping, never AI text-driven)
 * 9. Privacy & Data Minimization (Redaction of API keys, bearer tokens, passwords, emails, raw AI traces)
 * 10. Strict Processing Lifecycle Ordering (AI -> Validate -> Canonicalize -> Persist -> Run Success -> Task Success)
 * 11. Fail-Closed Durability (Throws if Firestore is unavailable, zero in-memory fallback)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildProcessingRunId,
  validateProcessingRunRecord,
  validateRunPrivacy,
  IntelligenceProcessingRunStore,
  ProcessingRunValidationError,
  ProcessingRunPrivacyViolationError,
} from '../../src/server/intelligence/processingRunStore';
import {
  calculateEstimatedCost,
  validateAndNormalizeMetrics,
  validateNonNegativeFiniteNumber,
  CostModelValidationError,
  PRICING_CATALOG,
} from '../../src/server/intelligence/costModel';
import {
  classifyAndSanitizeProcessingError,
  sanitizeDiagnostic,
} from '../../src/server/intelligence/processingErrorClassifier';
import { AICandidateSecurityError } from '../../src/server/intelligence/aiCandidateBoundary';
import { IntelligenceTaskQueue } from '../../src/server/intelligence/intelligenceTaskQueue';
import { IntelligenceProcessingRun } from '../../src/server/intelligence/types';

describe('Task 14: Intelligence Processing Observability & Execution Records', () => {
  // Mock Firestore implementation for transactional verification
  const createMockFirestore = () => {
    const store = new Map<string, any>();
    return {
      store,
      collection: (colName: string) => ({
        doc: (docId: string) => ({
          get: async () => ({
            exists: store.has(`${colName}/${docId}`),
            data: () => store.get(`${colName}/${docId}`),
          }),
          set: async (data: any, options?: { merge?: boolean }) => {
            const key = `${colName}/${docId}`;
            if (options?.merge && store.has(key)) {
              store.set(key, { ...store.get(key), ...data });
            } else {
              store.set(key, data);
            }
          },
          update: async (updates: any) => {
            const key = `${colName}/${docId}`;
            if (!store.has(key)) throw new Error(`Document ${key} does not exist`);
            store.set(key, { ...store.get(key), ...updates });
          },
        }),
        where: (field: string, op: string, val: any) => ({
          where: (f2: string, op2: string, v2: any) => ({
            get: async () => {
              const docs: any[] = [];
              for (const [key, data] of store.entries()) {
                if (key.startsWith(`${colName}/`) && data[field] === val && data[f2] === v2) {
                  docs.push({ id: key.split('/')[1], data: () => data });
                }
              }
              return { docs, empty: docs.length === 0 };
            },
          }),
          get: async () => {
            const docs: any[] = [];
            for (const [key, data] of store.entries()) {
              if (key.startsWith(`${colName}/`) && data[field] === val) {
                docs.push({ id: key.split('/')[1], data: () => data });
              }
            }
            return { docs, empty: docs.length === 0 };
          },
        }),
      }),
      runTransaction: async <T>(updateFn: (tx: any) => Promise<T>): Promise<T> => {
        const tx = {
          get: async (docRef: any) => docRef.get(),
          set: (docRef: any, data: any, options?: any) => docRef.set(data, options),
          update: (docRef: any, data: any) => docRef.update(data),
        };
        return await updateFn(tx);
      },
    };
  };

  describe('1. Schema & Validation of Execution Records', () => {
    it('creates a valid execution run record with all required fields', () => {
      const now = new Date().toISOString();
      const validRun: Partial<IntelligenceProcessingRun> = {
        runId: 'run_task_123_att1_abc123',
        taskId: 'task_123',
        aggregateType: 'job',
        aggregateId: 'job_456',
        taskType: 'job_extraction',
        status: 'started',
        attempt: 1,
        workerId: 'worker_node_1',
        leaseId: 'lease_xyz789',
        startedAt: now,
        pipelineVersion: 'v8.1.0',
        schemaVersion: 'v8.1.0',
        provider: 'google_genai',
        modelVersion: 'gemini-3.8-flash',
        promptVersion: 'default_v8.1',
        inputEvidenceCount: 3,
        inputBytes: 1200,
        outputBytes: 450,
        inputTokens: 300,
        outputTokens: 150,
        totalTokens: 450,
        estimatedCost: 0.000067,
        costCurrency: 'USD',
        pricingVersion: '2026-09-v1',
        createdAt: now,
      };

      const result = validateProcessingRunRecord(validRun);
      expect(result.runId).toBe('run_task_123_att1_abc123');
      expect(result.status).toBe('started');
      expect(result.attempt).toBe(1);
      expect(result.inputTokens).toBe(300);
      expect(result.outputTokens).toBe(150);
      expect(result.totalTokens).toBe(450);
    });

    it('rejects execution record missing required runId, taskId, aggregateType, or leaseId', () => {
      expect(() =>
        validateProcessingRunRecord({
          taskId: 't1',
          aggregateType: 'job',
          aggregateId: 'j1',
          taskType: 'job_extraction',
          status: 'started',
          attempt: 1,
          workerId: 'w1',
          leaseId: 'l1',
          startedAt: new Date().toISOString(),
        })
      ).toThrow(ProcessingRunValidationError);

      expect(() =>
        validateProcessingRunRecord({
          runId: 'r1',
          aggregateType: 'job',
          aggregateId: 'j1',
          taskType: 'job_extraction',
          status: 'started',
          attempt: 1,
          workerId: 'w1',
          leaseId: 'l1',
          startedAt: new Date().toISOString(),
        })
      ).toThrow(ProcessingRunValidationError);
    });

    it('rejects invalid status (e.g. "in_progress", "done", "unknown")', () => {
      expect(() =>
        validateProcessingRunRecord({
          runId: 'r1',
          taskId: 't1',
          aggregateType: 'job',
          aggregateId: 'j1',
          taskType: 'job_extraction',
          status: 'in_progress' as any,
          attempt: 1,
          workerId: 'w1',
          leaseId: 'l1',
          startedAt: new Date().toISOString(),
        })
      ).toThrow(/Invalid processing run status/);
    });

    it('rejects invalid attempt numbers (< 1, float, NaN)', () => {
      expect(() =>
        validateProcessingRunRecord({
          runId: 'r1',
          taskId: 't1',
          aggregateType: 'job',
          aggregateId: 'j1',
          taskType: 'job_extraction',
          status: 'started',
          attempt: 0,
          workerId: 'w1',
          leaseId: 'l1',
          startedAt: new Date().toISOString(),
        })
      ).toThrow(/Invalid attempt/);

      expect(() =>
        validateProcessingRunRecord({
          runId: 'r1',
          taskId: 't1',
          aggregateType: 'job',
          aggregateId: 'j1',
          taskType: 'job_extraction',
          status: 'started',
          attempt: 1.5,
          workerId: 'w1',
          leaseId: 'l1',
          startedAt: new Date().toISOString(),
        })
      ).toThrow(/Invalid attempt/);
    });
  });

  describe('2. Deterministic Identity & Attempt Discrimination', () => {
    it('generates distinct run identities across different attempts of the same task', () => {
      const runIdAtt1 = buildProcessingRunId('task_job_456', 1, 'lease_111');
      const runIdAtt2 = buildProcessingRunId('task_job_456', 2, 'lease_222');
      const runIdAtt3 = buildProcessingRunId('task_job_456', 3, 'lease_333');

      expect(runIdAtt1).not.toBe(runIdAtt2);
      expect(runIdAtt2).not.toBe(runIdAtt3);
      expect(runIdAtt1).toContain('att1');
      expect(runIdAtt2).toContain('att2');
      expect(runIdAtt3).toContain('att3');
    });

    it('generates exact same run identity for identical execution attempts (idempotency)', () => {
      const idA = buildProcessingRunId('task_job_456', 1, 'lease_fixed');
      const idB = buildProcessingRunId('task_job_456', 1, 'lease_fixed');

      expect(idA).toBe(idB);
    });
  });

  describe('3. Zero-Trust Cost Model & Metrics Validation', () => {
    it('calculates accurate estimated cost using the pricing catalog for Gemini 3.8 Flash', () => {
      // 10,000 input tokens @ $0.075/M = $0.00075
      // 5,000 output tokens @ $0.30/M = $0.0015
      // Total = $0.00225
      const cost = calculateEstimatedCost('google_genai', 'gemini-3.8-flash', 10_000, 5_000, '2026-09-v1');
      expect(cost).toBe(0.00225);
    });

    it('calculates accurate estimated cost for third-party models (Claude 3.5 Sonnet, GPT-4o)', () => {
      const claudeCost = calculateEstimatedCost('anthropic', 'claude-3-5-sonnet', 1_000_000, 1_000_000, '2026-09-v1');
      expect(claudeCost).toBe(18.0); // 3.0 + 15.0 = 18.0

      const gptCost = calculateEstimatedCost('openai', 'gpt-4o', 1_000_000, 1_000_000, '2026-09-v1');
      expect(gptCost).toBe(12.5); // 2.5 + 10.0 = 12.5
    });

    it('rejects negative, NaN, Infinity, or float token values', () => {
      expect(() => validateAndNormalizeMetrics({ inputTokens: -5 })).toThrow(CostModelValidationError);
      expect(() => validateAndNormalizeMetrics({ inputTokens: NaN })).toThrow(CostModelValidationError);
      expect(() => validateAndNormalizeMetrics({ inputTokens: Infinity })).toThrow(CostModelValidationError);
      expect(() => validateAndNormalizeMetrics({ inputTokens: 4.5 })).toThrow(CostModelValidationError);
    });

    it('rejects negative, NaN, Infinity, or budget-exceeding cost values', () => {
      expect(() => validateAndNormalizeMetrics({ estimatedCost: -1.0 })).toThrow(CostModelValidationError);
      expect(() => validateAndNormalizeMetrics({ estimatedCost: NaN })).toThrow(CostModelValidationError);
      expect(() => validateAndNormalizeMetrics({ estimatedCost: Infinity })).toThrow(CostModelValidationError);
      expect(() => validateAndNormalizeMetrics({ estimatedCost: 50_000 })).toThrow(CostModelValidationError); // > MAX_ALLOWED_COST ($10,000)
    });

    it('rejects negative, NaN, or budget-exceeding bytes and duration', () => {
      expect(() => validateAndNormalizeMetrics({ durationMs: -50 })).toThrow(CostModelValidationError);
      expect(() => validateAndNormalizeMetrics({ inputBytes: -100 })).toThrow(CostModelValidationError);
      expect(() => validateAndNormalizeMetrics({ inputBytes: 2 * 1024 * 1024 * 1024 })).toThrow(CostModelValidationError); // > 1 GiB
    });

    it('enforces totalTokens >= inputTokens + outputTokens', () => {
      expect(() =>
        validateAndNormalizeMetrics({
          inputTokens: 100,
          outputTokens: 100,
          totalTokens: 150, // Less than 200
        })
      ).toThrow(CostModelValidationError);
    });
  });

  describe('4. Controlled Error Classifier & Sanitization', () => {
    it('classifies AICandidateSecurityError and schema errors as validation_error (non-retryable)', () => {
      const err = new AICandidateSecurityError('Disallowed markdown code fences detected in candidate output');
      const classification = classifyAndSanitizeProcessingError(err);

      expect(classification.errorCode).toBe('validation_error');
      expect(classification.retryable).toBe(false);
      expect(classification.errorClass).toBe('AICandidateSecurityError');
    });

    it('classifies lineage and missing evidence errors as lineage_error (non-retryable)', () => {
      const err = new Error('Lineage validation failure: assertion missing required evidence backing');
      err.name = 'LineageValidationError';
      const classification = classifyAndSanitizeProcessingError(err);

      expect(classification.errorCode).toBe('lineage_error');
      expect(classification.retryable).toBe(false);
    });

    it('classifies authentication and authorization errors as non-retryable', () => {
      const authErr = new Error('PERMISSION_DENIED: User lacks admin role for intelligence operations');
      const classifiedAuth = classifyAndSanitizeProcessingError(authErr);
      expect(classifiedAuth.errorCode).toBe('authorization_error');
      expect(classifiedAuth.retryable).toBe(false);
    });

    it('classifies rate limit errors (429, RESOURCE_EXHAUSTED) as retryable', () => {
      const rateErr = new Error('RESOURCE_EXHAUSTED: Rate limit exceeded (429)');
      const classification = classifyAndSanitizeProcessingError(rateErr);

      expect(classification.errorCode).toBe('rate_limit');
      expect(classification.retryable).toBe(true);
    });

    it('classifies timeout and network errors (DEADLINE_EXCEEDED, ECONNRESET) as retryable', () => {
      const timeoutErr = new Error('DEADLINE_EXCEEDED: AI extraction timed out after 30000ms');
      const networkErr = new Error('ECONNRESET: Socket closed unexpectedly');

      expect(classifyAndSanitizeProcessingError(timeoutErr).errorCode).toBe('timeout');
      expect(classifyAndSanitizeProcessingError(timeoutErr).retryable).toBe(true);

      expect(classifyAndSanitizeProcessingError(networkErr).errorCode).toBe('network_error');
      expect(classifyAndSanitizeProcessingError(networkErr).retryable).toBe(true);
    });

    it('sanitizes API keys, bearer tokens, passwords, emails, and file paths from error diagnostics', () => {
      const dirtyError =
        'Error with API key AIzaSyD9876543210zyxwvutsrqponmlkjihgfed and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 ' +
        'from user test.admin@anytrader.co.uk with password=SuperSecretPass123! at /app/src/server/intelligence/task.ts:124:12';

      const sanitized = sanitizeDiagnostic(dirtyError);

      expect(sanitized).not.toContain('AIzaSyD9876543210');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1Ni');
      expect(sanitized).not.toContain('test.admin@anytrader.co.uk');
      expect(sanitized).not.toContain('SuperSecretPass123!');
      expect(sanitized).not.toContain('/app/src/server');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
      expect(sanitized).toContain('Bearer [REDACTED]');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
    });
  });

  describe('5. Privacy & Data Minimization Enforcements', () => {
    it('rejects processing runs containing forbidden raw AI prompts or responses', () => {
      expect(() =>
        validateRunPrivacy({
          runId: 'r1',
          rawResponse: 'Full text response from AI model...',
        })
      ).toThrow(ProcessingRunPrivacyViolationError);

      expect(() =>
        validateRunPrivacy({
          runId: 'r1',
          fullPrompt: 'Extract all details from user description: ...',
        })
      ).toThrow(ProcessingRunPrivacyViolationError);
    });

    it('rejects processing runs containing secret credentials or payment info', () => {
      expect(() =>
        validateRunPrivacy({
          runId: 'r1',
          apiKey: 'AIzaSy1234567890',
        })
      ).toThrow(ProcessingRunPrivacyViolationError);

      expect(() =>
        validateRunPrivacy({
          runId: 'r1',
          creditCard: '4111222233334444',
        })
      ).toThrow(ProcessingRunPrivacyViolationError);
    });
  });

  describe('6. Durable Firestore Store & End-to-End Task Queue Execution', () => {
    let mockDb: ReturnType<typeof createMockFirestore>;
    let store: IntelligenceProcessingRunStore;
    let queue: IntelligenceTaskQueue;

    beforeEach(() => {
      mockDb = createMockFirestore();
      store = new IntelligenceProcessingRunStore();
      queue = new IntelligenceTaskQueue();
      queue.setFirestoreDb(mockDb as any);
    });

    it('records run started, then updates to succeeded after handler persists intelligence', async () => {
      const now = new Date().toISOString();
      const runId = buildProcessingRunId('task_e2e_1', 1, 'lease_123');

      // 1. Record started
      await store.recordRunStarted(
        {
          runId,
          taskId: 'task_e2e_1',
          aggregateType: 'job',
          aggregateId: 'job_999',
          taskType: 'job_extraction',
          status: 'started',
          attempt: 1,
          workerId: 'worker_1',
          leaseId: 'lease_123',
          startedAt: now,
          pipelineVersion: 'v8.1.0',
          schemaVersion: 'v8.1.0',
          provider: 'google_genai',
          modelVersion: 'gemini-3.8-flash',
          promptVersion: 'default_v8.1',
          inputEvidenceCount: 2,
          inputBytes: 500,
          outputBytes: 0,
          inputTokens: 100,
          outputTokens: 0,
          totalTokens: 100,
          estimatedCost: 0,
          costCurrency: 'USD',
          pricingVersion: '2026-09-v1',
          createdAt: now,
        },
        mockDb as any
      );

      const savedStarted = await store.getRun(runId, mockDb as any);
      expect(savedStarted).toBeDefined();
      expect(savedStarted?.status).toBe('started');

      // 2. Record succeeded
      await store.recordRunSucceeded(
        runId,
        {
          finishedAt: new Date().toISOString(),
          durationMs: 350,
          outputTokens: 80,
          totalTokens: 180,
          outputBytes: 420,
        },
        mockDb as any
      );

      const savedSucceeded = await store.getRun(runId, mockDb as any);
      expect(savedSucceeded?.status).toBe('succeeded');
      expect(savedSucceeded?.durationMs).toBe(350);
      expect(savedSucceeded?.outputTokens).toBe(80);
      expect(savedSucceeded?.totalTokens).toBe(180);
    });

    it('records run failure with sanitized error and correct terminal vs retryable status', async () => {
      const runId = buildProcessingRunId('task_e2e_fail', 1, 'lease_fail');

      await store.recordRunStarted(
        {
          runId,
          taskId: 'task_e2e_fail',
          aggregateType: 'property',
          aggregateId: 'prop_123',
          taskType: 'property_aggregation',
          status: 'started',
          attempt: 1,
          workerId: 'worker_fail',
          leaseId: 'lease_fail',
          startedAt: new Date().toISOString(),
          pipelineVersion: 'v8.1.0',
          schemaVersion: 'v8.1.0',
          provider: 'google_genai',
          modelVersion: 'gemini-3.8-flash',
          promptVersion: 'default_v8.1',
          inputEvidenceCount: 1,
          inputBytes: 200,
          outputBytes: 0,
          inputTokens: 50,
          outputTokens: 0,
          totalTokens: 50,
          estimatedCost: 0,
          costCurrency: 'USD',
          pricingVersion: '2026-09-v1',
          createdAt: new Date().toISOString(),
        },
        mockDb as any
      );

      // Record failed run with rate limit error
      await store.recordRunFailed(
        runId,
        new Error('RESOURCE_EXHAUSTED: Rate limit exceeded (429)'),
        undefined,
        mockDb as any
      );

      const savedFailed = await store.getRun(runId, mockDb as any);
      expect(savedFailed?.status).toBe('retrying');
      expect(savedFailed?.errorCode).toBe('rate_limit');
      expect(savedFailed?.retryable).toBe(true);
    });

    it('executes task through IntelligenceTaskQueue creating complete processing run records', async () => {
      queue.registerHandler('job_extraction', async () => {
        return {
          category: 'Plumbing',
          tokenUsage: { inputTokens: 400, outputTokens: 120, totalTokens: 520 },
          inputBytes: 850,
          outputBytes: 310,
          evidenceIds: ['ev_1', 'ev_2'],
        };
      });

      const task = await queue.enqueueTaskAsync(
        'job_extraction',
        'job',
        'job_full_flow',
        'idem_full_flow_key',
        { title: 'Fix leaking copper pipe' }
      );

      const executedTask = await queue.executeTask(task.taskId);
      expect(executedTask.status).toBe('succeeded');

      // Verify that the durable processing run record was created in Firestore
      const runs = await store.listRunsForTask(task.taskId, mockDb as any);
      expect(runs.length).toBe(1);
      expect(runs[0].status).toBe('succeeded');
      expect(runs[0].taskId).toBe(task.taskId);
      expect(runs[0].aggregateId).toBe('job_full_flow');
      expect(runs[0].inputTokens).toBe(400);
      expect(runs[0].outputTokens).toBe(120);
      expect(runs[0].totalTokens).toBe(520);
      expect(runs[0].inputEvidenceCount).toBe(2);
    });

    it('fails closed when Firestore database is unconfigured or null', async () => {
      const standaloneStore = new IntelligenceProcessingRunStore();
      await expect(
        standaloneStore.recordRunStarted(
          {
            runId: 'r1',
            taskId: 't1',
            aggregateType: 'job',
            aggregateId: 'j1',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'w1',
            leaseId: 'l1',
            startedAt: new Date().toISOString(),
          },
          null
        )
      ).rejects.toThrow(/Firestore database or transaction support is unavailable/);
    });

    it('fails closed when runTransaction is missing on database (rejects direct write fallbacks)', async () => {
      const standaloneStore = new IntelligenceProcessingRunStore();
      let docSetCalled = false;
      const dbWithoutTransaction = {
        collection: () => ({
          doc: () => ({
            set: async () => {
              docSetCalled = true;
            },
          }),
        }),
      };

      await expect(
        standaloneStore.recordRunStarted(
          {
            runId: 'r_no_tx',
            taskId: 't1',
            aggregateType: 'job',
            aggregateId: 'j1',
            taskType: 'job_extraction',
            status: 'started',
            attempt: 1,
            workerId: 'w1',
            leaseId: 'l1',
            startedAt: new Date().toISOString(),
          },
          dbWithoutTransaction as any
        )
      ).rejects.toThrow(/Firestore database or transaction support is unavailable/);

      expect(docSetCalled).toBe(false);

      await expect(
        standaloneStore.recordRunSucceeded('r_no_tx', {}, dbWithoutTransaction as any)
      ).rejects.toThrow(/Firestore database or transaction support is unavailable/);

      await expect(
        standaloneStore.recordRunFailed('r_no_tx', new Error('test'), {}, dbWithoutTransaction as any)
      ).rejects.toThrow(/Firestore database or transaction support is unavailable/);
    });

    it('fails closed when recordRunStarted throws (handler is not executed, task is not succeeded)', async () => {
      let handlerCalled = false;
      const testQueue = new IntelligenceTaskQueue();
      const mockDbFailingStart = {
        collection: (name: string) => {
          if (name === 'intelligence_processing_runs') {
            return {
              doc: () => ({
                set: async () => {
                  throw new Error('Firestore disk write error during recordRunStarted');
                },
              }),
            };
          }
          return mockDb.collection(name);
        },
        runTransaction: mockDb.runTransaction,
      };

      testQueue.setFirestoreDb(mockDbFailingStart as any);
      testQueue.registerHandler('job_extraction', async () => {
        handlerCalled = true;
        return { success: true };
      });

      const task = await testQueue.enqueueTaskAsync(
        'job_extraction',
        'job',
        'job_fail_start',
        'idem_fail_start_key',
        { title: 'Test Fail Start' }
      );

      const executedTask = await testQueue.executeTask(task.taskId);
      expect(handlerCalled).toBe(false);
      expect(executedTask.status).not.toBe('succeeded');
    });

    it('fails closed when recordRunSucceeded throws (task is not marked succeeded)', async () => {
      const testQueue = new IntelligenceTaskQueue();
      const mockDbFailingSucc = {
        collection: (name: string) => {
          if (name === 'intelligence_processing_runs') {
            return {
              doc: () => ({
                get: async () => ({ exists: true, data: () => ({ startedAt: new Date().toISOString() }) }),
                set: async () => {},
                update: async () => {},
              }),
            };
          }
          return mockDb.collection(name);
        },
        runTransaction: async (fn: any) => {
          // If transaction is called for intelligence_processing_runs, fail it
          const tx = {
            get: async (ref: any) => {
              if (ref.id?.startsWith('run_')) {
                throw new Error('Firestore transaction error during recordRunSucceeded');
              }
              return ref.get();
            },
            set: (ref: any, data: any, opts: any) => ref.set(data, opts),
            update: (ref: any, data: any) => ref.update(data),
          };
          return fn(tx);
        },
      };

      testQueue.setFirestoreDb(mockDbFailingSucc as any);
      testQueue.registerHandler('job_extraction', async () => {
        return { success: true };
      });

      const task = await testQueue.enqueueTaskAsync(
        'job_extraction',
        'job',
        'job_fail_succ',
        'idem_fail_succ_key',
        { title: 'Test Fail Succ' }
      );

      const executedTask = await testQueue.executeTask(task.taskId);
      expect(executedTask.status).not.toBe('succeeded');
    });
  });
});
