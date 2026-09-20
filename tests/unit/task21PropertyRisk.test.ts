import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

import {
  PropertyRiskService,
  propertyRiskService,
  calculateDeterministicRiskScore,
  RISK_METHODOLOGY_VERSION,
  RecordPropertyRiskInput,
  PropertyRiskAssessment,
  evidenceRegistry,
} from '../../src/server/intelligence/index';
import { setGlobalIntelligenceDb } from '../../src/server/intelligence/immutableStore';

// Helper for Mock In-Memory Firestore DB for isolated logic tests
function createMockFirestoreDb(initialData: {
  jobs?: Record<string, any>;
  properties?: Record<string, any>;
  intelligence_evidence?: Record<string, any>;
  property_risk_history?: Record<string, any>;
  property_risk_retractions?: Record<string, any>;
} = {}) {
  const store: Record<string, Map<string, any>> = {
    jobs: new Map(Object.entries(initialData.jobs || {})),
    properties: new Map(Object.entries(initialData.properties || {})),
    intelligence_evidence: new Map(Object.entries(initialData.intelligence_evidence || {})),
    property_risk_history: new Map(Object.entries(initialData.property_risk_history || {})),
    property_risk_retractions: new Map(Object.entries(initialData.property_risk_retractions || {})),
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
      limit: (n: number) => {
        return createQuery(colName, filters, orderFields, n);
      },
      get: async () => {
        const results: any[] = [];
        for (const [id, data] of store[colName].entries()) {
          let match = true;
          for (const f of filters) {
            if (f.op === '==' && data[f.field] !== f.value) {
              match = false;
              break;
            }
          }
          if (match) {
            results.push({
              id,
              exists: true,
              data: () => ({ ...data }),
            });
          }
        }
        for (const ord of orderFields) {
          results.sort((a, b) => {
            const valA = a.data()[ord.field];
            const valB = b.data()[ord.field];
            if (valA < valB) return ord.dir === 'asc' ? -1 : 1;
            if (valA > valB) return ord.dir === 'asc' ? 1 : -1;
            return 0;
          });
        }
        const finalDocs = limitVal ? results.slice(0, limitVal) : results;
        return {
          empty: finalDocs.length === 0,
          docs: finalDocs,
          forEach: (fn: (doc: any) => void) => finalDocs.forEach(fn),
        };
      },
    };
  };

  return {
    collection: (colName: string) => {
      if (!store[colName]) {
        store[colName] = new Map();
      }
      const colMap = store[colName];
      return {
        doc: (id: string) => ({
          get: async () => {
            const data = colMap.get(id);
            return {
              id,
              exists: !!data,
              data: () => (data ? { ...data } : undefined),
            };
          },
          set: async (data: any, opts?: any) => {
            if (opts?.merge) {
              const prev = colMap.get(id) || {};
              colMap.set(id, { ...prev, ...data });
            } else {
              colMap.set(id, { ...data });
            }
          },
          update: async (data: any) => {
            const prev = colMap.get(id) || {};
            colMap.set(id, { ...prev, ...data });
          },
        }),
        where: (field: string, op: string, value: any) => createQuery(colName, [{ field, op, value }]),
        orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') => createQuery(colName, [], [{ field, dir }]),
        limit: (n: number) => createQuery(colName, [], [], n),
      };
    },
    runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
      const transaction = {
        get: async (docRef: any) => docRef.get(),
        set: (docRef: any, data: any, opts?: any) => docRef.set(data, opts),
        update: (docRef: any, data: any) => docRef.update(data),
      };
      return updateFunction(transaction);
    },
    store,
  };
}

describe('V8.2 Task 21 — Property Risk Intelligence Unit Tests', () => {
  let mockDb: ReturnType<typeof createMockFirestoreDb>;
  let riskService: PropertyRiskService;

  beforeEach(() => {
    mockDb = createMockFirestoreDb({
      properties: {
        prop_101: {
          propertyId: 'prop_101',
          ownerId: 'user_owner_101',
          tenantId: 'tenant_101',
        },
        prop_202: {
          propertyId: 'prop_202',
          ownerId: 'user_owner_202',
          tenantId: 'tenant_202',
        },
      },
      jobs: {
        job_301: {
          jobId: 'job_301',
          propertyId: 'prop_101',
          status: 'completed',
        },
        job_302: {
          jobId: 'job_302',
          propertyId: 'prop_202',
          status: 'completed',
        },
      },
      intelligence_evidence: {
        ev_roof_1: {
          evidenceId: 'ev_roof_1',
          aggregateType: 'property',
          aggregateId: 'prop_101',
          sourceReference: { propertyId: 'prop_101' },
          provenance: { tenantId: 'tenant_101' },
          evidenceQuality: 0.9,
          verified: true,
        },
        ev_cross_2: {
          evidenceId: 'ev_cross_2',
          aggregateType: 'property',
          aggregateId: 'prop_202',
          sourceReference: { propertyId: 'prop_202' },
          provenance: { tenantId: 'tenant_202' },
          evidenceQuality: 0.8,
          verified: true,
        },
      },
    });

    riskService = new PropertyRiskService({ firestoreDb: mockDb });
  });

  // ----------------------------------------------------
  // Vector A: Valid evidence-backed risk succeeds
  // ----------------------------------------------------
  it('Vector A: Valid evidence-backed risk succeeds and stores risk assessment', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'structural_roof_leak',
      description: 'Damaged roof tiles observed over south rafter causing potential water ingress.',
      severity: 'high',
      evidenceIds: ['ev_roof_1'],
      sourceJobId: 'job_301',
      provenance: {
        origin: 'manual_inspection',
        tenantId: 'tenant_101',
      },
    };

    const res = await riskService.recordRiskAssessment(input);

    expect(res).toBeDefined();
    expect(res.propertyId).toBe('prop_101');
    expect(res.componentType).toBe('roof');
    expect(res.severity).toBe('high');
    expect(res.methodologyVersion).toBe(RISK_METHODOLOGY_VERSION);
    expect(res.score).toBeGreaterThan(0);
    expect(res.status).toBe('derived');
    expect(res.evidenceIds).toEqual(['ev_roof_1']);

    // Verify stored history record
    const storedHistory = mockDb.store.property_risk_history.get(res.riskId);
    expect(storedHistory).toBeDefined();
    expect(storedHistory.contentHash).toBe(res.contentHash);

    // Verify property document current projection
    const propDoc = mockDb.store.properties.get('prop_101');
    expect(propDoc?.intelligence?.riskProjection).toBeDefined();
    expect(propDoc.intelligence.riskProjection.overallRiskScore).toBeGreaterThan(0);
  });

  // ----------------------------------------------------
  // Vector B: No evidence is rejected
  // ----------------------------------------------------
  it('Vector B: Reject risk assessment when no evidence IDs are provided', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'structural_leak',
      description: 'Roof tile damage',
      evidenceIds: [],
      provenance: { origin: 'manual_inspection' },
    };

    await expect(riskService.recordRiskAssessment(input)).rejects.toThrow(
      '[PropertyRisk Violation] Risk assessment requires source evidence'
    );
  });

  // ----------------------------------------------------
  // Vector C: Fabricated evidence is rejected
  // ----------------------------------------------------
  it('Vector C: Reject risk assessment when evidence ID does not exist in registry', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'structural_leak',
      description: 'Roof damage',
      evidenceIds: ['fabricated_ev_999'],
      provenance: { origin: 'manual_inspection' },
    };

    await expect(riskService.recordRiskAssessment(input)).rejects.toThrow(
      "[PropertyRisk Violation] Referenced evidence ID 'fabricated_ev_999' does not exist"
    );
  });

  // ----------------------------------------------------
  // Vector D: Cross-property evidence is rejected
  // ----------------------------------------------------
  it('Vector D: Reject risk assessment when evidence belongs to a different property', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'structural_leak',
      description: 'Roof damage using property 202 evidence',
      evidenceIds: ['ev_cross_2'], // belongs to prop_202
      provenance: { origin: 'manual_inspection' },
    };

    await expect(riskService.recordRiskAssessment(input)).rejects.toThrow(
      "[PropertyRisk Violation] Evidence 'ev_cross_2' belongs to property 'prop_202', not 'prop_101'"
    );
  });

  // ----------------------------------------------------
  // Vector E: Cross-property job lineage is rejected
  // ----------------------------------------------------
  it('Vector E: Reject risk assessment when source job belongs to a different property', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'structural_leak',
      description: 'Job 302 linked to prop_101 attempt',
      evidenceIds: ['ev_roof_1'],
      sourceJobId: 'job_302', // belongs to prop_202
      provenance: { origin: 'manual_inspection' },
    };

    await expect(riskService.recordRiskAssessment(input)).rejects.toThrow(
      "[PropertyLineage Violation] Job 'job_302' belongs to property 'prop_202', not 'prop_101'"
    );
  });

  // ----------------------------------------------------
  // Vector F & G: AI fabricated property / evidence rejected
  // ----------------------------------------------------
  it('Vector F & G: AI origin cannot supply unregistered evidence or spoof property ID', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      riskType: 'electrical_fault',
      description: 'AI model inference regarding consumer unit',
      evidenceIds: ['ai_invented_ev_123'],
      provenance: {
        origin: 'ai_copilot_recommendation',
        tenantId: 'tenant_101',
      },
    };

    await expect(riskService.recordRiskAssessment(input)).rejects.toThrow(
      "[PropertyRisk Violation] Referenced evidence ID 'ai_invented_ev_123' does not exist"
    );
  });

  // ----------------------------------------------------
  // Vector H: AI self-verification is rejected
  // ----------------------------------------------------
  it('Vector H: AI origin attempting to claim verified status is coerced to derived unless authorized', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'electrical',
      riskType: 'electrical_panel_hazard',
      description: 'AI detected outdated consumer unit',
      severity: 'medium',
      evidenceIds: ['ev_roof_1'],
      status: 'verified', // AI attempting self-promotion
      provenance: {
        origin: 'ai_inference_engine',
        tenantId: 'tenant_101',
      },
    };

    // Called without isVerifiedServerAction: true -> coerced to 'derived'
    const res = await riskService.recordRiskAssessment(input);
    expect(res.status).toBe('derived');
  });

  // ----------------------------------------------------
  // Vector I: Deterministic scoring formula
  // ----------------------------------------------------
  it('Vector I: Deterministic scoring formula returns identical output for identical inputs', () => {
    const score1 = calculateDeterministicRiskScore('high', 0.85, 0.9);
    const score2 = calculateDeterministicRiskScore('high', 0.85, 0.9);
    expect(score1).toBe(score2);
    expect(score1).toBeGreaterThan(50);

    const criticalScore = calculateDeterministicRiskScore('critical', 1.0, 1.0);
    expect(criticalScore).toBe(90);
  });

  // ----------------------------------------------------
  // Vector J: Idempotency enforcement
  // ----------------------------------------------------
  it('Vector J: Idempotent processing returns existing record without duplicating storage', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'plumbing',
      riskType: 'boiler_pressure_loss',
      description: 'Boiler pressure drops below 0.5 bar repeatedly.',
      severity: 'medium',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'manual_inspection', tenantId: 'tenant_101' },
    };

    const res1 = await riskService.recordRiskAssessment(input);
    const res2 = await riskService.recordRiskAssessment(input);

    expect(res1.riskId).toBe(res2.riskId);
    expect(res1.contentHash).toBe(res2.contentHash);
    expect(mockDb.store.property_risk_history.size).toBe(1);
  });

  // ----------------------------------------------------
  // Vector K: Conflicting mutation rejection
  // ----------------------------------------------------
  it('Vector K: Rejects conflicting same-ID risk write with differing content hash', async () => {
    const input1: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'plumbing',
      riskType: 'boiler_leak',
      description: 'First description',
      severity: 'medium',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'manual' },
    };

    const res1 = await riskService.recordRiskAssessment(input1);

    // Simulate conflicting write attempt to same doc ID
    const historyRef = mockDb.collection('property_risk_history').doc(res1.riskId);
    await historyRef.set({
      ...res1,
      contentHash: 'conflicting_hash_123456789',
    });

    await expect(riskService.recordRiskAssessment(input1)).rejects.toThrow(
      `[PropertyRisk Violation] Conflicting risk assessment content for ID '${res1.riskId}'`
    );
  });

  // ----------------------------------------------------
  // Vector L: Concurrent worker execution
  // ----------------------------------------------------
  it('Vector L: Simultaneous concurrent worker submissions execute atomically without race conditions', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'chimney_mortar_decay',
      description: 'Mortar erosion around chimney stack.',
      severity: 'low',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'manual_inspection' },
    };

    // Execute 3 concurrent workers in parallel
    const [w1, w2, w3] = await Promise.all([
      riskService.recordRiskAssessment(input),
      riskService.recordRiskAssessment(input),
      riskService.recordRiskAssessment(input),
    ]);

    expect(w1.riskId).toBe(w2.riskId);
    expect(w2.riskId).toBe(w3.riskId);
    expect(mockDb.store.property_risk_history.size).toBe(1);
  });

  // ----------------------------------------------------
  // Vector O: Retraction changes projection without mutating historical risk record
  // ----------------------------------------------------
  it('Vector O1: Retraction creates append-only retraction record, preserves historical risk record unchanged, and updates projection', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'roof_tile_crack',
      description: 'Minor hair crack on perimeter roof tile.',
      severity: 'high',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'manual_inspection' },
    };

    const res = await riskService.recordRiskAssessment(input);
    expect(mockDb.store.property_risk_history.get(res.riskId).status).toBe('derived');

    // Retract risk
    const retractionReason = 'Corrective re-inspection confirmed tile replacement complete.';
    const retractionRes = await riskService.retractRiskAssessment(res.riskId, retractionReason);

    // 1. Verify original historical doc remains 100% UNCHANGED and UNMUTATED
    const historyDoc = mockDb.store.property_risk_history.get(res.riskId);
    expect(historyDoc).toBeDefined();
    expect(historyDoc.status).toBe('derived'); // Original status preserved!
    expect(historyDoc.retractionReason).toBeUndefined(); // Never mutated!

    // 2. Verify append-only retraction record created in property_risk_retractions
    const retractionDoc = mockDb.store.property_risk_retractions.get(retractionRes.retractionId);
    expect(retractionDoc).toBeDefined();
    expect(retractionDoc.riskId).toBe(res.riskId);
    expect(retractionDoc.propertyId).toBe('prop_101');
    expect(retractionDoc.reason).toBe(retractionReason);
    expect(retractionDoc.contentHash).toBeDefined();

    // 3. Verify property current projection excludes retracted risk
    const propDoc = mockDb.store.properties.get('prop_101');
    expect(propDoc.intelligence.riskProjection.activeRiskAssessments.length).toBe(0);
  });

  it('Vector O2: Repeated retraction with identical reason is idempotent', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'plumbing',
      riskType: 'pipe_corrosion',
      description: 'Corrosion on cold water inlet.',
      severity: 'medium',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'manual_inspection' },
    };

    const res = await riskService.recordRiskAssessment(input);
    const reason = 'Incorrect observation location';

    const ret1 = await riskService.retractRiskAssessment(res.riskId, reason);
    const ret2 = await riskService.retractRiskAssessment(res.riskId, reason);

    expect(ret1.retractionId).toBe(ret2.retractionId);
    expect(mockDb.store.property_risk_retractions.size).toBe(1);
  });

  it('Vector O3: Retraction with conflicting content/reason fails closed', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'electrical',
      riskType: 'loose_wiring',
      description: 'Loose connection in junction box.',
      severity: 'high',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'manual_inspection' },
    };

    const res = await riskService.recordRiskAssessment(input);

    await riskService.retractRiskAssessment(res.riskId, 'Initial retraction reason');

    await expect(
      riskService.retractRiskAssessment(res.riskId, 'Conflicting second retraction reason')
    ).rejects.toThrow(`[PropertyRisk Violation] Conflicting retraction content for risk ID '${res.riskId}'`);
  });

  it('Vector O4: Reject cross-property retraction attempt', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'gutters_blocked',
      description: 'Debris accumulation in roof gutters.',
      severity: 'low',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'manual_inspection' },
    };

    const res = await riskService.recordRiskAssessment(input);

    await expect(
      riskService.retractRiskAssessment(res.riskId, 'Retract attempt', { propertyId: 'prop_202' })
    ).rejects.toThrow(`[PropertyRisk Violation] Retraction property 'prop_202' does not match risk property 'prop_101'`);
  });

  // ----------------------------------------------------
  // Vector P: Cross-tenant access is rejected
  // ----------------------------------------------------
  it('Vector P: Reject risk assessment when tenant ID does not match property owner/tenant', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'roof_leak',
      description: 'Tenant mismatch test',
      evidenceIds: ['ev_roof_1'],
      provenance: {
        origin: 'manual_inspection',
        tenantId: 'tenant_999_wrong', // Wrong tenant
      },
    };

    await expect(riskService.recordRiskAssessment(input)).rejects.toThrow(
      "[CrossTenantContamination Violation] Tenant 'tenant_999_wrong' does not match property owner/tenant 'tenant_101'"
    );
  });

  // ----------------------------------------------------
  // Vector R: Database-bounded property-scoped query
  // ----------------------------------------------------
  it('Vector R: getPropertyRiskHistory executes property-scoped query bounded by limit', async () => {
    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      riskType: 'roof_leak',
      description: 'Query test risk',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'manual' },
    };

    await riskService.recordRiskAssessment(input);

    const history = await riskService.getPropertyRiskHistory('prop_101', { limit: 10 });
    expect(history.length).toBe(1);
    expect(history[0].propertyId).toBe('prop_101');
  });
});

// ====================================================
// Real Firebase Emulator Security Rules & Integration Suite
// ====================================================
describe('V8.2 Task 21 — Real Firebase Emulator & Security Rules Integration', () => {
  const PROJECT_ID = 'demo-anytrader';
  let testEnv: RulesTestEnvironment;
  let adminApp: admin.app.App;
  let adminDb: admin.firestore.Firestore;

  beforeAll(async () => {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

    try {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: { rules, host: '127.0.0.1', port: 8088 },
      });

      if (admin.apps.length === 0) {
        adminApp = admin.initializeApp({
          projectId: PROJECT_ID,
        });
      } else {
        adminApp = admin.app();
      }

      adminDb = adminApp.firestore();
      adminDb.settings({ ignoreUndefinedProperties: true });
      setGlobalIntelligenceDb(adminDb);
    } catch (err: any) {
      console.error('[Task21 Test Setup] Real Firebase emulator error:', err);
      throw new Error(`[Task21 Test Setup] Failed to initialize real Firebase emulator environment: ${err?.message || err}`);
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
    if (testEnv) {
      await testEnv.clearFirestore();
    }

    // Seed authoritative property & evidence records via Admin SDK
    await adminDb.collection('properties').doc('prop_emu_101').set({
      propertyId: 'prop_emu_101',
      ownerId: 'user_owner_101',
      tenantId: 'tenant_101',
      address: '101 Security Way',
    });

    await adminDb.collection('intelligence_evidence').doc('ev_emu_101').set({
      evidenceId: 'ev_emu_101',
      aggregateType: 'property',
      aggregateId: 'prop_emu_101',
      sourceReference: { propertyId: 'prop_emu_101' },
      provenance: { tenantId: 'tenant_101' },
      evidenceQuality: 0.95,
      verified: true,
      createdAt: new Date().toISOString(),
    });
  });

  // ----------------------------------------------------
  // Vector Q: Security Rules — Client Access Denied
  // ----------------------------------------------------
  it('Vector Q1: Unauthenticated user cannot read property_risk_history', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const docRef = unauthDb.collection('property_risk_history').doc('pr_sample_123');

    await expect(docRef.get()).rejects.toThrow();
  });

  it('Vector Q2: Unrelated authenticated user cannot read property_risk_history', async () => {
    // Seed a risk doc in emulator
    await adminDb.collection('property_risk_history').doc('pr_sample_123').set({
      riskId: 'pr_sample_123',
      propertyId: 'prop_emu_101',
      severity: 'high',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
    });

    const unrelatedDb = testEnv.authenticatedContext('user_unrelated_999').firestore();
    const docRef = unrelatedDb.collection('property_risk_history').doc('pr_sample_123');

    await expect(docRef.get()).rejects.toThrow();
  });

  it('Vector Q3: Property owner can read property_risk_history', async () => {
    await adminDb.collection('property_risk_history').doc('pr_sample_123').set({
      riskId: 'pr_sample_123',
      propertyId: 'prop_emu_101',
      severity: 'high',
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
    });

    const ownerDb = testEnv.authenticatedContext('user_owner_101').firestore();
    const docRef = ownerDb.collection('property_risk_history').doc('pr_sample_123');

    const snap = await docRef.get();
    expect(snap.exists).toBe(true);
  });

  it('Vector Q4: Direct client create/update/delete on property_risk_history is DENIED', async () => {
    const clientDb = testEnv.authenticatedContext('user_owner_101').firestore();
    const docRef = clientDb.collection('property_risk_history').doc('pr_client_spoof');

    await expect(
      docRef.set({
        riskId: 'pr_client_spoof',
        propertyId: 'prop_emu_101',
        score: 0,
      })
    ).rejects.toThrow();
  });

  it('Vector Q5: Security Rules — Direct client write on property_risk_retractions is DENIED', async () => {
    const clientDb = testEnv.authenticatedContext('user_owner_101').firestore();
    const docRef = clientDb.collection('property_risk_retractions').doc('retract_spoof_123');

    await expect(
      docRef.set({
        retractionId: 'retract_spoof_123',
        riskId: 'pr_sample_123',
        propertyId: 'prop_emu_101',
        reason: 'Client spoofed retraction',
      })
    ).rejects.toThrow();
  });

  it('Vector Q6: Security Rules — Property owner can read property_risk_retractions', async () => {
    await adminDb.collection('property_risk_retractions').doc('retract_sample_123').set({
      retractionId: 'retract_sample_123',
      riskId: 'pr_sample_123',
      propertyId: 'prop_emu_101',
      reason: 'Admin verified retraction',
      retractedAt: new Date().toISOString(),
    });

    const ownerDb = testEnv.authenticatedContext('user_owner_101').firestore();
    const docRef = ownerDb.collection('property_risk_retractions').doc('retract_sample_123');

    const snap = await docRef.get();
    expect(snap.exists).toBe(true);
  });

  // ----------------------------------------------------
  // Vector Real Emulator Execution
  // ----------------------------------------------------
  it('Vector Real Emulator: PropertyRiskService records risk assessment on real emulator', async () => {
    const emuRiskService = new PropertyRiskService({ firestoreDb: adminDb });

    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_emu_101',
      componentType: 'electrical',
      riskType: 'consumer_unit_outdated',
      description: 'Rewireable fuses present in active consumer unit.',
      severity: 'medium',
      evidenceIds: ['ev_emu_101'],
      provenance: { origin: 'manual_inspection', tenantId: 'tenant_101' },
    };

    const res = await emuRiskService.recordRiskAssessment(input);

    expect(res).toBeDefined();
    expect(res.propertyId).toBe('prop_emu_101');
    expect(res.score).toBeGreaterThan(0);

    // Verify written to emulator Firestore
    const snap = await adminDb.collection('property_risk_history').doc(res.riskId).get();
    expect(snap.exists).toBe(true);

    // Query bounded history
    const history = await emuRiskService.getPropertyRiskHistory('prop_emu_101', { limit: 5 });
    expect(history.length).toBe(1);
    expect(history[0].riskId).toBe(res.riskId);
  });

  it('Vector Real Emulator: PropertyRiskService retracts risk assessment on real emulator via append-only retraction record', async () => {
    const emuRiskService = new PropertyRiskService({ firestoreDb: adminDb });

    const input: RecordPropertyRiskInput = {
      propertyId: 'prop_emu_101',
      componentType: 'roof',
      riskType: 'ridge_tile_loose',
      description: 'Loose ridge tile over main pitched roof.',
      severity: 'high',
      evidenceIds: ['ev_emu_101'],
      provenance: { origin: 'manual_inspection', tenantId: 'tenant_101' },
    };

    const riskRes = await emuRiskService.recordRiskAssessment(input);

    // Perform retraction
    const reason = 'Tile re-mortared and secured by roofing contractor.';
    const retractionRes = await emuRiskService.retractRiskAssessment(riskRes.riskId, reason);

    // 1. Verify original risk document in property_risk_history is UNCHANGED in emulator Firestore
    const historySnap = await adminDb.collection('property_risk_history').doc(riskRes.riskId).get();
    expect(historySnap.exists).toBe(true);
    const historyData = historySnap.data();
    expect(historyData?.status).toBe('derived'); // Original status unmutated!
    expect(historyData?.retractionReason).toBeUndefined();

    // 2. Verify append-only retraction record exists in property_risk_retractions in emulator Firestore
    const retractionSnap = await adminDb.collection('property_risk_retractions').doc(retractionRes.retractionId).get();
    expect(retractionSnap.exists).toBe(true);
    const retractionData = retractionSnap.data();
    expect(retractionData?.riskId).toBe(riskRes.riskId);
    expect(retractionData?.propertyId).toBe('prop_emu_101');
    expect(retractionData?.reason).toBe(reason);

    // 3. Verify property projection on real emulator excludes retracted risk
    const propSnap = await adminDb.collection('properties').doc('prop_emu_101').get();
    const propData = propSnap.data();
    const activeAssessments = propData?.intelligence?.riskProjection?.activeRiskAssessments || [];
    expect(activeAssessments.some((item: any) => item.riskId === riskRes.riskId)).toBe(false);
  });
});
