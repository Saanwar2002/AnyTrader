/**
 * AnyTrader V8.3 — Task 32: Data Retention, Revocation & Deletion Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataRetentionService,
  computeRetentionPolicyId,
  computeDeletionRequestId,
  computeLifecycleEventId,
  computeLifecycleEventHash,
  DataRetentionSecurityError,
  DataRetentionValidationError,
} from './dataRetention';
import { DataRightsService } from './dataRights';
import { ProvenanceGraphService } from './provenanceGraph';
import { ContractorArchiveRightsService } from './contractorArchiveRights';
import { DataClassificationEligibilityService } from './dataClassificationEligibility';
import { AiTrainingUsageControlsService } from './aiTrainingUsageControls';

// In-Memory Simulated Firestore Mock for isolated unit tests
class MockFirestore {
  private collections: Map<string, Map<string, any>> = new Map();

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    const store = this.collections.get(name)!;

    return {
      doc: (id: string) => ({
        get: async () => ({
          exists: store.has(id),
          data: () => store.get(id),
          id,
        }),
        set: async (data: any) => {
          store.set(id, { ...data });
        },
        update: async (patch: any) => {
          const current = store.get(id) || {};
          store.set(id, { ...current, ...patch });
        },
        delete: async () => {
          store.delete(id);
        },
      }),
      where: (field: string, op: string, val: any) => {
        return {
          where: (f2: string, op2: string, v2: any) => ({
            where: (f3: string, op3: string, v3: any) => ({
              limit: (n: number) => ({
                get: async () => {
                  const docs: any[] = [];
                  for (const [id, doc] of store.entries()) {
                    if (doc[field] === val && doc[f2] === v2 && doc[f3] === v3) {
                      docs.push({ id, data: () => doc, exists: true });
                    }
                  }
                  return { docs: docs.slice(0, n) };
                },
              }),
              get: async () => {
                const docs: any[] = [];
                for (const [id, doc] of store.entries()) {
                  if (doc[field] === val && doc[f2] === v2 && doc[f3] === v3) {
                    docs.push({ id, data: () => doc, exists: true });
                  }
                }
                return { docs };
              },
            }),
            limit: (n: number) => ({
              get: async () => {
                const docs: any[] = [];
                for (const [id, doc] of store.entries()) {
                  if (doc[field] === val && doc[f2] === v2) {
                    docs.push({ id, data: () => doc, exists: true });
                  }
                }
                return { docs: docs.slice(0, n) };
              },
            }),
            get: async () => {
              const docs: any[] = [];
              for (const [id, doc] of store.entries()) {
                if (doc[field] === val && doc[f2] === v2) {
                  docs.push({ id, data: () => doc, exists: true });
                }
              }
              return { docs };
            },
          }),
          limit: (n: number) => ({
            get: async () => {
              const docs: any[] = [];
              for (const [id, doc] of store.entries()) {
                if (doc[field] === val) {
                  docs.push({ id, data: () => doc, exists: true });
                }
              }
              return { docs: docs.slice(0, n) };
            },
          }),
          get: async () => {
            const docs: any[] = [];
            for (const [id, doc] of store.entries()) {
              if (doc[field] === val) {
                docs.push({ id, data: () => doc, exists: true });
              }
            }
            return { docs };
          },
        };
      },
      get: async () => {
        const docs: any[] = [];
        for (const [id, doc] of store.entries()) {
          docs.push({ id, data: () => doc, exists: true });
        }
        return { docs };
      },
    };
  }

  async runTransaction(cb: (tx: any) => Promise<any>) {
    const tx = {
      get: async (ref: any) => ref.get(),
      set: async (ref: any, data: any) => ref.set(data),
      update: async (ref: any, data: any) => ref.update(data),
      delete: async (ref: any) => ref.delete(),
    };
    return cb(tx);
  }
}

describe('DataRetentionService Unit Tests', () => {
  let mockDb: any;
  let rightsService: DataRightsService;
  let provenanceService: ProvenanceGraphService;
  let archiveService: ContractorArchiveRightsService;
  let classificationService: DataClassificationEligibilityService;
  let aiUsageService: AiTrainingUsageControlsService;
  let retentionService: DataRetentionService;

  beforeEach(() => {
    mockDb = new MockFirestore();
    rightsService = new DataRightsService(mockDb);
    provenanceService = new ProvenanceGraphService(mockDb);
    archiveService = new ContractorArchiveRightsService(mockDb, rightsService, provenanceService);
    classificationService = new DataClassificationEligibilityService(
      mockDb,
      rightsService,
      provenanceService,
      archiveService
    );
    aiUsageService = new AiTrainingUsageControlsService(
      mockDb,
      rightsService,
      provenanceService,
      archiveService,
      classificationService
    );
    retentionService = new DataRetentionService(
      mockDb,
      rightsService,
      provenanceService,
      archiveService,
      classificationService,
      aiUsageService
    );
  });

  describe('Deterministic Hashing & Identifiers', () => {
    it('computes deterministic policy, request, and event IDs', () => {
      const p1 = computeRetentionPolicyId('tenant_A', 'property_passport');
      const p2 = computeRetentionPolicyId('tenant_A', 'property_passport');
      expect(p1).toBe(p2);
      expect(p1.startsWith('retpol_')).toBe(true);

      const r1 = computeDeletionRequestId('tenant_A', 'property_passport', 'pass_1');
      const r2 = computeDeletionRequestId('tenant_A', 'property_passport', 'pass_1');
      expect(r1).toBe(r2);
      expect(r1.startsWith('delreq_')).toBe(true);

      const e1 = computeLifecycleEventId('tenant_A', 'POLICY_REGISTERED', 'pol_1', '2026-09-25T00:00:00Z');
      const e2 = computeLifecycleEventId('tenant_A', 'POLICY_REGISTERED', 'pol_1', '2026-09-25T00:00:00Z');
      expect(e1).toBe(e2);
      expect(e1.startsWith('licevt_')).toBe(true);
    });

    it('computes deterministic SHA-256 event hash', () => {
      const event = {
        eventId: 'licevt_123',
        tenantId: 'tenant_A',
        eventType: 'DELETION_APPROVED',
        recordType: 'job',
        recordId: 'job_100',
        recordedAt: '2026-09-25T00:00:00Z',
      };
      const hash1 = computeLifecycleEventHash(event);
      const hash2 = computeLifecycleEventHash(event);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe('Policy Registration & Unknown Policy Behavior', () => {
    it('fails closed when evaluating record without retention policy', async () => {
      const evalResult = await retentionService.evaluateRetentionEligibility(
        'tenant_A',
        'unregistered_type',
        'rec_1'
      );
      expect(evalResult.allowed).toBe(false);
      expect(evalResult.decision).toBe('blocked_by_unknown_policy');
    });

    it('registers retention policy successfully', async () => {
      const policy = await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'property_inspection',
        retentionClass: 'operational',
        retentionPeriodDays: 30,
      });

      expect(policy.policyId.startsWith('retpol_')).toBe(true);
      expect(policy.version).toBe(1);
      expect(policy.status).toBe('active');
      expect(policy.retentionUntil).toBeDefined();

      const lookup = await retentionService.getRetentionPolicy(policy.policyId, 'tenant_A');
      expect(lookup?.policyId).toBe(policy.policyId);
    });

    it('rejects cross-tenant policy reads and modifications', async () => {
      const policy = await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'confidential_notes',
        retentionClass: 'restricted',
      });

      // Cross-tenant read rejected
      await expect(
        retentionService.getRetentionPolicy(policy.policyId, 'tenant_B')
      ).rejects.toThrow(DataRetentionSecurityError);

      // Cross-tenant legal hold modification rejected
      await expect(
        retentionService.setLegalHold('tenant_B', policy.policyId, true, 'Malicious hold')
      ).rejects.toThrow(DataRetentionSecurityError);
    });
  });

  describe('Legal Hold & Retention Period Enforcement', () => {
    it('blocks deletion when record is under active retention period', async () => {
      await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'financial_receipt',
        retentionClass: 'financial_statutory',
        retentionPeriodDays: 365,
      });

      const evalResult = await retentionService.evaluateRetentionEligibility(
        'tenant_A',
        'financial_receipt',
        'rec_100'
      );
      expect(evalResult.allowed).toBe(false);
      expect(evalResult.decision).toBe('retain');
    });

    it('blocks deletion when policy is under legal hold', async () => {
      const policy = await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'safety_incident',
        retentionClass: 'compliance',
        retentionUntil: '2020-01-01T00:00:00Z', // Past date
      });

      // Apply legal hold
      await retentionService.setLegalHold('tenant_A', policy.policyId, true, 'HSE Audit Hold');

      const evalResult = await retentionService.evaluateRetentionEligibility(
        'tenant_A',
        'safety_incident',
        'incident_5'
      );
      expect(evalResult.allowed).toBe(false);
      expect(evalResult.decision).toBe('blocked_by_legal_hold');
    });

    it('permits deletion when retention expired and legal hold is clear', async () => {
      await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'expired_cache',
        retentionClass: 'transient',
        retentionUntil: '2020-01-01T00:00:00Z',
      });

      const evalResult = await retentionService.evaluateRetentionEligibility(
        'tenant_A',
        'expired_cache',
        'cache_1'
      );
      expect(evalResult.allowed).toBe(true);
      expect(evalResult.decision).toBe('eligible_for_deletion');
    });
  });

  describe('Dependency-Aware Deletion & Revocation Orchestration', () => {
    it('blocks deletion when active downstream Data Rights dependency exists', async () => {
      // 1. Create policy
      await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'property_passport',
        retentionClass: 'property_data',
        retentionUntil: '2020-01-01T00:00:00Z',
      });

      // 2. Create active Data Rights record
      await rightsService.createDataRightsRecord({
        tenantId: 'tenant_A',
        subject: { type: 'property_passport', id: 'pass_1' },
        owner: { type: 'user', id: 'tenant_A' },
        source: { type: 'user_action', id: 'act_1' },
        purposes: {
          internal_ai_use: 'allowed',
          external_ai_training: 'allowed',
        },
        provenance: {
          sourceType: 'user_action',
          sourceId: 'act_1',
          tenantId: 'tenant_A',
        },
      });

      // Evaluation should detect active rights dependency
      const evalResult = await retentionService.evaluateRetentionEligibility(
        'tenant_A',
        'property_passport',
        'pass_1'
      );
      expect(evalResult.allowed).toBe(false);
      expect(evalResult.decision).toBe('blocked_by_dependency');
      expect(evalResult.dependencies?.length).toBeGreaterThan(0);
    });

    it('orchestrates rights revocation immediately failing closed', async () => {
      const rightsRec = await rightsService.createDataRightsRecord({
        tenantId: 'tenant_A',
        subject: { type: 'document', id: 'doc_1' },
        owner: { type: 'user', id: 'tenant_A' },
        source: { type: 'user_action', id: 'act_1' },
        purposes: {
          internal_ai_use: 'allowed',
          external_ai_training: 'allowed',
        },
        provenance: {
          sourceType: 'user_action',
          sourceId: 'act_1',
          tenantId: 'tenant_A',
        },
      });

      // Revoke rights via retention service orchestration
      const revResult = await retentionService.revokeDataLifecycleRights({
        tenantId: 'tenant_A',
        rightsId: rightsRec.rightsId,
        reason: 'User withdrawal of consent',
      });

      expect(revResult.rightsRevoked).toBe(true);

      const updated = await rightsService.getDataRightsRecord(rightsRec.rightsId);
      expect(updated?.status).toBe('revoked');
    });
  });

  describe('Deletion Lifecycle State Machine & Idempotency', () => {
    it('executes full end-to-end deletion lifecycle: requested -> approved -> processing -> completed', async () => {
      // 1. Register expired retention policy
      await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'temporary_upload',
        retentionClass: 'temporary',
        retentionUntil: '2020-01-01T00:00:00Z',
      });

      // 2. Put dummy document in collection
      await mockDb.collection('temporary_files').doc('upload_1').set({
        tenantId: 'tenant_A',
        fileName: 'temp.jpg',
      });

      // 3. Request deletion
      const req = await retentionService.requestDeletion({
        tenantId: 'tenant_A',
        recordType: 'temporary_upload',
        recordId: 'upload_1',
        reason: 'GDPR Right to Erasure',
      });

      expect(req.status).toBe('approved');
      expect(req.requestId.startsWith('delreq_')).toBe(true);

      // 4. Process deletion (Server-authoritative target collection 'temporary_files' resolved from recordType)
      const completedReq = await retentionService.processDeletion({
        tenantId: 'tenant_A',
        requestId: req.requestId,
      });

      expect(completedReq.status).toBe('completed');
      expect(completedReq.result?.erasedRecordsCount).toBe(1);

      // Verify target document was physically erased from authoritative collection
      const docSnap = await mockDb.collection('temporary_files').doc('upload_1').get();
      expect(docSnap.exists).toBe(false);

      // 5. Idempotency test: repeating processDeletion returns same completed record
      const repeated = await retentionService.processDeletion({
        tenantId: 'tenant_A',
        requestId: req.requestId,
      });
      expect(repeated.status).toBe('completed');
      expect(repeated.version).toBe(completedReq.version);
    });

    it('fails closed when record type has no authoritative collection mapping', async () => {
      await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'unmapped_custom_record',
        retentionClass: 'custom',
        retentionUntil: '2020-01-01T00:00:00Z',
      });

      const req = await retentionService.requestDeletion({
        tenantId: 'tenant_A',
        recordType: 'unmapped_custom_record',
        recordId: 'cust_100',
        reason: 'Erasure',
      });

      await expect(
        retentionService.processDeletion({
          tenantId: 'tenant_A',
          requestId: req.requestId,
        })
      ).rejects.toThrow(DataRetentionValidationError);
    });

    it('preserves existing legal hold across standard policy updates', async () => {
      // 1. Initial policy under legal hold
      const initial = await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'dispute_evidence',
        retentionClass: 'legal',
        legalHold: true,
        legalHoldReason: 'Litigation hold',
      });
      expect(initial.legalHold).toBe(true);

      // 2. Standard update without legalHold field MUST preserve existing legal hold
      const updated = await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'dispute_evidence',
        retentionClass: 'legal_updated',
        retentionPeriodDays: 90,
      });
      expect(updated.legalHold).toBe(true);
      expect(updated.legalHoldReason).toBe('Litigation hold');
    });

    it('rejects cross-tenant deletion requests and processing', async () => {
      await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_A',
        recordType: 'user_profile',
        retentionClass: 'user_data',
        retentionUntil: '2020-01-01T00:00:00Z',
      });

      const req = await retentionService.requestDeletion({
        tenantId: 'tenant_A',
        recordType: 'user_profile',
        recordId: 'prof_1',
        reason: 'Erasure request',
      });

      // Tenant B cannot process Tenant A's deletion request
      await expect(
        retentionService.processDeletion({
          tenantId: 'tenant_B',
          requestId: req.requestId,
        })
      ).rejects.toThrow(DataRetentionSecurityError);
    });
  });
});
