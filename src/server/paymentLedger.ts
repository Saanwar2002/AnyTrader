/**
 * Financial Double-Entry Ledger & Idempotency Engine for AnyTrader V6
 * Enforces core invariants:
 * 1. "NO CLIENT-CONTROLLED VALUE MAY CAUSE ANYTRADER TO ACCEPT A PAYMENT AS VALID WITHOUT SERVER-SIDE VERIFICATION."
 * 2. "ONE FINANCIAL ACTION -> ONE FINANCIAL EFFECT."
 * 3. Atomic idempotency locks preventing duplicate releases, double payouts, and race conditions.
 */
import { BadRequestError, ConflictError, InternalServerError } from "./httpErrors.ts";
import { validatePaymentTransition, validateMilestoneTransition } from "./stateMachine.ts";
import { domainEvents } from "./domainEvents.ts";
import crypto from "crypto";

export interface LedgerEntry {
  entryId: string;
  transactionId: string;
  idempotencyKey: string;
  payerId: string;
  payeeId: string;
  amount: number; // in minor units (pence / cents)
  platformFee: number;
  netPayout: number;
  currency: string;
  type: "ESCROW_DEPOSIT" | "ESCROW_RELEASE" | "PLATFORM_COMMISSION" | "REFUND" | "RIDE_PAYMENT";
  status: "pending" | "completed" | "reversed";
  createdAt: string;
}

export class PaymentLedgerEngine {
  /**
   * Idempotency Guard:
   * Checks if an idempotency key has already been executed.
   * If yes, returns the existing result to avoid duplicate execution.
   */
  public static async executeIdempotentOperation<T>(
    db: any,
    idempotencyKey: string,
    operationName: string,
    executor: () => Promise<T>
  ): Promise<{ result: T; wasReplayed: boolean }> {
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      throw new BadRequestError("A valid, non-empty idempotencyKey is required for financial operations.");
    }

    if (!db) {
      // In development fallback without db, run executor directly
      const result = await executor();
      return { result, wasReplayed: false };
    }

    const idempotencyRef = db.collection("payment_idempotency").doc(idempotencyKey);
    
    // 1. Attempt transaction to claim the lock
    const claimResult = await db.runTransaction(async (transaction: any) => {
      const doc = await transaction.get(idempotencyRef);
      if (doc.exists) {
        const data = doc.data();
        if (data.status === "completed") {
          console.log(`[Idempotency Hit] Operation '${operationName}' already executed for key: ${idempotencyKey}`);
          return { shouldExecute: false, result: data.response as T, wasReplayed: true };
        }
        if (data.status === "in_progress") {
          throw new ConflictError("A concurrent request with the same idempotency key is already processing.");
        }
      }

      // Mark in progress
      transaction.set(idempotencyRef, {
        operationName,
        status: "in_progress",
        startedAt: new Date().toISOString(),
      });
      return { shouldExecute: true };
    });

    if (!claimResult.shouldExecute) {
      return { result: claimResult.result as T, wasReplayed: true };
    }

    // 2. Execute side effect outside transaction
    try {
      const result = await executor();
      
      // 3. Record completed result
      if (typeof idempotencyRef.update === "function") {
        await idempotencyRef.update({
          status: "completed",
          completedAt: new Date().toISOString(),
          response: result ?? null,
        });
      } else if (typeof idempotencyRef.set === "function") {
        await idempotencyRef.set({
          operationName,
          status: "completed",
          completedAt: new Date().toISOString(),
          response: result ?? null,
        }, { merge: true });
      }

      return { result, wasReplayed: false };
    } catch (err) {
      // Release lock on failure
      if (typeof idempotencyRef.delete === "function") {
        await idempotencyRef.delete().catch((e: any) => console.error("Failed to release idempotency lock:", e));
      } else if (typeof idempotencyRef.update === "function") {
        await idempotencyRef.update({ status: "failed" }).catch(() => {});
      } else if (typeof idempotencyRef.set === "function") {
        await idempotencyRef.set({ status: "failed" }, { merge: true }).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Record Escrow Funding:
   * Called strictly upon verified server-side Stripe webhook or payment intent confirmation.
   * Client-supplied price/amount is strictly rejected; amount must match the verified Stripe event.
   */
  public static async recordEscrowFunding(
    db: any,
    params: {
      jobId: string;
      milestoneId: string;
      customerId: string;
      traderId: string;
      verifiedAmount: number; // in pence
      currency: string;
      paymentIntentId: string;
      idempotencyKey: string;
    }
  ): Promise<LedgerEntry> {
    const { jobId, milestoneId, customerId, traderId, verifiedAmount, currency, paymentIntentId, idempotencyKey } = params;

    if (verifiedAmount <= 0) {
      throw new BadRequestError("Verified amount must be strictly greater than zero.");
    }

    const { result } = await this.executeIdempotentOperation(db, idempotencyKey, "FUND_MILESTONE_ESCROW", async () => {
      const platformFee = Math.round(verifiedAmount * 0.12); // Standard 12% platform fee
      const netPayout = verifiedAmount - platformFee;

      const entryId = `ledg_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const ledgerEntry: LedgerEntry = {
        entryId,
        transactionId: paymentIntentId,
        idempotencyKey,
        payerId: customerId,
        payeeId: traderId,
        amount: verifiedAmount,
        platformFee,
        netPayout,
        currency: currency.toLowerCase(),
        type: "ESCROW_DEPOSIT",
        status: "completed",
        createdAt: new Date().toISOString(),
      };

      if (db) {
        const milestoneRef = db.collection("jobs").doc(jobId).collection("milestones").doc(milestoneId);
        const milestoneDoc = await milestoneRef.get();
        if (milestoneDoc.exists) {
          const currentStatus = milestoneDoc.data()?.status || "pending";
          validateMilestoneTransition(currentStatus, "funded");
          await milestoneRef.update({
            status: "funded",
            fundedAt: new Date().toISOString(),
            escrowEntryId: entryId,
            verifiedAmount,
            platformFee,
            netPayout,
          });
        }

        await db.collection("payment_ledger").doc(entryId).set(ledgerEntry);
      }

      await domainEvents.dispatch("MILESTONE_FUNDED", milestoneId, customerId, {
        jobId,
        amount: verifiedAmount,
        currency,
      }, idempotencyKey, db);

      return ledgerEntry;
    });

    return result;
  }

  /**
   * Record Escrow Release to Tradesperson:
   * Mathematically guarantees:
   * - Milestone cannot be released if already released (terminal)
   * - Milestone cannot be released if refunded
   * - Trader receives netPayout; platform receives platformFee
   */
  public static async releaseEscrowFunds(
    db: any,
    params: {
      jobId: string;
      milestoneId: string;
      callerId: string;
      idempotencyKey: string;
    }
  ): Promise<LedgerEntry> {
    const { jobId, milestoneId, callerId, idempotencyKey } = params;

    const { result } = await this.executeIdempotentOperation(db, idempotencyKey, "RELEASE_MILESTONE_ESCROW", async () => {
      if (!db) {
        throw new InternalServerError("Database is required for financial escrow release.");
      }

      const milestoneRef = db.collection("jobs").doc(jobId).collection("milestones").doc(milestoneId);
      const milestoneDoc = await milestoneRef.get();

      if (!milestoneDoc.exists) {
        throw new BadRequestError(`Milestone ${milestoneId} does not exist on job ${jobId}.`);
      }

      const mData = milestoneDoc.data()!;
      const currentStatus = mData.status;

      // Validate state machine rule:
      validateMilestoneTransition(currentStatus, "released");

      const verifiedAmount = mData.verifiedAmount || mData.amount || 0;
      const platformFee = mData.platformFee || Math.round(verifiedAmount * 0.12);
      const netPayout = verifiedAmount - platformFee;

      const entryId = `ledg_rel_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const releaseEntry: LedgerEntry = {
        entryId,
        transactionId: mData.escrowEntryId || `tx_${milestoneId}`,
        idempotencyKey,
        payerId: mData.customerId || callerId,
        payeeId: mData.tradespersonId || mData.traderId,
        amount: verifiedAmount,
        platformFee,
        netPayout,
        currency: (mData.currency || "gbp").toLowerCase(),
        type: "ESCROW_RELEASE",
        status: "completed",
        createdAt: new Date().toISOString(),
      };

      // Atomic batch update
      const batch = db.batch();
      batch.update(milestoneRef, {
        status: "released",
        releasedAt: new Date().toISOString(),
        releasedBy: callerId,
        releaseEntryId: entryId,
      });

      batch.set(db.collection("payment_ledger").doc(entryId), releaseEntry);

      // Credit trader pending payout ledger
      const traderId = mData.tradespersonId || mData.traderId;
      if (traderId) {
        const traderBalanceRef = db.collection("trader_balances").doc(traderId);
        batch.set(traderBalanceRef, {
          availableBalance: db.FieldValue ? db.FieldValue.increment(netPayout) : netPayout,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      await batch.commit();

      await domainEvents.dispatch("MILESTONE_RELEASED", milestoneId, callerId, {
        jobId,
        traderId,
        netPayout,
        platformFee,
      }, idempotencyKey, db);

      return releaseEntry;
    });

    return result;
  }
}
