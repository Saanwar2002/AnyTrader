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

export class QualityReviewService {
  private reviews = new Map<string, QualityReview>();
  private db: FirestoreDbLike | null = null;

  public setFirestoreDb(db: FirestoreDbLike | null): void {
    this.db = db;
  }

  /**
   * Applies an admin quality review to a candidate intelligence record
   */
  public applyReview(input: {
    targetCollection: 'intelligence_jobs' | 'intelligence_properties' | 'intelligence_events';
    targetId: string;
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
    const qualityId = `qr_${validated.targetId}_${Date.now()}`;
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

    this.reviews.set(qualityId, review);

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
      targetCollection: 'intelligence_jobs' | 'intelligence_properties' | 'intelligence_events';
      targetId: string;
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
   * Retrieves review record by ID
   */
  public getReview(qualityId: string): QualityReview | undefined {
    return this.reviews.get(qualityId);
  }

  /**
   * Clears reviews (for testing)
   */
  public clear(): void {
    this.reviews.clear();
  }
}

export const qualityReviewService = new QualityReviewService();
