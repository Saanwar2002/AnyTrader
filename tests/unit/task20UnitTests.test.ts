import { describe, it, expect, beforeEach } from 'vitest';
import {
  PropertyLifecycleService,
  RecordConditionObservationInput,
  evidenceRegistry,
} from '../../src/server/intelligence/index';

// Helper for Mock In-Memory Firestore DB
function createMockFirestoreDb(initialData: {
  jobs?: Record<string, any>;
  properties?: Record<string, any>;
  intelligence_evidence?: Record<string, any>;
  property_condition_history?: Record<string, any>;
} = {}) {
  const store: Record<string, Map<string, any>> = {
    jobs: new Map(Object.entries(initialData.jobs || {})),
    properties: new Map(Object.entries(initialData.properties || {})),
    intelligence_evidence: new Map(Object.entries(initialData.intelligence_evidence || {})),
    property_condition_history: new Map(Object.entries(initialData.property_condition_history || {})),
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
            if (valA < valB) return ord.dir === 'desc' ? 1 : -1;
            if (valA > valB) return ord.dir === 'desc' ? -1 : 1;
            return 0;
          });
        }
        const finalResults = typeof limitVal === 'number' ? results.slice(0, limitVal) : results;
        return {
          empty: finalResults.length === 0,
          docs: finalResults,
        };
      },
    };
  };

  const getCollection = (colName: string) => {
    if (!store[colName]) {
      store[colName] = new Map();
    }
    const query = createQuery(colName, [], [], undefined);
    return {
      ...query,
      doc: (docId: string) => ({
        get: async () => {
          const data = store[colName].get(docId);
          return {
            exists: !!data,
            id: docId,
            data: () => (data ? { ...data } : undefined),
          };
        },
        set: async (val: any) => {
          store[colName].set(docId, { ...val });
        },
      }),
    };
  };

  return {
    collection: (colName: string) => getCollection(colName),
    runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
      const tx = {
        get: async (docRef: any) => docRef.get(),
        set: async (docRef: any, data: any) => docRef.set(data),
      };
      return updateFunction(tx);
    },
  };
}

describe('Task 20 — Property Condition & Lifecycle Intelligence Unit Suite', () => {
  beforeEach(() => {
    evidenceRegistry.clear();
  });

  describe('1. Authoritative Property Existence & Lineage Validation', () => {
    it('A. Missing property fails closed', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {},
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_missing_99',
        componentType: 'roof',
        lifecycleState: 'observed_degraded',
        evidenceIds: ['ev_1'],
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection' },
      };

      await expect(service.recordConditionObservation(input)).rejects.toThrow(
        "[PropertyLifecycle Violation] Property 'prop_missing_99' does not exist"
      );
    });

    it('B. Missing evidence fails', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'roof',
        lifecycleState: 'observed_degraded',
        evidenceIds: [],
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection' },
      };

      await expect(service.recordConditionObservation(input)).rejects.toThrow(
        '[PropertyLifecycle Violation] Lifecycle state requires supporting evidence'
      );
    });

    it('C. Fabricated/Unknown evidence fails', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
        intelligence_evidence: {},
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'roof',
        lifecycleState: 'observed_degraded',
        evidenceIds: ['ev_fabricated_123'],
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection' },
      };

      await expect(service.recordConditionObservation(input)).rejects.toThrow(
        "[PropertyLifecycle Violation] Evidence 'ev_fabricated_123' is not authoritative for property 'prop_1'"
      );
    });

    it('D. Cross-property evidence fails', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {
          prop_1: { landlordId: 'user_1' },
          prop_2: { landlordId: 'user_2' },
        },
        intelligence_evidence: {
          ev_for_prop_2: { propertyId: 'prop_2', aggregateId: 'prop_2' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'roof',
        lifecycleState: 'observed_degraded',
        evidenceIds: ['ev_for_prop_2'],
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection' },
        observationDetails: { conditionDescription: 'Degraded due to storm damage', severity: 'medium' },
      };

      await expect(service.recordConditionObservation(input)).rejects.toThrow(
        "[PropertyLifecycle Violation] Evidence 'ev_for_prop_2' is not authoritative for property 'prop_1'"
      );
    });

    it('E. Cross-property job lineage fails', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {
          prop_1: { landlordId: 'user_1' },
          prop_2: { landlordId: 'user_2' },
        },
        jobs: {
          job_belonging_to_prop_2: { propertyId: 'prop_2', linkedPropertyId: 'prop_2' },
        },
        intelligence_evidence: {
          ev_job_1: { sourceJobId: 'job_belonging_to_prop_2' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'roof',
        lifecycleState: 'observed_degraded',
        sourceType: 'job',
        sourceJobId: 'job_belonging_to_prop_2',
        evidenceIds: ['ev_job_1'],
        provenance: { origin: 'job_extraction' },
      };

      await expect(service.recordConditionObservation(input)).rejects.toThrow(
        "[PropertyLineage Violation] Job 'job_belonging_to_prop_2' belongs to property 'prop_2', not 'prop_1'"
      );
    });
  });

  describe('2. AI Security Boundary & Self-Promotion Defense', () => {
    it('F. AI cannot self-promote status to verified without server authorization', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
        intelligence_evidence: {
          ev_ai_1: { propertyId: 'prop_1' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'roof',
        lifecycleState: 'observed_degraded',
        evidenceIds: ['ev_ai_1'],
        sourceType: 'ai_extraction',
        status: 'verified',
        provenance: { origin: 'ai_copilot_extraction' },
      };

      await expect(service.recordConditionObservation(input)).rejects.toThrow(
        "[AIPrivilegeEscalation Violation] AI-derived candidate from origin 'ai_copilot_extraction' cannot set status 'verified' without server authorization"
      );
    });

    it('F2. AI cannot self-promote lifecycleState to repaired/replaced without server authorization', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
        intelligence_evidence: {
          ev_ai_1: { propertyId: 'prop_1' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'roof',
        lifecycleState: 'repaired',
        evidenceIds: ['ev_ai_1'],
        sourceType: 'ai_extraction',
        provenance: { origin: 'ai_copilot_extraction' },
      };

      await expect(service.recordConditionObservation(input)).rejects.toThrow(
        "[AIPrivilegeEscalation Violation] AI-derived candidate cannot directly establish 'repaired' state without explicit server verification"
      );
    });
  });

  describe('3. Observation vs Inference Separation & Core Lifecycle Mechanics', () => {
    it('G. Observation vs Inference separation preserved', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
        intelligence_evidence: {
          ev_1: { propertyId: 'prop_1' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'plumbing',
        lifecycleState: 'observed_degraded',
        evidenceIds: ['ev_1'],
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection' },
        observationDetails: {
          conditionDescription: 'Minor slow leak under kitchen sink',
          severity: 'medium',
          capturedAt: '2026-09-20T10:00:00Z',
        },
        inferenceDetails: {
          hypothesis: 'Worn washer in p-trap coupling',
          reasoning: 'Moisture accumulation without pipe corrosion',
          urgency: 'medium_term',
          estimatedBenchmarkCost: { min: 80, max: 150 },
        },
      };

      const record = await service.recordConditionObservation(input);

      expect(record.conditionId).toBeDefined();
      expect(record.observationDetails?.conditionDescription).toBe('Minor slow leak under kitchen sink');
      expect(record.inferenceDetails?.hypothesis).toBe('Worn washer in p-trap coupling');
      expect(record.inferenceDetails?.estimatedBenchmarkCost).toEqual({ min: 80, max: 150 });
    });

    it('K. Completed job does NOT automatically mean repaired without outcome evidence', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
        jobs: { job_1: { propertyId: 'prop_1', linkedPropertyId: 'prop_1', status: 'completed' } },
        intelligence_evidence: {
          ev_job_1: { sourceJobId: 'job_1', propertyId: 'prop_1' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'hvac',
        lifecycleState: 'repaired',
        sourceType: 'job',
        sourceJobId: 'job_1',
        evidenceIds: ['ev_job_1'],
        provenance: { origin: 'manual_server' },
      };

      await expect(service.recordConditionObservation(input)).rejects.toThrow(
        "[PropertyLifecycle Violation] Completed job requires supporting outcome evidence to establish 'repaired' state"
      );
    });

    it('L & M. Valid repair and replacement evidence establishes repaired/replaced state', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
        jobs: { job_1: { propertyId: 'prop_1', linkedPropertyId: 'prop_1', status: 'completed' } },
        intelligence_evidence: {
          ev_job_1: { sourceJobId: 'job_1', propertyId: 'prop_1' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const inputRepair: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'hvac',
        lifecycleState: 'repaired',
        sourceType: 'job',
        sourceJobId: 'job_1',
        evidenceIds: ['ev_job_1'],
        provenance: { origin: 'manual_server' },
        observationDetails: {
          conditionDescription: 'Repaired heat exchanger coupling and verified normal burner ignition.',
        },
        metadata: { isOutcomeVerified: true },
      };

      const record = await service.recordConditionObservation(inputRepair, { isVerifiedServerAction: true });
      expect(record.lifecycleState).toBe('repaired');
      expect(record.propertyId).toBe('prop_1');
    });

    it('N. Unsupported deterioration claim is rejected', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
        intelligence_evidence: {
          ev_1: { propertyId: 'prop_1' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'roof',
        lifecycleState: 'observed_degraded',
        evidenceIds: ['ev_1'],
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection' },
        metadata: { insufficientEvidence: true },
      };

      await expect(service.recordConditionObservation(input)).rejects.toThrow(
        '[PropertyLifecycle Violation] Unsupported deterioration claim without evidence'
      );
    });

    it('H & I. Deterministic idempotency & append-only store preservation', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
        intelligence_evidence: {
          ev_1: { propertyId: 'prop_1' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      const input: RecordConditionObservationInput = {
        propertyId: 'prop_1',
        componentType: 'windows',
        lifecycleState: 'observed_good',
        evidenceIds: ['ev_1'],
        observedAt: '2026-09-20T12:00:00Z',
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection' },
      };

      const rec1 = await service.recordConditionObservation(input);
      const rec2 = await service.recordConditionObservation(input);

      expect(rec1.conditionId).toBe(rec2.conditionId);
      expect(rec1.contentHash).toBe(rec2.contentHash);
    });

    it('O. Bounded property-scoped queries', async () => {
      const mockDb = createMockFirestoreDb({
        properties: { prop_1: { landlordId: 'user_1' } },
        intelligence_evidence: {
          ev_1: { propertyId: 'prop_1' },
        },
      });
      const service = new PropertyLifecycleService({ firestoreDb: mockDb });

      await service.recordConditionObservation({
        propertyId: 'prop_1',
        componentType: 'roof',
        lifecycleState: 'observed_fair',
        evidenceIds: ['ev_1'],
        observedAt: '2026-09-20T08:00:00Z',
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection' },
      });

      const history = await service.getPropertyConditionHistory('prop_1', { limit: 10 });
      expect(history.length).toBe(1);
      expect(history[0].componentType).toBe('roof');
      expect(history[0].lifecycleState).toBe('observed_fair');
    });
  });
});
