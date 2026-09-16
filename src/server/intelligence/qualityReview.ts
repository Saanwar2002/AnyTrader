/**
 * AnyTrader V8.1 — Admin Quality Review & Human Correction Foundation
 * 
 * Supports:
 * - approve, reject, edit/correct
 * - Preserves reviewer ID, reason, original candidate, and corrected result
 * - Explicit correction provenance with cryptographic hashing
 * - Distinguishes raw source vs model candidate vs validated vs human-corrected
 */

import { computeSha256, INTELLIGENCE_PIPELINE_VERSION, INTELLIGENCE_SCHEMA_VERSION } from './provenance';
import { QualityReviewInputSchema } from './schemas';
import { CanonicalIntelligenceEvent, QualityReview } from './types';
import { immutableIntelligenceStore, FirestoreDbLike } from './immutableStore';

/**
 * Builds a deterministic or unique Quality Review document ID
 */
export function buildQualityReviewId(
  targetId: string,
  reviewerId: string,
  timestampOrSeed?: string | number
): string {
  const norm = timestampOrSeed !== undefined ? String(timestampOrSeed) : '';
  const payload = `${targetId}:${reviewerId}:${norm}:${INTELLIGENCE_PIPELINE_VERSION}`;
  const hash = computeSha256(payload);
  return `qr_${targetId}_${hash.slice(0, 16)}`;
}

export class QualityReviewService {
  private db: FirestoreDbLike | null = null;

  public setFirestoreDb(db: FirestoreDbLike | null): void {
    this.db = db;
  }

  /**
   * Builds an admin quality review and corresponding audit event
   */
  public applyReview(input: {
    qualityId?: string;
    targetCollection: 'intelligence_jobs' | 'intelligence_properties' | 'intelligence_events';
    targetId: string;
    targetVersionId?: string;
    action: 'approve' | 'reject' | 'correct';
    reviewerId: string;
    reason: string;
    originalCandidate: Record<string, unknown>;
    correctedResult?: Record<string, unknown>;
  }): {
    review: QualityReview;
    auditEvent: CanonicalIntelligenceEvent;
  } {
    // Validate schema
    const validated = QualityReviewInputSchema.parse(input);

    const now = new Date().toISOString();
    const qualityId =
      validated.qualityId ||
      buildQualityReviewId(validated.targetId, validated.reviewerId, Date.now());
    const provenanceHash = computeSha256(
      `${validated.reviewerId}:${now}:${JSON.stringify(validated.correctedResult || {})}`
    );

    const review: QualityReview = {
      qualityId,
      targetCollection: validated.targetCollection,
      targetId: validated.targetId,
      targetVersionId: validated.targetVersionId,
      action: validated.action,
      reviewerId: validated.reviewerId,
      reviewedAt: now,
      reason: validated.reason,
      originalCandidate: validated.originalCandidate,
      correctedResult: validated.correctedResult,
      correctionProvenance: {
        reviewerId: validated.reviewerId,
        timestamp: now,
        hash: provenanceHash,
      },
    };

    // Audit Event
    const aggregateType = validated.targetCollection === 'intelligence_properties' ? 'property' : 'job';
    const auditEvent: CanonicalIntelligenceEvent = {
      eventId: `ie_qr_${qualityId}`,
      aggregateType,
      aggregateId: validated.targetId,
      eventType: 'QUALITY_REVIEW_APPLIED',
      schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
      pipelineVersion: INTELLIGENCE_PIPELINE_VERSION,
      modelVersion: 'human_reviewer',
      promptVersion: 'admin_review_v8.1',
      createdAt: now,
      source: `admin_review/${validated.reviewerId}`,
      evidenceIds: [],
      confidence: {
        overall: validated.action === 'reject' ? 0.0 : 1.0,
        extraction: 1.0,
        evidenceQuality: 1.0,
        classification: 1.0,
        temporalFreshness: 1.0,
        method: 'human_verified',
      },
      provenance: {
        source: `reviewer:${validated.reviewerId}`,
        evidenceIds: [],
        pipelineVersion: INTELLIGENCE_PIPELINE_VERSION,
        modelVersion: 'human_reviewer',
        promptVersion: 'admin_review_v8.1',
        generatedAt: now,
        sourceContentHash: provenanceHash,
      },
      status: validated.action === 'reject' ? 'retracted' : 'valid',
      payload: {
        action: validated.action,
        reason: validated.reason,
        targetCollection: validated.targetCollection,
        targetId: validated.targetId,
        correctionApplied: validated.action === 'correct',
      },
    };

    return {
      review,
      auditEvent,
    };
  }

  /**
   * Applies an admin quality review and transactionally persists it to Firestore (Fail-Closed production storage).
   */
  public async applyAndPersistReview(
    input: {
      qualityId?: string;
      targetCollection: 'intelligence_jobs' | 'intelligence_properties' | 'intelligence_events';
      targetId: string;
      targetVersionId?: string;
      action: 'approve' | 'reject' | 'correct';
      reviewerId: string;
      reason: string;
      originalCandidate: Record<string, unknown>;
      correctedResult?: Record<string, unknown>;
    },
    customDb?: FirestoreDbLike | null
  ): Promise<{ review: QualityReview; auditEvent: CanonicalIntelligenceEvent }> {
    const effectiveDb = customDb || this.db;
    if (!effectiveDb) {
      throw new Error('[QualityReviewService] Firestore database is not configured or ready. Operational failure (Fail Closed) — zero production memory fallback.');
    }

    const { review, auditEvent } = this.applyReview(input);

    await immutableIntelligenceStore.persistQualityReview({
      db: effectiveDb,
      review,
      auditEvent,
    });

    return { review, auditEvent };
  }

  /**
   * Authoritative Firestore Read (Fail Closed).
   */
  public async getReviewByIdAsync(
    qualityId: string,
    customDb?: FirestoreDbLike | null
  ): Promise<QualityReview | null> {
    const effectiveDb = customDb || this.db;
    if (!effectiveDb) {
      throw new Error(
        '[QualityReviewService] Firestore database is not configured or ready. Operational failure (Fail Closed) — zero production memory fallback.'
      );
    }
    return immutableIntelligenceStore.getQualityReviewById(effectiveDb, qualityId);
  }

  /**
   * Authoritative Firestore Query for Target (Fail Closed).
   */
  public async getReviewsForTargetAsync(
    targetId: string,
    customDb?: FirestoreDbLike | null
  ): Promise<QualityReview[]> {
    const effectiveDb = customDb || this.db;
    if (!effectiveDb) {
      throw new Error(
        '[QualityReviewService] Firestore database is not configured or ready. Operational failure (Fail Closed) — zero production memory fallback.'
      );
    }
    return immutableIntelligenceStore.getQualityReviewsForTarget(effectiveDb, targetId);
  }

  /**
   * Resets database reference (for testing)
   */
  public clear(): void {
    this.db = null;
  }
}

export const qualityReviewService = new QualityReviewService();
