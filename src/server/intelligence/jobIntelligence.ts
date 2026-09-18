/**
 * AnyTrader V8.1 — Derived Job Intelligence Service
 * 
 * Pipeline:
 * Authoritative Job + Evidence Registry
 * -> Evidence Verification ("No evidence, no assertion")
 * -> Asynchronous Extraction via Model Provider
 * -> Zod Schema Validation
 * -> Tier B Compressed Storage of Raw Model Output
 * -> Multidimensional Deterministic Confidence Calculation
 * -> Provenance Anchoring with SHA-256 Hashing
 * -> Canonical Intelligence Event & Compact Job Intelligence Projection (<= 100 KiB)
 */

import { calculateConfidence } from './confidence';
import { evidenceRegistry } from './evidenceRegistry';
import { GeminiIntelligenceProvider, IntelligenceModelProvider } from './geminiProvider';
import { buildProvenance, buildVersionId, computeSha256, INTELLIGENCE_PIPELINE_VERSION, INTELLIGENCE_SCHEMA_VERSION } from './provenance';
import { compressPayload, enforceFirestoreSafetyBudget } from './storageTier';
import { persistRawArtifact } from './rawArtifactStore';
import { immutableIntelligenceStore } from './immutableStore';
import { CanonicalIntelligenceEvent, IntelligenceExtraction, JobIntelligence } from './types';

export interface JobSourceInput {
  jobId: string;
  title: string;
  description: string;
  category?: string;
  postcode?: string;
  createdAt?: string;
  sourceVersion?: string | number;
  pipelineVersion?: string;
  promptVersion?: string;
  modelVersion?: string;
  schemaVersion?: string;
  provider?: string;
  taskId?: string;
  photos?: string[];
  photoObjects?: Array<{
    uri?: string;
    storagePath?: string;
    bytes?: Buffer | Uint8Array;
    mimeType?: string;
    byteSize?: number;
  }>;
  documents?: string[];
  documentObjects?: Array<{
    uri?: string;
    storagePath?: string;
    bytes?: Buffer | Uint8Array;
    mimeType?: string;
    byteSize?: number;
  }>;
}

export class JobIntelligenceService {
  constructor(private provider: IntelligenceModelProvider = new GeminiIntelligenceProvider()) {}

  public setProvider(provider: IntelligenceModelProvider): void {
    this.provider = provider;
  }

  public getProvider(): IntelligenceModelProvider {
    return this.provider;
  }

  /**
   * Derives structured job intelligence from authoritative job data and supporting evidence,
   * producing an immutable extraction record with deterministic version identity.
   */
  public async deriveJobIntelligence(
    job: JobSourceInput,
    overrideEvidenceIds?: string[],
    options?: { firestoreDb?: any; provider?: IntelligenceModelProvider }
  ): Promise<{
    jobIntelligence: JobIntelligence;
    extraction: IntelligenceExtraction;
    event: CanonicalIntelligenceEvent;
    versionId: string;
    rawCandidate?: any;
  }> {
    if (options?.firestoreDb) {
      evidenceRegistry.setDb(options.firestoreDb);
    }

    // 1. Gather & verify evidence
    let evidenceItems = await evidenceRegistry.getForAggregate('job', job.jobId, options?.firestoreDb);

    // If not yet registered in registry, register the baseline text & media
    if (evidenceItems.length === 0) {
      if (job.description && job.description.trim().length > 0) {
        await evidenceRegistry.register(
          'job',
          job.jobId,
          'user_description',
          `jobs/${job.jobId}/description`,
          job.description,
          { title: job.title },
          true,
          { documentId: job.jobId, sourceField: 'description' }
        );
      }

      // 1a. Handle structured photo objects with real binary bytes if present
      if (job.photoObjects && job.photoObjects.length > 0) {
        for (const [idx, photoObj] of job.photoObjects.entries()) {
          const sourceRef = photoObj.storagePath || photoObj.uri || `photos/${idx}`;
          if (photoObj.bytes) {
            await evidenceRegistry.register(
              'job',
              job.jobId,
              'image',
              sourceRef,
              photoObj.bytes,
              { mimeType: photoObj.mimeType || 'image/jpeg', byteSize: photoObj.byteSize, index: idx },
              true,
              { uri: photoObj.uri, storagePath: photoObj.storagePath, sourceField: `photos[${idx}]` }
            );
          } else {
            await evidenceRegistry.registerReferenceOnly(
              'job',
              job.jobId,
              'image',
              sourceRef,
              { mimeType: photoObj.mimeType, index: idx },
              { uri: photoObj.uri, storagePath: photoObj.storagePath, sourceField: `photos[${idx}]` }
            );
          }
        }
      } else if (job.photos && job.photos.length > 0) {
        // Fallback: reference-only pointers without fabricated byte hashes
        for (const [idx, photoUrl] of job.photos.entries()) {
          await evidenceRegistry.registerReferenceOnly(
            'job',
            job.jobId,
            'image',
            photoUrl,
            { photoUrl, index: idx },
            { uri: photoUrl, storagePath: photoUrl.startsWith('jobs/') ? photoUrl : undefined, sourceField: `photos[${idx}]` }
          );
        }
      }

      // 1b. Handle document objects with real binary bytes or reference-only
      if (job.documentObjects && job.documentObjects.length > 0) {
        for (const [idx, docObj] of job.documentObjects.entries()) {
          const sourceRef = docObj.storagePath || docObj.uri || `documents/${idx}`;
          if (docObj.bytes) {
            await evidenceRegistry.register(
              'job',
              job.jobId,
              'document',
              sourceRef,
              docObj.bytes,
              { mimeType: docObj.mimeType || 'application/pdf', byteSize: docObj.byteSize, index: idx },
              true,
              { uri: docObj.uri, storagePath: docObj.storagePath, sourceField: `documents[${idx}]` }
            );
          } else {
            await evidenceRegistry.registerReferenceOnly(
              'job',
              job.jobId,
              'document',
              sourceRef,
              { mimeType: docObj.mimeType, index: idx },
              { uri: docObj.uri, storagePath: docObj.storagePath, sourceField: `documents[${idx}]` }
            );
          }
        }
      } else if (job.documents && job.documents.length > 0) {
        for (const [idx, docUrl] of job.documents.entries()) {
          await evidenceRegistry.registerReferenceOnly(
            'job',
            job.jobId,
            'document',
            docUrl,
            { docUrl, index: idx },
            { uri: docUrl, storagePath: docUrl.startsWith('jobs/') ? docUrl : undefined, sourceField: `documents[${idx}]` }
          );
        }
      }

      evidenceItems = await evidenceRegistry.getForAggregate('job', job.jobId);
    }

    const targetEvidenceIds = overrideEvidenceIds || evidenceItems.map((e) => e.evidenceId);

    // Enforce invariant: No evidence, no assertion!
    evidenceRegistry.assertHasEvidence(targetEvidenceIds);

    // 2. Prepare untrusted evidence for the model provider
    const untrustedSources = evidenceItems
      .filter((e) => targetEvidenceIds.includes(e.evidenceId))
      .map((e) => ({
        id: e.evidenceId,
        type: e.evidenceType,
        content: e.evidenceType === 'user_description' ? job.description : `[Reference: ${e.sourceRef}]`,
      }));

    // 3. Asynchronous Model Extraction
    const effectiveProvider = (options?.provider && typeof (options.provider as any).extractJobCandidate === 'function')
      ? options.provider
      : this.provider;
    const extractionResult = await effectiveProvider.extractJobCandidate(job.jobId, untrustedSources);
    const candidate = extractionResult.candidate;

    // Determine version identifiers
    const sourceVersion = job.sourceVersion || '1';
    const pipelineVersion = job.pipelineVersion || INTELLIGENCE_PIPELINE_VERSION;
    const modelVersion = job.modelVersion || extractionResult.metrics.model;
    const promptVersion = job.promptVersion || 'job_extraction_v8.1';
    const schemaVersion = job.schemaVersion || INTELLIGENCE_SCHEMA_VERSION;
    const providerName = job.provider || 'google_genai';

    const versionId = buildVersionId(
      'job',
      job.jobId,
      sourceVersion,
      pipelineVersion,
      modelVersion,
      promptVersion,
      schemaVersion
    );

    // 4. Tier B: Store Raw Model Output Gzip-Compressed
    const storagePath = `intelligence_raw/job/${job.jobId}/extraction_${versionId}.json.gz`;
    const { compressedBuffer, manifest: rawManifestDraft } = compressPayload(extractionResult.rawResponseText, storagePath);
    const manifest = await persistRawArtifact({ compressedBuffer, manifest: rawManifestDraft });

    // 5. Calculate Multidimensional Confidence
    const hasMedia = evidenceItems.some((e) => e.evidenceType === 'image' || e.evidenceType === 'video');
    const hasSpec = evidenceItems.some((e) => e.evidenceType === 'structured_spec');
    const hasDesc = evidenceItems.some((e) => e.evidenceType === 'user_description');

    const confidence = calculateConfidence({
      rawExtractionScore: candidate.candidateConfidence,
      evidenceCount: targetEvidenceIds.length,
      hasMediaEvidence: hasMedia,
      hasVerifiedSpec: hasSpec,
      hasUserDescription: hasDesc,
      classificationConfidence: candidate.category ? 0.90 : 0.60,
      sourceAgeHours: 0,
      method: 'model_validated',
    });

    // 6. Build Provenance
    const provenanceContent = `${job.jobId}:${candidate.category}:${manifest.sha256}`;
    const provenance = buildProvenance(
      `jobs/${job.jobId}`,
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
      taskId: job.taskId,
      aggregateId: job.jobId,
      aggregateType: 'job',
      sourceAggregateId: job.jobId,
      sourceType: 'job',
      sourceVersion,
      pipelineVersion,
      modelVersion,
      promptVersion,
      schemaVersion,
      provider: providerName,
      evidenceIds: targetEvidenceIds,
      rawManifest: manifest,
      structuredCandidate: {
        category: candidate.category,
        buildingComponent: candidate.buildingComponent,
        observedProblem: candidate.observedProblem,
        extractedScope: candidate.extractedScope,
        recommendedIntervention: candidate.recommendedIntervention,
        candidateConfidence: candidate.candidateConfidence,
        identifiedEvidenceReferences: candidate.identifiedEvidenceReferences,
      },
      confidence,
      provenance,
      generatedAt: now,
      createdAt: now,
    };

    // 8. Compact Job Intelligence Projection (Current Active Pointer State)
    const jobIntelligence: JobIntelligence = {
      jobId: job.jobId,
      currentVersionId: versionId,
      currentPipelineVersion: pipelineVersion,
      currentModelVersion: modelVersion,
      currentPromptVersion: promptVersion,
      currentSchemaVersion: schemaVersion,
      currentSourceVersion: sourceVersion,
      category: candidate.category,
      buildingComponent: candidate.buildingComponent,
      observedProblem: candidate.observedProblem,
      extractedScope: candidate.extractedScope,
      recommendedIntervention: candidate.recommendedIntervention,
      evidenceIds: targetEvidenceIds,
      confidence,
      provenance,
      pipelineVersion,
      updatedAt: now,
    };

    // Verify Firestore Safety Budget (<= 100 KiB)
    const budgetCheck = enforceFirestoreSafetyBudget(jobIntelligence);
    if (!budgetCheck.valid) {
      throw new Error(`[JobIntelligence Budget Error] Exceeded 100 KiB budget: ${budgetCheck.actualBytes} bytes`);
    }

    // 9. Canonical Intelligence Event
    const event: CanonicalIntelligenceEvent = {
      eventId: `ie_job_${job.jobId}_${versionId.slice(4, 16)}_${computeSha256(now).slice(0, 6)}`,
      aggregateType: 'job',
      aggregateId: job.jobId,
      eventType: 'JOB_ANALYSIS_COMPLETED',
      schemaVersion,
      pipelineVersion,
      modelVersion,
      promptVersion,
      createdAt: now,
      source: `jobs/${job.jobId}`,
      evidenceIds: targetEvidenceIds,
      confidence,
      provenance,
      status: 'valid',
      payload: {
        versionId,
        sourceVersion,
        category: candidate.category,
        buildingComponent: candidate.buildingComponent,
        observedProblem: candidate.observedProblem,
        rawManifest: manifest,
        tokenMetrics: extractionResult.metrics,
      },
    };

    const candidateEvidence = (candidate as any).evidenceIds ||
      (candidate.identifiedEvidenceReferences && candidate.identifiedEvidenceReferences.length > 0
        ? candidate.identifiedEvidenceReferences
        : targetEvidenceIds);

    const rawCandidateObj: any = {
      domain: ((candidate as any).domain || candidate.category || 'general').toLowerCase(),
      category: candidate.category,
      component: (candidate as any).component || candidate.buildingComponent,
      observations: (candidate as any).observations || [
        {
          description: candidate.observedProblem || 'Observed problem',
          component: candidate.buildingComponent,
          evidenceIds: candidateEvidence,
        },
      ],
      inferences: (candidate as any).inferences || [
        {
          hypothesis: candidate.recommendedIntervention || (Array.isArray(candidate.extractedScope) ? candidate.extractedScope.join('; ') : 'Recommended intervention'),
          confidence: candidate.candidateConfidence,
          supportingEvidenceIds: candidateEvidence,
          targetComponent: candidate.buildingComponent,
        },
      ],
      interventions: (candidate as any).interventions || candidate.extractedScope?.map((scope: string) => ({
        description: scope,
        component: candidate.buildingComponent,
        evidenceIds: candidateEvidence,
      })),
      evidenceIds: candidateEvidence,
      candidateConfidence: candidate.candidateConfidence,
    };

    if ((candidate as any).problems) rawCandidateObj.problems = (candidate as any).problems;
    if ((candidate as any).outcomes) rawCandidateObj.outcomes = (candidate as any).outcomes;
    if ((candidate as any).conditions) rawCandidateObj.conditions = (candidate as any).conditions;

    // Forward model-supplied metadata attempts so the security boundary can explicitly strip and enforce server context
    if ((candidate as any).aggregateId) rawCandidateObj.aggregateId = (candidate as any).aggregateId;
    if ((candidate as any).aggregateType) rawCandidateObj.aggregateType = (candidate as any).aggregateType;
    if ((candidate as any).sourceId) rawCandidateObj.sourceId = (candidate as any).sourceId;
    if ((candidate as any).pipelineVersion) rawCandidateObj.pipelineVersion = (candidate as any).pipelineVersion;
    if ((candidate as any).modelVersion) rawCandidateObj.modelVersion = (candidate as any).modelVersion;
    if ((candidate as any).promptVersion) rawCandidateObj.promptVersion = (candidate as any).promptVersion;
    if ((candidate as any).schemaVersion) rawCandidateObj.schemaVersion = (candidate as any).schemaVersion;
    if ((candidate as any).generatedAt) rawCandidateObj.generatedAt = (candidate as any).generatedAt;

    // Persist extraction, event, and active summary projection to Firestore
    await immutableIntelligenceStore.persistOutput({
      db: options?.firestoreDb,
      aggregateType: 'job',
      aggregateId: job.jobId,
      versionId,
      extraction,
      event,
      summaryProjection: jobIntelligence,
      summary: jobIntelligence,
      sourceVersion,
    });

    return {
      jobIntelligence,
      extraction,
      event,
      versionId,
      rawCandidate: rawCandidateObj,
    };
  }
}

export const jobIntelligenceService = new JobIntelligenceService();
