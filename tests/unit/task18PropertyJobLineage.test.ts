import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveAuthoritativeJobPropertyId,
  jobIntelligenceService,
  propertyIntelligenceService,
  processAICandidateToCanonical,
  TrustedServerContext,
  JobIntelligence,
  evidenceRegistry,
  canonicalizeIntelligence,
  setGlobalRawArtifactBucket,
  evidenceLineageValidator,
  computeSha256
} from '../../src/server/intelligence/index';

// Mock in-memory Firestore database with chaining and transaction support
function createMockFirestoreDb(initialData: {
  jobs?: Record<string, any>;
  properties?: Record<string, any>;
  intelligence_evidence?: Record<string, any>;
  intelligence_jobs?: Record<string, any>;
  intelligence_properties?: Record<string, any>;
  intelligence_extractions?: Record<string, any>;
  intelligence_events?: Record<string, any>;
  canonical_intelligence?: Record<string, any>;
} = {}) {
  const store: Record<string, Map<string, any>> = {
    jobs: new Map(Object.entries(initialData.jobs || {})),
    properties: new Map(Object.entries(initialData.properties || {})),
    intelligence_evidence: new Map(Object.entries(initialData.intelligence_evidence || {})),
    intelligence_jobs: new Map(Object.entries(initialData.intelligence_jobs || {})),
    intelligence_properties: new Map(Object.entries(initialData.intelligence_properties || {})),
    intelligence_extractions: new Map(Object.entries(initialData.intelligence_extractions || {})),
    intelligence_events: new Map(Object.entries(initialData.intelligence_events || {})),
    canonical_intelligence: new Map(Object.entries(initialData.canonical_intelligence || {})),
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
    runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
      const transaction = {
        get: async (docRef: any) => {
          return await docRef.get();
        },
        set: (docRef: any, data: any) => {
          docRef.set(data);
        },
        update: (docRef: any, data: any) => {
          docRef.set(data);
        },
        delete: (docRef: any) => {},
      };
      return await updateFunction(transaction);
    },
    _store: store,
  };
}

describe('Task 18: Authoritative Property ↔ Job Lineage', () => {
  let mockDb: ReturnType<typeof createMockFirestoreDb>;

  beforeEach(() => {
    mockDb = createMockFirestoreDb({
      jobs: {
        job_alpha: {
          id: 'job_alpha',
          propertyId: 'prop_manor_101',
          title: 'Roof repair',
          description: 'Slate tiles displaced on south gable',
        },
        job_beta: {
          id: 'job_beta',
          propertyId: 'prop_manor_101',
          title: 'Guttering replacement',
          description: 'UPVC gutters cracked after storm',
        },
        job_unlinked: {
          id: 'job_unlinked',
          title: 'Freelance consultation without property',
          description: 'Consultation session',
        },
        job_other_prop: {
          id: 'job_other_prop',
          propertyId: 'prop_cottage_999',
          title: 'Window glazing',
          description: 'Cracked single-pane window replacement',
        },
      },
    });

    const mockBucket: any = {
      file: () => ({
        save: async () => {},
        get: async () => [Buffer.from('{}')],
      }),
    };

    setGlobalRawArtifactBucket(mockBucket);
    evidenceRegistry.clear();
    evidenceRegistry.setDb(mockDb as any);
    evidenceLineageValidator.setDb(mockDb as any);
  });

  describe('1. resolveAuthoritativeJobPropertyId', () => {
    it('successfully resolves propertyId from transactional job doc', async () => {
      const propId = await resolveAuthoritativeJobPropertyId(mockDb, 'job_alpha');
      expect(propId).toBe('prop_manor_101');
    });

    it('fails closed when database reference is missing', async () => {
      await expect(resolveAuthoritativeJobPropertyId(null as any, 'job_alpha')).rejects.toThrow(
        '[Lineage Resolution Error] Database reference is required to resolve job property lineage'
      );
    });

    it('fails closed when jobId is empty or invalid', async () => {
      await expect(resolveAuthoritativeJobPropertyId(mockDb, '')).rejects.toThrow(
        '[Lineage Resolution Error] Valid jobId is required to resolve job property lineage'
      );
      await expect(resolveAuthoritativeJobPropertyId(mockDb, '   ')).rejects.toThrow(
        '[Lineage Resolution Error] Valid jobId is required to resolve job property lineage'
      );
    });

    it('fails closed when job does not exist in transactional jobs collection', async () => {
      await expect(resolveAuthoritativeJobPropertyId(mockDb, 'non_existent_job')).rejects.toThrow(
        "[Lineage Resolution Error] Transactional job 'non_existent_job' not found in 'jobs' collection"
      );
    });

    it('fails closed when job exists but has no authoritative propertyId', async () => {
      await expect(resolveAuthoritativeJobPropertyId(mockDb, 'job_unlinked')).rejects.toThrow(
        "[Lineage Resolution Error] Transactional job 'job_unlinked' has no authoritative propertyId"
      );
    });
  });

  describe('2. JobIntelligenceService with Authoritative Lineage', () => {
    it('populates authoritative propertyId during job intelligence derivation', async () => {
      const { jobIntelligence, extraction } = await jobIntelligenceService.deriveJobIntelligence(
        {
          jobId: 'job_alpha',
          title: 'Roof repair',
          description: 'Slate tiles displaced on south gable',
        },
        undefined,
        {
          firestoreDb: mockDb,
          persist: false,
        }
      );

      expect(jobIntelligence.jobId).toBe('job_alpha');
      expect(jobIntelligence.propertyId).toBe('prop_manor_101');
      expect((extraction.structuredCandidate as any).propertyId).toBe('prop_manor_101');
    }, 15000);

    it('strips any untrusted model attempt to spoof propertyId or derivedFromJobIds', async () => {
      const evidenceItem = await evidenceRegistry.register(
        'job',
        'job_alpha',
        'user_description',
        'jobs/job_alpha/description',
        'Slate tiles displaced on south gable',
        {},
        true,
        { documentId: 'job_alpha' }
      );

      const untrustedAICandidate = {
        domain: 'roofing',
        category: 'Roofing & Guttering',
        component: 'Roof',
        propertyId: 'ATTACKER_SPOOFED_PROPERTY',
        derivedFromJobIds: ['SPOOFED_JOB_1', 'SPOOFED_JOB_2'],
        observations: [
          {
            description: 'Displaced slate tiles',
            component: 'Roof',
            evidenceIds: [evidenceItem.evidenceId],
          },
        ],
        inferences: [
          {
            hypothesis: 'Replace displaced slates',
            confidence: 0.9,
            supportingEvidenceIds: [evidenceItem.evidenceId],
            targetComponent: 'Roof',
          },
        ],
        candidateConfidence: 0.9,
      };

      const serverContext: TrustedServerContext = {
        aggregateType: 'job',
        aggregateId: 'job_alpha',
        propertyId: 'prop_manor_101',
        sourceId: 'usr_homeowner_123',
        generatedAt: new Date().toISOString(),
      };

      const { canonical } = await processAICandidateToCanonical(
        untrustedAICandidate,
        serverContext,
        {
          firestoreDb: mockDb,
          persistToStore: false,
        }
      );

      // Model's spoofed propertyId must be replaced by authoritative serverContext.propertyId
      expect(canonical.propertyId).toBe('prop_manor_101');
      expect(canonical.propertyId).not.toBe('ATTACKER_SPOOFED_PROPERTY');
    });
  });

  describe('3. PropertyIntelligenceService Lineage Verification & Cross-Property Defense', () => {
    it('accepts historical jobs belonging to the target property', async () => {
      const evAlpha = await evidenceRegistry.register(
        'job',
        'job_alpha',
        'user_description',
        'jobs/job_alpha/desc',
        'Roof repair',
        {},
        true,
        { documentId: 'job_alpha' }
      );

      const evBeta = await evidenceRegistry.register(
        'job',
        'job_beta',
        'user_description',
        'jobs/job_beta/desc',
        'Gutter replacement',
        {},
        true,
        { documentId: 'job_beta' }
      );

      const job1: JobIntelligence = {
        jobId: 'job_alpha',
        propertyId: 'prop_manor_101',
        category: 'Roofing',
        buildingComponent: 'Roof',
        observedProblem: 'Displaced tiles',
        extractedScope: ['Tile alignment'],
        recommendedIntervention: 'Re-seat slates',
        evidenceIds: [evAlpha.evidenceId],
        confidence: { overall: 0.88, extraction: 0.9, evidenceQuality: 0.85, classification: 0.9, temporalFreshness: 0.85, method: 'deterministic_heuristic' },
        provenance: { source: 'jobs/job_alpha', evidenceIds: [evAlpha.evidenceId], pipelineVersion: 'v8.1.0', modelVersion: 'm', promptVersion: 'p', generatedAt: new Date().toISOString(), sourceContentHash: computeSha256('a') },
        pipelineVersion: 'v8.1.0',
        updatedAt: new Date().toISOString(),
      };

      const job2: JobIntelligence = {
        jobId: 'job_beta',
        propertyId: 'prop_manor_101',
        category: 'Guttering',
        buildingComponent: 'Rainwater Goods',
        observedProblem: 'Cracked gutter',
        extractedScope: ['Gutter replacement'],
        recommendedIntervention: 'Install UPVC channel',
        evidenceIds: [evBeta.evidenceId],
        confidence: { overall: 0.85, extraction: 0.85, evidenceQuality: 0.85, classification: 0.85, temporalFreshness: 0.85, method: 'deterministic_heuristic' },
        provenance: { source: 'jobs/job_beta', evidenceIds: [evBeta.evidenceId], pipelineVersion: 'v8.1.0', modelVersion: 'm', promptVersion: 'p', generatedAt: new Date().toISOString(), sourceContentHash: computeSha256('b') },
        pipelineVersion: 'v8.1.0',
        updatedAt: new Date().toISOString(),
      };

      const { propertyIntelligence } = await propertyIntelligenceService.aggregatePropertyIntelligence(
        {
          propertyId: 'prop_manor_101',
          propertyType: 'Detached',
        },
        [job1, job2],
        undefined,
        {
          firestoreDb: mockDb,
          persist: false,
        }
      );

      expect(propertyIntelligence.propertyId).toBe('prop_manor_101');
      expect(propertyIntelligence.derivedFromJobIds).toEqual(['job_alpha', 'job_beta']);
    }, 15000);

    it('rejects cross-property contamination when a historical job belongs to a different property', async () => {
      const foreignJob: JobIntelligence = {
        jobId: 'job_other_prop',
        propertyId: 'prop_cottage_999', // Belongs to a different property!
        category: 'Glazing',
        buildingComponent: 'Windows',
        observedProblem: 'Cracked pane',
        extractedScope: ['Glass replacement'],
        recommendedIntervention: 'Re-glaze window',
        evidenceIds: ['ev_foreign'],
        confidence: { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: 'deterministic_heuristic' },
        provenance: { source: 'jobs/job_other_prop', evidenceIds: ['ev_foreign'], pipelineVersion: 'v8.1.0', modelVersion: 'm', promptVersion: 'p', generatedAt: new Date().toISOString(), sourceContentHash: computeSha256('foreign') },
        pipelineVersion: 'v8.1.0',
        updatedAt: new Date().toISOString(),
      };

      await expect(
        propertyIntelligenceService.aggregatePropertyIntelligence(
          {
            propertyId: 'prop_manor_101',
            propertyType: 'Detached',
          },
          [foreignJob],
          undefined,
          {
            firestoreDb: mockDb,
            persist: false,
          }
        )
      ).rejects.toThrow(
        "[PropertyLineage Violation] Job 'job_other_prop' belongs to property 'prop_cottage_999', not target property 'prop_manor_101'. Cross-property contamination rejected."
      );
    });

    it('queries historical jobs for a property via getHistoricalJobsForProperty', async () => {
      mockDb._store.intelligence_jobs.set('job_alpha', {
        jobId: 'job_alpha',
        propertyId: 'prop_manor_101',
        category: 'Roofing',
        buildingComponent: 'Roof',
      });
      mockDb._store.intelligence_jobs.set('job_beta', {
        jobId: 'job_beta',
        propertyId: 'prop_manor_101',
        category: 'Guttering',
        buildingComponent: 'Rainwater Goods',
      });
      mockDb._store.intelligence_jobs.set('job_other', {
        jobId: 'job_other',
        propertyId: 'prop_other_456',
        category: 'Electrical',
        buildingComponent: 'Wiring',
      });

      const jobs = await propertyIntelligenceService.getHistoricalJobsForProperty('prop_manor_101', mockDb);
      expect(jobs.length).toBe(2);
      expect(jobs.map((j) => j.jobId).sort()).toEqual(['job_alpha', 'job_beta']);
    });
  });

  describe('4. Canonicalizer Deterministic Content Hashing with Property Lineage', () => {
    it('deterministically binds propertyId into canonical intelligence and content hash', () => {
      const canonical1 = canonicalizeIntelligence({
        aggregateType: 'job',
        aggregateId: 'job_alpha',
        propertyId: 'prop_manor_101',
        domain: 'roofing',
        schemaVersion: '1',
        pipelineVersion: 'v8.1.0',
        modelVersion: 'gemini-2.5-flash',
        promptVersion: 'job_extraction_v8.1',
        observations: [
          {
            observationId: 'obs_1',
            description: 'Displaced tiles',
            component: 'Roof',
            evidenceIds: ['ev_1'],
          },
        ],
        inferences: [
          {
            inferenceId: 'inf_1',
            type: 'recommendation',
            hypothesis: 'Tile re-seating',
            confidence: 0.9,
            supportingEvidenceIds: ['ev_1'],
            targetComponent: 'Roof',
          },
        ],
        evidenceIds: ['ev_1'],
        confidence: { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: 'deterministic_heuristic' },
        provenance: { source: 'jobs/job_alpha', evidenceIds: ['ev_1'], pipelineVersion: 'v8.1.0', modelVersion: 'm', promptVersion: 'p', generatedAt: '2026-09-19T00:00:00.000Z', sourceContentHash: computeSha256('hash1') },
        generatedAt: '2026-09-19T00:00:00.000Z',
      });

      const canonical2 = canonicalizeIntelligence({
        aggregateType: 'job',
        aggregateId: 'job_alpha',
        propertyId: 'prop_DIFFERENT_999',
        domain: 'roofing',
        schemaVersion: '1',
        pipelineVersion: 'v8.1.0',
        modelVersion: 'gemini-2.5-flash',
        promptVersion: 'job_extraction_v8.1',
        observations: [
          {
            observationId: 'obs_1',
            description: 'Displaced tiles',
            component: 'Roof',
            evidenceIds: ['ev_1'],
          },
        ],
        inferences: [
          {
            inferenceId: 'inf_1',
            type: 'recommendation',
            hypothesis: 'Tile re-seating',
            confidence: 0.9,
            supportingEvidenceIds: ['ev_1'],
            targetComponent: 'Roof',
          },
        ],
        evidenceIds: ['ev_1'],
        confidence: { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: 'deterministic_heuristic' },
        provenance: { source: 'jobs/job_alpha', evidenceIds: ['ev_1'], pipelineVersion: 'v8.1.0', modelVersion: 'm', promptVersion: 'p', generatedAt: '2026-09-19T00:00:00.000Z', sourceContentHash: computeSha256('hash1') },
        generatedAt: '2026-09-19T00:00:00.000Z',
      });

      expect(canonical1.propertyId).toBe('prop_manor_101');
      expect(canonical2.propertyId).toBe('prop_DIFFERENT_999');
      // Different property IDs must result in distinct content hashes
      expect(canonical1.contentHash).not.toBe(canonical2.contentHash);
    });
  });
});
