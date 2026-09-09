# 🚀 AnyTrader V6 — Final Production Release Changelog

## Release Overview
AnyTrader V6 formalizes enterprise-grade reliability, defensive security, formal state machines, and continuous automated testing across the ecosystem.

---

### Key Architectural Enhancements

#### 1. Modular Server Architecture (`src/server/`)
- **`httpErrors.ts`**: Standardized HTTP exception hierarchy (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `InternalServerError`) with sanitized client payloads and unique audit correlation IDs.
- **`stateMachine.ts`**: Formal, mathematical state machines for Jobs, Milestones, Payments, AnyRoller Rides, and Disputes. All invalid state jumps throw `InvalidStateTransitionError` and fail closed.
- **`authorization.ts`**: Server-side BOLA/IDOR protection and mass-assignment defense. Provides `assertResourceOwner`, `assertCanAccessJob`, `assertCanSubmitQuote`, `assertCanManageMilestone`, and `sanitizeClientPayload`.
- **`paymentLedger.ts`**: Double-entry ledger engine providing atomic idempotency locks (`payment_idempotency`), preventing duplicate releases, double payouts, and client-side price tampering.
- **`domainEvents.ts`**: Structured domain event dispatcher supporting transactional persistence to `domain_events` and decoupled asynchronous event listeners.
- **`taskQueue.ts`**: Background worker queue with exponential backoff retries and status tracking in `task_queue`.
- **`productionChecks.ts`**: Runtime health scanner validating environment secrets, secret entropy, and mock payment gate status.

#### 2. Server Endpoint Refactoring & Hardening (Phase 3)
- **`/api/release-milestone`**: Fully refactored with atomic `PaymentLedgerEngine.executeIdempotentOperation`, state machine transition validation (`validateMilestoneTransition`), strict BOLA/IDOR authorization (`assertCanManageMilestone`), QR handshake authorization with 24-hour platform guarantee calculation, immutable ledger entry recording, and `MILESTONE_RELEASED` domain event dispatch.
- **`/api/jobs/create`**: Hardened with client payload mass-assignment sanitization (`sanitizeClientPayload`), initial status validation (`validateJobTransition`), and `JOB_CREATED` domain event audit logging.
- **`/api/jobs/:jobId/accept-quote`**: Hardened with homeowner resource ownership verification (`assertResourceOwner`), state machine enforcement (`validateJobTransition`), and atomic quote acceptance with `QUOTE_ACCEPTED` event dispatch.
- **`/api/reviews/submit`**: Server-authoritative review creation with self-review prevention (`reviewerId === revieweeId`), rating aggregation within Firestore transaction, state machine transition (`validateJobTransition` to `completed`), 14-day cooling off period for ratings <= 2, and fuzz-delayed notifications.
- **`/api/driver/stripe-payout` & `/api/driver/stripe-balance`**: Secured with authenticated driver verification (`assertResourceOwner`), standardized error handling (`sendHttpError`), and `DRIVER_PAYOUT_INITIATED` domain event tracking.
- **`/api/webhook`**: Hardened Stripe webhook processing for milestone payments and taxi trip completions using `PaymentLedgerEngine.recordEscrowFunding` and state machine validation.

#### 3. Automated Test Suite & Adversarial Red-Team Exploits (Phase 4 & Phase 5)
- **`tests/unit/stateMachine.test.ts`**: Validating all valid and invalid transitions across all lifecycle states (Jobs, Milestones, Payments, AnyRoller Rides) (12 tests).
- **`tests/unit/authorization.test.ts`**: Verifying authentication, admin claims, resource ownership (Customer A vs. Customer B), and mass-assignment filtering (10 tests).
- **`tests/unit/paymentLedger.test.ts`**: Verifying idempotency keys, fee calculations (12%), and deposit/payout validation (3 tests).
- **`tests/unit/productionChecks.test.ts`**: Verifying pre-flight security gates and fail-closed behaviors (3 tests).
- **`src/lib/useEntitlements.test.ts`**: Verifying role and tier entitlement evaluations (3 tests).
- **`tests/unit/adversarialRedTeam.test.ts` (Expanded 23 Exploits across 5 OWASP Risk Vectors)**:
  - **BOLA/IDOR Attacks**: Verified that User B cannot read/modify User A's private job; verified malicious tradespersons cannot modify or delete competitor quotes; verified snooping on private conversations is blocked; verified property passport mutations are restricted to legitimate owners; verified dispute eavesdropping and tampering are blocked.
  - **Property-Level Privilege Escalation & Mass-Assignment**: Verified that client attempts to inject privileged fields (`role`, `isAdmin`, `verified`, `isVerified`, `idVerified`, `paymentStatus`, `payoutStatus`, `ownerId`, `homeownerId`, `completed`, `funded`, `balance`, `credits`) are purged by `sanitizeClientPayload`; verified illegal skips directly from draft to completed are rejected.
  - **Business-Logic Abuse & Macro-Sequence Exploits**: Verified that multi-step abuse chains (Create -> Cancel -> Refund -> Recreate -> Payout) are blocked by `BusinessLogicDefense.validateEscrowReleaseEligibility`; verified that releasing unfunded milestones or executing double-dip payouts is rejected; verified transaction nonces cannot be recycled.
  - **Race Condition Defense**: Verified that concurrent money release calls, simultaneous job quote acceptances, double-spend withdrawal attempts, and concurrent property transfers execute atomically via `ConcurrencyLockEngine` with exactly 1 winner and racers rejected.
  - **Abuse & Automation Quotas**: Verified sliding-window throttling on 8 sensitive business flows (Job creation, Chat messaging, Search scraping, AI Copilot inference, Notifications, Account creation, Payment attempts, File uploads).
  - **Idempotency Replays**: Verified that replayed operations with identical idempotency keys return cached results without duplicating financial transactions or database side-effects.
- **Suite Result**: 100% passing tests (6 test files, 54/54 tests passing).

#### 4. Automated Pre-Flight Release Gate & Full Type Safety (Phase 6)
- Added `scripts/final-release-audit.mjs` executing automated pre-release scans across environment secrets, security rules, and mandatory architectural modules.
- Configured `"audit:release": "node scripts/final-release-audit.mjs"` in `package.json`.
- Integrated startup invariant check in `server.ts` logging pre-flight status on boot.
- Exposed administrative verification endpoint at `/api/admin/production-audit`.
- Full TypeScript validation (`tsc --noEmit`) passing with 0 errors across all server and client components.
- Production build (`npm run build`) passing cleanly.

#### 5. Security Rules & Storage Hardening
- Strengthened `firestore.rules` collectionGroup queries and user profile read permissions for active job participants.
- Maintained strict scoped storage policies in `storage.rules` forbidding anonymous uploads.

#### 6. End-to-End Monetization, Subscriptions & Dispute Mediation Integration (Phase 2 & Phase 3)
- **Gotham B2B SaaS Metered Licensing (£/door)**: Connected `GothamHousingPortal.tsx` SaaS Calculator and Tab 4 B2B Billing View to Stripe Checkout via `/api/create-checkout-session` (`subscriptionType: 'gotham_saas'`). Dynamically calculates metered monthly fee based on housing door count and volume pricing tiers (`calculateGothamSaaSPlan`). Webhook updates Firestore profile (`isGothamSubscriber: true`, `subscriptionType: 'gotham_saas'`, `gothamDoorsCount`, `gothamTierName`, `gothamBillingCycle`, `gothamCancelAtPeriodEnd`).
- **Gold Driver Tier (£49.99/mo)**: Connected Gold Driver subscription card in `BillingManager.tsx` to Stripe Checkout via `/api/create-checkout-session` (`subscriptionType: 'driver_gold'`). Webhook updates Firestore profile (`isGoldDriver: true`, `driverTier: 'gold'`, `commissionRate: 0.10`, `destinationFilters: 4`, `advanceBookingDays: 14`, `priorityDispatch: 50`).
- **Emergency Boost (£4.99)**: Connected `EmergencyJobWizard.tsx` and `PostJobWizard.tsx` to Stripe Checkout via `/api/create-checkout-session` (`unit_amount: 499`).
- **Landlord Pro Membership (£19/mo)**: Connected Landlord Pro membership card in `BillingManager.tsx` to Stripe Checkout via `/api/create-checkout-session` (`tierName: 'Landlord Pro'`).
- **Dispute Mediation Stake (£25.00)**: Replaced mock state updates with server-side Stripe PaymentIntent (`/api/disputes/create-stake-intent`), Stripe webhook fulfillment (`payment_intent.succeeded`), and atomic state machine transition (`funded_and_locked`).
- **Unified Self-Service Subscription Management**: Full support for `cancel_at_period_end` scheduling (`/api/cancel-subscription`), reactivation (`/api/reactivate-subscription`), and Stripe Customer Portal access (`/api/create-customer-portal-session`) across all 4 subscription types (`exclusive_leads`, `video_pro`, `gotham_saas`, `driver_gold`).

#### 7. Comprehensive Testing & Platform Integrity Verification
- **182/182 Automated Unit Tests Passing**: 100% test pass rate across 12 test suites (Mission 1 Security, Mission 2 Customer BOLA/IDOR, Mission 3 Malicious Trader, Mission 4 Financial Penetration, Mission 5 State Machine Penetration, Mission 6 Adversarial Platform Security, Adversarial Red-Team, Authorization, State Machine, Payment Ledger, Production Checks, and Entitlements).
- **0 Compilation Errors**: Verified via `compile_applet` and production build pipeline.

