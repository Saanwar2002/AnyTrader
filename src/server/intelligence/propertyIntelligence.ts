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
import { buildProvenance, buildVersionId, computeSha256, INTELLIGENCE_PIPELINE_VERSION, INTELLIGENCE_SCHEMA_VERSION } from './provenance';
import { compressPayload, enforceFirestoreSafetyBudget } from './storageTier';
import { CanonicalIntelligenceEvent, IntelligenceExtraction, JobIntelligence, PropertyIntelligence } from './types';

export interface PropertySourceInput {
  propertyId: string;
  address?: string;
  propertyType?: string;
  epcRating?: string;
  constructionYear?: number;
  sourceVersion?: string | number;
  pipelineVersion?: string;
  promptVersion?: string;
  modelVersion?: string;
  schemaVersion?: string;
  provider?: string;
  taskId?: string;
  documents?: string[];
  documentObjects?: Array<{
    uri?: string;
    storagePath?: string;
    bytes?: Buffer | Uint8Array;
    mimeType?: string;
    byteSize?: number;
  }>;
}

export class PropertyIntelligenceService {
  constructor(private provider: IntelligenceModelProvider = new GeminiIntelligenceProvider()) {}

  /**
   * Aggregates property-level intelligence from historical job intelligence records and property evidence,
   * producing an immutable extraction record with deterministic version identity.
   */
  public async aggregatePropertyIntelligence(
    property: PropertySourceInput,
    historicalJobs: JobIntelligence[],
    overrideEvidenceIds?: string[]
  ): Promise<{
    propertyIntelligence: PropertyIntelligence;
    extraction: IntelligenceExtraction;
    event: CanonicalIntelligenceEvent;
    versionId: string;
  }> {
    // 1. Gather property-level evidence
    let propertyEvidence = await evidenceRegistry.getForAggregate('property', property.propertyId);

    if (propertyEvidence.length === 0) {
      // Register property baseline spec evidence via canonical structured hashing
      const specPayload = {
        propertyId: property.propertyId,
        propertyType: property.propertyType || 'Residential',
        epcRating: property.epcRating || 'Unrated',
        constructionYear: property.constructionYear || null,
      };

      await evidenceRegistry.registerStructuredData(
        'property',
        property.propertyId,
        'structured_spec',
        `properties/${property.propertyId}`,
        specPayload,
        { propertyType: property.propertyType, epcRating: property.epcRating },
        { documentId: property.propertyId, sourceField: 'spec' }
      );

      // Handle document objects with real binary bytes or reference-only
      if (property.documentObjects && property.documentObjects.length > 0) {
        for (const [idx, docObj] of property.documentObjects.entries()) {
          const sourceRef = docObj.storagePath || docObj.uri || `documents/${idx}`;
          if (docObj.bytes) {
            await evidenceRegistry.register(
              'property',
              property.propertyId,
              'document',
              sourceRef,
              docObj.bytes,
              { mimeType: docObj.mimeType || 'application/pdf', byteSize: docObj.byteSize, index: idx },
              true,
              { uri: docObj.uri, storagePath: docObj.storagePath, sourceField: `documents[${idx}]` }
            );
          } else {
            await evidenceRegistry.registerReferenceOnly(
              'property',
              property.propertyId,
              'document',
              sourceRef,
              { mimeType: docObj.mimeType, index: idx },
              { uri: docObj.uri, storagePath: docObj.storagePath, sourceField: `documents[${idx}]` }
            );
          }
        }
      } else if (property.documents && property.documents.length > 0) {
        for (const [idx, docUrl] of property.documents.entries()) {
          await evidenceRegistry.registerReferenceOnly(
            'property',
            property.propertyId,
            'document',
            docUrl,
            { docUrl, index: idx },
            { uri: docUrl, storagePath: docUrl.startsWith('properties/') ? docUrl : undefined, sourceField: `documents[${idx}]` }
          );
        }
      }

      propertyEvidence = await evidenceRegistry.getForAggregate('property', property.propertyId);
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

    // Determine version identifiers
    const sourceVersion = property.sourceVersion || '1';
    const pipelineVersion = property.pipelineVersion || INTELLIGENCE_PIPELINE_VERSION;
    const modelVersion = property.modelVersion || rollupResult.metrics.model;
    const promptVersion = property.promptVersion || 'property_rollup_v8.1';
    const schemaVersion = property.schemaVersion || INTELLIGENCE_SCHEMA_VERSION;
    const providerName = property.provider || 'google_genai';

    const versionId = buildVersionId(
      'property',
      property.propertyId,
      sourceVersion,
      pipelineVersion,
      modelVersion,
      promptVersion,
      schemaVersion
    );

    // 4. Tier B: Store Raw Model Output Gzip-Compressed
    const storagePath = `intelligence_raw/property/${property.propertyId}/rollup_${versionId}_${Date.now()}.json.gz`;
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
      modelVersion,
      promptVersion,
      provenanceContent,
      pipelineVersion
    );

    const now = new Date().toISOString();

    // 7. Immutable Historical Extraction Record
    const extraction: IntelligenceExtraction = {
      extractionId: versionId,
      versionId,
      taskId: property.taskId,
      aggregateId: property.propertyId,
      aggregateType: 'property',
      sourceAggregateId: property.propertyId,
      sourceType: 'property',
      sourceVersion,
      pipelineVersion,
      modelVersion,
      promptVersion,
      schemaVersion,
      provider: providerName,
      evidenceIds: targetEvidenceIds,
      rawManifest: manifest,
      structuredCandidate: {
        overallHealthScore: candidate.overallHealthScore,
        buildingComponents: candidate.buildingComponents,
        observedConditions: candidate.observedConditions,
        recommendedInterventions: candidate.recommendedInterventions,
        derivedFromJobIds: derivedJobIds,
      },
      confidence,
      provenance,
      generatedAt: now,
      createdAt: now,
    };

    // 8. Compact Property Intelligence Projection (Current Active Pointer State)
    const propertyIntelligence: PropertyIntelligence = {
      propertyId: property.propertyId,
      currentVersionId: versionId,
      currentPipelineVersion: pipelineVersion,
      currentModelVersion: modelVersion,
      currentPromptVersion: promptVersion,
      currentSchemaVersion: schemaVersion,
      currentSourceVersion: sourceVersion,
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
      pipelineVersion,
      updatedAt: now,
    };

    // Verify Firestore Safety Budget (<= 100 KiB)
    const budgetCheck = enforceFirestoreSafetyBudget(propertyIntelligence);
    if (!budgetCheck.valid) {
      throw new Error(`[PropertyIntelligence Budget Error] Exceeded 100 KiB: ${budgetCheck.actualBytes} bytes`);
    }

    // 9. Canonical Intelligence Event
    const event: CanonicalIntelligenceEvent = {
      eventId: `ie_prop_${property.propertyId}_${versionId.slice(4, 16)}_${computeSha256(now).slice(0, 6)}`,
      aggregateType: 'property',
      aggregateId: property.propertyId,
      eventType: 'PROPERTY_ROLLUP_COMPLETED',
      schemaVersion,
      pipelineVersion,
      modelVersion,
      promptVersion,
      createdAt: now,
      source: `properties/${property.propertyId}`,
      evidenceIds: targetEvidenceIds,
      confidence,
      provenance,
      status: 'valid',
      payload: {
        versionId,
        sourceVersion,
        overallHealthScore: candidate.overallHealthScore,
        componentCount: candidate.buildingComponents.length,
        conditionCount: candidate.observedConditions.length,
        rawManifest: manifest,
        tokenMetrics: rollupResult.metrics,
      },
    };

    return {
      propertyIntelligence,
      extraction,
      event,
      versionId,
    };
  }
}

export const propertyIntelligenceService = new PropertyIntelligenceService();
