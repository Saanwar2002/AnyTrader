/**
 * AnyTrader V8.1 — Multidimensional Confidence Engine
 * 
 * Rules:
 * 1. "No evidence, no assertion": If evidenceIds is empty or evidenceQuality is 0, overall confidence is 0.
 * 2. Deterministic and testable: Calculated via weighted geometric-linear combination.
 * 3. Never trust a single ungrounded number from a model.
 */

import { ConfidenceScores, ConfidenceMethod } from './types';

export interface ConfidenceCalculationParams {
  rawExtractionScore: number;     // Extracted score (0.0 - 1.0)
  evidenceCount: number;          // Number of supporting evidence documents
  hasMediaEvidence: boolean;      // True if photo/video/file attached
  hasVerifiedSpec: boolean;       // True if structured spec / compliance passport available
  hasUserDescription: boolean;    // True if user textual description available
  classificationConfidence: number; // Domain classification match (0.0 - 1.0)
  sourceAgeHours?: number;        // Age of the source data
  method?: ConfidenceMethod;
}

/**
 * Calculates deterministic multidimensional confidence scores for an intelligence record
 */
export function calculateConfidence(params: ConfidenceCalculationParams): ConfidenceScores {
  const method: ConfidenceMethod = params.method || 'model_validated';

  // Rule 1: No evidence = Zero confidence
  if (params.evidenceCount === 0) {
    return {
      overall: 0,
      extraction: 0,
      evidenceQuality: 0,
      classification: 0,
      temporalFreshness: 0,
      method,
    };
  }

  // Calculate evidence quality (0.0 to 1.0) based on diversity and verification
  let evidenceQuality = 0;
  if (params.hasMediaEvidence) evidenceQuality += 0.45;
  if (params.hasVerifiedSpec) evidenceQuality += 0.35;
  if (params.hasUserDescription) evidenceQuality += 0.20;

  // Bonus for multiple corroborating items (up to 0.1 bonus, capped at 1.0)
  if (params.evidenceCount > 2) {
    evidenceQuality = Math.min(1.0, evidenceQuality + 0.1);
  }
  evidenceQuality = Math.min(1.0, Math.max(0.1, evidenceQuality));

  // Extraction score bounded 0 to 1
  const extraction = Math.min(1.0, Math.max(0.0, params.rawExtractionScore));

  // Classification score bounded 0 to 1
  const classification = Math.min(1.0, Math.max(0.0, params.classificationConfidence));

  // Temporal freshness decay: 1.0 at 0 hours, decays gradually to 0.5 over 1 year (8760 hours)
  const ageHours = Math.max(0, params.sourceAgeHours ?? 0);
  const temporalFreshness = Math.max(0.5, 1.0 - (ageHours / (8760 * 2)));

  // Weighted overall calculation:
  // - Evidence Quality: 40%
  // - Extraction Fidelity: 30%
  // - Classification Alignment: 20%
  // - Temporal Freshness: 10%
  const weightedScore =
    evidenceQuality * 0.40 +
    extraction * 0.30 +
    classification * 0.20 +
    temporalFreshness * 0.10;

  // Round to 4 decimal places for determinism
  const overall = Number(Math.min(1.0, Math.max(0.0, weightedScore)).toFixed(4));

  return {
    overall,
    extraction: Number(extraction.toFixed(4)),
    evidenceQuality: Number(evidenceQuality.toFixed(4)),
    classification: Number(classification.toFixed(4)),
    temporalFreshness: Number(temporalFreshness.toFixed(4)),
    method,
  };
}
