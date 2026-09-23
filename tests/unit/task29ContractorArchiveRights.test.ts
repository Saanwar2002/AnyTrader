/**
 * AnyTrader V8.3 — Task 29 Contractor Archive Rights Boundary Real Firebase Emulator Security & Integration Suite
 * 
 * CANONICAL TENANT MODEL ARCHITECTURAL INVARIANT:
 * - Strict UID-as-tenant (tenantId === request.auth.uid).
 * - Contractor historical archive rights are server-authoritative and tenant-bound.
 * - Client writes are denied across /data_rights and /data_rights_history.
 * - Unknown permissions are strictly denied for execution (unknown != allowed).
 * - Mixed-origin safety: possession of an archive does NOT grant commercial licensing,
 *   external AI training, third-party sharing, or export of embedded customer/third-party data.
 * - AnyTrader internal AI bot is preserved and permitted when internal_ai_use: 'allowed'.
 * - Production path verification on live Firebase emulator.
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
  ContractorArchiveRightsService,
  computeContractorArchiveId,
  computeArchiveComponentId,
  createDefaultContractorArchivePurposes,
  ContractorArchiveSecurityError,
  ContractorArchiveValidationError,
} from '../../src/server/intelligence/contractorArchiveRights';
import {
  DataRightsService,
  computeDataRightsHash,
} from '../../src/server/intelligence/dataRights';
import {
  ProvenanceGraphService,
} from '../../src/server/intelligence/provenanceGraph';

describe('V8.3 Task 29 — Firebase Emulator Contractor Archive Rights Boundary Suite', () => {
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
      console.error('FATAL ERROR: Failed to initialize Firebase emulator test environment for Task 29!', err);
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

  // ---------------------------------------------------------------------------
  // 1. UNAUTHENTICATED ACCESS DEFENSE
  // ---------------------------------------------------------------------------
  describe('Security Vector 1: Unauthenticated Client Defense', () => {
    it('denies unauthenticated read to contractor archive rights in /data_rights/{id}', async () => {
      const rightsId = 'rights_contractor_arch_001';
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_rights', rightsId), {
          rightsId,
          tenantId: 'contractor_uid_1',
          owner: { type: 'contractor', id: 'contractor_uid_1' },
          subject: { type: 'contractor_archive', id: 'arch_001' },
          source: { type: 'contractor_archive', id: 'arch_001', tenantId: 'contractor_uid_1' },
          purposes: createDefaultContractorArchivePurposes(true),
          restrictions: [],
          status: 'active',
          schemaVersion: 'v8.3.0',
          contentHash: 'hash_test_001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'data_rights', rightsId)));
    });

    it('denies unauthenticated read to archive rights history in /data_rights_history/{id}', async () => {
      const historyId = 'hist_contractor_arch_001';
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_rights_history', historyId), {
          historyId,
          rightsId: 'rights_contractor_arch_001',
          tenantId: 'contractor_uid_1',
          action: 'create',
          snapshot: { status: 'active' },
          timestamp: new Date().toISOString(),
          actor: 'system',
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'data_rights_history', historyId)));
    });
  });

  // ---------------------------------------------------------------------------
  // 2. UNRELATED TENANT & CROSS-UID OWNER DEFENSE
  // ---------------------------------------------------------------------------
  describe('Security Vector 2: Multi-Tenant Isolation & Cross-UID Owner Bypass Defense', () => {
    it('denies unrelated tenant read to contractor archive rights', async () => {
      const rightsId = 'rights_contractor_tenant_A';
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_rights', rightsId), {
          rightsId,
          tenantId: 'tenant_contractor_A',
          owner: { type: 'contractor', id: 'tenant_contractor_A' },
          subject: { type: 'contractor_archive', id: 'arch_A_001' },
          source: { type: 'contractor_archive', id: 'arch_A_001', tenantId: 'tenant_contractor_A' },
          purposes: createDefaultContractorArchivePurposes(true),
          restrictions: [],
          status: 'active',
          schemaVersion: 'v8.3.0',
          contentHash: 'hash_A',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        });
      });

      const tenantBContext = testEnv.authenticatedContext('tenant_contractor_B');
      await assertFails(getDoc(doc(tenantBContext.firestore(), 'data_rights', rightsId)));
    });

    it('denies cross-UID owner bypass (owner listed on record cannot bypass tenant isolation)', async () => {
      const rightsId = 'rights_cross_uid_001';
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_rights', rightsId), {
          rightsId,
          tenantId: 'tenant_contractor_A',
          // Owner is listed as user_malicious, but tenantId is tenant_contractor_A
          owner: { type: 'contractor', id: 'user_malicious' },
          subject: { type: 'contractor_archive', id: 'arch_001' },
          source: { type: 'contractor_archive', id: 'arch_001', tenantId: 'tenant_contractor_A' },
          purposes: createDefaultContractorArchivePurposes(true),
          restrictions: [],
          status: 'active',
          schemaVersion: 'v8.3.0',
          contentHash: 'hash_cross',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        });
      });

      // User user_malicious attempts to read using owner identity
      const maliciousContext = testEnv.authenticatedContext('user_malicious');
      await assertFails(getDoc(doc(maliciousContext.firestore(), 'data_rights', rightsId)));
    });
  });

  // ---------------------------------------------------------------------------
  // 3. AUTHORIZED SAME-TENANT & ADMIN ACCESS
  // ---------------------------------------------------------------------------
  describe('Security Vector 3: Authorized Access & Admin Policy', () => {
    it('permits authorized same-tenant read to contractor archive rights', async () => {
      const rightsId = 'rights_legit_same_tenant';
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_rights', rightsId), {
          rightsId,
          tenantId: 'contractor_valid_uid',
          owner: { type: 'contractor', id: 'contractor_valid_uid' },
          subject: { type: 'contractor_archive', id: 'arch_legit_001' },
          source: { type: 'contractor_archive', id: 'arch_legit_001', tenantId: 'contractor_valid_uid' },
          purposes: createDefaultContractorArchivePurposes(true),
          restrictions: [],
          status: 'active',
          schemaVersion: 'v8.3.0',
          contentHash: 'hash_legit',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        });
      });

      const sameTenantContext = testEnv.authenticatedContext('contractor_valid_uid');
      await assertSucceeds(getDoc(doc(sameTenantContext.firestore(), 'data_rights', rightsId)));
    });

    it('permits administrator read to contractor archive rights', async () => {
      const rightsId = 'rights_admin_check_001';
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_rights', rightsId), {
          rightsId,
          tenantId: 'contractor_tenant_alpha',
          owner: { type: 'contractor', id: 'contractor_tenant_alpha' },
          subject: { type: 'contractor_archive', id: 'arch_alpha_001' },
          source: { type: 'contractor_archive', id: 'arch_alpha_001', tenantId: 'contractor_tenant_alpha' },
          purposes: createDefaultContractorArchivePurposes(true),
          restrictions: [],
          status: 'active',
          schemaVersion: 'v8.3.0',
          contentHash: 'hash_alpha',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        });
      });

      const adminContext = testEnv.authenticatedContext('admin_user_uid', { admin: true });
      await assertSucceeds(getDoc(doc(adminContext.firestore(), 'data_rights', rightsId)));
    });
  });

  // ---------------------------------------------------------------------------
  // 4. CLIENT MUTATION DEFENSE (CREATE, UPDATE, DELETE STRICTLY DENIED)
  // ---------------------------------------------------------------------------
  describe('Security Vector 4: Client Mutation Defense (Fail-Closed)', () => {
    it('denies client create operation to /data_rights/{id}', async () => {
      const clientContext = testEnv.authenticatedContext('contractor_hacker');
      await assertFails(
        setDoc(doc(clientContext.firestore(), 'data_rights', 'rights_client_injected'), {
          rightsId: 'rights_client_injected',
          tenantId: 'contractor_hacker',
          owner: { type: 'contractor', id: 'contractor_hacker' },
          subject: { type: 'contractor_archive', id: 'arch_injected' },
          source: { type: 'contractor_archive', id: 'arch_injected', tenantId: 'contractor_hacker' },
          purposes: { commercial_licensing: 'allowed' },
          restrictions: [],
          status: 'active',
        })
      );
    });

    it('denies client update operation to /data_rights/{id}', async () => {
      const rightsId = 'rights_attempt_client_update';
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_rights', rightsId), {
          rightsId,
          tenantId: 'contractor_hacker',
          owner: { type: 'contractor', id: 'contractor_hacker' },
          subject: { type: 'contractor_archive', id: 'arch_001' },
          source: { type: 'contractor_archive', id: 'arch_001', tenantId: 'contractor_hacker' },
          purposes: createDefaultContractorArchivePurposes(true),
          restrictions: [],
          status: 'active',
        });
      });

      const clientContext = testEnv.authenticatedContext('contractor_hacker');
      await assertFails(
        updateDoc(doc(clientContext.firestore(), 'data_rights', rightsId), {
          'purposes.external_ai_training': 'allowed',
        })
      );
    });

    it('denies client delete operation to /data_rights/{id}', async () => {
      const rightsId = 'rights_attempt_client_delete';
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'data_rights', rightsId), {
          rightsId,
          tenantId: 'contractor_hacker',
          owner: { type: 'contractor', id: 'contractor_hacker' },
          subject: { type: 'contractor_archive', id: 'arch_001' },
          source: { type: 'contractor_archive', id: 'arch_001', tenantId: 'contractor_hacker' },
          purposes: createDefaultContractorArchivePurposes(true),
          restrictions: [],
          status: 'active',
        });
      });

      const clientContext = testEnv.authenticatedContext('contractor_hacker');
      await assertFails(deleteDoc(doc(clientContext.firestore(), 'data_rights', rightsId)));
    });

    it('denies client tenant substitution on /data_rights/{id}', async () => {
      const clientContext = testEnv.authenticatedContext('contractor_tenant_A');
      await assertFails(
        setDoc(doc(clientContext.firestore(), 'data_rights', 'rights_subst'), {
          rightsId: 'rights_subst',
          tenantId: 'victim_tenant_B', // Spoofed tenant
          owner: { type: 'contractor', id: 'contractor_tenant_A' },
          subject: { type: 'contractor_archive', id: 'arch_subst' },
          source: { type: 'contractor_archive', id: 'arch_subst', tenantId: 'victim_tenant_B' },
          purposes: createDefaultContractorArchivePurposes(true),
          restrictions: [],
          status: 'active',
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 5. CROSS-TENANT PROVENANCE & EVIDENCE DEFENSE
  // ---------------------------------------------------------------------------
  describe('Security Vector 5: Cross-Tenant Provenance & Evidence Defense', () => {
    it('rejects cross-tenant provenance edge creation in ProvenanceGraphService', async () => {
      let provService: ProvenanceGraphService;
      await testEnv.withSecurityRulesDisabled(async (context) => {
        provService = new ProvenanceGraphService(context.firestore());
        // Create node in tenant A
        await provService.createNode({
          tenantId: 'tenant_contractor_A',
          nodeType: 'source',
          sourceType: 'contractor_archive',
          sourceId: 'arch_cross_node_1',
        });
        // Create node in tenant B
        await provService.createNode({
          tenantId: 'tenant_contractor_B',
          nodeType: 'source',
          sourceType: 'contractor_archive',
          sourceId: 'arch_cross_node_2',
        });

        // Attempt cross-tenant edge (node from tenant A to node in tenant B)
        const nodeAId = provService.computeNodeId(
          'tenant_contractor_A',
          'source',
          'contractor_archive',
          'arch_cross_node_1'
        );
        const nodeBId = provService.computeNodeId(
          'tenant_contractor_B',
          'source',
          'contractor_archive',
          'arch_cross_node_2'
        );

        await expect(
          provService.createEdge({
            tenantId: 'tenant_contractor_A',
            fromNodeId: nodeAId,
            toNodeId: nodeBId,
            relationType: 'DERIVED_FROM',
          })
        ).rejects.toThrow();
      });
    });

    it('rejects cross-tenant rights reference in provenance node creation', async () => {
      let provService: ProvenanceGraphService;
      let rightsService: DataRightsService;
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        provService = new ProvenanceGraphService(db);
        rightsService = new DataRightsService(db);

        // Create rights in tenant B
        const rightsRecordB = await rightsService.createDataRightsRecord({
          tenantId: 'tenant_contractor_B',
          owner: { type: 'contractor', id: 'tenant_contractor_B' },
          subject: { type: 'contractor_archive', id: 'arch_B' },
          source: { type: 'contractor_archive', id: 'arch_B', tenantId: 'tenant_contractor_B' },
          purposes: createDefaultContractorArchivePurposes(true),
          restrictions: [],
          provenance: {
            sourceType: 'contractor_archive',
            sourceId: 'arch_B',
            tenantId: 'tenant_contractor_B',
            recordedBy: 'test',
          },
        });

        // Attempt to create provenance node in tenant A referencing rights in tenant B
        await expect(
          provService.createNode({
            tenantId: 'tenant_contractor_A',
            nodeType: 'source',
            sourceType: 'contractor_archive',
            sourceId: 'arch_A_spoofed',
            rightsReference: {
              rightsId: rightsRecordB.rightsId,
              tenantId: 'tenant_contractor_B', // Mismatched tenant
              status: 'active',
            },
          })
        ).rejects.toThrow();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 6. PURPOSE DECISION BOUNDARY & UNKNOWN != ALLOWED
  // ---------------------------------------------------------------------------
  describe('Security Vector 6: Authoritative Purpose Decision Boundary', () => {
    let archiveService: ContractorArchiveRightsService;

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        archiveService = new ContractorArchiveRightsService(db);
      });
    });

    it('allows internal AI when explicitly allowed', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_001',
        contractorUid: 'contractor_purp_001',
        archiveReference: 'archive_ai_ok',
        allowInternalAi: true,
      });

      const res = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_001',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      expect(res.eligible).toBe(true);
      expect(res.reason).toBe('allowed');
    });

    it('denies internal AI when explicitly denied', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_002',
        contractorUid: 'contractor_purp_002',
        archiveReference: 'archive_no_ai',
        allowInternalAi: false,
      });

      const res = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_002',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      expect(res.eligible).toBe(false);
      expect(['denied', 'blocked_by_restriction']).toContain(res.reason);
    });

    it('denies internal AI when permission is unknown', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_003',
        contractorUid: 'contractor_purp_003',
        archiveReference: 'archive_unknown_ai',
        purposes: { internal_ai_use: 'unknown' },
      });

      const res = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_003',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('unknown');
    });

    it('denies external AI training when denied', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_004',
        contractorUid: 'contractor_purp_004',
        archiveReference: 'archive_ext_denied',
        purposes: { external_ai_training: 'denied' },
      });

      const res = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_004',
        archiveId: reg.archiveId,
        purpose: 'external_ai_training',
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('denied');
    });

    it('denies external AI training when unknown (unknown != allowed)', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_005',
        contractorUid: 'contractor_purp_005',
        archiveReference: 'archive_ext_unknown',
      });

      const res = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_005',
        archiveId: reg.archiveId,
        purpose: 'external_ai_training',
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('unknown');
    });

    it('denies commercial licensing when denied', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_006',
        contractorUid: 'contractor_purp_006',
        archiveReference: 'archive_comm_denied',
        purposes: { commercial_licensing: 'denied' },
      });

      const res = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_006',
        archiveId: reg.archiveId,
        purpose: 'commercial_licensing',
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('denied');
    });

    it('denies commercial licensing when unknown', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_007',
        contractorUid: 'contractor_purp_007',
        archiveReference: 'archive_comm_unknown',
      });

      const res = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_007',
        archiveId: reg.archiveId,
        purpose: 'commercial_licensing',
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('unknown');
    });

    it('denies third-party sharing when unknown', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_008',
        contractorUid: 'contractor_purp_008',
        archiveReference: 'archive_tp_unknown',
      });

      const res = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_008',
        archiveId: reg.archiveId,
        purpose: 'third_party_sharing',
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('unknown');
    });

    it('denies export when unknown', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_009',
        contractorUid: 'contractor_purp_009',
        archiveReference: 'archive_exp_unknown',
      });

      const res = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_009',
        archiveId: reg.archiveId,
        purpose: 'export',
      });
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe('unknown');
    });

    it('verifies that internal AI permission does not grant external AI training', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_010',
        contractorUid: 'contractor_purp_010',
        archiveReference: 'archive_ai_isolation',
        allowInternalAi: true,
      });

      const internalEval = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_010',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      const externalEval = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_010',
        archiveId: reg.archiveId,
        purpose: 'external_ai_training',
      });

      expect(internalEval.eligible).toBe(true);
      expect(externalEval.eligible).toBe(false);
    });

    it('verifies that internal AI permission does not grant commercial licensing', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_011',
        contractorUid: 'contractor_purp_011',
        archiveReference: 'archive_comm_isolation',
        allowInternalAi: true,
      });

      const internalEval = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_011',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      const commercialEval = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_011',
        archiveId: reg.archiveId,
        purpose: 'commercial_licensing',
      });

      expect(internalEval.eligible).toBe(true);
      expect(commercialEval.eligible).toBe(false);
    });

    it('verifies that archive upload/ownership does not grant commercial rights', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_012',
        contractorUid: 'contractor_purp_012',
        archiveReference: 'contractor_owned_photos_2026',
        title: 'Complete Bathroom Refits 2026',
      });

      // Contractor is registered as owner in rights record
      expect(reg.rightsRecord.owner.id).toBe('contractor_purp_012');

      // However, commercial licensing must NOT be granted
      const commEval = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_012',
        archiveId: reg.archiveId,
        purpose: 'commercial_licensing',
      });
      expect(commEval.eligible).toBe(false);
      expect(commEval.reason).toBe('unknown');
    });

    it('mixed-origin archive with unknown embedded rights remains externally blocked', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_013',
        contractorUid: 'contractor_purp_013',
        archiveReference: 'mixed_origin_portfolio',
        components: [
          {
            componentKey: 'customer_house_facade',
            originType: 'customer_or_subject_data',
            category: 'photograph',
          },
          {
            componentKey: 'supplier_specification_sheet',
            originType: 'third_party_data',
            category: 'report',
          },
        ],
      });

      const customerCompId = computeArchiveComponentId(
        'contractor_purp_013',
        reg.archiveId,
        'customer_house_facade'
      );
      const supplierCompId = computeArchiveComponentId(
        'contractor_purp_013',
        reg.archiveId,
        'supplier_specification_sheet'
      );

      // Customer facade externally blocked
      const customerEval = await archiveService.evaluateComponentEligibility({
        tenantId: 'contractor_purp_013',
        archiveId: reg.archiveId,
        componentId: customerCompId,
        purpose: 'external_ai_training',
        originType: 'customer_or_subject_data',
      });
      expect(customerEval.eligible).toBe(false);
      expect(customerEval.reason).toBe('blocked_by_origin');

      // Supplier doc externally blocked
      const supplierEval = await archiveService.evaluateComponentEligibility({
        tenantId: 'contractor_purp_013',
        archiveId: reg.archiveId,
        componentId: supplierCompId,
        purpose: 'commercial_licensing',
        originType: 'third_party_data',
      });
      expect(supplierEval.eligible).toBe(false);
      expect(supplierEval.reason).toBe('blocked_by_origin');
    });

    it('revoked rights block future use across all purposes', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_purp_014',
        contractorUid: 'contractor_purp_014',
        archiveReference: 'archive_will_revoke',
        allowInternalAi: true,
      });

      // Revoke
      await archiveService.revokeArchiveRights(
        'contractor_purp_014',
        reg.archiveId,
        'Contractor requested archive retraction'
      );

      // Internal AI check should now be blocked by status
      const internalCheck = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_014',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      expect(internalCheck.eligible).toBe(false);
      expect(internalCheck.reason).toBe('blocked_by_status');

      // Platform operation check should now be blocked by status
      const opCheck = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_purp_014',
        archiveId: reg.archiveId,
        purpose: 'internal_platform_operation',
      });
      expect(opCheck.eligible).toBe(false);
      expect(opCheck.reason).toBe('blocked_by_status');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. PRODUCTION PATH VERIFICATION
  // ---------------------------------------------------------------------------
  describe('Security Vector 7: Production Path Integration Verification', () => {
    it('exercises complete production path: tenant context -> archive ID -> rights eval -> external block -> internal AI -> server persistence -> history -> provenance', async () => {
      let prodArchiveService: ContractorArchiveRightsService;
      let emulatorDb: any;

      await testEnv.withSecurityRulesDisabled(async (context) => {
        emulatorDb = context.firestore();
        prodArchiveService = new ContractorArchiveRightsService(emulatorDb);

        // 1. Establish tenant context
        const tenantId = 'contractor_prod_uid_99';
        const contractorUid = 'contractor_prod_uid_99';
        const archiveReference = 'prod_roofing_portfolio_2026';

        // 2. Register contractor archive through server-authoritative boundary
        const outcome = await prodArchiveService.registerArchiveRights({
          tenantId,
          contractorUid,
          archiveReference,
          title: 'Roofing Project Records 2026',
          description: 'Historical tile replacements and guttering jobs',
          allowInternalAi: true,
          components: [
            {
              componentKey: 'roof_tile_photo_1',
              originType: 'contractor_owned',
              category: 'photograph',
              description: 'Completed slate roof repair',
            },
            {
              componentKey: 'customer_invoice_signed',
              originType: 'customer_or_subject_data',
              category: 'invoice',
              description: 'Signed customer invoice copy',
            },
          ],
          linkProvenance: true,
          recordedBy: 'system_production_path',
        });

        // 3. Validate archive identity
        expect(outcome.archiveId).toBe(computeContractorArchiveId(tenantId, archiveReference));
        expect(outcome.rightsRecord.subject.id).toBe(outcome.archiveId);

        // 4. Validate server persistence in live Firestore emulator
        const storedRightsDoc = await emulatorDb.collection('data_rights').doc(outcome.rightsRecord.rightsId).get();
        expect(storedRightsDoc.exists).toBe(true);
        expect(storedRightsDoc.data()?.tenantId).toBe(tenantId);
        expect(storedRightsDoc.data()?.status).toBe('active');

        // 5. Validate historical rights persistence in live Firestore emulator (/data_rights_history)
        const historySnap = await emulatorDb
          .collection('data_rights_history')
          .where('tenantId', '==', tenantId)
          .get();
        expect(historySnap.docs.length).toBeGreaterThan(0);

        // 6. Validate integration with Task 28 Provenance Graph (/provenance_nodes)
        const provNodeDoc = await emulatorDb
          .collection('provenance_nodes')
          .doc(outcome.provenanceNode?.nodeId)
          .get();
        expect(provNodeDoc.exists).toBe(true);
        expect(provNodeDoc.data()?.tenantId).toBe(tenantId);
        expect(provNodeDoc.data()?.sourceType).toBe('contractor_archive');

        // 7. Evaluate authoritative rights: blocks unauthorized external use
        const evalExternal = await prodArchiveService.evaluateArchiveEligibility({
          tenantId,
          archiveId: outcome.archiveId,
          purpose: 'external_ai_training',
        });
        expect(evalExternal.eligible).toBe(false);
        expect(evalExternal.reason).toBe('unknown');

        const evalCommercial = await prodArchiveService.evaluateArchiveEligibility({
          tenantId,
          archiveId: outcome.archiveId,
          purpose: 'commercial_licensing',
        });
        expect(evalCommercial.eligible).toBe(false);
        expect(evalCommercial.reason).toBe('unknown');

        // 8. Permits authorized internal AI use
        const evalInternalAi = await prodArchiveService.evaluateArchiveEligibility({
          tenantId,
          archiveId: outcome.archiveId,
          purpose: 'internal_ai_use',
        });
        expect(evalInternalAi.eligible).toBe(true);
        expect(evalInternalAi.reason).toBe('allowed');

        // 9. Mixed-origin customer invoice component is blocked from external AI/licensing
        const invoiceCompId = computeArchiveComponentId(
          tenantId,
          outcome.archiveId,
          'customer_invoice_signed'
        );
        const evalCompExternal = await prodArchiveService.evaluateComponentEligibility({
          tenantId,
          archiveId: outcome.archiveId,
          componentId: invoiceCompId,
          purpose: 'external_ai_training',
          originType: 'customer_or_subject_data',
        });
        expect(evalCompExternal.eligible).toBe(false);
        expect(evalCompExternal.reason).toBe('blocked_by_origin');
      });
    });
  });
});
