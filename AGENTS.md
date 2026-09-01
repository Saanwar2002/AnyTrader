# Project State & Instructions

## Core Directive
- **CRITICAL**: This is a multi-portal ecosystem (Home + Rides) sharing one database.
- **MANDATORY**: You **MUST** read `DEVELOPMENT.md` before modifying any shared services, database schemas (`firebase-blueprint.json`), or security rules (`firestore.rules`). Failure to do so will break cross-portal synchronization.
- **DOCUMENTATION**: You **MUST** update `DEVELOPMENT.md` after completing your work to capture any architecture or schema changes for the next agent.

## Current Status
- **Last Updated**: 2026-09-01
- **Working State**: Application is fully functional with TradeOS Free Operating System tools, Property Passports, Multi-Property Portfolio Automation, Tenant Issue Portal, AI Pre-Quote Price Transparency, 40+ Signal Intelligent Matching Engine, Trader Video Credential Verification, B2B Enterprise & Housing Association Portal ("Gotham" Layer), Gotham B2B Per-Door SaaS Licensing Engine, Strategy 1 WhatsApp Privacy Bridge, Driver Terminal, AnyRoller Master Admin, Post-Ride Driver Review engine, On-Demand Delivery & Bulky Appliance Transport, Mobile Wheelie Bin Cleaning services, Tokenized Keyword Search, Flipped Trader Cards with Trader Name & Trade Category Header, 30-Second Extended Auto-Close Timer, General Labour, Trade Mates & Site Helpers Category, 2-Second Promotional Poster Splash Screen, 15 Skills/Tags Profile Limits, AI Copilot Trade Recommendation Engine, Slim Dual Action Buttons in Trader Preview Modal, and Top 5 Most Recent Review List Pagination (+5 Incremental Expansion).
- **Key Features Implemented**:
  - **PWA Mobile App Icon & Installed Home Screen App (`manifest.json` & `index.html`)**: Fully configured Progressive Web App manifest (`manifest.json`), high-resolution app store icon assets (`app-icon.jpg`, `pwa-192.jpg`, `pwa-512.jpg`, `apple-touch-icon.jpg`), dark navy theme color (`#002B5C`), and standalone iOS/Android home screen launcher tags for seamless native-like installation.
  - **Responsive Full-Screen 5-Second Poster Splash Screen with Logo Motion (`SplashScreen.tsx`)**: Responsive full-screen startup splash overlay with Framer Motion scale & pulse logo animations, animated top run-down timer bar (100% to 0% over 5s), live countdown badge ("Auto-close in 5s"), skip button, dual-column breakdown (Homeowner benefits on left, Tradesperson Zero-Lead-Fee callouts on right), 86+ categories, and TradeOS branding.
  - **General Labour, Trade Mates & Site Helpers (Category 86)**: Platform-wide category enabling homeowners and primary tradespeople to post jobs or hire manual assistance for garden digging, trenching, material offloading (plasterboard, bricks, timber), demolition & strip-out, skip loading, and trade mate support with CSCS card badges and fuzzy match indexing.
  - **B2B Social Housing & Portfolio SaaS ("Gotham" Layer Subscription)**: Per-door monthly licensing engine (`calculateGothamSaaSPlan` & `CorporatePortal.tsx`) charging housing associations, local councils, and private landlord portfolio managers a volume-tiered fee (£4.50/door for Starter 1-100 doors, £3.50/door for Growth 101-1,000 doors, £2.50/door for Enterprise 1,000+ doors) with 15% annual billing discounts, interactive pricing & ROI calculator modal (10–50,000 doors), consolidated MTD invoicing, estate-level per-door fee allocation, and dynamic estate onboarding recalculation.
  - **Refined Tokenized Keyword Search Matching**: Platform-wide matching engine (`fuzzyMatch.ts`) enforcing front-of-word prefix matching for the first 3-4 letters of keywords across service categories, trader tags, skills, and profiles — preventing partial word substring matches in the middle/end of words (e.g. `pet` matches `Pet Sitting` but never `Carpet`).
  - **On-Demand Delivery & Bulky Goods Courier (Category 84)**: Dedicated category supporting ASAP parcel delivery, same-day courier dispatch, bulky item & heavy appliance transport (washing machines, fridges, dishwashers, cookers), marketplace & store pickups (eBay, Facebook, B&Q, Currys), and on-demand van dispatch with full fuzzy search indexing.
  - **Mobile Bin Cleaning Services**: Dedicated subcategories under `Specialist Cleaning` (`Wheelie Bin Cleaning`) and `Industrial & Commercial Cleaning` (`Bin Store / Refuse Area Cleaning`) with keywords for domestic and commercial bin washing.
  - **BNPL & Large Repair Financing ("FlexiPay")**: Integrated BNPL financing options for major unexpected homeowner repairs (£1,000+) supporting 3-12 month terms, 0% APR on 3-6 months, and 1-tap pre-approval.
  - **Property Risk Analytics**: Aggregate property health and insurance risk scoring across 4 vectors (Roofing, Electrical, Plumbing, Damp/Mould), insurance discount estimation (up to 20%), and 5-year maintenance expenditure forecasting.
  - **B2B Enterprise & Housing Association Portal ("Gotham" Layer)**: High-capacity command center handling thousands of social housing units, real-time SLA repair time tracking (Emergency 2h SLA, Urgent 24h SLA, Routine 5-day SLA), Awaab's Law damp & mould compliance, 1-tap auto-dispatch, and contractor performance matrix.
  - **AI Pre-Quote Price Guide**: Real-time benchmark price ranges, postcode surcharge analysis, seasonal impact forecasts, and material vs labor breakdown before posting jobs.
  - **40+ Signal Intelligent Matching Engine**: Multivariate trader scoring system factoring rating history, location proximity, past job similarity, video verification, and schedule availability.
  - **Trader Video Credential Verification**: Live camera recorder & file uploader enabling 15-30s video selfie credential intros with trust badges (+35 match points).
  - **Multi-Property Landlord Portfolio Automation**: Bulk CP12 & EICR compliance tracking across property portfolios with ⚡ 1-click auto-dispatch to local verified engineers.
  - **Tenant Access & Repair Reporting Bridge**: Dedicated tenant portal (`/tenant-report`) allowing tenants to log repairs directly into property passports with in-app WhatsApp & link sharing.
  - **Automated Trade Booking via Passport Specs**: 1-Tap Trade Dispatch pre-loaded with boiler brand/model, roof condition, EPC ratings, access instructions, and tenant contact info.
  - **Strategy 1 Privacy Share Bridge**: Secure in-app privacy URL generation for WhatsApp sharing of Jobs, Quotes, Invoices, and Property Passports without exposing personal phone numbers or emails.
  - **Property Passport Digital Twin**: Landlord and Homeowner digital specs dashboard tracking EPC ratings, CP12 & EICR compliance expiration dates with automated alerts, maintenance history, ROI calculations, and AI predictive maintenance.
  - **TradeOS Financials & Cash Flow Engine**: Real-time cashflow dashboard tracking paid earnings, outstanding invoices, and UK Sole Trader Self-Assessment tax & NI reserves.
  - **Materials Procurement & AI Sourcing**: Material line item tracker with automated AI material list generation & trade market price estimator.
  - **Extensive Service Catalog**: 76 major categories and 797 subcategories.
  - **Live Driver Terminal**: High-accuracy GPS tracking, session lifecycle timers, and a persistent status HUD.
  - **Direct-to-Driver QR Payments**: Fully integrated Stripe Connect split-payment system with automatic 12% commission deduction.

## Active Task
- **Completed**: Phase 1, Phase 2, Phase 3, Phase 4 & Phase 5 (TradeOS Core, Property Passport, Multi-Property Portfolio Automation, Tenant Repair Portal, 1-Tap Specs Dispatch, AI Price Transparency, 40+ Signal Engine, Trader Video Verification, B2B Enterprise Portal "Gotham" Layer, BNPL FlexiPay Repair Financing, and Property Risk Analytics) fully implemented, verified, and compiled cleanly.

## Project Conventions
- **Styling**: Tailwind CSS with a "Modern Professional" aesthetic.
- **Card & Box Styling**: Whenever creating placeholders, boxes, or cards (small or big), MUST strictly use a compact square with rounded edges. For light backgrounds (e.g. `bg-white`, `bg-slate-50`), use a thin jet black border (`border border-black`). For dark backgrounds (e.g. `bg-slate-900`, `bg-black`), use a thin white border (`border border-white/20` or `border border-white`). Do not use other border colors or styles unless explicitly requested.
- **Typography**: Always use jet black (`text-black`) for any text which is meant to be readable.
- **Icons**: Lucide React.
- **Animations**: Motion (framer-motion).
- **Driver Terminal UI**: The styling for the heads-up navigation text (directions over the map) MUST REMAIN transparent background, dark blue (`#2563EB`) font color, with a faint white drop shadow (`drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]`), no text stroke, and no black background box. This has been explicitly locked by the user.
- **Premium Anti-Glare Golden Map Theme**: The Google Map within the Driver Terminal and Passenger Booking must strictly use the custom "Premium Anti-Glare Golden" JSON styling scheme (found in `premiumMapOptions` with a `#ebe3cd` geometry base and dark contrast labels). Do NOT add a `mapId` parameter to the `<GoogleMap>` component options or hook as it enforces WebGL Vector Map styling which overrides and breaks the custom JSON styles.
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
