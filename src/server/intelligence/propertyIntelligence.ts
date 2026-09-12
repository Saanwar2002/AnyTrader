/**
 * AnyTrader V8.1 — Derived Property Intelligence Roll-up Service
 * 
 * Pipeline:
 * Authoritative Property + Historical Job Records + Property Evidence
 * -> Evidence Verification
 * -> Asynchronous Aggregation via Model Provider
 * -> Tier B Compressed Storage of Raw Model Rollup
 * -> Multidimensional Confidence Score
 * -> Provenance Anchoring with SHA-256 Hashing
 * -> Canonical Intelligence Event & Compact Property Intelligence Projection (<= 100 KiB)
 */

import { calculateConfidence } from './confidence';
import { evidenceRegistry } from './evidenceRegistry';
import { GeminiIntelligenceProvider, IntelligenceModelProvider } from './geminiProvider';
import { buildProvenance, computeSha256, INTELLIGENCE_PIPELINE_VERSION, INTELLIGENCE_SCHEMA_VERSION } from './provenance';
import { compressPayload, enforceFirestoreSafetyBudget } from './storageTier';
import { CanonicalIntelligenceEvent, JobIntelligence, PropertyIntelligence } from './types';

export interface PropertySourceInput {
  propertyId: string;
  address?: string;
  propertyType?: string;
  epcRating?: string;
  constructionYear?: number;
  documents?: string[];
}

export class PropertyIntelligenceService {
  constructor(private provider: IntelligenceModelProvider = new GeminiIntelligenceProvider()) {}

  /**
   * Aggregates property-level intelligence from historical job intelligence records and property evidence
   */
  public async aggregatePropertyIntelligence(
    property: PropertySourceInput,
    historicalJobs: JobIntelligence[],
    overrideEvidenceIds?: string[]
  ): Promise<{
    propertyIntelligence: PropertyIntelligence;
    event: CanonicalIntelligenceEvent;
  }> {
    // 1. Gather property-level evidence
    let propertyEvidence = evidenceRegistry.getForAggregate('property', property.propertyId);

    if (propertyEvidence.length === 0) {
      // Register property baseline spec evidence
      const specText = `Property: ${property.propertyId}, Type: ${property.propertyType || 'Residential'}, EPC: ${property.epcRating || 'Unrated'}, Built: ${property.constructionYear || 'Unknown'}`;
      evidenceRegistry.register(
        'property',
        property.propertyId,
        'structured_spec',
        `properties/${property.propertyId}`,
        specText,
        { propertyType: property.propertyType, epcRating: property.epcRating },
        true
      );
      propertyEvidence = evidenceRegistry.getForAggregate('property', property.propertyId);
    }

    // Combine evidence IDs from property and jobs
    const combinedEvidenceIds = Array.from(
      new Set([
        ...propertyEvidence.map((e) => e.evidenceId),
        ...historicalJobs.flatMap((j) => j.evidenceIds),
      ])
    );

    const targetEvidenceIds = overrideEvidenceIds || combinedEvidenceIds;

    // Invariant: No evidence, no assertion
    evidenceRegistry.assertHasEvidence(targetEvidenceIds);

    // 2. Prepare structured job history for model
    const jobHistories = historicalJobs.map((j) => ({
      jobId: j.jobId,
      category: j.category,
      problem: j.observedProblem,
      scope: j.extractedScope,
    }));

    const untrustedEvidence = propertyEvidence.map((e) => ({
      id: e.evidenceId,
      type: e.evidenceType,
      content: `[Property Spec Source: ${e.sourceRef}]`,
    }));

    // 3. Model Rollup
    const rollupResult = await this.provider.rollupPropertyCandidate(
      property.propertyId,
      jobHistories,
      untrustedEvidence
    );
    const candidate = rollupResult.candidate;

    // 4. Tier B: Store Raw Model Output Gzip-Compressed
    const storagePath = `intelligence_raw/property/${property.propertyId}/rollup_${Date.now()}.json.gz`;
    const { manifest } = compressPayload(rollupResult.rawResponseText, storagePath);

    // 5. Calculate Multidimensional Confidence
    const hasMedia = historicalJobs.some((j) => j.confidence.evidenceQuality > 0.4);
    const hasSpec = propertyEvidence.some((e) => e.evidenceType === 'structured_spec');

    const confidence = calculateConfidence({
      rawExtractionScore: candidate.overallHealthScore / 100,
      evidenceCount: targetEvidenceIds.length,
      hasMediaEvidence: hasMedia,
      hasVerifiedSpec: hasSpec,
      hasUserDescription: historicalJobs.length > 0,
      classificationConfidence: 0.95,
      sourceAgeHours: 0,
      method: 'model_validated',
    });

    // 6. Build Provenance
    const derivedJobIds = historicalJobs.map((j) => j.jobId).sort();
    const provenanceContent = `${property.propertyId}:jobs_${derivedJobIds.join(',')}:${manifest.sha256}`;
    const provenance = buildProvenance(
      `properties/${property.propertyId}`,
      targetEvidenceIds,
      rollupResult.metrics.model,
      'property_rollup_v8.1',
      provenanceContent
    );

    const now = new Date().toISOString();

    // 7. Compact Property Intelligence Projection
    const propertyIntelligence: PropertyIntelligence = {
      propertyId: property.propertyId,
      buildingComponents: candidate.buildingComponents.map((bc) => ({
        component: bc.component,
        condition: bc.condition,
        confidence: bc.confidence,
        lastObservedAt: now,
        evidenceIds: bc.evidenceIds.length > 0 ? bc.evidenceIds : targetEvidenceIds.slice(0, 1),
      })),
      observedConditions: candidate.observedConditions.map((oc) => ({
        condition: oc.condition,
        severity: oc.severity,
        component: oc.component,
        evidenceIds: oc.evidenceIds.length > 0 ? oc.evidenceIds : targetEvidenceIds.slice(0, 1),
      })),
      recommendedInterventions: candidate.recommendedInterventions.map((ri) => ({
        intervention: ri.intervention,
        urgency: ri.urgency,
        estimatedBenchmarkCost: ri.estimatedBenchmarkCost,
        component: ri.component,
      })),
      derivedFromJobIds: derivedJobIds,
      evidenceIds: targetEvidenceIds,
      overallHealthScore: candidate.overallHealthScore,
      confidence,
      provenance,
      pipelineVersion: INTELLIGENCE_PIPELINE_VERSION,
      updatedAt: now,
    };

    // Verify Firestore Safety Budget (<= 100 KiB)
    const budgetCheck = enforceFirestoreSafetyBudget(propertyIntelligence);
    if (!budgetCheck.valid) {
      throw new Error(`[PropertyIntelligence Budget Error] Exceeded 100 KiB: ${budgetCheck.actualBytes} bytes`);
    }

    // 8. Canonical Intelligence Event
    const event: CanonicalIntelligenceEvent = {
      eventId: `ie_prop_${property.propertyId}_${computeSha256(now).slice(0, 10)}`,
      aggregateType: 'property',
      aggregateId: property.propertyId,
      eventType: 'PROPERTY_ROLLUP_COMPLETED',
      schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
      pipelineVersion: INTELLIGENCE_PIPELINE_VERSION,
      modelVersion: rollupResult.metrics.model,
      promptVersion: 'property_rollup_v8.1',
      createdAt: now,
      source: `properties/${property.propertyId}`,
      evidenceIds: targetEvidenceIds,
      confidence,
      provenance,
      status: 'valid',
      payload: {
        overallHealthScore: candidate.overallHealthScore,
        componentCount: candidate.buildingComponents.length,
        conditionCount: candidate.observedConditions.length,
        rawManifest: manifest,
        tokenMetrics: rollupResult.metrics,
      },
    };

    return {
      propertyIntelligence,
      event,
    };
  }
}

export const propertyIntelligenceService = new PropertyIntelligenceService();
