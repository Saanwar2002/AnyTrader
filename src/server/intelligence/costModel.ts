/**
 * AnyTrader V8.1 — Task 14: Provider-Independent Cost Model & Metrics Validation
 * 
 * Invariants & Protections:
 * - Provider-Independent Abstraction: Decoupled from any single AI vendor.
 * - Zero-Trust Validation: Treat all provider-reported metrics as untrusted.
 * - Strict Number Validation: Rejects NaN, Infinity, negative values, and oversized values.
 * - Deterministic Pricing: Calculates estimated cost against a versioned pricing catalog.
 */

export const DEFAULT_PRICING_VERSION = '2026-09-v1';
export const DEFAULT_COST_CURRENCY = 'USD';

export const MAX_ALLOWED_TOKENS = 10_000_000;
export const MAX_ALLOWED_COST = 10_000; // $10,000 max single run
export const MAX_ALLOWED_BYTES = 1_073_741_824; // 1 GiB
export const MAX_ALLOWED_DURATION_MS = 86_400_000; // 24 hours
export const MAX_ALLOWED_EVIDENCE_COUNT = 100_000;

export interface ModelPricingRates {
  inputPerMillion: number;  // Cost in USD per 1,000,000 input tokens
  outputPerMillion: number; // Cost in USD per 1,000,000 output tokens
}

/**
 * Versioned Pricing Catalog for multi-provider token rate evaluation.
 */
export const PRICING_CATALOG: Record<string, Record<string, ModelPricingRates>> = {
  '2026-09-v1': {
    // Gemini models
    'gemini-3.8-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
    'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
    'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
    'gemini-2.0-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40 },
    // Generic / Fallback models
    'default': { inputPerMillion: 0.10, outputPerMillion: 0.40 },
    'claude-3-5-sonnet': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
    'gpt-4o': { inputPerMillion: 2.50, outputPerMillion: 10.00 },
    'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  },
};

export interface RawMetricsInput {
  inputTokens?: number | unknown;
  outputTokens?: number | unknown;
  totalTokens?: number | unknown;
  estimatedCost?: number | unknown;
  durationMs?: number | unknown;
  inputBytes?: number | unknown;
  outputBytes?: number | unknown;
  inputEvidenceCount?: number | unknown;
  costCurrency?: string;
  pricingVersion?: string;
}

export interface ValidatedProcessingMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost: number;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  inputEvidenceCount: number;
  costCurrency: string;
  pricingVersion: string;
}

export class CostModelValidationError extends Error {
  constructor(message: string) {
    super(`[CostModelValidationError] ${message}`);
    this.name = 'CostModelValidationError';
  }
}

/**
 * Validates a numeric value ensuring it is finite, non-NaN, non-negative, and bounded.
 */
export function validateNonNegativeFiniteNumber(
  value: unknown,
  fieldName: string,
  maxAllowed: number,
  mustBeInteger: boolean = false
): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new CostModelValidationError(`Field '${fieldName}' must be a valid finite number, received ${String(value)}`);
  }

  if (value < 0) {
    throw new CostModelValidationError(`Field '${fieldName}' cannot be negative, received ${value}`);
  }

  if (value > maxAllowed) {
    throw new CostModelValidationError(
      `Field '${fieldName}' exceeds maximum allowed budget (${maxAllowed}), received ${value}`
    );
  }

  if (mustBeInteger && !Number.isInteger(value)) {
    throw new CostModelValidationError(`Field '${fieldName}' must be an integer, received ${value}`);
  }

  return value;
}

/**
 * Calculates estimated cost for a given provider, model, and token counts against the pricing catalog.
 */
export function calculateEstimatedCost(
  provider: string,
  modelVersion: string,
  inputTokens: number,
  outputTokens: number,
  pricingVersion: string = DEFAULT_PRICING_VERSION
): number {
  const versionCatalog = PRICING_CATALOG[pricingVersion] || PRICING_CATALOG[DEFAULT_PRICING_VERSION];
  const modelKey = modelVersion.toLowerCase();
  const rates = versionCatalog[modelKey] || versionCatalog['default'];

  const inputCost = (inputTokens / 1_000_000) * rates.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * rates.outputPerMillion;
  const totalCost = inputCost + outputCost;

  return Number(totalCost.toFixed(6));
}

/**
 * Validates and normalizes all cost and metric parameters for an execution record.
 */
export function validateAndNormalizeMetrics(
  raw: RawMetricsInput,
  provider: string = 'google_genai',
  modelVersion: string = 'gemini-3.8-flash'
): ValidatedProcessingMetrics {
  const hasInput = raw.inputTokens !== undefined && raw.inputTokens !== null;
  const hasOutput = raw.outputTokens !== undefined && raw.outputTokens !== null;

  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let totalTokens: number | undefined;

  if (hasInput && hasOutput) {
    inputTokens = validateNonNegativeFiniteNumber(raw.inputTokens, 'inputTokens', MAX_ALLOWED_TOKENS, true);
    outputTokens = validateNonNegativeFiniteNumber(raw.outputTokens, 'outputTokens', MAX_ALLOWED_TOKENS, true);
    const expectedTotal = inputTokens + outputTokens;
    totalTokens = expectedTotal;

    if (raw.totalTokens !== undefined && raw.totalTokens !== null) {
      const rawTotal = validateNonNegativeFiniteNumber(raw.totalTokens, 'totalTokens', MAX_ALLOWED_TOKENS, true);
      if (rawTotal !== expectedTotal) {
        throw new CostModelValidationError(
          `totalTokens (${rawTotal}) does not equal inputTokens (${inputTokens}) + outputTokens (${outputTokens})`
        );
      }
    }
  } else if (hasInput || hasOutput) {
    if (hasInput) {
      inputTokens = validateNonNegativeFiniteNumber(raw.inputTokens, 'inputTokens', MAX_ALLOWED_TOKENS, true);
    }
    if (hasOutput) {
      outputTokens = validateNonNegativeFiniteNumber(raw.outputTokens, 'outputTokens', MAX_ALLOWED_TOKENS, true);
    }
    if (raw.totalTokens !== undefined && raw.totalTokens !== null) {
      totalTokens = validateNonNegativeFiniteNumber(raw.totalTokens, 'totalTokens', MAX_ALLOWED_TOKENS, true);
      if (inputTokens !== undefined && outputTokens !== undefined) {
        if (totalTokens !== inputTokens + outputTokens) {
          throw new CostModelValidationError(
            `totalTokens (${totalTokens}) does not equal inputTokens (${inputTokens}) + outputTokens (${outputTokens})`
          );
        }
      }
    }
  } else {
    if (raw.totalTokens !== undefined && raw.totalTokens !== null) {
      totalTokens = validateNonNegativeFiniteNumber(raw.totalTokens, 'totalTokens', MAX_ALLOWED_TOKENS, true);
    }
  }

  const durationMs = validateNonNegativeFiniteNumber(raw.durationMs, 'durationMs', MAX_ALLOWED_DURATION_MS);
  const inputBytes = validateNonNegativeFiniteNumber(raw.inputBytes, 'inputBytes', MAX_ALLOWED_BYTES, true);
  const outputBytes = validateNonNegativeFiniteNumber(raw.outputBytes, 'outputBytes', MAX_ALLOWED_BYTES, true);
  const inputEvidenceCount = validateNonNegativeFiniteNumber(
    raw.inputEvidenceCount,
    'inputEvidenceCount',
    MAX_ALLOWED_EVIDENCE_COUNT,
    true
  );

  const pricingVersion = (typeof raw.pricingVersion === 'string' && raw.pricingVersion.trim().length > 0)
    ? raw.pricingVersion.trim()
    : DEFAULT_PRICING_VERSION;

  const costCurrency = (typeof raw.costCurrency === 'string' && raw.costCurrency.trim().length > 0)
    ? raw.costCurrency.trim().toUpperCase()
    : DEFAULT_COST_CURRENCY;

  // Reject malformed currency values (must be exactly 3 alphabetical letters)
  if (!/^[A-Z]{3}$/.test(costCurrency)) {
    throw new CostModelValidationError(`costCurrency must be a valid 3-letter alphabetical code, received '${costCurrency}'`);
  }

  // Calculate or validate estimated cost with deterministic precision
  let estimatedCost: number;
  if (raw.estimatedCost !== undefined && raw.estimatedCost !== null) {
    estimatedCost = validateNonNegativeFiniteNumber(raw.estimatedCost, 'estimatedCost', MAX_ALLOWED_COST);
    estimatedCost = Number(estimatedCost.toFixed(6));
  } else {
    if (inputTokens !== undefined && outputTokens !== undefined) {
      estimatedCost = calculateEstimatedCost(provider, modelVersion, inputTokens, outputTokens, pricingVersion);
    } else {
      estimatedCost = 0;
    }
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    durationMs,
    inputBytes,
    outputBytes,
    inputEvidenceCount,
    costCurrency,
    pricingVersion,
  };
}
