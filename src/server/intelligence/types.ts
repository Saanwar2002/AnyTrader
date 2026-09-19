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

/**
 * Step 3: Controlled Source Types vocabulary
 */
export type CanonicalSourceType =
  | 'job'
  | 'property'
  | 'contractor'
  | 'quote'
  | 'review'
  | 'customer_request'
  | 'project'
  | 'material'
  | 'imported_archive'
  | 'external_source';

export type SourceType = CanonicalSourceType | (string & {});

/**
 * Step 2: Evidence Categories / Kinds
 */
export type CanonicalEvidenceCategory =
  | 'MEDIA'
  | 'DOCUMENT'
  | 'TEXT'
  | 'STRUCTURED_RECORD'
  | 'USER_ASSERTION'
  | 'SYSTEM_RECORD'
  | 'EXTERNAL_IMPORT';

export type EvidenceCategory = CanonicalEvidenceCategory | (string & {});

export type CanonicalIntelligenceEventType =
  | 'JOB_ANALYSIS_COMPLETED'
  | 'PROPERTY_ROLLUP_COMPLETED'
  | 'EVIDENCE_INGESTED'
  | 'EXTRACTION_VALIDATED'
  | 'QUALITY_REVIEW_APPLIED'
  | 'INTELLIGENCE_RETRACTED'
  | 'CANONICAL_INTELLIGENCE_NORMALIZED';

export type IntelligenceEventType = CanonicalIntelligenceEventType | (string & {});


/**
 * Step 3: Controlled Evidence Types vocabulary
 */
export type CanonicalEvidenceType =
  | 'photo'
  | 'video'
  | 'document'
  | 'text'
  | 'quote'
  | 'completion_record'
  | 'review'
  | 'inspection_record'
  | 'structured_record'
  | 'user_statement'
  | 'imported_record'
  | 'image'
  | 'user_description'
  | 'structured_spec';

export type EvidenceType = CanonicalEvidenceType | (string & {});

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
  contractorId?: string;
  customerRequestId?: string;
  quoteId?: string;
  reviewId?: string;
  projectId?: string;
  materialId?: string;
  sourceField?: string;
  sourceVersion?: string | number;
  uri?: string;
  [key: string]: any;
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
  contentHash?: string;
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
  sourceType: SourceType;
  sourceId: string;
  sourceVersion: string | number;
  evidenceType: EvidenceType;
  evidenceCategory?: EvidenceCategory;
  contentHash: string;       // SHA-256 of raw content (or empty string if reference only)
  contentSize?: number;      // Size in bytes when known
  byteSize: number;          // Backward-compatible byte size
  mimeType?: string;         // MIME type when applicable
  storagePath?: string;      // Storage path when applicable (media, docs)
  createdAt: string;         // ISO 8601
  capturedAt?: string;       // ISO 8601 when known
  schemaVersion: string;     // Model schema version (e.g. 'v8.1.0')
  integrityStatus: EvidenceIntegrityStatus;
  verified: boolean;

  // Step 10: Lightweight Evidence Quality Metadata
  evidenceQuality?: number;   // 0.0 to 1.0 (or quality score)
  sourceReliability?: number; // 0.0 to 1.0
  temporalFreshness?: number; // 0.0 to 1.0

  // Backward-compatibility and contextual references
  sourceRef: string;
  sourceReference?: EvidenceSourceReference;
  metadata: Record<string, unknown>;
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
  leaseId?: string;
  leaseAcquiredAt?: string;
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
  propertyId?: string;
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

// ==========================================
// Task 11: Canonical Intelligence Normalized Types
// ==========================================

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type UrgencyLevel = 'immediate' | 'medium_term' | 'planned';
export type OutcomeStatus = 'resolved' | 'partially_resolved' | 'failed' | 'pending' | (string & {});

/**
 * Source-backed factual observation directly derived from evidence.
 */
export interface CanonicalObservation {
  observationId: string;
  component?: string;
  condition?: string;
  description: string;
  evidenceIds: string[];
  capturedAt?: string;
  sourceField?: string;
  metadata?: Record<string, unknown>;
}

/**
 * AI/Model hypothesis, risk assessment, or recommended action with confidence scoring.
 * Explicitly distinct from factual observations.
 */
export interface CanonicalInference {
  inferenceId: string;
  type: 'problem' | 'intervention' | 'outcome' | 'risk' | 'recommendation' | (string & {});
  targetComponent?: string;
  hypothesis: string;
  confidence: number; // 0.0 to 1.0
  reasoning?: string;
  supportingEvidenceIds: string[];
  supportingObservationIds?: string[];
  severity?: SeverityLevel;
  urgency?: UrgencyLevel;
  metadata?: Record<string, unknown>;
}

/**
 * Canonical problem assertion (traceable to supporting evidence).
 */
export interface CanonicalProblem {
  problemCode?: string;
  description: string;
  severity?: SeverityLevel;
  component?: string;
  evidenceIds: string[];
  inferenceId?: string;
}

/**
 * Canonical intervention / remediation action (traceable to supporting evidence).
 */
export interface CanonicalIntervention {
  interventionCode?: string;
  description: string;
  urgency?: UrgencyLevel;
  component?: string;
  estimatedBenchmarkCost?: {
    min: number;
    max: number;
    currency?: string;
  };
  evidenceIds: string[];
  inferenceId?: string;
}

/**
 * Canonical outcome assertion (traceable to supporting evidence).
 */
export interface CanonicalOutcome {
  outcomeCode?: string;
  description: string;
  component?: string;
  status?: OutcomeStatus;
  evidenceIds: string[];
}

/**
 * Canonical condition descriptor (traceable to supporting evidence).
 */
export interface CanonicalCondition {
  condition: string;
  severity?: SeverityLevel;
  component?: string;
  evidenceIds: string[];
}

/**
 * Full Canonical Intelligence Document.
 * Platform-wide, versioned, provenance-anchored, and immutable.
 */
export interface CanonicalIntelligence {
  canonicalId: string;
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  propertyId?: string;
  domain: string;
  category?: string;
  component?: string;
  observations: CanonicalObservation[];
  conditions?: CanonicalCondition[];
  problems?: CanonicalProblem[];
  interventions?: CanonicalIntervention[];
  outcomes?: CanonicalOutcome[];
  inferences: CanonicalInference[];
  evidenceIds: string[];
  confidence: ConfidenceScores;
  provenance: Provenance;
  schemaVersion: string;
  pipelineVersion: string;
  modelVersion: string;
  promptVersion: string;
  sourceVersion: string | number;
  generatedAt: string;
  contentHash?: string;
}

export type CanonicalIntelligenceInput = Partial<
  Omit<CanonicalIntelligence, 'canonicalId' | 'schemaVersion' | 'pipelineVersion' | 'generatedAt'>
> & {
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  domain: string;
  evidenceIds?: string[];
  confidence?: Partial<ConfidenceScores> | ConfidenceScores;
  provenance?: Partial<Provenance> | Provenance;
  schemaVersion?: string;
  pipelineVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
  sourceVersion?: string | number;
  generatedAt?: string;
};

/**
 * Task 14: Processing Execution Records & Observability Types
 */
export type ProcessingRunStatus =
  | 'started'
  | 'succeeded'
  | 'failed'
  | 'retrying'
  | 'dead_letter';

export type ControlledErrorCode =
  | 'validation_error'
  | 'lineage_error'
  | 'authentication_error'
  | 'authorization_error'
  | 'provider_error'
  | 'rate_limit'
  | 'timeout'
  | 'network_error'
  | 'storage_error'
  | 'storage_persistence_error'
  | 'storage_integrity_error'
  | 'firestore_error'
  | 'configuration_error'
  | 'payload_too_large'
  | 'unknown_error';

export interface IntelligenceProcessingRun {
  runId: string;
  taskId: string;
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  taskType: TaskType | string;
  status: ProcessingRunStatus;
  attempt: number;
  workerId: string;
  leaseId: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  pipelineVersion: string;
  schemaVersion: string;
  provider: string;
  modelVersion: string;
  promptVersion: string;
  inputEvidenceCount: number;
  inputBytes: number;
  outputBytes: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost: number;
  costCurrency: string;
  pricingVersion: string;
  errorCode?: ControlledErrorCode | string;
  errorClass?: string;
  retryable?: boolean;
  sanitizedDiagnostic?: string;
  createdAt: string;
}

