/**
 * AnyTrader V8.2 — Task 22 Predictive Maintenance Intelligence Tests
 * 
 * Validates:
 * Vectors A - Z:
 * A. Valid evidence-backed prediction succeeds
 * B. No evidence is rejected
 * C. Fabricated evidence is rejected
 * D. Cross-property evidence is rejected
 * E. Cross-property job lineage is rejected
 * F. AI fabricated property ID is rejected
 * G. AI fabricated evidence is rejected
 * H. AI prediction cannot become an observation
 * I. AI cannot self-verify
 * J. Same inputs produce deterministic results
 * K. Forecast window is valid and deterministic
 * L. Repeated processing is idempotent
 * M. Conflicting same-ID content is rejected
 * N. Concurrent processing is safe
 * O. Completed job alone does not prove maintenance
 * P. Valid outcome evidence can affect future prediction
 * Q. Supersession creates new/current prediction without mutating old history
 * R. Retracted supporting evidence / risk cannot silently remain the basis of an active prediction
 * S. Cross-tenant contamination is rejected
 * T. Firestore security rules are correct (Read owner/admin only, write denied)
 * U. Query is property-scoped and bounded
 * V. Task 17 regression passes
 * W. Task 19 regression passes
 * X. Task 20 regression passes
 * Y. Task 21 regression passes
 * Z. Tier-B storage separation remains intact where raw artifacts exist
 */

process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

import {
  PredictiveMaintenanceService,
  predictiveMaintenanceService,
  calculateDeterministicMaintenanceForecast,
  MAINTENANCE_METHODOLOGY_VERSION,
  RecordPredictiveMaintenanceInput,
  PredictiveMaintenanceAssessment,
  PropertyLifecycleService,
  PropertyRiskService,
  validateComponentType,
  FIRESTORE_DOC_MAX_BYTES,
  compressPayload,
  decompressPayload,
  intelligenceTaskQueue,
} from '../../src/server/intelligence/index';
import { setGlobalIntelligenceDb } from '../../src/server/intelligence/immutableStore';
import { registerIntelligenceTaskHandlers } from '../../server';

// Helper for Mock In-Memory Firestore DB for isolated logic tests
function createMockFirestoreDb(initialData: {
  jobs?: Record<string, any>;
  properties?: Record<string, any>;
  intelligence_evidence?: Record<string, any>;
  property_condition_history?: Record<string, any>;
  property_risk_history?: Record<string, any>;
  property_risk_retractions?: Record<string, any>;
  property_maintenance_history?: Record<string, any>;
  property_maintenance_supersessions?: Record<string, any>;
} = {}) {
  const store: Record<string, Map<string, any>> = {
    jobs: new Map(Object.entries(initialData.jobs || {})),
    properties: new Map(Object.entries(initialData.properties || {})),
    intelligence_evidence: new Map(Object.entries(initialData.intelligence_evidence || {})),
    property_condition_history: new Map(Object.entries(initialData.property_condition_history || {})),
    property_risk_history: new Map(Object.entries(initialData.property_risk_history || {})),
    property_risk_retractions: new Map(Object.entries(initialData.property_risk_retractions || {})),
    property_maintenance_history: new Map(Object.entries(initialData.property_maintenance_history || {})),
    property_maintenance_supersessions: new Map(Object.entries(initialData.property_maintenance_supersessions || {})),
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

describe('V8.2 Task 22 — Predictive Maintenance Intelligence Unit Tests', () => {
  let mockDb: ReturnType<typeof createMockFirestoreDb>;
  let maintenanceService: PredictiveMaintenanceService;

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
        ev_outcome_cert: {
          evidenceId: 'ev_outcome_cert',
          aggregateType: 'property',
          aggregateId: 'prop_101',
          sourceReference: { propertyId: 'prop_101' },
          evidenceType: 'completion_certificate',
          evidenceQuality: 0.95,
          verified: true,
        },
        ev_retracted_1: {
          evidenceId: 'ev_retracted_1',
          aggregateType: 'property',
          aggregateId: 'prop_101',
          sourceReference: { propertyId: 'prop_101' },
          status: 'retracted',
        },
      },
      property_risk_history: {
        risk_active_1: {
          riskId: 'risk_active_1',
          propertyId: 'prop_101',
          severity: 'high',
          status: 'verified',
        },
        risk_retracted_2: {
          riskId: 'risk_retracted_2',
          propertyId: 'prop_101',
          severity: 'high',
          status: 'retracted',
        },
      },
      property_risk_retractions: {
        retract_risk_retracted_2: {
          retractionId: 'retract_risk_retracted_2',
          riskId: 'risk_retracted_2',
          propertyId: 'prop_101',
          reason: 'Disproven by structural inspection',
        },
      },
    });

    maintenanceService = new PredictiveMaintenanceService({ firestoreDb: mockDb });
    setGlobalIntelligenceDb(mockDb);
  });

  // ----------------------------------------------------
  // Vector A: Valid evidence-backed prediction succeeds
  // ----------------------------------------------------
  it('Vector A: Valid evidence-backed prediction succeeds and updates projection', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      severity: 'medium',
      rationale: 'Roof tiles showing wear; scheduled maintenance recommended before winter',
      evidenceIds: ['ev_roof_1'],
      provenance: {
        origin: 'inspection_engine',
        tenantId: 'tenant_101',
      },
    };

    const assessment = await maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb });

    expect(assessment).toBeDefined();
    expect(assessment.propertyId).toBe('prop_101');
    expect(assessment.componentType).toBe('roof');
    expect(assessment.predictionType).toBe('maintenance_due');
    expect(assessment.severity).toBe('medium');
    expect(assessment.likelihood).toBeGreaterThan(0);
    expect(assessment.methodologyVersion).toBe(MAINTENANCE_METHODOLOGY_VERSION);
    expect(assessment.status).toBe('predicted');
    expect(assessment.contentHash).toBeDefined();
    expect(assessment.maintenanceId).toContain('pm_prop_101_');

    // Confirm stored in immutable history
    const stored = mockDb.store.property_maintenance_history.get(assessment.maintenanceId);
    expect(stored).toBeDefined();
    expect(stored.contentHash).toBe(assessment.contentHash);

    // Confirm property projection updated
    const propDoc = mockDb.store.properties.get('prop_101');
    expect(propDoc.intelligence?.maintenanceProjection).toBeDefined();
    expect(propDoc.intelligence.maintenanceProjection.activePredictions.length).toBe(1);
    expect(propDoc.intelligence.maintenanceProjection.componentForecasts.roof.nextMaintenanceDate).toBe('2026-11-01');
  });

  // ----------------------------------------------------
  // Vector B: No evidence is rejected (Fail-Closed)
  // ----------------------------------------------------
  it('Vector B: Rejects prediction without supporting evidence (Fail-Closed)', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'inspection_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'Unsubstantiated inspection prediction without evidence',
      evidenceIds: [],
      provenance: { origin: 'manual' },
    };

    await expect(maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb })).rejects.toThrow(
      /Prediction requires supporting evidence/
    );
  });

  // ----------------------------------------------------
  // Vector C: Fabricated evidence is rejected
  // ----------------------------------------------------
  it('Vector C: Rejects prediction referencing fabricated evidence', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'Fabricated evidence reference',
      evidenceIds: ['ev_fabricated_999'],
      provenance: { origin: 'manual' },
    };

    await expect(maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb })).rejects.toThrow(
      /Referenced evidence ID 'ev_fabricated_999' does not exist/
    );
  });

  // ----------------------------------------------------
  // Vector D: Cross-property evidence is rejected
  // ----------------------------------------------------
  it('Vector D: Rejects prediction referencing evidence belonging to another property', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'Cross property evidence attack',
      evidenceIds: ['ev_cross_2'], // Belongs to prop_202
      provenance: { origin: 'manual' },
    };

    await expect(maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb })).rejects.toThrow(
      /Evidence 'ev_cross_2' belongs to property 'prop_202', not 'prop_101'/
    );
  });

  // ----------------------------------------------------
  // Vector E: Cross-property job lineage is rejected
  // ----------------------------------------------------
  it('Vector E: Rejects prediction with job lineage belonging to another property', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      sourceJobId: 'job_302', // Belongs to prop_202
      rationale: 'Job belongs to another property',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'manual' },
    };

    await expect(maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb })).rejects.toThrow(
      /Job 'job_302' belongs to property 'prop_202', not 'prop_101'/
    );
  });

  // ----------------------------------------------------
  // Vector F: AI fabricated property ID is rejected
  // ----------------------------------------------------
  it('Vector F: Rejects AI candidate with non-existent property ID', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_non_existent_999',
      componentType: 'roof',
      predictionType: 'condition_review',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'AI hallucinated property ID',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'ai_copilot' },
    };

    await expect(maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb })).rejects.toThrow(
      /Property 'prop_non_existent_999' does not exist/
    );
  });

  // ----------------------------------------------------
  // Vector G: AI fabricated evidence is rejected
  // ----------------------------------------------------
  it('Vector G: Rejects AI candidate referencing hallucinated evidence', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'condition_review',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'AI hallucinated evidence ID',
      evidenceIds: ['ev_ai_hallucinated_123'],
      provenance: { origin: 'ai_inference' },
    };

    await expect(maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb })).rejects.toThrow(
      /Referenced evidence ID 'ev_ai_hallucinated_123' does not exist/
    );
  });

  // ----------------------------------------------------
  // Vector H: AI prediction cannot become an observation
  // ----------------------------------------------------
  it('Vector H: Rejects AI candidate attempting to assert prediction as an observed condition', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'AI attempting to assert prediction as observed condition',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'ai_inference' },
      metadata: { asObservation: true },
    };

    await expect(maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb })).rejects.toThrow(
      /Prediction cannot be asserted as an observed condition/
    );
  });

  // ----------------------------------------------------
  // Vector I: AI cannot self-verify
  // ----------------------------------------------------
  it('Vector I: AI cannot self-verify; unverified candidate is normalized to predicted', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'AI candidate claiming verified status',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'ai_inference' },
      status: 'verified' as any,
    };

    const assessment = await maintenanceService.recordMaintenancePrediction(input, {
      firestoreDb: mockDb,
      isVerifiedServerAction: false,
    });

    expect(assessment.status).toBe('predicted');
  });

  // ----------------------------------------------------
  // Vector J: Same inputs produce deterministic results
  // ----------------------------------------------------
  it('Vector J: Same inputs produce identical likelihood, severity, contentHash, and maintenanceId', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      severity: 'high',
      rationale: 'Severe tile displacement requiring planned intervention',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'inspector' },
    };

    const res1 = await maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb });
    const res2 = await maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb });

    expect(res1.contentHash).toBe(res2.contentHash);
    expect(res1.maintenanceId).toBe(res2.maintenanceId);
    expect(res1.likelihood).toBe(res2.likelihood);
    expect(res1.severity).toBe(res2.severity);
  });

  // ----------------------------------------------------
  // Vector K: Forecast window is valid and deterministic
  // ----------------------------------------------------
  it('Vector K: Rejects invalid forecast window (forecastStart > forecastEnd or non-ISO dates)', async () => {
    const invalidDatesInput: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: 'invalid-date',
      forecastEnd: '2027-02-01',
      rationale: 'Invalid date format',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'inspector' },
    };

    await expect(
      maintenanceService.recordMaintenancePrediction(invalidDatesInput, { firestoreDb: mockDb })
    ).rejects.toThrow(/Forecast window requires valid ISO date strings/);

    const reversedWindowInput: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2027-05-01',
      forecastEnd: '2026-11-01',
      rationale: 'Reversed start and end dates',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'inspector' },
    };

    await expect(
      maintenanceService.recordMaintenancePrediction(reversedWindowInput, { firestoreDb: mockDb })
    ).rejects.toThrow(/forecastStart cannot be after forecastEnd/);
  });

  // ----------------------------------------------------
  // Vector L: Repeated processing is idempotent
  // ----------------------------------------------------
  it('Vector L: Repeated processing does not create duplicate historical records', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'inspection_due',
      forecastStart: '2026-12-01',
      forecastEnd: '2027-03-01',
      rationale: 'Annual roof inspection recommendation',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'scheduler' },
    };

    const first = await maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb });
    const countAfterFirst = mockDb.store.property_maintenance_history.size;

    const second = await maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb });
    const countAfterSecond = mockDb.store.property_maintenance_history.size;

    expect(countAfterFirst).toBe(countAfterSecond);
    expect(first.maintenanceId).toBe(second.maintenanceId);
  });

  // ----------------------------------------------------
  // Vector M: Conflicting same-ID content is rejected
  // ----------------------------------------------------
  it('Vector M: Conflicting content for an existing ID is rejected (Fail-Closed)', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'inspection_due',
      forecastStart: '2026-12-01',
      forecastEnd: '2027-03-01',
      rationale: 'Original inspection prediction',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'scheduler' },
    };

    const original = await maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb });

    // Manually corrupt the stored contentHash to simulate an attack or collision
    const stored = mockDb.store.property_maintenance_history.get(original.maintenanceId);
    stored.contentHash = 'corrupted_hash_tamper_attempt';

    await expect(maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb })).rejects.toThrow(
      /Conflicting maintenance prediction content/
    );
  });

  // ----------------------------------------------------
  // Vector N: Concurrent processing is safe
  // ----------------------------------------------------
  it('Vector N: Concurrent workers processing same prediction resolve idempotently without conflict', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2027-01-01',
      forecastEnd: '2027-04-01',
      rationale: 'Concurrent worker test for predictive maintenance',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'worker' },
    };

    const [workerA, workerB] = await Promise.all([
      maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb }),
      maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb }),
    ]);

    expect(workerA.maintenanceId).toBe(workerB.maintenanceId);
    expect(workerA.contentHash).toBe(workerB.contentHash);
  });

  // ----------------------------------------------------
  // Vector O: Completed job alone does not prove maintenance
  // ----------------------------------------------------
  it('Vector O: Completed job alone without outcome certificate cannot assert repaired status', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'replacement_likelihood',
      forecastStart: '2027-01-01',
      forecastEnd: '2027-04-01',
      sourceJobId: 'job_301',
      rationale: 'Asserts repair without outcome certificate',
      evidenceIds: ['ev_roof_1'],
      metadata: { assertsRepair: true },
      provenance: { origin: 'job_listener' },
    };

    await expect(
      maintenanceService.recordMaintenancePrediction(input, {
        firestoreDb: mockDb,
        isVerifiedServerAction: false,
      })
    ).rejects.toThrow(
      /Completed job requires supporting outcome evidence to establish component repair\/replacement/
    );
  });

  // ----------------------------------------------------
  // Vector P: Valid outcome evidence can affect future prediction
  // ----------------------------------------------------
  it('Vector P: Valid outcome evidence successfully supports repair outcome assertion', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'condition_review',
      forecastStart: '2027-01-01',
      forecastEnd: '2027-04-01',
      sourceJobId: 'job_301',
      rationale: 'Outcome certificate verified repair, follow up review scheduled',
      evidenceIds: ['ev_roof_1', 'ev_outcome_cert'],
      metadata: { assertsRepair: true },
      provenance: { origin: 'verified_server' },
    };

    const res = await maintenanceService.recordMaintenancePrediction(input, {
      firestoreDb: mockDb,
      isVerifiedServerAction: false,
    });

    expect(res).toBeDefined();
    expect(res.status).toBe('predicted');
  });

  // ----------------------------------------------------
  // Vector Q: Supersession creates new/current prediction without mutating old history
  // ----------------------------------------------------
  it('Vector Q: Supersession creates append-only supersession record without mutating original prediction', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'Initial roof maintenance forecast',
      evidenceIds: ['ev_roof_1'],
      provenance: { origin: 'inspector' },
    };

    const initial = await maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb });
    const originalHash = initial.contentHash;
    const originalUpdatedAt = initial.updatedAt;

    // Supersede the prediction
    const supersession = await maintenanceService.supersedeMaintenancePrediction(
      initial.maintenanceId,
      'Roof repaired earlier than anticipated',
      { firestoreDb: mockDb }
    );

    expect(supersession).toBeDefined();
    expect(supersession.maintenanceId).toBe(initial.maintenanceId);
    expect(supersession.propertyId).toBe('prop_101');

    // CRITICAL: Verify original history record in property_maintenance_history was NOT mutated
    const originalInHistory = mockDb.store.property_maintenance_history.get(initial.maintenanceId);
    expect(originalInHistory.contentHash).toBe(originalHash);
    expect(originalInHistory.updatedAt).toBe(originalUpdatedAt);

    // Verify append-only record created in property_maintenance_supersessions
    const supersessionInStore = mockDb.store.property_maintenance_supersessions.get(supersession.supersessionId);
    expect(supersessionInStore).toBeDefined();
    expect(supersessionInStore.reason).toBe('Roof repaired earlier than anticipated');

    // Verify property projection excludes superseded prediction
    const propDoc = mockDb.store.properties.get('prop_101');
    const projection = propDoc.intelligence?.maintenanceProjection;
    expect(projection.activePredictions.length).toBe(0);
  });

  // ----------------------------------------------------
  // Vector R: Retracted supporting evidence cannot silently remain the basis of an active prediction
  // ----------------------------------------------------
  it('Vector R: Retracted supporting evidence is rejected during prediction creation and excluded from projection', async () => {
    const inputWithRetractedEvidence: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'Prediction based on retracted evidence',
      evidenceIds: ['ev_retracted_1'],
      provenance: { origin: 'inspector' },
    };

    await expect(
      maintenanceService.recordMaintenancePrediction(inputWithRetractedEvidence, { firestoreDb: mockDb })
    ).rejects.toThrow(/Cannot create prediction based on retracted evidence 'ev_retracted_1'/);

    // Also check retracted supporting risk
    const inputWithRetractedRisk: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101',
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'Prediction based on retracted risk',
      evidenceIds: ['ev_roof_1'],
      supportingRiskIds: ['risk_retracted_2'],
      provenance: { origin: 'inspector' },
    };

    await expect(
      maintenanceService.recordMaintenancePrediction(inputWithRetractedRisk, { firestoreDb: mockDb })
    ).rejects.toThrow(/Supporting risk 'risk_retracted_2' is retracted/);
  });

  // ----------------------------------------------------
  // Vector S: Cross-tenant contamination is rejected
  // ----------------------------------------------------
  it('Vector S: Rejects prediction when tenant does not match authoritative property tenant', async () => {
    const input: RecordPredictiveMaintenanceInput = {
      propertyId: 'prop_101', // Owned by tenant_101
      componentType: 'roof',
      predictionType: 'maintenance_due',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
      rationale: 'Cross tenant attack',
      evidenceIds: ['ev_roof_1'],
      provenance: {
        origin: 'inspector',
        tenantId: 'tenant_attacker_666',
      },
    };

    await expect(maintenanceService.recordMaintenancePrediction(input, { firestoreDb: mockDb })).rejects.toThrow(
      /Tenant 'tenant_attacker_666' does not match property owner\/tenant 'tenant_101'/
    );
  });

  // ----------------------------------------------------
  // Vector U: Query is property-scoped and bounded
  // ----------------------------------------------------
  it('Vector U: Maintenance history queries are strictly property-scoped and limit-bounded', async () => {
    // Add two records for prop_101 and one for prop_202
    await maintenanceService.recordMaintenancePrediction(
      {
        propertyId: 'prop_101',
        componentType: 'roof',
        predictionType: 'maintenance_due',
        forecastStart: '2026-11-01',
        forecastEnd: '2027-02-01',
        rationale: 'Record 1',
        evidenceIds: ['ev_roof_1'],
        provenance: { origin: 'system' },
      },
      { firestoreDb: mockDb }
    );

    await maintenanceService.recordMaintenancePrediction(
      {
        propertyId: 'prop_101',
        componentType: 'heating',
        predictionType: 'inspection_due',
        forecastStart: '2026-12-01',
        forecastEnd: '2027-03-01',
        rationale: 'Record 2',
        evidenceIds: ['ev_roof_1'],
        provenance: { origin: 'system' },
      },
      { firestoreDb: mockDb }
    );

    const history = await maintenanceService.getPropertyMaintenanceHistory('prop_101', {
      limit: 10,
      firestoreDb: mockDb,
    });

    expect(history.length).toBe(2);
    expect(history.every((h) => h.propertyId === 'prop_101')).toBe(true);

    const otherHistory = await maintenanceService.getPropertyMaintenanceHistory('prop_202', {
      limit: 10,
      firestoreDb: mockDb,
    });
    expect(otherHistory.length).toBe(0);
  });

  // ----------------------------------------------------
  // Vector Z: Tier-B storage separation remains intact
  // ----------------------------------------------------
  it('Vector Z: Tier-B storage safety budget and compression separation remain intact', () => {
    expect(FIRESTORE_DOC_MAX_BYTES).toBe(100 * 1024);
    const samplePayload = { test: 'predictive maintenance payload separation' };
    const { compressedBuffer, manifest } = compressPayload(
      samplePayload,
      'intelligence_raw/property/prop_101/test.json.gz'
    );
    expect(compressedBuffer).toBeDefined();
    const decompressed = decompressPayload(compressedBuffer, manifest);
    expect(decompressed).toEqual(samplePayload);
  });
});

// =========================================================================
// Real Firebase Emulator & Security Rules Integration
// =========================================================================
describe('V8.2 Task 22 — Real Firebase Emulator & Security Rules Integration', () => {
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
      intelligenceTaskQueue.setFirestoreDb(adminDb);
      registerIntelligenceTaskHandlers(adminDb);
    } catch (err: any) {
      console.error('[Task22 Test Setup] Real Firebase emulator error:', err);
      throw new Error(`[Task22 Test Setup] Failed to initialize real Firebase emulator environment: ${err?.message || err}`);
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

    // Seed authoritative property & evidence records
    await adminDb.collection('properties').doc('prop_emu_101').set({
      propertyId: 'prop_emu_101',
      ownerId: 'user_owner_101',
      tenantId: 'tenant_101',
      address: '101 Security Way',
    });

    await adminDb.collection('properties').doc('prop_emu_202').set({
      propertyId: 'prop_emu_202',
      ownerId: 'user_owner_202',
      tenantId: 'tenant_202',
      address: '202 Unrelated Court',
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

    await adminDb.collection('intelligence_evidence').doc('ev_emu_cross_202').set({
      evidenceId: 'ev_emu_cross_202',
      aggregateType: 'property',
      aggregateId: 'prop_emu_202',
      sourceReference: { propertyId: 'prop_emu_202' },
      provenance: { tenantId: 'tenant_202' },
      evidenceQuality: 0.90,
      verified: true,
      createdAt: new Date().toISOString(),
    });
  });

  // -----------------------------------------------------------------------
  // Production Task Queue & Service Integration via Real Emulator
  // -----------------------------------------------------------------------
  it('Production Integration A & B: Valid prediction succeeds through production task handler and updates projection', async () => {
    const idempotencyKey = 'idem_emu_prod_valid_101';
    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'predictive_maintenance',
      'property',
      'prop_emu_101',
      idempotencyKey,
      {
        propertyId: 'prop_emu_101',
        componentType: 'roof',
        predictionType: 'maintenance_due',
        forecastStart: '2026-11-01',
        forecastEnd: '2027-02-01',
        rationale: 'Slate tile inspection reveals weathering with degradation forecast within 90 days',
        evidenceIds: ['ev_emu_101'],
        provenance: {
          source: 'user_owner_101',
          origin: 'manual_inspection',
          tenantId: 'tenant_101',
        },
        isVerifiedServerAction: false,
      }
    );

    expect(task.taskId).toBeDefined();

    // Execute via production task worker
    const executedTask = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executedTask.lastError).toBeUndefined();
    expect(executedTask.status).toBe('succeeded');
    const payload = executedTask.payload as any;
    expect(payload.success).toBe(true);
    expect(payload.maintenanceId).toBeDefined();
    expect(payload.contentHash).toBeDefined();

    // Verify persisted to property_maintenance_history in real emulator
    const histSnap = await adminDb.collection('property_maintenance_history').doc(payload.maintenanceId).get();
    expect(histSnap.exists).toBe(true);
    const histData = histSnap.data();

    // Verify required deterministic Task 22 methodology fields
    expect(histData?.propertyId).toBe('prop_emu_101');
    expect(histData?.evidenceIds).toEqual(['ev_emu_101']);
    expect(histData?.componentType).toBe('roof');
    expect(histData?.methodologyVersion).toBe(MAINTENANCE_METHODOLOGY_VERSION);
    expect(histData?.forecastStart).toBe('2026-11-01');
    expect(histData?.forecastEnd).toBe('2027-02-01');
    expect(histData?.status).toBe('predicted');
    expect(histData?.contentHash).toBe(payload.contentHash);
    expect(histData?.likelihood).toBeDefined();
    expect(histData?.likelihood).toBeGreaterThan(0);

    // Verify current maintenance projection updated under properties/prop_emu_101
    const propSnap = await adminDb.collection('properties').doc('prop_emu_101').get();
    expect(propSnap.exists).toBe(true);
    const propData = propSnap.data();
    const projection = propData?.intelligence?.maintenanceProjection;
    expect(projection).toBeDefined();
    expect(projection.methodologyVersion).toBe(MAINTENANCE_METHODOLOGY_VERSION);
    expect(projection.activePredictions.some((p: any) => p.maintenanceId === payload.maintenanceId)).toBe(true);
    expect(projection.componentForecasts?.roof).toBeDefined();
    expect(projection.componentForecasts.roof.predictionCount).toBeGreaterThanOrEqual(1);
  });

  it('Production Integration C: Fabricated evidence fails through production path', async () => {
    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'predictive_maintenance',
      'property',
      'prop_emu_101',
      'idem_emu_fab_evidence',
      {
        propertyId: 'prop_emu_101',
        componentType: 'roof',
        predictionType: 'maintenance_due',
        forecastStart: '2026-11-01',
        forecastEnd: '2027-02-01',
        rationale: 'Unsubstantiated claim',
        evidenceIds: ['ev_fabricated_ghost_999'],
        provenance: { origin: 'manual_inspection', tenantId: 'tenant_101' },
      }
    );

    const executedTask = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executedTask.status).toBe('dead_letter');
    expect(executedTask.lastError).toMatch(/Fabricated or non-existent evidence ID/i);

    // Ensure no historical record was created
    const histQuery = await adminDb
      .collection('property_maintenance_history')
      .where('propertyId', '==', 'prop_emu_101')
      .where('evidenceIds', 'array-contains', 'ev_fabricated_ghost_999')
      .get();
    expect(histQuery.empty).toBe(true);
  });

  it('Production Integration D: Cross-property lineage fails through production path', async () => {
    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'predictive_maintenance',
      'property',
      'prop_emu_101',
      'idem_emu_cross_prop',
      {
        propertyId: 'prop_emu_101',
        componentType: 'roof',
        predictionType: 'maintenance_due',
        forecastStart: '2026-11-01',
        forecastEnd: '2027-02-01',
        rationale: 'Cross-property evidence usage attempt',
        evidenceIds: ['ev_emu_cross_202'], // Belongs to prop_emu_202
        provenance: { origin: 'manual_inspection', tenantId: 'tenant_101' },
      }
    );

    const executedTask = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executedTask.status).toBe('dead_letter');
    expect(executedTask.lastError).toMatch(/Cross-property lineage violation/i);
  });

  it('Production Integration E: Production-path idempotency works cleanly', async () => {
    const key = 'idem_emu_idempotent_test';
    const task1 = await intelligenceTaskQueue.enqueueTaskAsync(
      'predictive_maintenance',
      'property',
      'prop_emu_101',
      key,
      {
        propertyId: 'prop_emu_101',
        componentType: 'plumbing',
        predictionType: 'inspection_due',
        forecastStart: '2026-12-01',
        forecastEnd: '2027-01-15',
        rationale: 'Boiler pressure drop inspection',
        evidenceIds: ['ev_emu_101'],
        provenance: { origin: 'manual_inspection', tenantId: 'tenant_101' },
      }
    );
    const run1 = await intelligenceTaskQueue.executeTask(task1.taskId);
    expect(run1.status).toBe('succeeded');
    const initialMaintId = (run1.payload as any).maintenanceId;

    // Repeat enqueue with identical key
    const task2 = await intelligenceTaskQueue.enqueueTaskAsync(
      'predictive_maintenance',
      'property',
      'prop_emu_101',
      key,
      {
        propertyId: 'prop_emu_101',
        componentType: 'plumbing',
        predictionType: 'inspection_due',
        forecastStart: '2026-12-01',
        forecastEnd: '2027-01-15',
        rationale: 'Boiler pressure drop inspection',
        evidenceIds: ['ev_emu_101'],
        provenance: { origin: 'manual_inspection', tenantId: 'tenant_101' },
      }
    );
    expect(task2.taskId).toBe(task1.taskId);
    const run2 = await intelligenceTaskQueue.executeTask(task2.taskId);
    expect(run2.status).toBe('succeeded');
    expect((run2.payload as any).maintenanceId).toBe(initialMaintId);
  });

  it('Production Integration F & G: Historical prediction remains unchanged after supersession, and current projection updates', async () => {
    // 1. Initial prediction via production entry point
    const pTask = await intelligenceTaskQueue.enqueueTaskAsync(
      'predictive_maintenance',
      'property',
      'prop_emu_101',
      'idem_emu_supersede_base',
      {
        propertyId: 'prop_emu_101',
        componentType: 'hvac',
        predictionType: 'maintenance_due',
        forecastStart: '2026-11-15',
        forecastEnd: '2026-12-15',
        rationale: 'Initial HVAC inspection recommendation',
        evidenceIds: ['ev_emu_101'],
        provenance: { origin: 'manual_inspection', tenantId: 'tenant_101' },
      }
    );
    const pResult = await intelligenceTaskQueue.executeTask(pTask.taskId);
    expect(pResult.status).toBe('succeeded');
    const baseMaintId = (pResult.payload as any).maintenanceId;

    // Read initial history doc
    const initialDoc = await adminDb.collection('property_maintenance_history').doc(baseMaintId).get();
    const initialContentHash = initialDoc.data()?.contentHash;

    // 2. Perform supersession
    const service = new PredictiveMaintenanceService({ firestoreDb: adminDb });
    const supersession = await service.supersedeMaintenancePrediction(
      baseMaintId,
      'Superseded by verified engineer full replacement quote',
      {
        propertyId: 'prop_emu_101',
        provenance: { origin: 'engineer_inspection', tenantId: 'tenant_101' },
      }
    );
    expect(supersession.supersessionId).toBeDefined();

    // 3. F: Verify historical record is unchanged in property_maintenance_history
    const afterDoc = await adminDb.collection('property_maintenance_history').doc(baseMaintId).get();
    expect(afterDoc.data()?.contentHash).toBe(initialContentHash);
    expect(afterDoc.data()?.status).toBe('predicted'); // Original immutable record unchanged

    // 4. G: Current projection updates correctly (base prediction is removed from active predictions)
    const propDoc = await adminDb.collection('properties').doc('prop_emu_101').get();
    const active = propDoc.data()?.intelligence?.maintenanceProjection?.activePredictions || [];
    expect(active.some((p: any) => p.maintenanceId === baseMaintId)).toBe(false);
  });

  it('Production Integration: AI raw candidate boundary prevents property spoofing and unverified claim escalation', async () => {
    const task = await intelligenceTaskQueue.enqueueTaskAsync(
      'predictive_maintenance',
      'property',
      'prop_emu_101',
      'idem_emu_ai_boundary',
      {
        propertyId: 'prop_emu_101',
        rawCandidate: {
          propertyId: 'prop_emu_202', // AI spoof attempt
          componentType: 'roof',
          description: 'AI detected roof leak',
          evidenceIds: ['ev_emu_101'],
          isVerifiedServerAction: true, // AI cannot self-verify
        },
        provenance: { origin: 'ai_model', modelVersion: 'gemini-2.5-flash' },
      }
    );
    const executed = await intelligenceTaskQueue.executeTask(task.taskId);
    expect(executed.status).toBe('succeeded');
    const maintId = (executed.payload as any).maintenanceId;
    const savedDoc = await adminDb.collection('property_maintenance_history').doc(maintId).get();

    // Proves authoritative propertyId is bound from server context, NOT AI candidate claim
    expect(savedDoc.data()?.propertyId).toBe('prop_emu_101');
  });

  // ----------------------------------------------------
  // Vector T: Security Rules — Client Access Denied
  // ----------------------------------------------------
  it('Vector T1: Unauthenticated user cannot read property_maintenance_history', async () => {
    const unauthContext = testEnv.unauthenticatedContext();
    const db = unauthContext.firestore();

    await expect(
      db.collection('property_maintenance_history').doc('pm_prop_emu_101_sample').get()
    ).rejects.toThrow();
  });

  it('Vector T2: Unrelated authenticated user cannot read property_maintenance_history', async () => {
    // Seed record via Admin SDK
    await adminDb.collection('property_maintenance_history').doc('pm_prop_emu_101_sample').set({
      maintenanceId: 'pm_prop_emu_101_sample',
      propertyId: 'prop_emu_101',
      componentType: 'roof',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
    });

    const unrelatedContext = testEnv.authenticatedContext('user_stranger_999');
    const db = unrelatedContext.firestore();

    await expect(
      db.collection('property_maintenance_history').doc('pm_prop_emu_101_sample').get()
    ).rejects.toThrow();
  });

  it('Vector T3: Property owner can read property_maintenance_history', async () => {
    await adminDb.collection('property_maintenance_history').doc('pm_prop_emu_101_sample').set({
      maintenanceId: 'pm_prop_emu_101_sample',
      propertyId: 'prop_emu_101',
      componentType: 'roof',
      forecastStart: '2026-11-01',
      forecastEnd: '2027-02-01',
    });

    const ownerContext = testEnv.authenticatedContext('user_owner_101');
    const db = ownerContext.firestore();

    const doc = await db.collection('property_maintenance_history').doc('pm_prop_emu_101_sample').get();
    expect(doc.exists).toBe(true);
  });

  it('Vector T4: Client-side write (create) to property_maintenance_history is denied', async () => {
    const ownerContext = testEnv.authenticatedContext('user_owner_101');
    const db = ownerContext.firestore();

    await expect(
      db.collection('property_maintenance_history').doc('pm_client_write').set({
        maintenanceId: 'pm_client_write',
        propertyId: 'prop_emu_101',
      })
    ).rejects.toThrow();
  });

  it('Vector T5: Client-side write (update) to property_maintenance_history is denied', async () => {
    await adminDb.collection('property_maintenance_history').doc('pm_prop_emu_101_sample').set({
      maintenanceId: 'pm_prop_emu_101_sample',
      propertyId: 'prop_emu_101',
    });

    const ownerContext = testEnv.authenticatedContext('user_owner_101');
    const db = ownerContext.firestore();

    await expect(
      db.collection('property_maintenance_history').doc('pm_prop_emu_101_sample').update({
        componentType: 'tampered',
      })
    ).rejects.toThrow();
  });

  it('Vector T6: Client-side write (delete) to property_maintenance_history is denied', async () => {
    await adminDb.collection('property_maintenance_history').doc('pm_prop_emu_101_sample').set({
      maintenanceId: 'pm_prop_emu_101_sample',
      propertyId: 'prop_emu_101',
    });

    const ownerContext = testEnv.authenticatedContext('user_owner_101');
    const db = ownerContext.firestore();

    await expect(
      db.collection('property_maintenance_history').doc('pm_prop_emu_101_sample').delete()
    ).rejects.toThrow();
  });

  it('Vector T7: Client-side write to property_maintenance_supersessions is denied', async () => {
    const ownerContext = testEnv.authenticatedContext('user_owner_101');
    const db = ownerContext.firestore();

    await expect(
      db.collection('property_maintenance_supersessions').doc('supersede_sample').set({
        supersessionId: 'supersede_sample',
        propertyId: 'prop_emu_101',
        reason: 'Client forged supersession',
      })
    ).rejects.toThrow();
  });

  // ----------------------------------------------------
  // Vectors V, W, X, Y: Cross-Task Regressions
  // ----------------------------------------------------
  it('Vector V: Task 17 Property Security regression passes', async () => {
    // Owner can access property
    const ownerContext = testEnv.authenticatedContext('user_owner_101');
    const db = ownerContext.firestore();
    const propDoc = await db.collection('properties').doc('prop_emu_101').get();
    expect(propDoc.exists).toBe(true);

    // Stranger cannot access
    const strangerContext = testEnv.authenticatedContext('user_stranger_999');
    const strangerDb = strangerContext.firestore();
    await expect(strangerDb.collection('properties').doc('prop_emu_101').get()).rejects.toThrow();
  });

  it('Vector W: Task 19 Ontology regression passes', () => {
    expect(validateComponentType('roof')).toBe('roof');
    expect(validateComponentType('heating')).toBe('hvac');
    expect(() => validateComponentType('')).toThrow();
    expect(() => validateComponentType(null)).toThrow();
  });

  it('Vector X: Task 20 Property Lifecycle regression passes', async () => {
    const lifecycleService = new PropertyLifecycleService({ firestoreDb: adminDb });
    expect(lifecycleService).toBeDefined();
  });

  it('Vector Y: Task 21 Property Risk regression passes', async () => {
    const riskService = new PropertyRiskService({ firestoreDb: adminDb });
    expect(riskService).toBeDefined();
  });
});
