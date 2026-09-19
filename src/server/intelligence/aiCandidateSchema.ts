/**
 * AnyTrader V8.1 — AI Candidate Output Validation Schemas
 * 
 * Strict Zod schemas enforcing:
 * - Hard boundary on untrusted model outputs
 * - Strict field whitelisting (rejecting unknown/injected attributes)
 * - Safe payload sizes (string & array length constraints)
 * - Numeric score validation within [0.0, 1.0]
 * - Mandatory evidence references for all observations and inferences
 */

import { z } from 'zod';

export const MAX_AI_PAYLOAD_BYTES = 512 * 1024; // 512 KiB safety limit

export const CandidateObservationSchema = z.object({
  observationId: z.string().min(1).max(100).optional(),
  component: z.string().min(1).max(100).optional(),
  condition: z.string().min(1).max(100).optional(),
  description: z.string().min(1, 'Observation description cannot be empty').max(1000),
  evidenceIds: z.array(z.string().min(1).max(100)).min(1, 'Observation must reference at least one evidenceId').max(50),
  capturedAt: z.string().max(50).optional(),
  sourceField: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export const CandidateInferenceSchema = z.object({
  inferenceId: z.string().min(1).max(100).optional(),
  type: z.string().min(1).max(50).optional(),
  targetComponent: z.string().min(1).max(100).optional(),
  hypothesis: z.string().min(1, 'Inference hypothesis cannot be empty').max(1000),
  confidence: z.number().min(0, 'Confidence must be >= 0').max(1, 'Confidence must be <= 1'),
  reasoning: z.string().max(2000).optional(),
  supportingEvidenceIds: z.array(z.string().min(1).max(100)).min(1, 'Inference must reference at least one supporting evidenceId').max(50),
  supportingObservationIds: z.array(z.string().min(1).max(100)).max(50).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).or(z.string().max(50)).optional(),
  urgency: z.enum(['immediate', 'medium_term', 'planned']).or(z.string().max(50)).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export const CandidateProblemSchema = z.object({
  problemCode: z.string().min(1).max(100).optional(),
  description: z.string().min(1, 'Problem description cannot be empty').max(1000),
  severity: z.enum(['low', 'medium', 'high', 'critical']).or(z.string().max(50)).optional(),
  component: z.string().min(1).max(100).optional(),
  evidenceIds: z.array(z.string().min(1).max(100)).min(1, 'Problem must reference at least one evidenceId').max(50),
  inferenceId: z.string().min(1).max(100).optional(),
}).strict();

export const CandidateInterventionSchema = z.object({
  interventionCode: z.string().min(1).max(100).optional(),
  description: z.string().min(1, 'Intervention description cannot be empty').max(1000),
  urgency: z.enum(['immediate', 'medium_term', 'planned']).or(z.string().max(50)).optional(),
  component: z.string().min(1).max(100).optional(),
  estimatedBenchmarkCost: z.object({
    min: z.number().nonnegative('Cost min must be non-negative').max(10000000),
    max: z.number().nonnegative('Cost max must be non-negative').max(10000000),
    currency: z.string().max(10).optional(),
  }).refine((cost) => cost.max >= cost.min, {
    message: 'estimatedBenchmarkCost max must be greater than or equal to min',
  }).optional(),
  evidenceIds: z.array(z.string().min(1).max(100)).min(1, 'Intervention must reference at least one evidenceId').max(50),
  inferenceId: z.string().min(1).max(100).optional(),
}).strict();

export const CandidateOutcomeSchema = z.object({
  outcomeCode: z.string().min(1).max(100).optional(),
  description: z.string().min(1, 'Outcome description cannot be empty').max(1000),
  component: z.string().min(1).max(100).optional(),
  status: z.string().max(50).optional(),
  evidenceIds: z.array(z.string().min(1).max(100)).min(1, 'Outcome must reference at least one evidenceId').max(50),
}).strict();

export const CandidateConditionSchema = z.object({
  condition: z.string().min(1, 'Condition code cannot be empty').max(200),
  severity: z.enum(['low', 'medium', 'high', 'critical']).or(z.string().max(50)).optional(),
  component: z.string().min(1).max(100).optional(),
  evidenceIds: z.array(z.string().min(1).max(100)).min(1, 'Condition must reference at least one evidenceId').max(50),
}).strict();

export const CandidateBuildingComponentSchema = z.object({
  component: z.string().min(1, 'Component cannot be empty').max(100),
  condition: z.string().min(1, 'Condition cannot be empty').max(100),
  confidence: z.number().min(0, 'Confidence must be >= 0').max(1, 'Confidence must be <= 1').optional(),
  lastObservedAt: z.string().max(50).optional(),
  evidenceIds: z.array(z.string().min(1).max(100)).max(50).optional(),
}).strict();

export const CandidateObservedConditionSchema = z.object({
  condition: z.string().min(1, 'Condition code cannot be empty').max(200),
  severity: z.enum(['low', 'medium', 'high', 'critical']).or(z.string().max(50)),
  component: z.string().min(1).max(100).optional(),
  evidenceIds: z.array(z.string().min(1).max(100)).max(50).optional(),
}).strict();

export const CandidateRecommendedInterventionSchema = z.object({
  intervention: z.string().min(1, 'Intervention description cannot be empty').max(300),
  urgency: z.enum(['immediate', 'medium_term', 'planned']).or(z.string().max(50)),
  estimatedBenchmarkCost: z.object({
    min: z.number().nonnegative('Cost min must be non-negative').max(10000000),
    max: z.number().nonnegative('Cost max must be non-negative').max(10000000),
    currency: z.string().max(10).optional(),
  }).refine((cost) => cost.max >= cost.min, {
    message: 'estimatedBenchmarkCost max must be greater than or equal to min',
  }).optional(),
  component: z.string().min(1).max(100).optional(),
  evidenceIds: z.array(z.string().min(1).max(100)).max(50).optional(),
}).strict();

/**
 * Universal Untrusted AI Candidate Schema
 * Enforces strict boundaries before model output touches AnyTrader canonical pipelines.
 */
export const AIExtractionCandidateSchema = z.object({
  domain: z.string().min(1, 'Domain is required').max(100),
  category: z.string().max(100).optional(),
  component: z.string().max(100).optional(),
  observations: z.array(CandidateObservationSchema).max(50).default([]),
  inferences: z.array(CandidateInferenceSchema).max(50).default([]),
  problems: z.array(CandidateProblemSchema).max(50).optional(),
  interventions: z.array(CandidateInterventionSchema).max(50).optional(),
  outcomes: z.array(CandidateOutcomeSchema).max(50).optional(),
  conditions: z.array(CandidateConditionSchema).max(50).optional(),
  buildingComponents: z.array(CandidateBuildingComponentSchema).max(50).optional(),
  observedConditions: z.array(CandidateObservedConditionSchema).max(50).optional(),
  recommendedInterventions: z.array(CandidateRecommendedInterventionSchema).max(50).optional(),
  overallHealthScore: z.number().min(0, 'Health score must be >= 0').max(100, 'Health score must be <= 100').optional(),
  evidenceIds: z.array(z.string().min(1).max(100)).max(100).optional(),
  candidateConfidence: z.number().min(0, 'Candidate confidence must be >= 0').max(1, 'Candidate confidence must be <= 1').optional(),
}).strict().superRefine((candidate, ctx) => {
  // Ensure at least one observation, inference, problem, intervention, outcome, condition, or property component exists
  const hasSubItem =
    candidate.observations.length > 0 ||
    candidate.inferences.length > 0 ||
    (candidate.problems && candidate.problems.length > 0) ||
    (candidate.interventions && candidate.interventions.length > 0) ||
    (candidate.outcomes && candidate.outcomes.length > 0) ||
    (candidate.conditions && candidate.conditions.length > 0) ||
    (candidate.buildingComponents && candidate.buildingComponents.length > 0) ||
    (candidate.observedConditions && candidate.observedConditions.length > 0) ||
    (candidate.recommendedInterventions && candidate.recommendedInterventions.length > 0);

  if (!hasSubItem) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'AI candidate extraction must contain at least one observation, inference, problem, intervention, outcome, condition, or building component',
      path: ['observations'],
    });
  }
});

export type AIExtractionCandidate = z.infer<typeof AIExtractionCandidateSchema>;
export type CandidateObservation = z.infer<typeof CandidateObservationSchema>;
export type CandidateInference = z.infer<typeof CandidateInferenceSchema>;
export type CandidateProblem = z.infer<typeof CandidateProblemSchema>;
export type CandidateIntervention = z.infer<typeof CandidateInterventionSchema>;
export type CandidateOutcome = z.infer<typeof CandidateOutcomeSchema>;
export type CandidateCondition = z.infer<typeof CandidateConditionSchema>;
export type CandidateBuildingComponent = z.infer<typeof CandidateBuildingComponentSchema>;
export type CandidateObservedCondition = z.infer<typeof CandidateObservedConditionSchema>;
export type CandidateRecommendedIntervention = z.infer<typeof CandidateRecommendedInterventionSchema>;
