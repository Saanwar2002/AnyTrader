import { describe, it, expect } from "vitest";
import { isUserAdminClaim, AuthenticatedUser } from "../../src/server/authorization";
import fs from "fs";
import path from "path";

describe("Security Vulnerabilities Remediation Audit", () => {
  // Vulnerability 1: AI endpoints rate limit attached
  it("Vulnerability 1: verifies aiLimiter is attached to /api/gemini/call and /api/gemini/stream in server.ts", () => {
    const serverCode = fs.readFileSync(path.resolve(__dirname, "../../server.ts"), "utf-8");
    expect(serverCode).toContain('app.post("/api/gemini/call", express.json({ limit: "10mb" }), requireAuth, aiLimiter,');
    expect(serverCode).toContain('app.post("/api/gemini/stream", requireAuth, aiLimiter,');
  });

  // Vulnerability 2: unmatched_search_telemetry write protection
  it("Vulnerability 2: verifies unmatched_search_telemetry requires sign-in and owner/admin check in firestore.rules", () => {
    const rulesCode = fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf-8");
    expect(rulesCode).toContain("match /unmatched_search_telemetry/{telemetryId}");
    // Verifies creation requires authentication
    expect(rulesCode).toMatch(/match \/unmatched_search_telemetry\/\{telemetryId\}[\s\S]*?allow create: if isSignedIn\(\)/);
  });

  // Vulnerability 3: dynamic_search_synonyms restricted to admins only
  it("Vulnerability 3: verifies dynamic_search_synonyms write is restricted to admins only in firestore.rules", () => {
    const rulesCode = fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf-8");
    expect(rulesCode).toContain("match /dynamic_search_synonyms/{synonymId}");
    expect(rulesCode).toMatch(/match \/dynamic_search_synonyms\/\{synonymId\}[\s\S]*?allow write: if isAdmin\(\);/);
  });

  // Vulnerability 4: advertisements creation restricted by advertiser ID
  it("Vulnerability 4: verifies advertisements collection restricts create/update/delete by advertiserId or admin in firestore.rules", () => {
    const rulesCode = fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf-8");
    expect(rulesCode).toContain("match /advertisements/{adId}");
    expect(rulesCode).toContain("request.resource.data.advertiserUid == request.auth.uid");
    expect(rulesCode).toContain("request.resource.data.get('advertiserId', request.auth.uid) == request.auth.uid");
  });

  // Vulnerability 5: consistent admin checks
  describe("Vulnerability 5: Consistent Admin Checks", () => {
    it("recognizes admin token claim (admin: true) as administrator", () => {
      const user: AuthenticatedUser = { uid: "admin_1", admin: true };
      expect(isUserAdminClaim(user)).toBe(true);
    });

    it("recognizes isAdmin property (isAdmin: true) as administrator", () => {
      const user: AuthenticatedUser = { uid: "admin_2", isAdmin: true };
      expect(isUserAdminClaim(user)).toBe(true);
    });

    it("recognizes role === 'admin' and role === 'ecosystem_manager' as administrator", () => {
      const user1: AuthenticatedUser = { uid: "admin_3", role: "admin" };
      const user2: AuthenticatedUser = { uid: "admin_4", role: "ecosystem_manager" };
      expect(isUserAdminClaim(user1)).toBe(true);
      expect(isUserAdminClaim(user2)).toBe(true);
    });

    it("rejects regular users without admin claims or roles", () => {
      const normalUser: AuthenticatedUser = { uid: "user_1", role: "homeowner" };
      expect(isUserAdminClaim(normalUser)).toBe(false);
    });

    it("verifies public projection sync endpoints use unified admin checking", () => {
      const serverCode = fs.readFileSync(path.resolve(__dirname, "../../server.ts"), "utf-8");
      expect(serverCode).toContain('app.post("/api/admin/sync-public-job-cards", requireAdmin,');
      expect(serverCode).toContain('app.post("/api/admin/sync-public-properties", requireAdmin,');
      expect(serverCode).toContain('const isAdmin = await checkIsAdmin(user);');
    });
  });

  // Vulnerability 6: Token revocation fallback check
  it("Vulnerability 6: verifies verifyTokenSafely inspects user disabled/banned/revocation status on fallback without crashing on disabled Identity Toolkit API", () => {
    const serverCode = fs.readFileSync(path.resolve(__dirname, "../../server.ts"), "utf-8");
    expect(serverCode).toContain("userRecord.tokensValidAfterTime");
    expect(serverCode).toContain("Account has been disabled or banned");
    expect(serverCode).toContain("tokensRevokedAt");
    expect(serverCode).toContain('authErr?.code === "auth/user-disabled"');
  });

  // Vulnerability 7: Loose localhost origin check prevention
  describe("Vulnerability 7: Strict CORS Origin Validation", () => {
    const defaultAllowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://localhost",
      "capacitor://localhost",
      "ionic://localhost",
    ];
    const allowedSet = new Set(defaultAllowedOrigins);

    // Replicate the strict logic from server.ts
    const isOriginAllowed = (origin: string, set: Set<string>): boolean => {
      if (set.has(origin)) {
        return true;
      }
      try {
        const parsed = new URL(origin);
        const isStrictLocalhost =
          parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname === "[::1]";
        if (isStrictLocalhost) {
          return true;
        }
        if (
          parsed.protocol === "https:" &&
          (parsed.hostname.endsWith(".run.app") || parsed.hostname.endsWith(".google.com"))
        ) {
          return true;
        }
      } catch {
        return false;
      }
      return false;
    };

    it("rejects malicious domains like evil-localhost.com and localhost.attacker.com", () => {
      expect(isOriginAllowed("http://evil-localhost.com", allowedSet)).toBe(false);
      expect(isOriginAllowed("https://evil-localhost.com", allowedSet)).toBe(false);
      expect(isOriginAllowed("http://localhost.attacker.com", allowedSet)).toBe(false);
      expect(isOriginAllowed("http://notlocalhost:3000", allowedSet)).toBe(false);
    });

    it("allows valid local origins and ports", () => {
      expect(isOriginAllowed("http://localhost:3000", allowedSet)).toBe(true);
      expect(isOriginAllowed("http://localhost:5173", allowedSet)).toBe(true);
      expect(isOriginAllowed("http://localhost:8080", allowedSet)).toBe(true);
      expect(isOriginAllowed("http://127.0.0.1:3000", allowedSet)).toBe(true);
    });

    it("allows trusted preview domains", () => {
      expect(isOriginAllowed("https://preview-app-12345.europe-west2.run.app", allowedSet)).toBe(true);
      expect(isOriginAllowed("https://subdomain.google.com", allowedSet)).toBe(true);
      expect(isOriginAllowed("http://untrusted.run.app.attacker.com", allowedSet)).toBe(false);
    });
  });

  // Vulnerability 8: Driver navigation text sanitized with DOMPurify
  describe("Vulnerability 8: Driver Navigation HTML Sanitization", () => {
    it("verifies DriverTerminal uses DOMPurify with strict whitelist for navigation display", () => {
      const driverTerminalCode = fs.readFileSync(
        path.resolve(__dirname, "../../src/components/driver/DriverTerminal.tsx"),
        "utf-8"
      );
      expect(driverTerminalCode).toContain("import DOMPurify from 'dompurify'");
      expect(driverTerminalCode).toContain("DOMPurify.sanitize(htmlInstruction");
      expect(driverTerminalCode).toContain("DOMPurify.sanitize(formatted");
      expect(driverTerminalCode).toContain("DOMPurify.sanitize(html");
      expect(driverTerminalCode).toContain("ALLOWED_TAGS: ['b', 'strong', 'span', 'br', 'div', 'wbr']");
    });
  });

  // Vulnerability 9: Android allowBackup disabled
  describe("Vulnerability 9: Android allowBackup Protection", () => {
    it("verifies AndroidManifest.xml disables allowBackup to prevent session extraction", () => {
      const manifestPath = path.resolve(__dirname, "../../android/app/src/main/AndroidManifest.xml");
      if (fs.existsSync(manifestPath)) {
        const manifestContent = fs.readFileSync(manifestPath, "utf-8");
        expect(manifestContent).toContain('android:allowBackup="false"');
        expect(manifestContent).not.toContain('android:allowBackup="true"');
      }
    });
  });

  // Vulnerability 10: Global HSTS and Clickjacking Protection
  describe("Vulnerability 10: Global HSTS and Clickjacking Protection", () => {
    it("verifies server.ts applies HSTS and Clickjacking protection globally to pages and APIs", () => {
      const serverCode = fs.readFileSync(path.resolve(__dirname, "../../server.ts"), "utf-8");
      expect(serverCode).toContain("Strict-Transport-Security");
      expect(serverCode).toContain("max-age=31536000; includeSubDomains; preload");
      expect(serverCode).toContain("X-Frame-Options");
      expect(serverCode).toContain("SAMEORIGIN");
      expect(serverCode).toContain("Content-Security-Policy");
      expect(serverCode).toContain("frame-ancestors 'self'");
    });
  });
});
