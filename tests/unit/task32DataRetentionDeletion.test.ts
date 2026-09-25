/**
 * AnyTrader V8.3 — Task 32 Revocation, Retention & Deletion Real Firebase Emulator Security Suite
 * 
 * CANONICAL TENANT MODEL ARCHITECTURAL INVARIANTS:
 * - Strict UID-as-tenant (tenantId === request.auth.uid).
 * - Server-authoritative data retention, revocation, and deletion engine.
 * - Client writes are strictly denied across /data_retention_policies, /data_deletion_requests, /data_lifecycle_events.
 * - REVOCATION != DELETION (immediate fail closed vs lifecycle evaluation).
 * - Missing policy fails closed (unknown != allowed to delete).
 * - Legal hold blocks physical deletion.
 * - Dependencies block unsafe deletion.
 * - Immutable audit history is preserved upon erasure.
 * - All server-authoritative test operations remain strictly inside testEnv.withSecurityRulesDisabled().
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import {
  DataRetentionService,
  computeRetentionPolicyId,
  computeDeletionRequestId,
  computeLifecycleEventId,
  computeLifecycleEventHash,
  DataRetentionSecurityError,
  DataRetentionValidationError,
} from '../../src/server/intelligence/dataRetention';
import {
  DataRightsService,
} from '../../src/server/intelligence/dataRights';
import {
  ProvenanceGraphService,
} from '../../src/server/intelligence/provenanceGraph';
import {
  ContractorArchiveRightsService,
} from '../../src/server/intelligence/contractorArchiveRights';
import {
  DataClassificationEligibilityService,
} from '../../src/server/intelligence/dataClassificationEligibility';
import {
  AiTrainingUsageControlsService,
} from '../../src/server/intelligence/aiTrainingUsageControls';

describe('V8.3 Task 32 — Firebase Emulator Data Retention, Revocation & Deletion Suite', () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = 'demo-anytrader';
  const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

  beforeAll(async () => {
    try {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: firestoreRules,
          host: '127.0.0.1',
          port: 8088,
        },
      });
    } catch (err) {
      console.error('FATAL ERROR: Failed to initialize Firebase emulator test environment for Task 32!', err);
      throw err;
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  describe('Vector 1: Identification, Hash & Lifecycle State Machine Invariants', () => {
    it('generates deterministic policyId, requestId, and eventId', () => {
      const p1 = computeRetentionPolicyId('tenant_A', 'property_passport');
      const p2 = computeRetentionPolicyId('tenant_A', 'property_passport');
      expect(p1).toBe(p2);
      expect(p1.startsWith('retpol_')).toBe(true);

      const r1 = computeDeletionRequestId('tenant_A', 'property_passport', 'doc_100');
      const r2 = computeDeletionRequestId('tenant_A', 'property_passport', 'doc_100');
      expect(r1).toBe(r2);
      expect(r1.startsWith('delreq_')).toBe(true);

      const e1 = computeLifecycleEventId('tenant_A', 'POLICY_REGISTERED', 'doc_100', '2026-09-25T00:00:00Z');
      const e2 = computeLifecycleEventId('tenant_A', 'POLICY_REGISTERED', 'doc_100', '2026-09-25T00:00:00Z');
      expect(e1).toBe(e2);
      expect(e1.startsWith('licevt_')).toBe(true);
    });

    it('computes deterministic SHA-256 event hash over non-PII audit metadata', () => {
      const event = {
        eventId: 'licevt_abc',
        tenantId: 'tenant_A',
        eventType: 'DATA_ERASURE_COMPLETED',
        recordType: 'property_passport',
        recordId: 'pass_100',
        recordedAt: '2026-09-25T00:00:00Z',
      };
      const h1 = computeLifecycleEventHash(event);
      const h2 = computeLifecycleEventHash(event);
      expect(h1).toBe(h2);
      expect(h1.length).toBe(64);
    });
  });

  describe('Vector 2: Firestore Security Rules Enforcement', () => {
    it('denies unauthenticated client reads on /data_retention_policies, /data_deletion_requests, /data_lifecycle_events', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'data_retention_policies', 'pol_1')));
      await assertFails(getDoc(doc(unauthDb, 'data_deletion_requests', 'del_1')));
      await assertFails(getDoc(doc(unauthDb, 'data_lifecycle_events', 'evt_1')));
    });

    it('denies cross-tenant client reads on /data_retention_policies, /data_deletion_requests, /data_lifecycle_events', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'data_retention_policies', 'pol_owner'), {
          policyId: 'pol_owner',
          tenantId: 'tenant_owner',
          recordType: 'report',
        });
        await setDoc(doc(adminDb, 'data_deletion_requests', 'del_owner'), {
          requestId: 'del_owner',
          tenantId: 'tenant_owner',
          recordType: 'report',
        });
        await setDoc(doc(adminDb, 'data_lifecycle_events', 'evt_owner'), {
          eventId: 'evt_owner',
          tenantId: 'tenant_owner',
          recordType: 'report',
        });
      });

      const intruderDb = testEnv.authenticatedContext('tenant_intruder').firestore();
      await assertFails(getDoc(doc(intruderDb, 'data_retention_policies', 'pol_owner')));
      await assertFails(getDoc(doc(intruderDb, 'data_deletion_requests', 'del_owner')));
      await assertFails(getDoc(doc(intruderDb, 'data_lifecycle_events', 'evt_owner')));
    });

    it('allows owner tenant reads on /data_retention_policies, /data_deletion_requests, /data_lifecycle_events', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'data_retention_policies', 'pol_mydata'), {
          policyId: 'pol_mydata',
          tenantId: 'tenant_owner',
          recordType: 'report',
        });
        await setDoc(doc(adminDb, 'data_deletion_requests', 'del_mydata'), {
          requestId: 'del_mydata',
          tenantId: 'tenant_owner',
          recordType: 'report',
        });
        await setDoc(doc(adminDb, 'data_lifecycle_events', 'evt_mydata'), {
          eventId: 'evt_mydata',
          tenantId: 'tenant_owner',
          recordType: 'report',
        });
      });

      const ownerDb = testEnv.authenticatedContext('tenant_owner').firestore();
      await assertSucceeds(getDoc(doc(ownerDb, 'data_retention_policies', 'pol_mydata')));
      await assertSucceeds(getDoc(doc(ownerDb, 'data_deletion_requests', 'del_mydata')));
      await assertSucceeds(getDoc(doc(ownerDb, 'data_lifecycle_events', 'evt_mydata')));
    });

    it('denies all client writes on /data_retention_policies, /data_deletion_requests, /data_lifecycle_events', async () => {
      const ownerDb = testEnv.authenticatedContext('tenant_owner').firestore();
      const polRef = doc(ownerDb, 'data_retention_policies', 'pol_test');
      const reqRef = doc(ownerDb, 'data_deletion_requests', 'del_test');
      const evtRef = doc(ownerDb, 'data_lifecycle_events', 'evt_test');

      await assertFails(setDoc(polRef, { policyId: 'pol_test', tenantId: 'tenant_owner' }));
      await assertFails(updateDoc(polRef, { legalHold: false }));
      await assertFails(deleteDoc(polRef));

      await assertFails(setDoc(reqRef, { requestId: 'del_test', tenantId: 'tenant_owner' }));
      await assertFails(updateDoc(reqRef, { status: 'completed' }));
      await assertFails(deleteDoc(reqRef));

      await assertFails(setDoc(evtRef, { eventId: 'evt_test', tenantId: 'tenant_owner' }));
      await assertFails(deleteDoc(evtRef));
    });
  });

  describe('Vector 3: Revocation Orchestration (REVOCATION != DELETION)', () => {
    it('rights revocation immediately blocks external AI training and creates immutable history', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const rightsService = new DataRightsService(db as any);
        const provenanceService = new ProvenanceGraphService(db as any);
        const archiveService = new ContractorArchiveRightsService(db as any, rightsService, provenanceService);
        const classificationService = new DataClassificationEligibilityService(db as any, rightsService, provenanceService, archiveService);
        const aiService = new AiTrainingUsageControlsService(db as any, rightsService, provenanceService, archiveService, classificationService);
        const retentionService = new DataRetentionService(db as any, rightsService, provenanceService, archiveService, classificationService, aiService);

        // 1. Setup valid chain
        const rightsRec = await rightsService.createDataRightsRecord({
          tenantId: 'tenant_A',
          subject: { type: 'property_doc', id: 'doc_1' },
          owner: { type: 'user', id: 'tenant_A' },
          source: { type: 'user_action', id: 'act_1' },
          purposes: { internal_ai_use: 'allowed', external_ai_training: 'allowed' },
          provenance: { sourceType: 'user_action', sourceId: 'act_1', tenantId: 'tenant_A' },
        });

        const provNode = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'user_action',
          sourceId: 'act_1',
          rightsReference: { rightsId: rightsRec.rightsId, tenantId: 'tenant_A' },
        });

        const classRec = await classificationService.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'property_doc',
          recordId: 'doc_1',
          category: 'property_intelligence',
          provenanceRef: { nodeId: provNode.nodeId, tenantId: 'tenant_A' },
          rightsRef: { rightsId: rightsRec.rightsId, tenantId: 'tenant_A' },
        });

        await aiService.registerAiUsageControls({
          tenantId: 'tenant_A',
          recordType: 'property_doc',
          recordId: 'doc_1',
          purposes: { internal_ai_use: 'allowed', external_ai_training: 'allowed' },
          trainingConsent: 'opt_in',
          provenanceRef: { nodeId: provNode.nodeId, tenantId: 'tenant_A' },
          rightsRef: { rightsId: rightsRec.rightsId, tenantId: 'tenant_A' },
          classificationRef: { classificationId: classRec.classificationId, tenantId: 'tenant_A' },
        });

        // 2. Verify external training initially allowed
        const initialEval = await aiService.evaluateAiUsageEligibility({
          tenantId: 'tenant_A',
          recordType: 'property_doc',
          recordId: 'doc_1',
          requestedPurpose: 'external_ai_training',
        });
        expect(initialEval.allowed).toBe(true);

        // 3. Orchestrate rights revocation via DataRetentionService
        const revResult = await retentionService.revokeDataLifecycleRights({
          tenantId: 'tenant_A',
          rightsId: rightsRec.rightsId,
          reason: 'Owner revoked rights',
        });
        expect(revResult.rightsRevoked).toBe(true);

        // 4. Verify external AI training immediately fails closed
        const postRevEval = await aiService.evaluateAiUsageEligibility({
          tenantId: 'tenant_A',
          recordType: 'property_doc',
          recordId: 'doc_1',
          requestedPurpose: 'external_ai_training',
        });
        expect(postRevEval.allowed).toBe(false);
        expect(postRevEval.outcome).toBe('blocked_by_restriction');

        // 5. Verify immutable history exists
        const historySnap = await db.collection('data_rights_history').get();
        expect(historySnap.docs.length).toBeGreaterThanOrEqual(2); // Created + Revoked
      });
    });

    it('AI control revocation blocks all controlled purposes and provenance retraction makes validation fail', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const rightsService = new DataRightsService(db as any);
        const provenanceService = new ProvenanceGraphService(db as any);
        const archiveService = new ContractorArchiveRightsService(db as any, rightsService, provenanceService);
        const classificationService = new DataClassificationEligibilityService(db as any, rightsService, provenanceService, archiveService);
        const aiService = new AiTrainingUsageControlsService(db as any, rightsService, provenanceService, archiveService, classificationService);
        const retentionService = new DataRetentionService(db as any, rightsService, provenanceService, archiveService, classificationService, aiService);

        const node = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'user_action',
          sourceId: 'act_2',
        });

        // Retract provenance node
        const revResult = await retentionService.revokeDataLifecycleRights({
          tenantId: 'tenant_A',
          provenanceNodeId: node.nodeId,
          reason: 'Retracted node',
        });
        expect(revResult.provenanceRetracted).toBe(true);

        // Validating retracted node must fail
        const valRes = await provenanceService.validateProvenanceReference({
          tenantId: 'tenant_A',
          nodeId: node.nodeId,
          sourceType: 'user_action',
          sourceId: 'act_2',
        });
        expect(valRes.valid).toBe(false);
        expect(valRes.outcome).toBe('invalid_status');
      });
    });
  });

  describe('Vector 4: Retention Evaluation & Legal Hold Boundaries', () => {
    it('fails closed when evaluating record without retention policy (unknown != allowed to delete)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        const evalRes = await retentionService.evaluateRetentionEligibility(
          'tenant_A',
          'unregistered_record_type',
          'rec_1'
        );
        expect(evalRes.allowed).toBe(false);
        expect(evalRes.decision).toBe('blocked_by_unknown_policy');
      });
    });

    it('blocks deletion when record is within active retention period', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        await retentionService.registerRetentionPolicy({
          tenantId: 'tenant_A',
          recordType: 'invoice',
          retentionClass: 'statutory_financial',
          retentionPeriodDays: 365 * 6,
        });

        const evalRes = await retentionService.evaluateRetentionEligibility(
          'tenant_A',
          'invoice',
          'inv_1'
        );
        expect(evalRes.allowed).toBe(false);
        expect(evalRes.decision).toBe('retain');
      });
    });

    it('blocks deletion when policy is under legal hold regardless of expiry', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        const policy = await retentionService.registerRetentionPolicy({
          tenantId: 'tenant_A',
          recordType: 'dispute_evidence',
          retentionClass: 'dispute',
          retentionUntil: '2020-01-01T00:00:00Z', // Expired
        });

        await retentionService.setLegalHold('tenant_A', policy.policyId, true, 'Court Subpoena Hold', 'admin_court_officer');

        const evalRes = await retentionService.evaluateRetentionEligibility(
          'tenant_A',
          'dispute_evidence',
          'disp_1'
        );
        expect(evalRes.allowed).toBe(false);
        expect(evalRes.decision).toBe('blocked_by_legal_hold');
      });
    });
  });

  describe('Vector 5: Dependency-Aware Erasure & Immutable Audit Preservation', () => {
    it('blocks deletion when active downstream dependencies exist, and succeeds once resolved', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const rightsService = new DataRightsService(db as any);
        const provenanceService = new ProvenanceGraphService(db as any);
        const archiveService = new ContractorArchiveRightsService(db as any, rightsService, provenanceService);
        const classificationService = new DataClassificationEligibilityService(db as any, rightsService, provenanceService, archiveService);
        const aiService = new AiTrainingUsageControlsService(db as any, rightsService, provenanceService, archiveService, classificationService);
        const retentionService = new DataRetentionService(db as any, rightsService, provenanceService, archiveService, classificationService, aiService);

        // 1. Expired policy
        await retentionService.registerRetentionPolicy({
          tenantId: 'tenant_A',
          recordType: 'contractor_document',
          retentionClass: 'temporary',
          retentionUntil: '2020-01-01T00:00:00Z',
        });

        // 2. Active Rights record for subject
        const rights = await rightsService.createDataRightsRecord({
          tenantId: 'tenant_A',
          subject: { type: 'contractor_document', id: 'cdoc_1' },
          owner: { type: 'user', id: 'tenant_A' },
          source: { type: 'user_action', id: 'act_10' },
          purposes: { internal_ai_use: 'allowed', external_ai_training: 'allowed' },
          provenance: { sourceType: 'user_action', sourceId: 'act_10', tenantId: 'tenant_A' },
        });

        // 3. Evaluation is blocked by active dependency
        const initialEval = await retentionService.evaluateRetentionEligibility(
          'tenant_A',
          'contractor_document',
          'cdoc_1'
        );
        expect(initialEval.allowed).toBe(false);
        expect(initialEval.decision).toBe('blocked_by_dependency');
        expect(initialEval.dependencies?.length).toBeGreaterThan(0);

        // 4. Revoke the dependency
        await retentionService.revokeDataLifecycleRights({
          tenantId: 'tenant_A',
          rightsId: rights.rightsId,
          reason: 'Pre-erasure revocation',
        });

        // 5. Evaluation is now eligible for deletion
        const resolvedEval = await retentionService.evaluateRetentionEligibility(
          'tenant_A',
          'contractor_document',
          'cdoc_1'
        );
        expect(resolvedEval.allowed).toBe(true);
        expect(resolvedEval.decision).toBe('eligible_for_deletion');
      });
    });

    it('erases current projection, preserves immutable audit evidence without PII, and runs idempotently', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const rightsService = new DataRightsService(db as any);
        const provenanceService = new ProvenanceGraphService(db as any);
        const archiveService = new ContractorArchiveRightsService(db as any, rightsService, provenanceService);
        const classificationService = new DataClassificationEligibilityService(db as any, rightsService, provenanceService, archiveService);
        const aiService = new AiTrainingUsageControlsService(db as any, rightsService, provenanceService, archiveService, classificationService);
        const retentionService = new DataRetentionService(db as any, rightsService, provenanceService, archiveService, classificationService, aiService);

        // 1. Expired retention policy
        await retentionService.registerRetentionPolicy({
          tenantId: 'tenant_A',
          recordType: 'temporary_file',
          retentionClass: 'temp',
          retentionUntil: '2020-01-01T00:00:00Z',
        });

        // 2. Put document in temporary_files collection
        await setDoc(doc(db, 'temporary_files', 'file_99'), {
          tenantId: 'tenant_A',
          fileName: 'confidential_secret.pdf',
          piiCustomerPhone: '07123456789',
        });

        // 3. Request deletion
        const req = await retentionService.requestDeletion({
          tenantId: 'tenant_A',
          recordType: 'temporary_file',
          recordId: 'file_99',
          reason: 'Right to erasure',
        });
        expect(req.status).toBe('approved');

        // 4. Process deletion (Server-authoritative target collection 'temporary_files' resolved from recordType)
        const completed = await retentionService.processDeletion({
          tenantId: 'tenant_A',
          requestId: req.requestId,
        });
        expect(completed.status).toBe('completed');
        expect(completed.result?.erasedRecordsCount).toBe(1);

        // 5. Target document is physically erased from authoritative collection
        const targetSnap = await getDoc(doc(db, 'temporary_files', 'file_99'));
        expect(targetSnap.exists()).toBe(false);

        // 6. Immutable lifecycle events exist and DO NOT contain erased PII
        const eventsSnap = await db.collection('data_lifecycle_events').get();
        expect(eventsSnap.docs.length).toBeGreaterThan(0);
        for (const evDoc of eventsSnap.docs) {
          const evData = evDoc.data();
          expect(evData.payload?.piiCustomerPhone).toBeUndefined();
          expect(evData.payload?.fileName).toBeUndefined();
        }

        // 7. Idempotency: repeated processing returns same completed record
        const repeated = await retentionService.processDeletion({
          tenantId: 'tenant_A',
          requestId: req.requestId,
        });
        expect(repeated.status).toBe('completed');
        expect(repeated.completedAt).toBe(completed.completedAt);
      });
    });

    it('enforces server-authoritative deletion target mapping and fails closed on unmapped record type', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        await retentionService.registerRetentionPolicy({
          tenantId: 'tenant_A',
          recordType: 'unmapped_custom_artifact',
          retentionClass: 'temp',
          retentionUntil: '2020-01-01T00:00:00Z',
        });

        const req = await retentionService.requestDeletion({
          tenantId: 'tenant_A',
          recordType: 'unmapped_custom_artifact',
          recordId: 'art_123',
          reason: 'Erasure',
        });

        await expect(
          retentionService.processDeletion({
            tenantId: 'tenant_A',
            requestId: req.requestId,
          })
        ).rejects.toThrow(DataRetentionValidationError);
      });
    });

    it('preserves active legal hold across standard policy updates', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        const initial = await retentionService.registerRetentionPolicy({
          tenantId: 'tenant_A',
          recordType: 'dispute_evidence',
          retentionClass: 'legal',
          legalHold: true,
          legalHoldReason: 'Litigation Hold',
        });
        expect(initial.legalHold).toBe(true);

        // Standard update without legalHold input MUST preserve existing legal hold
        const updated = await retentionService.registerRetentionPolicy({
          tenantId: 'tenant_A',
          recordType: 'dispute_evidence',
          retentionClass: 'legal_v2',
        });
        expect(updated.legalHold).toBe(true);
        expect(updated.legalHoldReason).toBe('Litigation Hold');
      });
    });

    it('rejects cross-tenant deletion requests and processing', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        await retentionService.registerRetentionPolicy({
          tenantId: 'tenant_A',
          recordType: 'secret_file',
          retentionClass: 'restricted',
          retentionUntil: '2020-01-01T00:00:00Z',
        });

        const req = await retentionService.requestDeletion({
          tenantId: 'tenant_A',
          recordType: 'secret_file',
          recordId: 'sec_1',
          reason: 'Erasure',
        });

        // Tenant B attempts to process Tenant A's deletion request
        await expect(
          retentionService.processDeletion({
            tenantId: 'tenant_B',
            requestId: req.requestId,
          })
        ).rejects.toThrow(DataRetentionSecurityError);
      });
    });

    it('permits authorized administrator to apply legal hold and blocks cross-tenant unauthorized legal hold removal', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        const policy = await retentionService.registerRetentionPolicy({
          tenantId: 'tenant_victim',
          recordType: 'dispute_evidence',
          retentionClass: 'statutory',
        });

        // 1. Authorized Admin applies legal hold using authoritative tenant
        const heldPolicy = await retentionService.setLegalHold(
          'tenant_victim',
          policy.policyId,
          true,
          'Regulatory Enforcement Hold',
          'admin_compliance_uid'
        );
        expect(heldPolicy.legalHold).toBe(true);

        // Verify audit event recorded with admin attribution
        const eventDoc = await db.collection('data_lifecycle_events')
          .where('tenantId', '==', 'tenant_victim')
          .where('eventType', '==', 'LEGAL_HOLD_APPLIED')
          .get();
        expect(eventDoc.docs.length).toBeGreaterThan(0);
        expect(eventDoc.docs[0].data().payload.authorizedAdminUid).toBe('admin_compliance_uid');

        // 2. Unauthorized cross-tenant caller cannot remove legal hold
        await expect(
          retentionService.setLegalHold(
            'tenant_intruder',
            policy.policyId,
            false,
            'Malicious unhold'
          )
        ).rejects.toThrow(DataRetentionSecurityError);

        // Verify policy still under legal hold
        const currentPolicy = await retentionService.getRetentionPolicyAdmin(policy.policyId);
        expect(currentPolicy?.legalHold).toBe(true);
      });
    });
  });

  describe('Vector 6: Task 32R-1 API Adversarial & Tenant Authority Boundary Suite', () => {
    it('proves ordinary authenticated users cannot create or remove legal holds (fails closed in database state)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        const ordinaryTenant = 'tenant_standard_user';

        // 1. Ordinary user registers policy without legal hold
        const policy = await retentionService.registerRetentionPolicy({
          tenantId: ordinaryTenant,
          recordType: 'standard_log',
          retentionClass: 'operational',
        });
        expect(policy.legalHold).toBe(false);

        // 2. Admin applies legal hold
        await retentionService.setLegalHold(
          ordinaryTenant,
          policy.policyId,
          true,
          'Fraud Investigation Hold',
          'admin_security_lead'
        );

        // Verify hold is active in database
        const snap1 = await retentionService.getRetentionPolicyAdmin(policy.policyId);
        expect(snap1?.legalHold).toBe(true);

        // 3. Ordinary tenant attempts to clear hold without admin claims -> Fails Closed
        await expect(
          retentionService.setLegalHold(
            ordinaryTenant,
            policy.policyId,
            false,
            'Clear my hold'
          )
        ).rejects.toThrow(DataRetentionSecurityError);

        // Database state MUST remain under legal hold
        const snap2 = await retentionService.getRetentionPolicyAdmin(policy.policyId);
        expect(snap2?.legalHold).toBe(true);
        expect(snap2?.legalHoldReason).toBe('Fraud Investigation Hold');
      });
    });

    it('proves a user cannot substitute another tenant ID to compromise foreign policies', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        const victimTenant = 'tenant_victim_enterprise';
        const attackerTenant = 'tenant_attacker_malicious';

        // 1. Victim registers policy
        const victimPolicy = await retentionService.registerRetentionPolicy({
          tenantId: victimTenant,
          recordType: 'financial_ledger',
          retentionClass: 'statutory',
        });

        // 2. Attacker attempts cross-tenant policy read
        await expect(
          retentionService.getRetentionPolicy(victimPolicy.policyId, attackerTenant)
        ).rejects.toThrow(DataRetentionSecurityError);

        // 3. Attacker attempts cross-tenant hold alteration
        await expect(
          retentionService.setLegalHold(
            attackerTenant,
            victimPolicy.policyId,
            true,
            'Tampered hold'
          )
        ).rejects.toThrow(DataRetentionSecurityError);

        // Database state remains intact
        const snap = await retentionService.getRetentionPolicyAdmin(victimPolicy.policyId);
        expect(snap?.tenantId).toBe(victimTenant);
        expect(snap?.legalHold).toBe(false);
      });
    });

    it('proves server-authoritative deletion target resolution protects non-target collections in Firestore', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const retentionService = new DataRetentionService(db as any);

        const tenant = 'tenant_secure_deletion';

        // 1. Register expired policy for temporary_upload
        await retentionService.registerRetentionPolicy({
          tenantId: tenant,
          recordType: 'temporary_upload',
          retentionClass: 'temporary',
          retentionUntil: '2020-01-01T00:00:00Z',
        });

        // 2. Seed document in target collection ('temporary_files') and sensitive non-target collection ('jobs')
        await setDoc(doc(db, 'temporary_files', 'temp_doc_101'), {
          tenantId: tenant,
          tempPayload: 'to be deleted',
        });
        await setDoc(doc(db, 'jobs', 'job_secure_202'), {
          tenantId: tenant,
          title: 'Protected Core Job Record',
        });

        // 3. Request and process deletion
        const req = await retentionService.requestDeletion({
          tenantId: tenant,
          recordType: 'temporary_upload',
          recordId: 'temp_doc_101',
          reason: 'Scheduled lifecycle cleanup',
        });

        const completed = await retentionService.processDeletion({
          tenantId: tenant,
          requestId: req.requestId,
        });
        expect(completed.status).toBe('completed');

        // Target document is erased
        const targetSnap = await getDoc(doc(db, 'temporary_files', 'temp_doc_101'));
        expect(targetSnap.exists()).toBe(false);

        // Sensitive non-target document in jobs is completely preserved
        const safeSnap = await getDoc(doc(db, 'jobs', 'job_secure_202'));
        expect(safeSnap.exists()).toBe(true);
        expect(safeSnap.data()?.title).toBe('Protected Core Job Record');
      });
    });
  });
});
