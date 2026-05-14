# Consultancy Subcategory - Build Plan

## Objective
The Consultancy layer caters to virtual remote advisors, tutors, accountants, event planners, and professional services. These users require tools for scheduling virtual appointments, managing client relationships, tracking remote billable hours, and processing invoices.

## Bottom Navigation Layout for Consultancy Layer

When a `business` user is acting under the `consultancy` active tab, the bottom navigation on mobile (and sidebar on desktop) should adapt to their specific workflow.

### Proposed Navigation Tabs (`consultancyNav`)

1. **HQ / Dashboard**
   - **Icon:** `Home`
   - **Path:** `/`
   - **Purpose:** Overview of upcoming sessions, recent enquiries, earnings summary, and quick stats.

2. **Calendar / Sessions**
   - **Icon:** `Calendar`
   - **Path:** `/consultancy/calendar`
   - **Purpose:** Virtual appointments calendar. Direct integration with Google/Microsoft calendar sync. Ability to set availability windows and view upcoming bookings.

3. **Clients (CRM)**
   - **Icon:** `Users`
   - **Path:** `/consultancy/clients`
   - **Purpose:** Active client roster. Contains client details, previous session notes, proposals sent, and billing history.

4. **New Session / Proposal (CTA)**
   - **Icon:** `PlusCircle`
   - **Path:** `/consultancy/new`
   - **Purpose:** Floating Action Button (CTA) to quickly schedule a new appointment, generate a proposal, or log a new enquiry. 

5. **Invoices / Earnings**
   - **Icon:** `PoundSterling` (or `Receipt`)
   - **Path:** `/consultancy/billing`
   - **Purpose:** Manage billing, view generated invoices, track expenses, and view total earnings breakdown.

6. **Messages**
   - **Icon:** `MessageSquare`
   - **Path:** `/messages`
   - **Purpose:** Chat interface with clients. Standard cross-portal messaging.

## Implementation Steps

1. **Update `src/components/Layout.tsx`:**
   - Define a new `consultancyNav` array containing the tabs above.
   - Adjust the `navItems` logic to use `consultancyNav` when `activeRole === "business"` and `activeTab === "consultancy"`.
   - Ensure specific routing logic is added for these paths (e.g. creating placeholder routes or mapping to existing components).

2. **Routes Configuration (`App.tsx` or similar router):**
   - Add routes for `/consultancy/calendar`, `/consultancy/clients`, `/consultancy/billing`, etc. 
   - Note: For the MVP, these could all point back to the `BusinessDashboard` which uses the `ConsultancyManager` component to toggle views under a single dashboard, OR we create dedicated pages for each. Since `ConsultancyManager.tsx` already has tabs for "Calendar" and "Clients", we might want the bottom nav to update the view within the HQ OR route to specific pages that render those parts.

3. **Update `ConsultancyManager.tsx`:**
   - Instead of inner-tabs for Calendar, Clients, etc., we can link them to the main navigation so they feel like first-class citizens in the app.

## Considerations
- **Sync with Field Services & Properties:** Ensure this layout pattern is consistent with how Field Services and Properties manage sub-tabs vs global bottom-nav tabs. Currently `businessWorkHubNav` is used for Field Services Work Hub. We should follow a similar paradigm for Consultancy.
