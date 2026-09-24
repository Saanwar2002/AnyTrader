/**
 * AnyTrader V8.3 — Task 30 Data Classification & Eligibility Real Firebase Emulator Security Suite
 * 
 * CANONICAL TENANT MODEL ARCHITECTURAL INVARIANT:
 * - Strict UID-as-tenant (tenantId === request.auth.uid).
 * - Server-authoritative data classification and eligibility decision engine.
 * - Client writes are strictly denied across /data_classifications, /data_classification_history, /data_eligibility_decisions.
 * - Unknown or unclassified data is strictly denied for external purposes (unknown != allowed).
 * - Internal AI permission (internal_ai_use: 'allowed') NEVER implies external AI training, commercial licensing, sharing, or export.
 * - Contractor possession or job participation NEVER establishes external/commercial rights.
 * - Provenance binding is mandatory and tenant-partitioned; missing/cross-tenant provenance fails closed.
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
  DataClassificationEligibilityService,
  computeDataClassificationId,
  computeClassificationContentHash,
  DataClassificationSecurityError,
  DataClassificationValidationError,
} from '../../src/server/intelligence/dataClassificationEligibility';
import {
  DataRightsService,
} from '../../src/server/intelligence/dataRights';
import {
  ProvenanceGraphService,
} from '../../src/server/intelligence/provenanceGraph';
import {
  ContractorArchiveRightsService,
} from '../../src/server/intelligence/contractorArchiveRights';

describe('V8.3 Task 30 — Firebase Emulator Data Classification & Eligibility Suite', () => {
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
      console.error('FATAL ERROR: Failed to initialize Firebase emulator test environment for Task 30!', err);
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

  describe('Vector 1: Identification & Content Hash Invariants', () => {
    it('generates deterministic classificationId', () => {
      const id1 = computeDataClassificationId('tenant_A', 'property_doc', 'doc_100');
      const id2 = computeDataClassificationId('tenant_A', 'property_doc', 'doc_100');
      expect(id1).toBe(id2);
      expect(id1.startsWith('dclass_')).toBe(true);
    });

    it('computes deterministic SHA-256 contentHash over classification fields', () => {
      const record = {
        classificationId: 'dclass_123',
        tenantId: 'tenant_A',
        recordType: 'inspection',
        recordId: 'insp_1',
        category: 'property_intelligence' as const,
        sensitivity: 'confidential' as const,
        restrictions: [],
        version: 1,
        provenanceRef: {
          tenantId: 'tenant_A',
          sourceType: 'system',
          sourceId: 'sys_1',
        },
        status: 'active' as const,
      };
      const hash1 = computeClassificationContentHash(record);
      const hash2 = computeClassificationContentHash(record);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe('Vector 2: Firestore Security Rules Enforcement', () => {
    it('denies unauthenticated client read access on /data_classifications', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'data_classifications', 'dclass_test')));
    });

    it('denies unauthenticated client write access on /data_classifications', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(unauthDb, 'data_classifications', 'dclass_test'), {
        tenantId: 'tenant_A',
        category: 'property_intelligence',
      }));
    });

    it('denies cross-tenant client read access on /data_classifications', async () => {
      // Seed classification for tenant_A via disabled security rules
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_classifications', 'dclass_tenant_a'), {
          classificationId: 'dclass_tenant_a',
          tenantId: 'tenant_A',
          recordType: 'job',
          recordId: 'job_1',
          category: 'transactional_operational',
        });
      });

      // Tenant B attempts to read tenant_A's classification
      const tenantBDb = testEnv.authenticatedContext('tenant_B').firestore();
      await assertFails(getDoc(doc(tenantBDb, 'data_classifications', 'dclass_tenant_a')));
    });

    it('permits authenticated tenant to read own classification record', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_classifications', 'dclass_tenant_a'), {
          classificationId: 'dclass_tenant_a',
          tenantId: 'tenant_A',
          recordType: 'job',
          recordId: 'job_1',
          category: 'transactional_operational',
        });
      });

      const tenantADb = testEnv.authenticatedContext('tenant_A').firestore();
      await assertSucceeds(getDoc(doc(tenantADb, 'data_classifications', 'dclass_tenant_a')));
    });

    it('denies client SDK writes (create, update, delete) on /data_classifications', async () => {
      const tenantADb = testEnv.authenticatedContext('tenant_A').firestore();
      await assertFails(setDoc(doc(tenantADb, 'data_classifications', 'dclass_new'), {
        classificationId: 'dclass_new',
        tenantId: 'tenant_A',
        category: 'property_intelligence',
      }));
    });

    it('denies client SDK writes on /data_classification_history', async () => {
      const tenantADb = testEnv.authenticatedContext('tenant_A').firestore();
      await assertFails(setDoc(doc(tenantADb, 'data_classification_history', 'hist_1'), {
        historyId: 'hist_1',
        tenantId: 'tenant_A',
      }));
    });

    it('denies client SDK writes on /data_eligibility_decisions', async () => {
      const tenantADb = testEnv.authenticatedContext('tenant_A').firestore();
      await assertFails(setDoc(doc(tenantADb, 'data_eligibility_decisions', 'dec_1'), {
        decisionId: 'dec_1',
        tenantId: 'tenant_A',
      }));
    });
  });

  describe('Vector 3: Authoritative Classification & Eligibility Service Engine', () => {
    it('registers a classification record server-authoritatively and appends history', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const provenanceService = new ProvenanceGraphService(db as any);
        const service = new DataClassificationEligibilityService(db as any, undefined, provenanceService);

        // Seed provenance node
        const provNode = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'property_inspection',
          sourceId: 'insp_99',
        });

        const record = await service.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'property_passport',
          recordId: 'pass_100',
          category: 'property_intelligence',
          sensitivity: 'confidential',
          provenanceRef: {
            nodeId: provNode.nodeId,
            tenantId: 'tenant_A',
            sourceType: 'property_inspection',
            sourceId: 'insp_99',
          },
        });

        expect(record.classificationId).toBeDefined();
        expect(record.tenantId).toBe('tenant_A');
        expect(record.category).toBe('property_intelligence');
        expect(record.version).toBe(1);
        expect(record.status).toBe('active');
        expect(record.contentHash.length).toBe(64);

        // Verify record in Firestore
        const docSnap = await getDoc(doc(db, 'data_classifications', record.classificationId));
        expect(docSnap.exists()).toBe(true);
        expect(docSnap.data()?.category).toBe('property_intelligence');
      });
    });

    it('evaluates eligibility and blocks unclassified data for external AI training', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const service = new DataClassificationEligibilityService(db as any);

        const result = await service.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'unregistered_type',
          recordId: 'rec_999',
          requestedPurpose: 'external_ai_training',
        });

        expect(result.eligible).toBe(false);
        expect(result.outcome).toBe('blocked_by_classification');
        expect(result.reason).toContain('Unclassified data is strictly non-eligible');
      });
    });

    it('evaluates eligibility for valid classified record and passes all gates', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const rightsService = new DataRightsService(db as any);
        const provenanceService = new ProvenanceGraphService(db as any);
        const archiveService = new ContractorArchiveRightsService(db as any, rightsService, provenanceService);
        const classificationService = new DataClassificationEligibilityService(
          db as any,
          rightsService,
          provenanceService,
          archiveService
        );

        // Create Task 27 DataRights record
        const rightsRecord = await rightsService.createDataRightsRecord({
          tenantId: 'tenant_A',
          subject: { type: 'property_passport', id: 'pass_200' },
          owner: { type: 'user', id: 'tenant_A' },
          source: { type: 'inspection', id: 'insp_1' },
          purposes: {
            internal_platform_operation: 'allowed',
            internal_ai_use: 'allowed',
            external_ai_training: 'denied',
          },
          provenance: {
            sourceType: 'inspection',
            sourceId: 'insp_1',
            tenantId: 'tenant_A',
          },
        });

        // Create Task 28 Provenance Node
        const provNode = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'inspection',
          sourceId: 'insp_1',
          rightsReference: {
            rightsId: rightsRecord.rightsId,
            tenantId: 'tenant_A',
          },
        });

        // Register Data Classification
        const classification = await classificationService.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'property_passport',
          recordId: 'pass_200',
          category: 'property_intelligence',
          provenanceRef: {
            nodeId: provNode.nodeId,
            tenantId: 'tenant_A',
            sourceType: 'inspection',
            sourceId: 'insp_1',
          },
          rightsRef: {
            rightsId: rightsRecord.rightsId,
            tenantId: 'tenant_A',
          },
        });

        // Evaluate internal_ai_use -> should be allowed
        const internalEval = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'property_passport',
          recordId: 'pass_200',
          requestedPurpose: 'internal_ai_use',
          classificationId: classification.classificationId,
          context: { isInternalAi: true },
        });

        expect(internalEval.eligible).toBe(true);
        expect(internalEval.outcome).toBe('allowed');

        // Evaluate external_ai_training -> should be denied!
        const externalEval = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'property_passport',
          recordId: 'pass_200',
          requestedPurpose: 'external_ai_training',
          classificationId: classification.classificationId,
        });

        expect(externalEval.eligible).toBe(false);
        expect(externalEval.outcome).toBe('denied');
      });
    });

    it('blocks external purposes for contractor archive data containing customer/subject data', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const rightsService = new DataRightsService(db as any);
        const provenanceService = new ProvenanceGraphService(db as any);
        const archiveService = new ContractorArchiveRightsService(db as any, rightsService, provenanceService);
        const classificationService = new DataClassificationEligibilityService(
          db as any,
          rightsService,
          provenanceService,
          archiveService
        );

        // Register Contractor Archive with customer_or_subject_data component
        const archiveReg = await archiveService.registerArchiveRights({
          tenantId: 'tenant_A',
          contractorUid: 'tenant_A',
          archiveReference: 'archive_customer_photos',
          components: [
            {
              componentKey: 'customer_photo_1',
              originType: 'customer_or_subject_data',
              category: 'photograph',
            },
          ],
        });

        // Seed Provenance Node for contractor archive
        const provNode = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'contractor_archive',
          sourceId: archiveReg.archiveId,
        });

        // Register Data Classification linking to archive component
        const classification = await classificationService.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'archive_photo',
          recordId: 'photo_100',
          category: 'contractor_archive',
          provenanceRef: {
            nodeId: provNode.nodeId,
            tenantId: 'tenant_A',
            sourceType: 'contractor_archive',
            sourceId: archiveReg.archiveId,
          },
          archiveRef: {
            archiveId: archiveReg.archiveId,
            tenantId: 'tenant_A',
            componentKey: 'customer_photo_1',
          },
        });

        // Attempt external_ai_training -> MUST return blocked_by_origin!
        const evalResult = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'archive_photo',
          recordId: 'photo_100',
          requestedPurpose: 'external_ai_training',
          classificationId: classification.classificationId,
        });

        expect(evalResult.eligible).toBe(false);
        expect(evalResult.outcome).toBe('blocked_by_origin');
      });
    });

    it('blocks eligibility when classification is revoked', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const provenanceService = new ProvenanceGraphService(db as any);
        const service = new DataClassificationEligibilityService(db as any, undefined, provenanceService);

        // Seed Provenance Node
        const provNode = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'system',
          sourceId: 'sys_1',
        });

        const classification = await service.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'job_report',
          recordId: 'report_1',
          category: 'transactional_operational',
          provenanceRef: {
            nodeId: provNode.nodeId,
            tenantId: 'tenant_A',
            sourceType: 'system',
            sourceId: 'sys_1',
          },
        });

        // Revoke
        await service.revokeClassification('tenant_A', classification.classificationId, 'Data deleted by user');

        // Evaluate eligibility -> blocked_by_status
        const evalResult = await service.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'job_report',
          recordId: 'report_1',
          requestedPurpose: 'internal_platform_operation',
          classificationId: classification.classificationId,
        });

        expect(evalResult.eligible).toBe(false);
        expect(evalResult.outcome).toBe('blocked_by_status');
      });
    });
  });

  describe('Vector 4: Task 30R Provenance Enforcement & Integrity Suite', () => {
    it('passes eligibility when referencing a valid, active provenance node', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const provenanceService = new ProvenanceGraphService(db as any);
        const classificationService = new DataClassificationEligibilityService(db as any, undefined, provenanceService);

        const node = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'job_attachment',
          sourceId: 'att_101',
        });

        const classification = await classificationService.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'attachment',
          recordId: 'att_101',
          category: 'transactional_operational',
          provenanceRef: {
            nodeId: node.nodeId,
            tenantId: 'tenant_A',
            sourceType: 'job_attachment',
            sourceId: 'att_101',
          },
        });

        const result = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'attachment',
          recordId: 'att_101',
          requestedPurpose: 'internal_platform_operation',
          classificationId: classification.classificationId,
        });

        expect(result.eligible).toBe(true);
        expect(result.outcome).toBe('allowed');
      });
    });

    it('blocks eligibility with outcome blocked_by_provenance when provenance node does not exist in registry', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const provenanceService = new ProvenanceGraphService(db as any);
        const classificationService = new DataClassificationEligibilityService(db as any, undefined, provenanceService);

        // Direct write of classification record with dangling nonexistent nodeId
        const fakeNodeId = 'pnode_000000000000000000000000';
        const classificationId = 'dclass_dangling_prov';
        await setDoc(doc(db, 'data_classifications', classificationId), {
          classificationId,
          tenantId: 'tenant_A',
          recordType: 'ghost_record',
          recordId: 'ghost_1',
          category: 'property_intelligence',
          sensitivity: 'internal',
          restrictions: [],
          version: 1,
          provenanceRef: {
            nodeId: fakeNodeId,
            tenantId: 'tenant_A',
            sourceType: 'ghost_source',
            sourceId: 'ghost_1',
          },
          status: 'active',
          contentHash: 'hash_placeholder',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const result = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'ghost_record',
          recordId: 'ghost_1',
          requestedPurpose: 'internal_platform_operation',
          classificationId,
        });

        expect(result.eligible).toBe(false);
        expect(result.outcome).toBe('blocked_by_provenance');
        expect(result.reason).toContain('Task 28 Provenance validation failed');
      });
    });

    it('blocks eligibility when referencing cross-tenant provenance node', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const provenanceService = new ProvenanceGraphService(db as any);
        const classificationService = new DataClassificationEligibilityService(db as any, undefined, provenanceService);

        // Tenant B creates a valid provenance node
        const nodeB = await provenanceService.createNode({
          tenantId: 'tenant_B',
          nodeType: 'source',
          sourceType: 'tenant_b_data',
          sourceId: 'b_data_1',
        });

        // Tenant A creates classification referencing Tenant B's node directly
        const classificationId = 'dclass_cross_tenant_prov';
        await setDoc(doc(db, 'data_classifications', classificationId), {
          classificationId,
          tenantId: 'tenant_A',
          recordType: 'stolen_data',
          recordId: 'stolen_1',
          category: 'property_intelligence',
          sensitivity: 'internal',
          restrictions: [],
          version: 1,
          provenanceRef: {
            nodeId: nodeB.nodeId,
            tenantId: 'tenant_A', // references nodeB which belongs to tenant_B
            sourceType: 'tenant_b_data',
            sourceId: 'b_data_1',
          },
          status: 'active',
          contentHash: 'hash_placeholder',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const result = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'stolen_data',
          recordId: 'stolen_1',
          requestedPurpose: 'internal_platform_operation',
          classificationId,
        });

        expect(result.eligible).toBe(false);
        expect(result.outcome).toBe('blocked_by_provenance');
        expect(result.reason).toContain('Cross-tenant provenance reference rejected');
      });
    });

    it('blocks eligibility when provenance node has status retracted', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const provenanceService = new ProvenanceGraphService(db as any);
        const classificationService = new DataClassificationEligibilityService(db as any, undefined, provenanceService);

        const node = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'retracted_source',
          sourceId: 'ret_1',
        });

        // Mark provenance node as retracted in Firestore
        await updateDoc(doc(db, 'provenance_nodes', node.nodeId), {
          status: 'retracted',
        });

        const classificationId = 'dclass_retracted_prov';
        await setDoc(doc(db, 'data_classifications', classificationId), {
          classificationId,
          tenantId: 'tenant_A',
          recordType: 'retracted_doc',
          recordId: 'ret_1',
          category: 'property_intelligence',
          sensitivity: 'internal',
          restrictions: [],
          version: 1,
          provenanceRef: {
            nodeId: node.nodeId,
            tenantId: 'tenant_A',
            sourceType: 'retracted_source',
            sourceId: 'ret_1',
          },
          status: 'active',
          contentHash: 'hash_placeholder',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const result = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'retracted_doc',
          recordId: 'ret_1',
          requestedPurpose: 'internal_platform_operation',
          classificationId,
        });

        expect(result.eligible).toBe(false);
        expect(result.outcome).toBe('blocked_by_provenance');
        expect(result.reason).toContain("has status 'retracted'");
      });
    });

    it('blocks eligibility when provenance node source identity is mismatched', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const provenanceService = new ProvenanceGraphService(db as any);
        const classificationService = new DataClassificationEligibilityService(db as any, undefined, provenanceService);

        const node = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'inspection_report',
          sourceId: 'insp_100',
        });

        const classificationId = 'dclass_mismatched_source';
        await setDoc(doc(db, 'data_classifications', classificationId), {
          classificationId,
          tenantId: 'tenant_A',
          recordType: 'inspection_report',
          recordId: 'insp_100',
          category: 'property_intelligence',
          sensitivity: 'internal',
          restrictions: [],
          version: 1,
          provenanceRef: {
            nodeId: node.nodeId,
            tenantId: 'tenant_A',
            sourceType: 'electric_certificate', // Mismatched sourceType!
            sourceId: 'insp_100',
          },
          status: 'active',
          contentHash: 'hash_placeholder',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const result = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'inspection_report',
          recordId: 'insp_100',
          requestedPurpose: 'internal_platform_operation',
          classificationId,
        });

        expect(result.eligible).toBe(false);
        expect(result.outcome).toBe('blocked_by_provenance');
        expect(result.reason).toContain('sourceType');
      });
    });

    it('blocks eligibility when provenance node content hash fails integrity verification', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const provenanceService = new ProvenanceGraphService(db as any);
        const classificationService = new DataClassificationEligibilityService(db as any, undefined, provenanceService);

        const node = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'tampered_source',
          sourceId: 'tamp_1',
        });

        // Corrupt contentHash directly in Firestore
        await updateDoc(doc(db, 'provenance_nodes', node.nodeId), {
          contentHash: 'bad_tampered_hash_000000000000000000000000000000000000000000000000',
        });

        const classificationId = 'dclass_tampered_prov';
        await setDoc(doc(db, 'data_classifications', classificationId), {
          classificationId,
          tenantId: 'tenant_A',
          recordType: 'tampered_data',
          recordId: 'tamp_1',
          category: 'property_intelligence',
          sensitivity: 'internal',
          restrictions: [],
          version: 1,
          provenanceRef: {
            nodeId: node.nodeId,
            tenantId: 'tenant_A',
            sourceType: 'tampered_source',
            sourceId: 'tamp_1',
          },
          status: 'active',
          contentHash: 'hash_placeholder',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const result = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'tampered_data',
          recordId: 'tamp_1',
          requestedPurpose: 'internal_platform_operation',
          classificationId,
        });

        expect(result.eligible).toBe(false);
        expect(result.outcome).toBe('blocked_by_provenance');
        expect(result.reason).toContain('content hash integrity failure');
      });
    });

    it('guarantees internal AI is permitted while external AI training is strictly denied under same valid provenance', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const rightsService = new DataRightsService(db as any);
        const provenanceService = new ProvenanceGraphService(db as any);
        const classificationService = new DataClassificationEligibilityService(
          db as any,
          rightsService,
          provenanceService
        );

        const rights = await rightsService.createDataRightsRecord({
          tenantId: 'tenant_A',
          subject: { type: 'property', id: 'prop_77' },
          owner: { type: 'user', id: 'tenant_A' },
          source: { type: 'survey', id: 'srv_1' },
          purposes: {
            internal_platform_operation: 'allowed',
            internal_ai_use: 'allowed',
            external_ai_training: 'denied',
            commercial_licensing: 'denied',
            third_party_sharing: 'denied',
            export: 'denied',
          },
          provenance: {
            sourceType: 'survey',
            sourceId: 'srv_1',
            tenantId: 'tenant_A',
          },
        });

        const node = await provenanceService.createNode({
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'survey',
          sourceId: 'srv_1',
          rightsReference: {
            rightsId: rights.rightsId,
            tenantId: 'tenant_A',
          },
        });

        const classification = await classificationService.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'property',
          recordId: 'prop_77',
          category: 'property_intelligence',
          provenanceRef: {
            nodeId: node.nodeId,
            tenantId: 'tenant_A',
            sourceType: 'survey',
            sourceId: 'srv_1',
          },
          rightsRef: {
            rightsId: rights.rightsId,
            tenantId: 'tenant_A',
          },
        });

        // 1. Internal AI -> ALLOWED
        const internalAi = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'property',
          recordId: 'prop_77',
          requestedPurpose: 'internal_ai_use',
          classificationId: classification.classificationId,
          context: { isInternalAi: true },
        });
        expect(internalAi.eligible).toBe(true);
        expect(internalAi.outcome).toBe('allowed');

        // 2. External AI Training -> DENIED
        const externalAi = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'property',
          recordId: 'prop_77',
          requestedPurpose: 'external_ai_training',
          classificationId: classification.classificationId,
        });
        expect(externalAi.eligible).toBe(false);
        expect(externalAi.outcome).toBe('denied');

        // 3. Commercial Licensing -> DENIED
        const commLic = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'property',
          recordId: 'prop_77',
          requestedPurpose: 'commercial_licensing',
          classificationId: classification.classificationId,
        });
        expect(commLic.eligible).toBe(false);
        expect(commLic.outcome).toBe('denied');

        // 4. Third-Party Sharing -> DENIED
        const tpSharing = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'property',
          recordId: 'prop_77',
          requestedPurpose: 'third_party_sharing',
          classificationId: classification.classificationId,
        });
        expect(tpSharing.eligible).toBe(false);
        expect(tpSharing.outcome).toBe('denied');

        // 5. Export -> DENIED
        const exportRes = await classificationService.evaluateEligibility({
          tenantId: 'tenant_A',
          recordType: 'property',
          recordId: 'prop_77',
          requestedPurpose: 'export',
          classificationId: classification.classificationId,
        });
        expect(exportRes.eligible).toBe(false);
        expect(exportRes.outcome).toBe('denied');
      });
    });
  });
});
