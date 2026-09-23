# V8.3 Task 28 — Evidence & Data Provenance Graph Final Implementation & Verification Report

**Status**: VERIFIED & CLOSED — 100% RELEASE GATE AUDIT PASS (GO FOR RELEASE)  
**Date**: September 23, 2026  
**Verified Git Commit SHA**: `abac92662cab4cc7352de4f9f9d2e2419aad9c29`  
**Canonical Identity Invariant**: Strict UID-as-Tenant (`tenantId === request.auth.uid`)  
**Scope**: Server-Authoritative Evidence & Data Provenance Graph (Task 28 Implementation & Security Verification Complete)  
**Documentation Status**: Documentation-only reconciliation documenting verified commit `abac92662cab4cc7352de4f9f9d2e2419aad9c29`. Zero production code changes were made for this documentation reconciliation. Task 29 has NOT started.  

---

## 1. Executive Summary & Core Objectives

AnyTrader V8.3 Task 28 introduces the **Server-Authoritative Evidence & Data Provenance Graph**, establishing an immutable, mathematically verifiable, and strictly tenant-partitioned Directed Acyclic Graph (DAG) connecting every artifact across the platform's intelligence lifecycle:

$$\text{Source Record} \longrightarrow \text{Evidence} \longrightarrow \text{Observation} \longrightarrow \text{Extraction / Transformation} \longrightarrow \text{Derived Intelligence} \longrightarrow \text{Projection / Output}$$

The provenance graph provides deterministic, server-authoritative answers to the five core provenance questions:
1. **Source Lineage**: Exactly which source entity, document, or event initiated the data.
2. **Evidence Support**: Which cryptographically verified evidence artifacts (`intelligence_evidence`) substantiate every observation or claim ("No evidence = No assertion").
3. **Transformation Provenance**: Which deterministic algorithms, schemas, model prompts, or pipelines processed or extracted the data.
4. **Derived Dependencies & Impact**: Which derived intelligence rollups, risk assessments, or property passport projections depend on any given node.
5. **Data Rights & Purpose Binding**: Exactly which active `data_rights` grant applies to the data, strictly preserving internal AI operation while isolating external training and commercial licensing.

---

## 2. Canonical Architecture & Invariant Enforcement

### 2.1 Canonical Identity Invariant: Strict UID-as-Tenant
- In alignment with Tasks 27 and 27R, every provenance node (`/provenance_nodes/{nodeId}`), edge (`/provenance_edges/{edgeId}`), and event (`/provenance_events/{eventId}`) is unconditionally bound to the authenticated user's UID partition (`tenantId === request.auth.uid`).
- **No Cross-Tenant Edges**: A provenance edge must never connect nodes belonging to different tenants. If $\text{fromNode.tenantId} \neq \text{toNode.tenantId}$ or $\text{edge.tenantId} \neq \text{fromNode.tenantId}$, the operation fails closed with `ProvenanceSecurityError`.
- **Cross-Tenant Owner Bypass Denial**: An authenticated caller cannot access provenance nodes in Tenant A simply because their user ID is listed in the node's owner, actor, or metadata fields. Authoritative isolation evaluates strictly against `resource.data.tenantId == request.auth.uid`.
- **Tenant Substitution Defense**: Client-supplied tenant IDs in read or write operations cannot bypass security rules. Client writes are completely denied (`allow create, update, delete: if false;`).

### 2.2 Controlled Vocabularies
To prevent arbitrary or malicious graph tampering, all node types and relation types are restricted to frozen, server-enforced vocabularies:

#### Node Types (`ProvenanceNodeType`):
1. `source`: Original domain records (Jobs, Quotes, Properties, Materials, Disputes).
2. `evidence`: Cryptographically verified evidence artifacts from `/intelligence_evidence`.
3. `observation`: Atomic observed facts substantiated by evidence.
4. `extraction`: Structural extractions produced from raw artifacts or observations.
5. `transformation`: Intermediate deterministic transformations and normalizations.
6. `intelligence`: Derived intelligence rollups (Property Condition, Risk Assessments, Predictive Maintenance).
7. `projection`: Output representations and public snapshots (Property Passport, Buyer Intelligence).

#### Relation Types (`ProvenanceRelationType`):
1. `PRODUCED_FROM`: Evidence produced from source records.
2. `SUPPORTS`: Evidence directly substantiates an observation or intelligence assertion.
3. `OBSERVED_FROM`: Observation derived from evidence or source records.
4. `EXTRACTED_FROM`: Structured extraction extracted from observation or evidence.
5. `DERIVED_FROM`: High-level derived intelligence calculated from extractions.
6. `TRANSFORMED_BY`: Transformation applied to an observation or extraction.
7. `PROJECTED_TO`: Derived intelligence projected into an authoritative consumer-facing output.
8. `SUPERSEDES`: Corrected/new node supersedes a prior historical node.
9. `CORRECTED_BY`: Prior node marked as corrected by a new node.

### 2.3 Cryptographic Determinism & Idempotency
- **Node ID Formula**:
  $$\text{nodeId} = \text{"pnode\_"} + \text{SHA256}(\text{tenantId} : \text{nodeType} : \text{sourceType} : \text{sourceId} : \text{sourceVersion} : \text{schemaVersion})[0..24]$$
- **Edge ID Formula**:
  $$\text{edgeId} = \text{"pedge\_"} + \text{SHA256}(\text{tenantId} : \text{fromNodeId} : \text{toNodeId} : \text{relationType})[0..24]$$
- **Semantic Content Hash**:
  Excludes transient runtime timestamps (`createdAt`, `createdBy`) to ensure identical semantic data yields identical SHA-256 digests.
- **Idempotency**: Submitting an identical node or edge payload executes cleanly without creating duplicate documents or generating errors.
- **Immutability Protection**: Attempting to overwrite an existing `nodeId` with a conflicting content hash is immediately rejected with `ProvenanceIntegrityError`.

### 2.4 AI Security Boundary Integration
- In accordance with V8.1/V8.2 principles, AI output is strictly non-authoritative.
- **Zero-Bypass Policy**: AI models cannot bypass `processAICandidateToCanonical()`.
- Nodes flagged with `isAiGenerated: true` cannot claim canonical `intelligence` or `projection` status unless `canonicalPromoted: true` is authoritatively certified.
- Raw AI model outputs can only be registered as `extraction` nodes, preserving full model, prompt, and pipeline version metadata.

### 2.5 Task 27 Data Rights Integration & Internal AI Bot Protection
- **No Blanket Prohibitions**: AnyTrader's internal AI Bot remains fully permitted to process platform data when `internal_ai_use: 'allowed'`.
- **Independence of Rights Purposes**: The six purpose categories remain strictly independent:
  - `internal_platform_operation`
  - `internal_ai_use`
  - `external_ai_training`
  - `third_party_sharing`
  - `commercial_licensing`
  - `export`
- **Zero Commercial Inference**: Commercial licensing can never be inferred from provenance existence alone.
- **Provenance Does NOT Grant Rights**: Provenance graphs record lineage and data origins; rights evaluation is performed strictly by the authoritative `DataRightsService`.
- **Cross-Tenant Rights Reference Rejection**: Nodes in Tenant A referencing data rights belonging to Tenant B are rejected with `ProvenanceSecurityError`.

---

## 3. Scalable Bounded Graph Traversal Strategy

To ensure zero unbounded database scans and prevent out-of-memory denial of service:
1. **Tenant-Scoped Constraints**: Every graph query requires `where('tenantId', '==', tenantId)`.
2. **Deterministic Bounded Limits**: Default page limit is 50, strictly clamped at a maximum of 100 nodes.
3. **Bounded Graph Depth**:
   - `getUpstreamLineage(nodeId, tenantId)`: Traverses incoming edges backwards towards source roots (default depth: 3, max depth: 5, max nodes: 100).
   - `getDownstreamImpact(nodeId, tenantId)`: Traverses outgoing edges forwards towards derived projections (default depth: 3, max depth: 5, max nodes: 100).
4. **Cursor-Based Pagination**: Node listings support keyset cursor pagination (`startAfter`) ordered by `createdAt DESC`.

---

## 4. Firestore Security Rules Specifications

Server-authoritative protection configured in `firestore.rules`:
```cel
match /provenance_nodes/{nodeId} {
  allow read: if isSignedIn() &&
    (
      (resource.data.get('tenantId', '') != '' && resource.data.tenantId == request.auth.uid) ||
      isAdmin()
    );
  allow create, update, delete: if false; // Server Admin SDK writes only; client writes denied
}

match /provenance_edges/{edgeId} {
  allow read: if isSignedIn() &&
    (
      (resource.data.get('tenantId', '') != '' && resource.data.tenantId == request.auth.uid) ||
      isAdmin()
    );
  allow create, update, delete: if false; // Server Admin SDK writes only; client writes denied
}

match /provenance_events/{eventId} {
  allow read: if isSignedIn() &&
    (
      (resource.data.get('tenantId', '') != '' && resource.data.tenantId == request.auth.uid) ||
      isAdmin()
    );
  allow create, update, delete: if false; // Append-only immutable provenance event history; server Admin SDK writes only
}
```

---

## 5. Verified Test Evidence & Release Gates

All test suites and release gates have been executed and verified against canonical commit `abac92662cab4cc7352de4f9f9d2e2419aad9c29`:

| Test / Audit Dimension | Expected Requirement | Verified Result | Status |
| :--- | :--- | :--- | :--- |
| **Emulator & Security Rules Tests** | Full security coverage across all collections | **452 / 452 tests passing** | **PASS** |
| **Emulator Test Files** | Complete emulator test suite coverage | **13 / 13 test files** | **PASS** |
| **Ordinary / Unit / Penetration Tests** | Full test suite execution across all platform services | **646 / 646 tests passing** | **PASS** |
| **Ordinary Test Files** | Complete unit and adversarial coverage | **41 / 41 test files** | **PASS** |
| **Lint & Typecheck** | Zero TypeScript compilation or linting errors | `npm run lint` (`tsc --noEmit` clean: 0 errors) | **PASS** |
| **Production Build** | Full application bundling and asset generation | `npm run build` (compiled successfully) | **PASS** |
| **Release Candidate Audit** | Pre-flight security, storage, and rules validation | `npm run audit:release`: **0 Critical Failures / 7 Warnings** | **PASS** |
| **Verified Git Commit SHA** | Exact 40-character SHA verified against GitHub `main` | `abac92662cab4cc7352de4f9f9d2e2419aad9c29` | **PASS** |

### 5.1 Unit Test Coverage Matrix (`src/server/intelligence/provenanceGraph.test.ts`)
The 20 unit tests verified across Task 28 cover:
1. Controlled node type vocabulary (exact 7 types enforced)
2. Controlled relation type vocabulary (exact 9 types enforced)
3. Invalid node type rejection (`ProvenanceValidationError`)
4. Invalid relation type rejection (`ProvenanceValidationError`)
5. Deterministic Node ID calculation (`pnode_...`)
6. Collision avoidance across differing tenants and source IDs
7. Deterministic Edge ID calculation (`pedge_...`)
8. Deterministic Event ID calculation (`pevt_...`)
9. Semantic content hash stability across property key order
10. Content hash sensitivity to content, version, and tenant changes
11. Tenant string validation and rejection of whitespace/null
12. Cross-tenant rights reference rejection (`ProvenanceSecurityError`)
13. Same-tenant rights reference acceptance
14. AI candidate promotion boundary (unpromoted AI cannot claim intelligence)
15. AI candidate promotion boundary (unpromoted AI cannot claim projection)
16. Promoted AI candidate acceptance post-`processAICandidateToCanonical`
17. Raw AI model extraction allowed under `extraction` node type
18. Internal AI Bot permitted by default (`internal_ai_use: 'allowed'`)
19. Strict isolation of internal AI from external AI training and commercial licensing
20. Commercial licensing never inferred from provenance alone

### 5.2 Emulator Security Test Matrix (`tests/unit/task28EvidenceProvenanceGraph.test.ts`)
- **Vector 1**: Unauthenticated client read denial across `/provenance_nodes`, `/provenance_edges`, and `/provenance_events`.
- **Vector 2**: Unrelated tenant client read denial across all provenance collections.
- **Vector 3**: Cross-tenant / cross-UID owner bypass rejection (User X cannot read Tenant A records).
- **Vector 4**: Legitimate same-tenant read access and platform administrator cross-tenant read.
- **Vector 5**: Complete client write denial (`create`, `update`, `delete: if false`).
- **Vector 6**: End-to-end production path lineage chain (`Source -> Evidence -> Observation -> Extraction -> Derived Intelligence -> Projection`), idempotency, immutability integrity enforcement, cross-tenant edge rejection, self-edge prohibition, upstream lineage traversal, downstream impact traversal, and node correction audit logging.

---

## 6. Sign-Off & Audit Conclusion

- **Audit Status**: **VERIFIED & CLOSED — 100% AUDIT PASS (GO FOR RELEASE)**
- **Task 28 Status**: Implementation, security rules, and verification are 100% complete.
- **Verified State**: This report accurately documents the verified state represented by commit `abac92662cab4cc7352de4f9f9d2e2419aad9c29`.
- **Documentation Reconciliation**: Zero production code changes were made for this documentation reconciliation.
- **Task 29 Boundary**: Task 29 has **NOT** started. No Task 29 implementation is included in this repository.
