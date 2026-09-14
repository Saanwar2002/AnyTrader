/**
 * AnyTrader V8.1 — Evidence Registry
 * 
 * Enforces the core architectural rule:
 * "No evidence, no assertion."
 * 
 * Manages ingestion, hashing, and retrieval of evidence supporting all
 * intelligence assertions across any platform source.
 */

import { computeSha256, computeStructuredDataHash } from './provenance';
import {
  EvidenceCategory,
  EvidenceType,
  EvidenceIntegrityStatus,
  EvidenceSourceReference,
  IntelligenceAggregateType,
  IntelligenceEvidence,
  SourceType,
} from './types';
import { EvidenceRegistrationSchema } from './schemas';
import {
  buildDeterministicEvidenceId,
  deriveEvidenceCategory,
  validateNotCircularAiEvidence,
  persistEvidenceToFirestore,
  CreateEvidenceParams,
  createEvidenceRecord,
} from './evidence';
import { FirestoreDbLike } from './immutableStore';

export interface RegisterEvidenceOptions {
  sourceType?: SourceType;
  sourceId?: string;
  sourceVersion?: string | number;
  evidenceCategory?: EvidenceCategory;
  mimeType?: string;
  storagePath?: string;
  capturedAt?: string;
  evidenceQuality?: number;
  sourceReliability?: number;
  temporalFreshness?: number;
  customEvidenceId?: string;
}

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
    rawContent: string | Buffer | Uint8Array | null | undefined,
    metadata: Record<string, unknown> = {},
    verified: boolean = false,
    sourceReference?: EvidenceSourceReference,
    options?: RegisterEvidenceOptions
  ): IntelligenceEvidence {
    // Step 9: Validate against circular AI evidence
    validateNotCircularAiEvidence({
      sourceType: options?.sourceType || (metadata.sourceType as string) || (aggregateType as string),
      evidenceType,
      metadata,
      sourceReference,
    });

    // If no actual content is provided, it CANNOT be marked as verified content integrity
    if (rawContent === null || rawContent === undefined || (typeof rawContent === 'string' && rawContent.trim() === '')) {
      return this.registerReferenceOnly(
        aggregateType,
        aggregateId,
        evidenceType,
        sourceRef,
        metadata,
        sourceReference,
        options
      );
    }

    const contentBuffer = Buffer.isBuffer(rawContent)
      ? rawContent
      : rawContent instanceof Uint8Array
      ? Buffer.from(rawContent)
      : Buffer.from(rawContent, 'utf8');
    const contentHash = computeSha256(contentBuffer);
    const byteSize = contentBuffer.length;
    const integrityStatus: EvidenceIntegrityStatus = 'verified';

    const effectiveSourceType = options?.sourceType || (metadata.sourceType as SourceType) || (aggregateType as SourceType);
    const effectiveSourceId = options?.sourceId || (metadata.sourceId as string) || aggregateId;
    const effectiveSourceVersion = options?.sourceVersion || (metadata.sourceVersion as string | number) || sourceReference?.sourceVersion || '1';
    const effectiveCategory = options?.evidenceCategory || deriveEvidenceCategory(evidenceType);

    // Validate registration schema
    const validatedInput = EvidenceRegistrationSchema.parse({
      aggregateType,
      aggregateId,
      sourceType: effectiveSourceType,
      sourceId: effectiveSourceId,
      sourceVersion: effectiveSourceVersion,
      evidenceType,
      evidenceCategory: effectiveCategory,
      sourceRef,
      sourceReference,
      contentHash,
      contentSize: byteSize,
      byteSize,
      mimeType: options?.mimeType || (metadata.mimeType as string),
      storagePath: options?.storagePath || (metadata.storagePath as string),
      capturedAt: options?.capturedAt || (metadata.capturedAt as string),
      schemaVersion: 'v8.1.0',
      evidenceQuality: options?.evidenceQuality || (metadata.evidenceQuality as number),
      sourceReliability: options?.sourceReliability || (metadata.sourceReliability as number),
      temporalFreshness: options?.temporalFreshness || (metadata.temporalFreshness as number),
      integrityStatus,
      metadata,
      verified: true, // Actual bytes successfully verified
    });

    const evidenceId =
      options?.customEvidenceId ||
      buildDeterministicEvidenceId(
        effectiveSourceType,
        effectiveSourceId,
        effectiveSourceVersion,
        evidenceType,
        contentHash
      );

    const record: IntelligenceEvidence = {
      evidenceId,
      aggregateType: validatedInput.aggregateType,
      aggregateId: validatedInput.aggregateId,
      sourceType: validatedInput.sourceType as SourceType,
      sourceId: validatedInput.sourceId || effectiveSourceId,
      sourceVersion: validatedInput.sourceVersion || effectiveSourceVersion,
      evidenceType: validatedInput.evidenceType as EvidenceType,
      evidenceCategory: validatedInput.evidenceCategory as EvidenceCategory,
      sourceRef: validatedInput.sourceRef,
      sourceReference: validatedInput.sourceReference,
      contentHash: validatedInput.contentHash,
      contentSize: validatedInput.contentSize,
      byteSize: validatedInput.byteSize,
      mimeType: validatedInput.mimeType,
      storagePath: validatedInput.storagePath,
      createdAt: new Date().toISOString(),
      capturedAt: validatedInput.capturedAt,
      schemaVersion: validatedInput.schemaVersion,
      integrityStatus: validatedInput.integrityStatus as EvidenceIntegrityStatus,
      metadata: validatedInput.metadata,
      verified: validatedInput.verified,
      evidenceQuality: validatedInput.evidenceQuality,
      sourceReliability: validatedInput.sourceReliability,
      temporalFreshness: validatedInput.temporalFreshness,
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
    sourceReference?: EvidenceSourceReference,
    options?: RegisterEvidenceOptions
  ): IntelligenceEvidence {
    // Step 9: Validate against circular AI evidence
    validateNotCircularAiEvidence({
      sourceType: options?.sourceType || (metadata.sourceType as string) || (aggregateType as string),
      evidenceType,
      metadata,
      sourceReference,
    });

    const effectiveSourceType = options?.sourceType || (metadata.sourceType as SourceType) || (aggregateType as SourceType);
    const effectiveSourceId = options?.sourceId || (metadata.sourceId as string) || aggregateId;
    const effectiveSourceVersion = options?.sourceVersion || (metadata.sourceVersion as string | number) || sourceReference?.sourceVersion || '1';
    const effectiveCategory = options?.evidenceCategory || deriveEvidenceCategory(evidenceType);

    const validatedInput = EvidenceRegistrationSchema.parse({
      aggregateType,
      aggregateId,
      sourceType: effectiveSourceType,
      sourceId: effectiveSourceId,
      sourceVersion: effectiveSourceVersion,
      evidenceType,
      evidenceCategory: effectiveCategory,
      sourceRef,
      sourceReference: sourceReference || { uri: sourceRef },
      contentHash: '',
      contentSize: 0,
      byteSize: 0,
      mimeType: options?.mimeType || (metadata.mimeType as string),
      storagePath: options?.storagePath || (metadata.storagePath as string),
      capturedAt: options?.capturedAt || (metadata.capturedAt as string),
      schemaVersion: 'v8.1.0',
      evidenceQuality: options?.evidenceQuality || (metadata.evidenceQuality as number),
      sourceReliability: options?.sourceReliability || (metadata.sourceReliability as number),
      temporalFreshness: options?.temporalFreshness || (metadata.temporalFreshness as number),
      integrityStatus: 'reference_only',
      metadata,
      verified: false,
    });

    // Stable ID for reference pointer
    const evidenceId =
      options?.customEvidenceId ||
      buildDeterministicEvidenceId(
        effectiveSourceType,
        effectiveSourceId,
        effectiveSourceVersion,
        evidenceType,
        `ref_${sourceRef}`
      );

    const record: IntelligenceEvidence = {
      evidenceId,
      aggregateType: validatedInput.aggregateType,
      aggregateId: validatedInput.aggregateId,
      sourceType: validatedInput.sourceType as SourceType,
      sourceId: validatedInput.sourceId || effectiveSourceId,
      sourceVersion: validatedInput.sourceVersion || effectiveSourceVersion,
      evidenceType: validatedInput.evidenceType as EvidenceType,
      evidenceCategory: validatedInput.evidenceCategory as EvidenceCategory,
      sourceRef: validatedInput.sourceRef,
      sourceReference: validatedInput.sourceReference,
      contentHash: '',
      contentSize: 0,
      byteSize: 0,
      mimeType: validatedInput.mimeType,
      storagePath: validatedInput.storagePath,
      createdAt: new Date().toISOString(),
      capturedAt: validatedInput.capturedAt,
      schemaVersion: validatedInput.schemaVersion,
      integrityStatus: 'reference_only',
      metadata: validatedInput.metadata,
      verified: false,
      evidenceQuality: validatedInput.evidenceQuality,
      sourceReliability: validatedInput.sourceReliability,
      temporalFreshness: validatedInput.temporalFreshness,
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
    sourceReference?: EvidenceSourceReference,
    options?: RegisterEvidenceOptions
  ): IntelligenceEvidence {
    // Step 9: Validate against circular AI evidence
    validateNotCircularAiEvidence({
      sourceType: options?.sourceType || (metadata.sourceType as string) || (aggregateType as string),
      evidenceType,
      metadata,
      sourceReference,
    });

    const contentHash = computeStructuredDataHash(structuredData);
    const canonicalString = JSON.stringify(structuredData);
    const byteSize = Buffer.byteLength(canonicalString, 'utf8');

    const effectiveSourceType = options?.sourceType || (metadata.sourceType as SourceType) || (aggregateType as SourceType);
    const effectiveSourceId = options?.sourceId || (metadata.sourceId as string) || aggregateId;
    const effectiveSourceVersion = options?.sourceVersion || (metadata.sourceVersion as string | number) || sourceReference?.sourceVersion || '1';
    const effectiveCategory = options?.evidenceCategory || deriveEvidenceCategory(evidenceType);

    const validatedInput = EvidenceRegistrationSchema.parse({
      aggregateType,
      aggregateId,
      sourceType: effectiveSourceType,
      sourceId: effectiveSourceId,
      sourceVersion: effectiveSourceVersion,
      evidenceType,
      evidenceCategory: effectiveCategory,
      sourceRef,
      sourceReference,
      contentHash,
      contentSize: byteSize,
      byteSize,
      mimeType: options?.mimeType || 'application/json',
      storagePath: options?.storagePath || (metadata.storagePath as string),
      capturedAt: options?.capturedAt || (metadata.capturedAt as string),
      schemaVersion: 'v8.1.0',
      evidenceQuality: options?.evidenceQuality || (metadata.evidenceQuality as number),
      sourceReliability: options?.sourceReliability || (metadata.sourceReliability as number),
      temporalFreshness: options?.temporalFreshness || (metadata.temporalFreshness as number),
      integrityStatus: 'verified',
      metadata: { ...metadata, isStructuredData: true },
      verified: true,
    });

    const evidenceId =
      options?.customEvidenceId ||
      buildDeterministicEvidenceId(
        effectiveSourceType,
        effectiveSourceId,
        effectiveSourceVersion,
        evidenceType,
        contentHash
      );

    const record: IntelligenceEvidence = {
      evidenceId,
      aggregateType: validatedInput.aggregateType,
      aggregateId: validatedInput.aggregateId,
      sourceType: validatedInput.sourceType as SourceType,
      sourceId: validatedInput.sourceId || effectiveSourceId,
      sourceVersion: validatedInput.sourceVersion || effectiveSourceVersion,
      evidenceType: validatedInput.evidenceType as EvidenceType,
      evidenceCategory: validatedInput.evidenceCategory as EvidenceCategory,
      sourceRef: validatedInput.sourceRef,
      sourceReference: validatedInput.sourceReference,
      contentHash: validatedInput.contentHash,
      contentSize: validatedInput.contentSize,
      byteSize: validatedInput.byteSize,
      mimeType: validatedInput.mimeType,
      storagePath: validatedInput.storagePath,
      createdAt: new Date().toISOString(),
      capturedAt: validatedInput.capturedAt,
      schemaVersion: validatedInput.schemaVersion,
      integrityStatus: 'verified',
      metadata: validatedInput.metadata,
      verified: true,
      evidenceQuality: validatedInput.evidenceQuality,
      sourceReliability: validatedInput.sourceReliability,
      temporalFreshness: validatedInput.temporalFreshness,
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
    existing.contentSize = byteSize;
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
   * Persists an existing in-memory evidence record to Firestore using transactional boundary.
   */
  public async persistToFirestore(
    evidence: IntelligenceEvidence,
    db?: FirestoreDbLike | null
  ): Promise<{ evidenceId: string; isNew: boolean; evidence: IntelligenceEvidence }> {
    return persistEvidenceToFirestore({ db, evidence });
  }

  /**
   * Registers and immediately persists evidence to Firestore transactionally.
   */
  public async registerAndPersist(
    params: CreateEvidenceParams,
    db?: FirestoreDbLike | null
  ): Promise<{ evidenceId: string; isNew: boolean; evidence: IntelligenceEvidence }> {
    const record = createEvidenceRecord(params);
    this.evidenceStore.set(record.evidenceId, record);
    return persistEvidenceToFirestore({ db, evidence: record });
  }

  /**
   * Clears in-memory registry (for testing)
   */
  public clear(): void {
    this.evidenceStore.clear();
  }
}

export const evidenceRegistry = new EvidenceRegistry();

