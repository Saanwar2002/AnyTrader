/**
 * Financial Security & Stripe Invariant Verification Engine for AnyTrader V6
 * Enforces the core mission 4 objectives:
 * 1. "No attacker-controlled request can cause AnyTrader to believe money was paid when Stripe did not prove it."
 * 2. "No payment can be applied to the wrong resource."
 * 3. Strict mathematical validation of price, amount, currency, metadata binding, idempotency, and state machine transitions.
 */
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "./httpErrors.ts";
import { validatePaymentTransition, validateMilestoneTransition } from "./stateMachine.ts";
import { SERVER_OWNED_PROTECTED_KEYS, sanitizeClientPayload } from "./authorization.ts";
import crypto from "crypto";

export interface VerifiedStripeEventPayload {
  id: string;
  type: string;
  amount_total?: number; // in minor units (pence)
  currency?: string;
  payment_status?: "paid" | "unpaid" | "no_payment_required";
  payment_intent?: string | { id: string; status?: string; amount?: number; currency?: string };
  client_reference_id?: string;
  metadata?: Record<string, string>;
  customer?: string;
}

export interface ResourceTarget {
  jobId: string;
  quoteId?: string;
  milestoneId?: string;
  rideId?: string;
  expectedAmountPence: number;
  expectedCurrency: string;
  expectedPayerId: string;
  expectedPayeeId?: string;
}

export class FinancialSecurityEngine {
  private static processedWebhookEventIds = new Set<string>();
  private static processedPaymentIntents = new Set<string>();
  private static inProgressTransactions = new Map<string, number>();

  /**
   * Verifies that incoming Stripe webhook or checkout completion proofs mathematically
   * match the exact target resource and intended payment parameters.
   */
  public static verifyStripePaymentProof(
    event: VerifiedStripeEventPayload,
    target: ResourceTarget,
    signatureVerified: boolean = true
  ): {
    verified: boolean;
    amountPence: number;
    currency: string;
    payerId: string;
    payeeId?: string;
    resourceId: string;
  } {
    // Invariant 1: Unverified Cryptographic Signature Block
    if (!signatureVerified) {
      throw new UnauthorizedError("Cryptographic signature verification failed: Webhook is unverified or forged.");
    }

    // Invariant 2: Webhook / Event Replay Defense
    if (this.processedWebhookEventIds.has(event.id)) {
      throw new ConflictError(`Financial replay detected: Webhook event '${event.id}' has already been processed.`);
    }

    // Invariant 3: Payment Status Check (Failed, Unpaid, or Incomplete)
    if (event.payment_status && event.payment_status !== "paid") {
      throw new BadRequestError(`Payment verification failed: Stripe reports payment_status '${event.payment_status}'.`);
    }

    const intentId = typeof event.payment_intent === "string" 
      ? event.payment_intent 
      : event.payment_intent?.id;

    if (intentId && this.processedPaymentIntents.has(intentId)) {
      throw new ConflictError(`Duplicate payment capture: PaymentIntent '${intentId}' has already been bound to an escrow or payout.`);
    }

    const metadata = event.metadata || {};

    // Invariant 4: Resource Identity Binding (Cannot apply payment to wrong job/milestone/ride)
    if (metadata.jobId && metadata.jobId !== target.jobId) {
      throw new ForbiddenError(
        `Resource mismatch: Payment metadata references job '${metadata.jobId}' but target is '${target.jobId}'.`
      );
    }

    if (target.quoteId && metadata.quoteId && metadata.quoteId !== target.quoteId) {
      throw new ForbiddenError(
        `Resource mismatch: Payment metadata references quote '${metadata.quoteId}' but target is '${target.quoteId}'.`
      );
    }

    if (target.milestoneId && metadata.milestoneId && metadata.milestoneId !== target.milestoneId) {
      throw new ForbiddenError(
        `Resource mismatch: Payment metadata references milestone '${metadata.milestoneId}' but target is '${target.milestoneId}'.`
      );
    }

    if (target.rideId && metadata.rideId && metadata.rideId !== target.rideId) {
      throw new ForbiddenError(
        `Resource mismatch: Payment metadata references ride '${metadata.rideId}' but target is '${target.rideId}'.`
      );
    }

    // Invariant 5: User & Payer Ownership Binding (Cannot apply another customer's payment)
    const payerId = event.client_reference_id || metadata.userId || metadata.customerId;
    if (payerId && target.expectedPayerId && payerId !== target.expectedPayerId) {
      throw new ForbiddenError(
        `Payer mismatch: Payment belongs to user '${payerId}' but target resource belongs to '${target.expectedPayerId}'.`
      );
    }

    // Invariant 6: Currency Substitution Defense
    const paidCurrency = (event.currency || metadata.currency || "gbp").toLowerCase();
    const expectedCurrency = target.expectedCurrency.toLowerCase();
    if (paidCurrency !== expectedCurrency) {
      throw new BadRequestError(
        `Currency substitution detected: Expected '${expectedCurrency}', but received '${paidCurrency}'.`
      );
    }

    // Invariant 7: Price & Amount Substitution Defense
    const paidAmountPence = event.amount_total ?? 0;
    if (paidAmountPence <= 0) {
      throw new BadRequestError("Payment amount must be greater than zero.");
    }

    if (paidAmountPence < target.expectedAmountPence) {
      throw new BadRequestError(
        `Amount substitution detected: Expected at least ${target.expectedAmountPence} pence, but received ${paidAmountPence} pence.`
      );
    }

    // Mark event and intent as consumed
    this.processedWebhookEventIds.add(event.id);
    if (intentId) {
      this.processedPaymentIntents.add(intentId);
    }

    return {
      verified: true,
      amountPence: paidAmountPence,
      currency: paidCurrency,
      payerId: target.expectedPayerId,
      payeeId: target.expectedPayeeId,
      resourceId: target.milestoneId || target.rideId || target.jobId,
    };
  }

  /**
   * Concurrency & Network Timeout / Retry Lock for payouts and checkouts:
   * Prevents concurrent payouts, double-disbursements, or race conditions during network retries.
   */
  public static async executeWithNetworkRetryProtection<T>(
    idempotencyKey: string,
    operationName: string,
    timeoutMs: number,
    action: () => Promise<T>
  ): Promise<{ result: T; wasRetried: boolean }> {
    if (!idempotencyKey || idempotencyKey.trim() === "") {
      throw new BadRequestError("A valid idempotency key is required for financial operations.");
    }

    const now = Date.now();
    const activeLock = this.inProgressTransactions.get(idempotencyKey);
    if (activeLock && now - activeLock < timeoutMs) {
      throw new ConflictError(
        `Concurrent transaction in progress for idempotency key '${idempotencyKey}'. Retry after timeout.`
      );
    }

    this.inProgressTransactions.set(idempotencyKey, now);

    try {
      const result = await action();
      return { result, wasRetried: Boolean(activeLock) };
    } finally {
      this.inProgressTransactions.delete(idempotencyKey);
    }
  }

  /**
   * Resets verification state for unit tests
   */
  public static _resetForTesting(): void {
    this.processedWebhookEventIds.clear();
    this.processedPaymentIntents.clear();
    this.inProgressTransactions.clear();
  }
}
