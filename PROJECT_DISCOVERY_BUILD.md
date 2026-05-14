# AI-Powered Pro Discovery & Bidding System (Phase D)

This document outlines the phased implementation plan for the AI-Powered Pro Discovery, Schedule-Aware Matching, and Role-Based Bidding system for Complex Projects (e.g., Event Planning, Construction, Media Production).

## Phase D1: Data Model Expansion (Budget & Roles)
**Objective:** Expand the `projects` and `project_roles` schema to support budgets, detailed role requirements, and bids.
- **Tasks:**
  1. Add `totalBudget` field to the Project creation wizard and database schema.
  2. Implement budget vs. actual cost tracking UI in the project dashboard.
  3. Expand the `roles` or `subtasks` structure within a project to include specific categorizations (e.g., "Caterer", "DJ", "Photographer"), estimated role budget, and schedule requirements.
  4. Create a new `project_bids` collection in `firebase-blueprint.json` to store bids from professionals for specific project roles.

## Phase D2: Resource Availability & AI Matching Engine
**Objective:** Build the logic allowing the platform to find and suggest professionals based on category, skills, and schedule availability.
- **Tasks:**
  1. **Availability Indexing:** Ensure professional profiles and their existing calendars/sessions can be queried to determine availability for specific date ranges.
  2. **AI Matchmaker Service:** Create an AI utility (Gemini API) or heuristic engine that takes project requirements (role, date, location, budget) and queries the user base for matching professionals who are *available* during the project timeline.
  3. **"Find Pros" Integration:** Add a "Find Pros" button to project roles in the UI. When clicked, it displays a curated horizontal scroll or grid of matched professionals.

## Phase D3: Shortlisting & Favorites within Project Scope
**Objective:** Allow project creators to bookmark and manage potential candidates.
- **Tasks:**
  1. Build a "Shortlist" or "Favorites" UI block specifically tied to the project instance (not just a global user favorite).
  2. Allow project creators to save matching profiles into role-specific "buckets" (e.g., 3 caterers shortlisted, 2 DJs shortlisted).
  3. Feature quick actions to send direct messages to shortlisted pros regarding the project.

## Phase D4: Broadcasting & The Bidding System
**Objective:** Enable automated outreach and a bidding marketplace for project roles.
- **Tasks:**
  1. Add a "Broadcast Role" action that sends targeted in-app notifications (and optionally emails) to matched, available professionals.
  2. Build a "Project Board" view for professionals where they can see broadcasted roles they qualify for.
  3. Implement the "Submit Bid" flow for professionals to offer their services, quote their price, and outline their approach.
  4. Update the Project Creator's dashboard to review, accept, or reject incoming bids, automatically filling the project role upon acceptance.

## Phase D5: Integration & Polish
**Objective:** Connect all pieces seamlessly into the Consultancy/Agency Dashboard.
- **Tasks:**
  1. Ensure permissions and access control are strict: only invited or bidding pros can see public project details; internal financial details remain private to the creator.
  2. Map accepted bids to the calendar and project timeline automatically.
  3. Add push notifications for bid submissions and acceptances.
