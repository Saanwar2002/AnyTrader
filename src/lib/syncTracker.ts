import { useState, useEffect } from "react";

interface PendingOperation {
  id: string;
  op: string;
  timestamp: number;
}

const STORAGE_KEY = "anytrader_pending_syncs";

// Safe loading of persisted pending operations
function getSavedPendingOps(): PendingOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

let pendingOps: PendingOperation[] = getSavedPendingOps();
const listeners = new Set<(ops: PendingOperation[]) => void>();

function savePendingOps() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingOps));
  } catch (e) {
    console.error("Failed to save pending operations to localStorage:", e);
  }
}

function notifyListeners() {
  listeners.forEach((cb) => cb([...pendingOps]));
}

/**
 * Registers a new pending database write operation.
 * @param opName The name of the database write function (e.g. "setDoc", "addDoc").
 * @returns The unique tracked operation ID.
 */
export function startTrackedWrite(opName: string): string {
  const id = `${opName}-${Math.random().toString(36).substring(2, 9)}`;
  const newOp: PendingOperation = {
    id,
    op: opName,
    timestamp: Date.now(),
  };
  pendingOps.push(newOp);
  savePendingOps();
  notifyListeners();
  return id;
}

/**
 * Unregisters / resolves a pending database write operation.
 * @param id The unique tracked operation ID.
 */
export function endTrackedWrite(id: string) {
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
  const [ops, setOps] = useState<PendingOperation[]>(pendingOps);

  useEffect(() => {
    const handleUpdate = (updatedOps: PendingOperation[]) => {
      setOps(updatedOps);
    };
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  return {
    pendingCount: ops.length,
    hasPendingChanges: ops.length > 0,
    pendingOps: ops,
  };
}
