import { describe, it, expect, beforeEach } from 'vitest';
import { intelligenceTaskQueue } from '../../src/server/intelligence/intelligenceTaskQueue';
import { registerIntelligenceTaskHandlers } from '../../server';
import { createInMemoryTestDb } from '../../src/server/intelligence/testDoubles';
import { setGlobalIntelligenceDb } from '../../src/server/intelligence/immutableStore';

describe('Task 15R: V8.1 End-to-End AI Pipeline Security Boundary Verification', () => {
  let testDb: any;

  beforeEach(() => {
    testDb = createInMemoryTestDb();
    setGlobalIntelligenceDb(testDb);
    intelligenceTaskQueue.setFirestoreDb(testDb);
    intelligenceTaskQueue.clear();
    registerIntelligenceTaskHandlers(testDb);
  });

  const seedEvidence = async (evidenceId: string, aggregateId: string, sourceId: string = 'usr_123') => {
    await testDb.collection('intelligence_evidence').doc(evidenceId).set({
      evidenceId,
      aggregateType: 'job',
      aggregateId,
      sourceId,
      sourceType: 'user_upload',
      evidenceType: 'image',
      storageUri: `gs://anytrader/evidence/${evidenceId}.jpg`,
      sourceRef: `photos/${evidenceId}.jpg`,
      contentHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      byteSize: 10240,
      integrityStatus: 'verified',
      verified: true,
      capturedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  };

  it('Case 1: Valid candidate end-to-end pipeline (All stages pass, writes to store)', async () => {
    const jobId = 'job_valid_101';
    const evidenceId = 'ev_valid_101';
    await seedEvidence(evidenceId, jobId);

    const validCandidate = {
      domain: 'roofing',
      category: 'Roof Repair',
      component: 'Slate Tile',
      observations: [
        {
          description: 'Cracked slate tile near gutter flashing with active ingress',
          component: 'Slate Tile',
          evidenceIds: [evidenceId],
        },
      ],
      inferences: [
        {
          hypothesis: 'Replace cracked slate tile and re-bed lead flashing',
          confidence: 0.92,
          supportingEvidenceIds: [evidenceId],
          targetComponent: 'Slate Tile',
        },
      ],
      interventions: [
        {
          description: 'Source matching Welsh slate and secure with copper rivets',
          component: 'Slate Tile',
          evidenceIds: [evidenceId],
        },
      ],
      evidenceIds: [evidenceId],
      candidateConfidence: 0.90,
    };

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case1_${jobId}`,
      {
        job: { jobId, title: 'Roof leak', description: 'Leaking slate roof' },
        rawCandidate: validCandidate,
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('succeeded');

    // Verify written records
    const canonicalId = executionResult.payload?.versionId;
    expect(canonicalId).toBeDefined();

    const extractionSnap = await testDb.collection('intelligence_extractions').doc(canonicalId).get();
    expect(extractionSnap.exists).toBe(true);
    expect(extractionSnap.data().aggregateId).toBe(jobId);

    const summarySnap = await testDb.collection('intelligence_jobs').doc(jobId).get();
    expect(summarySnap.exists).toBe(true);
    expect(summarySnap.data().domain).toBe('roofing');
    expect(summarySnap.data().currentVersionId).toBe(canonicalId);
  });

  it('Case 2: Invalid structural candidate (Fails structural validation, 0 writes)', async () => {
    const jobId = 'job_invalid_struct_102';
    const evidenceId = 'ev_struct_102';
    await seedEvidence(evidenceId, jobId);

    // Missing required domain and empty description
    const invalidCandidate = {
      category: 'Unknown',
      observations: [
        {
          description: '', // Empty description violates schema
          evidenceIds: [evidenceId],
        },
      ],
    };

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case2_${jobId}`,
      {
        job: { jobId, title: 'Broken boiler' },
        rawCandidate: invalidCandidate,
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('dead_letter');
    expect(executionResult.lastError).toMatch(/Structural schema validation failed|Domain is required/);

    // Fail closed: zero writes to intelligence persistence
    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.empty).toBe(true);

    const summaries = await testDb.collection('intelligence_jobs').get();
    expect(summaries.empty).toBe(true);
  });

  it('Case 3: Oversized AI payload (> MAX_AI_PAYLOAD_BYTES, fails immediately)', async () => {
    const jobId = 'job_oversized_103';
    const evidenceId = 'ev_oversized_103';
    await seedEvidence(evidenceId, jobId);

    // Construct a payload strictly larger than MAX_AI_PAYLOAD_BYTES (512 KiB)
    const largeDescription = 'x'.repeat(550 * 1024);
    const oversizedCandidate = {
      domain: 'structural',
      observations: [
        {
          description: largeDescription,
          evidenceIds: [evidenceId],
        },
      ],
    };

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case3_${jobId}`,
      {
        job: { jobId, title: 'Large payload job' },
        rawCandidate: oversizedCandidate,
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('dead_letter');
    expect(executionResult.lastError).toMatch(/exceeds max limit/i);

    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.empty).toBe(true);
  });

  it('Case 4: Fabricated/Nonexistent evidence ID (Fails lineage validation, 0 writes)', async () => {
    const jobId = 'job_fabricated_ev_104';
    const fabricatedEvidenceId = 'ev_ghost_nonexistent_999';
    // Deliberately do NOT seed this evidence in testDb

    const candidate = {
      domain: 'electrical',
      observations: [
        {
          description: 'Faulty consumer unit with tripped RCD',
          evidenceIds: [fabricatedEvidenceId],
        },
      ],
      inferences: [
        {
          hypothesis: 'Replace 100A main switch and perform insulation resistance test',
          confidence: 0.88,
          supportingEvidenceIds: [fabricatedEvidenceId],
        },
      ],
      evidenceIds: [fabricatedEvidenceId],
    };

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case4_${jobId}`,
      {
        job: { jobId, title: 'Electrical trip' },
        rawCandidate: candidate,
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('dead_letter');
    expect(executionResult.lastError).toMatch(/Evidence lineage validation failed|does not exist in authoritative Firestore/i);

    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.empty).toBe(true);

    const summarySnap = await testDb.collection('intelligence_jobs').doc(jobId).get();
    expect(summarySnap.exists).toBe(false);
  });

  it('Case 5: Metadata manipulation attempt (Model tries to set aggregateId/sourceId/etc., server context wins)', async () => {
    const legitimateJobId = 'job_legitimate_105';
    const attackerSpoofedJobId = 'job_victim_stolen_999';
    const evidenceId = 'ev_legit_105';
    await seedEvidence(evidenceId, legitimateJobId);

    // AI model attempts to overwrite server-owned metadata
    const spoofedCandidate = {
      domain: 'plumbing',
      aggregateId: attackerSpoofedJobId, // ATTACK: trying to re-target extraction
      sourceId: 'attacker_user_666',      // ATTACK: trying to spoof author
      observations: [
        {
          description: 'Radiator pinhole leak causing carpet dampness',
          component: 'Radiator',
          evidenceIds: [evidenceId],
        },
      ],
      inferences: [
        {
          hypothesis: 'Replace radiator and inhibitor',
          confidence: 0.91,
          supportingEvidenceIds: [evidenceId],
        },
      ],
      evidenceIds: [evidenceId],
    };

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      legitimateJobId,
      `idem_case5_${legitimateJobId}`,
      {
        job: { jobId: legitimateJobId, title: 'Radiator leaking' },
        rawCandidate: spoofedCandidate,
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('succeeded');

    // Verify that server context strictly won:
    // 1. No record created under the attacker-spoofed ID
    const spoofedSummarySnap = await testDb.collection('intelligence_jobs').doc(attackerSpoofedJobId).get();
    expect(spoofedSummarySnap.exists).toBe(false);

    // 2. Legitimate record created under server-owned legitimateJobId
    const legitSummarySnap = await testDb.collection('intelligence_jobs').doc(legitimateJobId).get();
    expect(legitSummarySnap.exists).toBe(true);
    expect(legitSummarySnap.data().aggregateId).toBe(legitimateJobId);

    const extractionSnap = await testDb.collection('intelligence_extractions').doc(executionResult.payload?.versionId).get();
    expect(extractionSnap.data().aggregateId).toBe(legitimateJobId);
  });

  it('Case 6: Canonicalization proof (Output is properly canonicalized with deterministic hash and calibration)', async () => {
    const jobId = 'job_canonical_106';
    const evidenceId = 'ev_canonical_106';
    await seedEvidence(evidenceId, jobId);

    const candidate = {
      domain: 'glazing',
      category: 'Window Repair',
      component: 'Double Glazed Unit',
      observations: [
        {
          description: 'Blown sealed unit showing condensation between panes',
          component: 'Double Glazed Unit',
          evidenceIds: [evidenceId],
        },
      ],
      inferences: [
        {
          hypothesis: 'Degraded perimeter seal requires unit replacement',
          confidence: 0.95,
          supportingEvidenceIds: [evidenceId],
        },
      ],
      evidenceIds: [evidenceId],
      candidateConfidence: 0.95,
    };

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case6_${jobId}`,
      {
        job: { jobId, title: 'Misty window' },
        rawCandidate: candidate,
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('succeeded');

    const canonical = executionResult.payload?.canonical as any;
    expect(canonical).toBeDefined();

    // Deterministic cryptographic content hash (64 hex characters)
    expect(canonical.contentHash).toMatch(/^[a-f0-9]{64}$/);

    // Canonical ID conforms to standard format
    expect(canonical.canonicalId).toMatch(new RegExp(`^ver_job_${jobId}_`));

    // Confidence scores calibrated and present
    expect(canonical.confidence.overall).toBeGreaterThanOrEqual(0);
    expect(canonical.confidence.overall).toBeLessThanOrEqual(1);
    expect(canonical.confidence.method).toBeDefined();
    expect(canonical.confidence.evidenceQuality).toBeDefined();
  });

  it('Case 7: Security failure propagation (Task queue marks task failed/error, no projection update)', async () => {
    const jobId = 'job_sec_fail_107';
    // Provide candidate with invalid inference (missing supportingEvidenceIds per Zod schema)
    const invalidCandidate = {
      domain: 'joinery',
      observations: [
        {
          description: 'Hanging oak door sticking on carpet',
          evidenceIds: ['ev_nonexistent'],
        },
      ],
      inferences: [
        {
          hypothesis: 'Plane base of door by 4mm',
          confidence: 1.5, // Invalid: confidence > 1.0 violates Zod schema
          supportingEvidenceIds: [],
        },
      ],
    };

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case7_${jobId}`,
      {
        job: { jobId, title: 'Door sticking' },
        rawCandidate: invalidCandidate,
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('dead_letter');

    // Confirm that the task document itself in Firestore was updated to dead_letter
    const taskDocSnap = await testDb.collection('intelligence_tasks').doc(task.taskId).get();
    expect(taskDocSnap.data().status).toBe('dead_letter');
    expect(taskDocSnap.data().lastError).toBeDefined();

    // No projection update
    const projectionSnap = await testDb.collection('intelligence_jobs').doc(jobId).get();
    expect(projectionSnap.exists).toBe(false);
  });

  it('Case 8: Idempotent reprocessing (Same job processed twice returns existing immutable record without duplication)', async () => {
    const jobId = 'job_idempotent_108';
    const evidenceId = 'ev_idempotent_108';
    await seedEvidence(evidenceId, jobId);

    const candidate = {
      domain: 'masonry',
      observations: [
        {
          description: 'Spalling brickwork on exterior chimney breast',
          evidenceIds: [evidenceId],
        },
      ],
      inferences: [
        {
          hypothesis: 'Rake out defective mortar and repoint with lime mortar',
          confidence: 0.89,
          supportingEvidenceIds: [evidenceId],
        },
      ],
      evidenceIds: [evidenceId],
    };

    // First execution
    const task1 = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case8_run1_${jobId}`,
      {
        job: { jobId, title: 'Chimney repair' },
        rawCandidate: candidate,
      }
    );

    const result1 = await intelligenceTaskQueue.executeTask(task1.taskId);
    expect(result1.status).toBe('succeeded');
    const versionId1 = result1.payload?.versionId;

    // Second execution with identical payload and job (different task enqueue)
    const task2 = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case8_run2_${jobId}`,
      {
        job: { jobId, title: 'Chimney repair' },
        rawCandidate: candidate,
      }
    );

    const result2 = await intelligenceTaskQueue.executeTask(task2.taskId);
    expect(result2.status).toBe('succeeded');
    const versionId2 = result2.payload?.versionId;

    // Must resolve to identical immutable versionId without duplicate extraction documents
    expect(versionId2).toBe(versionId1);

    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.size).toBe(1);
  });

  it('Case 9: Concurrent lease/task execution (Task queue lease lock preserved)', async () => {
    const jobId = 'job_concurrent_109';
    const evidenceId = 'ev_concurrent_109';
    await seedEvidence(evidenceId, jobId);

    const candidate = {
      domain: 'hvac',
      observations: [
        {
          description: 'Air conditioning condensate pump overflowing',
          evidenceIds: [evidenceId],
        },
      ],
      evidenceIds: [evidenceId],
    };

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case9_${jobId}`,
      {
        job: { jobId, title: 'AC leak' },
        rawCandidate: candidate,
      }
    );

    // Claim the task under worker_A
    const claimedA = await intelligenceTaskQueue.claimTaskTransactional(
      task.taskId,
      'worker_A',
      30000,
      'lease_worker_A'
    );
    expect(claimedA).toBe(true);

    // Worker B attempts to claim the same task while worker_A holds lease -> should return false
    const claimedB = await intelligenceTaskQueue.claimTaskTransactional(
      task.taskId,
      'worker_B',
      30000,
      'lease_worker_B'
    );
    expect(claimedB).toBe(false);

    // Worker B attempting to execute the task while worker_A holds lease cannot execute it
    const resultB = await intelligenceTaskQueue.executeTask(task.taskId, 'worker_B');
    expect(resultB.status).toBe('processing');
    expect(resultB.workerId).toBe('worker_A');

    // Verify task status remains processing under worker_A
    const taskDocSnap = await testDb.collection('intelligence_tasks').doc(task.taskId).get();
    expect(taskDocSnap.data().status).toBe('processing');
    expect(taskDocSnap.data().workerId).toBe('worker_A');
  });

  it('Case 10: Fail-closed verification (Error leaves zero corrupt/partial state)', async () => {
    const jobId = 'job_fail_closed_110';
    // Circular AI assertion attempt (violates anti-circularity rule)
    const evidenceId = 'ev_ai_circular_110';
    await testDb.collection('intelligence_evidence').doc(evidenceId).set({
      evidenceId,
      aggregateType: 'job',
      aggregateId: jobId,
      sourceId: 'model_gemini',
      sourceType: 'ai_output', // ANTI-CIRCULARITY VIOLATION
      evidenceType: 'ai_candidate',
      integrityStatus: 'verified',
      verified: true,
      capturedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const candidate = {
      domain: 'security',
      observations: [
        {
          description: 'Circular self-referencing observation',
          evidenceIds: [evidenceId],
        },
      ],
      evidenceIds: [evidenceId],
    };

    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'job_extraction',
      'job',
      jobId,
      `idem_case10_${jobId}`,
      {
        job: { jobId, title: 'Alarm fault' },
        rawCandidate: candidate,
      }
    );

    const executionResult = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executionResult.status).toBe('dead_letter');
    expect(executionResult.lastError).toMatch(/Anti-AI Circularity Violation/i);

    // Zero corrupt/partial state in immutable persistence
    const extractions = await testDb.collection('intelligence_extractions').get();
    expect(extractions.empty).toBe(true);

    const events = await testDb.collection('intelligence_events').get();
    expect(events.empty).toBe(true);

    const summaries = await testDb.collection('intelligence_jobs').get();
    expect(summaries.empty).toBe(true);
  });
});
