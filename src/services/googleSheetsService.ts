// Google Sheets Integration Service for AnyTrader & AnyRoller
// Handles Google OAuth 2.0 GIS token acquisition, Spreadsheet creation, and appending bookkeeping rows.

// In-memory token store for security (H-02: Never persist OAuth bearer tokens in localStorage)
let inMemorySheetsAccessToken: string | null = null;
let inMemorySheetsTokenExpiry: number | null = null;
const STORAGE_KEY_SPREADSHEET_ID = "anytrader_gsheets_spreadsheet_id";

export function getStoredAccessToken(): string | null {
  if (!inMemorySheetsAccessToken || !inMemorySheetsTokenExpiry) return null;

  if (Date.now() >= inMemorySheetsTokenExpiry) {
    inMemorySheetsAccessToken = null;
    inMemorySheetsTokenExpiry = null;
    return null;
  }
  return inMemorySheetsAccessToken;
}

export function setStoredAccessToken(token: string, expiresInSeconds: number = 3600) {
  const expiryTime = Date.now() + (expiresInSeconds - 60) * 1000;
  inMemorySheetsAccessToken = token;
  inMemorySheetsTokenExpiry = expiryTime;
}

export function disconnectGoogleSheets(): void {
  inMemorySheetsAccessToken = null;
  inMemorySheetsTokenExpiry = null;
  localStorage.removeItem(STORAGE_KEY_SPREADSHEET_ID);
}

export function isGoogleSheetsConnected(): boolean {
  return getStoredAccessToken() !== null;
}

export function getSavedSpreadsheetId(): string | null {
  return localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID);
}

export function saveSpreadsheetId(id: string): void {
  localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, id);
}

/**
 * Triggers Google OAuth GIS popup to request access to spreadsheets scope.
 */
export async function requestSheetsAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const googleObj = (window as any).google;
      if (!googleObj?.accounts?.oauth2) {
        reject(new Error("Google Identity Services script not ready. Please refresh and try again."));
        return;
      }

      const client = googleObj.accounts.oauth2.initTokenClient({
        client_id: "437256678397-applet-client.apps.googleusercontent.com",
        scope: "https://www.googleapis.com/auth/spreadsheets",
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
 * Creates a brand new Google Spreadsheet with structured sheets for Bookkeeping.
 */
export async function createBookkeepingSpreadsheet(
  title: string = "AnyTrader & AnyRoller Sole Trader Ledger",
  overrideToken?: string
): Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; error?: string }> {
  try {
    let token = overrideToken || getStoredAccessToken();
    if (!token) {
      token = await requestSheetsAccessToken();
    }

    if (!token) {
      return { success: false, error: "Google Sheets authorization required." };
    }

    const payload = {
      properties: {
        title,
      },
      sheets: [
        {
          properties: { title: "Trade Earnings", gridProperties: { frozenRowCount: 1 } },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Date" } },
                    { userEnteredValue: { stringValue: "Job ID / Ref" } },
                    { userEnteredValue: { stringValue: "Client Name" } },
                    { userEnteredValue: { stringValue: "Category" } },
                    { userEnteredValue: { stringValue: "Gross Amount (£)" } },
                    { userEnteredValue: { stringValue: "Platform Fee (£)" } },
                    { userEnteredValue: { stringValue: "Net Payout (£)" } },
                    { userEnteredValue: { stringValue: "Payment Method" } },
                    { userEnteredValue: { stringValue: "Status" } },
                  ],
                },
              ],
            },
          ],
        },
        {
          properties: { title: "Invoices & Quotes", gridProperties: { frozenRowCount: 1 } },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Date Created" } },
                    { userEnteredValue: { stringValue: "Quote/Invoice Ref" } },
                    { userEnteredValue: { stringValue: "Client Name" } },
                    { userEnteredValue: { stringValue: "Service Description" } },
                    { userEnteredValue: { stringValue: "Subtotal (£)" } },
                    { userEnteredValue: { stringValue: "VAT / Tax (£)" } },
                    { userEnteredValue: { stringValue: "Total Amount (£)" } },
                    { userEnteredValue: { stringValue: "Status" } },
                  ],
                },
              ],
            },
          ],
        },
        {
          properties: { title: "Taxi Ride Receipts", gridProperties: { frozenRowCount: 1 } },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Date & Time" } },
                    { userEnteredValue: { stringValue: "Ride Ref" } },
                    { userEnteredValue: { stringValue: "Pickup Location" } },
                    { userEnteredValue: { stringValue: "Dropoff Location" } },
                    { userEnteredValue: { stringValue: "Fare (£)" } },
                    { userEnteredValue: { stringValue: "Tip (£)" } },
                    { userEnteredValue: { stringValue: "Total Charged (£)" } },
                    { userEnteredValue: { stringValue: "Driver / Passenger" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      disconnectGoogleSheets();
      const freshToken = await requestSheetsAccessToken();
      return createBookkeepingSpreadsheet(title, freshToken);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error?.message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    saveSpreadsheetId(data.spreadsheetId);

    return {
      success: true,
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create Google Spreadsheet." };
  }
}

/**
 * Appends rows to a specified sheet in the spreadsheet.
 */
export async function appendRowsToSheet(
  sheetName: string,
  rows: (string | number)[][],
  spreadsheetId?: string,
  overrideToken?: string
): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> {
  try {
    let token = overrideToken || getStoredAccessToken();
    if (!token) {
      token = await requestSheetsAccessToken();
    }
    if (!token) return { success: false, error: "Google Sheets authorization required." };

    let targetId = spreadsheetId || getSavedSpreadsheetId();
    let targetUrl: string | undefined;

    if (!targetId) {
      const createRes = await createBookkeepingSpreadsheet("AnyTrader & AnyRoller Sole Trader Ledger", token);
      if (!createRes.success || !createRes.spreadsheetId) {
        return { success: false, error: createRes.error || "Could not auto-create bookkeeping spreadsheet." };
      }
      targetId = createRes.spreadsheetId;
      targetUrl = createRes.spreadsheetUrl;
    }

    const range = `'${sheetName}'!A1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    });

    if (res.status === 401) {
      disconnectGoogleSheets();
      const freshToken = await requestSheetsAccessToken();
      return appendRowsToSheet(sheetName, rows, targetId, freshToken);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error?.message || `Google Sheets API HTTP ${res.status}` };
    }

    return {
      success: true,
      spreadsheetUrl: targetUrl || `https://docs.google.com/spreadsheets/d/${targetId}/edit`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to append rows to Google Sheet." };
  }
}

/**
 * 1-Click Export helper for Job Earnings.
 */
export async function exportEarningsToSheets(earnings: Array<{
  date: string;
  jobId: string;
  clientName: string;
  category: string;
  grossAmount: number;
  fee: number;
  netAmount: number;
  paymentMethod: string;
  status: string;
}>) {
  const rows = earnings.map((e) => [
    e.date,
    e.jobId,
    e.clientName,
    e.category,
    e.grossAmount,
    e.fee,
    e.netAmount,
    e.paymentMethod,
    e.status,
  ]);
  return appendRowsToSheet("Trade Earnings", rows);
}

/**
 * 1-Click Export helper for Invoices / Quotes.
 */
export async function exportInvoicesToSheets(invoices: Array<{
  dateCreated: string;
  ref: string;
  clientName: string;
  serviceDescription: string;
  subtotal: number;
  vat: number;
  total: number;
  status: string;
}>) {
  const rows = invoices.map((inv) => [
    inv.dateCreated,
    inv.ref,
    inv.clientName,
    inv.serviceDescription,
    inv.subtotal,
    inv.vat,
    inv.total,
    inv.status,
  ]);
  return appendRowsToSheet("Invoices & Quotes", rows);
}

/**
 * 1-Click Export helper for Taxi Receipts.
 */
export async function exportRideReceiptsToSheets(rides: Array<{
  dateTime: string;
  rideRef: string;
  pickup: string;
  dropoff: string;
  fare: number;
  tip: number;
  total: number;
  driverOrPassenger: string;
}>) {
  const rows = rides.map((r) => [
    r.dateTime,
    r.rideRef,
    r.pickup,
    r.dropoff,
    r.fare,
    r.tip,
    r.total,
    r.driverOrPassenger,
  ]);
  return appendRowsToSheet("Taxi Ride Receipts", rows);
}
