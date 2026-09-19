/**
 * AnyTrader V8.1 — Canonical Intelligence Zod Schema & Validation
 * 
 * Provides:
 * - Strongly typed Zod schemas for Observations vs Inferences
 * - Traceability validation ("No evidence, no assertion")
 * - Support for platform-wide aggregate types and partial knowledge
 * - Schema versioning and provenance preservation
 */

import { z } from 'zod';
import { ConfidenceScoreSchema, ProvenanceSchema } from './schemas';

export const SeverityLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const UrgencyLevelSchema = z.enum(['immediate', 'medium_term', 'planned']);

/**
 * Factual observation directly derived from source evidence.
 */
export const CanonicalObservationSchema = z.object({
  observationId: z.string().min(1, 'observationId is required'),
  component: z.string().min(1).optional(),
  condition: z.string().min(1).optional(),
  description: z.string().min(1, 'Observation description is required').max(2000),
  evidenceIds: z.array(z.string().min(1)).min(1, 'Observation must reference at least one evidenceId'),
  capturedAt: z.string().optional(),
  sourceField: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * AI/Model hypothesis or recommendation with explicit confidence and supporting evidence.
 */
export const CanonicalInferenceSchema = z.object({
  inferenceId: z.string().min(1, 'inferenceId is required'),
  type: z.string().min(1, 'Inference type is required'),
  targetComponent: z.string().min(1).optional(),
  hypothesis: z.string().min(1, 'Hypothesis statement is required').max(2000),
  confidence: z.number().min(0.0).max(1.0, 'Inference confidence must be between 0.0 and 1.0'),
  reasoning: z.string().max(3000).optional(),
  supportingEvidenceIds: z.array(z.string().min(1)).min(1, 'Inference must reference at least one supporting evidenceId'),
  supportingObservationIds: z.array(z.string().min(1)).optional(),
  severity: SeverityLevelSchema.optional(),
  urgency: UrgencyLevelSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Canonical problem assertion.
 */
export const CanonicalProblemSchema = z.object({
  problemCode: z.string().min(1).optional(),
  description: z.string().min(1, 'Problem description is required').max(1000),
  severity: SeverityLevelSchema.optional(),
  component: z.string().min(1).optional(),
  evidenceIds: z.array(z.string().min(1)).min(1, 'Problem assertion must reference at least one evidenceId'),
  inferenceId: z.string().min(1).optional(),
});

/**
 * Canonical intervention / remediation assertion.
 */
export const CanonicalInterventionSchema = z.object({
  interventionCode: z.string().min(1).optional(),
  description: z.string().min(1, 'Intervention description is required').max(1000),
  urgency: UrgencyLevelSchema.optional(),
  component: z.string().min(1).optional(),
  estimatedBenchmarkCost: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
      currency: z.string().default('GBP').optional(),
    })
    .optional(),
  evidenceIds: z.array(z.string().min(1)).min(1, 'Intervention assertion must reference at least one evidenceId'),
  inferenceId: z.string().min(1).optional(),
});

/**
 * Canonical outcome assertion.
 */
export const CanonicalOutcomeSchema = z.object({
  outcomeCode: z.string().min(1).optional(),
  description: z.string().min(1, 'Outcome description is required').max(1000),
  component: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  evidenceIds: z.array(z.string().min(1)).min(1, 'Outcome assertion must reference at least one evidenceId'),
});

/**
 * Canonical condition assertion.
 */
export const CanonicalConditionSchema = z.object({
  condition: z.string().min(1, 'Condition is required'),
  severity: SeverityLevelSchema.optional(),
  component: z.string().min(1).optional(),
  evidenceIds: z.array(z.string().min(1)).min(1, 'Condition assertion must reference at least one evidenceId'),
});

/**
 * Full Canonical Intelligence Document Schema.
 * Platform-wide, extensible, versioned, provenance-anchored.
 */
export const CanonicalIntelligenceSchema = z
  .object({
    canonicalId: z.string().min(1, 'canonicalId is required'),
    aggregateType: z.string().min(1, 'aggregateType is required'),
    aggregateId: z.string().min(1, 'aggregateId is required'),
    propertyId: z.string().min(1).optional(),
    domain: z.string().min(1, 'domain is required'),
    category: z.string().min(1).optional(),
    component: z.string().min(1).optional(),
    observations: z.array(CanonicalObservationSchema).default([]),
    conditions: z.array(CanonicalConditionSchema).default([]),
    problems: z.array(CanonicalProblemSchema).default([]),
    interventions: z.array(CanonicalInterventionSchema).default([]),
    outcomes: z.array(CanonicalOutcomeSchema).default([]),
    inferences: z.array(CanonicalInferenceSchema).default([]),
    evidenceIds: z.array(z.string().min(1)).min(1, 'Canonical intelligence must reference at least one evidenceId'),
    confidence: ConfidenceScoreSchema,
    provenance: ProvenanceSchema,
    schemaVersion: z.string().min(1, 'schemaVersion is required'),
    pipelineVersion: z.string().min(1, 'pipelineVersion is required'),
    modelVersion: z.string().min(1, 'modelVersion is required'),
    promptVersion: z.string().min(1, 'promptVersion is required'),
    sourceVersion: z.union([z.string(), z.number()]).default(1),
    generatedAt: z.string().min(1, 'generatedAt is required'),
    contentHash: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Invariant: All evidence referenced by sub-elements must be present in top-level evidenceIds
    const rootEvidenceSet = new Set(data.evidenceIds);

    for (let i = 0; i < data.observations.length; i++) {
      const obs = data.observations[i];
      for (const evId of obs.evidenceIds) {
        if (!rootEvidenceSet.has(evId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Observation[${i}] references evidenceId '${evId}' which is not in root evidenceIds`,
            path: ['observations', i, 'evidenceIds'],
          });
        }
      }
    }

    for (let i = 0; i < data.inferences.length; i++) {
      const inf = data.inferences[i];
      for (const evId of inf.supportingEvidenceIds) {
        if (!rootEvidenceSet.has(evId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Inference[${i}] references evidenceId '${evId}' which is not in root evidenceIds`,
            path: ['inferences', i, 'supportingEvidenceIds'],
          });
        }
      }
    }

    for (let i = 0; i < data.problems.length; i++) {
      const prob = data.problems[i];
      for (const evId of prob.evidenceIds) {
        if (!rootEvidenceSet.has(evId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Problem[${i}] references evidenceId '${evId}' which is not in root evidenceIds`,
            path: ['problems', i, 'evidenceIds'],
          });
        }
      }
    }

    for (let i = 0; i < data.interventions.length; i++) {
      const interv = data.interventions[i];
      for (const evId of interv.evidenceIds) {
        if (!rootEvidenceSet.has(evId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Intervention[${i}] references evidenceId '${evId}' which is not in root evidenceIds`,
            path: ['interventions', i, 'evidenceIds'],
          });
        }
      }
    }

    for (let i = 0; i < data.outcomes.length; i++) {
      const outc = data.outcomes[i];
      for (const evId of outc.evidenceIds) {
        if (!rootEvidenceSet.has(evId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Outcome[${i}] references evidenceId '${evId}' which is not in root evidenceIds`,
            path: ['outcomes', i, 'evidenceIds'],
          });
        }
      }
    }

    for (let i = 0; i < data.conditions.length; i++) {
      const cond = data.conditions[i];
      for (const evId of cond.evidenceIds) {
        if (!rootEvidenceSet.has(evId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Condition[${i}] references evidenceId '${evId}' which is not in root evidenceIds`,
            path: ['conditions', i, 'evidenceIds'],
          });
        }
      }
    }
  });
