# Project State & Instructions

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

## Active Task
- All planned AI features from `ROADMAP.md` have been implemented.
- The application is in a highly advanced state with full-stack AI integration.

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
1. Check `firebase-blueprint.json` for the data model.
2. Check `ROADMAP.md` for planned features.
3. The main entry point is `App.tsx`, and the core business logic is in `JobFeed.tsx`, `JobDetails.tsx`, and `PostJobWizard.tsx`.

## Pending Verification
- All pending verifications completed. The AI Job Recommendations system correctly handles guest traders and expired emergency jobs.
