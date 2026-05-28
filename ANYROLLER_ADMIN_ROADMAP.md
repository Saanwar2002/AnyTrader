# 🚕 AnyRoller Admin Side-Menu Completion Roadmap

This document serves as the master checklist and architecture roadmap for completing the **AnyRoller Admin Command Center** side-menu files. 

## 🏗️ Core Synchronization & Styling Constraints
Before writing any code or updating files, please ensure strict conformance with the following project rules:
1. **MANDATORY DB Check**: Refer to `DEVELOPMENT.md` and `firebase-blueprint.json` before writing database schemas or querying Firestore.
2. **Card & Box Styling (Strict Rule)**:
   - For light backgrounds (e.g. `bg-white`, `bg-slate-50`), use a thin jet black border (`border border-black`).
   - For dark backgrounds (e.g. `bg-slate-900`, `bg-black`), use a thin white border (`border border-white/20` or `border border-white`).
   - Cards/Boxes MUST strictly use a compact square with rounded edges.
3. **Typography**: Always use jet black (`text-black`) for any text meant to be readable on light panels.
4. **Icons**: Strictly use `lucide-react` for any icon requirements.
5. **Animations**: Use `motion` from `motion/react` for any smooth UI transitions.
6. **No Mock Data**: Ensure actual querying from Firestore where possible (e.g. `users`, `ride_requests`, `support_tickets`), falling back gracefully to clean, offline-safe state updates if Firestore has no records yet.

---

## 🗺️ Completion Roadmap Checklist

The AnyRoller Admin side-menu contains **27 distinct modules** grouped by category. This list numbers every module, identifies if it's already functional or is a stub, describes its exact purpose, and shows its implementation checkboxes.

### 📁 Category 1: Core System
- [x] **1. Dashboard (`AnyRollerDashboard`)**
  - **Path**: `src/components/anyroller/AnyRollerDashboard.tsx` (Current: Fully functional)
  - **Purpose**: Executive snapshot of rides network featuring real-time health index, active trips, online driver/rider totals, and quick-action cards.
- [x] **2. Live Map (`LiveMap`)**
  - **Path**: `src/components/anyroller/LiveMap.tsx` (Current: Fully functional with Cost-saving Controls)
  - **Purpose**: Real-time visualization of taxi drivers (querying `live_tracking` with driver coordinates and status) using Google Maps with custom Premium Anti-Glare Golden style schema.
- [x] **3. Active Rides (`RidesCommandCenter`)**
  - **Path**: `src/components/RidesCommandCenter.tsx`
  - **Status**: Implemented & fully functional core simulator, dispatch manager, and active ride telemetry monitor.
- [x] **4. Ride History (`RideHistory`)**
  - **Path**: `src/components/anyroller/RideHistory.tsx` (Current: Fully functional)
  - **Purpose**: Panoramic trip archives from `ride_requests` collection with flexible searching, filtering (by rider, driver, status, payment range), route details, and fee breakdown.

### 📁 Category 2: Financials
- [x] **5. Payments & Revenue (`PaymentsRevenue`)**
  - **Path**: `src/components/anyroller/PaymentsRevenue.tsx` (Current: Fully functional)
  - **Purpose**: High-fidelity dashboard displaying direct driver payouts, company commission splits (12%), gross revenue, three dedicated columns for Today (resets 12:00 AM), Week (starts Monday 00:01 AM), and Month (starts 1st Day 00:01 AM), and connected Stripe onboarding status indicator.
- [ ] **6. Priority Settings (`PrioritySettings`)**
  - **Path**: `src/components/anyroller/PrioritySettings.tsx` (Current: 12-line stub)
  - **Purpose**: Manage fast-pass subscription fees, surge pricing activation rules, and priority dispatcher metrics.
- [ ] **7. Pricing & Fares (`PricingFares`)**
  - **Path**: `src/components/anyroller/PricingFares.tsx` (Current: 12-line stub)
  - **Purpose**: Configurations panel for base fare rates, per-mile rates, per-minute waiting charges, and peak sessional rate schedules, persisting to `platform_settings/transport_pricing`.
- [ ] **8. Subscriptions & B2B (`SubscriptionManager`)**
  - **Path**: `src/components/anyroller/SubscriptionManager.tsx` (Current: 12-line stub)
  - **Purpose**: B2B and Corporate fleet account subscription panels, managing corporate ride credits, and business integrations.
- [x] **9. Tiers, Perks & Privileges (`AdminTierManager`)**
  - **Path**: `src/components/AdminTierManager.tsx`
  - **Status**: Implemented & integrated shared matrix for handling taxi driver subscription tiers, commission rates, and feature limits.

### 📁 Category 3: Users & Verification
- [ ] **10. Drivers (`DriversList`)**
  - **Path**: `src/components/anyroller/DriversList.tsx` (Current: 12-line stub)
  - **Purpose**: Consolidated vehicle drivers directory with statuses, online timers, block lists, and verification overrides.
- [ ] **11. Riders (`RidersList`)**
  - **Path**: `src/components/anyroller/RidersList.tsx` (Current: 12-line stub)
  - **Purpose**: Passenger/rider database tracking trips history, lifetime spend, trust rating, and dispute ratio flags to protect drivers from frivolous complainers.
- [ ] **12. Vehicles (`VehicleManagement`)**
  - **Path**: `src/components/anyroller/VehicleManagement.tsx` (Current: 12-line stub)
  - **Purpose**: Directory of active transport vehicle records (car models, plate numbers, colors, safety class, and age checks).
- [x] **13. Documents & Compliance (`DocumentCompliance`)**
  - **Path**: `src/components/anyroller/DocumentCompliance.tsx`
  - **Status**: Implemented & active doc check pipeline (accepting/rejecting licensing, PHV records, driver permits, and insurance papers).

### 📁 Category 4: Operations
- [ ] **14. Zones & Geofences (`ZonesGeofences`)**
  - **Path**: `src/components/anyroller/ZonesGeofences.tsx` (Current: 12-line stub)
  - **Purpose**: Config for operative areas and custom polygon geofencing to manage strict regional blockages or zone-specific automatic surcharges.
- [ ] **15. Dispatch Engine (`DispatchEngine`)**
  - **Path**: `src/components/anyroller/DispatchEngine.tsx` (Current: 12-line stub)
  - **Purpose**: Dispatch algorithm manager: configure lookup radius thresholds, target response times, automated rollover retry count, and newcomer driver order distribution boosts.
- [ ] **16. Scheduled Rides (`ScheduledRides`)**
  - **Path**: `src/components/anyroller/ScheduledRides.tsx` (Current: 12-line stub)
  - **Purpose**: Real-time calendar/schedule controller showing upcoming pre-booked rides with quick re-assign action tools.

### 📁 Category 5: Support & Safety
- [ ] **17. SOS & Safety (`SOSManager`)**
  - **Path**: `src/components/anyroller/SOSManager.tsx` (Current: 12-line stub)
  - **Purpose**: Primary priority dashboard listening to active SOS alerts, displaying driver-passenger GPS locations, trigger coordinates, panic type, and escalation resolution states.
- [ ] **18. Support Tickets (`SupportTickets`)**
  - **Path**: `src/components/anyroller/SupportTickets.tsx` (Current: 12-line stub)
  - **Purpose**: Support ticketing workflow for rider-driver issues (e.g., lost items, fare disputes, app bugs) with status columns (Open, In Progress, Resolved).
- [ ] **19. Ratings & Reviews (`RatingsReviews`)**
  - **Path**: `src/components/anyroller/RatingsReviews.tsx` (Current: 12-line stub)
  - **Purpose**: Monitor ratings logs, low review feedback investigations under 14-day cooling-off locks, and user experience trend indicators.
- [ ] **20. Broadcasts (`BroadcastMessaging`)**
  - **Path**: `src/components/anyroller/BroadcastMessaging.tsx` (Current: 12-line stub)
  - **Purpose**: Admin broadcast console for pushing notifications and alerts to all Riders or Drivers based on target area, portal roles, and schedules.

### 📁 Category 6: Marketing
- [ ] **21. Promotions (`Promotions`)**
  - **Path**: `src/components/anyroller/Promotions.tsx` (Current: 12-line stub)
  - **Purpose**: Manage dynamic discount codes, referral voucher caps, percent/flat deductions, and active timelines.
- [ ] **22. Referrals (`Referrals`)**
  - **Path**: `src/components/anyroller/Referrals.tsx` (Current: 12-line stub)
  - **Purpose**: Tracks inviter-invitee double-sided taxi referral code balances, pending bonus credits, and automated abuse/self-referral prevention settings.
- [ ] **23. Analytics (`Analytics`)**
  - **Path**: `src/components/anyroller/Analytics.tsx` (Current: 12-line stub)
  - **Purpose**: Rich business analytics charts (using `recharts`) showing rides growth, driver churn, peak hour booking maps, average wait time index, and CSV extraction tools.

### 📁 Category 7: System & Security
- [ ] **24. AnyTrader Integration (`AnyTraderIntegration`)**
  - **Path**: `src/components/anyroller/AnyTraderIntegration.tsx` (Current: 12-line stub)
  - **Purpose**: Set cross-portal rules for the Super App ecosystem, directory categorizations, homeowner dispatcher tie-ins, and service mappings.
- [ ] **25. Admin Users & RBAC (`AdminUsers`)**
  - **Path**: `src/components/anyroller/AdminUsers.tsx` (Current: 12-line stub)
  - **Purpose**: Access dashboard managing Command Center staff, sub-admin view levels, and custom Role-Based Access Control privileges.
- [ ] **26. Audit Log (`AuditLog`)**
  - **Path**: `src/components/anyroller/AuditLog.tsx` (Current: 12-line stub)
  - **Purpose**: Security ledger recording critical administrator actions, configuration logs, database overrides, and SOS escalations histories for perfect transparency.
- [ ] **27. Settings (`GlobalSettings`)**
  - **Path**: `src/components/anyroller/GlobalSettings.tsx` (Current: 12-line stub)
  - **Purpose**: Core platform configuration parameters including emergency maintenance triggers, version control parameters, legal documents, and API configurations.

---

## 📅 Execution Strategy & Phase Structure

To ensure maximum focus, professional polish, and bug-free compilation on each step:
1. **Discuss & Plan Each Section**: We will propose the detailed UI design mock and fields for the next section first.
2. **Implement**: Create/Edit the typescript component with Tailwind CSS, `motion/react` animations, and Firestore listeners.
3. **Audit**: Run the linter (`lint_applet`) and compiling test (`compile_applet`) to ensure clean execution.
4. **Mark Complete**: Re-update this document (`ANYROLLER_ADMIN_ROADMAP.md`) checking off the finished item.
5. **Yield**: Halt tools and wait for feedback before proceeding to the next item.
