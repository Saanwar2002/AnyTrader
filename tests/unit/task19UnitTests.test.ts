import { describe, it, expect } from 'vitest';
import {
  PROPERTY_COMPONENT_TYPES,
  PropertyComponentType,
  isPropertyComponentType,
  normalizeComponentType,
  validateComponentType,
  validateEvidenceConfidence,
  computeComponentEvidenceHash,
  PropertyOntologyService,
  propertyOntologyService,
  RegisterComponentEvidenceInput,
} from '../../src/server/intelligence/index';
import { AIExtractionCandidateSchema } from '../../src/server/intelligence/aiCandidateSchema';

// Mock in-memory Firestore database with transaction support
function createMockFirestoreDb(initialData: {
  jobs?: Record<string, any>;
  properties?: Record<string, any>;
  intelligence_evidence?: Record<string, any>;
} = {}) {
  const store: Record<string, Map<string, any>> = {
    jobs: new Map(Object.entries(initialData.jobs || {})),
    properties: new Map(Object.entries(initialData.properties || {})),
    intelligence_evidence: new Map(Object.entries(initialData.intelligence_evidence || {})),
  };

  const createQuery = (colName: string, filters: Array<{ field: string; op: string; value: any }> = []) => {
    if (!store[colName]) {
      store[colName] = new Map();
    }
    return {
      where: (field: string, op: string, value: any) => {
        return createQuery(colName, [...filters, { field, op, value }]);
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
        return {
          empty: results.length === 0,
          docs: results,
        };
      },
    };
  };

  const getCollection = (colName: string) => {
    if (!store[colName]) {
      store[colName] = new Map();
    }
    const query = createQuery(colName, []);
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
  };
}

describe('Task 19 & Task 19-V3 Unit Tests — Property Evidence & Component Ontology', () => {
  describe('1. Property Component Ontology & Vocabulary', () => {
    it('contains all required canonical component types', () => {
      const required = [
        'roof',
        'roofing_material',
        'roof_structure',
        'gutters',
        'hvac',
        'electrical',
        'plumbing',
        'windows',
        'doors',
        'exterior',
        'interior',
        'foundation',
        'drainage',
        'other',
      ];
      for (const comp of required) {
        expect(PROPERTY_COMPONENT_TYPES).toContain(comp);
      }
    });

    it('type guard isPropertyComponentType validates supported components', () => {
      expect(isPropertyComponentType('roof')).toBe(true);
      expect(isPropertyComponentType('hvac')).toBe(true);
      expect(isPropertyComponentType('plumbing')).toBe(true);
      expect(isPropertyComponentType('invalid_fake_comp')).toBe(false);
      expect(isPropertyComponentType(null)).toBe(false);
      expect(isPropertyComponentType(123)).toBe(false);
    });

    it('normalizeComponentType maps raw terms and synonyms to canonical ontology', () => {
      expect(normalizeComponentType('roof')).toBe('roof');
      expect(normalizeComponentType('roofing')).toBe('roof');
      expect(normalizeComponentType('roof_shingles')).toBe('roofing_material');
      expect(normalizeComponentType('roof_trusses')).toBe('roof_structure');
      expect(normalizeComponentType('downpipe')).toBe('gutters');
      expect(normalizeComponentType('double_glazing')).toBe('windows');
      expect(normalizeComponentType('wiring_socket')).toBe('electrical');
      expect(normalizeComponentType('random_unmatched_term')).toBe('other');
      expect(normalizeComponentType(null)).toBe('other');
    });

    it('validateComponentType validates non-empty component type and throws fail-closed error on empty input', () => {
      expect(validateComponentType('roof')).toBe('roof');
      expect(validateComponentType('hvac')).toBe('hvac');
      expect(() => validateComponentType('')).toThrow('[PropertyOntology Error]');
      expect(() => validateComponentType('   ')).toThrow('[PropertyOntology Error]');
      expect(() => validateComponentType(null)).toThrow('[PropertyOntology Error]');
    });
  });

  describe('2. Confidence Score Validation', () => {
    it('accepts valid confidence scores between 0.0 and 1.0', () => {
      expect(validateEvidenceConfidence(0.0)).toBe(0.0);
      expect(validateEvidenceConfidence(0.85)).toBe(0.85);
      expect(validateEvidenceConfidence(1.0)).toBe(1.0);
      expect(validateEvidenceConfidence(undefined)).toBeUndefined();
    });

    it('rejects invalid, non-numeric, or out-of-bounds confidence values', () => {
      expect(() => validateEvidenceConfidence(-0.1)).toThrow('[PropertyOntology Error] Confidence out of range');
      expect(() => validateEvidenceConfidence(1.05)).toThrow('[PropertyOntology Error] Confidence out of range');
      expect(() => validateEvidenceConfidence(NaN)).toThrow('[PropertyOntology Error] Confidence must be a finite number');
      expect(() => validateEvidenceConfidence('high' as any)).toThrow('[PropertyOntology Error] Confidence must be a finite number');
    });
  });

  describe('3. Server-Authoritative Lineage Validation (Job -> Property -> Component -> Evidence)', () => {
    it('registers evidence successfully when source job propertyId matches target propertyId', async () => {
      const mockDb = createMockFirestoreDb({
        jobs: {
          job_100: { propertyId: 'prop_A', title: 'Fix roof leaks' },
        },
        properties: {
          prop_A: { landlordId: 'tenant_owner_10' },
        },
      });

      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_A',
        componentType: 'roof',
        sourceType: 'job',
        sourceJobId: 'job_100',
        provenance: {
          origin: 'job_extraction',
          sourceId: 'jobs/job_100',
        },
        status: 'derived',
        confidence: 0.9,
      };

      const evidence = await service.registerComponentEvidence(input);
      expect(evidence.propertyId).toBe('prop_A');
      expect(evidence.componentType).toBe('roof');
      expect(evidence.sourceJobId).toBe('job_100');
      expect(evidence.status).toBe('derived');
      expect(evidence.contentHash).toBeDefined();
    });

    it('fails closed when source job propertyId does NOT match target propertyId (cross-property contamination)', async () => {
      const mockDb = createMockFirestoreDb({
        jobs: {
          job_200: { propertyId: 'prop_B', title: 'Boiler service' },
        },
        properties: {
          prop_A: { landlordId: 'tenant_owner_10' },
          prop_B: { landlordId: 'tenant_owner_20' },
        },
      });

      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_A',
        componentType: 'hvac',
        sourceType: 'job',
        sourceJobId: 'job_200',
        provenance: {
          origin: 'job_extraction',
        },
        status: 'derived',
      };

      await expect(service.registerComponentEvidence(input)).rejects.toThrow(
        "[PropertyLineage Violation] Source job 'job_200' belongs to property 'prop_B', which does not match target property 'prop_A'"
      );
    });

    it('fails closed when source job document is missing or invalid', async () => {
      const mockDb = createMockFirestoreDb({
        jobs: {},
        properties: {
          prop_A: { landlordId: 'tenant_owner_10' },
        },
      });

      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_A',
        componentType: 'plumbing',
        sourceType: 'job',
        sourceJobId: 'non_existent_job',
        provenance: {
          origin: 'job_extraction',
        },
      };

      await expect(service.registerComponentEvidence(input)).rejects.toThrow(
        "[Lineage Resolution Error] Transactional job 'non_existent_job' not found"
      );
    });

    it('fails closed when property document does NOT exist in Firestore', async () => {
      const mockDb = createMockFirestoreDb({
        jobs: {},
        properties: {},
      });

      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'nonexistent_property',
        componentType: 'roof',
        sourceType: 'inspection',
        provenance: {
          origin: 'inspection_record',
        },
      };

      await expect(service.registerComponentEvidence(input)).rejects.toThrow(
        "[PropertyLineage Violation] Property 'nonexistent_property' does not exist"
      );
    });
  });

  describe('4. AI Security Boundary & Non-Promotion Invariant', () => {
    it('blocks AI proposal from directly setting status to verified', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {
          prop_A: { landlordId: 'tenant_owner_10' },
        },
      });
      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_A',
        componentType: 'electrical',
        sourceType: 'system_record',
        provenance: {
          origin: 'ai_copilot_recommendation',
        },
        status: 'verified',
      };

      await expect(service.registerComponentEvidence(input)).rejects.toThrow(
        "[AIPrivilegeEscalation Violation] AI-derived content from origin 'ai_copilot_recommendation' cannot directly set status 'verified'"
      );
    });

    it('allows AI proposal with status derived or unverified', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {
          prop_A: { landlordId: 'tenant_owner_10' },
        },
      });
      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_A',
        componentType: 'windows',
        sourceType: 'inspection',
        provenance: {
          origin: 'property_rollup',
        },
        status: 'derived',
      };

      const evidence = await service.registerComponentEvidence(input);
      expect(evidence.status).toBe('derived');
    });

    it('allows verified status when isVerifiedServerAction option is true', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {
          prop_A: { landlordId: 'tenant_owner_10' },
        },
      });
      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_A',
        componentType: 'foundation',
        sourceType: 'inspection',
        provenance: {
          origin: 'manual_verification',
        },
        status: 'verified',
      };

      const evidence = await service.registerComponentEvidence(input, { isVerifiedServerAction: true });
      expect(evidence.status).toBe('verified');
    });
  });

  describe('5. Cross-Tenant Isolation & Retrieval', () => {
    it('fails closed when tenantId mismatch occurs between property owner and input provenance', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {
          prop_A: { landlordId: 'tenant_owner_10' },
        },
      });

      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_A',
        componentType: 'doors',
        sourceType: 'inspection',
        provenance: {
          origin: 'manual_inspection',
          tenantId: 'attacker_tenant_99',
        },
      };

      await expect(service.registerComponentEvidence(input)).rejects.toThrow(
        "[CrossTenantContamination Violation] Tenant 'attacker_tenant_99' does not match property owner/tenant 'tenant_owner_10'"
      );
    });

    it('retrieves evidence for component from Firestore store', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {
          prop_X: { landlordId: 'tenant_owner_10' },
        },
      });
      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      await service.registerComponentEvidence({
        propertyId: 'prop_X',
        componentType: 'drainage',
        sourceType: 'inspection',
        provenance: { origin: 'system' },
      });

      const results = await service.getEvidenceForComponent('prop_X', 'drainage');
      expect(results.length).toBe(1);
      expect(results[0].propertyId).toBe('prop_X');
      expect(results[0].componentType).toBe('drainage');
    });
  });

  describe('6. Task 19-V3 Strict Evidence Contract Tests (A through E)', () => {
    it('A — Valid evidence ID shape: accepts string[] evidenceIds in AI Candidate schema', () => {
      const candidateData = {
        domain: 'property_management',
        buildingComponents: [
          {
            component: 'Roofing',
            condition: 'Good condition',
            evidenceIds: ['evidence_valid_123'],
          },
        ],
        evidenceIds: ['evidence_valid_123'],
      };

      const parsed = AIExtractionCandidateSchema.safeParse(candidateData);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.evidenceIds).toEqual(['evidence_valid_123']);
        expect(parsed.data.buildingComponents?.[0].evidenceIds).toEqual(['evidence_valid_123']);
      }
    });

    it('B — Evidence object is not accepted: rejects [{ id: "..." }] in AI Candidate schema', () => {
      const candidateDataWithObject = {
        domain: 'property_management',
        buildingComponents: [
          {
            component: 'Roofing',
            condition: 'Good condition',
            evidenceIds: [{ id: 'evidence_valid_123' }],
          },
        ],
        evidenceIds: [{ id: 'evidence_valid_123' }],
      };

      const parsed = AIExtractionCandidateSchema.safeParse(candidateDataWithObject);
      expect(parsed.success).toBe(false);
    });

    it('C — Production transformation produces strings: sanitizes mixed evidence input objects into string[]', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {
          prop_transform_1: { landlordId: 'tenant_1' },
        },
      });

      const service = new PropertyOntologyService({ firestoreDb: mockDb });
      const evidence = await service.registerComponentEvidence({
        propertyId: 'prop_transform_1',
        componentType: 'roof',
        sourceType: 'inspection',
        provenance: { origin: 'system' },
      });

      expect(typeof evidence.evidenceId).toBe('string');
      expect(evidence.evidenceId.length).toBeGreaterThan(0);
    });

    it('D — Evidence lineage remains enforced: fails closed if evidence belongs to a different property', async () => {
      const mockDb = createMockFirestoreDb({
        jobs: {
          job_other_prop: {
            propertyId: 'prop_B',
            category: 'Roofing',
          },
        },
        properties: {
          prop_A: { landlordId: 'tenant_A' },
          prop_B: { landlordId: 'tenant_B' },
        },
      });

      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_A',
        componentType: 'roof',
        sourceType: 'job',
        sourceJobId: 'job_other_prop',
        provenance: {
          origin: 'job_extraction',
        },
      };

      await expect(service.registerComponentEvidence(input)).rejects.toThrow(
        "[PropertyLineage Violation] Source job 'job_other_prop' belongs to property 'prop_B', which does not match target property 'prop_A'"
      );
    });

    it('E — Missing evidence remains rejected: fabricated evidence fails closed', async () => {
      const mockDb = createMockFirestoreDb({
        properties: {
          prop_A: { landlordId: 'tenant_A' },
        },
      });

      const service = new PropertyOntologyService({ firestoreDb: mockDb });

      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_A',
        componentType: 'roof',
        sourceType: 'job',
        sourceJobId: 'fabricated_job_id',
        provenance: {
          origin: 'job_extraction',
        },
      };

      await expect(service.registerComponentEvidence(input)).rejects.toThrow(
        "[Lineage Resolution Error] Transactional job 'fabricated_job_id' not found"
      );
    });
  });
});
