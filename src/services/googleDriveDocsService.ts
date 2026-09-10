// Google Drive & Google Docs Service for AnyTrader Contract & Certificate Generation
// Uses OAuth 2.0 GIS token acquisition with drive.file and documents scopes.

// In-memory token store for security (H-02: Never persist OAuth bearer tokens in localStorage)
let inMemoryDocsAccessToken: string | null = null;
let inMemoryDocsTokenExpiry: number | null = null;

export function getStoredDocsAccessToken(): string | null {
  if (!inMemoryDocsAccessToken || !inMemoryDocsTokenExpiry) return null;

  if (Date.now() >= inMemoryDocsTokenExpiry) {
    inMemoryDocsAccessToken = null;
    inMemoryDocsTokenExpiry = null;
    return null;
  }
  return inMemoryDocsAccessToken;
}

export function setStoredDocsAccessToken(token: string, expiresInSeconds: number = 3600) {
  const expiryTime = Date.now() + (expiresInSeconds - 60) * 1000;
  inMemoryDocsAccessToken = token;
  inMemoryDocsTokenExpiry = expiryTime;
}

export function disconnectGoogleDriveDocs(): void {
  inMemoryDocsAccessToken = null;
  inMemoryDocsTokenExpiry = null;
}

export async function requestDriveDocsAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const googleObj = (window as any).google;
      if (!googleObj?.accounts?.oauth2) {
        reject(new Error("Google Identity Services script not ready. Please refresh and try again."));
        return;
      }

      const client = googleObj.accounts.oauth2.initTokenClient({
        client_id: "437256678397-applet-client.apps.googleusercontent.com",
        scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents",
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3600;
            setStoredDocsAccessToken(response.access_token, expiresIn);
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

export interface ContractDetails {
  documentType: "Trade Service Agreement" | "Liability Waiver" | "Job Completion Certificate";
  jobTitle: string;
  jobRef: string;
  clientName: string;
  clientAddress?: string;
  traderName: string;
  traderCompany?: string;
  amount: number | string;
  startDate?: string;
  scopeOfWork?: string;
  completionNotes?: string;
}

/**
 * Creates a formatted Google Document in the user's Google Drive.
 */
export async function generateLegalContractDoc(
  details: ContractDetails,
  overrideToken?: string
): Promise<{ success: boolean; documentId?: string; documentUrl?: string; error?: string }> {
  try {
    let token = overrideToken || getStoredDocsAccessToken();
    if (!token) {
      token = await requestDriveDocsAccessToken();
    }
    if (!token) return { success: false, error: "Google Drive/Docs authorization required." };

    const docTitle = `${details.documentType} - ${details.jobTitle} [${details.jobRef}]`;

    // Step 1: Create a blank document using Docs API
    const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: docTitle,
      }),
    });

    if (createRes.status === 401) {
      disconnectGoogleDriveDocs();
      const freshToken = await requestDriveDocsAccessToken();
      return generateLegalContractDoc(details, freshToken);
    }

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      return { success: false, error: errData.error?.message || `Google Docs HTTP ${createRes.status}` };
    }

    const docData = await createRes.json();
    const documentId = docData.documentId;

    // Step 2: Build contract content string
    const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    let textContent = "";

    if (details.documentType === "Trade Service Agreement") {
      textContent = 
`FORMAL UK TRADE SERVICE AGREEMENT
Ref: ${details.jobRef} | Date: ${todayStr}

PARTIES:
- Service Provider (Trader): ${details.traderName} ${details.traderCompany ? `(${details.traderCompany})` : ''}
- Client (Homeowner/Business): ${details.clientName}
- Site Location: ${details.clientAddress || 'Client designated worksite'}

1. SCOPE OF WORKS
The Service Provider agrees to perform the following works in a good and workmanlike manner:
${details.scopeOfWork || details.jobTitle}

2. FINANCIAL TERMS & AGROUND VALUE
Total Agreed Contract Value: £${details.amount} (inclusive of applicable UK VAT/taxes).
Payment Method: AnyTrader Direct Secure Split Escrow / Direct Card Settlement.

3. STANDARDS & COMPLIANCE
All work carried out will comply with relevant UK Building Regulations, Health & Safety at Work Act 1974, and local trade standards.

4. CANCELLATION & DISPUTE RESOLUTION
Either party may request amendments in writing through the AnyTrader platform. Disputes are handled via AnyTrader Trust & Compliance Engine.

SIGNED ON BEHALF OF TRADER: ${details.traderName}
SIGNED ON BEHALF OF CLIENT: ${details.clientName}
Generated via AnyTrader Automated Legal Engine.`;
    } else if (details.documentType === "Liability Waiver") {
      textContent = 
`WORKSITE LIABILITY WAIVER & ACCESS PERMIT
Ref: ${details.jobRef} | Date: ${todayStr}

PROJECT DETAILS:
- Works: ${details.jobTitle}
- Site Location: ${details.clientAddress || 'Client Works Port'}
- Contractor: ${details.traderName}
- Client Name: ${details.clientName}

1. SITE SAFETY & ACCESS ACKNOWLEDGMENT
The Client confirms that the worksite has been inspected and cleared of undisclosed hazards, hazardous waste, or structural obstructions prior to contractor access.

2. TRADER LIABILITY & INSURANCE
The Contractor maintains active UK Public Liability Insurance and will exercise reasonable care and skill during project execution.

3. INDEMNIFICATION
The Client acknowledges risks associated with active construction/maintenance zones and agrees to follow contractor safety instructions.

ACCEPTED & SIGNED:
Client: ${details.clientName}
Trader: ${details.traderName}
Generated via AnyTrader Automated Legal Engine.`;
    } else {
      textContent = 
`JOB COMPLETION & HANDOVER CERTIFICATE
Ref: ${details.jobRef} | Date: ${todayStr}

PROJECT COMPLETION DETAILS:
- Completed Project: ${details.jobTitle}
- Contractor: ${details.traderName}
- Client Name: ${details.clientName}
- Contract Value Paid: £${details.amount}

1. CERTIFICATION OF COMPLETION
The Contractor hereby certifies that all agreed works have been completed in accordance with contract specifications and trade quality benchmarks.

2. CLIENT SIGN-OFF & SATISFACTION
${details.completionNotes || 'The client has inspected the completed works and confirms satisfactory sign-off without outstanding defects.'}

3. WARRANTY & SUPPORT
Standard 12-Month Workmanship Guarantee applies from date of sign-off through AnyTrader.

CERTIFIED BY CONTRACTOR: ${details.traderName}
ACCEPTED BY CLIENT: ${details.clientName}
Generated via AnyTrader Automated Legal Engine.`;
    }

    // Step 3: Populate Document via batchUpdate
    const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: textContent,
            },
          },
        ],
      }),
    });

    if (!updateRes.ok) {
      console.warn("Docs batchUpdate failed, document created blank.");
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    return {
      success: true,
      documentId,
      documentUrl,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate Google Doc legal contract." };
  }
}
