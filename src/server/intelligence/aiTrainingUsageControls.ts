/**
 * AnyTrader V8.3 — Task 31 AI Training & Usage Controls
 * 
 * Server-authoritative AI Usage & Training Control Engine building on:
 * - Task 27 DataRightsService
 * - Task 28 ProvenanceGraphService
 * - Task 29 ContractorArchiveRightsService
 * - Task 30 DataClassificationEligibilityService
 * 
 * Core Invariants:
 * - Canonical Tenant Model: Strict UID-as-Tenant (tenantId === request.auth.uid)
 * - Conservative Semantics: unknown / unclassified / unconsented is NEVER silently externally eligible
 * - Explicit Purpose Isolation: internal_ai_use != external_ai_training
 *   Permission for internal AnyTrader AI use MUST NOT automatically authorize external AI training,
 *   third-party sharing, commercial licensing, or export.
 * - Training Consent Boundary: external_ai_training strictly requires explicit opt_in trainingConsent status.
 * - Non-Authority of Client Inputs: Client cannot supply permission, consent, or eligibility.
 * - Cryptographic & Deterministic Identifiers: SHA-256 for controls, decisions, and content integrity.
 * - Append-Only Immutability: Controls updates append to /ai_usage_controls_history, decisions log to /ai_usage_decisions.
 */

import * as admin from 'firebase-admin';
import { computeSha256, computeStructuredDataHash } from './provenance';
import {
  DataRightsService,
  dataRightsService,
  RightsPurpose,
  PurposePermission,
  DataRightsRecord,
} from './dataRights';
import {
  ProvenanceGraphService,
  provenanceGraphService,
} from './provenanceGraph';
import {
  ContractorArchiveRightsService,
  contractorArchiveRightsService,
} from './contractorArchiveRights';
import {
  DataClassificationEligibilityService,
  dataClassificationEligibilityService,
  DataClassificationRecord,
} from './dataClassificationEligibility';

// =============================================================================
// DOMAIN TYPES & VOCABULARIES
// =============================================================================

export const AI_USAGE_PURPOSES = [
  'internal_ai_use',
  'external_ai_training',
  'third_party_sharing',
  'commercial_licensing',
  'export',
] as const;

export type AiUsagePurpose = typeof AI_USAGE_PURPOSES[number];

export const AI_USAGE_SCOPES = [
  'canonical_record',
  'derived_intelligence',
  'raw_evidence',
  'aggregate_analytics',
] as const;

export type AiUsageScope = typeof AI_USAGE_SCOPES[number];

export const AI_TRAINING_CONSENT_STATUSES = [
  'opt_in',
  'opt_out',
  'unknown',
  'revoked',
] as const;

export type AiTrainingConsentStatus = typeof AI_TRAINING_CONSENT_STATUSES[number];

export const AI_USAGE_CONTROL_STATUSES = [
  'active',
  'revoked',
  'superseded',
] as const;

export type AiUsageControlStatus = typeof AI_USAGE_CONTROL_STATUSES[number];

export const AI_USAGE_DECISION_OUTCOMES = [
  'allowed',
  'denied',
  'unknown',
  'blocked_by_tenant',
  'blocked_by_consent',
  'blocked_by_purpose_mismatch',
  'blocked_by_classification',
  'blocked_by_provenance',
  'blocked_by_restriction',
  'blocked_by_status',
  'blocked_by_model_tier',
] as const;

export type AiUsageDecisionOutcome = typeof AI_USAGE_DECISION_OUTCOMES[number];

export interface AiUsageProvenanceRef {
  nodeId?: string;
  tenantId: string;
  sourceType?: string;
  sourceId?: string;
  sourceVersion?: string;
}

export interface AiUsageRightsRef {
  rightsId: string;
  tenantId: string;
}

export interface AiUsageClassificationRef {
  classificationId: string;
  tenantId: string;
}

export interface AiUsageArchiveRef {
  archiveId: string;
  tenantId: string;
  componentKey?: string;
}

export interface AiUsageControlRecord {
  controlId: string;
  tenantId: string;
  recordType: string;
  recordId: string;
  scope: AiUsageScope;
  purposes: Record<AiUsagePurpose, PurposePermission>;
  trainingConsent: AiTrainingConsentStatus;
  modelTiersAllowed: string[];
  restrictions: string[];
  status: AiUsageControlStatus;
  version: number;
  provenanceRef: AiUsageProvenanceRef;
  rightsRef?: AiUsageRightsRef;
  classificationRef?: AiUsageClassificationRef;
  archiveRef?: AiUsageArchiveRef;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  revocationReason?: string;
}

export interface RegisterAiUsageControlsInput {
  controlId?: string;
  tenantId: string;
  recordType: string;
  recordId: string;
  scope?: AiUsageScope;
  purposes?: Partial<Record<AiUsagePurpose, PurposePermission>>;
  trainingConsent?: AiTrainingConsentStatus;
  modelTiersAllowed?: string[];
  restrictions?: string[];
  provenanceRef: AiUsageProvenanceRef;
  rightsRef?: AiUsageRightsRef;
  classificationRef?: AiUsageClassificationRef;
  archiveRef?: AiUsageArchiveRef;
  recordedBy?: string;
}

export interface EvaluateAiUsageRequest {
  tenantId: string;
  recordType: string;
  recordId: string;
  requestedPurpose: AiUsagePurpose;
  controlId?: string;
  targetModelTier?: string;
  context?: {
    callerUid?: string;
    isInternalAi?: boolean;
    clientRole?: string;
  };
}

export interface AiUsageDecisionRecord {
  decisionId: string;
  tenantId: string;
  controlId: string;
  recordType: string;
  recordId: string;
  requestedPurpose: AiUsagePurpose;
  outcome: AiUsageDecisionOutcome;
  allowed: boolean;
  trainingConsent: AiTrainingConsentStatus;
  reasons: string[];
  evaluations: {
    tenantMatch: boolean;
    statusActive: boolean;
    purposePermission: PurposePermission;
    trainingConsentValid: boolean;
    provenanceValid: boolean;
    classificationValid?: boolean;
    rightsValid?: boolean;
    archiveValid?: boolean;
    modelTierValid?: boolean;
  };
  decisionHash: string;
  evaluatedAt: string;
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class AiUsageControlsSecurityError extends Error {
  constructor(message: string) {
    super(`[AiUsageControlsSecurityError] ${message}`);
    this.name = 'AiUsageControlsSecurityError';
  }
}

export class AiUsageControlsValidationError extends Error {
  constructor(message: string) {
    super(`[AiUsageControlsValidationError] ${message}`);
    this.name = 'AiUsageControlsValidationError';
  }
}

// =============================================================================
// HASHING & IDENTIFIER UTILITIES
// =============================================================================

export function computeAiControlId(tenantId: string, recordType: string, recordId: string): string {
  if (!tenantId || !recordType || !recordId) {
    throw new AiUsageControlsValidationError('Missing mandatory fields for computeAiControlId (tenantId, recordType, recordId)');
  }
  const digest = computeSha256(`${tenantId.trim()}:${recordType.trim()}:${recordId.trim()}`);
  return `aicontrol_${digest.substring(0, 24)}`;
}

export function computeAiControlContentHash(record: Record<string, any>): string {
  const payload = {
    controlId: record.controlId,
    tenantId: record.tenantId,
    recordType: record.recordType,
    recordId: record.recordId,
    scope: record.scope,
    purposes: record.purposes,
    trainingConsent: record.trainingConsent,
    modelTiersAllowed: record.modelTiersAllowed || [],
    restrictions: record.restrictions || [],
    status: record.status,
    version: record.version,
    provenanceRef: record.provenanceRef,
    rightsRef: record.rightsRef || null,
    classificationRef: record.classificationRef || null,
    archiveRef: record.archiveRef || null,
  };
  return computeStructuredDataHash(payload);
}

export function computeAiDecisionHash(decision: Record<string, any>): string {
  const payload = {
    tenantId: decision.tenantId,
    controlId: decision.controlId,
    requestedPurpose: decision.requestedPurpose,
    outcome: decision.outcome,
    allowed: decision.allowed,
    trainingConsent: decision.trainingConsent,
    reasons: decision.reasons,
    evaluatedAt: decision.evaluatedAt,
  };
  return computeStructuredDataHash(payload);
}

function cleanUndefinedValues<T extends Record<string, any>>(obj: T): T {
  const cleanObj: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        cleanObj[key] = cleanUndefinedValues(val);
      } else {
        cleanObj[key] = val;
      }
    }
  }
  return cleanObj as T;
}

// =============================================================================
// AI TRAINING & USAGE CONTROLS SERVICE
// =============================================================================

export class AiTrainingUsageControlsService {
  private firestoreDb: admin.firestore.Firestore | null = null;
  private rightsService: DataRightsService;
  private provenanceService: ProvenanceGraphService;
  private archiveService: ContractorArchiveRightsService;
  private classificationService: DataClassificationEligibilityService;

  constructor(
    db?: admin.firestore.Firestore,
    rightsService?: DataRightsService,
    provenanceService?: ProvenanceGraphService,
    archiveService?: ContractorArchiveRightsService,
    classificationService?: DataClassificationEligibilityService
  ) {
    if (db) {
      this.firestoreDb = db;
    }
    this.rightsService = rightsService || dataRightsService;
    this.provenanceService = provenanceService || provenanceGraphService;
    this.archiveService = archiveService || contractorArchiveRightsService;
    this.classificationService = classificationService || dataClassificationEligibilityService;
  }

  public setFirestoreDb(db: admin.firestore.Firestore) {
    this.firestoreDb = db;
    if (this.rightsService && typeof (this.rightsService as any).setFirestoreDb === 'function') {
      (this.rightsService as any).setFirestoreDb(db);
    }
    if (this.provenanceService && typeof (this.provenanceService as any).setFirestoreDb === 'function') {
      (this.provenanceService as any).setFirestoreDb(db);
    }
    if (this.archiveService && typeof (this.archiveService as any).setFirestoreDb === 'function') {
      (this.archiveService as any).setFirestoreDb(db);
    }
    if (this.classificationService && typeof (this.classificationService as any).setFirestoreDb === 'function') {
      (this.classificationService as any).setFirestoreDb(db);
    }
  }

  private getDb(): admin.firestore.Firestore {
    if (this.firestoreDb) return this.firestoreDb;
    try {
      this.firestoreDb = admin.firestore();
      return this.firestoreDb;
    } catch {
      throw new Error('Firebase Admin DB is not initialized. Pass db or call initializeApp first.');
    }
  }

  /**
   * Registers or updates server-authoritative AI usage controls record.
   */
  public async registerAiUsageControls(
    input: RegisterAiUsageControlsInput
  ): Promise<AiUsageControlRecord> {
    if (!input.tenantId || input.tenantId.trim() === '') {
      throw new AiUsageControlsValidationError('Missing mandatory tenantId');
    }
    if (!input.recordType || input.recordType.trim() === '') {
      throw new AiUsageControlsValidationError('Missing mandatory recordType');
    }
    if (!input.recordId || input.recordId.trim() === '') {
      throw new AiUsageControlsValidationError('Missing mandatory recordId');
    }
    if (!input.provenanceRef || !input.provenanceRef.tenantId) {
      throw new AiUsageControlsValidationError('Missing mandatory provenanceRef with valid tenantId');
    }

    // Cross-tenant provenance check
    if (input.provenanceRef.tenantId !== input.tenantId) {
      throw new AiUsageControlsSecurityError(
        `Provenance tenantId (${input.provenanceRef.tenantId}) does not match input tenantId (${input.tenantId})`
      );
    }

    // Verify provenance graph node existence if nodeId is supplied
    if (input.provenanceRef.nodeId) {
      const provRes = await this.provenanceService.validateProvenanceReference({
        tenantId: input.tenantId,
        nodeId: input.provenanceRef.nodeId,
        sourceType: input.provenanceRef.sourceType,
        sourceId: input.provenanceRef.sourceId,
        sourceVersion: input.provenanceRef.sourceVersion,
      });
      if (!provRes.valid) {
        throw new AiUsageControlsValidationError(
          `Provenance reference validation failed for nodeId: ${input.provenanceRef.nodeId}`
        );
      }
    }

    // Check optional references for cross-tenant mismatches
    if (input.rightsRef && input.rightsRef.tenantId !== input.tenantId) {
      throw new AiUsageControlsSecurityError('Rights reference tenant mismatch');
    }
    if (input.classificationRef && input.classificationRef.tenantId !== input.tenantId) {
      throw new AiUsageControlsSecurityError('Classification reference tenant mismatch');
    }
    if (input.archiveRef && input.archiveRef.tenantId !== input.tenantId) {
      throw new AiUsageControlsSecurityError('Archive reference tenant mismatch');
    }

    const controlId = input.controlId || computeAiControlId(input.tenantId, input.recordType, input.recordId);
    const scope: AiUsageScope = input.scope && AI_USAGE_SCOPES.includes(input.scope) ? input.scope : 'canonical_record';
    const trainingConsent: AiTrainingConsentStatus =
      input.trainingConsent && AI_TRAINING_CONSENT_STATUSES.includes(input.trainingConsent)
        ? input.trainingConsent
        : 'unknown';

    // Default purpose mapping: internal_ai_use default 'allowed', others default 'unknown' unless explicitly set
    const defaultPurposes: Record<AiUsagePurpose, PurposePermission> = {
      internal_ai_use: 'allowed',
      external_ai_training: 'unknown',
      third_party_sharing: 'unknown',
      commercial_licensing: 'unknown',
      export: 'unknown',
    };

    const finalPurposes: Record<AiUsagePurpose, PurposePermission> = {
      ...defaultPurposes,
      ...(input.purposes || {}),
    };

    const now = new Date().toISOString();

    const partialRecord = {
      controlId,
      tenantId: input.tenantId,
      recordType: input.recordType,
      recordId: input.recordId,
      scope,
      purposes: finalPurposes,
      trainingConsent,
      modelTiersAllowed: input.modelTiersAllowed || [],
      restrictions: input.restrictions || [],
      status: 'active' as const,
      version: 1,
      provenanceRef: input.provenanceRef,
      rightsRef: input.rightsRef,
      classificationRef: input.classificationRef,
      archiveRef: input.archiveRef,
      createdAt: now,
      updatedAt: now,
    };

    const contentHash = computeAiControlContentHash(partialRecord);

    const record: AiUsageControlRecord = {
      ...partialRecord,
      contentHash,
    };

    const cleanedRecord = cleanUndefinedValues(record);
    const db = this.getDb();

    // Check existing
    const docRef = db.collection('ai_usage_controls').doc(controlId);
    const existingSnap = await docRef.get();

    if (existingSnap.exists) {
      const existingData = existingSnap.data() as AiUsageControlRecord;
      cleanedRecord.version = (existingData.version || 1) + 1;
      cleanedRecord.createdAt = existingData.createdAt || now;
      cleanedRecord.contentHash = computeAiControlContentHash(cleanedRecord);
    }

    await docRef.set(cleanedRecord);

    // Append to history snapshot
    const historyId = `aicontrolh_${computeSha256(`${input.tenantId}:${controlId}:${cleanedRecord.version}:${now}`).substring(0, 24)}`;
    const historyRecord = cleanUndefinedValues({
      historyId,
      ...cleanedRecord,
      recordedBy: input.recordedBy || input.tenantId,
      snapshotTimestamp: now,
    });

    await db.collection('ai_usage_controls_history').doc(historyId).set(historyRecord);

    return cleanedRecord;
  }

  /**
   * Evaluates AI Usage & Training eligibility for a requested purpose.
   * STRICT INVARIANT: internal_ai_use != external_ai_training.
   */
  public async evaluateAiUsageEligibility(
    request: EvaluateAiUsageRequest
  ): Promise<AiUsageDecisionRecord> {
    if (!request.tenantId || request.tenantId.trim() === '') {
      throw new AiUsageControlsValidationError('Missing mandatory tenantId in evaluateAiUsageEligibility');
    }
    if (!request.requestedPurpose || !AI_USAGE_PURPOSES.includes(request.requestedPurpose)) {
      throw new AiUsageControlsValidationError(`Invalid or missing requestedPurpose: ${request.requestedPurpose}`);
    }

    const now = new Date().toISOString();
    const controlId = request.controlId || computeAiControlId(request.tenantId, request.recordType, request.recordId);
    const db = this.getDb();

    const docSnap = await db.collection('ai_usage_controls').doc(controlId).get();

    if (!docSnap.exists) {
      const fallbackHash = computeSha256(`${request.tenantId}:${controlId}:${request.requestedPurpose}:${now}`);
      const decisionId = `aidec_${fallbackHash.substring(0, 24)}`;

      const decision: AiUsageDecisionRecord = {
        decisionId,
        tenantId: request.tenantId,
        controlId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        outcome: 'unknown',
        allowed: false,
        trainingConsent: 'unknown',
        reasons: ['AI usage control record not found for record'],
        evaluations: {
          tenantMatch: false,
          statusActive: false,
          purposePermission: 'unknown',
          trainingConsentValid: false,
          provenanceValid: false,
        },
        decisionHash: '',
        evaluatedAt: now,
      };

      decision.decisionHash = computeAiDecisionHash(decision);
      await db.collection('ai_usage_decisions').doc(decisionId).set(cleanUndefinedValues(decision));
      return decision;
    }

    const controlRecord = docSnap.data() as AiUsageControlRecord;
    const reasons: string[] = [];

    // 1. Tenant match verification
    const tenantMatch = controlRecord.tenantId === request.tenantId;
    if (!tenantMatch) {
      reasons.push(`Tenant mismatch: request tenant ${request.tenantId} != record tenant ${controlRecord.tenantId}`);
    }

    // 2. Status verification
    const statusActive = controlRecord.status === 'active';
    if (!statusActive) {
      reasons.push(`AI control record status is ${controlRecord.status}`);
    }

    // 3. Provenance verification
    let provenanceValid = true;
    if (request.requestedPurpose === 'external_ai_training') {
      if (!controlRecord.provenanceRef || !controlRecord.provenanceRef.nodeId) {
        provenanceValid = false;
        reasons.push('External AI training requires a valid canonical Task 28 provenance nodeId');
      } else {
        const provRes = await this.provenanceService.validateProvenanceReference({
          tenantId: request.tenantId,
          nodeId: controlRecord.provenanceRef.nodeId,
          sourceType: controlRecord.provenanceRef.sourceType,
          sourceId: controlRecord.provenanceRef.sourceId,
          sourceVersion: controlRecord.provenanceRef.sourceVersion,
        });
        provenanceValid = provRes.valid === true;
        if (!provenanceValid) {
          reasons.push(`Provenance graph validation failed for AI usage control record: ${provRes.reason || 'invalid'}`);
        }
      }
    } else if (controlRecord.provenanceRef && controlRecord.provenanceRef.nodeId) {
      const provRes = await this.provenanceService.validateProvenanceReference({
        tenantId: request.tenantId,
        nodeId: controlRecord.provenanceRef.nodeId,
        sourceType: controlRecord.provenanceRef.sourceType,
        sourceId: controlRecord.provenanceRef.sourceId,
        sourceVersion: controlRecord.provenanceRef.sourceVersion,
      });
      provenanceValid = provRes.valid === true;
      if (!provenanceValid) {
        reasons.push('Provenance graph validation failed for AI usage control record');
      }
    }

    // 4. Purpose evaluation
    // INVARIANT: internal_ai_use != external_ai_training
    const purposePermission: PurposePermission = controlRecord.purposes[request.requestedPurpose] || 'unknown';

    // 5. Training Consent evaluation
    let trainingConsentValid = true;
    if (request.requestedPurpose === 'external_ai_training') {
      trainingConsentValid = controlRecord.trainingConsent === 'opt_in' && purposePermission === 'allowed';
      if (controlRecord.trainingConsent !== 'opt_in') {
        reasons.push(`External AI training requires explicit opt_in consent (current: ${controlRecord.trainingConsent})`);
      }
      if (purposePermission !== 'allowed') {
        reasons.push(`External AI training purpose permission is ${purposePermission}`);
      }
    } else {
      if (purposePermission !== 'allowed') {
        reasons.push(`Requested purpose ${request.requestedPurpose} permission is ${purposePermission}`);
      }
    }

    // 6. Model Tier verification (if specified)
    let modelTierValid = true;
    if (request.targetModelTier && controlRecord.modelTiersAllowed && controlRecord.modelTiersAllowed.length > 0) {
      modelTierValid = controlRecord.modelTiersAllowed.includes(request.targetModelTier);
      if (!modelTierValid) {
        reasons.push(`Target model tier ${request.targetModelTier} is not allowed by control policy`);
      }
    }

    // 7. Linked Data Rights verification (Task 27)
    let rightsValid: boolean | undefined = undefined;
    if (request.requestedPurpose === 'external_ai_training') {
      if (!controlRecord.rightsRef || !controlRecord.rightsRef.rightsId) {
        rightsValid = false;
        reasons.push('External AI training requires canonical Task 27 data rights reference');
      } else {
        try {
          const rightsRec = await this.rightsService.getDataRightsRecord(
            controlRecord.rightsRef.rightsId
          );
          const hasRightsPermission = rightsRec !== null &&
            rightsRec.status === 'active' &&
            rightsRec.tenantId === request.tenantId &&
            rightsRec.purposes?.['external_ai_training'] === 'allowed';

          rightsValid = hasRightsPermission;
          if (!rightsValid) {
            reasons.push('Linked Task 27 data rights record is inactive, missing, cross-tenant, or lacks external_ai_training permission');
          }
        } catch {
          rightsValid = false;
          reasons.push('Error looking up linked Task 27 data rights record');
        }
      }
    } else if (controlRecord.rightsRef) {
      try {
        const rightsRec = await this.rightsService.getDataRightsRecord(
          controlRecord.rightsRef.rightsId
        );
        rightsValid = rightsRec !== null && rightsRec.status === 'active' && rightsRec.tenantId === request.tenantId;
        if (!rightsValid) {
          reasons.push('Linked Task 27 data rights record is inactive, missing, or cross-tenant');
        }
      } catch {
        rightsValid = false;
        reasons.push('Error looking up linked Task 27 data rights record');
      }
    }

    // 8. Linked Classification verification (Task 30)
    let classificationValid: boolean | undefined = undefined;
    if (request.requestedPurpose === 'external_ai_training') {
      if (!controlRecord.classificationRef || !controlRecord.classificationRef.classificationId) {
        classificationValid = false;
        reasons.push('External AI training requires canonical Task 30 data classification reference');
      } else {
        try {
          const classDecision = await this.classificationService.evaluateEligibility({
            tenantId: request.tenantId,
            recordType: request.recordType,
            recordId: request.recordId,
            requestedPurpose: request.requestedPurpose as any,
            classificationId: controlRecord.classificationRef.classificationId,
          });
          classificationValid = classDecision.eligible === true;
          if (!classificationValid) {
            reasons.push(`Linked Task 30 data classification eligibility failed: ${classDecision.outcome}`);
          }
        } catch {
          classificationValid = false;
          reasons.push('Error evaluating linked Task 30 data classification');
        }
      }
    } else if (controlRecord.classificationRef) {
      try {
        const classDecision = await this.classificationService.evaluateEligibility({
          tenantId: request.tenantId,
          recordType: request.recordType,
          recordId: request.recordId,
          requestedPurpose: request.requestedPurpose as any,
          classificationId: controlRecord.classificationRef.classificationId,
        });
        classificationValid = classDecision.eligible === true;
        if (!classificationValid) {
          reasons.push(`Linked Task 30 data classification eligibility failed: ${classDecision.outcome}`);
        }
      } catch {
        classificationValid = false;
        reasons.push('Error evaluating linked Task 30 data classification');
      }
    }

    // Determine final outcome
    let outcome: AiUsageDecisionOutcome = 'allowed';
    let allowed = false;

    if (!tenantMatch) {
      outcome = 'blocked_by_tenant';
    } else if (!statusActive) {
      outcome = 'blocked_by_status';
    } else if (!provenanceValid) {
      outcome = 'blocked_by_provenance';
    } else if (request.requestedPurpose === 'external_ai_training' && !trainingConsentValid) {
      outcome = 'blocked_by_consent';
    } else if (rightsValid === false) {
      outcome = 'blocked_by_restriction';
    } else if (classificationValid === false) {
      outcome = 'blocked_by_classification';
    } else if (purposePermission === 'unknown') {
      outcome = 'unknown';
    } else if (purposePermission === 'denied') {
      outcome = 'denied';
    } else if (!modelTierValid) {
      outcome = 'blocked_by_model_tier';
    } else {
      allowed = true;
      outcome = 'allowed';
    }

    const decisionHashPayload = `${request.tenantId}:${controlId}:${request.requestedPurpose}:${outcome}:${now}`;
    const decisionId = `aidec_${computeSha256(decisionHashPayload).substring(0, 24)}`;

    const decision: AiUsageDecisionRecord = {
      decisionId,
      tenantId: request.tenantId,
      controlId,
      recordType: request.recordType,
      recordId: request.recordId,
      requestedPurpose: request.requestedPurpose,
      outcome,
      allowed,
      trainingConsent: controlRecord.trainingConsent,
      reasons,
      evaluations: {
        tenantMatch,
        statusActive,
        purposePermission,
        trainingConsentValid,
        provenanceValid,
        classificationValid,
        rightsValid,
        modelTierValid,
      },
      decisionHash: '',
      evaluatedAt: now,
    };

    decision.decisionHash = computeAiDecisionHash(decision);
    await db.collection('ai_usage_decisions').doc(decisionId).set(cleanUndefinedValues(decision));

    return decision;
  }

  /**
   * Retrieves an AI Usage Control record for an authorized caller tenant.
   */
  public async getAiUsageControlRecord(
    controlId: string,
    callerTenantId: string
  ): Promise<AiUsageControlRecord | null> {
    if (!controlId || !callerTenantId) return null;
    const db = this.getDb();
    const snap = await db.collection('ai_usage_controls').doc(controlId).get();
    if (!snap.exists) return null;
    const record = snap.data() as AiUsageControlRecord;
    if (record.tenantId !== callerTenantId) {
      throw new AiUsageControlsSecurityError(
        `Cross-tenant access attempt: caller ${callerTenantId} != owner ${record.tenantId}`
      );
    }
    return record;
  }

  /**
   * Revokes an AI Usage Control policy with an append-only audit trail.
   */
  public async revokeAiUsageControls(
    tenantId: string,
    controlId: string,
    reason: string,
    updatedBy?: string
  ): Promise<AiUsageControlRecord> {
    if (!tenantId || !controlId || !reason) {
      throw new AiUsageControlsValidationError('Missing mandatory params for revokeAiUsageControls');
    }

    const db = this.getDb();
    const docRef = db.collection('ai_usage_controls').doc(controlId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new AiUsageControlsValidationError(`AI control record ${controlId} not found`);
    }

    const record = snap.data() as AiUsageControlRecord;
    if (record.tenantId !== tenantId) {
      throw new AiUsageControlsSecurityError(
        `Tenant mismatch during revocation: caller ${tenantId} != owner ${record.tenantId}`
      );
    }

    const now = new Date().toISOString();
    const updatedRecord: AiUsageControlRecord = {
      ...record,
      status: 'revoked',
      version: record.version + 1,
      trainingConsent: 'revoked',
      purposes: {
        internal_ai_use: 'denied',
        external_ai_training: 'denied',
        third_party_sharing: 'denied',
        commercial_licensing: 'denied',
        export: 'denied',
      },
      revokedAt: now,
      revocationReason: reason,
      updatedAt: now,
    };

    updatedRecord.contentHash = computeAiControlContentHash(updatedRecord);
    const cleaned = cleanUndefinedValues(updatedRecord);

    await docRef.set(cleaned);

    const historyId = `aicontrolh_${computeSha256(`${tenantId}:${controlId}:${cleaned.version}:${now}`).substring(0, 24)}`;
    const historyRecord = cleanUndefinedValues({
      historyId,
      ...cleaned,
      recordedBy: updatedBy || tenantId,
      snapshotTimestamp: now,
    });

    await db.collection('ai_usage_controls_history').doc(historyId).set(historyRecord);

    return cleaned;
  }
}

export const aiTrainingUsageControlsService = new AiTrainingUsageControlsService();
