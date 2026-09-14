/**
 * AnyTrader V8.1 — Evidence Lineage Validator
 * 
 * Enforces the hard provenance boundary between evidence and historical intelligence:
 * "No evidence, no assertion."
 * 
 * Key Invariants:
 * 1. Existence: All referenced evidence must exist in authoritative Firestore.
 * 2. Integrity: Evidence must possess valid integrity status ('verified' with genuine SHA-256 or 'reference_only').
 * 3. Scope & Aggregate Relationship: Rejects cross-entity contamination (e.g. job_123 referencing job_999).
 *    Legitimate composite relationships (e.g. property rollups referencing constituent jobs) must be explicitly linked.
 * 4. Version Compatibility: Explicit sourceVersion mismatches on the same entity are rejected.
 * 5. Anti-AI Circularity: AI model outputs cannot satisfy their own evidence requirements.
 * 6. Fail-Closed: If Firestore is unavailable, validation strictly fails closed.
 */

import {
  EvidenceIntegrityStatus,
  IntelligenceAggregateType,
  IntelligenceEvidence,
  Provenance,
} from './types';
import { FirestoreDbLike, getGlobalIntelligenceDb } from './immutableStore';

export interface EvidenceLineageContract {
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  sourceVersion?: string | number;
  evidenceIds: string[];
  provenance?: Provenance;
  pipelineVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
}

export interface EvidenceLineageValidationResult {
  valid: boolean;
  validatedEvidenceCount: number;
  evidenceIds: string[];
  evidenceRecords: IntelligenceEvidence[];
  aggregateType: IntelligenceAggregateType;
  aggregateId: string;
  validatedAt: string;
}

export class EvidenceLineageValidator {
  private db: FirestoreDbLike | null = null;

  constructor(db?: FirestoreDbLike | null) {
    this.db = db || null;
  }

  public setDb(db: FirestoreDbLike | null): void {
    this.db = db;
  }

  private getEffectiveDb(db?: FirestoreDbLike | null): FirestoreDbLike | null {
    return db !== undefined ? db : (this.db || getGlobalIntelligenceDb());
  }

  /**
   * Validates the provenance relationship between an intelligence extraction and its referenced evidence.
   * Reads from Firestore (optionally inside a transaction for atomic snapshot isolation).
   * Fails closed if Firestore is unavailable or any rule is violated.
   */
  public async validateLineage(
    extraction: EvidenceLineageContract,
    db?: FirestoreDbLike | null,
    transaction?: any
  ): Promise<EvidenceLineageValidationResult> {
    const effectiveDb = this.getEffectiveDb(db);
    if (!effectiveDb) {
      throw new Error(
        '[EvidenceLineage Error] Firestore database is not configured or ready. Operational failure (Fail Closed).'
      );
    }

    // Step 8: No-evidence / no-assertion
    if (!extraction.evidenceIds || !Array.isArray(extraction.evidenceIds) || extraction.evidenceIds.length === 0) {
      throw new Error(
        '[EvidenceLineage Violation] No evidence provided: An intelligence extraction cannot be persisted without evidence references.'
      );
    }

    // Deduplicate while preserving order
    const rawIds = extraction.evidenceIds;
    const uniqueEvidenceIds = Array.from(new Set(rawIds));

    for (const id of uniqueEvidenceIds) {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('[EvidenceLineage Violation] Invalid empty evidence ID referenced in extraction.');
      }
    }

    const evidenceRecords: IntelligenceEvidence[] = [];

    // Step 4: Verify evidence exists in authoritative Firestore store
    for (const evidenceId of uniqueEvidenceIds) {
      const docRef = effectiveDb.collection('intelligence_evidence').doc(evidenceId);
      const snap = transaction && typeof transaction.get === 'function'
        ? await transaction.get(docRef)
        : await docRef.get();

      if (!snap || !snap.exists) {
        throw new Error(
          `[EvidenceLineage Violation] Referenced evidence '${evidenceId}' does not exist in authoritative Firestore store.`
        );
      }

      const evidence = (typeof snap.data === 'function' ? snap.data() : snap.data) as IntelligenceEvidence;
      if (!evidence || evidence.evidenceId !== evidenceId) {
        throw new Error(
          `[EvidenceLineage Violation] Evidence record '${evidenceId}' corrupted or ID mismatch.`
        );
      }

      // Step 18: Anti-AI Circularity Guard
      const isAiSelfClaim =
        evidence.sourceType === 'ai_output' ||
        evidence.evidenceType === 'ai_candidate' ||
        evidence.metadata?.isAiGenerated === true ||
        evidence.metadata?.aiSelfJustification === true ||
        (evidence.sourceRef && evidence.sourceRef.startsWith('ai_output:'));

      if (isAiSelfClaim) {
        throw new Error(
          `[EvidenceLineage Violation] Evidence '${evidenceId}' is an AI-generated assertion. AI outputs cannot satisfy their own evidence requirement.`
        );
      }

      // Step 7: Verify Evidence Integrity
      this.verifyEvidenceIntegrity(evidence);

      // Step 5: Verify Source / Aggregate Relationship & Cross-Entity Contamination
      this.verifyAggregateRelationship(extraction, evidence);

      // Step 6: Verify Source Version Compatibility
      this.verifySourceVersionCompatibility(extraction, evidence);

      evidenceRecords.push(evidence);
    }

    return {
      valid: true,
      validatedEvidenceCount: evidenceRecords.length,
      evidenceIds: uniqueEvidenceIds,
      evidenceRecords,
      aggregateType: extraction.aggregateType,
      aggregateId: extraction.aggregateId,
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Verifies the cryptographic integrity model of an evidence record.
   */
  private verifyEvidenceIntegrity(evidence: IntelligenceEvidence): void {
    const status: EvidenceIntegrityStatus = evidence.integrityStatus;

    if (status === 'verified') {
      if (!evidence.verified) {
        throw new Error(
          `[EvidenceLineage Violation] Evidence '${evidence.evidenceId}' has integrityStatus 'verified' but verified flag is false.`
        );
      }
      if (!evidence.contentHash || !/^[a-f0-9]{64}$/i.test(evidence.contentHash)) {
        throw new Error(
          `[EvidenceLineage Violation] Evidence '${evidence.evidenceId}' has invalid verified integrity: missing or malformed 64-character SHA-256 contentHash.`
        );
      }
      if (evidence.byteSize === undefined || evidence.byteSize === null || evidence.byteSize <= 0) {
        throw new Error(
          `[EvidenceLineage Violation] Evidence '${evidence.evidenceId}' has invalid verified integrity: byteSize must be greater than zero.`
        );
      }
    } else if (status === 'reference_only') {
      if (!evidence.sourceRef || typeof evidence.sourceRef !== 'string' || evidence.sourceRef.trim() === '') {
        throw new Error(
          `[EvidenceLineage Violation] Reference-only evidence '${evidence.evidenceId}' is missing a valid sourceRef pointer.`
        );
      }
      if (evidence.verified === true) {
        throw new Error(
          `[EvidenceLineage Violation] Reference-only evidence '${evidence.evidenceId}' cannot be marked as verified bytes.`
        );
      }
    } else {
      throw new Error(
        `[EvidenceLineage Violation] Evidence '${evidence.evidenceId}' has unverified or invalid integrityStatus '${status}'.`
      );
    }
  }

  /**
   * Verifies that the evidence belongs to or has an explicit documented relationship to the extraction target.
   * Prevents cross-entity contamination (e.g. job_123 claiming evidence belonging to job_999).
   */
  private verifyAggregateRelationship(
    extraction: EvidenceLineageContract,
    evidence: IntelligenceEvidence
  ): void {
    const extAggType = String(extraction.aggregateType || '').toLowerCase();
    const extAggId = String(extraction.aggregateId || '');
    const evAggType = String(evidence.aggregateType || '').toLowerCase();
    const evAggId = String(evidence.aggregateId || '');

    // 1. Same aggregate type: Must match aggregateId exactly
    if (extAggType === evAggType) {
      if (extAggId !== evAggId) {
        // Check if there is an explicit matching sourceId
        const sourceMatches = evidence.sourceId === extAggId;
        const refMatches =
          (extAggType === 'job' && evidence.sourceReference?.jobId === extAggId) ||
          (extAggType === 'property' && evidence.sourceReference?.propertyId === extAggId);

        if (!sourceMatches && !refMatches) {
          throw new Error(
            `[EvidenceLineage Violation] Cross-aggregate evidence reference rejected: Evidence '${evidence.evidenceId}' belongs to '${evidence.aggregateType}:${evidence.aggregateId}', not '${extraction.aggregateType}:${extraction.aggregateId}'.`
          );
        }
      }
      return;
    }

    // 2. Cross-aggregate relationships: Allowed only if explicitly linked
    // Example: Property rollups referencing job evidence from jobs on that property
    const isLinkedToProperty =
      extAggType === 'property' &&
      (evidence.sourceReference?.propertyId === extAggId ||
        evidence.metadata?.propertyId === extAggId ||
        evidence.sourceId === extAggId);

    const isLinkedToJob =
      extAggType === 'job' &&
      (evidence.sourceReference?.jobId === extAggId ||
        evidence.metadata?.jobId === extAggId ||
        evidence.sourceId === extAggId);

    const isLinkedToContractor =
      extAggType === 'contractor' &&
      (evidence.sourceReference?.contractorId === extAggId ||
        evidence.metadata?.contractorId === extAggId ||
        evidence.sourceId === extAggId);

    if (!isLinkedToProperty && !isLinkedToJob && !isLinkedToContractor) {
      throw new Error(
        `[EvidenceLineage Violation] Incompatible cross-aggregate relationship: Evidence '${evidence.evidenceId}' (aggregate: '${evidence.aggregateType}:${evidence.aggregateId}', source: '${evidence.sourceType}:${evidence.sourceId}') does not reference target '${extraction.aggregateType}:${extraction.aggregateId}'.`
      );
    }
  }

  /**
   * Verifies source version compatibility between extraction and evidence.
   */
  private verifySourceVersionCompatibility(
    extraction: EvidenceLineageContract,
    evidence: IntelligenceEvidence
  ): void {
    if (
      extraction.sourceVersion === undefined ||
      extraction.sourceVersion === null ||
      String(extraction.sourceVersion).trim() === ''
    ) {
      return;
    }

    if (
      evidence.sourceVersion === undefined ||
      evidence.sourceVersion === null ||
      String(evidence.sourceVersion).trim() === ''
    ) {
      return;
    }

    // Version checking applies when evidence is directly tied to the extraction aggregate
    const isDirectAggregate =
      evidence.aggregateId === extraction.aggregateId ||
      evidence.sourceId === extraction.aggregateId;

    if (isDirectAggregate) {
      const extVer = String(extraction.sourceVersion).trim();
      const evVer = String(evidence.sourceVersion).trim();

      if (extVer !== evVer) {
        throw new Error(
          `[EvidenceLineage Violation] Incompatible source version for evidence '${evidence.evidenceId}': extraction declares sourceVersion '${extVer}' but evidence explicitly declares sourceVersion '${evVer}'.`
        );
      }
    }
  }
}

export const evidenceLineageValidator = new EvidenceLineageValidator();
