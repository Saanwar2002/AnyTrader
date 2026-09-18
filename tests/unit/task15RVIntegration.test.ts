/**
 * AnyTrader V8.1 — Task 15R-V: Final AI Provider to Security Boundary Runtime Path Verification Suite
 *
 * PROVES:
 * The ACTUAL production "job_extraction" runtime path cannot allow AI/provider output
 * to bypass the mandatory V8.1 security boundary:
 *
 *   "production task handler"
 *   → "production jobIntelligenceService.deriveJobIntelligence()"
 *   → "controlled provider.extractJobCandidate()"
 *   → "raw provider candidate"
 *   → "processAICandidateToCanonical()"
 *   → "lineage validation"
 *   → "canonicalization"
 *   → "authoritative persistence (Tier A immutable store & projection)"
 *
 * INVARIANTS ENFORCED:
 * 1. ZERO DIRECT rawCandidate INJECTION: All tests invoke the production task queue handler
 *    without injecting rawCandidate into the payload.
 * 2. CONTROLLED PROVIDER INJECTION: Uses the production IntelligenceModelProvider interface
 *    to test valid, malformed, spoofed, and fabricated AI outputs.
 * 3. AUTHORITATIVE METADATA: Server context strictly overrides all provider metadata.
 * 4. FAIL-CLOSED LINEAGE: Non-existent or cross-aggregate evidence rejects with AICandidateSecurityError.
 * 5. TIER B RAW AUDIT: Raw output is compressed in rawManifest but never becomes authoritative directly.
 * 6. OBSERVABILITY & FAILURE PROPAGATION: Failures are recorded in processingRunStore and task queue.
 * 7. IDEMPOTENCY & CONCURRENCY: Task deduplication and atomic worker leases prevent double-spend or corruption.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { intelligenceTaskQueue } from '../../src/server/intelligence/intelligenceTaskQueue';
import { registerIntelligenceTaskHandlers } from '../../server';
import { createInMemoryTestDb } from '../../src/server/intelligence/testDoubles';
import { setGlobalIntelligenceDb } from '../../src/server/intelligence/immutableStore';
import { jobIntelligenceService } from '../../src/server/intelligence/jobIntelligence';
import {
  IntelligenceModelProvider,
  ModelExtractionResult,
} from '../../src/server/intelligence/geminiProvider';
import {
  INTELLIGENCE_PIPELINE_VERSION,
  INTELLIGENCE_SCHEMA_VERSION,
} from '../../src/server/intelligence/provenance';
import { processingRunStore } from '../../src/server/intelligence/processingRunStore';

/**
 * Controlled test implementation of the production IntelligenceModelProvider interface.
 * Implements the exact same contract as GeminiIntelligenceProvider without separate security paths.
 */
class ControlledTestIntelligenceProvider implements IntelligenceModelProvider {
  public lastJobId?: string;
  public lastUntrustedEvidence?: Array<{ id: string; type: string; content: string }>;
  public invocationCount: number = 0;

  constructor(
    private candidateOverride?: any,
    private metricsOverride?: any
  ) {}

  public setCandidate(candidate: any): void {
    this.candidateOverride = candidate;
  }

  public setMetrics(metrics: any): void {
    this.metricsOverride = metrics;
  }

  async extractJobCandidate(
    jobId: string,
    untrustedEvidence: Array<{ id: string; type: string; content: string }>
  ): Promise<ModelExtractionResult<any>> {
    this.invocationCount++;
    this.lastJobId = jobId;
    this.lastUntrustedEvidence = untrustedEvidence;

    const candidate = this.candidateOverride !== undefined
      ? this.candidateOverride
      : {
          category: 'Roofing',
          buildingComponent: 'Slate Tile',
          observedProblem: 'Cracked slate tile near gutter flashing with active ingress',
          extractedScope: [
            'Source matching Welsh slate',
            'Secure with copper rivets',
            'Re-bed lead flashing',
          ],
          identifiedEvidenceReferences: untrustedEvidence.map((e) => e.id),
          candidateConfidence: 0.92,
        };

    return {
      candidate,
      metrics: this.metricsOverride || {
        model: 'controlled-test-model-v1',
        inputTokens: 150,
        outputTokens: 90,
        totalTokens: 240,
        estimatedCostUsd: 0.000038,
        processingDurationMs: 42,
      },
      rawResponseText: JSON.stringify(candidate),
    };
  }

  async rollupPropertyCandidate(
    propertyId: string,
    jobHistories: Array<{ jobId: string; category: string; problem: string; scope: string[] }>,
    untrustedEvidence: Array<{ id: string; type: string; content: string }>
  ): Promise<ModelExtractionResult<any>> {
    return {
      candidate: {
        summary: 'Controlled property rollup',
        criticalIssues: [],
        preventativeMaintenance: [],
        maintenanceScore: 88,
        identifiedEvidenceReferences: untrustedEvidence.map((e) => e.id),
        candidateConfidence: 0.91,
      },
      metrics: {
        model: 'controlled-test-model-v1',
        inputTokens: 210,
        outputTokens: 95,
        totalTokens: 305,
        estimatedCostUsd: 0.000045,
        processingDurationMs: 55,
      },
      rawResponseText: '{}',
    };
  }
}

describe('Task 15R-V: Production AI Provider to Security Boundary Runtime Path Verification', () => {
  let testDb: any;
  let controlledProvider: ControlledTestIntelligenceProvider;

  beforeEach(() => {
    testDb = createInMemoryTestDb();
    setGlobalIntelligenceDb(testDb);
    intelligenceTaskQueue.setFirestoreDb(testDb);
    intelligenceTaskQueue.clear();

    controlledProvider = new ControlledTestIntelligenceProvider();
    jobIntelligenceService.setProvider(controlledProvider);

    // Register production task handlers backed by testDb
    registerIntelligenceTaskHandlers(testDb);
  });

  const seedAuthoritativeEvidence = async (
    evidenceId: string,
    aggregateId: string,
    aggregateType: 'job' | 'property' = 'job',
    sourceId: string = 'usr_homeowner_42'
  ) => {
    await testDb.collection('intelligence_evidence').doc(evidenceId).set({
      evidenceId,
      aggregateType,
      aggregateId,
      sourceId,
      sourceType: 'user_upload',
      evidenceType: 'image',
      storageUri: `gs://anytrader/evidence/${evidenceId}.jpg`,
      sourceRef: `photos/${evidenceId}.jpg`,
      contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      byteSize: 20480,
      integrityStatus: 'verified',
      verified: true,
      capturedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  };

  // =========================================================================
  // 1. POSITIVE TEST: FULL PRODUCTION RUNTIME PATH WITH VALID PROVIDER RESPONSE
  // =========================================================================
  it('1. POSITIVE: Full production pipeline executes via real provider path without direct rawCandidate injection', async () => {
    const jobId = 'job_e2e_real_path_001';
    const evidenceId = 'ev_e2e_real_001';

    // Step A: Register authoritative evidence in Firestore
    await seedAuthoritativeEvidence(evidenceId, jobId);

    // Step B: Enqueue task WITHOUT ANY direct rawCandidate or rawAICandidate
    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case1_${jobId}`,
      {
        job: {
          jobId,
          title: 'Roof leak repair',
          description: 'Cracked slate tile near gutter flashing with active ingress',
          sourceVersion: '1',
          modelVersion: 'controlled-test-model-v1',
        },
      }
    );

    expect(task.taskId).toBeDefined();
    expect((task.payload as any).rawCandidate).toBeUndefined();

    // Step C: Execute task through real production handler
    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);

    // Step D: Verify provider was invoked through jobIntelligenceService
    expect(controlledProvider.invocationCount).toBe(1);
    expect(controlledProvider.lastJobId).toBe(jobId);
    expect(controlledProvider.lastUntrustedEvidence).toBeDefined();
    expect(controlledProvider.lastUntrustedEvidence!.some((e) => e.id === evidenceId)).toBe(true);

    // Step E: Verify task reached 'succeeded'
    expect(executionResult.status).toBe('succeeded');
    expect(executionResult.lastError).toBeUndefined();

    // Step F: Verify authoritative extraction was persisted in Tier A store
    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.docs.length).toBe(1);

    const extraction = extractions.docs[0].data();
    expect(extraction.aggregateId).toBe(jobId);
    expect(extraction.aggregateType).toBe('job');

    // Step G: Verify canonical event and current projection
    const canonicalEvents = await testDb.collection('intelligence_events').get();
    expect(canonicalEvents.docs.length).toBe(1);
    const event = canonicalEvents.docs[0].data();
    expect(event.aggregateId).toBe(jobId);
    expect(event.payload.contentHash).toBeDefined();
    expect(event.payload.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.evidenceIds).toContain(evidenceId);

    // Step H: Verify summary projection in intelligence_jobs
    const summarySnap = await testDb.collection('intelligence_jobs').doc(jobId).get();
    expect(summarySnap.exists).toBe(true);
    const summary = summarySnap.data();
    expect(summary.domain).toBe('roofing');
    expect(summary.currentVersionId).toBe(event.payload.canonicalId);
  });

  // =========================================================================
  // 2. NEGATIVE TEST: INVALID STRUCTURE / SCHEMA REJECTED BY SECURITY BOUNDARY
  // =========================================================================
  it('2. NEGATIVE (Invalid Structure): Provider returning invalid confidence rejected by boundary', async () => {
    const jobId = 'job_invalid_struct_002';
    const evidenceId = 'ev_invalid_struct_002';
    await seedAuthoritativeEvidence(evidenceId, jobId);

    // Provider returns candidate violating confidence bounds (> 1.0)
    controlledProvider.setCandidate({
      category: 'Roofing',
      buildingComponent: 'Slate Tile',
      observedProblem: 'Cracked tile',
      extractedScope: ['Fix tile'],
      identifiedEvidenceReferences: [evidenceId],
      candidateConfidence: 1.85, // INVALID: Must be <= 1.0
    });

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case2_${jobId}`,
      {
        job: {
          jobId,
          title: 'Roof repair',
          description: 'Cracked tile',
        },
      }
    );

    // Execute real production handler
    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);

    // Verify provider was indeed called
    expect(controlledProvider.invocationCount).toBe(1);

    // Verify task failed closed
    expect(executionResult.status).toBe('dead_letter');
    expect(executionResult.lastError).toMatch(/Structural schema validation failed|candidateConfidence/i);

    // Verify NO authoritative intelligence was persisted
    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.empty).toBe(true);

    const summaries = await testDb.collection('intelligence_jobs').get();
    expect(summaries.empty).toBe(true);
  });

  it('2B. NEGATIVE (Malformed Observations): Provider returning invalid observations structure fails closed', async () => {
    const jobId = 'job_malformed_003';
    const evidenceId = 'ev_malformed_003';
    await seedAuthoritativeEvidence(evidenceId, jobId);

    // Provider returns candidate with invalid empty observations
    controlledProvider.setCandidate({
      category: 'Roofing',
      buildingComponent: 'Slate Tile',
      observedProblem: '', // INVALID: empty observed problem
      extractedScope: ['Fix'],
      identifiedEvidenceReferences: [evidenceId],
      candidateConfidence: 0.85,
      observations: [
        {
          description: '', // INVALID: empty observation description
          evidenceIds: [evidenceId],
        },
      ],
    });

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case2b_${jobId}`,
      {
        job: { jobId, title: 'Roof repair', description: 'Test' },
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);

    expect(controlledProvider.invocationCount).toBe(1);
    expect(executionResult.status).toBe('dead_letter');

    // No documents persisted
    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.empty).toBe(true);
  });

  // =========================================================================
  // 3. NEGATIVE TEST: FABRICATED EVIDENCE REJECTED BY LINEAGE VALIDATOR
  // =========================================================================
  it('3. NEGATIVE (Non-existent Evidence): Provider returning ungrounded/fabricated evidenceId fails closed', async () => {
    const jobId = 'job_fabricated_ev_004';
    // Do NOT seed evidence 'ev_ghost_fabricated_999'

    controlledProvider.setCandidate({
      category: 'Roofing',
      buildingComponent: 'Slate Tile',
      observedProblem: 'Fabricated ghost evidence test',
      extractedScope: ['Repair slate'],
      identifiedEvidenceReferences: ['ev_ghost_fabricated_999'], // GHOST EVIDENCE
      candidateConfidence: 0.95,
    });

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case3_${jobId}`,
      {
        job: { jobId, title: 'Ghost repair', description: 'Test' },
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);

    expect(controlledProvider.invocationCount).toBe(1);
    expect(executionResult.status).toBe('dead_letter');
    expect(executionResult.lastError).toMatch(/Evidence lineage validation failed|does not exist in authoritative Firestore/i);

    // Store remains completely empty
    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.empty).toBe(true);

    const summarySnap = await testDb.collection('intelligence_jobs').doc(jobId).get();
    expect(summarySnap.exists).toBe(false);
  });

  it('3B. NEGATIVE (Cross-Aggregate Evidence): Provider referencing evidence belonging to another job fails closed', async () => {
    const targetJobId = 'job_target_005';
    const otherJobId = 'job_other_005';
    const otherEvidenceId = 'ev_other_job_005';

    // Seed evidence explicitly belonging to OTHER job
    await seedAuthoritativeEvidence(otherEvidenceId, otherJobId);

    controlledProvider.setCandidate({
      category: 'Plumbing',
      buildingComponent: 'Boiler',
      observedProblem: 'Cross-job evidence theft attempt',
      extractedScope: ['Inspect boiler'],
      identifiedEvidenceReferences: [otherEvidenceId], // BELONGS TO OTHER JOB
      candidateConfidence: 0.88,
    });

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      targetJobId,
      `idem_case3b_${targetJobId}`,
      {
        job: { jobId: targetJobId, title: 'Boiler repair', description: 'Test' },
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);

    expect(controlledProvider.invocationCount).toBe(1);
    expect(executionResult.status).toBe('dead_letter');
    expect(executionResult.lastError).toMatch(/Same-type aggregate mismatch rejected|belongs to/i);

    // No documents persisted for target job
    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.empty).toBe(true);

    const summarySnap = await testDb.collection('intelligence_jobs').doc(targetJobId).get();
    expect(summarySnap.exists).toBe(false);
  });

  // =========================================================================
  // 4. SERVER-OWNED METADATA TAMPERING DEFENSE
  // =========================================================================
  it('4. SERVER-OWNED METADATA: Security boundary strictly overwrites model-supplied metadata with trusted server context', async () => {
    const jobId = 'job_metadata_spoof_006';
    const evidenceId = 'ev_meta_spoof_006';
    await seedAuthoritativeEvidence(evidenceId, jobId);

    // Provider candidate tries to hijack server-owned security metadata
    controlledProvider.setCandidate({
      category: 'Roofing',
      buildingComponent: 'Slate Tile',
      observedProblem: 'Cracked tile with metadata tampering payload',
      extractedScope: ['Replace slate tile'],
      identifiedEvidenceReferences: [evidenceId],
      candidateConfidence: 0.90,
      // MALICIOUS / SPOOFED SERVER-OWNED METADATA
      aggregateId: 'hacked_target_job_999',
      aggregateType: 'super_admin_system',
      sourceId: 'forged_user_999',
      pipelineVersion: 'v999.0.0-unauthorized',
      modelVersion: 'unauthorized-model-999',
      promptVersion: 'injected_prompt_v0',
      schemaVersion: 'v999',
      generatedAt: '1970-01-01T00:00:00.000Z',
    });

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case4_${jobId}`,
      {
        job: {
          jobId,
          title: 'Roof repair',
          description: 'Valid job',
          sourceVersion: '1',
          modelVersion: 'controlled-test-model-v1',
        },
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('succeeded');

    // Verify canonical event contains TRUSTED server metadata, NOT the spoofed model values
    const canonicalEvents = await testDb.collection('intelligence_events').get();
    expect(canonicalEvents.docs.length).toBe(1);

    const event = canonicalEvents.docs[0].data();
    expect(event.aggregateId).toBe(jobId); // TRUSTED (NOT hacked_target_job_999)
    expect(event.aggregateType).toBe('job'); // TRUSTED (NOT super_admin_system)
    expect(event.pipelineVersion).toBe(INTELLIGENCE_PIPELINE_VERSION); // TRUSTED (NOT v999)
    expect(event.modelVersion).toBe('controlled-test-model-v1'); // TRUSTED (NOT unauthorized-model-999)
    expect(event.generatedAt).not.toBe('1970-01-01T00:00:00.000Z'); // TRUSTED (FRESH TIMESTAMP)

    // Verify summary projection also respects trusted aggregate
    const summarySnap = await testDb.collection('intelligence_jobs').doc(jobId).get();
    expect(summarySnap.exists).toBe(true);
    expect(summarySnap.data().currentVersionId).toBe(event.payload.canonicalId);

    // Verify hacked document was never created
    const hackedSummary = await testDb.collection('intelligence_jobs').doc('hacked_target_job_999').get();
    expect(hackedSummary.exists).toBe(false);
  });

  // =========================================================================
  // 5. RAW OUTPUT PERSISTENCE & SEPARATION CHECK
  // =========================================================================
  it('5. RAW OUTPUT PERSISTENCE: Raw provider output is stored in rawManifest but does NOT become authoritative directly', async () => {
    const jobId = 'job_raw_manifest_007';
    const evidenceId = 'ev_raw_manifest_007';
    await seedAuthoritativeEvidence(evidenceId, jobId);

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case5_${jobId}`,
      {
        job: { jobId, title: 'Roof repair', description: 'Raw manifest test' },
      }
    );

    await intelligenceTaskQueue.executeTask(task.taskId);

    // Verify extraction extraction doc was stored with rawManifest
    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.docs.length).toBe(1);

    const extraction = extractions.docs[0].data();
    expect(extraction.rawManifest).toBeDefined();
    expect(extraction.rawManifest.storagePath).toMatch(/^(intelligence_raw|canonical_extractions)\/job\//);
    expect(extraction.rawManifest.encoding || extraction.rawManifest.compression).toBeDefined();
    expect(extraction.rawManifest.sha256).toBeDefined();

    // Verify canonical event contains ONLY canonicalized, sanitized data
    const canonicalEvents = await testDb.collection('intelligence_events').get();
    const event = canonicalEvents.docs[0].data();
    expect(event.payload.contentHash).toBeDefined();
    expect(event.payload.domain).toBe('roofing');
  });

  // =========================================================================
  // 6. SECURITY FAILURE PROPAGATION & OBSERVABILITY
  // =========================================================================
  it('6. OBSERVABILITY: Security failure propagates to task status and records failure in processingRunStore', async () => {
    const jobId = 'job_observability_008';
    // No evidence registered

    controlledProvider.setCandidate({
      category: 'Roofing',
      buildingComponent: 'Slate Tile',
      observedProblem: 'Testing failure propagation',
      extractedScope: ['Inspect'],
      identifiedEvidenceReferences: ['ev_unregistered_008'],
      candidateConfidence: 0.90,
    });

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case6_${jobId}`,
      {
        job: { jobId, title: 'Unregistered test', description: 'Test' },
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('dead_letter');
    expect(executionResult.lastError).toContain('ev_unregistered_008');

    // Verify failure recorded in processing run store
    const runs = await processingRunStore.listRunsForAggregate('job', jobId, testDb);
    expect(runs.length).toBeGreaterThanOrEqual(1);
    const failedRun = runs.find((r) => r.status === 'failed' || r.status === 'dead_letter');
    expect(failedRun).toBeDefined();
    expect(failedRun!.sanitizedDiagnostic || failedRun!.errorCode).toBeDefined();
    expect(failedRun!.status).toBe('dead_letter');
  });

  // =========================================================================
  // 7. IDEMPOTENCY & CONCURRENCY REGRESSION ON ACTUAL PROVIDER PATH
  // =========================================================================
  it('7. IDEMPOTENCY: Duplicate delivery of job_extraction task produces deterministic canonical version without duplication', async () => {
    const jobId = 'job_idempotency_009';
    const evidenceId = 'ev_idempotency_009';
    await seedAuthoritativeEvidence(evidenceId, jobId);

    // Enqueue first task
    const task1 = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case7_first_${jobId}`,
      {
        job: { jobId, title: 'Idempotency test', description: 'Test', sourceVersion: '1' },
      }
    );

    // Execute first run
    const result1 = await intelligenceTaskQueue.executeTask(task1.taskId);
    expect(result1.status).toBe('succeeded');

    const extractionsAfterFirst = await testDb.collection('intelligence_extractions').get();
    expect(extractionsAfterFirst.docs.length).toBe(1);
    const firstVersionId = extractionsAfterFirst.docs[0].data().versionId;

    // Enqueue second task (duplicate delivery for same job and version)
    const task2 = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case7_second_${jobId}`,
      {
        job: { jobId, title: 'Idempotency test', description: 'Test', sourceVersion: '1' },
      }
    );

    // Execute second run
    const result2 = await intelligenceTaskQueue.executeTask(task2.taskId);
    expect(result2.status).toBe('succeeded');

    // Immutable store contains deterministic single version
    const extractionsAfterSecond = await testDb.collection('intelligence_extractions').get();
    expect(extractionsAfterSecond.docs.length).toBe(1);
    expect(extractionsAfterSecond.docs[0].data().versionId).toBe(firstVersionId);

    // Summary projection remains stable
    const summarySnap = await testDb.collection('intelligence_jobs').doc(jobId).get();
    expect(summarySnap.exists).toBe(true);
    expect(summarySnap.data().currentVersionId).toBe(firstVersionId);
  });

  it('7B. CONCURRENCY: Concurrent worker race claims lease atomically; lost lease prevents duplicate execution', async () => {
    const jobId = 'job_concurrency_010';
    const evidenceId = 'ev_concurrency_010';
    await seedAuthoritativeEvidence(evidenceId, jobId);

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case7b_${jobId}`,
      {
        job: { jobId, title: 'Concurrency race test', description: 'Test' },
      }
    );

    // Worker A claims the task atomically via transactional lock
    const claimedWorkerA = await intelligenceTaskQueue.claimTaskTransactional(task.taskId, 'worker-A', 30000);
    expect(claimedWorkerA).toBe(true);

    // Worker B attempts to claim simultaneously — must receive false because active lease is held
    const claimedWorkerB = await intelligenceTaskQueue.claimTaskTransactional(task.taskId, 'worker-B', 30000);
    expect(claimedWorkerB).toBe(false);

    // Worker A executes task to completion
    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId, 'worker-A');
    expect(executionResult.status).toBe('succeeded');

    // Provider was invoked exactly once
    expect(controlledProvider.invocationCount).toBe(1);

    // Exactly one extraction persisted
    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.docs.length).toBe(1);
  });
});
