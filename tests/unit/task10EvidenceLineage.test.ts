/**
 * AnyTrader V8.1 — Task 10: Evidence → Intelligence Lineage Enforcement Test Suite
 * 
 * Verifies the hard provenance boundary between evidence and historical intelligence:
 * "No evidence, no assertion."
 * 
 * Tests:
 * 1. Valid evidence -> historical intelligence created successfully.
 * 2. Missing evidence -> rejected (pre-persistence fail-closed, no writes).
 * 3. Wrong aggregate / cross-aggregate contamination (e.g. job_123 referencing job_999) -> rejected.
 * 4. Incompatible sourceVersion (e.g. extraction v2 referencing evidence v1) -> rejected.
 * 5. Anti-AI circularity (AI model output cannot satisfy its own evidence requirement) -> rejected.
 * 6. Reference-only evidence -> accepted when valid, rejected when malformed or falsely claims verified bytes.
 * 7. Structured data evidence -> accepted when valid.
 * 8. Fail-closed when Firestore database is unavailable / null.
 * 9. Pre-persistence validation order -> zero writes executed on failure.
 * 10. Tampered or invalid verified evidence (missing/invalid contentHash, byteSize <= 0) -> rejected.
 * 11. Empty evidence list ("No evidence, no assertion") -> rejected.
 * 12. Composite/rollup property intelligence with constituent job evidence -> accepted when linked, rejected when unlinked.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EvidenceLineageValidator,
  evidenceLineageValidator,
} from '../../src/server/intelligence/lineageValidator';
import {
  ImmutableIntelligenceStore,
  immutableIntelligenceStore,
} from '../../src/server/intelligence/immutableStore';
import { createInMemoryTestDb } from '../../src/server/intelligence/testDoubles';
import { buildVersionId } from '../../src/server/intelligence/provenance';
import {
  CanonicalIntelligenceEvent,
  ConfidenceScores,
  IntelligenceEvidence,
  IntelligenceExtraction,
  JobIntelligence,
  PropertyIntelligence,
  Provenance,
} from '../../src/server/intelligence/types';

describe('Task 10: Evidence → Intelligence Lineage Enforcement Invariants', () => {
  let db: any;
  let store: ImmutableIntelligenceStore;
  let validator: EvidenceLineageValidator;

  const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const confidence: ConfidenceScores = {
    overall: 0.95,
    extraction: 0.95,
    evidenceQuality: 0.95,
    classification: 0.95,
    temporalFreshness: 0.95,
    method: 'deterministic_heuristic',
  };

  const provenance: Provenance = {
    source: 'user',
    evidenceIds: ['ev_valid_1'],
    pipelineVersion: 'v8.1',
    modelVersion: 'gemini-3.7-flash',
    promptVersion: 'job_v1',
    generatedAt: new Date().toISOString(),
    sourceContentHash: validHash,
  };

  beforeEach(() => {
    db = createInMemoryTestDb();
    store = new ImmutableIntelligenceStore();
    validator = new EvidenceLineageValidator(db);
  });

  async function seedEvidence(evidence: Partial<IntelligenceEvidence> & { evidenceId: string }): Promise<void> {
    const fullRecord: IntelligenceEvidence = {
      evidenceId: evidence.evidenceId,
      aggregateType: evidence.aggregateType || 'job',
      aggregateId: evidence.aggregateId || 'job_101',
      sourceType: evidence.sourceType || 'job',
      sourceId: evidence.sourceId || evidence.aggregateId || 'job_101',
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
      sourceReference: evidence.sourceReference,
      createdAt: new Date().toISOString(),
    };
    await db.collection('intelligence_evidence').doc(evidence.evidenceId).set(fullRecord);
  }

  it('Step 14: Valid evidence -> historical intelligence created and persisted successfully', async () => {
    await seedEvidence({
      evidenceId: 'ev_job_101',
      aggregateType: 'job',
      aggregateId: 'job_101',
      sourceVersion: 1,
      integrityStatus: 'verified',
      verified: true,
      contentHash: validHash,
      byteSize: 512,
    });

    const versionId = buildVersionId('job', 'job_101', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

    const extraction: IntelligenceExtraction = {
      extractionId: 'ext_101',
      versionId,
      aggregateType: 'job',
      aggregateId: 'job_101',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'job_v1',
      sourceVersion: 1,
      provider: 'google_genai',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: validHash, encoding: 'gzip', originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_101', createdAt: new Date().toISOString() },
      structuredCandidate: { category: 'Plumbing', problem: 'Burst Radiator' },
      evidenceIds: ['ev_job_101'],
      confidence,
      provenance,
    };

    const event: CanonicalIntelligenceEvent = {
      eventId: 'ie_101',
      aggregateType: 'job',
      aggregateId: 'job_101',
      eventType: 'JOB_ANALYSIS_COMPLETED',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'job_v1',
      createdAt: new Date().toISOString(),
      source: 'jobs/job_101',
      evidenceIds: ['ev_job_101'],
      confidence,
      provenance,
      status: 'valid',
      payload: { category: 'Plumbing' },
    };

    const summary: JobIntelligence = {
      jobId: 'job_101',
      currentVersionId: versionId,
      category: 'Plumbing',
      buildingComponent: 'Radiator',
      observedProblem: 'Burst Radiator',
      extractedScope: ['Replace valve'],
      recommendedIntervention: 'Drain and swap',
      evidenceIds: ['ev_job_101'],
      confidence,
      provenance,
      pipelineVersion: 'v8.1',
      updatedAt: new Date().toISOString(),
    };

    const res = await store.persistOutput({
      db,
      aggregateType: 'job',
      aggregateId: 'job_101',
      versionId,
      extraction,
      event,
      summaryProjection: summary,
    });

    expect(res.isNew).toBe(true);
    expect(res.versionId).toBe(versionId);

    // Verify extraction persisted in database
    const savedExtraction = await store.getVersionById(db, versionId);
    expect(savedExtraction).toBeDefined();
    expect(savedExtraction?.evidenceIds).toContain('ev_job_101');
  });

  it('Step 15: Missing evidence -> rejected before persistence with zero writes', async () => {
    const versionId = buildVersionId('job', 'job_404', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

    const extraction: IntelligenceExtraction = {
      extractionId: 'ext_404',
      versionId,
      aggregateType: 'job',
      aggregateId: 'job_404',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'job_v1',
      sourceVersion: 1,
      provider: 'google_genai',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: validHash, encoding: 'gzip', originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_404', createdAt: new Date().toISOString() },
      structuredCandidate: { category: 'Roofing', problem: 'Missing Tile' },
      evidenceIds: ['ev_nonexistent_999'],
      confidence,
      provenance,
    };

    const event: any = { eventId: 'ie_404', aggregateType: 'job', aggregateId: 'job_404' };

    await expect(
      store.persistOutput({
        db,
        aggregateType: 'job',
        aggregateId: 'job_404',
        versionId,
        extraction,
        event,
        summaryProjection: { jobId: 'job_404' },
      })
    ).rejects.toThrow(/Referenced evidence 'ev_nonexistent_999' does not exist in authoritative Firestore store/);

    // Pre-persistence validation: Ensure zero records were created in database
    const extractionSnap = await db.collection('intelligence_extractions').doc(versionId).get();
    expect(extractionSnap.exists).toBe(false);

    const eventSnap = await db.collection('intelligence_events').doc('ie_404').get();
    expect(eventSnap.exists).toBe(false);
  });

  it('Step 16: Wrong aggregate / cross-aggregate contamination -> strictly rejected', async () => {
    // Evidence belongs to job_999
    await seedEvidence({
      evidenceId: 'ev_job_999',
      aggregateType: 'job',
      aggregateId: 'job_999',
      sourceVersion: 1,
    });

    // Extraction is for job_123, but attempts to reference ev_job_999
    const versionId = buildVersionId('job', 'job_123', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

    const extraction: IntelligenceExtraction = {
      extractionId: 'ext_123',
      versionId,
      aggregateType: 'job',
      aggregateId: 'job_123',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'job_v1',
      sourceVersion: 1,
      provider: 'google_genai',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: validHash, encoding: 'gzip', originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_123', createdAt: new Date().toISOString() },
      structuredCandidate: { category: 'Electrical', problem: 'Sparks' },
      evidenceIds: ['ev_job_999'],
      confidence,
      provenance,
    };

    await expect(
      store.persistOutput({
        db,
        aggregateType: 'job',
        aggregateId: 'job_123',
        versionId,
        extraction,
        event: { eventId: 'ie_123', aggregateType: 'job', aggregateId: 'job_123' } as any,
        summaryProjection: { jobId: 'job_123' },
      })
    ).rejects.toThrow(/Same-type aggregate mismatch rejected: Evidence 'ev_job_999' belongs to 'job:job_999', not 'job:job_123'/);
  });

  it('Step 16b: Same-type aggregate mismatch rejected even when sourceId matches target aggregateId', async () => {
    // Vulnerability defense: Evidence has aggregateId = job_999, but sourceId = job_123
    await seedEvidence({
      evidenceId: 'ev_job_spoofed_source',
      aggregateType: 'job',
      aggregateId: 'job_999',
      sourceId: 'job_123',
      sourceVersion: 1,
    });

    const versionId = buildVersionId('job', 'job_123', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

    const extraction: IntelligenceExtraction = {
      extractionId: 'ext_123_spoof',
      versionId,
      aggregateType: 'job',
      aggregateId: 'job_123',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'job_v1',
      sourceVersion: 1,
      provider: 'google_genai',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: validHash, encoding: 'gzip', originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_123_spoof', createdAt: new Date().toISOString() },
      structuredCandidate: { category: 'Electrical', problem: 'Sparks' },
      evidenceIds: ['ev_job_spoofed_source'],
      confidence,
      provenance,
    };

    await expect(
      store.persistOutput({
        db,
        aggregateType: 'job',
        aggregateId: 'job_123',
        versionId,
        extraction,
        event: { eventId: 'ie_123_spoof', aggregateType: 'job', aggregateId: 'job_123' } as any,
        summaryProjection: { jobId: 'job_123' },
      })
    ).rejects.toThrow(/Same-type aggregate mismatch rejected: Evidence 'ev_job_spoofed_source' belongs to 'job:job_999', not 'job:job_123'/);
  });

  it('Step 17: Incompatible sourceVersion -> strictly rejected', async () => {
    // Evidence is from version 1 of job_500
    await seedEvidence({
      evidenceId: 'ev_job_500_v1',
      aggregateType: 'job',
      aggregateId: 'job_500',
      sourceVersion: 1,
    });

    // Extraction claims sourceVersion 3
    const versionId = buildVersionId('job', 'job_500', 3, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

    const extraction: IntelligenceExtraction = {
      extractionId: 'ext_500_v3',
      versionId,
      aggregateType: 'job',
      aggregateId: 'job_500',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'job_v1',
      sourceVersion: 3,
      provider: 'google_genai',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: validHash, encoding: 'gzip', originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_500', createdAt: new Date().toISOString() },
      structuredCandidate: { category: 'Plumbing', problem: 'Burst Pipe' },
      evidenceIds: ['ev_job_500_v1'],
      confidence,
      provenance,
    };

    await expect(
      store.persistOutput({
        db,
        aggregateType: 'job',
        aggregateId: 'job_500',
        versionId,
        extraction,
        event: { eventId: 'ie_500', aggregateType: 'job', aggregateId: 'job_500' } as any,
        summaryProjection: { jobId: 'job_500' },
      })
    ).rejects.toThrow(/Incompatible source version for evidence 'ev_job_500_v1': extraction declares sourceVersion '3' but evidence explicitly declares sourceVersion '1'/);
  });

  it('Step 18: Anti-AI circularity: AI model output cannot satisfy evidence requirement', async () => {
    // Seed evidence that is an AI output / candidate
    await seedEvidence({
      evidenceId: 'ev_ai_claim_1',
      aggregateType: 'job',
      aggregateId: 'job_600',
      sourceType: 'ai_output',
      evidenceType: 'ai_candidate',
      metadata: { isAiGenerated: true },
    });

    const versionId = buildVersionId('job', 'job_600', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

    const extraction: IntelligenceExtraction = {
      extractionId: 'ext_600',
      versionId,
      aggregateType: 'job',
      aggregateId: 'job_600',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'job_v1',
      sourceVersion: 1,
      provider: 'google_genai',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: validHash, encoding: 'gzip', originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_600', createdAt: new Date().toISOString() },
      structuredCandidate: { category: 'Heating', problem: 'Boiler Error' },
      evidenceIds: ['ev_ai_claim_1'],
      confidence,
      provenance,
    };

    await expect(
      store.persistOutput({
        db,
        aggregateType: 'job',
        aggregateId: 'job_600',
        versionId,
        extraction,
        event: { eventId: 'ie_600', aggregateType: 'job', aggregateId: 'job_600' } as any,
        summaryProjection: { jobId: 'job_600' },
      })
    ).rejects.toThrow(/Evidence 'ev_ai_claim_1' is an AI-generated assertion. AI outputs cannot satisfy their own evidence requirement/);
  });

  it('Step 19: Reference-only evidence -> accepted when valid, rejected when invalid', async () => {
    // Valid reference-only evidence (e.g. remote cloud storage URL or inspection report URI)
    await seedEvidence({
      evidenceId: 'ev_ref_valid',
      aggregateType: 'job',
      aggregateId: 'job_700',
      sourceRef: 'https://storage.googleapis.com/anytrader-inspections/report_700.pdf',
      integrityStatus: 'reference_only',
      verified: false,
      contentHash: '',
      byteSize: 0,
    });

    const versionId = buildVersionId('job', 'job_700', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

    const extraction: IntelligenceExtraction = {
      extractionId: 'ext_700',
      versionId,
      aggregateType: 'job',
      aggregateId: 'job_700',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'job_v1',
      sourceVersion: 1,
      provider: 'google_genai',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: validHash, encoding: 'gzip', originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_700', createdAt: new Date().toISOString() },
      structuredCandidate: { category: 'Glazing', problem: 'Cracked Window' },
      evidenceIds: ['ev_ref_valid'],
      confidence,
      provenance,
    };

    const res = await store.persistOutput({
      db,
      aggregateType: 'job',
      aggregateId: 'job_700',
      versionId,
      extraction,
      event: { eventId: 'ie_700', aggregateType: 'job', aggregateId: 'job_700' } as any,
      summaryProjection: { jobId: 'job_700' },
    });
    expect(res.isNew).toBe(true);

    // Invalid reference-only evidence: falsely claims verified = true
    await seedEvidence({
      evidenceId: 'ev_ref_false_verified',
      aggregateType: 'job',
      aggregateId: 'job_701',
      sourceRef: 'https://storage.googleapis.com/test.pdf',
      integrityStatus: 'reference_only',
      verified: true, // ILLEGAL
    });

    const versionId2 = buildVersionId('job', 'job_701', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');
    const extraction2: IntelligenceExtraction = {
      ...extraction,
      aggregateId: 'job_701',
      versionId: versionId2,
      evidenceIds: ['ev_ref_false_verified'],
    };

    await expect(
      store.persistOutput({
        db,
        aggregateType: 'job',
        aggregateId: 'job_701',
        versionId: versionId2,
        extraction: extraction2,
        event: { eventId: 'ie_701', aggregateType: 'job', aggregateId: 'job_701' } as any,
        summaryProjection: { jobId: 'job_701' },
      })
    ).rejects.toThrow(/Reference-only evidence 'ev_ref_false_verified' cannot be marked as verified bytes/);
  });

  it('Step 20: Structured data evidence -> accepted when valid', async () => {
    await seedEvidence({
      evidenceId: 'ev_struct_data_1',
      aggregateType: 'job',
      aggregateId: 'job_800',
      evidenceType: 'diagnostic_code',
      evidenceCategory: 'STRUCTURED_DATA',
      integrityStatus: 'verified',
      verified: true,
      contentHash: validHash,
      byteSize: 128,
    });

    const versionId = buildVersionId('job', 'job_800', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');

    const extraction: IntelligenceExtraction = {
      extractionId: 'ext_800',
      versionId,
      aggregateType: 'job',
      aggregateId: 'job_800',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'job_v1',
      sourceVersion: 1,
      provider: 'google_genai',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: validHash, encoding: 'gzip', originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_800', createdAt: new Date().toISOString() },
      structuredCandidate: { category: 'Electrical', problem: 'Fault Code E04' },
      evidenceIds: ['ev_struct_data_1'],
      confidence,
      provenance,
    };

    const res = await store.persistOutput({
      db,
      aggregateType: 'job',
      aggregateId: 'job_800',
      versionId,
      extraction,
      event: { eventId: 'ie_800', aggregateType: 'job', aggregateId: 'job_800' } as any,
      summaryProjection: { jobId: 'job_800' },
    });
    expect(res.isNew).toBe(true);
  });

  it('Step 21: Fail-closed when Firestore database is unavailable or null', async () => {
    const extraction: any = {
      aggregateType: 'job',
      aggregateId: 'job_null_db',
      evidenceIds: ['ev_some_id'],
    };

    await expect(
      validator.validateLineage(extraction, null)
    ).rejects.toThrow(/Firestore database is not configured or ready. Operational failure \(Fail Closed\)/);
  });

  it('Step 23: Tampered or invalid verified evidence (malformed contentHash, byteSize <= 0) -> rejected', async () => {
    // Missing contentHash
    await seedEvidence({
      evidenceId: 'ev_bad_hash',
      aggregateType: 'job',
      aggregateId: 'job_900',
      integrityStatus: 'verified',
      verified: true,
      contentHash: 'short_invalid_hash',
      byteSize: 100,
    });

    const versionId = buildVersionId('job', 'job_900', 1, 'v8.1', 'gemini-3.7-flash', 'job_v1', '1.0.0');
    const extraction: any = {
      aggregateType: 'job',
      aggregateId: 'job_900',
      versionId,
      evidenceIds: ['ev_bad_hash'],
    };

    await expect(
      validator.validateLineage(extraction, db)
    ).rejects.toThrow(/missing or malformed 64-character SHA-256 contentHash/);

    // byteSize <= 0
    await seedEvidence({
      evidenceId: 'ev_bad_size',
      aggregateType: 'job',
      aggregateId: 'job_901',
      integrityStatus: 'verified',
      verified: true,
      contentHash: validHash,
      byteSize: 0,
    });

    const extraction2: any = {
      aggregateType: 'job',
      aggregateId: 'job_901',
      versionId,
      evidenceIds: ['ev_bad_size'],
    };

    await expect(
      validator.validateLineage(extraction2, db)
    ).rejects.toThrow(/byteSize must be greater than zero/);
  });

  it('Step 24: Empty evidence list ("No evidence, no assertion") -> rejected', async () => {
    const extraction: any = {
      aggregateType: 'job',
      aggregateId: 'job_empty_ev',
      evidenceIds: [],
    };

    await expect(
      validator.validateLineage(extraction, db)
    ).rejects.toThrow(/No evidence provided: An intelligence extraction cannot be persisted without evidence references/);
  });

  it('Step 25: Composite/rollup property intelligence with constituent job evidence -> accepted when linked, rejected when unlinked', async () => {
    // 1. Evidence originating from a job at prop_100, explicitly linked in sourceReference
    await seedEvidence({
      evidenceId: 'ev_job_at_property',
      aggregateType: 'job',
      aggregateId: 'job_part_of_prop_100',
      sourceReference: { propertyId: 'prop_100' },
      sourceVersion: 1,
    });

    const versionId = buildVersionId('property', 'prop_100', 1, 'v8.1', 'gemini-3.7-flash', 'prop_v1', '1.0.0');

    const propertyExtraction: IntelligenceExtraction = {
      extractionId: 'ext_prop_100',
      versionId,
      aggregateType: 'property',
      aggregateId: 'prop_100',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'gemini-3.7-flash',
      promptVersion: 'prop_v1',
      sourceVersion: 1,
      provider: 'google_genai',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: validHash, encoding: 'gzip', originalBytes: 50, compressedBytes: 50, compressionRatio: 1, schemaVersion: '1.0.0', storagePath: 'sp_p100', createdAt: new Date().toISOString() },
      structuredCandidate: { overallHealthScore: 88 },
      evidenceIds: ['ev_job_at_property'],
      confidence,
      provenance,
    };

    const propertySummary: PropertyIntelligence = {
      propertyId: 'prop_100',
      currentVersionId: versionId,
      overallHealthScore: 88,
      buildingComponents: [],
      observedConditions: [],
      recommendedInterventions: [],
      derivedFromJobIds: ['job_part_of_prop_100'],
      evidenceIds: ['ev_job_at_property'],
      confidence,
      provenance,
      pipelineVersion: 'v8.1',
      updatedAt: new Date().toISOString(),
    };

    // Linked composite evidence should succeed
    const res = await store.persistOutput({
      db,
      aggregateType: 'property',
      aggregateId: 'prop_100',
      versionId,
      extraction: propertyExtraction,
      event: { eventId: 'ie_prop_100', aggregateType: 'property', aggregateId: 'prop_100' } as any,
      summaryProjection: propertySummary,
    });
    expect(res.isNew).toBe(true);

    // 2. Unlinked job evidence: Evidence from job at prop_999, NOT linked to prop_100
    await seedEvidence({
      evidenceId: 'ev_unlinked_job',
      aggregateType: 'job',
      aggregateId: 'job_other_prop',
      sourceReference: { propertyId: 'prop_999' },
    });

    const unlinkedExtraction: IntelligenceExtraction = {
      ...propertyExtraction,
      extractionId: 'ext_prop_unlinked',
      evidenceIds: ['ev_unlinked_job'],
    };

    await expect(
      store.persistOutput({
        db,
        aggregateType: 'property',
        aggregateId: 'prop_100',
        versionId: 'ver_unlinked',
        extraction: unlinkedExtraction,
        event: { eventId: 'ie_unlinked', aggregateType: 'property', aggregateId: 'prop_100' } as any,
        summaryProjection: { propertyId: 'prop_100' },
      })
    ).rejects.toThrow(/Incompatible cross-aggregate relationship/);
  });
});
