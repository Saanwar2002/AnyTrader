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
import { evidenceLineageValidator } from './lineageValidator';
import { GeminiIntelligenceProvider, IntelligenceModelProvider } from './geminiProvider';
import { buildProvenance, buildVersionId, computeSha256, INTELLIGENCE_PIPELINE_VERSION, INTELLIGENCE_SCHEMA_VERSION } from './provenance';
import { compressPayload, enforceFirestoreSafetyBudget } from './storageTier';
import { persistRawArtifact } from './rawArtifactStore';
import { immutableIntelligenceStore, getGlobalIntelligenceDb } from './immutableStore';
import { CanonicalIntelligenceEvent, IntelligenceExtraction, JobIntelligence, PropertyIntelligence, CanonicalIntelligence } from './types';
import { processAICandidateToCanonical, TrustedServerContext } from './aiCandidateBoundary';
import { persistCanonicalIntelligence } from './canonicalizer';
import { propertyOntologyService } from './propertyOntology';

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
  private defaultDb?: any;

  constructor(
    private provider: IntelligenceModelProvider = new GeminiIntelligenceProvider(),
    options?: { firestoreDb?: any }
  ) {
    if (options?.firestoreDb) {
      this.defaultDb = options.firestoreDb;
    }
  }

  public setFirestoreDb(db: any): void {
    this.defaultDb = db;
  }

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
    property: string | PropertySourceInput,
    historicalJobs: JobIntelligence[] = [],
    overrideEvidenceIds?: string[],
    options?: { firestoreDb?: any; persist?: boolean; provider?: IntelligenceModelProvider }
  ): Promise<{
    propertyIntelligence: PropertyIntelligence;
    extraction: IntelligenceExtraction;
    event: CanonicalIntelligenceEvent;
    versionId: string;
    canonical?: CanonicalIntelligence;
    rawCandidate?: unknown;
  }> {
    const propInput: PropertySourceInput = typeof property === 'string' ? { propertyId: property } : property;

    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (activeDb) {
      evidenceRegistry.setDb(activeDb);
      evidenceLineageValidator.setDb(activeDb);

      try {
        const propRef = activeDb.collection('properties').doc(propInput.propertyId);
        const existingDoc = await propRef.get();
        if (!existingDoc || !existingDoc.exists) {
          await propRef.set({
            propertyId: propInput.propertyId,
            propertyType: propInput.propertyType || 'Residential',
            address: propInput.address || '',
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore if error occurs during upsert attempt
      }
    }

    // 0. Lineage Verification: All historical jobs provided MUST strictly belong to this target property
    for (const job of historicalJobs) {
      const jobPropId = job.propertyId;
      if (jobPropId && jobPropId !== propInput.propertyId) {
        throw new Error(
          `[PropertyLineage Violation] Job '${job.jobId}' belongs to property '${jobPropId}', not target property '${propInput.propertyId}'. Cross-property contamination rejected.`
        );
      }
    }

    // 1. Gather property-level evidence
    let propertyEvidence = await evidenceRegistry.getForAggregate('property', propInput.propertyId, activeDb);

    if (propertyEvidence.length === 0) {
      // Register property baseline spec evidence via canonical structured hashing
      const specPayload = {
        propertyId: propInput.propertyId,
        propertyType: propInput.propertyType || 'Residential',
        epcRating: propInput.epcRating || 'Unrated',
        constructionYear: propInput.constructionYear || null,
      };

      await evidenceRegistry.registerStructuredData(
        'property',
        propInput.propertyId,
        'structured_spec',
        `properties/${propInput.propertyId}`,
        specPayload,
        { propertyType: propInput.propertyType, epcRating: propInput.epcRating },
        { documentId: propInput.propertyId, sourceField: 'spec' },
        activeDb
      );

      // Handle document objects with real binary bytes or reference-only
      if (propInput.documentObjects && propInput.documentObjects.length > 0) {
        for (const [idx, docObj] of propInput.documentObjects.entries()) {
          const sourceRef = docObj.storagePath || docObj.uri || `documents/${idx}`;
          if (docObj.bytes) {
            await evidenceRegistry.register(
              'property',
              propInput.propertyId,
              'document',
              sourceRef,
              docObj.bytes,
              { mimeType: docObj.mimeType || 'application/pdf', byteSize: docObj.byteSize, index: idx },
              true,
              { uri: docObj.uri, storagePath: docObj.storagePath, sourceField: `documents[${idx}]` },
              activeDb
            );
          } else {
            await evidenceRegistry.registerReferenceOnly(
              'property',
              propInput.propertyId,
              'document',
              sourceRef,
              { mimeType: docObj.mimeType, index: idx },
              { uri: docObj.uri, storagePath: docObj.storagePath, sourceField: `documents[${idx}]` },
              undefined,
              activeDb
            );
          }
        }
      } else if (propInput.documents && propInput.documents.length > 0) {
        for (const [idx, docUrl] of propInput.documents.entries()) {
          await evidenceRegistry.registerReferenceOnly(
            'property',
            propInput.propertyId,
            'document',
            docUrl,
            { docUrl, index: idx },
            { uri: docUrl, storagePath: docUrl.startsWith('properties/') ? docUrl : undefined, sourceField: `documents[${idx}]` },
            undefined,
            activeDb
          );
        }
      }

      propertyEvidence = await evidenceRegistry.getForAggregate('property', propInput.propertyId, activeDb);
    }

    // Property-level evidence IDs supporting the property aggregate extraction
    const propertyEvidenceIds = propertyEvidence.map((e) => e.evidenceId);

    // Register reference evidence for historical jobs if needed
    for (const j of historicalJobs) {
      if (j.jobId) {
        try {
          await evidenceRegistry.registerReferenceOnly(
            'job',
            j.jobId,
            'structured_spec',
            `jobs/${j.jobId}`,
            { jobId: j.jobId, propertyId: propInput.propertyId },
            { documentId: j.jobId, propertyId: propInput.propertyId },
            { customEvidenceId: `job_${j.jobId}` },
            activeDb
          );
        } catch {
          // Evidence reference already registered or error handled
        }
      }
    }

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
    const activeProvider = options?.provider || this.provider;
    const rollupResult = await activeProvider.rollupPropertyCandidate(
      propInput.propertyId,
      jobHistories,
      untrustedEvidence
    );
    const candidate = rollupResult.candidate;

    // Determine version identifiers
    const sourceVersion = propInput.sourceVersion || '1';
    const pipelineVersion = propInput.pipelineVersion || INTELLIGENCE_PIPELINE_VERSION;
    const modelVersion = propInput.modelVersion || rollupResult.metrics.model || 'gemini-2.5-flash';
    const promptVersion = propInput.promptVersion || 'property_rollup_v8.1';
    const schemaVersion = propInput.schemaVersion || INTELLIGENCE_SCHEMA_VERSION;
    const providerName = propInput.provider || 'google_genai';

    const versionId = buildVersionId(
      'property',
      propInput.propertyId,
      sourceVersion,
      pipelineVersion,
      modelVersion,
      promptVersion,
      schemaVersion
    );

    // 4. Tier B: Store Raw Model Output Gzip-Compressed
    const storagePath = `intelligence_raw/property/${propInput.propertyId}/rollup_${versionId}.json.gz`;
    const { compressedBuffer, manifest: rawManifestDraft } = compressPayload(rollupResult.rawResponseText, storagePath);
    const manifest = await persistRawArtifact({ compressedBuffer, manifest: rawManifestDraft });

    // 5. Construct Untrusted AI Candidate for Security Boundary Processing
    const candidateEvidenceIds = Array.isArray((candidate as any)?.evidenceIds) && (candidate as any).evidenceIds.length > 0
      ? (candidate as any).evidenceIds
      : targetEvidenceIds;

    const rawCandidateObj = {
      ...(typeof candidate === 'object' && candidate !== null ? candidate : {}),
      domain: (candidate as any)?.domain || 'property_management',
      category: (candidate as any)?.category || propInput.propertyType || 'Residential',
      component: (candidate as any)?.component || 'Building Fabric',
      buildingComponents: Array.isArray((candidate as any)?.buildingComponents)
        ? (candidate as any).buildingComponents.map((bc: any) => ({
            component: bc?.component,
            condition: bc?.condition,
            confidence: bc?.confidence,
            lastObservedAt: bc?.lastObservedAt || new Date().toISOString(),
            evidenceIds: Array.isArray(bc?.evidenceIds) && bc.evidenceIds.length > 0 ? bc.evidenceIds : candidateEvidenceIds.slice(0, 1),
          }))
        : (candidate as any)?.buildingComponents,
      observedConditions: Array.isArray((candidate as any)?.observedConditions)
        ? (candidate as any).observedConditions.map((oc: any) => ({
            condition: oc?.condition,
            severity: oc?.severity,
            component: oc?.component,
            evidenceIds: Array.isArray(oc?.evidenceIds) && oc.evidenceIds.length > 0 ? oc.evidenceIds : candidateEvidenceIds.slice(0, 1),
          }))
        : (candidate as any)?.observedConditions,
      recommendedInterventions: Array.isArray((candidate as any)?.recommendedInterventions)
        ? (candidate as any).recommendedInterventions.map((ri: any) => ({
            intervention: ri?.intervention,
            urgency: ri?.urgency,
            component: ri?.component,
            evidenceIds: Array.isArray(ri?.evidenceIds) && ri.evidenceIds.length > 0 ? ri.evidenceIds : candidateEvidenceIds.slice(0, 1),
            estimatedBenchmarkCost: ri?.estimatedBenchmarkCost ? {
              min: ri.estimatedBenchmarkCost.min ?? 0,
              max: ri.estimatedBenchmarkCost.max ?? 0,
            } : undefined,
          }))
        : (candidate as any)?.recommendedInterventions,
      overallHealthScore: (candidate as any)?.overallHealthScore,
      evidenceIds: candidateEvidenceIds,
      candidateConfidence: typeof (candidate as any)?.candidateConfidence === 'number'
        ? (candidate as any).candidateConfidence
        : ((candidate as any)?.overallHealthScore ? (candidate as any).overallHealthScore / 100 : 0.85),
    };

    // 6. Trusted Server Context (SERVER-OWNED METADATA)
    const serverContext: TrustedServerContext = {
      aggregateType: 'property',
      aggregateId: propInput.propertyId,
      sourceId: `properties/${propInput.propertyId}`,
      sourceVersion: String(sourceVersion),
      schemaVersion,
      pipelineVersion,
      modelVersion,
      promptVersion,
      generatedAt: new Date().toISOString(),
    };

    // 7. Establish Authoritative Firestore Reference (Fails closed if unavailable)
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

    // 10.5. Property Component Ontology Registration
    // Runs only after the canonical record is durably persisted, so ontology evidence
    // can never exist for a rollup that was not authoritatively accepted.
    if (activeDb && options?.persist !== false) {
      for (const comp of propertyIntelligence.buildingComponents) {
        if (comp.component) {
          await propertyOntologyService.registerComponentEvidence(
            {
              propertyId: propInput.propertyId,
              componentType: comp.component,
              sourceType: 'property_rollup',
              provenance: {
                origin: 'property_rollup',
                sourceId: `properties/${propInput.propertyId}`,
                sourceVersion: String(sourceVersion),
                pipelineVersion: canonical.pipelineVersion,
                modelVersion: canonical.modelVersion,
                promptVersion: canonical.promptVersion,
                schemaVersion: canonical.schemaVersion,
              },
              status: 'derived',
              observedAt: comp.lastObservedAt,
              confidence: comp.confidence,
              metadata: {
                condition: comp.condition,
                evidenceIds: comp.evidenceIds || [],
              },
            },
            { firestoreDb: activeDb }
          );
        }
      }
    }

    // 11. Immutable Historical Extraction Record (for backward compatibility)
    const extraction: IntelligenceExtraction = {
      extractionId: canonical.canonicalId,
      versionId: canonical.canonicalId,
      taskId: propInput.taskId,
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
      eventId: `ie_prop_${propInput.propertyId}_${canonical.canonicalId.slice(4, 16)}_${computeSha256(now).slice(0, 6)}`,
      aggregateType: 'property',
      aggregateId: propInput.propertyId,
      eventType: 'PROPERTY_ROLLUP_COMPLETED',
      schemaVersion: canonical.schemaVersion,
      pipelineVersion: canonical.pipelineVersion,
      modelVersion: canonical.modelVersion,
      promptVersion: canonical.promptVersion,
      createdAt: now,
      source: `properties/${propInput.propertyId}`,
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

  /**
   * Queries all authoritative historical jobs associated with a property from intelligence_jobs.
   */
  public async getHistoricalJobsForProperty(
    propertyId: string,
    db?: any
  ): Promise<JobIntelligence[]> {
    const activeDb = db || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PropertyIntelligence Error] Database reference required to query property jobs');
    }
    const snap = await activeDb.collection('intelligence_jobs').where('propertyId', '==', propertyId).get();
    if (!snap || snap.empty) {
      return [];
    }
    const docs = typeof snap.docs !== 'undefined' ? snap.docs : [];
    const jobs: JobIntelligence[] = [];
    for (const doc of docs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      if (data) {
        jobs.push({
          jobId: doc.id || data.jobId,
          ...data,
          propertyId,
        });
      }
    }
    return jobs;
  }
}

export const propertyIntelligenceService = new PropertyIntelligenceService();

export function createPropertyIntelligenceService(options?: {
  provider?: IntelligenceModelProvider;
  firestoreDb?: any;
}): PropertyIntelligenceService {
  return new PropertyIntelligenceService(options?.provider, { firestoreDb: options?.firestoreDb });
}
