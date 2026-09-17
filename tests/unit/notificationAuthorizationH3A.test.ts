import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { authorizeNotificationRequest, validateNotificationPayload } from "../../src/server/authorization";

// Mock Firestore database implementation for testing relationship checks
function createMockDb(initialData: Record<string, Record<string, any>> = {}) {
  const collections: Record<string, Record<string, any>> = {
    users: initialData.users || {},
    jobs: initialData.jobs || {},
    conversations: initialData.conversations || {},
    projects: initialData.projects || {},
    ride_requests: initialData.ride_requests || {},
    rides: initialData.rides || {},
    notifications: {}
  };

  return {
    collections,
    collection(colName: string) {
      const col = collections[colName] || {};
      return {
        doc(docId: string) {
          const docData = col[docId];
          return {
            get: async () => ({
              exists: !!docData,
              data: () => docData
            }),
            collection(subColName: string) {
              const subCol = docData?.subcollections?.[subColName] || {};
              return {
                where(field: string, op: string, val: any) {
                  return {
                    limit(lim: number) {
                      return {
                        get: async () => {
                          const matches = Object.values(subCol).filter((item: any) => {
                            if (op === "==") return item[field] === val;
                            return false;
                          });
                          return {
                            empty: matches.length === 0,
                            docs: matches.map(m => ({ data: () => m }))
                          };
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

describe("Security Remediation H3A — Fix Cross-User Notification Authorization Bypass Audit", () => {
  const serverCode = fs.readFileSync(path.resolve(__dirname, "../../server.ts"), "utf-8");

  describe("1. Removal of Vulnerable Fallback Logic", () => {
    it("strictly verifies server.ts does NOT contain recipientDoc.exists authorization fallback", () => {
      expect(serverCode).not.toContain("const recipientDoc = await db.collection(\"users\").doc(recipientId).get();");
      expect(serverCode).not.toContain("if (recipientDoc.exists)");
    });

    it("verifies server.ts delegates notification authorization to authorizeNotificationRequest", () => {
      expect(serverCode).toContain("authorizeNotificationRequest(");
    });
  });

  describe("2. Regression Tests (Prompt Section 8 - Tests A through F)", () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb({
        users: {
          user_a: { uid: "user_a", name: "User A", role: "homeowner" },
          user_b: { uid: "user_b", name: "User B", role: "tradesperson" },
          user_c: { uid: "user_c", name: "User C", role: "homeowner" },
        },
        jobs: {
          job_c: {
            id: "job_c",
            homeownerId: "user_c",
            title: "Plumbing Repair",
            status: "open"
          },
          job_x: {
            id: "job_x",
            homeownerId: "user_a",
            acceptedTradespersonId: "trader_assigned",
            invitedTraderIds: ["trader_invited"],
            status: "open",
            subcollections: {
              quotes: {
                quote_1: { id: "quote_1", tradespersonId: "trader_quoted", amount: 150 }
              }
            }
          }
        },
        conversations: {
          conv_123: {
            id: "conv_123",
            participants: ["user_a", "user_b"]
          }
        }
      });
    });

    it("Test A — recipient merely exists: rejects cross-user notification when recipient exists but no relationship exists", async () => {
      const isAuthorized = await authorizeNotificationRequest(
        mockDb,
        "user_a",
        { uid: "user_a", role: "homeowner" },
        {
          recipientId: "user_b",
          type: "quote",
          link: "/profile/user_b"
        }
      );
      expect(isAuthorized).toBe(false);
    });

    it("Test B — unrelated user: rejects notification concerning User C's job sent by User A to User B", async () => {
      const isAuthorized = await authorizeNotificationRequest(
        mockDb,
        "user_a",
        { uid: "user_a", role: "homeowner" },
        {
          recipientId: "user_b",
          type: "status",
          jobId: "job_c",
          link: "/job/job_c"
        }
      );
      expect(isAuthorized).toBe(false);
    });

    it("Test C — recipient substitution: rejects attempt by User A (owner of Job X) to substitute recipient with unrelated User B", async () => {
      const isAuthorized = await authorizeNotificationRequest(
        mockDb,
        "user_a",
        { uid: "user_a", role: "homeowner" },
        {
          recipientId: "user_b",
          type: "quote",
          jobId: "job_x",
          link: "/job/job_x"
        }
      );
      expect(isAuthorized).toBe(false);
    });

    it("Test D — missing resource: rejects notification referencing nonexistent jobId or quoteId", async () => {
      const isAuthorized = await authorizeNotificationRequest(
        mockDb,
        "user_a",
        { uid: "user_a", role: "homeowner" },
        {
          recipientId: "user_b",
          type: "quote",
          jobId: "nonexistent_job_999",
          link: "/job/nonexistent_job_999"
        }
      );
      expect(isAuthorized).toBe(false);
    });

    it("Test E — legitimate relationship: allows notifications between legitimate job participants and conversation members", async () => {
      // E1: Homeowner User A notifies assigned trader trader_assigned for Job X
      const auth1 = await authorizeNotificationRequest(
        mockDb,
        "user_a",
        { uid: "user_a", role: "homeowner" },
        {
          recipientId: "trader_assigned",
          type: "status",
          jobId: "job_x",
          link: "/job/job_x"
        }
      );
      expect(auth1).toBe(true);

      // E2: Homeowner User A notifies invited trader trader_invited for Job X
      const auth2 = await authorizeNotificationRequest(
        mockDb,
        "user_a",
        { uid: "user_a", role: "homeowner" },
        {
          recipientId: "trader_invited",
          type: "quote",
          jobId: "job_x",
          link: "/job/job_x"
        }
      );
      expect(auth2).toBe(true);

      // E3: Quoted trader trader_quoted notifies Homeowner User A for Job X
      const auth3 = await authorizeNotificationRequest(
        mockDb,
        "trader_quoted",
        { uid: "trader_quoted", role: "tradesperson" },
        {
          recipientId: "user_a",
          type: "quote",
          jobId: "job_x",
          link: "/job/job_x"
        }
      );
      expect(auth3).toBe(true);

      // E4: Conversation members in conv_123 (User A & User B) notify each other
      const auth4 = await authorizeNotificationRequest(
        mockDb,
        "user_a",
        { uid: "user_a", role: "homeowner" },
        {
          recipientId: "user_b",
          type: "message",
          conversationId: "conv_123",
          link: "/chat/conv_123"
        }
      );
      expect(auth4).toBe(true);
    });

    it("Test F — cross-user existing recipient: verifies quote, job_lead, and status types fail when caller has no relationship", async () => {
      const typesToTest = ["quote", "job_lead", "status"];

      for (const t of typesToTest) {
        const isAuthorized = await authorizeNotificationRequest(
          mockDb,
          "user_a",
          { uid: "user_a", role: "homeowner" },
          {
            recipientId: "user_b",
            type: t,
            link: "/dashboard"
          }
        );
        expect(isAuthorized).toBe(false);
      }
    });

    it("Test G — self-notifications and admin notifications remain allowed", async () => {
      // Self notification
      const selfAuth = await authorizeNotificationRequest(
        mockDb,
        "user_a",
        { uid: "user_a", role: "homeowner" },
        {
          recipientId: "user_a",
          type: "profile_optimization",
          link: "/profile"
        }
      );
      expect(selfAuth).toBe(true);

      // Admin notification
      const adminAuth = await authorizeNotificationRequest(
        mockDb,
        "admin_user",
        { uid: "admin_user", isAdmin: true },
        {
          recipientId: "user_b",
          type: "system",
          link: "/announcements"
        }
      );
      expect(adminAuth).toBe(true);
    });
  });
});
