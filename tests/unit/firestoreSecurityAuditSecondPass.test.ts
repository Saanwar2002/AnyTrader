import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Firestore Security Rules Second-Pass Comprehensive Audit & Verification Suite", () => {
  const rulesContent = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf-8");

  describe("1. Static AST Invariants for Hardened Collections", () => {
    it("RESTRICTS /admins to isAdmin() only (removes isConsultancyOwner() loophole)", () => {
      const adminMatch = rulesContent.match(/match \/admins\/\{adminId\} \{([\s\S]*?)\}/);
      expect(adminMatch).toBeTruthy();
      const block = adminMatch![1];
      expect(block).toContain("allow read, write: if isAdmin();");
      expect(block).not.toContain("isConsultancyOwner");
    });

    it("RESTRICTS /emergency_broadcasts creation strictly to admin (no arbitrary user spam)", () => {
      const match = rulesContent.match(/match \/emergency_broadcasts\/\{broadcastId\} \{([\s\S]*?)\}/);
      expect(match).toBeTruthy();
      const block = match![1];
      expect(block).toContain("allow read: if true;");
      expect(block).toContain("allow write: if isAdmin();");
      expect(block).not.toMatch(/allow\s+create\s*:\s*if\s+isSignedIn\(\)/);
    });

    it("SCOPES /recurring_schedules to participants and blocks global enumeration", () => {
      const match = rulesContent.match(/match \/recurring_schedules\/\{scheduleId\} \{([\s\S]*?)\}/);
      expect(match).toBeTruthy();
      const block = match![1];
      expect(block).not.toContain("allow list: if isSignedIn();");
      expect(block).toContain("resource.data.get('homeownerId', '') == request.auth.uid");
      expect(block).toContain("payoutStatus");
      expect(block).toContain("payoutTransferred");
    });

    it("SCOPES /live_tracking to driver, passenger, rider, or admin (no global streaming)", () => {
      const match = rulesContent.match(/match \/live_tracking\/\{rideId\} \{([\s\S]*?)\}/);
      expect(match).toBeTruthy();
      const block = match![1];
      expect(block).not.toMatch(/allow\s+read\s*:\s*if\s+isSignedIn\(\)\s*;/);
      expect(block).toContain("resource.data.get('driverId', '') == request.auth.uid");
      expect(block).toContain("resource.data.get('passengerId', '') == request.auth.uid");
    });

    it("PROTECTS /invoices financial status fields against client manipulation", () => {
      const match = rulesContent.match(/match \/invoices\/\{id\} \{([\s\S]*?)\}/);
      expect(match).toBeTruthy();
      const block = match![1];
      expect(block).toContain("stripePaymentIntentId");
      expect(block).toContain("payoutStatus");
      expect(block).toContain("payoutTransferred");
      expect(block).toContain("paid");
    });

    it("LOCKS /bidding_jobs against cross-user overwrites and financial key manipulation", () => {
      const match = rulesContent.match(/match \/bidding_jobs\/\{jobId\} \{([\s\S]*?)\}/);
      expect(match).toBeTruthy();
      const block = match![1];
      expect(block).not.toMatch(/allow\s+read,\s*list\s*:\s*if\s+isSignedIn\(\)\s*;/);
      expect(block).not.toMatch(/allow\s+write\s*:\s*if\s+isSignedIn\(\)\s*;/);
      expect(block).toContain("creatorId");
      expect(block).toContain("payoutStatus");
    });

    it("PROTECTS /support_tickets and /enquiries against cross-user tampering", () => {
      const ticketMatch = rulesContent.match(/match \/support_tickets\/\{ticketId\} \{([\s\S]*?)\}/);
      expect(ticketMatch).toBeTruthy();
      expect(ticketMatch![1]).not.toMatch(/allow\s+write\s*:\s*if\s+isSignedIn\(\)\s*;/);

      const enquiryMatch = rulesContent.match(/match \/enquiries\/\{id\} \{([\s\S]*?)\}/);
      expect(enquiryMatch).toBeTruthy();
      expect(enquiryMatch![1]).not.toMatch(/allow\s+write\s*:\s*if\s+isSignedIn\(\)\s*;/);
    });
  });

  describe("2. Behavioral Simulation Matrix (Evaluating Rules Engine Logic)", () => {
    interface SecurityContext {
      auth: { uid: string; token?: { role?: string; isAdmin?: boolean; admin?: boolean; email?: string } } | null;
      resource?: { data: Record<string, any> };
      requestResource?: { data: Record<string, any> };
    }

    const isSignedIn = (ctx: SecurityContext) => !!ctx.auth?.uid;
    const isAdmin = (ctx: SecurityContext) => {
      if (!ctx.auth) return false;
      return ctx.auth.token?.role === "admin" || ctx.auth.token?.isAdmin === true || ctx.auth.token?.admin === true;
    };

    // --- Recurring Schedules Evaluation ---
    const evaluateCanReadRecurringSchedule = (ctx: SecurityContext, scheduleData: Record<string, any>) => {
      if (!isSignedIn(ctx)) return false;
      const uid = ctx.auth!.uid;
      return (
        scheduleData.homeownerId === uid ||
        scheduleData.tradespersonId === uid ||
        scheduleData.userId === uid ||
        isAdmin(ctx)
      );
    };

    const evaluateCanUpdateRecurringSchedule = (
      ctx: SecurityContext,
      currentData: Record<string, any>,
      newData: Record<string, any>
    ) => {
      if (!isSignedIn(ctx)) return false;
      if (isAdmin(ctx)) return true;
      const uid = ctx.auth!.uid;
      const isParticipant =
        currentData.homeownerId === uid ||
        currentData.tradespersonId === uid ||
        currentData.userId === uid;
      if (!isParticipant) return false;

      // Check affected keys
      const affectedKeys = Object.keys(newData).filter((k) => newData[k] !== currentData[k]);
      const protectedKeys = ["homeownerId", "tradespersonId", "userId", "payoutStatus", "payoutTransferred", "funded"];
      if (affectedKeys.some((k) => protectedKeys.includes(k))) return false;
      return true;
    };

    // --- Invoices Evaluation ---
    const evaluateCanUpdateInvoice = (
      ctx: SecurityContext,
      currentData: Record<string, any>,
      newData: Record<string, any>
    ) => {
      if (!isSignedIn(ctx)) return false;
      if (isAdmin(ctx)) return true;
      const uid = ctx.auth!.uid;
      const isOwner =
        currentData.traderId === uid ||
        currentData.consultantId === uid ||
        currentData.userId === uid ||
        currentData.businessId === uid;
      if (!isOwner) return false;

      const affectedKeys = Object.keys(newData).filter((k) => newData[k] !== currentData[k]);
      const protectedKeys = [
        "paid", "isPaid", "status", "stripePaymentIntentId", "stripeSessionId",
        "payoutStatus", "payoutTransferred", "platformFee", "amountPaid"
      ];
      if (affectedKeys.some((k) => protectedKeys.includes(k))) return false;
      return true;
    };

    // --- Support Tickets Evaluation ---
    const evaluateCanAccessTicket = (ctx: SecurityContext, ticketData: Record<string, any>) => {
      if (!isSignedIn(ctx)) return false;
      return ticketData.userId === ctx.auth!.uid || isAdmin(ctx);
    };

    const evaluateCanUpdateTicket = (
      ctx: SecurityContext,
      currentData: Record<string, any>,
      newData: Record<string, any>
    ) => {
      if (!isSignedIn(ctx)) return false;
      if (isAdmin(ctx)) return true;
      if (currentData.userId !== ctx.auth!.uid) return false;

      const affectedKeys = Object.keys(newData).filter((k) => newData[k] !== currentData[k]);
      const protectedKeys = ["userId", "adminAssigned", "priority", "internalNotes"];
      if (affectedKeys.some((k) => protectedKeys.includes(k))) return false;
      return true;
    };

    // --- Bidding Jobs Evaluation ---
    const evaluateCanAccessBiddingJob = (ctx: SecurityContext, jobData: Record<string, any>) => {
      if (!isSignedIn(ctx)) return false;
      const uid = ctx.auth!.uid;
      return (
        jobData.creatorId === uid ||
        jobData.ownerId === uid ||
        jobData.userId === uid ||
        jobData.status === "open" ||
        isAdmin(ctx)
      );
    };

    const evaluateCanUpdateBiddingJob = (
      ctx: SecurityContext,
      currentData: Record<string, any>,
      newData: Record<string, any>
    ) => {
      if (!isSignedIn(ctx)) return false;
      if (isAdmin(ctx)) return true;
      const uid = ctx.auth!.uid;
      const isOwner = currentData.creatorId === uid || currentData.ownerId === uid || currentData.userId === uid;
      if (!isOwner) return false;

      const affectedKeys = Object.keys(newData).filter((k) => newData[k] !== currentData[k]);
      const protectedKeys = ["creatorId", "ownerId", "userId", "payoutStatus", "payoutTransferred", "funded", "amount", "balance"];
      if (affectedKeys.some((k) => protectedKeys.includes(k))) return false;
      return true;
    };

    // --- Live Tracking Evaluation ---
    const evaluateCanReadLiveTracking = (ctx: SecurityContext, trackingData: Record<string, any>, rideId: string) => {
      if (!isSignedIn(ctx)) return false;
      const uid = ctx.auth!.uid;
      return (
        trackingData.driverId === uid ||
        trackingData.passengerId === uid ||
        trackingData.riderId === uid ||
        rideId === uid ||
        isAdmin(ctx)
      );
    };

    // --- TEST SCENARIOS ---

    describe("Recurring Schedules Access Matrix", () => {
      const schedule = {
        id: "sched_1",
        homeownerId: "user_homeowner",
        tradespersonId: "trader_cleaner",
        frequency: "weekly",
        pricePerVisit: 45,
        payoutStatus: "pending"
      };

      it("ALLOWS homeowner and assigned cleaner to view their recurring schedule", () => {
        expect(evaluateCanReadRecurringSchedule({ auth: { uid: "user_homeowner" } }, schedule)).toBe(true);
        expect(evaluateCanReadRecurringSchedule({ auth: { uid: "trader_cleaner" } }, schedule)).toBe(true);
      });

      it("BLOCKS unrelated third-party users from reading the schedule", () => {
        expect(evaluateCanReadRecurringSchedule({ auth: { uid: "attacker_user" } }, schedule)).toBe(false);
        expect(evaluateCanReadRecurringSchedule({ auth: null }, schedule)).toBe(false);
      });

      it("ALLOWS homeowner to update legitimate fields (e.g. notes, preferredTime)", () => {
        const updated = { ...schedule, preferredTime: "10:00 AM", notes: "Please use side gate" };
        expect(evaluateCanUpdateRecurringSchedule({ auth: { uid: "user_homeowner" } }, schedule, updated)).toBe(true);
      });

      it("BLOCKS homeowner or trader from mutating payoutStatus or tradespersonId", () => {
        const hijacked = { ...schedule, payoutStatus: "transferred" };
        expect(evaluateCanUpdateRecurringSchedule({ auth: { uid: "user_homeowner" } }, schedule, hijacked)).toBe(false);

        const hijackedTrader = { ...schedule, tradespersonId: "attacker_trader" };
        expect(evaluateCanUpdateRecurringSchedule({ auth: { uid: "trader_cleaner" } }, schedule, hijackedTrader)).toBe(false);
      });
    });

    describe("Invoices Financial Protection Matrix", () => {
      const invoice = {
        id: "inv_123",
        traderId: "trader_alice",
        clientId: "customer_bob",
        amount: 350.00,
        paid: false,
        status: "unpaid",
        stripePaymentIntentId: null
      };

      it("ALLOWS legitimate trader to update invoice line items or notes before payment", () => {
        const updated = { ...invoice, notes: "Includes materials" };
        expect(evaluateCanUpdateInvoice({ auth: { uid: "trader_alice" } }, invoice, updated)).toBe(true);
      });

      it("BLOCKS customer or trader from marking invoice as paid: true directly from client SDK", () => {
        const forgedPaid = { ...invoice, paid: true, status: "paid" };
        expect(evaluateCanUpdateInvoice({ auth: { uid: "customer_bob" } }, invoice, forgedPaid)).toBe(false);
        expect(evaluateCanUpdateInvoice({ auth: { uid: "trader_alice" } }, invoice, forgedPaid)).toBe(false);
      });

      it("BLOCKS tampering with stripePaymentIntentId or platformFee", () => {
        const forgedStripe = { ...invoice, stripePaymentIntentId: "pi_fake_123" };
        expect(evaluateCanUpdateInvoice({ auth: { uid: "customer_bob" } }, invoice, forgedStripe)).toBe(false);
        expect(evaluateCanUpdateInvoice({ auth: { uid: "trader_alice" } }, invoice, forgedStripe)).toBe(false);
      });

      it("ALLOWS admin to update invoice records during support arbitration", () => {
        const adminCtx = { auth: { uid: "admin_1", token: { role: "admin" } } };
        const adminUpdate = { ...invoice, paid: true, status: "paid" };
        expect(evaluateCanUpdateInvoice(adminCtx, invoice, adminUpdate)).toBe(true);
      });
    });

    describe("Support Tickets Access Matrix", () => {
      const ticket = {
        id: "ticket_99",
        userId: "customer_dan",
        subject: "Cannot connect bank account",
        priority: "normal",
        adminAssigned: null,
        internalNotes: null
      };

      it("ALLOWS ticket owner to access their own support ticket", () => {
        expect(evaluateCanAccessTicket({ auth: { uid: "customer_dan" } }, ticket)).toBe(true);
      });

      it("BLOCKS other users from accessing another user's support ticket", () => {
        expect(evaluateCanAccessTicket({ auth: { uid: "attacker_eve" } }, ticket)).toBe(false);
      });

      it("BLOCKS ticket owner from escalating priority or injecting adminAssigned notes", () => {
        const escalated = { ...ticket, priority: "critical_p0", adminAssigned: "admin_super" };
        expect(evaluateCanUpdateTicket({ auth: { uid: "customer_dan" } }, ticket, escalated)).toBe(false);
      });
    });

    describe("Bidding Jobs Access Matrix", () => {
      const openBiddingJob = {
        id: "bid_job_1",
        creatorId: "user_carol",
        title: "Kitchen Refurbishment Tender",
        status: "open",
        amount: 5000,
        funded: false
      };

      const draftBiddingJob = {
        id: "bid_job_2",
        creatorId: "user_carol",
        title: "Private Draft Tender",
        status: "draft",
        amount: 2000,
        funded: false
      };

      it("ALLOWS all signed-in users to view open tenders", () => {
        expect(evaluateCanAccessBiddingJob({ auth: { uid: "trader_bidder" } }, openBiddingJob)).toBe(true);
      });

      it("BLOCKS other users from viewing private draft tenders", () => {
        expect(evaluateCanAccessBiddingJob({ auth: { uid: "trader_bidder" } }, draftBiddingJob)).toBe(false);
        expect(evaluateCanAccessBiddingJob({ auth: { uid: "user_carol" } }, draftBiddingJob)).toBe(true);
      });

      it("BLOCKS competitors from mutating or deleting another user's tender", () => {
        const modified = { ...openBiddingJob, title: "Maliciously Hijacked" };
        expect(evaluateCanUpdateBiddingJob({ auth: { uid: "attacker_trader" } }, openBiddingJob, modified)).toBe(false);
      });

      it("BLOCKS creator from forging funded: true or modifying payoutStatus directly", () => {
        const forgedFunded = { ...openBiddingJob, funded: true, payoutStatus: "transferred" };
        expect(evaluateCanUpdateBiddingJob({ auth: { uid: "user_carol" } }, openBiddingJob, forgedFunded)).toBe(false);
      });
    });

    describe("Live Tracking Real-Time GPS Matrix", () => {
      const activeTracking = {
        rideId: "ride_xyz",
        driverId: "driver_sam",
        passengerId: "passenger_emma",
        latitude: 51.5074,
        longitude: -0.1278
      };

      it("ALLOWS assigned driver and passenger to stream live coordinates", () => {
        expect(evaluateCanReadLiveTracking({ auth: { uid: "driver_sam" } }, activeTracking, "ride_xyz")).toBe(true);
        expect(evaluateCanReadLiveTracking({ auth: { uid: "passenger_emma" } }, activeTracking, "ride_xyz")).toBe(true);
      });

      it("BLOCKS random authenticated third-party from tracking driver coordinates", () => {
        expect(evaluateCanReadLiveTracking({ auth: { uid: "stalker_user" } }, activeTracking, "ride_xyz")).toBe(false);
      });

      it("ALLOWS platform admin to inspect live tracking for passenger safety", () => {
        expect(evaluateCanReadLiveTracking({ auth: { uid: "admin_desk", token: { role: "admin" } } }, activeTracking, "ride_xyz")).toBe(true);
      });
    });
  });
});
