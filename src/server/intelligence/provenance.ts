/**
 * AnyTrader V8.1 — Provenance & Cryptographic Integrity
 * 
 * Provides:
 * - SHA-256 content hashing for evidence and artifacts
 * - Deterministic SHA-256 Idempotency Key calculation
 * - Safe provenance record generation (no credentials, no secret tokens)
 */

import crypto from 'crypto';
import { Provenance } from './types';

export const INTELLIGENCE_PIPELINE_VERSION = 'v8.1.0';
export const INTELLIGENCE_SCHEMA_VERSION = 'v8.1.0';

/**
 * Computes deterministic SHA-256 digest of arbitrary string or buffer
 */
export function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Builds a deterministic idempotency key for async task deduplication and event replay safety:
 * sha256(aggregateId + ':' + eventType + ':' + sourceVersion + ':' + pipelineVersion)
 */
export function buildIdempotencyKey(
  aggregateId: string,
  eventType: string,
  sourceVersion: string,
  pipelineVersion: string = INTELLIGENCE_PIPELINE_VERSION
): string {
  const payload = `${aggregateId}:${eventType}:${sourceVersion}:${pipelineVersion}`;
  const hash = computeSha256(payload);
  return `idemp_${aggregateId}_${eventType}_${hash.slice(0, 16)}`;
}

/**
 * Builds a validated provenance structure
 */
export function buildProvenance(
  source: string,
  evidenceIds: string[],
  modelVersion: string,
  promptVersion: string,
  sourceContent: string | Buffer,
  pipelineVersion: string = INTELLIGENCE_PIPELINE_VERSION
): Provenance {
  return {
    source,
    evidenceIds: [...evidenceIds].sort(),
    pipelineVersion,
    modelVersion,
    promptVersion,
    generatedAt: new Date().toISOString(),
    sourceContentHash: computeSha256(sourceContent),
  };
}
