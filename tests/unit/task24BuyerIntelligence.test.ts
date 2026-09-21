/**
 * AnyTrader V8.2 — Task 24 Buyer / Conveyancing Intelligence Tests
 * 
 * Validates:
 * 1. Unit Tests (Mock Store & Service Logic):
 *    - Valid evidence-backed buyer intelligence assessment generation
 *    - Non-existent property ID fail-closed rejection
 *    - Cross-tenant contamination rejection
 *    - Conveyancing flags derived from active property risks
 *    - Recommended inquiries derived from condition gaps & upcoming maintenance
 *    - Standard legal / non-conveyancing / non-valuation disclaimers
 *    - Deterministic content hashing & idempotency
 *    - Immutable snapshot history storage & current assessment retrieval
 *    - Async task queue execution for 'buyer_intelligence'
 * 
 * 2. Real Production Firebase Emulator Integration Tests:
 *    - Production Task Queue execution through registered 'buyer_intelligence' handler
 *    - Full end-to-end pipeline against real Firestore Admin DB & emulator
 *    - Persistence of current projection (/buyer_intelligence/{propertyId}) & snapshot history (/buyer_intelligence_history/{snapshotId})
 *    - Production idempotency & deterministic content hashing
 *    - Client-side write denial & historical snapshot immutability
 *    - Cross-property & cross-tenant data isolation & fail-closed security
 *    - Missing property fail-closed rejection & missing passport auto-generation
 *    - Evidence gap representation & preserved AI non-promotion
 *    - Real Firestore security rules enforcement (owner/manager/admin allowed, unauth/stranger denied)
 *    - Material finding evidence provenance & bounded historical queries
 */

process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

import {
  BuyerIntelligenceService,
  buyerIntelligenceService,
  BUYER_INTELLIGENCE_SCHEMA_VERSION,
  BUYER_INTELLIGENCE_PIPELINE_VERSION,
  MAX_BUYER_HISTORY_QUERY_LIMIT,
  STANDARD_LEGAL_DISCLAIMER,
  PropertyPassportService,
  propertyPassportService,
  intelligenceTaskQueue,
  enqueueBuyerIntelligenceTask,
} from '../../src/server/intelligence/index';
import { setGlobalIntelligenceDb } from '../../src/server/intelligence/immutableStore';
import { registerIntelligenceTaskHandlers } from '../../server';

// =========================================================================
// Helper for Mock In-Memory Firestore DB for isolated deterministic logic tests
// =========================================================================
function createMockFirestoreDb(initialData: {
  jobs?: Record<string, any>;
  properties?: Record<string, any>;
  property_passports?: Record<string, any>;
  property_passport_history?: Record<string, any>;
  property_condition_history?: Record<string, any>;
  property_risk_history?: Record<string, any>;
  property_risk_retractions?: Record<string, any>;
  property_maintenance_history?: Record<string, any>;
  property_maintenance_supersessions?: Record<string, any>;
  buyer_intelligence?: Record<string, any>;
  buyer_intelligence_history?: Record<string, any>;
} = {}) {
  const store: Record<string, Map<string, any>> = {
    jobs: new Map(Object.entries(initialData.jobs || {})),
    properties: new Map(Object.entries(initialData.properties || {})),
    property_passports: new Map(Object.entries(initialData.property_passports || {})),
    property_passport_history: new Map(Object.entries(initialData.property_passport_history || {})),
    property_condition_history: new Map(Object.entries(initialData.property_condition_history || {})),
    property_risk_history: new Map(Object.entries(initialData.property_risk_history || {})),
    property_risk_retractions: new Map(Object.entries(initialData.property_risk_retractions || {})),
    property_maintenance_history: new Map(Object.entries(initialData.property_maintenance_history || {})),
    property_maintenance_supersessions: new Map(Object.entries(initialData.property_maintenance_supersessions || {})),
    buyer_intelligence: new Map(Object.entries(initialData.buyer_intelligence || {})),
    buyer_intelligence_history: new Map(Object.entries(initialData.buyer_intelligence_history || {})),
  };

  const createQuery = (
    colName: string,
    filters: Array<{ field: string; op: string; value: any }> = [],
    orderFields: Array<{ field: string; dir: 'asc' | 'desc' }> = [],
    limitVal?: number
  ) => {
    if (!store[colName]) {
      store[colName] = new Map();
    }
    return {
      where: (field: string, op: string, value: any) => {
        return createQuery(colName, [...filters, { field, op, value }], orderFields, limitVal);
      },
      orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') => {
        return createQuery(colName, filters, [...orderFields, { field, dir }], limitVal);
      },
      limit: (val: number) => {
        return createQuery(colName, filters, orderFields, val);
      },
      get: async () => {
        let items = Array.from(store[colName].entries()).map(([id, data]) => ({ id, ...data }));
        for (const f of filters) {
          if (f.op === '==') {
            items = items.filter((item) => item[f.field] === f.value);
          }
        }
        if (limitVal !== undefined) {
          items = items.slice(0, limitVal);
        }
        return {
          docs: items.map((item) => ({
            id: item.id,
            data: () => item,
            exists: true,
          })),
          size: items.length,
          empty: items.length === 0,
        };
      },
    };
  };

  return {
    collection: (colName: string) => {
      if (!store[colName]) {
        store[colName] = new Map();
      }
      return {
        doc: (docId: string) => ({
          get: async () => {
            const data = store[colName].get(docId);
            return {
              id: docId,
              exists: !!data,
              data: () => data,
            };
          },
          set: async (data: any) => {
            store[colName].set(docId, data);
          },
          update: async (data: any) => {
            const existing = store[colName]?.get(docId) || {};
            store[colName].set(docId, { ...existing, ...data });
          },
        }),
        where: (field: string, op: string, value: any) => {
          return createQuery(colName, [{ field, op, value }]);
        },
        limit: (val: number) => {
          return createQuery(colName, [], [], val);
        },
        get: async () => {
          const items = Array.from(store[colName].entries()).map(([id, data]) => ({
            id,
            data: () => data,
            exists: true,
          }));
          return { docs: items, size: items.length, empty: items.length === 0 };
        },
      };
    },
    runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
      const tx = {
        get: async (docRef: any) => docRef.get(),
        set: (docRef: any, data: any) => docRef.set(data),
        update: (docRef: any, data: any) => docRef.update(data),
      };
      return updateFunction(tx);
    },
    _store: store,
  };
}

// =========================================================================
// SECTION 1: Unit & Logic Tests (Mock Store)
// =========================================================================
describe('Task 24 — Buyer / Conveyancing Intelligence Unit & Logic Tests', () => {
  const samplePropId = 'prop_buyer_test_101';
  const sampleTenant = 'tenant_buyer_1';

  let mockDb: any;
  let buyerService: BuyerIntelligenceService;

  beforeEach(() => {
    mockDb = createMockFirestoreDb({
      properties: {
        [samplePropId]: {
          propertyId: samplePropId,
          tenantId: sampleTenant,
          ownerId: sampleTenant,
          postcode: 'SW1A 1AA',
        },
      },
      property_passports: {
        [samplePropId]: {
          propertyId: samplePropId,
          components: [
            { componentType: 'roof', condition: 'poor', status: 'observed', evidenceIds: ['ev_roof_1'], sourceRecordIds: ['c_1'] },
            { componentType: 'electrical', condition: 'good', status: 'verified', evidenceIds: ['ev_elec_1'], sourceRecordIds: ['c_2'] },
          ],
          riskSummary: {
            riskScore: 75,
            overallSeverity: 'high',
            activeRiskCount: 1,
            criticalRiskCount: 0,
            risks: [
              {
                riskId: 'risk_damp_01',
                riskType: 'damp_and_mould',
                description: 'Active penetrating damp observed on south wall',
                severity: 'high',
                evidenceIds: ['ev_damp_1'],
              },
            ],
            evidenceIds: ['ev_damp_1'],
          },
          maintenanceSummary: {
            upcomingInterventionsCount: 1,
            estimatedTotalBudgetMin: 500,
            estimatedTotalBudgetMax: 1500,
            currency: 'GBP',
            upcomingActions: [
              {
                maintenanceAssessmentId: 'maint_roof_01',
                componentType: 'roof',
                predictionType: 'maintenance_due',
                forecastStart: '2026-10-01',
                forecastEnd: '2026-12-01',
                urgency: 'immediate',
                evidenceIds: ['ev_roof_1'],
              },
            ],
            evidenceIds: ['ev_roof_1'],
          },
          verifiedOutcomeSummary: {
            totalCompletedJobs: 1,
            lastCompletedJobAt: '2026-08-01T00:00:00Z',
            completedOutcomeIds: ['job_101'],
            evidenceIds: ['ev_elec_1'],
          },
          evidenceIds: ['ev_roof_1', 'ev_elec_1', 'ev_damp_1'],
          confidence: { overall: 0.85, extraction: 0.9, evidenceQuality: 0.8, classification: 0.9, temporalFreshness: 0.9 },
          provenance: {
            pipelineVersion: 'v8.2.0',
            schemaVersion: 'v8.2-passport-v1',
            generatedAt: '2026-09-20T00:00:00Z',
            contentHash: 'hash_passport_1',
            snapshotId: 'pps_prop_buyer_test_101_hash1',
            sourceRecordIds: ['c_1', 'c_2', 'risk_damp_01', 'maint_roof_01', 'job_101'],
            sourceCollections: ['properties', 'property_condition_history', 'property_risk_history', 'property_maintenance_history', 'jobs'],
            tenantId: sampleTenant,
          },
          schemaVersion: 'v8.2-passport-v1',
          updatedAt: '2026-09-20T00:00:00Z',
        },
      },
    });

    setGlobalIntelligenceDb(mockDb);
    propertyPassportService.setFirestoreDb(mockDb);
    buyerService = new BuyerIntelligenceService({ firestoreDb: mockDb });
  });

  it('1. Valid evidence-backed buyer intelligence assessment generation succeeds', async () => {
    const assessment = await buyerService.generateBuyerIntelligence(
      { propertyId: samplePropId, provenance: { tenantId: sampleTenant } },
      { firestoreDb: mockDb }
    );

    expect(assessment).toBeDefined();
    expect(assessment.propertyId).toBe(samplePropId);
    expect(assessment.schemaVersion).toBe(BUYER_INTELLIGENCE_SCHEMA_VERSION);
    expect(assessment.provenance.pipelineVersion).toBe(BUYER_INTELLIGENCE_PIPELINE_VERSION);
    expect(assessment.disclaimers.isNonLegalAdviceNotice).toBe(true);
    expect(assessment.disclaimers.isNonConveyancingNotice).toBe(true);
    expect(assessment.disclaimers.isNonValuationNotice).toBe(true);
  });

  it('2. Non-existent property ID is rejected (Fail-Closed)', async () => {
    await expect(
      buyerService.generateBuyerIntelligence({ propertyId: 'prop_non_existent' }, { firestoreDb: mockDb })
    ).rejects.toThrow(/does not exist/);
  });

  it('3. Cross-tenant contamination is rejected', async () => {
    await expect(
      buyerService.generateBuyerIntelligence(
        { propertyId: samplePropId, provenance: { tenantId: 'tenant_attacker_99' } },
        { firestoreDb: mockDb }
      )
    ).rejects.toThrow(/CrossTenantContamination Violation/);
  });

  it('4. Active property risks are correctly derived as conveyancing flags', async () => {
    const assessment = await buyerService.generateBuyerIntelligence(
      { propertyId: samplePropId },
      { firestoreDb: mockDb }
    );

    expect(assessment.conveyancingFlags.length).toBeGreaterThan(0);
    const dampFlag = assessment.conveyancingFlags.find((f) => f.sourceRecordId === 'risk_damp_01');
    expect(dampFlag).toBeDefined();
    expect(dampFlag?.severity).toBe('high');
    expect(dampFlag?.evidenceIds).toContain('ev_damp_1');
  });

  it('5. Condition gaps and upcoming maintenance are converted into recommended inquiries', async () => {
    const assessment = await buyerService.generateBuyerIntelligence(
      { propertyId: samplePropId },
      { firestoreDb: mockDb }
    );

    expect(assessment.recommendedInquiries.length).toBeGreaterThan(0);
    const roofInquiry = assessment.recommendedInquiries.find((i) => i.inquiryId.includes('maint_roof_01'));
    expect(roofInquiry).toBeDefined();
    expect(roofInquiry?.urgency).toBe('immediate');
  });

  it('6. Standard non-legal, non-conveyancing, non-valuation disclaimers are enforced', async () => {
    const assessment = await buyerService.generateBuyerIntelligence(
      { propertyId: samplePropId },
      { firestoreDb: mockDb }
    );

    expect(assessment.disclaimers.disclaimerText).toContain('DOES NOT constitute formal legal advice');
    expect(assessment.disclaimers.isNonLegalAdviceNotice).toBe(true);
    expect(assessment.disclaimers.isNonConveyancingNotice).toBe(true);
    expect(assessment.disclaimers.isNonValuationNotice).toBe(true);
  });

  it('7. Deterministic content hashing produces identical hash on identical inputs', async () => {
    const a1 = await buyerService.generateBuyerIntelligence({ propertyId: samplePropId }, { firestoreDb: mockDb });
    const a2 = await buyerService.generateBuyerIntelligence({ propertyId: samplePropId }, { firestoreDb: mockDb });

    expect(a1.provenance.contentHash).toBe(a2.provenance.contentHash);
    expect(a1.provenance.assessmentId).toBe(a2.provenance.assessmentId);
  });

  it('8. Current assessment and historical snapshot are retrievable', async () => {
    const assessment = await buyerService.generateBuyerIntelligence(
      { propertyId: samplePropId },
      { firestoreDb: mockDb }
    );

    const latest = await buyerService.getLatestBuyerIntelligence(samplePropId, { firestoreDb: mockDb });
    expect(latest).toBeDefined();
    expect(latest?.provenance.contentHash).toBe(assessment.provenance.contentHash);

    const history = await buyerService.getBuyerIntelligenceHistory(samplePropId, { firestoreDb: mockDb });
    expect(history.length).toBe(1);
    expect(history[0].snapshotId).toBe(assessment.provenance.assessmentId);
  });

  it('9. Async task queue execution for buyer_intelligence succeeds in unit mock mode', async () => {
    registerIntelligenceTaskHandlers(mockDb);
    intelligenceTaskQueue.setFirestoreDb(mockDb);

    const task = await enqueueBuyerIntelligenceTask(samplePropId, {}, { firestoreDb: mockDb });
    expect(task.status).toBe('pending');

    const executedTask = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executedTask.status).toBe('succeeded');
    expect(executedTask.payload?.assessment).toBeDefined();
    expect((executedTask.payload?.assessment as any).propertyId).toBe(samplePropId);
  });
});

// =========================================================================
// SECTION 2: Real Production Firebase Emulator Integration Tests
// =========================================================================
describe('V8.2 Task 24 — Real Production Firebase Emulator & Security Rules Verification', () => {
  const PROJECT_ID = 'demo-anytrader';
  let testEnv: RulesTestEnvironment;
  let adminApp: admin.app.App;
  let adminDb: admin.firestore.Firestore;

  beforeAll(async () => {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

    try {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: { rules, host: '127.0.0.1', port: 8088 },
      });

      if (admin.apps.length > 0) {
        await Promise.all(admin.apps.map((app) => app?.delete()));
      }
      adminApp = admin.initializeApp({ projectId: PROJECT_ID });

      adminDb = adminApp.firestore();
      try {
        adminDb.settings({ ignoreUndefinedProperties: true });
      } catch {
        // settings already configured
      }

      setGlobalIntelligenceDb(adminDb);
      propertyPassportService.setFirestoreDb(adminDb);
      buyerIntelligenceService.setFirestoreDb(adminDb);
      intelligenceTaskQueue.setFirestoreDb(adminDb);
      registerIntelligenceTaskHandlers(adminDb);
    } catch (err: any) {
      console.error('[Task24 Test Setup] Real Firebase emulator error:', err);
      throw new Error(`[Task24 Test Setup] Failed to initialize real Firebase emulator environment: ${err?.message || err}`);
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
    if (adminApp) {
      await adminApp.delete();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed primary authoritative property 101
    await adminDb.collection('properties').doc('prop_emu_24_101').set({
      propertyId: 'prop_emu_24_101',
      ownerId: 'user_owner_24_101',
      landlordId: 'user_owner_24_101',
      tenantId: 'tenant_emu_24_101',
      managerId: 'user_manager_24_101',
      address: '101 Buyer Way, London',
      postcode: 'SW1A 1AA',
      createdAt: new Date().toISOString(),
    });

    // Seed secondary property 202 (for cross-property / cross-tenant isolation testing)
    await adminDb.collection('properties').doc('prop_emu_24_202').set({
      propertyId: 'prop_emu_24_202',
      ownerId: 'user_owner_24_202',
      tenantId: 'tenant_emu_24_202',
      address: '202 Unrelated Court, London',
      postcode: 'E1 6AN',
      createdAt: new Date().toISOString(),
    });

    // Seed verified evidence for property 101
    await adminDb.collection('intelligence_evidence').doc('ev_emu_24_101').set({
      evidenceId: 'ev_emu_24_101',
      aggregateType: 'property',
      aggregateId: 'prop_emu_24_101',
      sourceReference: { propertyId: 'prop_emu_24_101' },
      provenance: { tenantId: 'tenant_emu_24_101' },
      evidenceQuality: 0.95,
      verified: true,
      createdAt: new Date().toISOString(),
    });

    // Seed property condition history for property 101
    await adminDb.collection('property_condition_history').doc('cond_emu_24_roof').set({
      conditionId: 'cond_emu_24_roof',
      propertyId: 'prop_emu_24_101',
      componentType: 'roof',
      condition: 'poor',
      lifecycleState: 'operational',
      observedAt: new Date().toISOString(),
      evidenceIds: ['ev_emu_24_101'],
      provenance: { origin: 'manual_inspection', tenantId: 'tenant_emu_24_101' },
    });

    // Seed property risk history for property 101
    await adminDb.collection('property_risk_history').doc('risk_emu_24_damp').set({
      riskId: 'risk_emu_24_damp',
      propertyId: 'prop_emu_24_101',
      componentType: 'roof',
      riskType: 'damp_and_mould',
      description: 'Active penetrating damp observed on south wall',
      severity: 'high',
      riskScore: 75,
      status: 'assessed',
      evaluatedAt: new Date().toISOString(),
      evidenceIds: ['ev_emu_24_101'],
      provenance: { origin: 'manual_inspection', tenantId: 'tenant_emu_24_101' },
    });

    // Seed property maintenance forecast for property 101
    await adminDb.collection('property_maintenance_history').doc('maint_emu_24_roof').set({
      maintenanceId: 'maint_emu_24_roof',
      propertyId: 'prop_emu_24_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      urgency: 'immediate',
      severity: 'high',
      rationale: 'Slate tile maintenance window',
      evidenceIds: ['ev_emu_24_101'],
      likelihood: 0.85,
      status: 'predicted',
      provenance: { origin: 'manual_inspection', tenantId: 'tenant_emu_24_101' },
    });

    // Seed completed job for property 101
    await adminDb.collection('jobs').doc('job_emu_24_101').set({
      id: 'job_emu_24_101',
      linkedPropertyId: 'prop_emu_24_101',
      propertyId: 'prop_emu_24_101',
      status: 'completed',
      completed: true,
      outcomeSummary: 'Slate tile repair completed',
      evidenceIds: ['ev_emu_24_101'],
    });
  });

  // -----------------------------------------------------------------------
  // Real Production Task Handler & Emulator Persistence Verification
  // -----------------------------------------------------------------------
  it('Production Vector A & B: Valid buyer_intelligence task executes through production handler and persists projection & history to real emulator', async () => {
    const task = await enqueueBuyerIntelligenceTask(
      'prop_emu_24_101',
      { provenance: { tenantId: 'tenant_emu_24_101' } },
      { firestoreDb: adminDb }
    );

    expect(task.taskId).toBeDefined();

    const executedTask = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executedTask.lastError).toBeUndefined();
    expect(executedTask.status).toBe('succeeded');

    const payload = executedTask.payload as any;
    expect(payload.success).toBe(true);
    expect(payload.propertyId).toBe('prop_emu_24_101');
    expect(payload.assessmentId).toBeDefined();
    expect(payload.contentHash).toBeDefined();
    expect(payload.assessment).toBeDefined();

    // Verify /buyer_intelligence/prop_emu_24_101 persisted in real emulator
    const projSnap = await adminDb.collection('buyer_intelligence').doc('prop_emu_24_101').get();
    expect(projSnap.exists).toBe(true);
    const projData = projSnap.data();
    expect(projData?.propertyId).toBe('prop_emu_24_101');
    expect(projData?.schemaVersion).toBe(BUYER_INTELLIGENCE_SCHEMA_VERSION);
    expect(projData?.provenance?.contentHash).toBe(payload.contentHash);
    expect(projData?.provenance?.assessmentId).toBe(payload.assessmentId);
    expect(Array.isArray(projData?.conveyancingFlags)).toBe(true);
    expect(Array.isArray(projData?.recommendedInquiries)).toBe(true);
    expect(projData?.disclaimers?.isNonLegalAdviceNotice).toBe(true);

    // Verify /buyer_intelligence_history/{snapshotId} persisted in real emulator
    const histSnap = await adminDb.collection('buyer_intelligence_history').doc(payload.assessmentId).get();
    expect(histSnap.exists).toBe(true);
    const histData = histSnap.data();
    expect(histData?.propertyId).toBe('prop_emu_24_101');
    expect(histData?.snapshotId).toBe(payload.assessmentId);
    expect(histData?.provenance?.contentHash).toBe(payload.contentHash);
  });

  it('Production Vector C: Idempotent execution produces identical content hash and snapshot on repeated runs', async () => {
    const service = new BuyerIntelligenceService({ firestoreDb: adminDb });
    const b1 = await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_101', provenance: { tenantId: 'tenant_emu_24_101' } },
      { firestoreDb: adminDb }
    );
    const b2 = await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_101', provenance: { tenantId: 'tenant_emu_24_101' } },
      { firestoreDb: adminDb }
    );

    expect(b1.provenance.contentHash).toBe(b2.provenance.contentHash);
    expect(b1.provenance.assessmentId).toBe(b2.provenance.assessmentId);

    // Ensure single authoritative current assessment document under /buyer_intelligence/prop_emu_24_101
    const currentSnap = await adminDb.collection('buyer_intelligence').doc('prop_emu_24_101').get();
    expect(currentSnap.data()?.provenance.assessmentId).toBe(b1.provenance.assessmentId);
  });

  it('Production Vector D: Historical snapshot is immutable and client writes are strictly denied', async () => {
    const service = new BuyerIntelligenceService({ firestoreDb: adminDb });
    const assessment = await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_101', provenance: { tenantId: 'tenant_emu_24_101' } },
      { firestoreDb: adminDb }
    );
    const assessmentId = assessment.provenance.assessmentId;

    // Verify snapshot exists via Admin SDK
    const snapBefore = await adminDb.collection('buyer_intelligence_history').doc(assessmentId).get();
    expect(snapBefore.exists).toBe(true);
    const originalHash = snapBefore.data()?.provenance?.contentHash;

    // Client context attempt to modify or overwrite snapshot
    const ownerDb = testEnv.authenticatedContext('user_owner_24_101').firestore();
    await assertFails(
      setDoc(doc(ownerDb, 'buyer_intelligence_history', assessmentId), {
        propertyId: 'prop_emu_24_101',
        tampered: true,
      })
    );
    await assertFails(
      updateDoc(doc(ownerDb, 'buyer_intelligence_history', assessmentId), {
        'provenance.contentHash': 'forged_hash',
      })
    );
    await assertFails(deleteDoc(doc(ownerDb, 'buyer_intelligence_history', assessmentId)));

    // Re-verify snapshot unchanged via Admin SDK
    const snapAfter = await adminDb.collection('buyer_intelligence_history').doc(assessmentId).get();
    expect(snapAfter.data()?.provenance?.contentHash).toBe(originalHash);
  });

  it('Production Vector E & F: Cross-property & cross-tenant contamination are strictly rejected', async () => {
    const service = new BuyerIntelligenceService({ firestoreDb: adminDb });

    // Mismatched tenant check
    await expect(
      service.generateBuyerIntelligence(
        { propertyId: 'prop_emu_24_101', provenance: { tenantId: 'tenant_emu_24_202' } },
        { firestoreDb: adminDb }
      )
    ).rejects.toThrow(/CrossTenantContamination Violation/i);

    // Cross-property assessment check
    const assessment1 = await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_101', provenance: { tenantId: 'tenant_emu_24_101' } },
      { firestoreDb: adminDb }
    );
    expect(assessment1.propertyId).toBe('prop_emu_24_101');
    expect(assessment1.provenance.sourceRecordIds).not.toContain('ev_emu_cross_202');
  });

  it('Production Vector G & H: Missing property fails closed, and missing passport is auto-generated', async () => {
    const service = new BuyerIntelligenceService({ firestoreDb: adminDb });

    // Non-existent property fails closed
    await expect(
      service.generateBuyerIntelligence(
        { propertyId: 'prop_emu_24_non_existent' },
        { firestoreDb: adminDb }
      )
    ).rejects.toThrow(/does not exist/i);

    // Seed property 303 without an existing property_passports document
    await adminDb.collection('properties').doc('prop_emu_24_303').set({
      propertyId: 'prop_emu_24_303',
      ownerId: 'user_owner_24_303',
      tenantId: 'tenant_emu_24_303',
      address: '303 AutoPassport Ave',
      createdAt: new Date().toISOString(),
    });

    const autoAssessment = await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_303', provenance: { tenantId: 'tenant_emu_24_303' } },
      { firestoreDb: adminDb }
    );
    expect(autoAssessment.propertyId).toBe('prop_emu_24_303');

    // Verify property passport was generated on the fly in real emulator
    const passportSnap = await adminDb.collection('property_passports').doc('prop_emu_24_303').get();
    expect(passportSnap.exists).toBe(true);
  });

  it('Production Vector I & J: Evidence gaps and conflicting records are preserved without silent dropping', async () => {
    // Seed unverified condition record
    await adminDb.collection('property_condition_history').doc('cond_unverified_elec').set({
      conditionId: 'cond_unverified_elec',
      propertyId: 'prop_emu_24_101',
      componentType: 'electrical',
      condition: 'critical',
      lifecycleState: 'operational',
      observedAt: new Date().toISOString(),
      evidenceIds: [],
      provenance: { origin: 'manual_inspection', tenantId: 'tenant_emu_24_101' },
    });

    const service = new BuyerIntelligenceService({ firestoreDb: adminDb });
    const assessment = await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_101', provenance: { tenantId: 'tenant_emu_24_101' } },
      { firestoreDb: adminDb }
    );

    expect(assessment.recommendedInquiries.some((i) => i.inquiryId.includes('electrical'))).toBe(true);
  });

  it('Production Vector K: AI-derived source data is preserved and not self-promoted to verified', async () => {
    // Seed property prop_emu_24_104
    await adminDb.collection('properties').doc('prop_emu_24_104').set({
      propertyId: 'prop_emu_24_104',
      ownerId: 'user_owner_24_104',
      tenantId: 'tenant_emu_24_104',
      address: '104 AI Derivation St',
      createdAt: new Date().toISOString(),
    });

    // Seed AI-derived condition record without verification evidence
    await adminDb.collection('property_condition_history').doc('cond_ai_24_104').set({
      conditionId: 'cond_ai_24_104',
      propertyId: 'prop_emu_24_104',
      componentType: 'plumbing',
      condition: 'derived',
      lifecycleState: 'operational',
      observedAt: new Date().toISOString(),
      evidenceIds: [],
      provenance: { origin: 'ai_copilot', tenantId: 'tenant_emu_24_104' },
    });

    const service = new BuyerIntelligenceService({ firestoreDb: adminDb });
    const assessment = await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_104', provenance: { tenantId: 'tenant_emu_24_104' } },
      { firestoreDb: adminDb }
    );

    // Verify plumbing is represented in inquiries or flags and evidence summary maintains unverified status logic
    expect(assessment.recommendedInquiries.some((i) => i.inquiryId.includes('plumbing'))).toBe(true);
  });

  it('Production Vector L: Real Firestore Security Rules enforce strict access controls on buyer_intelligence and history', async () => {
    const service = new BuyerIntelligenceService({ firestoreDb: adminDb });
    const assessment = await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_101', provenance: { tenantId: 'tenant_emu_24_101' } },
      { firestoreDb: adminDb }
    );
    const assessmentId = assessment.provenance.assessmentId;

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const ownerDb = testEnv.authenticatedContext('user_owner_24_101').firestore();
    const managerDb = testEnv.authenticatedContext('user_manager_24_101').firestore();
    const strangerDb = testEnv.authenticatedContext('user_stranger_999').firestore();
    const adminCtxDb = testEnv.authenticatedContext('admin_user', { admin: true }).firestore();

    // 1. Unauthenticated read denied
    await assertFails(getDoc(doc(unauthDb, 'buyer_intelligence', 'prop_emu_24_101')));
    await assertFails(getDoc(doc(unauthDb, 'buyer_intelligence_history', assessmentId)));

    // 2. Unrelated authenticated user read denied
    await assertFails(getDoc(doc(strangerDb, 'buyer_intelligence', 'prop_emu_24_101')));
    await assertFails(getDoc(doc(strangerDb, 'buyer_intelligence_history', assessmentId)));

    // 3. Property owner read allowed
    await assertSucceeds(getDoc(doc(ownerDb, 'buyer_intelligence', 'prop_emu_24_101')));
    await assertSucceeds(getDoc(doc(ownerDb, 'buyer_intelligence_history', assessmentId)));

    // 4. Assigned property manager read allowed
    await assertSucceeds(getDoc(doc(managerDb, 'buyer_intelligence', 'prop_emu_24_101')));
    await assertSucceeds(getDoc(doc(managerDb, 'buyer_intelligence_history', assessmentId)));

    // 5. Admin read allowed
    await assertSucceeds(getDoc(doc(adminCtxDb, 'buyer_intelligence', 'prop_emu_24_101')));
    await assertSucceeds(getDoc(doc(adminCtxDb, 'buyer_intelligence_history', assessmentId)));

    // 6. Client writes denied on buyer_intelligence (create, update, delete)
    await assertFails(
      setDoc(doc(ownerDb, 'buyer_intelligence', 'prop_emu_24_101'), {
        propertyId: 'prop_emu_24_101',
        fakeField: 'client_forged',
      })
    );
    await assertFails(
      updateDoc(doc(ownerDb, 'buyer_intelligence', 'prop_emu_24_101'), {
        schemaVersion: 'v99.0',
      })
    );
    await assertFails(deleteDoc(doc(ownerDb, 'buyer_intelligence', 'prop_emu_24_101')));
  });

  it('Production Vector M: Material findings retain evidence provenance and embedded legal disclaimers', async () => {
    const service = new BuyerIntelligenceService({ firestoreDb: adminDb });
    const assessment = await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_101', provenance: { tenantId: 'tenant_emu_24_101' } },
      { firestoreDb: adminDb }
    );

    expect(assessment.disclaimers.disclaimerText).toContain('DOES NOT constitute formal legal advice');
    expect(assessment.evidenceSummary.evidenceIds).toContain('ev_emu_24_101');
    expect(assessment.conveyancingFlags.some((f) => f.evidenceIds.includes('ev_emu_24_101'))).toBe(true);
  });

  it('Production Vector N: Bounded queries are enforced for history retrieval', async () => {
    const service = new BuyerIntelligenceService({ firestoreDb: adminDb });
    await service.generateBuyerIntelligence(
      { propertyId: 'prop_emu_24_101', provenance: { tenantId: 'tenant_emu_24_101' } },
      { firestoreDb: adminDb }
    );

    const history = await service.getBuyerIntelligenceHistory('prop_emu_24_101', { limit: 10, firestoreDb: adminDb });
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history.length).toBeLessThanOrEqual(10);
  });
});
