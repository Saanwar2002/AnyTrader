// Google Calendar Integration Service for AnyTrader & AnyRoller
// Handles Google OAuth 2.0 GIS token acquisition, event syncing, and calendar event creation.

export interface CalendarEventParams {
  summary: string;
  description?: string;
  location?: string;
  startTime: string; // ISO string e.g. "2026-08-01T10:00:00.000Z" or "YYYY-MM-DDTHH:mm:ss"
  endTime?: string;   // ISO string; if omitted defaults to 1 hour after start
  attendees?: string[]; // email addresses
  remindersMinutesBefore?: number[]; // e.g. [15, 60]
}

const STORAGE_KEY_TOKEN = "anytrader_gcal_access_token";
const STORAGE_KEY_EXPIRY = "anytrader_gcal_token_expiry";

/**
 * Dynamically loads the Google Identity Services (GIS) client script if not already present.
 */
export function ensureGsiLoaded(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById("google-gis-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Retrieves a non-expired stored Google Calendar access token from localStorage.
 */
export function getStoredAccessToken(): string | null {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const expiry = localStorage.getItem(STORAGE_KEY_EXPIRY);
  if (!token || !expiry) return null;

  const now = Date.now();
  if (now >= parseInt(expiry, 10)) {
    // Token expired
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_EXPIRY);
    return null;
  }

  return token;
}

/**
 * Saves access token and calculates expiration timestamp.
 */
export function setStoredAccessToken(token: string, expiresInSeconds: number = 3600) {
  const expiryTime = Date.now() + (expiresInSeconds - 60) * 1000; // 1 min buffer
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_EXPIRY, expiryTime.toString());
}

/**
 * Clears stored Google Calendar access credentials.
 */
export function disconnectGoogleCalendar(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_EXPIRY);
}

/**
 * Checks if a valid, non-expired Google Calendar access token is stored.
 */
export function isGoogleCalendarConnected(): boolean {
  return getStoredAccessToken() !== null;
}

/**
 * Triggers Google OAuth GIS popup to request access to calendar.events scope.
 */
export async function requestCalendarAccessToken(): Promise<string> {
  const loaded = await ensureGsiLoaded();
  if (!loaded) {
    throw new Error("Unable to load Google Authentication client script.");
  }

  return new Promise((resolve, reject) => {
    try {
      const googleObj = (window as any).google;
      if (!googleObj?.accounts?.oauth2) {
        reject(new Error("Google Identity Services unavailable."));
        return;
      }

      const client = googleObj.accounts.oauth2.initTokenClient({
        client_id: "437256678397-applet-client.apps.googleusercontent.com", // standard AI Studio client
        scope: "https://www.googleapis.com/auth/calendar.events",
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3600;
            setStoredAccessToken(response.access_token, expiresIn);
            resolve(response.access_token);
          } else {
            reject(new Error("No access token returned from Google."));
          }
        },
      });

      client.requestAccessToken({ prompt: "consent" });
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Creates an event in the user's primary Google Calendar.
 */
export async function createCalendarEvent(
  params: CalendarEventParams,
  overrideToken?: string
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  try {
    let token = overrideToken || getStoredAccessToken();

    // If no active token, prompt user via GIS
    if (!token) {
      token = await requestCalendarAccessToken();
    }

    if (!token) {
      return { success: false, error: "Google Calendar authorization required." };
    }

    // Default start/end calculation
    const startIso = new Date(params.startTime).toISOString();
    const endDateObj = params.endTime ? new Date(params.endTime) : new Date(new Date(params.startTime).getTime() + 60 * 60 * 1000);
    const endIso = endDateObj.toISOString();

    const remindersList = (params.remindersMinutesBefore || [30, 120]).map((mins) => ({
      method: "popup",
      minutes: mins,
    }));

    const eventPayload: any = {
      summary: params.summary,
      description: params.description || "Scheduled via AnyTrader Platform",
      location: params.location || "",
      start: {
        dateTime: startIso,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
      },
      end: {
        dateTime: endIso,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
      },
      reminders: {
        useDefault: false,
        overrides: remindersList,
      },
    };

    if (params.attendees && params.attendees.length > 0) {
      eventPayload.attendees = params.attendees.map((email) => ({ email }));
    }

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    if (response.status === 401) {
      // Token expired during call, clear token and retry once
      disconnectGoogleCalendar();
      const freshToken = await requestCalendarAccessToken();
      return createCalendarEvent(params, freshToken);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error?.message || `Google Calendar API returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to connect to Google Calendar API.",
    };
  }
}

/**
 * Quick helper to sync a scheduled trade job into Google Calendar.
 */
export async function syncJobToGoogleCalendar(job: {
  title: string;
  category?: string;
  address?: string;
  postcode?: string;
  startDate?: string;
  description?: string;
  clientEmail?: string;
}) {
  const startTime = job.startDate ? new Date(job.startDate).toISOString() : new Date().toISOString();
  const summary = `[AnyTrader Job] ${job.title}`;
  const location = [job.address, job.postcode].filter(Boolean).join(", ");
  const description = `Job Category: ${job.category || "Trade Services"}\nDetails: ${job.description || "N/A"}\n\nManaged via AnyTrader Ecosystem`;

  return createCalendarEvent({
    summary,
    description,
    location,
    startTime,
    attendees: job.clientEmail ? [job.clientEmail] : undefined,
    remindersMinutesBefore: [30, 120, 1440], // 30m, 2h, 24h
  });
}

/**
 * Quick helper to sync an AnyRoller pre-booked ride into Google Calendar.
 */
export async function syncRideToGoogleCalendar(ride: {
  pickup: string;
  destination: string;
  pickupTime: string;
  driverName?: string;
  fareEstimate?: number | string;
}) {
  const startTime = new Date(ride.pickupTime).toISOString();
  const summary = `[AnyRoller Ride] Taxi to ${ride.destination}`;
  const description = `Pickup Location: ${ride.pickup}\nDestination: ${ride.destination}\nDriver: ${ride.driverName || "Assigned Driver"}\nEstimated Fare: £${ride.fareEstimate || "0.00"}\n\nBooked via AnyRoller Taxi Ecosystem`;

  return createCalendarEvent({
    summary,
    description,
    location: ride.pickup,
    startTime,
    remindersMinutesBefore: [15, 60], // 15m and 1h reminders
  });
}

/**
 * Quick helper to sync a site inspection or consultancy meeting into Google Calendar.
 */
export async function syncSiteInspectionToGoogleCalendar(inspection: {
  projectName: string;
  clientName?: string;
  address?: string;
  scheduledTime: string;
  notes?: string;
}) {
  const startTime = new Date(inspection.scheduledTime).toISOString();
  const summary = `[Site Inspection] ${inspection.projectName}`;
  const description = `Client: ${inspection.clientName || "Property Owner"}\nInspection Notes: ${inspection.notes || "Site visit & quote assessment"}\n\nScheduled via AnyTrader Agency Portal`;

  return createCalendarEvent({
    summary,
    description,
    location: inspection.address || "",
    startTime,
    remindersMinutesBefore: [30, 120],
  });
}

/**
 * Fetches upcoming calendar events from Google Calendar to prevent double bookings.
 */
export async function fetchUpcomingEvents(): Promise<any[]> {
  const token = getStoredAccessToken();
  if (!token) return [];

  try {
    const timeMin = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=20`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.error("Failed to fetch Google Calendar events:", err);
    return [];
  }
}
