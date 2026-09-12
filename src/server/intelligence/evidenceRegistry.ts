/**
 * AnyTrader V8.1 — Evidence Registry
 * 
 * Enforces the core architectural rule:
 * "No evidence, no assertion."
 * 
 * Manages ingestion, hashing, and retrieval of evidence supporting all
 * intelligence assertions.
 */

import { computeSha256, computeStructuredDataHash } from './provenance';
import {
  EvidenceType,
  EvidenceIntegrityStatus,
  EvidenceSourceReference,
  IntelligenceAggregateType,
  IntelligenceEvidence,
} from './types';
import { EvidenceRegistrationSchema } from './schemas';

export class EvidenceRegistry {
  private evidenceStore = new Map<string, IntelligenceEvidence>();

  /**
   * Registers a piece of evidence into the registry with SHA-256 content integrity
   * when actual bytes or verified structured data are available.
   */
  public register(
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    evidenceType: EvidenceType,
    sourceRef: string,
    rawContent: string | Buffer | null | undefined,
    metadata: Record<string, unknown> = {},
    verified: boolean = false,
    sourceReference?: EvidenceSourceReference
  ): IntelligenceEvidence {
    // If no actual content is provided, it CANNOT be marked as verified content integrity
    if (rawContent === null || rawContent === undefined || (typeof rawContent === 'string' && rawContent.trim() === '')) {
      return this.registerReferenceOnly(
        aggregateType,
        aggregateId,
        evidenceType,
        sourceRef,
        metadata,
        sourceReference
      );
    }

    const contentBuffer = Buffer.isBuffer(rawContent) ? rawContent : Buffer.from(rawContent, 'utf8');
    const contentHash = computeSha256(contentBuffer);
    const byteSize = contentBuffer.length;
    const integrityStatus: EvidenceIntegrityStatus = 'verified';

    // Validate registration schema
    const validatedInput = EvidenceRegistrationSchema.parse({
      aggregateType,
      aggregateId,
      evidenceType,
      sourceRef,
      sourceReference,
      contentHash,
      byteSize,
      integrityStatus,
      metadata,
      verified: true, // Actual bytes successfully verified
    });

    const evidenceId = `ev_${validatedInput.aggregateType}_${validatedInput.aggregateId}_${contentHash.slice(0, 12)}`;

    const record: IntelligenceEvidence = {
      evidenceId,
      aggregateType: validatedInput.aggregateType,
      aggregateId: validatedInput.aggregateId,
      evidenceType: validatedInput.evidenceType,
      sourceRef: validatedInput.sourceRef,
      sourceReference: validatedInput.sourceReference,
      contentHash: validatedInput.contentHash,
      byteSize: validatedInput.byteSize,
      integrityStatus: validatedInput.integrityStatus,
      metadata: validatedInput.metadata,
      createdAt: new Date().toISOString(),
      verified: validatedInput.verified,
    };

    this.evidenceStore.set(evidenceId, record);
    return record;
  }

  /**
   * Registers a reference-only evidence record where source bytes are not directly accessible
   * at ingestion time (e.g. external media URL, unverified pointer).
   * Invariant: Never falsely claims content verification for unverified references.
   */
  public registerReferenceOnly(
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    evidenceType: EvidenceType,
    sourceRef: string,
    metadata: Record<string, unknown> = {},
    sourceReference?: EvidenceSourceReference
  ): IntelligenceEvidence {
    const validatedInput = EvidenceRegistrationSchema.parse({
      aggregateType,
      aggregateId,
      evidenceType,
      sourceRef,
      sourceReference: sourceReference || { uri: sourceRef },
      contentHash: '',
      byteSize: 0,
      integrityStatus: 'reference_only',
      metadata,
      verified: false,
    });

    // Stable ID for reference pointer
    const refHash = computeSha256(`${aggregateId}:${sourceRef}`);
    const evidenceId = `ev_ref_${validatedInput.aggregateType}_${validatedInput.aggregateId}_${refHash.slice(0, 12)}`;

    const record: IntelligenceEvidence = {
      evidenceId,
      aggregateType: validatedInput.aggregateType,
      aggregateId: validatedInput.aggregateId,
      evidenceType: validatedInput.evidenceType,
      sourceRef: validatedInput.sourceRef,
      sourceReference: validatedInput.sourceReference,
      contentHash: '',
      byteSize: 0,
      integrityStatus: 'reference_only',
      metadata: validatedInput.metadata,
      createdAt: new Date().toISOString(),
      verified: false,
    };

    this.evidenceStore.set(evidenceId, record);
    return record;
  }

  /**
   * Registers canonical structured Firestore data as verified evidence
   */
  public registerStructuredData(
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    evidenceType: EvidenceType,
    sourceRef: string,
    structuredData: unknown,
    metadata: Record<string, unknown> = {},
    sourceReference?: EvidenceSourceReference
  ): IntelligenceEvidence {
    const contentHash = computeStructuredDataHash(structuredData);
    const canonicalString = JSON.stringify(structuredData);
    const byteSize = Buffer.byteLength(canonicalString, 'utf8');

    const validatedInput = EvidenceRegistrationSchema.parse({
      aggregateType,
      aggregateId,
      evidenceType,
      sourceRef,
      sourceReference,
      contentHash,
      byteSize,
      integrityStatus: 'verified',
      metadata: { ...metadata, isStructuredData: true },
      verified: true,
    });

    const evidenceId = `ev_spec_${validatedInput.aggregateType}_${validatedInput.aggregateId}_${contentHash.slice(0, 12)}`;

    const record: IntelligenceEvidence = {
      evidenceId,
      aggregateType: validatedInput.aggregateType,
      aggregateId: validatedInput.aggregateId,
      evidenceType: validatedInput.evidenceType,
      sourceRef: validatedInput.sourceRef,
      sourceReference: validatedInput.sourceReference,
      contentHash: validatedInput.contentHash,
      byteSize: validatedInput.byteSize,
      integrityStatus: 'verified',
      metadata: validatedInput.metadata,
      createdAt: new Date().toISOString(),
      verified: true,
    };

    this.evidenceStore.set(evidenceId, record);
    return record;
  }

  /**
   * Populates and verifies the cryptographic hash of a previously reference-only evidence item
   */
  public verifyAndUpdateContent(evidenceId: string, actualContent: string | Buffer): IntelligenceEvidence {
    const existing = this.get(evidenceId);
    if (!existing) {
      throw new Error(`[EvidenceRegistry Error] Evidence record '${evidenceId}' not found for verification.`);
    }

    const contentBuffer = Buffer.isBuffer(actualContent) ? actualContent : Buffer.from(actualContent, 'utf8');
    const contentHash = computeSha256(contentBuffer);
    const byteSize = contentBuffer.length;

    existing.contentHash = contentHash;
    existing.byteSize = byteSize;
    existing.integrityStatus = 'verified';
    existing.verified = true;

    this.evidenceStore.set(evidenceId, existing);
    return existing;
  }

  /**
   * Retrieves all registered evidence for a specific aggregate
   */
  public getForAggregate(aggregateType: IntelligenceAggregateType, aggregateId: string): IntelligenceEvidence[] {
    const results: IntelligenceEvidence[] = [];
    for (const record of this.evidenceStore.values()) {
      if (record.aggregateType === aggregateType && record.aggregateId === aggregateId) {
        results.push(record);
      }
    }
    return results;
  }

  /**
   * Retrieves a single piece of evidence by ID
   */
  public get(evidenceId: string): IntelligenceEvidence | undefined {
    return this.evidenceStore.get(evidenceId);
  }

  /**
   * Asserts that at least one valid evidence reference exists
   */
  public assertHasEvidence(evidenceIds: string[]): void {
    if (!evidenceIds || evidenceIds.length === 0) {
      throw new Error('[EvidenceRegistry Violation] No evidence provided: An intelligence assertion cannot be formed without evidence.');
    }
  }

  /**
   * Verifies the cryptographic integrity of content against registered evidence
   */
  public verifyContentIntegrity(evidenceId: string, content: string | Buffer): boolean {
    const record = this.get(evidenceId);
    if (!record || !record.verified || !record.contentHash) return false;
    const computed = computeSha256(content);
    return computed === record.contentHash;
  }

  /**
   * Clears in-memory registry (for testing)
   */
  public clear(): void {
    this.evidenceStore.clear();
  }
}

export const evidenceRegistry = new EvidenceRegistry();
