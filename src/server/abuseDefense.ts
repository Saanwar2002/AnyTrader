/**
 * Abuse & Automation Defense Layer for AnyTrader V6
 * Mitigates OWASP API Risks: Unrestricted Resource Consumption & Sensitive Business-Flow Abuse.
 * Enforces per-user and per-IP rate limits and anomaly throttles on:
 * 1. Job Creation
 * 2. Messaging / Chat
 * 3. Search Queries & Scraping
 * 4. AI Copilot Calls
 * 5. Notifications
 * 6. Account Creation
 * 7. Payment Attempts / Card Testing
 * 8. File Uploads
 */
import type { Request, Response, NextFunction } from "express";
import { TooManyRequestsError, BadRequestError } from "./httpErrors.ts";

export type SensitiveFlowType =
  | "JOB_CREATION"
  | "MESSAGE_SEND"
  | "SEARCH_QUERY"
  | "AI_INFERENCE"
  | "NOTIFICATION_SEND"
  | "ACCOUNT_CREATION"
  | "PAYMENT_ATTEMPT"
  | "FILE_UPLOAD";

export interface FlowPolicy {
  windowMs: number;
  maxRequests: number;
  description: string;
}

export const SENSITIVE_FLOW_POLICIES: Record<SensitiveFlowType, FlowPolicy> = {
  JOB_CREATION: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    description: "Job posting limit reached. Please wait before creating more jobs.",
  },
  MESSAGE_SEND: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    description: "Chat messaging flood limit reached. Please wait before sending more messages.",
  },
  SEARCH_QUERY: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    description: "Search velocity threshold reached. Automated scraping is restricted.",
  },
  AI_INFERENCE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    description: "AI Copilot query limit reached. Please slow down your requests.",
  },
  NOTIFICATION_SEND: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 15,
    description: "Notification dispatch limit reached. Batch notifications to prevent spam.",
  },
  ACCOUNT_CREATION: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    description: "Too many accounts created from this network. Please try again later.",
  },
  PAYMENT_ATTEMPT: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 5,
    description: "Too many consecutive payment attempts. Transaction processing is temporarily paused for security.",
  },
  FILE_UPLOAD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    description: "Upload limit exceeded. Please wait before uploading additional media.",
  },
};

export class AbuseDefenseEngine {
  // Key: `${flowType}:${identifier}` -> Array of request epoch timestamps
  private static requestLog = new Map<string, number[]>();

  /**
   * Evaluates if an action is permitted under the sliding-window policy.
   * If allowed, records the request timestamp.
   * If violated, throws TooManyRequestsError.
   */
  static checkAndConsumeQuota(
    flowType: SensitiveFlowType,
    identifier: string
  ): { allowed: boolean; remaining: number; resetInSeconds: number } {
    if (!identifier || identifier.trim() === "") {
      throw new BadRequestError("Missing identity or IP for rate-limit evaluation.");
    }

    const policy = SENSITIVE_FLOW_POLICIES[flowType];
    if (!policy) {
      throw new BadRequestError(`Unknown sensitive flow policy '${flowType}'.`);
    }

    const now = Date.now();
    const windowStart = now - policy.windowMs;
    const bucketKey = `${flowType}:${identifier.trim()}`;

    // Retrieve previous timestamps and prune expired entries
    const timestamps = (this.requestLog.get(bucketKey) || []).filter(t => t > windowStart);

    if (timestamps.length >= policy.maxRequests) {
      const oldestTimestamp = timestamps[0];
      const resetInSeconds = Math.max(1, Math.ceil((oldestTimestamp + policy.windowMs - now) / 1000));

      throw new TooManyRequestsError(
        `${policy.description} (Retry in ${resetInSeconds}s)`
      );
    }

    // Record this request
    timestamps.push(now);
    this.requestLog.set(bucketKey, timestamps);

    const remaining = policy.maxRequests - timestamps.length;
    const resetInSeconds = Math.ceil(policy.windowMs / 1000);

    return {
      allowed: true,
      remaining,
      resetInSeconds,
    };
  }

  /**
   * Express middleware generator to protect sensitive HTTP routes against automation abuse.
   */
  static createMiddleware(flowType: SensitiveFlowType) {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Determine best identifier: authenticated user ID, or client IP
      const authUser = (req as any).user;
      const identifier = authUser?.uid || req.ip || req.socket.remoteAddress || "unknown_client";

      try {
        const quota = AbuseDefenseEngine.checkAndConsumeQuota(flowType, identifier);
        res.setHeader("X-RateLimit-Limit", SENSITIVE_FLOW_POLICIES[flowType].maxRequests);
        res.setHeader("X-RateLimit-Remaining", quota.remaining);
        res.setHeader("X-RateLimit-Reset", quota.resetInSeconds);
        next();
      } catch (err) {
        if (err instanceof TooManyRequestsError) {
          res.setHeader("Retry-After", 60);
          res.status(429).json({
            success: false,
            error: err.message,
            code: "RATE_LIMIT_EXCEEDED",
          });
          return;
        }
        next(err);
      }
    };
  }

  /**
   * Reset request logs (for testing only)
   */
  static _resetLogsForTesting(): void {
    this.requestLog.clear();
  }
}
