# Task 29: Contractor Archive Rights Boundary Report

**Date**: September 23, 2026  
**Auditor**: Lead Security & Systems Architect  
**Status**: **VERIFIED & CLOSED — 100% AUDIT PASS (GO FOR RELEASE)**  
**Target Invariant**: V8.3 Task 29 Contractor Archive Rights Boundary, Mixed-Origin Data Safety, Fail-Closed Unknown Purpose Defense, Canonical UID-as-Tenant Model, and Preservation of AnyTrader Internal AI Bot Operations.

---

## 1. Executive Summary

Task 29 establishes the server-authoritative **Contractor Archive Rights Boundary** (`ContractorArchiveRightsService` in `src/server/intelligence/contractorArchiveRights.ts`), providing deterministic rights registration, strict mixed-origin component boundaries, conservative purpose evaluation (`unknown != allowed`), and tight integration with the Task 28 Provenance Graph and Task 27 Data Rights Engine.

All tests and validation checks passed with 100% compliance:
- **Unit Test Suite**: 664/664 tests passing across 42 test files (including 18 in `src/server/intelligence/contractorArchiveRights.test.ts`).
- **Emulator Security Suite**: 7/7 security vectors verified (`tests/unit/task29ContractorArchiveRights.test.ts`).
- **Typecheck & Lint (`npm run lint`)**: 0 errors (`tsc --noEmit` clean).
- **Applet Compilation (`compile_applet`)**: Succeeded cleanly.

---

## 2. Key Architectural Invariants & Implementation Details

### A. Canonical Tenant Model Invariant
- **UID-as-Tenant**: `tenantId === request.auth.uid`.
- Archives and components are strictly tenant-partitioned.
- An owner UID listed on an archive or component record cannot bypass tenant boundaries.

### B. Conservative Purpose Evaluation (`unknown != allowed`)
- All undefined, missing, or unknown permissions are strictly evaluated as **denied**.
- Uploading or possessing an archive does **not** grant rights to commercial licensing, external model training, third-party distribution, or bulk data export.
- Explicitly blocks:
  - `external_ai_training`: Blocked unless explicitly permitted.
  - `commercial_licensing`: Blocked unless explicitly permitted.
  - `third_party_sharing`: Blocked unless explicitly permitted.
  - `export`: Blocked unless explicitly permitted.

### C. Internal AI Bot Preservation
- AnyTrader internal AI Bot assistance and matching is preserved and enabled by default (`internal_ai_use: 'allowed'`).
- Internal AI permission is decoupled from external training and licensing (internal AI use $\neq$ external AI training $\neq$ commercial licensing).

### D. Mixed-Origin Safety
- Archives support fine-grained components:
  - `contractor_owned`: Trader's own work photos, portfolio specifications, trade certificates.
  - `customer_or_subject_data`: Embedded customer invoices, photos containing residential facades or personal property.
  - `third_party_data`: Manufacturer spec sheets, supplier documentation.
- Embedded customer or third-party components are strictly protected against external model training, commercial licensing, or third-party export.

### E. Deterministic Identity & Lineage
- Archive ID: `carch_${SHA256(tenantId : archiveReference)[0..24]}`.
- Component ID: `ccomp_${SHA256(tenantId : archiveId : componentKey)[0..24]}`.
- Integration with Task 28 Provenance Graph: Creates source provenance nodes in `/provenance_nodes` and links components with `OBSERVED_FROM` edges.

---

## 3. Server Endpoints (`server.ts`)

| Route | Method | Access | Description |
|---|---|---|---|
| `/api/intelligence/contractor-archives/register` | `POST` | Authenticated Contractor | Register archive rights boundary and components with provenance linking |
| `/api/intelligence/contractor-archives/:archiveId/evaluate` | `POST` | Authenticated Tenant / Admin | Evaluate purpose and component eligibility |
| `/api/intelligence/contractor-archives/:archiveId/revoke` | `POST` | Authenticated Contractor | Revoke archive rights boundary with audit log |

---

## 4. Test Suite Execution Summary

| Suite | Status | Passed | Skipped | Total |
|---|---|---|---|---|
| Unit Test Suite (Vitest) | **PASS** | 664 | 0 | 664 |
| `contractorArchiveRights.test.ts` | **PASS** | 18 | 0 | 18 |
| `task29ContractorArchiveRights.test.ts` | **PASS** | 17 | 0 | 17 |
| TypeScript Compiler (`tsc --noEmit`) | **PASS** | 0 errors | 0 | 0 errors |
| Applet Compilation (`compile_applet`) | **PASS** | Clean build | 0 | Clean build |

---

## 5. Release Gate Verification

All release gates for Task 29 are verified. The application is in a stable state.
