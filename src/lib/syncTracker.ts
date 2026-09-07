import { useState, useEffect } from "react";

interface PendingOperation {
  id: string;
  op: string;
  timestamp: number;
}

const STORAGE_KEY = "anytrader_pending_syncs";
const MAX_PENDING_AGE_MS = 6000; // 6 seconds max lifespan to prevent stuck UI loops

// Auto-cleanup timer map to ensure no promise leak
const autoCleanTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Safe loading of persisted pending operations with strict staleness pruning
function getSavedPendingOps(): PendingOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed: PendingOperation[] = JSON.parse(data);
    const now = Date.now();
    // Only keep operations that are less than MAX_PENDING_AGE_MS old
    const fresh = Array.isArray(parsed) ? parsed.filter((op) => now - op.timestamp < MAX_PENDING_AGE_MS) : [];
    if (fresh.length !== parsed.length) {
      if (fresh.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      }
    }
    return fresh;
  } catch (e) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return [];
  }
}

let pendingOps: PendingOperation[] = getSavedPendingOps();
const listeners = new Set<(ops: PendingOperation[]) => void>();

function savePendingOps() {
  if (typeof window === "undefined") return;
  try {
    if (pendingOps.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingOps));
    }
  } catch (e) {
    console.error("Failed to save pending operations to localStorage:", e);
  }
}

function notifyListeners() {
  listeners.forEach((cb) => cb([...pendingOps]));
}

/**
 * Prunes stale operations older than MAX_PENDING_AGE_MS
 */
export function pruneStalePendingOps() {
  const now = Date.now();
  const initialLength = pendingOps.length;
  pendingOps = pendingOps.filter((op) => now - op.timestamp < MAX_PENDING_AGE_MS);
  if (pendingOps.length !== initialLength) {
    savePendingOps();
    notifyListeners();
  }
}

/**
 * Forcibly clears all pending sync operations (used for dismiss / recovery)
 */
export function forceClearPendingSyncs() {
  autoCleanTimers.forEach((timer) => clearTimeout(timer));
  autoCleanTimers.clear();
  pendingOps = [];
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  notifyListeners();
}

/**
 * Registers a new pending database write operation.
 * Automatically schedules a safety cleanup so it never stays stuck in a loop.
 * @param opName The name of the database write function (e.g. "setDoc", "addDoc").
 * @returns The unique tracked operation ID.
 */
export function startTrackedWrite(opName: string): string {
  // Prune any stale ones first
  pruneStalePendingOps();

  const id = `${opName}-${Math.random().toString(36).substring(2, 9)}`;
  const newOp: PendingOperation = {
    id,
    op: opName,
    timestamp: Date.now(),
  };
  pendingOps.push(newOp);
  savePendingOps();
  notifyListeners();

  // Safety fallback timeout: if promise or network hangs, auto-expire in 6s
  if (typeof window !== "undefined") {
    const timer = setTimeout(() => {
      endTrackedWrite(id);
    }, MAX_PENDING_AGE_MS);
    autoCleanTimers.set(id, timer);
  }

  return id;
}

/**
 * Unregisters / resolves a pending database write operation.
 * @param id The unique tracked operation ID.
 */
export function endTrackedWrite(id: string) {
  if (autoCleanTimers.has(id)) {
    clearTimeout(autoCleanTimers.get(id));
    autoCleanTimers.delete(id);
  }
  const initialLength = pendingOps.length;
  pendingOps = pendingOps.filter((op) => op.id !== id);
  if (pendingOps.length !== initialLength) {
    savePendingOps();
    notifyListeners();
  }
}

/**
 * Custom React hook to observe database sync status.
 */
export function useSyncStatus() {
  const [ops, setOps] = useState<PendingOperation[]>(() => {
    pruneStalePendingOps();
    return pendingOps;
  });

  useEffect(() => {
    pruneStalePendingOps();
    const handleUpdate = (updatedOps: PendingOperation[]) => {
      setOps(updatedOps);
    };
    listeners.add(handleUpdate);

    // Periodic sweep to ensure stale ops are cleaned up even when idle
    const interval = setInterval(() => {
      pruneStalePendingOps();
    }, 2000);

    return () => {
      listeners.delete(handleUpdate);
      clearInterval(interval);
    };
  }, []);

  return {
    pendingCount: ops.length,
    hasPendingChanges: ops.length > 0,
    pendingOps: ops,
    forceClearPendingSyncs,
  };
}
