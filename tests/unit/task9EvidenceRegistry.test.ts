/**
 * AnyTrader V8.1 — Task 9: Evidence Registry & Evidence Integrity Test Suite
 * 
 * Validates:
 * 1. Schema Validation (EvidenceRegistrationSchema):
 *    - Rejects invalid/empty source types
 *    - Validates photo, video, document, user statement, external import, archive
 *    - Rejects missing content hash for verified bytes
 *    - Enforces metadata and size constraints
 * 2. Deterministic Identity & Hash Integrity:
 *    - Deterministic evidence ID derived from source type, source ID, version, type, and content hash
 *    - Genuine SHA-256 for bytes and canonical JSON hashing for structured records
 * 3. Immutability & Append-Only Invariant:
 *    - Idempotent on identical re-submission (same ID + same content hash)
 *    - Rejection with [Evidence Immutability Error] on conflicting re-submission (same ID + different content)
 *    - New versions create distinct evidence records
 * 4. Transactional Persistence Boundary:
 *    - Uses db.runTransaction() to commit to intelligence_evidence collection
 *    - Fails closed when Firestore or runTransaction is unavailable (no production memory fallback)
 * 5. Media & Storage Separation:
 *    - Large binary assets stored via storagePath, metadata kept in Firestore
 *    - Enforces 100 KiB Firestore safety budget (rejects bloated documents)
 * 6. "No Evidence, No Assertion" & Anti-Circular AI Guard:
 *    - Assertion derivation strictly blocked without evidence IDs
 *    - AI model extraction output cannot be registered as raw source evidence
 * 7. Evidence Lineage & Chain Tracing:
 *    - Links assertions and extraction versions back to verified source evidence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEvidenceRecord,
  buildDeterministicEvidenceId,
  deriveEvidenceCategory,
  validateNotCircularAiEvidence,
  validateEvidencePayload,
  persistEvidenceToFirestore,
  getEvidenceFromFirestore,
  getEvidenceForAggregateFromFirestore,
  getEvidenceForSourceFromFirestore,
  EvidenceRepository,
  buildEvidenceChainTrace,
} from '../../src/server/intelligence/evidence';
import {
  evidenceRegistry,
  EvidenceRegistry,
} from '../../src/server/intelligence/evidenceRegistry';
import {
  EvidenceRegistrationSchema,
} from '../../src/server/intelligence/schemas';
import {
  createInMemoryTestDb,
} from '../../src/server/intelligence/testDoubles';
import {
  computeSha256,
  computeStructuredDataHash,
} from '../../src/server/intelligence/provenance';
import {
  IntelligenceEvidence,
  SourceType,
  EvidenceType,
  EvidenceCategory,
} from '../../src/server/intelligence/types';
import { immutableIntelligenceStore } from '../../src/server/intelligence/immutableStore';

describe('Task 9: Evidence Registry & Evidence Integrity', () => {
  let testDb: any;

  beforeEach(() => {
    testDb = createInMemoryTestDb();
    evidenceRegistry.clear();
  });

  describe('1. Schema Validation (EvidenceRegistrationSchema)', () => {
    it('accepts valid evidence across diverse platform source types and categories', () => {
      const sourceTypes: SourceType[] = [
        'job',
        'property',
        'contractor',
        'quote',
        'review',
        'customer_request',
        'document',
        'external_import',
        'imported_archive',
      ];

      for (const st of sourceTypes) {
        const validated = EvidenceRegistrationSchema.parse({
          aggregateType: 'job',
          aggregateId: `job_${st}_01`,
          sourceType: st,
          sourceId: `src_${st}_01`,
          sourceVersion: '1',
          evidenceType: 'document',
          evidenceCategory: 'DOCUMENT',
          sourceRef: `sources/${st}/01`,
          contentHash: computeSha256(`content_${st}`),
          byteSize: 100,
          integrityStatus: 'verified',
          verified: true,
          mimeType: 'application/pdf',
          storagePath: `intelligence_evidence/ev_${st}/file.pdf`,
        });

        expect(validated.sourceType).toBe(st);
        expect(validated.integrityStatus).toBe('verified');
      }
    });

    it('rejects invalid or unsupported source types', () => {
      expect(() => {
        EvidenceRegistrationSchema.parse({
          aggregateType: 'job',
          aggregateId: 'job_invalid_01',
          sourceType: 'unsupported_fake_source_type' as any,
          sourceId: 'src_01',
          sourceVersion: '1',
          evidenceType: 'photo',
          sourceRef: 'photos/01.jpg',
          contentHash: 'somehash',
          byteSize: 10,
          integrityStatus: 'verified',
        });
      }).toThrow();
    });

    it('rejects verified status if contentHash is missing', () => {
      expect(() => {
        EvidenceRegistrationSchema.parse({
          aggregateType: 'job',
          aggregateId: 'job_01',
          sourceType: 'job',
          sourceId: 'job_01',
          sourceVersion: '1',
          evidenceType: 'photo',
          sourceRef: 'photos/01.jpg',
          contentHash: '',
          byteSize: 10,
          integrityStatus: 'verified',
          verified: true,
        });
      }).toThrow(/Verified evidence must possess a valid/);
    });

    it('validates all supported evidence types (photo, video, document, quote, review, etc.)', () => {
      const types: EvidenceType[] = [
        'photo',
        'video',
        'image',
        'document',
        'inspection_record',
        'text',
        'user_statement',
        'user_description',
        'quote',
        'completion_record',
        'review',
        'structured_record',
        'structured_spec',
        'imported_record',
        'imported_archive',
      ];

      for (const t of types) {
        const category = deriveEvidenceCategory(t);
        const parsed = EvidenceRegistrationSchema.parse({
          aggregateType: 'job',
          aggregateId: 'job_all_types',
          sourceType: 'job',
          sourceId: 'job_all_types',
          sourceVersion: '1',
          evidenceType: t,
          evidenceCategory: category,
          sourceRef: `ref_${t}`,
          contentHash: computeSha256(t),
          byteSize: t.length,
          integrityStatus: 'verified',
        });
        expect(parsed.evidenceType).toBe(t);
        expect(parsed.evidenceCategory).toBe(category);
      }
    });
  });

  describe('2. Deterministic Identity & Hash Integrity', () => {
    it('produces identical deterministic evidence IDs for identical parameters', () => {
      const hash = computeSha256('boiler leak pipe');
      const id1 = buildDeterministicEvidenceId('job', 'job_404', '1', 'photo', hash);
      const id2 = buildDeterministicEvidenceId('job', 'job_404', '1', 'photo', hash);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^ev_job_job_404_[a-f0-9]{16}$/);
    });

    it('produces distinct evidence IDs when version or content changes', () => {
      const hashA = computeSha256('version 1 photo bytes');
      const hashB = computeSha256('version 2 photo bytes');

      const idV1 = buildDeterministicEvidenceId('job', 'job_505', '1', 'photo', hashA);
      const idV2 = buildDeterministicEvidenceId('job', 'job_505', '2', 'photo', hashB);
      const idSameVerDiffContent = buildDeterministicEvidenceId('job', 'job_505', '1', 'photo', hashB);

      expect(idV1).not.toBe(idV2);
      expect(idV1).not.toBe(idSameVerDiffContent);
    });

    it('computes genuine SHA-256 for binary buffers and canonical hash for structured specs', () => {
      const buffer = Buffer.from('raw binary photo data content');
      const sha = computeSha256(buffer);
      expect(sha).toHaveLength(64);

      const structuredA = { boilerModel: 'Worcester Greenstar 30i', year: 2021, kw: 30 };
      const structuredB = { year: 2021, kw: 30, boilerModel: 'Worcester Greenstar 30i' };

      const hashA = computeStructuredDataHash(structuredA);
      const hashB = computeStructuredDataHash(structuredB);
      expect(hashA).toBe(hashB);
    });
  });

  describe('3. Anti-Circular AI Guard & "No Evidence, No Assertion"', () => {
    it('rejects registering AI model extraction outputs as raw source evidence', () => {
      expect(() => {
        validateNotCircularAiEvidence({
          sourceType: 'ai_model',
          evidenceType: 'text',
        });
      }).toThrow(/AI model extraction output cannot be registered as raw source evidence/);

      expect(() => {
        validateNotCircularAiEvidence({
          sourceType: 'ai_output',
          evidenceType: 'text',
        });
      }).toThrow(/AI model extraction output cannot be registered as raw source evidence/);

      expect(() => {
        validateNotCircularAiEvidence({
          sourceType: 'extraction',
          evidenceType: 'structured_record',
        });
      }).toThrow(/AI model extraction output cannot be registered as raw source evidence/);
    });

    it('rejects purely synthetic AI statements marked with isAiGeneratedStatement without human source', () => {
      expect(() => {
        validateNotCircularAiEvidence({
          sourceType: 'customer_request',
          evidenceType: 'user_statement',
          metadata: { isAiGeneratedStatement: true, verifiedHumanSource: false },
        });
      }).toThrow(/Pure AI-generated statements cannot serve as source evidence/);
    });

    it('assertHasEvidence enforces non-empty evidence reference sets', () => {
      expect(() => {
        evidenceRegistry.assertHasEvidence([]);
      }).toThrow(/No evidence provided: An intelligence assertion cannot be formed without evidence/);

      expect(() => {
        evidenceRegistry.assertHasEvidence(null as any);
      }).toThrow(/No evidence provided/);

      expect(() => {
        evidenceRegistry.assertHasEvidence(['ev_job_101_abcd1234abcd1234']);
      }).not.toThrow();
    });
  });

  describe('4. Media Storage Separation & 100 KiB Safety Budget', () => {
    it('rejects bloated evidence metadata exceeding the 100 KiB safety budget', () => {
      const hugeString = 'X'.repeat(105 * 1024); // 105 KiB string
      const bloatedEvidence: IntelligenceEvidence = {
        evidenceId: 'ev_bloated_01',
        aggregateType: 'job',
        aggregateId: 'job_bloat',
        sourceType: 'job',
        sourceId: 'job_bloat',
        sourceVersion: '1',
        evidenceType: 'photo',
        evidenceCategory: 'MEDIA',
        sourceRef: 'photos/bloated.jpg',
        contentHash: computeSha256(hugeString),
        byteSize: hugeString.length,
        createdAt: new Date().toISOString(),
        schemaVersion: 'v8.1.0',
        integrityStatus: 'verified',
        verified: true,
        metadata: {
          embeddedBinaryPayload: hugeString, // Violation: inlined binary into metadata
        },
      };

      expect(() => {
        validateEvidencePayload(bloatedEvidence);
      }).toThrow(/Evidence metadata document exceeds 100 KiB safety budget/);
    });

    it('permits compact evidence metadata with external storagePath reference for large media', () => {
      const compactMediaEvidence = createEvidenceRecord({
        aggregateType: 'job',
        aggregateId: 'job_media_101',
        sourceType: 'job',
        sourceId: 'job_media_101',
        sourceVersion: '1',
        evidenceType: 'photo',
        evidenceCategory: 'MEDIA',
        sourceRef: 'photos/boiler_leak.jpg',
        rawContent: Buffer.from('mock photo binary header data'),
        mimeType: 'image/jpeg',
        storagePath: 'intelligence_evidence/ev_job_job_media_101_abc/photo.jpg',
        metadata: {
          originalFilename: 'boiler_leak.jpg',
          cameraModel: 'iPhone 15 Pro',
        },
        evidenceQuality: 0.95,
        sourceReliability: 0.9,
      });

      expect(() => validateEvidencePayload(compactMediaEvidence)).not.toThrow();
      expect(compactMediaEvidence.storagePath).toBe('intelligence_evidence/ev_job_job_media_101_abc/photo.jpg');
      expect(compactMediaEvidence.mimeType).toBe('image/jpeg');
    });
  });

  describe('5. Transactional Persistence Boundary (Firestore runTransaction)', () => {
    it('persists evidence record into intelligence_evidence collection via runTransaction', async () => {
      const evidence = createEvidenceRecord({
        aggregateType: 'job',
        aggregateId: 'job_tx_201',
        sourceType: 'job',
        sourceId: 'job_tx_201',
        sourceVersion: '1',
        evidenceType: 'inspection_record',
        sourceRef: 'inspections/cp12_cert.pdf',
        rawContent: 'CP12 Gas Safety Certificate: Pass. Boiler flue secure.',
        mimeType: 'application/pdf',
      });

      const result = await persistEvidenceToFirestore({
        db: testDb,
        evidence,
      });

      expect(result.isNew).toBe(true);
      expect(result.evidenceId).toBe(evidence.evidenceId);

      // Verify persisted in collection
      const fetched = await getEvidenceFromFirestore(testDb, evidence.evidenceId);
      expect(fetched).not.toBeNull();
      expect(fetched?.contentHash).toBe(evidence.contentHash);
      expect(fetched?.aggregateId).toBe('job_tx_201');
    });

    it('is idempotent on identical re-submission (same ID + same contentHash)', async () => {
      const evidence = createEvidenceRecord({
        aggregateType: 'property',
        aggregateId: 'prop_tx_301',
        sourceType: 'property',
        sourceId: 'prop_tx_301',
        sourceVersion: '1',
        evidenceType: 'document',
        sourceRef: 'deeds/title_register.pdf',
        rawContent: 'Title Absolute: Freehold Property, Land Registry England & Wales.',
      });

      // First submission
      const firstResult = await persistEvidenceToFirestore({ db: testDb, evidence });
      expect(firstResult.isNew).toBe(true);

      // Duplicate submission with identical content
      const secondResult = await persistEvidenceToFirestore({ db: testDb, evidence });
      expect(secondResult.isNew).toBe(false);
      expect(secondResult.evidenceId).toBe(evidence.evidenceId);
      expect(secondResult.evidence.contentHash).toBe(evidence.contentHash);
    });

    it('rejects conflicting re-submission (same ID + different contentHash) with [Evidence Immutability Error]', async () => {
      const evidenceV1 = createEvidenceRecord({
        aggregateType: 'contractor',
        aggregateId: 'trader_401',
        sourceType: 'contractor',
        sourceId: 'trader_401',
        sourceVersion: '1',
        evidenceType: 'document',
        sourceRef: 'certs/gas_safe.pdf',
        rawContent: 'Gas Safe Registration 654321',
        customEvidenceId: 'ev_contractor_trader_401_cert',
      });

      await persistEvidenceToFirestore({ db: testDb, evidence: evidenceV1 });

      // Attacker attempts to mutate same evidence record with tampered content
      const tamperedEvidence: IntelligenceEvidence = {
        ...evidenceV1,
        contentHash: computeSha256('Forged Gas Safe Registration 999999'),
      };

      await expect(
        persistEvidenceToFirestore({ db: testDb, evidence: tamperedEvidence })
      ).rejects.toThrow(/\[Evidence Immutability Error\] Cannot mutate historical evidence/);
    });

    it('FAILS CLOSED when Firestore is not provided or runTransaction is unavailable', async () => {
      const evidence = createEvidenceRecord({
        aggregateType: 'job',
        aggregateId: 'job_failclosed',
        sourceType: 'job',
        sourceId: 'job_failclosed',
        sourceVersion: '1',
        evidenceType: 'text',
        sourceRef: 'jobs/job_failclosed',
        rawContent: 'Emergency leak repair',
      });

      // Null db
      await expect(
        persistEvidenceToFirestore({ db: null, evidence })
      ).rejects.toThrow(/\[EvidencePersistence Error\] Firestore database is not configured or ready/);

      // Missing runTransaction capability
      const invalidDb = {
        collection: () => ({ doc: () => ({}) }),
      } as any;

      await expect(
        persistEvidenceToFirestore({ db: invalidDb, evidence })
      ).rejects.toThrow(/Firestore transaction capability \(runTransaction\) is required/);
    });

    it('queries evidence by aggregate and by source from Firestore', async () => {
      const ev1 = createEvidenceRecord({
        aggregateType: 'job',
        aggregateId: 'job_query_501',
        sourceType: 'job',
        sourceId: 'job_query_501',
        sourceVersion: '1',
        evidenceType: 'photo',
        sourceRef: 'photos/1.jpg',
        rawContent: 'photo 1',
      });

      const ev2 = createEvidenceRecord({
        aggregateType: 'job',
        aggregateId: 'job_query_501',
        sourceType: 'job',
        sourceId: 'job_query_501',
        sourceVersion: '1',
        evidenceType: 'user_description',
        sourceRef: 'desc',
        rawContent: 'Kitchen leak under sink',
      });

      await persistEvidenceToFirestore({ db: testDb, evidence: ev1 });
      await persistEvidenceToFirestore({ db: testDb, evidence: ev2 });

      const results = await getEvidenceForAggregateFromFirestore(testDb, 'job', 'job_query_501');
      expect(results).toHaveLength(2);

      const sourceResults = await getEvidenceForSourceFromFirestore(testDb, 'job', 'job_query_501');
      expect(sourceResults).toHaveLength(2);
    });
  });

  describe('6. EvidenceRepository & ImmutableIntelligenceStore Integration', () => {
    it('EvidenceRepository delegates to transactional Firestore operations', async () => {
      const repo = new EvidenceRepository(testDb);
      const ev = createEvidenceRecord({
        aggregateType: 'property',
        aggregateId: 'prop_repo_601',
        sourceType: 'property',
        sourceId: 'prop_repo_601',
        sourceVersion: '1',
        evidenceType: 'document',
        sourceRef: 'epc/epc_cert.pdf',
        rawContent: 'EPC Rating: C (72 points)',
      });

      const persisted = await repo.persist(ev);
      expect(persisted.isNew).toBe(true);

      const retrieved = await repo.getById(ev.evidenceId);
      expect(retrieved?.evidenceId).toBe(ev.evidenceId);
      expect(retrieved?.contentHash).toBe(ev.contentHash);

      const aggregateList = await repo.getForAggregate('property', 'prop_repo_601');
      expect(aggregateList).toHaveLength(1);
    });

    it('ImmutableIntelligenceStore.persistEvidence adheres to transactional persistence boundary', async () => {
      const ev = createEvidenceRecord({
        aggregateType: 'contractor',
        aggregateId: 'contractor_701',
        sourceType: 'contractor',
        sourceId: 'contractor_701',
        sourceVersion: '1',
        evidenceType: 'review',
        sourceRef: 'reviews/rev_99',
        rawContent: '5 stars: Excellent rewiring of consumer unit.',
      });

      const res1 = await immutableIntelligenceStore.persistEvidence({ db: testDb, evidence: ev });
      expect(res1.isNew).toBe(true);

      // Re-persist idempotent
      const res2 = await immutableIntelligenceStore.persistEvidence({ db: testDb, evidence: ev });
      expect(res2.isNew).toBe(false);

      const fetched = await immutableIntelligenceStore.getEvidenceById(testDb, ev.evidenceId);
      expect(fetched?.contentHash).toBe(ev.contentHash);
    });
  });

  describe('7. Evidence Lineage & Provenance Chain Tracing', () => {
    it('builds an evidence chain trace linking extraction version to supporting evidence', () => {
      const ev1 = createEvidenceRecord({
        aggregateType: 'job',
        aggregateId: 'job_chain_801',
        sourceType: 'job',
        sourceId: 'job_chain_801',
        sourceVersion: '1',
        evidenceType: 'photo',
        sourceRef: 'photos/leak.jpg',
        rawContent: 'leak photo bytes',
      });

      const ev2 = createEvidenceRecord({
        aggregateType: 'job',
        aggregateId: 'job_chain_801',
        sourceType: 'job',
        sourceId: 'job_chain_801',
        sourceVersion: '1',
        evidenceType: 'user_description',
        sourceRef: 'desc',
        rawContent: 'Water dripping from ceiling',
      });

      const trace = buildEvidenceChainTrace(
        'ver_job_job_chain_801_abc123',
        'job',
        'job_chain_801',
        [
          { evidenceId: ev1.evidenceId, verified: ev1.verified },
          { evidenceId: ev2.evidenceId, verified: ev2.verified },
        ]
      );

      expect(trace.extractionVersionId).toBe('ver_job_job_chain_801_abc123');
      expect(trace.evidenceIds).toContain(ev1.evidenceId);
      expect(trace.evidenceIds).toContain(ev2.evidenceId);
      expect(trace.evidenceCount).toBe(2);
      expect(trace.allVerified).toBe(true);
    });
  });

  describe('8. Task 9A: Authoritative Firestore Evidence Store & Fail-Closed Invariants', () => {
    let registryTestDb: any;

    beforeEach(() => {
      registryTestDb = createInMemoryTestDb();
      evidenceRegistry.setDb(registryTestDb);
    });

    it('proves no process-local evidenceStore Map exists on EvidenceRegistry', () => {
      expect((evidenceRegistry as any).evidenceStore).toBeUndefined();
    });

    it('persists registered evidence directly to Firestore intelligence_evidence collection', async () => {
      const content = 'Worcester Greenstar 30i Combi Boiler Pressure Issue';
      const ev = await evidenceRegistry.register(
        'job',
        'job_firestore_1',
        'user_description',
        'jobs/job_firestore_1/desc',
        content,
        { source: 'web_portal' },
        true
      );

      // Verify returned object
      expect(ev.evidenceId).toBeDefined();
      expect(ev.contentHash).toBe(computeSha256(content));

      // Verify it exists in Firestore intelligence_evidence collection directly
      const docSnap = await registryTestDb.collection('intelligence_evidence').doc(ev.evidenceId).get();
      expect(docSnap.exists).toBe(true);
      const firestoreData = docSnap.data();
      expect(firestoreData.contentHash).toBe(computeSha256(content));
      expect(firestoreData.aggregateId).toBe('job_firestore_1');
    });

    it('reads evidence directly from Firestore (reads what is written to Firestore)', async () => {
      const manualEvidence = createEvidenceRecord({
        aggregateType: 'property',
        aggregateId: 'prop_manual_1',
        sourceType: 'property',
        sourceId: 'prop_manual_1',
        sourceVersion: '1',
        evidenceType: 'document',
        sourceRef: 'epc.pdf',
        rawContent: 'EPC Rating C - 72 Points',
      });

      // Insert directly into Firestore bypassing any in-memory state
      await registryTestDb.collection('intelligence_evidence').doc(manualEvidence.evidenceId).set(manualEvidence);

      // Fetch through evidenceRegistry - must find it in Firestore
      const fetched = await evidenceRegistry.get(manualEvidence.evidenceId);
      expect(fetched).not.toBeNull();
      expect(fetched?.aggregateId).toBe('prop_manual_1');
      expect(fetched?.contentHash).toBe(manualEvidence.contentHash);

      // Fetch for aggregate
      const aggregateEvidence = await evidenceRegistry.getForAggregate('property', 'prop_manual_1');
      expect(aggregateEvidence.length).toBe(1);
      expect(aggregateEvidence[0].evidenceId).toBe(manualEvidence.evidenceId);
    });

    it('FAILS CLOSED when Firestore is null or unavailable (no in-memory fallback)', async () => {
      const unconfiguredRegistry = new EvidenceRegistry(null);

      // register() must throw
      await expect(
        unconfiguredRegistry.register(
          'job',
          'job_fc_1',
          'user_description',
          'desc',
          'content'
        )
      ).rejects.toThrow(/Firestore database is not configured or ready/);

      // registerReferenceOnly() must throw
      await expect(
        unconfiguredRegistry.registerReferenceOnly(
          'job',
          'job_fc_1',
          'image',
          'https://image.url'
        )
      ).rejects.toThrow(/Firestore database is not configured or ready/);

      // registerStructuredData() must throw
      await expect(
        unconfiguredRegistry.registerStructuredData(
          'property',
          'prop_fc_1',
          'structured_spec',
          'spec',
          { epc: 'B' }
        )
      ).rejects.toThrow(/Firestore database is not configured or ready/);

      // verifyAndUpdateContent() must throw
      await expect(
        unconfiguredRegistry.verifyAndUpdateContent('some_id', 'new content')
      ).rejects.toThrow(/Firestore database transaction capability is required/);
    });

    it('is idempotent on duplicate registrations via evidenceRegistry.register()', async () => {
      const content = 'Identical evidence payload content';
      const ev1 = await evidenceRegistry.register(
        'job',
        'job_idem_1',
        'text',
        'notes',
        content
      );

      const ev2 = await evidenceRegistry.register(
        'job',
        'job_idem_1',
        'text',
        'notes',
        content
      );

      expect(ev1.evidenceId).toBe(ev2.evidenceId);
      expect(ev1.contentHash).toBe(ev2.contentHash);
    });

    it('rejects conflicting evidence mutation with [Evidence Immutability Error]', async () => {
      const original = 'Original verified survey report';
      const ev = await evidenceRegistry.register(
        'job',
        'job_tamper_1',
        'document',
        'survey.pdf',
        original,
        {},
        true,
        undefined,
        { customEvidenceId: 'ev_fixed_id_100' }
      );

      expect(ev.evidenceId).toBe('ev_fixed_id_100');

      // Attempt to overwrite with different content under same ID
      await expect(
        evidenceRegistry.register(
          'job',
          'job_tamper_1',
          'document',
          'survey.pdf',
          'Tampered fraudulent survey report',
          {},
          true,
          undefined,
          { customEvidenceId: 'ev_fixed_id_100' }
        )
      ).rejects.toThrow(/\[Evidence Immutability Error\] Cannot mutate historical evidence/);
    });

    it('atomically upgrades reference-only evidence in Firestore via verifyAndUpdateContent()', async () => {
      const refEv = await evidenceRegistry.registerReferenceOnly(
        'job',
        'job_upgrade_1',
        'image',
        'photos/leak.jpg'
      );

      expect(refEv.verified).toBe(false);
      expect(refEv.integrityStatus).toBe('reference_only');

      const photoBytes = Buffer.from('REAL_CAMERA_IMAGE_BYTES_123');
      const verifiedEv = await evidenceRegistry.verifyAndUpdateContent(refEv.evidenceId, photoBytes);

      expect(verifiedEv.verified).toBe(true);
      expect(verifiedEv.integrityStatus).toBe('verified');
      expect(verifiedEv.contentHash).toBe(computeSha256(photoBytes));

      // Confirm in Firestore directly
      const snap = await registryTestDb.collection('intelligence_evidence').doc(refEv.evidenceId).get();
      expect(snap.data().verified).toBe(true);
      expect(snap.data().contentHash).toBe(computeSha256(photoBytes));
    });
  });
});
