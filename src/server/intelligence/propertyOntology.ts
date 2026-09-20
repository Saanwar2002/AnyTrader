/**
 * AnyTrader V8.2 — Property Evidence & Component Ontology
 * 
 * Provides:
 * - Deterministic, type-safe Property Component Ontology
 * - Controlled Property Component Vocabulary & Normalization
 * - Property Component Evidence Records with Lineage & Provenance Anchoring
 * - Server-authoritative lineage checks (Job -> Property -> Component -> Evidence)
 * - AI Output Security Boundary Enforcement (AI output != Authoritative Fact)
 * - Fail-closed validation for cross-property & cross-tenant isolation
 */

import { COMPONENT_ALIASES, normalizeComponentCode, sanitizeTerm } from './canonicalVocabulary';
import { resolveAuthoritativeJobPropertyId } from './jobIntelligence';
import { computeSha256 } from './provenance';
import { getGlobalIntelligenceDb } from './immutableStore';
import { cleanUndefinedFields } from './evidence';

// ----------------------------------------------------
// 1. Property Component Types & Vocabulary
// ----------------------------------------------------

export const PROPERTY_COMPONENT_TYPES = [
  'roof',
  'roofing_material',
  'roof_structure',
  'gutters',
  'hvac',
  'electrical',
  'plumbing',
  'windows',
  'doors',
  'exterior',
  'interior',
  'foundation',
  'drainage',
  'boiler',
  'electrical_panel',
  'pipe',
  'radiator',
  'wall',
  'floor',
  'chimney',
  'other',
] as const;

export type PropertyComponentType = typeof PROPERTY_COMPONENT_TYPES[number];

export type EvidenceStatus = 'derived' | 'unverified' | 'verified' | 'rejected';

/**
 * Type guard for PropertyComponentType
 */
export function isPropertyComponentType(value: unknown): value is PropertyComponentType {
  if (typeof value !== 'string') return false;
  return (PROPERTY_COMPONENT_TYPES as readonly string[]).includes(value as PropertyComponentType);
}

/**
 * Normalizes raw input strings into supported PropertyComponentTypes.
 * Uses canonical vocabulary aliases or defaults to 'other'.
 */
export function normalizeComponentType(value: unknown): PropertyComponentType {
  if (!value || typeof value !== 'string') return 'other';
  const rawStr = value.trim();
  if (isPropertyComponentType(rawStr)) return rawStr as PropertyComponentType;

  // Try vocabulary alias normalization
  const normCode = normalizeComponentCode(rawStr);
  if (normCode && isPropertyComponentType(normCode)) {
    return normCode as PropertyComponentType;
  }

  // Common synonym mappings for Task 19 requirements
  const lower = sanitizeTerm(rawStr);
  if (lower.includes('roof_material') || lower.includes('shingle') || lower.includes('tile') || lower.includes('slate')) {
    return 'roofing_material';
  }
  if (lower.includes('roof_truss') || lower.includes('rafter') || lower.includes('roof_frame')) {
    return 'roof_structure';
  }
  if (lower.includes('gutter') || lower.includes('downpipe') || lower.includes('fascia')) {
    return 'gutters';
  }
  if (lower.includes('window') || lower.includes('glazing')) {
    return 'windows';
  }
  if (lower.includes('door') || lower.includes('entrance') || lower.includes('fire_door')) {
    return 'doors';
  }
  if (lower.includes('exterior') || lower.includes('facade') || lower.includes('render')) {
    return 'exterior';
  }
  if (lower.includes('interior') || lower.includes('plaster') || lower.includes('drywall')) {
    return 'interior';
  }
  if (lower.includes('wire') || lower.includes('fuse') || lower.includes('consumer_unit') || lower.includes('socket')) {
    return 'electrical';
  }
  if (lower.includes('plumb') || lower.includes('pipe') || lower.includes('leak') || lower.includes('tap')) {
    return 'plumbing';
  }
  if (lower.includes('drain') || lower.includes('sewer') || lower.includes('manhole')) {
    return 'drainage';
  }
  if (lower.includes('heat') || lower.includes('boiler') || lower.includes('ac') || lower.includes('vent')) {
    return 'hvac';
  }

  return 'other';
}

/**
 * Validates component type, throwing a fail-closed Error if value cannot be normalized or is empty.
 */
export function validateComponentType(value: unknown): PropertyComponentType {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('[PropertyOntology Error] Component type must be a non-empty string');
  }
  const normalized = normalizeComponentType(value);
  if (!isPropertyComponentType(normalized)) {
    throw new Error(`[PropertyOntology Error] Unsupported component type '${value}'`);
  }
  return normalized;
}

// ----------------------------------------------------
// 2. Data Models & Interfaces
// ----------------------------------------------------

export interface ComponentEvidenceProvenance {
  origin: string;              // e.g. 'job_extraction', 'property_rollup', 'inspection_record', 'manual_verification'
  sourceId?: string;
  sourceVersion?: string | number;
  tenantId?: string;
  pipelineVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
}

export interface PropertyComponentEvidence {
  evidenceId: string;
  propertyId: string;
  componentType: PropertyComponentType;

  sourceType: string;          // e.g. 'job', 'inspection', 'user_statement', 'system_record'
  sourceJobId?: string;

  provenance: ComponentEvidenceProvenance;

  status: EvidenceStatus;

  observedAt?: string;
  createdAt: string;

  confidence?: number;         // Validated 0.0 to 1.0

  contentHash: string;         // SHA-256 deterministic hash
  metadata?: Record<string, unknown>;
}

export interface PropertyComponent {
  componentId: string;         // e.g. `comp_${propertyId}_${componentType}`
  propertyId: string;
  componentType: PropertyComponentType;
  displayName: string;
  category?: string;
  description?: string;
  status: 'active' | 'archived' | 'degraded' | 'replaced';
  evidenceIds: string[];
  lastObservedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterComponentEvidenceInput {
  propertyId: string;
  componentType: string;
  sourceType: string;
  sourceJobId?: string;
  provenance: ComponentEvidenceProvenance;
  status?: EvidenceStatus;
  observedAt?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------
// 3. Helper Functions
// ----------------------------------------------------

export function validateEvidenceConfidence(confidence?: unknown): number | undefined {
  if (confidence === undefined || confidence === null) return undefined;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    throw new Error(`[PropertyOntology Error] Confidence must be a finite number between 0.0 and 1.0, received '${confidence}'`);
  }
  if (confidence < 0.0 || confidence > 1.0) {
    throw new Error(`[PropertyOntology Error] Confidence out of range [0.0, 1.0]: ${confidence}`);
  }
  return confidence;
}

export function computeComponentEvidenceHash(input: {
  propertyId: string;
  componentType: string;
  sourceType: string;
  sourceJobId?: string;
  origin: string;
  metadata?: Record<string, unknown>;
}): string {
  const canonicalString = JSON.stringify({
    propertyId: input.propertyId,
    componentType: normalizeComponentType(input.componentType),
    sourceType: input.sourceType,
    sourceJobId: input.sourceJobId || '',
    origin: input.origin,
    metadata: input.metadata || {},
  });
  return computeSha256(canonicalString);
}

// ----------------------------------------------------
// 4. Property Ontology Service
// ----------------------------------------------------

export class PropertyOntologyService {
  private defaultDb?: any;

  constructor(options?: { firestoreDb?: any }) {
    if (options?.firestoreDb) {
      this.defaultDb = options.firestoreDb;
    }
  }

  public setFirestoreDb(db: any): void {
    this.defaultDb = db;
  }

  /**
   * Registers a new component evidence record for a property with strict, fail-closed server checks.
   */
  public async registerComponentEvidence(
    input: RegisterComponentEvidenceInput,
    options?: { firestoreDb?: any; isVerifiedServerAction?: boolean }
  ): Promise<PropertyComponentEvidence> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();

    // 1. Basic Parameter Validation
    if (!input.propertyId || typeof input.propertyId !== 'string' || input.propertyId.trim().length === 0) {
      throw new Error('[PropertyOntology Error] Valid propertyId is required');
    }
    if (!input.provenance || !input.provenance.origin) {
      throw new Error('[PropertyOntology Error] Valid provenance with origin is required');
    }

    const componentType = validateComponentType(input.componentType);
    const confidence = validateEvidenceConfidence(input.confidence);

    // 2. Server-Authoritative Lineage Validation for Job-Linked Evidence
    if (input.sourceJobId || input.sourceType === 'job') {
      if (!input.sourceJobId) {
        throw new Error('[Lineage Resolution Error] sourceJobId is required when sourceType is job');
      }
      if (!activeDb) {
        throw new Error('[Lineage Resolution Error] Firestore database reference required for authoritative job property resolution');
      }

      // Call authoritative resolver from jobIntelligence.ts
      const authoritativeJobPropertyId = await resolveAuthoritativeJobPropertyId(activeDb, input.sourceJobId);

      // Verify that target property matches authoritative job property
      if (authoritativeJobPropertyId !== input.propertyId) {
        throw new Error(
          `[PropertyLineage Violation] Source job '${input.sourceJobId}' belongs to property '${authoritativeJobPropertyId}', which does not match target property '${input.propertyId}'. Cross-property evidence attachment rejected.`
        );
      }
    }

    // 3. AI Security Boundary & Non-Promotion Check
    // AI proposals (e.g. model candidates, extraction pipelines, copilots) cannot self-promote to 'verified'
    const isAiOrigin =
      input.provenance.origin.includes('ai') ||
      input.provenance.origin.includes('extraction') ||
      input.provenance.origin.includes('rollup') ||
      input.provenance.origin.includes('copilot') ||
      input.provenance.origin.includes('model');

    let finalStatus: EvidenceStatus = input.status || 'derived';

    if (finalStatus === 'verified' && isAiOrigin && !options?.isVerifiedServerAction) {
      throw new Error(
        `[AIPrivilegeEscalation Violation] AI-derived content from origin '${input.provenance.origin}' cannot directly set status 'verified'. Must be verified via explicit human/server authorization.`
      );
    }

    // 4. Authoritative Property Existence & Cross-Tenant Isolation Check
    if (activeDb) {
      const propDoc = await activeDb.collection('properties').doc(input.propertyId).get();
      if (!propDoc || !propDoc.exists) {
        throw new Error(
          `[PropertyLineage Violation] Property '${input.propertyId}' does not exist`
        );
      }
      const propData = typeof propDoc.data === 'function' ? propDoc.data() : propDoc.data;
      const authoritativeTenant = propData?.tenantId ?? propData?.landlordId ?? propData?.ownerId;

      if (input.provenance.tenantId && authoritativeTenant && input.provenance.tenantId !== authoritativeTenant) {
        throw new Error(
          `[CrossTenantContamination Violation] Tenant '${input.provenance.tenantId}' does not match property owner/tenant '${authoritativeTenant}'.`
        );
      }
    }

    // 5. Deterministic Content Hash & Evidence Identity
    const contentHash = computeComponentEvidenceHash({
      propertyId: input.propertyId,
      componentType,
      sourceType: input.sourceType,
      sourceJobId: input.sourceJobId,
      origin: input.provenance.origin,
      metadata: input.metadata,
    });

    const evidenceId = `ev_comp_${input.propertyId}_${componentType}_${contentHash.slice(0, 12)}`;
    const now = new Date().toISOString();

    const record: PropertyComponentEvidence = {
      evidenceId,
      propertyId: input.propertyId,
      componentType,
      sourceType: input.sourceType,
      sourceJobId: input.sourceJobId,
      provenance: input.provenance,
      status: finalStatus,
      observedAt: input.observedAt || now,
      createdAt: now,
      confidence,
      contentHash,
      metadata: input.metadata || {},
    };

    // 6. Persistence to Immutable Evidence Store
    if (activeDb) {
      const payload = cleanUndefinedFields({
        ...record,
        aggregateType: 'property',
        aggregateId: input.propertyId,
        sourceId: input.sourceJobId || `properties/${input.propertyId}`,
        sourceVersion: input.provenance?.sourceVersion ? String(input.provenance.sourceVersion) : '1',
        evidenceType: 'structured_record',
        byteSize: Buffer.byteLength(JSON.stringify(input.metadata || {})),
        schemaVersion: 'v8.1.0',
        integrityStatus: record.status === 'verified' ? 'verified' : 'unverified',
        verified: record.status === 'verified',
        sourceRef: input.sourceJobId ? `jobs/${input.sourceJobId}` : `properties/${input.propertyId}`,
        updatedAt: now,
      });

      await activeDb.collection('intelligence_evidence').doc(evidenceId).set(payload);
    }

    return record;
  }

  /**
   * Fetches component evidence for a given property and component type.
   */
  public async getEvidenceForComponent(
    propertyId: string,
    componentType: string,
    db?: any
  ): Promise<PropertyComponentEvidence[]> {
    const activeDb = db || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) return [];

    const normType = normalizeComponentType(componentType);
    const snap = await activeDb
      .collection('intelligence_evidence')
      .where('propertyId', '==', propertyId)
      .where('componentType', '==', normType)
      .get();

    if (!snap || snap.empty) return [];

    const docs = typeof snap.docs !== 'undefined' ? snap.docs : [];
    return docs.map((doc: any) => {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      return {
        evidenceId: doc.id || data.evidenceId,
        ...data,
      };
    });
  }
}

export const propertyOntologyService = new PropertyOntologyService();
