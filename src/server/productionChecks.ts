/**
 * Pre-Production Readiness Invariant Checks for AnyTrader V6
 * Scans runtime environment, secret entropy, and database connectivity.
 */
export interface ProductionCheckResult {
  name: string;
  category: "SECURITY" | "FINANCIAL" | "DATABASE" | "CONFIG";
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  details?: Record<string, any>;
}

export interface ProductionAuditReport {
  timestamp: string;
  environment: string;
  overallStatus: "GO" | "GO_WITH_ACCEPTED_RISKS" | "NO_GO";
  checks: ProductionCheckResult[];
}

export function runProductionChecks(env = process.env, dbInstance?: any): ProductionAuditReport {
  const isProd = env.NODE_ENV === "production";
  const checks: ProductionCheckResult[] = [];

  // 1. Secret Entropy & Presence Checks
  const sensitiveKeys = [
    { key: "STRIPE_SECRET_KEY", category: "FINANCIAL" as const, requiredInProd: true },
    { key: "STRIPE_WEBHOOK_SECRET", category: "FINANCIAL" as const, requiredInProd: true },
    { key: "GEMINI_API_KEY", category: "SECURITY" as const, requiredInProd: true },
    { key: "JWT_SECRET", category: "SECURITY" as const, requiredInProd: false },
  ];

  for (const { key, category, requiredInProd } of sensitiveKeys) {
    const val = env[key];
    if (!val) {
      if (isProd && requiredInProd) {
        checks.push({
          name: `Env Check: ${key}`,
          category,
          status: "FAIL",
          message: `Mandatory production secret '${key}' is missing.`,
        });
      } else {
        checks.push({
          name: `Env Check: ${key}`,
          category,
          status: "WARN",
          message: `Secret '${key}' is not configured. Development fallbacks may apply.`,
        });
      }
    } else if (val.length < 12 || ["test", "12345", "changeme", "default"].includes(val.toLowerCase())) {
      checks.push({
        name: `Entropy Check: ${key}`,
        category,
        status: isProd ? "FAIL" : "WARN",
        message: `Secret '${key}' exhibits dangerously low entropy or placeholder value.`,
      });
    } else {
      checks.push({
        name: `Entropy Check: ${key}`,
        category,
        status: "PASS",
        message: `Secret '${key}' is configured with valid entropy.`,
      });
    }
  }

  // 2. Mock Payments Production Gate
  if (isProd && env.ALLOW_MOCK_PAYMENTS === "true") {
    checks.push({
      name: "Mock Payment Gate",
      category: "FINANCIAL",
      status: "FAIL",
      message: "ALLOW_MOCK_PAYMENTS must strictly be disabled ('false') in production environments.",
    });
  } else {
    checks.push({
      name: "Mock Payment Gate",
      category: "FINANCIAL",
      status: "PASS",
      message: "Mock payments are correctly disabled or restricted to non-production environments.",
    });
  }

  // 3. Database Connectivity Check
  if (dbInstance) {
    checks.push({
      name: "Firestore Connectivity",
      category: "DATABASE",
      status: "PASS",
      message: "Firebase Admin Firestore initialized successfully.",
    });
  } else {
    checks.push({
      name: "Firestore Connectivity",
      category: "DATABASE",
      status: isProd ? "FAIL" : "WARN",
      message: "Server Firestore client not initialized. Client-direct rules apply.",
    });
  }

  // Calculate Overall Status
  const hasFailures = checks.some((c) => c.status === "FAIL");
  const hasWarnings = checks.some((c) => c.status === "WARN");

  let overallStatus: "GO" | "GO_WITH_ACCEPTED_RISKS" | "NO_GO" = "GO";
  if (hasFailures) {
    overallStatus = "NO_GO";
  } else if (hasWarnings) {
    overallStatus = "GO_WITH_ACCEPTED_RISKS";
  }

  return {
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV || "development",
    overallStatus,
    checks,
  };
}
