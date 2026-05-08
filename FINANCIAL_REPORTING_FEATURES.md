# Financial Reporting & Analytics Features

This document outlines the logic, features, and UI/UX enhancements implemented for the Driver Earnings section. This can serve as a blueprint for implementing similar financial reporting tools for Traders, Landlords, Estate Agents, and other service providers on the main AnyTrader platform.

## Core Features

### 1. Custom Date Range Report Generation
- **UI:** Interactive dropdowns to select Start Date and End Date (`Day`, `Month`, `Year`).
- **Logic:** Converts selected dates into a valid Timestamp range. Queries the Firestore database for jobs/tasks completed within that specific timeframe.
- **Preview:** Shows the total number of jobs found and previews the list of jobs.
- **Collapsible List:** If the result yields a large number of jobs (e.g., more than 5), the list truncates by default with a "Show all X jobs" button. This prevents the UI from becoming unmanageably long for yearly or quarterly reports. A "Collapse List" button hides them again.

### 2. CSV Data Export
- **Format:** Generates a structured CSV file dynamically in the browser using Blob and object URLs. Includes headers like `Date`, `Time`, `Customer`, `Service/Location`, `Earned (£)`, and `Gross (£)`.
- **Parsing:** Properly escapes strings containing commas (e.g., wrapping addresses and names in double quotes) and formats monetary values to 2 decimal places.

### 3. Financial Calculations & Breakdowns
- **Gross Earnings:** Base quote/fare + any additional costs or surges.
- **Platform Commission:** Automatically calculates and deducts platform fees (e.g., 10-12% commission).
- **Extra Income:** Handles additional items like tips or priority booking fees where the provider takes 100%.
- **Net Earnings:** Correctly calculates and displays the exact amount the provider takes home for tax and accounting purposes.

### 4. Subscription Monetization Gate (Premium Feature)
- **Monetization:** Generating and downloading unlimited CSV reports for accountants is gated behind a premium subscription (e.g., £10/year).
- **UX Prompts:** If a user tries to export without an active subscription, a smooth, inline prompt appears explaining the feature's value.
- **Payment Portal Overlay:** Clicking to subscribe opens a modal overlay directly within the interface to handle the transaction. Upon success, it updates the user's Firestore profile (e.g., `subscriptions.earningsReportExport = true`) and sets an expiration date.

## Adaptation Notes for AnyTrader (Traders, Landlords, etc.)

When porting these features to the other sides of the platform:
1. **Theming & Styling:** Change the color palette from the Driver dark theme (Black, dark grays, and Green `#00D26A`) to the AnyTrader light theme (White, Blue primary accents, and light neutral grays).
2. **Data Structure (Headers):** Instead of "Pickup/Dropoff", headers will adapt to the context:
   - **Traders:** "Customer", "Job Description", "Materials Cost", "Labor Rate".
   - **Landlords:** "Property", "Tenant", "Rent Amount", "Maintenance Deductions".
3. **Database Queries:** Queries will point to the respective collections (e.g., `bidding_jobs`, `tenancies`, `invoices`) rather than `driver_trips`.
4. **Tiered Access:** Consider bundling the reporting tool into existing AnyTrader premium subscription tiers if applicable.
