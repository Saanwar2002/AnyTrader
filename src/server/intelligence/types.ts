/**
 * AnyTrader V8.1 — Structured Intelligence Domain Types
 * 
 * Defines the immutable schema definitions for:
 * - Canonical Intelligence Events
 * - Intelligence Evidence Registry
 * - Intelligence Extractions & Storage Manifests
 * - Intelligence Tasks & Async Lifecycle
 * - Derived Job & Property Intelligence
 * - Quality Assurance & Human Correction Provenance
 */

export type CanonicalAggregateType =
  | 'job'
  | 'property'
  | 'contractor'
  | 'quote'
  | 'review'
  | 'material'
  | 'project'
  | 'customer_request';

export type IntelligenceAggregateType = CanonicalAggregateType | (string & {});

export type IntelligenceEventType =
  | 'JOB_ANALYSIS_COMPLETED'
  | 'PROPERTY_ROLLUP_COMPLETED'
  | 'EVIDENCE_INGESTED'
  | 'EXTRACTION_VALIDATED'
  | 'QUALITY_REVIEW_APPLIED'
  | 'INTELLIGENCE_RETRACTED';

export type EvidenceType =
  | 'image'
  | 'video'
  | 'document'
  | 'user_description'
  | 'structured_spec'
  | 'quote'
  | 'review';

export type TaskStatus = 'pending' | 'processing' | 'succeeded' | 'retrying' | 'dead_letter';

export type TaskType =
  | 'job_extraction'
  | 'property_rollup'
  | 'evidence_ingestion'
  | 'quality_reprocess';

export type ConfidenceMethod =
  | 'deterministic_heuristic'
  | 'model_validated'
  | 'human_verified';

export type EvidenceIntegrityStatus =
  | 'verified'
  | 'unverified'
  | 'reference_only'
  | 'hash_pending';

export interface EvidenceSourceReference {
  storagePath?: string;
  documentId?: string;
  jobId?: string;
  propertyId?: string;
  sourceField?: string;
  sourceVersion?: string | number;
  uri?: string;
}

export interface ConfidenceScores {
  overall: number;              // 0.0 to 1.0
  extraction: number;           // 0.0 to 1.0
  evidenceQuality: number;      // 0.0 to 1.0 (zero evidence = 0)
  classification: number;       // 0.0 to 1.0
  temporalFreshness: number;    // 0.0 to 1.0
  method: ConfidenceMethod;
}

export interface Provenance {
  source: string;
  evidenceIds: string[];
  pipelineVersion: string;
  modelVersion: string;
  promptVersion: string;
  generatedAt: string;
  sourceContentHash: string; // SHA-256
}

export interface StorageManifest {
  encoding: 'gzip' | 'identity';
  originalBytes: number;
  compressedBytes: number;
  compressionRatio: number;
  sha256: string;
  schemaVersion: string;
  storagePath: string;
  createdAt: string;
}

export interface IntelligenceEvidence {
  evidenceId: string;
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  evidenceType: EvidenceType;
  sourceRef: string;
  sourceReference?: EvidenceSourceReference;
  contentHash: string;       // SHA-256 of raw content (or empty string if reference only)
  byteSize: number;
  integrityStatus: EvidenceIntegrityStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  verified: boolean;
}

export interface CanonicalIntelligenceEvent {
  eventId: string;
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  eventType: IntelligenceEventType;
  schemaVersion: string;
  pipelineVersion: string;
  modelVersion: string;
  promptVersion: string;
  createdAt: string;
  source: string;
  evidenceIds: string[];
  confidence: ConfidenceScores;
  provenance: Provenance;
  status: 'valid' | 'retracted' | 'superseded';
  payload: Record<string, unknown>;
}

export interface IntelligenceVersionMetadata {
  schemaVersion: string;
  pipelineVersion: string;
  modelVersion: string;
  promptVersion: string;
  sourceVersion: string | number;
  generatedAt: string;
  provider?: string;
  sourceAggregateId?: string;
  sourceType?: IntelligenceAggregateType;
  evidenceIds?: string[];
  extractionId?: string;
  versionId?: string;
  taskId?: string;
}

export interface IntelligenceExtraction {
  extractionId: string;
  versionId: string;
  taskId?: string;
  aggregateId: string;
  aggregateType: IntelligenceAggregateType;
  sourceAggregateId?: string;
  sourceType?: IntelligenceAggregateType;
  sourceVersion: string | number;
  pipelineVersion: string;
  modelVersion: string;
  promptVersion: string;
  schemaVersion: string;
  provider: string;
  evidenceIds: string[];
  rawManifest: StorageManifest;
  structuredCandidate: Record<string, unknown>;
  validationErrors?: string[];
  confidence: ConfidenceScores;
  provenance: Provenance;
  generatedAt: string;
  createdAt: string;
}

export interface IntelligenceTask {
  taskId: string;
  taskType: TaskType;
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  idempotencyKey: string;     // SHA-256: aggregateId + eventType + sourceVersion + pipelineVersion
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  nextAttemptAt?: string;
  nextRetryAt?: string;       // Alias for backwards compatibility
  lastError?: string;
  errorCode?: string;
  provider?: string;
  modelVersion?: string;
  pipelineVersion?: string;
  workerId?: string;
  leaseExpiresAt?: string;
  error?: {
    classification: string;
    message: string;
    timestamp: string;
  };
  processingDurationMs?: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  estimatedCostUsd?: number;
  providerMetrics?: {
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
  };
  payload: Record<string, unknown>;
}

export interface JobIntelligence {
  jobId: string;
  currentVersionId?: string;
  currentPipelineVersion?: string;
  currentModelVersion?: string;
  currentPromptVersion?: string;
  currentSchemaVersion?: string;
  currentSourceVersion?: string | number;
  category: string;
  buildingComponent: string;
  observedProblem: string;
  extractedScope: string[];
  recommendedIntervention: string;
  evidenceIds: string[];
  confidence: ConfidenceScores;
  provenance: Provenance;
  pipelineVersion: string;
  updatedAt: string;
}

export interface PropertyBuildingComponent {
  component: string;
  condition: string;
  lastObservedAt: string;
  confidence: number;
  evidenceIds: string[];
}

export interface PropertyObservedCondition {
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  evidenceIds: string[];
}

export interface PropertyRecommendedIntervention {
  intervention: string;
  urgency: 'immediate' | 'medium_term' | 'planned';
  estimatedBenchmarkCost?: {
    min: number;
    max: number;
  };
  component: string;
}

export interface PropertyIntelligence {
  propertyId: string;
  currentVersionId?: string;
  currentPipelineVersion?: string;
  currentModelVersion?: string;
  currentPromptVersion?: string;
  currentSchemaVersion?: string;
  currentSourceVersion?: string | number;
  buildingComponents: PropertyBuildingComponent[];
  observedConditions: PropertyObservedCondition[];
  recommendedInterventions: PropertyRecommendedIntervention[];
  derivedFromJobIds: string[];
  evidenceIds: string[];
  overallHealthScore: number; // 0 to 100
  confidence: ConfidenceScores;
  provenance: Provenance;
  pipelineVersion: string;
  updatedAt: string;
}

export interface QualityReview {
  qualityId: string;
  targetCollection: 'intelligence_jobs' | 'intelligence_properties' | 'intelligence_events';
  targetId: string;
  targetVersionId?: string;
  action: 'approve' | 'reject' | 'correct';
  reviewerId: string;
  reviewedAt: string;
  reason: string;
  originalCandidate: Record<string, unknown>;
  correctedResult?: Record<string, unknown>;
  correctionProvenance: {
    reviewerId: string;
    timestamp: string;
    hash: string;
  };
}
