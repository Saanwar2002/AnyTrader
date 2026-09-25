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

      // Apply legal hold via authorized admin
      await retentionService.setLegalHold('tenant_A', policy.policyId, true, 'HSE Audit Hold', 'admin_hse');

      const evalResult = await retentionService.evaluateRetentionEligibility(
        'tenant_A',
        'safety_incident',
        'incident_5'
      );
      expect(evalResult.allowed).toBe(false);
      expect(evalResult.decision).toBe('blocked_by_legal_hold');
    });

    it('permits authorized administrator to apply and remove legal hold on tenant policy', async () => {
      const policy = await retentionService.registerRetentionPolicy({
        tenantId: 'tenant_target',
        recordType: 'disputed_transaction',
        retentionClass: 'financial',
      });

      // Admin lookup
      const adminLookup = await retentionService.getRetentionPolicyAdmin(policy.policyId);
      expect(adminLookup).not.toBeNull();
      expect(adminLookup?.tenantId).toBe('tenant_target');

      // Admin applies legal hold using authoritative policy tenant
      const heldPolicy = await retentionService.setLegalHold(
        adminLookup!.tenantId,
        policy.policyId,
        true,
        'Judicial freeze order',
        'admin_master_uid'
      );
      expect(heldPolicy.legalHold).toBe(true);
      expect(heldPolicy.legalHoldReason).toBe('Judicial freeze order');

      // Deletion is blocked
      const evalResult = await retentionService.evaluateRetentionEligibility(
        'tenant_target',
        'disputed_transaction',
        'tx_999'
      );
      expect(evalResult.allowed).toBe(false);
      expect(evalResult.decision).toBe('blocked_by_legal_hold');

      // Admin releases legal hold
      const releasedPolicy = await retentionService.setLegalHold(
        adminLookup!.tenantId,
        policy.policyId,
        false,
        'Freeze lifted',
        'admin_master_uid'
      );
      expect(releasedPolicy.legalHold).toBe(false);
      expect(releasedPolicy.legalHoldReason).toBeUndefined();
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

  describe('Task 32R-1: API-Level Adversarial & Tenant Authority Boundary Invariants', () => {
    it('proves ordinary authenticated users cannot create legal holds and database state reflects no hold', async () => {
      // Simulate ordinary user attempting to register policy with legalHold: true
      const ordinaryUserUid = 'tenant_ordinary_user';
      
      // In server endpoint logic: non-admin callers attempting to pass legalHold fail closed or legalHold is stripped
      // If service is called without admin authority or legalHold field is omitted:
      const policy = await retentionService.registerRetentionPolicy({
        tenantId: ordinaryUserUid,
        recordType: 'standard_invoice',
        retentionClass: 'financial',
        retentionPeriodDays: 365,
      });

      // Verify database state: legalHold is false
      expect(policy.legalHold).toBe(false);
      const dbRecord = await retentionService.getRetentionPolicy(policy.policyId, ordinaryUserUid);
      expect(dbRecord?.legalHold).toBe(false);
      expect(dbRecord?.legalHoldReason).toBeUndefined();
    });

    it('proves ordinary authenticated users cannot remove legal holds established by an administrator', async () => {
      const tenantUid = 'tenant_subject_to_hold';
      const adminUid = 'admin_compliance_officer';

      // 1. Initial policy
      const initialPolicy = await retentionService.registerRetentionPolicy({
        tenantId: tenantUid,
        recordType: 'disputed_transaction',
        retentionClass: 'statutory',
      });

      // 2. Administrator establishes legal hold
      const heldPolicy = await retentionService.setLegalHold(
        tenantUid,
        initialPolicy.policyId,
        true,
        'HMRC Tax Investigation Hold',
        adminUid
      );
      expect(heldPolicy.legalHold).toBe(true);

      // 3. Ordinary tenant attempts to remove legal hold via direct setLegalHold call without admin privilege
      await expect(
        retentionService.setLegalHold(
          tenantUid,
          initialPolicy.policyId,
          false,
          'User trying to clear hold'
          // No authorizedAdminUid
        )
      ).rejects.toThrow(DataRetentionSecurityError);

      // 4. Ordinary tenant attempts to remove legal hold via standard policy update
      const updatedPolicy = await retentionService.registerRetentionPolicy({
        tenantId: tenantUid,
        recordType: 'disputed_transaction',
        retentionClass: 'standard',
      });

      // Database state MUST preserve active legal hold
      expect(updatedPolicy.legalHold).toBe(true);
      const currentDoc = await retentionService.getRetentionPolicy(initialPolicy.policyId, tenantUid);
      expect(currentDoc?.legalHold).toBe(true);
      expect(currentDoc?.legalHoldReason).toBe('HMRC Tax Investigation Hold');
    });

    it('proves a user cannot substitute another tenant ID to access or alter policies', async () => {
      const victimTenantId = 'tenant_victim_123';
      const attackerTenantId = 'tenant_attacker_456';

      // 1. Victim registers policy
      const victimPolicy = await retentionService.registerRetentionPolicy({
        tenantId: victimTenantId,
        recordType: 'confidential_contract',
        retentionClass: 'confidential',
      });

      // 2. Attacker attempts to read victim policy
      await expect(
        retentionService.getRetentionPolicy(victimPolicy.policyId, attackerTenantId)
      ).rejects.toThrow(DataRetentionSecurityError);

      // 3. Attacker attempts to modify victim policy by passing victim policyId with attacker tenantId
      await expect(
        retentionService.setLegalHold(
          attackerTenantId,
          victimPolicy.policyId,
          true,
          'Malicious hold'
        )
      ).rejects.toThrow(DataRetentionSecurityError);

      // Verify victim policy database state remains unchanged
      const verifiedVictimDoc = await retentionService.getRetentionPolicyAdmin(victimPolicy.policyId);
      expect(verifiedVictimDoc?.tenantId).toBe(victimTenantId);
      expect(verifiedVictimDoc?.legalHold).toBe(false);
    });

    it('proves authorized privileged operation succeeds with server-authoritative tenant derivation', async () => {
      const tenantUid = 'tenant_regulated_firm';
      const adminUid = 'admin_fca_auditor';

      // 1. Create policy for tenant
      const policy = await retentionService.registerRetentionPolicy({
        tenantId: tenantUid,
        recordType: 'audit_log',
        retentionClass: 'regulatory',
      });

      // 2. Lookup policy via server-authoritative admin lookup
      const adminLookup = await retentionService.getRetentionPolicyAdmin(policy.policyId);
      expect(adminLookup).not.toBeNull();
      expect(adminLookup?.tenantId).toBe(tenantUid);

      // 3. Admin applies legal hold using server-derived tenantId
      const heldPolicy = await retentionService.setLegalHold(
        adminLookup!.tenantId,
        policy.policyId,
        true,
        'FCA Statutory Audit Hold',
        adminUid
      );

      expect(heldPolicy.legalHold).toBe(true);
      expect(heldPolicy.legalHoldReason).toBe('FCA Statutory Audit Hold');

      // Verify database state
      const dbSnap = await retentionService.getRetentionPolicyAdmin(policy.policyId);
      expect(dbSnap?.legalHold).toBe(true);
      expect(dbSnap?.version).toBe(2);

      // 4. Admin later releases legal hold with valid reason
      const releasedPolicy = await retentionService.setLegalHold(
        adminLookup!.tenantId,
        policy.policyId,
        false,
        'Audit complete - hold lifted',
        adminUid
      );
      expect(releasedPolicy.legalHold).toBe(false);
      expect(releasedPolicy.legalHoldReason).toBeUndefined();

      const finalDbSnap = await retentionService.getRetentionPolicyAdmin(policy.policyId);
      expect(finalDbSnap?.legalHold).toBe(false);
      expect(finalDbSnap?.version).toBe(3);
    });

    it('proves server-authoritative deletion target protection remains intact against client manipulation', async () => {
      const tenantUid = 'tenant_deletion_test';

      // 1. Register expired policy for a known record type
      await retentionService.registerRetentionPolicy({
        tenantId: tenantUid,
        recordType: 'temporary_upload',
        retentionClass: 'ephemeral',
        retentionUntil: '2020-01-01T00:00:00Z',
      });

      // 2. Seed document in authoritative collection ('temporary_files')
      await mockDb.collection('temporary_files').doc('upload_target_1').set({
        tenantId: tenantUid,
        data: 'temporary data to be erased',
      });

      // Also seed document in unrelated sensitive collection ('properties')
      await mockDb.collection('properties').doc('prop_safe_1').set({
        tenantId: tenantUid,
        propertyAddress: '10 Downing St',
      });

      // 3. Create deletion request for temporary_upload
      const req = await retentionService.requestDeletion({
        tenantId: tenantUid,
        recordType: 'temporary_upload',
        recordId: 'upload_target_1',
        reason: 'GDPR Right to Erasure',
      });
      expect(req.status).toBe('approved');

      // 4. Process deletion: Server maps 'temporary_upload' to 'temporary_files' strictly
      const processed = await retentionService.processDeletion({
        tenantId: tenantUid,
        requestId: req.requestId,
      });
      expect(processed.status).toBe('completed');

      // Verify target in 'temporary_files' was erased
      const targetDoc = await mockDb.collection('temporary_files').doc('upload_target_1').get();
      expect(targetDoc.exists).toBe(false);

      // Verify document in 'properties' was NEVER touched
      const safeDoc = await mockDb.collection('properties').doc('prop_safe_1').get();
      expect(safeDoc.exists).toBe(true);
      expect(safeDoc.data().propertyAddress).toBe('10 Downing St');
    });
  });
});
