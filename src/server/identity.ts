/**
 * Canonical Identity & Capability Model for AnyTrader (Task 1)
 *
 * Establishes formal separation between:
 * 1. accountType: Fundamental account classification ('consumer' | 'service_provider' | 'business' | 'driver' | 'admin')
 * 2. capabilities: Authorized operational capabilities (['homeowner', 'landlord', 'tradesperson', etc.])
 * 3. verification: Separate credential/verification lifecycle ('unverified' | 'pending' | 'verified' | 'rejected' | 'expired' | 'revoked')
 * 4. subscription: Commercial tier and entitlements ('PAYG' | 'Silver Professional' | 'Gold Elite' | 'Platinum Enterprise')
 * 5. activeContext: Presentation/UI state ('anytrader' vs 'anyroller' portal, active UI persona)
 *
 * CRITICAL SECURITY INVARIANT:
 * Presentation state (PortalContext, localStorage, UI persona switches) NEVER determines
 * or elevates server authorization. All capabilities and account types resolve authoritatively.
 */

import { UnauthorizedError, ForbiddenError } from "./httpErrors.ts";

export type CanonicalAccountType = 
  | "consumer" 
  | "service_provider" 
  | "business" 
  | "driver" 
  | "admin";

export type CanonicalCapability =
  | "homeowner"
  | "landlord"
  | "estate_agent"
  | "property_manager"
  | "tradesperson"
  | "contractor"
  | "consultant"
  | "fleet_driver";

export type CanonicalVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "expired"
  | "revoked";

export interface CanonicalVerificationInfo {
  status: CanonicalVerificationStatus;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  credentials?: any[];
}

export interface CanonicalSubscriptionInfo {
  tierId: string;
  status: string;
  isFoundingMember?: boolean;
  validUntil?: string | null;
}

export interface CanonicalActiveContext {
  portal: "anytrader" | "anyroller";
  role: string;
}

export interface CanonicalIdentity {
  uid: string;
  email?: string;
  accountType: CanonicalAccountType;
  capabilities: CanonicalCapability[];
  verification: CanonicalVerificationInfo;
  subscription: CanonicalSubscriptionInfo;
  activeContext?: CanonicalActiveContext;
}

/**
 * Maps legacy role string or attributes to canonical AccountType.
 * Preserves 100% backward compatibility with all historical AnyTrader roles.
 */
export function resolveAccountType(
  rawRole?: string | null,
  isAdmin?: boolean
): CanonicalAccountType {
  if (isAdmin === true) {
    return "admin";
  }

  const role = (rawRole || "").trim().toLowerCase();

  switch (role) {
    case "tradesperson":
    case "trader":
    case "pro":
    case "service_provider":
      return "service_provider";

    case "driver":
    case "fleet_driver":
    case "taxi_driver":
      return "driver";

    case "business":
    case "enterprise":
    case "corporate":
    case "contractor_org":
      return "business";

    case "admin":
    case "ecosystem_manager":
      // Untrusted role strings without verified server custom claims default to consumer
      return "consumer";

    case "customer":
    case "homeowner":
    case "consumer":
    case "landlord":
    case "tenant":
    case "passenger":
    case "rider":
    default:
      return "consumer";
  }
}

/**
 * Resolves authorized capabilities based on account type, legacy role, business layer, and explicit grants.
 */
export function resolveCapabilities(params: {
  role?: string | null;
  businessLayer?: string | null;
  explicitCapabilities?: string[] | null;
  accountType?: CanonicalAccountType;
  isAdmin?: boolean;
}): CanonicalCapability[] {
  const capabilities = new Set<CanonicalCapability>();

  const accountType = params.accountType || resolveAccountType(params.role, params.isAdmin);

  // 1. Process explicit capability array if present
  if (Array.isArray(params.explicitCapabilities)) {
    for (const cap of params.explicitCapabilities) {
      if (isValidCapability(cap)) {
        capabilities.add(cap);
      }
    }
  }

  // 2. Derive base capabilities from accountType and legacy role mapping
  switch (accountType) {
    case "admin":
      // Admins possess operational monitoring across all standard capabilities
      capabilities.add("homeowner");
      capabilities.add("landlord");
      capabilities.add("estate_agent");
      capabilities.add("property_manager");
      capabilities.add("tradesperson");
      capabilities.add("contractor");
      capabilities.add("consultant");
      capabilities.add("fleet_driver");
      break;

    case "service_provider":
      capabilities.add("tradesperson");
      break;

    case "driver":
      capabilities.add("fleet_driver");
      break;

    case "business":
      // Business users possess organizational contractor/tradesperson capabilities
      capabilities.add("contractor");
      capabilities.add("tradesperson");

      if (params.businessLayer === "properties" || params.role === "landlord" || params.role === "estate_agent" || params.role === "property_manager") {
        capabilities.add("landlord");
        capabilities.add("property_manager");
        capabilities.add("estate_agent");
      } else if (params.businessLayer === "consultancy") {
        capabilities.add("consultant");
      }
      break;

    case "consumer":
    default:
      capabilities.add("homeowner");
      // If legacy profile had landlord context
      if (params.role === "landlord") {
        capabilities.add("landlord");
      }
      break;
  }

  return Array.from(capabilities);
}

/**
 * Type guard for CanonicalCapability
 */
export function isValidCapability(val: any): val is CanonicalCapability {
  return [
    "homeowner",
    "landlord",
    "estate_agent",
    "property_manager",
    "tradesperson",
    "contractor",
    "consultant",
    "fleet_driver",
  ].includes(val);
}

/**
 * Type guard for CanonicalAccountType
 */
export function isValidAccountType(val: any): val is CanonicalAccountType {
  return ["consumer", "service_provider", "business", "driver", "admin"].includes(val);
}

/**
 * Maps raw verification doc status or flags to canonical verification status
 */
export function resolveVerificationStatus(data?: Record<string, any> | null): CanonicalVerificationStatus {
  if (!data) return "unverified";

  if (data.isVerified === true || data.verified === true || data.verifiedTrader === true || data.verificationStatus === "verified") {
    return "verified";
  }

  if (data.verificationStatus === "pending" || (Array.isArray(data.verificationDocs) && data.verificationDocs.length > 0)) {
    return "pending";
  }

  if (data.verificationStatus === "rejected") {
    return "rejected";
  }

  if (data.verificationStatus === "expired") {
    return "expired";
  }

  if (data.verificationStatus === "revoked") {
    return "revoked";
  }

  return "unverified";
}

/**
 * Resolves a complete, authoritative CanonicalIdentity from a user profile or auth record.
 * Handles missing fields seamlessly for backward compatibility.
 */
export function resolveCanonicalIdentity(
  source?: Record<string, any> | null
): CanonicalIdentity {
  if (!source) {
    throw new UnauthorizedError("Cannot resolve identity for null or undefined user source.");
  }

  const uid = source.uid || source.id || source.userId;
  if (!uid || typeof uid !== "string") {
    throw new UnauthorizedError("Invalid user identity: missing required user ID.");
  }

  const isAdmin = source.isAdmin === true || source.admin === true;
  const accountType = resolveAccountType(source.role || source.accountType, isAdmin);

  const capabilities = resolveCapabilities({
    role: source.role,
    businessLayer: source.businessLayer,
    explicitCapabilities: source.capabilities,
    accountType,
    isAdmin,
  });

  const verificationStatus = resolveVerificationStatus(source);

  const verification: CanonicalVerificationInfo = {
    status: verificationStatus,
    verifiedAt: source.verifiedAt || null,
    expiresAt: source.verificationExpiresAt || null,
    credentials: Array.isArray(source.verificationDocs) ? source.verificationDocs : [],
  };

  const subscription: CanonicalSubscriptionInfo = {
    tierId: source.tierId || source.tier || source.subscriptionType || "PAYG",
    status: source.subscriptionStatus || "active",
    isFoundingMember: Boolean(source.isFoundingMember),
    validUntil: source.subscriptionExpiresAt || null,
  };

  const activeContext: CanonicalActiveContext | undefined = source.activeContext
    ? {
        portal: source.activeContext.portal === "anyroller" ? "anyroller" : "anytrader",
        role: String(source.activeContext.role || "customer"),
      }
    : undefined;

  return {
    uid,
    email: source.email || undefined,
    accountType,
    capabilities,
    verification,
    subscription,
    activeContext,
  };
}

/**
 * Checks whether an identity possesses a specific capability.
 */
export function hasCapability(
  identityOrUser: CanonicalIdentity | Record<string, any> | null | undefined,
  capability: CanonicalCapability
): boolean {
  if (!identityOrUser) return false;

  const identity = "capabilities" in identityOrUser && Array.isArray(identityOrUser.capabilities) && "accountType" in identityOrUser
    ? (identityOrUser as CanonicalIdentity)
    : resolveCanonicalIdentity(identityOrUser);

  if (identity.accountType === "admin") {
    return true;
  }

  return identity.capabilities.includes(capability);
}

/**
 * Asserts that a user identity possesses a required capability. Throws ForbiddenError otherwise.
 */
export function assertHasCapability(
  identityOrUser: CanonicalIdentity | Record<string, any> | null | undefined,
  capability: CanonicalCapability
): void {
  if (!identityOrUser) {
    throw new UnauthorizedError("Authentication required.");
  }

  if (!hasCapability(identityOrUser, capability)) {
    throw new ForbiddenError(`Operation requires '${capability}' capability.`);
  }
}

/**
 * Asserts that a user identity belongs to one of the allowed AccountTypes.
 */
export function assertHasAccountType(
  identityOrUser: CanonicalIdentity | Record<string, any> | null | undefined,
  allowedTypes: CanonicalAccountType[]
): void {
  if (!identityOrUser) {
    throw new UnauthorizedError("Authentication required.");
  }

  const identity = "accountType" in identityOrUser && "capabilities" in identityOrUser
    ? (identityOrUser as CanonicalIdentity)
    : resolveCanonicalIdentity(identityOrUser);

  if (identity.accountType === "admin") {
    return;
  }

  if (!allowedTypes.includes(identity.accountType)) {
    throw new ForbiddenError(
      `Account type '${identity.accountType}' is not authorized. Required: ${allowedTypes.join(", ")}`
    );
  }
}
