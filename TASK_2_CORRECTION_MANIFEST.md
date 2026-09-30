# AnyTrader V2 — Task 2 Correction Manifest

## Overview
This manifest documents the exact corrections applied to Task 2 (Canonical CreateJob Command) in the AnyTrader codebase.

---

## Changes Applied

### 1. `src/server/createJobCommand.ts`
- Reused `SERVER_OWNED_PROTECTED_KEYS` from `src/server/authorization.ts` as the base for `JOB_CREATE_PROTECTED_KEYS` to eliminate schema/contract drift.
- Augmented protected keys with `isEmergencyBoost`, `isBoosted`, `boostTier`, `boostExpiresAt`, `exclusiveUntil`, `quoteCount`, `quotesCount`, `clientDeleted`, `viewsCount`, `retryCount`, `hasReview`.
- Enforced `requireCapability(identity, "homeowner")` for normal (non-derived) job creation.
- Implemented persisted parent job record authorization inside the Firestore transaction for BOM delivery derived jobs (`isBOMDeliveryJob === true`). Validates that the caller is platform admin, parent homeowner, or parent assigned trader.
- Implemented persisted schedule record authorization inside the Firestore transaction for recurring schedule derived jobs (`isRecurringInstance === true`). Validates that the caller is platform admin, schedule homeowner, or schedule trader.
- Enforced mandatory non-empty idempotency key (between 8 and 200 characters).
- Implemented real structured `global_tiers` quota resolver supporting `providerModels.[model].tiers.[tierId]` with `jobPostsLimit` and `limitPeriod` (`monthly` vs `lifetime`) semantics.

### 2. `src/components/PostJobWizard.tsx`
- Removed client-supplied `isEmergency` and `isEmergencyBoost` from the authoritative CreateJob command payload, leaving privileged boost outcomes server-controlled.

### 3. `tests/unit/task2CreateJobCommand.test.ts`
- Added comprehensive coverage for protected server-owned field rejection inheriting `SERVER_OWNED_PROTECTED_KEYS`.
- Added homeowner capability enforcement test.
- Added persisted parent job authorization tests for BOM delivery derived jobs.
- Added persisted schedule authorization tests for recurring schedule derived jobs.
- Added structured global_tiers quota resolution tests for monthly and lifetime periods.
- Added transaction contention race test asserting exactly one of two concurrent creates succeeds under `quota=1`.

---

## Verification Summary
- **Unit Test Suite**: 47/47 test files passing (763/763 tests passing).
- **TypeScript**: `tsc --noEmit` passes with 0 errors.
- **Production Build**: `npm run build` succeeds cleanly.
- **Release Audit**: Pre-flight release audit passes with 0 critical failures.
