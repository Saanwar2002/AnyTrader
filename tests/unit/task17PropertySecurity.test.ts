/**
 * AnyTrader V8.2 — Task 17-V: Property AI Security Boundary Verification
 *
 * PROVES:
 * The authoritative property intelligence pipeline strictly enforces the mandatory V8.2 AI Security Boundary
 * across the REAL Firebase Emulator (Firestore + Storage):
 *
 *   Property Task / Source
 *       ↓
 *   PropertyIntelligenceService
 *       ↓
 *   Controlled IntelligenceModelProvider
 *       ↓
 *   Untrusted Candidate
 *       ↓
 *   processAICandidateToCanonical()
 *       ↓
 *   Structural Validation (aiCandidateSchema - Zod .strict())
 *       ↓
 *   Server-Owned Metadata Override (TrustedServerContext)
 *       ↓
 *   Evidence Lineage Validation (evidenceLineageValidator - Fail Closed against Firestore)
 *       ↓
 *   Deterministic Canonicalization (canonicalizer)
 *       ↓
 *   Immutable Intelligence Persistence (persistCanonicalIntelligence)
 *       ↓
 *   Authoritative Intelligence Projection (intelligence_properties)
 *
 * PENETRATION VECTORS TESTED ON REAL EMULATOR:
 * 1. Valid Provider-Generated Candidate Execution & Server-Owned Metadata Verification
 * 2. Provider-Controlled Metadata Spoofing & Attacker Aggregate Isolation Rejection
 * 3. Fabricated Evidence Reference Rejection (Fail-Closed)
 * 4. Cross-Property Evidence Contamination Rejection (Property A vs Property B)
 * 5. Malformed Candidate & Structural Schema Violation Rejection
 * 6. Provider Invocation Assertions (provider.invocationCount === 1)
 * 7. Immutable Persistence & Idempotent Re-Execution (Zero Duplicate Records)
 * 8. Missing Firestore Connection Fail-Closed Boundary
 * 9. Production Durable Task Queue Integration (property_rollup Handler Execution)
 */

process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

import {
  PropertyIntelligenceService,
  createPropertyIntelligenceService,
  propertyIntelligenceService,
} from '../../src/server/intelligence/propertyIntelligence';
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
  setGlobalRawArtifactBucket,
  RawArtifactBucketLike,
} from '../../src/server/intelligence/rawArtifactStore';
import {
  IntelligenceModelProvider,
  ModelExtractionResult,
} from '../../src/server/intelligence/geminiProvider';
import {
  INTELLIGENCE_PIPELINE_VERSION,
  INTELLIGENCE_SCHEMA_VERSION,
} from '../../src/server/intelligence/provenance';
import { evidenceLineageValidator } from '../../src/server/intelligence/lineageValidator';
import { intelligenceTaskQueue } from '../../src/server/intelligence/intelligenceTaskQueue';
import { registerIntelligenceTaskHandlers } from '../../server';
import { MAX_AI_PAYLOAD_BYTES } from '../../src/server/intelligence/aiCandidateSchema';

/**
 * Controlled test provider implementation for hostile penetration tests.
 * Proves that the real production property pipeline calls the provider.
 */
class ControlledPropertyIntelligenceProvider implements IntelligenceModelProvider {
  public invocationCount: number = 0;
  public customMetrics: any;
  public customRawResponseText?: string;

  constructor(public customRollupCandidate: unknown) {}

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
    const rawResponseText = this.customRawResponseText || (typeof candidate === 'string' ? candidate : JSON.stringify(candidate));

    return {
      candidate,
      metrics: this.customMetrics || {
        model: 'gemini-2.5-flash',
        inputTokens: 320,
        outputTokens: 160,
        totalTokens: 480,
        estimatedCostUsd: 0.0003,
        processingDurationMs: 38,
      },
      rawResponseText,
    };
  }
}

describe('Task 17-V — Property AI Security Boundary Final Verification (Real Firebase Emulator)', () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = 'demo-anytrader';
  const BUCKET_NAME = 'demo-anytrader.appspot.com';
  let adminApp: admin.app.App;
  let adminBucket: RawArtifactBucketLike;
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
      adminBucket = adminApp.storage().bucket(BUCKET_NAME) as unknown as RawArtifactBucketLike;

      setGlobalIntelligenceDb(adminDb as any);
      setGlobalRawArtifactBucket(adminBucket);
      evidenceRegistry.setDb(adminDb as any);
      evidenceLineageValidator.setDb(adminDb as any);
      (intelligenceTaskQueue as any).firestoreDb = adminDb;

      registerIntelligenceTaskHandlers(adminDb as any);
    } catch (err: any) {
      throw new Error(
        `[Task17 Emulator Setup] Failed to initialize real Firebase emulator environment: ${err?.message || err}`
      );
    }
  });

  afterAll(async () => {
    setGlobalRawArtifactBucket(null);
    setGlobalIntelligenceDb(null);
    evidenceRegistry.setDb(null);
    evidenceLineageValidator.setDb(null);
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.clearStorage();
    }
    evidenceRegistry.clear();
    evidenceRegistry.setDb(adminDb as any);
    evidenceLineageValidator.setDb(adminDb as any);
    setGlobalIntelligenceDb(adminDb as any);
    setGlobalRawArtifactBucket(adminBucket);
  });

  const createValidCandidate = (evidenceId: string) => ({
    domain: 'property_management',
    category: 'Residential',
    component: 'Building Fabric',
    overallHealthScore: 85,
    buildingComponents: [
      {
        component: 'Roof Fabric',
        condition: 'Good condition, no broken slates',
        lastObservedAt: '2026-09-18T10:00:00.000Z',
        confidence: 0.9,
        evidenceIds: [evidenceId],
      },
      {
        component: 'Central Heating',
        condition: 'Combi boiler operational',
        lastObservedAt: '2026-09-18T10:00:00.000Z',
        confidence: 0.88,
        evidenceIds: [evidenceId],
      },
    ],
    observedConditions: [
      {
        condition: 'Dry basement',
        severity: 'low',
        component: 'Foundation',
        evidenceIds: [evidenceId],
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
    evidenceIds: [evidenceId],
  });

  // =========================================================================
  // 1. REAL PRODUCTION PIPELINE & VALID CANDIDATE PERSISTENCE
  // =========================================================================
  describe('1. Real Production Pipeline & Valid Candidate Persistence', () => {
    it('persists a valid provider-generated property candidate through the real production pipeline', async () => {
      const propertyId = 'prop_valid_real_prod_1';

      // Register valid property spec evidence in real emulator Firestore
      const specEv = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Valid EPC C property spec with combi boiler and slate roof',
        {},
        true
      );

      const validCandidate = createValidCandidate(specEv.evidenceId);
      const provider = new ControlledPropertyIntelligenceProvider(validCandidate);

      const service = createPropertyIntelligenceService({
        firestoreDb: adminDb,
        provider,
      });

      const result = await service.aggregatePropertyIntelligence(propertyId);

      // Verify provider was actually invoked exactly once
      expect(provider.invocationCount).toBe(1);

      // Verify returned canonical object
      expect(result.canonical).toBeDefined();
      expect(result.canonical?.aggregateId).toBe(propertyId);
      expect(result.canonical?.observations.length).toBe(2);
      expect(result.canonical?.evidenceIds).toContain(specEv.evidenceId);

      // Query real emulator Firestore for authoritative records
      const propDoc = await adminDb.collection('intelligence_properties').doc(propertyId).get();
      expect(propDoc.exists).toBe(true);
      const propData = propDoc.data()!;
      expect(propData.propertyId).toBe(propertyId);
      expect(propData.overallHealthScore).toBe(85);
      expect(propData.buildingComponents.length).toBe(2);

      // Query real emulator Firestore for extraction document
      const extractionDoc = await adminDb.collection('intelligence_extractions').doc(result.versionId).get();
      expect(extractionDoc.exists).toBe(true);
      const extractionData = extractionDoc.data()!;
      expect(extractionData.aggregateId).toBe(propertyId);
      expect(extractionData.aggregateType).toBe('property');

      // Verify Tier B Raw Artifact was persisted into emulator Storage
      expect(result.extraction.rawManifest).toBeDefined();
      expect(result.extraction.rawManifest.encoding).toBe('gzip');
      expect(result.extraction.rawManifest.compressedBytes).toBeGreaterThan(0);
      expect(result.extraction.rawManifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('verifies that server-owned metadata overrides model claims and is persisted correctly', async () => {
      const propertyId = 'prop_server_metadata_1';

      const specEv = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Property specification for metadata verification',
        { sourceVersion: '2' },
        true
      );

      const validCandidate = createValidCandidate(specEv.evidenceId);
      const provider = new ControlledPropertyIntelligenceProvider(validCandidate);

      const service = createPropertyIntelligenceService({
        firestoreDb: adminDb,
        provider,
      });

      const result = await service.aggregatePropertyIntelligence({
        propertyId,
        sourceVersion: '2',
        pipelineVersion: 'v8.1.0',
      });

      expect(provider.invocationCount).toBe(1);

      // Query emulator-persisted document
      const propDoc = await adminDb.collection('intelligence_properties').doc(propertyId).get();
      expect(propDoc.exists).toBe(true);
      const data = propDoc.data()!;

      // Provider must NOT control aggregateType, aggregateId, pipelineVersion, schemaVersion, provenance
      expect(data.propertyId).toBe(propertyId);
      expect(data.currentSourceVersion).toBe('2');
      expect(data.currentPipelineVersion).toBe('v8.1.0');
      expect(data.currentSchemaVersion).toBe(INTELLIGENCE_SCHEMA_VERSION);
      expect(data.provenance).toBeDefined();
      expect(data.provenance.source).toBe(`properties/${propertyId}`);
      expect(data.provenance.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // =========================================================================
  // 2. REQUIRED MALICIOUS CANDIDATE & ATTACKER AGGREGATE ISOLATION
  // =========================================================================
  describe('2. Required Malicious Candidate Test (Section 10)', () => {
    it('rejects candidate attempting to hijack server-owned metadata and prevents attacker aggregate writes', async () => {
      const propertyId = 'prop_victim_10';
      const attackerAggregateId = 'ATTACKER_PROPERTY_ID';

      const genuineEvidence = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Victim property genuine spec',
        {},
        true
      );

      const validCandidate = createValidCandidate(genuineEvidence.evidenceId);

      const maliciousCandidate = {
        ...validCandidate,
        aggregateId: attackerAggregateId,
        aggregateType: 'job',
        schemaVersion: 'attacker-schema',
        pipelineVersion: 'attacker-pipeline',
        modelVersion: 'attacker-model',
        promptVersion: 'attacker-prompt',
        generatedAt: 'attacker-generated-time',
        provenance: {
          source: 'attacker-controlled',
        },
      };

      const provider = new ControlledPropertyIntelligenceProvider(maliciousCandidate);

      const service = createPropertyIntelligenceService({
        firestoreDb: adminDb,
        provider,
      });

      // Execute REAL production property pipeline
      await expect(
        service.aggregatePropertyIntelligence(propertyId)
      ).rejects.toThrow();

      // Provider was invoked
      expect(provider.invocationCount).toBe(1);

      // Verify through emulator that NO authoritative intelligence was written for attacker-controlled aggregate
      const attackerDoc = await adminDb.collection('intelligence_properties').doc(attackerAggregateId).get();
      expect(attackerDoc.exists).toBe(false);

      const attackerExtractions = await adminDb
        .collection('intelligence_extractions')
        .where('aggregateId', '==', attackerAggregateId)
        .get();
      expect(attackerExtractions.empty).toBe(true);

      // Verify that victim property also has NO partial/corrupted authority created
      const victimDoc = await adminDb.collection('intelligence_properties').doc(propertyId).get();
      expect(victimDoc.exists).toBe(false);
    });
  });

  // =========================================================================
  // 3. REQUIRED FABRICATED EVIDENCE TEST (Section 11)
  // =========================================================================
  describe('3. Required Fabricated Evidence Test (Section 11)', () => {
    it('fails closed when provider returns a candidate referencing fabricated evidence', async () => {
      const propertyId = 'prop_fabricated_11';

      const genuineEvidence = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Victim property genuine spec',
        {},
        true
      );

      const validCandidate = createValidCandidate(genuineEvidence.evidenceId);

      const maliciousCandidate = {
        ...validCandidate,
        evidenceIds: [
          'fabricated-evidence-that-does-not-exist',
        ],
        buildingComponents: [
          {
            component: 'Roof Fabric',
            condition: 'Severe roof failure fabricated by AI',
            confidence: 0.95,
            evidenceIds: ['fabricated-evidence-that-does-not-exist'],
          },
        ],
      };

      const provider = new ControlledPropertyIntelligenceProvider(maliciousCandidate);

      const service = createPropertyIntelligenceService({
        firestoreDb: adminDb,
        provider,
      });

      // Execute the REAL production pipeline
      await expect(
        service.aggregatePropertyIntelligence(propertyId)
      ).rejects.toThrow();

      expect(provider.invocationCount).toBe(1);

      // Query authoritative intelligence collection in real emulator
      const propDoc = await adminDb.collection('intelligence_properties').doc(propertyId).get();
      expect(propDoc.exists).toBe(false);

      const extractions = await adminDb
        .collection('intelligence_extractions')
        .where('aggregateId', '==', propertyId)
        .get();
      expect(extractions.empty).toBe(true);
    });
  });

  // =========================================================================
  // 4. REQUIRED CROSS-PROPERTY LINEAGE TEST (Section 12)
  // =========================================================================
  describe('4. Required Cross-Property Lineage Test (Section 12)', () => {
    it('fails closed when candidate for PROPERTY_B attempts to cite evidence from PROPERTY_A', async () => {
      const propertyAId = 'PROPERTY_A_12';
      const propertyBId = 'PROPERTY_B_12';

      // Create valid evidence for PROPERTY_A in real emulator
      const propertyAEvidence = await evidenceRegistry.register(
        'property',
        propertyAId,
        'structured_spec',
        `properties/${propertyAId}/spec`,
        'Property A inspection and EPC certificate',
        {},
        true
      );

      // Create valid evidence for PROPERTY_B in real emulator
      await evidenceRegistry.register(
        'property',
        propertyBId,
        'structured_spec',
        `properties/${propertyBId}/spec`,
        'Property B baseline registration spec',
        {},
        true
      );

      const validCandidateA = createValidCandidate(propertyAEvidence.evidenceId);

      // Candidate for PROPERTY_B cites PROPERTY_A evidence
      const maliciousCandidate = {
        ...validCandidateA,
        aggregateId: propertyBId,
        evidenceIds: [
          propertyAEvidence.evidenceId,
        ],
        buildingComponents: [
          {
            component: 'Roof Fabric',
            condition: 'Damage reported via Property A evidence',
            confidence: 0.9,
            evidenceIds: [propertyAEvidence.evidenceId],
          },
        ],
      };

      const provider = new ControlledPropertyIntelligenceProvider(maliciousCandidate);

      const service = createPropertyIntelligenceService({
        firestoreDb: adminDb,
        provider,
      });

      // Execute the real PROPERTY_B pipeline
      await expect(
        service.aggregatePropertyIntelligence(propertyBId)
      ).rejects.toThrow();

      expect(provider.invocationCount).toBe(1);

      // Verify NO authoritative PROPERTY_B intelligence was created using PROPERTY_A evidence
      const propBDoc = await adminDb.collection('intelligence_properties').doc(propertyBId).get();
      expect(propBDoc.exists).toBe(false);

      const propBExtractions = await adminDb
        .collection('intelligence_extractions')
        .where('aggregateId', '==', propertyBId)
        .get();
      expect(propBExtractions.empty).toBe(true);
    });
  });

  // =========================================================================
  // 5. REQUIRED MALFORMED CANDIDATE TEST (Section 13)
  // =========================================================================
  describe('5. Required Malformed Candidate Test (Section 13)', () => {
    it('fails closed and rejects malformed candidate output with structural schema violations', async () => {
      const propertyId = 'prop_malformed_13';

      await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Property spec for malformed candidate test',
        {},
        true
      );

      const malformedCandidate = {
        buildingComponents: 'THIS MUST NOT BE AN ARRAY',
        observedConditions: null,
        recommendedInterventions: {
          malicious: true,
        },
        unexpectedField: {
          deeply: {
            nested: true,
          },
        },
      };

      const provider = new ControlledPropertyIntelligenceProvider(malformedCandidate);

      const service = createPropertyIntelligenceService({
        firestoreDb: adminDb,
        provider,
      });

      // Execute REAL production pipeline
      await expect(
        service.aggregatePropertyIntelligence(propertyId)
      ).rejects.toThrow();

      expect(provider.invocationCount).toBe(1);

      // Assert no authoritative persistence in real emulator
      const propDoc = await adminDb.collection('intelligence_properties').doc(propertyId).get();
      expect(propDoc.exists).toBe(false);

      const extractions = await adminDb
        .collection('intelligence_extractions')
        .where('aggregateId', '==', propertyId)
        .get();
      expect(extractions.empty).toBe(true);
    });
  });

  // =========================================================================
  // 6. IMMUTABLE PERSISTENCE & IDEMPOTENT RE-EXECUTION (Section 16)
  // =========================================================================
  describe('6. Immutable Persistence & Idempotency (Section 16)', () => {
    it('verifies immutable persistence and idempotent re-execution without duplicate historical records', async () => {
      const propertyId = 'prop_idempotency_16';

      const specEv = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Property spec for idempotency test',
        {},
        true
      );

      const validCandidate = createValidCandidate(specEv.evidenceId);
      const provider = new ControlledPropertyIntelligenceProvider(validCandidate);

      const service = createPropertyIntelligenceService({
        firestoreDb: adminDb,
        provider,
      });

      // 1. Initial successful processing
      const result1 = await service.aggregatePropertyIntelligence(propertyId);
      expect(provider.invocationCount).toBe(1);

      // Query the authoritative intelligence record
      const doc1 = await adminDb.collection('intelligence_properties').doc(propertyId).get();
      expect(doc1.exists).toBe(true);
      const versionId1 = doc1.data()!.currentVersionId;
      expect(versionId1).toBe(result1.versionId);

      // Count extraction records in emulator
      const extractions1 = await adminDb
        .collection('intelligence_extractions')
        .where('aggregateId', '==', propertyId)
        .get();
      expect(extractions1.size).toBe(1);

      // 2. Run the same logical operation again
      const result2 = await service.aggregatePropertyIntelligence(propertyId);
      expect(provider.invocationCount).toBe(2);

      // 3. Verify existing V8.1 idempotency behavior
      expect(result2.versionId).toBe(versionId1);

      // 4. Verify that duplicate immutable historical records are NOT created merely because processing was repeated
      const extractions2 = await adminDb
        .collection('intelligence_extractions')
        .where('aggregateId', '==', propertyId)
        .get();
      expect(extractions2.size).toBe(1);

      const doc2 = await adminDb.collection('intelligence_properties').doc(propertyId).get();
      expect(doc2.data()!.currentVersionId).toBe(versionId1);
    });
  });

  // =========================================================================
  // 7. MISSING DATABASE FAIL-CLOSED BOUNDARY
  // =========================================================================
  describe('7. Missing Database Fail-Closed Boundary', () => {
    it('fails closed when Firestore DB reference is null', async () => {
      const propertyId = 'prop_no_db_test';
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
  // 8. PRODUCTION TASK QUEUE INTEGRATION (property_rollup)
  // =========================================================================
  describe('8. Production Task Queue Integration (property_rollup)', () => {
    it('processes property_rollup task via production intelligenceTaskQueue in real emulator', async () => {
      const propertyId = 'prop_queue_real_8';

      const ev = await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/spec`,
        'Property spec for durable task queue execution',
        {},
        true
      );

      const validCandidate = createValidCandidate(ev.evidenceId);
      const provider = new ControlledPropertyIntelligenceProvider(validCandidate);
      propertyIntelligenceService.setProvider(provider);

      const task = await intelligenceTaskQueue.enqueueTaskAsync(
        'property_rollup',
        'property',
        propertyId,
        `idemp_prop_task_${Date.now()}`,
        {
          property: { propertyId },
          historicalJobs: [],
        }
      );

      expect(task.taskId).toBeDefined();

      const executed = await intelligenceTaskQueue.executeTask(task.taskId, 'worker_task17_real_test');
      expect(executed).toBeDefined();
      expect(executed.status).toBe('succeeded');

      // Verify projection written to emulator Firestore
      const projDoc = await adminDb.collection('intelligence_properties').doc(propertyId).get();
      expect(projDoc.exists).toBe(true);
      expect(projDoc.data()!.overallHealthScore).toBe(85);
    });

    it('transitions task to dead_letter in real emulator when candidate contains fabricated evidence', async () => {
      const propertyId = 'prop_queue_fail_8';

      const fabricatedCandidate = {
        domain: 'property_management',
        category: 'Residential',
        component: 'Building Fabric',
        overallHealthScore: 75,
        buildingComponents: [
          {
            component: 'Roof',
            condition: 'Fabricated condition citing non-existent evidence',
            confidence: 0.95,
            evidenceIds: ['ev_hallucinated_queue_fail'],
          },
        ],
        evidenceIds: ['ev_hallucinated_queue_fail'],
        candidateConfidence: 0.95,
      };

      const provider = new ControlledPropertyIntelligenceProvider(fabricatedCandidate);
      propertyIntelligenceService.setProvider(provider);

      const task = await intelligenceTaskQueue.enqueueTaskAsync(
        'property_rollup',
        'property',
        propertyId,
        `idemp_prop_fail_${Date.now()}`,
        {
          property: { propertyId },
          historicalJobs: [],
        }
      );

      const failed = await intelligenceTaskQueue.executeTask(task.taskId, 'worker_task17_fail_test');
      expect(failed.status).toBe('dead_letter');
      expect(failed.errorCode).toBe('AICandidateSecurityError');

      // Assert projection was not created
      const projDoc = await adminDb.collection('intelligence_properties').doc(propertyId).get();
      expect(projDoc.exists).toBe(false);
    });
  });
});
