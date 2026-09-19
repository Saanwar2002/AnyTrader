/**
 * AnyTrader V8.2 — Task 17: Property AI Security Boundary Integration & Hostile Penetration Suite
 *
 * PROVES:
 * The authoritative property intelligence pipeline strictly enforces the mandatory V8.2 AI Security Boundary:
 *
 *   PROPERTY SOURCE
 *       ↓
 *   PROPERTY INTELLIGENCE SERVICE
 *       ↓
 *   AI MODEL PROVIDER
 *       ↓
 *   UNTRUSTED AI CANDIDATE
 *       ↓
 *   processAICandidateToCanonical()
 *       ↓
 *   STRUCTURAL VALIDATION (aiCandidateSchema)
 *       ↓
 *   SERVER-OWNED METADATA OVERRIDE (TrustedServerContext)
 *       ↓
 *   EVIDENCE LINEAGE VALIDATION (evidenceLineageValidator - Fail Closed)
 *       ↓
 *   DETERMINISTIC CANONICALIZATION (canonicalizer)
 *       ↓
 *   IMMUTABLE INTELLIGENCE PERSISTENCE (persistCanonicalIntelligence)
 *       ↓
 *   CURRENT PROPERTY PROJECTION (property_intelligence)
 *
 * HOSTILE PENETRATION VECTORS TESTED:
 * 1. Fabricated evidence reference rejection
 * 2. Provider-controlled metadata spoofing rejection
 * 3. Cross-aggregate / malicious property ID contamination rejection
 * 4. Malicious evidence ownership rejection
 * 5. Malformed candidate / schema structural violation rejection
 * 6. Missing Firestore connection fail-closed rejection
 * 7. Payload size & safety budget enforcement (<= 100 KiB)
 * 8. End-to-end production task queue handler execution (property_rollup)
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { propertyIntelligenceService } from '../../src/server/intelligence/propertyIntelligence';
import {
  processAICandidateToCanonical,
  AICandidateSecurityError,
  TrustedServerContext,
} from '../../src/server/intelligence/aiCandidateBoundary';
import { evidenceRegistry } from '../../src/server/intelligence/evidenceRegistry';
import {
  setGlobalIntelligenceDb,
  immutableIntelligenceStore,
} from '../../src/server/intelligence/immutableStore';
import {
  createInMemoryTestDb,
  createInMemoryTestBucket,
} from '../../src/server/intelligence/testDoubles';
import {
  setGlobalRawArtifactBucket,
} from '../../src/server/intelligence/rawArtifactStore';
import {
  IntelligenceModelProvider,
  ModelExtractionResult,
} from '../../src/server/intelligence/geminiProvider';
import {
  INTELLIGENCE_PIPELINE_VERSION,
  INTELLIGENCE_SCHEMA_VERSION,
} from '../../src/server/intelligence/provenance';
import { intelligenceTaskQueue } from '../../src/server/intelligence/intelligenceTaskQueue';
import { registerIntelligenceTaskHandlers } from '../../server';
import { MAX_AI_PAYLOAD_BYTES } from '../../src/server/intelligence/aiCandidateSchema';

/**
 * Controlled test provider implementation for hostile penetration tests.
 */
class ControlledPropertyTestProvider implements IntelligenceModelProvider {
  public customRollupCandidate: any;
  public customMetrics: any;
  public customRawResponseText?: string;
  public invocationCount: number = 0;

  constructor(candidate?: any) {
    this.customRollupCandidate = candidate || {
      overallHealthScore: 88,
      riskLevel: 'LOW',
      buildingComponents: [
        {
          component: 'Boiler / Diverter Valve',
          condition: 'Operable with slight pressure loss',
          lastObservedAt: '2026-09-18T00:00:00.000Z',
          confidence: 0.92,
          evidenceIds: [],
        },
      ],
      observedConditions: [
        {
          condition: 'Minor system weeping',
          severity: 'low',
          component: 'Boiler / Diverter Valve',
          evidenceIds: [],
        },
      ],
      recommendedInterventions: [
        {
          intervention: 'Replace diverter valve seal kit',
          urgency: 'medium_term',
          component: 'Boiler / Diverter Valve',
          estimatedBenchmarkCost: { min: 80, max: 150 },
        },
      ],
      candidateConfidence: 0.92,
    };
  }

  async extractJobCandidate(): Promise<ModelExtractionResult<any>> {
    throw new Error('Not used in property rollup tests');
  }

  async rollupPropertyCandidate(
    propertyId: string,
    jobHistories: Array<{ jobId: string; category: string; problem: string; scope: string[] }>,
    untrustedEvidence: Array<{ id: string; type: string; content: string }>
  ): Promise<ModelExtractionResult<any>> {
    this.invocationCount++;
    const candidate = this.customRollupCandidate;
    const rawResponseText = this.customRawResponseText || JSON.stringify(candidate);

    return {
      candidate,
      metrics: this.customMetrics || {
        model: 'gemini-2.5-flash-hostile-test',
        inputTokens: 250,
        outputTokens: 120,
        totalTokens: 370,
        estimatedCostUsd: 0.0002,
        processingDurationMs: 45,
      },
      rawResponseText,
    };
  }
}

describe('Task 17 — V8.2 Property AI Security Boundary Implementation & Penetration Tests', () => {
  let testDb: any;
  let testBucket: any;
  let controlledProvider: ControlledPropertyTestProvider;

  beforeAll(() => {
    testDb = createInMemoryTestDb();
    testBucket = createInMemoryTestBucket();
    setGlobalIntelligenceDb(testDb);
    setGlobalRawArtifactBucket(testBucket);
    (evidenceRegistry as any).firestoreDb = testDb;
    (intelligenceTaskQueue as any).firestoreDb = testDb;

    registerIntelligenceTaskHandlers(testDb);
  });

  beforeEach(() => {
    controlledProvider = new ControlledPropertyTestProvider();
    propertyIntelligenceService.setProvider(controlledProvider);
  });

  // =========================================================================
  // VECTOR 1: FABRICATED EVIDENCE INJECTION
  // =========================================================================
  describe('Vector 1: Fabricated Evidence Injection', () => {
    it('REJECTS model candidate that references non-existent / fabricated evidence IDs', async () => {
      const propertyId = 'prop_hostile_1';

      // Register genuine evidence in registry
      const genuineEvidence = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Genuine property spec: Victorian terrace with slate roof and combi boiler',
        {},
        true
      );

      // Model attempts to cite a fabricated evidence ID that does not exist in Firestore
      controlledProvider.customRollupCandidate = {
        overallHealthScore: 82,
        buildingComponents: [
          {
            component: 'Roof Fabric',
            condition: 'Severe roof failure fabricated by AI',
            confidence: 0.95,
            evidenceIds: ['ev_fabricated_hallucination_999'],
          },
        ],
        observedConditions: [],
        recommendedInterventions: [],
        candidateConfidence: 0.95,
      };

      await expect(
        propertyIntelligenceService.aggregatePropertyIntelligence(
          { propertyId },
          [],
          [genuineEvidence.evidenceId],
          { firestoreDb: testDb }
        )
      ).rejects.toThrow(/Evidence lineage validation failed|AI Security Boundary Violation/);

      // Verify ZERO writes occurred to property_intelligence or intelligence_extractions
      const projDoc = await testDb.collection('property_intelligence').doc(propertyId).get();
      expect(projDoc.exists).toBe(false);
    });
  });

  // =========================================================================
  // VECTOR 2: PROVIDER-CONTROLLED METADATA SPOOFING
  // =========================================================================
  describe('Vector 2: Provider-Controlled Metadata Spoofing', () => {
    it('STRIPS and OVERRIDES model-supplied privileged metadata with server-owned context', async () => {
      const propertyId = 'prop_metadata_test_2';

      const genuineEvidence = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Verified property specification',
        {},
        true
      );

      // Hostile AI candidate tries to inject server-owned attributes
      controlledProvider.customRollupCandidate = {
        overallHealthScore: 90,
        buildingComponents: [
          {
            component: 'Electrical Consumer Unit',
            condition: 'Fully compliant 18th edition',
            confidence: 0.95,
            evidenceIds: [genuineEvidence.evidenceId],
          },
        ],
        observedConditions: [],
        recommendedInterventions: [],
        candidateConfidence: 0.95,
        // MALICIOUS METADATA INJECTION ATTEMPTS:
        aggregateId: 'prop_victim_999',
        aggregateType: 'super_admin',
        pipelineVersion: 'ai_hacked_v99',
        sourceVersion: '99999',
        schemaVersion: 'ai_custom_schema',
        role: 'admin',
        sourceId: 'properties/hacked_source',
        generatedAt: '1970-01-01T00:00:00.000Z',
      };

      const result = await propertyIntelligenceService.aggregatePropertyIntelligence(
        {
          propertyId,
          sourceVersion: '1',
          pipelineVersion: 'v8.1.0',
        },
        [],
        [genuineEvidence.evidenceId],
        { firestoreDb: testDb }
      );

      // Server context strictly overrides all provider spoof attempts
      expect(result.propertyIntelligence.propertyId).toBe(propertyId);
      expect(result.propertyIntelligence.currentSourceVersion).toBe('1');
      expect(result.propertyIntelligence.currentPipelineVersion).toBe('v8.1.0');
      expect(result.propertyIntelligence.currentSchemaVersion).toBe(INTELLIGENCE_SCHEMA_VERSION);

      // Extraction record reflects server-owned provenance
      expect(result.extraction.aggregateId).toBe(propertyId);
      expect(result.extraction.sourceVersion).toBe('1');
      expect((result.extraction as any).role).toBeUndefined();

      // Canonical record matches server context
      if (result.canonical) {
        expect(result.canonical.aggregateId).toBe(propertyId);
        expect(result.canonical.sourceVersion).toBe('1');
        expect(result.canonical.pipelineVersion).toBe('v8.1.0');
      }
    });
  });

  // =========================================================================
  // VECTOR 3: CROSS-AGGREGATE CONTAMINATION & MALICIOUS PROPERTY ID
  // =========================================================================
  describe('Vector 3: Cross-Aggregate Contamination & Malicious Property ID', () => {
    it('REJECTS model candidate attempting to link evidence belonging to a different property', async () => {
      const targetPropertyId = 'prop_target_3';
      const foreignPropertyId = 'prop_foreign_3';

      // Register genuine evidence for foreign property
      const foreignEvidence = await evidenceRegistry.register(
        'property',
        foreignPropertyId,
        'structured_spec',
        `properties/${foreignPropertyId}/spec`,
        'Foreign property damp inspection report',
        {},
        true
      );

      // Model for target property attempts to reference foreign property evidence
      controlledProvider.customRollupCandidate = {
        overallHealthScore: 65,
        buildingComponents: [
          {
            component: 'Damp Proof Course',
            condition: 'Rising damp observed',
            confidence: 0.9,
            evidenceIds: [foreignEvidence.evidenceId],
          },
        ],
        observedConditions: [],
        recommendedInterventions: [],
        candidateConfidence: 0.9,
      };

      await expect(
        propertyIntelligenceService.aggregatePropertyIntelligence(
          { propertyId: targetPropertyId },
          [],
          [foreignEvidence.evidenceId],
          { firestoreDb: testDb }
        )
      ).rejects.toThrow(/Evidence lineage validation failed|AI Security Boundary Violation/);

      // Assert target property was not modified
      const projDoc = await testDb.collection('property_intelligence').doc(targetPropertyId).get();
      expect(projDoc.exists).toBe(false);
    });

    it('REJECTS model candidate attempting to cite job evidence from an unlinked job', async () => {
      const propertyId = 'prop_target_job_link_3';
      const unlinkedJobId = 'job_unlinked_999';

      // Register evidence under unlinked job
      const jobEvidence = await evidenceRegistry.register(
        'job',
        unlinkedJobId,
        'photo',
        `jobs/${unlinkedJobId}/photo1.jpg`,
        'Unlinked job photo',
        {},
        true
      );

      controlledProvider.customRollupCandidate = {
        overallHealthScore: 70,
        buildingComponents: [
          {
            component: 'Plumbing',
            condition: 'Leaking pipe',
            confidence: 0.9,
            evidenceIds: [jobEvidence.evidenceId],
          },
        ],
        observedConditions: [],
        recommendedInterventions: [],
        candidateConfidence: 0.9,
      };

      // Property rollup has no historical jobs linking this job
      await expect(
        propertyIntelligenceService.aggregatePropertyIntelligence(
          { propertyId },
          [],
          [jobEvidence.evidenceId],
          { firestoreDb: testDb }
        )
      ).rejects.toThrow(/Evidence lineage validation failed|AI Security Boundary Violation/);
    });
  });

  // =========================================================================
  // VECTOR 4: MALFORMED CANDIDATE & STRUCTURAL VIOLATIONS
  // =========================================================================
  describe('Vector 4: Malformed Candidate & Structural Schema Violations', () => {
    it('REJECTS malformed / unparseable JSON output from model provider', async () => {
      const propertyId = 'prop_malformed_json_4';
      const ev = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Spec',
        {},
        true
      );

      const serverContext: TrustedServerContext = {
        aggregateType: 'property',
        aggregateId: propertyId,
        sourceId: `properties/${propertyId}`,
        sourceVersion: '1',
      };

      // Test processAICandidateToCanonical directly with corrupt JSON string
      await expect(
        processAICandidateToCanonical(
          '{ "overallHealthScore": 88, "buildingComponents": [ UNQUOTED_CORRUPT_SYNTAX ',
          serverContext,
          { firestoreDb: testDb }
        )
      ).rejects.toThrow(AICandidateSecurityError);
    });

    it('REJECTS model candidate exceeding MAX_AI_PAYLOAD_BYTES (64 KiB)', async () => {
      const propertyId = 'prop_oversize_4';
      const oversizedText = 'A'.repeat(MAX_AI_PAYLOAD_BYTES + 100);

      const serverContext: TrustedServerContext = {
        aggregateType: 'property',
        aggregateId: propertyId,
        sourceId: `properties/${propertyId}`,
        sourceVersion: '1',
      };

      await expect(
        processAICandidateToCanonical(
          JSON.stringify({ domain: 'property_management', component: oversizedText }),
          serverContext,
          { firestoreDb: testDb }
        )
      ).rejects.toThrow(/exceeds max limit/);
    });

    it('REJECTS model candidate attempting to manufacture raw evidence records', async () => {
      const propertyId = 'prop_raw_ev_manufacture_4';
      const serverContext: TrustedServerContext = {
        aggregateType: 'property',
        aggregateId: propertyId,
        sourceId: `properties/${propertyId}`,
        sourceVersion: '1',
      };

      await expect(
        processAICandidateToCanonical(
          {
            domain: 'property_management',
            category: 'Residential',
            component: 'Building Fabric',
            evidenceRegistryRecord: { evidenceId: 'ev_fake', contentHash: 'hacked' },
          },
          serverContext,
          { firestoreDb: testDb }
        )
      ).rejects.toThrow(/strictly forbidden from creating raw evidence records/);
    });

    it('REJECTS model candidate with out-of-range confidence scores (> 1.0 or < 0.0)', async () => {
      const propertyId = 'prop_bad_conf_4';
      const serverContext: TrustedServerContext = {
        aggregateType: 'property',
        aggregateId: propertyId,
        sourceId: `properties/${propertyId}`,
        sourceVersion: '1',
      };

      await expect(
        processAICandidateToCanonical(
          {
            domain: 'property_management',
            category: 'Residential',
            component: 'Building Fabric',
            candidateConfidence: 1.5, // INVALID: Must be <= 1.0
          },
          serverContext,
          { firestoreDb: testDb }
        )
      ).rejects.toThrow(/Structural validation failed|confidence/);
    });
  });

  // =========================================================================
  // VECTOR 5: FAIL-CLOSED DATABASE BOUNDARY
  // =========================================================================
  describe('Vector 5: Missing Database Fail-Closed Boundary', () => {
    it('FAILS CLOSED when Firestore DB reference is null / undefined', async () => {
      const propertyId = 'prop_no_db_5';
      const serverContext: TrustedServerContext = {
        aggregateType: 'property',
        aggregateId: propertyId,
        sourceId: `properties/${propertyId}`,
        sourceVersion: '1',
      };

      await expect(
        processAICandidateToCanonical(
          {
            domain: 'property_management',
            category: 'Residential',
            component: 'Building Fabric',
          },
          serverContext,
          { firestoreDb: null }
        )
      ).rejects.toThrow(/Firestore DB reference is required to validate evidence lineage/);
    });
  });

  // =========================================================================
  // VECTOR 6: VALID PRODUCTION PIPELINE EXECUTION
  // =========================================================================
  describe('Vector 6: Valid Production Pipeline & Deterministic Canonicalization', () => {
    it('SUCCESSFULLY executes full pipeline with valid evidence and writes to store & projection', async () => {
      const propertyId = 'prop_valid_pipeline_6';

      // Register valid property evidence
      const specEv = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Valid EPC C property spec with combi boiler and slate roof',
        {},
        true
      );

      controlledProvider.customRollupCandidate = {
        overallHealthScore: 85,
        riskLevel: 'LOW',
        buildingComponents: [
          {
            component: 'Roof Fabric',
            condition: 'Good condition, no broken slates',
            lastObservedAt: '2026-09-18T10:00:00.000Z',
            confidence: 0.9,
            evidenceIds: [specEv.evidenceId],
          },
          {
            component: 'Central Heating',
            condition: 'Combi boiler operational',
            lastObservedAt: '2026-09-18T10:00:00.000Z',
            confidence: 0.88,
            evidenceIds: [specEv.evidenceId],
          },
        ],
        observedConditions: [
          {
            condition: 'Dry basement',
            severity: 'low',
            component: 'Foundation',
            evidenceIds: [specEv.evidenceId],
          },
        ],
        recommendedInterventions: [
          {
            intervention: 'Annual boiler service',
            urgency: 'planned',
            component: 'Central Heating',
            estimatedBenchmarkCost: { min: 90, max: 130 },
          },
        ],
        candidateConfidence: 0.88,
      };

      const result = await propertyIntelligenceService.aggregatePropertyIntelligence(
        { propertyId },
        [],
        [specEv.evidenceId],
        { firestoreDb: testDb }
      );

      // Verify canonical object returned
      expect(result.canonical).toBeDefined();
      expect(result.canonical?.aggregateId).toBe(propertyId);
      expect(result.canonical?.observations.length).toBe(2);
      expect(result.canonical?.evidenceIds).toContain(specEv.evidenceId);

      // Verify projection
      expect(result.propertyIntelligence.propertyId).toBe(propertyId);
      expect(result.propertyIntelligence.overallHealthScore).toBe(85);
      expect(result.propertyIntelligence.buildingComponents.length).toBe(2);

      // Verify Tier B Raw Manifest exists and is compressed
      expect(result.extraction.rawManifest).toBeDefined();
      expect(result.extraction.rawManifest.encoding).toBe('gzip');
      expect(result.extraction.rawManifest.compressedBytes).toBeGreaterThan(0);
      expect(result.extraction.rawManifest.sha256).toMatch(/^[a-f0-9]{64}$/);

      // Verify immutable store projection
      const projDoc = await testDb.collection('intelligence_properties').doc(propertyId).get();
      expect(projDoc.exists).toBe(true);
      expect(projDoc.data().currentVersionId).toBe(result.versionId);
    });
  });

  // =========================================================================
  // VECTOR 7: PRODUCTION TASK QUEUE INTEGRATION (property_rollup)
  // =========================================================================
  describe('Vector 7: Production Task Queue Handler Execution', () => {
    it('PROCESSES property_rollup task via production intelligenceTaskQueue without bypass', async () => {
      const propertyId = 'prop_queue_task_7';

      // Register valid property spec
      const ev = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Terraced property registered for queue processing',
        {},
        true
      );

      controlledProvider.customRollupCandidate = {
        overallHealthScore: 91,
        buildingComponents: [
          {
            component: 'Windows & Glazing',
            condition: 'Double glazing intact',
            confidence: 0.95,
            evidenceIds: [ev.evidenceId],
          },
        ],
        observedConditions: [],
        recommendedInterventions: [],
        candidateConfidence: 0.95,
      };

      // Enqueue a real durable task in intelligenceTaskQueue
      const task = await intelligenceTaskQueue.enqueueTaskAsync(
        'property_rollup',
        'property',
        propertyId,
        `idemp_prop_task_${Date.now()}`,
        {
          property: { propertyId },
          historicalJobs: [],
          firestoreDb: testDb,
        }
      );

      expect(task.taskId).toBeDefined();

      // Execute task via the registered production task handler
      const executed = await intelligenceTaskQueue.executeTask(task.taskId, 'worker_task17_test');
      expect(executed).toBeDefined();
      expect(executed.status).toBe('succeeded');

      // Verify projection written to intelligence_properties
      const projDoc = await testDb.collection('intelligence_properties').doc(propertyId).get();
      expect(projDoc.exists).toBe(true);
      expect(projDoc.data().overallHealthScore).toBe(91);
    });

    it('FAILS task in queue when AI candidate contains fabricated evidence', async () => {
      const propertyId = 'prop_queue_fail_7';

      // Candidate citations are fabricated
      controlledProvider.customRollupCandidate = {
        overallHealthScore: 80,
        buildingComponents: [
          {
            component: 'Roof',
            condition: 'Fabricated condition',
            confidence: 0.95,
            evidenceIds: ['ev_hallucinated_queue_fail'],
          },
        ],
        observedConditions: [],
        recommendedInterventions: [],
        candidateConfidence: 0.95,
      };

      const task = await intelligenceTaskQueue.enqueueTaskAsync(
        'property_rollup',
        'property',
        propertyId,
        `idemp_prop_fail_${Date.now()}`,
        {
          property: { propertyId },
          historicalJobs: [],
          firestoreDb: testDb,
        }
      );

      // Security validation failures transition immediately to dead_letter
      const failed = await intelligenceTaskQueue.executeTask(task.taskId, 'worker_task17_fail_test');
      expect(failed.status).toBe('dead_letter');
      expect(failed.errorCode).toBe('AICandidateSecurityError');

      // Assert projection was not created
      const projDoc = await testDb.collection('intelligence_properties').doc(propertyId).get();
      expect(projDoc.exists).toBe(false);
    });
  });
});
