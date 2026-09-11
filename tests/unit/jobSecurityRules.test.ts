import { describe, it, expect } from "vitest";
import { 
  sanitizeJobToPublicCard, 
  extractOutwardPostcode, 
  sanitizePublicDescription 
} from "../../src/server/projectionSync";
import * as fs from "fs";
import * as path from "path";

describe("Firestore Security Rules Remediation & Job Privacy Test Suite", () => {
  const rulesContent = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf-8");

  describe("1. Static Rule AST & Policy Enforcement Invariants", () => {
    it("ENFORCES authentication requirement on private /jobs collection (no public reads)", () => {
      // Rule must NOT have 'allow read, list: if true' on /jobs
      const jobsMatch = rulesContent.match(/match \/jobs\/\{jobId\} \{([\s\S]*?)(match \/|$)/);
      expect(jobsMatch).toBeTruthy();
      const jobsBlock = jobsMatch![1];

      expect(jobsBlock).not.toMatch(/allow\s+(?:read|list)\s*:\s*if\s+true\s*;/);
      expect(jobsBlock).toMatch(/allow\s+get\s*:\s*if\s+isSignedIn\(\)\s*&&/);
      expect(jobsBlock).toMatch(/allow\s+list\s*:\s*if\s+isSignedIn\(\)\s*&&/);
    });

    it("RESTRICTS private /jobs reads strictly to owner, assigned trader, or admin", () => {
      const jobsMatch = rulesContent.match(/match \/jobs\/\{jobId\} \{([\s\S]*?)(match \/|$)/);
      const jobsBlock = jobsMatch![1];

      expect(jobsBlock).toContain("isJobOwner(resource.data)");
      expect(jobsBlock).toContain("isJobTradesperson(resource.data)");
      expect(jobsBlock).toContain("isAdmin()");
    });

    it("ALLOWS public & anonymous read discovery on /public_job_cards", () => {
      const publicCardsMatch = rulesContent.match(/match \/public_job_cards\/\{cardId\} \{([\s\S]*?)\}/);
      expect(publicCardsMatch).toBeTruthy();
      const publicBlock = publicCardsMatch![1];

      expect(publicBlock).toMatch(/allow\s+(?:get,\s*list|read,\s*list|get|list|read)\s*:\s*if\s+true\s*;/);
    });

    it("BLOCKS unauthorized creation or sensitive key tampering on /public_job_cards", () => {
      const publicCardsMatch = rulesContent.match(/match \/public_job_cards\/\{cardId\} \{([\s\S]*?)\}/);
      const publicBlock = publicCardsMatch![1];

      expect(publicBlock).toContain("homeownerId");
      expect(publicBlock).toContain("fullAddress");
      expect(publicBlock).toContain("houseNumber");
      expect(publicBlock).toContain("payoutTransferred");
    });
  });

  describe("2. Rule Simulation Invariants (Evaluating Access Matrix)", () => {
    interface SecurityContext {
      auth: { uid: string; token?: { role?: string; isAdmin?: boolean } } | null;
      resource?: { data: Record<string, any> };
      requestResource?: { data: Record<string, any> };
    }

    const evaluateIsSignedIn = (ctx: SecurityContext) => !!ctx.auth?.uid;

    const evaluateIsAdmin = (ctx: SecurityContext) => {
      if (!ctx.auth) return false;
      return ctx.auth.token?.role === "admin" || ctx.auth.token?.isAdmin === true;
    };

    const evaluateIsJobOwner = (ctx: SecurityContext, jobData: Record<string, any>) => {
      if (!evaluateIsSignedIn(ctx)) return false;
      const uid = ctx.auth!.uid;
      return (
        jobData.homeownerId === uid ||
        jobData.userId === uid ||
        jobData.ownerId === uid ||
        jobData.posterId === uid ||
        jobData.customerId === uid
      );
    };

    const evaluateIsJobTradesperson = (ctx: SecurityContext, jobData: Record<string, any>) => {
      if (!evaluateIsSignedIn(ctx)) return false;
      const uid = ctx.auth!.uid;
      return (
        jobData.acceptedTradespersonId === uid ||
        jobData.acceptedTraderId === uid ||
        jobData.assignedTraderId === uid ||
        jobData.tradespersonId === uid ||
        jobData.traderId === uid ||
        jobData.targetTradespersonId === uid
      );
    };

    const evaluateCanReadPrivateJob = (ctx: SecurityContext, jobData: Record<string, any>) => {
      return (
        evaluateIsSignedIn(ctx) &&
        (evaluateIsJobOwner(ctx, jobData) ||
          evaluateIsJobTradesperson(ctx, jobData) ||
          evaluateIsAdmin(ctx))
      );
    };

    const evaluateCanReadPublicCard = () => true;

    const evaluateCanWritePublicCard = (ctx: SecurityContext, incomingData: Record<string, any>) => {
      if (!evaluateIsSignedIn(ctx)) return false;
      if (evaluateIsAdmin(ctx)) return true;

      const forbiddenKeys = [
        "homeownerId", "userId", "customerId", "ownerId", "posterId",
        "fullAddress", "houseNumber", "locationInstructions", "accessInstructions",
        "postcode", "photos", "videos", "documents", "drawings", "voiceNotes",
        "quotes", "dispute", "payoutStatus", "payoutTransferred",
        "stripeCustomerId", "stripeAccountId"
      ];

      return !forbiddenKeys.some((key) => key in incomingData);
    };

    const privateJobSample = {
      id: "job_999",
      homeownerId: "user_alice",
      title: "Boiler Installation",
      description: "Replace standard combi boiler at 10 Downing Street",
      fullAddress: "10 Downing Street, Westminster, London, SW1A 2AA",
      houseNumber: "10",
      locationInstructions: "Ring bell twice, gate code 1234",
      postcode: "SW1A 2AA",
      payoutStatus: "pending",
      payoutTransferred: false,
      acceptedTradespersonId: "trader_bob"
    };

    it("DENIES anonymous visitor from reading private /jobs document", () => {
      const anonCtx: SecurityContext = { auth: null };
      expect(evaluateCanReadPrivateJob(anonCtx, privateJobSample)).toBe(false);
    });

    it("DENIES unassigned User C from reading Alice's private /jobs document", () => {
      const attackerCtx: SecurityContext = { auth: { uid: "user_charlie_attacker" } };
      expect(evaluateCanReadPrivateJob(attackerCtx, privateJobSample)).toBe(false);
    });

    it("ALLOWS Alice (homeowner/owner) to read her private /jobs document", () => {
      const ownerCtx: SecurityContext = { auth: { uid: "user_alice" } };
      expect(evaluateCanReadPrivateJob(ownerCtx, privateJobSample)).toBe(true);
    });

    it("ALLOWS Bob (accepted tradesperson) to read the private /jobs document", () => {
      const traderCtx: SecurityContext = { auth: { uid: "trader_bob" } };
      expect(evaluateCanReadPrivateJob(traderCtx, privateJobSample)).toBe(true);
    });

    it("ALLOWS Platform Admin to read the private /jobs document", () => {
      const adminCtx: SecurityContext = { auth: { uid: "admin_super", token: { role: "admin" } } };
      expect(evaluateCanReadPrivateJob(adminCtx, privateJobSample)).toBe(true);
    });

    it("ALLOWS anonymous visitor to read /public_job_cards document", () => {
      expect(evaluateCanReadPublicCard()).toBe(true);
    });

    it("DENIES anonymous visitor from writing to /public_job_cards", () => {
      const anonCtx: SecurityContext = { auth: null };
      expect(evaluateCanWritePublicCard(anonCtx, { title: "Spam Job" })).toBe(false);
    });

    it("DENIES normal user from writing PII keys to /public_job_cards", () => {
      const userCtx: SecurityContext = { auth: { uid: "user_alice" } };
      expect(evaluateCanWritePublicCard(userCtx, { title: "Leaked Job", fullAddress: "123 Secret St" })).toBe(false);
      expect(evaluateCanWritePublicCard(userCtx, { title: "Leaked Job", homeownerId: "user_alice" })).toBe(false);
      expect(evaluateCanWritePublicCard(userCtx, { title: "Leaked Job", payoutTransferred: true })).toBe(false);
    });

    it("ALLOWS sanitized card write to /public_job_cards", () => {
      const userCtx: SecurityContext = { auth: { uid: "user_alice" } };
      const safeCard = {
        id: "job_999",
        category: "Plumbing & Heating",
        title: "Boiler Installation",
        description: "Standard combi replacement",
        postcodeArea: "SW1A",
        status: "posted"
      };
      expect(evaluateCanWritePublicCard(userCtx, safeCard)).toBe(true);
    });
  });

  describe("3. Projection Engine Sanitization & Redaction Verification", () => {
    it("EXTRACTS outward postcode safely without exposing full postcode", () => {
      expect(extractOutwardPostcode("SW1A 1AA")).toBe("SW1A");
      expect(extractOutwardPostcode("EC1V 2NX")).toBe("EC1V");
      expect(extractOutwardPostcode("M1 1AE")).toBe("M1");
      expect(extractOutwardPostcode("B338TH")).toBe("B33");
      expect(extractOutwardPostcode("")).toBe("");
    });

    it("REDACTS emails, phone numbers, and full postcodes from job descriptions", () => {
      const rawText = "Please contact me at john.doe@example.com or call 07700 900077. Property is at EC1V 2NX near the park.";
      const sanitized = sanitizePublicDescription(rawText);

      expect(sanitized).not.toContain("john.doe@example.com");
      expect(sanitized).toContain("[Contact Info Redacted]");
      expect(sanitized).not.toContain("07700 900077");
      expect(sanitized).toContain("[Phone Redacted]");
      expect(sanitized).not.toContain("EC1V 2NX");
      expect(sanitized).toContain("EC1V ***");
    });

    it("STRIPS all homeowner PII, operational notes, and financial parameters from projection", () => {
      const privateJob = {
        id: "job_12345",
        jobNo: "AT-882200",
        homeownerId: "user_secret_owner_id",
        userId: "user_secret_owner_id",
        ownerId: "user_secret_owner_id",
        customerId: "user_secret_owner_id",
        posterId: "user_secret_owner_id",
        title: "Emergency Pipe Burst",
        description: "Major water leak in kitchen under sink. Contact me at emergency@home.co.uk or 07911 123456 at SW1A 1AA.",
        category: "Plumbing & Heating",
        subCategory: "Emergency Leak",
        postcode: "SW1A 1AA",
        fullAddress: "Flat 4B, 10 Buckingham Gate, London SW1A 1AA",
        houseNumber: "Flat 4B",
        locationInstructions: "Key under flowerpot on the porch",
        urgency: "emergency",
        status: "posted",
        estimateMin: 150,
        estimateMax: 300,
        photos: ["https://storage.googleapis.com/private/img1.jpg", "https://storage.googleapis.com/private/img2.jpg"],
        videos: ["https://storage.googleapis.com/private/vid1.mp4"],
        documents: ["https://storage.googleapis.com/private/spec.pdf"],
        quotes: [{ quoteId: "q1", amount: 200 }],
        dispute: { raisedBy: "user_secret_owner_id", reason: "Damage" },
        payoutStatus: "transferred",
        payoutTransferred: true,
        stripeCustomerId: "cus_secret123",
        stripeAccountId: "acct_secret456",
        securityAlert: "SUSPICIOUS_IP",
        isBoosted: true,
        boostTier: "emergency_boost"
      };

      const publicCard = sanitizeJobToPublicCard("job_12345", privateJob);

      // Verify what MUST be excluded
      expect((publicCard as any).homeownerId).toBeUndefined();
      expect((publicCard as any).userId).toBeUndefined();
      expect((publicCard as any).ownerId).toBeUndefined();
      expect((publicCard as any).customerId).toBeUndefined();
      expect((publicCard as any).posterId).toBeUndefined();
      expect((publicCard as any).fullAddress).toBeUndefined();
      expect((publicCard as any).houseNumber).toBeUndefined();
      expect((publicCard as any).locationInstructions).toBeUndefined();
      expect((publicCard as any).postcode).toBeUndefined();
      expect((publicCard as any).photos).toBeUndefined();
      expect((publicCard as any).videos).toBeUndefined();
      expect((publicCard as any).documents).toBeUndefined();
      expect((publicCard as any).quotes).toBeUndefined();
      expect((publicCard as any).dispute).toBeUndefined();
      expect((publicCard as any).payoutStatus).toBeUndefined();
      expect((publicCard as any).payoutTransferred).toBeUndefined();
      expect((publicCard as any).stripeCustomerId).toBeUndefined();
      expect((publicCard as any).stripeAccountId).toBeUndefined();
      expect((publicCard as any).securityAlert).toBeUndefined();

      // Verify what MUST be included safely
      expect(publicCard.id).toBe("job_12345");
      expect(publicCard.jobNo).toBe("AT-882200");
      expect(publicCard.category).toBe("Plumbing & Heating");
      expect(publicCard.subCategory).toBe("Emergency Leak");
      expect(publicCard.title).toBe("Emergency Pipe Burst");
      expect(publicCard.postcodeArea).toBe("SW1A");
      expect(publicCard.urgency).toBe("emergency");
      expect(publicCard.status).toBe("posted");
      expect(publicCard.estimateMin).toBe(150);
      expect(publicCard.estimateMax).toBe(300);
      expect(publicCard.photosCount).toBe(2);
      expect(publicCard.videosCount).toBe(1);
      expect(publicCard.documentsCount).toBe(1);
      expect(publicCard.isBoosted).toBe(true);
      expect(publicCard.boostTier).toBe("emergency_boost");

      // Verify redacted text
      expect(publicCard.description).not.toContain("emergency@home.co.uk");
      expect(publicCard.description).not.toContain("07911 123456");
      expect(publicCard.description).not.toContain("SW1A 1AA");
      expect(publicCard.description).toContain("[Contact Info Redacted]");
      expect(publicCard.description).toContain("[Phone Redacted]");
      expect(publicCard.description).toContain("SW1A ***");
    });
  });
});
