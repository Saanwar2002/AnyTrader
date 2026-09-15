/**
 * AnyTrader V8.1 — Provenance & Cryptographic Integrity
 * 
 * Provides:
 * - SHA-256 content hashing for evidence and artifacts
 * - Deterministic SHA-256 Idempotency Key calculation
 * - Safe provenance record generation (no credentials, no secret tokens)
 */

import crypto from 'crypto';
import { IntelligenceAggregateType, Provenance } from './types';

export const INTELLIGENCE_PIPELINE_VERSION = 'v8.1.0';
export const INTELLIGENCE_SCHEMA_VERSION = 'v8.1.0';

/**
 * Recursively canonicalizes structured data to deterministic JSON string representation
 * (alphabetically sorted keys, normalized types, stable array formatting).
 */
export function canonicalizeData(data: unknown): string {
  if (data === null || data === undefined) {
    return 'null';
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return JSON.stringify(data);
  }
  if (typeof data === 'string') {
    return JSON.stringify(data);
  }
  if (Array.isArray(data)) {
    return '[' + data.map(item => canonicalizeData(item)).join(',') + ']';
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
    const pairs = sortedKeys.map(key => {
      return JSON.stringify(key) + ':' + canonicalizeData(obj[key]);
    });
    return '{' + pairs.join(',') + '}';
  }
  return JSON.stringify(data);
}

/**
 * Computes deterministic SHA-256 digest of arbitrary string or buffer
 */
export function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Computes SHA-256 hash of structured data using deterministic canonical serialization
 */
export function computeStructuredDataHash(data: unknown): string {
  const canonicalString = canonicalizeData(data);
  return computeSha256(canonicalString);
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
 * Builds a deterministic immutable version ID for intelligence extractions:
 * sha256(aggregateType + ':' + aggregateId + ':' + sourceVersion + ':' + pipelineVersion + ':' + modelVersion + ':' + promptVersion + ':' + schemaVersion)
 */
export function buildVersionId(
  aggregateType: IntelligenceAggregateType,
  aggregateId: string,
  sourceVersion: string | number = '1',
  pipelineVersion: string = INTELLIGENCE_PIPELINE_VERSION,
  modelVersion: string = 'gemini-2.5-flash',
  promptVersion: string = 'v8.1',
  schemaVersion: string = INTELLIGENCE_SCHEMA_VERSION
): string {
  const normSourceVer = String(sourceVersion || '1');
  const payload = `${aggregateType}:${aggregateId}:${normSourceVer}:${pipelineVersion}:${modelVersion}:${promptVersion}:${schemaVersion}`;
  const hash = computeSha256(payload);
  return `ver_${aggregateType}_${aggregateId}_${hash.slice(0, 16)}`;
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

/**
 * Step 8: Lineage from Assertion to Evidence
 * Full provenance trace structure linking an intelligence extraction back to its supporting evidence chain.
 */
export interface EvidenceChainTrace {
  extractionVersionId: string;
  aggregateType: string;
  aggregateId: string;
  evidenceIds: string[];
  evidenceCount: number;
  allVerified: boolean;
  generatedAt: string;
}

export function buildEvidenceChainTrace(
  extractionVersionId: string,
  aggregateType: string,
  aggregateId: string,
  evidenceList: Array<{ evidenceId: string; verified: boolean }>
): EvidenceChainTrace {
  const evidenceIds = evidenceList.map((e) => e.evidenceId).sort();
  const allVerified = evidenceList.length > 0 && evidenceList.every((e) => e.verified);
  return {
    extractionVersionId,
    aggregateType,
    aggregateId,
    evidenceIds,
    evidenceCount: evidenceIds.length,
    allVerified,
    generatedAt: new Date().toISOString(),
  };
}

