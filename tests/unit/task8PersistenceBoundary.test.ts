import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ImmutableIntelligenceStore,
  immutableIntelligenceStore,
} from "../../src/server/intelligence/index.ts";
import {
  createInMemoryTestDb,
} from "../../src/server/intelligence/testDoubles.ts";
import {
  buildVersionId,
  computeStructuredDataHash,
} from "../../src/server/intelligence/provenance.ts";
import {
  CanonicalIntelligenceEvent,
  IntelligenceExtraction,
  JobIntelligence,
  QualityReview,
} from "../../src/server/intelligence/types.ts";

describe("Task 8: Intelligence Persistence Boundary Invariants", () => {
  let db: any;
  let store: ImmutableIntelligenceStore;

  beforeEach(() => {
    db = createInMemoryTestDb();
    store = new ImmutableIntelligenceStore();
  });

  it("Test 8.1 (HISTORICAL EXTRACTION BOUNDARY): persistOutput transactionally writes extractions, events, and summary pointer", async () => {
    const versionId = buildVersionId("job", "job_task8_101", 1, "v8.1", "gemini-3.7-flash", "job_extraction_v8.1", "1.0.0");

    const confidence = { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: "deterministic_heuristic" as const };
    const provenance = { source: "user", evidenceIds: ["ev_101"], pipelineVersion: "v8.1", modelVersion: "gemini-3.7-flash", promptVersion: "v1", generatedAt: new Date().toISOString(), sourceContentHash: "hash_101" };

    const extractionPayload: IntelligenceExtraction = {
      extractionId: "ext_job_101",
      versionId,
      aggregateType: "job",
      aggregateId: "job_task8_101",
      schemaVersion: "1.0.0",
      pipelineVersion: "v8.1",
      modelVersion: "gemini-3.7-flash",
      promptVersion: "job_extraction_v8.1",
      sourceVersion: 1,
      provider: "google_genai",
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: "h101", encoding: "gzip", originalBytes: 10, compressedBytes: 10, compressionRatio: 1.0, schemaVersion: "1.0.0", storagePath: "path_101", createdAt: new Date().toISOString() },
      structuredCandidate: { category: "Plumbing", problem: "Burst Pipe" },
      evidenceIds: ["ev_101"],
      confidence,
      provenance,
    };

    const eventPayload: CanonicalIntelligenceEvent = {
      eventId: "ie_ev_101",
      aggregateType: "job",
      aggregateId: "job_task8_101",
      eventType: "JOB_ANALYSIS_COMPLETED",
      schemaVersion: "1.0.0",
      pipelineVersion: "v8.1",
      modelVersion: "gemini-3.7-flash",
      promptVersion: "job_extraction_v8.1",
      createdAt: new Date().toISOString(),
      source: "jobs/job_task8_101",
      evidenceIds: ["ev_101"],
      confidence,
      provenance,
      status: "valid",
      payload: { category: "Plumbing" },
    };

    const summaryPayload: JobIntelligence = {
      jobId: "job_task8_101",
      currentVersionId: versionId,
      category: "Plumbing",
      buildingComponent: "Pipe",
      observedProblem: "Burst Pipe",
      extractedScope: ["Repair pipe"],
      recommendedIntervention: "Solder joint",
      evidenceIds: ["ev_101"],
      confidence,
      provenance,
      pipelineVersion: "v8.1",
      updatedAt: new Date().toISOString(),
    };

    const result = await store.persistOutput({
      db,
      aggregateType: "job",
      aggregateId: "job_task8_101",
      versionId,
      extraction: extractionPayload,
      event: eventPayload,
      summaryProjection: summaryPayload,
    });

    expect(result.isNew).toBe(true);
    expect(result.versionId).toBe(versionId);

    // Verify extraction is stored in Category A (intelligence_extractions)
    const storedExtractionDoc = await db.collection("intelligence_extractions").doc(versionId).get();
    expect(storedExtractionDoc.exists).toBe(true);
    expect(storedExtractionDoc.data().versionId).toBe(versionId);

    // Verify event is stored in Category A (intelligence_events)
    const storedEventDoc = await db.collection("intelligence_events").doc("ie_ev_101").get();
    expect(storedEventDoc.exists).toBe(true);
    expect(storedEventDoc.data().eventId).toBe("ie_ev_101");

    // Verify summary is stored in Category B (intelligence_jobs)
    const storedSummaryDoc = await db.collection("intelligence_jobs").doc("job_task8_101").get();
    expect(storedSummaryDoc.exists).toBe(true);
    expect(storedSummaryDoc.data().currentVersionId).toBe(versionId);
  });

  it("Test 8.2 (QUALITY REVIEW BOUNDARY): persistQualityReview transactionally writes review and audit event", async () => {
    const review: QualityReview = {
      qualityId: "qr_801",
      targetCollection: "intelligence_jobs",
      targetId: "job_task8_101",
      action: "reject",
      reviewerId: "admin_1",
      reviewedAt: new Date().toISOString(),
      reason: "Incorrect category classification",
      originalCandidate: { category: "Plumbing" },
      correctedResult: { category: "Heating" },
      correctionProvenance: {
        reviewerId: "admin_1",
        timestamp: new Date().toISOString(),
        hash: "hash_qr_801",
      },
    };

    const auditEvent: CanonicalIntelligenceEvent = {
      eventId: "ie_audit_801",
      aggregateType: "job",
      aggregateId: "job_task8_101",
      eventType: "QUALITY_REVIEW_APPLIED",
      schemaVersion: "1.0.0",
      pipelineVersion: "v8.1",
      modelVersion: "human_admin",
      promptVersion: "manual",
      createdAt: new Date().toISOString(),
      source: "admin/quality",
      evidenceIds: [],
      confidence: { overall: 1.0, extraction: 1.0, evidenceQuality: 1.0, classification: 1.0, temporalFreshness: 1.0, method: "human_verified" },
      provenance: { source: "admin", evidenceIds: [], pipelineVersion: "v8.1", modelVersion: "human", promptVersion: "manual", generatedAt: new Date().toISOString(), sourceContentHash: "hash_admin" },
      status: "valid",
      payload: { qualityId: "qr_801", action: "REJECT" },
    };

    const res = await store.persistQualityReview({
      db,
      review,
      auditEvent,
    });

    expect(res.qualityId).toBe("qr_801");
    expect(res.eventId).toBe("ie_audit_801");

    // Verify quality review doc stored in Category C (intelligence_quality)
    const storedQualityDoc = await db.collection("intelligence_quality").doc("qr_801").get();
    expect(storedQualityDoc.exists).toBe(true);
    expect(storedQualityDoc.data().action).toBe("reject");

    // Verify audit event stored in Category A (intelligence_events)
    const storedAuditEventDoc = await db.collection("intelligence_events").doc("ie_audit_801").get();
    expect(storedAuditEventDoc.exists).toBe(true);
    expect(storedAuditEventDoc.data().eventType).toBe("QUALITY_REVIEW_APPLIED");
  });

  it("Test 8.3 (SEPARATION OF CONCERNS): creating a new version preserves previous version while updating active summary pointer", async () => {
    const version1 = buildVersionId("job", "job_task8_102", 1, "v8.1", "gemini-3.7-flash", "job_extraction_v8.1", "1.0.0");
    const version2 = buildVersionId("job", "job_task8_102", 2, "v8.1", "gemini-3.7-flash", "job_extraction_v8.1", "1.0.0");

    const confidence = { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: "deterministic_heuristic" as const };
    const provenance = { source: "user", evidenceIds: ["ev_102"], pipelineVersion: "v8.1", modelVersion: "gemini-3.7-flash", promptVersion: "v1", generatedAt: new Date().toISOString(), sourceContentHash: "hash_102" };

    const extraction1: IntelligenceExtraction = {
      extractionId: "ext_job_102_v1",
      versionId: version1,
      aggregateType: "job",
      aggregateId: "job_task8_102",
      schemaVersion: "1.0.0",
      pipelineVersion: "v8.1",
      modelVersion: "gemini-3.7-flash",
      promptVersion: "job_extraction_v8.1",
      sourceVersion: 1,
      provider: "google_genai",
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: "h102_v1", encoding: "gzip", originalBytes: 10, compressedBytes: 10, compressionRatio: 1.0, schemaVersion: "1.0.0", storagePath: "path_102_1", createdAt: new Date().toISOString() },
      structuredCandidate: { category: "Electrical", problem: "Flickering Lights" },
      evidenceIds: ["ev_102"],
      confidence,
      provenance,
    };

    const event1: CanonicalIntelligenceEvent = {
      eventId: "ie_ev_102_v1",
      aggregateType: "job",
      aggregateId: "job_task8_102",
      eventType: "JOB_ANALYSIS_COMPLETED",
      schemaVersion: "1.0.0",
      pipelineVersion: "v8.1",
      modelVersion: "gemini-3.7-flash",
      promptVersion: "job_extraction_v8.1",
      createdAt: new Date().toISOString(),
      source: "jobs/job_task8_102",
      evidenceIds: ["ev_102"],
      confidence,
      provenance,
      status: "valid",
      payload: { category: "Electrical" },
    };

    const summary1: JobIntelligence = {
      jobId: "job_task8_102",
      currentVersionId: version1,
      category: "Electrical",
      buildingComponent: "Wiring",
      observedProblem: "Flickering Lights",
      extractedScope: ["Check fuse box"],
      recommendedIntervention: "Rewire circuit",
      evidenceIds: ["ev_102"],
      confidence,
      provenance,
      pipelineVersion: "v8.1",
      updatedAt: new Date().toISOString(),
    };

    // Write version 1
    await store.persistOutput({
      db,
      aggregateType: "job",
      aggregateId: "job_task8_102",
      versionId: version1,
      extraction: extraction1,
      event: event1,
      summaryProjection: summary1,
    });

    // Write version 2 for same aggregate
    const extraction2: IntelligenceExtraction = {
      ...extraction1,
      extractionId: "ext_job_102_v2",
      versionId: version2,
      sourceVersion: 2,
      structuredCandidate: { category: "Electrical", problem: "Blown Fuse Box" },
    };

    const event2: CanonicalIntelligenceEvent = {
      ...event1,
      eventId: "ie_ev_102_v2",
    };

    const summary2: JobIntelligence = {
      ...summary1,
      currentVersionId: version2,
      observedProblem: "Blown Fuse Box",
    };

    await store.persistOutput({
      db,
      aggregateType: "job",
      aggregateId: "job_task8_102",
      versionId: version2,
      extraction: extraction2,
      event: event2,
      summaryProjection: summary2,
    });

    // Verify version 1 document still exists unchanged
    const storedV1Doc = await db.collection("intelligence_extractions").doc(version1).get();
    expect(storedV1Doc.exists).toBe(true);
    expect(storedV1Doc.data().structuredCandidate.problem).toBe("Flickering Lights");

    // Verify version 2 document exists
    const storedV2Doc = await db.collection("intelligence_extractions").doc(version2).get();
    expect(storedV2Doc.exists).toBe(true);
    expect(storedV2Doc.data().structuredCandidate.problem).toBe("Blown Fuse Box");

    // Verify summary pointer reflects version 2
    const summaryDoc = await db.collection("intelligence_jobs").doc("job_task8_102").get();
    expect(summaryDoc.data().currentVersionId).toBe(version2);
    expect(summaryDoc.data().observedProblem).toBe("Blown Fuse Box");
  });

  it("Test 8.4 (MUTATION REJECTION & IDEMPOTENCY): rejects modification of existing version, allows exact idempotent retry", async () => {
    const versionId = buildVersionId("job", "job_task8_103", 1, "v8.1", "gemini-3.7-flash", "job_extraction_v8.1", "1.0.0");

    const confidence = { overall: 0.9, extraction: 0.9, evidenceQuality: 0.9, classification: 0.9, temporalFreshness: 0.9, method: "deterministic_heuristic" as const };
    const provenance = { source: "user", evidenceIds: ["ev_103"], pipelineVersion: "v8.1", modelVersion: "gemini-3.7-flash", promptVersion: "v1", generatedAt: new Date().toISOString(), sourceContentHash: "hash_103" };

    const extraction: IntelligenceExtraction = {
      extractionId: "ext_job_103",
      versionId,
      aggregateType: "job",
      aggregateId: "job_task8_103",
      schemaVersion: "1.0.0",
      pipelineVersion: "v8.1",
      modelVersion: "gemini-3.7-flash",
      promptVersion: "job_extraction_v8.1",
      sourceVersion: 1,
      provider: "google_genai",
      createdAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      rawManifest: { sha256: "h103", encoding: "gzip", originalBytes: 10, compressedBytes: 10, compressionRatio: 1.0, schemaVersion: "1.0.0", storagePath: "path_103", createdAt: new Date().toISOString() },
      structuredCandidate: { category: "Roofing", problem: "Tile Slip" },
      evidenceIds: ["ev_103"],
      confidence,
      provenance,
    };

    const event: CanonicalIntelligenceEvent = {
      eventId: "ie_ev_103",
      aggregateType: "job",
      aggregateId: "job_task8_103",
      eventType: "JOB_ANALYSIS_COMPLETED",
      schemaVersion: "1.0.0",
      pipelineVersion: "v8.1",
      modelVersion: "gemini-3.7-flash",
      promptVersion: "job_extraction_v8.1",
      createdAt: new Date().toISOString(),
      source: "jobs/job_task8_103",
      evidenceIds: ["ev_103"],
      confidence,
      provenance,
      status: "valid",
      payload: { category: "Roofing" },
    };

    const summary: JobIntelligence = {
      jobId: "job_task8_103",
      currentVersionId: versionId,
      category: "Roofing",
      buildingComponent: "Roof",
      observedProblem: "Tile Slip",
      extractedScope: ["Replace tile"],
      recommendedIntervention: "Slate repair",
      evidenceIds: ["ev_103"],
      confidence,
      provenance,
      pipelineVersion: "v8.1",
      updatedAt: new Date().toISOString(),
    };

    // First write
    const res1 = await store.persistOutput({
      db,
      aggregateType: "job",
      aggregateId: "job_task8_103",
      versionId,
      extraction,
      event,
      summaryProjection: summary,
    });
    expect(res1.isNew).toBe(true);

    // Exact retry -> Idempotent success (isNew = false)
    const res2 = await store.persistOutput({
      db,
      aggregateType: "job",
      aggregateId: "job_task8_103",
      versionId,
      extraction,
      event,
      summaryProjection: summary,
    });
    expect(res2.isNew).toBe(false);
    expect(res2.versionId).toBe(versionId);

    // Modified content for SAME versionId -> Rejection
    const tamperedExtraction: IntelligenceExtraction = {
      ...extraction,
      structuredCandidate: { category: "Roofing", problem: "TAMPERED PROBLEM" },
    };

    await expect(
      store.persistOutput({
        db,
        aggregateType: "job",
        aggregateId: "job_task8_103",
        versionId,
        extraction: tamperedExtraction,
        event,
        summaryProjection: summary,
      })
    ).rejects.toThrow(/Cannot mutate historical intelligence version/);
  });

  it("Test 8.5 (FAIL CLOSED ON MISSING TRANSACTION): persistQualityReview fails closed if runTransaction is missing", async () => {
    const nonTxDb = {
      collection: () => ({
        doc: () => ({ set: vi.fn() }),
      }),
    };

    const review: QualityReview = {
      qualityId: "qr_805",
      targetCollection: "intelligence_jobs",
      targetId: "job_805",
      action: "approve",
      reviewerId: "admin",
      reviewedAt: new Date().toISOString(),
      reason: "Approved by admin",
      originalCandidate: { category: "Plumbing" },
      correctionProvenance: {
        reviewerId: "admin",
        timestamp: new Date().toISOString(),
        hash: "hash_qr_805",
      },
    };

    const auditEvent: CanonicalIntelligenceEvent = {
      eventId: "ie_audit_805",
      aggregateType: "job",
      aggregateId: "job_805",
      eventType: "QUALITY_REVIEW_APPLIED",
      schemaVersion: "1.0.0",
      pipelineVersion: "v8.1",
      modelVersion: "human",
      promptVersion: "manual",
      createdAt: new Date().toISOString(),
      source: "admin",
      evidenceIds: [],
      confidence: { overall: 1, extraction: 1, evidenceQuality: 1, classification: 1, temporalFreshness: 1, method: "human_verified" },
      provenance: { source: "admin", evidenceIds: [], pipelineVersion: "v8.1", modelVersion: "human", promptVersion: "manual", generatedAt: new Date().toISOString(), sourceContentHash: "hash" },
      status: "valid",
      payload: {},
    };

    await expect(
      store.persistQualityReview({
        db: nonTxDb as any,
        review,
        auditEvent,
      })
    ).rejects.toThrow(/Firestore transaction capability \(runTransaction\) is required/);
  });
});
