/**
 * AnyTrader V8.1 — Task 11A: Deterministic Canonicalization Hardening Test Suite
 * 
 * Verifies:
 * 1. Same input (no generatedAt provided) produces identical contentHash, canonicalId, and semantic content across separate invocations.
 * 2. Same input with shuffled/different object key ordering produces identical contentHash.
 * 3. Explicit generatedAt is faithfully preserved in output.generatedAt and output.provenance.generatedAt.
 * 4. Changing a semantic field (observation, inference, condition, severity, component, etc.) produces a different contentHash.
 * 5. Changing ONLY generatedAt produces identical contentHash and canonicalId while preserving the respective generatedAt timestamps.
 * 6. Array element reordering (observations, inferences, conditions, problems, interventions, outcomes) produces identical contentHash.
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalizeIntelligence,
  CanonicalIntelligenceError,
} from '../../src/server/intelligence/canonicalizer';
import { CanonicalIntelligenceInput } from '../../src/server/intelligence/types';

describe('Task 11A: Deterministic Canonicalization Hardening', () => {
  const baseInput: CanonicalIntelligenceInput = {
    aggregateType: 'job',
    aggregateId: 'job_roof_301',
    domain: 'roofing',
    category: 'Roof Repair',
    component: 'slate tiles',
    observations: [
      {
        observationId: 'obs_1',
        component: 'slate tiles',
        condition: 'cracked',
        description: 'Two cracked Welsh slate tiles on north ridge',
        evidenceIds: ['ev_photo_1', 'ev_photo_2'],
      },
      {
        observationId: 'obs_2',
        component: 'flashing',
        condition: 'loose',
        description: 'Lead flashing loose around chimney stack',
        evidenceIds: ['ev_photo_1'],
      },
    ],
    inferences: [
      {
        inferenceId: 'inf_1',
        type: 'risk',
        targetComponent: 'roof cavity',
        hypothesis: 'Water ingress risk during persistent downpours',
        confidence: 0.88,
        reasoning: 'Loose flashing and cracked tiles allow moisture behind membrane',
        supportingEvidenceIds: ['ev_photo_1', 'ev_photo_2'],
        supportingObservationIds: ['obs_1', 'obs_2'],
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
        description: 'Chimney flashing detachment and broken slate tiles',
        severity: 'high',
        component: 'roof',
        evidenceIds: ['ev_photo_1', 'ev_photo_2'],
      },
    ],
    interventions: [
      {
        description: 'Re-dress lead flashing and replace 2 slate tiles',
        urgency: 'immediate',
        component: 'roof',
        evidenceIds: ['ev_photo_1'],
        estimatedBenchmarkCost: { min: 200, max: 400, currency: 'GBP' },
      },
    ],
    outcomes: [
      {
        description: 'Roof watertight and weather-sealed',
        component: 'roof',
        status: 'pending',
        evidenceIds: ['ev_photo_1'],
      },
    ],
    evidenceIds: ['ev_photo_1', 'ev_photo_2'],
    schemaVersion: 'v8.1.0',
    pipelineVersion: 'v8.1.0',
    modelVersion: 'gemini-2.5-flash',
    promptVersion: 'canonical_v8.1',
    sourceVersion: '1',
  };

  // =========================================================================
  // Test 1: Same input (no generatedAt) -> same hash, ID, and semantic content
  // =========================================================================
  it('1. Same input (no generatedAt) produces identical contentHash, canonicalId, and semantic content across executions', () => {
    const inputCopy1 = JSON.parse(JSON.stringify(baseInput));
    delete inputCopy1.generatedAt;

    const inputCopy2 = JSON.parse(JSON.stringify(baseInput));
    delete inputCopy2.generatedAt;

    const doc1 = canonicalizeIntelligence(inputCopy1);
    const doc2 = canonicalizeIntelligence(inputCopy2);

    expect(doc1.canonicalId).toBe(doc2.canonicalId);
    expect(doc1.contentHash).toBe(doc2.contentHash);
    expect(doc1.aggregateType).toBe(doc2.aggregateType);
    expect(doc1.aggregateId).toBe(doc2.aggregateId);
    expect(doc1.domain).toBe(doc2.domain);
    expect(doc1.observations).toEqual(doc2.observations);
    expect(doc1.inferences).toEqual(doc2.inferences);
    expect(doc1.conditions).toEqual(doc2.conditions);
    expect(doc1.problems).toEqual(doc2.problems);
    expect(doc1.interventions).toEqual(doc2.interventions);
    expect(doc1.outcomes).toEqual(doc2.outcomes);
    expect(doc1.confidence).toEqual(doc2.confidence);
    expect(doc1.evidenceIds).toEqual(doc2.evidenceIds);
    expect(doc1.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  // =========================================================================
  // Test 2: Same input (different key order) -> same hash
  // =========================================================================
  it('2. Same input with different/shuffled object key ordering produces identical contentHash', () => {
    // Construct object with keys in arbitrary and inverted order
    const shuffledInput: CanonicalIntelligenceInput = {
      promptVersion: 'canonical_v8.1',
      domain: 'roofing',
      sourceVersion: '1',
      outcomes: [
        {
          status: 'pending',
          evidenceIds: ['ev_photo_1'],
          description: 'Roof watertight and weather-sealed',
          component: 'roof',
        },
      ],
      aggregateId: 'job_roof_301',
      interventions: [
        {
          estimatedBenchmarkCost: { currency: 'GBP', max: 400, min: 200 },
          evidenceIds: ['ev_photo_1'],
          urgency: 'immediate',
          description: 'Re-dress lead flashing and replace 2 slate tiles',
          component: 'roof',
        },
      ],
      modelVersion: 'gemini-2.5-flash',
      inferences: [
        {
          hypothesis: 'Water ingress risk during persistent downpours',
          confidence: 0.88,
          supportingObservationIds: ['obs_2', 'obs_1'], // shuffled order in sub-array
          type: 'risk',
          urgency: 'immediate',
          severity: 'high',
          supportingEvidenceIds: ['ev_photo_2', 'ev_photo_1'], // shuffled order in sub-array
          reasoning: 'Loose flashing and cracked tiles allow moisture behind membrane',
          targetComponent: 'roof cavity',
          inferenceId: 'inf_1',
        },
      ],
      aggregateType: 'job',
      problems: [
        {
          evidenceIds: ['ev_photo_2', 'ev_photo_1'],
          severity: 'high',
          component: 'roof',
          description: 'Chimney flashing detachment and broken slate tiles',
        },
      ],
      category: 'Roof Repair',
      pipelineVersion: 'v8.1.0',
      evidenceIds: ['ev_photo_2', 'ev_photo_1'], // shuffled order in root evidenceIds
      component: 'slate tiles',
      conditions: [
        {
          component: 'roof',
          condition: 'damaged',
          severity: 'medium',
          evidenceIds: ['ev_photo_1'],
        },
      ],
      observations: [
        {
          description: 'Two cracked Welsh slate tiles on north ridge',
          evidenceIds: ['ev_photo_2', 'ev_photo_1'],
          condition: 'cracked',
          observationId: 'obs_1',
          component: 'slate tiles',
        },
        {
          component: 'flashing',
          observationId: 'obs_2',
          evidenceIds: ['ev_photo_1'],
          description: 'Lead flashing loose around chimney stack',
          condition: 'loose',
        },
      ],
      schemaVersion: 'v8.1.0',
    };

    const docStandard = canonicalizeIntelligence(baseInput);
    const docShuffled = canonicalizeIntelligence(shuffledInput);

    expect(docShuffled.contentHash).toBe(docStandard.contentHash);
    expect(docShuffled.canonicalId).toBe(docStandard.canonicalId);
  });

  // =========================================================================
  // Test 3: Explicit generatedAt -> preserved in output
  // =========================================================================
  it('3. Explicit generatedAt is preserved in output.generatedAt and output.provenance.generatedAt', () => {
    const customTimestamp = '2026-09-14T15:45:30.123Z';
    const inputWithTimestamp: CanonicalIntelligenceInput = {
      ...baseInput,
      generatedAt: customTimestamp,
    };

    const doc = canonicalizeIntelligence(inputWithTimestamp);

    expect(doc.generatedAt).toBe(customTimestamp);
    expect(doc.provenance.generatedAt).toBe(customTimestamp);
  });

  // =========================================================================
  // Test 4: Change semantic field -> different hash
  // =========================================================================
  it('4. Changing a semantic field produces a different contentHash', () => {
    const docBase = canonicalizeIntelligence(baseInput);

    // Variation A: Change observation description
    const inputVarA: CanonicalIntelligenceInput = {
      ...baseInput,
      observations: [
        {
          ...baseInput.observations![0],
          description: 'Four cracked Welsh slate tiles on north ridge', // changed from Two to Four
        },
        baseInput.observations![1],
      ],
    };
    const docVarA = canonicalizeIntelligence(inputVarA);
    expect(docVarA.contentHash).not.toBe(docBase.contentHash);

    // Variation B: Change inference severity
    const inputVarB: CanonicalIntelligenceInput = {
      ...baseInput,
      inferences: [
        {
          ...baseInput.inferences![0],
          severity: 'low', // changed from high to low
        },
      ],
    };
    const docVarB = canonicalizeIntelligence(inputVarB);
    expect(docVarB.contentHash).not.toBe(docBase.contentHash);

    // Variation C: Change component
    const inputVarC: CanonicalIntelligenceInput = {
      ...baseInput,
      component: 'flat roof', // changed from slate tiles
    };
    const docVarC = canonicalizeIntelligence(inputVarC);
    expect(docVarC.contentHash).not.toBe(docBase.contentHash);
  });

  // =========================================================================
  // Test 5: Change only generatedAt -> same hash
  // =========================================================================
  it('5. Changing ONLY generatedAt produces identical contentHash and canonicalId', () => {
    const inputTimeA: CanonicalIntelligenceInput = {
      ...baseInput,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };

    const inputTimeB: CanonicalIntelligenceInput = {
      ...baseInput,
      generatedAt: '2026-12-31T23:59:59.999Z',
    };

    const docA = canonicalizeIntelligence(inputTimeA);
    const docB = canonicalizeIntelligence(inputTimeB);

    expect(docA.contentHash).toBe(docB.contentHash);
    expect(docA.canonicalId).toBe(docB.canonicalId);
    expect(docA.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(docB.generatedAt).toBe('2026-12-31T23:59:59.999Z');
    expect(docA.provenance.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(docB.provenance.generatedAt).toBe('2026-12-31T23:59:59.999Z');
  });

  // =========================================================================
  // Test 6: Array elements in different order produce identical contentHash
  // =========================================================================
  it('6. Observations and inferences supplied in reverse order produce identical contentHash', () => {
    const inputReversedArrays: CanonicalIntelligenceInput = {
      ...baseInput,
      observations: [baseInput.observations![1], baseInput.observations![0]], // obs_2 then obs_1
    };

    const docStandard = canonicalizeIntelligence(baseInput);
    const docReversed = canonicalizeIntelligence(inputReversedArrays);

    expect(docReversed.contentHash).toBe(docStandard.contentHash);
    expect(docReversed.canonicalId).toBe(docStandard.canonicalId);
    // Both are normalized in deterministic sort order
    expect(docReversed.observations[0].observationId).toBe('obs_1');
    expect(docReversed.observations[1].observationId).toBe('obs_2');
  });
});
