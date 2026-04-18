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

---

## 🆘 Critical Recovery
If the apps become desynchronized or "Missing Permissions" errors appear globally:
1.  Check `firestore.rules` for deleted blocks.
2.  Compare `firebase-blueprint.json` against the live Firestore structure.
3.  Ensure `firebase-applet-config.json` contains the correct `firestoreDatabaseId`.

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

## 📝 Next Agent Checklist
1. Review `ROADMAP.md` for the next logical feature set (e.g. Community Forums or ATS refinements).
2. The Fast Pass feature logic in `server.ts` relies on `notificationSettings.quietHoursEnabled` and specific match structures. If refactoring scheduling, ensure `visibleAt` exclusivity timestamps are preserved in `db.collection("notifications")`.

### Recent UI Updates (April 18, 2026)
*   **Toggle Optimization**: Merged "Emergency Offers" and "Priority Offers" toggles into a single, compact UI container in `TradesDashboard.tsx` with reduced container (`h-9`) and toggle button sizing to fit mobile viewports better.
*   **Label Refinement**: 
    *   "Emergency" -> "Emergency Offers"
    *   "Fast Pass" -> "Priority Offers"
*   **Engagement**: Enhanced the activation flow for "Priority Offers" with an inline explanation toast, and resized the Checkout/Unlock modal (`max-h-[70vh]` with sticky footer) for superior accessibility and scrollability on mobile screens.
