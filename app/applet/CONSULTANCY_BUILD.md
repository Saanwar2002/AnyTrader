# LAYOUT C: CONSULTANCY & PROFESSIONAL SERVICES
## COMPLETE BUILD PLAN — ANYTRADER PLATFORM
From Signup → Receiving Requests → Servicing → Completion → Payout

### 1. SCOPE & PURPOSE
**WHAT THIS DOCUMENT COVERS**
This is the COMPLETE technical build specification for Layout C — the Consultancy & Professional Services layer of the AnyTrader platform.

It covers the FULL LIFECYCLE of a service provider:
1. SIGNUP → Provider creates account, selects category, sets pricing, availability, certs
2. DISCOVERY → Platform matches provider to customer enquiries via match engine
3. RECEIVING REQUESTS → Enquiries land in provider's inbox (Instant Match or Quotes)
4. RESPONDING → Provider sends proposal/quote or accepts Instant Match auto-assignment
5. SERVICING → Project management, scheduling, team assignment, event coordination
6. BILLING → Invoice generation, milestone payments, Stripe processing
7. COMPLETION → Project close, review request, payout, stats update

**WHAT LAYOUT C IS NOT:**
- Layout B = HANDS → physical trade work (plumber, cleaner)
- Layout C = HEADS → knowledge, skill, coordination

Same platform shell. Same bottom nav structure. Same role switcher. Different content inside each tab. Category selection at signup determines which layout the provider gets.

**RELATIONSHIP TO PLATFORM FOUNDATION:**
Layout C builds ON TOP of Phase 0A shared foundation:
- Auth system (register, login, JWT)
- Users & user_roles tables
- Categories & subcategories tables
- Business profiles & business_categories
- Category field definitions (dynamic form fields)
- Stripe Connect payment infrastructure
- Notification system
- File upload system
- Chat messaging system

### 2. WHO ARE LAYOUT C SERVICE PROVIDERS?
**6 PERSONA CLUSTERS — ~35 CATEGORIES — ~250+ SUBCATEGORIES**

**CLUSTER 1: EDUCATION & COACHING (11 categories)**
Private Tutoring · Music Teaching · Language Teaching · Driving Instruction · Life Coaching · Career Coaching · Business Mentoring · Sports Coaching · Swimming Instruction · Dance Teaching · Exam Preparation
Typical: Solo practitioner. Session-based. £25–£80/hr.
PROJECT DEPTH: SIMPLE

**CLUSTER 2: FINANCIAL & LEGAL (10 categories)**
Accounting & Bookkeeping · Tax Advisory · Financial Planning · Mortgage Broking · Insurance Broking · Solicitors · Conveyancing · Immigration Advisory · Will Writing & Probate · Mediation
Typical: Retainer-based. Document-heavy. £100–£500/mo retainer or £150–£2,000 per service.
PROJECT DEPTH: MEDIUM

**CLUSTER 3: CREATIVE & MEDIA (14 categories)**
Photography · Videography · Graphic Design · Web Design · Interior Design · Architecture · Garden Design · Makeup Artistry · Mobile Hairdressing · DJ Services · Live Music · Voice-Over · Copywriting · Translation
Typical: Project-based with deliverables. £200–£10,000+ per project.
PROJECT DEPTH: MEDIUM to COMPLEX

**CLUSTER 4: EVENT & PRODUCTION (8 categories)**
Party Planning · Wedding Planning · Corporate Events · Exhibition & Conference · Production & Staging · Marquee Hire · AV & Technical Production · Funeral Planning
Typical: THE MOST COMPLEX. Multi-staff, multi-venue, multi-supplier, multi-day.
PROJECT DEPTH: COMPLEX

**CLUSTER 5: HEALTH & WELLNESS (11 categories)**
Personal Training · Yoga · Pilates · Nutrition & Dietetics · Counselling & Therapy · Physiotherapy · Osteopathy · Chiropractic · Sports Massage · Holistic Therapy · Hypnotherapy
Typical: Session-based. £30–£100/session.
PROJECT DEPTH: SIMPLE

**CLUSTER 6: BUSINESS & TECHNICAL (13 categories)**
IT Consulting · Management Consulting · HR Consulting · Marketing & PR · SEO & Digital Marketing · Social Media Management · Virtual Assistant · Project Management · Health & Safety Consulting · Energy Assessment (EPC) · Building Surveying · Quantity Surveying · Planning Consulting
Typical: Highest per-hour rates (£50–£1,500/day). Deliverable-based projects.
PROJECT DEPTH: MEDIUM

**THE THREE PROJECT DEPTH LEVELS:**
- **SIMPLE**: 1:1 sessions. Tutor, PT, counsellor. No team. No venue. Calendar = slots.
- **MEDIUM**: Client retainers & deliverable projects. Accountant, solicitor. Milestone tracking.
- **COMPLEX**: Multi-staff events. Party planner. Team management, venue, suppliers, budget.

### 3. SIGNUP FLOW — SERVICE PROVIDER ONBOARDING
Steps 1–3 are SHARED FOUNDATION. Steps 4–12 are LAYOUT C SPECIFIC.
- STEP 4: CATEGORY SELECTION
- STEP 5: SUBCATEGORY SELECTION
- STEP 6: BUSINESS DETAILS
- STEP 7: RATE CARD (Adapts based on project depth)
- STEP 8: AVAILABILITY & SCHEDULING
- STEP 9: TEAM SETUP (COMPLEX CATEGORIES ONLY)
- STEP 10: ACCREDITATIONS & QUALIFICATIONS
- STEP 11: SERVICE AREA
- STEP 12: REVIEW & GO LIVE

### 4. SCREEN LAYOUTS & BOTTOM NAVIGATION
**5 TABS (ALWAYS): Dash | Proj/Sess | Sched | Chat | Biz**
Tab 2 label adapts: Sessions (Simple), Clients (Medium), Projects (Complex).
- Dashboard: Adapts by depth.
- Projects/Sessions/Clients: List view and detail view with specific tabs based on depth.
- Schedule: Merged calendar.
- Chat: Merged – all roles.
- Biz (Management): Tools grid mapping strictly to depth (Rate card, Proposals, Team, Venues, etc.).

### 5. RECEIVING REQUESTS — ENQUIRY MATCHING
Match Engine filters by Category, Subcategory, Area, Availability, then Scores & Ranks.
Routes via: Instant Match, Priority Access, or Standard.

### 6. RESPONDING — PROPOSALS & QUOTES
- SIMPLE: Reply with available slot.
- MEDIUM: Send scope of work + fixed quote.
- COMPLEX: Send full PROPOSAL.
When accepted: project created, client record created, milestones generated, calendar events set, chat opened.

### 7. SERVICING THE REQUEST — PROJECT LIFECYCLE
- 7A. SIMPLE DEPTH: Weekly cycles, session notes, monthly invoices.
- 7B. MEDIUM DEPTH: Retainer tasks, milestones, ad-hoc tracking.
- 7C. COMPLEX DEPTH: Planning phase (venues, suppliers, team shifts), setup, event day run sheet, post-event teardown and pay. Team member lifecycle defined.

### 8. BILLING & PAYMENT LIFECYCLE
From Invoice Created -> Client Pays -> Stripe Captures -> Platform Splits -> Net to Provider.
Auto and manual invoices, overdue handling.

### 9. COMPLETION & REVIEW
Completion actions, final invoice, stats updated, review request scheduled.

### 10. COMPLETE DATABASE SCHEMA (22 Tables)
Includes `rate_cards`, `availability_windows`, `calendar_syncs`, `projects`, `clients`, `proposals`, `proposal_templates`, `project_milestones`, `team_members`, `project_assignments`, `project_venues`, `venues`, `project_suppliers`, `supplier_contacts`, `project_timeline_items`, `invoices`, `expenses`, `portfolio_items`, `session_notes`, `calendar_events`, `match_scores`, `enquiries`.

### 11. API ENDPOINTS (78 Endpoints)
Endpoints grouped into Rate Card, Availability, Projects, Clients, Proposals, Team Management, Project Assignments, Venues, Suppliers, Timeline, Invoices, Expenses, Portfolio, Calendar, Session Notes, Revenue & Tax.

### 12. BACKGROUND JOBS
9 Scheduled Jobs (e.g. recalculator, recurring session creator)
7 Event-driven Triggers (e.g. on_proposal_accepted).

### 13. SUBSCRIPTION TIER ENFORCEMENT
Checks against Free, Pro, Premium limitations on categories, active projects, team members, templates, etc.

### 14. EDGE CASES & ERROR HANDLING
Double-booking, shift conflicts, client/team no-shows, supplier cancellations, expired certs, concurrent acceptances, payment disputes, scope changes, cross-layout hiring.

### 15. COMPLETE END-TO-END FLOW DIAGRAM
From Provider Signup -> Profile Active -> Match Engine -> Responding -> Client Accepts -> Active Servicing -> Invoicing -> Completion.

### 16. BUILD TASK BREAKDOWN
(30 TASKS · 9 PHASES · ~95 HOURS)
PHASE C1: CORE DATA LAYER (5 tasks)
PHASE C2: PROJECT & PROPOSAL (5 tasks)
PHASE C3: TEAM & EVENT (4 tasks)
PHASE C4: FINANCIAL SYSTEM (4 tasks)
PHASE C5: CALENDAR & SCHEDULING (3 tasks)
PHASE C6: BACKGROUND JOBS (2 tasks)
PHASE C7: PORTFOLIO & PROFILE (2 tasks)
PHASE C8: SIGNUP FLOW (3 tasks)
PHASE C9: DASHBOARD & NAVIGATION (2 tasks)
