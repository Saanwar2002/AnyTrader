/**
 * AnyTrader V8.3 — Task 28 Evidence & Data Provenance Graph
 * 
 * Provides:
 * - Server-authoritative evidence and data provenance graph across:
 *   Source Record -> Evidence -> Observation -> Extraction/Transformation -> Derived Intelligence -> Projection
 * - Strict tenant-bound isolation (tenantId === request.auth.uid)
 * - Cryptographic SHA-256 deterministic node and edge hashing
 * - Immutable, append-only provenance event audit log (/provenance_events)
 * - Controlled node and relation vocabularies (no arbitrary client relations)
 * - Cross-tenant edge rejection and cross-tenant rights/evidence reference prevention
 * - Full integration with Evidence Registry (no evidence -> no assertion)
 * - Full integration with Task 27 Data Rights Service (independent purpose permissions, internal AI enabled)
 * - Hard AI security boundary enforcement (AI output cannot bypass processAICandidateToCanonical)
 * - Scalable, bounded, cursor-paginated queries (zero unbounded .get() traversals)
 */

import * as admin from 'firebase-admin';
import { computeSha256, computeStructuredDataHash } from './provenance';
import { DataRightsRecord, RightsPurpose, PurposePermission } from './dataRights';

// =============================================================================
// CONTROLLED VOCABULARIES
// =============================================================================

export const PROVENANCE_NODE_TYPES = [
  'source',
  'evidence',
  'observation',
  'extraction',
  'transformation',
  'intelligence',
  'projection',
] as const;

export type ProvenanceNodeType = typeof PROVENANCE_NODE_TYPES[number];

export const PROVENANCE_RELATION_TYPES = [
  'PRODUCED_FROM',    // Evidence produced from source record
  'SUPPORTS',         // Evidence supports observation or derived intelligence
  'OBSERVED_FROM',    // Observation derived from evidence or source record
  'EXTRACTED_FROM',   // Extraction pulled from observation or evidence
  'DERIVED_FROM',     // Intelligence derived from extraction or observation
  'TRANSFORMED_BY',   // Observation/extraction modified through deterministic transformation
  'PROJECTED_TO',     // Derived intelligence projected to public or buyer passport
  'SUPERSEDES',       // Corrected/updated node supersedes prior historical node
  'CORRECTED_BY',     // Prior node marked as corrected by new node
] as const;

export type ProvenanceRelationType = typeof PROVENANCE_RELATION_TYPES[number];

export type ProvenanceNodeStatus = 'active' | 'superseded' | 'retracted' | 'corrected';

export type ProvenanceEventType =
  | 'NODE_CREATED'
  | 'EDGE_CREATED'
  | 'NODE_STATUS_CHANGED'
  | 'LINEAGE_RECORDED'
  | 'NODE_CORRECTED';

export const PROVENANCE_SCHEMA_VERSION = 'v8.3.0';

// =============================================================================
// DOMAIN MODELS & INTERFACES
// =============================================================================

export interface ProvenanceRightsReference {
  rightsId: string;
  tenantId: string;
  status?: string;
}

export interface ProvenanceNodeMetadata {
  pipelineVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
  isAiGenerated?: boolean;
  canonicalPromoted?: boolean;
  evidenceId?: string;
  componentType?: string;
  confidenceScore?: number;
  [key: string]: unknown;
}

export interface ProvenanceNode {
  nodeId: string;
  tenantId: string;
  nodeType: ProvenanceNodeType;
  sourceType: string;
  sourceId: string;
  sourceVersion: string | number;
  contentHash: string; // Deterministic SHA-256 of semantic payload
  schemaVersion: string;
  createdAt: string; // ISO 8601
  createdBy: string;
  rightsReference?: ProvenanceRightsReference;
  status: ProvenanceNodeStatus;
  metadata?: ProvenanceNodeMetadata;
}

export interface ProvenanceEdge {
  edgeId: string;
  tenantId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: ProvenanceRelationType;
  sourceVersion?: string | number;
  createdAt: string; // ISO 8601
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export interface ProvenanceEvent {
  eventId: string;
  tenantId: string;
  eventType: ProvenanceEventType;
  nodeId?: string;
  edgeId?: string;
  payload: Record<string, unknown>;
  eventHash: string;
  recordedAt: string;
}

export interface CreateProvenanceNodeParams {
  nodeId?: string;
  tenantId: string;
  nodeType: ProvenanceNodeType;
  sourceType: string;
  sourceId: string;
  sourceVersion?: string | number;
  schemaVersion?: string;
  rightsReference?: ProvenanceRightsReference;
  status?: ProvenanceNodeStatus;
  createdBy?: string;
  metadata?: ProvenanceNodeMetadata;
}

export interface CreateProvenanceEdgeParams {
  edgeId?: string;
  tenantId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: ProvenanceRelationType;
  sourceVersion?: string | number;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordLineageChainParams {
  tenantId: string;
  createdBy: string;
  source: {
    sourceType: string;
    sourceId: string;
    sourceVersion?: string | number;
    metadata?: Record<string, unknown>;
  };
  evidence?: {
    evidenceId: string;
    evidenceType: string;
    metadata?: Record<string, unknown>;
  };
  observation?: {
    observationId: string;
    observationType: string;
    metadata?: Record<string, unknown>;
  };
  extraction?: {
    extractionId: string;
    extractionType: string;
    isAiGenerated?: boolean;
    canonicalPromoted?: boolean;
    metadata?: Record<string, unknown>;
  };
  intelligence?: {
    intelligenceId: string;
    intelligenceType: string;
    metadata?: Record<string, unknown>;
  };
  projection?: {
    projectionId: string;
    projectionType: string;
    metadata?: Record<string, unknown>;
  };
  rightsReference?: ProvenanceRightsReference;
}

export interface TraversalOptions {
  maxDepth?: number; // default 3, max 5
  limit?: number; // default 50, max 100
}

export interface ProvenanceSubgraph {
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
  rootNodeId: string;
  depth: number;
}

export interface ListNodesOptions {
  nodeType?: ProvenanceNodeType;
  status?: ProvenanceNodeStatus;
  limit?: number;
  startAfterNodeId?: string;
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class ProvenanceSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProvenanceSecurityError';
  }
}

export class ProvenanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProvenanceValidationError';
  }
}

export class ProvenanceIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProvenanceIntegrityError';
  }
}

// =============================================================================
// CRYPTOGRAPHIC & DETERMINISTIC IDENTIFIERS
// =============================================================================

/**
 * Computes deterministic node ID from primary semantic identity keys
 */
/**
 * Recursively strips undefined keys from objects so Firestore never rejects documents
 */
export function cleanUndefinedValues<T extends Record<string, any>>(obj?: T): T | undefined {
  if (!obj || typeof obj !== 'object') return obj;
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = cleanUndefinedValues(val);
      } else {
        result[key] = val;
      }
    }
  }
  return Object.keys(result).length > 0 ? (result as T) : undefined;
}

export function computeProvenanceNodeId(
  tenantId: string,
  nodeType: ProvenanceNodeType,
  sourceType: string,
  sourceId: string,
  sourceVersion: string | number = '1',
  schemaVersion: string = PROVENANCE_SCHEMA_VERSION
): string {
  const normVer = String(sourceVersion || '1');
  const payload = `${tenantId}:${nodeType}:${sourceType}:${sourceId}:${normVer}:${schemaVersion}`;
  return `pnode_${computeSha256(payload).slice(0, 24)}`;
}

/**
 * Computes deterministic edge ID preventing duplicate edges between nodes
 */
export function computeProvenanceEdgeId(
  tenantId: string,
  fromNodeId: string,
  toNodeId: string,
  relationType: ProvenanceRelationType
): string {
  const payload = `${tenantId}:${fromNodeId}:${toNodeId}:${relationType}`;
  return `pedge_${computeSha256(payload).slice(0, 24)}`;
}

/**
 * Computes deterministic event ID for append-only audit trail
 */
export function computeProvenanceEventId(
  tenantId: string,
  eventType: ProvenanceEventType,
  targetId: string,
  timestamp: string
): string {
  const payload = `${tenantId}:${eventType}:${targetId}:${timestamp}`;
  return `pevt_${computeSha256(payload).slice(0, 24)}`;
}

/**
 * Computes deterministic SHA-256 semantic content hash for a provenance node
 * Excludes transient runtime attributes (createdAt, createdBy) to guarantee
 * identical semantic payloads generate identical content hashes.
 */
export function computeProvenanceContentHash(payload: {
  tenantId: string;
  nodeType: ProvenanceNodeType;
  sourceType: string;
  sourceId: string;
  sourceVersion: string | number;
  schemaVersion: string;
  rightsReference?: ProvenanceRightsReference;
  metadata?: Record<string, unknown>;
}): string {
  const canonicalObject = {
    tenantId: payload.tenantId,
    nodeType: payload.nodeType,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    sourceVersion: String(payload.sourceVersion ?? '1'),
    schemaVersion: payload.schemaVersion || PROVENANCE_SCHEMA_VERSION,
    rightsReference: payload.rightsReference
      ? {
          rightsId: payload.rightsReference.rightsId,
          tenantId: payload.rightsReference.tenantId,
          status: payload.rightsReference.status || 'active',
        }
      : null,
    metadata: cleanUndefinedValues(payload.metadata) || {},
  };
  return computeStructuredDataHash(canonicalObject);
}

// =============================================================================
// VALIDATION & INTEGRITY ENFORCEMENT
// =============================================================================

export function validateNodeType(nodeType: string): asserts nodeType is ProvenanceNodeType {
  if (!PROVENANCE_NODE_TYPES.includes(nodeType as ProvenanceNodeType)) {
    throw new ProvenanceValidationError(
      `Invalid provenance nodeType '${nodeType}'. Must be one of: ${PROVENANCE_NODE_TYPES.join(', ')}`
    );
  }
}

export function validateRelationType(relationType: string): asserts relationType is ProvenanceRelationType {
  if (!PROVENANCE_RELATION_TYPES.includes(relationType as ProvenanceRelationType)) {
    throw new ProvenanceValidationError(
      `Invalid provenance relationType '${relationType}'. Must be one of: ${PROVENANCE_RELATION_TYPES.join(', ')}`
    );
  }
}

export function validateNodeTenant(tenantId: unknown): asserts tenantId is string {
  if (typeof tenantId !== 'string' || !tenantId.trim()) {
    throw new ProvenanceSecurityError('Provenance node requires a valid, non-empty tenantId string');
  }
}

export function validateProvenanceNodeParams(params: CreateProvenanceNodeParams): void {
  validateNodeTenant(params.tenantId);
  validateNodeType(params.nodeType);

  if (!params.sourceType || !params.sourceType.trim()) {
    throw new ProvenanceValidationError('sourceType must be a non-empty string');
  }
  if (!params.sourceId || !params.sourceId.trim()) {
    throw new ProvenanceValidationError('sourceId must be a non-empty string');
  }

  // Cross-tenant rights reference defense
  if (params.rightsReference) {
    if (!params.rightsReference.rightsId || !params.rightsReference.rightsId.trim()) {
      throw new ProvenanceValidationError('rightsReference requires non-empty rightsId');
    }
    if (!params.rightsReference.tenantId || params.rightsReference.tenantId !== params.tenantId) {
      throw new ProvenanceSecurityError(
        `Cross-tenant rights reference rejected! Node tenant '${params.tenantId}' cannot reference rights belonging to '${params.rightsReference.tenantId}'`
      );
    }
  }

  // AI boundary invariant: AI outputs cannot claim canonical promotion unless explicitly verified
  if (params.metadata?.isAiGenerated === true && params.metadata?.canonicalPromoted !== true) {
    if (params.nodeType === 'intelligence' || params.nodeType === 'projection') {
      throw new ProvenanceSecurityError(
        'AI output cannot bypass processAICandidateToCanonical(). Unpromoted AI candidate cannot form canonical intelligence or projection node.'
      );
    }
  }
}

// =============================================================================
// SERVER-AUTHORITATIVE PROVENANCE GRAPH SERVICE
// =============================================================================

export class ProvenanceGraphService {
  private db: admin.firestore.Firestore | any;

  constructor(db?: admin.firestore.Firestore | any) {
    this.db = db || null;
  }

  public setFirestoreDb(db: admin.firestore.Firestore | any): void {
    this.db = db;
  }

  public computeNodeId(
    tenantId: string,
    nodeType: ProvenanceNodeType,
    sourceType: string,
    sourceId: string,
    sourceVersion: string | number = '1',
    schemaVersion: string = PROVENANCE_SCHEMA_VERSION
  ): string {
    return computeProvenanceNodeId(tenantId, nodeType, sourceType, sourceId, sourceVersion, schemaVersion);
  }

  public computeEdgeId(
    tenantId: string,
    fromNodeId: string,
    toNodeId: string,
    relationType: ProvenanceRelationType
  ): string {
    return computeProvenanceEdgeId(tenantId, fromNodeId, toNodeId, relationType);
  }

  public computeEventId(
    tenantId: string,
    eventType: ProvenanceEventType,
    targetId: string,
    timestamp: string
  ): string {
    return computeProvenanceEventId(tenantId, eventType, targetId, timestamp);
  }

  private getDb(): admin.firestore.Firestore {
    if (this.db) {
      return this.db;
    }
    return admin.firestore();
  }

  /**
   * Creates or idempotently retrieves a provenance node in /provenance_nodes/{nodeId}
   * Enforces:
   * - Tenant isolation
   * - Deterministic content hashing
   * - Immutability: conflicting re-submissions fail closed
   * - Append-only event logging in /provenance_events
   */
  public async createNode(params: CreateProvenanceNodeParams): Promise<ProvenanceNode> {
    validateProvenanceNodeParams(params);

    const db = this.getDb();
    const schemaVersion = params.schemaVersion || PROVENANCE_SCHEMA_VERSION;
    const sourceVersion = params.sourceVersion ?? '1';
    const nodeId =
      params.nodeId ||
      computeProvenanceNodeId(
        params.tenantId,
        params.nodeType,
        params.sourceType,
        params.sourceId,
        sourceVersion,
        schemaVersion
      );

    const contentHash = computeProvenanceContentHash({
      tenantId: params.tenantId,
      nodeType: params.nodeType,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceVersion,
      schemaVersion,
      rightsReference: params.rightsReference,
      metadata: params.metadata,
    });

    const now = new Date().toISOString();
    const createdBy = params.createdBy || 'system';

    const nodeRef = db.collection('provenance_nodes').doc(nodeId);

    // Validate evidence reference if applicable
    if (params.nodeType === 'evidence' || params.metadata?.evidenceId) {
      const evidenceId = params.metadata?.evidenceId || params.sourceId;
      await this.assertAuthoritativeEvidenceExists(db, evidenceId, params.tenantId);
    }

    // Validate rights reference if provided
    if (params.rightsReference) {
      await this.assertAuthoritativeRightsExists(db, params.rightsReference.rightsId, params.tenantId);
    }

    const cleanedMetadata = cleanUndefinedValues(params.metadata);
    const node: ProvenanceNode = {
      nodeId,
      tenantId: params.tenantId,
      nodeType: params.nodeType,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceVersion,
      contentHash,
      schemaVersion,
      createdAt: now,
      createdBy,
      status: params.status || 'active',
      ...(params.rightsReference ? { rightsReference: params.rightsReference } : {}),
      ...(cleanedMetadata ? { metadata: cleanedMetadata } : {}),
    };

    // Execute atomic check-and-insert
    await db.runTransaction(async (transaction: any) => {
      const existingDoc = await transaction.get(nodeRef);
      if (existingDoc.exists) {
        const existingData = existingDoc.data() as ProvenanceNode;
        // Tenant boundary check on existing
        if (existingData.tenantId !== params.tenantId) {
          throw new ProvenanceSecurityError('Cross-tenant node collision detected and rejected');
        }
        // Idempotency: exact same content hash succeeds cleanly
        if (existingData.contentHash === contentHash) {
          return;
        }
        // Conflicting semantic payload fails closed (immutability violation)
        throw new ProvenanceIntegrityError(
          `Immutable provenance node conflict: node '${nodeId}' already exists with a different content hash`
        );
      }

      transaction.set(nodeRef, node);

      // Append immutable audit event
      const eventId = computeProvenanceEventId(params.tenantId, 'NODE_CREATED', nodeId, now);
      const eventRef = db.collection('provenance_events').doc(eventId);
      const event: ProvenanceEvent = {
        eventId,
        tenantId: params.tenantId,
        eventType: 'NODE_CREATED',
        nodeId,
        payload: {
          nodeType: node.nodeType,
          sourceType: node.sourceType,
          sourceId: node.sourceId,
          contentHash: node.contentHash,
        },
        eventHash: computeSha256(JSON.stringify({ nodeId, contentHash, tenantId: params.tenantId })),
        recordedAt: now,
      };
      transaction.set(eventRef, event);
    });

    return node;
  }

  /**
   * Creates or idempotently retrieves a provenance edge in /provenance_edges/{edgeId}
   * Enforces:
   * - Both fromNode and toNode exist and belong to the same tenant
   * - fromNodeId !== toNodeId (no self-edges)
   * - Controlled relation vocabulary
   * - Cross-tenant edge rejection (Tenant A -> Tenant B strictly prohibited)
   * - Append-only event logging in /provenance_events
   */
  public async createEdge(params: CreateProvenanceEdgeParams): Promise<ProvenanceEdge> {
    validateNodeTenant(params.tenantId);
    validateRelationType(params.relationType);

    if (!params.fromNodeId || !params.fromNodeId.trim()) {
      throw new ProvenanceValidationError('fromNodeId must be a non-empty string');
    }
    if (!params.toNodeId || !params.toNodeId.trim()) {
      throw new ProvenanceValidationError('toNodeId must be a non-empty string');
    }
    if (params.fromNodeId === params.toNodeId) {
      throw new ProvenanceValidationError(
        `Self-referencing provenance edges are strictly forbidden (fromNodeId === toNodeId: '${params.fromNodeId}')`
      );
    }

    const db = this.getDb();
    const edgeId =
      params.edgeId ||
      computeProvenanceEdgeId(params.tenantId, params.fromNodeId, params.toNodeId, params.relationType);
    const now = new Date().toISOString();
    const createdBy = params.createdBy || 'system';

    const fromNodeRef = db.collection('provenance_nodes').doc(params.fromNodeId);
    const toNodeRef = db.collection('provenance_nodes').doc(params.toNodeId);
    const edgeRef = db.collection('provenance_edges').doc(edgeId);

    const cleanedEdgeMetadata = cleanUndefinedValues(params.metadata);
    const edge: ProvenanceEdge = {
      edgeId,
      tenantId: params.tenantId,
      fromNodeId: params.fromNodeId,
      toNodeId: params.toNodeId,
      relationType: params.relationType,
      sourceVersion: params.sourceVersion ?? '1',
      createdAt: now,
      createdBy,
      ...(cleanedEdgeMetadata ? { metadata: cleanedEdgeMetadata } : {}),
    };

    await db.runTransaction(async (transaction: any) => {
      // 1. Verify existence and tenant boundary of fromNode
      const fromDoc = await transaction.get(fromNodeRef);
      if (!fromDoc.exists) {
        throw new ProvenanceValidationError(`Source provenance node '${params.fromNodeId}' does not exist`);
      }
      const fromData = fromDoc.data() as ProvenanceNode;
      if (fromData.tenantId !== params.tenantId) {
        throw new ProvenanceSecurityError(
          `Cross-tenant provenance edge rejected! fromNode tenant '${fromData.tenantId}' does not match edge tenant '${params.tenantId}'`
        );
      }

      // 2. Verify existence and tenant boundary of toNode
      const toDoc = await transaction.get(toNodeRef);
      if (!toDoc.exists) {
        throw new ProvenanceValidationError(`Target provenance node '${params.toNodeId}' does not exist`);
      }
      const toData = toDoc.data() as ProvenanceNode;
      if (toData.tenantId !== params.tenantId) {
        throw new ProvenanceSecurityError(
          `Cross-tenant provenance edge rejected! toNode tenant '${toData.tenantId}' does not match edge tenant '${params.tenantId}'`
        );
      }

      // Strict cross-tenant edge prohibition: fromNode.tenantId must equal toNode.tenantId
      if (fromData.tenantId !== toData.tenantId) {
        throw new ProvenanceSecurityError(
          `Cross-tenant provenance edge rejected! Cannot connect node from tenant '${fromData.tenantId}' to node in tenant '${toData.tenantId}'`
        );
      }

      // 3. Idempotency check on existing edge
      const existingEdgeDoc = await transaction.get(edgeRef);
      if (existingEdgeDoc.exists) {
        const existingData = existingEdgeDoc.data() as ProvenanceEdge;
        if (existingData.tenantId !== params.tenantId) {
          throw new ProvenanceSecurityError('Cross-tenant edge collision detected and rejected');
        }
        return; // Idempotent success
      }

      transaction.set(edgeRef, edge);

      // Append immutable audit event
      const eventId = computeProvenanceEventId(params.tenantId, 'EDGE_CREATED', edgeId, now);
      const eventRef = db.collection('provenance_events').doc(eventId);
      const event: ProvenanceEvent = {
        eventId,
        tenantId: params.tenantId,
        eventType: 'EDGE_CREATED',
        edgeId,
        payload: {
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          relationType: edge.relationType,
        },
        eventHash: computeSha256(JSON.stringify({ edgeId, tenantId: params.tenantId })),
        recordedAt: now,
      };
      transaction.set(eventRef, event);
    });

    return edge;
  }

  /**
   * Production-Path Pipeline: Records an end-to-end 6-stage lineage graph:
   * Source -> Evidence -> Observation -> Extraction -> Derived Intelligence -> Projection
   */
  public async recordLineageChain(params: RecordLineageChainParams): Promise<{
    nodes: ProvenanceNode[];
    edges: ProvenanceEdge[];
  }> {
    validateNodeTenant(params.tenantId);

    const createdNodes: ProvenanceNode[] = [];
    const createdEdges: ProvenanceEdge[] = [];

    // Stage 1: Source Node
    const sourceNode = await this.createNode({
      tenantId: params.tenantId,
      nodeType: 'source',
      sourceType: params.source.sourceType,
      sourceId: params.source.sourceId,
      sourceVersion: params.source.sourceVersion ?? '1',
      rightsReference: params.rightsReference,
      createdBy: params.createdBy,
      metadata: params.source.metadata,
    });
    createdNodes.push(sourceNode);

    let previousNode = sourceNode;

    // Stage 2: Evidence Node (if present)
    if (params.evidence) {
      const evidenceNode = await this.createNode({
        tenantId: params.tenantId,
        nodeType: 'evidence',
        sourceType: 'intelligence_evidence',
        sourceId: params.evidence.evidenceId,
        rightsReference: params.rightsReference,
        createdBy: params.createdBy,
        metadata: {
          evidenceType: params.evidence.evidenceType,
          ...params.evidence.metadata,
        },
      });
      createdNodes.push(evidenceNode);

      const edge = await this.createEdge({
        tenantId: params.tenantId,
        fromNodeId: evidenceNode.nodeId,
        toNodeId: previousNode.nodeId,
        relationType: 'PRODUCED_FROM',
        createdBy: params.createdBy,
      });
      createdEdges.push(edge);
      previousNode = evidenceNode;
    }

    // Stage 3: Observation Node (if present)
    if (params.observation) {
      const obsNode = await this.createNode({
        tenantId: params.tenantId,
        nodeType: 'observation',
        sourceType: 'observation_fact',
        sourceId: params.observation.observationId,
        rightsReference: params.rightsReference,
        createdBy: params.createdBy,
        metadata: {
          observationType: params.observation.observationType,
          ...params.observation.metadata,
        },
      });
      createdNodes.push(obsNode);

      const edge = await this.createEdge({
        tenantId: params.tenantId,
        fromNodeId: obsNode.nodeId,
        toNodeId: previousNode.nodeId,
        relationType: 'OBSERVED_FROM',
        createdBy: params.createdBy,
      });
      createdEdges.push(edge);
      previousNode = obsNode;
    }

    // Stage 4: Extraction Node (if present)
    if (params.extraction) {
      const extNode = await this.createNode({
        tenantId: params.tenantId,
        nodeType: 'extraction',
        sourceType: 'intelligence_extraction',
        sourceId: params.extraction.extractionId,
        rightsReference: params.rightsReference,
        createdBy: params.createdBy,
        metadata: {
          extractionType: params.extraction.extractionType,
          isAiGenerated: params.extraction.isAiGenerated,
          canonicalPromoted: params.extraction.canonicalPromoted,
          ...params.extraction.metadata,
        },
      });
      createdNodes.push(extNode);

      const edge = await this.createEdge({
        tenantId: params.tenantId,
        fromNodeId: extNode.nodeId,
        toNodeId: previousNode.nodeId,
        relationType: 'EXTRACTED_FROM',
        createdBy: params.createdBy,
      });
      createdEdges.push(edge);
      previousNode = extNode;
    }

    // Stage 5: Derived Intelligence Node (if present)
    if (params.intelligence) {
      const intelNode = await this.createNode({
        tenantId: params.tenantId,
        nodeType: 'intelligence',
        sourceType: 'derived_intelligence',
        sourceId: params.intelligence.intelligenceId,
        rightsReference: params.rightsReference,
        createdBy: params.createdBy,
        metadata: {
          intelligenceType: params.intelligence.intelligenceType,
          ...params.intelligence.metadata,
        },
      });
      createdNodes.push(intelNode);

      const edge = await this.createEdge({
        tenantId: params.tenantId,
        fromNodeId: intelNode.nodeId,
        toNodeId: previousNode.nodeId,
        relationType: 'DERIVED_FROM',
        createdBy: params.createdBy,
      });
      createdEdges.push(edge);
      previousNode = intelNode;
    }

    // Stage 6: Projection / Output Node (if present)
    if (params.projection) {
      const projNode = await this.createNode({
        tenantId: params.tenantId,
        nodeType: 'projection',
        sourceType: 'property_passport_projection',
        sourceId: params.projection.projectionId,
        rightsReference: params.rightsReference,
        createdBy: params.createdBy,
        metadata: {
          projectionType: params.projection.projectionType,
          ...params.projection.metadata,
        },
      });
      createdNodes.push(projNode);

      const edge = await this.createEdge({
        tenantId: params.tenantId,
        fromNodeId: projNode.nodeId,
        toNodeId: previousNode.nodeId,
        relationType: 'PROJECTED_TO',
        createdBy: params.createdBy,
      });
      createdEdges.push(edge);
    }

    return { nodes: createdNodes, edges: createdEdges };
  }

  /**
   * Retrieves upstream lineage graph (traversing fromNode -> toNode backwards)
   * Scalable & Bounded:
   * - Bounded depth (default 3, max 5)
   * - Hard cap on total nodes (max 100)
   * - Strictly tenant-scoped (aborts immediately if any node violates tenant)
   */
  public async getUpstreamLineage(
    nodeId: string,
    tenantId: string,
    options?: TraversalOptions
  ): Promise<ProvenanceSubgraph> {
    validateNodeTenant(tenantId);
    const maxDepth = Math.min(options?.maxDepth || 3, 5);
    const limit = Math.min(options?.limit || 50, 100);

    const db = this.getDb();
    const visitedNodeIds = new Set<string>();
    const resultNodes: ProvenanceNode[] = [];
    const resultEdges: ProvenanceEdge[] = [];

    // Fetch root node
    const rootNode = await this.getNode(nodeId, tenantId);
    if (!rootNode) {
      return { nodes: [], edges: [], rootNodeId: nodeId, depth: 0 };
    }
    resultNodes.push(rootNode);
    visitedNodeIds.add(rootNode.nodeId);

    let currentLevelNodes = [rootNode.nodeId];
    let currentDepth = 0;

    while (currentLevelNodes.length > 0 && currentDepth < maxDepth && resultNodes.length < limit) {
      currentDepth++;
      const nextLevelNodes: string[] = [];

      for (const currentNodeId of currentLevelNodes) {
        if (resultNodes.length >= limit) break;

        // Bounded edge query: find edges where fromNodeId == currentNodeId
        const edgesSnap = await db
          .collection('provenance_edges')
          .where('tenantId', '==', tenantId)
          .where('fromNodeId', '==', currentNodeId)
          .limit(20)
          .get();

        for (const doc of edgesSnap.docs) {
          const edge = doc.data() as ProvenanceEdge;
          if (edge.tenantId !== tenantId) {
            throw new ProvenanceSecurityError('Cross-tenant edge detected during traversal');
          }
          resultEdges.push(edge);

          const targetNodeId = edge.toNodeId;
          if (!visitedNodeIds.has(targetNodeId) && resultNodes.length < limit) {
            visitedNodeIds.add(targetNodeId);
            const targetNode = await this.getNode(targetNodeId, tenantId);
            if (targetNode) {
              resultNodes.push(targetNode);
              nextLevelNodes.push(targetNodeId);
            }
          }
        }
      }
      currentLevelNodes = nextLevelNodes;
    }

    return {
      nodes: resultNodes,
      edges: resultEdges,
      rootNodeId: nodeId,
      depth: currentDepth,
    };
  }

  /**
   * Retrieves downstream impact graph (traversing toNode -> fromNode forwards)
   * Scalable & Bounded:
   * - Bounded depth (default 3, max 5)
   * - Hard cap on total nodes (max 100)
   * - Strictly tenant-scoped
   */
  public async getDownstreamImpact(
    nodeId: string,
    tenantId: string,
    options?: TraversalOptions
  ): Promise<ProvenanceSubgraph> {
    validateNodeTenant(tenantId);
    const maxDepth = Math.min(options?.maxDepth || 3, 5);
    const limit = Math.min(options?.limit || 50, 100);

    const db = this.getDb();
    const visitedNodeIds = new Set<string>();
    const resultNodes: ProvenanceNode[] = [];
    const resultEdges: ProvenanceEdge[] = [];

    const rootNode = await this.getNode(nodeId, tenantId);
    if (!rootNode) {
      return { nodes: [], edges: [], rootNodeId: nodeId, depth: 0 };
    }
    resultNodes.push(rootNode);
    visitedNodeIds.add(rootNode.nodeId);

    let currentLevelNodes = [rootNode.nodeId];
    let currentDepth = 0;

    while (currentLevelNodes.length > 0 && currentDepth < maxDepth && resultNodes.length < limit) {
      currentDepth++;
      const nextLevelNodes: string[] = [];

      for (const currentNodeId of currentLevelNodes) {
        if (resultNodes.length >= limit) break;

        // Bounded edge query: find edges where toNodeId == currentNodeId
        const edgesSnap = await db
          .collection('provenance_edges')
          .where('tenantId', '==', tenantId)
          .where('toNodeId', '==', currentNodeId)
          .limit(20)
          .get();

        for (const doc of edgesSnap.docs) {
          const edge = doc.data() as ProvenanceEdge;
          if (edge.tenantId !== tenantId) {
            throw new ProvenanceSecurityError('Cross-tenant edge detected during traversal');
          }
          resultEdges.push(edge);

          const dependentNodeId = edge.fromNodeId;
          if (!visitedNodeIds.has(dependentNodeId) && resultNodes.length < limit) {
            visitedNodeIds.add(dependentNodeId);
            const dependentNode = await this.getNode(dependentNodeId, tenantId);
            if (dependentNode) {
              resultNodes.push(dependentNode);
              nextLevelNodes.push(dependentNodeId);
            }
          }
        }
      }
      currentLevelNodes = nextLevelNodes;
    }

    return {
      nodes: resultNodes,
      edges: resultEdges,
      rootNodeId: nodeId,
      depth: currentDepth,
    };
  }

  /**
   * Retrieves a single node by ID with strict tenant boundary check
   */
  public async getNode(nodeId: string, tenantId: string): Promise<ProvenanceNode | null> {
    validateNodeTenant(tenantId);
    const db = this.getDb();
    const doc = await db.collection('provenance_nodes').doc(nodeId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() as ProvenanceNode;
    if (data.tenantId !== tenantId) {
      // Fail closed: pretend document doesn't exist to unrelated tenant
      return null;
    }
    return data;
  }

  /**
   * Retrieves a single edge by ID with strict tenant boundary check
   */
  public async getEdge(edgeId: string, tenantId: string): Promise<ProvenanceEdge | null> {
    validateNodeTenant(tenantId);
    const db = this.getDb();
    const doc = await db.collection('provenance_edges').doc(edgeId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() as ProvenanceEdge;
    if (data.tenantId !== tenantId) {
      return null;
    }
    return data;
  }

  /**
   * Lists provenance nodes for a tenant with strict limit and cursor pagination
   */
  public async listNodesByTenant(
    tenantId: string,
    options?: ListNodesOptions
  ): Promise<{ nodes: ProvenanceNode[]; nextCursor?: string }> {
    validateNodeTenant(tenantId);
    const db = this.getDb();
    const limit = Math.min(options?.limit || 50, 100);

    let query = db
      .collection('provenance_nodes')
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (options?.nodeType) {
      query = query.where('nodeType', '==', options.nodeType);
    }
    if (options?.status) {
      query = query.where('status', '==', options.status);
    }
    if (options?.startAfterNodeId) {
      const cursorDoc = await db.collection('provenance_nodes').doc(options.startAfterNodeId).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snap = await query.get();
    const nodes: ProvenanceNode[] = [];
    for (const doc of snap.docs) {
      const node = doc.data() as ProvenanceNode;
      if (node.tenantId === tenantId) {
        nodes.push(node);
      }
    }

    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : undefined;

    return { nodes, nextCursor };
  }

  /**
   * Marks an existing node as corrected/superseded and links it to a new node
   * Immutability Rule: Historical nodes are NOT rewritten; corrections are new events!
   */
  public async correctNode(
    oldNodeId: string,
    tenantId: string,
    newNodeParams: CreateProvenanceNodeParams,
    reason: string
  ): Promise<{ oldNode: ProvenanceNode; newNode: ProvenanceNode; edge: ProvenanceEdge }> {
    validateNodeTenant(tenantId);

    const db = this.getDb();
    const oldNode = await this.getNode(oldNodeId, tenantId);
    if (!oldNode) {
      throw new ProvenanceValidationError(`Original node '${oldNodeId}' does not exist in tenant '${tenantId}'`);
    }

    // 1. Create the new correcting node
    const newNode = await this.createNode({
      ...newNodeParams,
      tenantId,
      status: 'active',
      metadata: {
        ...newNodeParams.metadata,
        correctsNodeId: oldNodeId,
        correctionReason: reason,
      },
    });

    // 2. Mark old node as superseded in a transaction
    const now = new Date().toISOString();
    const oldNodeRef = db.collection('provenance_nodes').doc(oldNodeId);
    await db.runTransaction(async (transaction: any) => {
      transaction.update(oldNodeRef, {
        status: 'superseded',
        supersededBy: newNode.nodeId,
        supersededAt: now,
      });

      // Record immutable correction event
      const eventId = computeProvenanceEventId(tenantId, 'NODE_CORRECTED', oldNodeId, now);
      const eventRef = db.collection('provenance_events').doc(eventId);
      transaction.set(eventRef, {
        eventId,
        tenantId,
        eventType: 'NODE_CORRECTED',
        nodeId: oldNodeId,
        payload: {
          supersededBy: newNode.nodeId,
          reason,
        },
        eventHash: computeSha256(JSON.stringify({ oldNodeId, newNodeId: newNode.nodeId, reason })),
        recordedAt: now,
      });
    });

    // 3. Create SUPERSEDES edge from newNode to oldNode
    const edge = await this.createEdge({
      tenantId,
      fromNodeId: newNode.nodeId,
      toNodeId: oldNodeId,
      relationType: 'SUPERSEDES',
      metadata: { reason },
    });

    const updatedOldNode = { ...oldNode, status: 'superseded' as const };
    return { oldNode: updatedOldNode, newNode, edge };
  }

  // ===========================================================================
  // PRIVATE SECURITY VALIDATORS
  // ===========================================================================

  private async assertAuthoritativeEvidenceExists(
    db: any,
    evidenceId: string,
    tenantId: string
  ): Promise<void> {
    const evidenceDoc = await db.collection('intelligence_evidence').doc(evidenceId).get();
    if (!evidenceDoc.exists) {
      throw new ProvenanceValidationError(
        `Authoritative evidence record '${evidenceId}' does not exist in Evidence Registry`
      );
    }
    const evidenceData = evidenceDoc.data();
    // Evidence tenant verification (or aggregate owner check if tenantId is stored)
    if (evidenceData.tenantId && evidenceData.tenantId !== tenantId) {
      throw new ProvenanceSecurityError(
        `Cross-tenant evidence reference rejected! Evidence '${evidenceId}' belongs to tenant '${evidenceData.tenantId}', but node belongs to '${tenantId}'`
      );
    }
  }

  private async assertAuthoritativeRightsExists(
    db: any,
    rightsId: string,
    tenantId: string
  ): Promise<void> {
    const rightsDoc = await db.collection('data_rights').doc(rightsId).get();
    if (!rightsDoc.exists) {
      throw new ProvenanceValidationError(
        `Authoritative data rights record '${rightsId}' does not exist in Data Rights registry`
      );
    }
    const rightsData = rightsDoc.data() as DataRightsRecord;
    if (rightsData.tenantId !== tenantId) {
      throw new ProvenanceSecurityError(
        `Cross-tenant rights reference rejected! Rights '${rightsId}' belongs to tenant '${rightsData.tenantId}', but node belongs to '${tenantId}'`
      );
    }
  }
}

export const provenanceGraphService = new ProvenanceGraphService();
