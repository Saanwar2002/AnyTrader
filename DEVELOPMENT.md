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
*   **The Global Context Switcher:** Introduction of the `PortalContext` and a floating, draggable `PlatformSwitcher` widget to hot-swap navigation layouts based on `activePortal` ('anytrader' vs 'anyride') without losing state or forcing re-authentication. The legacy "MagicBubble" was deleted.
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
    *   *Google Maps Readiness:* These precise layout constraints (`55vh` max-heights, compressed spacing, shifted focal tracking, multi-lat-lng stop injection) are logged here and must be explicitly replicated 1:1 if the platform swaps `react-leaflet` OpenStreetMap components for `@react-google-maps/api` structures in the future.

