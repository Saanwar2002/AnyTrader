# AI Feature Roadmap - MyLocalTraders

This roadmap outlines the planned AI-powered enhancements to make the platform more user-friendly for both homeowners and tradespeople.

## Phase 1: Tradesperson Efficiency (COMPLETED)
- [x] **AI Quote Drafter**: Generate professional, personalized quote messages based on job details and tradesperson profile.
- [x] **Review Summarizer**: AI-generated summaries of tradesperson reviews to help homeowners make faster decisions.

## Phase 2: Homeowner Onboarding & Job Quality (COMPLETED)
- [x] **AI Photo Diagnosis**: Analyze job photos to suggest categories, urgency, and potential causes.
- [x] **Scope Refiner Bot**: Interactive AI questions in the job posting wizard to help homeowners provide better job details.
- [x] **AI Description Improver**: One-tap professional rewriting of job descriptions.
- [x] **Material Shopping List**: AI-generated list of materials for "Labour Only" jobs.

## Phase 3: Advanced UX & Safety (COMPLETED)
- [x] **Natural Language Search**: Allow tradespeople to search jobs using conversational queries.
- [x] **PII & Safety Filter**: Automatically detect and flag sensitive information in public job posts.
- [x] **Smart Schedule Optimization**: Suggest job bookings based on location and existing schedule.
- [x] **Automated Dispute Mediator**: AI-assisted summaries and resolution suggestions for disputed jobs.

## Phase 4: Post-Launch Growth (COMPLETED)
- [x] **AI-Powered Marketing**: Automated social media post generation for tradespeople to showcase their completed jobs.
- [x] **Dynamic Pricing Insights**: AI analysis of local market rates to help homeowners and tradespeople understand pricing trends.
- [x] **Predictive Maintenance Alerts**: Suggest recurring maintenance jobs to homeowners based on their job history.

## Phase 5: Production Readiness (COMPLETED)
- [x] **Admin API Key Management**: Securely update platform secrets (Gemini, Stripe, etc.) from the Admin Dashboard.
- [x] **Polished Mock Checkout**: Interactive, Stripe-inspired payment simulation for subscription tiers.
- [x] **Universal Calendar Support**: One-tap syncing for Google, Outlook, and Apple Calendar.
- [x] **Security Hardening**: Strict Firestore rules for platform configurations and sensitive user data.

## Phase 6: Future Security Enhancements (COMPLETED)
- [x] **Account Farming Prevention**: Implement Firebase Phone Auth (SMS verification) for all Business accounts to prevent multi-account abuse.
- [x] **Automated Fraud Detection**: Integrate device fingerprinting and IP tracking to automatically flag suspicious account creation patterns.
- [x] **Usage-Based Enforcement**: Automatically flag or force upgrades for users exceeding job posting limits for their tier.

## Phase 7: Payment Integration (COMPLETED)
- [x] **Stripe Subscription Checkout**: Implement frontend integration to call `/api/create-checkout-session` and redirect users to Stripe.
- [x] **Stripe Webhook Handler**: Implement server-side webhook listener to update user subscription status in Firestore upon successful payment.

## Phase 8: AI Smart Shop Integration (In Progress)
- [x] **Phase 8.1: The Foundation (UI & Basic Routing)**: Add a distinct shopping cart icon to the main navigation for Trades/Business roles, linking to an external shop with basic query parameters.
- [x] **Phase 8.2: The AI "Teaser" Popover**: Implement a mini-cart dropdown where Gemini AI generates and displays 3 highly relevant product categories based on the user's specific trade profile.
- [x] **Phase 8.3: Seamless E-Commerce Integration**: Implement Single Sign-On (SSO) using secure JWT tokens so users are automatically authenticated on the separate e-commerce site without a second login.
- [x] **Phase 8.4: Ecosystem Synergy & Rewards**: Sync TradeQuote subscription tiers to grant automatic shop discounts (e.g., Pro members get 10% off) and trigger AI equipment alerts when large jobs are won.

- [x] **Phase 9.1: Profitability Analytics Engine**: Backend API to analyze quote history against material spend for margin suggestions.
- [x] **Phase 9.2: Dashboard Insights Widget**: Frontend UI displaying profitability and actionable pricing adjustments.
- [x] **Phase 9.3: Smart Job Procurement**: Material detection system that suggests shop orders based on job scope.
- [x] **Phase 9.4: Personalized Shop Pulse**: Replenishment alerts and discount tracking widget.

## Phase 10: Ecosystem Expansion & Consumer Trust (COMPLETED)
- [x] **Phase 10.1: Verified Badges Tiering**: Distinguish between "Verified", "Vetted", and "Auditioned" traders for higher homeowner confidence.
- [x] **Phase 10.2: Regional Demand Heatmaps**: Advanced AI visualization for traders to see where the most active job clusters are in real-time.

---
*Status: Completed Phase 10. Multi-portal trust and demand ecosystem fully active.*

## Phase 11: Release & Mobile App Rollout Plan (Active)
- [ ] **Phase 11.1: Web App Publication & Live Test**: 
  - Publish the application as a highly responsive web application.
  - **Pre-Live Cleanup**: Disable the simulated surge zone fallback in `src/services/surgeHeatmapService.ts` (lines 151-155) so the driver map remains completely clean when real-time surge criteria are not actively triggered.
  - Conduct a 1-2 week live pilot test with real users.
  - Monitor logs, errors, and system performance closely.
- [ ] **Phase 11.2: Iterative Refinement**:
  - Push live updates and modify features based on user and driver feedback during the testing period.
  - Fine-tune Gemini Voice AI accuracy and edge cases.
- [ ] **Phase 11.3: Capacitor Integration**:
  - Once the web app stabilizes, execute the `CAPACITOR_PRECHECK.md` checklist.
  - Wrap the web app into native iOS and Android shells using Capacitor.
  - Integrate native device plugins (Camera, Location, Speech, Notifications).
- [ ] **Phase 11.4: Mobile Beta Run**:
  - Distribute the mobile app (via TestFlight / Google Play Console Internal Testing).
  - Do a secondary 1-week mobile-specific run test to catch native hardware issues.
- [ ] **Phase 11.5: Final Production Build**:
  - Finalize App Store / Google Play submissions.
  - Perform continuous post-launch monitoring and scaling.

## Phase 12: AI-Powered Trader Calendar + Smart Scheduling (Post-Launch)
- [x] **Phase 12.1: Built-in Trader Calendar Foundation**: Develop calendar UI and underlying data model to track trader availability, auto-populating accepted jobs, travel time, and recurring tasks.
- [x] **Phase 12.2: AI Availability Engine**: Implement scoring logic to evaluate trader fit based on time slot availability, travel logistics, route efficiency, workload balance, and earnings optimization.
- [x] **Phase 12.3: AI Scheduling Assistant (Trader-Facing)**: Introduce a smart assistant to suggest optimal scheduling slots for new jobs, refill canceled slots, and proactively fill empty days with matching job opportunities.
- [x] **Phase 12.4: Enhanced Match Algorithm Integration**: Update the Instant Match algorithm to factor in Schedule Fit (weighted at 20%) alongside rating, completion rate, response speed, distance, and price fairness.
- [x] **Phase 12.5: External Calendar Sync**: Enable seamless two-way syncing with external services like Google, Apple, and Outlook calendars to incorporate personal availability constraints.

## Phase 13: Future Strategic Backlog ("Do It Later" List)
- [ ] **Instant Guarantee & Workmanship Warranty Add-On (£9.99–£19.99 per job)**:
  - **Concept**: Optional 12-Month AnyTrader Workmanship Protection policy offered to homeowners at quote acceptance for £9.99–£19.99 per job.
  - **3-Stage Resolution Escalation**:
    1. *Stage 1 (Mandatory Rectification)*: Original trader is given 14 calendar days to fix defects.
    2. *Stage 2 (Peer Dispatch)*: If trader fails or absconds, an audited top-rated local trader is dispatched to fix the work funded by the policy reserve.
    3. *Stage 3 (Refund / Indemnity)*: Direct financial payout to homeowner up to the £5,000 policy cap.
  - **Early-Stage Bootstrapping Strategy**: Launch initially as an **Underwritten Broker/MGA Referral Partner** model (earning a 15%–25% referral commission with 0 balance sheet liability), transitioning to a self-insured platform claims pool once transaction volume exceeds 5,000 monthly completed jobs.

