import { describe, it, expect } from "vitest";
import { runProductionChecks } from "../../src/server/productionChecks.ts";

describe("Production Invariant Checks", () => {
  it("fails production gate when mandatory secrets are missing in NODE_ENV=production", () => {
    const fakeEnv = {
      NODE_ENV: "production",
      // STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GEMINI_API_KEY missing
    };

    const report = runProductionChecks(fakeEnv as any);
    expect(report.overallStatus).toBe("NO_GO");
    const failedChecks = report.checks.filter((c) => c.status === "FAIL");
    expect(failedChecks.length).toBeGreaterThanOrEqual(1);
  });

  it("fails production gate when ALLOW_MOCK_PAYMENTS=true in production", () => {
    const fakeEnv = {
      NODE_ENV: "production",
      STRIPE_SECRET_KEY: "sk_live_verylongsecurekey123456789",
      STRIPE_WEBHOOK_SECRET: "whsec_verylongsecurekey123456789",
      GEMINI_API_KEY: "AIzaSy_verylongsecurekey123456789",
      ALLOW_MOCK_PAYMENTS: "true", // Malicious / dangerous in prod
    };

    const report = runProductionChecks(fakeEnv as any, {});
    expect(report.overallStatus).toBe("NO_GO");
    const mockPaymentCheck = report.checks.find((c) => c.name === "Mock Payment Gate");
    expect(mockPaymentCheck?.status).toBe("FAIL");
  });

  it("passes production gate when all invariants and secrets are healthy", () => {
    const healthyEnv = {
      NODE_ENV: "production",
      STRIPE_SECRET_KEY: "sk_live_verylongsecurekey123456789",
      STRIPE_WEBHOOK_SECRET: "whsec_verylongsecurekey123456789",
      GEMINI_API_KEY: "AIzaSy_verylongsecurekey123456789",
      JWT_SECRET: "very_long_secure_jwt_secret_key_123456789",
      ALLOW_MOCK_PAYMENTS: "false",
    };

    const report = runProductionChecks(healthyEnv as any, { collection: () => {} });
    expect(report.overallStatus).toBe("GO");
    const failedChecks = report.checks.filter((c) => c.status === "FAIL");
    expect(failedChecks.length).toBe(0);
  });
});
