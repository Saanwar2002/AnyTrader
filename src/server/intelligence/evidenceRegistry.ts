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
  getEvidenceFromFirestore,
  getEvidenceForAggregateFromFirestore,
  getEvidenceForSourceFromFirestore,
  CreateEvidenceParams,
  createEvidenceRecord,
} from './evidence';
import { FirestoreDbLike, getGlobalIntelligenceDb } from './immutableStore';

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
  db?: FirestoreDbLike | null;
}

export class EvidenceRegistry {
  private db: FirestoreDbLike | null = null;

  constructor(db?: FirestoreDbLike | null) {
    this.db = db || null;
  }

  public setDb(db: FirestoreDbLike | null): void {
    this.db = db;
  }

  private getEffectiveDb(explicitDb?: FirestoreDbLike | null): FirestoreDbLike | null {
    return explicitDb !== undefined ? explicitDb : (this.db || getGlobalIntelligenceDb());
  }

  /**
   * Registers a piece of evidence into the authoritative Firestore store with SHA-256 content integrity
   * when actual bytes or verified structured data are available.
   * Transactionally persists to Firestore (intelligence_evidence/{evidenceId}).
   * Fails closed if Firestore is unavailable.
   */
  public async register(
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    evidenceType: EvidenceType,
    sourceRef: string,
    rawContent: string | Buffer | Uint8Array | null | undefined,
    metadata: Record<string, unknown> = {},
    verified: boolean = false,
    sourceReference?: EvidenceSourceReference,
    options?: RegisterEvidenceOptions,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceEvidence> {
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
        options,
        db
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

    const targetDb = this.getEffectiveDb(options?.db || db);
    const persistResult = await persistEvidenceToFirestore({ db: targetDb, evidence: record });
    return persistResult.evidence;
  }

  /**
   * Registers a reference-only evidence record where source bytes are not directly accessible
   * at ingestion time (e.g. external media URL, unverified pointer).
   * Invariant: Never falsely claims content verification for unverified references.
   * Transactionally persists to Firestore (intelligence_evidence/{evidenceId}).
   * Fails closed if Firestore is unavailable.
   */
  public async registerReferenceOnly(
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    evidenceType: EvidenceType,
    sourceRef: string,
    metadata: Record<string, unknown> = {},
    sourceReference?: EvidenceSourceReference,
    options?: RegisterEvidenceOptions,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceEvidence> {
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

    const targetDb = this.getEffectiveDb(options?.db || db);
    const persistResult = await persistEvidenceToFirestore({ db: targetDb, evidence: record });
    return persistResult.evidence;
  }

  /**
   * Registers canonical structured Firestore data as verified evidence.
   * Transactionally persists to Firestore (intelligence_evidence/{evidenceId}).
   * Fails closed if Firestore is unavailable.
   */
  public async registerStructuredData(
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    evidenceType: EvidenceType,
    sourceRef: string,
    structuredData: unknown,
    metadata: Record<string, unknown> = {},
    sourceReference?: EvidenceSourceReference,
    options?: RegisterEvidenceOptions,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceEvidence> {
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

    const targetDb = this.getEffectiveDb(options?.db || db);
    const persistResult = await persistEvidenceToFirestore({ db: targetDb, evidence: record });
    return persistResult.evidence;
  }

  /**
   * Populates and verifies the cryptographic hash of a previously reference-only evidence item
   * directly within Firestore using runTransaction.
   * Invariant: Rejects mutation if already verified with conflicting content.
   */
  public async verifyAndUpdateContent(
    evidenceId: string,
    actualContent: string | Buffer,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceEvidence> {
    const effectiveDb = this.getEffectiveDb(db);
    if (!effectiveDb || typeof effectiveDb.runTransaction !== 'function') {
      throw new Error(
        '[EvidencePersistence Error] Firestore database transaction capability is required for verifyAndUpdateContent. Operational failure (Fail Closed).'
      );
    }

    const contentBuffer = Buffer.isBuffer(actualContent) ? actualContent : Buffer.from(actualContent, 'utf8');
    const contentHash = computeSha256(contentBuffer);
    const byteSize = contentBuffer.length;

    const docRef = effectiveDb.collection('intelligence_evidence').doc(evidenceId);

    return effectiveDb.runTransaction(async (transaction: any) => {
      const snap = await transaction.get(docRef);
      if (!snap || !snap.exists) {
        throw new Error(`[EvidenceRegistry Error] Evidence record '${evidenceId}' not found for verification in Firestore.`);
      }
      const existing = (typeof snap.data === 'function' ? snap.data() : snap.data) as IntelligenceEvidence;

      if (existing.verified && existing.contentHash === contentHash) {
        return existing;
      }
      if (existing.verified && existing.contentHash && existing.contentHash !== contentHash) {
        throw new Error(
          `[Evidence Immutability Error] Cannot mutate historical evidence '${evidenceId}'. Already verified with different content.`
        );
      }

      const updated: IntelligenceEvidence = {
        ...existing,
        contentHash,
        contentSize: byteSize,
        byteSize,
        integrityStatus: 'verified',
        verified: true,
      };

      transaction.set(docRef, updated);
      return updated;
    });
  }

  /**
   * Retrieves all registered evidence for a specific aggregate from authoritative Firestore store.
   */
  public async getForAggregate(
    aggregateType: IntelligenceAggregateType,
    aggregateId: string,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceEvidence[]> {
    return getEvidenceForAggregateFromFirestore(this.getEffectiveDb(db), aggregateType, aggregateId);
  }

  /**
   * Retrieves a single piece of evidence by ID from authoritative Firestore store.
   */
  public async get(
    evidenceId: string,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceEvidence | null> {
    return getEvidenceFromFirestore(this.getEffectiveDb(db), evidenceId);
  }

  /**
   * Retrieves all registered evidence for a specific source from authoritative Firestore store.
   */
  public async getForSource(
    sourceType: string,
    sourceId: string,
    db?: FirestoreDbLike | null
  ): Promise<IntelligenceEvidence[]> {
    return getEvidenceForSourceFromFirestore(this.getEffectiveDb(db), sourceType, sourceId);
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
   * Verifies the cryptographic integrity of content against registered evidence in Firestore
   */
  public async verifyContentIntegrity(
    evidenceId: string,
    content: string | Buffer,
    db?: FirestoreDbLike | null
  ): Promise<boolean> {
    const record = await this.get(evidenceId, db);
    if (!record || !record.verified || !record.contentHash) return false;
    const computed = computeSha256(content);
    return computed === record.contentHash;
  }

  /**
   * Persists an existing evidence record to Firestore using transactional boundary.
   */
  public async persistToFirestore(
    evidence: IntelligenceEvidence,
    db?: FirestoreDbLike | null
  ): Promise<{ evidenceId: string; isNew: boolean; evidence: IntelligenceEvidence }> {
    return persistEvidenceToFirestore({ db: this.getEffectiveDb(db), evidence });
  }

  /**
   * Registers and immediately persists evidence to Firestore transactionally.
   */
  public async registerAndPersist(
    params: CreateEvidenceParams,
    db?: FirestoreDbLike | null
  ): Promise<{ evidenceId: string; isNew: boolean; evidence: IntelligenceEvidence }> {
    const record = createEvidenceRecord(params);
    return persistEvidenceToFirestore({ db: this.getEffectiveDb(db), evidence: record });
  }

  /**
   * Clears in-memory state (no-op in production Firestore-backed registry).
   * Maintained for test hygiene compatibility.
   */
  public clear(): void {}
}

export const evidenceRegistry = new EvidenceRegistry();

