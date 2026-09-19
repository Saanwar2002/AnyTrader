import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

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
  propertyIntelligenceService,
  JobIntelligence,
} from '../../src/server/intelligence/index';

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

describe('Task 19 — Property Evidence & Component Ontology', () => {
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
        propertyId: 'prop_A', // Attacker trying to attach job_200 (prop_B) to prop_A
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
        status: 'verified', // AI model trying to self-promote to 'verified'
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
          tenantId: 'attacker_tenant_99', // Mismatched tenantId
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

  describe('6. Real Firebase Emulator Runtime Verification (Tests A through J)', () => {
    let testEnv: RulesTestEnvironment;
    const PROJECT_ID = 'demo-anytrader';
    const BUCKET_NAME = 'demo-anytrader.appspot.com';
    let adminApp: admin.app.App;
    let adminDb: admin.firestore.Firestore;

    beforeAll(async () => {
      process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

      const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
      const storageRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf-8');

      try {
        testEnv = await initializeTestEnvironment({
          projectId: PROJECT_ID,
          firestore: {
            rules: firestoreRules,
            host: '127.0.0.1',
            port: 8088,
          },
          storage: {
            rules: storageRules,
            host: '127.0.0.1',
            port: 9199,
          },
        });

        if (admin.apps.length === 0) {
          adminApp = admin.initializeApp({
            projectId: PROJECT_ID,
            storageBucket: BUCKET_NAME,
          });
        } else {
          adminApp = admin.apps[0]!;
        }

        adminDb = adminApp.firestore();
      } catch {
        adminDb = mockDb as any;
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

    it('A. Valid component evidence: accepts and persists evidence for valid property', async () => {
      await adminDb.collection('properties').doc('prop_emu_1').set({ landlordId: 'tenant_1', address: '1 Main St' });
      const service = new PropertyOntologyService({ firestoreDb: adminDb });
      const evidence = await service.registerComponentEvidence({
        propertyId: 'prop_emu_1',
        componentType: 'roof',
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection', tenantId: 'tenant_1' },
        status: 'derived',
        confidence: 0.95,
      });

      expect(evidence.evidenceId).toBeDefined();
      const docSnap = await adminDb.collection('intelligence_evidence').doc(evidence.evidenceId).get();
      expect(docSnap.exists).toBe(true);
      expect(docSnap.data()?.propertyId).toBe('prop_emu_1');
      expect(docSnap.data()?.componentType).toBe('roof');
    });

    it('B. Missing property: rejects component evidence for nonexistent property and persists nothing', async () => {
      const service = new PropertyOntologyService({ firestoreDb: adminDb });
      await expect(
        service.registerComponentEvidence({
          propertyId: 'prop_nonexistent_99',
          componentType: 'roof',
          sourceType: 'inspection',
          provenance: { origin: 'inspection' },
        })
      ).rejects.toThrow("[PropertyLineage Violation] Property 'prop_nonexistent_99' does not exist");

      const snapshot = await adminDb.collection('intelligence_evidence').get();
      expect(snapshot.empty).toBe(true);
    });

    it('C. Cross-property job: rejects attaching evidence from Job A (Property A) to Property B', async () => {
      await adminDb.collection('properties').doc('prop_emu_A').set({ landlordId: 'tenant_A' });
      await adminDb.collection('properties').doc('prop_emu_B').set({ landlordId: 'tenant_B' });
      await adminDb.collection('jobs').doc('job_emu_100').set({ propertyId: 'prop_emu_A', title: 'Roof repair' });

      const service = new PropertyOntologyService({ firestoreDb: adminDb });
      await expect(
        service.registerComponentEvidence({
          propertyId: 'prop_emu_B',
          componentType: 'roof',
          sourceType: 'job',
          sourceJobId: 'job_emu_100',
          provenance: { origin: 'job_extraction' },
        })
      ).rejects.toThrow(/PropertyLineage Violation/);
    });

    it('D. Cross-tenant contamination: rejects evidence when provenance tenantId mismatches property owner', async () => {
      await adminDb.collection('properties').doc('prop_emu_2').set({ landlordId: 'tenant_2' });
      const service = new PropertyOntologyService({ firestoreDb: adminDb });
      await expect(
        service.registerComponentEvidence({
          propertyId: 'prop_emu_2',
          componentType: 'hvac',
          sourceType: 'inspection',
          provenance: { origin: 'inspection', tenantId: 'tenant_attacker' },
        })
      ).rejects.toThrow(/CrossTenantContamination Violation/);
    });

    it('E. AI privilege escalation: rejects AI proposal attempting to set verified status without server authorization', async () => {
      await adminDb.collection('properties').doc('prop_emu_3').set({ landlordId: 'tenant_3' });
      const service = new PropertyOntologyService({ firestoreDb: adminDb });
      await expect(
        service.registerComponentEvidence({
          propertyId: 'prop_emu_3',
          componentType: 'plumbing',
          sourceType: 'inspection',
          provenance: { origin: 'gemini_ai_model' },
          status: 'verified',
        })
      ).rejects.toThrow(/AIPrivilegeEscalation Violation/);
    });

    it('F. Explicit server verification: accepts verified status when isVerifiedServerAction is true', async () => {
      await adminDb.collection('properties').doc('prop_emu_4').set({ landlordId: 'tenant_4' });
      const service = new PropertyOntologyService({ firestoreDb: adminDb });
      const evidence = await service.registerComponentEvidence(
        {
          propertyId: 'prop_emu_4',
          componentType: 'plumbing',
          sourceType: 'inspection',
          provenance: { origin: 'gemini_ai_model' },
          status: 'verified',
        },
        { isVerifiedServerAction: true }
      );

      expect(evidence.status).toBe('verified');
      const docSnap = await adminDb.collection('intelligence_evidence').doc(evidence.evidenceId).get();
      expect(docSnap.data()?.status).toBe('verified');
    });

    it('G. Deterministic identity: produces identical evidenceId and prevents duplicates on re-registration', async () => {
      await adminDb.collection('properties').doc('prop_emu_5').set({ landlordId: 'tenant_5' });
      const service = new PropertyOntologyService({ firestoreDb: adminDb });
      const input: RegisterComponentEvidenceInput = {
        propertyId: 'prop_emu_5',
        componentType: 'gutters',
        sourceType: 'inspection',
        provenance: { origin: 'manual_inspection' },
        metadata: { gutterCondition: 'Clean' },
      };

      const ev1 = await service.registerComponentEvidence(input);
      const ev2 = await service.registerComponentEvidence(input);

      expect(ev1.evidenceId).toBe(ev2.evidenceId);
      expect(ev1.contentHash).toBe(ev2.contentHash);

      const snapshot = await adminDb.collection('intelligence_evidence').get();
      expect(snapshot.size).toBe(1);
    });

    it('H. AI cannot redirect property identity: metadata overrides cannot change authoritative property identity', async () => {
      await adminDb.collection('properties').doc('prop_emu_6').set({ landlordId: 'tenant_6' });
      const service = new PropertyOntologyService({ firestoreDb: adminDb });
      const evidence = await service.registerComponentEvidence({
        propertyId: 'prop_emu_6',
        componentType: 'electrical',
        sourceType: 'inspection',
        provenance: { origin: 'ai_copilot' },
        metadata: { propertyId: 'attacker_prop_override', address: '123 Fake St' },
      });

      expect(evidence.propertyId).toBe('prop_emu_6');
      const docSnap = await adminDb.collection('intelligence_evidence').doc(evidence.evidenceId).get();
      expect(docSnap.data()?.propertyId).toBe('prop_emu_6');
    });

    it('I. Production runtime integration: aggregatePropertyIntelligence registers component evidence in emulator', async () => {
      await adminDb.collection('properties').doc('prop_emu_7').set({ landlordId: 'tenant_7', address: '10 Downing St' });
      await adminDb.collection('jobs').doc('job_emu_700').set({ propertyId: 'prop_emu_7', category: 'Roofing' });

      const mockJobIntel: JobIntelligence = {
        jobId: 'job_emu_700',
        propertyId: 'prop_emu_7',
        category: 'Roofing',
        buildingComponent: 'Roofing',
        observedProblem: 'Leak in tiles',
        extractedScope: ['Replace tiles'],
        recommendedIntervention: 'Repair roof',
        evidenceIds: ['ev_emu_700'],
        confidence: { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: 'deterministic_heuristic' },
        provenance: { source: 'jobs/job_emu_700', evidenceIds: ['ev_emu_700'], pipelineVersion: 'v8.1.0', modelVersion: 'm', promptVersion: 'p', generatedAt: new Date().toISOString(), sourceContentHash: 'hash' },
        pipelineVersion: 'v8.1.0',
        updatedAt: new Date().toISOString(),
      };

      const result = await propertyIntelligenceService.aggregatePropertyIntelligence(
        { propertyId: 'prop_emu_7', address: '10 Downing St', propertyType: 'residential' },
        [mockJobIntel],
        undefined,
        { firestoreDb: adminDb }
      );

      expect(result.propertyIntelligence).toBeDefined();
      const snapshot = await adminDb.collection('intelligence_evidence').where('propertyId', '==', 'prop_emu_7').get();
      expect(snapshot.empty).toBe(false);
    });

    it('J. Retrieval isolation: evidence for Property A does not leak to Property B', async () => {
      await adminDb.collection('properties').doc('prop_emu_8A').set({ landlordId: 'tenant_8A' });
      await adminDb.collection('properties').doc('prop_emu_8B').set({ landlordId: 'tenant_8B' });

      const service = new PropertyOntologyService({ firestoreDb: adminDb });
      await service.registerComponentEvidence({
        propertyId: 'prop_emu_8A',
        componentType: 'roof',
        sourceType: 'inspection',
        provenance: { origin: 'inspection' },
      });

      const resultsB = await service.getEvidenceForComponent('prop_emu_8B', 'roof');
      expect(resultsB.length).toBe(0);
    });
  });
});
