# AnyRide Command Center - Implementation Checklist

## Phase 1: Architecture & Navigation
- [x] Create `MasterAdminLayout` (Portal Switcher bridging AnyTrader, AnyRide, and Super Admin).
- [x] Detach AnyRide features from the legacy `AnyTraderAdmin` dashboard.
- [x] Set up AnyRide Sidebar Navigation (Sidebar component with tabs for all AnyRide sections).

## Phase 2: Core Operational Dashboards
- [x] **Screen 1: Dashboard** - Live Status, KPIs, active alerts, volume charts.
- [x] **Screen 2: Live Map** - Mapbox integration, real-time driver tracking, layers.
- [x] **Screen 3: Active Rides** - High-level monitoring of rides currently searching, matching, or in-progress.
- [x] **Screen 14: Scheduled Rides** - Managing future bookings and auto-dispatch logic.
- [x] **Screen 4: Ride History** - Searchable archive of all rides with route replays and receipts.

## Phase 3: Financials & Configuration
- [x] **Screen 5: Payments & Revenue** - Stripe Connect overview, platform revenue, QR payment funnel stats.
- [x] **Screen 6: Priority Settings** - Configure platform fees for priority status dispatch.
- [x] **Screen 7: Pricing & Fares** - Base rates per vehicle type, multi-stop pricing, surge modifiers.
- [x] **Screen 10: Vehicle Management** - Definitions for Standard, Executive, Minibus, Accessible types.
- [x] **Screen 12: Zones & Geofences** - Draw zones via map, manage operational boundaries and surcharges.
- [x] **Screen 13: Dispatch Engine** - Configure logic for driver matching, radius step-ups, and timeouts.

## Phase 4: User & Safety Management
- [x] **Screen 8: Drivers** - Comprehensive driver list, profiles, Stripe link, and the Approval Queue.
- [x] **Screen 9: Riders** - Rider list, payment strikes, and suspensions.
- [x] **Screen 11: Documents & Compliance** - Monitor driving licenses, MOTs, DBS checks, and expirations.
- [x] **Screen 15: SOS & Safety (Critical)** - Active red-alert dashboard, SOS audio access, incident resolution.

## Phase 5: Support & Engagement
- [x] **Screen 16: Support Tickets** - Ticketing system for rider/driver issues.
- [x] **Screen 17: Ratings & Reviews** - Moderation, low ratings flagging, trend monitoring.
- [x] **Screen 18: Broadcast Messaging** - Send Push/SMS/Emails contextually to user groups.
- [x] **Screen 19: Promotions** - Promo code configurations (e.g. free priority rides).
- [x] **Screen 20: Referrals** - Credits management and refer-a-friend statistics.

## Phase 6: System & Admin
- [x] **Screen 21: Analytics** - Detailed cross-filtered dashboards (Rides, Revenue, Wait Times).
- [x] **Screen 22: AnyTrader Integration** - KPIs for cross-sells between Trader and Ride platforms.
- [x] **Screen 23: Admin Users & RBAC** - Staff access level assignment (Ops, Finance, Support).
- [x] **Screen 24: Audit Log** - Immutable tracking of admin actions.
- [x] **Screen 25: Global Settings** - Platform toggle switches, external API key entries (Stripe, Twilio, Mapbox).
