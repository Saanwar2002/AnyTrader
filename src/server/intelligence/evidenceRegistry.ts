/**
 * AnyTrader V8.1 — Evidence Registry
 * 
 * Enforces the core architectural rule:
 * "No evidence, no assertion."
 * 
 * Manages ingestion, hashing, and retrieval of evidence supporting all
 * intelligence assertions.
 */

import { computeSha256 } from './provenance';
import { EvidenceType, IntelligenceAggregateType, IntelligenceEvidence } from './types';
import { EvidenceRegistrationSchema } from './schemas';

export class EvidenceRegistry {
  private evidenceStore = new Map<string, IntelligenceEvidence>();

  /**
   * Registers a piece of evidence into the registry with SHA-256 content integrity
   */
  public register(
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    evidenceType: EvidenceType,
    sourceRef: string,
    rawContent: string | Buffer,
    metadata: Record<string, unknown> = {},
    verified: boolean = false
  ): IntelligenceEvidence {
    const contentBuffer = Buffer.isBuffer(rawContent) ? rawContent : Buffer.from(rawContent, 'utf8');
    const contentHash = computeSha256(contentBuffer);
    const byteSize = contentBuffer.length;

    // Validate registration schema
    const validatedInput = EvidenceRegistrationSchema.parse({
      aggregateType,
      aggregateId,
      evidenceType,
      sourceRef,
      contentHash,
      byteSize,
      metadata,
      verified,
    });

    const evidenceId = `ev_${validatedInput.aggregateType}_${validatedInput.aggregateId}_${contentHash.slice(0, 12)}`;

    const record: IntelligenceEvidence = {
      evidenceId,
      aggregateType: validatedInput.aggregateType,
      aggregateId: validatedInput.aggregateId,
      evidenceType: validatedInput.evidenceType,
      sourceRef: validatedInput.sourceRef,
      contentHash: validatedInput.contentHash,
      byteSize: validatedInput.byteSize,
      metadata: validatedInput.metadata,
      createdAt: new Date().toISOString(),
      verified: validatedInput.verified,
    };

    this.evidenceStore.set(evidenceId, record);
    return record;
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
    if (!record) return false;
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
