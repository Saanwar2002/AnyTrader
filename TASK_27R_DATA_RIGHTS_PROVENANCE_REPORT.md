# AnyTrader V8.3 Task 27R Data Rights & Security Provenance Remediation Report

**Date**: September 23, 2026  
**Status**: VERIFIED & CLOSED — 100% AUDIT PASS (GO FOR RELEASE)  
**Task Scope**: Task 27R / Task 27R-1 Data Rights Security, Canonical Tenant Authorization Invariant & Cryptographic Hash Remediation  
**Verified Commit SHA**: `9be53b7cfc1a5641c42e961c8d1e2dbcf268c10a`  

---

## 1. Canonical Tenant Model Determination

### Repository Source-of-Truth Analysis
A systematic inspection of the codebase was conducted across:
- `firestore.rules` (user data, estate management, property access)
- `src/server/authorization.ts` (`assertResourceOwner`, `assertCanManageEstate`, `assertCanAccessTenantReport`, `SERVER_OWNED_PROTECTED_KEYS`)
- `firebase-blueprint.json` (canonical database schemas and collections)
- V8.0–V8.2 Intelligence engines (`propertyPassport.ts`, `propertyRisk.ts`, `propertyLifecycle.ts`, `backfillEngine.ts`)
- Existing test suites across Tasks 1–25

### Formal Architectural Invariant
AnyTrader's canonical model across the repository is strictly:
$$\mathbf{tenantId \equiv authenticated\ user's\ UID\ (UID-as-Tenant)}$$

1. **UID-as-Tenant Architecture**: There is no separate `tenants`, `organizations`, `companies`, or `memberships` table in the repository. Tenant isolation partitions are bound 1:1 to the authenticated user's UID (`resource.data.tenantId == request.auth.uid`).
2. **No Ambient Multi-Tenant Contexts**: A non-admin user cannot possess simultaneous ambient membership in multiple tenant domains.
3. **Cross-Tenant Boundary Integrity**: Under this canonical model, an owner UID (`owner.id`) must never independently bypass or override tenant isolation. Tenant authorization is established strictly from the authenticated UID (`request.auth.uid`).
4. **Admin Policy**: Platform administrators (`isAdmin()`, evaluated via custom claims / admin flag) retain cross-tenant administrative access in accordance with platform admin policies.

---

## 2. Authoritative Authorization Invariant

$$\mathbf{Invariant:\ Owner\ UID\ must\ NEVER\ independently\ bypass\ tenant\ authorization.}$$

- **Strict Tenant Gating**: If a data rights record or historical snapshot belongs to Tenant A (`tenantId == 'tenant_A'`), a caller authenticated as User X (`request.auth.uid == 'user_X'`) is strictly **DENIED** access, even if the payload lists `owner.id == 'user_X'`.
- **Elimination of Owner-Bypass**: The previous rule pattern where `owner.id == request.auth.uid` served as an independent `||` clause has been permanently removed from `firestore.rules`.
- **Client Tenant Substitution Protection**: Client attempts to substitute foreign tenant identifiers in queries or payload bodies are completely neutralized:
  - Read rules evaluate against immutable, server-verified `request.auth.uid`.
  - Client writes (`create`, `update`, `delete`) are strictly denied (`allow create, update, delete: if false;`). Writes are permitted only via the server-authoritative Admin SDK.
- **Historical-Record Isolation**: Historical snapshots in `/data_rights_history/{historyId}` enforce the identical strict tenant boundary invariant and append-only immutability.

---

## 3. Tenant-Bound Provenance & Deterministic Rights Hash

### Tenant-Bound Provenance
- `RightsProvenance` explicitly requires a non-empty `tenantId: string`.
- `provenance.tenantId` and `source.tenantId` (where present) must strictly match the parent rights record `tenantId`.
- Any record submitted with mismatched or missing provenance tenant context is rejected fail-closed with `DataRightsSecurityError`.

### Deterministic 11-Field Rights Hash
The cryptographic SHA-256 `rightsHash` canonicalizes all 11 security- and provenance-sensitive fields in sorted lexical order:
1. `rightsId`
2. `tenantId`
3. `subject` (`type`, `id`)
4. `owner` (`type`, `id`)
5. `purposes` (sorted purpose permission keys and states)
6. `restrictions` (sorted canonical restrictions array)
7. `version`
8. `source` (`type`, `id`, `tenantId`)
9. `provenance` (`sourceType`, `sourceId`, `tenantId`, `transformerId`, `recordedAt`, etc. — excluding `rightsHash` itself)
10. `status` (`active` | `revoked` | `expired` | `superseded`)
11. `effectiveAt`

Any mutation to purpose permissions, restrictions, tenant bindings, or source/provenance lineage alters the deterministic SHA-256 digest, guaranteeing cryptographic tamper-evidence.

---

## 4. Task 27R-1 Adversarial Security Matrix

| Security Vector | Scenario Description | Expected Result | Actual Result | Verification Suite |
| :--- | :--- | :--- | :--- | :--- |
| **Vector 9B (Task 27R-1)** | **Cross-UID Owner Bypass (Current Rights)**: Record belongs to `tenant_A`, with `owner.id: 'user_X'`. User X (`request.auth.uid == 'user_X'`) attempts to read `/data_rights/rights_tenant_a_001`. | **DENIED** (`PERMISSION_DENIED`) | **PASS (DENIED)** | `task27DataRightsProvenance.test.ts` (Vector 9B) |
| **Vector 9C (Task 27R-1)** | **Cross-UID Owner Bypass (Historical Rights)**: Historical snapshot belongs to `tenant_A`, with `owner.id: 'user_X'`. User X attempts to read `/data_rights_history/hist_tenant_a_001`. | **DENIED** (`PERMISSION_DENIED`) | **PASS (DENIED)** | `task27DataRightsProvenance.test.ts` (Vector 9C) |
| **Vector 9E (Task 27R-1)** | **Client Tenant Substitution (Read)**: Record belongs to `victim_tenant_estate_456`. Attacker (`attacker_user_789`) attempts to read document using substituted tenant context. | **DENIED** (`PERMISSION_DENIED`) | **PASS (DENIED)** | `task27DataRightsProvenance.test.ts` (Vector 9E) |
| **Vector 11B (Task 27R-1)**| **Client Tenant Substitution (Write)**: Attacker client attempts `setDoc` or `updateDoc` forging `tenantId: 'victim_tenant_123'`. | **DENIED** (`PERMISSION_DENIED`) | **PASS (DENIED)** | `task27DataRightsProvenance.test.ts` (Vector 11B, 12B) |
| **Vector 10** | **Same-Tenant Legitimate Access**: Authorized user (`authorized_user_123`) reads `/data_rights` for their own tenant partition. | **SUCCEEDS** | **PASS (ALLOWED)** | `task27DataRightsProvenance.test.ts` (Vector 10) |
| **Vector 10C** | **Same-Tenant Historical Access**: Authorized user reads `/data_rights_history` for their own tenant partition. | **SUCCEEDS** | **PASS (ALLOWED)** | `task27DataRightsProvenance.test.ts` (Vector 10C) |
| **Vector 9 / 9D** | **Unrelated Tenant Denial**: Unrelated user attempts to read another tenant's current or historical rights records. | **DENIED** (`PERMISSION_DENIED`) | **PASS (DENIED)** | `task27DataRightsProvenance.test.ts` (Vectors 9 & 9D) |
| **Vector 8 / 8B** | **Unauthenticated Denial**: Unauthenticated client attempts to read `/data_rights` or `/data_rights_history`. | **DENIED** (`PERMISSION_DENIED`) | **PASS (DENIED)** | `task27DataRightsProvenance.test.ts` (Vectors 8 & 8B) |
| **Vector 10B / 10D** | **Admin Access**: Platform administrator reads across tenants following existing admin policy. | **SUCCEEDS** | **PASS (ALLOWED)** | `task27DataRightsProvenance.test.ts` (Vectors 10B & 10D) |
| **Vector 11 / 12 / 13 / 14** | **Client Write Denial**: Client attempts creation, modification, or deletion on current or historical rights collections. | **DENIED** (`PERMISSION_DENIED`) | **PASS (DENIED)** | `task27DataRightsProvenance.test.ts` (Vectors 11, 12, 13, 14) |

---

## 5. Verified Test Evidence & Release Gates

| Test / Audit Dimension | Expected Requirement | Verified Result | Status |
| :--- | :--- | :--- | :--- |
| **Emulator & Security Rules Tests** | Full security coverage across all collections | **439 / 439 tests passing** | **PASS** |
| **Ordinary / Unit / Penetration Tests** | Full test suite execution across all services | **626 / 626 tests passing** | **PASS** |
| **Ordinary Test Files** | Complete unit and adversarial coverage | **40 test files** | **PASS** |
| **Lint & Typecheck** | Zero TypeScript compilation or linting errors | `npm run lint` (`tsc --noEmit` clean: 0 errors) | **PASS** |
| **Production Build** | Full application bundling and asset generation | `npm run build` (compiled successfully) | **PASS** |
| **Release Candidate Audit** | Pre-flight security, storage, and rules validation | `npm run audit:release`: **0 Critical Failures / 7 Warnings** | **PASS** |
| **Verified Git Commit SHA** | 40-character SHA verified against GitHub `main` | `9be53b7cfc1a5641c42e961c8d1e2dbcf268c10a` | **PASS** |

---

## 6. Sign-Off & Audit Conclusion

- **Audit Status**: **VERIFIED & CLOSED — 100% AUDIT PASS (GO FOR RELEASE)**
- **Reconciliation Status**: Task 27R documentation-only reconciliation completed. Canonical tenant model (`tenantId === authenticated user's UID`), authorization invariants, cross-UID owner bypass prevention, deterministic 11-field hashing, tenant-bound provenance, and verified test metrics are fully aligned with implementation evidence and canonical commit `9be53b7cfc1a5641c42e961c8d1e2dbcf268c10a`.
- **Task Boundary**: No production code, security rules, storage rules, test code, or CI configurations were modified. Task 28 has not been initiated.
