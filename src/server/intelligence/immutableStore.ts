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
 *    - `intelligence_jobs/{jobId}` and `intelligence_properties/{propertyId}` maintain a mutable pointer
 *      (`currentVersionId`, `currentPipelineVersion`, `currentModelVersion`, `updatedAt`) and projection,
 *      while historical records in `intelligence_extractions` remain immutable.
 * 5. Atomic Pointer & Version Association:
 *    - Uses atomic batch/transactional writes so the active pointer never references a nonexistent version.
 * 6. Provenance & Audit Trail Preservation:
 *    - Retains full links to evidenceIds, sourceVersion, pipelineVersion, modelVersion, promptVersion, schemaVersion, generatedAt.
 */

import { computeSha256, computeStructuredDataHash } from './provenance';
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
  summaryProjection: JobIntelligence | PropertyIntelligence;
  sourceVersion?: string | number;
}

export interface PersistIntelligenceResult {
  versionId: string;
  isNew: boolean;
  extraction: IntelligenceExtraction;
  eventId: string;
}

export class ImmutableIntelligenceStore {
  private inMemoryExtractions = new Map<string, IntelligenceExtraction>(); // versionId -> extraction
  private inMemoryEvents = new Map<string, CanonicalIntelligenceEvent>(); // eventId -> event
  private inMemorySummaryPointers = new Map<string, JobIntelligence | PropertyIntelligence>(); // aggregateId -> summary

  /**
   * Resets local in-memory stores (for testing)
   */
  public clear(): void {
    this.inMemoryExtractions.clear();
    this.inMemoryEvents.clear();
    this.inMemorySummaryPointers.clear();
  }

  /**
   * Persists an intelligence extraction immutably, ensuring:
   * - No historical record is ever mutated in place.
   * - Exact duplicate configuration is idempotent (no duplicate versions).
   * - New versions create independent immutable records.
   * - Current version pointer is updated atomically.
   */
  public async persistOutput(options: PersistIntelligenceOptions): Promise<PersistIntelligenceResult> {
    const {
      db,
      aggregateType,
      aggregateId,
      versionId,
      extraction,
      event,
      summaryProjection,
    } = options;

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

    const summaryCollectionName = aggregateType === 'job' ? 'intelligence_jobs' : 'intelligence_properties';

    // 1. Check if version already exists in Firestore or memory
    if (db) {
      const existingDocRef = db.collection('intelligence_extractions').doc(versionId);
      const existingSnap = await existingDocRef.get();

      if (existingSnap && existingSnap.exists) {
        const existingData = existingSnap.data() as IntelligenceExtraction;
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
          // Ensure the summary pointer points to this versionId and return without mutating.
          const summaryRef = db.collection(summaryCollectionName).doc(aggregateId);
          await summaryRef.set(
            {
              ...summaryProjection,
              currentVersionId: versionId,
              currentPipelineVersion: extraction.pipelineVersion,
              currentModelVersion: extraction.modelVersion,
              currentSourceVersion: extraction.sourceVersion,
              currentPromptVersion: extraction.promptVersion,
              currentSchemaVersion: extraction.schemaVersion,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          return {
            versionId,
            isNew: false,
            extraction: existingData,
            eventId: event.eventId,
          };
        } else {
          // Collision or mutation attempt on existing historical version
          throw new Error(
            `[Intelligence Immutability Error] Cannot mutate historical intelligence version '${versionId}'. Historical intelligence outputs are append-only.`
          );
        }
      }

      // 2. Perform atomic creation in Firestore using batch write
      if (typeof db.batch === 'function') {
        const batch = db.batch();
        const extractionRef = db.collection('intelligence_extractions').doc(versionId);
        const eventRef = db.collection('intelligence_events').doc(event.eventId);
        const summaryRef = db.collection(summaryCollectionName).doc(aggregateId);

        batch.set(extractionRef, extraction);
        batch.set(eventRef, event);
        batch.set(
          summaryRef,
          {
            ...summaryProjection,
            currentVersionId: versionId,
            currentPipelineVersion: extraction.pipelineVersion,
            currentModelVersion: extraction.modelVersion,
            currentSourceVersion: extraction.sourceVersion,
            currentPromptVersion: extraction.promptVersion,
            currentSchemaVersion: extraction.schemaVersion,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        await batch.commit();
      } else {
        // Direct write sequence if batch is not implemented on mock
        await db.collection('intelligence_extractions').doc(versionId).set(extraction);
        await db.collection('intelligence_events').doc(event.eventId).set(event);
        await db.collection(summaryCollectionName).doc(aggregateId).set(
          {
            ...summaryProjection,
            currentVersionId: versionId,
            currentPipelineVersion: extraction.pipelineVersion,
            currentModelVersion: extraction.modelVersion,
            currentSourceVersion: extraction.sourceVersion,
            currentPromptVersion: extraction.promptVersion,
            currentSchemaVersion: extraction.schemaVersion,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }

    // 3. In-memory storage handling (and local cache mirror)
    if (this.inMemoryExtractions.has(versionId)) {
      const existingInMemory = this.inMemoryExtractions.get(versionId)!;
      const existingHash = computeStructuredDataHash({
        aggregateId: existingInMemory.aggregateId,
        aggregateType: existingInMemory.aggregateType,
        sourceVersion: existingInMemory.sourceVersion,
        pipelineVersion: existingInMemory.pipelineVersion,
        modelVersion: existingInMemory.modelVersion,
        promptVersion: existingInMemory.promptVersion,
        schemaVersion: existingInMemory.schemaVersion,
        candidate: existingInMemory.structuredCandidate,
      });

      if (existingHash === extractionHash) {
        return {
          versionId,
          isNew: false,
          extraction: existingInMemory,
          eventId: event.eventId,
        };
      } else {
        throw new Error(
          `[Intelligence Immutability Error] Cannot mutate historical intelligence version '${versionId}'. Historical intelligence outputs are append-only.`
        );
      }
    }

    // Store frozen immutable records locally
    this.inMemoryExtractions.set(versionId, Object.freeze({ ...extraction }));
    this.inMemoryEvents.set(event.eventId, Object.freeze({ ...event }));
    this.inMemorySummaryPointers.set(aggregateId, {
      ...summaryProjection,
      currentVersionId: versionId,
      currentPipelineVersion: extraction.pipelineVersion,
      currentModelVersion: extraction.modelVersion,
      currentSourceVersion: extraction.sourceVersion,
      currentPromptVersion: extraction.promptVersion,
      currentSchemaVersion: extraction.schemaVersion,
      updatedAt: new Date().toISOString(),
    });

    return {
      versionId,
      isNew: true,
      extraction,
      eventId: event.eventId,
    };
  }

  /**
   * Retrieves all historical intelligence versions for a specific aggregate
   */
  public async getVersionsForAggregate(
    db: FirestoreDbLike | null,
    aggregateType: IntelligenceAggregateType,
    aggregateId: string
  ): Promise<IntelligenceExtraction[]> {
    if (db) {
      const snap = await db
        .collection('intelligence_extractions')
        .where('aggregateId', '==', aggregateId)
        .where('aggregateType', '==', aggregateType)
        .get();

      if (snap && snap.docs) {
        return snap.docs.map((d: any) => (typeof d.data === 'function' ? d.data() : d));
      }
    }

    // In-memory lookup
    const list: IntelligenceExtraction[] = [];
    for (const item of this.inMemoryExtractions.values()) {
      if (item.aggregateId === aggregateId && item.aggregateType === aggregateType) {
        list.push(item);
      }
    }
    return list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }

  /**
   * Retrieves a single historical intelligence version by versionId
   */
  public async getVersionById(
    db: FirestoreDbLike | null,
    versionId: string
  ): Promise<IntelligenceExtraction | null> {
    if (db) {
      const docSnap = await db.collection('intelligence_extractions').doc(versionId).get();
      if (docSnap && docSnap.exists) {
        return docSnap.data() as IntelligenceExtraction;
      }
    }
    return this.inMemoryExtractions.get(versionId) || null;
  }

  /**
   * Retrieves the current summary pointer for an aggregate
   */
  public async getCurrentPointer(
    db: FirestoreDbLike | null,
    aggregateType: IntelligenceAggregateType,
    aggregateId: string
  ): Promise<JobIntelligence | PropertyIntelligence | null> {
    const colName = aggregateType === 'job' ? 'intelligence_jobs' : 'intelligence_properties';
    if (db) {
      const docSnap = await db.collection(colName).doc(aggregateId).get();
      if (docSnap && docSnap.exists) {
        return docSnap.data();
      }
    }
    return this.inMemorySummaryPointers.get(aggregateId) || null;
  }

  /**
   * Attempting an in-place update on a historical extraction must be explicitly rejected.
   */
  public async attemptMutateVersion(
    db: FirestoreDbLike | null,
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
