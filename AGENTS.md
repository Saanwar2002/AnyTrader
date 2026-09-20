# Project State & Instructions

## Core Directive
- **CRITICAL**: This is a multi-portal ecosystem (Home + Rides) sharing one database.
- **MANDATORY**: You **MUST** read `DEVELOPMENT.md` before modifying any shared services, database schemas (`firebase-blueprint.json`), or security rules (`firestore.rules`). Failure to do so will break cross-portal synchronization.
- **DOCUMENTATION**: You **MUST** update `DEVELOPMENT.md` after completing your work to capture any architecture or schema changes for the next agent.

## Current Status
- **Last Updated**: 2026-09-20
- **Working State**: Application is fully functional with Enterprise V6/V7 Modular Server Architecture, V8.1 Structured Intelligence Engine, V8.2 Task 19 Property Evidence & Component Ontology, V8.2 Task 20 Property Condition & Lifecycle Intelligence, V8.2 Task 20V Property Lifecycle Remediation (database-bounded queries, fail-closed security rules, 10-vector security tests, atomic transactions, outcome evidence verification, fail-hard emulator test setup), Server-Authoritative Pricing Catalog (`pricingCatalog.ts`), Stripe Connect Direct Routing, Formal State Machines, Payment Ledger, Concurrency Locks, Business-Logic Abuse Defense, and 100% Automated Test Pass Rate (598/598 unit tests passing across 39 test suites).
- **V8.2 Task 20 & Task 20V Remediation Final Audit Status (Audited September 20, 2026)**:
  - **Audit Status**: **VERIFIED & CLOSED — 100% AUDIT PASS (GO FOR RELEASE)** (Documented in `/TASK_20_PROPERTY_CONDITION_LIFECYCLE_REPORT.md` and `DEVELOPMENT.md`).
  - **Comprehensive Test Results**:
    - **Unit Test Suite**: 598/598 tests passing across 39 test files (including 13 tests in `tests/unit/task20UnitTests.test.ts`).
    - **Task 20 Real Emulator Test Suite**: 16/16 tests in `tests/unit/task20PropertyConditionLifecycle.test.ts` (fails hard if emulator setup is unreachable; cannot silently skip).
    - **Typecheck & Lint (`npm run lint`)**: 0 errors (`tsc --noEmit` clean).
    - **Applet Compilation (`compile_applet`)**: Succeeded cleanly.
  - **0 Defects Discovered**: Production code verified 100% clean across Tasks 1–17.
  - **Comprehensive Test Results (785/785 Total Passing)**:
    - **Firebase Emulator Test Suite**: 219/219 tests passing (`firebaseEmulatorSecurityRules.test.ts`: 114, `firebaseEmulatorIntelligenceV81.test.ts`: 84, `task16TierBStorage.test.ts`: 21).
    - **Unit Test Suite**: 566/566 tests passing across 37 test files (including 12 tests in `tests/unit/task17PropertySecurity.test.ts`).
    - **Typecheck & Lint (`npm run lint`)**: 0 errors (`tsc --noEmit` clean).
    - **Release Gate (`npm run audit:release`)**: Passed 100%.
    1. `tests/unit/stripeConnectFinancialAudit.test.ts` (6 tests, 100% pass): Strict Stripe Connect destination charge routing for client funds, zero platform custody, server-authoritative pricing catalog with dynamic Firestore admin overrides for tiers/add-ons/commissions, volume-tiered B2B SaaS math, and price manipulation defense.
    2. `tests/unit/vulnerabilityFixesV7.test.ts` (7 tests, 100% pass): Escrow bypass rejection, BOLA checks, rate limiting integration, error sanitization, and mass-assignment defense.
    3. `tests/unit/adversarialPlatformSecurity.test.ts` (19 tests, 100% pass): Multi-tenant estate B2B SaaS IDOR, taxi ride BOLA & lifecycle hijacks, 1-to-1 direct quote interception, tenant repair report PII protection, and concurrent double-spend / double-accept / ownership locks.
    4. `tests/unit/mission5StateMachinePenetration.test.ts` (29 tests, 100% pass): State machine and concurrent sequence penetration defense across illegal jumps (draft→completed, draft→paid, cancelled→completed, completed→funded, released→funded, refunded→released, etc.) and racing actions (`release()+release()`, `cancel()+release()`, `accept()+accept()`, `fund()+refund()+release()`, `withdraw()+withdraw()`).
    5. `tests/unit/mission4FinancialPenetration.test.ts` (16 tests, 100% pass): Financial system penetration defense across 7 vectors (price/amount substitution, currency swap, metadata manipulation, cross-job/cross-user binding, webhook/payment replay, duplicate/concurrent payout locks, failed/cancelled payment rejection, and zero-drift double-entry ledger).
    6. `tests/unit/maliciousTraderMission3.test.ts` (23 tests, 100% pass): Malicious trader marketplace penetration defense across 9 vectors (job acceptance hijack, quote modification/deletion, milestone escrow release, customer PII & property access, completion manipulation, payout/fee manipulation, review manipulation, availability/calendar tampering, trader impersonation).
    7. `tests/unit/customerVsCustomerMission2.test.ts` (28 tests, 100% pass): Customer vs Customer BOLA/IDOR defense across 9 vectors (access job, modify job, read messages, access property, access dispute, submit review, release milestone, manipulate payment, access private files) with forward (A → B) and reverse (B → A) matrices.
    8. `tests/unit/unauthenticatedAttackerMission1.test.ts` (13 tests, 100% pass): Unauthenticated attacker penetration defense covering all 12 threat vectors (private Firestore reads, storage enumeration, job & user enumeration, PII protection, API abuse, Gemini privilege escalation, payment endpoint abuse, Stripe webhook manipulation, rate-limit bypass, and production error-information leakage).
    9. `tests/unit/adversarialRedTeam.test.ts` (23 tests, 100% pass): IDOR/BOLA defense, parameter injection/mass-assignment filtering, macro-sequence attack prevention, concurrent money release/acceptance/double-spend race condition locks, multi-flow abuse rate-limiting, and financial idempotency replay defense.
    10. `tests/unit/authorization.test.ts` (10 tests, 100% pass): Strict resource ownership validation, admin privilege verification, quote submission permissions, milestone management, and sanitized client payload generation.
    11. `tests/unit/stateMachine.test.ts` (12 tests, 100% pass): State machine transition validation across Jobs, Milestones, Payments, AnyRoller Taxi Trips, and Disputes.
    12. `tests/unit/paymentLedger.test.ts` (3 tests, 100% pass): Deterministic 12% platform fee calculation, double-entry escrow tracking, and idempotent operation replay.
    13. `tests/unit/productionChecks.test.ts` (3 tests, 100% pass): Environment variables and pre-flight security gates.
    14. `src/lib/useEntitlements.test.ts` (3 tests, 100% pass): User entitlement evaluation and role enforcement.
    15. `tests/unit/notificationQueueSecurityH3.test.ts` (14 tests, 100% pass): Server-authoritative notifications, SMS/Email queue locking, and rate limiting.
    16. `tests/unit/notificationAuthorizationH3A.test.ts` (9 tests, 100% pass): Elimination of recipient existence fallback; mandatory authoritative relationship verification across Job, Conversation, Project, and Ride contexts.
  - **OWASP API 5-Vector Defenses Enforced**:
    - **Vector 1: IDOR / BOLA**: `src/server/authorization.ts` (`assertCanAccessJob`, `assertCanModifyJob`, `assertCanAccessProperty`, `assertCanModifyProperty`, `assertCanModifyQuote`, `assertCanDeleteQuote`, `assertCanAccessDispute`, `assertCanModifyDispute`) + `firestore.rules` participant validation on `/conversations/{conversationId}/messages/{messageId}`.
    - **Vector 2: Property-Level Privilege Escalation**: `SERVER_OWNED_PROTECTED_KEYS` strips 25+ privileged attributes (`role`, `isAdmin`, `verified`, `isVerified`, `idVerified`, `paymentStatus`, `payoutStatus`, `ownerId`, `homeownerId`, `completed`, `funded`, `balance`, `credits`) from client inputs; `firestore.rules` enforces `.diff(resource.data).affectedKeys().hasAny([...])` rejection on protected user and job keys.
    - **Vector 3: Business-Logic Abuse**: `src/server/businessLogicDefense.ts` (`validateEscrowReleaseEligibility`, `validateLifecycleSequence`, `verifyAndConsumeTransactionNonce`) blocks macro-sequence exploits (e.g. Create -> Cancel -> Refund -> Recreate -> Payout).
    - **Vector 4: Race Conditions**: `src/server/concurrencyLock.ts` (`atomicReleaseMilestone`, `atomicAcceptJob`, `atomicWithdrawFunds`, `atomicTransferOwnership`) ensures atomic execution under simultaneous requests.
    - **Vector 5: Abuse & Automation**: `src/server/abuseDefense.ts` sliding-window token bucket engine enforces strict velocity quotas on 8 sensitive business flows (Job creation, Chat messaging, Scraping/Search, AI Copilot calls, Notifications, Account creation, Payment attempts, File uploads).
  - **Locked AI Bot Trader Recommendation Engine & Hard Domain Gating (`aiRecommendationService.ts`, `TradeBot.tsx`)**:
    - **CRITICAL / DO NOT MODIFY WITHOUT EXPLICIT USER CONSENT**:
    - Strict Intra-Domain Separation: `getCategoryAliases` dynamically synchronizes with `categoryRegistry` and `getCategoryMetadata`. Bridge aliases (e.g. associating "security systems" with both "Electrical" and "Locksmith") are STRICTLY FORBIDDEN. Distinct disciplines (Electrical, Locksmith, Plumbing, Gas & Heating, Security Systems, Manned Guarding, Carpentry, etc.) must remain isolated.
    - Hard Primary-Domain Gate (`calculateTradeRelevanceScore`): A tradesperson MUST possess at least one primary trade, registered category, or certified specialization matching the requested target domain or canonical synonyms before scoring. Ancillary tags, secondary cross-trade services (e.g., CCTV or alarms offered by a locksmith), or user query keywords CAN NEVER qualify an out-of-domain trader. If this primary gate fails, the relevance score is strictly `0` (rejection).
    - Slot Allocation Discipline (`getHybridTraderRecommendations`): Slot 1 (Featured Partner) and Slot 2 (Organic Fair Rotation) select strictly from candidates passing the hard domain gate (`tradeScore > 0`). If no secondary candidates exist within that trade domain, Slot 2 does NOT backfill with unrelated trades.
  - **Quote Deletion Permissions & Lifecycle (`firestore.rules`, `MyQuotes.tsx`)**: Resolved permission error on quote deletion by adding explicit `allow delete` rules for `/jobs/{jobId}/quotes/{quoteId}` for the quote owner/trader, homeowner, or platform admin. Synced parent job `quoteCount` decrement on deletion.
  - **Tradesperson Category Job Feed Filter Precision & Dual-Mode Matching (`JobFeed.tsx` & `matchingEngine.ts`)**: Removed Nearby Requests section from Job Feed completely. Kept "Best Match" toggle ON by default for tradespeople unless explicitly toggled off. Fixed false-positive matches by hard-capping match scores at 10 for out-of-domain trades. When "Best Match" is ON (Strict Mode), requires direct trade category alignment, direct service alignment, or verified subcategories. When "Best Match" is OFF (Relaxed Relevance Mode), relaxes constraints to surface all jobs aligning with trader's trade skills, category, tags, or offered services (including category synonyms and related terms) while STILL strictly excluding completely unrelated random cross-domain categories (e.g. Baker never sees Boiler Repair or Roofing). Homeowners/guests retain full-marketplace browsing.
  - **Direct 1-to-1 Quote Request Trader Profile Name Display (`JobDetails.tsx`)**: Replaced generic "Waiting for quotes..." and area broadcast review messaging on 1-to-1 direct quote requests with personalized trader profile headers (`Waiting for [Trader Profile Name]...` and `Direct 1-to-1 quote request sent to [Trader Profile Name]...`).
  - **Mobile Capacitor Input Accessibility & Full-Screen Responsive Chat (`Layout.tsx`, `Chat.tsx`)**: Uncovered chat text input field by automatically hiding mobile bottom nav bar on active `/chat/*` routes and adjusting viewport height (`flex-1 h-full min-h-[calc(100dvh-104px)]`) with safe-area bottom inset padding (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`).
  - **Real-Time Notification & Message Sound Alerts (`sound.ts`, `Layout.tsx`, `Chat.tsx`, `RideChat.tsx`)**: Dual-tone Web Audio API sound chime (E5 -> A5) with WebAudio context resume unlock and Capacitor `triggerHaptic(ImpactStyle.Medium)` haptic pulse triggered automatically on every incoming message or alert.
  - **PWA Mobile App Icon & Installed Home Screen App (`manifest.json` & `index.html`)**: Fully configured Progressive Web App manifest (`manifest.json`), high-resolution app store icon assets (`app-icon.jpg`, `pwa-192.jpg`, `pwa-512.jpg`, `apple-touch-icon.jpg`), dark navy theme color (`#002B5C`), and standalone iOS/Android home screen launcher tags for seamless native-like installation.
  - **Responsive Full-Screen 5-Second Poster Splash Screen with Logo Motion (`SplashScreen.tsx`)**: Responsive full-screen startup splash overlay with Framer Motion scale & pulse logo animations, animated top run-down timer bar (100% to 0% over 5s), live countdown badge ("Auto-close in 5s"), skip button, dual-column breakdown (Homeowner benefits on left, Tradesperson Zero-Lead-Fee callouts on right), 86+ categories, and TradeOS branding.
  - **General Labour, Trade Mates & Site Helpers (Category 86)**: Platform-wide category enabling homeowners and primary tradespeople to post jobs or hire manual assistance for garden digging, trenching, material offloading (plasterboard, bricks, timber), demolition & strip-out, skip loading, and trade mate support with CSCS card badges and fuzzy match indexing.
  - **B2B Social Housing & Portfolio SaaS ("Gotham" Layer Subscription)**: Per-door monthly licensing engine (`calculateGothamSaaSPlan` & `CorporatePortal.tsx`) charging housing associations, local councils, and private landlord portfolio managers a volume-tiered fee (£4.50/door for Starter 1-100 doors, £3.50/door for Growth 101-1,000 doors, £2.50/door for Enterprise 1,000+ doors) with 15% annual billing discounts, interactive pricing & ROI calculator modal (10–50,000 doors), consolidated MTD invoicing, estate-level per-door fee allocation, and dynamic estate onboarding recalculation.
  - **Refined Tokenized Keyword Search Matching**: Platform-wide matching engine (`fuzzyMatch.ts`) enforcing front-of-word prefix matching for the first 3-4 letters of keywords across service categories, trader tags, skills, and profiles — preventing partial word substring matches in the middle/end of words (e.g. `pet` matches `Pet Sitting` but never `Carpet`).
  - **On-Demand Delivery & Bulky Goods Courier (Category 84)**: Dedicated category supporting ASAP parcel delivery, same-day courier dispatch, bulky item & heavy appliance transport (washing machines, fridges, dishwashers, cookers), marketplace & store pickups (eBay, Facebook, B&Q, Currys), and on-demand van dispatch with full fuzzy search indexing.
  - **Mobile Bin Cleaning Services**: Dedicated subcategories under `Specialist Cleaning` (`Wheelie Bin Cleaning`) and `Industrial & Commercial Cleaning` (`Bin Store / Refuse Area Cleaning`) with keywords for domestic and commercial bin washing.
  - **BNPL & Large Repair Financing ("FlexiPay")**: Integrated BNPL financing options for major unexpected homeowner repairs (£1,000+) supporting 3-12 month terms, 0% APR on 3-6 months, and 1-tap pre-approval.
  - **Property Risk Analytics**: Aggregate property health and insurance risk scoring across 4 vectors (Roofing, Electrical, Plumbing, Damp/Mould), insurance discount estimation (up to 20%), and 5-year maintenance expenditure forecasting.
  - **B2B Enterprise & Housing Association Portal ("Gotham" Layer)**: High-capacity command center handling thousands of social housing units, real-time SLA repair time tracking (Emergency 2h SLA, Urgent 24h SLA, Routine 5-day SLA), Awaab's Law damp & mould compliance, 1-tap auto-dispatch, and contractor performance matrix.
  - **AI Pre-Quote Price Guide**: Real-time benchmark price ranges, postcode surcharge analysis, seasonal impact forecasts, and material vs labor breakdown before posting jobs.
  - **40+ Signal Intelligent Matching Engine**: Multivariate trader scoring system factoring rating history, location proximity, past job similarity, video verification, and schedule availability.
  - **Trader Video Credential Verification**: Live camera recorder & file uploader enabling 15-30s video selfie credential intros with trust badges (+35 match points).
  - **Multi-Property Landlord Portfolio Automation**: Bulk CP12 & EICR compliance tracking across property portfolios with ⚡ 1-click auto-dispatch to local verified engineers.
  - **Tenant Access & Repair Reporting Bridge**: Dedicated tenant portal (`/tenant-report`) allowing tenants to log repairs directly into property passports with in-app WhatsApp & link sharing.
  - **Automated Trade Booking via Passport Specs**: 1-Tap Trade Dispatch pre-loaded with boiler brand/model, roof condition, EPC ratings, access instructions, and tenant contact info.
  - **Strategy 1 Privacy Share Bridge**: Secure in-app privacy URL generation for WhatsApp sharing of Jobs, Quotes, Invoices, and Property Passports without exposing personal phone numbers or emails.
  - **Property Passport Digital Twin**: Landlord and Homeowner digital specs dashboard tracking EPC ratings, CP12 & EICR compliance expiration dates with automated alerts, maintenance history, ROI calculations, and AI predictive maintenance.
  - **TradeOS Financials & Cash Flow Engine**: Real-time cashflow dashboard tracking paid earnings, outstanding invoices, and UK Sole Trader Self-Assessment tax & NI reserves.
  - **Materials Procurement & AI Sourcing**: Material line item tracker with automated AI material list generation & trade market price estimator.
  - **Firebase Category Registry & Gemini Dynamic Prompt Layer (`categoryRegistrySync.ts`, `geminiServer.ts`)**: Built real-time in-memory category registry manager syncing active Firestore categories and search synonyms directly into Gemini system prompt instructions, ensuring the AI Copilot and search engines always reflect current platform categories and newly onboarded trades.
  - **Trader Onboarding Category Search Box (`Onboarding.tsx`)**: Real-time search bar at the top of the trader trade selection screen with multi-attribute filtering (category names, subcategories, certifications), instant 1-tap clear button, matching count indicator, and matched service highlights.
  - **Extensive Service Catalog**: 96 major categories and 840+ subcategories, including dedicated "Van Hire & Commercial Vehicle Rental" (Category 95) and "Tyres, Wheels & Mobile Tyre Fitting" (Category 96).
  - **Live Driver Terminal**: High-accuracy GPS tracking, session lifecycle timers, and a persistent status HUD.
  - **Phase 2, Phase 3 & Phase 7 Stripe Monetization, Subscriptions & Dispute Stake**: Replaced client-side state bypasses with full Stripe Checkout sessions & PaymentIntents (`/api/create-checkout-session`, `/api/disputes/create-stake-intent`), server-side webhook fulfillment (`checkout.session.completed`, `payment_intent.succeeded`), and 1-click self-service cancellation & reactivation (`/api/cancel-subscription`, `/api/reactivate-subscription`, `/api/create-customer-portal-session`) across Emergency Boost (£4.99), Landlord Pro Membership (£19/mo), Gotham B2B SaaS Metered Billing, Gold Driver Tier (£49.99/mo), and Dispute Mediation Stake (£25.00).
  - **Direct-to-Driver QR Payments**: Fully integrated Stripe Connect split-payment system with automatic 12% commission deduction.

## Active Task
- **Completed**: Task 19 — Property Evidence & Component Ontology implemented and verified. Created deterministic Property Component Ontology (`propertyOntology.ts`, `PROPERTY_COMPONENT_TYPES`, `normalizeComponentType`, `validateComponentType`), structured `PropertyComponentEvidence` model with SHA-256 `contentHash`, server-authoritative `Job -> Property -> Component -> Evidence` lineage checks via `resolveAuthoritativeJobPropertyId`, AI security boundary non-promotion enforcement (`[AIPrivilegeEscalation Violation]`), and cross-tenant isolation defense (`[CrossTenantContamination Violation]`). Verified 14/14 unit tests in `task19PropertyEvidenceOntology.test.ts` and 111/111 intelligence unit tests. Created `/TASK_19_PROPERTY_EVIDENCE_COMPONENT_ONTOLOGY_REPORT.md` and updated `DEVELOPMENT.md`.

## Project Conventions
- **Styling**: Tailwind CSS with a "Modern Professional" aesthetic.
- **Card & Box Styling**: Whenever creating placeholders, boxes, or cards (small or big), MUST strictly use a compact square with rounded edges. For light backgrounds (e.g. `bg-white`, `bg-slate-50`), use a thin jet black border (`border border-black`). For dark backgrounds (e.g. `bg-slate-900`, `bg-black`), use a thin white border (`border border-white/20` or `border border-white`). Do not use other border colors or styles unless explicitly requested.
- **Typography**: Always use jet black (`text-black`) for any text which is meant to be readable.
- **Icons**: Lucide React.
- **Animations**: Motion (framer-motion).
- **Driver Terminal UI**: The styling for the heads-up navigation text (directions over the map) MUST REMAIN transparent background, dark blue (`#2563EB`) font color, with a faint white drop shadow (`drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]`), no text stroke, and no black background box. This has been explicitly locked by the user.
- **AI Recommendation Engine & Hard Domain Gate**: The matching logic in `src/services/aiRecommendationService.ts` and `src/components/TradeBot.tsx` is **LOCKED BY THE USER**. Future agents are STRICTLY FORBIDDEN from introducing cross-trade bridge aliases (e.g. bridging Security Systems with Electrical or Locksmith) or relaxing the Hard Primary-Domain Gate. Ancillary skills, secondary services, or query token matches must NEVER qualify an out-of-domain trader. Slot 2 must NEVER backfill with unrelated trades.
- **Premium Anti-Glare Golden Map Theme**: The Google Map within the Driver Terminal and Passenger Booking must strictly use the custom "Premium Anti-Glare Golden" JSON styling scheme (found in `premiumMapOptions` with a `#ebe3cd` geometry base and dark contrast labels). Do NOT add a `mapId` parameter to the `<GoogleMap>` component options or hook as it enforces WebGL Vector Map styling which overrides and breaks the custom JSON styles.
- **Database**: Firestore (Enterprise Edition).
- **AI**: Gemini API (@google/genai) for all intelligent features.
- **Review System**: 14-day cooling-off period for low ratings, anonymous reviews, and notification fuzzing for low-rating alerts.
- **Notifications**: In-app notifications with `visibleAt` timestamps for delayed delivery.
- **Admin**: Trust & Fairness Engine settings for serial complainer protection, newcomer boosts, and fair job distribution.

## Recovery Instructions
If you need to revive the project or understand the current architecture:
1. **Read `DEVELOPMENT.md`** first to understand the multi-portal synchronization rules.
2. Check `firebase-blueprint.json` for the shared data model.
3. Check `ROADMAP.md` for planned features.
4. The main entry point is `App.tsx`, and the core transport logic is in `src/services/taxiIntegrationService.ts`.

## Pending Verification
- All pending verifications completed. The AI Job Recommendations system correctly handles guest traders and expired emergency jobs.

---

## Permanent AnyTrader Engineering & Synchronization Workflow

### 1. Canonical Source of Truth
GitHub is the canonical source of truth for AnyTrader.
- **Canonical Repository**: `Saanwar2002/AnyTrader`
- **Canonical Branch**: `main`
- **Standard Workflow**:
  `GitHub` $\rightarrow$ `AI Studio synchronization` $\rightarrow$ `Gemini reads AGENTS.md` $\rightarrow$ `inspect current baseline` $\rightarrow$ `ONE TASK` $\rightarrow$ `implementation` $\rightarrow$ `tests` $\rightarrow$ `complete diff review` $\rightarrow$ `commit` $\rightarrow$ `GitHub` $\rightarrow$ `AI Studio re-synchronization` $\rightarrow$ `next task`
- Never assume an old ZIP, previous Gemini conversation, or stale AI Studio copy represents the current source of truth.

### 2. AGENTS.md Must Always Be Read
At the beginning of **EVERY** AnyTrader task:
1. Locate `AGENTS.md`.
2. Read it completely.
3. Follow it for the current task.
4. Inspect the current repository state.
5. Confirm the current baseline before editing.

`AGENTS.md` is a permanent instruction file. It must be treated as mandatory for every future task unless the project owner explicitly changes it. Do not rely on memory of previous instructions instead of reading the current file.

### 3. One Task at a Time
Every assigned task is isolated. Gemini **MUST**:
- Implement only the assigned task;
- Avoid unrelated refactoring;
- Avoid unrelated security changes;
- Avoid dependency upgrades unless explicitly assigned;
- Avoid future roadmap work;
- Avoid silently fixing unrelated findings.
Unrelated discoveries must be reported separately as follow-up work.

### 4. Inspect Before Editing
Before modifying code:
- Inspect the current implementation;
- Inspect relevant tests;
- Inspect relevant Firebase rules/configuration;
- Inspect relevant documentation;
- Establish the current commit/version;
- Identify the existing architecture;
- Identify the security/integrity invariant the task must enforce.

If the current AI Studio code differs unexpectedly from GitHub: **STOP**. Do not blindly overwrite either version. Report the divergence first.

### 5. No Security Bypasses
Never introduce production bypasses such as:
- `skipSecurity`
- `skipAuth`
- `skipAuthorization`
- `skipLineage`
- `skipValidation`
- `unsafeMode`
- `force=true`
- Forced task execution
- Process-memory authority for durable state
- Non-transactional fallback where transactions are required

Equivalent mechanisms with different names are also prohibited. Never weaken a security boundary simply to make a test or feature pass.

### 6. Tests Must Not Be Weakened
Never:
- Delete a failing test;
- Disable a failing test;
- Silently skip a test;
- Reduce assertions;
- Replace a real security test with a mock merely to obtain a pass;
- Change expected security behaviour solely to make CI green.

A failing test must be investigated. Determine whether the failure is: implementation, test, environment, synchronization, or pre-existing. Then fix only what belongs to the assigned task.

### 7. Firebase Security Testing
When Firebase Firestore or Storage behaviour is changed:
- Use the **REAL Firebase Emulator**.
- Test where applicable: unauthenticated access, authorized access, unrelated-user access, cross-resource access, admin access, nested paths, client writes, client updates, and client deletes.
- Emulator setup failures must fail hard. Never silently skip security tests because the emulator is unavailable.
- Do not retain Firestore instances obtained from a security-disabled emulator callback after that callback completes. Use callback-scoped trusted contexts.

### 8. Authorization
Never consider the following sufficient proof of authorization:
- Existence of a user ID;
- Existence of a recipient;
- Client-supplied owner ID;
- Client-supplied role;
- Client-supplied relationship;
- URL parameters;
- Hidden UI controls.

Authorization must be derived from trusted identity and the actual authoritative relationship to the resource.

### 9. Server-Owned Data
Clients must not arbitrarily modify:
- Financial fields;
- Security fields;
- Audit fields;
- Ownership fields;
- Processing state;
- Privilege fields;
- Server timestamps;
- Counters that affect billing/ranking/security;
- Intelligence provenance;
- Immutable historical records.

Use controlled server operations.

### 10. Intelligence Architecture
Preserve the established V8.1 intelligence boundary:
`SOURCE` $\rightarrow$ `EVIDENCE` $\rightarrow$ `AI / MODEL` $\rightarrow$ `UNTRUSTED CANDIDATE` $\rightarrow$ `STRUCTURAL VALIDATION` $\rightarrow$ `SEMANTIC VALIDATION` $\rightarrow$ `EVIDENCE LINEAGE` $\rightarrow$ `CANONICALIZATION` $\rightarrow$ `CONFIDENCE / PROVENANCE` $\rightarrow$ `IMMUTABLE INTELLIGENCE` $\rightarrow$ `CURRENT PROJECTION`

- AI output is untrusted.
- AI cannot create evidence.
- No evidence means no source-backed assertion.
- Historical intelligence is append-only and must not be silently overwritten.
- Current projections may be mutable.
- Durable authoritative state must not depend on process memory.

### 11. Task Processing
Preserve the established durable task lifecycle:
`pending` $\rightarrow$ `processing` $\rightarrow$ `succeeded`
or:
`processing` $\rightarrow$ `retrying` $\rightarrow$ `processing`
and eventually:
`retrying` $\rightarrow$ `dead_letter`

Worker ownership must be transactional. Lease ownership must be respected. A worker that loses its lease must not finalize the task. Do not introduce memory fallback for authoritative task state.

### 12. Processing Observability
Processing records must remain durable and integrity protected. Preserve relevant:
- Task identity;
- Attempt;
- Worker identity;
- Lease identity;
- Timing;
- Provider/model metadata;
- Pipeline/version metadata;
- Cost metadata;
- Controlled error metadata.

A task must not be reported as successful when required durable processing persistence failed.

### 13. Error Handling
Do not swallow failures involving:
- Authorization;
- Persistence;
- Auditability;
- Task ownership;
- Processing state;
- Provenance;
- Evidence lineage;
- Financial correctness.

Do not expose raw internal errors, stack traces, secrets, provider details, or database details to clients.

### 14. Diff Review
Before committing every task: Review the **COMPLETE** diff. Verify:
- Only task-related files changed;
- No unrelated refactor slipped in;
- No secrets were introduced;
- No debug code remains;
- No security bypass exists;
- No Firebase rule was weakened;
- No test was disabled;
- No process-memory authority was introduced;
- No unsafe persistence fallback was introduced.

### 15. Validation
Run the strongest applicable validation. Normally this includes:
- `npm test`;
- Relevant Firebase Emulator suites;
- Relevant intelligence Emulator suites;
- Typecheck (`npm run typecheck` or `lint_applet`);
- Lint;
- Production build (`compile_applet`);
- Release audit.

Never claim a test passed unless it actually ran. If something cannot run, explicitly report: what failed, why it could not run, and whether it is an environment issue or code issue.

### 16. GitHub Synchronization
After successful validation:
1. Review complete diff.
2. Commit only the assigned task.
3. Use a task-specific commit message.
4. Record the commit SHA.
5. Push the completed task to the canonical GitHub branch.
6. Re-synchronize AI Studio from GitHub.
7. Verify the AI Studio copy matches the committed GitHub state.
8. Only then begin the next task.

Never start the next task from stale AI Studio code.

### 17. Divergence Protocol
If GitHub and AI Studio differ unexpectedly: **STOP**. Determine:
- GitHub commit;
- AI Studio baseline;
- Local changes;
- Intentional changes;
- Accidental changes.

Do not blindly overwrite either side. Report the divergence and wait for reconciliation if necessary.

### 18. Completion Report Format
Every completed task must report:

```
TASK:
[task ID and title]

BASELINE COMMIT:
[SHA]

IMPLEMENTATION COMMIT:
[SHA]

FILES CHANGED:
[list]

WHAT CHANGED:
[summary]

SECURITY / INTEGRITY INVARIANT:
[what is now guaranteed]

TESTS ADDED OR UPDATED:
[list]

VALIDATION:
- Unit tests:
- Emulator tests:
- Typecheck:
- Lint:
- Build:
- Release audit:

RESULT:
PASS / FAIL / BLOCKED

KNOWN LIMITATIONS:
[list or None]

UNRELATED FINDINGS:
[list or None]
```

### 19. Stop Conditions
**STOP** rather than improvise when:
- Requirements are ambiguous;
- GitHub and AI Studio unexpectedly diverge;
- A security invariant cannot be preserved;
- Required tests cannot run;
- The architecture appears contradictory;
- Unrelated systems would need modification;
- A production bypass appears necessary;
- A migration could risk existing data.

Do not guess.

### 20. Definition of Done
A task is complete only when applicable:
`Implementation` + `Regression tests` + `Real Emulator verification` + `Validation` + `Complete diff review` + `GitHub commit` + `AI Studio synchronization`
have been completed. If any required stage is blocked, report it explicitly.
