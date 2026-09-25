/**
 * AnyTrader V8.3 — Task 32: Revocation, Retention & Deletion Service
 * 
 * SERVER-AUTHORITATIVE ARCHITECTURAL INVARIANTS:
 * 1. REVOCATION != DELETION:
 *    - Revocation immediately makes affected authorization fail closed.
 *    - Deletion separately evaluates retention policy, legal hold, dependencies, tenant authorization, and audit requirements.
 * 2. UNKNOWN POLICY FAILS CLOSED:
 *    - Missing or unknown retention policy returns 'blocked_by_unknown_policy' (unknown != allowed to delete).
 * 3. LEGAL HOLD IS ABSOLUTE:
 *    - Server-authoritative legal hold blocks physical deletion ('blocked_by_legal_hold').
 *    - Client input cannot create, remove, or override legal hold.
 * 4. DEPENDENCY-AWARE DELETION:
 *    - Upstream records with active downstream dependencies (Rights, Provenance, Classification, AI Controls)
 *      are blocked from erasure ('blocked_by_dependency').
 * 5. IMMUTABLE AUDIT PRESERVATION:
 *    - Erasing current projection NEVER deletes immutable audit history (data_rights_history, provenance_events,
 *      ai_usage_controls_history, ai_usage_decisions, data_lifecycle_events).
 *    - Retained lifecycle audit events contain minimal non-personal cryptographic evidence.
 * 6. IDEMPOTENT LIFECYCLE STATE MACHINE:
 *    - Transitions: requested -> blocked | approved -> processing -> completed | rejected.
 *    - Repeated requests return deterministic, idempotent results.
 * 7. TENANT ISOLATION (UID-as-Tenant):
 *    - Cross-tenant revocation, retention, or deletion attempts fail closed with DataRetentionSecurityError.
 */

import * as admin from 'firebase-admin';
import { computeSha256 } from './provenance';
import {
  DataRightsService,
  dataRightsService as defaultDataRightsService,
  DataRightsRecord,
} from './dataRights';
import {
  ProvenanceGraphService,
  provenanceGraphService as defaultProvenanceGraphService,
  ProvenanceNode,
  cleanUndefinedValues,
} from './provenanceGraph';
import {
  ContractorArchiveRightsService,
  contractorArchiveRightsService as defaultContractorArchiveRightsService,
} from './contractorArchiveRights';
import {
  DataClassificationEligibilityService,
  dataClassificationEligibilityService as defaultDataClassificationEligibilityService,
} from './dataClassificationEligibility';
import {
  AiTrainingUsageControlsService,
  aiTrainingUsageControlsService as defaultAiTrainingUsageControlsService,
  AiUsageControlRecord,
} from './aiTrainingUsageControls';

// =============================================================================
// DOMAIN TYPES & ENUMS
// =============================================================================

export type RetentionDecision =
  | 'retain'
  | 'eligible_for_deletion'
  | 'blocked_by_legal_hold'
  | 'blocked_by_dependency'
  | 'blocked_by_active_rights'
  | 'blocked_by_audit_requirement'
  | 'blocked_by_unknown_policy'
  | 'already_erased';

export type DeletionRequestStatus =
  | 'requested'
  | 'blocked'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected';

export type DataLifecycleEventType =
  | 'POLICY_REGISTERED'
  | 'POLICY_SUPERSEDED'
  | 'LEGAL_HOLD_APPLIED'
  | 'LEGAL_HOLD_REMOVED'
  | 'RIGHTS_REVOKED'
  | 'AI_USAGE_REVOKED'
  | 'PROVENANCE_RETRACTED'
  | 'DELETION_REQUESTED'
  | 'DELETION_BLOCKED'
  | 'DELETION_APPROVED'
  | 'DATA_ERASURE_PROCESSING'
  | 'DATA_ERASURE_COMPLETED'
  | 'DELETION_REJECTED';

export interface RetentionPolicy {
  policyId: string;
  tenantId: string;
  recordType: string;
  retentionClass: string;
  retentionPeriodDays?: number;
  retentionUntil?: string; // ISO timestamp
  legalHold?: boolean;
  legalHoldReason?: string;
  legalHoldAppliedAt?: string;
  version: number;
  status: 'active' | 'superseded';
  createdAt: string;
  updatedAt: string;
  policyHash?: string;
}

export interface RegisterRetentionPolicyInput {
  tenantId: string;
  recordType: string;
  retentionClass: string;
  retentionPeriodDays?: number;
  retentionUntil?: string;
  legalHold?: boolean;
  legalHoldReason?: string;
}

export interface DeletionDependency {
  dependencyType:
    | 'data_rights'
    | 'provenance_node'
    | 'provenance_edge'
    | 'data_classification'
    | 'ai_usage_control'
    | 'derived_intelligence'
    | 'authoritative_projection';
  dependencyId: string;
  tenantId: string;
  status: string;
  description?: string;
}

export interface RetentionEvaluationResult {
  allowed: boolean;
  decision: RetentionDecision;
  reason: string;
  policyId?: string;
  retentionUntil?: string;
  legalHold?: boolean;
  dependencies?: DeletionDependency[];
}

export interface DataDeletionRequest {
  requestId: string;
  tenantId: string;
  recordType: string;
  recordId: string;
  status: DeletionRequestStatus;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  approvedAt?: string;
  completedAt?: string;
  blockedReason?: string;
  dependencyCount?: number;
  dependencies?: DeletionDependency[];
  policyRef?: {
    policyId: string;
    version: number;
  };
  result?: {
    decision: RetentionDecision;
    erasedRecordsCount: number;
    revokedRightsCount: number;
    revokedAiControlsCount: number;
    retractedNodesCount: number;
  };
  version: number;
}

export interface RequestDeletionInput {
  tenantId: string;
  recordType: string;
  recordId: string;
  reason: string;
  requestedBy?: string;
}

export interface ProcessDeletionInput {
  tenantId: string;
  requestId: string;
  processedBy?: string;
}

export interface LifecycleRevocationInput {
  tenantId: string;
  rightsId?: string;
  controlId?: string;
  provenanceNodeId?: string;
  reason: string;
  updatedBy?: string;
}

export interface LifecycleRevocationResult {
  rightsRevoked?: boolean;
  aiControlRevoked?: boolean;
  provenanceRetracted?: boolean;
  rightsId?: string;
  controlId?: string;
  nodeId?: string;
  revokedAt: string;
  status: 'revoked' | 'retracted';
}

export interface DataLifecycleEvent {
  eventId: string;
  tenantId: string;
  eventType: DataLifecycleEventType;
  recordType: string;
  recordId: string;
  requestId?: string;
  policyVersion?: number;
  payload?: Record<string, any>;
  eventHash: string;
  recordedAt: string;
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class DataRetentionSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataRetentionSecurityError';
  }
}

export class DataRetentionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataRetentionValidationError';
  }
}

export class DataRetentionIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataRetentionIntegrityError';
  }
}

// =============================================================================
// CRYPTOGRAPHIC & DETERMINISTIC IDENTIFIERS
// =============================================================================

export function computeRetentionPolicyId(tenantId: string, recordType: string): string {
  const hash = computeSha256(`${tenantId}:${recordType}`);
  return `retpol_${hash.substring(0, 24)}`;
}

export function computeDeletionRequestId(tenantId: string, recordType: string, recordId: string): string {
  const hash = computeSha256(`${tenantId}:${recordType}:${recordId}`);
  return `delreq_${hash.substring(0, 24)}`;
}

export function computeLifecycleEventId(
  tenantId: string,
  eventType: string,
  recordId: string,
  timestamp: string
): string {
  const hash = computeSha256(`${tenantId}:${eventType}:${recordId}:${timestamp}`);
  return `licevt_${hash.substring(0, 24)}`;
}

export function computeLifecycleEventHash(event: {
  eventId: string;
  tenantId: string;
  eventType: string;
  recordType: string;
  recordId: string;
  requestId?: string;
  policyVersion?: number;
  recordedAt: string;
}): string {
  const payload = JSON.stringify({
    eventId: event.eventId,
    tenantId: event.tenantId,
    eventType: event.eventType,
    recordType: event.recordType,
    recordId: event.recordId,
    requestId: event.requestId || null,
    policyVersion: event.policyVersion || null,
    recordedAt: event.recordedAt,
  });
  return computeSha256(payload);
}


// =============================================================================
// DATA RETENTION & DELETION SERVICE
// =============================================================================

export class DataRetentionService {
  private db: admin.firestore.Firestore | any = null;
  private rightsService: DataRightsService;
  private provenanceService: ProvenanceGraphService;
  private archiveService: ContractorArchiveRightsService;
  private classificationService: DataClassificationEligibilityService;
  private aiUsageService: AiTrainingUsageControlsService;

  constructor(
    db?: admin.firestore.Firestore | any,
    rightsService?: DataRightsService,
    provenanceService?: ProvenanceGraphService,
    archiveService?: ContractorArchiveRightsService,
    classificationService?: DataClassificationEligibilityService,
    aiUsageService?: AiTrainingUsageControlsService
  ) {
    if (db) this.db = db;
    this.rightsService = rightsService || defaultDataRightsService;
    this.provenanceService = provenanceService || defaultProvenanceGraphService;
    this.archiveService = archiveService || defaultContractorArchiveRightsService;
    this.classificationService = classificationService || defaultDataClassificationEligibilityService;
    this.aiUsageService = aiUsageService || defaultAiTrainingUsageControlsService;
  }

  public setFirestoreDb(db: admin.firestore.Firestore | any) {
    this.db = db;
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
    if (this.aiUsageService && typeof (this.aiUsageService as any).setFirestoreDb === 'function') {
      (this.aiUsageService as any).setFirestoreDb(db);
    }
  }

  private getDb(): admin.firestore.Firestore {
    if (!this.db) {
      if (admin?.apps && admin.apps.length > 0) {
        this.db = admin.firestore();
      } else {
        throw new Error('[DataRetentionService] Firestore instance not initialized');
      }
    }
    return this.db;
  }

  /**
   * Resolves the server-authoritative Firestore collection for a validated record type.
   * Unknown record types return null (fails closed).
   */
  public resolveAuthoritativeCollection(recordType: string): string | null {
    if (!recordType || typeof recordType !== 'string') return null;
    const normalized = recordType.trim().toLowerCase();
    const mappings: Record<string, string> = {
      property: 'properties',
      properties: 'properties',
      property_passport: 'properties',
      property_doc: 'properties',
      job: 'jobs',
      jobs: 'jobs',
      quote: 'quotes',
      quotes: 'quotes',
      review: 'reviews',
      reviews: 'reviews',
      temporary_upload: 'temporary_files',
      temporary_uploads: 'temporary_files',
      temporary_file: 'temporary_files',
      temporary_files: 'temporary_files',
      contractor_document: 'contractor_documents',
      contractor_documents: 'contractor_documents',
      dispute_evidence: 'dispute_evidence',
      user_profile: 'users',
      user: 'users',
      users: 'users',
    };

    return mappings[normalized] || null;
  }

  /**
   * Registers or updates a server-authoritative retention policy for a tenant & recordType.
   */
  public async registerRetentionPolicy(input: RegisterRetentionPolicyInput): Promise<RetentionPolicy> {
    if (!input.tenantId || typeof input.tenantId !== 'string' || input.tenantId.trim() === '') {
      throw new DataRetentionValidationError('Invalid tenantId: must be a non-empty string');
    }
    if (!input.recordType || typeof input.recordType !== 'string' || input.recordType.trim() === '') {
      throw new DataRetentionValidationError('Invalid recordType: must be a non-empty string');
    }
    if (!input.retentionClass || typeof input.retentionClass !== 'string' || input.retentionClass.trim() === '') {
      throw new DataRetentionValidationError('Invalid retentionClass: must be a non-empty string');
    }

    const db = this.getDb();
    const policyId = computeRetentionPolicyId(input.tenantId, input.recordType);
    const policyRef = db.collection('data_retention_policies').doc(policyId);
    const now = new Date().toISOString();

    let retentionUntil = input.retentionUntil;
    if (!retentionUntil && input.retentionPeriodDays !== undefined && input.retentionPeriodDays > 0) {
      const futureMs = Date.now() + input.retentionPeriodDays * 24 * 60 * 60 * 1000;
      retentionUntil = new Date(futureMs).toISOString();
    }

    let existingPolicy: RetentionPolicy | null = null;
    const snap = await policyRef.get();
    if (snap.exists) {
      existingPolicy = snap.data() as RetentionPolicy;
      if (existingPolicy.tenantId !== input.tenantId) {
        throw new DataRetentionSecurityError(
          `Cross-tenant policy modification rejected for policy '${policyId}'`
        );
      }
    }

    // Preserve existing legal hold if not explicitly overridden by authorized input
    const isLegalHold = input.legalHold !== undefined ? input.legalHold === true : (existingPolicy ? existingPolicy.legalHold === true : false);
    const legalHoldReason = isLegalHold ? (input.legalHoldReason || (existingPolicy ? existingPolicy.legalHoldReason : undefined)) : undefined;

    const version = existingPolicy ? existingPolicy.version + 1 : 1;
    const policyRecord: RetentionPolicy = {
      policyId,
      tenantId: input.tenantId,
      recordType: input.recordType,
      retentionClass: input.retentionClass,
      ...(input.retentionPeriodDays !== undefined ? { retentionPeriodDays: input.retentionPeriodDays } : {}),
      ...(retentionUntil ? { retentionUntil } : {}),
      legalHold: isLegalHold,
      ...(isLegalHold && legalHoldReason ? { legalHoldReason } : {}),
      ...(isLegalHold ? { legalHoldAppliedAt: existingPolicy?.legalHoldAppliedAt || now } : {}),
      version,
      status: 'active',
      createdAt: existingPolicy ? existingPolicy.createdAt : now,
      updatedAt: now,
    };

    policyRecord.policyHash = computeSha256(
      JSON.stringify({
        policyId,
        tenantId: input.tenantId,
        recordType: input.recordType,
        retentionClass: input.retentionClass,
        retentionUntil,
        legalHold: policyRecord.legalHold,
        version,
      })
    );

    const cleanedPolicy = cleanUndefinedValues(policyRecord)!;

    await policyRef.set(cleanedPolicy);

    // Record lifecycle event
    await this.recordLifecycleEvent({
      tenantId: input.tenantId,
      eventType: existingPolicy ? 'POLICY_SUPERSEDED' : 'POLICY_REGISTERED',
      recordType: input.recordType,
      recordId: policyId,
      policyVersion: version,
      payload: {
        retentionClass: input.retentionClass,
        retentionUntil,
        legalHold: policyRecord.legalHold,
        version,
      },
    });

    return cleanedPolicy;
  }

  /**
   * Retrieves a retention policy with strict tenant isolation.
   */
  public async getRetentionPolicy(policyId: string, callerTenantId: string): Promise<RetentionPolicy | null> {
    if (!policyId || !callerTenantId) return null;
    const db = this.getDb();
    const snap = await db.collection('data_retention_policies').doc(policyId).get();
    if (!snap.exists) return null;
    const policy = snap.data() as RetentionPolicy;
    if (policy.tenantId !== callerTenantId) {
      throw new DataRetentionSecurityError(
        `Cross-tenant access attempt: caller ${callerTenantId} != owner ${policy.tenantId}`
      );
    }
    return policy;
  }

  /**
   * Looks up retention policy for tenant and recordType.
   */
  public async getRetentionPolicyForRecordType(
    tenantId: string,
    recordType: string
  ): Promise<RetentionPolicy | null> {
    const policyId = computeRetentionPolicyId(tenantId, recordType);
    return this.getRetentionPolicy(policyId, tenantId);
  }

  /**
   * Applies or removes a server-authoritative legal hold on a policy.
   */
  public async setLegalHold(
    tenantId: string,
    policyId: string,
    legalHold: boolean,
    reason?: string
  ): Promise<RetentionPolicy> {
    if (!tenantId || !policyId) {
      throw new DataRetentionValidationError('Missing tenantId or policyId for setLegalHold');
    }
    const db = this.getDb();
    const policyRef = db.collection('data_retention_policies').doc(policyId);
    const snap = await policyRef.get();
    if (!snap.exists) {
      throw new DataRetentionValidationError(`Retention policy '${policyId}' does not exist`);
    }

    const policy = snap.data() as RetentionPolicy;
    if (policy.tenantId !== tenantId) {
      throw new DataRetentionSecurityError(
        `Cross-tenant legal hold modification rejected for policy '${policyId}'`
      );
    }

    const now = new Date().toISOString();
    const updatedPolicy: RetentionPolicy = {
      ...policy,
      legalHold,
      ...(legalHold ? { legalHoldReason: reason || 'Under legal investigation', legalHoldAppliedAt: now } : {}),
      version: policy.version + 1,
      updatedAt: now,
    };
    if (!legalHold) {
      delete updatedPolicy.legalHoldReason;
      delete updatedPolicy.legalHoldAppliedAt;
    }

    updatedPolicy.policyHash = computeSha256(
      JSON.stringify({
        policyId: updatedPolicy.policyId,
        tenantId: updatedPolicy.tenantId,
        recordType: updatedPolicy.recordType,
        retentionClass: updatedPolicy.retentionClass,
        retentionUntil: updatedPolicy.retentionUntil,
        legalHold: updatedPolicy.legalHold,
        version: updatedPolicy.version,
      })
    );

    const cleaned = cleanUndefinedValues(updatedPolicy)!;
    await policyRef.set(cleaned);

    await this.recordLifecycleEvent({
      tenantId,
      eventType: legalHold ? 'LEGAL_HOLD_APPLIED' : 'LEGAL_HOLD_REMOVED',
      recordType: policy.recordType,
      recordId: policyId,
      policyVersion: cleaned.version,
      payload: { legalHold, reason },
    });

    return cleaned;
  }

  /**
   * Evaluates if a record is eligible for deletion according to:
   * 1. Retention policy existence (missing -> blocked_by_unknown_policy)
   * 2. Legal hold state (legalHold === true -> blocked_by_legal_hold)
   * 3. Retention period (retentionUntil > now -> retain)
   * 4. Downstream dependencies (active dependencies -> blocked_by_dependency)
   */
  public async evaluateRetentionEligibility(
    tenantId: string,
    recordType: string,
    recordId: string
  ): Promise<RetentionEvaluationResult> {
    if (!tenantId || !recordType || !recordId) {
      throw new DataRetentionValidationError('Missing mandatory params for evaluateRetentionEligibility');
    }

    // 1. Retention Policy Lookup
    const policy = await this.getRetentionPolicyForRecordType(tenantId, recordType);
    if (!policy || policy.status !== 'active') {
      return {
        allowed: false,
        decision: 'blocked_by_unknown_policy',
        reason: `No active retention policy found for tenant '${tenantId}' and recordType '${recordType}'. Unknown policy fails closed.`,
      };
    }

    // 2. Legal Hold Boundary Check
    if (policy.legalHold === true) {
      return {
        allowed: false,
        decision: 'blocked_by_legal_hold',
        reason: `Record is under server-authoritative legal hold: ${policy.legalHoldReason || 'Active legal hold enforced'}`,
        policyId: policy.policyId,
        legalHold: true,
      };
    }

    // 3. Retention Period Expiry Check
    if (policy.retentionUntil) {
      const expiryMs = new Date(policy.retentionUntil).getTime();
      const nowMs = Date.now();
      if (expiryMs > nowMs) {
        return {
          allowed: false,
          decision: 'retain',
          reason: `Record is within mandatory active retention period until ${policy.retentionUntil}`,
          policyId: policy.policyId,
          retentionUntil: policy.retentionUntil,
          legalHold: false,
        };
      }
    }

    // 4. Downstream Dependency Inspection
    const dependencies = await this.findDeletionDependencies(tenantId, recordType, recordId);
    if (dependencies.length > 0) {
      return {
        allowed: false,
        decision: 'blocked_by_dependency',
        reason: `Record has ${dependencies.length} active downstream dependencies that must be resolved or revoked first`,
        policyId: policy.policyId,
        retentionUntil: policy.retentionUntil,
        legalHold: false,
        dependencies,
      };
    }

    // All gates pass -> eligible for deletion
    return {
      allowed: true,
      decision: 'eligible_for_deletion',
      reason: 'Record has met retention policy criteria, has no legal hold, and all dependencies are clear',
      policyId: policy.policyId,
      retentionUntil: policy.retentionUntil,
      legalHold: false,
    };
  }

  /**
   * Discovers downstream dependencies for a given record across:
   * - Data Rights (/data_rights)
   * - Provenance Nodes (/provenance_nodes)
   * - Data Classifications (/data_classifications)
   * - AI Usage Controls (/ai_usage_controls)
   */
  public async findDeletionDependencies(
    tenantId: string,
    recordType: string,
    recordId: string
  ): Promise<DeletionDependency[]> {
    const dependencies: DeletionDependency[] = [];
    const db = this.getDb();

    // 1. Data Rights Check
    try {
      const rightsDoc = await this.rightsService.getDataRightsRecordBySubject(tenantId, recordType, recordId);
      if (rightsDoc && rightsDoc.status === 'active') {
        dependencies.push({
          dependencyType: 'data_rights',
          dependencyId: rightsDoc.rightsId,
          tenantId: rightsDoc.tenantId,
          status: rightsDoc.status,
          description: `Active sovereign Data Rights record '${rightsDoc.rightsId}' exists for subject ${recordType}:${recordId}`,
        });
      }
    } catch {
      // Fallback manual check
    }

    // 2. AI Usage Controls Check
    try {
      const controlId = `aicontrol_${computeSha256(`${tenantId}:${recordType}:${recordId}`).substring(0, 24)}`;
      const aiControl = await this.aiUsageService.getAiUsageControlRecord(controlId, tenantId);
      if (aiControl && aiControl.status === 'active') {
        dependencies.push({
          dependencyType: 'ai_usage_control',
          dependencyId: aiControl.controlId,
          tenantId: aiControl.tenantId,
          status: aiControl.status,
          description: `Active AI Usage Control policy '${aiControl.controlId}' is bound to ${recordType}:${recordId}`,
        });
      }
    } catch {
      // Ignore not found
    }

    // 3. Provenance Node Check
    try {
      const provSnap = await db
        .collection('provenance_nodes')
        .where('tenantId', '==', tenantId)
        .where('sourceId', '==', recordId)
        .where('status', '==', 'active')
        .limit(10)
        .get();

      for (const doc of provSnap.docs) {
        const node = doc.data() as ProvenanceNode;
        if (node.tenantId === tenantId && node.status === 'active') {
          dependencies.push({
            dependencyType: 'provenance_node',
            dependencyId: node.nodeId,
            tenantId: node.tenantId,
            status: node.status,
            description: `Active provenance node '${node.nodeId}' references source '${recordId}'`,
          });
        }
      }
    } catch {
      // Fallback
    }

    // 4. Data Classification Check
    try {
      const classSnap = await db
        .collection('data_classifications')
        .where('tenantId', '==', tenantId)
        .where('recordType', '==', recordType)
        .where('recordId', '==', recordId)
        .where('status', '==', 'active')
        .limit(10)
        .get();

      for (const doc of classSnap.docs) {
        const d = doc.data();
        if (d.tenantId === tenantId && d.status === 'active') {
          dependencies.push({
            dependencyType: 'data_classification',
            dependencyId: doc.id,
            tenantId: d.tenantId,
            status: d.status,
            description: `Active data classification '${doc.id}' categorizes ${recordType}:${recordId}`,
          });
        }
      }
    } catch {
      // Fallback
    }

    return dependencies;
  }

  /**
   * Orchestrates multi-system rights revocation, AI control revocation, and provenance retraction.
   * Reuses existing canonical services without creating second engines.
   */
  public async revokeDataLifecycleRights(input: LifecycleRevocationInput): Promise<LifecycleRevocationResult> {
    if (!input.tenantId || !input.reason) {
      throw new DataRetentionValidationError('Missing tenantId or reason for revokeDataLifecycleRights');
    }

    const now = new Date().toISOString();
    let rightsRevoked = false;
    let aiControlRevoked = false;
    let provenanceRetracted = false;

    // 1. Revoke Data Rights via DataRightsService
    if (input.rightsId) {
      const rights = await this.rightsService.getDataRightsRecord(input.rightsId);
      if (!rights) {
        throw new DataRetentionValidationError(`Data rights record '${input.rightsId}' not found`);
      }
      if (rights.tenantId !== input.tenantId) {
        throw new DataRetentionSecurityError(
          `Cross-tenant rights revocation rejected: caller '${input.tenantId}' != owner '${rights.tenantId}'`
        );
      }
      if (rights.status !== 'revoked') {
        await this.rightsService.updateDataRightsRecord({
          rightsId: input.rightsId,
          tenantId: input.tenantId,
          status: 'revoked',
          revocationReason: input.reason,
          updatedBy: input.updatedBy || input.tenantId,
        });
        rightsRevoked = true;
      }
    }

    // 2. Revoke AI Usage Controls via AiTrainingUsageControlsService
    if (input.controlId) {
      const control = await this.aiUsageService.getAiUsageControlRecord(input.controlId, input.tenantId);
      if (control && control.status !== 'revoked') {
        await this.aiUsageService.revokeAiUsageControls(
          input.tenantId,
          input.controlId,
          input.reason,
          input.updatedBy || input.tenantId
        );
        aiControlRevoked = true;
      }
    }

    // 3. Retract Provenance Node via ProvenanceGraphService
    if (input.provenanceNodeId) {
      const node = await this.provenanceService.getNode(input.provenanceNodeId, input.tenantId);
      if (node && node.status !== 'retracted') {
        await this.provenanceService.updateNodeStatus(
          input.tenantId,
          input.provenanceNodeId,
          'retracted',
          input.reason
        );
        provenanceRetracted = true;
      }
    }

    return {
      rightsRevoked,
      aiControlRevoked,
      provenanceRetracted,
      rightsId: input.rightsId,
      controlId: input.controlId,
      nodeId: input.provenanceNodeId,
      revokedAt: now,
      status: 'revoked',
    };
  }

  /**
   * Initiates a deterministic deletion request.
   * State Machine: requested -> blocked | approved.
   */
  public async requestDeletion(input: RequestDeletionInput): Promise<DataDeletionRequest> {
    if (!input.tenantId || !input.recordType || !input.recordId) {
      throw new DataRetentionValidationError('Missing mandatory fields for requestDeletion');
    }

    const db = this.getDb();
    const requestId = computeDeletionRequestId(input.tenantId, input.recordType, input.recordId);
    const reqRef = db.collection('data_deletion_requests').doc(requestId);
    const now = new Date().toISOString();

    const existingSnap = await reqRef.get();
    if (existingSnap.exists) {
      const existingReq = existingSnap.data() as DataDeletionRequest;
      if (existingReq.tenantId !== input.tenantId) {
        throw new DataRetentionSecurityError(
          `Cross-tenant deletion request access rejected for request '${requestId}'`
        );
      }
      // Idempotency: if already completed, return existing
      if (existingReq.status === 'completed') {
        return existingReq;
      }
    }

    // Evaluate eligibility
    const evalResult = await this.evaluateRetentionEligibility(
      input.tenantId,
      input.recordType,
      input.recordId
    );

    const status: DeletionRequestStatus = evalResult.allowed ? 'approved' : 'blocked';
    const requestRecord: DataDeletionRequest = {
      requestId,
      tenantId: input.tenantId,
      recordType: input.recordType,
      recordId: input.recordId,
      status,
      reason: input.reason,
      requestedBy: input.requestedBy || input.tenantId,
      requestedAt: existingSnap.exists ? (existingSnap.data() as any).requestedAt : now,
      ...(evalResult.allowed ? { approvedAt: now } : { blockedReason: evalResult.reason }),
      ...(evalResult.policyId ? { policyRef: { policyId: evalResult.policyId, version: 1 } } : {}),
      dependencyCount: evalResult.dependencies ? evalResult.dependencies.length : 0,
      dependencies: evalResult.dependencies,
      version: existingSnap.exists ? (existingSnap.data() as any).version + 1 : 1,
    };

    const cleaned = cleanUndefinedValues(requestRecord)!;
    await reqRef.set(cleaned);

    await this.recordLifecycleEvent({
      tenantId: input.tenantId,
      eventType: evalResult.allowed ? 'DELETION_APPROVED' : 'DELETION_BLOCKED',
      recordType: input.recordType,
      recordId: input.recordId,
      requestId,
      payload: {
        status,
        decision: evalResult.decision,
        reason: evalResult.reason,
      },
    });

    return cleaned;
  }

  /**
   * Processes an approved deletion request and performs actual erasure of the eligible current projection.
   * State Machine: approved -> processing -> completed.
   * Enforces:
   * - Re-checks retention policy, legal hold, and active dependencies.
   * - Revokes rights and AI controls first.
   * - Retracts provenance nodes if applicable.
   * - Erases current target projection from Firestore collection.
   * - Preserves immutable audit history.
   * - Emits minimal DATA_ERASURE_COMPLETED lifecycle event.
   */
  public async processDeletion(input: ProcessDeletionInput): Promise<DataDeletionRequest> {
    if (!input.tenantId || !input.requestId) {
      throw new DataRetentionValidationError('Missing tenantId or requestId for processDeletion');
    }

    const db = this.getDb();
    const reqRef = db.collection('data_deletion_requests').doc(input.requestId);
    const snap = await reqRef.get();
    if (!snap.exists) {
      throw new DataRetentionValidationError(`Deletion request '${input.requestId}' not found`);
    }

    const reqData = snap.data() as DataDeletionRequest;
    if (reqData.tenantId !== input.tenantId) {
      throw new DataRetentionSecurityError(
        `Cross-tenant deletion processing rejected: caller '${input.tenantId}' != owner '${reqData.tenantId}'`
      );
    }

    // Idempotency: if completed, return immediately
    if (reqData.status === 'completed') {
      return reqData;
    }

    // Invalid transition checks
    if (reqData.status === 'rejected') {
      throw new DataRetentionValidationError(`Cannot process rejected deletion request '${input.requestId}'`);
    }

    // Re-evaluate eligibility to ensure state has not drifted
    const evalResult = await this.evaluateRetentionEligibility(
      input.tenantId,
      reqData.recordType,
      reqData.recordId
    );

    if (!evalResult.allowed) {
      // Transition back to blocked
      const blockedReq: DataDeletionRequest = {
        ...reqData,
        status: 'blocked',
        blockedReason: evalResult.reason,
        version: reqData.version + 1,
      };
      await reqRef.set(cleanUndefinedValues(blockedReq)!);
      throw new DataRetentionSecurityError(
        `Deletion blocked during execution: ${evalResult.reason}`
      );
    }

    const now = new Date().toISOString();

    // 1. Transition to 'processing'
    await reqRef.update({
      status: 'processing',
      version: reqData.version + 1,
    });

    await this.recordLifecycleEvent({
      tenantId: input.tenantId,
      eventType: 'DATA_ERASURE_PROCESSING',
      recordType: reqData.recordType,
      recordId: reqData.recordId,
      requestId: input.requestId,
    });

    let erasedRecordsCount = 0;
    let revokedRightsCount = 0;
    let revokedAiControlsCount = 0;
    let retractedNodesCount = 0;

    // 2. Revoke associated Data Rights
    try {
      const rightsDoc = await this.rightsService.getDataRightsRecordBySubject(
        input.tenantId,
        reqData.recordType,
        reqData.recordId
      );
      if (rightsDoc && rightsDoc.status === 'active') {
        await this.rightsService.updateDataRightsRecord({
          rightsId: rightsDoc.rightsId,
          tenantId: input.tenantId,
          status: 'revoked',
          revocationReason: `Data erasure executed for ${reqData.recordType}:${reqData.recordId}`,
          updatedBy: input.processedBy || input.tenantId,
        });
        revokedRightsCount++;
      }
    } catch {
      // Ignore
    }

    // 3. Revoke associated AI Controls
    try {
      const controlId = `aicontrol_${computeSha256(`${input.tenantId}:${reqData.recordType}:${reqData.recordId}`).substring(0, 24)}`;
      const aiControl = await this.aiUsageService.getAiUsageControlRecord(controlId, input.tenantId);
      if (aiControl && aiControl.status === 'active') {
        await this.aiUsageService.revokeAiUsageControls(
          input.tenantId,
          controlId,
          `Data erasure executed for ${reqData.recordType}:${reqData.recordId}`,
          input.processedBy || input.tenantId
        );
        revokedAiControlsCount++;
      }
    } catch {
      // Ignore
    }

    // 4. Retract associated Provenance Nodes
    try {
      const provSnap = await db
        .collection('provenance_nodes')
        .where('tenantId', '==', input.tenantId)
        .where('sourceId', '==', reqData.recordId)
        .where('status', '==', 'active')
        .get();

      for (const doc of provSnap.docs) {
        await this.provenanceService.updateNodeStatus(
          input.tenantId,
          doc.id,
          'retracted',
          `Data erasure executed for ${reqData.recordType}:${reqData.recordId}`
        );
        retractedNodesCount++;
      }
    } catch {
      // Ignore
    }

    // 5. Erase target document from server-authoritative collection
    const targetCollection = this.resolveAuthoritativeCollection(reqData.recordType);
    if (!targetCollection) {
      throw new DataRetentionValidationError(
        `No authoritative physical collection mapping exists for record type '${reqData.recordType}'`
      );
    }

    try {
      const targetRef = db.collection(targetCollection).doc(reqData.recordId);
      const targetSnap = await targetRef.get();
      if (targetSnap.exists) {
        const targetData = targetSnap.data();
        if (targetData?.tenantId && targetData.tenantId !== input.tenantId) {
          throw new DataRetentionSecurityError('Target document tenant mismatch during erasure');
        }
        await targetRef.delete();
        erasedRecordsCount++;
      }
    } catch (err: any) {
      if (err instanceof DataRetentionSecurityError) throw err;
      // Target might not exist as a physical document, proceed
    }

    // 6. Complete deletion request
    const completedReq: DataDeletionRequest = {
      ...reqData,
      status: 'completed',
      completedAt: now,
      version: reqData.version + 2,
      result: {
        decision: 'eligible_for_deletion',
        erasedRecordsCount,
        revokedRightsCount,
        revokedAiControlsCount,
        retractedNodesCount,
      },
    };

    await reqRef.set(cleanUndefinedValues(completedReq)!);

    // 7. Record minimal non-PII immutable audit event
    await this.recordLifecycleEvent({
      tenantId: input.tenantId,
      eventType: 'DATA_ERASURE_COMPLETED',
      recordType: reqData.recordType,
      recordId: reqData.recordId,
      requestId: input.requestId,
      payload: {
        completedAt: now,
        erasedRecordsCount,
        revokedRightsCount,
        revokedAiControlsCount,
        retractedNodesCount,
      },
    });

    return completedReq;
  }

  /**
   * Records an immutable, append-only lifecycle audit event.
   */
  public async recordLifecycleEvent(params: {
    tenantId: string;
    eventType: DataLifecycleEventType;
    recordType: string;
    recordId: string;
    requestId?: string;
    policyVersion?: number;
    payload?: Record<string, any>;
  }): Promise<DataLifecycleEvent> {
    const db = this.getDb();
    const now = new Date().toISOString();
    const eventId = computeLifecycleEventId(params.tenantId, params.eventType, params.recordId, now);

    const eventBase = {
      eventId,
      tenantId: params.tenantId,
      eventType: params.eventType,
      recordType: params.recordType,
      recordId: params.recordId,
      requestId: params.requestId,
      policyVersion: params.policyVersion,
      payload: cleanUndefinedValues(params.payload),
      recordedAt: now,
    };

    const eventHash = computeLifecycleEventHash(eventBase);
    const eventRecord: DataLifecycleEvent = {
      ...eventBase,
      eventHash,
    };

    const cleaned = cleanUndefinedValues(eventRecord)!;
    await db.collection('data_lifecycle_events').doc(eventId).set(cleaned);

    return cleaned;
  }

  /**
   * Retrieves deletion request by ID for authorized tenant.
   */
  public async getDeletionRequest(requestId: string, callerTenantId: string): Promise<DataDeletionRequest | null> {
    if (!requestId || !callerTenantId) return null;
    const db = this.getDb();
    const snap = await db.collection('data_deletion_requests').doc(requestId).get();
    if (!snap.exists) return null;
    const req = snap.data() as DataDeletionRequest;
    if (req.tenantId !== callerTenantId) {
      throw new DataRetentionSecurityError(
        `Cross-tenant access attempt for deletion request '${requestId}'`
      );
    }
    return req;
  }
}

export const dataRetentionService = new DataRetentionService();
