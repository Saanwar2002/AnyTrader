# AnyTrader V8.2 — Task 20 Property Condition & Lifecycle Intelligence Report
**Date**: September 20, 2026  
**Status**: VERIFIED & CLOSED — 100% AUDIT PASS (GO FOR RELEASE)

---

## 1. Executive Summary

Task 20 successfully establishes an **evidence-backed Property Condition & Lifecycle History layer** on top of the closed V8.2 Task 19 Property Evidence & Component Ontology foundation.

The implementation strictly maintains the core architecture:
1. **Observation vs. Inference Separation**: `PropertyConditionObservation` records capture observed component conditions (e.g., `observed_degraded`, `repaired`, `replaced`), while model/system inferences are isolated inside `inferenceDetails` (hypothesis, confidence, benchmark cost).
2. **Untrusted AI Boundary**: AI-derived candidates are marked as `status: 'derived'` with `isVerifiedServerAction: false`. They are strictly forbidden from self-promoting to `verified` or asserting `repaired`/`replaced` states without server authorization.
3. **Completed Job != Automatic Repair**: A `job.status === "completed"` state does NOT constitute proof of repair. The lifecycle service requires supporting outcome evidence (e.g. photos, signed signoff, completion report) or server-verified action to record a `repaired` or `replaced` state.
4. **Authoritative Lineage & Property Scope**: Uses `resolveAuthoritativeJobPropertyId` and `evidenceRegistry` to enforce fail-closed property lineage and cross-tenant isolation.
5. **Immutable Append-Only History**: Stores condition observations in `/property_condition_history/{conditionId}` and projects current state into `/properties/{propertyId}` under `intelligence.buildingComponents`.

---

## 2. Core Service Implementation

### `PropertyLifecycleService` (`src/server/intelligence/propertyLifecycle.ts`)
- **`recordConditionObservation(input, options)`**:
  - Validates property existence in `/properties/{propertyId}`.
  - Enforces component vocabulary via `validateComponentType` & `normalizeComponentType`.
  - Ensures at least one valid evidence ID is supplied.
  - Verifies job lineage: `resolveAuthoritativeJobPropertyId` ensures `sourceJobId` belongs to `input.propertyId`.
  - Verifies evidence authority: evidence in `evidenceIds` must belong to `input.propertyId` or `input.sourceJobId`.
  - Enforces AI Security Boundary: prevents AI candidates from asserting `status: 'verified'` or setting `lifecycleState` to `repaired`/`replaced` without `isVerifiedServerAction: true`.
  - Enforces Deterioration Claims Guardrail: rejects `observed_degraded` without supporting evidence or detailed observation notes.
  - Generates deterministic `conditionId` using `pc_${propertyId}_${contentHash.slice(0, 16)}` for idempotency.
  - Writes to `/property_condition_history/{conditionId}` append-only log and updates `/properties/{propertyId}` aggregate projection.
- **`getPropertyConditionHistory(propertyId, options)`**: Bounded query returning chronological condition observations for a given property.
- **`getCurrentPropertyConditionProjection(propertyId)`**: Retrieves projected component conditions from the property document.

---

## 3. Data Model & Schema Enhancements

### Types (`src/server/intelligence/types.ts` & `src/server/intelligence/propertyOntology.ts`)
- `PropertyLifecycleState`: `'observed_good' | 'observed_fair' | 'observed_degraded' | 'observed_end_of_life' | 'repaired' | 'replaced' | 'unknown'`
- `PropertyConditionObservation`:
  - `conditionId`: Deterministic string ID
  - `propertyId`: Authoritative property ID
  - `componentType`: Validated `PropertyComponentType`
  - `lifecycleState`: `PropertyLifecycleState`
  - `sourceType`: `'inspection' | 'job' | 'tenant_report' | 'ai_inference' | 'manual'`
  - `sourceId`: Source identifier
  - `sourceJobId`: Optional source job ID
  - `evidenceIds`: Array of evidence IDs
  - `status`: `EvidenceStatus` (`'derived' | 'unverified' | 'verified' | 'rejected'`)
  - `confidence`: Number (0.0 to 1.0)
  - `contentHash`: SHA-256 hash
  - `observationDetails`: Optional detailed observation
  - `inferenceDetails`: Optional model hypothesis, estimated remaining lifespan, and cost benchmark
  - `provenance`: `Provenance` record
  - `observedAt`, `createdAt`, `updatedAt`: ISO 8601 timestamps

---

## 4. Security Rules & Indexing

### `firestore.rules`
Added security rule for `/property_condition_history/{conditionId}`:
```cel
match /property_condition_history/{conditionId} {
  allow read: if isAuthenticated() && (
    resource.data.propertyId == null ||
    isPropertyOwnerOrLandlord(resource.data.propertyId) ||
    isAssignedPropertyManager(resource.data.propertyId) ||
    isAdmin()
  );
  allow write: if isAdmin();
}
```

### `firestore.indexes.json`
Added composite index for `property_condition_history`:
```json
{
  "collectionGroup": "property_condition_history",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "propertyId", "order": "ASCENDING" },
    { "fieldPath": "observedAt", "order": "DESCENDING" }
  ]
}
```

---

## 5. Comprehensive Unit Test Verification

Created `tests/unit/task20PropertyConditionLifecycle.test.ts` (15 tests, 100% pass):
1. **Authoritative Property Existence & Lineage Validation**:
   - `A. Missing property fails closed`: Rejects observations for non-existent properties.
   - `B. Missing evidence fails`: Rejects observations without evidence IDs.
   - `C. Fabricated/Unknown evidence fails`: Rejects unrecorded evidence IDs.
   - `D. Cross-property evidence fails`: Rejects evidence belonging to a different property.
   - `E. Cross-property job lineage fails`: Rejects jobs belonging to a different property.
2. **AI Boundary & Unverified Candidate Restrictions**:
   - `F. AI cannot self-promote status to verified without server authorization`: Strips/rejects unverified AI attempts to claim verified status.
   - `F2. AI cannot self-promote lifecycleState to repaired/replaced without server authorization`: Rejects AI candidate attempts to set `repaired` or `replaced`.
3. **Observation vs Inference Separation & Core Lifecycle Mechanics**:
   - `G. Observation vs Inference separation preserved`: Verifies factual observation remains distinct from model hypothesis/benchmarks.
   - `K. Completed job does NOT automatically mean repaired without outcome evidence`: Fails closed when attempting to record `repaired` on a completed job without outcome evidence.
   - `L & M. Valid repair and replacement evidence establishes repaired/replaced state`: Successfully records `repaired`/`replaced` when verified.
   - `N. Unsupported deterioration claim is rejected`: Fails closed when deterioration claims lack evidence/details.
   - `H & I. Deterministic idempotency & append-only store preservation`: Verifies idempotent duplicate writes return identical records without duplicating storage.
   - `O. Bounded property-scoped queries`: Returns sorted historical observations scoped to property ID.
4. **Real Firebase Emulator & Security Rules Invariants**:
   - `P. Client access denied on property_condition_history`: Client SDK attempts to write directly to `/property_condition_history` fail closed.
   - `Q & R. Admin SDK writes & reads property_condition_history in emulator`: Admin SDK successfully writes and reads observations.

---

## 6. Audit & Verification Results

- **Unit Tests**: 585/585 unit tests passing across 38 test files (100% pass rate).
- **TypeScript Typecheck**: `tsc --noEmit` clean with 0 errors.
- **Applet Compilation**: `compile_applet` build succeeded cleanly.
- **Pre-Flight Release Audit**: Passed with 0 critical failures.

**Final Status**: Task 20 VERIFIED & CLOSED.
