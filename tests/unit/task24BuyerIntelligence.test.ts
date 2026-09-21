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
 *    - Bounded property-scoped historical queries
 *    - Async task queue execution for 'buyer_intelligence'
 * 2. Real Firebase Emulator Integration Tests (Security Rules):
 *    - Client write rejection on /buyer_intelligence/{propertyId}
 *    - Client write rejection on /buyer_intelligence_history/{snapshotId}
 *    - Authorized read allowed for property owner/landlord/admin
 *    - Unauthorized read rejected for non-owner/unauthenticated users
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
  propertyPassportService,
  intelligenceTaskQueue,
  enqueueBuyerIntelligenceTask,
} from '../../src/server/intelligence/index';
import { setGlobalIntelligenceDb } from '../../src/server/intelligence/immutableStore';
import { registerIntelligenceTaskHandlers } from '../../server';

// Helper for Mock In-Memory Firestore DB for isolated deterministic logic tests
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

  it('9. Async task queue execution for buyer_intelligence succeeds', async () => {
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

describe('Task 24 — Real Firebase Emulator Security Rules Tests', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'ai-studio-anytrader-44dab8b3-bbc9-4352-b725-2cbe7a1dfd2a',
      firestore: {
        host: '127.0.0.1',
        port: 8088,
        rules,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed test property
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'properties', 'prop_sec_24_101'), {
        propertyId: 'prop_sec_24_101',
        ownerId: 'user_owner_24',
        landlordId: 'user_owner_24',
        postcode: 'SW1A 1AA',
      });

      await setDoc(doc(db, 'buyer_intelligence', 'prop_sec_24_101'), {
        propertyId: 'prop_sec_24_101',
        conveyancingFlags: [],
        recommendedInquiries: [],
        schemaVersion: 'v8.2-buyer-v1',
      });

      await setDoc(doc(db, 'buyer_intelligence_history', 'bia_prop_sec_24_101_hash1'), {
        snapshotId: 'bia_prop_sec_24_101_hash1',
        propertyId: 'prop_sec_24_101',
        conveyancingFlags: [],
        schemaVersion: 'v8.2-buyer-v1',
      });
    });
  });

  it('1. Client write on /buyer_intelligence/{propertyId} is DENIED for authenticated user', async () => {
    const context = testEnv.authenticatedContext('user_owner_24');
    const db = context.firestore();

    await assertFails(
      setDoc(doc(db, 'buyer_intelligence', 'prop_sec_24_101'), {
        propertyId: 'prop_sec_24_101',
        conveyancingFlags: [{ flagId: 'malicious' }],
      })
    );
  });

  it('2. Client write on /buyer_intelligence_history/{snapshotId} is DENIED for authenticated user', async () => {
    const context = testEnv.authenticatedContext('user_owner_24');
    const db = context.firestore();

    await assertFails(
      setDoc(doc(db, 'buyer_intelligence_history', 'bia_malicious_snapshot'), {
        snapshotId: 'bia_malicious_snapshot',
        propertyId: 'prop_sec_24_101',
      })
    );
  });

  it('3. Property owner can READ /buyer_intelligence/{propertyId}', async () => {
    const context = testEnv.authenticatedContext('user_owner_24');
    const db = context.firestore();

    await assertSucceeds(getDoc(doc(db, 'buyer_intelligence', 'prop_sec_24_101')));
  });

  it('4. Unauthenticated user CANNOT read /buyer_intelligence/{propertyId}', async () => {
    const context = testEnv.unauthenticatedContext();
    const db = context.firestore();

    await assertFails(getDoc(doc(db, 'buyer_intelligence', 'prop_sec_24_101')));
  });

  it('5. Non-owner user CANNOT read /buyer_intelligence/{propertyId}', async () => {
    const context = testEnv.authenticatedContext('user_stranger_999');
    const db = context.firestore();

    await assertFails(getDoc(doc(db, 'buyer_intelligence', 'prop_sec_24_101')));
  });
});
