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
- [ ] **Phase 9.4: Personalized Shop Pulse**: Replenishment alerts and discount tracking widget.

---
*Status: Starting Phase 9.4.*
