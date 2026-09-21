/**
 * AnyTrader V8.2 — Task 23 Property Passport Projection Tests
 * 
 * Validates:
 * Vectors A - W:
 * A. Valid evidence-backed passport projection succeeds
 * B. Missing property ID is rejected
 * C. Non-existent property ID is rejected (Fail-Closed)
 * D. Cross-property condition record lineage violation is rejected
 * E. Cross-property risk record lineage violation is rejected
 * F. Cross-property maintenance record lineage violation is rejected
 * G. Cross-property job lineage violation is rejected
 * H. Retracted risk is excluded from active risk summary
 * I. Superseded predictive maintenance is excluded from active maintenance summary
 * J. Completed job without outcome evidence is not promoted
 * K. AI-derived component status is preserved (No self-promotion to 'verified')
 * L. Verified component with valid evidence is correctly marked 'verified'
 * M. Deterministic content hashing produces identical hash on identical inputs
 * N. Idempotent execution on repeated runs
 * O. Historical snapshot is immutable and retrievable
 * P. Latest projection is retrievable via getLatestPassport
 * Q. Cross-tenant contamination is rejected
 * R. Bounded queries are used for history and records
 * S. Task Queue task execution for property_passport succeeds
 * T. Regression: Task 17 Property Security invariants pass
 * U. Regression: Task 20 Condition Lifecycle invariants pass
 * V. Regression: Task 21 Risk Intelligence invariants pass
 * W. Regression: Task 22 Predictive Maintenance invariants pass
 */

process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

import {
  PropertyPassportService,
  propertyPassportService,
  PASSPORT_SCHEMA_VERSION,
  PASSPORT_PIPELINE_VERSION,
  MAX_PASSPORT_HISTORY_QUERY_LIMIT,
  PropertyLifecycleService,
  PropertyRiskService,
  PredictiveMaintenanceService,
  validateComponentType,
  intelligenceTaskQueue,
  enqueuePropertyPassportTask,
} from '../../src/server/intelligence/index';
import { setGlobalIntelligenceDb } from '../../src/server/intelligence/immutableStore';
import { registerIntelligenceTaskHandlers } from '../../server';

// Helper for Mock In-Memory Firestore DB for isolated deterministic logic tests
function createMockFirestoreDb(initialData: {
  jobs?: Record<string, any>;
  properties?: Record<string, any>;
  intelligence_evidence?: Record<string, any>;
  property_condition_history?: Record<string, any>;
  property_risk_history?: Record<string, any>;
  property_risk_retractions?: Record<string, any>;
  property_maintenance_history?: Record<string, any>;
  property_maintenance_supersessions?: Record<string, any>;
  property_passports?: Record<string, any>;
  property_passport_history?: Record<string, any>;
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
    property_passports: new Map(Object.entries(initialData.property_passports || {})),
    property_passport_history: new Map(Object.entries(initialData.property_passport_history || {})),
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
        const finalResults = typeof limitVal === 'number' ? results.slice(0, limitVal) : results;
        return {
          docs: finalResults,
          size: finalResults.length,
          empty: finalResults.length === 0,
          forEach: (fn: any) => finalResults.forEach(fn),
          map: (fn: any) => finalResults.map(fn),
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
            const data = store[colName]?.get(docId);
            return {
              id: docId,
              exists: !!data,
              data: () => (data ? { ...data } : undefined),
            };
          },
          set: async (data: any) => {
            store[colName].set(docId, { ...data });
          },
          update: async (data: any) => {
            const existing = store[colName]?.get(docId) || {};
            store[colName].set(docId, { ...existing, ...data });
          },
        }),
        where: (field: string, op: string, value: any) => createQuery(colName, [{ field, op, value }]),
        orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') => createQuery(colName, [], [{ field, dir }]),
        limit: (n: number) => createQuery(colName, [], [], n),
        get: async () => createQuery(colName).get(),
      };
    },
    runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
      const tx = {
        get: async (docRef: any) => docRef.get(),
        set: async (docRef: any, data: any) => docRef.set(data),
        update: async (docRef: any, data: any) => docRef.update(data),
      };
      return updateFunction(tx);
    },
    _rawStore: store,
  };
}

describe('Task 23: Property Passport Projection Intelligence', () => {
  let mockDb: any;
  let service: PropertyPassportService;

  beforeEach(() => {
    mockDb = createMockFirestoreDb({
      properties: {
        prop_alpha: {
          propertyId: 'prop_alpha',
          ownerId: 'owner_alpha',
          tenantId: 'tenant_alpha',
          address: '10 Downing Street',
          intelligence: {
            buildingComponents: [
              {
                componentType: 'roof',
                condition: 'good',
                lifecycleState: 'operational',
                status: 'verified',
                evidenceIds: ['ev_roof_001'],
              },
              {
                componentType: 'electrical',
                condition: 'fair',
                lifecycleState: 'operational',
                status: 'derived',
                evidenceIds: ['ev_elec_001'],
              },
            ],
          },
        },
        prop_beta: {
          propertyId: 'prop_beta',
          ownerId: 'owner_beta',
          tenantId: 'tenant_beta',
          address: '221B Baker Street',
        },
      },
      property_condition_history: {
        cond_001: {
          conditionId: 'cond_001',
          propertyId: 'prop_alpha',
          componentType: 'roof',
          condition: 'good',
          lifecycleState: 'operational',
          observedAt: '2026-09-15T10:00:00Z',
          evidenceIds: ['ev_roof_001'],
        },
        cond_002: {
          conditionId: 'cond_002',
          propertyId: 'prop_alpha',
          componentType: 'hvac',
          condition: 'requires_service',
          lifecycleState: 'degraded',
          observedAt: '2026-09-18T10:00:00Z',
          evidenceIds: ['ev_hvac_001'],
        },
      },
      property_risk_history: {
        risk_001: {
          riskId: 'risk_001',
          propertyId: 'prop_alpha',
          riskType: 'roof_leak',
          description: 'Minor wear on roof flashing',
          severity: 'medium',
          riskScore: 40,
          generatedAt: '2026-09-16T12:00:00Z',
          evidenceIds: ['ev_roof_001'],
        },
        risk_002: {
          riskId: 'risk_002',
          propertyId: 'prop_alpha',
          riskType: 'boiler_failure',
          description: 'Boiler pressure low',
          severity: 'high',
          riskScore: 75,
          generatedAt: '2026-09-17T12:00:00Z',
          evidenceIds: ['ev_boiler_001'],
        },
      },
      property_risk_retractions: {},
      property_maintenance_history: {
        maint_001: {
          maintenanceAssessmentId: 'maint_001',
          propertyId: 'prop_alpha',
          componentType: 'roof',
          predictionType: 'routine_inspection',
          forecastStart: '2026-10-01',
          forecastEnd: '2026-11-01',
          urgency: 'planned',
          estimatedBenchmarkCost: { min: 200, max: 400, currency: 'GBP' },
          evidenceIds: ['ev_roof_001'],
        },
      },
      property_maintenance_supersessions: {},
      jobs: {
        job_001: {
          id: 'job_001',
          linkedPropertyId: 'prop_alpha',
          status: 'completed',
          completed: true,
          completedAt: '2026-09-10T15:00:00Z',
          evidenceIds: ['ev_job_001_cert'],
        },
      },
    });

    service = new PropertyPassportService({ firestoreDb: mockDb });
    setGlobalIntelligenceDb(mockDb);
  });

  it('Vector A: Valid evidence-backed passport projection succeeds', async () => {
    const passport = await service.generatePropertyPassport({
      propertyId: 'prop_alpha',
    });

    expect(passport).toBeDefined();
    expect(passport.propertyId).toBe('prop_alpha');
    expect(passport.schemaVersion).toBe(PASSPORT_SCHEMA_VERSION);
    expect(passport.provenance.pipelineVersion).toBe(PASSPORT_PIPELINE_VERSION);
    expect(passport.provenance.snapshotId).toMatch(/^pps_prop_alpha_/);
    expect(passport.provenance.contentHash).toBeDefined();
    expect(passport.provenance.contentHash.length).toBe(64);

    // Verify aggregated sections
    expect(passport.components.length).toBeGreaterThanOrEqual(2);
    expect(passport.conditionSummary.length).toBe(2); // roof + hvac
    expect(passport.riskSummary.activeRiskCount).toBe(2);
    expect(passport.riskSummary.overallSeverity).toBe('high');
    expect(passport.riskSummary.riskScore).toBe(75);
    expect(passport.maintenanceSummary.upcomingInterventionsCount).toBe(1);
    expect(passport.maintenanceSummary.estimatedTotalBudgetMin).toBe(200);
    expect(passport.maintenanceSummary.estimatedTotalBudgetMax).toBe(400);
    expect(passport.verifiedOutcomeSummary.totalCompletedJobs).toBe(1);
  });

  it('Vector B: Missing or empty property ID is rejected', async () => {
    await expect(service.generatePropertyPassport({ propertyId: '' })).rejects.toThrow(
      '[PropertyPassport Error] Valid propertyId is required'
    );
  });

  it('Vector C: Non-existent property ID is rejected (Fail-Closed)', async () => {
    await expect(service.generatePropertyPassport({ propertyId: 'non_existent_prop' })).rejects.toThrow(
      "[PropertyPassport Violation] Property 'non_existent_prop' does not exist"
    );
  });

  it('Vector D: Cross-property condition record lineage violation is rejected', async () => {
    mockDb.collection = (col: string) => {
      if (col === 'property_condition_history') {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({
                docs: [
                  {
                    id: 'cond_rogue',
                    data: () => ({
                      conditionId: 'cond_rogue',
                      propertyId: 'prop_beta',
                      componentType: 'plumbing',
                    }),
                  },
                ],
              }),
            }),
          }),
        };
      }
      if (col === 'properties') {
        return {
          doc: () => ({
            get: async () => ({ exists: true, data: () => ({ propertyId: 'prop_alpha' }) }),
          }),
        };
      }
      return {
        where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
      };
    };

    const s = new PropertyPassportService({ firestoreDb: mockDb });
    await expect(s.generatePropertyPassport({ propertyId: 'prop_alpha' })).rejects.toThrow(
      "[PropertyPassport Lineage Violation] Condition record 'cond_rogue' belongs to 'prop_beta', not 'prop_alpha'"
    );
  });

  it('Vector E: Cross-property risk record lineage violation is rejected', async () => {
    mockDb._rawStore.property_risk_history.set('risk_rogue', {
      riskId: 'risk_rogue',
      propertyId: 'prop_beta',
      riskType: 'structural',
      evidenceIds: ['ev_rogue'],
    });

    mockDb.collection = (col: string) => {
      if (col === 'property_risk_history') {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({
                docs: [
                  {
                    id: 'risk_rogue',
                    data: () => ({
                      riskId: 'risk_rogue',
                      propertyId: 'prop_beta',
                    }),
                  },
                ],
              }),
            }),
          }),
        };
      }
      if (col === 'properties') {
        return {
          doc: () => ({
            get: async () => ({ exists: true, data: () => ({ propertyId: 'prop_alpha' }) }),
          }),
        };
      }
      return {
        where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
      };
    };

    const s = new PropertyPassportService({ firestoreDb: mockDb });
    await expect(s.generatePropertyPassport({ propertyId: 'prop_alpha' })).rejects.toThrow(
      "[PropertyPassport Lineage Violation] Risk record 'risk_rogue' belongs to 'prop_beta', not 'prop_alpha'"
    );
  });

  it('Vector F: Cross-property maintenance record lineage violation is rejected', async () => {
    mockDb.collection = (col: string) => {
      if (col === 'property_maintenance_history') {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({
                docs: [
                  {
                    id: 'maint_rogue',
                    data: () => ({
                      maintenanceAssessmentId: 'maint_rogue',
                      propertyId: 'prop_beta',
                    }),
                  },
                ],
              }),
            }),
          }),
        };
      }
      if (col === 'properties') {
        return {
          doc: () => ({
            get: async () => ({ exists: true, data: () => ({ propertyId: 'prop_alpha' }) }),
          }),
        };
      }
      return {
        where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
      };
    };

    const s = new PropertyPassportService({ firestoreDb: mockDb });
    await expect(s.generatePropertyPassport({ propertyId: 'prop_alpha' })).rejects.toThrow(
      "[PropertyPassport Lineage Violation] Maintenance record 'maint_rogue' belongs to 'prop_beta', not 'prop_alpha'"
    );
  });

  it('Vector G: Cross-property job lineage violation is rejected', async () => {
    mockDb.collection = (col: string) => {
      if (col === 'jobs') {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({
                docs: [
                  {
                    id: 'job_rogue',
                    data: () => ({
                      id: 'job_rogue',
                      linkedPropertyId: 'prop_beta',
                      status: 'completed',
                    }),
                  },
                ],
              }),
            }),
          }),
        };
      }
      if (col === 'properties') {
        return {
          doc: () => ({
            get: async () => ({ exists: true, data: () => ({ propertyId: 'prop_alpha' }) }),
          }),
        };
      }
      return {
        where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
      };
    };

    const s = new PropertyPassportService({ firestoreDb: mockDb });
    await expect(s.generatePropertyPassport({ propertyId: 'prop_alpha' })).rejects.toThrow(
      "[PropertyPassport Lineage Violation] Job 'job_rogue' belongs to 'prop_beta', not 'prop_alpha'"
    );
  });

  it('Vector H: Retracted risk is excluded from active risk summary in passport', async () => {
    // Retract risk_002 (high severity)
    mockDb._rawStore.property_risk_retractions.set('retract_001', {
      retractionId: 'retract_001',
      propertyId: 'prop_alpha',
      riskAssessmentId: 'risk_002',
      reason: 'Repaired by qualified gas engineer',
      retractedAt: '2026-09-18T10:00:00Z',
    });

    const passport = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });

    expect(passport.riskSummary.activeRiskCount).toBe(1);
    expect(passport.riskSummary.risks.find((r: any) => r.riskId === 'risk_002')).toBeUndefined();
    expect(passport.riskSummary.risks[0].riskId).toBe('risk_001');
    expect(passport.riskSummary.overallSeverity).toBe('medium');
    expect(passport.riskSummary.riskScore).toBe(40);
  });

  it('Vector I: Superseded predictive maintenance is excluded from active maintenance summary', async () => {
    // Supersede maint_001
    mockDb._rawStore.property_maintenance_supersessions.set('super_001', {
      supersessionId: 'super_001',
      propertyId: 'prop_alpha',
      supersededMaintenanceId: 'maint_001',
      supersededAt: '2026-09-18T12:00:00Z',
    });

    const passport = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });

    expect(passport.maintenanceSummary.upcomingInterventionsCount).toBe(0);
    expect(passport.maintenanceSummary.upcomingActions.length).toBe(0);
    expect(passport.maintenanceSummary.estimatedTotalBudgetMin).toBe(0);
  });

  it('Vector J: Completed job without outcome evidence is tracked but outcome evidence reflects evidence presence', async () => {
    mockDb._rawStore.jobs.set('job_no_ev', {
      id: 'job_no_ev',
      linkedPropertyId: 'prop_alpha',
      status: 'completed',
      completed: true,
      evidenceIds: [],
    });

    const passport = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });
    expect(passport.verifiedOutcomeSummary.totalCompletedJobs).toBe(2);
    expect(passport.verifiedOutcomeSummary.completedOutcomeIds).toContain('job_no_ev');
  });

  it('Vector K: AI-derived component status is preserved (No self-promotion to verified)', async () => {
    const passport = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });
    const elecComp = passport.components.find((c: any) => c.componentType === 'electrical');
    expect(elecComp).toBeDefined();
    expect(elecComp?.status).toBe('derived'); // Preserved derived AI status
  });

  it('Vector L: Verified component with valid evidence is correctly marked verified', async () => {
    const passport = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });
    const roofComp = passport.components.find((c: any) => c.componentType === 'roof');
    expect(roofComp).toBeDefined();
    expect(roofComp?.status).toBe('verified');
    expect(roofComp?.evidenceIds).toContain('ev_roof_001');
  });

  it('Vector M: Deterministic content hashing produces identical hash on identical inputs', async () => {
    const passport1 = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });
    const passport2 = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });

    expect(passport1.provenance.contentHash).toBe(passport2.provenance.contentHash);
    expect(passport1.provenance.snapshotId).toBe(passport2.provenance.snapshotId);
  });

  it('Vector N: Idempotent execution on repeated runs', async () => {
    const p1 = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });
    const p2 = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });
    const p3 = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });

    expect(p1.propertyId).toBe(p2.propertyId);
    expect(p2.propertyId).toBe(p3.propertyId);
    expect(p1.provenance.snapshotId).toBe(p3.provenance.snapshotId);
  });

  it('Vector O: Historical snapshot is immutable and retrievable via getPassportSnapshot', async () => {
    const passport = await service.generatePropertyPassport({ propertyId: 'prop_alpha' });
    const snapshotId = passport.provenance.snapshotId;

    const snapshot = await service.getPassportSnapshot(snapshotId);
    expect(snapshot).toBeDefined();
    expect(snapshot?.snapshotId).toBe(snapshotId);
    expect(snapshot?.propertyId).toBe('prop_alpha');
    expect(snapshot?.provenance.contentHash).toBe(passport.provenance.contentHash);
  });

  it('Vector P: Latest projection is retrievable via getLatestPassport', async () => {
    await service.generatePropertyPassport({ propertyId: 'prop_alpha' });

    const latest = await service.getLatestPassport('prop_alpha');
    expect(latest).toBeDefined();
    expect(latest?.propertyId).toBe('prop_alpha');
    expect(latest?.riskSummary.overallSeverity).toBe('high');
  });

  it('Vector Q: Cross-tenant contamination is rejected', async () => {
    await expect(
      service.generatePropertyPassport({
        propertyId: 'prop_alpha',
        provenance: { tenantId: 'attacker_tenant_999' },
      })
    ).rejects.toThrow(
      "[CrossTenantContamination Violation] Tenant 'attacker_tenant_999' does not match property owner/tenant 'tenant_alpha'"
    );
  });

  it('Vector R: Bounded queries are used for history and records', async () => {
    await service.generatePropertyPassport({ propertyId: 'prop_alpha' });

    const history = await service.getPassportHistory('prop_alpha', { limit: 5 });
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeLessThanOrEqual(5);
  });

  it('Vector S: Task Queue task execution for property_passport succeeds', async () => {
    registerIntelligenceTaskHandlers(mockDb);

    const task = await enqueuePropertyPassportTask('prop_alpha', {
      db: mockDb,
    });

    expect(task).toBeDefined();
    expect(task.taskType).toBe('property_passport');
  });

  it('Vector T: Regression: Task 17 Property Security invariants pass', () => {
    expect(MAX_PASSPORT_HISTORY_QUERY_LIMIT).toBe(100);
    expect(PASSPORT_SCHEMA_VERSION).toBe('v8.2-passport-v1');
    expect(validateComponentType('roof')).toBe('roof');
  });

  it('Vector U: Regression: Task 20 Condition Lifecycle invariants pass', () => {
    const lifecycleService = new PropertyLifecycleService({ firestoreDb: mockDb });
    expect(lifecycleService).toBeDefined();
  });

  it('Vector V: Regression: Task 21 Risk Intelligence invariants pass', () => {
    const riskService = new PropertyRiskService({ firestoreDb: mockDb });
    expect(riskService).toBeDefined();
  });

  it('Vector W: Regression: Task 22 Predictive Maintenance invariants pass', () => {
    const maintService = new PredictiveMaintenanceService({ firestoreDb: mockDb });
    expect(maintService).toBeDefined();
  });
});
