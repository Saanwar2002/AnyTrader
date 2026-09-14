/**
 * AnyTrader V8.1 — Canonical Intelligence Normalization & Schema Enforcement
 * 
 * Pipeline:
 * Authoritative Platform Data
 *        ↓
 * Evidence Registry
 *        ↓
 * Validated Evidence
 *        ↓
 * Canonical Intelligence (Deterministic Normalization + Schema Validation)
 *        ↓
 * Confidence + Provenance
 *        ↓
 * Immutable Intelligence Store (Atomic Firestore Transaction + Lineage Gate)
 *        ↓
 * Current Projection
 */

import { calculateConfidence } from './confidence';
import {
  normalizeComponentCode,
  normalizeConditionCode,
  normalizeDomainCode,
  sanitizeTerm,
} from './canonicalVocabulary';
import { CanonicalIntelligenceSchema } from './canonicalSchema';
import {
  buildProvenance,
  buildVersionId,
  computeSha256,
  computeStructuredDataHash,
  INTELLIGENCE_PIPELINE_VERSION,
  INTELLIGENCE_SCHEMA_VERSION,
} from './provenance';
import {
  CanonicalCondition,
  CanonicalInference,
  CanonicalIntelligence,
  CanonicalIntelligenceEvent,
  CanonicalIntelligenceInput,
  CanonicalIntervention,
  CanonicalObservation,
  CanonicalOutcome,
  CanonicalProblem,
  ConfidenceScores,
  IntelligenceExtraction,
  Provenance,
} from './types';
import { FirestoreDbLike, immutableIntelligenceStore, PersistIntelligenceResult } from './immutableStore';


export class CanonicalIntelligenceError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(`[CanonicalIntelligenceError] ${message}`);
    this.name = 'CanonicalIntelligenceError';
  }
}

/**
 * Deterministically normalizes, validates, and hashes a canonical intelligence payload.
 * Guarantee: Identical logical input produces identical canonical representation and content hash.
 */
export function canonicalizeIntelligence(input: CanonicalIntelligenceInput): CanonicalIntelligence {
  if (!input) {
    throw new CanonicalIntelligenceError('Input intelligence document cannot be null or undefined');
  }

  if (!input.aggregateType || typeof input.aggregateType !== 'string' || input.aggregateType.trim().length === 0) {
    throw new CanonicalIntelligenceError('aggregateType is required and must be non-empty');
  }

  if (!input.aggregateId || typeof input.aggregateId !== 'string' || input.aggregateId.trim().length === 0) {
    throw new CanonicalIntelligenceError('aggregateId is required and must be non-empty');
  }

  if (!input.domain || typeof input.domain !== 'string' || input.domain.trim().length === 0) {
    throw new CanonicalIntelligenceError('domain is required and must be non-empty');
  }

  const aggregateType = input.aggregateType.trim().toLowerCase();
  const aggregateId = input.aggregateId.trim();
  const domain = normalizeDomainCode(input.domain);
  const category = input.category ? sanitizeTerm(input.category) : undefined;
  const component = normalizeComponentCode(input.component);

  const schemaVersion = input.schemaVersion || INTELLIGENCE_SCHEMA_VERSION;
  const pipelineVersion = input.pipelineVersion || INTELLIGENCE_PIPELINE_VERSION;
  const modelVersion = input.modelVersion || 'gemini-2.5-flash';
  const promptVersion = input.promptVersion || 'canonical_v8.1';
  const sourceVersion = input.sourceVersion !== undefined ? String(input.sourceVersion) : '1';
  const generatedAt = input.generatedAt || new Date().toISOString();

  // 1. Gather all referenced evidence IDs across sub-records
  const referencedEvidenceSet = new Set<string>();
  if (Array.isArray(input.evidenceIds)) {
    for (const id of input.evidenceIds) {
      if (typeof id === 'string' && id.trim().length > 0) {
        referencedEvidenceSet.add(id.trim());
      }
    }
  }

  // 2. Normalize Observations
  const rawObservations = Array.isArray(input.observations) ? input.observations : [];
  const normalizedObservations: CanonicalObservation[] = rawObservations.map((obs, idx) => {
    if (!obs || typeof obs !== 'object') {
      throw new CanonicalIntelligenceError(`Observation at index ${idx} is invalid`);
    }
    const description = (obs.description || '').trim();
    if (!description) {
      throw new CanonicalIntelligenceError(`Observation at index ${idx} is missing required description`);
    }

    const obsEvIds = Array.isArray(obs.evidenceIds)
      ? Array.from(new Set(obs.evidenceIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))).sort()
      : [];

    if (obsEvIds.length === 0) {
      throw new CanonicalIntelligenceError(
        `Observation '${description.slice(0, 30)}' violates lineage: Must reference at least one evidenceId`
      );
    }

    for (const evId of obsEvIds) {
      referencedEvidenceSet.add(evId);
    }

    const obsComponent = normalizeComponentCode(obs.component);
    const obsCondition = normalizeConditionCode(obs.condition);

    // Deterministic observation ID
    const obsIdSeed = `${obsComponent || ''}:${obsCondition || ''}:${description}:${obsEvIds.join(',')}`;
    const observationId = obs.observationId && obs.observationId.trim().length > 0
      ? obs.observationId.trim()
      : `obs_${computeSha256(obsIdSeed).slice(0, 16)}`;

    return {
      observationId,
      component: obsComponent,
      condition: obsCondition,
      description,
      evidenceIds: obsEvIds,
      capturedAt: obs.capturedAt,
      sourceField: obs.sourceField ? obs.sourceField.trim() : undefined,
      metadata: obs.metadata,
    };
  });

  // Sort observations deterministically by observationId
  normalizedObservations.sort((a, b) => a.observationId.localeCompare(b.observationId));

  // 3. Normalize Inferences
  const rawInferences = Array.isArray(input.inferences) ? input.inferences : [];
  const normalizedInferences: CanonicalInference[] = rawInferences.map((inf, idx) => {
    if (!inf || typeof inf !== 'object') {
      throw new CanonicalIntelligenceError(`Inference at index ${idx} is invalid`);
    }
    const hypothesis = (inf.hypothesis || '').trim();
    if (!hypothesis) {
      throw new CanonicalIntelligenceError(`Inference at index ${idx} is missing required hypothesis statement`);
    }

    const infEvIds = Array.isArray(inf.supportingEvidenceIds)
      ? Array.from(new Set(inf.supportingEvidenceIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))).sort()
      : [];

    if (infEvIds.length === 0) {
      throw new CanonicalIntelligenceError(
        `Inference '${hypothesis.slice(0, 30)}' violates lineage: Must reference at least one supporting evidenceId`
      );
    }

    for (const evId of infEvIds) {
      referencedEvidenceSet.add(evId);
    }

    const targetComponent = normalizeComponentCode(inf.targetComponent);
    const infType = sanitizeTerm(inf.type) || 'risk';
    const confidence = typeof inf.confidence === 'number' ? Math.min(1.0, Math.max(0.0, inf.confidence)) : 0.5;

    const supportingObservationIds = Array.isArray(inf.supportingObservationIds)
      ? Array.from(new Set(inf.supportingObservationIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))).sort()
      : undefined;

    const infIdSeed = `${infType}:${targetComponent || ''}:${hypothesis}:${infEvIds.join(',')}`;
    const inferenceId = inf.inferenceId && inf.inferenceId.trim().length > 0
      ? inf.inferenceId.trim()
      : `inf_${computeSha256(infIdSeed).slice(0, 16)}`;

    return {
      inferenceId,
      type: infType,
      targetComponent,
      hypothesis,
      confidence: Number(confidence.toFixed(4)),
      reasoning: inf.reasoning ? inf.reasoning.trim() : undefined,
      supportingEvidenceIds: infEvIds,
      supportingObservationIds,
      severity: inf.severity,
      urgency: inf.urgency,
      metadata: inf.metadata,
    };
  });

  // Sort inferences deterministically by inferenceId
  normalizedInferences.sort((a, b) => a.inferenceId.localeCompare(b.inferenceId));

  // 4. Normalize Problems
  const rawProblems = Array.isArray(input.problems) ? input.problems : [];
  const normalizedProblems: CanonicalProblem[] = rawProblems.map((prob, idx) => {
    const description = (prob.description || '').trim();
    if (!description) {
      throw new CanonicalIntelligenceError(`Problem at index ${idx} is missing required description`);
    }
    const probEvIds = Array.isArray(prob.evidenceIds)
      ? Array.from(new Set(prob.evidenceIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))).sort()
      : [];
    if (probEvIds.length === 0) {
      throw new CanonicalIntelligenceError(`Problem '${description.slice(0, 30)}' violates lineage: Missing evidenceIds`);
    }
    for (const evId of probEvIds) {
      referencedEvidenceSet.add(evId);
    }
    return {
      problemCode: prob.problemCode ? sanitizeTerm(prob.problemCode) : undefined,
      description,
      severity: prob.severity,
      component: normalizeComponentCode(prob.component),
      evidenceIds: probEvIds,
      inferenceId: prob.inferenceId ? prob.inferenceId.trim() : undefined,
    };
  });
  normalizedProblems.sort((a, b) => a.description.localeCompare(b.description));

  // 5. Normalize Interventions
  const rawInterventions = Array.isArray(input.interventions) ? input.interventions : [];
  const normalizedInterventions: CanonicalIntervention[] = rawInterventions.map((interv, idx) => {
    const description = (interv.description || '').trim();
    if (!description) {
      throw new CanonicalIntelligenceError(`Intervention at index ${idx} is missing required description`);
    }
    const intervEvIds = Array.isArray(interv.evidenceIds)
      ? Array.from(new Set(interv.evidenceIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))).sort()
      : [];
    if (intervEvIds.length === 0) {
      throw new CanonicalIntelligenceError(`Intervention '${description.slice(0, 30)}' violates lineage: Missing evidenceIds`);
    }
    for (const evId of intervEvIds) {
      referencedEvidenceSet.add(evId);
    }
    return {
      interventionCode: interv.interventionCode ? sanitizeTerm(interv.interventionCode) : undefined,
      description,
      urgency: interv.urgency,
      component: normalizeComponentCode(interv.component),
      estimatedBenchmarkCost: interv.estimatedBenchmarkCost,
      evidenceIds: intervEvIds,
      inferenceId: interv.inferenceId ? interv.inferenceId.trim() : undefined,
    };
  });
  normalizedInterventions.sort((a, b) => a.description.localeCompare(b.description));

  // 6. Normalize Outcomes
  const rawOutcomes = Array.isArray(input.outcomes) ? input.outcomes : [];
  const normalizedOutcomes: CanonicalOutcome[] = rawOutcomes.map((outc, idx) => {
    const description = (outc.description || '').trim();
    if (!description) {
      throw new CanonicalIntelligenceError(`Outcome at index ${idx} is missing required description`);
    }
    const outcEvIds = Array.isArray(outc.evidenceIds)
      ? Array.from(new Set(outc.evidenceIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))).sort()
      : [];
    if (outcEvIds.length === 0) {
      throw new CanonicalIntelligenceError(`Outcome '${description.slice(0, 30)}' violates lineage: Missing evidenceIds`);
    }
    for (const evId of outcEvIds) {
      referencedEvidenceSet.add(evId);
    }
    return {
      outcomeCode: outc.outcomeCode ? sanitizeTerm(outc.outcomeCode) : undefined,
      description,
      component: normalizeComponentCode(outc.component),
      status: outc.status ? sanitizeTerm(outc.status) : undefined,
      evidenceIds: outcEvIds,
    };
  });
  normalizedOutcomes.sort((a, b) => a.description.localeCompare(b.description));

  // 7. Normalize Conditions
  const rawConditions = Array.isArray(input.conditions) ? input.conditions : [];
  const normalizedConditions: CanonicalCondition[] = rawConditions.map((cond, idx) => {
    const condition = normalizeConditionCode(cond.condition) || (cond.condition || '').trim();
    if (!condition) {
      throw new CanonicalIntelligenceError(`Condition at index ${idx} is missing required condition code`);
    }
    const condEvIds = Array.isArray(cond.evidenceIds)
      ? Array.from(new Set(cond.evidenceIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))).sort()
      : [];
    if (condEvIds.length === 0) {
      throw new CanonicalIntelligenceError(`Condition '${condition}' violates lineage: Missing evidenceIds`);
    }
    for (const evId of condEvIds) {
      referencedEvidenceSet.add(evId);
    }
    return {
      condition,
      severity: cond.severity,
      component: normalizeComponentCode(cond.component),
      evidenceIds: condEvIds,
    };
  });
  normalizedConditions.sort((a, b) => a.condition.localeCompare(b.condition));

  // 8. Consolidated Evidence Lineage Check
  const consolidatedEvidenceIds = Array.from(referencedEvidenceSet).sort();
  if (consolidatedEvidenceIds.length === 0) {
    throw new CanonicalIntelligenceError(
      'Lineage Violation: Canonical intelligence must be backed by at least one valid evidenceId ("No evidence, no assertion")'
    );
  }

  // 9. Confidence Computation (reuse existing multidimensional model)
  let confidence: ConfidenceScores;
  if (input.confidence && typeof input.confidence === 'object' && 'overall' in input.confidence) {
    confidence = {
      overall: Number(Number(input.confidence.overall).toFixed(4)),
      extraction: Number(Number(input.confidence.extraction || 0.8).toFixed(4)),
      evidenceQuality: Number(Number(input.confidence.evidenceQuality || 0.8).toFixed(4)),
      classification: Number(Number(input.confidence.classification || 0.8).toFixed(4)),
      temporalFreshness: Number(Number(input.confidence.temporalFreshness || 1.0).toFixed(4)),
      method: input.confidence.method || 'model_validated',
    };
  } else {
    confidence = calculateConfidence({
      rawExtractionScore: 0.85,
      evidenceCount: consolidatedEvidenceIds.length,
      hasMediaEvidence: false,
      hasVerifiedSpec: false,
      hasUserDescription: true,
      classificationConfidence: 0.90,
      sourceAgeHours: 0,
      method: 'model_validated',
    });
  }

  // 10. Provenance Construction
  let provenance: Provenance;
  if (input.provenance && typeof input.provenance === 'object' && input.provenance.source) {
    provenance = {
      source: input.provenance.source,
      evidenceIds: consolidatedEvidenceIds,
      pipelineVersion,
      modelVersion,
      promptVersion,
      generatedAt: input.provenance.generatedAt || generatedAt,
      sourceContentHash: input.provenance.sourceContentHash || computeSha256(`${aggregateType}:${aggregateId}:${sourceVersion}`),
    };
  } else {
    provenance = buildProvenance(
      `${aggregateType}s/${aggregateId}`,
      consolidatedEvidenceIds,
      modelVersion,
      promptVersion,
      `${aggregateType}:${aggregateId}:${sourceVersion}`,
      pipelineVersion
    );
  }

  // 11. Canonical deterministic version ID
  const canonicalId = buildVersionId(
    aggregateType,
    aggregateId,
    sourceVersion,
    pipelineVersion,
    modelVersion,
    promptVersion,
    schemaVersion
  );

  // 12. Deterministic Content Hash (stable over data payload, excluding runtime generatedAt / random IDs)
  const canonicalPayloadForHashing = {
    aggregateType,
    aggregateId,
    domain,
    category: category || null,
    component: component || null,
    observations: normalizedObservations.map((o) => ({
      component: o.component || null,
      condition: o.condition || null,
      description: o.description,
      evidenceIds: o.evidenceIds,
    })),
    inferences: normalizedInferences.map((i) => ({
      type: i.type,
      targetComponent: i.targetComponent || null,
      hypothesis: i.hypothesis,
      confidence: i.confidence,
      supportingEvidenceIds: i.supportingEvidenceIds,
      severity: i.severity || null,
      urgency: i.urgency || null,
    })),
    conditions: normalizedConditions,
    problems: normalizedProblems,
    interventions: normalizedInterventions,
    outcomes: normalizedOutcomes,
    evidenceIds: consolidatedEvidenceIds,
    schemaVersion,
    pipelineVersion,
  };
  const contentHash = computeStructuredDataHash(canonicalPayloadForHashing);

  const canonicalDocument: CanonicalIntelligence = {
    canonicalId,
    aggregateType,
    aggregateId,
    domain,
    category,
    component,
    observations: normalizedObservations,
    conditions: normalizedConditions.length > 0 ? normalizedConditions : undefined,
    problems: normalizedProblems.length > 0 ? normalizedProblems : undefined,
    interventions: normalizedInterventions.length > 0 ? normalizedInterventions : undefined,
    outcomes: normalizedOutcomes.length > 0 ? normalizedOutcomes : undefined,
    inferences: normalizedInferences,
    evidenceIds: consolidatedEvidenceIds,
    confidence,
    provenance,
    schemaVersion,
    pipelineVersion,
    modelVersion,
    promptVersion,
    sourceVersion,
    generatedAt,
    contentHash,
  };

  // 13. Validate strictly against Zod Schema
  const parseResult = CanonicalIntelligenceSchema.safeParse(canonicalDocument);
  if (!parseResult.success) {
    throw new CanonicalIntelligenceError('Canonical intelligence schema validation failed', parseResult.error.format());
  }

  return canonicalDocument;
}

/**
 * Persists canonical intelligence directly via the authoritative ImmutableIntelligenceStore.
 * Feeds the existing immutable architecture (Atomic Firestore Transaction + Lineage Gate).
 */
export async function persistCanonicalIntelligence(options: {
  db?: FirestoreDbLike | null;
  canonical: CanonicalIntelligence;
  summaryProjection?: Record<string, unknown>;
}): Promise<PersistIntelligenceResult> {
  const { db, canonical, summaryProjection } = options;

  // Re-verify canonical representation integrity
  const validated = canonicalizeIntelligence(canonical);

  const now = validated.generatedAt || new Date().toISOString();

  // Convert to IntelligenceExtraction for immutable append-only persistence
  const extraction: IntelligenceExtraction = {
    extractionId: validated.canonicalId,
    versionId: validated.canonicalId,
    aggregateId: validated.aggregateId,
    aggregateType: validated.aggregateType,
    sourceAggregateId: validated.aggregateId,
    sourceType: validated.aggregateType,
    sourceVersion: validated.sourceVersion,
    pipelineVersion: validated.pipelineVersion,
    modelVersion: validated.modelVersion,
    promptVersion: validated.promptVersion,
    schemaVersion: validated.schemaVersion,
    provider: 'canonical_pipeline',
    evidenceIds: validated.evidenceIds,
    rawManifest: {
      encoding: 'gzip',
      originalBytes: 0,
      compressedBytes: 0,
      compressionRatio: 1,
      sha256: validated.contentHash || computeSha256(validated.canonicalId),
      schemaVersion: validated.schemaVersion,
      storagePath: `canonical_extractions/${validated.aggregateType}/${validated.aggregateId}/${validated.canonicalId}.json.gz`,
      createdAt: now,
    },
    structuredCandidate: {
      domain: validated.domain,
      category: validated.category,
      component: validated.component,
      observations: validated.observations,
      inferences: validated.inferences,
      conditions: validated.conditions,
      problems: validated.problems,
      interventions: validated.interventions,
      outcomes: validated.outcomes,
    },
    confidence: validated.confidence,
    provenance: validated.provenance,
    generatedAt: now,
    createdAt: now,
  };

  // Convert to CanonicalIntelligenceEvent for historical ledger
  const event: CanonicalIntelligenceEvent = {
    eventId: `ie_can_${validated.aggregateType}_${validated.aggregateId}_${validated.canonicalId.slice(4, 16)}`,
    aggregateType: validated.aggregateType,
    aggregateId: validated.aggregateId,
    eventType: 'CANONICAL_INTELLIGENCE_NORMALIZED',
    schemaVersion: validated.schemaVersion,
    pipelineVersion: validated.pipelineVersion,
    modelVersion: validated.modelVersion,
    promptVersion: validated.promptVersion,
    createdAt: now,
    source: `${validated.aggregateType}s/${validated.aggregateId}`,
    evidenceIds: validated.evidenceIds,
    confidence: validated.confidence,
    provenance: validated.provenance,
    status: 'valid',
    payload: {
      canonicalId: validated.canonicalId,
      domain: validated.domain,
      contentHash: validated.contentHash,
      observationCount: validated.observations.length,
      inferenceCount: validated.inferences.length,
    },
  };

  // Active projection state
  const activeProjection = summaryProjection || {
    aggregateId: validated.aggregateId,
    aggregateType: validated.aggregateType,
    currentVersionId: validated.canonicalId,
    domain: validated.domain,
    category: validated.category,
    component: validated.component,
    observationCount: validated.observations.length,
    inferenceCount: validated.inferences.length,
    evidenceIds: validated.evidenceIds,
    confidence: validated.confidence,
    provenance: validated.provenance,
    pipelineVersion: validated.pipelineVersion,
    schemaVersion: validated.schemaVersion,
    contentHash: validated.contentHash,
    updatedAt: now,
  };

  // Persist through the existing ImmutableIntelligenceStore (authoritative lineaged transaction)
  return await immutableIntelligenceStore.persistOutput({
    db,
    aggregateType: validated.aggregateType,
    aggregateId: validated.aggregateId,
    versionId: validated.canonicalId,
    extraction,
    event,
    summaryProjection: activeProjection,
  });
}
