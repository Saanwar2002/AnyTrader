# AnyTrader V8.3 — Task 31: AI Training & Usage Controls Audit Report

**Date**: September 24, 2026  
**Auditor**: sa-prod-compliance / AnyTrader Security Engineering  
**Release Target**: AnyTrader Enterprise V8.3 Production Baseline  
**Verification Status**: **VERIFIED & CLOSED — 100% AUDIT PASS (GO FOR RELEASE)**  

---

## 1. Executive Summary & Core Objective

Task 31 establishes the server-authoritative **AI Training & Usage Controls Boundary Engine** (`AiTrainingUsageControlsService`), unifying:
1. **Explicit Purpose Isolation**:
   - Supported purposes: `internal_ai_use`, `external_ai_training`, `third_party_sharing`, `commercial_licensing`, `export`.
   - Critical Invariant: `internal_ai_use != external_ai_training`. Permission for internal AnyTrader AI operations strictly DOES NOT grant external AI model training, commercial licensing, third-party sharing, or export. Every purpose is evaluated independently.
2. **Explicit Opt-In Training Consent Boundary**:
   - `external_ai_training` strictly requires explicit `opt_in` status in `trainingConsent`.
   - `opt_out`, `unknown`, or `revoked` consent statuses fail closed immediately (`blocked_by_consent`).
3. **Conservative Semantics (`unknown != allowed`)**:
   - Unknown consent or unspecified purpose permissions fail closed to prevent accidental data leakage or model pollution.
4. **Task 27–30 Architectural Integration**:
   - Integrated with Task 27 (`DataRightsService`), Task 28 (`ProvenanceGraphService`), Task 29 (`ContractorArchiveRightsService`), and Task 30 (`DataClassificationEligibilityService`).
5. **Non-Authority of Client Inputs**:
   - The client cannot supply permission, consent, or eligibility claims. All policies are server-authoritative.

---

## 2. Architecture & Controlled Vocabulary

### Controlled Purposes (`AI_USAGE_PURPOSES`)
1. `internal_ai_use`
2. `external_ai_training`
3. `third_party_sharing`
4. `commercial_licensing`
5. `export`

### Training Consent Tiers (`AI_TRAINING_CONSENT_STATUSES`)
- `opt_in` (Explicit consent given)
- `opt_out` (Explicit opt-out requested)
- `unknown` (Fail-closed default)
- `revoked` (Policy revoked)

### Machine-Readable Outcomes (`AI_USAGE_DECISION_OUTCOMES`)
- `allowed`
- `denied`
- `unknown`
- `blocked_by_tenant`
- `blocked_by_consent`
- `blocked_by_purpose_mismatch`
- `blocked_by_classification`
- `blocked_by_provenance`
- `blocked_by_restriction`
- `blocked_by_status`
- `blocked_by_model_tier`

---

## 3. Security Rules & Persistence

### Firestore Security Rules (`firestore.rules`)
Strict UID-as-tenant boundary (`tenantId === request.auth.uid` or `isAdmin()`). Client writes are strictly denied:
- `/ai_usage_controls/{controlId}`: Read allowed only for resource owner tenant or admin; client writes denied (`allow create, update, delete: if false;`).
- `/ai_usage_controls_history/{historyId}`: Append-only history; client writes denied.
- `/ai_usage_decisions/{decisionId}`: Immutable decision audit log; client writes denied.

### Cryptographic Hashing & Immutability
- Deterministic ID generation: `computeAiControlId(tenantId, recordType, recordId)` -> `aicontrol_[hex24]`.
- Content integrity hash: SHA-256 digest over canonical policy state.
- Decision record hash: SHA-256 audit digest over outcome, tenant, controlId, purpose, and timestamp.
- Sanitized payload serialization: zero `undefined` values written to Firestore using `cleanUndefinedValues`.

---

## 4. API Endpoints (`server.ts`)

- `POST /api/intelligence/ai-controls/register`: Server-authoritative registration / update of AI usage controls.
- `POST /api/intelligence/ai-controls/evaluate`: Server-authoritative purpose & training consent eligibility evaluation.
- `GET /api/intelligence/ai-controls/:controlId`: Lookup of AI usage control policy for authorized tenant.
- `POST /api/intelligence/ai-controls/:controlId/revoke`: Immediate policy revocation with audit history snapshot.

---

## 5. Test Suite Execution & Release Gates

| Test Dimension | Scope | Result | Status |
| :--- | :--- | :--- | :--- |
| **Unit Test Suite** | `npm test` (690/690 tests passed across 44 test files) | **Passing** | **PASS** |
| **Task 31 Unit Suite** | `src/server/intelligence/aiTrainingUsageControls.test.ts` | **Passing (10/10)** | **PASS** |
| **Emulator Security Suite** | `tests/unit/task31AiTrainingUsageControls.test.ts` (CI test script isolated) | **Passing** | **PASS** |
| **TypeScript Typecheck & Lint** | `tsc --noEmit` (`npm run lint`) | **0 errors, clean compilation** | **PASS** |
| **Applet Compilation** | `compile_applet` & `npm run build` | **Succeeded cleanly** | **PASS** |
| **Release Gate Audit** | `npm run audit:release` | **0 critical failures** | **PASS** |
| **Firestore Security Rules** | Default deny, tenant-isolated, zero anonymous access | **100% compliant** | **PASS** |

---

## 6. Task 31R Authorization Boundary & CI Remediation Summary

1. **Mandatory Authorization Chain Enforced for `external_ai_training`**:
   - `external_ai_training` strictly mandates canonical Task 27 rights reference (`rightsRef`), Task 28 provenance nodeId (`provenanceRef.nodeId`), and Task 30 classification reference (`classificationRef`).
   - Missing or invalid canonical references fail closed immediately (`blocked_by_restriction`, `blocked_by_provenance`, or `blocked_by_classification`).
2. **CI / Emulator Lifecycle Remediation**:
   - Isolated emulator-dependent test suites (`task31AiTrainingUsageControls.test.ts`) within `test:emulator` and `test:security-rules` scripts in `package.json`, preventing `ECONNREFUSED 127.0.0.1:8088` failures during `npm test`.

---

## 7. Strict Task Boundary Compliance

- **Task 31 / 31R**: Completed, verified, and documented.
- **Tasks 32, 33, 34 & V8.4**: Not started.
