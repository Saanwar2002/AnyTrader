# Project State & Instructions

## Core Directive
- **CRITICAL**: This is a multi-portal ecosystem (Home + Rides) sharing one database.
- **MANDATORY**: You **MUST** read `DEVELOPMENT.md` before modifying any shared services, database schemas (`firebase-blueprint.json`), or security rules (`firestore.rules`). Failure to do so will break cross-portal synchronization.
- **DOCUMENTATION**: You **MUST** update `DEVELOPMENT.md` after completing your work to capture any architecture or schema changes for the next agent.

## Current Status
- **Last Updated**: 2026-04-15
- **Working State**: The application is fully functional and production-ready.
- **Key Features Implemented**:
  - **Extensive Service Catalog**: 76 major categories and 797 subcategories covering Trades, Digital Services, Health, Beauty, and Care.
  - Job Feed with "Saved Feeds" and Natural Language Search.
  - Job Posting Wizard with AI Cost Estimator, Voice-to-Job, Scope Refiner, and Pricing Insights.
  - Real-time Chat and Quote Management with AI Material Lists.
  - AI Job Recommendations and Smart Schedule Optimization.
  - AI Dispute Mediator and Security Alert System.
  - **Admin API Key Management** for secure platform configuration.
  - **Polished Mock Checkout** for subscription tiers.
  - **Universal Calendar Integration** (Google, Outlook, Apple).
  - **AnyTrader Rides Integration**: Full ecosystem synchronization with a dedicated Taxi portal, including shared auth, role mapping, and real-time emergency dispatch ingestion.

## Active Task
- Integration with AnyTrader Rides completed.
- The application is now a multi-portal ecosystem with home services and transport services unified.

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
