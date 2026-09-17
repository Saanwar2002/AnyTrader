import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { validateNotificationPayload } from "../../src/server/authorization";
import { BadRequestError } from "../../src/server/httpErrors";

describe("Security Remediation H3 — Notification & Queue Abuse Prevention Audit", () => {
  const rulesCode = fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf-8");
  const serverCode = fs.readFileSync(path.resolve(__dirname, "../../server.ts"), "utf-8");

  describe("1. Firestore Security Rules Hardening for Notifications & Queues", () => {
    it("locks /notifications creation strictly to admin/server callers", () => {
      expect(rulesCode).toContain("match /notifications/{notificationId}");
      expect(rulesCode).toContain("allow create: if isAdmin();");
    });

    it("restricts /notifications reading to recipient/owner/admin", () => {
      expect(rulesCode).toContain("resource.data.userId == request.auth.uid");
      expect(rulesCode).toContain("resource.data.get('recipientId', '') == request.auth.uid");
    });

    it("restricts /notifications update to read-status fields only", () => {
      expect(rulesCode).toContain("hasOnly(['read', 'isRead', 'readAt', 'updatedAt'])");
    });

    it("locks /sms_queue from all client direct read/write operations", () => {
      expect(rulesCode).toContain("match /sms_queue/{queueId}");
      expect(rulesCode).toContain("allow read, write: if isAdmin();");
    });

    it("locks /email_queue and /email_alerts_queue from all client direct read/write operations", () => {
      expect(rulesCode).toContain("match /email_queue/{queueId}");
      expect(rulesCode).toContain("match /email_alerts_queue/{queueId}");
    });
  });

  describe("2. Server-Side Notification Payload Validation & Sanitization (validateNotificationPayload)", () => {
    it("accepts valid notification payloads with proper sanitization", () => {
      const validPayload = {
        recipientId: "user_recipient_123",
        title: "New Job Quote Received",
        message: "A tradesperson has submitted a quote for your plumbing job.",
        type: "quote",
        link: "/job/job_123"
      };
      const result = validateNotificationPayload(validPayload);
      expect(result.recipientId).toBe("user_recipient_123");
      expect(result.title).toBe("New Job Quote Received");
      expect(result.message).toBe("A tradesperson has submitted a quote for your plumbing job.");
      expect(result.type).toBe("quote");
      expect(result.link).toBe("/job/job_123");
    });

    it("rejects missing or empty recipientId", () => {
      expect(() => validateNotificationPayload({
        recipientId: "   ",
        title: "Test",
        message: "Test message"
      })).toThrow(BadRequestError);

      expect(() => validateNotificationPayload({
        title: "Test",
        message: "Test message"
      })).toThrow("Recipient ID is required");
    });

    it("rejects missing or oversized title (>120 chars)", () => {
      expect(() => validateNotificationPayload({
        recipientId: "user_123",
        title: "",
        message: "Test message"
      })).toThrow("Notification title is required");

      expect(() => validateNotificationPayload({
        recipientId: "user_123",
        title: "A".repeat(121),
        message: "Test message"
      })).toThrow("Notification title exceeds maximum length of 120 characters");
    });

    it("rejects missing or oversized message (>500 chars)", () => {
      expect(() => validateNotificationPayload({
        recipientId: "user_123",
        title: "Test",
        message: ""
      })).toThrow("Notification message is required");

      expect(() => validateNotificationPayload({
        recipientId: "user_123",
        title: "Test",
        message: "B".repeat(501)
      })).toThrow("Notification message exceeds maximum length of 500 characters");
    });

    it("rejects invalid notification types", () => {
      expect(() => validateNotificationPayload({
        recipientId: "user_123",
        title: "Test",
        message: "Valid message",
        type: "malicious_exploit_type"
      })).toThrow("Invalid notification type");
    });

    it("rejects phishing URLs, external links, and open-redirect vectors in notification links", () => {
      // External absolute URL
      expect(() => validateNotificationPayload({
        recipientId: "user_123",
        title: "Test",
        message: "Valid message",
        link: "https://phishing-site.com/steal-credentials"
      })).toThrow("Notification links must be relative in-app paths starting with '/'");

      // Scheme-relative URL
      expect(() => validateNotificationPayload({
        recipientId: "user_123",
        title: "Test",
        message: "Valid message",
        link: "//phishing-site.com/login"
      })).toThrow();

      // Javascript protocol injection
      expect(() => validateNotificationPayload({
        recipientId: "user_123",
        title: "Test",
        message: "Valid message",
        link: "javascript:alert(document.cookie)"
      })).toThrow();
    });
  });

  describe("3. Server-Authoritative Endpoints & Rate-Limiting", () => {
    it("protects /api/notifications with requireAuth and AbuseDefenseEngine rate limiting", () => {
      expect(serverCode).toContain('app.post(');
      expect(serverCode).toContain('"/api/notifications"');
      expect(serverCode).toContain('requireAuth');
      expect(serverCode).toContain('AbuseDefenseEngine.createMiddleware("NOTIFICATION_SEND")');
    });

    it("protects /api/jobs/:id/distribute-leads with requireAuth and AbuseDefenseEngine rate limiting", () => {
      expect(serverCode).toContain('"/api/jobs/:id/distribute-leads"');
      expect(serverCode).toContain('requireAuth');
      expect(serverCode).toContain('AbuseDefenseEngine.createMiddleware("NOTIFICATION_SEND")');
    });

    it("verifies relationship/authorization before dispatching notification to another user", () => {
      expect(serverCode).toContain('isCallerAdmin || (recipientId === callerUid)');
      expect(serverCode).toContain('You do not have authorization to send notifications to this recipient');
    });
  });
});
