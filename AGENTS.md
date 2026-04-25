# Project State & Instructions

## Core Directive
- **CRITICAL**: This is a multi-portal ecosystem (Home + Rides) sharing one database.
- **MANDATORY**: You **MUST** read `DEVELOPMENT.md` before modifying any shared services, database schemas (`firebase-blueprint.json`), or security rules (`firestore.rules`). Failure to do so will break cross-portal synchronization.
- **DOCUMENTATION**: You **MUST** update `DEVELOPMENT.md` after completing your work to capture any architecture or schema changes for the next agent.

## Current Status
- **Last Updated**: 2026-04-25
- **Working State**: Application is fully functional with a live Driver Terminal and AnyRide Master Admin.
- **Key Features Implemented**:
  - **Extensive Service Catalog**: 76 major categories and 797 subcategories.
  - AnyTrader Rides Integration: Unified auth/role mapping.
  - **Live Driver Terminal**: High-accuracy GPS tracking, session lifecycle timers, and a persistent status HUD.
  - **Direct-to-Driver QR Payments**: Fully integrated Stripe Connect split-payment system. Drivers represent a QR code for instant scan-to-pay transactions with automatic 12% platform commission deduction.
  - **Mobile-Adaptive UI**: Collapsible privacy drawers and touch-optimized map controls.
  - **AnyRide Master Admin**: Complete portal for managing rides, drivers, financials, dispatch rules, and safety/compliance.

## Active Task
- **Driver Dashboard Revamp**: Transitioning the "Earnings" and "Stats" components into a live performance hub using real trip payment data and Stripe Connect balances.

## Project Conventions
- **Styling**: Tailwind CSS with a "Modern Professional" aesthetic.
- **Icons**: Lucide React.
- **Animations**: Motion (framer-motion).
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
