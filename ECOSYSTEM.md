# 🌐 ANYTRADER ECOSYSTEM BIBLE
**Handoff Document for Multi-Portal Synchronization (Home + Rides)**

## 🚀 Context
AnyTrader is a unified ecosystem. The "Home" app (Plumbers, Builders) and the "Rides" app (Taxis, Chauffeurs) share the same Firebase database and user base.

## 🧠 The Shared Heart (Database)
- **Project ID**: (See `firebase-applet-config.json`)
- **Shared User Collection**: `/users/{userId}`
  - `role`: Can be multiple (e.g. `isHomeowner: true`, `isDriver: true`).
  - `stripeAccountId`: Shared wallet ID for all payouts.
  - `fairnessScore`: Cross-portal behavioral score. If a user is a "serial complainer" in the Home app, they should be flagged in the Rides app.

## 💳 Payment Infrastructure (Stripe Connect)
- **Model**: Direct Charges with Application Fees.
- **Service Bridge**: `src/services/stripeIntegrationService.ts`
- **Dual-Rail Logic**:
  - **Total < £400**: Always use **Standard Card Rail** (Apple Pay/Google Pay).
  - **Total >= £400**: Default to **Open Banking (Pay by Bank)** to avoid high percentage fees on thousands of pounds.
- **Commission Cap**: Platform fees are capped at **£250 per job** to protect large contractors.

## 🔐 Security & "Rights"
- **Unified Auth**: A user logged into the Home app should be automatically authenticated in the Rides app via Firebase Auth.
- **Staff Logic**: Admin staff should have access to the **Master Admin Dashboard** (`admin.anytrader.co.uk`). The Taxi app should NOT build its own admin panel. Data should flow to the central command center.

## 🚕 Taxi-Specific Integration Rules
1. **Ride Ingestion**: Post emergency ride requests to the `ride_requests` collection.
2. **Handshake Verification**: All rides MUST end with a QR code scan. This releases the Stripe Escalated/Escrow funds instantly to the driver’s wallet.
3. **No Cash Policy**: To ensure the platform commission is collected and the driver is safe, AnyTrader Rides is an **All-Digital** ecosystem.

## 🧮 Ride Pricing Engine & Commission
The Taxi App MUST calculate upfront pricing using the Google Maps Routes API, governed by dynamic variables held in `platform_config/ride_fees`:
- **Formula**: `Base Fare + (Miles * Distance Rate) + (Minutes * Time Rate)`
- **Minimum Fare Guardrail**: The app must calculate the formula and compare it against a global Minimum Fare (e.g., £5.00). If the formula result is lower, the Minimum Fare is charged to protect drivers on short (<1 mile) trips.
- **Geofenced Surcharges (Airports/Tolls)**: Extra fees (e.g., £10 airport drop-off, ULEZ) must be auto-added to the total fare if the route intersects an admin-defined geofenced zone.
- **Platform Commission**: The starting commission for Rides is fixed at **12%**. This is strictly applied to the transit formula ONLY (`Base + Distance + Time`). 100% of any Surcharge amount must bypass commission and pass directly to the driver as reimbursement.

## 🆘 Critical Constants
- `PAYMENT_RAIL_THRESHOLD`: £400.00
- `MEDIATION_STAKE`: £15.00 (Mandatory for disputes)
- `QUICK_SETTLE_WINDOW`: 24 Hours

---
*Created for the AnyTrader Rides Agent by the AnyTrader Home Project Lead.*
