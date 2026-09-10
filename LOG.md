# 📜 AnyTrader Platform — Change & Execution Log for Future Agentic Work

## 📌 Executive Summary
This document serves as an exhaustive execution and architectural change log for AI Coding Agents and developers maintaining the AnyTrader / AnyRoller ecosystem.

- **Current Status**: Production-Ready V7 Hardened Enterprise Architecture (Stripe Connect Direct Routing, Server-Authoritative Dynamic Pricing, Resilient Chunk Loading)
- **Last Updated**: September 10, 2026
- **Test Suite Status**: 195/195 Passing Unit Tests across 14 Test Suites (100% Pass Rate)
- **Compilation**: 0 Errors, Verified with `compile_applet`

---

## 📦 Build Artifacts & Dynamic Chunk Loading Resolution

### 1. Headless Utility Component Import Normalization
- Identified that headless ambient controller components (`ReferralTracker`, `RecurringJobManager`) were wrapped in `lazyWithRetry` but rendered directly inside `<BrowserRouter>` outside `<Suspense>`.
- Replaced dynamic imports with direct static imports, eliminating unhandled Suspense promise escapes that caused ErrorBoundary crashes and aborted concurrent module requests in the browser.
- Wrapped top-level `<Suspense fallback={<PageSkeleton />}>` around the entire inner router hierarchy inside `src/App.tsx`.

### 2. Build Pipeline & Deployment Verification
- Executed and validated `npm run build` (`vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`).
- Verified all client bundles, service worker assets, and server entry points are generated cleanly into `dist/`.
- Executed `lint_applet` (`tsc --noEmit`) with 0 errors and `compile_applet` with 100% successful build output.

---

## 🛡️ V7 Security Audit Remediation (14/14 Findings Remediated)

### 1. Server-Authoritative Stripe Pricing Catalog (C-01 & C-02)
- Replaced client-supplied `price_data.unit_amount` with authoritative server-side catalog mapping in `server.ts`.
- Supported tiers & services: `price_payg` (£0), `price_pro` (£29.00/mo), `price_premium` (£49.00/mo), `price_exclusive_leads` (£15.00/mo), `price_video_pro` (£10.00/mo), `price_landlord` (£19.00/mo), `price_driver_gold` (£49.99/mo), `price_emergency_boost` (£4.99), `price_dispute_stake` (£25.00), and Gotham B2B SaaS metered licensing based on verified door count.
- Sanitized `metadata` to strictly bind `userId`, `tierId`, and `subscriptionType`, ignoring any user-injected `role` or `isVerified` flags.

### 2. Firestore Secrets Isolation (H-01)
- Added explicit denial rule for `/platform_config/secrets` in `firestore.rules` (`allow read, write: if false;`).
- Removed `onSnapshot` secret listener and client-side updates in `AnyTraderAdmin.tsx`. API keys are strictly configured via server environment variables (`.env`).
- Deployed rules via `deploy_firebase`.

### 3. In-Memory OAuth Token Isolation (H-02)
- Replaced `localStorage` persistence with secure in-memory token closures across `googleCalendarService.ts`, `googleDriveDocsService.ts`, and `googleSheetsService.ts`.

### 4. Storage Rules Participant Verification (H-03)
- Secured `storage.rules` across `/chats`, `/disputes`, `/properties`, and `/vehicles` using Firestore lookup helpers verifying participant identity before read/write access.

### 5. Abuse Defense Rate-Limiting Active Mounting (H-04)
- Mounted `AbuseDefenseEngine` token-bucket rate limiter onto `/api/create-checkout-session`, `/api/cancel-subscription`, `/api/reactivate-subscription`, `/api/create-customer-portal-session`, and `/api/disputes/create-stake-intent`.

### 6. PII & Data Privacy Hardening (H-05, H-06, H-07)
- Restricted `/users/{userId}` reads to account owners, admins, or public service profiles.
- Restricted `/live_tracking/{rideId}` reads to passenger, assigned driver, or admin.
- Enforced sender verification on `/notifications/{notificationId}` creation.
- Restricted `/rateCards/{id}` and `/availabilityWindows/{id}` to consultant owners or admins.

### 7. Production Security Headers & CORS Lockdown (M-01 & M-02)
- Added CSP, X-Frame-Options, HSTS, and X-Content-Type-Options headers in `server.ts`.
- Restricted CORS origins to authorized domain list.

---

## 🛠️ Key Architectural & Monetization Implementations

### 1. Gotham B2B SaaS Housing Association Metered Licensing (`GothamHousingPortal.tsx` & `server.ts`)
- **Checkout Session Flow**: Wired the interactive SaaS Calculator Modal and Tab 4 B2B Billing View in `GothamHousingPortal.tsx` to Stripe Checkout via `POST /api/create-checkout-session` (`subscriptionType: 'gotham_saas'`).
- **Dynamic Metered Pricing**: Volume pricing engine (`calculateGothamSaaSPlan`) calculates monthly fees based on property door count (£4.50/door for 1–100 doors, £3.50/door for 101–1,000 doors, £2.50/door for 1,000+ doors) with a 15% discount for annual billing.
- **Webhook Fulfillment**: `server.ts` webhook handler processes `checkout.session.completed` for `gotham_saas`, updating Firestore (`isGothamSubscriber: true`, `subscriptionType: 'gotham_saas'`, `gothamDoorsCount`, `gothamTierName`, `gothamBillingCycle`, `gothamCancelAtPeriodEnd: false`).
- **Subscription Management**: Supports 1-click cancellation scheduling (`/api/cancel-subscription`), auto-renewal resumption (`/api/reactivate-subscription`), and Stripe Customer Portal sessions (`/api/create-customer-portal-session`).

### 2. Gold Driver Subscription Tier (£49.99/mo) (`BillingManager.tsx` & `server.ts`)
- **Checkout Session Flow**: Wired the Gold Driver Tier subscription card in `BillingManager.tsx` to Stripe Checkout via `POST /api/create-checkout-session` (`unit_amount: 4999`, `subscriptionType: 'driver_gold'`).
- **Driver Entitlements**: Unlocks a reduced 10% platform commission rate, 4 daily destination filters, a 14-day advance booking window, and +50 score priority ride dispatch.
- **Webhook Fulfillment**: Webhook handler updates driver profile in Firestore (`isGoldDriver: true`, `driverTier: 'gold'`, `commissionRate: 0.10`, `destinationFilters: 4`, `advanceBookingDays: 14`, `priorityDispatch: 50`).
- **Subscription Management**: Integrated 1-click self-service cancellation scheduling, reactivation, and Stripe Customer Portal access.

### 3. Homeowner & Landlord Monetization Wires (`EmergencyJobWizard.tsx`, `PostJobWizard.tsx`, `BillingManager.tsx`)
- **Emergency Boost (£4.99)**: Connected emergency job posting workflows to `/api/create-checkout-session` (`unit_amount: 499`), unlocking immediate 2-hour SLA response dispatch upon webhook confirmation.
- **Landlord Pro Membership (£19/mo)**: Connected Landlord Pro membership card to `/api/create-checkout-session` (`tierName: 'Landlord Pro'`), unlocking multi-property portfolio automation, CP12 & EICR compliance tracking, and 1-tap specs dispatch.

### 4. Dispute Mediation Stake (£25.00) (`DisputeDetails.tsx` & `server.ts`)
- **PaymentIntent Handshake**: Replaced client-side state bypass with server-side PaymentIntent endpoint `POST /api/disputes/create-stake-intent` (£25.00 stake).
- **Fulfillment & State Machine**: `payment_intent.succeeded` webhook handler atomically updates dispute state to `funded_and_locked`, preventing malicious dispute spam while guaranteeing mediation coverage.

### 5. Unified Subscription Lifecycle Endpoints (`server.ts`)
- **`POST /api/cancel-subscription`**: Supports `subscriptionType` values (`'tier'`, `'exclusive_leads'`, `'video_pro'`, `'gotham_saas'`, `'driver_gold'`). Sets `cancel_at_period_end: true` on Stripe and updates Firestore.
- **`POST /api/reactivate-subscription`**: Sets `cancel_at_period_end: false` on Stripe and updates Firestore.
- **`POST /api/create-customer-portal-session`**: Generates a self-service Stripe Billing Portal session for payment method updates and invoice downloads.

### 6. Stripe Connect Direct Destination Routing & Zero Platform Custody (`src/server/pricingCatalog.ts` & `server.ts`)
- **Zero Custody of Client Funds**: Platform strictly forbids taking custody of homeowner milestone funds into platform operational bank accounts.
- **Destination Charge Routing**: Milestone escrow checkout sessions enforce `payment_intent_data.transfer_data.destination = traderStripeAccountId`, routing 100% of client escrow directly to the verified tradesperson's connected Stripe account.
- **Platform Application Fee**: Platform commission (default 12% or dynamic trader tier rate) is captured strictly via `payment_intent_data.application_fee_amount`.
- **Connected Account Validation**: Before checkout creation, server verifies the tradesperson's profile has a valid `stripeAccountId`. If missing, returns a descriptive error guiding the trader to complete Stripe onboarding.
- **Double-Entry Ledger Audit**: All transactions record `destinationAccountId`, `stripeTransferId`, `transferStatus`, `amount`, `platformFee`, and `netPayout`.

### 7. Dynamic Admin-Controlled Pricing & Commission Overrides (`src/server/pricingCatalog.ts`)
- **Server-Authoritative Catalog**: Discards arbitrary client-supplied `price_data.unit_amount` and `amount` parameters, preventing client-side price tampering.
- **Dynamic Firestore Resolution**: Queries `platform_config/global_tiers` and `platform_config/global` for admin-configured price and commission overrides made via `AdminTierManager.tsx` or `AnyTraderAdmin.tsx`.
- **Dynamic Commission Rates**: Computes milestone escrow commission dynamically based on admin tier settings (`providerModels.one_off_trades.tiers[tier].commission`).
- **Dynamic Tier & Add-On Pricing**: Subscription tiers (Pro, Premium, Platinum, Driver Gold, Landlord Pro) and add-ons (Emergency Boost, Instant Match, Verified Video Pro, Exclusive Leads, Dispute Stake) dynamically honor admin overrides with safe catalog fallbacks.
- **In-Memory Cache**: Cached with 5-second TTL per database instance to eliminate Firestore read amplification while responding immediately to admin updates.
- **Security Rule Protection**: Admin configuration is guarded by `firestore.rules` (`allow write: if isAdmin()`), completely preventing client-side manipulation.

### 8. Webhook Underpayment Defense (`server.ts`)
- **Fail-Closed Underpayment Check**: Webhook handler recalculates the authoritative expected pence from database records and rejects any session where `session.amount_total < expectedAmountPence`.
- **Cryptographic Signature Verification**: HMAC-SHA256 signature verification fail-closed gate blocks forged or simulated webhook events in production.

### 9. BOLA & State Machine Exploits (Critical & High)
- **Escrow Release Invariant**: Integrated `BusinessLogicDefense.validateEscrowReleaseEligibility` directly into the `POST /api/release-milestone` endpoint in `server.ts`, preventing escrow release on cancelled, refunded, or disputed jobs.
- **Server-Authoritative Ride Acceptance**: Moved taxi ride acceptance from client-side Firestore mutations to a secure `POST /api/rides/accept` endpoint. Hardened `firestore.rules` to prevent mass-assignment BOLA attacks on `ride_requests`.
- **Tenant Issues DoS Defense**: Added `isSignedIn()` check to `/tenant_issues/{issueId}` creation rule, preventing unauthenticated resource exhaustion.
- **Shop Orders Mass-Assignment**: Restricted `/shop_orders/{orderId}` creation rule to explicitly reject `paid`, `status`, `total`, and `fulfilled` flags from client payloads.

---

## 🧪 Security & Verification Invariants (Audited September 10, 2026)

All **195 unit tests across 14 test suites** are passing 100%:
1. `tests/unit/stripeConnectFinancialAudit.test.ts` (6/6 tests passing): Strict Stripe Connect destination routing for client funds, zero platform custody, server-authoritative dynamic pricing catalog with Firestore admin overrides, volume-tiered B2B SaaS math, and client price tampering defense.
2. `tests/unit/vulnerabilityFixesV7.test.ts` (7/7 tests passing): Escrow bypass rejection, BOLA checks, rate limiting integration, error sanitization, and mass-assignment defense.
3. `tests/unit/adversarialPlatformSecurity.test.ts` (19/19 tests passing): Multi-tenant estate B2B SaaS IDOR, taxi ride BOLA & lifecycle hijacks, 1-to-1 direct quote interception, tenant repair report PII protection, and concurrent double-spend / double-accept / ownership locks.
4. `tests/unit/mission5StateMachinePenetration.test.ts` (29/29 tests passing): State machine and concurrent sequence penetration defense across illegal jumps and racing actions.
5. `tests/unit/mission4FinancialPenetration.test.ts` (16/16 tests passing): Financial system penetration defense across price substitution, currency swap, metadata manipulation, cross-job binding, replay attacks, duplicate payout locks, and double-entry ledger invariants.
6. `tests/unit/maliciousTraderMission3.test.ts` (23/23 tests passing): Malicious trader marketplace penetration defense across job acceptance hijack, quote tampering, milestone release, PII snooping, completion manipulation, payout/fee manipulation, and review tampering.
7. `tests/unit/customerVsCustomerMission2.test.ts` (28/28 tests passing): Customer vs Customer BOLA/IDOR defense across 9 vectors with forward (A → B) and reverse (B → A) matrices.
8. `tests/unit/unauthenticatedAttackerMission1.test.ts` (13/13 tests passing): Unauthenticated attacker penetration defense covering private reads, storage enumeration, PII protection, API abuse, Gemini privilege escalation, and production error sanitization.
9. `tests/unit/adversarialRedTeam.test.ts` (23/23 tests passing): IDOR/BOLA defense, parameter injection/mass-assignment filtering, macro-sequence attack prevention, concurrent money release/acceptance race condition locks, and financial idempotency replay defense.
10. `tests/unit/authorization.test.ts` (10/10 tests passing): Strict resource ownership validation, admin privilege verification, quote submission permissions, milestone management, and sanitized client payload generation.
11. `tests/unit/stateMachine.test.ts` (12/12 tests passing): State machine transition validation across Jobs, Milestones, Payments, AnyRoller Taxi Trips, and Disputes.
12. `tests/unit/paymentLedger.test.ts` (3/3 tests passing): Deterministic 12% platform fee calculation, double-entry escrow tracking, and idempotent operation replay.
13. `tests/unit/productionChecks.test.ts` (3/3 tests passing): Environment variables and pre-flight security gates.
14. `src/lib/useEntitlements.test.ts` (3/3 tests passing): User entitlement evaluation and role enforcement.

---

## 📋 Guidelines for Future Agentic Work
1. **Always Read `DEVELOPMENT.md`**: Review synchronization rules before making cross-portal or schema changes.
2. **Preserve Locked Systems**: The AI Bot Recommendation Engine (`aiRecommendationService.ts`) and Hard Domain Gating are locked. Do NOT introduce cross-trade bridge aliases.
3. **Zero Platform Custody**: Never route homeowner milestone payments to the platform Stripe balance; always route directly to `traderStripeAccountId` with `application_fee_amount`.
4. **Server-Authoritative Pricing**: Never accept client-supplied prices or fees; always resolve through `resolveAuthoritativeLineItem` in `src/server/pricingCatalog.ts`.
5. **Admin Configuration Invariant**: Ensure admin pricing adjustments saved in `platform_config/global_tiers` and `platform_config/global` are resolved by the server without code re-deployment.
6. **Run `npm test` and `compile_applet`**: After making file edits, run full verification to ensure 100% test pass rate and clean compilation.
