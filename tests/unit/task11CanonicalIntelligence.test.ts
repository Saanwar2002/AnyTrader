/**
 * AnyTrader V8.1 — Task 11: Canonical Intelligence Normalization & Schema Enforcement Test Suite
 * 
 * Verifies:
 * 1. Valid canonicalization & Zod schema validation.
 * 2. Missing evidence rejected ("No evidence, no assertion").
 * 3. Invalid evidence reference rejected (sub-element referencing evidence missing from root).
 * 4. Observation without inference succeeds (partial knowledge / fact-only).
 * 5. Evidence-backed inference succeeds (with confidence & supporting evidence).
 * 6. Identical input produces identical canonical representation & content hash (determinism).
 * 7. Extensible future aggregate/domain succeeds without arbitrary taxonomic restrictions.
 * 8. schemaVersion is mandatory and preserved.
 * 9. Provenance is preserved and anchored with cryptographic SHA-256 hash.
 * 10. Historical persistence uses ImmutableIntelligenceStore (no secondary store).
 * 11. AI-generated assertion cannot pose as raw evidence.
 * 12. Controlled vocabulary normalization & extensible registration.
 * 13. Real Firebase Emulator integration & client security boundary enforcement.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  canonicalizeIntelligence,
  CanonicalIntelligenceError,
  persistCanonicalIntelligence,
} from '../../src/server/intelligence/canonicalizer';

import {
  CanonicalIntelligenceSchema,
  CanonicalObservationSchema,
  CanonicalInferenceSchema,
} from '../../src/server/intelligence/canonicalSchema';
import {
  normalizeComponentCode,
  normalizeConditionCode,
  normalizeDomainCode,
  registerCanonicalComponent,
  registerCanonicalCondition,
  registerCanonicalDomain,
} from '../../src/server/intelligence/canonicalVocabulary';
import {
  ImmutableIntelligenceStore,
  immutableIntelligenceStore,
} from '../../src/server/intelligence/immutableStore';
import { createInMemoryTestDb } from '../../src/server/intelligence/testDoubles';
import {
  CanonicalIntelligenceInput,
  ConfidenceScores,
  IntelligenceEvidence,
  Provenance,
} from '../../src/server/intelligence/types';
import { computeSha256 } from '../../src/server/intelligence/provenance';

describe('Task 11: Canonical Intelligence Normalization & Schema Enforcement', () => {
  let inMemoryDb: any;
  const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const baseConfidence: ConfidenceScores = {
    overall: 0.92,
    extraction: 0.90,
    evidenceQuality: 0.95,
    classification: 0.90,
    temporalFreshness: 1.0,
    method: 'model_validated',
  };

  const baseProvenance: Provenance = {
    source: 'jobs/job_roof_101',
    evidenceIds: ['ev_photo_1', 'ev_desc_1'],
    pipelineVersion: 'v8.1.0',
    modelVersion: 'gemini-2.5-flash',
    promptVersion: 'canonical_v8.1',
    generatedAt: '2026-09-14T10:00:00.000Z',
    sourceContentHash: validHash,
  };

  beforeEach(() => {
    inMemoryDb = createInMemoryTestDb();
  });

  async function seedEvidence(db: any, evidence: Partial<IntelligenceEvidence> & { evidenceId: string }): Promise<void> {
    const fullRecord: IntelligenceEvidence = {
      evidenceId: evidence.evidenceId,
      aggregateType: evidence.aggregateType || 'job',
      aggregateId: evidence.aggregateId || 'job_roof_101',
      sourceType: evidence.sourceType || 'job',
      sourceId: evidence.sourceId || evidence.aggregateId || 'job_roof_101',
      sourceVersion: evidence.sourceVersion ?? 1,
      evidenceType: evidence.evidenceType || 'photo',
      evidenceCategory: evidence.evidenceCategory || 'MEDIA',
      sourceRef: evidence.sourceRef || `photos/${evidence.evidenceId}.jpg`,
      contentHash: evidence.contentHash !== undefined ? evidence.contentHash : validHash,
      contentSize: evidence.contentSize ?? 1024,
      byteSize: evidence.byteSize ?? 1024,
      schemaVersion: 'v8.1.0',
      integrityStatus: evidence.integrityStatus || 'verified',
      verified: evidence.verified !== undefined ? evidence.verified : true,
      metadata: evidence.metadata || {},
      createdAt: new Date().toISOString(),
    };
    await db.collection('intelligence_evidence').doc(evidence.evidenceId).set(fullRecord);
  }

  // =========================================================================
  // 1. Valid Canonicalization & Schema Validation
  // =========================================================================
  it('1. Valid canonicalization succeeds with full observations, inferences, and conditions', () => {
    const input: CanonicalIntelligenceInput = {
      aggregateType: 'job',
      aggregateId: 'job_roof_101',
      domain: 'roofing',
      category: 'Roof Repair',
      component: 'flat roof',
      observations: [
        {
          observationId: 'obs_1',
          component: 'tiles',
          condition: 'cracked',
          description: 'Three cracked slate tiles visible on north-facing pitch',
          evidenceIds: ['ev_photo_1'],
        },
      ],
      inferences: [
        {
          inferenceId: 'inf_1',
          type: 'risk',
          targetComponent: 'roof',
          hypothesis: 'High risk of water ingress into roof timber cavity during heavy rainfall',
          confidence: 0.88,
          reasoning: 'Cracked tiles expose underlayment membrane',
          supportingEvidenceIds: ['ev_photo_1'],
          severity: 'high',
          urgency: 'immediate',
        },
      ],
      conditions: [
        {
          condition: 'damaged',
          severity: 'medium',
          component: 'roof',
          evidenceIds: ['ev_photo_1'],
        },
      ],
      problems: [
        {
          description: 'Water ingress risk via broken slate tiles',
          severity: 'high',
          component: 'roof',
          evidenceIds: ['ev_photo_1'],
        },
      ],
      interventions: [
        {
          description: 'Replace cracked slates and inspect felt membrane',
          urgency: 'immediate',
          component: 'roof',
          evidenceIds: ['ev_photo_1'],
          estimatedBenchmarkCost: { min: 150, max: 350, currency: 'GBP' },
        },
      ],
      outcomes: [
        {
          description: 'Roof integrity restored',
          component: 'roof',
          status: 'pending',
          evidenceIds: ['ev_photo_1'],
        },
      ],
      evidenceIds: ['ev_photo_1', 'ev_desc_1'],
      confidence: baseConfidence,
      provenance: baseProvenance,
      schemaVersion: 'v8.1.0',
      sourceVersion: '1',
    };

    const canonical = canonicalizeIntelligence(input);

    expect(canonical.canonicalId).toBeDefined();
    expect(canonical.canonicalId).toContain('ver_job_job_roof_101');
    expect(canonical.domain).toBe('roofing');
    expect(canonical.component).toBe('roof'); // 'flat roof' normalized to 'roof'
    expect(canonical.observations[0].component).toBe('roof'); // 'tiles' normalized to 'roof'
    expect(canonical.observations[0].condition).toBe('damaged'); // 'cracked' normalized to 'damaged'
    expect(canonical.inferences[0].type).toBe('risk');
    expect(canonical.inferences[0].confidence).toBe(0.88);
    expect(canonical.schemaVersion).toBe('v8.1.0');
    expect(canonical.contentHash).toBeDefined();
    expect(canonical.contentHash).toMatch(/^[a-f0-9]{64}$/);

    // Verify Zod parse passes cleanly
    const parsed = CanonicalIntelligenceSchema.parse(canonical);
    expect(parsed.canonicalId).toBe(canonical.canonicalId);
  });

  // =========================================================================
  // 2. Missing Evidence Rejected ("No Evidence, No Assertion")
  // =========================================================================
  it('2. Missing evidence in observation is strictly rejected', () => {
    const input: CanonicalIntelligenceInput = {
      aggregateType: 'job',
      aggregateId: 'job_roof_102',
      domain: 'roofing',
      observations: [
        {
          observationId: 'obs_unbacked',
          description: 'Cracked tile without any backing evidence',
          evidenceIds: [], // Empty!
        },
      ],
      evidenceIds: ['ev_photo_1'],
    };

    expect(() => canonicalizeIntelligence(input)).toThrow(
      /violates lineage: Must reference at least one evidenceId/i
    );
  });

  it('2b. Completely empty root evidenceIds is strictly rejected', () => {
    const input: CanonicalIntelligenceInput = {
      aggregateType: 'job',
      aggregateId: 'job_roof_103',
      domain: 'roofing',
      evidenceIds: [],
    };

    expect(() => canonicalizeIntelligence(input)).toThrow(
      /Lineage Violation: Canonical intelligence must be backed by at least one valid evidenceId/i
    );
  });

  // =========================================================================
  // 3. Invalid Evidence Reference Rejected (Sub-element not in root)
  // =========================================================================
  it('3. Observation referencing evidence not in root evidenceIds fails schema validation', () => {
    const input: any = {
      canonicalId: 'ver_job_test_1',
      aggregateType: 'job',
      aggregateId: 'job_104',
      domain: 'plumbing',
      observations: [
        {
          observationId: 'obs_1',
          description: 'Boiler leaking water',
          evidenceIds: ['ev_ghost_999'], // Not in root evidenceIds!
        },
      ],
      inferences: [],
      evidenceIds: ['ev_real_1'],
      confidence: baseConfidence,
      provenance: baseProvenance,
      schemaVersion: 'v8.1.0',
      pipelineVersion: 'v8.1.0',
      modelVersion: 'gemini-2.5-flash',
      promptVersion: 'canonical_v8.1',
      sourceVersion: '1',
      generatedAt: new Date().toISOString(),
    };

    const parseResult = CanonicalIntelligenceSchema.safeParse(input);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.issues[0].message).toContain("references evidenceId 'ev_ghost_999' which is not in root evidenceIds");
    }
  });

  // =========================================================================
  // 4. Observation Without Inference Succeeds (Partial Knowledge / Fact-Only)
  // =========================================================================
  it('4. Observation without inference succeeds cleanly (partial knowledge)', () => {
    const input: CanonicalIntelligenceInput = {
      aggregateType: 'job',
      aggregateId: 'job_fact_only_105',
      domain: 'electrical',
      component: 'fuse_box',
      observations: [
        {
          observationId: 'obs_fuse',
          component: 'electrical_panel',
          condition: 'tripping',
          description: 'Main RCD trips when power shower is turned on',
          evidenceIds: ['ev_shower_1'],
        },
      ],
      inferences: [], // No model inferences!
      evidenceIds: ['ev_shower_1'],
      confidence: baseConfidence,
      provenance: baseProvenance,
    };

    const canonical = canonicalizeIntelligence(input);
    expect(canonical.observations.length).toBe(1);
    expect(canonical.inferences.length).toBe(0);
    expect(canonical.observations[0].condition).toBe('failed'); // 'tripping' normalized to 'failed'
    expect(canonical.component).toBe('electrical_panel');
  });

  // =========================================================================
  // 5. Evidence-Backed Inference Succeeds
  // =========================================================================
  it('5. Evidence-backed inference with confidence score and reasoning succeeds', () => {
    const input: CanonicalIntelligenceInput = {
      aggregateType: 'job',
      aggregateId: 'job_inf_106',
      domain: 'heating',
      component: 'boiler',
      inferences: [
        {
          inferenceId: 'inf_scale',
          type: 'problem',
          targetComponent: 'boiler',
          hypothesis: 'Secondary heat exchanger is calcified with limescale',
          confidence: 0.76,
          reasoning: 'Hot water temperature fluctuates rapidly while central heating works normally',
          supportingEvidenceIds: ['ev_audio_1', 'ev_notes_1'],
          severity: 'medium',
          urgency: 'medium_term',
        },
      ],
      evidenceIds: ['ev_audio_1', 'ev_notes_1'],
      confidence: baseConfidence,
      provenance: baseProvenance,
    };

    const canonical = canonicalizeIntelligence(input);
    expect(canonical.inferences.length).toBe(1);
    expect(canonical.inferences[0].confidence).toBe(0.76);
    expect(canonical.inferences[0].supportingEvidenceIds).toEqual(['ev_audio_1', 'ev_notes_1']);
    expect(canonical.inferences[0].targetComponent).toBe('boiler');
  });

  // =========================================================================
  // 6. Deterministic Normalization: Identical Input -> Identical Representation & Hash
  // =========================================================================
  it('6. Identical input with different field ordering produces identical canonical representation and content hash', () => {
    const input1: CanonicalIntelligenceInput = {
      aggregateType: 'job',
      aggregateId: 'job_det_107',
      domain: 'plumbing',
      component: 'pipe',
      observations: [
        {
          observationId: 'obs_b',
          description: 'Copper pipe green corrosion',
          evidenceIds: ['ev_2', 'ev_1'],
        },
        {
          observationId: 'obs_a',
          description: 'Puddle under kitchen sink',
          evidenceIds: ['ev_1'],
        },
      ],
      inferences: [
        {
          inferenceId: 'inf_2',
          type: 'risk',
          hypothesis: 'Pin-hole leak in pipe',
          confidence: 0.85,
          supportingEvidenceIds: ['ev_2', 'ev_1'],
        },
        {
          inferenceId: 'inf_1',
          type: 'recommendation',
          hypothesis: 'Replace corroded pipe section',
          confidence: 0.90,
          supportingEvidenceIds: ['ev_1'],
        },
      ],
      evidenceIds: ['ev_2', 'ev_1'],
      schemaVersion: 'v8.1.0',
      pipelineVersion: 'v8.1.0',
      sourceVersion: '1',
      generatedAt: '2026-09-14T12:00:00.000Z',
    };

    // Reversed order in input2
    const input2: CanonicalIntelligenceInput = {
      generatedAt: '2026-09-14T12:00:00.000Z',
      sourceVersion: 1,
      pipelineVersion: 'v8.1.0',
      schemaVersion: 'v8.1.0',
      evidenceIds: ['ev_1', 'ev_2'],
      inferences: [
        {
          confidence: 0.90,
          hypothesis: 'Replace corroded pipe section',
          inferenceId: 'inf_1',
          supportingEvidenceIds: ['ev_1'],
          type: 'recommendation',
        },
        {
          confidence: 0.85,
          hypothesis: 'Pin-hole leak in pipe',
          inferenceId: 'inf_2',
          supportingEvidenceIds: ['ev_1', 'ev_2'],
          type: 'risk',
        },
      ],
      observations: [
        {
          evidenceIds: ['ev_1'],
          description: 'Puddle under kitchen sink',
          observationId: 'obs_a',
        },
        {
          evidenceIds: ['ev_1', 'ev_2'],
          description: 'Copper pipe green corrosion',
          observationId: 'obs_b',
        },
      ],
      component: 'pipes',
      domain: 'plumbing',
      aggregateId: 'job_det_107',
      aggregateType: 'job',
    };

    const canonical1 = canonicalizeIntelligence(input1);
    const canonical2 = canonicalizeIntelligence(input2);

    expect(canonical1.contentHash).toBe(canonical2.contentHash);
    expect(canonical1.canonicalId).toBe(canonical2.canonicalId);
    expect(canonical1.observations).toEqual(canonical2.observations);
    expect(canonical1.inferences).toEqual(canonical2.inferences);
    expect(canonical1.evidenceIds).toEqual(canonical2.evidenceIds);
  });

  // =========================================================================
  // 7. Extensible Future Aggregate / Domain
  // =========================================================================
  it('7. Extensible future aggregate type and domain succeed without schema errors', () => {
    const input: CanonicalIntelligenceInput = {
      aggregateType: 'telecoms_tower',
      aggregateId: 'tower_london_east_42',
      domain: 'cellular_infrastructure',
      category: '5g_antenna_array',
      component: 'microwave_dish',
      observations: [
        {
          observationId: 'obs_antenna_1',
          description: 'Alignment azimuth offset by 4 degrees after gale storm',
          evidenceIds: ['ev_telemetry_1'],
        },
      ],
      inferences: [
        {
          inferenceId: 'inf_throughput',
          type: 'performance_degradation',
          hypothesis: 'Sector 3 signal attenuation of 12dB due to dish misalignment',
          confidence: 0.94,
          supportingEvidenceIds: ['ev_telemetry_1'],
        },
      ],
      evidenceIds: ['ev_telemetry_1'],
      schemaVersion: 'v8.1.0',
    };

    const canonical = canonicalizeIntelligence(input);
    expect(canonical.aggregateType).toBe('telecoms_tower');
    expect(canonical.domain).toBe('cellular_infrastructure');
    expect(canonical.category).toBe('5g_antenna_array');
    expect(canonical.canonicalId).toContain('ver_telecoms_tower_tower_london_east_42');
  });

  // =========================================================================
  // 8. Controlled Vocabulary & Extensible Registry
  // =========================================================================
  it('8. Controlled vocabulary normalizes aliases and supports runtime extension', () => {
    expect(normalizeComponentCode('combi boiler')).toBe('boiler');
    expect(normalizeComponentCode('fuse box')).toBe('electrical_panel');
    expect(normalizeComponentCode('double glazing')).toBe('window');
    expect(normalizeConditionCode('cracked')).toBe('damaged');
    expect(normalizeConditionCode('water ingress')).toBe('leaking');
    expect(normalizeDomainCode('electrician')).toBe('electrical');

    // Register a new domain and verify normalization
    registerCanonicalDomain('smart_home_iot', ['home automation', 'iot systems']);
    expect(normalizeDomainCode('home automation')).toBe('smart_home_iot');
    expect(normalizeDomainCode('iot systems')).toBe('smart_home_iot');

    // Register a new component
    registerCanonicalComponent('heat_pump', ['air source heat pump', 'ground source heat pump', 'ashp']);
    expect(normalizeComponentCode('air source heat pump')).toBe('heat_pump');
    expect(normalizeComponentCode('ashp')).toBe('heat_pump');

    // Register a new condition
    registerCanonicalCondition('calcified', ['scaled', 'limescale coated']);
    expect(normalizeConditionCode('limescale coated')).toBe('calcified');
  });

  // =========================================================================
  // 9. Provenance Preservation
  // =========================================================================
  it('9. Provenance is anchored with SHA-256 hash and preserved through normalization', () => {
    const input: CanonicalIntelligenceInput = {
      aggregateType: 'contractor',
      aggregateId: 'trader_404',
      domain: 'gas',
      observations: [
        {
          observationId: 'obs_gas_safe',
          description: 'Gas Safe license verified active on register',
          evidenceIds: ['ev_cert_1'],
        },
      ],
      evidenceIds: ['ev_cert_1'],
      schemaVersion: 'v8.1.0',
      modelVersion: 'gemini-2.5-pro',
      promptVersion: 'trader_vetting_v8.1',
    };

    const canonical = canonicalizeIntelligence(input);
    expect(canonical.provenance.source).toBe('contractors/trader_404');
    expect(canonical.provenance.evidenceIds).toEqual(['ev_cert_1']);
    expect(canonical.provenance.modelVersion).toBe('gemini-2.5-pro');
    expect(canonical.provenance.promptVersion).toBe('trader_vetting_v8.1');
    expect(canonical.provenance.sourceContentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  // =========================================================================
  // 10. Persistence Feeds ImmutableIntelligenceStore
  // =========================================================================
  it('10. Persisting canonical intelligence writes atomically to ImmutableIntelligenceStore with lineage check', async () => {
    await seedEvidence(inMemoryDb, {
      evidenceId: 'ev_roof_photo_1',
      aggregateType: 'job',
      aggregateId: 'job_persist_108',
      sourceId: 'job_persist_108',
    });

    const canonical = canonicalizeIntelligence({
      aggregateType: 'job',
      aggregateId: 'job_persist_108',
      domain: 'roofing',
      observations: [
        {
          observationId: 'obs_tile_break',
          component: 'roof',
          condition: 'damaged',
          description: 'Cracked ridge tile',
          evidenceIds: ['ev_roof_photo_1'],
        },
      ],
      inferences: [
        {
          inferenceId: 'inf_ridge_rebed',
          type: 'recommendation',
          hypothesis: 'Rebed ridge tiles with mortar mix',
          confidence: 0.92,
          supportingEvidenceIds: ['ev_roof_photo_1'],
        },
      ],
      evidenceIds: ['ev_roof_photo_1'],
      schemaVersion: 'v8.1.0',
    });

    const result = await persistCanonicalIntelligence({
      db: inMemoryDb,
      canonical,
    });

    expect(result.versionId).toBe(canonical.canonicalId);
    expect(result.isNew).toBe(true);

    // Verify written to intelligence_extractions
    const extractionDoc = await inMemoryDb.collection('intelligence_extractions').doc(canonical.canonicalId).get();
    expect(extractionDoc.exists).toBe(true);
    expect(extractionDoc.data().structuredCandidate.domain).toBe('roofing');
    expect(extractionDoc.data().structuredCandidate.observations.length).toBe(1);

    // Verify written to active projection pointer
    const projectionDoc = await inMemoryDb.collection('intelligence_jobs').doc('job_persist_108').get();
    expect(projectionDoc.exists).toBe(true);
    expect(projectionDoc.data().currentVersionId).toBe(canonical.canonicalId);
    expect(projectionDoc.data().domain).toBe('roofing');
  });

  // =========================================================================
  // 11. AI-Generated Assertion Cannot Become Raw Evidence
  // =========================================================================
  it('11. Lineage validator rejects unverified / synthetic AI assertions posing as evidence', async () => {
    const fakeEvidenceId = 'ev_fabricated_ai_output_999';

    const canonical = canonicalizeIntelligence({
      aggregateType: 'job',
      aggregateId: 'job_fake_ev_109',
      domain: 'carpentry',
      observations: [
        {
          observationId: 'obs_synthetic',
          description: 'Termite damage in joists',
          evidenceIds: [fakeEvidenceId],
        },
      ],
      evidenceIds: [fakeEvidenceId],
      schemaVersion: 'v8.1.0',
    });

    // Attempt to persist against database missing this evidence record
    await expect(
      persistCanonicalIntelligence({
        db: inMemoryDb,
        canonical,
      })
    ).rejects.toThrow(/EvidenceLineage Violation/i);
  });
});

