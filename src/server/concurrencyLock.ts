/**
 * Atomic Concurrency & Race Condition Defense Layer for AnyTrader V6
 * Guards critical financial and operational flows from simultaneous race conditions:
 * - Releasing money (Milestone Escrow release)
 * - Accepting a job quote
 * - Claiming a milestone / job assignment
 * - Withdrawing balance (Double-spend prevention)
 * - Transferring property ownership
 */
import { ConflictError, BadRequestError } from "./httpErrors.ts";

export interface MockDataStore {
  get: (key: string) => Promise<any> | any;
  set: (key: string, value: any) => Promise<void> | void;
}

export class ConcurrencyLockEngine {
  private static activeLocks = new Map<string, { lockedAt: number; expiresAt: number }>();
  private static DEFAULT_LOCK_TIMEOUT_MS = 5000;

  /**
   * Acquires an atomic lock on a specific resource identifier.
   * If another request already holds an unexpired lock, throws ConflictError.
   */
  static acquireLock(resourceKey: string, timeoutMs: number = ConcurrencyLockEngine.DEFAULT_LOCK_TIMEOUT_MS): void {
    const now = Date.now();
    const existing = this.activeLocks.get(resourceKey);

    if (existing && existing.expiresAt > now) {
      throw new ConflictError(
        `Concurrency Conflict: Resource '${resourceKey}' is locked by another active operation. Simultaneous modification blocked.`
      );
    }

    this.activeLocks.set(resourceKey, {
      lockedAt: now,
      expiresAt: now + timeoutMs,
    });
  }

  /**
   * Releases an acquired lock.
   */
  static releaseLock(resourceKey: string): void {
    this.activeLocks.delete(resourceKey);
  }

  /**
   * Wraps an asynchronous operation with an atomic resource lock.
   */
  static async executeWithResourceLock<T>(
    resourceKey: string,
    operation: () => Promise<T>,
    timeoutMs: number = ConcurrencyLockEngine.DEFAULT_LOCK_TIMEOUT_MS
  ): Promise<T> {
    this.acquireLock(resourceKey, timeoutMs);
    try {
      return await operation();
    } finally {
      this.releaseLock(resourceKey);
    }
  }

  /**
   * Race Condition Defense: Concurrent Money Release (Milestone Escrow)
   * Guarantees that only ONE of multiple concurrent release requests succeeds.
   */
  static async atomicReleaseMilestone(
    store: MockDataStore,
    milestoneId: string,
    releaseFn: (milestone: any) => Promise<{ releasedAmount: number }>
  ): Promise<{ success: boolean; releasedAmount: number }> {
    const lockKey = `lock:milestone:${milestoneId}`;

    return await this.executeWithResourceLock(lockKey, async () => {
      const milestone = await store.get(`milestones/${milestoneId}`);
      if (!milestone) {
        throw new BadRequestError(`Milestone ${milestoneId} not found.`);
      }

      if (milestone.status === "released") {
        throw new ConflictError(`Milestone ${milestoneId} has already been released.`);
      }

      if (!["funded", "work_submitted"].includes(milestone.status)) {
        throw new ConflictError(
          `Cannot release milestone in status '${milestone.status}'. Must be funded.`
        );
      }

      // Execute release side-effect
      const result = await releaseFn(milestone);

      // Atomically update state
      await store.set(`milestones/${milestoneId}`, {
        ...milestone,
        status: "released",
        releasedAt: new Date().toISOString(),
        payoutTransferred: true,
      });

      return { success: true, releasedAmount: result.releasedAmount };
    });
  }

  /**
   * Race Condition Defense: Concurrent Job Quote Acceptance
   * Guarantees that only ONE quote can be accepted when two requests arrive simultaneously.
   */
  static async atomicAcceptJob(
    store: MockDataStore,
    jobId: string,
    quoteId: string,
    traderId: string,
    acceptFn?: (job: any) => Promise<void>
  ): Promise<{ success: boolean; acceptedTraderId: string }> {
    const lockKey = `lock:job:${jobId}`;

    return await this.executeWithResourceLock(lockKey, async () => {
      const job = await store.get(`jobs/${jobId}`);
      if (!job) {
        throw new BadRequestError(`Job ${jobId} not found.`);
      }

      if (job.status !== "open" && job.status !== "quoted") {
        throw new ConflictError(
          `Job ${jobId} is no longer open for acceptance (current status: '${job.status}').`
        );
      }

      if (job.acceptedTraderId) {
        throw new ConflictError(
          `Job ${jobId} has already been assigned to trader '${job.acceptedTraderId}'.`
        );
      }

      if (acceptFn) {
        await acceptFn(job);
      }

      await store.set(`jobs/${jobId}`, {
        ...job,
        status: "in_progress",
        acceptedQuoteId: quoteId,
        acceptedTraderId: traderId,
        assignedAt: new Date().toISOString(),
      });

      return { success: true, acceptedTraderId: traderId };
    });
  }

  /**
   * Race Condition Defense: Concurrent Fund Withdrawal (Double-Spend Prevention)
   * Guarantees that simultaneous withdrawal requests cannot exceed available balance.
   */
  static async atomicWithdrawFunds(
    store: MockDataStore,
    userId: string,
    amount: number,
    processPayoutFn: (amount: number) => Promise<{ payoutId: string }>
  ): Promise<{ success: boolean; remainingBalance: number; payoutId: string }> {
    if (amount <= 0) {
      throw new BadRequestError("Withdrawal amount must be greater than zero.");
    }

    const lockKey = `lock:wallet:${userId}`;

    return await this.executeWithResourceLock(lockKey, async () => {
      const user = await store.get(`users/${userId}`);
      if (!user) {
        throw new BadRequestError(`User account ${userId} not found.`);
      }

      const currentBalance = Number(user.balance || 0);
      if (currentBalance < amount) {
        throw new BadRequestError(
          `Insufficient balance: Requested £${amount.toFixed(2)}, available balance is £${currentBalance.toFixed(2)}.`
        );
      }

      // Decrement balance atomically
      const remainingBalance = currentBalance - amount;
      const payoutResult = await processPayoutFn(amount);

      await store.set(`users/${userId}`, {
        ...user,
        balance: remainingBalance,
        lastWithdrawalAt: new Date().toISOString(),
      });

      return {
        success: true,
        remainingBalance,
        payoutId: payoutResult.payoutId,
      };
    });
  }

  /**
   * Race Condition Defense: Concurrent Property Ownership Transfer
   * Guarantees that two concurrent claims or transfers cannot corrupt ownership.
   */
  static async atomicTransferOwnership(
    store: MockDataStore,
    propertyId: string,
    expectedCurrentOwnerId: string,
    newOwnerId: string
  ): Promise<{ success: boolean; newOwnerId: string }> {
    const lockKey = `lock:property:${propertyId}`;

    return await this.executeWithResourceLock(lockKey, async () => {
      const property = await store.get(`properties/${propertyId}`);
      if (!property) {
        throw new BadRequestError(`Property ${propertyId} not found.`);
      }

      if (property.ownerId !== expectedCurrentOwnerId) {
        throw new ConflictError(
          `Ownership conflict: Property is currently owned by '${property.ownerId}', not '${expectedCurrentOwnerId}'.`
        );
      }

      await store.set(`properties/${propertyId}`, {
        ...property,
        ownerId: newOwnerId,
        transferStatus: "completed",
        transferredAt: new Date().toISOString(),
      });

      return { success: true, newOwnerId };
    });
  }

  /**
   * Clear all active locks (for testing)
   */
  static _resetLocksForTesting(): void {
    this.activeLocks.clear();
  }
}
