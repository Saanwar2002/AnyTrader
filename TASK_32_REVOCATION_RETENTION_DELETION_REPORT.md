# V8.3 Task 32 / 32R: Revocation, Retention & Deletion Report

---

## 1. Task 32 / 32R Objective

The objective of **Task 32** and **Task 32R** is to implement and security-harden the server-authoritative **Revocation, Retention & Deletion Boundary** on top of the verified Task 27–31 architecture.

The boundary strictly enforces:
1. **REVOCATION != DELETION**: Revocation immediately fails authorization closed, while deletion separately evaluates retention policies, legal holds, downstream dependencies, and immutable audit requirements.
2. **Server-Authoritative Deletion Target (Remediation A)**:
   - Client callers CANNOT select or influence the physical Firestore collection target (`targetCollection` removed from client API).
   - Server-side resolution (`resolveAuthoritativeCollection`) strictly maps validated record types to canonical collections (e.g. `property` -> `properties`, `job` -> `jobs`, `temporary_upload` -> `temporary_files`). Unknown record types fail closed with `DataRetentionValidationError`.
3. **Privileged Legal Hold Boundary (Remediation B)**:
   - Server-authoritative legal holds block physical erasure (`blocked_by_legal_hold`).
   - Ordinary users CANNOT create, modify, or remove legal holds via policy registration (`legalHold` input rejected with 403 / `DataRetentionSecurityError`).
   - Existing legal holds are strictly preserved across standard policy updates.
   - Legal holds can only be applied or removed via dedicated privileged admin endpoint (`POST /api/intelligence/data-lifecycle/policy/:policyId/legal-hold` guarded by `requireAdmin`).
4. **Unknown Policy Fails Closed**: Missing or undefined retention policies return `blocked_by_unknown_policy` (`unknown != allowed to delete`).
5. **Dependency-Aware Erasure**: Records with active downstream dependencies (Data Rights, Provenance Nodes, Classifications, AI Controls) are blocked from physical erasure until dependencies are resolved.
6. **Immutable Audit Preservation**: Physical erasure of current projection records never destroys append-only immutable history (`data_rights_history`, `provenance_events`, `ai_usage_controls_history`, `ai_usage_decisions`, `data_lifecycle_events`).
7. **Zero Raw PII in Retained Audit**: Retained deletion lifecycle events record only non-PII operational and cryptographic metadata.
8. **Deterministic Idempotency**: Repeated deletion requests return the completed state without duplicate side-effects.
9. **Strict UID-as-Tenant Boundary**: Cross-tenant revocation, retention policy reads/mutations, or deletion processing fail closed with `DataRetentionSecurityError`.

---

## 2. Architecture & Service Ecosystem

Task 32/32R orchestrates lifecycle policy across the verified Task 27–31 canonical services without introducing duplicate engines:
- **`DataRetentionService`** (`src/server/intelligence/dataRetention.ts`):
  - Canonical orchestration engine for retention policies, privileged legal holds, dependency discovery, server-authoritative deletion targets, multi-service revocation, deletion requests, and physical erasure.
- **`DataRightsService`** (`src/server/intelligence/dataRights.ts`):
  - Reused for rights status transitions to `revoked` and append-only `data_rights_history` recording.
- **`ProvenanceGraphService`** (`src/server/intelligence/provenanceGraph.ts`):
  - Reused for provenance node status transitions to `retracted` and immutable `provenance_events` recording.
- **`ContractorArchiveRightsService`** (`src/server/intelligence/contractorArchiveRights.ts`):
  - Reused for contractor archive boundaries.
- **`DataClassificationEligibilityService`** (`src/server/intelligence/dataClassificationEligibility.ts`):
  - Reused for category and sensitivity level boundaries.
- **`AiTrainingUsageControlsService`** (`src/server/intelligence/aiTrainingUsageControls.ts`):
  - Reused for AI control status transitions to `revoked` and immutable `ai_usage_controls_history` recording.

---

## 3. Services & Files Changed

| File | Change Description |
| :--- | :--- |
| `src/server/intelligence/dataRetention.ts` | **Created & Hardened**. Canonical `DataRetentionService` implementing retention policies, server-authoritative deletion target mapping (`resolveAuthoritativeCollection`), legal hold preservation, dependency evaluation, multi-service revocation, deletion state machines, and immutable lifecycle events. |
| `src/server/intelligence/dataRetention.test.ts` | **Created & Hardened**. Unit test suite covering hashing, policy evaluation, legal hold preservation, dependency blocking, revocation orchestration, state machine transitions, server-authoritative collection mapping, and idempotency (14/14 passing). |
| `tests/unit/task32DataRetentionDeletion.test.ts` | **Created & Hardened**. Real Firebase emulator security test suite covering Firestore security rules, cross-tenant isolation, immediate revocation fail-closed, legal holds, server-authoritative collection mapping, dependency resolution, and immutable audit preservation. |
| `src/server/intelligence/index.ts` | **Updated**. Exported `dataRetention` types, error classes, and `DataRetentionService` from the intelligence barrel. |
| `server.ts` | **Updated & Hardened**. Registered server-authoritative API routes under `/api/intelligence/data-lifecycle/*`, enforced privileged admin checks on `legalHold` modification, added dedicated `POST /api/intelligence/data-lifecycle/policy/:policyId/legal-hold`, and removed client `targetCollection` parameter. |
| `firestore.rules` | **Updated**. Added strict tenant-bound rules and client write denial (`allow create, update, delete: if false;`) for `/data_retention_policies/{id}`, `/data_deletion_requests/{id}`, and `/data_lifecycle_events/{id}`. |
| `firebase-blueprint.json` | **Updated**. Added entity and path schema definitions for Task 32 collections. |
| `package.json` | **Updated**. Added Task 32 test script exclusions and emulator test targets. |
| `DEVELOPMENT.md` | **Updated**. Documented Task 32/32R architecture, lifecycle states, retention policy model, legal hold, deletion rules, and verification evidence. |

---

## 4. Collections & Firestore Security Rules

| Collection | Path | Read Rule | Write Rule |
| :--- | :--- | :--- | :--- |
| **Retention Policies** | `/data_retention_policies/{policyId}` | `isSignedIn() && (resource.data.tenantId == request.auth.uid \|\| isAdmin())` | `allow create, update, delete: if false;` |
| **Deletion Requests** | `/data_deletion_requests/{requestId}` | `isSignedIn() && (resource.data.tenantId == request.auth.uid \|\| isAdmin())` | `allow create, update, delete: if false;` |
| **Lifecycle Events** | `/data_lifecycle_events/{eventId}` | `isSignedIn() && (resource.data.tenantId == request.auth.uid \|\| isAdmin())` | `allow create, update, delete: if false;` |

---

## 5. Lifecycle State Machine & Decision Logic

```
                    ┌─────────────────────────┐
                    │   requestDeletion()     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  evaluateRetention()    │
                    └────────────┬────────────┘
                                 │
               ┌─────────────────┴─────────────────┐
               ▼                                   ▼
      [Eligibility Gate Passed]           [Gate Failed / Blocked]
               │                                   │
               ▼                                   ▼
    ┌─────────────────────┐             ┌─────────────────────┐
    │  status: 'approved' │             │  status: 'blocked'  │
    └──────────┬──────────┘             └─────────────────────┘
               │
    ┌──────────▼──────────┐
    │  processDeletion()  │ (Server resolves authoritative collection)
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │ status: 'processing'│
    └──────────┬──────────┘
               │
               ├─► Revoke Data Rights (`DataRightsService.updateDataRightsRecord`)
               ├─► Revoke AI Controls (`AiTrainingUsageControlsService.revokeAiUsageControls`)
               ├─► Retract Provenance Nodes (`ProvenanceGraphService.updateNodeStatus`)
               ├─► Erase Target Current Document Projection from Authoritative Collection
               ├─► Preserve Immutable Audit History (`data_rights_history`, `provenance_events`, etc.)
               └─► Record Non-PII Event (`data_lifecycle_events`)
               │
    ┌──────────▼──────────┐
    │ status: 'completed' │
    └─────────────────────┘
```

---

## 6. Server API Surface

All API endpoints derive tenant ownership strictly from the verified JWT token (`user.uid`), completely rejecting client-supplied tenant overrides:
- `POST /api/intelligence/data-lifecycle/policy/register`: Registers/updates server-authoritative retention policy (legal hold creation/modification blocked for non-admin callers with 403).
- `POST /api/intelligence/data-lifecycle/policy/:policyId/legal-hold`: Dedicated privileged endpoint for applying or removing legal holds (`requireAdmin`).
- `GET /api/intelligence/data-lifecycle/policy/:policyId`: Retrieves tenant-owned retention policy.
- `POST /api/intelligence/data-lifecycle/revoke`: Multi-service rights/AI/provenance revocation orchestration.
- `POST /api/intelligence/data-lifecycle/deletion-request`: Submits deterministic deletion request and evaluates eligibility.
- `POST /api/intelligence/data-lifecycle/process-deletion`: Executes server-authoritative physical erasure and logs non-PII audit events (no client `targetCollection`).
- `GET /api/intelligence/data-lifecycle/:requestId`: Retrieves deletion request state for authorized tenant.

---

## 7. Adversarial Test Matrix

| Test Suite | Vectors Covered | Result |
| :--- | :--- | :--- |
| **`src/server/intelligence/dataRetention.test.ts`** | - Deterministic IDs & SHA-256 event hashing<br>- Missing policy fails closed (`blocked_by_unknown_policy`)<br>- Policy registration & versioning<br>- Active retention period blocking<br>- Legal hold blocking<br>- Expired retention eligibility<br>- Active Data Rights dependency blocking<br>- Rights revocation orchestration<br>- Full end-to-end deletion lifecycle<br>- Unmapped record type fails closed during erasure (`DataRetentionValidationError`)<br>- Legal hold preservation across standard policy updates<br>- Idempotent processing<br>- Cross-tenant request & processing rejection | **PASS (14/14 tests passing)** |
| **`tests/unit/task32DataRetentionDeletion.test.ts`** | - Deterministic policyId, requestId, and eventId generation<br>- SHA-256 event hash integrity<br>- Unauthenticated client read denial on all 3 lifecycle collections<br>- Cross-tenant client read denial<br>- Owner tenant read access<br>- Complete client write denial (create/update/delete)<br>- Rights revocation immediately blocks external AI training and creates immutable history<br>- AI control revocation & provenance retraction validation failure<br>- Unknown policy fail closed<br>- Active retention period blocking<br>- Legal hold absolute blocking<br>- Dependency-aware erasure with resolution workflow<br>- Server-authoritative collection mapping and unmapped record type fail-closed<br>- Active legal hold preservation across policy updates<br>- Current projection physical erasure with immutable audit preservation & zero PII in retained events<br>- Idempotency & cross-tenant rejection | **PASS (100% in emulator suite)** |

---

## 8. Verification Results

| Verification Step | Command | Result |
| :--- | :--- | :--- |
| **Full Unit Test Suite** | `npm test` | **PASS: 704/704 unit tests passing** across **45 test files** (100% pass rate) |
| **TypeScript & Lint** | `npm run lint` (`tsc --noEmit`) | **PASS: 0 errors** |
| **Applet Compilation** | `compile_applet` | **PASS: Production bundle compilation succeeded** |
| **Production Build** | `npm run build` | **PASS: Full-stack build completed** (`dist/` & `dist/server.cjs`) |
| **Pre-Flight Release Audit** | `npm run audit:release` | **PASS: 0 Critical Failures** (5 non-critical environment warnings) |

---

## 9. Warnings & Non-Critical Notes

- 5 non-critical environment variable warnings during local pre-flight audit (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`, `ALLOWED_ORIGINS`, server Firestore client fallback in local dev environment). These are expected in local development and resolved via production Cloud Run environment secrets.

---

## 10. Commit & Status

- **Commit SHA**: Working directory clean, verified for release.
- **Task 33 (Scale & Resilience)**: **NOT STARTED**.
- **Task 34 (Independent Final Audit)**: **NOT STARTED**.
- **V8.4 (Contractor Archive Ingestion)**: **NOT STARTED**.
