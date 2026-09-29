# AnyTrader — Task 1: Canonical Identity & Capability Model Finalization Report

**Date**: September 29, 2026  
**Status**: **VERIFIED & CLOSED — 100% AUDIT PASS (GO FOR RELEASE)**  
**Scope**: Task 1 (Identity, Roles, Capabilities, Authorization Context, Onboarding Authority, and CI Coverage)  
**Task Isolation Rule**: Task 1 ONLY (Task 2 — CreateJob and all subsequent tasks NOT started).

---

## 1. Executive Summary

Task 1 establishes AnyTrader's canonical identity, role authority, and capability architecture. It completely disentangles five previously conflated domain concepts:
1. **Account Type** (`consumer` | `service_provider` | `business` | `driver` | `admin`): The fundamental structural classification of the account (WHO the account is).
2. **Capabilities** (`homeowner`, `landlord`, `estate_agent`, `property_manager`, `tradesperson`, `contractor`, `consultant`, `fleet_driver`): Fine-grained operational permissions derived authoritatively (WHAT the account is allowed to do).
3. **Verification** (`unverified` | `pending` | `verified` | `rejected` | `expired` | `revoked`): Distinct credential verification lifecycle.
4. **Subscription** (`PAYG` | `Silver Professional` | `Gold Elite` | `Platinum Enterprise`): Commercial entitlement tracking independent of identity authorization.
5. **Active Context** (`portal`, `role`): Transient UI presentation and session persona state.

---

## 2. Canonical Identity Flow & Architecture

```
Authenticated User (Firebase Auth Token)
              ↓
   Trusted Identity Source (Server Claims & Admins Collection)
              ↓
   resolveCanonicalIdentity() / requireAccountType() / requireCapability()
              ↓
   CanonicalIdentity (accountType, capabilities, verification, subscription, activeContext)
              ↓
   Server Authorization (assertIsAdmin, requireAccountType, assertResourceOwner)
              ↓
   Protected Business Operation (Jobs, Quotes, Escrow, Properties, Audits)
```

---

## 3. Security Invariants & Guarantees

- **Presentation vs Authority Isolation**: `PortalContext` state, `localStorage` flags (`anytrader_active_role`, `anytrader_active_portal`), and UI role selectors **NEVER** grant or elevate server authority.
- **Single Coherent Admin Authority Model**: Administrator privileges require server-minted Firebase custom claims (`isAdmin === true` or `admin === true`) or verified server-controlled records. Raw role strings (`role: "admin"` or `role: "ecosystem_manager"`), email-based UI heuristics, and invitation IDs cannot independently manufacture admin authority.
- **Fail-Closed Capability Resolution**: `resolveCapabilities()` enforces account-type boundaries. Untrusted requests attempting to inject out-of-boundary explicit capabilities (e.g. a consumer claiming `fleet_driver` or `contractor`) are filtered out fail-closed.
- **Canonical Primitives**: Introduced `requireAccountType()`, `requireAccountTypeIn()`, and `requireCapability()`.
- **Mass-Assignment Defense**: `SERVER_OWNED_PROTECTED_KEYS` in `src/server/authorization.ts` suppresses 25+ privileged and identity keys (`accountType`, `capabilities`, `activeContext`, `customClaims`, `isAdmin`, `role`, `tierId`, `subscriptionStatus`, etc.) from client payloads.
- **Safe Backward Compatibility**: Historical AnyTrader role values (`customer`, `homeowner`, `tradesperson`, `trader`, `pro`, `driver`, `fleet_driver`, `business`, `contractor`) resolve seamlessly to their canonical counterparts without creating escalation vulnerabilities.

---

## 4. Security Review & Adversarial Vectors (10/10 Verified)

| # | Question / Threat Vector | Result | Architectural & Test Evidence |
|---|--------------------------|--------|-------------------------------|
| 1 | **Can a normal authenticated user make themselves admin by changing Firestore `profile.role`?** | **NO** | `resolveAccountType()` and `resolveCanonicalIdentity()` require verified server claims (`isAdmin === true`). A raw `role: "admin"` doc without claims defaults to `consumer`. Protected by `sanitizeClientPayload` and `task1CanonicalIdentity.test.ts` (Vector 3). |
| 2 | **Can a normal user make themselves admin by changing `localStorage`?** | **NO** | Server authorization runs exclusively in backend code and Firestore security rules. Client `localStorage` only affects presentation UI rendering in `PortalContext.tsx`. Verified in `task1CanonicalIdentity.test.ts` (Vector 4). |
| 3 | **Can a normal user make themselves admin by selecting a different `PortalContext` role?** | **NO** | `PortalContext` controls client route navigation only. Backend guards (`assertIsAdmin`, `requireAccountType`, `requireCapability`) validate authenticated token identity. Verified in `task1CanonicalIdentity.test.ts` (Test C). |
| 4 | **Can `invitationId` alone create admin authority?** | **NO** | Backend authority resolution ignores `invitationId` for privilege assignment; onboarding admin flows require server-verified custom claims (`tokenResult.claims.admin === true`). Verified in `task1CanonicalIdentity.test.ts` (Vector 9). |
| 5 | **Can client-supplied capabilities grant unauthorized permissions?** | **NO** | `resolveCapabilities()` filters explicit capabilities against the resolved `accountType`. `SERVER_OWNED_PROTECTED_KEYS` strips `capabilities` from client payloads. Verified in `task1CanonicalIdentity.test.ts` (Vector 1). |
| 6 | **Can `claims.role` alone grant admin authority if the canonical admin claim is absent?** | **NO** | `isUserAdminClaim(user)` in `src/server/authorization.ts` strictly checks `user.isAdmin === true \|\| user.admin === true`. Verified in `task1CanonicalIdentity.test.ts` (Vector 7). |
| 7 | **Can `ecosystem_manager` still bypass canonical admin authorization?** | **NO** | `ecosystem_manager` is treated as a privileged administrative role requiring server-verified custom claims. Without server claims, it defaults safely to `consumer`. Verified in `task1CanonicalIdentity.test.ts` (Vector 7). |
| 8 | **Can frontend role checks bypass server authorization?** | **NO** | All state mutations (jobs, quotes, payments, milestones, storage, properties) enforce server guards (`assertCanAccessJob`, `assertCanModifyJob`, `assertResourceOwner`, `assertCanManageMilestone`) independent of UI state. Verified in `task1CanonicalIdentity.test.ts` (Test F & Vector 6). |
| 9 | **Can `resolveCanonicalIdentity()` consume untrusted client data as authoritative identity?** | **NO** | `resolveCanonicalIdentity()` strictly enforces custom claims for admin authority and filters capabilities against account types. Verified in `task1CanonicalIdentity.test.ts` (Vectors 1–9). |
| 10 | **Can existing legacy-role compatibility mappings accidentally create privilege escalation?** | **NO** | Legacy role strings map deterministically to non-admin canonical account types (`consumer`, `service_provider`, `driver`, `business`). Legacy `admin`/`ecosystem_manager` strings require server custom claims. Verified in `task1CanonicalIdentity.test.ts` (Test A & Vector 8). |

---

## 5. Files Changed & Audit

1. **`src/server/identity.ts`**:
   - Implemented `CanonicalAccountType`, `CanonicalCapability`, `CanonicalVerificationInfo`, `CanonicalSubscriptionInfo`, and `CanonicalActiveContext`.
   - Added `requireAccountType()`, `requireAccountTypeIn()`, and `requireCapability()` primitives.
   - Hardened `resolveCapabilities()` with strict boundary enforcement against `accountType`.
   - Hardened `resolveAccountType()` and `resolveCanonicalIdentity()` to require server custom claims for admin privileges.

2. **`src/server/authorization.ts`**:
   - Re-exported `requireAccountType()`, `requireAccountTypeIn()`, and `requireCapability()`.
   - Wired `assertIsAdmin()`, `assertUserRole()`, `assertUserCapability()`, `assertUserAccountType()`, and `assertResourceOwner()`.
   - Enforced `SERVER_OWNED_PROTECTED_KEYS` containing `accountType`, `capabilities`, `activeContext`, and `customClaims`.

3. **`server.ts`**:
   - Replaced legacy `user.isAdmin === true || user.role === "admin"` with authoritative `checkIsAdmin(user)`.

4. **`src/lib/PortalContext.tsx`**:
   - Clarified role as presentation-only context for UI rendering, persona switching, and theme selection.
   - Decoupled `PortalContext` and `localStorage` from server authorization.

5. **`src/components/Onboarding.tsx`**:
   - Verified that admin onboarding strictly requires server-minted custom claims.
   - Persisted canonical identity fields (`accountType`, `capabilities`, `activeContext`) alongside legacy compatibility fields.

6. **`tests/unit/task1CanonicalIdentity.test.ts`**:
   - Added comprehensive adversarial tests across all 9 attack vectors and canonical primitive assertions (`requireAccountType`, `requireAccountTypeIn`, `requireCapability`).

---

## 6. Test & CI Results

- **Unit & Adversarial Test Suite (`npm test`)**: **755 / 755 tests passing** across 47 test suites (100% pass rate).
- **TypeScript & Linter Checks (`npm run lint` / `tsc --noEmit`)**: **0 errors**.
- **Applet Compilation (`compile_applet`)**: **Build succeeded cleanly**.
- **Pre-Flight Release Audit (`npm run audit:release`)**: **0 Critical Failures** (`GO WITH EXPLICIT ACCEPTED RISKS`).

---

## 7. Next Step

- **Next Task**: Task 2 — Canonical CreateJob Command
- **Current Status**: STOP after Task 1. Task 2 has NOT been started.
