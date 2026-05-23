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
- 2026-05-22: Resolved standard Firestore timeout issue ("Could not reach Cloud Firestore backend. Backend didn't respond within 10 seconds") observed in WebViews, Capacitor, and sandboxed runtimes. Configured `useFetchStreams: false` in `src/firebase.ts` to instruct the Firestore JS client to use standard XMLHttpRequests/fetch POSTs rather than streaming fetch connections, which often freeze, get blocked, or get dropped in containerized/webview networks.
- 2026-05-22: Fixed timing issue where the Verification PIN and Waiting for Confirmation banners did not appear live after a quote was accepted until a manual refresh or app re-launch. Converted the static `getDoc` download on the job document in `JobDetails.tsx` into a real-time `onSnapshot` subscription listener. Any downstream changes to the job document (status, pins, confirmation updates, route handshakes) are now instantly synchronized and rendered in the React view.
- 2026-05-22: Resolved "Missing or insufficient permissions" error when completing a job. Fixed `firestore.rules` where updating `/users/{userId}` was failing because `.hasOnly()` is not a valid method on `rules.Set` in Firestore rules version '2'. Replaced the invalid hasOnly constraint with a standard `hasAll()` subset assertion on the list of allowed keys, allowing homeowners to correctly increment performance stats (`phantomFeesSaved`, `totalJobsDone`, etc.) on the tradesperson's document when completing a job. Correctly deployed rules and verified linter/compiler outputs completely green.
- 2026-05-23: Implemented dual-rail Google Maps API key resolution supporting simultaneously restricted Web and Native (Android Capacitor) environments. Rather than relying solely on `VITE_GOOGLE_MAPS_API_KEY`, all 6 maps-enabled pages now automatically detect if they are running inside a native mobile wrapper (using `window.Capacitor.isNativePlatform`). If true, it dynamically loads `VITE_GOOGLE_MAPS_API_KEY_ANDROID` if available, and falls back to `VITE_GOOGLE_MAPS_API_KEY`. This keeps both the AI Studio website preview and wrapped mobile apps functional without API-Key HTTP Referrer conflicts. Added environment variable explanation to `.env.example`.