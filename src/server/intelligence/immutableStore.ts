/**
 * AnyTrader V8.1 — Immutable Intelligence Output Store & Versioning Service
 * 
 * Core Invariants:
 * 1. Historical Intelligence is strictly Append-Only & Immutable:
 *    - Once persisted to `intelligence_extractions/{versionId}`, it cannot be updated or overwritten.
 *    - Any attempt to mutate an existing historical record is strictly rejected.
 * 2. Idempotent Retries:
 *    - The exact same processing configuration (aggregateId + sourceVersion + pipelineVersion + modelVersion + promptVersion + schemaVersion)
 *      generates a deterministic versionId. Re-running returns the existing immutable output without duplication.
 * 3. Independent Historical Versions:
 *    - New pipelineVersion, modelVersion, sourceVersion, promptVersion, or schemaVersion creates a new independent version.
 *    - Previous historical versions remain permanently untouched.
 * 4. Decoupled Current Active Pointer:
 *    - Active summary projections (`intelligence_jobs/{jobId}`, `intelligence_properties/{propertyId}`, `intelligence_<aggregateType>s/{aggregateId}`)
 *      maintain a mutable pointer (`currentVersionId`, `currentPipelineVersion`, `currentModelVersion`, `updatedAt`) and projection,
 *      while historical records in `intelligence_extractions` remain immutable.
 * 5. Atomic Pointer & Version Association:
 *    - Uses atomic transactional writes (`runTransaction`) so the active pointer never references a nonexistent version.
 * 6. Zero Production Memory Fallback:
 *    - Does NOT fall back to in-memory maps in production. Fails closed if Firestore is unavailable.
 * 7. Platform-Wide Aggregate Extensibility:
 *    - Supports any aggregateType ('job', 'property', 'contractor', 'quote', 'review', etc.).
 */

import { computeStructuredDataHash } from './provenance';
import {
  CanonicalIntelligenceEvent,
  IntelligenceAggregateType,
  IntelligenceExtraction,
  JobIntelligence,
  PropertyIntelligence,
} from './types';

export interface FirestoreDbLike {
  collection(name: string): any;
  batch?(): any;
  runTransaction?<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T>;
}

export interface PersistIntelligenceOptions {
  db?: FirestoreDbLike | null;
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  versionId: string;
  extraction: IntelligenceExtraction;
  event: CanonicalIntelligenceEvent;
  summaryProjection: JobIntelligence | PropertyIntelligence | Record<string, unknown>;
  sourceVersion?: string | number;
}

export interface PersistIntelligenceResult {
  versionId: string;
  isNew: boolean;
  extraction: IntelligenceExtraction;
  eventId: string;
}

/**
 * Global default database instance for the intelligence store.
 */
let globalIntelligenceDb: FirestoreDbLike | null = null;

export function setGlobalIntelligenceDb(db: FirestoreDbLike | null): void {
  globalIntelligenceDb = db;
}

export function getGlobalIntelligenceDb(): FirestoreDbLike | null {
  return globalIntelligenceDb;
}

/**
 * Derives the collection name for summary active pointers.
 */
export function getSummaryCollectionName(aggregateType: IntelligenceAggregateType): string {
  if (aggregateType === 'job') return 'intelligence_jobs';
  if (aggregateType === 'property') return 'intelligence_properties';
  return `intelligence_${aggregateType}s`;
}

export class ImmutableIntelligenceStore {
  /**
   * Resets local state (no-op retained for testing interface compatibility)
   */
  public clear(): void {
    // No-op: in-memory maps removed in Task 7A to eliminate silent production fallback.
  }

  /**
   * Persists an intelligence extraction immutably in Firestore using atomic transactions:
   * - Historical extractions in `intelligence_extractions/{versionId}` are strictly CREATE-ONLY and append-only.
   * - Identical deterministic versions (same versionId + same content hash) are idempotent (no-op success, updates active pointer).
   * - Differing content for an existing versionId causes a hard failure transactionally.
   * - Active summary pointers (`intelligence_jobs/{jobId}`, `intelligence_properties/{propertyId}`, `intelligence_<aggregateType>s/{aggregateId}`)
   *   are updated atomically within the transaction.
   * - Zero production memory fallback: Fails closed if Firestore is unavailable.
   */
  public async persistOutput(options: PersistIntelligenceOptions): Promise<PersistIntelligenceResult> {
    const {
      aggregateType,
      aggregateId,
      versionId,
      extraction,
      event,
      summaryProjection,
    } = options;

    const db = options.db || globalIntelligenceDb;
    if (!db) {
      throw new Error('[ImmutableStore] Firestore database is not configured or ready. Operational failure (Fail Closed).');
    }

    if (!versionId) {
      throw new Error('[ImmutableStore] Missing versionId for immutable intelligence persistence');
    }

    const extractionHash = computeStructuredDataHash({
      aggregateId,
      aggregateType,
      sourceVersion: extraction.sourceVersion,
      pipelineVersion: extraction.pipelineVersion,
      modelVersion: extraction.modelVersion,
      promptVersion: extraction.promptVersion,
      schemaVersion: extraction.schemaVersion,
      candidate: extraction.structuredCandidate,
    });

    const summaryCollectionName = getSummaryCollectionName(aggregateType);

    const extractionRef = db.collection('intelligence_extractions').doc(versionId);
    const eventRef = db.collection('intelligence_events').doc(event.eventId);
    const summaryRef = db.collection(summaryCollectionName).doc(aggregateId);

    const updatedSummary = {
      ...summaryProjection,
      currentVersionId: versionId,
      currentPipelineVersion: extraction.pipelineVersion,
      currentModelVersion: extraction.modelVersion,
      currentSourceVersion: extraction.sourceVersion,
      currentPromptVersion: extraction.promptVersion,
      currentSchemaVersion: extraction.schemaVersion,
      updatedAt: new Date().toISOString(),
    };

    if (typeof db.runTransaction !== 'function') {
      throw new Error(
        '[ImmutableStore] Firestore transaction capability (runTransaction) is required for atomic immutable persistence. Operational failure (Fail Closed).'
      );
    }

    return await db.runTransaction(async (transaction: any) => {
      const existingSnap = await transaction.get(extractionRef);

      if (existingSnap && existingSnap.exists) {
        const existingData = (typeof existingSnap.data === 'function' ? existingSnap.data() : existingSnap.data) as IntelligenceExtraction;
        const existingHash = computeStructuredDataHash({
          aggregateId: existingData.aggregateId,
          aggregateType: existingData.aggregateType,
          sourceVersion: existingData.sourceVersion,
          pipelineVersion: existingData.pipelineVersion,
          modelVersion: existingData.modelVersion,
          promptVersion: existingData.promptVersion,
          schemaVersion: existingData.schemaVersion,
          candidate: existingData.structuredCandidate,
        });

        if (existingHash === extractionHash) {
          // Idempotent retry: Exact same execution recognized.
          // Transactionally update summary pointer and return existing extraction.
          transaction.set(summaryRef, updatedSummary, { merge: true });
          return {
            versionId,
            isNew: false,
            extraction: existingData,
            eventId: event.eventId,
          };
        } else {
          // Collision or mutation attempt on existing historical version -> HARD FAILURE
          throw new Error(
            `[Intelligence Immutability Error] Cannot mutate historical intelligence version '${versionId}'. Historical intelligence outputs are append-only.`
          );
        }
      }

      // Atomic create-only transaction write
      transaction.set(extractionRef, extraction);
      transaction.set(eventRef, event);
      transaction.set(summaryRef, updatedSummary, { merge: true });

      return {
        versionId,
        isNew: true,
        extraction,
        eventId: event.eventId,
      };
    });
  }

  /**
   * Retrieves all historical intelligence versions for a specific aggregate.
   * Fails closed if Firestore database is unavailable.
   */
  public async getVersionsForAggregate(
    db: FirestoreDbLike | null,
    aggregateType: IntelligenceAggregateType,
    aggregateId: string
  ): Promise<IntelligenceExtraction[]> {
    const effectiveDb = db || globalIntelligenceDb;
    if (!effectiveDb) {
      throw new Error('[ImmutableStore] Firestore database is not configured or ready. Operational failure (Fail Closed).');
    }

    const snap = await effectiveDb
      .collection('intelligence_extractions')
      .where('aggregateId', '==', aggregateId)
      .where('aggregateType', '==', aggregateType)
      .get();

    if (snap && snap.docs) {
      const docs = snap.docs.map((d: any) => (typeof d.data === 'function' ? d.data() : d.data || d));
      return docs.sort((a: IntelligenceExtraction, b: IntelligenceExtraction) =>
        (a.createdAt || '').localeCompare(b.createdAt || '')
      );
    }
    return [];
  }

  /**
   * Retrieves a single historical intelligence version by versionId.
   * Fails closed if Firestore database is unavailable.
   */
  public async getVersionById(
    db: FirestoreDbLike | null,
    versionId: string
  ): Promise<IntelligenceExtraction | null> {
    const effectiveDb = db || globalIntelligenceDb;
    if (!effectiveDb) {
      throw new Error('[ImmutableStore] Firestore database is not configured or ready. Operational failure (Fail Closed).');
    }

    const docSnap = await effectiveDb.collection('intelligence_extractions').doc(versionId).get();
    if (docSnap && docSnap.exists) {
      return (typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data) as IntelligenceExtraction;
    }
    return null;
  }

  /**
   * Retrieves the current summary pointer for an aggregate.
   * Fails closed if Firestore database is unavailable.
   */
  public async getCurrentPointer(
    db: FirestoreDbLike | null,
    aggregateType: IntelligenceAggregateType,
    aggregateId: string
  ): Promise<JobIntelligence | PropertyIntelligence | Record<string, unknown> | null> {
    const effectiveDb = db || globalIntelligenceDb;
    if (!effectiveDb) {
      throw new Error('[ImmutableStore] Firestore database is not configured or ready. Operational failure (Fail Closed).');
    }

    const colName = getSummaryCollectionName(aggregateType);
    const docSnap = await effectiveDb.collection(colName).doc(aggregateId).get();
    if (docSnap && docSnap.exists) {
      return typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data;
    }
    return null;
  }

  /**
   * Attempting an in-place update on a historical extraction is strictly prohibited.
   */
  public async attemptMutateVersion(
    _db: FirestoreDbLike | null,
    versionId: string,
    _mutatedPayload: Record<string, unknown>
  ): Promise<void> {
    throw new Error(
      `[Intelligence Immutability Error] Direct modification of historical extraction '${versionId}' is prohibited. Create a new version instead.`
    );
  }
}

export const immutableIntelligenceStore = new ImmutableIntelligenceStore();

export async function persistImmutableIntelligenceOutput(
  options: PersistIntelligenceOptions
): Promise<PersistIntelligenceResult> {
  return immutableIntelligenceStore.persistOutput(options);
}
