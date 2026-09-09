/**
 * Business-Logic Abuse & Sequence Integrity Defense Layer for AnyTrader V6
 * Protects against complex attack flows where each individual API call may pass auth,
 * but the macro-sequence (e.g. create -> cancel -> refund -> recreate -> payout) is malicious.
 */
import { ConflictError, BadRequestError, ForbiddenError } from "./httpErrors.ts";

export interface MilestoneEntity {
  id?: string;
  milestoneId?: string;
  status: string;
  amount?: number;
  escrowFunded?: boolean;
  fundingPaymentId?: string;
  isRefunded?: boolean;
  refundId?: string;
  refundedAt?: string | number;
  payoutTransferred?: boolean;
  payoutId?: string;
  payoutStatus?: string;
  isDisputed?: boolean;
  lifecycleHistory?: string[];
}

export interface JobEntity {
  id?: string;
  jobId?: string;
  status: string;
  homeownerId?: string;
  acceptedTradespersonId?: string;
  isCancelled?: boolean;
  isRefunded?: boolean;
  payoutStatus?: string;
  lifecycleHistory?: string[];
}

// In-memory set of consumed transaction nonces (backed by Firestore in production)
const CONSUMED_TRANSACTION_NONCES = new Set<string>();

export class BusinessLogicDefense {
  /**
   * Enforces that escrow release and payout can NEVER occur on cancelled, refunded,
   * disputed, or unfunded entities, regardless of individual parameter validity.
   */
  static validateEscrowReleaseEligibility(
    milestone: MilestoneEntity,
    job?: JobEntity | null
  ): void {
    // Invariant 1: Milestone Terminal State Block
    if (
      milestone.status === "cancelled" ||
      milestone.status === "refunded" ||
      milestone.isRefunded === true ||
      Boolean(milestone.refundId)
    ) {
      throw new ConflictError(
        "Business-logic violation: Milestone has been cancelled or refunded. Fund release and payout are permanently blocked."
      );
    }

    // Invariant 2: Active Job State Check
    if (job) {
      if (job.status === "cancelled" || job.status === "refunded" || job.isCancelled === true || job.isRefunded === true) {
        throw new ConflictError(
          "Business-logic violation: Job has been cancelled or refunded. Milestone payouts cannot be released."
        );
      }
    }

    // Invariant 3: Prior Payout Double-Dip Defense
    if (
      milestone.status === "released" ||
      milestone.payoutTransferred === true ||
      milestone.payoutStatus === "transferred" ||
      Boolean(milestone.payoutId)
    ) {
      throw new ConflictError(
        "Business-logic violation: Funds for this milestone have already been disbursed to the tradesperson."
      );
    }

    // Invariant 4: Escrow Funding Proof
    const validFundedStatuses = ["funded", "work_submitted"];
    if (!validFundedStatuses.includes(milestone.status) && milestone.escrowFunded !== true) {
      throw new BadRequestError(
        `Business-logic violation: Escrow must be actively funded before release. Current status is '${milestone.status}'.`
      );
    }

    // Invariant 5: Dispute Freeze
    if (milestone.status === "disputed" || milestone.isDisputed === true || job?.status === "disputed") {
      throw new ConflictError(
        "Business-logic violation: Funds are locked under active dispute arbitration. Release requires resolution."
      );
    }

    // Invariant 6: History sequence tamper check
    if (milestone.lifecycleHistory && milestone.lifecycleHistory.length > 0) {
      const forbiddenPriorStates = ["cancelled", "refunded"];
      const hasBadPriorState = milestone.lifecycleHistory.some(state => forbiddenPriorStates.includes(state));
      if (hasBadPriorState) {
        throw new ForbiddenError(
          "Business-logic abuse alert: Milestone was previously cancelled or refunded in its lifecycle history. State manipulation rejected."
        );
      }
    }
  }

  /**
   * Validates a proposed state transition against the entity's complete lifecycle history
   * to catch multi-step sequence abuse (e.g. revived jobs or cyclical refunds).
   */
  static validateLifecycleSequence(
    currentState: string,
    attemptedNextState: string,
    lifecycleHistory: string[] = []
  ): void {
    const terminalStates = ["cancelled", "refunded", "dispute_resolved", "released"];

    // If current state is terminal, no transitions are permitted
    if (terminalStates.includes(currentState)) {
      throw new ConflictError(
        `Business-logic violation: Entity is in terminal state '${currentState}' and cannot transition to '${attemptedNextState}'.`
      );
    }

    // If lifecycle history contains a terminal state, the entity cannot be revived
    if (lifecycleHistory.includes("refunded") || lifecycleHistory.includes("cancelled")) {
      throw new ForbiddenError(
        `Business-logic abuse detected: Entity was previously terminated in history [${lifecycleHistory.join(" -> ")}]. Transition to '${attemptedNextState}' rejected.`
      );
    }

    // Payout can never be triggered directly from non-funded state
    if (attemptedNextState === "payout_triggered" && !["work_submitted", "released"].includes(currentState)) {
      throw new BadRequestError(
        `Business-logic violation: Payout cannot be triggered from status '${currentState}'. Escrow release is required.`
      );
    }
  }

  /**
   * Registers a payment/refund transaction nonce and verifies it hasn't been replayed
   * or recycled to trigger duplicate financial operations.
   */
  static verifyAndConsumeTransactionNonce(
    transactionId: string,
    operationType: "REFUND" | "PAYOUT"
  ): void {
    if (!transactionId || transactionId.trim() === "") {
      throw new BadRequestError("Invalid transaction identifier.");
    }

    const nonceKey = `${operationType}:${transactionId}`;
    if (CONSUMED_TRANSACTION_NONCES.has(nonceKey)) {
      throw new ConflictError(
        `Business-logic violation: Transaction ${transactionId} has already been consumed for ${operationType}. Duplicate processing blocked.`
      );
    }

    CONSUMED_TRANSACTION_NONCES.add(nonceKey);
  }

  /**
   * Clears transaction nonces (for testing only)
   */
  static _resetNoncesForTesting(): void {
    CONSUMED_TRANSACTION_NONCES.clear();
  }
}
