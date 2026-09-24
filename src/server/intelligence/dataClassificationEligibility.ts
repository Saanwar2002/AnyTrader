/**
 * AnyTrader V8.3 — Task 30 Data Classification & Eligibility
 * 
 * Server-authoritative Data Classification & Eligibility layer building on:
 * - Task 27 DataRightsService
 * - Task 28 ProvenanceGraphService
 * - Task 29 ContractorArchiveRightsService
 * 
 * Core Invariants:
 * - Canonical Tenant Model: Strict UID-as-Tenant (tenantId === request.auth.uid)
 * - Conservative Semantics: unknown / unclassified is NEVER silently externally eligible
 * - Internal AI Preservation: AnyTrader internal AI allowed when internal_ai_use: 'allowed'
 * - Internal AI permission NEVER implies external AI training, commercial licensing, third party sharing, or export
 * - Contractor possession / upload / job participation DOES NOT grant external / commercial rights
 * - AI model candidate output CANNOT establish rights, ownership, classification, or eligibility
 * - Machine-readable outcomes: allowed, denied, unknown, blocked_by_tenant, blocked_by_status,
 *   blocked_by_restriction, blocked_by_classification, blocked_by_provenance, blocked_by_origin
 */

import * as admin from 'firebase-admin';
import { computeSha256, computeStructuredDataHash } from './provenance';
import {
  DataRightsService,
  dataRightsService,
  RightsPurpose,
  PurposePermission,
  DataRightsSecurityError,
  DataRightsRecord,
  canUseDataForPurpose,
} from './dataRights';
import {
  ProvenanceGraphService,
  provenanceGraphService,
} from './provenanceGraph';
import {
  ContractorArchiveRightsService,
  contractorArchiveRightsService,
  ArchiveOriginType,
} from './contractorArchiveRights';

// =============================================================================
// CONTROLLED VOCABULARIES & DOMAIN TYPES
// =============================================================================

export const DATA_CLASSIFICATION_CATEGORIES = [
  'transactional_operational',
  'property_intelligence',
  'contractor_archive',
  'customer_subject',
  'third_party',
  'platform_derived_intelligence',
  'provenance_evidence_metadata',
  'unknown_unclassified',
] as const;

export type DataClassificationCategory = typeof DATA_CLASSIFICATION_CATEGORIES[number];

export const SENSITIVITY_LEVELS = [
  'public',
  'internal',
  'confidential',
  'restricted',
  'pii',
] as const;

export type SensitivityLevel = typeof SENSITIVITY_LEVELS[number];

export const CLASSIFICATION_STATUSES = ['active', 'superseded', 'revoked'] as const;

export type ClassificationStatus = typeof CLASSIFICATION_STATUSES[number];

export const ELIGIBILITY_OUTCOMES = [
  'allowed',
  'denied',
  'unknown',
  'blocked_by_tenant',
  'blocked_by_status',
  'blocked_by_restriction',
  'blocked_by_classification',
  'blocked_by_provenance',
  'blocked_by_origin',
] as const;

export type EligibilityOutcome = typeof ELIGIBILITY_OUTCOMES[number];

export interface ClassificationProvenanceRef {
  nodeId?: string;
  tenantId: string;
  sourceType?: string;
  sourceId?: string;
  sourceVersion?: string;
}

export interface ClassificationRightsRef {
  rightsId: string;
  tenantId: string;
}

export interface ClassificationArchiveRef {
  archiveId: string;
  tenantId: string;
  componentKey?: string;
}

export interface DataClassificationRecord {
  classificationId: string;
  tenantId: string;
  recordType: string;
  recordId: string;
  category: DataClassificationCategory;
  sensitivity: SensitivityLevel;
  restrictions: string[];
  version: number;
  provenanceRef: ClassificationProvenanceRef;
  rightsRef?: ClassificationRightsRef;
  archiveRef?: ClassificationArchiveRef;
  status: ClassificationStatus;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  revocationReason?: string;
}

export interface RegisterClassificationInput {
  classificationId?: string;
  tenantId: string;
  recordType: string;
  recordId: string;
  category: DataClassificationCategory;
  sensitivity?: SensitivityLevel;
  restrictions?: string[];
  provenanceRef: ClassificationProvenanceRef;
  rightsRef?: ClassificationRightsRef;
  archiveRef?: ClassificationArchiveRef;
  recordedBy?: string;
}

export interface EligibilityEvaluationRequest {
  tenantId: string;
  recordType: string;
  recordId: string;
  requestedPurpose: RightsPurpose;
  classificationId?: string;
  context?: {
    callerUid?: string;
    isInternalAi?: boolean;
    clientRole?: string;
  };
}

export interface EligibilityDecisionResult {
  eligible: boolean;
  outcome: EligibilityOutcome;
  tenantId: string;
  recordType: string;
  recordId: string;
  requestedPurpose: RightsPurpose;
  category: DataClassificationCategory;
  classificationId?: string;
  rightsId?: string;
  archiveId?: string;
  reason: string;
  evaluatedAt: string;
  decisionHash: string;
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class DataClassificationSecurityError extends DataRightsSecurityError {
  constructor(message: string) {
    super(message);
    this.name = 'DataClassificationSecurityError';
  }
}

export class DataClassificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataClassificationValidationError';
  }
}

// =============================================================================
// DETERMINISTIC IDENTIFIER & HASH GENERATION
// =============================================================================

/**
 * Deterministic SHA-256 classification ID based on tenantId, recordType, recordId
 */
export function computeDataClassificationId(
  tenantId: string,
  recordType: string,
  recordId: string
): string {
  if (!tenantId || !tenantId.trim()) {
    throw new DataClassificationValidationError('tenantId is mandatory for classification ID generation');
  }
  if (!recordType || !recordType.trim()) {
    throw new DataClassificationValidationError('recordType is mandatory for classification ID generation');
  }
  if (!recordId || !recordId.trim()) {
    throw new DataClassificationValidationError('recordId is mandatory for classification ID generation');
  }
  const raw = `${tenantId.trim()}:data_classification:${recordType.trim()}:${recordId.trim()}`;
  return `dclass_${computeSha256(raw).slice(0, 24)}`;
}

/**
 * Computes deterministic SHA-256 integrity hash for classification record
 */
export function computeClassificationContentHash(record: {
  classificationId: string;
  tenantId: string;
  recordType: string;
  recordId: string;
  category: DataClassificationCategory;
  sensitivity: SensitivityLevel;
  restrictions: string[];
  version: number;
  provenanceRef: ClassificationProvenanceRef;
  rightsRef?: ClassificationRightsRef;
  archiveRef?: ClassificationArchiveRef;
  status: ClassificationStatus;
}): string {
  return computeStructuredDataHash({
    classificationId: record.classificationId,
    tenantId: record.tenantId,
    recordType: record.recordType,
    recordId: record.recordId,
    category: record.category,
    sensitivity: record.sensitivity,
    restrictions: [...(record.restrictions || [])].sort(),
    version: record.version,
    provenanceRef: {
      nodeId: record.provenanceRef.nodeId,
      tenantId: record.provenanceRef.tenantId,
      sourceType: record.provenanceRef.sourceType,
      sourceId: record.provenanceRef.sourceId,
      sourceVersion: record.provenanceRef.sourceVersion,
    },
    rightsRef: record.rightsRef
      ? {
          rightsId: record.rightsRef.rightsId,
          tenantId: record.rightsRef.tenantId,
        }
      : undefined,
    archiveRef: record.archiveRef
      ? {
          archiveId: record.archiveRef.archiveId,
          tenantId: record.archiveRef.tenantId,
          componentKey: record.archiveRef.componentKey,
        }
      : undefined,
    status: record.status,
  });
}

/**
 * Recursively removes keys with undefined values to prevent Firestore serialization errors
 */
function cleanUndefinedValues<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefinedValues) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      result[key] = typeof value === 'object' && value !== null ? cleanUndefinedValues(value) : value;
    }
  }
  return result as T;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class DataClassificationEligibilityService {
  private db: admin.firestore.Firestore | null = null;
  private rightsService: DataRightsService;
  private provenanceService: ProvenanceGraphService;
  private archiveService: ContractorArchiveRightsService;

  constructor(
    db?: admin.firestore.Firestore,
    rightsService?: DataRightsService,
    provenanceService?: ProvenanceGraphService,
    archiveService?: ContractorArchiveRightsService
  ) {
    this.db = db || (admin?.apps && admin.apps.length > 0 ? admin.firestore() : null);
    this.rightsService = rightsService || dataRightsService;
    this.provenanceService = provenanceService || provenanceGraphService;
    this.archiveService = archiveService || contractorArchiveRightsService;
  }

  public setFirestoreDb(db: admin.firestore.Firestore | any) {
    this.db = db;
  }

  private get activeDb(): admin.firestore.Firestore {
    if (this.db) return this.db;
    if (admin?.apps && admin.apps.length > 0) {
      this.db = admin.firestore();
      return this.db;
    }
    throw new DataClassificationSecurityError('Firebase Firestore is not initialized');
  }

  /**
   * Registers or updates a data classification record server-authoritatively.
   */
  async registerClassification(
    input: RegisterClassificationInput
  ): Promise<DataClassificationRecord> {
    if (!input.tenantId || !input.tenantId.trim()) {
      throw new DataClassificationValidationError('tenantId is required');
    }
    if (!input.recordType || !input.recordType.trim()) {
      throw new DataClassificationValidationError('recordType is required');
    }
    if (!input.recordId || !input.recordId.trim()) {
      throw new DataClassificationValidationError('recordId is required');
    }
    if (!input.category || !DATA_CLASSIFICATION_CATEGORIES.includes(input.category)) {
      throw new DataClassificationValidationError(
        `Invalid category '${input.category}'. Must be one of: ${DATA_CLASSIFICATION_CATEGORIES.join(', ')}`
      );
    }

    // Provenance reference validation
    if (!input.provenanceRef || !input.provenanceRef.tenantId || !input.provenanceRef.tenantId.trim()) {
      throw new DataClassificationSecurityError('provenanceRef with non-empty tenantId is mandatory');
    }
    if (input.provenanceRef.tenantId.trim() !== input.tenantId.trim()) {
      throw new DataClassificationSecurityError(
        `Cross-tenant provenance reference mismatch: provenance.tenantId (${input.provenanceRef.tenantId}) != input.tenantId (${input.tenantId})`
      );
    }

    // Rights reference validation
    if (input.rightsRef) {
      if (!input.rightsRef.tenantId || input.rightsRef.tenantId.trim() !== input.tenantId.trim()) {
        throw new DataClassificationSecurityError(
          `Cross-tenant rights reference mismatch: rights.tenantId (${input.rightsRef?.tenantId}) != input.tenantId (${input.tenantId})`
        );
      }
    }

    // Archive reference validation
    if (input.archiveRef) {
      if (!input.archiveRef.tenantId || input.archiveRef.tenantId.trim() !== input.tenantId.trim()) {
        throw new DataClassificationSecurityError(
          `Cross-tenant archive reference mismatch: archive.tenantId (${input.archiveRef?.tenantId}) != input.tenantId (${input.tenantId})`
        );
      }
    }

    const tenantId = input.tenantId.trim();
    const classificationId =
      input.classificationId ||
      computeDataClassificationId(tenantId, input.recordType, input.recordId);

    const now = new Date().toISOString();
    const sensitivity = input.sensitivity || 'internal';
    const restrictions = [...(input.restrictions || [])].sort();

    const docRef = this.activeDb.collection('data_classifications').doc(classificationId);
    const existingDoc = await docRef.get();

    let version = 1;
    if (existingDoc.exists) {
      const data = existingDoc.data() as DataClassificationRecord;
      if (data.tenantId !== tenantId) {
        throw new DataClassificationSecurityError('Cross-tenant classification mutation denied');
      }
      version = (data.version || 1) + 1;
    }

    // Clean provenanceRef
    const provenanceRef: ClassificationProvenanceRef = {
      nodeId: input.provenanceRef.nodeId,
      tenantId: input.provenanceRef.tenantId.trim(),
      sourceType: input.provenanceRef.sourceType,
      sourceId: input.provenanceRef.sourceId,
      sourceVersion: input.provenanceRef.sourceVersion || '1',
    };

    // If live Firestore is available, perform authoritative provenance validation
    if (this.db || (admin?.apps && admin.apps.length > 0)) {
      const provVal = await this.provenanceService.validateProvenanceReference({
        tenantId,
        nodeId: provenanceRef.nodeId,
        sourceType: provenanceRef.sourceType,
        sourceId: provenanceRef.sourceId,
        sourceVersion: provenanceRef.sourceVersion,
      });
      if (!provVal.valid) {
        if (provVal.outcome === 'cross_tenant') {
          throw new DataClassificationSecurityError(
            `Cross-tenant provenance validation failed: ${provVal.reason}`
          );
        }
        if (provVal.outcome === 'integrity_failure' || provVal.outcome === 'invalid_status') {
          throw new DataClassificationSecurityError(
            `Invalid provenance reference: ${provVal.reason}`
          );
        }
      }
    }

    const record: DataClassificationRecord = {
      classificationId,
      tenantId,
      recordType: input.recordType.trim(),
      recordId: input.recordId.trim(),
      category: input.category,
      sensitivity,
      restrictions,
      version,
      provenanceRef,
      rightsRef: input.rightsRef
        ? {
            rightsId: input.rightsRef.rightsId.trim(),
            tenantId: input.rightsRef.tenantId.trim(),
          }
        : undefined,
      archiveRef: input.archiveRef
        ? {
            archiveId: input.archiveRef.archiveId.trim(),
            tenantId: input.archiveRef.tenantId.trim(),
            componentKey: input.archiveRef.componentKey,
          }
        : undefined,
      status: 'active',
      contentHash: '',
      createdAt: existingDoc.exists ? (existingDoc.data() as DataClassificationRecord).createdAt : now,
      updatedAt: now,
    };

    record.contentHash = computeClassificationContentHash(record);

    const cleanRecord = cleanUndefinedValues(record);

    // Write to Firestore and append to history
    const historyId = `dclasshist_${computeSha256(`${classificationId}:${version}:${now}`).slice(0, 24)}`;
    const historyRef = this.activeDb.collection('data_classification_history').doc(historyId);

    const batch = this.activeDb.batch();
    batch.set(docRef, cleanRecord);
    batch.set(historyRef, cleanUndefinedValues({
      historyId,
      ...cleanRecord,
      recordedAt: now,
      recordedBy: input.recordedBy || tenantId,
    }));

    await batch.commit();

    return record;
  }

  /**
   * Deterministically evaluates server-authoritative data eligibility.
   * Integrates:
   * 1. Data Classification
   * 2. Authoritative Task 27 Rights
   * 3. Task 28 Provenance
   * 4. Tenant Binding
   * 5. Record/Status State
   * 6. Applicable Restrictions
   * 7. Requested Purpose
   * 8. Task 29 Contractor-Archive Rights (if applicable)
   */
  async evaluateEligibility(
    request: EligibilityEvaluationRequest
  ): Promise<EligibilityDecisionResult> {
    const evaluatedAt = new Date().toISOString();
    const tenantId = request.tenantId.trim();

    // 1. Tenant Binding & Authentication Context Check
    if (request.context?.callerUid && request.context.callerUid !== tenantId) {
      return this.buildDecisionResult({
        eligible: false,
        outcome: 'blocked_by_tenant',
        tenantId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        category: 'unknown_unclassified',
        reason: 'Caller identity does not match record tenant isolation partition',
        evaluatedAt,
      });
    }

    // 2. Fetch Data Classification Record
    let classification: DataClassificationRecord | null = null;
    try {
      if (this.db || (admin?.apps && admin.apps.length > 0)) {
        if (request.classificationId) {
          const doc = await this.activeDb.collection('data_classifications').doc(request.classificationId).get();
          if (doc.exists) {
            classification = doc.data() as DataClassificationRecord;
          }
        } else {
          const snap = await this.activeDb
            .collection('data_classifications')
            .where('tenantId', '==', tenantId)
            .where('recordType', '==', request.recordType)
            .where('recordId', '==', request.recordId)
            .limit(1)
            .get();
          if (!snap.empty) {
            classification = snap.docs[0].data() as DataClassificationRecord;
          }
        }
      }
    } catch (e: any) {
      if (e instanceof DataClassificationSecurityError && e.message.includes('Firestore is not initialized')) {
        classification = null;
      } else {
        throw e;
      }
    }

    const isExternalPurpose = [
      'external_ai_training',
      'third_party_sharing',
      'commercial_licensing',
      'export',
    ].includes(request.requestedPurpose);

    // Unclassified / Unknown Category Handling
    if (!classification) {
      if (isExternalPurpose) {
        return this.buildDecisionResult({
          eligible: false,
          outcome: 'blocked_by_classification',
          tenantId,
          recordType: request.recordType,
          recordId: request.recordId,
          requestedPurpose: request.requestedPurpose,
          category: 'unknown_unclassified',
          reason: 'Unclassified data is strictly non-eligible for external AI, training, commercial licensing, or export',
          evaluatedAt,
        });
      }
      return this.buildDecisionResult({
        eligible: false,
        outcome: 'unknown',
        tenantId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        category: 'unknown_unclassified',
        reason: 'No classification record found for requested entity',
        evaluatedAt,
      });
    }

    // Cross-tenant classification binding check
    if (classification.tenantId !== tenantId) {
      return this.buildDecisionResult({
        eligible: false,
        outcome: 'blocked_by_tenant',
        tenantId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        category: classification.category || 'unknown_unclassified',
        classificationId: classification.classificationId,
        reason: 'Classification record tenantId does not match request tenant context',
        evaluatedAt,
      });
    }

    // Unknown category invariant check
    if (classification.category === 'unknown_unclassified') {
      if (isExternalPurpose) {
        return this.buildDecisionResult({
          eligible: false,
          outcome: 'blocked_by_classification',
          tenantId,
          recordType: request.recordType,
          recordId: request.recordId,
          requestedPurpose: request.requestedPurpose,
          category: 'unknown_unclassified',
          classificationId: classification.classificationId,
          reason: 'Data marked as unknown_unclassified cannot be used for external purposes',
          evaluatedAt,
        });
      }
    }

    // 3. Classification Status Check
    if (classification.status !== 'active') {
      return this.buildDecisionResult({
        eligible: false,
        outcome: 'blocked_by_status',
        tenantId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        category: classification.category,
        classificationId: classification.classificationId,
        reason: `Classification record status is '${classification.status}' (not active)`,
        evaluatedAt,
      });
    }

    // 4. Server-Authoritative Task 28 Provenance Validation
    if (!classification.provenanceRef || !classification.provenanceRef.tenantId) {
      return this.buildDecisionResult({
        eligible: false,
        outcome: 'blocked_by_provenance',
        tenantId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        category: classification.category,
        classificationId: classification.classificationId,
        reason: 'Missing mandatory provenance reference in classification record',
        evaluatedAt,
      });
    }

    if (classification.provenanceRef.tenantId !== tenantId) {
      return this.buildDecisionResult({
        eligible: false,
        outcome: 'blocked_by_provenance',
        tenantId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        category: classification.category,
        classificationId: classification.classificationId,
        reason: 'Cross-tenant provenance reference detected',
        evaluatedAt,
      });
    }

    // Validate referenced Task 28 provenance node via ProvenanceGraphService
    let isDbAvailable = false;
    try {
      if (this.db || (admin?.apps && admin.apps.length > 0)) {
        isDbAvailable = true;
      }
    } catch {
      isDbAvailable = false;
    }

    if (isDbAvailable) {
      const provVal = await this.provenanceService.validateProvenanceReference({
        tenantId,
        nodeId: classification.provenanceRef.nodeId,
        sourceType: classification.provenanceRef.sourceType,
        sourceId: classification.provenanceRef.sourceId,
        sourceVersion: classification.provenanceRef.sourceVersion,
      });

      if (!provVal.valid) {
        return this.buildDecisionResult({
          eligible: false,
          outcome: 'blocked_by_provenance',
          tenantId,
          recordType: request.recordType,
          recordId: request.recordId,
          requestedPurpose: request.requestedPurpose,
          category: classification.category,
          classificationId: classification.classificationId,
          reason: `Task 28 Provenance validation failed: ${provVal.reason}`,
          evaluatedAt,
        });
      }
    }

    // 5. Explicit Classification Restrictions Check
    if (classification.restrictions && classification.restrictions.length > 0) {
      const restrictionMap: Record<RightsPurpose, string[]> = {
        internal_platform_operation: ['no_internal_ops', 'blocked_all'],
        internal_ai_use: ['no_internal_ai', 'no_ai', 'blocked_all'],
        external_ai_training: ['no_external_ai', 'no_ai_training', 'no_ai', 'blocked_all'],
        third_party_sharing: ['no_third_party_sharing', 'no_sharing', 'blocked_all'],
        commercial_licensing: ['no_commercial_licensing', 'no_commercial', 'blocked_all'],
        export: ['no_export', 'blocked_all'],
      };

      const blockingRestrictions = restrictionMap[request.requestedPurpose] || ['blocked_all'];
      const hit = classification.restrictions.find((r) =>
        blockingRestrictions.includes(r.toLowerCase())
      );
      if (hit) {
        return this.buildDecisionResult({
          eligible: false,
          outcome: 'blocked_by_restriction',
          tenantId,
          recordType: request.recordType,
          recordId: request.recordId,
          requestedPurpose: request.requestedPurpose,
          category: classification.category,
          classificationId: classification.classificationId,
          rightsId: classification.rightsRef?.rightsId,
          archiveId: classification.archiveRef?.archiveId,
          reason: `Blocked by explicit restriction '${hit}'`,
          evaluatedAt,
        });
      }
    }

    // 6. Task 29 Contractor Archive Integration (if archiveRef or contractor_archive category)
    if (classification.archiveRef || classification.category === 'contractor_archive') {
      if (classification.archiveRef) {
        if (classification.archiveRef.componentKey) {
          const compEval = await this.archiveService.evaluateComponentEligibility({
            tenantId,
            archiveId: classification.archiveRef.archiveId,
            componentId: classification.archiveRef.componentKey,
            purpose: request.requestedPurpose as any,
          });

          if (!compEval.eligible) {
            const outcome =
              compEval.reason === 'blocked_by_origin'
                ? 'blocked_by_origin'
                : compEval.reason === 'blocked_by_status'
                ? 'blocked_by_status'
                : compEval.reason === 'blocked_by_tenant'
                ? 'blocked_by_tenant'
                : compEval.reason === 'blocked_by_restriction'
                ? 'blocked_by_restriction'
                : 'denied';

            return this.buildDecisionResult({
              eligible: false,
              outcome,
              tenantId,
              recordType: request.recordType,
              recordId: request.recordId,
              requestedPurpose: request.requestedPurpose,
              category: classification.category,
              classificationId: classification.classificationId,
              archiveId: classification.archiveRef.archiveId,
              reason: `Contractor archive component evaluation failed: ${compEval.details || compEval.reason}`,
              evaluatedAt,
            });
          }
        } else {
          const archiveEval = await this.archiveService.evaluateArchiveEligibility({
            tenantId,
            archiveId: classification.archiveRef.archiveId,
            purpose: request.requestedPurpose as any,
          });

          if (!archiveEval.eligible) {
            const outcome =
              archiveEval.reason === 'blocked_by_origin'
                ? 'blocked_by_origin'
                : archiveEval.reason === 'blocked_by_status'
                ? 'blocked_by_status'
                : archiveEval.reason === 'blocked_by_tenant'
                ? 'blocked_by_tenant'
                : archiveEval.reason === 'blocked_by_restriction'
                ? 'blocked_by_restriction'
                : 'denied';

            return this.buildDecisionResult({
              eligible: false,
              outcome,
              tenantId,
              recordType: request.recordType,
              recordId: request.recordId,
              requestedPurpose: request.requestedPurpose,
              category: classification.category,
              classificationId: classification.classificationId,
              archiveId: classification.archiveRef.archiveId,
              reason: `Contractor archive evaluation failed: ${archiveEval.details || archiveEval.reason}`,
              evaluatedAt,
            });
          }
        }
      } else if (isExternalPurpose && classification.category === 'contractor_archive') {
        // Contractor archive data without explicit archive component authorization is blocked from external purposes
        return this.buildDecisionResult({
          eligible: false,
          outcome: 'blocked_by_origin',
          tenantId,
          recordType: request.recordType,
          recordId: request.recordId,
          requestedPurpose: request.requestedPurpose,
          category: classification.category,
          classificationId: classification.classificationId,
          reason: 'Contractor archive data requires explicit purpose authorization for external use',
          evaluatedAt,
        });
      }
    }

    // 7. Authoritative Task 27 Data Rights Evaluation
    let rightsRecord: DataRightsRecord | null = null;
    if (classification.rightsRef) {
      rightsRecord = await this.rightsService.getDataRightsRecord(
        classification.rightsRef.rightsId
      );
    } else {
      rightsRecord = await this.rightsService.getDataRightsRecordBySubject(
        tenantId,
        request.recordType,
        request.recordId
      );
    }

    if (!rightsRecord) {
      if (isExternalPurpose) {
        return this.buildDecisionResult({
          eligible: false,
          outcome: 'unknown',
          tenantId,
          recordType: request.recordType,
          recordId: request.recordId,
          requestedPurpose: request.requestedPurpose,
          category: classification.category,
          classificationId: classification.classificationId,
          reason: 'No Task 27 DataRights record exists; external purpose remains unknown/non-eligible',
          evaluatedAt,
        });
      }

      // If internal platform operation or internal AI, check default/context
      if (
        request.requestedPurpose === 'internal_platform_operation' ||
        (request.requestedPurpose === 'internal_ai_use' && request.context?.isInternalAi)
      ) {
        return this.buildDecisionResult({
          eligible: true,
          outcome: 'allowed',
          tenantId,
          recordType: request.recordType,
          recordId: request.recordId,
          requestedPurpose: request.requestedPurpose,
          category: classification.category,
          classificationId: classification.classificationId,
          reason: 'Internal platform operation / internal AI permitted under server-authoritative operational defaults',
          evaluatedAt,
        });
      }

      return this.buildDecisionResult({
        eligible: false,
        outcome: 'unknown',
        tenantId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        category: classification.category,
        classificationId: classification.classificationId,
        reason: 'DataRights record missing and purpose is non-operational',
        evaluatedAt,
      });
    }

    // Evaluate Task 27 purpose
    const rawPermission = rightsRecord.purposes?.[request.requestedPurpose as RightsPurpose] || 'unknown';
    const isAllowedByRights = canUseDataForPurpose(
      rightsRecord,
      request.requestedPurpose as RightsPurpose,
      tenantId
    );

    const permission: 'allowed' | 'denied' | 'unknown' = isAllowedByRights
      ? 'allowed'
      : rawPermission === 'denied'
      ? 'denied'
      : rawPermission === 'unknown'
      ? 'unknown'
      : 'denied';

    if (permission === 'denied') {
      return this.buildDecisionResult({
        eligible: false,
        outcome: 'denied',
        tenantId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        category: classification.category,
        classificationId: classification.classificationId,
        rightsId: rightsRecord.rightsId,
        reason: `Task 27 DataRights explicitly denied purpose '${request.requestedPurpose}'`,
        evaluatedAt,
      });
    }

    if (permission === 'unknown') {
      return this.buildDecisionResult({
        eligible: false,
        outcome: 'unknown',
        tenantId,
        recordType: request.recordType,
        recordId: request.recordId,
        requestedPurpose: request.requestedPurpose,
        category: classification.category,
        classificationId: classification.classificationId,
        rightsId: rightsRecord.rightsId,
        reason: `Task 27 DataRights purpose permission for '${request.requestedPurpose}' is unknown`,
        evaluatedAt,
      });
    }

    // CRITICAL INVARIANT VERIFICATION:
    // Permission === 'allowed' in Task 27.
    // Verify that internal_ai_use: 'allowed' is NOT being used to justify an external purpose request.
    if (isExternalPurpose) {
      const explicitExternalPerm = rightsRecord.purposes[request.requestedPurpose];
      if (explicitExternalPerm !== 'allowed') {
        return this.buildDecisionResult({
          eligible: false,
          outcome: 'denied',
          tenantId,
          recordType: request.recordType,
          recordId: request.recordId,
          requestedPurpose: request.requestedPurpose,
          category: classification.category,
          classificationId: classification.classificationId,
          rightsId: rightsRecord.rightsId,
          reason: `Internal AI permission does not confer external purpose '${request.requestedPurpose}'`,
          evaluatedAt,
        });
      }
    }

    // All gates passed cleanly!
    return this.buildDecisionResult({
      eligible: true,
      outcome: 'allowed',
      tenantId,
      recordType: request.recordType,
      recordId: request.recordId,
      requestedPurpose: request.requestedPurpose,
      category: classification.category,
      classificationId: classification.classificationId,
      rightsId: rightsRecord.rightsId,
      archiveId: classification.archiveRef?.archiveId,
      reason: 'Authoritative classification, provenance, status, origin, and rights gates passed cleanly',
      evaluatedAt,
    });
  }

  /**
   * Revokes a data classification record
   */
  async revokeClassification(
    tenantId: string,
    classificationId: string,
    reason: string = 'User/system requested revocation'
  ): Promise<DataClassificationRecord> {
    if (!tenantId || !tenantId.trim()) {
      throw new DataClassificationValidationError('tenantId is required for revocation');
    }
    if (!classificationId || !classificationId.trim()) {
      throw new DataClassificationValidationError('classificationId is required for revocation');
    }

    const docRef = this.activeDb.collection('data_classifications').doc(classificationId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new DataClassificationValidationError(`Classification record '${classificationId}' not found`);
    }

    const record = doc.data() as DataClassificationRecord;
    if (record.tenantId !== tenantId.trim()) {
      throw new DataClassificationSecurityError('Cross-tenant classification revocation denied');
    }

    const now = new Date().toISOString();
    const updatedRecord: DataClassificationRecord = {
      ...record,
      status: 'revoked',
      version: record.version + 1,
      updatedAt: now,
      revokedAt: now,
      revocationReason: reason,
    };

    updatedRecord.contentHash = computeClassificationContentHash(updatedRecord);

    const historyId = `dclasshist_${computeSha256(`${classificationId}:${updatedRecord.version}:${now}`).slice(0, 24)}`;
    const historyRef = this.activeDb.collection('data_classification_history').doc(historyId);

    const batch = this.activeDb.batch();
    batch.set(docRef, cleanUndefinedValues(updatedRecord));
    batch.set(historyRef, cleanUndefinedValues({
      historyId,
      ...updatedRecord,
      recordedAt: now,
      recordedBy: tenantId,
    }));

    await batch.commit();

    return updatedRecord;
  }

  /**
   * Fetches classification record by ID
   */
  async getClassification(
    classificationId: string,
    tenantId: string
  ): Promise<DataClassificationRecord | null> {
    if (!classificationId || !tenantId) return null;
    const doc = await this.activeDb.collection('data_classifications').doc(classificationId).get();
    if (!doc.exists) return null;
    const data = doc.data() as DataClassificationRecord;
    if (data.tenantId !== tenantId.trim()) {
      throw new DataClassificationSecurityError('Cross-tenant classification retrieval denied');
    }
    return data;
  }

  /**
   * Builds audit-ready decision result with cryptographic SHA-256 decisionHash
   */
  private buildDecisionResult(params: {
    eligible: boolean;
    outcome: EligibilityOutcome;
    tenantId: string;
    recordType: string;
    recordId: string;
    requestedPurpose: RightsPurpose;
    category: DataClassificationCategory;
    classificationId?: string;
    rightsId?: string;
    archiveId?: string;
    reason: string;
    evaluatedAt: string;
  }): EligibilityDecisionResult {
    const raw = `${params.tenantId}:${params.recordType}:${params.recordId}:${params.requestedPurpose}:${params.outcome}:${params.evaluatedAt}`;
    const decisionHash = computeSha256(raw);

    const result: EligibilityDecisionResult = {
      eligible: params.eligible,
      outcome: params.outcome,
      tenantId: params.tenantId,
      recordType: params.recordType,
      recordId: params.recordId,
      requestedPurpose: params.requestedPurpose,
      category: params.category,
      classificationId: params.classificationId,
      rightsId: params.rightsId,
      archiveId: params.archiveId,
      reason: params.reason,
      evaluatedAt: params.evaluatedAt,
      decisionHash,
    };

    // Log decision asynchronously to audit trail in Firestore
    try {
      const decisionId = `delig_${decisionHash.slice(0, 24)}`;
      this.activeDb.collection('data_eligibility_decisions').doc(decisionId).set(cleanUndefinedValues({
        decisionId,
        ...result,
        createdAt: params.evaluatedAt,
      })).catch(() => {
        // Audit logging errors fail silently to not disrupt evaluation flow
      });
    } catch (_) {
      // Ignore background write errors
    }

    return result;
  }
}

export const dataClassificationEligibilityService = new DataClassificationEligibilityService();
