/**
 * AnyTrader V8.1 — AI Output Security Boundary
 * 
 * Establishes a hard security boundary between UNTRUSTED AI MODEL OUTPUT
 * and TRUSTED ANYTRADER INTELLIGENCE.
 * 
 * Pipeline:
 * Raw AI Response
 *   ↓
 * Candidate Schema Validation (Zod .strict(), safe payload limits, numeric confidence [0,1])
 *   ↓
 * Attach Trusted Server-Owned Metadata (aggregateType, aggregateId, sourceId, pipelineVersion, etc.)
 *   ↓
 * Evidence Lineage Validation (Authoritative Evidence Registry check)
 *   ↓
 * Canonicalization (Confidence calibration, cryptographic contentHash, canonicalId)
 *   ↓
 * Immutable Store Persistence
 */

import { z } from 'zod';
import {
  AIExtractionCandidateSchema,
  AIExtractionCandidate,
  MAX_AI_PAYLOAD_BYTES,
} from './aiCandidateSchema';
import {
  CanonicalIntelligenceInput,
  CanonicalIntelligence,
  IntelligenceAggregateType,
  StorageManifest,
} from './types';
import { canonicalizeIntelligence } from './canonicalizer';
import { EvidenceLineageValidator, evidenceLineageValidator } from './lineageValidator';
import { persistCanonicalIntelligence } from './canonicalizer';

export class AICandidateSecurityError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(`[AI Security Boundary Violation] ${message}`);
    this.name = 'AICandidateSecurityError';
  }
}

export interface TrustedServerContext {
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  sourceId: string;
  propertyId?: string;
  sourceVersion?: string;
  schemaVersion?: string;
  pipelineVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
  generatedAt?: string;
}

export interface PipelineOptions {
  firestoreDb: any;
  persistToStore?: boolean;
  rawManifest?: StorageManifest;
  summaryProjection?: Record<string, unknown>;
}

/**
 * Validates untrusted AI model output, strips/rejects unknown & malicious fields,
 * enforces strict payload limits, and attaches server-owned metadata context.
 */
export function validateAndSanitizeAICandidate(
  rawInput: unknown,
  serverContext: TrustedServerContext
): CanonicalIntelligenceInput {
  if (!serverContext || !serverContext.aggregateType || !serverContext.aggregateId || !serverContext.sourceId) {
    throw new AICandidateSecurityError('Trusted server context (aggregateType, aggregateId, sourceId) is required');
  }

  // 1. Check raw payload size limit & parse JSON
  let rawJsonString = '';
  let parsedObj: any = rawInput;

  if (typeof rawInput === 'string') {
    rawJsonString = rawInput;
    if (Buffer.byteLength(rawJsonString, 'utf-8') > MAX_AI_PAYLOAD_BYTES) {
      throw new AICandidateSecurityError(
        `AI payload size (${Buffer.byteLength(rawJsonString, 'utf-8')} bytes) exceeds max limit of ${MAX_AI_PAYLOAD_BYTES} bytes`
      );
    }
    try {
      parsedObj = JSON.parse(rawJsonString);
    } catch (err: any) {
      throw new AICandidateSecurityError(`Malformed JSON payload from AI model: ${err.message}`);
    }
  } else if (typeof rawInput === 'object' && rawInput !== null) {
    try {
      rawJsonString = JSON.stringify(rawInput);
    } catch (err: any) {
      throw new AICandidateSecurityError(`Unserializable AI payload object: ${err.message}`);
    }
    if (Buffer.byteLength(rawJsonString, 'utf-8') > MAX_AI_PAYLOAD_BYTES) {
      throw new AICandidateSecurityError(
        `AI payload size (${Buffer.byteLength(rawJsonString, 'utf-8')} bytes) exceeds max limit of ${MAX_AI_PAYLOAD_BYTES} bytes`
      );
    }
  } else {
    throw new AICandidateSecurityError('Raw AI response must be a valid JSON string or object');
  }

  // 2. Reject attempts to manufacture raw evidence or hijack system instructions
  if (parsedObj && typeof parsedObj === 'object') {
    if ('evidenceRegistryRecord' in parsedObj || 'createEvidence' in parsedObj || 'rawEvidence' in parsedObj) {
      throw new AICandidateSecurityError('AI model output is strictly forbidden from creating raw evidence records');
    }
    // Strip untrusted model-spoofed identity fields so server-owned context unconditionally wins
    delete (parsedObj as any).aggregateId;
    delete (parsedObj as any).aggregateType;
    delete (parsedObj as any).sourceId;
    delete (parsedObj as any).sourceType;
    delete (parsedObj as any).ownerId;
    delete (parsedObj as any).homeownerId;
    delete (parsedObj as any).userId;
    delete (parsedObj as any).tenantId;
    delete (parsedObj as any).propertyId;
    delete (parsedObj as any).derivedFromJobIds;
    delete (parsedObj as any).pipelineVersion;
    delete (parsedObj as any).modelVersion;
    delete (parsedObj as any).promptVersion;
    delete (parsedObj as any).schemaVersion;
    delete (parsedObj as any).generatedAt;
    delete (parsedObj as any).storagePath;
    delete (parsedObj as any).storageUri;
  }

  // 3. Strict Zod Schema Validation (rejects unknown/malicious fields, invalid confidence, oversize arrays)
  let candidate: AIExtractionCandidate;
  try {
    candidate = AIExtractionCandidateSchema.parse(parsedObj);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      throw new AICandidateSecurityError(
        `Structural schema validation failed: ${err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        err.issues
      );
    }
    throw new AICandidateSecurityError(`Structural validation failed: ${err.message}`);
  }

  // 4. Extract all evidence IDs referenced in candidate sub-items
  const collectedEvidenceIds = new Set<string>();
  if (candidate.evidenceIds) {
    candidate.evidenceIds.forEach((id) => collectedEvidenceIds.add(id));
  }
  candidate.observations.forEach((obs) => obs.evidenceIds.forEach((id) => collectedEvidenceIds.add(id)));
  candidate.inferences.forEach((inf) => inf.supportingEvidenceIds.forEach((id) => collectedEvidenceIds.add(id)));
  candidate.problems?.forEach((p) => p.evidenceIds.forEach((id) => collectedEvidenceIds.add(id)));
  candidate.interventions?.forEach((inv) => inv.evidenceIds.forEach((id) => collectedEvidenceIds.add(id)));
  candidate.outcomes?.forEach((o) => o.evidenceIds.forEach((id) => collectedEvidenceIds.add(id)));
  candidate.conditions?.forEach((c) => c.evidenceIds.forEach((id) => collectedEvidenceIds.add(id)));
  candidate.buildingComponents?.forEach((bc) => bc.evidenceIds?.forEach((id) => collectedEvidenceIds.add(id)));
  candidate.observedConditions?.forEach((oc) => oc.evidenceIds?.forEach((id) => collectedEvidenceIds.add(id)));
  candidate.recommendedInterventions?.forEach((ri) => ri.evidenceIds?.forEach((id) => collectedEvidenceIds.add(id)));

  // 5. Construct Canonical Intelligence Input with SERVER-OWNED TRUST METADATA
  // Server-owned metadata MUST override any model-derived claims!
  const observations = candidate.observations.length > 0
    ? candidate.observations.map((obs, idx) => ({
        observationId: obs.observationId || `obs_${idx + 1}`,
        component: obs.component,
        condition: obs.condition,
        description: obs.description,
        evidenceIds: obs.evidenceIds,
        capturedAt: obs.capturedAt,
        sourceField: obs.sourceField,
      }))
    : (candidate.buildingComponents || []).map((bc, idx) => ({
        observationId: `obs_bc_${idx + 1}`,
        component: bc.component,
        condition: bc.condition,
        description: `${bc.component}: ${bc.condition}`,
        evidenceIds: bc.evidenceIds && bc.evidenceIds.length > 0 ? bc.evidenceIds : Array.from(collectedEvidenceIds),
        capturedAt: bc.lastObservedAt,
      }));

  const inferences = candidate.inferences.length > 0
    ? candidate.inferences.map((inf, idx) => ({
        inferenceId: inf.inferenceId || `inf_${idx + 1}`,
        type: inf.type || 'risk',
        targetComponent: inf.targetComponent,
        hypothesis: inf.hypothesis,
        confidence: inf.confidence,
        reasoning: inf.reasoning,
        supportingEvidenceIds: inf.supportingEvidenceIds,
        supportingObservationIds: inf.supportingObservationIds,
        severity: inf.severity as any,
        urgency: inf.urgency as any,
      }))
    : candidate.overallHealthScore !== undefined
      ? [
          {
            inferenceId: 'inf_health_1',
            type: 'property_health',
            targetComponent: candidate.component || 'Building Fabric',
            hypothesis: `Overall property health score: ${candidate.overallHealthScore}/100`,
            confidence: candidate.candidateConfidence ?? (candidate.overallHealthScore / 100),
            supportingEvidenceIds: Array.from(collectedEvidenceIds),
            severity: candidate.overallHealthScore < 50 ? ('high' as const) : candidate.overallHealthScore < 75 ? ('medium' as const) : ('low' as const),
          },
        ]
      : [];

  const conditions = candidate.conditions
    ? candidate.conditions.map((c) => ({
        condition: c.condition,
        severity: c.severity as any,
        component: c.component,
        evidenceIds: c.evidenceIds,
      }))
    : candidate.observedConditions?.map((oc) => ({
        condition: oc.condition,
        severity: oc.severity as any,
        component: oc.component,
        evidenceIds: oc.evidenceIds && oc.evidenceIds.length > 0 ? oc.evidenceIds : Array.from(collectedEvidenceIds),
      }));

  const interventions = candidate.interventions
    ? candidate.interventions.map((inv) => ({
        description: inv.description,
        urgency: inv.urgency as any,
        component: inv.component,
        evidenceIds: inv.evidenceIds,
        estimatedBenchmarkCost: inv.estimatedBenchmarkCost ? {
          min: inv.estimatedBenchmarkCost.min ?? 0,
          max: inv.estimatedBenchmarkCost.max ?? 0,
          currency: inv.estimatedBenchmarkCost.currency,
        } : undefined,
      }))
    : candidate.recommendedInterventions?.map((ri) => ({
        description: ri.intervention,
        urgency: ri.urgency as any,
        component: ri.component,
        evidenceIds: ri.evidenceIds && ri.evidenceIds.length > 0 ? ri.evidenceIds : Array.from(collectedEvidenceIds),
        estimatedBenchmarkCost: ri.estimatedBenchmarkCost ? {
          min: ri.estimatedBenchmarkCost.min ?? 0,
          max: ri.estimatedBenchmarkCost.max ?? 0,
          currency: ri.estimatedBenchmarkCost.currency,
        } : undefined,
      }));

  const canonicalInput: CanonicalIntelligenceInput = {
    // SERVER-OWNED AGGREGATE IDENTITY AND SOURCE
    aggregateType: serverContext.aggregateType,
    aggregateId: serverContext.aggregateId,
    propertyId: serverContext.propertyId,

    // MODEL-DERIVED CANDIDATE DATA (Validated)
    domain: candidate.domain,
    category: candidate.category,
    component: candidate.component,
    observations,
    inferences,
    problems: candidate.problems?.map((p) => ({
      description: p.description,
      severity: p.severity as any,
      component: p.component,
      evidenceIds: p.evidenceIds,
    })),
    interventions,
    outcomes: candidate.outcomes?.map((o) => ({
      description: o.description,
      component: o.component,
      status: o.status,
      evidenceIds: o.evidenceIds,
    })),
    conditions,
    evidenceIds: Array.from(collectedEvidenceIds),

    provenance: {
      source: serverContext.sourceId,
      pipelineVersion: serverContext.pipelineVersion || 'v8.1.0',
      modelVersion: serverContext.modelVersion || 'gemini-2.5-flash',
      promptVersion: serverContext.promptVersion || 'canonical_v8.1',
      evidenceIds: Array.from(collectedEvidenceIds),
      generatedAt: serverContext.generatedAt || new Date().toISOString(),
      sourceContentHash: '',
    },

    // SERVER-OWNED PROVENANCE & PIPELINE VERSIONS (Model cannot overwrite)
    sourceVersion: serverContext.sourceVersion || '1',
    schemaVersion: serverContext.schemaVersion || 'v8.1.0',
    pipelineVersion: serverContext.pipelineVersion || 'v8.1.0',
    modelVersion: serverContext.modelVersion || 'gemini-2.5-flash',
    promptVersion: serverContext.promptVersion || 'canonical_v8.1',
    generatedAt: serverContext.generatedAt,
  };

  return canonicalInput;
}

/**
 * Complete End-to-End AI Candidate Security Boundary Pipeline:
 * Untrusted AI Output -> Schema Validation -> Attach Server Metadata -> Lineage Check -> Canonicalization -> Immutable Store
 */
export async function processAICandidateToCanonical(
  rawInput: unknown,
  serverContext: TrustedServerContext,
  options: PipelineOptions
): Promise<{ canonical: CanonicalIntelligence; persisted: boolean }> {
  if (!options || !options.firestoreDb) {
    throw new AICandidateSecurityError('Firestore DB reference is required to validate evidence lineage');
  }

  // Step 1 & 2: Structural & Schema validation + Attach server-owned metadata
  const canonicalInput = validateAndSanitizeAICandidate(rawInput, serverContext);

  // Step 3: Evidence Lineage Validation against Firestore Evidence Registry (Authoritative)
  try {
    await evidenceLineageValidator.validateLineage(
      { ...canonicalInput, evidenceIds: canonicalInput.evidenceIds || [] },
      options.firestoreDb
    );
  } catch (err: any) {
    throw new AICandidateSecurityError(
      `Evidence lineage validation failed: ${err.message}`
    );
  }

  // Step 4: Canonicalization (Confidence calibration, cryptographic digest, deterministic sorting)
  const canonical = canonicalizeIntelligence(canonicalInput);

  // Step 5: Persistence to Immutable Intelligence Store
  let persisted = false;
  if (options.persistToStore) {
    await persistCanonicalIntelligence({
      db: options.firestoreDb,
      canonical,
      rawManifest: options.rawManifest,
      summaryProjection: options.summaryProjection,
    });
    persisted = true;
  }

  return { canonical, persisted };
}
