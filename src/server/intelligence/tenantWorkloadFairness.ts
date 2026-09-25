/**
 * AnyTrader V8.3 — Task 33 / 33R: Tenant Workload Fairness & Concurrency Limiter
 * 
 * Server-authoritative tracking of in-flight background operations per tenant
 * to prevent noisy-neighbor starvation and monopolization of AI / queue resources.
 * 
 * Enforced atomically inside Firestore transactions during task claim, completion,
 * retry, dead-letter, and stale recovery across multiple concurrent worker instances.
 */

import { SCALE_LIMITS } from './scaleLimits';

export const TENANT_WORKLOAD_COLLECTION = 'tenant_active_workloads';

export interface TenantWorkloadRecord {
  tenantId: string;
  activeCount: number;
  updatedAt: string;
}

/**
 * Atomically checks and acquires a workload processing slot for the given tenant
 * inside an existing Firestore transaction.
 * 
 * Multi-worker safe: Serializes on the tenant's workload document in Firestore.
 * Returns true if the slot was acquired, false if the tenant has reached the active limit.
 */
export async function acquireTenantSlotTransactional(
  transaction: any,
  db: any,
  tenantId: string,
  maxLimit: number = SCALE_LIMITS.maxTenantActiveTasks
): Promise<boolean> {
  if (!tenantId) return true; // System-wide or unassigned tasks pass through
  if (!db || typeof db.collection !== 'function') return true;

  const workloadRef = db.collection(TENANT_WORKLOAD_COLLECTION).doc(tenantId);
  const snap = await transaction.get(workloadRef);
  const currentCount = snap && snap.exists ? (snap.data()?.activeCount || 0) : 0;

  if (currentCount >= maxLimit) {
    return false; // Throttled: Tenant has reached or exceeded max active concurrency limit
  }

  const nowIso = new Date().toISOString();
  const newCount = currentCount + 1;

  transaction.set(
    workloadRef,
    {
      tenantId,
      activeCount: newCount,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  return true;
}

/**
 * Atomically releases an acquired workload processing slot for the given tenant
 * inside an existing Firestore transaction.
 * 
 * Guarded against underflow: clamps activeCount to Math.max(0, count - 1).
 */
export async function releaseTenantSlotTransactional(
  transaction: any,
  db: any,
  tenantId: string
): Promise<void> {
  if (!tenantId) return;
  if (!db || typeof db.collection !== 'function') return;

  const workloadRef = db.collection(TENANT_WORKLOAD_COLLECTION).doc(tenantId);
  const snap = await transaction.get(workloadRef);
  if (!snap || !snap.exists) return;

  const currentCount = snap.data()?.activeCount || 0;
  const newCount = Math.max(0, currentCount - 1);
  const nowIso = new Date().toISOString();

  transaction.set(
    workloadRef,
    {
      tenantId,
      activeCount: newCount,
      updatedAt: nowIso,
    },
    { merge: true }
  );
}

/**
 * Retrieves the current authoritative active workload count for a tenant.
 */
export async function getTenantActiveWorkloadCount(
  db: any,
  tenantId: string
): Promise<number> {
  if (!tenantId || !db || typeof db.collection !== 'function') return 0;
  const snap = await db.collection(TENANT_WORKLOAD_COLLECTION).doc(tenantId).get();
  return snap && snap.exists ? (snap.data()?.activeCount || 0) : 0;
}

/**
 * In-memory fallback and helper tracker for local test harnesses.
 */
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

