/**
 * AnyTrader V8.1 — Structured Intelligence Validation Schemas
 * 
 * Strict Zod schemas enforcing:
 * - Evidence metadata boundaries
 * - Multidimensional confidence score constraints
 * - Provenance requirements
 * - Model candidate structured validation (preventing hallucinated or malformed fields)
 * - Safe payload sizes
 */

import { z } from 'zod';

export const ConfidenceScoreSchema = z.object({
  overall: z.number().min(0).max(1),
  extraction: z.number().min(0).max(1),
  evidenceQuality: z.number().min(0).max(1),
  classification: z.number().min(0).max(1),
  temporalFreshness: z.number().min(0).max(1),
  method: z.enum(['deterministic_heuristic', 'model_validated', 'human_verified']),
});

export const ProvenanceSchema = z.object({
  source: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
  pipelineVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/i, 'Must be a valid SHA-256 hash'),
});

export const StorageManifestSchema = z.object({
  encoding: z.enum(['gzip', 'identity']),
  originalBytes: z.number().int().nonnegative(),
  compressedBytes: z.number().int().nonnegative(),
  compressionRatio: z.number().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  schemaVersion: z.string().min(1),
  storagePath: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const EvidenceRegistrationSchema = z.object({
  aggregateType: z.enum(['job', 'property']),
  aggregateId: z.string().min(1),
  evidenceType: z.enum(['image', 'video', 'document', 'user_description', 'structured_spec', 'quote', 'review']),
  sourceRef: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i),
  byteSize: z.number().int().positive(),
  metadata: z.record(z.unknown()).default({}),
  verified: z.boolean().default(false),
});

/**
 * Strict Schema for Job Intelligence candidate output produced by AI models
 */
export const JobExtractionCandidateSchema = z.object({
  category: z.string().min(1).max(100),
  buildingComponent: z.string().min(1).max(100),
  observedProblem: z.string().min(1).max(500),
  extractedScope: z.array(z.string().min(1).max(200)).min(1).max(20),
  recommendedIntervention: z.string().min(1).max(500),
  candidateConfidence: z.number().min(0).max(1),
  identifiedEvidenceReferences: z.array(z.string().min(1)).min(1, 'Model extraction must reference at least one evidence item'),
});

/**
 * Strict Schema for Property Roll-up candidate output
 */
export const PropertyRollupCandidateSchema = z.object({
  buildingComponents: z.array(
    z.object({
      component: z.string().min(1).max(100),
      condition: z.string().min(1).max(100),
      confidence: z.number().min(0).max(1),
      evidenceIds: z.array(z.string()),
    })
  ).max(50),
  observedConditions: z.array(
    z.object({
      condition: z.string().min(1).max(200),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      component: z.string().min(1).max(100),
      evidenceIds: z.array(z.string()),
    })
  ).max(50),
  recommendedInterventions: z.array(
    z.object({
      intervention: z.string().min(1).max(300),
      urgency: z.enum(['immediate', 'medium_term', 'planned']),
      estimatedBenchmarkCost: z.object({
        min: z.number().nonnegative(),
        max: z.number().nonnegative(),
      }).optional(),
      component: z.string().min(1).max(100),
    })
  ).max(30),
  overallHealthScore: z.number().min(0).max(100),
});

export const QualityReviewInputSchema = z.object({
  targetCollection: z.enum(['intelligence_jobs', 'intelligence_properties', 'intelligence_events']),
  targetId: z.string().min(1),
  action: z.enum(['approve', 'reject', 'correct']),
  reviewerId: z.string().min(1),
  reason: z.string().min(1).max(1000),
  originalCandidate: z.record(z.unknown()),
  correctedResult: z.record(z.unknown()).optional(),
}).refine((data) => {
  if (data.action === 'correct' && !data.correctedResult) {
    return false;
  }
  return true;
}, {
  message: "correctedResult is mandatory when action is 'correct'",
  path: ['correctedResult'],
});
