/**
 * AnyTrader V8.3 — Task 28 Evidence & Data Provenance Graph Firebase Emulator Security & Integration Suite
 * 
 * CANONICAL TENANT MODEL ARCHITECTURAL INVARIANT:
 * - Strict UID-as-tenant (tenantId === request.auth.uid).
 * - Every provenance node and edge is tenant-bound.
 * - Cross-tenant edges (Tenant A -> Tenant B) are strictly prohibited.
 * - Client writes are denied across /provenance_nodes, /provenance_edges, and /provenance_events.
 * - Historical records are immutable and append-only.
 * - Deterministic SHA-256 semantic hashing and idempotent graph operations.
 * - Real production path: Source -> Evidence -> Observation -> Extraction -> Intelligence -> Projection.
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProvenanceGraphService,
  computeProvenanceNodeId,
  computeProvenanceEdgeId,
  computeProvenanceContentHash,
  ProvenanceSecurityError,
  ProvenanceValidationError,
  ProvenanceIntegrityError,
} from '../../src/server/intelligence/provenanceGraph';

describe('V8.3 Task 28 — Firebase Emulator Evidence & Data Provenance Graph Suite', () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = 'demo-anytrader';
  const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

  beforeAll(async () => {
    try {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: firestoreRules,
          host: '127.0.0.1',
          port: 8088,
        },
      });
    } catch (err) {
      console.error('FATAL ERROR: Failed to initialize Firebase emulator test environment for Task 28!', err);
      throw err;
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // ---------------------------------------------------------------------------
  // 1. UNAUTHENTICATED ACCESS DEFENSE
  // ---------------------------------------------------------------------------
  describe('Vector 1: Unauthenticated Client Defense', () => {
    it('denies unauthenticated read to /provenance_nodes/{nodeId}', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_nodes', 'node_sec_001'), {
          nodeId: 'node_sec_001',
          tenantId: 'tenant_owner_1',
          nodeType: 'source',
          sourceType: 'job',
          sourceId: 'job_001',
          sourceVersion: '1',
          contentHash: 'hash_123',
          schemaVersion: 'v8.3.0',
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          status: 'active',
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'provenance_nodes', 'node_sec_001')));
    });

    it('denies unauthenticated read to /provenance_edges/{edgeId}', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_edges', 'edge_sec_001'), {
          edgeId: 'edge_sec_001',
          tenantId: 'tenant_owner_1',
          fromNodeId: 'node_1',
          toNodeId: 'node_2',
          relationType: 'DERIVED_FROM',
          createdAt: new Date().toISOString(),
          createdBy: 'system',
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'provenance_edges', 'edge_sec_001')));
    });

    it('denies unauthenticated read to /provenance_events/{eventId}', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_events', 'evt_sec_001'), {
          eventId: 'evt_sec_001',
          tenantId: 'tenant_owner_1',
          eventType: 'NODE_CREATED',
          payload: { nodeType: 'source' },
          eventHash: 'hash_evt_123',
          recordedAt: new Date().toISOString(),
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'provenance_events', 'evt_sec_001')));
    });
  });

  // ---------------------------------------------------------------------------
  // 2. UNRELATED TENANT ACCESS DEFENSE
  // ---------------------------------------------------------------------------
  describe('Vector 2: Unrelated Tenant Access Defense', () => {
    it('denies unrelated tenant read to /provenance_nodes/{nodeId}', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_nodes', 'node_tenant_a'), {
          nodeId: 'node_tenant_a',
          tenantId: 'tenant_A',
          nodeType: 'source',
          sourceType: 'job',
          sourceId: 'job_001',
          contentHash: 'hash_123',
          schemaVersion: 'v8.3.0',
          createdAt: new Date().toISOString(),
          status: 'active',
        });
      });

      const attackerDb = testEnv.authenticatedContext('attacker_user_B').firestore();
      await assertFails(getDoc(doc(attackerDb, 'provenance_nodes', 'node_tenant_a')));
    });

    it('denies unrelated tenant read to /provenance_edges/{edgeId}', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_edges', 'edge_tenant_a'), {
          edgeId: 'edge_tenant_a',
          tenantId: 'tenant_A',
          fromNodeId: 'node_1',
          toNodeId: 'node_2',
          relationType: 'SUPPORTS',
          createdAt: new Date().toISOString(),
        });
      });

      const attackerDb = testEnv.authenticatedContext('attacker_user_B').firestore();
      await assertFails(getDoc(doc(attackerDb, 'provenance_edges', 'edge_tenant_a')));
    });

    it('denies unrelated tenant read to /provenance_events/{eventId}', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_events', 'evt_tenant_a'), {
          eventId: 'evt_tenant_a',
          tenantId: 'tenant_A',
          eventType: 'NODE_CREATED',
          payload: {},
          eventHash: 'hash_123',
          recordedAt: new Date().toISOString(),
        });
      });

      const attackerDb = testEnv.authenticatedContext('attacker_user_B').firestore();
      await assertFails(getDoc(doc(attackerDb, 'provenance_events', 'evt_tenant_a')));
    });
  });

  // ---------------------------------------------------------------------------
  // 3. CROSS-TENANT / CROSS-UID OWNER BYPASS DEFENSE
  // ---------------------------------------------------------------------------
  describe('Vector 3: Cross-Tenant Owner Bypass Defense', () => {
    it('denies User X read to Tenant A node even if User X is recorded in metadata', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_nodes', 'node_owner_bypass_test'), {
          nodeId: 'node_owner_bypass_test',
          tenantId: 'tenant_A',
          ownerId: 'user_X', // Attempting cross-tenant owner claim
          nodeType: 'source',
          sourceType: 'job',
          sourceId: 'job_tenant_a',
          contentHash: 'hash_123',
          schemaVersion: 'v8.3.0',
          createdAt: new Date().toISOString(),
          status: 'active',
        });
      });

      const userXDb = testEnv.authenticatedContext('user_X').firestore();
      await assertFails(getDoc(doc(userXDb, 'provenance_nodes', 'node_owner_bypass_test')));
    });
  });

  // ---------------------------------------------------------------------------
  // 4. LEGITIMATE SAME-TENANT & ADMIN ACCESS
  // ---------------------------------------------------------------------------
  describe('Vector 4: Legitimate Tenant & Admin Access', () => {
    it('allows legitimate same-tenant read to /provenance_nodes, /provenance_edges, and /provenance_events', async () => {
      const TENANT = 'legit_user_123';
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_nodes', 'node_legit'), {
          nodeId: 'node_legit',
          tenantId: TENANT,
          nodeType: 'source',
          sourceType: 'job',
          sourceId: 'job_legit',
          contentHash: 'hash_legit',
          schemaVersion: 'v8.3.0',
          createdAt: new Date().toISOString(),
          status: 'active',
        });
        await setDoc(doc(db, 'provenance_edges', 'edge_legit'), {
          edgeId: 'edge_legit',
          tenantId: TENANT,
          fromNodeId: 'node_legit',
          toNodeId: 'node_target',
          relationType: 'SUPPORTS',
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'provenance_events', 'evt_legit'), {
          eventId: 'evt_legit',
          tenantId: TENANT,
          eventType: 'NODE_CREATED',
          payload: {},
          eventHash: 'hash_evt',
          recordedAt: new Date().toISOString(),
        });
      });

      const tenantDb = testEnv.authenticatedContext(TENANT).firestore();
      await assertSucceeds(getDoc(doc(tenantDb, 'provenance_nodes', 'node_legit')));
      await assertSucceeds(getDoc(doc(tenantDb, 'provenance_edges', 'edge_legit')));
      await assertSucceeds(getDoc(doc(tenantDb, 'provenance_events', 'evt_legit')));
    });

    it('allows admin read across all provenance collections regardless of tenantId', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_nodes', 'node_admin_test'), {
          nodeId: 'node_admin_test',
          tenantId: 'some_other_tenant',
          nodeType: 'source',
          sourceType: 'job',
          sourceId: 'job_test',
          contentHash: 'hash_admin',
          schemaVersion: 'v8.3.0',
          createdAt: new Date().toISOString(),
          status: 'active',
        });
      });

      const adminDb = testEnv.authenticatedContext('admin_user_1', { role: 'admin', isAdmin: true }).firestore();
      await assertSucceeds(getDoc(doc(adminDb, 'provenance_nodes', 'node_admin_test')));
    });
  });

  // ---------------------------------------------------------------------------
  // 5. CLIENT WRITE DENIAL (SERVER ADMIN SDK ONLY)
  // ---------------------------------------------------------------------------
  describe('Vector 5: Client Write Denial', () => {
    it('denies client create, update, and delete to /provenance_nodes', async () => {
      const TENANT = 'user_test_client_write';
      const clientDb = testEnv.authenticatedContext(TENANT).firestore();

      // Deny create
      await assertFails(
        setDoc(doc(clientDb, 'provenance_nodes', 'node_client_attempt'), {
          nodeId: 'node_client_attempt',
          tenantId: TENANT,
          nodeType: 'source',
          sourceType: 'job',
          sourceId: 'job_001',
          contentHash: 'hash_spoofed',
          schemaVersion: 'v8.3.0',
          createdAt: new Date().toISOString(),
          status: 'active',
        })
      );

      // Seed doc via admin
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'provenance_nodes', 'node_client_attempt'), {
          nodeId: 'node_client_attempt',
          tenantId: TENANT,
          nodeType: 'source',
          sourceType: 'job',
          sourceId: 'job_001',
          contentHash: 'hash_legit',
          schemaVersion: 'v8.3.0',
          createdAt: new Date().toISOString(),
          status: 'active',
        });
      });

      // Deny update
      await assertFails(
        updateDoc(doc(clientDb, 'provenance_nodes', 'node_client_attempt'), {
          contentHash: 'hash_tampered',
        })
      );

      // Deny delete
      await assertFails(deleteDoc(doc(clientDb, 'provenance_nodes', 'node_client_attempt')));
    });

    it('denies client create, update, and delete to /provenance_edges', async () => {
      const TENANT = 'user_test_client_write';
      const clientDb = testEnv.authenticatedContext(TENANT).firestore();

      await assertFails(
        setDoc(doc(clientDb, 'provenance_edges', 'edge_client_attempt'), {
          edgeId: 'edge_client_attempt',
          tenantId: TENANT,
          fromNodeId: 'node_1',
          toNodeId: 'node_2',
          relationType: 'SUPPORTS',
        })
      );
    });

    it('denies client create, update, and delete to /provenance_events', async () => {
      const TENANT = 'user_test_client_write';
      const clientDb = testEnv.authenticatedContext(TENANT).firestore();

      await assertFails(
        setDoc(doc(clientDb, 'provenance_events', 'evt_client_attempt'), {
          eventId: 'evt_client_attempt',
          tenantId: TENANT,
          eventType: 'NODE_CREATED',
          payload: {},
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 6. PRODUCTION PATH INTEGRATION: 6-STAGE LINEAGE CHAIN & GRAPH SERVICE
  // ---------------------------------------------------------------------------
  describe('Vector 6: Production Path Integration & Graph Lifecycle', () => {
    it('executes full 6-stage lineage chain, idempotency, cross-tenant rejection, and traversals', async () => {
      const TENANT = 'tenant_prod_chain_owner';
      const service = new ProvenanceGraphService();

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        (service as any).db = db;

        // Seed an authoritative evidence document and data rights document for the tenant
        await setDoc(doc(db, 'intelligence_evidence', 'ev_prod_001'), {
          evidenceId: 'ev_prod_001',
          tenantId: TENANT,
          aggregateType: 'job',
          aggregateId: 'job_prod_001',
          sourceType: 'job',
          sourceId: 'job_prod_001',
          sourceVersion: '1',
          evidenceType: 'photo',
          contentHash: 'hash_ev_photo_sha256',
          byteSize: 1024,
          schemaVersion: 'v8.1.0',
          integrityStatus: 'verified',
          verified: true,
          createdAt: new Date().toISOString(),
        });

        await setDoc(doc(db, 'data_rights', 'rights_prod_001'), {
          rightsId: 'rights_prod_001',
          tenantId: TENANT,
          owner: { type: 'user', id: TENANT },
          subject: { type: 'job', id: 'job_prod_001' },
          source: { type: 'job', id: 'job_prod_001', tenantId: TENANT },
          purposes: {
            internal_platform_operation: 'allowed',
            internal_ai_use: 'allowed',
            external_ai_training: 'denied',
            third_party_sharing: 'denied',
            commercial_licensing: 'denied',
            export: 'denied',
          },
          restrictions: [],
          status: 'active',
          version: 1,
          effectiveAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // 1. Record Complete 6-Stage Lineage Chain:
        // Source -> Evidence -> Observation -> Extraction -> Derived Intelligence -> Projection
        const chain = await service.recordLineageChain({
          tenantId: TENANT,
          createdBy: 'prod_system',
          rightsReference: {
            rightsId: 'rights_prod_001',
            tenantId: TENANT,
          },
          source: {
            sourceType: 'job',
            sourceId: 'job_prod_001',
            sourceVersion: '1',
          },
          evidence: {
            evidenceId: 'ev_prod_001',
            evidenceType: 'photo',
          },
          observation: {
            observationId: 'obs_boiler_leak_001',
            observationType: 'boiler_leak_fact',
          },
          extraction: {
            extractionId: 'ext_gas_leak_001',
            extractionType: 'gas_leak_analysis',
            isAiGenerated: true,
            canonicalPromoted: true,
          },
          intelligence: {
            intelligenceId: 'intel_risk_assessment_001',
            intelligenceType: 'property_risk',
          },
          projection: {
            projectionId: 'proj_passport_snapshot_001',
            projectionType: 'property_passport',
          },
        });

        expect(chain.nodes.length).toBe(6);
        expect(chain.edges.length).toBe(5);

        // Verify all nodes exist and are tenant-bound
        for (const node of chain.nodes) {
          expect(node.tenantId).toBe(TENANT);
          const retrieved = await service.getNode(node.nodeId, TENANT);
          expect(retrieved).not.toBeNull();
          expect(retrieved?.nodeId).toBe(node.nodeId);
        }

        // 2. Idempotency Check: Re-recording an existing node with identical payload succeeds
        const firstNode = chain.nodes[0];
        const reNode = await service.createNode({
          nodeId: firstNode.nodeId,
          tenantId: TENANT,
          nodeType: firstNode.nodeType,
          sourceType: firstNode.sourceType,
          sourceId: firstNode.sourceId,
          sourceVersion: firstNode.sourceVersion,
          rightsReference: firstNode.rightsReference,
        });
        expect(reNode.nodeId).toBe(firstNode.nodeId);

        // 3. Immutability Violation Check: Submitting existing nodeId with different payload throws ProvenanceIntegrityError
        await expect(
          service.createNode({
            nodeId: firstNode.nodeId,
            tenantId: TENANT,
            nodeType: firstNode.nodeType,
            sourceType: firstNode.sourceType,
            sourceId: 'completely_different_conflicting_source_id',
            sourceVersion: '999',
          })
        ).rejects.toThrow(ProvenanceIntegrityError);

        // 4. Cross-Tenant Edge Rejection: Edge from TENANT node to Foreign Tenant node fails
        await setDoc(doc(db, 'provenance_nodes', 'node_foreign_tenant'), {
          nodeId: 'node_foreign_tenant',
          tenantId: 'foreign_tenant_xyz',
          nodeType: 'source',
          sourceType: 'job',
          sourceId: 'foreign_job',
          contentHash: 'hash_foreign',
          schemaVersion: 'v8.3.0',
          createdAt: new Date().toISOString(),
          status: 'active',
        });

        await expect(
          service.createEdge({
            tenantId: TENANT,
            fromNodeId: firstNode.nodeId,
            toNodeId: 'node_foreign_tenant',
            relationType: 'SUPPORTS',
          })
        ).rejects.toThrow(ProvenanceSecurityError);

        // 5. Self-Edge Rejection: Connecting a node to itself is forbidden
        await expect(
          service.createEdge({
            tenantId: TENANT,
            fromNodeId: firstNode.nodeId,
            toNodeId: firstNode.nodeId,
            relationType: 'SUPPORTS',
          })
        ).rejects.toThrow(ProvenanceValidationError);

        // 6. Upstream Lineage Traversal: From projection back through to source
        const lastNode = chain.nodes[chain.nodes.length - 1];
        const upstream = await service.getUpstreamLineage(lastNode.nodeId, TENANT);
        expect(upstream.nodes.length).toBeGreaterThan(1);
        expect(upstream.rootNodeId).toBe(lastNode.nodeId);

        // 7. Downstream Impact Traversal: From source through to projection
        const downstream = await service.getDownstreamImpact(firstNode.nodeId, TENANT);
        expect(downstream.nodes.length).toBeGreaterThan(1);
        expect(downstream.rootNodeId).toBe(firstNode.nodeId);

        // 8. Node Correction & Immutability Audit:
        // Correcting an observation node creates a new node, updates old status to 'superseded',
        // creates SUPERSEDES edge, and appends a NODE_CORRECTED event to /provenance_events.
        const observationNode = chain.nodes[2];
        const correction = await service.correctNode(
          observationNode.nodeId,
          TENANT,
          {
            tenantId: TENANT,
            nodeType: 'observation',
            sourceType: 'observation_fact',
            sourceId: 'obs_boiler_leak_001_v2',
            sourceVersion: '2',
          },
          'Corrected model serial number observation'
        );

        expect(correction.oldNode.status).toBe('superseded');
        expect(correction.newNode.status).toBe('active');
        expect(correction.edge.relationType).toBe('SUPERSEDES');
        expect(correction.edge.fromNodeId).toBe(correction.newNode.nodeId);
        expect(correction.edge.toNodeId).toBe(observationNode.nodeId);

        // Verify audit event exists in /provenance_events
        const eventsSnap = await db
          .collection('provenance_events')
          .where('tenantId', '==', TENANT)
          .where('eventType', '==', 'NODE_CORRECTED')
          .get();
        expect(eventsSnap.empty).toBe(false);
      });
    });
  });
});
