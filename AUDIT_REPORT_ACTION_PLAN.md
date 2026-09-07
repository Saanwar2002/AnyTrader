# 🛡️ AnyTrader — Production Audit Remediation Action Plan

This document serves as the master engineering roadmap to remediate all **58 shortcomings** identified in the 3rd-Party Pre-Launch Security, Performance, and Architecture Audit.

---

## 📋 Execution Protocol & Rules
1. **Strict Sequential Execution**: Tasks must be implemented in the exact logical sequence defined below. Prerequisites (such as client auth interceptors) MUST be completed before downstream protections (such as locking server endpoints).
2. **Zero-Regression Verification**: Before marking any task as completed (`[x]`), the agent must:
   - Run `compile_applet` to guarantee the app compiles cleanly without breaking the build.
   - Verify that dependent features (e.g., job posting, quote submission, taxi rides, property passports) remain fully functional.
3. **Progress Tracking**: After completing and verifying each task, update this document immediately by checking off the task (`[x]`), recording the completion timestamp, and summarizing the changes before moving to the next task.

---

## 📊 High-Level Status Dashboard
- **Total Tasks**: 35 action items across 6 phases
- **Completed**: 0 / 35 (0%)
- **Current Phase**: Phase 1 (API & Server Ingress Fortress)
- **Current Task**: Task 1.1

---

## 🚦 Phase 1: API & Server Ingress Fortress
*Goal: Eliminate unauthenticated server routes, secure webhooks, close remote procedure call (RPC) loopholes, and prepare the frontend with an auth interceptor so no API calls break.*

- [ ] **Task 1.1: Global Client API Auth Interceptor**
  - **Audit Ref**: C-4, §9.4
  - **Objective**: Create `src/lib/apiAuthInterceptor.ts` to automatically attach the Firebase ID token (`Authorization: Bearer <token>`) to all outgoing client `fetch('/api/...')` requests.
  - **Files**: `src/lib/apiAuthInterceptor.ts`, `src/main.tsx`
  - **Dependencies**: None. (Must be completed *before* locking server routes in Task 1.2 to avoid 401 Unauthorized regressions on user actions).
  - **Status**: `[ ] Pending`

- [ ] **Task 1.2: Server Authentication & Identity Derivation on All API Endpoints**
  - **Audit Ref**: C-4, §9.3
  - **Objective**: Apply `requireAuth` middleware to all 16 unauthenticated routes in `server.ts`. Crucially, derive `userId`, `driverId`, and `callerUid` strictly from `req.user.uid`, completely ignoring any caller-supplied ID in `req.body`.
  - **Affected Routes**:
    - `/api/create-checkout-session`
    - `/api/create-setup-session`
    - `/api/rides/create-trip-payment`
    - `/api/driver/stripe-balance/:driverId`
    - `/api/driver/settle-fees`
    - `/api/driver/confirm-fee-settlement`
    - `/api/check-job-limit` & `/api/check-quote-limit`
    - `/api/analytics/profitability`
    - `/api/job/procure-materials` & `/api/job/extract-bom`
    - `/api/driver/analytics-pulse`
  - **Files**: `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 1.3: Admin Route Gating (`requireAdmin`)**
  - **Audit Ref**: C-4, §9.3
  - **Objective**: Enforce `requireAdmin` on all sensitive operational and AI management routes:
    - `/api/admin/agents/scan`
    - `/api/admin/agents/execute-action`
    - `/api/admin/agents/audit-logs`
    - `/api/admin/send-email-alert`
    - `/api/gemini/cache-clear`
    - `/api/gemini/sync-categories`
  - **Files**: `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 1.4: Stripe Webhook Signature Strict Enforcement (Fail Closed)**
  - **Audit Ref**: C-5
  - **Objective**: Remove the fallback `JSON.parse(req.body.toString())` in `server.ts:891-894`. If `STRIPE_WEBHOOK_SECRET` is missing or the signature fails, fail closed with HTTP 400. Never parse unverified webhook payloads.
  - **Files**: `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 1.5: Stripe Mock Checkout Production Gate**
  - **Audit Ref**: C-4, §9.3
  - **Objective**: Ensure mock subscription activations and payment bypasses are strictly gated behind `process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_PAYMENTS === 'true'`. Prevent accidental free tier unlocks in live environments.
  - **Files**: `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 1.6: Dynamic Gemini RPC Replacement (Explicit Function Allowlist)**
  - **Audit Ref**: H-2
  - **Objective**: Replace dynamic function execution `(geminiServer as any)[functionName](...args)` on `/api/gemini/call` and `/api/gemini/stream` with an explicit allowlist mapping and Zod schema validation of arguments. Prevent arbitrary server function execution.
  - **Files**: `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 1.7: Strict CORS Origin Allowlist**
  - **Audit Ref**: H-1
  - **Objective**: Replace wildcard origin reflection (`res.setHeader("Access-Control-Allow-Origin", origin)`) with a strict allowlist configured via `ALLOWED_ORIGINS` environment variable, including authorized production domains, localhost, and Capacitor schemes (`capacitor://localhost`, `https://localhost`).
  - **Files**: `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 1.8: API Rate Limiting & Payload Defense**
  - **Audit Ref**: P-10, H-8
  - **Objective**: 
    - Reduce global JSON payload limit from `10mb` to `1mb` (raise only on specific multipart/upload routes).
    - Enable `validate: true` on rate limiters with reasonable per-user thresholds.
    - Implement standard security headers (Helmet / CSP).
  - **Files**: `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 1.9: Secure SSO Token Generation**
  - **Audit Ref**: C-4, §2.4
  - **Objective**: Harden `/api/sso-token` so it only signs `{ uid: req.user.uid, role: userDoc.role, email: req.user.email }` with a short 2-minute expiration and audience `shop.tradequote.uk`. Reject attacker-supplied roles/discounts in `req.body`.
  - **Files**: `server.ts`
  - **Status**: `[ ] Pending`

---

## 🔑 Phase 2: Admin Authority, Secrets & Client Sanitization
*Goal: Eliminate client-side admin bypasses, purge hardcoded PINs/emails, and secure credentials.*

- [ ] **Task 2.1: Firebase Custom Claims Admin Script & Verification**
  - **Audit Ref**: C-8, §1.1, §9.6
  - **Objective**:
    - Create `scripts/set-admin-claim.ts` utilizing Firebase Admin SDK to grant/revoke `{ admin: true }` custom claims.
    - Update `requireAdmin` in `server.ts` to verify `decodedToken.admin === true`.
    - Update `firestore.rules` to check `request.auth.token.admin == true`.
  - **Files**: `scripts/set-admin-claim.ts`, `server.ts`, `firestore.rules`
  - **Status**: `[ ] Pending`

- [ ] **Task 2.2: Hardcoded Email Literal Purge**
  - **Audit Ref**: C-8
  - **Objective**: Purge all hardcoded email references (`saanwar2002@gmail.com`) across rules and client components, replacing them with custom claims verification and dynamic role state.
  - **Affected Files**: `firestore.rules`, `server.ts`, `src/context/AuthProvider.tsx`, `src/components/Onboarding.tsx`, `src/components/admin/MasterAdminLayout.tsx`, `src/components/admin/AnyTraderAdmin.tsx`, `src/components/TermsAcceptancePrompt.tsx`, `src/services/traderOutreachAgentService.ts`, etc.
  - **Status**: `[ ] Pending`

- [ ] **Task 2.3: Remove Client Master PIN & `sessionStorage` Bypasses**
  - **Audit Ref**: C-6, C-7
  - **Objective**:
    - Remove hardcoded master PIN `362515` and `sessionStorage.admin_session_unlocked = "true"` logic from `adminAuthSecurityService.ts` and `MasterAdminLayout.tsx`.
    - Remove `sessionStorage.is_test_admin === "true"` bypass from `Onboarding.tsx` and `AuthProvider.tsx`.
    - Rely strictly on Firebase Auth authentication + re-authentication (`auth_time < 10m`) for sensitive admin operations.
  - **Files**: `src/services/adminAuthSecurityService.ts`, `src/components/admin/MasterAdminLayout.tsx`, `src/components/Onboarding.tsx`, `src/context/AuthProvider.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 2.4: Biometric & Plaintext Credential Storage Purge**
  - **Audit Ref**: H-3
  - **Objective**: Remove `btoa(JSON.stringify({email, pass}))` storage in `localStorage` from `biometricService.ts`. On native Capacitor, rely strictly on secure session tokens with native biometric prompts (`@capacitor-firebase/authentication` or Keychain). Disable simulated biometric password storage on web.
  - **Files**: `src/services/biometricService.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 2.5: Sanitize Client Error Logs (PII Leak Prevention)**
  - **Audit Ref**: M-8
  - **Objective**: Sanitize `handleFirestoreError` in `src/firebase.ts` so it no longer constructs error messages containing raw user email addresses or authentication provider dumps.
  - **Files**: `src/firebase.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 2.6: Remove `@google/genai` & API Keys from Browser Bundles**
  - **Audit Ref**: P-5
  - **Objective**: Remove direct `@google/genai` imports and `process.env.GEMINI_API_KEY` from browser code (`aiAgentEcosystemService.ts`, `aiProfileOptimizationService.ts`). Ensure all AI requests proxy through the authenticated `/api/gemini/*` endpoints.
  - **Files**: `src/services/aiAgentEcosystemService.ts`, `src/services/aiProfileOptimizationService.ts`
  - **Status**: `[ ] Pending`

---

## 🔒 Phase 3: Database & Storage Rules Hardening
*Goal: Enforce strict ownership, remove mock regex backdoors, lock server-only collections, and split public/private user profiles.*

- [ ] **Task 3.1: Remove Seed / Mock Regex Backdoors in `firestore.rules`**
  - **Audit Ref**: C-9
  - **Objective**: Remove all `^seed-`, `^mock-`, `^sample_`, `^ad-`, `^deal-` regex clauses from `firestore.rules` that currently allow arbitrary creation/modification/deletion of jobs, quotes, ads, and profiles.
  - **Files**: `firestore.rules`
  - **Status**: `[ ] Pending`

- [ ] **Task 3.2: Strict Job Ownership & Field-Level Update Control**
  - **Audit Ref**: C-1
  - **Objective**:
    - Disallow unauthenticated or non-participant updates on `/jobs/{jobId}`.
    - Allow updates only for:
      a) The job owner (`homeownerId == request.auth.uid`).
      b) The accepted tradesperson, restricted strictly to operational fields (`status`, `stage`, `timelineNotes`) via `diff().affectedKeys().hasOnly([...])`.
      c) Platform admins (`request.auth.token.admin == true`).
    - Prevent modification of critical fields (`homeownerId`, `price`, `milestones`, `escrowStatus`, `acceptedTradespersonId`) by tradespeople or third parties.
  - **Files**: `firestore.rules`
  - **Status**: `[ ] Pending`

- [ ] **Task 3.3: Lockdown Server-Only Queues & Collections (`allow write: if false`)**
  - **Audit Ref**: C-1, C-2, §1.6
  - **Objective**: Set `allow write: if false;` on collections that must strictly be server-written:
    - `notifications`
    - `sms_queue`
    - `email_queue`
    - `email_alerts_queue`
    - `audit_logs`
    - `admin_login_audits`
    - `security_alerts`
    - `ai_agent_audit_logs`
    - `demand_surge_forecasts`
    - `materials_arbitrage_alerts`
    - `platform_counters`
  - All writes to these collections must occur via Firebase Admin SDK in `server.ts`.
  - **Files**: `firestore.rules`, `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 3.4: Split Public vs. Private User Profiles (GDPR / PII Protection)**
  - **Audit Ref**: C-3
  - **Objective**:
    - Restrict `users/{userId}` to owner and admin (`allow read: if isOwner(userId) || isAdmin()`).
    - Establish `public_profiles/{userId}` containing only non-sensitive public metadata (business name, trades, area postcode, rating summary, verified badges).
    - Update public search/discovery queries to read from `public_profiles`.
  - **Files**: `firestore.rules`, `src/types/index.ts`, `src/services/userService.ts`, `src/components/FindTrades.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 3.5: Marketplace Security & Loophole Hardening**
  - **Audit Ref**: H-5, H-6, H-7, Section 6
  - **Objective**:
    - **Quote Privacy**: Restrict reading of competitor quote prices on `/jobs/{jobId}/quotes` so traders cannot see competitor pricing before bidding.
    - **Tenant Issues (`H-5`)**: Remove `get, list, create, update: if true`. Require authentication or verified document access tokens.
    - **Property Transfers (`H-6`)**: Restrict property passport updates during pending transfer strictly to `pendingTransferToUid`.
    - **Instant Matches & Deals**: Prevent arbitrary assignment of `matchedTraderId` or manipulation of `claimedCount`.
    - **Promo Codes**: Disallow public listing/enumeration of `promo_codes`.
  - **Files**: `firestore.rules`
  - **Status**: `[ ] Pending`

- [ ] **Task 3.6: Path-Scoped Firebase Storage Rules**
  - **Audit Ref**: H-4
  - **Objective**: Replace the catch-all `allow read, write: if request.auth != null;` in `storage.rules` with strict path, size, and MIME-type constraints:
    - `users/{uid}/private/**`: Owner + Admin only (verification docs, IDs).
    - `users/{uid}/public/**`: Public read, Owner write (avatars, portfolio photos, max 5MB, image MIME types only).
    - `jobs/{jobId}/**`: Job participants only.
    - Default deny on all other paths.
  - **Files**: `storage.rules`
  - **Status**: `[ ] Pending`

---

## 💳 Phase 4: Financial & Business Logic Integrity
*Goal: Ensure all money, fee, and milestone calculations are server-authoritative and legally sound.*

- [ ] **Task 4.1: Server-Authoritative Taxi Trip Payments**
  - **Audit Ref**: Section 6 (`create-trip-payment`), H-9
  - **Objective**: In `/api/rides/create-trip-payment`, retrieve trip distance, duration, and pricing configuration from the Firestore `ride_requests/{rideId}` document on the server. Completely reject client-supplied `baseFare` or fee parameters.
  - **Files**: `server.ts`, `src/components/passenger/PassengerBooking.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 4.2: Driver Fee Settlement Verification via Webhook**
  - **Audit Ref**: Section 6, H-9
  - **Objective**: Remove the client-side zeroing of `pendingPlatformFees` in `PlatformFeeSuccess.tsx`. Clear driver fees strictly inside the verified Stripe webhook handler upon confirming payment completion for fee settlement sessions.
  - **Files**: `src/components/driver/PlatformFeeSuccess.tsx`, `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 4.3: Escrow & Milestone Transition Lockdown**
  - **Audit Ref**: Section 6
  - **Objective**: Disallow direct client updates to `escrowStatus` and `milestones[*].status`. Require milestone funding and milestone releases to pass through server-verified endpoints with idempotency keys.
  - **Files**: `server.ts`, `firestore.rules`, `src/components/JobDetails.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 4.4: Server-Side Rating & Review Aggregation**
  - **Audit Ref**: H-7
  - **Objective**: Block client-side writes to `rating`, `totalReviews`, and `trustScore` on user profiles. Compute rating aggregates and review cooling-off periods via server endpoint or Cloud Function triggered on review submission.
  - **Files**: `firestore.rules`, `server.ts`, `src/components/Reviews.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 4.5: Server-Enforced Job Posting Limits**
  - **Audit Ref**: Section 6
  - **Objective**: Enforce tier posting limits either inside `firestore.rules` (counting existing active jobs) or by requiring job creation to pass through a verified server endpoint that validates quotas before writing.
  - **Files**: `server.ts`, `firestore.rules`, `src/components/PostJobWizard.tsx`
  - **Status**: `[ ] Pending`

---

## 📱 Phase 5: Mobile App Store & Infrastructure Readiness
*Goal: Eliminate app-store rejection triggers, clean up native configurations, and decouple in-process cron jobs.*

- [ ] **Task 5.1: Contextual Mobile Permissions (Fix Startup Permission Blast)**
  - **Audit Ref**: P-9
  - **Objective**: Remove the immediate 1.5-second startup prompt requesting Location, Camera, and Microphone permissions simultaneously in `App.tsx:259–285`. Request permissions contextually when the user initiates relevant actions (e.g. prompt location on "Near Me" / taxi pickup; prompt camera on "Take Photo").
  - **Files**: `src/App.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 5.2: Sanitize Capacitor Mobile Configuration**
  - **Audit Ref**: M-9b, M-10, M-11
  - **Objective**:
    - Remove hardcoded development Cloud Run URLs (`ais-dev-*.run.app`) from `main.tsx` and `capacitor.config.json`.
    - Remove `"cleartext": true` from `capacitor.config.json`.
    - Remove `*.googleapis.com` from `allowNavigation`.
  - **Files**: `capacitor.config.json`, `src/main.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 5.3: Repository Hygiene & Build Artifact Removal**
  - **Audit Ref**: M-9, §9.5
  - **Objective**:
    - Remove prebuilt bundles committed inside `android/app/src/main/assets/public` and `ios/App/App/public`.
    - Add these paths to `.gitignore`.
    - Resolve package lock inconsistencies and remove temporary scratch files.
  - **Files**: `.gitignore`, `package.json`
  - **Status**: `[ ] Pending`

- [ ] **Task 5.4: Background Cron & Worker Cloud Run Decoupling**
  - **Audit Ref**: P-11, P-12
  - **Objective**: Document and decouple the 7 `node-cron` schedules and `instantMatchWorker` from the in-process web server into idempotent Cloud Scheduler triggers / Cloud Run Job endpoints to prevent duplicate runs across multi-instance scaling.
  - **Files**: `server.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 5.5: Third-Party IP Polling Removal**
  - **Audit Ref**: P-13
  - **Objective**: Remove client-side calls to `https://api.ipify.org` in `adminAuthSecurityService.ts`. Rely exclusively on server-side `req.ip` for admin session logging.
  - **Files**: `src/services/adminAuthSecurityService.ts`, `server.ts`
  - **Status**: `[ ] Pending`

---

## ⚡ Phase 6: Performance, Bundle Splitting & Code Quality
*Goal: Slash initial bundle size from 5MB to <350KB, optimize Firestore reads, and resolve type-check errors.*

- [ ] **Task 6.1: Route-Level Code Splitting & Lazy Loading**
  - **Audit Ref**: P-1
  - **Objective**: Convert 27 eager route imports in `src/App.tsx` to `React.lazy()` with a central `Suspense` fallback. Isolate heavy portals (`DriverTerminal`, `PassengerBooking`, `AnyTraderAdmin`, `CorporatePortal`) into separate chunks so regular users download minimal initial JavaScript.
  - **Files**: `src/App.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 6.2: Dynamic Imports for Heavy Libraries**
  - **Audit Ref**: P-1, P-2
  - **Objective**: Dynamically import `jspdf`, `recharts`, and maps components so they load on-demand rather than on the initial page load.
  - **Files**: `vite.config.ts`, relevant component files
  - **Status**: `[ ] Pending`

- [ ] **Task 6.3: Firestore Listener Budget & Read Optimization**
  - **Audit Ref**: P-4
  - **Objective**: Add strict `limit()` clauses to all collection-wide `onSnapshot` listeners in `Layout.tsx`, `PlatformSwitcher.tsx`, and job feeds. Prevent excessive document read billing for long-time users.
  - **Files**: `src/components/Layout.tsx`, `src/components/shared/PlatformSwitcher.tsx`, `src/components/JobFeed.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 6.4: High-Volume List Virtualization**
  - **Audit Ref**: P-6
  - **Objective**: Virtualize high-volume lists in `JobFeed.tsx` and admin tables to maintain 60fps scrolling on mobile devices.
  - **Files**: `src/components/JobFeed.tsx`, `src/components/admin/AnyTraderAdmin.tsx`
  - **Status**: `[ ] Pending`

- [ ] **Task 6.5: PWA & Workbox Cache Hash Configuration**
  - **Audit Ref**: P-7
  - **Objective**: Remove hardcoded `cacheId: 'anytrader-v1.0.4'` from `vite.config.ts`. Allow Workbox to manage cache revisions dynamically using build asset hashes to prevent chunk mismatch reloads.
  - **Files**: `vite.config.ts`
  - **Status**: `[ ] Pending`

- [ ] **Task 6.6: Fix TypeScript Compiler Errors (`npm run lint` Gate)**
  - **Audit Ref**: M-2, M-3
  - **Objective**: Triage and resolve the TypeScript errors in the codebase so that `npm run lint` (`tsc --noEmit`) passes cleanly as an automated quality gate.
  - **Status**: `[ ] Pending`

- [ ] **Task 6.7: Modularize God Components**
  - **Audit Ref**: M-1
  - **Objective**: Incrementally break down files exceeding 5,000 lines (`AnyTraderAdmin.tsx`, `DriverTerminal.tsx`, `JobDetails.tsx`, `PassengerBooking.tsx`) into modular subcomponents and custom hooks.
  - **Status**: `[ ] Pending`

---

## 📝 Change Log & Verification Records
*Record every completed task here with timestamp, verification details, and impacted files.*

| Task ID | Description | Completed At | Verification Method | Status |
| :---: | :--- | :---: | :---: | :---: |
| — | Initial plan created | 2026-09-07 | Plan initialized | Ready |
