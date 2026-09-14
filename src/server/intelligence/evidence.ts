/**
 * AnyTrader V8.1 — Generic Evidence Model & Repository
 * 
 * Core Invariants:
 * 1. Generic Platform-Wide Evidence:
 *    - Not tied exclusively to jobs or properties; supports all platform sources
 *      (job, property, contractor, quote, review, customer_request, project, material, imported_archive, external_source).
 * 2. Strict Content Integrity:
 *    - Content-addressable using genuine SHA-256 for all actual bytes or verified structured records.
 * 3. Immutable & Append-Only:
 *    - Persisted into `intelligence_evidence/{evidenceId}`.
 *    - Identical re-submissions (same evidenceId + same contentHash) are idempotent.
 *    - Conflicting re-submissions (same evidenceId + differing contentHash) throw [Evidence Immutability Error].
 * 4. Zero Production In-Memory Fallback:
 *    - Requires Firestore transaction capability (runTransaction); fails closed otherwise.
 * 5. Binary Media Storage Separation:
 *    - Binary assets reside in Firebase Storage (`intelligence_evidence/{evidenceId}/...`),
 *      never base64-injected into Firestore documents (100 KiB safety budget).
 * 6. Provenance & Anti-Circular AI Guard:
 *    - Enforces "No evidence, no assertion".
 *    - AI model outputs cannot be registered as raw source evidence.
 */

import {
  computeSha256,
  computeStructuredDataHash,
  buildEvidenceChainTrace,
  EvidenceChainTrace,
} from './provenance';
export { buildEvidenceChainTrace, type EvidenceChainTrace };
import { FirestoreDbLike, getGlobalIntelligenceDb } from './immutableStore';
import {
  EvidenceCategory,
  EvidenceIntegrityStatus,
  EvidenceSourceReference,
  EvidenceType,
  IntelligenceAggregateType,
  IntelligenceEvidence,
  SourceType,
} from './types';
import { EvidenceRegistrationSchema } from './schemas';

export interface PersistEvidenceOptions {
  db?: FirestoreDbLike | null;
  evidence: IntelligenceEvidence;
}

export interface PersistEvidenceResult {
  evidenceId: string;
  isNew: boolean;
  evidence: IntelligenceEvidence;
}

export interface CreateEvidenceParams {
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  sourceType?: SourceType;
  sourceId?: string;
  sourceVersion?: string | number;
  evidenceType: EvidenceType;
  evidenceCategory?: EvidenceCategory;
  sourceRef: string;
  rawContent?: string | Buffer | Uint8Array | null;
  structuredData?: unknown;
  metadata?: Record<string, unknown>;
  verified?: boolean;
  sourceReference?: EvidenceSourceReference;
  capturedAt?: string;
  mimeType?: string;
  storagePath?: string;
  evidenceQuality?: number;
  sourceReliability?: number;
  temporalFreshness?: number;
  customEvidenceId?: string;
}

/**
 * Step 13: Deterministic Evidence Identity
 * Generates an immutable, deterministic evidence ID derived from source identity, version, and content hash.
 */
export function buildDeterministicEvidenceId(
  sourceType: SourceType | string,
  sourceId: string,
  sourceVersion: string | number,
  evidenceType: EvidenceType | string,
  contentHash: string
): string {
  const normSourceType = String(sourceType || 'gen').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const normSourceId = String(sourceId || '0').replace(/[^a-zA-Z0-9_-]/g, '_');
  const normVersion = String(sourceVersion || '1');
  const normType = String(evidenceType || 'rec').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const normHash = contentHash && contentHash.trim().length > 0 ? contentHash.trim() : 'ref_only';

  const payload = `${normSourceType}:${normSourceId}:${normVersion}:${normType}:${normHash}`;
  const digest = computeSha256(payload);
  return `ev_${normSourceType}_${normSourceId}_${digest.slice(0, 16)}`;
}

/**
 * Step 2: Derives the canonical Evidence Category based on the evidence type.
 */
export function deriveEvidenceCategory(evidenceType: EvidenceType | string): EvidenceCategory {
  switch (evidenceType) {
    case 'photo':
    case 'video':
    case 'image':
      return 'MEDIA';
    case 'document':
    case 'inspection_record':
      return 'DOCUMENT';
    case 'text':
      return 'TEXT';
    case 'user_statement':
    case 'user_description':
      return 'USER_ASSERTION';
    case 'quote':
    case 'completion_record':
    case 'review':
    case 'structured_record':
    case 'structured_spec':
      return 'STRUCTURED_RECORD';
    case 'imported_record':
    case 'imported_archive':
      return 'EXTERNAL_IMPORT';
    default:
      return 'STRUCTURED_RECORD';
  }
}

/**
 * Step 9: No-Evidence / No-Assertion & Anti-Circular AI Guard
 * Enforces that an AI model output cannot serve as raw source evidence.
 */
export function validateNotCircularAiEvidence(evidence: {
  sourceType?: string;
  evidenceType?: string;
  metadata?: Record<string, unknown>;
  sourceReference?: EvidenceSourceReference;
}): void {
  if (
    evidence.sourceType === 'ai_model' ||
    evidence.sourceType === 'ai_output' ||
    evidence.sourceType === 'extraction'
  ) {
    throw new Error(
      '[Evidence Integrity Violation] AI model extraction output cannot be registered as raw source evidence. Evidence must originate from an authentic platform source (job, property, quote, review, media, document, external import, etc.).'
    );
  }

  if (
    evidence.metadata &&
    evidence.metadata.isAiGeneratedStatement === true &&
    !evidence.metadata.verifiedHumanSource
  ) {
    throw new Error(
      '[Evidence Integrity Violation] Pure AI-generated statements cannot serve as source evidence for intelligence assertions.'
    );
  }
}

/**
 * Step 4 & 15: Validates that the metadata payload adheres to the 100 KiB Firestore safety budget.
 */
export function validateEvidencePayload(evidence: IntelligenceEvidence): void {
  const jsonStr = JSON.stringify(evidence);
  const byteLength = Buffer.byteLength(jsonStr, 'utf8');
  if (byteLength > 100 * 1024) {
    throw new Error(
      `[Evidence Storage Error] Evidence metadata document exceeds 100 KiB safety budget (${byteLength} bytes). Large binary objects must be stored in Firebase Storage, not Firestore.`
    );
  }
}

/**
 * Step 4: Storage Path derivation for binary evidence assets
 */
export function buildEvidenceStoragePath(evidenceId: string, filename?: string): string {
  return `intelligence_evidence/${evidenceId}/${filename || 'content'}`;
}

/**
 * Factory to construct a fully validated IntelligenceEvidence object.
 */
export function createEvidenceRecord(params: CreateEvidenceParams): IntelligenceEvidence {
  // Step 9: Verify source is not circular AI output
  validateNotCircularAiEvidence(params);

  const effectiveSourceType = (params.sourceType || params.aggregateType) as SourceType;
  const effectiveSourceId = params.sourceId || params.aggregateId;
  const effectiveSourceVersion = params.sourceVersion || params.sourceReference?.sourceVersion || '1';
  const effectiveCategory = params.evidenceCategory || deriveEvidenceCategory(params.evidenceType);

  let contentHash = '';
  let byteSize = 0;
  let integrityStatus: EvidenceIntegrityStatus = 'unverified';
  let isVerified = params.verified || false;

  if (params.structuredData !== undefined && params.structuredData !== null) {
    contentHash = computeStructuredDataHash(params.structuredData);
    const serialized = JSON.stringify(params.structuredData);
    byteSize = Buffer.byteLength(serialized, 'utf8');
    integrityStatus = 'verified';
    isVerified = true;
  } else if (params.rawContent !== undefined && params.rawContent !== null) {
    if (typeof params.rawContent === 'string' && params.rawContent.trim() === '') {
      integrityStatus = 'reference_only';
      isVerified = false;
      contentHash = '';
      byteSize = 0;
    } else {
      const buffer = Buffer.isBuffer(params.rawContent)
        ? params.rawContent
        : params.rawContent instanceof Uint8Array
        ? Buffer.from(params.rawContent)
        : Buffer.from(params.rawContent, 'utf8');
      contentHash = computeSha256(buffer);
      byteSize = buffer.length;
      integrityStatus = 'verified';
      isVerified = true;
    }
  } else {
    integrityStatus = 'reference_only';
    isVerified = false;
    contentHash = '';
    byteSize = 0;
  }

  const evidenceId =
    params.customEvidenceId ||
    buildDeterministicEvidenceId(
      effectiveSourceType,
      effectiveSourceId,
      effectiveSourceVersion,
      params.evidenceType,
      contentHash
    );

  // Validate through Zod schema
  const validated = EvidenceRegistrationSchema.parse({
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    sourceType: effectiveSourceType,
    sourceId: effectiveSourceId,
    sourceVersion: effectiveSourceVersion,
    evidenceType: params.evidenceType,
    evidenceCategory: effectiveCategory,
    sourceRef: params.sourceRef,
    sourceReference: params.sourceReference,
    contentHash,
    contentSize: byteSize,
    byteSize,
    mimeType: params.mimeType,
    storagePath: params.storagePath,
    capturedAt: params.capturedAt,
    schemaVersion: 'v8.1.0',
    evidenceQuality: params.evidenceQuality,
    sourceReliability: params.sourceReliability,
    temporalFreshness: params.temporalFreshness,
    integrityStatus,
    metadata: params.metadata || {},
    verified: isVerified,
  });

  const record: IntelligenceEvidence = {
    evidenceId,
    aggregateType: validated.aggregateType,
    aggregateId: validated.aggregateId,
    sourceType: validated.sourceType as SourceType,
    sourceId: validated.sourceId || effectiveSourceId,
    sourceVersion: validated.sourceVersion || effectiveSourceVersion,
    evidenceType: validated.evidenceType as EvidenceType,
    evidenceCategory: validated.evidenceCategory as EvidenceCategory,
    contentHash: validated.contentHash,
    contentSize: validated.contentSize,
    byteSize: validated.byteSize,
    mimeType: validated.mimeType,
    storagePath: validated.storagePath,
    createdAt: new Date().toISOString(),
    capturedAt: validated.capturedAt,
    schemaVersion: validated.schemaVersion,
    integrityStatus: validated.integrityStatus as EvidenceIntegrityStatus,
    verified: validated.verified,
    evidenceQuality: validated.evidenceQuality,
    sourceReliability: validated.sourceReliability,
    temporalFreshness: validated.temporalFreshness,
    sourceRef: validated.sourceRef,
    sourceReference: validated.sourceReference,
    metadata: validated.metadata,
  };

  validateEvidencePayload(record);
  return record;
}

/**
 * Step 5 & 6: Firestore Transactional Persistence Boundary for Evidence
 * - Persists into `intelligence_evidence/{evidenceId}`.
 * - Enforces append-only immutability.
 * - Idempotent for identical content.
 * - Hard failure with [Evidence Immutability Error] for differing content.
 * - Fails closed if Firestore or runTransaction is unavailable.
 */
export async function persistEvidenceToFirestore(
  options: PersistEvidenceOptions
): Promise<PersistEvidenceResult> {
  const db = options.db || getGlobalIntelligenceDb();
  if (!db) {
    throw new Error(
      '[EvidencePersistence Error] Firestore database is not configured or ready. Operational failure (Fail Closed).'
    );
  }

  if (typeof db.runTransaction !== 'function') {
    throw new Error(
      '[EvidencePersistence Error] Firestore transaction capability (runTransaction) is required for atomic immutable evidence persistence. Operational failure (Fail Closed).'
    );
  }

  const { evidence } = options;
  validateEvidencePayload(evidence);

  const docRef = db.collection('intelligence_evidence').doc(evidence.evidenceId);

  return db.runTransaction(async (transaction: any) => {
    const existingSnap = await transaction.get(docRef);

    if (existingSnap && existingSnap.exists) {
      const existingData = (
        typeof existingSnap.data === 'function' ? existingSnap.data() : existingSnap.data
      ) as IntelligenceEvidence;

      // Idempotency check: same version + same content hash
      const isIdentical =
        existingData.contentHash === evidence.contentHash &&
        existingData.sourceType === evidence.sourceType &&
        existingData.sourceId === evidence.sourceId &&
        String(existingData.sourceVersion) === String(evidence.sourceVersion);

      if (isIdentical) {
        return {
          evidenceId: evidence.evidenceId,
          isNew: false,
          evidence: existingData,
        };
      } else {
        throw new Error(
          `[Evidence Immutability Error] Cannot mutate historical evidence '${evidence.evidenceId}'. Historical evidence records are append-only. Submit a new evidence record instead.`
        );
      }
    }

    // Atomic transaction create
    transaction.set(docRef, evidence);

    return {
      evidenceId: evidence.evidenceId,
      isNew: true,
      evidence,
    };
  });
}

/**
 * Retrieves a single historical evidence record by ID.
 * Fails closed if Firestore is unavailable.
 */
export async function getEvidenceFromFirestore(
  db: FirestoreDbLike | null,
  evidenceId: string
): Promise<IntelligenceEvidence | null> {
  const effectiveDb = db || getGlobalIntelligenceDb();
  if (!effectiveDb) {
    throw new Error(
      '[EvidencePersistence Error] Firestore database is not configured or ready. Operational failure (Fail Closed).'
    );
  }

  const docSnap = await effectiveDb.collection('intelligence_evidence').doc(evidenceId).get();
  if (docSnap && docSnap.exists) {
    return (typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data) as IntelligenceEvidence;
  }
  return null;
}

/**
 * Retrieves all registered evidence for an aggregate from Firestore.
 */
export async function getEvidenceForAggregateFromFirestore(
  db: FirestoreDbLike | null,
  aggregateType: string,
  aggregateId: string
): Promise<IntelligenceEvidence[]> {
  const effectiveDb = db || getGlobalIntelligenceDb();
  if (!effectiveDb) {
    throw new Error(
      '[EvidencePersistence Error] Firestore database is not configured or ready. Operational failure (Fail Closed).'
    );
  }

  const snap = await effectiveDb
    .collection('intelligence_evidence')
    .where('aggregateType', '==', aggregateType)
    .where('aggregateId', '==', aggregateId)
    .get();

  if (snap && snap.docs) {
    return snap.docs.map((d: any) => (typeof d.data === 'function' ? d.data() : d.data || d));
  }
  return [];
}

/**
 * Retrieves all registered evidence for a specific source from Firestore.
 */
export async function getEvidenceForSourceFromFirestore(
  db: FirestoreDbLike | null,
  sourceType: string,
  sourceId: string
): Promise<IntelligenceEvidence[]> {
  const effectiveDb = db || getGlobalIntelligenceDb();
  if (!effectiveDb) {
    throw new Error(
      '[EvidencePersistence Error] Firestore database is not configured or ready. Operational failure (Fail Closed).'
    );
  }

  const snap = await effectiveDb
    .collection('intelligence_evidence')
    .where('sourceType', '==', sourceType)
    .where('sourceId', '==', sourceId)
    .get();

  if (snap && snap.docs) {
    return snap.docs.map((d: any) => (typeof d.data === 'function' ? d.data() : d.data || d));
  }
  return [];
}

/**
 * Evidence Repository Class
 */
export class EvidenceRepository {
  private db: FirestoreDbLike | null = null;

  constructor(db?: FirestoreDbLike | null) {
    this.db = db || null;
  }

  public setDb(db: FirestoreDbLike | null): void {
    this.db = db;
  }

  public async persist(evidence: IntelligenceEvidence): Promise<PersistEvidenceResult> {
    return persistEvidenceToFirestore({ db: this.db, evidence });
  }

  public async getById(evidenceId: string): Promise<IntelligenceEvidence | null> {
    return getEvidenceFromFirestore(this.db, evidenceId);
  }

  public async getForAggregate(
    aggregateType: string,
    aggregateId: string
  ): Promise<IntelligenceEvidence[]> {
    return getEvidenceForAggregateFromFirestore(this.db, aggregateType, aggregateId);
  }

  public async getForSource(sourceType: string, sourceId: string): Promise<IntelligenceEvidence[]> {
    return getEvidenceForSourceFromFirestore(this.db, sourceType, sourceId);
  }
}

export const evidenceRepository = new EvidenceRepository();
