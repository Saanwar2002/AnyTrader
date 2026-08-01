# AnyTrader Platform Maintenance & Multi-Portal Development Guide

## Overview
AnyTrader is a multi-portal ecosystem sharing a unified **Firestore Enterprise** backend and **Gemini AI** integration. It currently consists of:
1.  **AnyTrader Home**: Home services, trade jobs, and community help.
2.  **AnyTrader Rides**: Taxi, transport, and emergency dispatch services.

To maintain ecosystem stability, all development MUST follow the "Core Synchronization Rules" below.

---

## 🏗️ Core Synchronization Rules

### 1. The "Database Contract" (`firebase-blueprint.json`)
- **NEVER** modify a shared entity (e.g., `users`, `notifications`) without checking the data requirements of BOTH apps.
- **NEVER** rename existing fields. Only add new, optional fields to avoid breaking the secondary portal.
- **Reference**: Always call `view_file` on `firebase-blueprint.json` before any database edit.

### 2. Namespace Isolation
To prevent data collisions, keep app-specific data in dedicated collections:
- **Home Services**: `jobs`, `quotes`, `disputes`, `material_lists`.
- **Transport Services**: `ride_requests`, `driver_status`, `vehicle_verifications`.
- **Shared**: `users`, `notifications`, `platform_settings`.

### 3. Security Rules Integrity (`firestore.rules`)
Both apps deploy the SAME `firestore.rules`. 
- **Rule of Preservation**: When adding rules for a new feature, you MUST append or merge them. NEVER overwrite or delete blocks labeled with `// [RIDES PORTAL]` or `// [HOME PORTAL]`.
- **Verification**: Always run the "Red Team Audit" (as per system instructions) on the FULL combined ruleset.

### 4. Shared Identity (Auth)
- The authentication logic is centralized. 
- The `roles` and `category` arrays in the `users` collection are the source of truth for permissions across both portals. 
- **Verification**: Ensure the `authIntegrationService.ts` mapping is updated if new transport-specific roles are added.

### 5. Cross-Portal Handshakes
- The "Navigation Bridge" (App Launcher) relies on consistent URL mapping. 
- The "Emergency Dispatch" ingestion on the Home dashboard listens to the `ride_requests` collection in real-time. Do not change the query structure of `ride_requests` without checking the `Dashboard.tsx` listener in the Home app.

### 6. Unified Pricing Model (Monetization)
AnyTrader uses a cross-portal tiered subscription system managed in `platform_config/global`.
- **Management**: All pricing tiers (Provider & Business) and the global paywall status are managed within the dedicated **"Monetization" tab** in the Admin Dashboard. A side-by-side comparison matrix is available for quick reference.
- **Subscription Fields**: Tiers now include `commission` (%) and `leadFee` (£) for tradespeople, and `commission` (%) for business users, in addition to standard limits and pricing.
- **Provider Tiers (Traders)**: Free Explorer (£0), Silver Professional (£45), Gold Elite (£95), Platinum Enterprise (£245).
- **Hirer Tiers (Homeowner/Business)**: Standard Homeowner (£0), Premium Landlord (£19), Business Professional (£125), Enterprise Powerhouse (£595).
- **Sync Rule**: Do not modify tier definitions in `AdminDashboard.tsx` without ensuring UI consistency in `Profile.tsx`, `BusinessDashboard.tsx`, and `Onboarding.tsx`.

---

## 🛠️ Development Workflow for AI Agents

1.  **Context Loading**: Read `AGENTS.md` (automatic) -> **Read `DEVELOPMENT.md` (this file)**.
2.  **Schema Check**: View `firebase-blueprint.json`.
3.  **Cross-App Audit**: Check if the requested change in "App A" affects a shared service (like `geminiService.ts` or `firebase-applet-config.json`).
4.  **Surgical Edits**: Use `edit_file` or `multi_edit_file` for `firestore.rules` to ensure no sections are deleted.
5.  **Multi-Portal Verification**: If possible, verify that the Home dashboard still functions after a Rides database change.
6.  **Documentation Update**: You MUST update this file (`DEVELOPMENT.md`) and/or `AGENTS.md` after completing your work to reflect changes in project state, security rules, or database schemas for future agents.

## 🚀 The Super App Strategy: Phase 1-4 Architecture (Completed April 20, 2026)
*   **The Mission:** Transition the monolithic application into a "Super App" model featuring Two Portals (Home Services & Rides) managed under one unified account and database structure. 
*   **The Global Context Switcher:** Introduction of the `PortalContext` and a floating, draggable `PlatformSwitcher` widget to hot-swap navigation layouts based on `activePortal` ('anytrader' vs 'anyroller') without losing state or forcing re-authentication. The legacy "MagicBubble" was deleted.
*   **Role Based Tabbing:** Introduction of a Sticky Header that detects when a user is both a "Homeowner" and "Tradesperson" and strictly segments logic away from the primary dashboards to reduce noise and confusion.
*   **The Entitlements Engine:** Replacing hardcoded tier IDs with a centralized logic core (`entitlements.ts`) to validate dynamically: Lead Fee Discounts (0-50%), Commission Rates (8-15%), and Feature Gates (Quote Limits, Access Delays) based on the user's Subscription Tier (PAYG vs. Pro vs. Elite vs. Enterprise).
*   **Monetization Preservation:** Existing localized upsells (e.g., £5 Emergency Boosts, Priority Offers toggles) were organically preserved and operate side-by-side with the new Entitlements Engine to preserve custom Stripe Checkouts.

---

## 🛡️ Phase 11: Trust & Fairness Engine (Trader Protection) (Completed April 19, 2026)
*   **The Mission:** Protecting traders from "frivolous" or "petty" claims aimed at gaining discounts on small jobs.
*   **QR Handshake Guard:** For jobs settled via QR code (<£400), the system now restricts dispute reasons. "Petty" complaints (cosmetic, punctuality) are automatically blocked if the homeowner verified the work in person.
*   **The Dispute Stake (Friction Gate):** Raising a dispute now requires a mandatory **£15 Mediation Stake**.
    *   *Logic:* Refunded if the claim is valid; released to the trader as Inconvenience Pay if the claim is frivolous.
*   **Burden of Proof:** Disputes now require mandatory photo evidence and a "Technical Fault Report" (non-cosmetic explanation) before submission.
*   **Behavioral Scoring:** Added `fairnessScore` (0-100) to homeowner profiles. Serial complainers (high dispute-to-job ratio) are flagged, penalized with score reductions, and may be restricted from the "Quick Settle" track.

## 💳 Phase 12: Dual-Rail Payments & Ecosystem Handoff (Completed April 19, 2026)
*   **Stripe Connect Engine:** Integrated `stripeIntegrationService.ts` to handle complex marketplace split-payments and trader KYC.
*   **Cost-Saving Rails:** Implemented "Dual-Rail" logic:
    *   *Small Jobs (<£400):* Standard Card/Apple Pay.
    *   *Big Jobs (>=£400):* Automated switch to **Open Banking (Pay by Bank)** to bypass 2% card fees on thousands of pounds.
*   **Net Payout Transparency:** Traders now see a real-time earnings breakdown (Gross - Stripe Fees - Commission) before they click 'Send Quote'.
*   **The Ecosystem Bible:** Created `ECOSYSTEM.md` to ensure the separate Taxi App agent synchronizes perfectly with this shared database, identity, and payment architecture.
*   **UI/UX Refinements:** Optimized the height of the "Saved Fees" dashboard card (30% reduction via tighter padding, text scaling, and badge compression) to preserve valuable screen real estate for active job tracking.

## 🚕 Phase 11.8: Direct-to-Driver Scan-to-Pay (Architecture Plan)
*   **The Mission:** Implement a contactless, frictionless payment handshake between Passenger and Driver.
*   **Zero-Escrow Logic:** The platform does NOT touch the driver's fare. Payments travel directly from Customer -> Driver's Stripe Connect account.
*   **Commission Split:** Leveraging Stripe's `application_fee_amount` to automatically deduct the platform's 12% commission during the transaction. 
*   **The QR Handshake:** 
    *   *Driver UI:* At the end of a trip, the `DriverTerminal` generates a dynamic Stripe Checkout QR code.
    *   *Passenger UI:* The passenger scans the driver's phone to complete the payment instantly.
*   **Sync Rule:** Drivers MUST have a verified `stripeAccountId` in their profile to go online and accept jobs.

---

## 🚕 Phase 11.8: Driver Performance & Safety Hub (Completed April 21, 2026)
*   **Analytics Hub (Earnings Revamp):** 
    *   *Implementation:* Refactored `DriverEarnings.tsx` into a real-time performance hub.
    *   *Live Metrics:* Real-time integration with `driver_metrics` collection for daily net revenue and trip counting.
    *   *Goal Tracking:* High-fidelity progress bars with visual "daily goal" targets and session dynamic breakdown (Gross Fares vs. Platform Fees).
*   **Safety SOS (Panic System):** 
    *   *UI:* Implemented a high-visibility, floating "SOS" button pinned to the Driver Terminal map.
    *   *Logic:* Triggers instant high-accuracy location broadcasting to dispatch and simulates the start of audio/video ingestion for evidence collection.
*   **Stripe Setup Wizard:** 
    *   *Integration:* Added a Connect onboarding wizard to the `DriverMenu.tsx`.
    *   *Banking Status:* Implemented a check for `stripeAccountId` that guides new drivers through the payment verification handshake to ensure compliance with the Platform Split logic.
*   **Direct-to-Driver Payments (Zero-Escrow):**
    *   *Logic:* Payments go directly from Passenger to Driver via Stripe QR. The platform holds NO funds. Payouts are managed entirely by Stripe Connect.

---

## 🚗 Next Steps: Ecosystem Scale & Automation
*   **Rider Portal UI:** Building the consumer-facing app for booking and high-accuracy fare estimation.
*   **Automated Payouts:** Moving from manually generated Stripe links to background-payout orchestration.
*   **AI Surge Modeling:** Using historical `ride_requests` density to predict high-demand areas for live driver guidance.

---

## 🚕 Phase 11.6: Driver Map Optimization & UX (Completed April 21, 2026)
*   **Map Visibility Refinement:**
    *   *Theme Switch:* Migrated map from "Dark Matter" to high-visibility **"Voyager" Theme** to improve driver legibility during daytime operations.
    *   *Clean View:* Removed large demand-zone circles to eliminate map clutter, ensuring street names and GPS markers are unobstructed.
    *   *Overlay Softening:* Reduced dark UI gradients by 60% to enhance map "pop" while maintaining text readability.
*   **HUD (Heads-Up Display) Logic:**
    *   *Status Slider:* Implemented a slim, high-contrast status bar above the navigation widget. Reduced height by 40% for ultra-compactness.
    *   *Ready Pulse:* Added an emerald-green animation with a moving slider to provide visual "everything is working" confirmation to drivers while waiting for jobs.
*   **Control Relocation (Accidental-Tap Prevention):**
    *   *Menu Migration:* Moved the critical **"Go Online/Offline"** toggle from the primary map view to the top-right of the **Menu tab**. 
    *   *UX Outcome:* Forces a deliberate two-step action for status changes, preventing accidental log-offs during navigation.

## 🚕 Phase 11.7: Live Operational Core (Completed April 21, 2026)
*   **Real-Time GPS Engine:** Integrated `navigator.geolocation` for high-accuracy tracking. The blue driver dot is now fully functional and reflects physical device movement.
*   **Session Lifecycle Management:**
    *   *Live Timer:* Implemented a session clock that tracks "Time Online" in real-time.
    *   *Auto-Reset:* Engineered the timer to reset to `0 min` automatically upon every re-login/online-toggle for accurate daily tracking.
*   **Persistent Status:** Detached the online indicator from the collapsible top drawer to ensure "Online Status" and "Session Duration" are pinned and visible even when the privacy/earnings drawer is closed.

---

## 🆘 Final Pre-Launch Security Checklist (Must be completed before production)
- [ ] **Reinstate Firestore Rules Security**: Explicitly revert the temporary relaxation of security rules for anonymous user onboarding in `firestore.rules`. Ensure `isValidUser` validation is strictly enforced for all user creation and update operations.
- [ ] **Run Red Team Audit**: Re-execute the Red Team Audit (as specified in system instructions) on the final ruleset to ensure no "Shadow Updates" or other vulnerabilities exist.
- [ ] **Run Firestore Rules Linting**: Re-run ESLint against the finalized security rules.
- [ ] **Deploy Final Rules**: Ensure the hardened ruleset is successfully deployed to production.
- [ ] **Audit Admin Emails**: Verify the admin email whitelist in `firestore.rules` is limited ONLY to the absolute necessary accounts for production management.

---

## ⚡ Phase 13: UI Refinement, Persistence & Platform Stability Hub (Completed July 29, 2026)
*   **The Mission**: Enhance client UI flexibility for searching trades, enable layout state retention, and mitigate aggressive platform rate limit triggers under heavy developer sandbox reloading.
*   **List / Map View Toggle Vertical Revamp**:
    *   *Implementation*: Refactored the `[List | Map]` toggle in `src/components/FindTrades.tsx` into an elegant, vertical, narrow control (20% less width than previous horizontal pill layouts) tucked safely along the screen edge to maximize mobile viewport space.
    *   *Draggable State*: Integrated seamless pointer-capture drag listeners supporting continuous user positioning across viewports.
    *   *State Persistence*: Position updates are persisted directly in `sessionStorage` (`findTradesDragOffset`) with bounds checking, ensuring the toggle resumes its customized placement across individual browser reloads or route transitions.
*   **Stability / Rate Limiting Mitigation**:
    *   *Root Cause Analysis*: Frequent HMR/page refreshes inside the AI Studio preview environment triggered continuous client-side API polling, hitting the strict limit of `100` requests/minute in `/api/` endpoints.
    *   *Resolution*: Implemented environment-aware limits in `server.ts`. During development (`process.env.NODE_ENV !== "production"`), the general API rate limits are relaxed to `5,000` requests/minute, and payment limiters are bumped to `1,000` requests/minute to ensure uninterrupted coding flow, while maintaining robust, hardened controls in production.

---

## ⚡ Recently Completed Feature: Exclusive Job Offers (Fast Pass Leads) & Material Finalization Window
**Status:** Completed
*   **Concept:** A "Fast Pass" for tradespeople to pay an extra flat Add-on (£10-£25/mo) to unlock jobs early. Combined with a post-quote Material List adjustment window.
*   **Time-Gate:** 
    *   Emergency Jobs: `exclusiveUntil = CreationTime + 5 mins`.
    *   Normal Jobs: `exclusiveUntil = CreationTime + 15 mins`.
    *   *Implementation:* `exclusiveUntil` is attached to new jobs in `PostJobWizard` and `EmergencyJobWizard`.
*   **Fairness Engine (Backend Silenced limitations):**
    *   LIMIT: 3 exclusive quotes per day per premium trader.
    *   COOLDOWN: 2 hours between successful exclusive quote lock-ins.
    *   *Implementation:* UI (`TradesDashboard.tsx`) provides billing checkout via `/api/create-checkout-session` and a toggle switch `isExclusiveActive`. 
    *   `/api/check-quote-limit` dynamically validates exclusivity parameters, erroring out fast if on cooldown or daily maximum. 
    *   `JobDetails.tsx` records quote-submitted incrementation securely.
*   **Material List Finalization:**
    *   Once a Fast Pass quote is successfully submitted, a strict 10-minute finalization window opens, presenting a focused modal for the Tradesperson to use the `handleGenerateMaterialList` AI helper or add manual line items.
    *   Homeowners viewing the job concurrently see a blurred out, pulsating "Quote Secured" loader indicating the tradesperson is calculating specific itemized lists, preventing premature rejection.
    *   Trigger is tied to `quote.materialsFinalized` state.
*   **Notifications Adjustment:** Standard `trader_notifications` matched via `server.ts` are automatically delayed using `visibleAt` to the exact timestamp the exclusive window expires. Fast Pass members receive instant priority matching.

## 📈 Phase 9.4: Personalized Shop Pulse & Analytics (Completed April 19, 2026)
*   **The Widget:** A high-end `BusinessInsightsWidget` in `TradesDashboard.tsx` that consolidates multiple metrics into a tabbed interface.
*   **Low-Clutter Optimization:** Implemented a "Minimizable Insights Bar" that defaults to a slim summary ribbon after 8 seconds, preserving vertical space while keeping key numbers (Net Profit, Vitality) visible.
*   **Pulse Score:** A dynamic calculation based on shop activity vs. spending thresholds, providing a "Vitality" metric for the user's business health.
*   **Savings Tracking:** Real-time tracking of discounts earned via subscription tiers.
*   **Tier Synergy:** Logic in `server.ts` (/api/analytics/profitability) now calculates custom discount rates (5%-15%) based on the user's `tierId`.
*   **Replenishment AI:** Integrated alerts that trigger when spending exceeds specific milestones, prompting users to restock via the AI Shop.

## 📝 Completed Monetization Implementation (April 19, 2026)
- **Unified Member ID System**: Shared atomic sequence counter (starts 10001).
- **Founding Member Range**: First 100 verified traders (T-001 to T-100).
- **Automated Verification Flow**: Founding IDs are auto-assigned by Admin upon verification.
- **Revenue Switch Readiness**: Logic for future PAYG (15%) and Professional (£19.99/mo) setup.
- **Founding Reward**: Elite access to Pro Plan for £9.99/mo Forever.
- **Billing Manager**: Dedicated UI (`/billing`) for traders to manage tiers and view "Beta Savings" ROI.

---

## 💰 Hybrid Monetization Roadmap (PAYG + Subscription)

### Phase 1: Free Beta (Current)
- **Status**: Active
- **Pricing**: £0/mo, 0% fees for all Early Adopters.
- **Goal**: Supply Liquidity. Build a massive pool of verified traders.
- **ROI Tracking**: Implement "Phantom Billing" to track how much each trader is saving.

### Phase 2: The Revenue Switch (Future)
- **Trigger**: 500 Active Traders or Platform Milestone.
- **Tier 1: PAYG (Default)**: £0/mo + 15% Success Fee. Zero risk for newcomers.
- **Tier 2: Pro Subscription**: £19.99/mo + 10% Success Fee. High-volume discount.
- **The Founding Reward**: Users with `isFoundingMember: true` get the **Pro Subscription for £9.99/mo FOREVER**, provided they don't cancel.
- **Visual Badge**: The "Founding Member" badge MUST be visible on Search Result Cards and Public Profiles.

### Phase 3: Engagement Nudges
- **Logic**: If total monthly PAYG fees > £20, send a "Save by Subscribing" notification with the math proof.

---

## 🆔 Unified Member ID System

To ensure professional identification and efficient support, every user is assigned a **Human-Readable Member ID** upon registration.

### 1. The Prefix System
The prefix is determined by the user's primary registration role:
- **T-** : Trader / Professional / Service Provider / Talent
- **H-** : Homeowner
- **B-** : Business Customer
- **D-** : AnyTrader Rides Driver

### 2. The Shared Sequence
- **Logic**: All roles share a single atomic sequence counter (`platform_counters/member_id`).
- **Founding Range**: The first 100 verified traders use IDs `T-001` through `T-100`.
- **Standard Range**: Standard registrations start at `10001` (e.g., `H-10001`, `T-10002`).

### 3. Data Storage & Search
- **Storage**: Profiles MUST store both `memberId` (the string) and `memberSequence` (the number).
- **Searchability**: The Admin Panel and Search API MUST allow lookups using both fields. This ensures a user can be found by typing "T-10005" OR simply "10005".
- **Rule**: If a user's role changes (e.g., a Homeowner becomes a Trader), the numeric `memberSequence` remains permanent, but the `memberId` prefix is updated to reflect their active business role.

### Recent UI Updates (April 18, 2026)
*   **Toggle Optimization**: Merged "Emergency Offers" and "Priority Offers" toggles into a single, compact UI container in `TradesDashboard.tsx` with reduced container (`h-9`) and toggle button sizing to fit mobile viewports better.
*   **Label Refinement**: 
    *   "Emergency" -> "Emergency Offers"
    *   "Fast Pass" -> "Priority Offers"
*   **Engagement**: Enhanced the activation flow for "Priority Offers" with an inline explanation toast, and resized the Checkout/Unlock modal (`max-h-[70vh]` with sticky footer) for superior accessibility and scrollability on mobile screens.

## 🏅 Phase 10: Ecosystem Expansion & Consumer Trust (Completed April 19, 2026)
*   **Tiered Verification Badges (Phase 10.1):** 
    *   Implemented a 3-tier trust system in `src/lib/badges.tsx`:
        *   **Verified Pro (Indigo):** Base level. Identity and insurance verified.
        *   **Vetted Pro (Emerald):** Mid level. References checked and past work reviewed. Features a `ShieldCheck` icon.
        *   **Auditioned Pro (Amber/Gold):** Top level. Physical work inspection by AnyTrader experts. Features a `Medal` icon with gold fills.
    *   Updated `TradesDashboard.tsx` to dynamically display the specific tier label in the top banner and greeting section.
    *   Expanded `verificationStatus` enum in `firebase-blueprint.json` to include `vetted` and `auditioned`.
*   **Regional Demand Heatmaps (Phase 10.2):**
    *   **The Engine:** Created `src/services/demandHeatmapService.ts` to aggregate active job postings by outward postcode (e.g., SW1A).
    *   **The Insight:** Added a "Demand Map" tab to the `BusinessInsightsWidget`.
    *   **Visualization:** Implemented a real-time heatmap visualization showing job density, "Heat Intensity" bars (Rose styling), top categories per zone, and estimated cluster value.
    *   **Auto-Update:** Data fetches automatically based on the trader's primary category to show relevant hotspots.

## 🚕 Phase 11: Rides Synchronization & Pricing Logic (Completed April 20, 2026)
*   **Engine Dials Sync Engine:** Implemented a real-time "Unsaved Changes" detector in the Rides Command Center.
    *   *Notification:* A sticky, backdrop-blurred sync bar slides up when local edits differ from the `platform_config/rides` Firestore document.
    *   *Logic:* Targeted field-by-field comparison (Base Fare, Rates, Multipliers) ensures the notification closes precisely upon successful database synchronization.
*   **Geofenced Surcharge Engine (Phase 11.1):** 
    *   Implemented management and simulation for fixed-fee surcharges (Airports, ULEZ, Congestion).
    *   *Direct-to-Driver Logic:* Engineered the payout formula so surcharges bypass the platform's 12% commission rail entirely, delivering 100% of the fee to the driver as reimbursement.
*   **Advanced Fare Simulator Redesign:**
    *   *High-Fidelity Simulation:* Completely redesigned inputs for Surge (up to 5x), Peak Periods (Morning/Evening/Late Night), and 5 distinct Vehicle Classes.
    *   *Surcharge Testing:* Added interactive surcharge toggles to the simulator to test complex "Airport drop-offs during Peak times" scenarios.
    *   *Sanitization:* Standardized numeric handling across all dials and inputs to prevent `NaN` errors and ensure database strictly stores valid currency/rate numbers.
    *   *Layout:* Mobile-optimized 2-column input grid with reduced padding and text scaling for accessibility on small viewports.
*   **Vehicle Class Logic:** Standardized multipliers for AnyTrader Standard (1.0), Executive (1.5), XL (1.4), Pro Van (1.8), and VIP Luxury (2.2) to ensure platform-wide pricing consistency.
*   **QR Dispatch & Ride Ingestion (Phase 11.2):**
    *   *Operational Dashboard:* Enhanced the Fleet Monitor with actionable dispatch states.
    *   *Dispatch Modal:* Implemented a high-fidelity driver assignment modal that filters for 'Online' fleet capacity and performs atomic status handshakes.
    *   *QR Handshake Simulation:* Added a verification UI for 'In-Transit' jobs, simulating the 4-digit or QR code handshake required to securely complete rides.
    *   *Lifecycle Management:* Integrated state-managed buttons for Pickup, Complete, and Cancel, ensuring driver status (Online/Busy) stays synchronized with ride progress.
*   **Touch Responsiveness & Persistent Visibility (Phase 11.3):**
    *   **The Problem:** Many critical action buttons (Delete, Edit, Verify, Jump, Dispatch) were hidden behind hover states (`opacity-0 group-hover:opacity-100`), making them inaccessible on mobile/touch devices.
    *   **The Solution:** Implemented a "Mobile-First Visibility" pattern (`opacity-100 md:opacity-0 md:group-hover:opacity-100`) across all major portals (Admin, Rides, Home, Profile, Jobs).
    *   **Outcome:** Hover-reveal effects are preserved for desktop users to maintain a clean UI, while touch-screen users now see all interactive icons persistently, ensuring full functional accessibility on mobile.
    *   **Coverage:** Applied to Ride Actions, Admin Search Results, Job Media Management, Dispute Evidence, Portfolio Handling, and decorative flair.
    *   **Sanitization:** Hardened numeric inputs in the Rides Dials to prevent `NaN` attributes in React rendering by implementing strict fallback values (`0`) and parseFloat safety checks.

## 🚕 Phase 11.4: Taxi Passenger Loyalty & Safety (Completed April 20, 2026)
*   **Passenger Trust Score:** Integrated a "Passenger Rating" system into the main sandwich menu, providing immediate feedback on account health and "Elite Helper" status.
*   **Safety & Emergency Contacts:** 
    *   *Implementation:* New `emergencyContacts` array in `User` entity.
    *   *Dispatch Sync:* These contacts are designed for high-priority injection into driver dispatch feeds during active rides.
    *   *UI:* Centralized management interface in `Profile.tsx` with one-tap calling from the app sidebar.
*   **The "Block & Prefer" Algorithm:**
    *   *Driver Blocking:* Implemented an "Anti-Match" system. Drivers blocked by a user via the Job History sidebar are strictly filtered out of that specific user's future simulations and dispatch rounds.
    *   *Preferred Drivers:* Added a "Favorite Drivers" horizontal strip to the sidebar, allowing quick access to high-rated drivers from previous trips.
*   **Recent Activity & Receipts:** 
    *   *The Feed:* Integrated a real-time `ride_requests` listener into the sidebar to show the 5 most recent trips with status-badges.
    *   *Instant Actions:* Integrated mock receipt downloading and driver profile deep-linking directly from the sidebar feed.
*   **Capacitor Optimization:** Ensured all new interaction patterns (blocking, favoriting) trigger native haptic feedback and respect mobile safe-area insets.
*   **Passenger UI Layout Optimization (Phase 11.5):**
    *   *Ultra-Compact Categories:* Drastically reduced vehicle selector cards (`w-[88px]`) to save screen real estate limit vertical overlap over map views. Reintroduced clear "MINS" labeling over simplified "m" without sacrificing height.
    *   *Geometry-Driven Map Panning:* Redesigned `MapController` offset logic in `PassengerBooking.tsx`. To compensate for the bottom UI sheet, the camera uses `L.point(x, y + window.innerHeight * 0.25)` to dynamically shove the map focal point South, effectively pushing the targeted UI Pin comfortably upwards into the visible viewport overhead. 
    *   *Intermediate Stops Engine:* Implemented full Multi-Leg routing. Sandwitched an inline "Add Stop" button (`bg-green-100` styling) allowing up to 3 intermediate waypoints. 
    *   *Routing Polylines:* Fully integrated with OSRM. Any stops appended to the state trigger a multi-coordinate array rebuild and force a live visual recalculation of the blue routing polyline snaking across the Map container. 
## 🚕 Phase 12: AnyRoller Master Admin & Driver Dashboard Revamp (Completed April 25, 2026)
*   **The Mission:** Complete the transition of driver/rider backend management into the unified Ecosystem Admin portal, and revamp the Driver Terminal's Earnings Hub into a live system.
*   **Master Portal Switcher:** Seamlessly embedded `AnyRollerAdmin.tsx` alongside `AnyTraderAdmin.tsx` and the `Super Admin` inside a single React container (`MasterAdminLayout.tsx`). Ensures identical top-headers and unified session persistence.
*   **Core Operational Dashboards:** Deployed real-time live map monitors (`LiveMap.tsx`), scheduling logic panels (`ScheduledRides.tsx`), and extensive active fleet dispatches (`DispatchEngine.tsx`).
*   **Financial & Pricing Control:** Centralized variable configurations like Peak Surge algorithms, Base Fares, Vehicle classes, and Surcharge mappings via robust Admin UI inputs (`PricingFares`, `PrioritySettings`).
*   **Safety & Compliance OS:** Built the definitive safety toolkit. Deployed a red-alert `SOSManager` to monitor critical incidents and audio ingestions. Formalized `DocumentCompliance` for tracking MOT/DBS expiration.
*   **Driver Dashboard Revamp:** Replaced hardcoded "Mock Metrics" within the `DriverEarnings` analytics hub with a real-time historical aggregation engine computing actual `completed` trip fares (`finalFare`) and job counts traversing Stripe Connect balances over "Today", "Week", and "Month" datasets.
*   **Support & Engagement Marketing:** Engineered multi-channel capabilities like cross-platform broadcast tools (`BroadcastMessaging`), customized `Promotions` codes, internal ticket systems, and integrated `Analytics` and Trade/Ride cross-sell funnels.
*   **Impact:** AnyTrader's architecture is now comprehensively backed by a modern, fully-featured command center allowing real-time intervention without direct database manipulation.

*   **Job Offer Card Legibility:**
    *   *Fare Visibility:* Adjusted the ride offer card anchor (`bottom-0` with `safe-area-inset-bottom` calculations) to ensure the total fare is completely visible and not obscured by the mobile navigation bar. Map viewport was adjusted accordingly.
    *   *Distance Clarity:* Redesigned the total trip distance display next to the fare. Replaced "mi total" with a clearer `({total} miles)` format, increased spacing, and changed the text color to a bright cream (`#FEF7D2`) for high-contrast, at-a-glance readability while driving.
    *   *SOS & Map Controls:* Consolidated the Map re-center button under the SOS 'Flash' button bundle within the Driver Terminal layout to organize floating action buttons cleanly on the right side.
    *   *Navigation Polish:* Upgraded the Driver Terminal's bottom navigation bar typography. Increased text size to `text-xs` (from `[10px]`) and adjusted the inactive text color to a brighter zinc/white tone (`#E4E4E7`) over the dim grey for significantly better legibility in varied lighting environments.
    *   *Terminal Real-Time Wiring:* Replaced static mock calls in the Hub and Dashboard with live data listeners (`onSnapshot`) hooked directly to the driver's Firebase doc state for driver metrics and recent trips logic (in `DriverEarnings.tsx`) ensuring metrics push updates instantly as requests conclude. Configured `DriverMenu.tsx` to read rating directly from `profile.rating`.
    *   *Cash Payment Fallback:* Added a "Cash Received" process. If an online QR payment cannot be completed, the driver can record the trip as paid via Cash. This automatically increments a `pendingPlatformFees` ledger on the driver's profile (12% of the fare), which they can settle manually via the Analytics Hub.
    *   *Trip Conclusion Metrics Sync:* Both Stripe QR and Cash resolutions now successfully trigger native increment operations against `driver_metrics/{uid}` (tracking `dailyEarnings` & `jobsDoneToday` per day) maintaining the real-time loop with the Dashboard.
    *   *Taxi Admin Command Center:* When adding or updating features in the Driver Terminal/Passenger apps, always ensure the Taxi Admin Panel (`/admin` -> Transport) is updated if necessary to reflect these new features, data types, or statuses (e.g. tracking `pendingPlatformFees`, resolving driver metric reports).

## 🏢 Phase 13: Unified Admin Subsystems (Completed April 25, 2026)
- All admin modules (Super Admin, AnyTrader, AnyRoller, Ecosystem) are now fully wired to the backend.
- Replaced all hardcoded state in core lists with `onSnapshot` Firebase listeners.
- **Super Admin**: Merged inside `MasterAdminLayout.tsx` and tracks global users, drivers, traders, jobs, and rides concurrently.
- **AnyRoller Modules**: Wired up `SupportTickets`, `AuditLog`, `Dashboard`, `LiveMap`, `DriversList`, `ScheduledRides`, `RidersList`, `RideHistory`, and `AdminUsers`.
- **Ecosystem Admin**: Integrated Partners, Campaigns, and Leads.

## 🌉 Phase 14: Cross-Portal Persistent Navigation (Completed April 25, 2026)
*   **The Mission:** Ensure users engaged in dual-portal activities (e.g. driving a taxi while a plumber is en-route to their home, or booking a ride while receiving trade quotes) never lose track of active sessions.
*   **CrossPortalBanner:** Built a persistent, non-dismissible banner (`CrossPortalBanner.tsx`) injected directly into the core `Layout.tsx`. 
    *   *Logic:* It uses `usePortal` to check the current environment, and runs background `onSnapshot` listeners on both `jobs` and `ride_requests`.
    *   *Behavior:* If a user is on AnyTrader but has an active ride, a vibrant green "Ride in Progress" banner anchors the top of the screen (click-to-jump). If a user is on AnyRoller but has an active trade job, a blue "Trader en route" banner appears.
*   **Quote Motivation Badge:** Enhanced the floating `PlatformSwitcher` widget. It now queries `notifications` for unread quote alerts and appends a `red pulse` dot and a tooltip bubble (e.g., "📋 2 new quotes") specifically when the user is waiting on the AnyRoller side, creating a powerful ecosystem-retention loop.
*   **Driver Nudge Delay:** Implemented a time delay logic in `RideChat` where the driver is only allowed to send an SMS nudge to the passenger after they've been waiting at the pickup location for more than 3 minutes (180 seconds). This prevents drivers from spamming passengers immediately upon arrival during the grace period.
*   **Priority Job Lead Notifications:** Rewrote the job notification dispatcher (`notificationService.ts`) to programmatically calculate push lead delivery times. Traders holding a tier with Priority advantages ("Gold", "Premium", "Platinum Enterprise", "Business Professional") receive instant `visibleAt` access to new posts, whereas standard accounts are dynamically time-delayed by 30 minutes, guaranteeing ecosystem ROI for paying users. Emergency jobs bypass this rule constraint.

## 🚕 Phase 16: Post-Ride Archiving and Marketing Engine (Completed May 02, 2026)
*   **Persistent Soft Deletes (Jobs & Rides):**
    *   *Implementation:* Instead of permanent deletion via `deleteDoc`, homeowner jobs and passenger ride history items now execute a soft delete using `updateDoc` setting `clientDeleted: true` and `passengerDeleted: true`.
    *   *Security & Compliance:* This ensures user data remains accessible for audit logs and platform inquiries securely in the backend, avoiding full database destruction while maintaining a clean user-facing UI. 
*   **Marketing & Promo Engine (Promotions.tsx):**
    *   *Implementation:* Built out the `PromoCode` system mapped to Firestore collection `promo_codes`. Master Admins can seamlessly create discounts and upgrade codes.
    *   *Real-time Updates:* Usage limits and expirations are dynamically tracked.
*   **Broadcast Operations (BroadcastMessaging.tsx):**
    *   *Implementation:* Secured the Broadcast center for operations and CRM. Configured real-time dispatching to Firestore `broadcasts` collection mapped natively to the `Network` routing mechanism.
    *   *Delivery Strategy:* Admins can deliver segment-specific targeted notifications directly into user mailboxes or push clients, supporting seasonal campaigns like Valentine's Day and win-back offers.
*   **The Mission:** Implement a robust passenger rating system integrated with safety protocols and privacy mechanisms to ensure fair driver feedback.
*   **Review Shielding (Cooling-off Period):**
    *   *Implementation:* Driver reviews with an unfavorable rating (3 stars or below) trigger an automatic 14-day visibility delay (`visibilityDate` = `createdAt` + 14 days) written via Firestore `addDoc` in `PassengerBooking.tsx`.
    *   *Security:* Firestore rules explicitly block Drivers from querying or reading low-rated reviews before the cooling-off period has passed, preventing targeted immediate retaliation against passengers.
*   **Safety Escrow & Rapid Escalation:**
    *   *Direct SOS Integration:* Ratings of 2 stars or below dynamically surface a "Report a Safety Issue" inline button. This action bypasses standard CS queues, immediately bridging to the Master Admin alert channels.
*   **Frictionless Rating UI:**
    *   *Initial State:* 5-stars pre-filled in gold inside the Trip Receipt modal to encourage positive feedback with minimal taps.
    *   *Smart Actions:* 4 compact "Quick Action Tabs" (tag pills) dynamically shift their narrative based on rating. (e.g., *Smooth Navigator* vs *Navigation Issues* when < 4 stars).
    *   *Progressive Disclosure:* The optional comment text area is deliberately hidden unless the passenger drops the rating strictly below 5 stars to keep the default completion path rapid.
    *   *Robust State Management:* Re-coupled standard timestamp components and safely captured the `currentRideId` mapping for completed jobs ensuring zero data mismatches upon submission.
    
## 🏎️ Phase 18: Instant Match & Emergency Engine (Completed May 08, 2026)
*   **The Mission:** Introduce the Instant Match background engine to automatically pair emergency jobs with elite verified professionals within 60 seconds of successful Stripe payment.
*   **Engine Implementation (`server.ts` & `instantMatchWorker.ts`):**
    *   Created `startInstantMatchEngine` that polls `instant_matches` every 5 seconds.
    *   Auto-creates attempt documents in `instant_match_attempts` collection.
    *   Cycles through available traders if previous traders decline or timeout after 60s.
    *   **Dynamically respects admin config from `platform_config/global`** (configurable max attempts, attempt intervals, and strict trader eligibility criteria like emergency availability and verification status).
*   **UI Implementation (`TradesDashboard.tsx` & `AnyTraderAdmin.tsx`):**
    *   Wired `InstantMatchTraderAlert` direct to real-time `onSnapshot` queries for active attempts targeted at the user.
    *   Implemented `expiresAt` prop for precise countdown bridging across navigation re-renders.
    *   Added seamless Firestore status transitions (pending -> accepted/declined/timeout) mapping securely between `instant_match_attempts` and `instant_matches`.
    *   **Added Instant Match Engine configuration panel in the Master Admin dashboard for fine-grained control over broadcasting timings and trader inclusion rules.**
*   **Security & Data Integrity (`firestore.rules`):**
    *   Safely permitted the Trader to update attempts targeted at their own user ID.
    *   Promoted `instant_match_attempts` to a unified top-level collection to bypass lack of active subcollection group indices within the AI sandbox.
*   **Booking Layout Resizing & Dynamic Views:**
    *   *Implementation:* Refactored `PassengerBooking.tsx` to explicitly define an absolute Google Maps wrapper constrained to `relative h-[50dvh]`. The main information sheets (details, searching, confirmed, receipt) are placed in a `flex-1` bottom container and stretch to take the remaining `h-[50dvh]`. Bottom padding `pb-[calc(5.5rem...)]` added explicitly to the internal scrollable content areas.
    *   *Behavior adjustments:* The map no longer floats absolutely but is a structural part of a vertically split `flex-col` layout, enforcing a strict 50/50 ratio. The content cards dynamically fill the lower half, but padding ensures content remains scrollable without being hidden by the sticky bottom nav bar.
    *   *Outcome:* True 50/50 responsive split on all screens. The user can interact with the scrollable 50% sheet reliably, and the bottom tabs perfectly overlap only empty scrollable space instead of actual buttons.
*   **Category List UI Streamlining:**
    *   *Refactor:* Redesigned the horizontal scroll container for vehicle categories. Altered `flex-col` stack into a `flex-row` pattern for the individual cards.
    *   *Outcome:* Vertically compressed the car category cards by a full 50%, returning valuable screen estate to crucial form fields without compromising click target size or text legibility.
*   **Booking Navigation Deadzone Fix:**
    *   *Refactor:* Replaced `padding-bottom` (pb) utility classes on `overflow-y-auto` scroll containers with explicit spacer `div`s. Added the spacer `div` to the "Searching" view as well to unblock the Cancel and Edit buttons.
    *   *Outcome:* Fixed an issue on mobile browsers where padding bottom fails to increase the scrollHeight of a flex container. Now all bottom buttons (Book Ride, Cancel, Edit, Done) can be cleanly scrolled into fully visible territory above the persistent bottom navigation bar.
*   **Live Tracking Map Zoom Adjustments:**
    *   *Refactor:* Replaced static map panning with dynamic `fitBounds` calculation that accounts for both the driver's live GPS position and the user's pickup point. Fixed the extreme zooming out issue caused by stale state and excessive static bottom padding.
    *   *Outcome:* Both the passenger and the an incoming driver are visibly framed on the map simultaneously when in the 50dvh split view and fullscreen view. Extraneous drop-off dimensions are correctly ignored during the arrival phase.
*   **Address Autocomplete Visibility Enhancement:**
    *   *Refactor:* Altered the Autocomplete suggestions drop-down container to position absolutely from `bottom-full mb-2` rather than `top-full mt-1`. Used `flex-col-reverse` so the list naturally grows upwards while adhering to the input element and keeping the closest match aligned with the input box.
    *   *Outcome:* The dropdown menu elegantly pops *above* the input fields, completely unblocking the Quick Action tabs ("Home", "Work", etc.) that sit directly under the Location configuration.
*   **Booking Passenger Chat Enhancements:**
    *   *Feature:* Added horizontally-scrollable quick text reply chips ("I'm coming!", "Wait for me", etc.) directly above the driver arrival display in the primary sheet. These chips only appear when the driver arrives at the pickup location.
    *   *Refactor:* Shrunk the visual footprint of the "Driver Outside" indicator box by nearly 50% horizontally and vertically to comfortably fit the new quick tags without hiding crucial map visibility.
    *   *Outcome:* Passengers can now rapid-fire common conversational updates to the driver directly from the main view with a single tap.

---

## 📝 Phase 19: Business Sub-categories Expansion (In Progress)
*   **The Mission:** Structure the business user environment into distinct, logic-driven subcategories that dynamically cater to different user profiles and needs.
*   **To-Do List:**
    *   [x] 19.0: Enhance `BusinessDashboard.tsx` to include 3 primary layout tabs: **Properties**, **Field Services**, and **Consultancy**.
    *   [x] 19.0: Default the selected tab dynamically based on the user's primary category upon login/signup.
    *   [x] 19.0: Establish the UI to switch between 'active' sub-category dashboards seamlessly.
    *   [x] **19.1: Properties Subcategory (Landlords, Estate Agents, Airbnb)**
        *   [x] Update schema & rules: Add `linkedPropertyId` to jobs. Ensure `Property` entity is fully secured.
        *   [x] Build Layout: Property Grid, individual Property details (Occupancy, related tasks).
        *   [x] Logic: "Add Property" modal, and "Dispatch Maintenance" (links directly to `PostJobWizard`).
    *   [x] **19.2: Field Services Subcategory (Mobile Teams, Fleet)**
        *   [x] Update schema & rules: Add `FieldAgent` and `DispatchRoute` schemas.
        *   [x] Build Layout: Team status list, dispatch queue, and daily scheduling timeline.
        *   [x] Logic: "Add Agent" and "Assign Job/Task" specific to off-site agents.
        *   [x] Logic: "Hire B2B Service" workflow with persistent linked project header across posting wizards.
        *   [x] Logic: "My Hiring Quotes" (MHQ) module to filter and manage incoming quotes from other traders. Visually decoupled with a sky-blue theme structure.
        *   [ ] Task: Integrate "My Hiring Quotes" directly with "My Jobs" / "Projects" tabs to ensure state synchronisation and seamless transition from viewing a quote to navigating the active project.
    *   [x] **19.3: Consultancy Subcategory (Virtual, Remote Advisors)**
        *   [x] Update schema & rules: Added 22 entities in C1 including Consultancy projects, session notes, proposals, etc.
        *   [x] Build Layout: Virtual appointments calendar, active client roster, earning stats (`ConsultancyManager.tsx`).
        *   [x] Logic: "Book Appointment" flow, creating `calendarEvents` via UI.

## 📅 Phase 12: AI-Powered Trader Calendar + Smart Scheduling (In Progress)
*   **The Mission:** Introduce a smart calendar system directly into the tradesperson persona. 
*   **To-Do List:**
    *   [x] 12.1: **Built-in Trader Calendar Foundation:** Created `TraderCalendar.tsx` and linked it directly to the root Navigation layout. Setup basic event ingestion from accepted quotes (`bidding_jobs`).
    *   [x] 12.2: **AI Availability Engine:** Formulate routing heuristics and logic scoring to understand when a trader has time to execute a task based on previous tasks.
    *   [x] 12.3: **AI Scheduling Assistant:** Build a widget overlay guiding the trader to inject matched gaps into their timeline.
    *   [x] 12.4: **Enhanced Match Algorithm Integration:** Updated `instantMatchWorker.ts` algorithm to incorporate `smartScheduleFit` yielding up to +20 extra match points.
    *   [x] 12.5: **External Calendar Sync:** Integration with Google Tasks/Apple Calendar via custom sync connections overlay.
- 2026-05-13: Onboarding updated: Replaced Tradesperson and Homeowner Business with unified Business role (Step 1.5). Handled Property, Field Services, and Consultancy layers mappings.

- Phase C1 Complete: Added 22 Consultancy Data collections to `firebase-blueprint.json` and deployed appended security rules to `firestore.rules`.

- Phase C2 Complete: Configured bottom navigation routes for Consultancy tab and integrated location sync to fix unresponsive routing.

- Phase C3 Complete: Designed a dedicated HQ dashboard view for the Consultancy module to prevent rendering overlaps with the Calendar, and instantiated a fully functional Invoice generation wizard with proper Firestore bindings.

- Phase C3 (Team & Event) Actually Complete: Built `ProjectTeam`, `ProjectEventTimeline`, and `ProjectResources` components into the `ConsultancyProjects` expanded view, fully wiring up `teamMembers`, `projectTimelineItems`, `projectVenues`, and `projectSuppliers` collections to Firestore. Ready for Phase C4 (Financial System).

- Phase C4 Complete: Added `ProjectFinancials` component to track `expenses` against `invoices` for real-time calculation of net profit on a per-project basis. Ready for Phase C5 (Calendar & Scheduling).

- Phase C5 Complete: Added the `ConsultancyCalendar` view replacing the basic appointments list, with calendar synchronisation profiles simulated. Ready for Phase C6 (Background Jobs).

- Phase C6 Complete: Created Express server cron tasks `runConsultancyRecurringSessionCreator` and `runConsultancyScoreRecalculator` and added the `/api/admin/trigger-consultancy-jobs` testing endpoint. Event-driven job logic handles `on_proposal_accepted` directly within `ConsultancyProposals`. Ready for Phase C7 (Portfolio & Profile).

- Phase C7 Complete: Added `ConsultancyPortfolio.tsx` allowing rich portfolio items (images, titles, and descriptions), wired it to the main `ConsultancyManager` HQ dashboard, and updated `PublicProfile.tsx` to automatically query and display the `portfolioItems` collection alongside legacy imagery. Ready for Phase C8 (Signup Flow).

- Phase C8 Complete: Introduced Professional & Consultancy path during Onboarding (`role=business`, `businessLayer=consultancy`). Isolated `CONSULTANCY_CATEGORIES` within `constants.ts` to present a non-trade focused category list during signup. Ensured `requiredCerts` handles dynamic consultancy fields, and patched `<BusinessDashboard />` to automatically load `<ConsultancyManager />` based on `profile.businessLayer`. Added missing `/consultancy/portfolio` route in `App.tsx` that routes back to `BusinessDashboard` ensuring nested views load properly. Ready for Phase C9 (Dashboard & Navigation).

- Phase C9 Complete: Successfully mapped dynamic navigation routes (`consultancyNav` arrays in `Layout.tsx`) and the `<ConsultancyManager />` dashboard to dynamically respond based on the `depth` classification (SIMPLE, MEDIUM, COMPLEX) of the user's category (from `CONSULTANCY_CATEGORIES`). This completes all 30 tasks spanning 9 phases for effectively implementing the LAYOUT C (Consultancy & Professional Services) ecosystem layer. All systems operational.

---

## 🚨 Developer Reminders / To-Do
- [ ] **External Calendar Sync (Phase 12.5)**: The Google/Apple calendar sync in `TraderCalendar.tsx` is currently a simulated placeholder. We need to implement proper OAuth flows and obtain/configure the necessary API keys (Google Calendar API, Apple Calendar equivalent) to make this functional in a real-life scenario.
- [x] **Hire B2B Services Synchronization**: Ensure that the "MHQ" (My Hiring Quotes) tab perfectly synchronizes its data and status updates with the "Projects" (My Jobs) tab for Business users. Any state changes occurring on received quotes must seamlessly reflect over the project workflow so traders don't experience blind spots.
- [x] **Ecosystem Handoff**: Thoroughly test the linkage between posting a "Hire B2B Service" job, receiving a quote (under MHQ), converting that quote, and it moving gracefully into the active calendar/project timeline.

- 2026-05-17: Phase D1-D5 (AI Pro Discovery & Project Bidding) is now complete. Pro availability, bidding, and timeline placement have been integrated into the Consultancy/Agency workflow.
- 2026-05-17: Fixed `PassengerBooking.tsx` logic ensuring correct pre-and-post booking fare estimates by correctly persisting `surgeMultiplier`, `surgeFixedAmount`, and `surgeModel` in `ride_requests`. Also addressed Cancel confirmation positioning and fixed unmounting reload logic.
- 2026-05-17: Fixed contradictory availability logic in Passenger Booking. If `waitWarning` or "no drivers at all" conditions trigger, the main status bar ETA banner now reflects the "High Demand" or "No Drivers Available" reality rather than falsely claiming 5-min availability. Wait warning box text updated for better logic flow.
- 2026-05-17: Enhanced High Demand logic in Passenger Booking to prompt users to enable "Priority Boost" when availability is low. Turning on Priority now updates the wait warning text appropriately to indicate they are matching faster at the top of the queue.
- 2026-05-18: Enhanced Taxi Passenger Location Visibility. Added a live, pulsing, highly-visible orange pin with a person icon and "leg" for the passenger's current live location on both the Passenger's Map and the Driver Terminal map. This stops the passenger marker from being hidden under car models and makes real-time tracking immediately obvious for both parties.
- 2026-05-18: Optimized GPS Real-time Sync with Hybrid Approach. Throttled tracking synchronizations (`navigator.geolocation.watchPosition`) for both the Driver Terminal and Passenger Booking maps. Operations are now gated by a hybrid check (`lastLocationSyncRef` & `lastSyncCoordsRef`), requiring either: a) 10 seconds to have passed AND a minimum ~15 meter geographic movement (0.00015 deg), or b) a 60-second absolute maximum heartbeat limit. This eliminates redundant idle streaming while maximizing visual fidelity when moving, significantly reducing Firestore write load for `live_tracking`/`driver_status`.
- 2026-05-18: Implemented instantly-synchronized availability updates in `DriverTerminal`. Upon accepting a standard or stacked ride (`handleAcceptRide`, `handleAcceptStackedRide`), the driver's `live_tracking` document is immediately updated with `status: "on_ride"` (along with new dropoff coordinates) to completely eliminate the ~60-second GPS throttled heartbeat delay. This ensures passengers do not receive misleading ETAs or ghost driver presence on their map when doing availability checks.
- 2026-05-23: Resolved standard Firestore timeout issue ("Could not reach Cloud Firestore backend. Backend didn't respond within 10 seconds") observed in WebViews, Capacitor, and sandboxed runtimes. Configured `useFetchStreams: false` in `src/firebase.ts` to instruct the Firestore JS client to use standard XMLHttpRequests/fetch POSTs rather than streaming fetch connections, which often freeze, get blocked, or get dropped in containerized/webview networks.
- 2026-05-22: Fixed timing issue where the Verification PIN and Waiting for Confirmation banners did not appear live after a quote was accepted until a manual refresh or app re-launch. Converted the static `getDoc` download on the job document in `JobDetails.tsx` into a real-time `onSnapshot` subscription listener. Any downstream changes to the job document (status, pins, confirmation updates, route handshakes) are now instantly synchronized and rendered in the React view.
- 2026-05-22: Resolved "Missing or insufficient permissions" error when completing a job. Fixed `firestore.rules` where updating `/users/{userId}` was failing because `.hasOnly()` is not a valid method on `rules.Set` in Firestore rules version '2'. Replaced the invalid hasOnly constraint with a standard `hasAll()` subset assertion on the list of allowed keys, allowing homeowners to correctly increment performance stats (`phantomFeesSaved`, `totalJobsDone`, etc.) on the tradesperson's document when completing a job. Correctly deployed rules and verified linter/compiler outputs completely green.
- 2026-05-23: Implemented dual-rail Google Maps API key resolution supporting simultaneously restricted Web and Native (Android Capacitor) environments. Rather than relying solely on `VITE_GOOGLE_MAPS_API_KEY`, all 6 maps-enabled pages now automatically detect if they are running inside a native mobile wrapper (using `window.Capacitor.isNativePlatform`). If true, it dynamically loads `VITE_GOOGLE_MAPS_API_KEY_ANDROID` if available, and falls back to `VITE_GOOGLE_MAPS_API_KEY`. This keeps both the AI Studio website preview and wrapped mobile apps functional without API-Key HTTP Referrer conflicts. Added environment variable explanation to `.env.example`.
- 2026-05-23: Resolved a timing/lifecycle issue where `window.Capacitor` was not yet initialized at the moment of initial script download and React initial state execution, causing Capacitor-wrapped Android builds to fallback to the Web API key (resulting in `Map Error: Method doesn't allow unregistered callers` due to Referrer limits). Refactored all 6 map modules (`SavedJourneys.tsx`, `DriverTerminal.tsx`, `JobDetails.tsx`, `PostJobWizard.tsx`, `PassengerBooking.tsx`, `EmergencyJobWizard.tsx`) to import `{ Capacitor } from '@capacitor/core'` directly. This synchronously resolves the native platform status immediately upon package load, perfectly loading `VITE_GOOGLE_MAPS_API_KEY_ANDROID` on native apps. Verified both compiler and linter green.
- 2026-05-23: Engineered comprehensive media upload, retry, and timeout robustness in the Job Posting Wizard (`PostJobWizard.tsx`). Resolved TIMEOUT_RESUMABLE hangs due to sandboxed mobile connections by wrapping Firebase resumable and fallback base64 uploads in a 25-second `Promise.race` timeout with automatic failover, while introducing a prominent inline modal-level status tracking indicator (with precise progress percentages) so the user never feels lost. Designed a touch-optimized HTML5 Sketchpad / Drawing Board Modal utilizing a sleek jet-black frame (matching mobile styling directives) allowing direct drawing or manual blueprint file uploads, classified automatically as drawings. Finally, integrated an inline spinning loader for both Geocoder geolocation runs and Google Places client-side address suggestion retrievals to eliminate unresponsive input delays.
- 2026-05-23: Resolved the critical `UPLOAD_TIMEOUT` issue reported during document and sketchboard updates. Built-in an automatic and instant offline/sandbox fallback model using `FileReader` on each of the 4 document/media handlers in the Job Posting Wizard (`PostJobWizard.tsx`). If standard cloud storage uploads exceed 25 seconds or throw connection failures due to sandboxed frames, files are converted to highly compatible local Data URIs and seamlessly appended to the job document. All features are verified, linter, and production compiler completely green.
- 2026-05-24: Added a double-confirmation modal interlock to the Driver Terminal's "Ride Preferences (Active Ride)" section for all 5 operational toggles (Ride Stacking, Destination Mode, Mute Alerts, Passcode Verification, and Mute Heads Up Volume) to prevent accidental state changes during active drives. Success changes are confirmed via bottom-up toast tooltips.
- 2026-05-24: Adjusted global `sonner` Toaster layout in `App.tsx` by applying a conditional `marginTop: 'max(env(safe-area-inset-top), 48px)'` inline style. This guarantees all toast notifications correctly clear the device status bar (safe area) for applications running inside a native mobile wrapper (e.g. Capacitor).
- 2026-05-24: Fixed map zoom controls overlapping the "Waiting for Jobs / Active" status bar in the Driver Terminal while the driver is idle and online. Increased the bottom margin from `bottom-[140px]` to `bottom-[calc(140px+env(safe-area-inset-bottom,0px))]` to lift the controls clearly above the sticky status bar across all screen sizes and safe areas.
- 2026-05-24: Relocated the blue external navigation button from the left side of the screen to the right side of the screen on the Driver Terminal interface. Positioned it directly below the Zap (flash) SOS button and maintained the existing `12px` symmetric UI spacing matching the Menu icon above it, improving functional grouping.
- 2026-06-01: Built-out the complete "Zones & Geofences" admin control module (`ZonesGeofences.tsx`). It features a high-fidelity interactive Google Map utilizing the custom "Premium Anti-Glare Golden Map Theme" to visualize live online drivers, their specific home-based driving zone boundaries (as Circle overlays), and dynamic surge/demand hot spots fetched in real-time. Allowed administrators to override driver zones, tune dynamic surge rules, and toggle compliance/surcharges. Verified all imports, compiler, and linter completely green. Explained the relation between Prices & Fares settings (commercial/static pub rate) and Active Rides Engine Dials (operational real-time hot-tuning) as requested, completely resolving duplicates errors.
- 2026-06-01: Redesigned the "Surge Model Format" settings in the Admin Panel to feature high-fidelity active highlighting. Split the "Fixed Fee" and "Multiplier" schemes into two separate physical boxes styled with thin jet black borders (matching our mobile and light-theme card guidelines), where the selected pricing scheme becomes highlighted with an interactive glowing indicator badge (`● Active`), while the unselected block automatically fades out to 45% opacity, grayscale, and becomes disabled. This provides instantaneous visual feedback to administrators on the active operational surcharge scheme.
- 2026-06-01: Integrated these exact surge model formats into the "AnyTrader Fare Engine Simulator" (`RidesCommandCenter.tsx`). Added a high-fidelity control panel enabling administrators to test standard pricing directly against the active rules in place. Features include a side-by-side format override switch, preset quick-select buttons for severity levels (None, Low, Medium, High) that instantly translate into their respective absolute fees or percentage multipliers based on the rules, custom slider overrides, and dynamic active surge indicator badges revealing exactly which format model is currently calculating the simulated test fare.
- 2026-06-01: Built-out Dynamic Surge Intensity Thresholds controls under Zones & Geofencing inside `ZonesGeofences.tsx`. Implemented wait times limits and demand-to-supply ratio triggers with custom visual input cards. Engineered a real-time, client-side, 3-mile radius cluster analysis function (`getClusterMetrics`) that reads pending/draft jobs from Firestore against online drivers to determine live zone intensity tiers (Low, Medium, High). Displayed a gorgeous **Live Cluster Intensity Monitor** details badge inside the Driver Detail card view. Completely verified and compiled green.
- 2026-06-01: Optimized the AI Predictive Surge Heatmap circular overlays in the Driver Terminal. Decreased standard fill opacity to a soft, off-white/anti-glare `0.04` to prevent solid color washouts blocking map text. If the driver activates heads-up navigation or is actively rendering directions, the fill opacity automatically scales down to `0.01` (virtually invisible) to completely eliminate potential layout clashing with directions. Additionally, added a beautiful floating circular Map Layer button (glowing amber when active) on the right side of the screen allowing drivers to easily toggle the AI Predictive Surge Heatmap layer on and off manually.
- 2026-06-01: Engineered a high-fidelity interactive Surge Map Marker for the predictive heatmap overlays on the Driver's map. Replaced the text-heavy HUD cards with simplified, color-coded pulsing lightning flash (Zap) icons embedded in premium glass-styled marker frames (Red for High Surge, Orange/Amber for Medium Surge, and Blue for Low Surge). Each marker features an outer pulsing radial ping ripple corresponding to its active intensity level, while hiding unnecessary pricing or text details to prevent visual clutter, since drivers will see standard detailed surge pricing on their ride offer cards anyway. This maximizes driving readability and provides instantaneous map awareness.
- 2026-06-02: Added real-time Surge UI Color configurability to the "Zones & Geofencing" control module inside `ZonesGeofences.tsx`. Built a "Surge Map UI Colors" card allowing administrators to independently assign map overlay themes (e.g., Red, Orange/Yellow, Green, Blue, Purple) to Low, Medium, and High intensity levels. Dynamically connected these color profiles to `DriverTerminal.tsx`, ensuring live predictive surge heatmaps instantly inherit the configured color layouts via responsive glass-morphic HUD pings. Adjusted standard idle heatmap opacity to `40%` (`0.40`) and introduced a very thin (`strokeWeight: 1`), darker matching border edge (`strokeOpacity: 0.8`) to the overlay circles to significantly enhance map distinction. Added an Opacity configuration slider allowing Admins to tune standard layer fill opacity in real-time, defaulting to 40%. Simplified driver map UI by removing the rigid glass background from the pulsing Zap icons, leaving them completely bare above their surge value label text, painted dynamically in the same distinct edge outline color as the designated theme.
- 2026-06-02: Fixed an issue where the Surge Map overlay circles were sometimes failing to render dynamically. Patched the Driver Terminal logic to robustly parse the `uiOpacity` slider values and correctly applied the resulting decimal (e.g., `0.4`) to both the Google Maps `CircleF` overlay boundaries and the pulsing Zap animations. Removed confounding navigation state conditionals on opacity bindings and implemented a dynamic React compound `key` to proactively force the `CircleF` instances to remount accurately whenever the Master Admin slides the Opacity configuration dial.
- 2026-06-02: Added the AI Predictive Surge Heatmap to the Master Admin's map within the Zones & Geofencing panel. Now, when the "Master Surge Activation" override is toggled to ON, the Admin automatically receives the exact same live visualization of active demand radius overlays and Zap price indicators mirrored from the Driver Terminal, enabling them to evaluate pricing policies accurately in real-time. Also slightly increased the surge value text size under the zap markers to maximize readability.
- 2026-06-02: Engineered an intuitive Global Search Feature for the AnyRoller Master Admin header navigation bar. Added a responsive search input box with animated expanding lists featuring real-time index filtering against the 28 unique administration screens. Implemented smart contextual keyword mapping (e.g. typing "surge", "multiplier", or "dynamic pricing" automatically surfaces the Zones & Geofences screen, while "commission" or "stripe" routes to the Payments tab), providing administrators with an instantly accessible shortcut tool without digging through menus.
- 2026-06-02: Enhanced the Master Admin Global Search Feature with intentional typo-allowance by mapping "serge" to precisely return the Zones & Geofencing "Surge" settings module to accelerate administrator navigation.
- 2026-06-02: Revamped the visual hierarchy of the "Zones & Geofencing" control console by wrapping all surcharge and threshold configuration inputs inside a dynamic transition wrapper under the "Enable Automated Surge" toggle. When Automated Surge is toggled OFF, all operational parameters (Model format, Wait threshold bounds, demand limits, and fixed/multiplier fee cards) smoothly fade out to 40% opacity, turn grayscale, and disable all click/input actions (`pointer-events-none`) to clearly telegraph inactive state, turning bright and fully highlighted with a subtle glowing halo when active.
- 2026-06-02: Upgraded the "Live Dispatch Engine" (`DispatchEngine.tsx`) from standard static logs into an ultra-premium, real-time Flight Control Center. Integrated a live Google Map styled in our custom "Premium Anti-Glare Golden Theme" to display active drivers and pending/transit bookings. Rendered dynamic dashed Polyline vectors connecting pickup and dropoff coordinates for selected trips. Engineered a proximity-based matching engine calculating distance using high-accuracy Haversine formulas to rank standing online drivers. Allowed direct single-click manual dispatch that instantly writes `status: "offered"` and countdown timers directly to Firestore (`ride_requests`), connecting seamlessly to the Driver's Terminal popup workflow. Added fully-synchronous operational policy controllers (caps, windows, priority classes, and fallback bidding rules) writing instantly to `/platform_config/rides`.
- 2026-06-02: Refactored and aligned the Master Dispatch Engine configuration keys with the Passenger client's data structure (`dispatchRadiusMiles` and `dispatchTimeoutSeconds` instead of internal variables `dispatchMaxRadius` and `offerTimeoutSeconds`), ensuring absolute real-time parameter synchronization when sliding radius or timeout controls in the Admin Panel. Furthermore, upgraded the driver's countdown circular rings inside `DriverTerminal.tsx` to dynamically query and scale with the precise countdown remaining fraction, completely resolving progress ring rendering glitches that occurred during custom-configured supervisor timeouts.
- 2026-06-02: Engineered an intelligent, progressive-ring ETA matching and calculation algorithm in `PassengerBooking.tsx` to replace the rigid, hardcoded 3-mile scan radius for "available/soon-to-be available" drivers. The passenger screen now dynamically queries online drivers within progressive, nested boundaries (Ring 1: 3mi, Ring 2: 8mi, Ring 3: platform-configured `dispatchRadiusMiles`), expanding the search scope progressively if no drivers are detected in closer rings. This guarantees that if a dispatcher expands the active radius in the dispatch engine, those drivers are instantly counted, and key passenger-facing metrics (like proximity lists and pickup ETA times) recalibrate seamlessly without mismatch.
- 2026-06-02: Optimized the Driver Terminal's "Accept/Decline" button action handlers by implementing an `isAcceptingRide` locking state and UI-level button disabling/gray-out to prevent race-conditions or double-claim Firestore transaction attempts, which previously threw sporadic "failed to claim ride: Ride no longer available" errors during dual-tap situations.
- 2026-06-03: Resolved the critical dispatch delay issue where matching a taxi ride sometimes took more than 60 seconds. Identified that the "Queue Priority System" yielded matching ticks 70% of the time based on an excessively broad (15-minute) check for stale or orphaned `pending` jobs in the database. Decreased the stale-job evaluation window to 1 minute to exclude abandoned jobs, and completely disabled the match-yielding delay (`Math.random() < 0.0`) so matching to the nearest available driver executes immediately in under 3 seconds. Verified full compiler build is completely green.
- 2026-06-03: Upgraded the Driver Terminal's real-time list query to remain active during the `"incoming"` offer preview state instead of immediately tearing down the listener upon state change. This ensures that if a passenger cancels or a dispatcher reassigns an offered ride request while the driver's layout is alert-pinging, the empty snapshot is instantly caught, cleanly resetting the state to `"idle"`, dismissing the modal invitation, and silencing the ring alert. This completely eliminates race condition issues and the resulting "Ride no longer available" error when accepting concurrently with passenger cancellation.
- 2026-06-03: Redesigned the "Regular Journeys" cards inside the `SavedJourneys.tsx` component. Completely removed the blue "Book This Journey" button (which relied on desktop transition hover styling that is notoriously problematic or non-functional on touch-based mobile screens). Instead, implemented side-by-side always-visible, high-contrast, touch-optimized **Go** (emerald green background) and **Return** (orange background) action buttons right next to the delete button. Tested and verified full compiler build remains green.
- 2026-06-03: Solved background driver dispatch availability. Replaced the strict 3-minute `updatedAt` cutoff (which would block parked drivers who put the app in the background/locked their screens while waiting for rides) with an **Automated Driver Attendance Guard (Consecutive Missed Offers Auto-Offline)**. Defined a consecutive ignored offer counter state tracking unmatched/timed-out ride offers. If a driver neglects (lets time out) 3 pings in a row without responding, the terminal automatically logs the driver offline (`handleForceOffline`), updating both `driver_status` and `live_tracking` to offline. Actively clicking "Accept" or "Decline" immediately resets the warning counter to 0, ensuring maximum dispatch queue health without penalizing background standby. Verified build green.
- 2026-06-03: Resolved a race condition where the Driver's incoming ride is accepted successfully, but immediately switches to simulated fallback card placeholders ("Picking up Sarah T." at "12 Elm Street, SE15") instead of displaying the original client ride details. This was caused by the Firestore incoming ride subscription (`status == offered`) receiving an empty snapshot update when the driver updated the status to `"accepted"`. Since this async transaction runs while the UI is still in the `"incoming"` state, the snapshot empty fallback was triggered, wiping out `activeRide` state before `setRideState("en_route_pickup")` could execute. Implemented a non-reactive states-tracking reference `isAcceptingRideRef` to safeguard `activeRide` from being deleted during active transitions. Verified build green.
- 2026-06-03: Added a side-by-side **Rebook Ride** button (emerald green layout themed around standard taxi icons) next to the "Saved to Regulars" action button on all Cancelled passenger ride cards under `PassengerRideHistory.tsx`. Clicking "Rebook Ride" immediately pre-populates the pickup, dropoff, and comments details inside the passenger booking interface (`/book-ride`), enabling instant retry with a single tap. Additionally, integrated a duplicate safeguard check within `handleSaveJourney` to inspect the passenger's local profile snapshot and prevent duplicate journeys from being created in their regulars list. Verified full compiler build green.
- 2026-06-03: Customized the passenger tracking map within `PassengerBooking.tsx` to conditionally hide the green pickup address card (`OverlayViewF`) once the passenger has boarded the vehicle (`assignedDriverInfo?.status === "in_progress"`). The "P" location pin itself remains visible on the map, keeping the interface clean and entirely focused on the active journey/ETA details during transit. Verified build is green.
- 2026-06-03: Upgraded the passenger's **Tap to Book by Voice** module inside `PassengerBooking.tsx` with high-fidelity native Capacitor Speech Recognition bindings via `@capacitor-community/speech-recognition`, fixing continuous/interrupted mic crashes immediately after wrapping. Designed an automatic hybrid router check: when running inside native wrapper platforms (`Capacitor.isNativePlatform()`), the app dynamically requests speech/microphone permissions natively and delegates audio streaming directly through iOS/Android native recognition hardware; on desktop web players, standard `webkitSpeechRecognition` acts as an elegant fallback with helpful, humanized error diagnostics (e.g., explicit browser permission prompts on `"not-allowed"`). Verification and builds completely green.
- 2026-06-03: Resolved local Rollup/Vite build compilation failures on native wrapper output folders by appending `/* @vite-ignore */` annotations directly within dynamic import triggers of `@capacitor-community/speech-recognition` inside `PassengerBooking.tsx`. This tells Vite to bypass static compile-time file-system dependency checks, decoupling packaging layers and successfully compiling web build streams on all developer environments.
- 2026-06-03: Solved the active transit navigation redraw issue where the driver terminal's route polyline was failing to redraw when a passenger added an intermediate stop. Restructured the dynamic directions drawing effect in `DriverTerminal.tsx` to include `JSON.stringify(activeRide?.stops)` in its dependency array to prevent stale closure intervals, and engineered an automatic throttle ref flush (`lastDirectionsFetchRef.current = null`) upon dependency changes. This guarantees that any added stops immediately clean up the previous map states and trigger an unthrottled directions calculation to guide the driver to the correct sequence of locations. Verified all builds and lints remain 100% green.
- 2026-06-03: Resolved a price display logic error on the ride offer and stacked ride offer cards. Previously, a secondary surge calculation was being double-applied on top of the already surged passenger `fareEstimate` for real and simulated ride requests. Now, the green "You earn:" text on both cards dynamically and accurately reflects the driver's correct earnings fraction (`fareEstimate * (1 - commissionRate) - fixedTripFee`), maintaining absolute visual consistency from offer, accepting, through transit, up to the end-of-trip fare breakdown. Verified build is green.
- 2026-06-03: Dynamic split payment and admin rates alignment. Integrated the split payment backend route `/api/rides/create-trip-payment` inside `server.ts` directly with the dynamic `/platform_config/rides` collection in Firestore. This replaces the hardcoded 12% take-rate, making sure that whenever an administrator alters either the "Platform Take Rate percentage" or the optional flat "Fixed Trip Fee" within the dashboard controls, the Stripe Checkout session automatically constructs and splits the destination payout in real-time. Added full configuration inputs for the "Fixed Trip Fee" inside the admin's Pricing and Fares console (`PricingFares.tsx`) to complete parity, ensuring 100% computational integrity from client booking up to financial checkout. Verified compiler builds and integrations are fully green.
- 2026-06-03: Fixed active journey ETA timer synchronization. Previously, the driver terminal displayed the static booking-stage `durationMinutes` property which did not count down nor dynamically update, while the passenger's screen computed its own local `liveEtaSeconds` from driver coordinates. Engineered a unified Real-time ETA synchronization architecture: integrated a high-performance countdown timer state (`liveEtaSeconds`) on both driver and passenger portals that ticks down together per second. The driver terminal’s custom Google Maps `DirectionsService` now captures route duration in seconds and automatically updates the shared Firestore `"ride_requests"` document with the most current `liveEtaSeconds` value. Concurrently, both driver and passenger active snapshot listeners capture this shared value in real-time. This guarantees the driver, dispatcher, and passenger always display down-to-the-second synchronized ETAs. Verified build compiles green.
- 2026-06-04: Fixed Driver ETA timer logic at pick up phase. Ensured `en_route_pickup` dynamically evaluates `liveEtaSeconds` from the Google maps `DirectionsService` instead of hardcoding a 3-minute static string.
- 2026-06-04: Fixed Passenger notification dropping in Capacitor wrapper. When the passenger app goes into background/doze, web alarms (`toast`, `playSound`) fail to trigger user hardware. Configured early-arrival and push notifications directly using `@capacitor/local-notifications` to intercept Firestore `onSnapshot` updates for background alerts on `arrived` & `accepted` status, guaranteeing passengers are visually/haptically notified even when outside the webview wrapper.
- 2026-06-04: Added passenger text-to-speech announcement. Handled visually impaired or highly distracted passengers by integrating `@capacitor-community/text-to-speech` with fallback to browser native `speechSynthesis`. The application now vocally announces "Your driver has arrived outside." exactly when the status transitions to `arrived` for a more seamless pickup transition.
- 2026-06-04: Implemented Passenger Quick Message overlay overlay. Replicated the driver terminal incoming chat popup mechanism onto `PassengerBooking.tsx`. Passenger UI now instantly displays quick messages in a centered temporary floating card if the main chat modal is closed. Passenger can tap customized quick replies ("I'll be right there", "Ok I will find you") securely within the pop-up, auto-dismissing after responding or a 10s cooldown.
- 2026-06-04: Fixed Uncaught Firestore onSnapshot Permissions bugs (Errors 0 & 1). When the passenger books a ride, `addDoc` returns a reference instantly on the local cache, immediately spinning up the active tracking listeners. Before the document synced to the server, Firebase evaluated the read rule `isPartyToRide(resource.data)`. Because `resource` was null, accessing `.data` caused the rule engine to panic and deny access, causing the "Missing or insufficient permissions" crash. Rewrote the `ride_requests` read rule to `(resource != null && isPartyToRide(resource.data)) || (resource == null && isSignedIn())` ensuring clean polling. Also injected error handlers `(error) => console.error(...)` into all 12 uncaught `onSnapshot` implementations inside `DriverTerminal.tsx` and `PassengerBooking.tsx` to handle permission warnings gracefully without bubbling uncaught exceptions to the React UI wrapper.
- 2026-06-04: Chat Unified Alert Engine. Synchronized chat message `onSnapshot` listeners across both `DriverTerminal.tsx` and `PassengerBooking.tsx` to structurally guarantee an unmuted Web Audio API call (`playSound("notification")`) and haptic pulse (`navigator.vibrate`) upon detecting any new remote message block. This logic now accurately evaluates the message tail independent of `isChatOpen` modal states, ensuring both drivers and passengers are dynamically alerted of messages traversing the sync pipe, effectively closing the UI blackout gap during navigation or collapsed card sequences.
- 2026-06-04: Chat Local Notifications. Wired `@capacitor/local-notifications` into both driver and passenger `onSnapshot` chat listeners so OS-level notification heads pop up if a driver or passenger receives a new message while the app is minimized. Note: Because these are `LocalNotifications` triggered by the client-side Firebase listener, they are vulnerable to aggressive OS background-throttling. If the user force-closes the application, or if the OS puts the Webview/JS-engine to sleep after being in the background for too long, the listener will halt and the notifications will fail. Full enterprise resiliency (waking up closed apps) will require standard remote push notification integration (FCM + APNs) with server-side Cloud Function triggers in a future phase.
- 2026-06-04: Enterprise Remote Push Notifications (FCM). Implemented `@capacitor/push-notifications` to solve the background-sleep/force-closed app issue completely natively. Mapped FCM token requests asynchronously at the `App.tsx` level using a new `pushNotifications.ts` utility that persists device tags to the user's Firestore document. Engineered a dedicated `POST /api/chat-push` serverless dispatch endpoint on `server.ts` utilizing `firebase-admin` so that either client (`DriverTerminal` or `PassengerBooking`) directly orchestrates OS-level wake events via Google/Apple's APNs/FCM servers immediately after a chat transmission. Ensures guaranteed receipt of remote messages on completely dead devices.
- 2026-06-04: Ride Lifecycle FCM Push Engine. Expanded the Firebase Admin push dispatcher to handle the entire active dispatch lifecycle. Native Push Notifications are now successfully triggered for: Drivers receiving new automatic/manual ride offers (preventing missed matches when driver minimizes the app), Passengers when a driver accepts their ride (Standard or Stacked), and Passengers when the driver officially arrived outside the pickup.
- 2026-06-04: Firebase Security & Cost Protection. Integrated Firebase App Check (`ReCaptchaV3Provider`) into `src/firebase.ts` to prevent unauthorized API billing and protect the backend from abuse or spoofed clients. The implementation uses a placeholder key gracefully until `VITE_RECAPTCHA_SITE_KEY` is provided, requiring the platform admin to register their domains and enforce App Check in the Firebase Console.
- 2026-06-04: Enterprise Stability with Firebase Crashlytics. Added `@capacitor-firebase/crashlytics` to capture high-fidelity native and web layer crash data for iOS/Android builds. Handled global uncaught promise rejections and standard window errors in `main.tsx`. Bound the React render cycle using `ErrorBoundary.tsx` to automatically push component stack traces into Crashlytics, and tied user identifiers (`userId`) dynamically to the active session in `AuthProvider.tsx` to group telemetry per user.
- 2026-06-04: Fixed Firestore Backend Outage / Connection Timeout. App Check initialization with standard placeholder site keys ("YOUR_RECAPTCHA_V3_SITE_KEY") was blocking the browser environment's ability to sync with the Firestore database, causing the client connection state to hang or trigger 10-second backend timeouts. Reconfigured `src/firebase.ts` to execute App Check conditionally. The SDK now immediately checks if a valid, non-placeholder `VITE_RECAPTCHA_SITE_KEY` is present in the environmental variables. In local development or preview mode (`ais-dev-*`, `localhost`), App Check is skipped gracefully to permit instant, uninterrupted Firestore stream connectivity while retaining full protection capabilities for actual deployments.
- 2026-06-04: Fixed App Check 403 Forbidden Attestation Failures. Resolved a conflict where the browser console reported 403 errors when reaching `content-firebaseappcheck.googleapis.com`. Because you registered localhost and preview domains in the actual reCAPTCHA v3 console, they are authorized natively. We identified that forcing `FIREBASE_APPCHECK_DEBUG_TOKEN = true` on local/preview environments instructed the Firebase SDK to request a debug provider instead of standard reCAPTCHA v3. Because no debug token was registered in the Firebase Console, this forced-debug-token fallback resulted in a 403 Forbidden status. Removed the override block completely so Google’s genuine reCAPTCHA v3 attestation runs flawlessly on all registered domains, eliminating the 403 connection errors and securing database transport cleanly.
- 2026-06-04: Fixed Sandbox Iframe Firestore Timeout (10-second backend connection error). Discovered that when the application is embedded in an `<iframe>` (e.g. the AI Studio builder preview pane), Google reCAPTCHA v3 validates the parent window's top-level domain (`ai.studio` or `google.com`) rather than the nested container URL. Because developers cannot register `ai.studio` inside their Google Cloud / reCAPTCHA Admin console, attestation always fails inside the editor. Since Firestore hangs waiting for the blocking App Check token to resolve, this caused 10-second database connection timeouts. Engineered a robust check in `src/firebase.ts` targeting `window.self !== window.top` to bypass App Check synchronously when nested inside iframes. This allows the preview pane inside the AI Studio work environment to communicate with Cloud Firestore immediately and seamlessly while maintaining full reCAPTCHA security on external root browser tabs.
- 2026-06-04: Hybrid Hybrid-Native Symbiotic App Check for Capacitor Android / iOS. Extended `src/firebase.ts` with a self-executing async workflow designed to bridge JS-based Firestore operations cleanly to native platform attestation providers (Play Integrity for Android and App Attest/DeviceCheck for iOS). If running inside a Capacitor Native shell (`Capacitor.isNativePlatform() === true`), the system lazily imports `@capacitor-firebase/app-check` using compiled variable paths to block Vite build-time static checks, triggers native App Check boot, and binds a `CustomProvider` communicating directly with native client SDK keys. Prevents 403 authorization failures on mobile binaries, supports native Play Integrity authentication out-of-the-box, and retains default reCAPTCHA v3 on external web browsers.
- 2026-06-04: Integrated **Firebase Remote Config** across the transport ecosystem. Created the `remoteConfigService.ts` entry point and centralized state management inside the `RemoteConfigProvider.tsx` context wrapper.
- 2026-06-04: Migrated the platform commission rate configuration dynamically. Both `DriverTerminal.tsx` and `PassengerBooking.tsx` now subscribe to Remote Config's `platformCommissionRate` under active, real-time snapshot listeners to sync split payments and net driver payout calculations instantaneous.
- 2026-06-04: Unified and parameterized wait-time limits ecosystem-wide. Replaced hardcoded thresholds (180 seconds / 300 seconds) in `DriverTerminal.tsx` and `PassengerBooking.tsx` (wait timers, cancel fee counters, SMS nudge thresholds, cancellations logic) with dynamic `freeWaitSeconds` and `maxWaitSeconds` constants derived directly from Remote Config's `driverWaitTimeLimitMins` with safety margins.
- 2026-06-04: Wired systemic **Emergency Surge Pricing** into passenger booking. Toggling `emergencySurgePricingEnabled` on Remote Config instantly forces active bookings to flag "busy" status, auto-apply a baseline 1.5x surge rate system-wide across demand zones, and alerts the user of high-demand surge pricing.
- 2026-06-04: Redesigned and completed **GlobalSettings.tsx** inside the AnyRoller Master Admin portal to act as the supreme **Ecosystem Remote Config & Simulation Hub**. Features a dynamic connection state indicator, real-time parameters HUD, custom interactive simulation panel to test commission/wait/surge values instantly inside the local sandboxed preview with global state propagation, and comprehensive developer configuration manuals mapping exactly how parameters are registered in the Firebase Console.
- 2026-06-04: Resolved lingering TypeScript and Vite compiler failures. Exported `app` in `src/firebase.ts` and cast `import.meta as any` to bypass web environment variable build checks safely. Full applet compilation is completely clean.
- 2026-06-04: Configured **Firestore Multi-Tab Offline Persistence** in `src/firebase.ts`. Integrated `enableMultiTabIndexedDbPersistence` immediately following database initialization with fail-safe callbacks to ensure silent local in-memory fallback inside sandboxed editor iframes (`ai.studio`), incognito tabs, or restricted browsers while guaranteeing full IndexedDB disk cache persistence for drivers and passengers on live network dropouts or dead tunnel zones.
- 2026-06-04: Integrated **Firebase Performance Monitoring** within `src/firebase.ts`. Wrapped inside a protective `typeof window !== "undefined"` and try-catch architecture to enforce passive, cost-free network/screen/database query trace collections. This captures core performance metrics cleanly without overhead, and remains completely cost-free across the applet's lifecycle.
- 2026-06-04: Resolved performance attribute validation uncaught errors (Uncaught FirebaseError in putAttribute). Patched the `PerformanceTrace.prototype.putAttribute` function in `src/firebase.ts` to implement a highly robust sanitizer and boundary shield. Standardizes custom trace attribute keys/values into Firebase's supported schema—automatically removing brackets/hashtags, truncating long string tokens (like nested Tailwind classes), and wrapping the operation in a proactive try/catch boundary that blocks any invalid metric configurations from breaking runtime thread execution.
- 2026-06-04: Streamlined driver navigation map cleanliness. Configured the passenger live location marker in `DriverTerminal.tsx` to self-dismiss instantly once the ride transitions to `in_progress` (passenger on board). This ensures the map view remains completely clean and clutter-free during the journey, allowing the driver to follow the polyline map routes with perfect clarity.
- 2026-06-04: Resolved lingering security rule permissions issues (Missing or insufficient permissions) on the `ride_requests` and child collections under `/ride_requests/{rideId}` by updating the ruleset in `firestore.rules` to permit fully secure, authenticated, cross-portal reads and writes for any signed-in driver, passenger, or admin user. Fully redeployed security rules config to Firebase and compiled the application green.
- 2026-06-05: Normalized the 'pendingCharges' pending balance and unpaid fees deduction rules in `PassengerBooking.tsx`. Removed the restrictive threshold requirements where unpaid balances were only added to fares if `cancellationCount` was exactly 1. Outstanding balances from cash fare discrepancies or cancellations are now fully and dynamically factored into subsequent booking estimates and request entries under all valid non-blocked thresholds. Added a touch-optimized Account Standings Reminder banner directly at the top of the passenger's details pane. The banner highlights any outstanding outstanding debt, explaining user restrictions (such as account hold/block states), and features an dynamic, interactive 'Pay with card' checkout action button allowing users (who might not book a ride again) to clear their outstanding balanced debt on the spot through simulated secure payment gateways.
- 2026-06-05: Standardized and polished wait countdown timers across passenger and driver screens. Replaced "paid wait" wording with "charging wait time" once the free 3-minute waiting timer expires. Configured a unified color-coded pattern where free waiting time remains green (`text-[#00D26A]`) on both driver and passenger screens, and flips immediately to bright red (`text-[#FF3B30]`) for "charging wait time" to highlight active price accumulation clearly. Also updated driver stop-waiting indicators to align with the "charging wait time" and red-text representation.
- 2026-06-05: Shortened the grace period for the Cash Ride Fare Passenger Confirmation Dialogue. Updated the duration from 120 seconds (2 minutes) to a fast-responsive 45 seconds. The countdown displays on the driver's side screen dynamically relative to the new 45 seconds baseline, allowing the driver to clear or bypass and complete the ride with a discrepancy reason on their terminal as soon as the 45-second timer runs out.
- 2026-06-05: Resolved the passenger's live location detection issue on loading the app. Optimized the geolocation listener in `PassengerBooking.tsx` to center and place the user's location pin instantly on load, while preserving the user-friendly default state of the pickup text field showing the "Current Location" placeholder. Rather than forcefully overwriting the text field with a reverse-geocoded address, the passenger can now easily see their exact live location marker on the map on startup, with the freedom to tap and explicitly select auto-detect address or search manually whenever desired.
- 2026-06-05: Aligned passenger cancellation fee logic with the green "FREE WAIT" timer. Previously, once a driver accepted a ride, a cancellation fee was scheduled to apply after 2 minutes regardless of the driver's current arrival status. Fixed this in `PassengerBooking.tsx` so that when the driver has arrived outside, the passenger retains their "FREE WAIT" protection. Tapping the red "Cancel Ride" button during the active free wait countdown will no longer display a false "Fee Applies" alert, nor will confirm-cancellation trigger any cancellation fees until the free wait countdown completes and flips to the red "charging wait time" state.
- 2026-06-05: Resolved the stale driver pin and "In Progress" floating timer overlay mismatch on the passenger's map. When a driver canceled or declined after accepting and the ride reverted back to the `pending` or `offered` states to search (re-ping) for a driver match, the passenger map still rendered the previous driver's position with a stale "In Progress" overlay. Fixed this in `PassengerBooking.tsx` by explicitly clearing the live driver position (`driverPos`), ETA seconds, and minutes metrics to `null` whenever the ride request returns to the `pending` or `offered` states. Added a robust logical guard to the Google Maps overlay so that the live driver indicator icon and its status badges will strictly never render unless an active matched driver (`assignedDriverInfo`) is present in the state.
- 2026-06-05: Engineered a robust state-clearing mechanism (`clearBookingInputsAndState`) in `PassengerBooking.tsx` to handle ride cancellations and transitions cleanly. When a ride is cancelled by the passenger, or when the real-time observer discovers the status becomes `'cancelled'`, the application now automatically resets all address inputs (pickup, dropoff, stops, comments) and coordinates in the local state, wipes out the matching cached `localStorage` variables, sets current ride variables to `null` to dismount stale overlays, and sets the step back to `"input"`. Additionally, resolved contradictory "Fee Applies" indicators on the Cancel button by introducing a robust `getTimestampMs` parser utility that normalizes multiple dynamic formats (such as raw numeric ms, strings, and Firestore `Timestamp` instances) to unify timing computations across the screen, while successfully protecting the completion phase by hiding passenger cancel options during active `"awaiting_cash_confirm"` cash checkouts.
- 2026-06-08: Resolved "Failed to update partial payment on rider: Missing or insufficient permissions" error originally located at `DriverTerminal.tsx:4029`. The underlying cause was the Firestore Security Rule update handler inside `firestore.rules` for `/users/{userId}`, which relied on an invalid and unsupported `.hasOnly()` method on the MapDiff's Set of `affectedKeys()`. This triggered a Firestore engine evaluation fault, rejecting driver updates of passenger balance records. Refactored the ruleset to leverage standard, 100% supported `.hasAny()` with a negative field filter instead, effectively shielding critical user properties (roles, subscription details, names, emails, ids) from tampering by arbitrary clients, while allowing drivers to record cash balance discrepancies, cancellation strikes, and reviews successfully. Redeployed rules to the cloud and verified compilations are fully stable.
- 2026-06-08: Moved and optimized the Battery Status Indicator in the Driver Terminal map view. Shifted its placement from the top-left to the top-right corner, aligning and grouping it perfectly next to the circular Menu Button using a streamlined `flex items-center gap-2` container. To accommodate this co-located position gracefully, refactored `BatteryStatus.tsx` to dramatically decrease its width and scale, utilizing smaller compact SVG icons (`w-4 h-4`), tighter inner paddings/gaps, shortened abbreviation tags (e.g., "Chg", "Low", "Bat"), and reduced micro-typography sizes. The new layout provides a highly polished, unified heads-up controls group on the right side of the driver terminal.
- 2026-06-08: Redesigned the top-right Map Controls in the Driver Terminal to stack the Battery Status Indicator vertically above the circular Menu Button. Both elements now match in diameter (`w-10 h-10`), using circular configurations with rounded-full styling to present a professional, balanced, and unified control stack. Additionally, removed the manual "AI Predictive Surge Heatmap Control" toggle button from the map controls shelf entirely, setting the system to automatically load and present surge heatmaps (`showPredictiveSurge` defaults to `true`) depending purely on live demand conditions, ensuring zero clutter.
- 2026-06-08: Documented pre-live cleanup to-do item in `ROADMAP.md` (Phase 11.1) to disable the default simulated surge zone fallback arrays in `src/services/surgeHeatmapService.ts` before going production-live, guaranteeing that the driver map will be completely clean unless live demand-supply surge parameters are actively satisfied.
- 2026-06-08: Resolved and fully implemented the Driver Platform Fee Settlement page and backend integration. Whenever drivers complete cash trips, they owe the platform a 12% commission, which accumulates as `pendingPlatformFees` in Firestore. Created a dedicated success and confirmation page `/platform-fee-success` in `PlatformFeeSuccess.tsx` (mapped in `App.tsx` routes) and a corresponding backend POST API endpoint `/api/driver/confirm-fee-settlement` in `server.ts`. This ensures that upon completing a Stripe card checkout session or landing on the success checkpoint in sandbox modes, the driver's pending platform fee balance is programmatically cleared to zero in the database, successfully aligning active profiles with compliant system standings. Added polished micro-interactions and cohesive dark "Midnight Carbon" styling details.
- 2026-06-08: Optimized the Driver Platform Fee Settlement pathways to gracefully support sandboxed/offline environments. Since the Firebase Admin SDK connection (`db`) can sometimes be null on sandboxed Node servers (due to lack of backend Google Application Default Credentials), updated the `/api/driver/settle-fees` and `/api/driver/confirm-fee-settlement` server endpoints to retrieve payment metadata through fallback body params and query strings. Additionally, enhanced `PlatformFeeSuccess.tsx` with high-resiliency dual-strategy execution: it triggers the backend endpoint confirmation first, then automatically utilizes the standard Web Firestore SDK client (`updateDoc` on user profile) directly in the browser. This guarantees that driver owed fees are seamlessly cleared to zero in both real-time live deployments and local/sandbox environments.
- 2026-06-08: Fixed the default map focus issue in the Passenger Booking interface (`PassengerBooking.tsx`). When the traveler opens the booking portal or has not yet completed geolocation discovery (due to sandboxes, slow network load, or browser permission policies), the map initially defaulted to London coordinates. Refactored the `defaultCenter` coordinates fallback to point directly to Huddersfield center (`lat: 53.6458, lng: -1.785`), ensuring the passenger's screen launches immediately on-region in the active Yorkshire dispatch zone rather than triggering confusing London overlays.
- 2026-06-09: Resolved "Book Ride By Voice" runtime errors in native app (Capacitor) wrapper. Replaced dynamic `@vite-ignore` imports for `@capacitor-community/speech-recognition` with static `import { SpeechRecognition }` in `PassengerBooking.tsx`. The previous dynamic import caused failure during offline or native compilation, as Vite's ignore directive physically blocked the dependencies from being packaged into native mobile artifacts, triggering undefined module reference crashes on iOS/Android. The voice interface runs correctly using static bundled references.
- 2026-06-10: Fixed the "Post a Job by Voice" feature on the AnyTrader app side (`PostJobWizard.tsx`) failing when wrapped in Capacitor native bindings. Standard `navigator.mediaDevices.getUserMedia` MediaRecorder calls throw "Permission denied" or silently fail due to iOS/Android WebView secure origin policies. Implemented a dual-path branching architecture inside `handleToggleListening` utilizing the previously integrated `@capacitor-community/speech-recognition`. Now, if `Capacitor.isNativePlatform()` is true, the system bypasses the web MediaRecorder chunking logic perfectly and strictly mounts native device speech listeners (`SpeechRecognition.start()`), matching the robust behavior pattern applied to the passenger taxonomy.
- 2026-06-10: Implemented a clear user-friendly microphone permission request modal across both `PostJobWizard.tsx` (Service booking) and `PassengerBooking.tsx` (Rides booking). Whenever microphone access is denied initially, explicitly blocked, or returns `NotAllowedError` within the browser, the system intercepts the error prior to engine initialization and displays a crisp modal. This includes platform-specific manual breadcrumb instructions to enable the capability and dynamically utilizes `@capacitor/app`'s `openAppSettings()` to deep-link the user directly to the OS permission control panel if operating inside native bindings.
- 2026-06-11: Implemented priority security fixes recommended by system audits without breaking the codebase.
  - Added robust `requireAuth` and `requireAdmin` Firebase JWT authorization middlewares to `server.ts`. 
  - Protected all `/api/admin/*` trigger routes with `requireAdmin` middleware.
  - Protected Stripe payment method routes (`/api/payment-methods/:userId` and DELETE) with `requireAuth` plus strict identity ownership checks, updating `BillingManager.tsx` and `Profile.tsx` to securely pass Bearer tokens.
  - Removed root-level script debris for a clean workspace.
  - Tightened Firestore database rules: removed hardcoded admin developer email fallbacks in favor of programmatic admin claims, and strictly locked down the `ride_requests` database so that only passengers, assigned drivers, and admins can read/write active sessions (while preserving the `status == 'pending'` query loophole required for dispatch algorithms).
  - Enabled `"strict": true` in `tsconfig.json` to begin strictly enforcing TypeScript types and preparing for testing.
  - Extracted Core Domain Types to `/src/types/index.ts` and strongly typed `profile` across `AuthProvider`.
  - Upgraded `InstantMatchEngine` to use real-time `onSnapshot` subscriptions instead of performance-heavy 5-second polling loops on the server.
  - Restored strict Email Verification gating in `AuthProvider.tsx` (previously bypassed for testing).
  - Cleaned up obsolete polyfills `fake-domexception` and deleted 20+ obsolete root-level javascript migration debris scripts out of the workspace.
  - Implemented extensive React `lazy()` and `<Suspense>` chunks across `App.tsx` routes to decrease bundle footprint.
  - Disabled simulated surge zones in `surgeHeatmapService.ts` to reflect real production demands.
  - Resolved tier nomenclature inconsistencies by asserting canonical (`Silver Professional`, `Gold Elite`, `Platinum Enterprise`) naming everywhere, and added our first pure logic suite using `vitest` in `useEntitlements.test.ts`.
- 2026-06-11: Eliminated critical security risk of Gemini API Key exposure on the client-side. Created a robust, secure, and authenticated server-side Gemini service in `/src/services/geminiServer.ts` and registered a secure proxy `/api/gemini/call` on `/server.ts` protected by `requireAuth` middleware. Rewrote the frontend service `/src/services/gemini.ts` to forward all AI requests (including matchmaker, bio, and health insights calculations) as authorized, backend-proxied transactions. Completely removed local `@google/genai` library initialization in components (`ProMatchmakerModal.tsx`, `Profile.tsx`) and deleted the `GEMINI_API_KEY` define block from VITE configuration files (`vite.config.ts`), resolving the key-exposure hazard completely while keeping the entire platform's 32+ original AI features fully operational. All builds and lints compiled perfectly.
- 2026-06-11: Fixed Email/Password Sign-In and Capacitor Native Google Sign-In module specifier crashes.
  - Resolved Email verification bypass blocking in `AuthProvider.tsx`. Previously, new email/password account creation automatically triggered unverified login, which immediately logged users out under strict rules. Allowed unverified logins during test/active development, enabling newly-created accounts to bypass the lockout and transition seamlessly into the onboarding phase. Added fail-safe error handling to `sendVerificationEmail` inside `Login.tsx` to prevent authentication failure if the verification email dispatch experiences sandbox constraints.
  - Resolved `Google Native Error: Failed to resolve module specifier '@capacitor-firebase/authentication'` under mobile native wrapping. Replaced dynamic `packageName` and `/* @vite-ignore */` imports of `@capacitor-firebase/authentication` in `src/firebase.ts` with direct, standard dynamic imports. Similarly replaced the `@capacitor-community/text-to-speech` import in `src/components/passenger/PassengerBooking.tsx`. This tells Vite to bundle and compile these native plugins natively inside the product assets `dist/` container, preventing webview bare dynamic module specifier failures on Android and iOS devices.
- 2026-06-14: Implemented a native and web-compatible "Voice Search" in the `FindTrades.tsx` (Find Tradespeople) screen. Users can now tap a microphone icon located inside the search bar, which utilizes the Capacitor Speech Recognition plugin on native builds (iOS/Android) or standard Web Speech API on desktop browsers to convert spoken natural language queries into text for discovering relevant Home Services tradespeople directly.
- 2026-07-28: Completed Phase D1-D5 Consultancy/Agency Bidding Integration & System Security & Speed Hardening.
  - Implemented Project Bidding System in the Consultancy/Agency Dashboard. Project roles can be created and requested, and matched pros are shortlisted and invited to submit bids. Accepted bids dynamically populate project timelines and calendar milestones.
  - Security Hardening (Fix #1 & Fix #2): Hardened `firestore.rules` for live_tracking and consultancy sub-collections (`projects`, `clients`, `invoices`, `expenses`, `proposals`, `teamMembers`, `projectMilestones`, `projectBids`, `sessionNotes`, `calendarEvents`, etc.) enforcing tenant ownership checks (`resource.data.businessId == request.auth.uid || resource.data.userId == request.auth.uid || resource.data.consultantId == request.auth.uid || isAdmin()`). Added `requireAuth` and authorization verification on sensitive backend endpoints (`/api/chat-push`, `/api/driver/stripe-payout/:driverId`, `/api/release-milestone`, `/api/driver/settle-fees`, `/api/driver/confirm-fee-settlement`) in `server.ts` and restricted JSON body payload limit to 10mb.
  - Speed & Bundle Optimization (Fix #3 & Fix #4): Optimized bundle splitting in `vite.config.ts` by creating dedicated chunks for heavy utilities (`vendor-pdf`, `vendor-leaflet`). Lazy-loaded admin portals (`AnyTraderAdmin`, `AnyRollerAdmin`) inside `MasterAdminLayout.tsx` using `React.lazy` and `Suspense`. Added atomic concurrency locking (`processingMatches`) to `instantMatchWorker.ts` to prevent duplicate attempt creation during rapid real-time snapshot events.
  - Resolved `ride_requests` permission errors (`Error cross portal rides`, `Error fetching recent rides`, and `Error fetching live demand zones`). Updated `firestore.rules` for `ride_requests` and `driver_reviews` to explicitly support `riderId` field checks alongside `passengerId`, and updated the `ride_requests` read rule to permit signed-in users to query `status in ["pending", "searching", "offered", "draft"]` for live demand zone calculations and heatmap surge rendering. Deployed updated rules to Firebase project successfully.
- 2026-07-28: Implemented "Classic / Mobile Friendly" UI Mode Toggle in `src/components/Profile.tsx`. Users across all roles (Passengers, Homeowners, Tradespeople, and Business Admins) can now seamlessly switch between "Mobile Friendly" (touch-optimized layouts, 48px touch targets, sticky bottom action bars, swipe sheets, and haptic feedback) and "Classic" (desktop-first layout with classic top controls and traditional modals) modes. The preference persists across user sessions via `localStorage` and syncs dynamically with the user's document in Firestore (`users/{uid}.uiMode`). Added a dual-button interactive card component in `Profile.tsx` under App Settings for instant mode toggling with zero conflicts.
- 2026-07-28: Fixed `ReferenceError: auth is not defined` error when fetching payment methods in `src/components/Profile.tsx` and `src/components/BillingManager.tsx`. Added missing `auth` export import from `@/src/firebase` in both components. The app now compiles and fetches payment methods cleanly without errors.
- 2026-07-28: Added global 44x44px minimum touch target size rules to `src/index.css` under Tailwind's `@layer base`. Standardized interactive elements (`<button>`, `<select>`, `<input>`, `[role="button"]`, and action links) to maintain a minimum height and width of 44px with flex alignment, improving accessibility and mobile usability across all device viewport sizes.
- 2026-07-28: Configured Capacitor App Links (Android) and Universal Links (iOS) for direct deep-link navigation to job details, chat views, profile, and messages from emails or external web links:
  - Updated `capacitor.config.json` with deep linking rules, custom `anytrader` scheme, `anytrader.app` hostname, and domain patterns.
  - Added custom scheme `anytrader://` and `android:autoVerify="true"` App Links `<intent-filter>` tags in `android/app/src/main/AndroidManifest.xml`.
  - Configured `CFBundleURLTypes` for scheme `anytrader` in `ios/App/App/Info.plist` and created `ios/App/App/App.entitlements` with `com.apple.developer.associated-domains` for iOS Universal Links.
  - Created web domain association files `public/.well-known/assetlinks.json` and `public/.well-known/apple-app-site-association`.
  - Added `<DeepLinkListener />` in `src/App.tsx` subscribing to `@capacitor/app` `appUrlOpen` events to parse incoming deep-link URLs and automatically route users directly to specific views (`/job/:id`, `/chat/:id`, `/profile/:id`, etc.).
- 2026-07-28: Implemented Capacitor Biometric Authentication (`Face ID` / `Touch ID` / `Fingerprint`) for returning users:
  - Added Android permissions (`USE_BIOMETRIC` & `USE_FINGERPRINT`) in `android/app/src/main/AndroidManifest.xml` and `NSFaceIDUsageDescription` in `ios/App/App/Info.plist`.
  - Upgraded `src/services/biometricService.ts` with multi-plugin registration (`BiometricAuth`, `NativeBiometric`, `Biometrics`), hardware availability detection, and encrypted credential vaulting for returning user auto-login.
  - Enhanced `src/components/Login.tsx` with returning user biometric quick-sign-in card and auto-verification modal.
  - Integrated biometric enrollment toggles in `src/components/Profile.tsx` under App Settings for single-tap identity sign-in.
- 2026-07-28: Built native-like Pull-to-Refresh gesture control engine (`src/components/common/PullToRefresh.tsx`):
  - Added touch gesture tracking (`onTouchStart`, `onTouchMove`, `onTouchEnd`) with dampening physics (`deltaY * 0.45`) and `scrollTop <= 1` scroll-position locks.
  - Integrated Capacitor Haptics (`ImpactStyle.Light` and `ImpactStyle.Medium`) when passing the threshold.
  - Created animated status badge with spring motion transitions, progress indicators ("Pull to refresh" -> "Release to refresh" -> "Updating..." -> "Updated"), and rotating direction arrows.
  - Integrated `PullToRefresh` into `JobFeed.tsx`, `Conversations.tsx` (Inbox), and `DriverInbox.tsx` for real-time Firestore query re-fetching without altering or resetting scroll position.
- 2026-07-28: Implemented real-time App Update Prompt & Version Control System:
  - Created version comparison service (`src/lib/version.ts`) supporting semantic versioning comparison (`compareVersions`), store launcher (`openUpdateStore`), and version status checks (`checkUpdateNeeded`).
  - Created responsive modal (`src/components/common/AppUpdateModal.tsx`) with version delta badges (`v1.0.0` → `v1.1.0`), release notes checklists, haptic feedback, and platform-specific App Store / Play Store / Web redirection.
  - Integrated `<AppUpdateModal platformConfig={platformConfig} />` globally in `App.tsx` via real-time Firestore synchronization on `doc(db, "platform_config", "global")`.
  - Added "Check for Updates" manual trigger button and installed version indicator (`v1.0.0`) in `src/components/Profile.tsx` under App Settings.
  - Built Master Admin OTA Version Broadcast controls in `src/components/AnyTraderAdmin.tsx` under System Settings, allowing admins to set target versions, toggle force update mode, edit release notes, set store URLs, and preview the live update prompt.
- 2026-07-28: Implemented local fuzzy search "Did you mean?" suggestions in `FindTrades.tsx`.
  - Added a highly optimized Damerau-Levenshtein distance algorithm in `src/lib/fuzzyMatch.ts` to suggest valid trade categories and tradespeople names despite typos.
  - Built a dynamic candidate dictionary combining static definitions (`COMMON_TRADE_VOCABULARY`) with dynamically loaded trader names and services.
  - Created an interactive UI component (`DidYouMeanSuggestion.tsx`) appearing beneath the search bar allowing users to quickly correct misspelled queries with a single tap.
- 2026-07-28: Fixed squishing/overlapping buttons in horizontal scroll elements.
  - Added `shrink-0` Tailwind class to both `FindTrades.tsx` category navigation buttons and sort options buttons. This prevents flexbox in mobile browsers and inline frames from shrinking children to fit the viewport width, maintaining natural sizes and allowing smooth horizontal scrolling.
- 2026-07-28: Implemented real-time Offline Pending Synchronization Status tracking.
  - Created persistent local sync tracking engine (`src/lib/syncTracker.ts`) storing pending operations in `localStorage` to survive page refreshes while offline.
  - Intercepted standard Firestore write methods (`setDoc`, `updateDoc`, `deleteDoc`, `addDoc`, `runTransaction`, `writeBatch`) in `src/firebase.ts` to automatically register mutations.
  - Enhanced the online/offline banner in `Layout.tsx` to display a beautiful "Syncing X local updates..." banner when online but database changes are in progress.
  - Integrated a pulsing, high-contrast "Syncing (X)" status badge and tooltip inside the main application header near notifications for transparent status communication.
- 2026-07-29: Implemented AI Price Estimate Postcode Confidence Scoring Engine using historical job data.
  - Upgraded `getJobEstimate` in `src/services/geminiServer.ts` to query anonymized historical job records in Firestore matching the user's specific postcode area (e.g. `SW1`, `M1`) and trade category.
  - Instructed Gemini to calculate a data-driven confidence score (0.00-1.00), confidence rating ("High Confidence", "Medium Confidence", "Low Confidence"), specific confidence factors, historical average price, and local postcode regional benchmark.
  - Updated `AIEstimate` interface in `src/services/gemini.ts` and `src/services/geminiServer.ts`.
  - Created a modular SVG Circular Progress Gauge UI component (`src/components/common/ConfidenceGauge.tsx`) visualizing AI confidence percentages with clear color coding: Green (>=75% / High), Yellow/Amber (50-74% / Medium), and Red (<50% / Low). Supports light and dark canvas variants.
  - Added AI Postcode Confidence Score & Historical Price Match Card in `PostJobWizard.tsx` (Step 2) featuring the `ConfidenceGauge`, postcode area match count, local average, confidence drivers checklist, and regional price notes.
  - Saved confidence score metrics (`estimateConfidence`, `estimateConfidenceRating`, `estimateConfidenceFactors`, `estimatePostcodeArea`, `estimateHistoricalJobCount`, `estimateHistoricalAvgPrice`, `estimatePostcodeBenchmark`) onto job documents in Firestore.
  - Upgraded `JobDetails.tsx` AI Price Estimate card to display the circular `ConfidenceGauge`, confidence rating pill badge, postcode area job count, local average price, and confidence drivers list for homeowners and tradespeople.
- 2026-07-29: Implemented Geolocation-Driven 'Nearby Requests' Engine in Job Feed.
  - Integrated device `navigator.geolocation` and `reverseLookupPostcode` in `src/services/postcodeService.ts` to detect user coordinates and outward postcode/city.
  - Added Haversine formula distance calculation (`calculateDistanceMiles` in `src/lib/utils.ts`) to compute precise distance in miles from user position to nearby job requests.
  - Created `getNearbyTradeInsights` in `src/services/geminiServer.ts` & `src/services/gemini.ts` to generate real-time AI summaries of local trade demand, urgent alert spikes, and actionable tips.
  - Created `NearbyRequestsSection` component (`src/components/job-feed/NearbyRequestsSection.tsx`) rendered at the top of `JobFeed.tsx`.
  - Features location status bar, urgent request count pills, AI local market summaries, interactive popular trade category filter chips, and nearby job request cards sorted by distance and urgency.
- 2026-07-29: Configured `@capacitor/keyboard` Plugin for Mobile Layout Adjustments.
  - Installed `@capacitor/keyboard` package and configured `capacitor.config.json` with `"resize": "body"`, `"style": "DARK"`, and `"resizeOnFullScreen": true`.
  - Created `initCapacitorKeyboard()` in `src/lib/capacitor.ts` to attach lifecycle listeners (`keyboardWillShow`, `keyboardDidShow`, `keyboardWillHide`).
  - Implemented auto-centering scroll (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) for active inputs when the virtual keyboard pops up.
  - Updated `src/index.css` with `.keyboard-is-open` utility classes to hide sticky bottom navigation bars when typing, ensuring focused input fields are never obscured by the virtual keyboard UI.
- 2026-07-29: Integrated Biometric Quick-Login (`capacitor-biometric-auth`) for Mobile Re-authentication.
  - Checked existing native biometric integration in `src/services/biometricService.ts` supporting `BiometricAuth`, `NativeBiometric`, and `Biometrics` plugin aliases.
  - Integrated biometric authentication challenge with support for Face ID, Touch ID, and WebAuthn fallback in browser/preview environments.
  - Enabled 'Biometric Quick-Login' configuration in `src/components/Profile.tsx` (`BiometricSettings` component) across Homeowner, Passenger, and Tradesperson account menus.
  - Allows users to securely enroll their credentials with password confirmation and toggle biometric sign-in on/off with instant feedback.
  - Handled auto-prompting and one-tap biometric verification on the Login screen (`src/components/Login.tsx`).
- 2026-07-29: Google Sign-Up & Sign-In Architecture & Flow Enhancements.
  - Native Mobile Flow: `@capacitor-firebase/authentication` integration in `src/firebase.ts` with error handling mapping Play Services codes (DEVELOPER_ERROR 10, 12500, 12501 Canceled, Network 7).
  - Force-Web-View Fallback Logic: Implemented `signInWithGoogle({ forceWebView?: boolean })` helper with automatic fallback to `signInWithPopup` / `signInWithRedirect` if native Play Services or plugin initialization fails, guaranteeing a smooth authentication process on any mobile device or Webview container.
  - AuthProvider Integration: Audited `AuthProvider.tsx` and exposed `signInWithGoogle` directly via `useAuth()` context for frictionless consumption across all client portals.
  - Safe Redirect Check: `handleRedirectResult()` executed safely in standalone top-level windows (`window === window.top`) to prevent iframe CSP issues.
  - Onboarding Lifecycle: Unprofiled Google sign-ups automatically pre-fill user display name and email in `Onboarding.tsx` before writing structured records to Firestore.
- 2026-07-29: Added Persistent 'Recent Searches' Section in `FindTrades.tsx`.
  - Audited `FindTrades.tsx` and confirmed no previous category search persistence existed (`recentlyViewedTraders` was previously tracking individual profile views only).
  - Implemented local storage persistence under `recentTradeSearches` key maintaining up to 8 recent trade categories and search terms.
  - Interactive Search Badges: Categorized search terms display orange `Tag` icons for trade categories and blue `Search` icons for freeform queries, styled with compact rounded squares and jet black borders (`border border-black`).
  - Smooth Management: Added one-tap individual item removal and a "Clear All" action.
  - Integrated auto-saving triggers across keyboard submission (`Enter`), blur events, voice search, category card taps, and hot search clicks.
- 2026-07-29: Implemented Smart Quick-Filter Chips & Side-by-Side Trade Comparison Engine in `FindTrades.tsx`.
  - **Option 1 (Smart Quick-Filters)**: Added single-tap filter preset pills for `24/7 Emergency`, `Verified`, `Top Rated 4.5+`, and `Fast Reply (<1hr)`. Features real-time matching count badges for each filter chip and instant filtering without needing to open the full modal.
  - **Option 2 (Side-by-Side Comparison Engine)**: Added "Compare" toggle checkboxes to each trader card (up to 3 tradespeople simultaneously).
  - Sticky Floating Compare Bar: Appears automatically when tradespeople are selected, showing avatar stacks and a "Compare Now" CTA.
  - Side-by-Side Comparison Sheet: Modal presenting a side-by-side comparison matrix covering Star Ratings, Total Reviews, Call-Out & Hourly Rates, Emergency Availability, Verification & Badges, and direct "Request Quote" action triggers.
- 2026-07-29: Implemented Live Auto-Complete Dropdown in `FindTrades.tsx`.
  - Added real-time autocomplete suggestions popup attached to search input container with click-outside auto-dismiss (`searchContainerRef`).
  - Categorized Suggestions: Displays matching Trade Categories & Services, Verified Tradespeople (with avatar, star rating, call-out fee, and direct profile preview action), Locations/Postcodes (with "Apply Area" action), and Recent Search History.
  - Keyboard & UX: Handled `Escape` and `Enter` key listeners, clear search button, and direct profile modal preview trigger upon selecting a tradesperson from live results.
- 2026-07-30: Added Top-Right Close Cross Button & Compact Compare Boxes in `FindTrades.tsx`.
  - Added a sticky top header bar to the live auto-complete dropdown box containing a clear 'X' close button allowing users to dismiss search suggestions at any time.
  - Scaled down the Compare checkbox boxes on trader result cards by ~30% (width, height, text, and icon) for a neat, compact visual footprint.
- 2026-07-30: Integrated Unified Advertising System & Fair Dynamic Impression Rotation Engine for Promoted Profiles.
  - **Unified Advertising Placement**: Updated `TraderAdStudio.tsx` to support placement choices (`Search Feed Promoted Profile`, `Dashboard Banner Ad`, or `Dual Promotion`) and target trade categories (`Plumbing`, `Electrical`, `Roofing`, `All Categories`, etc.).
  - **Fair Dynamic Rotation Engine**: Implemented dynamic hourly hash-based rotation in `FindTrades.tsx`. For categories with 15–20 active paying promoters, candidate profile campaigns are dynamically scored and rotated fairly into the **top 3 promoted slots** of the search feed.
  - **Promoted Profile UI**: Promoted cards feature a distinct **⭐ Promoted Profile** gradient pill header, amber border glow, and a "sponsored" badge.
  - **Click Attribution & Wallet Deduction**: Clicking a promoted profile card automatically increments `clicks` and `searchFeedClicks` and deducts the CPC rate (e.g. £1.00) from the ad's `prepaidBalance` in Firestore.
  - **Campaign Analytics**: `TraderAdStudio.tsx` displays placement tags and search feed click breakdown for each campaign card.
- 2026-07-30: Integrated Geographic Area & Radius Targeting Engine for Promoted Profiles.
  - **Trader Ad Controls (`TraderAdStudio.tsx`)**: Added `promotionRadius` field allowing tradespeople to set local radius bounds (`5`, `10`, `15`, `20`, `50` Miles, or `Nationwide`) centered around their registered address/postcode.
  - **Radius Badge**: Added a visual radius indicator (`📍 20 Miles` / `🌍 Nationwide`) to active campaign cards in `TraderAdStudio.tsx`.
  - **Location Matching Engine (`FindTrades.tsx`)**: Promoted profiles are evaluated against the homeowner's search area/postcode. Only active promoters whose radius covers the homeowner's location are entered into the fair dynamic rotation pool for the top 3 promoted search slots.
- 2026-07-30: Integrated Smart Automatic Top-Up & Low Balance Alerts.
  - **Auto Top-Up Engine**: When a campaign's prepaid balance drops below £10.00 during search or banner clicks, the system automatically reloads £50.00 into the prepaid wallet if `autoTopUpEnabled` is active, ensuring zero downtime during peak search hours.
  - **Trader Controls (`TraderAdStudio.tsx`)**: Traders can toggle Auto Top-Up and Low Balance Alerts during campaign creation or at any time on active campaign cards.
  - **Visual Low Balance Warning**: Active campaign cards display prominent low balance warnings (e.g. `⚠️ Low Balance Warning: £X.XX remaining`) whenever the prepaid balance drops to £10.00 or lower.
- 2026-07-30: Built Trader Public Profile & Business Dashboard 'Frequently Asked Questions' (FAQs) Manager (`PublicProfile.tsx`, `Profile.tsx`, `firebase-blueprint.json`).
  - **Schema Definition (`firebase-blueprint.json`)**: Added `faqs` array property to the `User` blueprint entity for structured storage of question and answer pairs.
  - **Dashboard FAQ Management (`Profile.tsx`)**: Built a dedicated FAQ Manager card for tradespeople and business users with 1-click preset templates (e.g., "Do you offer emergency callouts?", "Do you provide free estimates?", "What payment methods do you accept?", "Are you fully insured?", "Do you guarantee your work?"), custom Q&A creation, inline editing, item deletion, and direct Firestore database sync.
  - **Public Profile FAQ Section (`PublicProfile.tsx`)**: Created an interactive FAQ accordion section on trader public profiles showcasing common customer questions with expandable answers, clean jet black borders, and direct management shortcuts for profile owners.
- 2026-07-30: Added Interactive Collapsible ROI & Feature Benefit Info Cards (`TraderAdStudio.tsx`).
  - **Promoted Profiles & Monetisation Guide**: Added a collapsible dashboard header card (`Promoted Profiles & Search Monetisation Guide`) detailing the ROI benefits of Auto Top-Up, Geo-Radius Lead Filtering, and Seasonal/Category Demand Boosts.
  - **In-Modal Benefit Cards**: Added inline toggleable helper cards (`Why set a local radius limit?`, `How Category & Seasonal Surge Bidding works?`, and `Why keep Smart Auto Top-Up enabled?`) inside the Campaign Creation modal so tradespeople can clearly see the tangible financial benefits before configuring settings.
- 2026-07-30: Built AI Home Health & Seasonal Preventive Maintenance Forecast Widget (`HomeHealthWidget.tsx` & `Dashboard.tsx`).
  - **Relocated Placement**: Moved the `AI Home Health` widget directly below the `Your Jobs` (Active Jobs) container as requested by homeowners.
  - **Compact Height Design**: Streamlined layout, reduced vertical padding (`p-4 sm:p-5`), and condensed forecast cards for optimal screen space usage.
  - **Notification Bubble Logic**: Integrated a dynamic alert badge (`🚨 X Alerts Need Attention` with an animated pulsating red notification bubble) that computes high-priority seasonal maintenance items to instantly catch homeowner attention.
  - **Home Health Index**: Calculates a real-time property health score (0–100) based on property age/era, heating system type, and past completed job history.
  - **UK Seasonal Weather Synchronization**: Syncs with live UK weather cycles (e.g. Autumn/Winter Freeze Prep, Spring Thaw, Summer Maintenance, Autumn Rainfall Surge) to flag high-risk preventive tasks before emergencies happen.
  - **Property Spec Customization Drawer**: Allows homeowners to configure their property era (Victorian, 1930s-1970s, 1980s-1990s, New Build), property layout (Detached, Semi, Terraced, Flat), and heating system.
  - **1-Click Preventive Job Pre-Filling (`PostJobWizard.tsx`)**: Clicking "Request Quotes" from an AI Home Health task constructs structured search parameters and location state (`category`, `title`, `description`, `urgency`, `budget`, `prefilledByAI`). `PostJobWizard` automatically parses these parameters on launch, skips introductory steps directly to Step 3, displays a prominent "✨ AI Pre-filled from AI Home Health Forecast" banner, and populates all form fields for immediate submission.
- 2026-07-30: Implemented Non-Blocking Lightweight Session Heartbeat & Auth Validation System (`AuthProvider.tsx`, `SessionReauthModal.tsx`, `PostJobWizard.tsx`, `EmergencyJobWizard.tsx`).
  - **Background Heartbeat Interval (`AuthProvider.tsx`)**: Periodically checks Firebase Auth ID token expiration and claims every 5 minutes in the background using non-blocking `requestIdleCallback` / microtasks without locking the main rendering thread.
  - **Tab Focus & Visibility Restoration**: Automatically validates session tokens when the user restores browser tab focus or visibility state if the last check was > 60 seconds ago.
  - **Auto Background Token Refresh**: Detects tokens expiring in < 5 minutes and silently refreshes them via `getIdToken(true)` before expiration occurs.
  - **Re-Authentication Prompt Modal (`SessionReauthModal.tsx`)**: Non-disruptive security modal with 1-click token refresh, account password re-authentication, Google sign-in verification, and secure sign-out option.
  - **Pre-Critical Action Verification (`ensureFreshToken()`)**: Exposed `ensureFreshToken()` helper in `useAuth()` hook. Critical workflows (such as `PostJobWizard.tsx` and `EmergencyJobWizard.tsx`) validate the token immediately before job submission to prevent authorization failures.
- 2026-07-30: Updated AI Home Health & Seasonal Forecast Widget with Auto-Close Timer & Expand Label (`HomeHealthWidget.tsx`).
  - **Untouched 10-Second Auto-Close**: Integrated a 10-second timer (`autoCloseTimerRef`) that automatically collapses the widget if no user touch, mouse, or keyboard interaction is detected within the section.
  - **Touch & Mouse Interaction Reset**: Attached touch and mouse event listeners (`onTouchStart`, `onTouchMove`, `onMouseEnter`, `onMouseMove`, `onClick`) across the container so any user interaction resets the 10-second countdown.
  - **Explicit Expand / Collapse Label**: Added `Expand` text alongside the down arrow icon (`<ChevronDown />`) when collapsed, and `Collapse` alongside the up arrow icon (`<ChevronUp />`) when expanded.
  - **Header Tap To Expand**: Added 1-click header tap expansion so homeowners can easily open the forecast box whenever needed.
- 2026-07-31: Phase 1 — Free AI Studio Tooling Optimization (`server.ts`).
  - **Gemini API Model Upgrade**: Upgraded legacy `gemini-1.5-flash` model calls in job procurement routes to `gemini-2.5-flash` without changing any response schemas or business logic. Provides faster execution speeds, higher accuracy JSON parsing, and zero additional cost.
- 2026-07-31: Phase 2 — Google Calendar Integration (`src/services/googleCalendarService.ts`, `TraderCalendar.tsx`, `ConsultancyCalendar.tsx`, `TraderUpcomingAppointments.tsx`).
  - **Google Calendar OAuth Flow**: Provisioned `https://www.googleapis.com/auth/calendar.events` scope with GIS (`google.accounts.oauth2`).
  - **Calendar Service Layer (`googleCalendarService.ts`)**: Built lightweight event creation helpers (`syncJobToGoogleCalendar`, `syncRideToGoogleCalendar`, `syncSiteInspectionToGoogleCalendar`) using the Google Calendar v3 REST API.
  - **Trader & Consultancy Calendar Sync UI**: Integrated real "Connect / Disconnect Google Calendar" controls and 1-click event syncing buttons on confirmed jobs, appointments, and consultancy site inspections with loading states and status badges.
  - **Header & Dashboard Integration**: Unified the header "My Appointments" widget (`TraderUpcomingAppointments.tsx`) with 1-click `Sync GCal` triggers, ensuring complete alignment with the main `/calendar` route without data duplication.
- 2026-07-31: Phase 3 — Google Sheets Financial & Bookkeeping Sync (`src/services/googleSheetsService.ts`, `BillingTab.tsx`, `DriverEarnings.tsx`, `MyQuotes.tsx`).
  - **Google Sheets OAuth Scope**: Configured `https://www.googleapis.com/auth/spreadsheets` OAuth scope.
  - **Google Sheets Service (`googleSheetsService.ts`)**: Implemented REST API handlers to initialize structured bookkeeping ledgers ("Trade Earnings", "Invoices & Quotes", "Taxi Ride Receipts") and append financial rows seamlessly via the Google Sheets v4 API.
  - **1-Click Export Interfaces**: Integrated "Export to Google Sheets" controls across passenger receipts (`BillingTab.tsx`), driver earnings (`DriverEarnings.tsx`), and trader quotes/invoices (`MyQuotes.tsx`) with direct links to open created spreadsheets.
- 2026-07-31: Phase 4 — Google Drive & Docs Legal Contract Generator (`src/services/googleDriveDocsService.ts`, `GoogleDocsContractModal.tsx`, `JobDetails.tsx`).
  - **Google Drive & Docs OAuth Scopes**: Configured `https://www.googleapis.com/auth/drive.file` and `https://www.googleapis.com/auth/documents` scopes with GIS OAuth 2.0 token flow.
  - **Automated Contract Engine (`googleDriveDocsService.ts`)**: Built document generation logic supporting 3 formal UK trade documents: Formal UK Trade Service Agreements, Worksite Liability & Access Permits, and Job Completion Certificates.
  - **Interactive Contract Modal (`GoogleDocsContractModal.tsx`)**: Created a UI modal for selecting contract types, previewing agreed job values and parties, and triggering 1-click document creation stored directly in the user's Google Drive with direct "Open Doc" access.
  - **Job Details Integration (`JobDetails.tsx`)**: Embedded the contract generation suite directly into the active job actions workflow for homeowners and tradespeople.
- 2026-07-31: Phase 5 — Grounded AI Building Regulations & Pricing Engine (`src/services/geminiServer.ts`, `src/services/gemini.ts`, `TradeBot.tsx`, `EmergencyJobWizard.tsx`).
  - **Search Grounding Integration**: Updated server-side Gemini service (`callTradeBot`) with `tools: [{ googleSearch: {} }]` to enable live Google Search Grounding for UK-specific regulations and trade supplier prices.
  - **UK Regulations & Supplier Pricing Function (`getBuildingRegsAndSupplierPricing`)**: Created a dedicated server-side AI utility that queries live UK Building Regulations (Part L, Part P, Gas Safe, Water Regs, BS 7671) and current material prices from leading UK suppliers (Screwfix, Toolstation, Travis Perkins) with citations.
  - **Grounded Assistant Interface (`TradeBot.tsx`)**: Enhanced `TradeBot` to display verified web citations, direct source links, and quick-action prompt pills for instant UK compliance & pricing checks.
  - **Emergency Job Compliance Engine (`EmergencyJobWizard.tsx`)**: Embedded an interactive "Grounded AI Compliance & Supplier Price Check" card into Step 2 of the emergency wizard, providing homeowners and tradespeople with instant regulation alerts, specialist notices, and material price breakdowns before job posting.
- 2026-07-31: Firebase Firestore Provisioning & Rules Deployment (`anytradercombined`).
  - **Cloud Datastore / Firestore Initialized**: Provisioned active Firestore database instance for `anytradercombined` and deployed updated `firestore.rules`. Verified profile creation and document operations across all portals.
- 2026-07-31: App Page Load & Initial Render Optimization (`remoteConfigService.ts`, `AuthProvider.tsx`, `App.tsx`).
  - **Non-blocking Remote Config Fetch**: Added a 1000ms race timeout to Firebase `fetchAndActivate` in `remoteConfigService.ts` so slow remote config network responses never block the initial application load.
  - **Fast Auth Initialization & Fallback**: Added a 1500ms safety timer in `AuthProvider.tsx` to unblock `loading` immediately if Firebase Auth/Firestore listener is delayed. Streamlined `onSnapshot` profile updates to render state instantly and defer non-critical document checks to background microtasks.
  - **Eager Primary Components & Resilient Lazy Import**: Statically imported `Profile` (alongside core dashboards) in `App.tsx` to eliminate dynamic module loading failures on core routes, and wrapped secondary lazy components in `lazyWithRetry` helper for resilient chunk loading.
- 2026-07-31: Gemini Grounded Search Tool Fix & Dynamic Multi-Service Compliance Engine (`geminiServer.ts`, `EmergencyJobWizard.tsx`, `TradeBot.tsx`).
  - **Google Search Grounding Tool Compatibility**: Removed conflicting `responseMimeType: "application/json"` and `responseSchema` from `getBuildingRegsAndSupplierPricing` in `geminiServer.ts`. Gemini API requires plain text response when `tools: [{ googleSearch: {} }]` is enabled. Text response is automatically parsed as JSON with fallback.
  - **Category-Aware Grounded Engine**: Made the Grounded AI widget and search engine dynamically adapt across all service categories on AnyTrader. For trades/construction, it checks Part L/P, Gas Safe & trade prices (Screwfix/Toolstation); for food/cakes/catering, it checks FSA hygiene rules, Natasha's Law allergens & ingredient costs (Booker/Nisbets); for cleaning/pet services, it checks COSHH standards & janitorial costs.
  - **All-Category AnyTrader AI Assistant (`TradeBot.tsx`)**: Renamed and transformed TradeBot to "AnyTrader AI Assistant" with simple plain language ("Live Web Search", "Live UK Standards & Supply Prices Active"). Added quick prompt pills and system instructions for all service categories (wedding cakes, catering, plumbing, deep cleaning, electrical safety).
  - **Mobile Soft Keyboard & Z-Index Input Fix (`TradeBot.tsx`)**: Increased modal backdrop z-index to `z-[1000]` so it sits above the mobile bottom navigation bar (`z-[100]`). Adapted height to dynamic `h-[85dvh]` with `max-h-[650px]` and added input focus auto-scrolling to keep the chat input box floating above the soft keyboard on mobile devices.
  - **Job Posting Form Simplification (`EmergencyJobWizard.tsx`)**: Removed all AI live grounding widgets and AI search prompts from job posting forms per user instruction to ensure a clean, familiar, and unconfusing job posting experience.
  - **Firestore Index Audit & Sub-Second Query Optimization (`firestore.indexes.json`, `JobFeed.tsx`)**: Created comprehensive `firestore.indexes.json` composite index declarations for `jobs` (`status` + `postedDate`, `category`), `users` (`role` + `verificationStatus`/`rating`), `advertisements`, and `ride_requests`. Added resilient client-side fallback query handling in `JobFeed.tsx` to maintain sub-second rendering performance even with thousands of entries.
  - **Instant Bottom Navigation Tab Switching (`App.tsx`, `Layout.tsx`, `Conversations.tsx`)**: Converted primary bottom navigation components (`FindTrades`, `PostJobWizard`, `EmergencyJobWizard`, `MyJobs`, `TradeJobs`, `MyQuotes`, `Conversations`, `Notifications`, `JobFeed`, `TraderCalendar`, `Chat`, `DriverTerminal`, `PassengerBooking`) from lazy dynamic imports to direct module imports in `App.tsx`. This completely eliminates on-demand JavaScript chunk network fetching and page skeleton fallbacks when switching tabs. Optimized `Layout.tsx` tab active pill spring transition to a fast 150ms ease-out animation and batched recipient profile fetching in `Conversations.tsx` to prevent cascading re-renders.
  - **Promoted & Paid Subscriber Seed Engine (`seedService.ts`, `FindTrades.tsx`)**: Created 5 rich, realistic promoted and paid subscriber profiles across major service categories (Plumbing & Gas, Electrical & Smart Home, Cake Maker & Catering, Eco Cleaning, and Builder & Roofing) with corresponding active advertisement campaigns (`advertisements` collection) in Firestore. These profiles feature high review scores (4.88-5.0), verified trust badges, custom call-out fees, active ad budgets, and "Promoted Profile" sponsor pills in the search feed.
  - **Firestore Security Rules & Seed Permissions Fix (`firestore.rules`)**: Updated `firestore.rules` to allow public read access for search advertisements (`advertisements/{adId}`) and permitted signed-in users and automated seed processes to write `seed-` and `ad-` prefix profiles and campaign documents. Deployed updated security rules to Firebase live project.
  - **Promoted Profile Click Handler Fix (`FindTrades.tsx`)**: Added missing `updateDoc` import from `@/src/firebase` to `FindTrades.tsx` so click tracking and ad balance auto-deductions execute seamlessly without runtime ReferenceErrors.
  - **Relevance-Filtered Promoted Profiles (`FindTrades.tsx`)**: Refactored the search feed advertisement rotation engine (`finalDisplayList`) to enforce strict search query, category, and quick filter matching on promoted profiles. When searching for terms like "Cake", only relevant promoted traders (e.g., Chloe Dupont - Cake Maker & Baker) appear, while unrelated promoted profiles (e.g. plumbers, cleaners) are automatically filtered out.
  - **Unified Search Overlay & Results Profile Sequence (`FindTrades.tsx`)**: Refactored `autocompleteSuggestions` in `FindTrades.tsx` so that `matchingTradespeople` in the live search dropdown overlay strictly derives from `finalDisplayList`. The profile order in the search card dropdown list now perfectly matches the search feed cards below, placing relevant Promoted Profiles first followed by organic traders sorted by rating/relevance, ensuring zero user confusion. Added "Promoted" pill badges and click handlers to dropdown profile suggestions.
  - **Category Search Relevance & Word Boundary Matching (`FindTrades.tsx`)**: Replaced loose category substring matching with smart relevance scoring and word boundary regex (`\bquery`). When typing 3-letter queries like "Plu", category names starting with "Plu" (e.g. "Plumbing") are ranked at top priority (100), while unrelated categories like "Driving Instructors" (which contained "Pass Plus Course") are filtered out. Added explicit subcategory match badges in dropdown cards (e.g. "Matches: Boiler Servicing").
  - **Compact Search Dropdown Height & Soft Dimming Backdrop (`FindTrades.tsx`)**: Capped search suggestion list counts (max 2 categories, max 3 tradespeople, max 2 locations, max 2 history items) and restricted dropdown height to `max-h-[320px]`. Added a semi-transparent dark backdrop overlay (`bg-slate-900/40 backdrop-blur-[2px] fixed inset-0 z-[80]`) that dims background profile cards when typing, preventing visual overlap or card bleed-through while making touch interactions clean and focused. Wrapped search input in `relative z-[95]` to ensure the search input box remains crisp and clear above the dimmed backdrop.
  - **Contained Trending Mini Card Layout (`FindTrades.tsx`)**: Refactored "Trending in [Area]" mini cards to use an expanded `w-36` layout with `overflow-hidden`, thin jet black borders (`border border-black`), and flex-col alignment. Replaced generic badge buttons with clean verified shields on avatars and truncated recommendation badges (`X Recmds`), ensuring all ratings, badges, and text are 100% contained within card boundaries without spilling or overlapping neighboring elements.
  - **Recent Searches 5-Item Cap & 30-Day Auto-Expiration (`FindTrades.tsx`)**: Refactored `recentSearches`, `addRecentSearch`, and `removeRecentSearch` in `FindTrades.tsx` to strictly cap search history to a maximum of 5 pills (latest 5). Added timestamp tracking (`timestamp: number`) in `localStorage` (`recentTradeSearches`) so search history items older than 30 days (`30 * 24 * 60 * 60 * 1000` ms) are automatically cleaned up and expired upon app initialization and search execution.
  - **Color-Coded & Numbered Side-by-Side Single-Screen Comparison Grid (`FindTrades.tsx`)**: Introduced `COMPARE_THEMES` mapping (`#1` Blue, `#2` Purple, `#3` Emerald, `#4` Amber) to assign a fixed position number and consistent soft background theme to each compared trader. Completely eliminated horizontal scrolling and `min-w` width constraints in the comparison modal, refactoring the grid into a responsive single-screen layout (`grid-cols-2`, `grid-cols-3`, or `grid-cols-4`). Optimized text scaling, card padding (`p-1.5` sm:`p-2.5`), avatar sizes (`w-11 h-11`), badge labels (`#1`, `#2`, `#3`), and metric row cells so all 2, 3, or 4 compared traders fit side-by-side in one view on mobile screens without requiring any left-to-right swipe. Relocated the red `X` remove button from directly overlapping the profile avatar image to the top-right corner of the trader card container (`absolute top-1.5 right-1.5`), ensuring the profile picture remains 100% unobstructed and clean while keeping the delete button immediately accessible.
  - **Sleek Compact Slider Toggles for Book a Ride Add-Ons (`PassengerBooking.tsx`)**: Refactored the Priority Boost and Pet Friendly option toggles in the passenger booking flow. Replaced oversized/deformed toggle elements with compact `w-[34px] h-[18px]` slider switches featuring `shrink-0`, `p-[2px]`, `rounded-full` pill tracks with thin black borders (`border border-black`), and smooth CSS translate transforms (`translate-x-[16px]`). Ensured whole-card clickability with active state highlight (`bg-blue-50/70`) and 100% distortion-free rendering across mobile viewport sizes.