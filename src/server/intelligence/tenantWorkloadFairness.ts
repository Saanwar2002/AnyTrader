/**
 * AnyTrader V8.3 — Task 33: Tenant Workload Fairness & Concurrency Limiter
 * 
 * Server-authoritative tracking of in-flight background operations per tenant
 * to prevent noisy-neighbor starvation and monopolization of AI / queue resources.
 */

import { SCALE_LIMITS } from './scaleLimits';

export class TenantWorkloadFairnessTracker {
  private activeTenantTaskCounts: Map<string, number> = new Map();
  private maxActivePerTenant: number;

  constructor(maxActivePerTenant: number = SCALE_LIMITS.maxTenantActiveTasks) {
    this.maxActivePerTenant = maxActivePerTenant;
  }

  /**
   * Attempts to claim a processing slot for the specified tenant.
   * Returns true if allowed, false if tenant has exceeded their active task limit.
   */
  public tryAcquire(tenantId?: string): boolean {
    if (!tenantId) return true; // System-wide or unassigned tasks pass through

    const current = this.activeTenantTaskCounts.get(tenantId) || 0;
    if (current >= this.maxActivePerTenant) {
      return false; // Throttled due to noisy-neighbor limit
    }

    this.activeTenantTaskCounts.set(tenantId, current + 1);
    return true;
  }

  /**
   * Releases an acquired processing slot when the task completes, fails, or expires.
   */
  public release(tenantId?: string): void {
    if (!tenantId) return;

    const current = this.activeTenantTaskCounts.get(tenantId) || 0;
    if (current <= 1) {
      this.activeTenantTaskCounts.delete(tenantId);
    } else {
      this.activeTenantTaskCounts.set(tenantId, current - 1);
    }
  }

  /**
   * Gets the current number of active in-flight tasks for a tenant.
   */
  public getActiveCount(tenantId: string): number {
    return this.activeTenantTaskCounts.get(tenantId) || 0;
  }

  /**
   * Clears all in-memory tracking state (used in testing or process reboot).
   */
  public reset(): void {
    this.activeTenantTaskCounts.clear();
  }
}

export const tenantWorkloadTracker = new TenantWorkloadFairnessTracker();
