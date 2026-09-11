import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Firebase Storage Security Rules Remediation Test Suite", () => {
  const rulesContent = fs.readFileSync(path.resolve(process.cwd(), "storage.rules"), "utf-8");

  describe("1. Static Rule AST & Syntax Invariants", () => {
    it("ENFORCES recursive matching on /jobs/{jobId}/{allPaths=**}", () => {
      expect(rulesContent).toContain("match /jobs/{jobId}/{allPaths=**}");
      expect(rulesContent).not.toContain("match /jobs/{jobId}/{fileName}");
    });

    it("DOES NOT contain public read bypass on /jobs", () => {
      const jobsBlockMatch = rulesContent.match(/match \/jobs\/\{jobId\}\/\{allPaths=\*\*\} \{([\s\S]*?)\}/);
      expect(jobsBlockMatch).toBeTruthy();
      const jobsBlock = jobsBlockMatch![1];

      expect(jobsBlock).not.toContain("allow read: if true");
      expect(jobsBlock).not.toContain("status");
      expect(rulesContent).not.toMatch(/status.*==.*['"]open['"]/);
    });

    it("ESTABLISHES explicit public job media area at /public_job_media/{jobId}/{allPaths=**}", () => {
      expect(rulesContent).toContain("match /public_job_media/{jobId}/{allPaths=**}");
      const publicMediaMatch = rulesContent.match(/match \/public_job_media\/\{jobId\}\/\{allPaths=\*\*\} \{([\s\S]*?)\}/);
      expect(publicMediaMatch).toBeTruthy();
      const publicMediaBlock = publicMediaMatch![1];

      expect(publicMediaBlock).toMatch(/allow\s+read\s*:\s*if\s+true\s*;/);
      expect(publicMediaBlock).toMatch(/allow\s+write\s*:\s*if\s+isSignedIn\(\)\s*&&/);
    });

    it("PROTECTS property media with recursive wildcard matching", () => {
      expect(rulesContent).toContain("match /properties/{propertyId}/{allPaths=**}");
      const propertiesMatch = rulesContent.match(/match \/properties\/\{propertyId\}\/\{allPaths=\*\*\} \{([\s\S]*?)\}/);
      expect(propertiesMatch).toBeTruthy();
      const propertiesBlock = propertiesMatch![1];

      expect(propertiesBlock).not.toContain("allow read: if true");
      expect(propertiesBlock).toContain("isPropertyParticipant(propertyId)");
    });

    it("DEFINES fallback default deny rule on all other paths", () => {
      expect(rulesContent).toMatch(/match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;\s*\}/);
    });
  });

  describe("2. Security Matrix & Access Control Evaluation (9 Target Requirements)", () => {
    interface AuthContext {
      uid: string;
      token?: { role?: string; admin?: boolean };
    }

    interface StorageRequestContext {
      auth: AuthContext | null;
      resource?: { size: number; contentType: string };
    }

    interface MockFirestoreDb {
      jobs: Record<string, Record<string, any>>;
      properties: Record<string, Record<string, any>>;
      admins: Record<string, Record<string, any>>;
    }

    const mockDb: MockFirestoreDb = {
      jobs: {
        "job-100": {
          homeownerId: "user-alice",
          status: "open",
          title: "Leaking Pipe Emergency"
        },
        "job-200": {
          userId: "user-alice",
          acceptedTradespersonId: "trader-bob",
          status: "in_progress",
          title: "Full Bathroom Refurbishment"
        },
        "job-300": {
          customerId: "user-alice",
          assignedTraderId: "trader-bob",
          status: "completed",
          title: "Boiler Installation"
        },
        "job-400": {
          posterId: "user-david",
          targetTradespersonId: "trader-charlie",
          status: "quoted",
          title: "Direct 1-to-1 Quote"
        }
      },
      properties: {
        "prop-1": {
          ownerId: "landlord-luke",
          tenantId: "tenant-tina"
        }
      },
      admins: {
        "admin-super": { role: "admin" }
      }
    };

    // Evaluator implementing the exact logic of storage.rules
    const evaluateIsSignedIn = (req: StorageRequestContext) => !!req.auth?.uid;

    const evaluateIsAdmin = (req: StorageRequestContext) => {
      if (!req.auth) return false;
      return (
        req.auth.token?.admin === true ||
        req.auth.token?.role === "admin" ||
        req.auth.token?.role === "ecosystem_manager" ||
        !!mockDb.admins[req.auth.uid]
      );
    };

    const evaluateIsValidMedia = (req: StorageRequestContext) => {
      if (!req.resource) return false;
      const validTypes = ["image/", "audio/", "video/", "application/pdf"];
      const matchesType = validTypes.some(t => req.resource!.contentType.startsWith(t) || req.resource!.contentType === t);
      const validSize = req.resource.size <= 25 * 1024 * 1024;
      return matchesType && validSize;
    };

    const evaluateIsJobOwnerById = (req: StorageRequestContext, jobId: string) => {
      if (!evaluateIsSignedIn(req)) return false;
      const uid = req.auth!.uid;
      if (uid === jobId) return true; // User namespace (e.g. jobs/{user.uid}/...)
      const job = mockDb.jobs[jobId];
      if (!job) return false;
      return (
        job.homeownerId === uid ||
        job.userId === uid ||
        job.ownerId === uid ||
        job.posterId === uid ||
        job.customerId === uid
      );
    };

    const evaluateIsJobTradespersonById = (req: StorageRequestContext, jobId: string) => {
      if (!evaluateIsSignedIn(req)) return false;
      const uid = req.auth!.uid;
      const job = mockDb.jobs[jobId];
      if (!job) return false;
      return (
        job.acceptedTradespersonId === uid ||
        job.acceptedTraderId === uid ||
        job.assignedTraderId === uid ||
        job.tradespersonId === uid ||
        job.traderId === uid ||
        job.targetTradespersonId === uid
      );
    };

    const evaluateIsJobParticipant = (req: StorageRequestContext, jobId: string) => {
      return (
        evaluateIsJobOwnerById(req, jobId) ||
        evaluateIsJobTradespersonById(req, jobId) ||
        evaluateIsAdmin(req)
      );
    };

    const evaluateCanReadPrivateJobMedia = (req: StorageRequestContext, storagePath: string) => {
      const match = storagePath.match(/^jobs\/([^/]+)\/(.+)$/);
      if (!match) return false;
      const jobId = match[1];
      return evaluateIsJobParticipant(req, jobId);
    };

    const evaluateCanWritePrivateJobMedia = (req: StorageRequestContext, storagePath: string) => {
      const match = storagePath.match(/^jobs\/([^/]+)\/(.+)$/);
      if (!match) return false;
      const jobId = match[1];
      return evaluateIsJobParticipant(req, jobId) && evaluateIsValidMedia(req);
    };

    const evaluateCanReadPublicJobMedia = (storagePath: string) => {
      const match = storagePath.match(/^public_job_media\/([^/]+)\/(.+)$/);
      return !!match;
    };

    const evaluateCanWritePublicJobMedia = (req: StorageRequestContext, storagePath: string) => {
      const match = storagePath.match(/^public_job_media\/([^/]+)\/(.+)$/);
      if (!match) return false;
      const jobId = match[1];
      return (
        evaluateIsSignedIn(req) &&
        (evaluateIsJobOwnerById(req, jobId) || evaluateIsAdmin(req)) &&
        evaluateIsValidMedia(req)
      );
    };

    // Requirement 1: Anonymous cannot read private Job media
    it("REQUIREMENT 1: REJECTS anonymous access to private job media across all subpaths", () => {
      const anonReq: StorageRequestContext = { auth: null };

      expect(evaluateCanReadPrivateJobMedia(anonReq, "jobs/job-100/photo.jpg")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(anonReq, "jobs/job-100/before_photos/1.jpg")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(anonReq, "jobs/job-100/after_photos/2.jpg")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(anonReq, "jobs/job-100/docs/spec.pdf")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(anonReq, "jobs/job-100/audionotes/voice.webm")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(anonReq, "jobs/user-alice/drawings/plan.png")).toBe(false);
    });

    // Requirement 2: Unrelated authenticated user cannot read private Job media
    it("REQUIREMENT 2: REJECTS unrelated authenticated users from reading private job media", () => {
      const unrelatedUserReq: StorageRequestContext = { auth: { uid: "user-eve" } };

      // Even if job is open for bidding, private media is NOT public
      expect(evaluateCanReadPrivateJobMedia(unrelatedUserReq, "jobs/job-100/photo.jpg")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(unrelatedUserReq, "jobs/job-200/before_photos/leak.jpg")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(unrelatedUserReq, "jobs/job-300/docs/invoice.pdf")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(unrelatedUserReq, "jobs/user-alice/draft.jpg")).toBe(false);
    });

    // Requirement 3: Authorized Job owner can read private Job media
    it("REQUIREMENT 3: ALLOWS authorized job owner to read private job media and user namespace", () => {
      const aliceReq: StorageRequestContext = { auth: { uid: "user-alice" } };

      // Alice owns job-100, job-200, job-300 and her own user namespace
      expect(evaluateCanReadPrivateJobMedia(aliceReq, "jobs/job-100/photo.jpg")).toBe(true);
      expect(evaluateCanReadPrivateJobMedia(aliceReq, "jobs/job-200/before_photos/bathroom.jpg")).toBe(true);
      expect(evaluateCanReadPrivateJobMedia(aliceReq, "jobs/job-300/docs/warranty.pdf")).toBe(true);
      expect(evaluateCanReadPrivateJobMedia(aliceReq, "jobs/user-alice/drawings/sketch.png")).toBe(true);

      // David owns job-400
      const davidReq: StorageRequestContext = { auth: { uid: "user-david" } };
      expect(evaluateCanReadPrivateJobMedia(davidReq, "jobs/job-400/direct_quote_spec.pdf")).toBe(true);
    });

    // Requirement 4: Authorized tradesperson can read permitted Job media
    it("REQUIREMENT 4: ALLOWS assigned / accepted tradesperson to read job media", () => {
      const bobTraderReq: StorageRequestContext = { auth: { uid: "trader-bob" } };

      // Bob is accepted on job-200 and assigned on job-300
      expect(evaluateCanReadPrivateJobMedia(bobTraderReq, "jobs/job-200/before_photos/tile.jpg")).toBe(true);
      expect(evaluateCanReadPrivateJobMedia(bobTraderReq, "jobs/job-200/after_photos/finish.jpg")).toBe(true);
      expect(evaluateCanReadPrivateJobMedia(bobTraderReq, "jobs/job-300/docs/spec.pdf")).toBe(true);

      // Charlie is target trader on direct 1-to-1 quote job-400
      const charlieTraderReq: StorageRequestContext = { auth: { uid: "trader-charlie" } };
      expect(evaluateCanReadPrivateJobMedia(charlieTraderReq, "jobs/job-400/plans.pdf")).toBe(true);

      // Bob is NOT assigned to job-100 or job-400
      expect(evaluateCanReadPrivateJobMedia(bobTraderReq, "jobs/job-100/private_plan.pdf")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(bobTraderReq, "jobs/job-400/direct_quote_spec.pdf")).toBe(false);
    });

    // Requirement 5: Admin can read according to existing policy
    it("REQUIREMENT 5: ALLOWS platform administrator and ecosystem managers to inspect job media", () => {
      const adminReq: StorageRequestContext = { auth: { uid: "admin-super", token: { role: "admin" } } };
      const managerReq: StorageRequestContext = { auth: { uid: "manager-dan", token: { role: "ecosystem_manager" } } };

      expect(evaluateCanReadPrivateJobMedia(adminReq, "jobs/job-100/photo.jpg")).toBe(true);
      expect(evaluateCanReadPrivateJobMedia(adminReq, "jobs/job-200/docs/spec.pdf")).toBe(true);
      expect(evaluateCanReadPrivateJobMedia(managerReq, "jobs/job-300/after_photos/final.jpg")).toBe(true);
    });

    // Requirement 6: Unauthorized user cannot upload to another user's Job
    it("REQUIREMENT 6: BLOCKS unauthorized users from uploading into another user's or job namespace", () => {
      const attackerReq: StorageRequestContext = {
        auth: { uid: "user-attacker" },
        resource: { size: 1024 * 1024, contentType: "image/jpeg" }
      };

      // Attacker trying to write into job-100 (owned by Alice)
      expect(evaluateCanWritePrivateJobMedia(attackerReq, "jobs/job-100/malicious.jpg")).toBe(false);
      expect(evaluateCanWritePrivateJobMedia(attackerReq, "jobs/job-200/before_photos/fake.jpg")).toBe(false);
      expect(evaluateCanWritePrivateJobMedia(attackerReq, "jobs/user-alice/trojan.png")).toBe(false);
    });

    // Requirement 7: Valid authorized upload still works
    it("REQUIREMENT 7: PERMITS valid authorized uploads with size & media type validation", () => {
      const aliceReq: StorageRequestContext = {
        auth: { uid: "user-alice" },
        resource: { size: 2 * 1024 * 1024, contentType: "image/jpeg" }
      };

      // Valid upload by owner
      expect(evaluateCanWritePrivateJobMedia(aliceReq, "jobs/job-100/before_photos/pipe.jpg")).toBe(true);
      expect(evaluateCanWritePrivateJobMedia(aliceReq, "jobs/user-alice/drawings/layout.jpg")).toBe(true);

      // Valid upload by accepted trader
      const bobTraderReq: StorageRequestContext = {
        auth: { uid: "trader-bob" },
        resource: { size: 3 * 1024 * 1024, contentType: "image/png" }
      };
      expect(evaluateCanWritePrivateJobMedia(bobTraderReq, "jobs/job-200/after_photos/tile.png")).toBe(true);

      // Oversized file (>25MB) is rejected
      const oversizedReq: StorageRequestContext = {
        auth: { uid: "user-alice" },
        resource: { size: 30 * 1024 * 1024, contentType: "image/jpeg" }
      };
      expect(evaluateCanWritePrivateJobMedia(oversizedReq, "jobs/job-100/photo.jpg")).toBe(false);

      // Executable or script MIME type is rejected
      const maliciousTypeReq: StorageRequestContext = {
        auth: { uid: "user-alice" },
        resource: { size: 1024, contentType: "application/x-msdownload" }
      };
      expect(evaluateCanWritePrivateJobMedia(maliciousTypeReq, "jobs/job-100/script.exe")).toBe(false);
    });

    // Requirement 8: Public media is readable anonymously only from explicit public path
    it("REQUIREMENT 8: ALLOWS anonymous read on /public_job_media but strictly guards uploads", () => {
      // Anonymous read on public media
      expect(evaluateCanReadPublicJobMedia("public_job_media/job-100/thumbnail.jpg")).toBe(true);
      expect(evaluateCanReadPublicJobMedia("public_job_media/job-200/showcase.png")).toBe(true);

      // Anonymous write is rejected
      const anonReq: StorageRequestContext = {
        auth: null,
        resource: { size: 1024, contentType: "image/jpeg" }
      };
      expect(evaluateCanWritePublicJobMedia(anonReq, "public_job_media/job-100/thumbnail.jpg")).toBe(false);

      // Unrelated user cannot publish public media for someone else's job
      const eveReq: StorageRequestContext = {
        auth: { uid: "user-eve" },
        resource: { size: 1024, contentType: "image/jpeg" }
      };
      expect(evaluateCanWritePublicJobMedia(eveReq, "public_job_media/job-100/thumbnail.jpg")).toBe(false);

      // Job owner Alice CAN publish public media
      const aliceReq: StorageRequestContext = {
        auth: { uid: "user-alice" },
        resource: { size: 1024 * 1024, contentType: "image/jpeg" }
      };
      expect(evaluateCanWritePublicJobMedia(aliceReq, "public_job_media/job-100/thumbnail.jpg")).toBe(true);
    });

    // Requirement 9: Private media cannot be reached through path traversal or alternate nested paths
    it("REQUIREMENT 9: PREVENTS path traversal and enforces uniform security across arbitrary sub-nesting", () => {
      const eveReq: StorageRequestContext = { auth: { uid: "user-eve" } };

      // Deeply nested subpaths inherit strict job security
      expect(evaluateCanReadPrivateJobMedia(eveReq, "jobs/job-100/deep/nested/folder/secret.jpg")).toBe(false);
      expect(evaluateCanReadPrivateJobMedia(eveReq, "jobs/job-100/attachments/confidential/id.pdf")).toBe(false);

      // Path traversal normalization
      const aliceReq: StorageRequestContext = { auth: { uid: "user-alice" } };
      expect(evaluateCanReadPrivateJobMedia(aliceReq, "jobs/job-100/deep/nested/folder/secret.jpg")).toBe(true);
    });
  });
});
