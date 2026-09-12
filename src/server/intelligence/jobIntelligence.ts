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
import { buildProvenance, computeSha256, INTELLIGENCE_PIPELINE_VERSION, INTELLIGENCE_SCHEMA_VERSION } from './provenance';
import { compressPayload, enforceFirestoreSafetyBudget } from './storageTier';
import { CanonicalIntelligenceEvent, JobIntelligence } from './types';

export interface JobSourceInput {
  jobId: string;
  title: string;
  description: string;
  category?: string;
  postcode?: string;
  createdAt?: string;
  photos?: string[];
  documents?: string[];
}

export class JobIntelligenceService {
  constructor(private provider: IntelligenceModelProvider = new GeminiIntelligenceProvider()) {}

  /**
   * Derives structured job intelligence from authoritative job data and supporting evidence
   */
  public async deriveJobIntelligence(
    job: JobSourceInput,
    overrideEvidenceIds?: string[]
  ): Promise<{
    jobIntelligence: JobIntelligence;
    event: CanonicalIntelligenceEvent;
  }> {
    // 1. Gather & verify evidence
    let evidenceItems = evidenceRegistry.getForAggregate('job', job.jobId);

    // If not yet registered in registry, register the baseline text & media
    if (evidenceItems.length === 0) {
      if (job.description && job.description.trim().length > 0) {
        evidenceRegistry.register(
          'job',
          job.jobId,
          'user_description',
          `jobs/${job.jobId}/description`,
          job.description,
          { title: job.title },
          true
        );
      }

      if (job.photos && job.photos.length > 0) {
        for (const [idx, photoUrl] of job.photos.entries()) {
          evidenceRegistry.register(
            'job',
            job.jobId,
            'image',
            photoUrl,
            Buffer.from(`photo_evidence_${job.jobId}_${idx}_${photoUrl}`),
            { photoUrl, index: idx },
            true
          );
        }
      }

      evidenceItems = evidenceRegistry.getForAggregate('job', job.jobId);
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
    const extractionResult = await this.provider.extractJobCandidate(job.jobId, untrustedSources);
    const candidate = extractionResult.candidate;

    // 4. Tier B: Store Raw Model Output Gzip-Compressed
    const storagePath = `intelligence_raw/job/${job.jobId}/extraction_${Date.now()}.json.gz`;
    const { manifest } = compressPayload(extractionResult.rawResponseText, storagePath);

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
      extractionResult.metrics.model,
      'job_extraction_v8.1',
      provenanceContent
    );

    const now = new Date().toISOString();

    // 7. Compact Job Intelligence Projection
    const jobIntelligence: JobIntelligence = {
      jobId: job.jobId,
      category: candidate.category,
      buildingComponent: candidate.buildingComponent,
      observedProblem: candidate.observedProblem,
      extractedScope: candidate.extractedScope,
      recommendedIntervention: candidate.recommendedIntervention,
      evidenceIds: targetEvidenceIds,
      confidence,
      provenance,
      pipelineVersion: INTELLIGENCE_PIPELINE_VERSION,
      updatedAt: now,
    };

    // Verify Firestore Safety Budget (<= 100 KiB)
    const budgetCheck = enforceFirestoreSafetyBudget(jobIntelligence);
    if (!budgetCheck.valid) {
      throw new Error(`[JobIntelligence Budget Error] Exceeded 100 KiB budget: ${budgetCheck.actualBytes} bytes`);
    }

    // 8. Canonical Intelligence Event
    const event: CanonicalIntelligenceEvent = {
      eventId: `ie_job_${job.jobId}_${computeSha256(now).slice(0, 10)}`,
      aggregateType: 'job',
      aggregateId: job.jobId,
      eventType: 'JOB_ANALYSIS_COMPLETED',
      schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
      pipelineVersion: INTELLIGENCE_PIPELINE_VERSION,
      modelVersion: extractionResult.metrics.model,
      promptVersion: 'job_extraction_v8.1',
      createdAt: now,
      source: `jobs/${job.jobId}`,
      evidenceIds: targetEvidenceIds,
      confidence,
      provenance,
      status: 'valid',
      payload: {
        category: candidate.category,
        buildingComponent: candidate.buildingComponent,
        observedProblem: candidate.observedProblem,
        rawManifest: manifest,
        tokenMetrics: extractionResult.metrics,
      },
    };

    return {
      jobIntelligence,
      event,
    };
  }
}

export const jobIntelligenceService = new JobIntelligenceService();
