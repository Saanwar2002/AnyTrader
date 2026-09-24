/**
 * AnyTrader V8.3 — Task 31 AI Training & Usage Controls Real Firebase Emulator Security Suite
 * 
 * CANONICAL TENANT MODEL ARCHITECTURAL INVARIANT:
 * - Strict UID-as-tenant (tenantId === request.auth.uid).
 * - Server-authoritative AI Training & Usage Controls decision engine.
 * - Client writes are strictly denied across /ai_usage_controls, /ai_usage_controls_history, /ai_usage_decisions.
 * - EXPLICIT PURPOSE ISOLATION: internal_ai_use != external_ai_training.
 * - External AI training strictly requires explicit opt_in trainingConsent status.
 * - Unknown or unconsented data fails closed (unknown != allowed).
 * - Provenance binding is mandatory and tenant-partitioned.
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
  AiTrainingUsageControlsService,
  computeAiControlId,
  computeAiControlContentHash,
  computeAiDecisionHash,
  AiUsageControlsSecurityError,
  AiUsageControlsValidationError,
} from '../../src/server/intelligence/aiTrainingUsageControls';
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

describe('V8.3 Task 31 — Firebase Emulator AI Training & Usage Controls Suite', () => {
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
      console.error('FATAL ERROR: Failed to initialize Firebase emulator test environment for Task 31!', err);
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
    it('generates deterministic controlId', () => {
      const id1 = computeAiControlId('tenant_A', 'property_doc', 'doc_100');
      const id2 = computeAiControlId('tenant_A', 'property_doc', 'doc_100');
      expect(id1).toBe(id2);
      expect(id1.startsWith('aicontrol_')).toBe(true);
    });

    it('computes deterministic SHA-256 contentHash over AI control fields', () => {
      const record = {
        controlId: 'aicontrol_123',
        tenantId: 'tenant_A',
        recordType: 'inspection',
        recordId: 'insp_1',
        scope: 'canonical_record' as const,
        purposes: {
          internal_ai_use: 'allowed' as const,
          external_ai_training: 'denied' as const,
          third_party_sharing: 'denied' as const,
          commercial_licensing: 'denied' as const,
          export: 'denied' as const,
        },
        trainingConsent: 'opt_out' as const,
        modelTiersAllowed: ['internal_gemini_flash'],
        restrictions: [],
        version: 1,
        provenanceRef: {
          tenantId: 'tenant_A',
          sourceType: 'system',
          sourceId: 'sys_1',
        },
        status: 'active' as const,
      };

      const hash1 = computeAiControlContentHash(record);
      const hash2 = computeAiControlContentHash(record);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe('Vector 2: Firestore Security Rules Enforcement', () => {
    it('denies unauthenticated client reads on /ai_usage_controls', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      const ref = doc(unauthDb, 'ai_usage_controls', 'aicontrol_123');
      await assertFails(getDoc(ref));
    });

    it('denies cross-tenant client reads on /ai_usage_controls', async () => {
      const adminDb = testEnv.authenticatedContext('admin_uid', { isAdmin: true }).firestore();
      await setDoc(doc(adminDb, 'ai_usage_controls', 'aicontrol_secret'), {
        controlId: 'aicontrol_secret',
        tenantId: 'tenant_owner',
        recordType: 'report',
        recordId: 'rep_1',
      });

      const intruderDb = testEnv.authenticatedContext('tenant_intruder').firestore();
      const ref = doc(intruderDb, 'ai_usage_controls', 'aicontrol_secret');
      await assertFails(getDoc(ref));
    });

    it('allows owner tenant reads on /ai_usage_controls', async () => {
      const adminDb = testEnv.authenticatedContext('admin_uid', { isAdmin: true }).firestore();
      await setDoc(doc(adminDb, 'ai_usage_controls', 'aicontrol_mydata'), {
        controlId: 'aicontrol_mydata',
        tenantId: 'tenant_owner',
        recordType: 'report',
        recordId: 'rep_1',
      });

      const ownerDb = testEnv.authenticatedContext('tenant_owner').firestore();
      const ref = doc(ownerDb, 'ai_usage_controls', 'aicontrol_mydata');
      await assertSucceeds(getDoc(ref));
    });

    it('denies all client writes on /ai_usage_controls', async () => {
      const ownerDb = testEnv.authenticatedContext('tenant_owner').firestore();
      const ref = doc(ownerDb, 'ai_usage_controls', 'aicontrol_test');

      await assertFails(setDoc(ref, {
        controlId: 'aicontrol_test',
        tenantId: 'tenant_owner',
      }));

      await assertFails(updateDoc(ref, { status: 'revoked' }));
      await assertFails(deleteDoc(ref));
    });

    it('denies all client writes on /ai_usage_controls_history and /ai_usage_decisions', async () => {
      const ownerDb = testEnv.authenticatedContext('tenant_owner').firestore();
      const histRef = doc(ownerDb, 'ai_usage_controls_history', 'hist_1');
      const decRef = doc(ownerDb, 'ai_usage_decisions', 'dec_1');

      await assertFails(setDoc(histRef, { historyId: 'hist_1', tenantId: 'tenant_owner' }));
      await assertFails(setDoc(decRef, { decisionId: 'dec_1', tenantId: 'tenant_owner' }));
    });
  });

  describe('Vector 3: Server-Authoritative Engine & Explicit Purpose Isolation', () => {
    it('allows internal_ai_use while denying external_ai_training when opt_out', async () => {
      const db = testEnv.authenticatedContext('test_runner', { isAdmin: true }).firestore();
      const rightsService = new DataRightsService(db as any);
      const provenanceService = new ProvenanceGraphService(db as any);
      const archiveService = new ContractorArchiveRightsService(db as any, rightsService, provenanceService);
      const classificationService = new DataClassificationEligibilityService(db as any, rightsService, provenanceService, archiveService);

      const aiService = new AiTrainingUsageControlsService(
        db as any,
        rightsService,
        provenanceService,
        archiveService,
        classificationService
      );

      // Register control with internal_ai_use: allowed, external_ai_training: unknown, trainingConsent: opt_out
      const control = await aiService.registerAiUsageControls({
        tenantId: 'tenant_A',
        recordType: 'property_passport',
        recordId: 'pass_100',
        purposes: {
          internal_ai_use: 'allowed',
          external_ai_training: 'unknown',
        },
        trainingConsent: 'opt_out',
        provenanceRef: {
          tenantId: 'tenant_A',
          sourceType: 'user_action',
          sourceId: 'act_100',
        },
      });

      expect(control.controlId.startsWith('aicontrol_')).toBe(true);
      expect(control.trainingConsent).toBe('opt_out');

      // 1. Evaluate internal_ai_use -> ALLOWED
      const internalEval = await aiService.evaluateAiUsageEligibility({
        tenantId: 'tenant_A',
        recordType: 'property_passport',
        recordId: 'pass_100',
        requestedPurpose: 'internal_ai_use',
      });

      expect(internalEval.allowed).toBe(true);
      expect(internalEval.outcome).toBe('allowed');

      // 2. Evaluate external_ai_training -> BLOCKED BY CONSENT (internal_ai_use != external_ai_training)
      const externalEval = await aiService.evaluateAiUsageEligibility({
        tenantId: 'tenant_A',
        recordType: 'property_passport',
        recordId: 'pass_100',
        requestedPurpose: 'external_ai_training',
      });

      expect(externalEval.allowed).toBe(false);
      expect(externalEval.outcome).toBe('blocked_by_consent');
    });

    it('allows external_ai_training when explicitly opt_in and purpose allowed', async () => {
      const db = testEnv.authenticatedContext('test_runner', { isAdmin: true }).firestore();
      const rightsService = new DataRightsService(db as any);
      const provenanceService = new ProvenanceGraphService(db as any);
      const archiveService = new ContractorArchiveRightsService(db as any, rightsService, provenanceService);
      const classificationService = new DataClassificationEligibilityService(db as any, rightsService, provenanceService, archiveService);

      const aiService = new AiTrainingUsageControlsService(
        db as any,
        rightsService,
        provenanceService,
        archiveService,
        classificationService
      );

      await aiService.registerAiUsageControls({
        tenantId: 'tenant_A',
        recordType: 'property_passport',
        recordId: 'pass_200',
        purposes: {
          internal_ai_use: 'allowed',
          external_ai_training: 'allowed',
        },
        trainingConsent: 'opt_in',
        provenanceRef: {
          tenantId: 'tenant_A',
          sourceType: 'user_action',
          sourceId: 'act_200',
        },
      });

      const externalEval = await aiService.evaluateAiUsageEligibility({
        tenantId: 'tenant_A',
        recordType: 'property_passport',
        recordId: 'pass_200',
        requestedPurpose: 'external_ai_training',
      });

      expect(externalEval.allowed).toBe(true);
      expect(externalEval.outcome).toBe('allowed');
      expect(externalEval.trainingConsent).toBe('opt_in');
    });

    it('blocks all purposes upon policy revocation', async () => {
      const db = testEnv.authenticatedContext('test_runner', { isAdmin: true }).firestore();
      const rightsService = new DataRightsService(db as any);
      const provenanceService = new ProvenanceGraphService(db as any);
      const archiveService = new ContractorArchiveRightsService(db as any, rightsService, provenanceService);
      const classificationService = new DataClassificationEligibilityService(db as any, rightsService, provenanceService, archiveService);

      const aiService = new AiTrainingUsageControlsService(
        db as any,
        rightsService,
        provenanceService,
        archiveService,
        classificationService
      );

      const control = await aiService.registerAiUsageControls({
        tenantId: 'tenant_A',
        recordType: 'buyer_intelligence',
        recordId: 'buyer_300',
        purposes: {
          internal_ai_use: 'allowed',
        },
        trainingConsent: 'opt_in',
        provenanceRef: {
          tenantId: 'tenant_A',
          sourceType: 'user_action',
          sourceId: 'act_300',
        },
      });

      // Revoke policy
      await aiService.revokeAiUsageControls('tenant_A', control.controlId, 'User requested complete opt-out');

      // Evaluate internal_ai_use after revocation -> BLOCKED
      const internalEval = await aiService.evaluateAiUsageEligibility({
        tenantId: 'tenant_A',
        recordType: 'buyer_intelligence',
        recordId: 'buyer_300',
        requestedPurpose: 'internal_ai_use',
      });

      expect(internalEval.allowed).toBe(false);
      expect(internalEval.outcome).toBe('blocked_by_status');
    });
  });
});
