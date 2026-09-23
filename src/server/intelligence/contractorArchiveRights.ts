/**
 * AnyTrader V8.3 — Task 29 Contractor Archive Rights Boundary
 * 
 * Provides:
 * - Server-authoritative rights boundary for contractor-held historical archives
 * - Strict tenant-bound isolation (tenantId === request.auth.uid)
 * - Deterministic archive and component identity hashing (SHA-256)
 * - Explicit purpose separation: internal_ai_use vs external_ai_training vs commercial_licensing
 * - Conservative default evaluation semantics: unknown != allowed
 * - Internal AI bot preservation: AnyTrader internal AI allowed when internal_ai_use: 'allowed'
 * - Mixed-origin boundary: distinguishes contractor_owned, customer_or_subject_data, third_party_data, platform_generated, unknown_origin
 * - No rights inference from possession, upload, or provenance graph existence
 * - Integration with Task 27 DataRightsService and Task 28 ProvenanceGraphService
 * - Comprehensive eligibility evaluation boundary with deterministic failure reasons:
 *   allowed, denied, unknown, blocked_by_restriction, blocked_by_tenant, blocked_by_status, blocked_by_origin
 */

import * as admin from 'firebase-admin';
import { computeSha256 } from './provenance';
import {
  DataRightsRecord,
  RightsPurpose,
  PurposePermission,
  DataRightsSecurityError,
  DataRightsService,
  dataRightsService,
} from './dataRights';
import {
  ProvenanceGraphService,
  provenanceGraphService,
  ProvenanceNode,
} from './provenanceGraph';

// =============================================================================
// CONTROLLED VOCABULARIES & DOMAIN TYPES
// =============================================================================

export const ARCHIVE_ORIGIN_TYPES = [
  'contractor_owned',
  'customer_or_subject_data',
  'third_party_data',
  'platform_generated',
  'unknown_origin',
] as const;

export type ArchiveOriginType = typeof ARCHIVE_ORIGIN_TYPES[number];

export const ARCHIVE_COMPONENT_CATEGORIES = [
  'photograph',
  'estimate_quote',
  'inspection_note',
  'completion_record',
  'invoice',
  'certificate',
  'report',
  'measurement',
  'maintenance_history',
  'project_record',
  'other',
] as const;

export type ArchiveComponentCategory = typeof ARCHIVE_COMPONENT_CATEGORIES[number];

export type ArchiveEligibilityReason =
  | 'allowed'
  | 'denied'
  | 'unknown'
  | 'blocked_by_restriction'
  | 'blocked_by_tenant'
  | 'blocked_by_status'
  | 'blocked_by_origin';

export interface ArchiveComponentSpec {
  componentKey: string;
  originType: ArchiveOriginType;
  category: ArchiveComponentCategory;
  description?: string;
  contentHash?: string;
  purposes?: Partial<Record<RightsPurpose, PurposePermission>>;
  restrictions?: string[];
}

export interface RegisterContractorArchiveInput {
  tenantId: string;
  contractorUid: string;
  archiveReference: string;
  title?: string;
  description?: string;
  allowInternalAi?: boolean;
  sourceVersion?: string | number;
  purposes?: Partial<Record<RightsPurpose, PurposePermission>>;
  restrictions?: string[];
  components?: ArchiveComponentSpec[];
  linkProvenance?: boolean;
  recordedBy?: string;
}

export interface RegisterArchiveComponentInput {
  tenantId: string;
  archiveId: string;
  component: ArchiveComponentSpec;
  sourceVersion?: string | number;
  linkProvenance?: boolean;
  recordedBy?: string;
}

export interface ArchiveEligibilityResult {
  eligible: boolean;
  reason: ArchiveEligibilityReason;
  purpose: RightsPurpose;
  tenantId: string;
  archiveId: string;
  componentId?: string;
  originType?: ArchiveOriginType;
  rightsId?: string;
  details?: string;
}

export class ContractorArchiveSecurityError extends DataRightsSecurityError {
  constructor(message: string) {
    super(message);
    this.name = 'ContractorArchiveSecurityError';
  }
}

export class ContractorArchiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractorArchiveValidationError';
  }
}

// =============================================================================
// DETERMINISTIC IDENTIFIER & HASH GENERATION
// =============================================================================

/**
 * Deterministic SHA-256 archive ID generation based on tenantId and archiveReference
 */
export function computeContractorArchiveId(tenantId: string, archiveReference: string): string {
  if (!tenantId || !tenantId.trim()) {
    throw new ContractorArchiveValidationError('tenantId is mandatory for archive ID generation');
  }
  if (!archiveReference || !archiveReference.trim()) {
    throw new ContractorArchiveValidationError('archiveReference is mandatory for archive ID generation');
  }
  const raw = `${tenantId.trim()}:contractor_archive:${archiveReference.trim()}`;
  return `arch_${computeSha256(raw).slice(0, 24)}`;
}

/**
 * Deterministic SHA-256 archive component ID generation based on tenantId, archiveId, and componentKey
 */
export function computeArchiveComponentId(
  tenantId: string,
  archiveId: string,
  componentKey: string
): string {
  if (!tenantId || !tenantId.trim()) {
    throw new ContractorArchiveValidationError('tenantId is mandatory for component ID generation');
  }
  if (!archiveId || !archiveId.trim()) {
    throw new ContractorArchiveValidationError('archiveId is mandatory for component ID generation');
  }
  if (!componentKey || !componentKey.trim()) {
    throw new ContractorArchiveValidationError('componentKey is mandatory for component ID generation');
  }
  const raw = `${tenantId.trim()}:${archiveId.trim()}:acomp:${componentKey.trim()}`;
  return `acomp_${computeSha256(raw).slice(0, 24)}`;
}

/**
 * Conservative default purpose map for contractor historical archives:
 * - internal_platform_operation = allowed
 * - internal_ai_use = allowed (if explicitly enabled, default true for AnyTrader platform AI)
 * - external_ai_training = unknown (strictly conservative!)
 * - third_party_sharing = unknown (strictly conservative!)
 * - commercial_licensing = unknown (strictly conservative!)
 * - export = unknown (strictly conservative!)
 */
export function createDefaultContractorArchivePurposes(
  internalAiAllowed: boolean = true,
  overrides?: Partial<Record<RightsPurpose, PurposePermission>>
): Record<RightsPurpose, PurposePermission> {
  return {
    internal_platform_operation: overrides?.internal_platform_operation ?? 'allowed',
    internal_ai_use: overrides?.internal_ai_use ?? (internalAiAllowed ? 'allowed' : 'denied'),
    external_ai_training: overrides?.external_ai_training ?? 'unknown',
    third_party_sharing: overrides?.third_party_sharing ?? 'unknown',
    commercial_licensing: overrides?.commercial_licensing ?? 'unknown',
    export: overrides?.export ?? 'unknown',
  };
}

// =============================================================================
// SERVER-AUTHORITATIVE CONTRACTOR ARCHIVE RIGHTS SERVICE
// =============================================================================

export class ContractorArchiveRightsService {
  private db: admin.firestore.Firestore | any = null;
  private rightsService: DataRightsService;
  private provService: ProvenanceGraphService;

  constructor(
    db?: admin.firestore.Firestore | any,
    rightsService?: DataRightsService,
    provService?: ProvenanceGraphService
  ) {
    if (db) this.db = db;
    this.rightsService = rightsService || dataRightsService;
    this.provService = provService || provenanceGraphService;
    if (db) {
      this.rightsService.setFirestoreDb(db);
      this.provService.setFirestoreDb(db);
    }
  }

  public setFirestoreDb(db: admin.firestore.Firestore | any): void {
    this.db = db;
    this.rightsService.setFirestoreDb(db);
    this.provService.setFirestoreDb(db);
  }

  /**
   * Registers a contractor archive and establishes its server-authoritative rights boundary.
   * Enforces:
   * - Strict tenant binding (tenantId === contractorUid in UID-as-tenant architecture)
   * - Conservative defaults: external_ai_training, commercial_licensing, third_party_sharing, export default to unknown/denied
   * - Internal AI use enabled without granting external rights
   * - Deterministic archive ID and rights ID
   * - Mixed-origin component breakdown if provided
   * - Optional linkage to Task 28 Provenance Graph
   */
  public async registerArchiveRights(
    input: RegisterContractorArchiveInput
  ): Promise<{
    archiveId: string;
    rightsRecord: DataRightsRecord;
    provenanceNode?: ProvenanceNode;
    componentRights?: DataRightsRecord[];
  }> {
    if (!input.tenantId || !input.tenantId.trim()) {
      throw new ContractorArchiveSecurityError('Invalid tenantId: tenant context is mandatory');
    }
    if (!input.contractorUid || !input.contractorUid.trim()) {
      throw new ContractorArchiveSecurityError('Invalid contractorUid: contractor UID is mandatory');
    }

    // In canonical UID-as-tenant model, contractor tenant must match contractor UID
    if (input.tenantId !== input.contractorUid) {
      throw new ContractorArchiveSecurityError(
        `Tenant mismatch: contractorUid '${input.contractorUid}' does not match tenant '${input.tenantId}'`
      );
    }

    const archiveId = computeContractorArchiveId(input.tenantId, input.archiveReference);
    const allowInternalAi = input.allowInternalAi !== false;

    // Build conservative purpose map: external purposes cannot be manufactured as 'allowed' via arbitrary registration payload
    const purposes: Record<RightsPurpose, PurposePermission> = {
      internal_platform_operation: input.purposes?.internal_platform_operation ?? 'allowed',
      internal_ai_use: input.allowInternalAi === false || input.purposes?.internal_ai_use === 'denied'
        ? 'denied'
        : (input.purposes?.internal_ai_use ?? (allowInternalAi ? 'allowed' : 'denied')),
      external_ai_training: input.purposes?.external_ai_training === 'denied' ? 'denied' : 'unknown',
      third_party_sharing: input.purposes?.third_party_sharing === 'denied' ? 'denied' : 'unknown',
      commercial_licensing: input.purposes?.commercial_licensing === 'denied' ? 'denied' : 'unknown',
      export: input.purposes?.export === 'denied' ? 'denied' : 'unknown',
    };

    const restrictions = [...(input.restrictions || [])];
    if (input.allowInternalAi === false && !restrictions.includes('restrict_internal_ai_use')) {
      restrictions.push('restrict_internal_ai_use');
    }

    // Register archive rights record via authoritative DataRightsService
    const archiveSourceVersion = input.sourceVersion !== undefined && input.sourceVersion !== null && String(input.sourceVersion).trim() !== ''
      ? String(input.sourceVersion)
      : '1';

    const rightsRecord = await this.rightsService.createDataRightsRecord({
      tenantId: input.tenantId,
      subject: {
        type: 'contractor_archive',
        id: archiveId,
      },
      owner: {
        type: 'contractor',
        id: input.contractorUid,
      },
      source: {
        type: 'contractor_archive',
        id: archiveId,
        tenantId: input.tenantId,
      },
      purposes,
      restrictions,
      provenance: {
        sourceType: 'contractor_archive',
        sourceId: archiveId,
        tenantId: input.tenantId,
        sourceVersion: archiveSourceVersion,
        recordedBy: input.recordedBy || 'contractor_archive_boundary',
      },
    });

    let provenanceNode: ProvenanceNode | undefined;
    if (input.linkProvenance !== false) {
      // Must NOT swallow errors! If provenance node creation fails, throw immediately (fail closed)
      provenanceNode = await this.provService.createNode({
        tenantId: input.tenantId,
        nodeType: 'source',
        sourceType: 'contractor_archive',
        sourceId: archiveId,
        sourceVersion: Number(archiveSourceVersion) || 1,
        rightsReference: {
          rightsId: rightsRecord.rightsId,
          tenantId: input.tenantId,
          status: rightsRecord.status,
        },
        metadata: {
          archiveReference: input.archiveReference,
          contractorUid: input.contractorUid,
          componentCount: input.components?.length || 0,
          hasMixedOrigins: (input.components || []).some(
            (c) => c.originType !== 'contractor_owned'
          ),
        },
        createdBy: input.recordedBy || 'contractor_archive_boundary',
      });
    }

    // Register component rights if mixed-origin components were provided
    const componentRights: DataRightsRecord[] = [];
    if (input.components && input.components.length > 0) {
      for (const comp of input.components) {
        const compRes = await this.registerComponentRights({
          tenantId: input.tenantId,
          archiveId,
          component: comp,
          linkProvenance: input.linkProvenance,
          recordedBy: input.recordedBy,
        });
        componentRights.push(compRes.rightsRecord);
      }
    }

    return {
      archiveId,
      rightsRecord,
      provenanceNode,
      componentRights,
    };
  }

  /**
   * Registers an individual archive component rights record for mixed-origin tracking.
   */
  public async registerComponentRights(
    input: RegisterArchiveComponentInput
  ): Promise<{
    componentId: string;
    rightsRecord: DataRightsRecord;
    provenanceNode?: ProvenanceNode;
  }> {
    const { tenantId, archiveId, component } = input;
    if (!ARCHIVE_ORIGIN_TYPES.includes(component.originType)) {
      throw new ContractorArchiveValidationError(
        `Invalid originType '${component.originType}'. Must be one of: ${ARCHIVE_ORIGIN_TYPES.join(', ')}`
      );
    }
    if (!ARCHIVE_COMPONENT_CATEGORIES.includes(component.category)) {
      throw new ContractorArchiveValidationError(
        `Invalid category '${component.category}'. Must be one of: ${ARCHIVE_COMPONENT_CATEGORIES.join(', ')}`
      );
    }

    const componentId = computeArchiveComponentId(tenantId, archiveId, component.componentKey);

    // Component-level conservative purposes: external purposes cannot be manufactured as 'allowed'
    const compPurposes: Record<RightsPurpose, PurposePermission> = {
      internal_platform_operation: component.purposes?.internal_platform_operation ?? 'allowed',
      internal_ai_use: component.purposes?.internal_ai_use === 'denied'
        ? 'denied'
        : (component.purposes?.internal_ai_use ?? 'allowed'),
      external_ai_training: component.purposes?.external_ai_training === 'denied' ? 'denied' : 'unknown',
      third_party_sharing: component.purposes?.third_party_sharing === 'denied' ? 'denied' : 'unknown',
      commercial_licensing: component.purposes?.commercial_licensing === 'denied' ? 'denied' : 'unknown',
      export: component.purposes?.export === 'denied' ? 'denied' : 'unknown',
    };

    // MIXED-ORIGIN INVARIANT:
    // If component origin is NOT contractor-owned (e.g. customer data, third-party data, unknown origin),
    // external AI training, commercial licensing, third-party sharing, and export MUST NEVER be allowed!
    if (component.originType !== 'contractor_owned') {
      compPurposes.external_ai_training = component.purposes?.external_ai_training === 'denied' ? 'denied' : 'unknown';
      compPurposes.third_party_sharing = component.purposes?.third_party_sharing === 'denied' ? 'denied' : 'unknown';
      compPurposes.commercial_licensing = component.purposes?.commercial_licensing === 'denied' ? 'denied' : 'unknown';
      compPurposes.export = component.purposes?.export === 'denied' ? 'denied' : 'unknown';
    }

    const compRestrictions = [...(component.restrictions || [])];
    if (component.originType === 'customer_or_subject_data') {
      compRestrictions.push('subject_privacy_protected');
    } else if (component.originType === 'third_party_data') {
      compRestrictions.push('third_party_copyright_protected');
    }

    const compSourceVersion = input.sourceVersion !== undefined && input.sourceVersion !== null && String(input.sourceVersion).trim() !== ''
      ? String(input.sourceVersion)
      : '1';

    const rightsRecord = await this.rightsService.createDataRightsRecord({
      tenantId,
      subject: {
        type: 'contractor_archive_component',
        id: componentId,
      },
      owner: {
        type: component.originType === 'contractor_owned' ? 'contractor' : 'mixed_subject',
        id: tenantId,
      },
      source: {
        type: 'contractor_archive',
        id: archiveId,
        tenantId,
      },
      purposes: compPurposes,
      restrictions: compRestrictions,
      provenance: {
        sourceType: 'contractor_archive_component',
        sourceId: componentId,
        tenantId,
        sourceVersion: compSourceVersion,
        recordedBy: input.recordedBy || 'contractor_archive_component_boundary',
      },
    });

    let provenanceNode: ProvenanceNode | undefined;
    if (input.linkProvenance !== false) {
      // Must NOT swallow errors! If provenance node or edge creation fails, throw immediately (fail closed)
      provenanceNode = await this.provService.createNode({
        tenantId,
        nodeType: 'observation',
        sourceType: 'contractor_archive_component',
        sourceId: componentId,
        sourceVersion: Number(compSourceVersion) || 1,
        rightsReference: {
          rightsId: rightsRecord.rightsId,
          tenantId,
          status: rightsRecord.status,
        },
        metadata: {
          archiveId,
          componentKey: component.componentKey,
          originType: component.originType,
          category: component.category,
          contentHash: component.contentHash,
        },
        createdBy: input.recordedBy || 'contractor_archive_component_boundary',
      });

      // Link component to parent archive node in provenance graph
      const archiveNodeId = this.provService.computeNodeId(
        tenantId,
        'source',
        'contractor_archive',
        archiveId,
        1
      );
      await this.provService.createEdge({
        tenantId,
        fromNodeId: archiveNodeId,
        toNodeId: provenanceNode.nodeId,
        relationType: 'OBSERVED_FROM',
        createdBy: input.recordedBy || 'contractor_archive_component_boundary',
      });
    }

    return {
      componentId,
      rightsRecord,
      provenanceNode,
    };
  }

  /**
   * Deterministic Server-Authoritative Decision Boundary for Contractor Archive Use.
   * Evaluates whether an archive or archive component is eligible for a specific purpose.
   *
   * Possible reasons:
   * - allowed: Explicitly permitted (purposes[purpose] === 'allowed' and no restrictions)
   * - denied: Explicitly denied (purposes[purpose] === 'denied')
   * - unknown: Permission is 'unknown' or unrecorded (CONSERVATIVE: unknown != allowed)
   * - blocked_by_restriction: Blocked by active restriction (e.g. restrict_${purpose} or restrict_all_ai)
   * - blocked_by_tenant: Cross-tenant access attempt rejected
   * - blocked_by_status: Rights status is not active (e.g. revoked, expired, superseded)
   * - blocked_by_origin: Mixed-origin component lacks explicit clearance for external use
   */
  public async evaluateArchiveEligibility(params: {
    tenantId: string;
    archiveId: string;
    purpose: RightsPurpose;
    requestedByUid?: string;
    isAdmin?: boolean;
  }): Promise<ArchiveEligibilityResult> {
    const { tenantId, archiveId, purpose, requestedByUid, isAdmin } = params;

    // Cross-tenant defense: If requestedByUid is provided and is neither tenant owner nor admin
    if (requestedByUid && !isAdmin && requestedByUid !== tenantId) {
      return {
        eligible: false,
        reason: 'blocked_by_tenant',
        purpose,
        tenantId,
        archiveId,
        details: `Caller '${requestedByUid}' cannot evaluate archive rights belonging to tenant '${tenantId}'`,
      };
    }

    const rightsId = this.rightsService.generateRightsId(tenantId, 'contractor_archive', archiveId);
    const rights = await this.rightsService.getDataRightsRecord(rightsId);

    if (!rights) {
      return {
        eligible: false,
        reason: 'unknown',
        purpose,
        tenantId,
        archiveId,
        details: `No data rights record found for archive '${archiveId}' in tenant '${tenantId}'`,
      };
    }

    // Multi-tenant check
    if (rights.tenantId !== tenantId) {
      return {
        eligible: false,
        reason: 'blocked_by_tenant',
        purpose,
        tenantId,
        archiveId,
        rightsId: rights.rightsId,
        details: 'Tenant mismatch on stored rights record',
      };
    }

    // Status check
    if (rights.status !== 'active') {
      return {
        eligible: false,
        reason: 'blocked_by_status',
        purpose,
        tenantId,
        archiveId,
        rightsId: rights.rightsId,
        details: `Rights record status is '${rights.status}' (must be 'active')`,
      };
    }

    // Explicit restriction checks
    if (Array.isArray(rights.restrictions)) {
      const purposeRestriction = `restrict_${purpose}`;
      const allAiRestriction = 'restrict_all_ai';
      if (rights.restrictions.includes(purposeRestriction)) {
        return {
          eligible: false,
          reason: 'blocked_by_restriction',
          purpose,
          tenantId,
          archiveId,
          rightsId: rights.rightsId,
          details: `Blocked by explicit restriction '${purposeRestriction}'`,
        };
      }
      if (purpose.includes('ai') && rights.restrictions.includes(allAiRestriction)) {
        return {
          eligible: false,
          reason: 'blocked_by_restriction',
          purpose,
          tenantId,
          archiveId,
          rightsId: rights.rightsId,
          details: `Blocked by explicit restriction '${allAiRestriction}'`,
        };
      }
    }

    // Purpose permission check: unknown != allowed
    const permission = rights.purposes?.[purpose];
    if (permission === 'denied') {
      return {
        eligible: false,
        reason: 'denied',
        purpose,
        tenantId,
        archiveId,
        rightsId: rights.rightsId,
        details: `Purpose '${purpose}' is explicitly denied`,
      };
    }

    if (permission !== 'allowed') {
      return {
        eligible: false,
        reason: 'unknown',
        purpose,
        tenantId,
        archiveId,
        rightsId: rights.rightsId,
        details: `Purpose '${purpose}' permission is '${permission || 'unknown'}' (unknown != allowed)`,
      };
    }

    return {
      eligible: true,
      reason: 'allowed',
      purpose,
      tenantId,
      archiveId,
      rightsId: rights.rightsId,
      details: `Purpose '${purpose}' is explicitly authorized`,
    };
  }

  /**
   * Deterministic Server-Authoritative Decision Boundary for Mixed-Origin Archive Components.
   */
  public async evaluateComponentEligibility(params: {
    tenantId: string;
    archiveId: string;
    componentId: string;
    purpose: RightsPurpose;
    originType?: ArchiveOriginType;
    requestedByUid?: string;
    isAdmin?: boolean;
  }): Promise<ArchiveEligibilityResult> {
    const { tenantId, archiveId, componentId, purpose, originType, requestedByUid, isAdmin } = params;

    // Cross-tenant defense
    if (requestedByUid && !isAdmin && requestedByUid !== tenantId) {
      return {
        eligible: false,
        reason: 'blocked_by_tenant',
        purpose,
        tenantId,
        archiveId,
        componentId,
        originType,
        details: `Caller '${requestedByUid}' cannot evaluate component rights belonging to tenant '${tenantId}'`,
      };
    }

    const rightsId = this.rightsService.generateRightsId(
      tenantId,
      'contractor_archive_component',
      componentId
    );
    const rights = await this.rightsService.getDataRightsRecord(rightsId);

    // If component-level rights record is not found, fallback to evaluating parent archive
    if (!rights) {
      const parentResult = await this.evaluateArchiveEligibility({
        tenantId,
        archiveId,
        purpose,
        requestedByUid,
        isAdmin,
      });

      // MIXED-ORIGIN CRITICAL SAFETY RULE:
      // If component is customer_or_subject_data, third_party_data, or unknown_origin,
      // parent archive's broad permissions CANNOT grant external use!
      const effectiveOrigin = originType || 'unknown_origin';
      if (
        effectiveOrigin !== 'contractor_owned' &&
        (purpose === 'external_ai_training' ||
          purpose === 'commercial_licensing' ||
          purpose === 'third_party_sharing' ||
          purpose === 'export')
      ) {
        return {
          eligible: false,
          reason: 'blocked_by_origin',
          purpose,
          tenantId,
          archiveId,
          componentId,
          originType: effectiveOrigin,
          details: `Mixed-origin component of type '${effectiveOrigin}' cannot inherit external permissions from parent archive without explicit component-level authorization`,
        };
      }

      return {
        ...parentResult,
        componentId,
        originType: effectiveOrigin,
      };
    }

    // Component-level record checks
    if (rights.tenantId !== tenantId) {
      return {
        eligible: false,
        reason: 'blocked_by_tenant',
        purpose,
        tenantId,
        archiveId,
        componentId,
        rightsId: rights.rightsId,
        details: 'Tenant mismatch on component rights record',
      };
    }

    if (rights.status !== 'active') {
      return {
        eligible: false,
        reason: 'blocked_by_status',
        purpose,
        tenantId,
        archiveId,
        componentId,
        rightsId: rights.rightsId,
        details: `Component rights status is '${rights.status}'`,
      };
    }

    // Mixed-origin external purpose safety gate on component record:
    const effectiveOrigin = originType || (rights.owner?.type === 'contractor' ? 'contractor_owned' : 'unknown_origin');
    if (
      effectiveOrigin !== 'contractor_owned' &&
      (purpose === 'external_ai_training' ||
        purpose === 'commercial_licensing' ||
        purpose === 'third_party_sharing' ||
        purpose === 'export')
    ) {
      return {
        eligible: false,
        reason: 'blocked_by_origin',
        purpose,
        tenantId,
        archiveId,
        componentId,
        rightsId: rights.rightsId,
        originType: effectiveOrigin,
        details: `Mixed-origin component of type '${effectiveOrigin}' is blocked from external purpose '${purpose}' by origin`,
      };
    }

    if (Array.isArray(rights.restrictions)) {
      const purposeRestriction = `restrict_${purpose}`;
      const allAiRestriction = 'restrict_all_ai';
      if (rights.restrictions.includes(purposeRestriction)) {
        return {
          eligible: false,
          reason: 'blocked_by_restriction',
          purpose,
          tenantId,
          archiveId,
          componentId,
          rightsId: rights.rightsId,
          details: `Blocked by explicit restriction '${purposeRestriction}'`,
        };
      }
      if (purpose.includes('ai') && rights.restrictions.includes(allAiRestriction)) {
        return {
          eligible: false,
          reason: 'blocked_by_restriction',
          purpose,
          tenantId,
          archiveId,
          componentId,
          rightsId: rights.rightsId,
          details: `Blocked by explicit restriction '${allAiRestriction}'`,
        };
      }
    }

    const permission = rights.purposes?.[purpose];
    if (permission === 'denied') {
      return {
        eligible: false,
        reason: 'denied',
        purpose,
        tenantId,
        archiveId,
        componentId,
        rightsId: rights.rightsId,
        details: `Purpose '${purpose}' is explicitly denied on component`,
      };
    }

    if (permission !== 'allowed') {
      return {
        eligible: false,
        reason: 'unknown',
        purpose,
        tenantId,
        archiveId,
        componentId,
        rightsId: rights.rightsId,
        details: `Purpose '${purpose}' permission is '${permission || 'unknown'}' (unknown != allowed)`,
      };
    }

    return {
      eligible: true,
      reason: 'allowed',
      purpose,
      tenantId,
      archiveId,
      componentId,
      rightsId: rights.rightsId,
      originType,
      details: `Purpose '${purpose}' is explicitly authorized on component`,
    };
  }

  /**
   * Revokes rights for a contractor archive.
   * Ensures status is updated to 'revoked' and append-only history snapshot is persisted.
   */
  public async revokeArchiveRights(
    tenantId: string,
    archiveId: string,
    revocationReason: string,
    revokedBy?: string
  ): Promise<DataRightsRecord> {
    if (!tenantId || !tenantId.trim()) {
      throw new ContractorArchiveSecurityError('Invalid tenantId: tenant context is mandatory');
    }
    const rightsId = this.rightsService.generateRightsId(tenantId, 'contractor_archive', archiveId);
    return this.rightsService.updateDataRightsRecord({
      rightsId,
      tenantId,
      status: 'revoked',
      revocationReason,
      updatedBy: revokedBy || 'contractor_archive_revocation',
    });
  }
}

export const contractorArchiveRightsService = new ContractorArchiveRightsService();
