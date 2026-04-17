# Calendar Integration Plan

## Overview
Integrate Google and Outlook calendars to allow automated job scheduling when a homeowner accepts a quote.

## Implementation Plan

### 1. OAuth Integration (Phase 1)
- Implement popup-based OAuth flows for Google and Microsoft (Outlook) APIs.
- Use `postMessage` for secure communication between the OAuth popup and the main application.

### 2. Calendar API Backend (Phase 2)
- Implement server-side API routes in `server.ts`:
  - `GET /api/calendar/availability`: Check for conflicts.
  - `POST /api/calendar/event`: Create the scheduled job event.
- Manage OAuth tokens server-side to ensure security.

### 3. UI/UX Implementation (Phase 3)
- Trigger scheduling workflow upon quote acceptance.
- Suggest available slots based on tradesperson and homeowner availability.
- Automatically sync events to both parties' calendars.

## Configuration Requirements (Environment Variables)
Add these to your production environment settings:

```env
# OAuth Configuration
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
```

## Next Steps
1. Configure OAuth applications in Google Cloud Console and Azure Portal.
2. Implement server-side OAuth routes.
3. Add callback URLs to developer consoles (will be provided upon implementation).
