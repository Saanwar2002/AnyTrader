# Project State & Instructions

## Core Directive
- **CRITICAL**: This is a multi-portal ecosystem (Home + Rides) sharing one database.
- **MANDATORY**: You **MUST** read `DEVELOPMENT.md` before modifying any shared services, database schemas (`firebase-blueprint.json`), or security rules (`firestore.rules`). Failure to do so will break cross-portal synchronization.
- **DOCUMENTATION**: You **MUST** update `DEVELOPMENT.md` after completing your work to capture any architecture or schema changes for the next agent.

## Current Status
- **Last Updated**: 2026-05-02
- **Working State**: Application is fully functional with a live Driver Terminal, AnyRoller Master Admin, and robust Post-Ride Driver Review engine.
- **Key Features Implemented**:
  - **Extensive Service Catalog**: 76 major categories and 797 subcategories.
  - AnyTrader Rides Integration: Unified auth/role mapping.
  - **Live Driver Terminal**: High-accuracy GPS tracking, session lifecycle timers, and a persistent status HUD.
  - **Direct-to-Driver QR Payments**: Fully integrated Stripe Connect split-payment system. Drivers represent a QR code for instant scan-to-pay transactions with automatic 12% platform commission deduction.
  - **Mobile-Adaptive UI**: Collapsible privacy drawers and touch-optimized map controls.
  - **AnyRoller Master Admin**: Complete portal for managing rides, drivers, financials, dispatch rules, and safety/compliance.
  - **Post-Ride Reviews**: 5-star Rating system integrated with "cooling-off" period mechanisms, quick action tags, and live Master Admin escalations for poor safety ratings.

## Active Task
- **Completed**: UI/UX enhancement for Trip Confirmation and dynamic Tag-based driver reviews.
- **Ready for Next Phase**: TBD.

## Project Conventions
- **Styling**: Tailwind CSS with a "Modern Professional" aesthetic.
- **Card & Box Styling**: Whenever creating placeholders, boxes, or cards (small or big), MUST strictly use a compact square with rounded edges and a thin jet black border (e.g., `rounded-xl border border-black shadow-sm bg-white`). Do not use other border colors or styles unless explicitly requested.
- **Typography**: Always use jet black (`text-black`) for any text which is meant to be readable.
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
