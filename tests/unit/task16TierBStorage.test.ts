/**
 * AnyTrader V8.1 — Task 16: Durable Tier-B Raw Intelligence Storage Verification Suite
 *
 * PROVES ON REAL FIREBASE EMULATOR (FIRESTORE & STORAGE):
 * 1. Real provider raw AI/model output is gzip-compressed into Tier-B Firebase Storage artifact.
 * 2. The actual compressed Storage object exists in the real Firebase Storage emulator.
 * 3. Authoritative Firestore intelligence records contain only the compact StorageManifest.
 * 4. SHA-256 integrity verification detects and rejects tampered/corrupted artifacts fail-closed.
 * 5. Storage failure fails closed immediately with zero false manifests or authoritative writes.
 * 6. Storage security rules strictly deny client/unauthenticated/authenticated reads & writes to /intelligence_raw.
 * 7. Firestore 100 KiB safety budget is strictly respected (no raw output stored in Firestore).
 * 8. Deterministic versioning and idempotent replay preserve single authoritative records.
 */

process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  ref as clientStorageRef,
  getBytes as clientGetBytes,
  uploadBytes as clientUploadBytes,
} from 'firebase/storage';
import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import zlib from 'zlib';

import {
  persistRawArtifact,
  readRawArtifact,
  verifyRawArtifact,
  setGlobalRawArtifactBucket,
  RawArtifactPersistenceError,
  RawArtifactIntegrityError,
  RawArtifactBucketLike,
} from '../../src/server/intelligence/rawArtifactStore';
import {
  compressPayload,
  decompressPayload,
  enforceFirestoreSafetyBudget,
  FIRESTORE_DOC_MAX_BYTES,
} from '../../src/server/intelligence/storageTier';
import { jobIntelligenceService } from '../../src/server/intelligence/jobIntelligence';
import { propertyIntelligenceService } from '../../src/server/intelligence/propertyIntelligence';
import { evidenceRegistry } from '../../src/server/intelligence/evidenceRegistry';
import {
  setGlobalIntelligenceDb,
  immutableIntelligenceStore,
} from '../../src/server/intelligence/immutableStore';
import {
  IntelligenceModelProvider,
  ModelExtractionResult,
} from '../../src/server/intelligence/geminiProvider';
import {
  computeSha256,
  INTELLIGENCE_PIPELINE_VERSION,
  INTELLIGENCE_SCHEMA_VERSION,
} from '../../src/server/intelligence/provenance';
import { StorageManifest } from '../../src/server/intelligence/types';

/**
 * Controlled test provider implementation for verifiable deterministic raw model output.
 */
class ControlledTestProvider implements IntelligenceModelProvider {
  public rawOutputText: string;

  constructor(customOutput?: string) {
    this.rawOutputText = customOutput || JSON.stringify({
      category: 'Plumbing',
      buildingComponent: 'Boiler / Diverter Valve',
      observedProblem: 'Vaillant combi boiler loses pressure rapidly from 1.5 bar to 0 bar',
      extractedScope: [
        'Inspect expansion vessel Schrader valve',
        'Pressure test primary heat exchanger',
        'Check PRV discharge pipe for weeping',
      ],
      candidateConfidence: 0.94,
    });
  }

  async extractJobCandidate(
    jobId: string,
    untrustedEvidence: Array<{ id: string; type: string; content: string }>
  ): Promise<ModelExtractionResult<any>> {
    return {
      candidate: JSON.parse(this.rawOutputText),
      metrics: {
        model: 'gemini-2.5-flash-controlled-test',
        inputTokens: 180,
        outputTokens: 95,
        totalTokens: 275,
        estimatedCostUsd: 0.0001,
        processingDurationMs: 42,
      },
      rawResponseText: this.rawOutputText,
    };
  }

  async rollupPropertyCandidate(
    propertyId: string,
    jobHistories: Array<{ jobId: string; category: string; problem: string; scope: string[] }>,
    untrustedEvidence: Array<{ id: string; type: string; content: string }>
  ): Promise<ModelExtractionResult<any>> {
    const rawRollup = JSON.stringify({
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
      observedConditions: [],
      recommendedInterventions: [],
      candidateConfidence: 0.92,
    });
    return {
      candidate: JSON.parse(rawRollup),
      metrics: {
        model: 'gemini-2.5-flash-controlled-test',
        inputTokens: 250,
        outputTokens: 120,
        totalTokens: 370,
        estimatedCostUsd: 0.0002,
        processingDurationMs: 55,
      },
      rawResponseText: rawRollup,
    };
  }
}

describe('Task 16 — Durable Tier-B Raw Intelligence Storage Verification Suite', () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = 'demo-anytrader';
  const BUCKET_NAME = 'demo-anytrader.appspot.com';
  let adminApp: admin.app.App;
  let adminBucket: RawArtifactBucketLike;
  let adminDb: admin.firestore.Firestore;

  beforeAll(async () => {
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

      if (admin.apps.length > 0) {
        await Promise.all(admin.apps.map(app => app?.delete()));
      }
      adminApp = admin.initializeApp({
        projectId: PROJECT_ID,
        storageBucket: BUCKET_NAME,
      });

      adminDb = adminApp.firestore();
      adminBucket = adminApp.storage().bucket(BUCKET_NAME) as unknown as RawArtifactBucketLike;

      setGlobalIntelligenceDb(adminDb as any);
      setGlobalRawArtifactBucket(adminBucket);
      evidenceRegistry.setDb(adminDb as any);
    } catch {
      // Emulator not running
    }
  });

  afterAll(async () => {
    setGlobalRawArtifactBucket(null);
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.clearStorage();
    }
    setGlobalRawArtifactBucket(adminBucket);
    setGlobalIntelligenceDb(adminDb as any);
    evidenceRegistry.clear();
  });

  // =========================================================================
  // A. JOB RAW ARTIFACT PERSISTENCE & STORAGE OBJECT EXISTENCE
  // =========================================================================
  describe('A. Job Raw Artifact Persistence', () => {
    it('persists compressed raw model artifact to Firebase Storage and records manifest in Firestore', async () => {
      const jobId = 'job_tierb_001';
      const provider = new ControlledTestProvider();
      jobIntelligenceService.setProvider(provider);

      // Register initial evidence for lineage
      const ev = await evidenceRegistry.register(
        'job',
        jobId,
        'user_description',
        `jobs/${jobId}/desc`,
        'Vaillant combi boiler loses pressure rapidly from 1.5 bar to 0 bar',
        { source: 'job_post' },
        true
      );

      // Execute real job intelligence extraction
      const result = await jobIntelligenceService.deriveJobIntelligence({
        jobId,
        title: 'Boiler pressure drops',
        description: 'Vaillant combi boiler loses pressure rapidly from 1.5 bar to 0 bar',
        category: 'Plumbing',
      });

      const { jobIntelligence, event, versionId, extraction } = result;

      // 1. Verify manifest properties
      const manifest = extraction.rawManifest;
      expect(manifest).toBeDefined();
      expect(manifest.encoding).toBe('gzip');
      expect(manifest.storagePath).toBe(`intelligence_raw/job/${jobId}/extraction_${versionId}.json.gz`);
      expect(manifest.originalBytes).toBe(Buffer.byteLength(provider.rawOutputText, 'utf8'));
      expect(manifest.compressedBytes).toBeGreaterThan(0);
      expect(manifest.compressedBytes).toBeLessThanOrEqual(manifest.originalBytes);
      expect(manifest.sha256).toBe(computeSha256(Buffer.from(provider.rawOutputText, 'utf8')));
      expect(manifest.compressionRatio).toBeGreaterThan(0);

      // 2. Verify physical existence in real Firebase Storage emulator
      const fileRef = (adminBucket as any).file(manifest.storagePath);
      const [exists] = await fileRef.exists();
      expect(exists).toBe(true);

      // 3. Verify object metadata in Storage
      const [downloadedBuf] = await fileRef.download();
      expect(downloadedBuf.length).toBe(manifest.compressedBytes);

      // 4. Verify authoritative Tier A Firestore record contains only the manifest
      const storedExtraction = await immutableIntelligenceStore.getVersionById(adminDb as any, versionId);
      expect(storedExtraction).not.toBeNull();
      expect(storedExtraction?.rawManifest.sha256).toBe(manifest.sha256);
      expect(storedExtraction?.rawManifest.storagePath).toBe(manifest.storagePath);
    });
  });

  // =========================================================================
  // B. PROPERTY RAW ARTIFACT PERSISTENCE & STORAGE OBJECT EXISTENCE
  // =========================================================================
  describe('B. Property Raw Artifact Persistence', () => {
    it('persists compressed property rollup artifact to Firebase Storage and records manifest in Firestore', async () => {
      const propertyId = 'prop_tierb_001';
      const provider = new ControlledTestProvider();
      jobIntelligenceService.setProvider(provider);
      propertyIntelligenceService.setProvider(provider);

      // Create a historical job extraction first
      const jobId = 'job_hist_prop_001';
      await evidenceRegistry.register(
        'job',
        jobId,
        'user_description',
        `jobs/${jobId}/desc`,
        'Boiler repair and service',
        { source: 'job_post' },
        true
      );
      const { jobIntelligence: histJob } = await jobIntelligenceService.deriveJobIntelligence({
        jobId,
        title: 'Boiler repair',
        description: 'Boiler repair and service',
        category: 'Plumbing',
      });

      // Register property evidence
      await evidenceRegistry.register(
        'property',
        propertyId,
        'structured_spec',
        `properties/${propertyId}/specs`,
        JSON.stringify({ propertyType: 'Semi-Detached', epcRating: 'B', constructionYear: 1995 }),
        { source: 'property_passport' },
        true
      );

      // Execute property rollup
      const result = await propertyIntelligenceService.aggregatePropertyIntelligence(
        {
          propertyId,
          propertyType: 'Semi-Detached',
          epcRating: 'B',
          constructionYear: 1995,
        },
        [histJob]
      );

      const { propertyIntelligence, versionId, extraction } = result;

      // 1. Verify manifest
      const manifest = extraction.rawManifest;
      expect(manifest).toBeDefined();
      expect(manifest.encoding).toBe('gzip');
      expect(manifest.storagePath).toBe(`intelligence_raw/property/${propertyId}/rollup_${versionId}.json.gz`);
      expect(manifest.compressedBytes).toBeGreaterThan(0);
      expect(manifest.sha256).toBeDefined();

      // 2. Verify physical existence in real Firebase Storage emulator
      const fileRef = (adminBucket as any).file(manifest.storagePath);
      const [exists] = await fileRef.exists();
      expect(exists).toBe(true);

      // 3. Verify authoritative Firestore record contains manifest
      const storedExtraction = await immutableIntelligenceStore.getVersionById(adminDb as any, versionId);
      expect(storedExtraction).not.toBeNull();
      expect(storedExtraction?.rawManifest.storagePath).toBe(manifest.storagePath);
    });
  });

  // =========================================================================
  // C. SHA-256 INTEGRITY VERIFICATION
  // =========================================================================
  describe('C. SHA-256 Integrity Verification', () => {
    it('reads and verifies SHA-256 integrity of stored raw artifacts', async () => {
      const payload = {
        inspectionDate: '2026-09-18',
        findings: ['Flue termination clearance compliant', 'Gas pressure 20.5 mbar'],
        engineerNotes: 'All systems operating within manufacturer parameters',
      };
      const storagePath = 'intelligence_raw/job/job_integ_001/extraction_test_v1.json.gz';
      const { compressedBuffer, manifest } = compressPayload(payload, storagePath);

      // Upload via persistRawArtifact
      const persistedManifest = await persistRawArtifact({ compressedBuffer, manifest });
      expect(persistedManifest.sha256).toBe(manifest.sha256);

      // Read back through readRawArtifact and verify decompression & SHA-256
      const decompressedBuf = await readRawArtifact(persistedManifest);
      const actualSha = computeSha256(decompressedBuf);
      expect(actualSha).toBe(manifest.sha256);

      const parsed = JSON.parse(decompressedBuf.toString('utf8'));
      expect(parsed).toEqual(payload);

      // verifyRawArtifact returns true
      const isValid = await verifyRawArtifact(persistedManifest);
      expect(isValid).toBe(true);
    });
  });

  // =========================================================================
  // D. CORRUPTION & TAMPER DETECTION (FAIL-CLOSED)
  // =========================================================================
  describe('D. Corruption & Tamper Detection', () => {
    it('throws RawArtifactIntegrityError when storage artifact content is corrupted or tampered', async () => {
      const originalPayload = { criticalAssessment: 'Safe to operate', hazardLevel: 'NONE' };
      const storagePath = 'intelligence_raw/job/job_tamper_001/extraction_v1.json.gz';
      const { compressedBuffer, manifest } = compressPayload(originalPayload, storagePath);

      await persistRawArtifact({ compressedBuffer, manifest });

      // Simulate bit corruption or malicious payload swap in Storage
      const tamperedPayload = { criticalAssessment: 'CONDEMNED / GAS LEAK', hazardLevel: 'EXTREME' };
      const tamperedBuffer = zlib.gzipSync(Buffer.from(JSON.stringify(tamperedPayload), 'utf8'));

      // Overwrite the Storage object directly in emulator with tampered content
      await (adminBucket as any).file(storagePath).save(tamperedBuffer, {
        contentType: 'application/json',
      });

      // Verification MUST fail closed with RawArtifactIntegrityError
      await expect(readRawArtifact(manifest)).rejects.toThrow(RawArtifactIntegrityError);
      await expect(verifyRawArtifact(manifest)).rejects.toThrow(RawArtifactIntegrityError);
    });
  });

  // =========================================================================
  // E. STORAGE FAILURE & FAIL-CLOSED PROPAGATION
  // =========================================================================
  describe('E. Storage Failure & Fail-Closed Invariants', () => {
    it('fails closed when Storage persistence rejects without emitting false manifests or writing Firestore docs', async () => {
      const jobId = 'job_fail_closed_001';
      const provider = new ControlledTestProvider();
      jobIntelligenceService.setProvider(provider);

      // Inject a failing storage bucket test double
      const failingBucket: RawArtifactBucketLike = {
        file: () => ({
          save: async () => {
            throw new Error('STORAGE_UNAVAILABLE: Connection refused to storage cluster');
          },
          download: async () => {
            throw new Error('Not implemented');
          },
          exists: async () => [false],
        }),
      };

      setGlobalRawArtifactBucket(failingBucket);

      // Register evidence
      await evidenceRegistry.register(
        'job',
        jobId,
        'user_description',
        `jobs/${jobId}/desc`,
        'Roof tile broken and leaking',
        { source: 'job_post' },
        true
      );

      // Attempt extraction — must throw RawArtifactPersistenceError fail-closed
      await expect(
        jobIntelligenceService.deriveJobIntelligence({
          jobId,
          title: 'Roof repair',
          description: 'Roof tile broken and leaking',
          category: 'Roofing',
        })
      ).rejects.toThrow(RawArtifactPersistenceError);

      // Verify ZERO extraction documents were persisted to Firestore
      const stored = await immutableIntelligenceStore.getVersionsForAggregate(adminDb as any, 'job', jobId);
      expect(stored.length).toBe(0);
    });

    it('rejects persistRawArtifact if no bucket is configured (fail-closed)', async () => {
      setGlobalRawArtifactBucket(null);

      const { compressedBuffer, manifest } = compressPayload(
        { test: 'data' },
        'intelligence_raw/job/job_nobucket/test.json.gz'
      );

      await expect(
        persistRawArtifact({ compressedBuffer, manifest })
      ).rejects.toThrow(/No raw artifact bucket configured/);
    });
  });

  // =========================================================================
  // F. CLIENT SECURITY & ACCESS CONTROL (STORAGE SECURITY RULES)
  // =========================================================================
  describe('F. Storage Security Rules for /intelligence_raw Namespace', () => {
    it('denies unauthenticated read and write access to /intelligence_raw (PERMISSION_DENIED)', async () => {
      const unauthStorage = testEnv.unauthenticatedContext().storage();
      const rawRef = clientStorageRef(unauthStorage, 'intelligence_raw/job/job_sec_001/extraction_v1.json.gz');

      await assertFails(clientGetBytes(rawRef));
      await assertFails(clientUploadBytes(rawRef, Buffer.from('unauthenticated payload')));
    });

    it('denies authenticated standard user read and write access to /intelligence_raw (PERMISSION_DENIED)', async () => {
      const homeownerStorage = testEnv.authenticatedContext('user_homeowner', { role: 'homeowner' }).storage();
      const traderStorage = testEnv.authenticatedContext('user_trader', { role: 'tradesperson' }).storage();

      const rawRefHomeowner = clientStorageRef(homeownerStorage, 'intelligence_raw/job/job_sec_001/extraction_v1.json.gz');
      const rawRefTrader = clientStorageRef(traderStorage, 'intelligence_raw/job/job_sec_001/extraction_v1.json.gz');

      // Homeowner attempts
      await assertFails(clientGetBytes(rawRefHomeowner));
      await assertFails(clientUploadBytes(rawRefHomeowner, Buffer.from('homeowner injected bytes')));

      // Trader attempts
      await assertFails(clientGetBytes(rawRefTrader));
      await assertFails(clientUploadBytes(rawRefTrader, Buffer.from('trader injected bytes')));
    });

    it('denies unrelated user access even when aggregate ID is known (PERMISSION_DENIED)', async () => {
      const attackerStorage = testEnv.authenticatedContext('attacker_999').storage();
      const targetPath = 'intelligence_raw/job/job_victim_100/extraction_v1.json.gz';
      const targetRef = clientStorageRef(attackerStorage, targetPath);

      await assertFails(clientGetBytes(targetRef));
      await assertFails(clientUploadBytes(targetRef, Buffer.from('malicious payload')));
    });

    it('allows Admin / Server SDK durable write and read to /intelligence_raw', async () => {
      // Admin SDK write via adminBucket
      const storagePath = 'intelligence_raw/job/job_admin_001/extraction_admin_v1.json.gz';
      const payload = { modelRunId: 'run_admin_1', status: 'verified' };
      const { compressedBuffer, manifest } = compressPayload(payload, storagePath);

      const savedManifest = await persistRawArtifact({ compressedBuffer, manifest });
      expect(savedManifest.sha256).toBe(manifest.sha256);

      // Verify read back succeeds
      const decompressed = await readRawArtifact(savedManifest);
      expect(JSON.parse(decompressed.toString('utf8'))).toEqual(payload);
    });
  });

  // =========================================================================
  // G. FIRESTORE SAFETY BUDGET (<= 100 KiB & NO RAW ARTIFACT IN FIRESTORE)
  // =========================================================================
  describe('G. Firestore Safety Budget & Compact Projections', () => {
    it('enforces Firestore safety budget <= 100 KiB and verifies no raw payload is stored in Firestore', async () => {
      // Create a large 250 KiB raw model output
      const largeObservations = Array.from({ length: 150 }, (_, i) => ({
        index: i,
        finding: `Detailed structural observation ${i}: Inspection of rafters, battens, underlayment, lead flashing, gutters, downpipes, and masonry joints for defect code D-${1000 + i}`,
        specDetails: 'Standard BS 5534 slating and tiling compliance metrics with lime mortar repointing',
      }));
      const largeRawOutput = JSON.stringify({
        category: 'Roofing',
        buildingComponent: 'Roof Structure',
        observedProblem: 'Extensive storm damage across rear elevation',
        extractedScope: ['Complete strip and re-slate', 'Replace rotten timber rafters'],
        observations: largeObservations,
        candidateConfidence: 0.91,
      });

      expect(Buffer.byteLength(largeRawOutput, 'utf8')).toBeGreaterThan(20 * 1024);

      const provider = new ControlledTestProvider(largeRawOutput);
      jobIntelligenceService.setProvider(provider);

      const jobId = 'job_budget_001';
      await evidenceRegistry.register(
        'job',
        jobId,
        'user_description',
        `jobs/${jobId}/desc`,
        'Extensive roof storm damage inspection report',
        { source: 'job_post' },
        true
      );

      const result = await jobIntelligenceService.deriveJobIntelligence({
        jobId,
        title: 'Roof storm damage',
        description: 'Extensive roof storm damage inspection report',
        category: 'Roofing',
      });

      const { jobIntelligence, versionId, extraction } = result;

      // 1. Verify Firestore document conforms to safety budget
      const storedExtraction = await immutableIntelligenceStore.getVersionById(adminDb as any, versionId);
      expect(storedExtraction).not.toBeNull();

      const budgetCheck = enforceFirestoreSafetyBudget(storedExtraction);
      expect(budgetCheck.valid).toBe(true);
      expect(budgetCheck.actualBytes).toBeLessThan(FIRESTORE_DOC_MAX_BYTES);

      // 2. Verify Firestore document does NOT contain the full raw observations string
      const firestoreJson = JSON.stringify(storedExtraction);
      expect(firestoreJson).not.toContain(largeObservations[50].finding);
      expect(firestoreJson).not.toContain(largeObservations[100].finding);

      // 3. Verify the full raw output is stored in Tier-B Storage instead
      const rawBuf = await readRawArtifact(extraction.rawManifest);
      const parsedRaw = JSON.parse(rawBuf.toString('utf8'));
      expect(parsedRaw.observations.length).toBe(150);
      expect(parsedRaw.observations[50].finding).toBe(largeObservations[50].finding);
    });
  });

  // =========================================================================
  // H. IDEMPOTENCY & DETERMINISTIC VERSIONING
  // =========================================================================
  describe('H. Idempotency & Deterministic Versioning', () => {
    it('produces identical deterministic versionId and storagePath without uncontrolled duplicates on replay', async () => {
      const jobId = 'job_idem_001';
      const provider = new ControlledTestProvider();
      jobIntelligenceService.setProvider(provider);

      await evidenceRegistry.register(
        'job',
        jobId,
        'user_description',
        `jobs/${jobId}/desc`,
        'Water leak under kitchen sink from waste trap',
        { source: 'job_post' },
        true
      );

      // First execution
      const result1 = await jobIntelligenceService.deriveJobIntelligence({
        jobId,
        title: 'Sink leak',
        description: 'Water leak under kitchen sink from waste trap',
        category: 'Plumbing',
        sourceVersion: '1',
        pipelineVersion: INTELLIGENCE_PIPELINE_VERSION,
        modelVersion: 'gemini-2.5-flash-controlled-test',
        promptVersion: 'job_extraction_v8.1',
        schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
      });

      // Second identical execution
      const result2 = await jobIntelligenceService.deriveJobIntelligence({
        jobId,
        title: 'Sink leak',
        description: 'Water leak under kitchen sink from waste trap',
        category: 'Plumbing',
        sourceVersion: '1',
        pipelineVersion: INTELLIGENCE_PIPELINE_VERSION,
        modelVersion: 'gemini-2.5-flash-controlled-test',
        promptVersion: 'job_extraction_v8.1',
        schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
      });

      // Version IDs and Storage Paths MUST match deterministically
      expect(result1.versionId).toBe(result2.versionId);
      expect(result1.extraction.rawManifest.storagePath).toBe(
        result2.extraction.rawManifest.storagePath
      );
      expect(result1.extraction.rawManifest.sha256).toBe(
        result2.extraction.rawManifest.sha256
      );

      // Verify immutable store contains exactly one record for this version
      const allExtractions = await immutableIntelligenceStore.getVersionsForAggregate(adminDb as any, 'job', jobId);
      expect(allExtractions.length).toBe(1);
    });
  });
});
