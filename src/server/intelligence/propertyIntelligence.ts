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
import { persistRawArtifact } from './rawArtifactStore';
import { immutableIntelligenceStore, getGlobalIntelligenceDb } from './immutableStore';
import { CanonicalIntelligenceEvent, IntelligenceExtraction, JobIntelligence, PropertyIntelligence, CanonicalIntelligence } from './types';
import { processAICandidateToCanonical, TrustedServerContext } from './aiCandidateBoundary';
import { persistCanonicalIntelligence } from './canonicalizer';

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

  public setProvider(provider: IntelligenceModelProvider): void {
    this.provider = provider;
  }

  public getProvider(): IntelligenceModelProvider {
    return this.provider;
  }

  /**
   * Aggregates property-level intelligence from historical job intelligence records and property evidence,
   * producing an immutable extraction record with deterministic version identity.
   */
  public async aggregatePropertyIntelligence(
    property: PropertySourceInput,
    historicalJobs: JobIntelligence[],
    overrideEvidenceIds?: string[],
    options?: { firestoreDb?: any; persist?: boolean }
  ): Promise<{
    propertyIntelligence: PropertyIntelligence;
    extraction: IntelligenceExtraction;
    event: CanonicalIntelligenceEvent;
    versionId: string;
    canonical?: CanonicalIntelligence;
    rawCandidate?: unknown;
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

    // Property-level evidence IDs supporting the property aggregate extraction
    const propertyEvidenceIds = propertyEvidence.map((e) => e.evidenceId);

    const targetEvidenceIds = overrideEvidenceIds || propertyEvidenceIds;

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
    const storagePath = `intelligence_raw/property/${property.propertyId}/rollup_${versionId}.json.gz`;
    const { compressedBuffer, manifest: rawManifestDraft } = compressPayload(rollupResult.rawResponseText, storagePath);
    const manifest = await persistRawArtifact({ compressedBuffer, manifest: rawManifestDraft });

    // 5. Construct Untrusted AI Candidate for Security Boundary Processing
    const rawCandidateObj = {
      domain: 'property_management',
      category: property.propertyType || 'Residential',
      component: 'Building Fabric',
      buildingComponents: (candidate.buildingComponents || []).map((bc: any) => ({
        component: bc.component,
        condition: bc.condition,
        confidence: bc.confidence,
        lastObservedAt: bc.lastObservedAt || new Date().toISOString(),
        evidenceIds: bc.evidenceIds && bc.evidenceIds.length > 0 ? bc.evidenceIds : targetEvidenceIds.slice(0, 1),
      })),
      observedConditions: (candidate.observedConditions || []).map((oc: any) => ({
        condition: oc.condition,
        severity: oc.severity,
        component: oc.component,
        evidenceIds: oc.evidenceIds && oc.evidenceIds.length > 0 ? oc.evidenceIds : targetEvidenceIds.slice(0, 1),
      })),
      recommendedInterventions: (candidate.recommendedInterventions || []).map((ri: any) => ({
        intervention: ri.intervention,
        urgency: ri.urgency,
        component: ri.component,
        evidenceIds: targetEvidenceIds.slice(0, 1),
        estimatedBenchmarkCost: ri.estimatedBenchmarkCost ? {
          min: ri.estimatedBenchmarkCost.min ?? 0,
          max: ri.estimatedBenchmarkCost.max ?? 0,
        } : undefined,
      })),
      overallHealthScore: candidate.overallHealthScore,
      evidenceIds: targetEvidenceIds,
      candidateConfidence: typeof (candidate as any).candidateConfidence === 'number'
        ? (candidate as any).candidateConfidence
        : (candidate.overallHealthScore ? candidate.overallHealthScore / 100 : 0.85),
    };

    // 6. Trusted Server Context (SERVER-OWNED METADATA)
    const serverContext: TrustedServerContext = {
      aggregateType: 'property',
      aggregateId: property.propertyId,
      sourceId: `properties/${property.propertyId}`,
      sourceVersion: String(sourceVersion),
      schemaVersion,
      pipelineVersion,
      modelVersion,
      promptVersion,
      generatedAt: new Date().toISOString(),
    };

    // 7. Establish Authoritative Firestore Reference (Fails closed if unavailable)
    const activeDb = options?.firestoreDb || getGlobalIntelligenceDb() || (evidenceRegistry as any).firestoreDb;
    if (!activeDb) {
      throw new Error('[PropertyIntelligence Error] Firestore database reference is required to validate evidence lineage (Fail Closed)');
    }

    // 8. MANDATORY AI SECURITY BOUNDARY INVOCATION:
    // Untrusted Model Candidate -> Structural Validation -> Server-Owned Metadata Override -> Evidence Lineage Validation -> Deterministic Canonicalization
    const { canonical } = await processAICandidateToCanonical(
      rawCandidateObj,
      serverContext,
      {
        firestoreDb: activeDb,
        persistToStore: false,
      }
    );

    // 9. Compact Property Intelligence Projection (Constructed from Canonical representation)
    const derivedJobIds = historicalJobs.map((j) => j.jobId).sort();
    const now = canonical.generatedAt || new Date().toISOString();

    const propertyIntelligence: PropertyIntelligence = {
      propertyId: canonical.aggregateId,
      currentVersionId: canonical.canonicalId,
      currentPipelineVersion: canonical.pipelineVersion,
      currentModelVersion: canonical.modelVersion,
      currentPromptVersion: canonical.promptVersion,
      currentSchemaVersion: canonical.schemaVersion,
      currentSourceVersion: canonical.sourceVersion,
      buildingComponents: canonical.observations.map((obs) => ({
        component: obs.component || 'Building Fabric',
        condition: obs.condition || obs.description,
        confidence: typeof obs.metadata?.confidence === 'number' ? (obs.metadata.confidence as number) : canonical.confidence.overall,
        lastObservedAt: obs.capturedAt || now,
        evidenceIds: obs.evidenceIds,
      })),
      observedConditions: (canonical.conditions || []).map((c) => ({
        condition: c.condition,
        severity: c.severity,
        component: c.component,
        evidenceIds: c.evidenceIds,
      })),
      recommendedInterventions: (canonical.interventions || []).map((ri) => ({
        intervention: ri.description,
        urgency: ri.urgency,
        estimatedBenchmarkCost: ri.estimatedBenchmarkCost ? {
          min: ri.estimatedBenchmarkCost.min ?? 0,
          max: ri.estimatedBenchmarkCost.max ?? 0,
        } : undefined,
        component: ri.component,
      })),
      derivedFromJobIds: derivedJobIds,
      evidenceIds: canonical.evidenceIds,
      overallHealthScore: candidate.overallHealthScore ?? 85,
      confidence: canonical.confidence,
      provenance: canonical.provenance,
      pipelineVersion: canonical.pipelineVersion,
      updatedAt: now,
    };

    // Verify Firestore Safety Budget (<= 100 KiB)
    const budgetCheck = enforceFirestoreSafetyBudget(propertyIntelligence);
    if (!budgetCheck.valid) {
      throw new Error(`[PropertyIntelligence Budget Error] Exceeded 100 KiB: ${budgetCheck.actualBytes} bytes`);
    }

    // 10. Authoritative Persistence to Immutable Intelligence Store
    if (options?.persist !== false) {
      await persistCanonicalIntelligence({
        db: activeDb,
        canonical,
        rawManifest: manifest,
        summaryProjection: propertyIntelligence as unknown as Record<string, unknown>,
      });
    }

    // 11. Immutable Historical Extraction Record (for backward compatibility)
    const extraction: IntelligenceExtraction = {
      extractionId: canonical.canonicalId,
      versionId: canonical.canonicalId,
      taskId: property.taskId,
      aggregateId: canonical.aggregateId,
      aggregateType: 'property',
      sourceAggregateId: canonical.aggregateId,
      sourceType: 'property',
      sourceVersion: canonical.sourceVersion,
      pipelineVersion: canonical.pipelineVersion,
      modelVersion: canonical.modelVersion,
      promptVersion: canonical.promptVersion,
      schemaVersion: canonical.schemaVersion,
      provider: providerName,
      evidenceIds: canonical.evidenceIds,
      rawManifest: manifest,
      structuredCandidate: {
        overallHealthScore: candidate.overallHealthScore,
        buildingComponents: candidate.buildingComponents,
        observedConditions: candidate.observedConditions,
        recommendedInterventions: candidate.recommendedInterventions,
        derivedFromJobIds: derivedJobIds,
      },
      confidence: canonical.confidence,
      provenance: canonical.provenance,
      generatedAt: now,
      createdAt: now,
    };

    // 12. Canonical Intelligence Event (for backward compatibility)
    const event: CanonicalIntelligenceEvent = {
      eventId: `ie_prop_${property.propertyId}_${canonical.canonicalId.slice(4, 16)}_${computeSha256(now).slice(0, 6)}`,
      aggregateType: 'property',
      aggregateId: property.propertyId,
      eventType: 'PROPERTY_ROLLUP_COMPLETED',
      schemaVersion: canonical.schemaVersion,
      pipelineVersion: canonical.pipelineVersion,
      modelVersion: canonical.modelVersion,
      promptVersion: canonical.promptVersion,
      createdAt: now,
      source: `properties/${property.propertyId}`,
      evidenceIds: canonical.evidenceIds,
      confidence: canonical.confidence,
      provenance: canonical.provenance,
      status: 'valid',
      payload: {
        versionId: canonical.canonicalId,
        sourceVersion: canonical.sourceVersion,
        overallHealthScore: candidate.overallHealthScore,
        componentCount: (candidate.buildingComponents || []).length,
        conditionCount: (candidate.observedConditions || []).length,
        rawManifest: manifest,
        tokenMetrics: rollupResult.metrics,
      },
    };

    return {
      propertyIntelligence,
      extraction,
      event,
      versionId: canonical.canonicalId,
      canonical,
      rawCandidate: rawCandidateObj,
    };
  }
}

export const propertyIntelligenceService = new PropertyIntelligenceService();
