/**
 * AnyTrader V8.3 — Task 27 Data Rights & Provenance Foundation
 * 
 * Provides:
 * - Server-authoritative data rights and permissions model
 * - Explicit purpose distinction (internal AI use vs external AI training vs commercial licensing)
 * - Conservative evaluation semantics (unknown != allowed)
 * - Tenant-scoped, provenance-aware rights records
 * - Append-only immutable history (/data_rights_history) + current projection (/data_rights)
 * - Server-only transaction-based rights mutations
 */

import * as admin from 'firebase-admin';
import { computeSha256, computeStructuredDataHash } from './provenance';

export type RightsPurpose =
  | 'internal_platform_operation'
  | 'internal_ai_use'
  | 'external_ai_training'
  | 'third_party_sharing'
  | 'commercial_licensing'
  | 'export';

export type PurposePermission = 'allowed' | 'denied' | 'unknown';

export type RightsStatus = 'active' | 'revoked' | 'expired' | 'superseded';

export interface RightsSubject {
  type: string;
  id: string;
}

export interface RightsOwner {
  type: string;
  id: string;
}

export interface RightsSource {
  type: string;
  id: string;
  tenantId?: string;
}

export interface RightsProvenance {
  sourceType: string;
  sourceId: string;
  tenantId: string;
  sourceVersion?: string;
  recordedBy?: string;
  rightsHash?: string;
}

export interface DataRightsRecord {
  rightsId: string;
  tenantId: string;
  subject: RightsSubject;
  owner: RightsOwner;
  source: RightsSource;
  purposes: Record<RightsPurpose, PurposePermission>;
  restrictions: string[];
  status: RightsStatus;
  version: number;
  provenance: RightsProvenance;
  effectiveAt: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  revocationReason?: string;
}

export interface CreateDataRightsInput {
  rightsId?: string;
  tenantId: string;
  subject: RightsSubject;
  owner: RightsOwner;
  source: RightsSource;
  purposes?: Partial<Record<RightsPurpose, PurposePermission>>;
  restrictions?: string[];
  provenance: {
    sourceType: string;
    sourceId: string;
    tenantId?: string;
    sourceVersion?: string;
    recordedBy?: string;
  };
  effectiveAt?: string;
}

export interface UpdateDataRightsInput {
  rightsId: string;
  tenantId: string;
  purposes?: Partial<Record<RightsPurpose, PurposePermission>>;
  restrictions?: string[];
  status?: RightsStatus;
  revocationReason?: string;
  updatedBy?: string;
}

export class DataRightsSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataRightsSecurityError';
  }
}

/**
 * Computes deterministic SHA-256 integrity hash over all security/provenance-sensitive state.
 * Required fields covered:
 * - rightsId
 * - tenantId
 * - subject
 * - owner
 * - purposes
 * - restrictions
 * - version
 * - source
 * - provenance (excluding rightsHash itself)
 * - status
 * - effectiveAt
 */
export function computeDataRightsHash(record: {
  rightsId: string;
  tenantId: string;
  subject: RightsSubject;
  owner: RightsOwner;
  purposes: Record<RightsPurpose, PurposePermission>;
  restrictions: string[];
  version: number;
  source: RightsSource;
  provenance: {
    sourceType: string;
    sourceId: string;
    tenantId: string;
    sourceVersion?: string;
    recordedBy?: string;
  };
  status: RightsStatus;
  effectiveAt: string;
}): string {
  return computeStructuredDataHash({
    rightsId: record.rightsId,
    tenantId: record.tenantId,
    subject: record.subject,
    owner: record.owner,
    purposes: record.purposes,
    restrictions: record.restrictions,
    version: record.version,
    source: record.source,
    provenance: {
      sourceType: record.provenance.sourceType,
      sourceId: record.provenance.sourceId,
      tenantId: record.provenance.tenantId,
      sourceVersion: record.provenance.sourceVersion,
      recordedBy: record.provenance.recordedBy,
    },
    status: record.status,
    effectiveAt: record.effectiveAt,
  });
}

/**
 * Default conservative purpose map where all undefined purposes are 'unknown'
 */
export function createDefaultPurposes(
  overrides?: Partial<Record<RightsPurpose, PurposePermission>>
): Record<RightsPurpose, PurposePermission> {
  return {
    internal_platform_operation: overrides?.internal_platform_operation ?? 'unknown',
    internal_ai_use: overrides?.internal_ai_use ?? 'unknown',
    external_ai_training: overrides?.external_ai_training ?? 'unknown',
    third_party_sharing: overrides?.third_party_sharing ?? 'unknown',
    commercial_licensing: overrides?.commercial_licensing ?? 'unknown',
    export: overrides?.export ?? 'unknown',
  };
}

/**
 * Standard AnyTrader internal operational rights template:
 * internal_platform_operation = allowed
 * internal_ai_use = allowed
 * external_ai_training = denied (or unknown)
 * third_party_sharing = denied
 * commercial_licensing = denied
 * export = denied
 */
export function createStandardInternalPlatformPurposes(
  internalAiAllowed: boolean = true
): Record<RightsPurpose, PurposePermission> {
  return {
    internal_platform_operation: 'allowed',
    internal_ai_use: internalAiAllowed ? 'allowed' : 'denied',
    external_ai_training: 'denied',
    third_party_sharing: 'denied',
    commercial_licensing: 'denied',
    export: 'denied',
  };
}

/**
 * Validates rights record consistency, tenant binding, and non-empty mandatory attributes
 */
export function validateDataRightsRecord(record: DataRightsRecord): void {
  if (!record.rightsId || typeof record.rightsId !== 'string') {
    throw new DataRightsSecurityError('Invalid rightsId');
  }
  if (!record.tenantId || typeof record.tenantId !== 'string' || record.tenantId.trim() === '') {
    throw new DataRightsSecurityError('Invalid tenantId: tenant context is mandatory');
  }
  if (!record.subject || !record.subject.type || !record.subject.id) {
    throw new DataRightsSecurityError('Invalid subject: subject type and id are mandatory');
  }
  if (!record.owner || !record.owner.type || !record.owner.id) {
    throw new DataRightsSecurityError('Invalid owner: owner type and id are mandatory');
  }
  if (!record.source || !record.source.type || !record.source.id) {
    throw new DataRightsSecurityError('Invalid source: source type and id are mandatory');
  }
  // Source tenant binding if provided
  if (record.source.tenantId && record.source.tenantId !== record.tenantId) {
    throw new DataRightsSecurityError(`Source tenant mismatch: source tenant '${record.source.tenantId}' does not match record tenant '${record.tenantId}'`);
  }
  if (!record.provenance || !record.provenance.sourceType || !record.provenance.sourceId) {
    throw new DataRightsSecurityError('Invalid provenance: provenance sourceType and sourceId are mandatory');
  }
  if (!record.provenance.tenantId || typeof record.provenance.tenantId !== 'string' || record.provenance.tenantId.trim() === '') {
    throw new DataRightsSecurityError('Invalid provenance: provenance tenantId is mandatory and must be non-empty');
  }
  if (record.provenance.tenantId !== record.tenantId) {
    throw new DataRightsSecurityError(`Provenance tenant mismatch: provenance tenant '${record.provenance.tenantId}' does not match record tenant '${record.tenantId}'`);
  }
  if (!record.provenance.rightsHash || typeof record.provenance.rightsHash !== 'string' || record.provenance.rightsHash.length < 64) {
    throw new DataRightsSecurityError('Invalid provenance: rightsHash must be a valid 64-character SHA-256 hash');
  }
  if (!record.purposes) {
    throw new DataRightsSecurityError('Invalid purposes: purposes object is mandatory');
  }

  const validPurposes: RightsPurpose[] = [
    'internal_platform_operation',
    'internal_ai_use',
    'external_ai_training',
    'third_party_sharing',
    'commercial_licensing',
    'export',
  ];

  const validPermissions: PurposePermission[] = ['allowed', 'denied', 'unknown'];

  for (const purpose of validPurposes) {
    const val = record.purposes[purpose];
    if (!validPermissions.includes(val)) {
      throw new DataRightsSecurityError(`Invalid purpose permission '${val}' for purpose '${purpose}'`);
    }
  }

  if (record.version < 1 || !Number.isInteger(record.version)) {
    throw new DataRightsSecurityError('Invalid version: version must be a positive integer');
  }
}

/**
 * Evaluates whether data is permitted for a specific purpose.
 * CONSERVATIVE EVALUATION:
 * - Status must be 'active'
 * - Purpose permission must be strictly 'allowed' ('unknown' and 'denied' return false)
 * - Explicit restrictions matching purpose reject access
 */
export function canUseDataForPurpose(
  rights: DataRightsRecord | null | undefined,
  purpose: RightsPurpose,
  expectedTenantId?: string
): boolean {
  if (!rights) {
    return false;
  }

  // Multi-tenant check
  if (expectedTenantId && rights.tenantId !== expectedTenantId) {
    return false;
  }

  // Must be active
  if (rights.status !== 'active') {
    return false;
  }

  // Check expiration if effectiveAt/expires in restrictions
  if (rights.effectiveAt && new Date(rights.effectiveAt).getTime() > Date.now()) {
    return false;
  }

  // Explicit purpose check: unknown != allowed
  const permission = rights.purposes?.[purpose];
  if (permission !== 'allowed') {
    return false;
  }

  // Check explicit restriction list
  if (Array.isArray(rights.restrictions)) {
    const purposeRestriction = `restrict_${purpose}`;
    const allAiRestriction = 'restrict_all_ai';
    if (rights.restrictions.includes(purposeRestriction)) {
      return false;
    }
    if (purpose.includes('ai') && rights.restrictions.includes(allAiRestriction)) {
      return false;
    }
  }

  return true;
}

/**
 * Authoritative Server Data Rights Service
 */
export class DataRightsService {
  private db: admin.firestore.Firestore | null = null;

  constructor(db?: admin.firestore.Firestore) {
    if (db) this.db = db;
  }

  public setFirestoreDb(db: admin.firestore.Firestore) {
    this.db = db;
  }

  private getDb(): admin.firestore.Firestore {
    if (!this.db) {
      if (admin.apps.length > 0) {
        this.db = admin.firestore();
      } else {
        throw new Error('[DataRightsService] Firestore not initialized');
      }
    }
    return this.db;
  }

  /**
   * Deterministic rights ID generation based on subject
   */
  public generateRightsId(tenantId: string, subjectType: string, subjectId: string): string {
    const raw = `${tenantId}:${subjectType}:${subjectId}`;
    return `rights_${computeSha256(raw).slice(0, 24)}`;
  }

  /**
   * Creates a new authoritative data rights record and persists an immutable history snapshot.
   */
  public async createDataRightsRecord(input: CreateDataRightsInput): Promise<DataRightsRecord> {
    const db = this.getDb();
    const rightsId = input.rightsId || this.generateRightsId(input.tenantId, input.subject.type, input.subject.id);
    const nowIso = new Date().toISOString();

    if (!input.tenantId || typeof input.tenantId !== 'string' || input.tenantId.trim() === '') {
      throw new DataRightsSecurityError('Invalid tenantId: tenant context is mandatory');
    }

    if (input.provenance?.tenantId && input.provenance.tenantId !== input.tenantId) {
      throw new DataRightsSecurityError(`Provenance tenant mismatch: provenance tenant '${input.provenance.tenantId}' does not match record tenant '${input.tenantId}'`);
    }

    if (input.source?.tenantId && input.source.tenantId !== input.tenantId) {
      throw new DataRightsSecurityError(`Source tenant mismatch: source tenant '${input.source.tenantId}' does not match record tenant '${input.tenantId}'`);
    }

    const record: DataRightsRecord = {
      rightsId,
      tenantId: input.tenantId,
      subject: input.subject,
      owner: input.owner,
      source: input.source,
      purposes: createDefaultPurposes(input.purposes),
      restrictions: input.restrictions || [],
      status: 'active',
      version: 1,
      provenance: {
        sourceType: input.provenance.sourceType,
        sourceId: input.provenance.sourceId,
        tenantId: input.tenantId, // authoritatively bound to record tenant
        sourceVersion: input.provenance.sourceVersion,
        recordedBy: input.provenance.recordedBy || 'system_authoritative',
      },
      effectiveAt: input.effectiveAt || nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    record.provenance.rightsHash = computeDataRightsHash({
      rightsId: record.rightsId,
      tenantId: record.tenantId,
      subject: record.subject,
      owner: record.owner,
      purposes: record.purposes,
      restrictions: record.restrictions,
      version: record.version,
      source: record.source,
      provenance: {
        sourceType: record.provenance.sourceType,
        sourceId: record.provenance.sourceId,
        tenantId: record.provenance.tenantId,
        sourceVersion: record.provenance.sourceVersion,
        recordedBy: record.provenance.recordedBy,
      },
      status: record.status,
      effectiveAt: record.effectiveAt,
    });

    validateDataRightsRecord(record);

    const rightsRef = db.collection('data_rights').doc(rightsId);
    const historyId = `${rightsId}_v1_${Date.now()}`;
    const historyRef = db.collection('data_rights_history').doc(historyId);

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(rightsRef);
      if (existing.exists) {
        throw new DataRightsSecurityError(`Data rights record '${rightsId}' already exists. Use updateDataRightsRecord for revisions.`);
      }

      transaction.set(rightsRef, record);
      transaction.set(historyRef, {
        ...record,
        historyId,
        historyRecordedAt: nowIso,
        historyEventType: 'CREATED',
      });
    });

    return record;
  }

  /**
   * Retrieves current active projection for a rightsId
   */
  public async getDataRightsRecord(rightsId: string): Promise<DataRightsRecord | null> {
    const db = this.getDb();
    const snap = await db.collection('data_rights').doc(rightsId).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data() as DataRightsRecord;
  }

  /**
   * Updates an existing rights record transactionally with version bump and append-only history snapshot.
   */
  public async updateDataRightsRecord(input: UpdateDataRightsInput): Promise<DataRightsRecord> {
    const db = this.getDb();
    const rightsRef = db.collection('data_rights').doc(input.rightsId);
    const nowIso = new Date().toISOString();

    let updatedRecord: DataRightsRecord;

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(rightsRef);
      if (!snap.exists) {
        throw new DataRightsSecurityError(`Data rights record '${input.rightsId}' not found`);
      }

      const current = snap.data() as DataRightsRecord;

      // Tenant validation: updates cannot cross tenant boundaries
      if (current.tenantId !== input.tenantId) {
        throw new DataRightsSecurityError(`Tenant mismatch: cannot update rights for tenant '${current.tenantId}' with tenant '${input.tenantId}'`);
      }

      const nextVersion = current.version + 1;
      const updatedPurposes = { ...current.purposes, ...(input.purposes || {}) };
      const updatedRestrictions = input.restrictions !== undefined ? input.restrictions : current.restrictions;
      const nextStatus = input.status || current.status;

      updatedRecord = {
        ...current,
        purposes: updatedPurposes,
        restrictions: updatedRestrictions,
        status: nextStatus,
        version: nextVersion,
        updatedAt: nowIso,
        revokedAt: nextStatus === 'revoked' ? (current.revokedAt || nowIso) : current.revokedAt,
        revocationReason: input.revocationReason || current.revocationReason,
      };

      const prov = {
        ...current.provenance,
        tenantId: current.tenantId,
        recordedBy: input.updatedBy || current.provenance.recordedBy,
      };

      updatedRecord.provenance = {
        ...prov,
        rightsHash: computeDataRightsHash({
          rightsId: updatedRecord.rightsId,
          tenantId: updatedRecord.tenantId,
          subject: updatedRecord.subject,
          owner: updatedRecord.owner,
          purposes: updatedRecord.purposes,
          restrictions: updatedRecord.restrictions,
          version: updatedRecord.version,
          source: updatedRecord.source,
          provenance: {
            sourceType: prov.sourceType,
            sourceId: prov.sourceId,
            tenantId: prov.tenantId,
            sourceVersion: prov.sourceVersion,
            recordedBy: prov.recordedBy,
          },
          status: updatedRecord.status,
          effectiveAt: updatedRecord.effectiveAt,
        }),
      };

      validateDataRightsRecord(updatedRecord);

      const historyId = `${input.rightsId}_v${nextVersion}_${Date.now()}`;
      const historyRef = db.collection('data_rights_history').doc(historyId);

      transaction.set(rightsRef, updatedRecord);
      transaction.set(historyRef, {
        ...updatedRecord,
        historyId,
        historyRecordedAt: nowIso,
        historyEventType: nextStatus === 'revoked' ? 'REVOKED' : 'UPDATED',
      });
    });

    return updatedRecord!;
  }

  /**
   * Helper to check permission on an aggregate/subject directly
   */
  public async evaluatePermissionForSubject(
    tenantId: string,
    subjectType: string,
    subjectId: string,
    purpose: RightsPurpose
  ): Promise<{ allowed: boolean; reason?: string; rightsRecord?: DataRightsRecord }> {
    const rightsId = this.generateRightsId(tenantId, subjectType, subjectId);
    const record = await this.getDataRightsRecord(rightsId);

    if (!record) {
      return { allowed: false, reason: 'no_rights_record_found' };
    }

    const allowed = canUseDataForPurpose(record, purpose, tenantId);
    return {
      allowed,
      reason: allowed ? 'permission_granted' : `permission_${record.purposes[purpose] || 'unknown'}_or_restricted`,
      rightsRecord: record,
    };
  }
}

export const dataRightsService = new DataRightsService();
