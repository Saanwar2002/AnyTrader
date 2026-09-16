import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { immutableIntelligenceStore, FirestoreDbLike } from '../../src/server/intelligence/immutableStore';
import { QualityReviewService, buildQualityReviewId } from '../../src/server/intelligence/qualityReview';
import { CanonicalIntelligenceEvent, QualityReview } from '../../src/server/intelligence/types';
import { computeStructuredDataHash } from '../../src/server/intelligence/provenance';

class MockMemoryFirestore implements FirestoreDbLike {
  public collections: Map<string, Map<string, any>> = new Map();

  public getDocData(col: string, id: string): any {
    return this.collections.get(col)?.get(id);
  }

  public collection(name: string): any {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    const colMap = this.collections.get(name)!;

    return {
      doc: (id: string) => ({
        id,
        get: async () => {
          const exists = colMap.has(id);
          const data = exists ? JSON.parse(JSON.stringify(colMap.get(id))) : undefined;
          return {
            exists,
            id,
            data: () => data,
          };
        },
        set: async (val: any) => {
          colMap.set(id, JSON.parse(JSON.stringify(val)));
        },
        update: async (val: any) => {
          if (!colMap.has(id)) throw new Error('Doc not found');
          const curr = colMap.get(id);
          colMap.set(id, { ...curr, ...JSON.parse(JSON.stringify(val)) });
        },
        delete: async () => {
          colMap.delete(id);
        },
      }),
      where: (field: string, op: string, value: any) => ({
        get: async () => {
          const docs: any[] = [];
          for (const [docId, docVal] of colMap.entries()) {
            if (op === '==' && docVal[field] === value) {
              docs.push({
                id: docId,
                data: () => JSON.parse(JSON.stringify(docVal)),
              });
            }
          }
          return {
            docs,
            empty: docs.length === 0,
          };
        },
      }),
    };
  }

  public async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const stagedSets: Array<{ col: string; id: string; data: any }> = [];

    const transaction = {
      get: async (docRef: any) => {
        const parts = docRef.id ? docRef.id : '';
        // Find collection name by checking where this doc belongs
        let targetCol = '';
        for (const [colName, colMap] of this.collections.entries()) {
          // Check if docRef was created from this collection
          if (docRef.get) {
            // Read from current collection
          }
        }
        return await docRef.get();
      },
      set: (docRef: any, data: any) => {
        stagedSets.push({ col: '', id: docRef.id, data });
        // Apply immediately in mock
        docRef.set(data);
      },
    };

    return await updateFunction(transaction);
  }
}

describe('V8.1 Cumulative Intelligence Security & Immutability Hardening', () => {
  let mockDb: MockMemoryFirestore;

  beforeEach(() => {
    mockDb = new MockMemoryFirestore();
  });

  // -------------------------------------------------------------
  // Part 1 & 2: Firestore Security Rules Invariants
  // -------------------------------------------------------------
  describe('Part 1 & 2: Firestore Security Rules Classification & Write Protection', () => {
    const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

    it('1. Blocks client SDK create, update, delete on /intelligence_tasks/{taskId}', () => {
      const match = rules.match(/match \/intelligence_tasks\/\{taskId\} \{([\s\S]*?)\}/);
      expect(match).toBeTruthy();
      const block = match![1];
      expect(block).toContain('allow read: if isAdmin();');
      expect(block).toContain('allow create, update, delete: if false;');
      expect(block).not.toContain('allow create, update:');
    });

    it('2. Blocks client SDK create, update, delete on /intelligence_backfill_runs/{runId}', () => {
      const match = rules.match(/match \/intelligence_backfill_runs\/\{runId\} \{([\s\S]*?)\}/);
      expect(match).toBeTruthy();
      const block = match![1];
      expect(block).toContain('allow read: if isAdmin();');
      expect(block).toContain('allow create, update, delete: if false;');
    });

    it('3. Blocks client SDK create, update, delete on /intelligence_processing_runs/{runId}', () => {
      const match = rules.match(/match \/intelligence_processing_runs\/\{runId\} \{([\s\S]*?)\}/);
      expect(match).toBeTruthy();
      const block = match![1];
      expect(block).toContain('allow read: if isAdmin();');
      expect(block).toContain('allow create, update, delete: if false;');
    });

    it('4. Enforces append-only immutable rules on /intelligence_quality/{qualityId}', () => {
      const match = rules.match(/match \/intelligence_quality\/\{qualityId\} \{([\s\S]*?)\}/);
      expect(match).toBeTruthy();
      const block = match![1];
      expect(block).toContain('allow read: if isAdmin();');
      expect(block).toContain('allow create: if isAdmin() && isValidId(qualityId);');
      expect(block).toContain('allow update, delete: if false;');
    });

    it('5. Enforces append-only immutable rules on /intelligence_events, /intelligence_evidence, /intelligence_extractions', () => {
      for (const col of ['intelligence_events', 'intelligence_evidence', 'intelligence_extractions']) {
        const idVar = col.replace('intelligence_', '').replace(/s$/, '') + 'Id';
        const match = rules.match(new RegExp(`match \\/${col}\\/\\{${idVar}\\} \\{([\\s\\S]*?)\\}`));
        expect(match).toBeTruthy();
        const block = match![1];
        expect(block).toContain('allow update, delete: if false;');
      }
    });
  });

  // -------------------------------------------------------------
  // Part 3, 4, 5, 7: Transactional Immutability & Fail-Closed Store
  // -------------------------------------------------------------
  describe('Part 3, 4, 5, 7: ImmutableStore.persistQualityReview Invariants', () => {
    const sampleReview: QualityReview = {
      qualityId: 'qr_job_100_auth',
      targetCollection: 'intelligence_jobs',
      targetId: 'job_100',
      targetVersionId: 'ver_1',
      action: 'correct',
      reviewerId: 'admin_usr_1',
      reviewedAt: '2026-09-16T10:00:00.000Z',
      reason: 'Adjusted urgency from normal to emergency',
      originalCandidate: { urgency: 'normal', category: 'Plumbing' },
      correctedResult: { urgency: 'emergency', category: 'Plumbing' },
      correctionProvenance: {
        reviewerId: 'admin_usr_1',
        timestamp: '2026-09-16T10:00:00.000Z',
        hash: 'prov_hash_1',
      },
    };

    const sampleEvent: CanonicalIntelligenceEvent = {
      eventId: 'ie_qr_job_100_auth',
      aggregateType: 'job',
      aggregateId: 'job_100',
      eventType: 'QUALITY_REVIEW_APPLIED',
      schemaVersion: '1.0.0',
      pipelineVersion: 'v8.1',
      modelVersion: 'human_reviewer',
      promptVersion: 'admin_review_v8.1',
      createdAt: '2026-09-16T10:00:00.000Z',
      source: 'admin_review/admin_usr_1',
      evidenceIds: [],
      confidence: {
        overall: 1.0,
        extraction: 1.0,
        evidenceQuality: 1.0,
        classification: 1.0,
        temporalFreshness: 1.0,
        method: 'human_verified',
      },
      provenance: {
        source: 'reviewer:admin_usr_1',
        evidenceIds: [],
        pipelineVersion: 'v8.1',
        modelVersion: 'human_reviewer',
        promptVersion: 'admin_review_v8.1',
        generatedAt: '2026-09-16T10:00:00.000Z',
        sourceContentHash: 'prov_hash_1',
      },
      status: 'valid',
      payload: {
        action: 'correct',
        reason: 'Adjusted urgency from normal to emergency',
        targetCollection: 'intelligence_jobs',
        targetId: 'job_100',
        correctionApplied: true,
      },
    };

    it('4. Persists quality review and canonical audit event transactionally (isNew: true)', async () => {
      const res = await immutableIntelligenceStore.persistQualityReview({
        db: mockDb,
        review: sampleReview,
        auditEvent: sampleEvent,
      });

      expect(res.qualityId).toBe('qr_job_100_auth');
      expect(res.eventId).toBe('ie_qr_job_100_auth');
      expect(res.isNew).toBe(true);

      const savedQuality = mockDb.getDocData('intelligence_quality', 'qr_job_100_auth');
      const savedEvent = mockDb.getDocData('intelligence_events', 'ie_qr_job_100_auth');

      expect(savedQuality).toBeDefined();
      expect(savedQuality.action).toBe('correct');
      expect(savedEvent).toBeDefined();
      expect(savedEvent.eventType).toBe('QUALITY_REVIEW_APPLIED');
    });

    it('5. Allows identical idempotent re-submission (isNew: false)', async () => {
      await immutableIntelligenceStore.persistQualityReview({
        db: mockDb,
        review: sampleReview,
        auditEvent: sampleEvent,
      });

      const res2 = await immutableIntelligenceStore.persistQualityReview({
        db: mockDb,
        review: sampleReview,
        auditEvent: sampleEvent,
      });

      expect(res2.isNew).toBe(false);
      expect(res2.qualityId).toBe('qr_job_100_auth');
    });

    it('6. Rejects conflicting re-submission of quality review with [Quality Review Immutability Error]', async () => {
      await immutableIntelligenceStore.persistQualityReview({
        db: mockDb,
        review: sampleReview,
        auditEvent: sampleEvent,
      });

      const conflictingReview: QualityReview = {
        ...sampleReview,
        reason: 'Tampered reason attempting mutation',
      };

      await expect(
        immutableIntelligenceStore.persistQualityReview({
          db: mockDb,
          review: conflictingReview,
          auditEvent: sampleEvent,
        })
      ).rejects.toThrow(/\[Quality Review Immutability Error\]/);
    });

    it('7. Rejects conflicting re-submission of audit event with [Event Immutability Error]', async () => {
      await immutableIntelligenceStore.persistQualityReview({
        db: mockDb,
        review: sampleReview,
        auditEvent: sampleEvent,
      });

      const conflictingEvent: CanonicalIntelligenceEvent = {
        ...sampleEvent,
        eventType: 'EXTRACTION_COMPLETED' as any,
      };

      const newReviewWithSameId: QualityReview = {
        ...sampleReview,
        qualityId: 'qr_another_test',
      };

      await expect(
        immutableIntelligenceStore.persistQualityReview({
          db: mockDb,
          review: newReviewWithSameId,
          auditEvent: conflictingEvent,
        })
      ).rejects.toThrow(/\[Event Immutability Error\]/);
    });

    it('8. Fails closed if Firestore database is null or transaction fails', async () => {
      await expect(
        immutableIntelligenceStore.persistQualityReview({
          db: null,
          review: sampleReview,
          auditEvent: sampleEvent,
        })
      ).rejects.toThrow(/Firestore database is not configured or ready\. Operational failure \(Fail Closed\)/);

      const dbWithoutTransaction = { collection: () => ({}) } as any;
      await expect(
        immutableIntelligenceStore.persistQualityReview({
          db: dbWithoutTransaction,
          review: sampleReview,
          auditEvent: sampleEvent,
        })
      ).rejects.toThrow(/Firestore transaction capability \(runTransaction\) is required/);
    });
  });

  // -------------------------------------------------------------
  // Part 6: QualityReviewService Firestore Authoritative Queries & Removal of Map
  // -------------------------------------------------------------
  describe('Part 6: QualityReviewService Firestore Integration & Non-Authoritative Map', () => {
    it('9. applyAndPersistReview persists directly to Firestore and returns generated review & auditEvent', async () => {
      const qrs = new QualityReviewService();
      qrs.setFirestoreDb(mockDb);

      const res = await qrs.applyAndPersistReview({
        targetCollection: 'intelligence_jobs',
        targetId: 'job_404',
        action: 'approve',
        reviewerId: 'admin_bob',
        reason: 'Verified accurate',
        originalCandidate: { budget: 500 },
      });

      expect(res.review.qualityId).toContain('qr_job_404_');
      expect(res.auditEvent.eventId).toContain('ie_qr_');

      const savedQuality = mockDb.getDocData('intelligence_quality', res.review.qualityId);
      expect(savedQuality).toBeDefined();
      expect(savedQuality.action).toBe('approve');
      expect(savedQuality.reviewerId).toBe('admin_bob');
    });

    it('10. getReviewByIdAsync reads directly from Firestore and fails closed if db is unavailable', async () => {
      const qrs = new QualityReviewService();
      qrs.setFirestoreDb(mockDb);

      const { review } = await qrs.applyAndPersistReview({
        targetCollection: 'intelligence_jobs',
        targetId: 'job_405',
        action: 'correct',
        reviewerId: 'admin_carol',
        reason: 'Updated scope',
        originalCandidate: { scope: 'minor' },
        correctedResult: { scope: 'major' },
      });

      // Query from Firestore
      const fetched = await qrs.getReviewByIdAsync(review.qualityId);
      expect(fetched).toBeDefined();
      expect(fetched?.action).toBe('correct');
      expect(fetched?.reviewerId).toBe('admin_carol');

      // Fails closed if db is null
      const unconfiguredService = new QualityReviewService();
      await expect(unconfiguredService.getReviewByIdAsync(review.qualityId)).rejects.toThrow(
        /Firestore database is not configured or ready\. Operational failure \(Fail Closed\)/
      );
    });

    it('11. getReviewsForTargetAsync queries Firestore by targetId and fails closed if db is unavailable', async () => {
      const qrs = new QualityReviewService();
      qrs.setFirestoreDb(mockDb);

      await qrs.applyAndPersistReview({
        targetCollection: 'intelligence_jobs',
        targetId: 'job_multi_1',
        action: 'approve',
        reviewerId: 'admin_1',
        reason: 'First pass',
        originalCandidate: { a: 1 },
      });

      await qrs.applyAndPersistReview({
        targetCollection: 'intelligence_jobs',
        targetId: 'job_multi_1',
        action: 'correct',
        reviewerId: 'admin_2',
        reason: 'Second pass correction',
        originalCandidate: { a: 1 },
        correctedResult: { a: 2 },
      });

      const reviews = await qrs.getReviewsForTargetAsync('job_multi_1');
      expect(reviews.length).toBe(2);
      expect(reviews[0].targetId).toBe('job_multi_1');
      expect(reviews[1].targetId).toBe('job_multi_1');

      // Fails closed if db is null
      const unconfiguredService = new QualityReviewService();
      await expect(unconfiguredService.getReviewsForTargetAsync('job_multi_1')).rejects.toThrow(
        /Firestore database is not configured or ready\. Operational failure \(Fail Closed\)/
      );
    });

    it('12. A fresh QualityReviewService instance without in-memory state reads persisted records from Firestore', async () => {
      const qrs1 = new QualityReviewService();
      qrs1.setFirestoreDb(mockDb);

      const { review } = await qrs1.applyAndPersistReview({
        targetCollection: 'intelligence_properties',
        targetId: 'prop_999',
        action: 'approve',
        reviewerId: 'admin_auditor',
        reason: 'Property specs verified',
        originalCandidate: { epc: 'B' },
      });

      // Create completely separate service instance (zero memory state)
      const qrs2 = new QualityReviewService();
      qrs2.setFirestoreDb(mockDb);

      // In-memory lookup on qrs2 returns undefined
      expect(qrs2.getReview(review.qualityId)).toBeUndefined();

      // Authoritative Firestore lookup on qrs2 successfully retrieves record
      const authoritativeReview = await qrs2.getReviewByIdAsync(review.qualityId);
      expect(authoritativeReview).toBeDefined();
      expect(authoritativeReview?.qualityId).toBe(review.qualityId);
      expect(authoritativeReview?.targetId).toBe('prop_999');
      expect(authoritativeReview?.reviewerId).toBe('admin_auditor');
    });

    it('13. buildQualityReviewId provides deterministic idempotency identity', () => {
      const id1 = buildQualityReviewId('job_777', 'admin_1', 'v1');
      const id2 = buildQualityReviewId('job_777', 'admin_1', 'v1');
      const id3 = buildQualityReviewId('job_777', 'admin_2', 'v1');

      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id1.startsWith('qr_job_777_')).toBe(true);
    });
  });
});
