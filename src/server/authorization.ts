/**
 * Server-Side Authorization & BOLA/IDOR Defense Layer for AnyTrader V6
 * Enforces resource ownership, role boundaries, and mass-assignment protection.
 */
import { UnauthorizedError, ForbiddenError, BadRequestError, ConflictError } from "./httpErrors.ts";
import {
  CanonicalAccountType,
  CanonicalCapability,
  CanonicalIdentity,
  resolveCanonicalIdentity,
  hasCapability,
  assertHasCapability,
  assertHasAccountType,
} from "./identity.ts";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role?: string;
  accountType?: CanonicalAccountType;
  capabilities?: CanonicalCapability[];
  isAdmin?: boolean;
  admin?: boolean;
  isEcosystemManager?: boolean;
  identity?: CanonicalIdentity;
}

/**
 * Checks whether an authenticated user holds administrative privileges via token claims
 */
export function isUserAdminClaim(user?: AuthenticatedUser | null): boolean {
  if (!user) return false;
  return user.isAdmin === true || user.admin === true;
}

/**
 * Ensures caller is authenticated
 */
export function assertIsAuthenticated(user?: AuthenticatedUser | null): asserts user is AuthenticatedUser {
  if (!user || !user.uid) {
    throw new UnauthorizedError("Authentication token is missing or invalid.");
  }
}

/**
 * Ensures caller holds administrative privileges (server-authoritative)
 */
export function assertIsAdmin(user?: AuthenticatedUser | null): asserts user is AuthenticatedUser {
  assertIsAuthenticated(user);
  if (!isUserAdminClaim(user)) {
    throw new ForbiddenError("Administrative privileges required for this action.");
  }
}

/**
 * Ensures caller has one of the required roles or is an admin
 */
export function assertUserRole(
  user: AuthenticatedUser,
  allowedRoles: string[]
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) {
    return;
  }
  const canonical = resolveUserCanonicalIdentity(user);
  if (user.role && allowedRoles.includes(user.role)) {
    return;
  }
  if (allowedRoles.includes(canonical.accountType)) {
    return;
  }
  throw new ForbiddenError(`User role '${user.role || canonical.accountType || "unknown"}' is not permitted to perform this action.`);
}

/**
 * Resolves the full canonical identity representation for an authenticated user.
 */
export function resolveUserCanonicalIdentity(user: AuthenticatedUser | Record<string, any>): CanonicalIdentity {
  return resolveCanonicalIdentity(user);
}

/**
 * Asserts that an authenticated user possesses a required capability (e.g. 'homeowner', 'tradesperson', 'fleet_driver').
 */
export function assertUserCapability(
  user: AuthenticatedUser,
  capability: CanonicalCapability
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) {
    return;
  }
  const identity = resolveUserCanonicalIdentity(user);
  assertHasCapability(identity, capability);
}

/**
 * Asserts that an authenticated user belongs to one of the permitted canonical account types.
 */
export function assertUserAccountType(
  user: AuthenticatedUser,
  allowedTypes: CanonicalAccountType[]
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) {
    return;
  }
  const identity = resolveUserCanonicalIdentity(user);
  assertHasAccountType(identity, allowedTypes);
}

/**
 * Object-Level Authorization (IDOR / BOLA Prevention):
 * Asserts that the authenticated user strictly owns the targeted resource ID.
 */
export function assertResourceOwner(
  user: AuthenticatedUser,
  resourceOwnerId: string,
  resourceType: string = "Resource"
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) {
    return; // Admins can bypass ownership checks for support operations
  }
  if (!resourceOwnerId || user.uid !== resourceOwnerId) {
    throw new ForbiddenError(`You do not have authorization to access or modify this ${resourceType}.`);
  }
}

/**
 * Job Access Governance:
 * Determines if a user has legitimate interest in reading a job (owner, quoted/assigned trader, or admin).
 */
export function assertCanAccessJob(user: AuthenticatedUser, jobData: Record<string, any>): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) {
    return;
  }
  
  const ownerId = jobData.homeownerId || jobData.userId || jobData.ownerId;
  const assignedTraderId = jobData.tradespersonId || jobData.proId || jobData.traderId;
  const isPublicOpen = jobData.status === "open" || jobData.status === "quoted";

  if (user.uid === ownerId || user.uid === assignedTraderId || isPublicOpen) {
    return;
  }
  
  throw new ForbiddenError("You do not have permission to access this job.");
}

/**
 * Job Mutation Governance:
 * Only the homeowner or admin can modify core job specs, cancel jobs, or approve quotes.
 */
export function assertCanModifyJob(user: AuthenticatedUser, jobData: Record<string, any>): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;
  const ownerId = jobData.homeownerId || jobData.userId || jobData.ownerId;
  if (user.uid !== ownerId) {
    throw new ForbiddenError("Only the job creator can modify this job or its status.");
  }
}

/**
 * Quote Submission Governance:
 * A user cannot quote their own job; only verified traders can submit quotes on open jobs.
 */
export function assertCanSubmitQuote(user: AuthenticatedUser, jobData: Record<string, any>): void {
  assertIsAuthenticated(user);
  const ownerId = jobData.homeownerId || jobData.userId || jobData.ownerId;
  if (user.uid === ownerId) {
    throw new BadRequestError("Homeowners cannot submit quotes on their own jobs.");
  }
  if (!["open", "quoted"].includes(jobData.status)) {
    throw new ForbiddenError("This job is not accepting new quotes.");
  }
}

/**
 * Milestone Action Governance:
 * Escrow operations require strict role distinction:
 * - 'fund': Only homeowner
 * - 'submit_work': Only assigned trader
 * - 'release': Only homeowner or admin
 * - 'refund': Only admin or mutual agreement
 */
export function assertCanManageMilestone(
  user: AuthenticatedUser,
  milestoneData: Record<string, any>,
  action: "fund" | "submit_work" | "release" | "dispute" | "refund",
  isQrHandshake: boolean = false
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const customerId = milestoneData.customerId || milestoneData.homeownerId || milestoneData.userId;
  const traderId = milestoneData.tradespersonId || milestoneData.proId || milestoneData.traderId || milestoneData.acceptedTradespersonId || milestoneData.acceptedTraderId;

  switch (action) {
    case "fund":
      if (user.uid !== customerId) {
        throw new ForbiddenError(`Only the paying customer can ${action} milestone funds.`);
      }
      break;
    case "release":
      if (isQrHandshake && traderId && user.uid === traderId) {
        return; // Valid QR handshake by accepted trader
      }
      if (user.uid !== customerId) {
        throw new ForbiddenError(`Only the paying customer can ${action} milestone funds.`);
      }
      break;
    case "submit_work":
      if (user.uid !== traderId) {
        throw new ForbiddenError("Only the assigned tradesperson can submit milestone deliverables.");
      }
      break;
    case "dispute":
      if (user.uid !== customerId && user.uid !== traderId) {
        throw new ForbiddenError("Only involved parties can dispute a milestone.");
      }
      break;
    case "refund":
      throw new ForbiddenError("Milestone refunds require administrator arbitration.");
  }
}

/**
 * Chat Conversation Governance:
 * Prevents eavesdropping and message injection across conversation threads.
 */
export function assertCanAccessConversation(
  user: AuthenticatedUser,
  participants: string[]
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;
  if (!participants || !participants.includes(user.uid)) {
    throw new ForbiddenError("You are not an authorized participant in this conversation.");
  }
}

/**
 * Property Passport Access & Mutation Governance (IDOR / BOLA Prevention):
 * Ensures an attacker changing propertyId=A to propertyId=B cannot view private details
 * or alter ownership / specs unless authorized.
 */
export function assertCanAccessProperty(
  user: AuthenticatedUser,
  propertyData: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const ownerId = propertyData.ownerId || propertyData.userId;
  const isPendingRecipient = propertyData.transferStatus === "pending" && propertyData.pendingTransferToUid === user.uid;
  const isAuthorizedTenant = propertyData.tenantEmail && user.email && propertyData.tenantEmail.toLowerCase() === user.email.toLowerCase();

  if (user.uid === ownerId || isPendingRecipient || isAuthorizedTenant || propertyData.isPublicPassport === true) {
    return;
  }

  throw new ForbiddenError("You do not have authorization to access this property passport.");
}

export function assertCanModifyProperty(
  user: AuthenticatedUser,
  propertyData: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const ownerId = propertyData.ownerId || propertyData.userId;
  const isPendingRecipient = propertyData.transferStatus === "pending" && propertyData.pendingTransferToUid === user.uid;

  if (user.uid === ownerId || isPendingRecipient) {
    return;
  }

  throw new ForbiddenError("Only the property owner or verified transfer recipient can modify this property.");
}

/**
 * Quote Access & Mutation Governance (IDOR / BOLA Prevention):
 * Ensures a malicious trader cannot view, modify, or delete another trader's quote.
 */
export function assertCanModifyQuote(
  user: AuthenticatedUser,
  quoteData: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const quotingTraderId = quoteData.tradespersonId || quoteData.traderId || quoteData.proId;
  if (user.uid !== quotingTraderId) {
    throw new ForbiddenError("You cannot modify another tradesperson's quote.");
  }
}

export function assertCanDeleteQuote(
  user: AuthenticatedUser,
  quoteData: Record<string, any>,
  jobData?: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const quotingTraderId = quoteData.tradespersonId || quoteData.traderId || quoteData.proId;
  const homeownerId = quoteData.homeownerId || quoteData.userId || jobData?.homeownerId || jobData?.userId;

  if (user.uid === quotingTraderId || user.uid === homeownerId) {
    return;
  }

  throw new ForbiddenError("You do not have permission to delete this quote.");
}

/**
 * Dispute & Tenant Issue Governance (IDOR / BOLA Prevention):
 * Ensures only the affected landlord, tenant, trader, or admin can access or resolve disputes.
 */
export function assertCanAccessDispute(
  user: AuthenticatedUser,
  disputeData: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const landlordId = disputeData.landlordOwnerId || disputeData.landlordId || disputeData.ownerId;
  const tenantEmail = disputeData.tenantEmail;
  const claimantId = disputeData.claimantId || disputeData.initiatorId || disputeData.userId;
  const respondentId = disputeData.respondentId || disputeData.traderId;

  const isEmailMatch = tenantEmail && user.email && tenantEmail.toLowerCase() === user.email.toLowerCase();

  if (user.uid === landlordId || user.uid === claimantId || user.uid === respondentId || isEmailMatch) {
    return;
  }

  throw new ForbiddenError("You do not have authorization to view this dispute or issue.");
}

export function assertCanModifyDispute(
  user: AuthenticatedUser,
  disputeData: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const landlordId = disputeData.landlordOwnerId || disputeData.landlordId || disputeData.ownerId;
  const claimantId = disputeData.claimantId || disputeData.initiatorId || disputeData.userId;

  if (user.uid === landlordId || user.uid === claimantId) {
    return;
  }

  throw new ForbiddenError("Only authorized dispute participants or administrators can update this dispute.");
}

/**
 * Review Submission & Modification Governance (IDOR / BOLA Prevention):
 * Ensures Customer A cannot write reviews under Customer B's identity or for unassociated jobs.
 */
export function assertCanSubmitReview(
  user: AuthenticatedUser,
  reviewData: Record<string, any>,
  jobData?: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const reviewerId = reviewData.reviewerId || reviewData.userId || reviewData.homeownerId || reviewData.customerId;
  if (!reviewerId || user.uid !== reviewerId) {
    throw new ForbiddenError("You cannot submit a review on behalf of another user.");
  }

  if (jobData) {
    const jobOwnerId = jobData.homeownerId || jobData.userId || jobData.ownerId;
    const acceptedTraderId = jobData.tradespersonId || jobData.traderId || jobData.proId;
    const isParticipant = user.uid === jobOwnerId || user.uid === acceptedTraderId;

    if (!isParticipant) {
      throw new ForbiddenError("You cannot review a job in which you were not an active participant.");
    }
  }
}

/**
 * User Private Storage & Documents Governance (IDOR / BOLA Prevention):
 * Ensures User A cannot read or modify User B's private files (KYC, passport, driver license, bank proofs).
 */
export function assertCanAccessUserStorage(
  user: AuthenticatedUser,
  targetUserId: string,
  accessType: "read" | "write" = "read",
  isPublicFolder: boolean = false
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  if (isPublicFolder && accessType === "read") {
    return;
  }

  if (!targetUserId || user.uid !== targetUserId) {
    throw new ForbiddenError(`You do not have authorization to ${accessType} private files belonging to another user.`);
  }
}

/**
 * Mass-Assignment & Property-Level Privilege Escalation Defense:
 * Strips client-supplied payloads of server-owned, financial, role, status, or identity keys.
 * OWASP API Protection: Protects against injection of hidden fields that aren't security boundaries.
 */
export const SERVER_OWNED_PROTECTED_KEYS = new Set([
  // Canonical Identity & Capability (Server-Derived Only)
  "accountType",
  "capabilities",
  "capabilitiesList",
  "activeContext",
  "customClaims",
  "accountFlags",

  // Role & Admin privilege escalation
  "isAdmin",
  "role",
  "permissions",
  "tierId",
  "tier",
  "isPro",
  "isProInvoiceSubscriber",
  "subscriptionStatus",
  "subscriptionId",
  "gothamSubscription",
  
  // Paid Add-ons & Subscriptions (Server / Stripe-Authoritative Only)
  "hasVerifiedVideoProSubscription",
  "videoProSubscribedAt",
  "videoProSubscriptionId",
  "hasExclusiveAddon",
  "isExclusiveActive",
  "exclusiveSubscribedAt",
  "exclusiveSubscriptionId",
  "adWalletBalance",
  "adSpendTotal",

  // Verification flags
  "verified",
  "isVerified",
  "idVerified",
  "verifiedTrader",
  "videoVerified",
  "isVerifiedVideo",
  "videoVerificationUrl",
  "verifiedBadges",
  "verifiedAt",
  "trustScore",
  "rating",
  "totalReviews",

  // Identity & Ownership fields (cannot be injected by client)
  "ownerId",
  "homeownerId",
  "userId",
  "posterId",
  "customerId",
  "landlordId",
  "tenantId",
  "pendingTransferToUid",
  "transferClaimedByUid",

  // Financial & Payment status
  "amount",
  "price",
  "platformFee",
  "fee",
  "pendingPlatformFees",
  "payoutTransferred",
  "fundingPaymentId",
  "paymentStatus",
  "payoutStatus",
  "escrowStatus",
  "balance",
  "credits",
  "stripeCustomerId",
  "stripeAccountId",
  "guaranteeExpiresAt",

  // State & Outcome fields (state-machine governed)
  "completed",
  "isCompleted",
  "funded",
  "isFunded",
  "refunded",
  "isRefunded",
  "status",
  "disputeStatus",

  // Temporal stamps
  "createdAt",
  "updatedAt",
]);

export function sanitizeClientPayload<T extends Record<string, any>>(
  payload: T,
  additionalProtectedKeys?: string[]
): Partial<T> {
  const sanitized: Record<string, any> = {};
  const protectedSet = additionalProtectedKeys
    ? new Set([...SERVER_OWNED_PROTECTED_KEYS, ...additionalProtectedKeys])
    : SERVER_OWNED_PROTECTED_KEYS;

  for (const [key, value] of Object.entries(payload)) {
    if (!protectedSet.has(key)) {
      sanitized[key] = value;
    } else {
      console.warn(`[Security Alert] Suppressed server-owned key '${key}' from client payload.`);
    }
  }

  return sanitized as Partial<T>;
}

/**
 * Trader Availability & Calendar Governance:
 * Ensures Trader A cannot modify Trader B's calendar, working hours, or live emergency availability.
 */
export function assertCanManageTraderAvailability(
  user: AuthenticatedUser,
  targetTraderId: string
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  if (!targetTraderId || user.uid !== targetTraderId) {
    throw new ForbiddenError("You cannot modify another tradesperson's availability or calendar.");
  }
}

/**
 * Job Acceptance & Assignment Governance:
 * Ensures Trader A cannot self-accept or self-assign a customer's job without the homeowner's explicit quote approval.
 */
export function assertCanAcceptJob(
  user: AuthenticatedUser,
  jobData: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const homeownerId = jobData.homeownerId || jobData.userId || jobData.ownerId;
  if (user.uid !== homeownerId) {
    throw new ForbiddenError("Only the homeowner or platform administrator can accept a quote or award a job.");
  }
}

/**
 * Estate & Portfolio SaaS Governance (B2B Gotham Layer IDOR / BOLA Defense):
 * Ensures Landlord/Estate Manager A cannot view, add units, modify specs, or access
 * MTD invoicing for Estate B.
 */
export function assertCanManageEstate(
  user: AuthenticatedUser,
  estateData: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const managerId = estateData.managerId || estateData.landlordId || estateData.ownerId || estateData.userId;
  if (!managerId || user.uid !== managerId) {
    throw new ForbiddenError("You do not have authorization to manage or view this housing estate portfolio.");
  }
}

/**
 * AnyRoller Taxi Ride Access & Mutation Governance (IDOR / BOLA Prevention):
 * Ensures Passenger A cannot cancel or modify Passenger B's ride, and Driver A cannot
 * hijack a trip assigned to Driver B.
 */
export function assertCanManageRide(
  user: AuthenticatedUser,
  rideData: Record<string, any>,
  action: "view" | "cancel" | "accept" | "update_status"
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const passengerId = rideData.passengerId || rideData.userId || rideData.customerId;
  const driverId = rideData.driverId || rideData.assignedDriverId;

  switch (action) {
    case "view":
      if (user.uid !== passengerId && user.uid !== driverId && rideData.status !== "searching") {
        throw new ForbiddenError("You do not have authorization to view this taxi trip.");
      }
      break;
    case "cancel":
      if (user.uid !== passengerId && user.uid !== driverId) {
        throw new ForbiddenError("Only the passenger or assigned driver can cancel this trip.");
      }
      if (rideData.status === "completed") {
        throw new BadRequestError("Cannot cancel an already completed taxi trip.");
      }
      break;
    case "accept":
      if (rideData.status !== "searching" && rideData.status !== "open") {
        throw new ConflictError("This taxi trip has already been assigned or is no longer available.");
      }
      if (user.uid === passengerId) {
        throw new BadRequestError("Passengers cannot accept their own ride requests as a driver.");
      }
      break;
    case "update_status":
      if (user.uid !== driverId) {
        throw new ForbiddenError("Only the assigned driver can update real-time trip status.");
      }
      break;
  }
}

/**
 * Direct 1-to-1 Quote Request Governance:
 * Ensures that if a homeowner requested a direct quote from Trader A, an unrelated Trader B
 * cannot intercept or submit quotes to that private request.
 */
export function assertCanSubmitDirectQuote(
  user: AuthenticatedUser,
  jobData: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const directTargetId = jobData.targetTraderId || jobData.directTraderId || jobData.requestedTraderId;
  if (directTargetId && directTargetId !== user.uid) {
    throw new ForbiddenError("This is a direct 1-to-1 quote request intended for a specific tradesperson.");
  }
}

/**
 * Tenant Repair Report Governance:
 * Ensures only the submitting tenant, property landlord, or administrator can view or modify
 * repair logs and tenant contact PII.
 */
export function assertCanAccessTenantReport(
  user: AuthenticatedUser,
  reportData: Record<string, any>
): void {
  assertIsAuthenticated(user);
  if (isUserAdminClaim(user)) return;

  const tenantId = reportData.tenantId || reportData.userId;
  const tenantEmail = reportData.tenantEmail;
  const landlordId = reportData.landlordId || reportData.ownerId;

  const isEmailMatch = tenantEmail && user.email && tenantEmail.toLowerCase() === user.email.toLowerCase();

  if (user.uid === tenantId || user.uid === landlordId || isEmailMatch) {
    return;
  }

  throw new ForbiddenError("You do not have authorization to access this tenant repair report.");
}

/**
 * Notification Governance & Abuse Prevention (H3 Hardened):
 * Prevents phishing, spamming, and unauthorized notification dispatch.
 * 1. Admins can notify anyone.
 * 2. Users can notify themselves (e.g. AI optimizer, digests, internal telemetry).
 * 3. Users can notify another user ONLY if they share a legitimate transactional context (job, conversation, project, or quote).
 */
export function validateNotificationPayload(payload: Record<string, any>): {
  recipientId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  jobId?: string;
  conversationId?: string;
  projectId?: string;
  rideId?: string;
} {
  if (!payload || typeof payload !== "object") {
    throw new BadRequestError("Notification payload must be an object.");
  }

  const recipientId = payload.recipientId || payload.userId;
  if (!recipientId || typeof recipientId !== "string" || recipientId.trim().length === 0) {
    throw new BadRequestError("Recipient ID is required.");
  }

  const title = payload.title;
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw new BadRequestError("Notification title is required.");
  }
  if (title.length > 120) {
    throw new BadRequestError("Notification title exceeds maximum length of 120 characters.");
  }

  const message = payload.message || payload.body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    throw new BadRequestError("Notification message is required.");
  }
  if (message.length > 500) {
    throw new BadRequestError("Notification message exceeds maximum length of 500 characters.");
  }

  const allowedTypes = [
    "quote",
    "message",
    "status",
    "system",
    "job_lead",
    "promotion",
    "profile_optimization",
    "general",
    "emergency_alert"
  ];
  const type = payload.type || "general";
  if (!allowedTypes.includes(type)) {
    throw new BadRequestError(`Invalid notification type '${type}'.`);
  }

  let link = payload.link || payload.actionPath;
  if (link) {
    if (typeof link !== "string" || link.length > 200) {
      throw new BadRequestError("Invalid notification link.");
    }
    // Prevent open redirect phishing by requiring relative app links only
    if (!link.startsWith("/")) {
      throw new BadRequestError("Notification links must be relative in-app paths starting with '/'.");
    }
    // Block protocol injection attempts
    if (link.startsWith("//") || link.includes("://") || link.toLowerCase().includes("javascript:") || link.toLowerCase().includes("data:")) {
      throw new BadRequestError("Notification links cannot contain external URLs or script protocols.");
    }
  }

  return {
    recipientId: recipientId.trim(),
    title: title.trim(),
    message: message.trim(),
    type,
    link: link ? link.trim() : undefined,
    jobId: typeof payload.jobId === "string" ? payload.jobId.trim() : undefined,
    conversationId: typeof payload.conversationId === "string" ? payload.conversationId.trim() : undefined,
    projectId: typeof payload.projectId === "string" ? payload.projectId.trim() : undefined,
    rideId: typeof payload.rideId === "string" ? payload.rideId.trim() : undefined,
  };
}

/**
 * Server-Authoritative Notification Authorization Helper (H3A Hardened):
 * Evaluates whether an authenticated user is authorized to dispatch a notification to a recipient.
 * 
 * Strict Invariants:
 * 1. Admin callers can notify any recipient.
 * 2. Authenticated users can notify themselves (recipientId === callerUid).
 * 3. Cross-user notifications REQUIRE an authoritative, verifiable database relationship
 *    (Job, Conversation, Project, or Ride/Trip).
 * 4. Merely existing as a user in Firestore NEVER constitutes authorization.
 * 5. Recipient substitution attacks are blocked by verifying that the recipient is an authorized participant
 *    on the targeted resource.
 */
export async function authorizeNotificationRequest(
  db: any,
  callerUid: string,
  callerUser: AuthenticatedUser | null,
  payload: {
    recipientId: string;
    type: string;
    link?: string;
    jobId?: string;
    conversationId?: string;
    projectId?: string;
    rideId?: string;
  }
): Promise<boolean> {
  if (!db || !callerUid || !payload || !payload.recipientId) {
    return false;
  }

  const { recipientId, link } = payload;

  // Rule 1: Admin callers can notify any recipient
  if (isUserAdminClaim(callerUser)) {
    return true;
  }

  // Rule 2: Users can notify themselves
  if (recipientId === callerUid) {
    return true;
  }

  // Infer context IDs from link if not explicitly provided
  let jobId = payload.jobId;
  let conversationId = payload.conversationId;
  let projectId = payload.projectId;
  let rideId = payload.rideId;

  if (link) {
    if (!jobId) {
      const jobMatch = link.match(/\/(?:jobs?|job)\/([a-zA-Z0-9_-]+)/);
      if (jobMatch) jobId = jobMatch[1];
    }
    if (!conversationId) {
      const convMatch = link.match(/\/(?:chat|conversations?)\/([a-zA-Z0-9_-]+)/);
      if (convMatch) conversationId = convMatch[1];
    }
    if (!projectId) {
      const projMatch = link.match(/\/(?:projects?|project)\/([a-zA-Z0-9_-]+)/);
      if (projMatch) projectId = projMatch[1];
    }
    if (!rideId) {
      const rideMatch = link.match(/\/(?:rides?|ride|trips?|trip)\/([a-zA-Z0-9_-]+)/);
      if (rideMatch) rideId = rideMatch[1];
    }
  }

  // Rule 3A: Authoritative Job Relationship Check
  if (jobId) {
    try {
      const jobDoc = await db.collection("jobs").doc(jobId).get();
      if (!jobDoc.exists) {
        return false; // Fail closed if job does not exist
      }
      const job = jobDoc.data() || {};
      const ownerId = job.homeownerId || job.userId || job.ownerId || job.customerId;
      const assignedTraderId = job.acceptedTradespersonId || job.tradespersonId || job.assignedTraderId;
      const targetTraderId = job.targetTradespersonId || job.targetTraderId || job.directTraderId || job.requestedTraderId;
      const invitedTraderIds = Array.isArray(job.invitedTraderIds) ? job.invitedTraderIds : [];
      const jobStatus = job.status || "open";

      // If caller is the Homeowner/Job Creator:
      if (callerUid === ownerId) {
        // Recipient must be assigned trader, direct target, or invited trader
        if (
          recipientId === assignedTraderId ||
          recipientId === targetTraderId ||
          invitedTraderIds.includes(recipientId)
        ) {
          return true;
        }
        // Or recipient submitted a quote on this job
        const quotesSnap = await db
          .collection("jobs")
          .doc(jobId)
          .collection("quotes")
          .where("tradespersonId", "==", recipientId)
          .limit(1)
          .get();
        if (!quotesSnap.empty) {
          return true;
        }
        // Otherwise, homeowner attempting to notify an unrelated recipient on this job -> DENIED
        return false;
      }

      // If recipient is the Homeowner/Job Creator:
      if (recipientId === ownerId) {
        // Caller must be assigned trader, direct target, or invited trader
        if (
          callerUid === assignedTraderId ||
          callerUid === targetTraderId ||
          invitedTraderIds.includes(callerUid)
        ) {
          return true;
        }
        // Or caller submitted a quote on this job
        const myQuotesSnap = await db
          .collection("jobs")
          .doc(jobId)
          .collection("quotes")
          .where("tradespersonId", "==", callerUid)
          .limit(1)
          .get();
        if (!myQuotesSnap.empty) {
          return true;
        }
        // Or job is open/quoted/pending and caller is reaching out to job owner
        if (jobStatus === "open" || jobStatus === "quoted" || jobStatus === "pending") {
          return true;
        }
        return false;
      }

      // If caller and recipient are both participants on assigned job
      if (
        (callerUid === assignedTraderId || callerUid === ownerId) &&
        (recipientId === assignedTraderId || recipientId === ownerId)
      ) {
        return true;
      }

      return false;
    } catch (err) {
      console.warn("[Notification Auth] Error evaluating job relationship:", err);
      return false;
    }
  }

  // Rule 3B: Authoritative Conversation Relationship Check
  if (conversationId) {
    try {
      const convDoc = await db.collection("conversations").doc(conversationId).get();
      if (!convDoc.exists) {
        return false;
      }
      const convData = convDoc.data() || {};
      const participants = Array.isArray(convData.participants) ? convData.participants : [];
      if (participants.includes(callerUid) && participants.includes(recipientId)) {
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[Notification Auth] Error evaluating conversation relationship:", err);
      return false;
    }
  }

  // Rule 3C: Authoritative Project Relationship Check
  if (projectId) {
    try {
      const projDoc = await db.collection("projects").doc(projectId).get();
      if (!projDoc.exists) {
        return false;
      }
      const projData = projDoc.data() || {};
      const managerId = projData.managerId || projData.landlordId || projData.ownerId || projData.userId;
      const participants = Array.isArray(projData.participants)
        ? projData.participants
        : Array.isArray(projData.contractors)
        ? projData.contractors
        : [];

      if (
        (callerUid === managerId || participants.includes(callerUid)) &&
        (recipientId === managerId || participants.includes(recipientId))
      ) {
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[Notification Auth] Error evaluating project relationship:", err);
      return false;
    }
  }

  // Rule 3D: Authoritative Ride / Taxi Request Relationship Check
  if (rideId) {
    try {
      let rideDoc = await db.collection("ride_requests").doc(rideId).get();
      if (!rideDoc.exists) {
        rideDoc = await db.collection("rides").doc(rideId).get();
      }
      if (!rideDoc.exists) {
        return false;
      }
      const rideData = rideDoc.data() || {};
      const passengerId = rideData.passengerId || rideData.userId || rideData.riderId || rideData.customerId;
      const driverId = rideData.assignedDriverId || rideData.driverId;

      if (
        (callerUid === passengerId && recipientId === driverId) ||
        (callerUid === driverId && recipientId === passengerId)
      ) {
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[Notification Auth] Error evaluating ride relationship:", err);
      return false;
    }
  }

  // No legitimate relationship found -> Fail closed
  return false;
}


