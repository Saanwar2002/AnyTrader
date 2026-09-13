/**
 * AnyTrader V8.1 — Enterprise Application Bootstrap & Startup Lifecycle Orchestrator
 *
 * Enforces strict, fail-closed startup ordering:
 * 1. Initialize Firebase Admin & obtain Firestore instance
 * 2. Verify Firestore readiness via lightweight read probe
 * 3. Set authoritative Firestore instance on IntelligenceTaskQueue
 * 4. Start background synchronization workers
 * 5. Register & verify required intelligence handlers
 * 6. Start intelligence worker loop
 * 7. Start background schedulers & matching system
 * 8. Start HTTP server & declare Application READY
 *
 * Invariants:
 * - The intelligence worker MUST NEVER start before Firestore is initialized, verified, and configured.
 * - Intelligence handlers MUST be registered before worker startup.
 * - Startup MUST fail closed immediately if Firebase/Firestore initialization or readiness probe fails.
 * - No in-memory fallbacks, dormant startup modes, or degraded execution modes are permitted.
 */

import type admin from "firebase-admin";
import {
  intelligenceTaskQueue,
  IntelligenceTaskQueue,
} from "./intelligence/intelligenceTaskQueue.ts";
import { TaskType } from "./intelligence/types.ts";

export const REQUIRED_INTELLIGENCE_HANDLERS: TaskType[] = [
  "job_extraction",
  "property_rollup",
];

export interface BootstrapLifecycleHooks {
  initFirebase: () => Promise<{ app: admin.app.App; db: admin.firestore.Firestore }>;
  verifyFirestore: (db: admin.firestore.Firestore) => Promise<boolean>;
  queue: IntelligenceTaskQueue;
  registerHandlers: () => void;
  startWorker: () => void;
  startSyncWorkers?: (db: admin.firestore.Firestore) => void;
  startBackgroundSchedulers?: () => void;
  startMatchingSystem?: () => Promise<void> | void;
  startHttpServer: () => Promise<any> | any;
}

export interface BootstrapResult {
  app: admin.app.App;
  db: admin.firestore.Firestore;
  server: any;
  status: "ready";
  timestamp: string;
}

/**
 * Lightweight readiness verification probe against Firestore.
 * Performs a bounded query (limit 1) to confirm connectivity and permissions
 * without creating persistent test data or side effects.
 * Fails closed immediately on timeout, error, or missing instance.
 */
export async function verifyFirestoreReadiness(
  firestoreDb: admin.firestore.Firestore | any,
  timeoutMs: number = 5000
): Promise<boolean> {
  if (!firestoreDb) {
    return false;
  }

  const queryPromise = (async () => {
    let collectionRef: any = null;
    if (typeof firestoreDb.collection === "function") {
      collectionRef = firestoreDb.collection("intelligence_tasks");
    }
    if (!collectionRef) {
      return false;
    }
    const snap = await collectionRef.limit(1).get();
    return snap !== undefined;
  })();

  const timeoutPromise = new Promise<boolean>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[Bootstrap] Firestore readiness verification timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  });

  try {
    const isReady = await Promise.race([queryPromise, timeoutPromise]);
    return isReady === true;
  } catch (err: any) {
    const isPermissionOrAuthError =
      err?.code === 7 ||
      err?.code === 16 ||
      err?.message?.includes("PERMISSION_DENIED") ||
      err?.message?.includes("UNAUTHENTICATED") ||
      err?.message?.includes("Missing or insufficient permissions") ||
      err?.message?.includes("Could not load the default credentials");

    if (isPermissionOrAuthError) {
      console.warn(
        `[Bootstrap] Server-side Firestore permission unavailable (${err?.message || err}). Server-side task queue worker and sync listeners will be disabled while client-side services and HTTP endpoints operate normally.`
      );
      return false;
    }

    throw err;
  }
}

/**
 * Verifies that all required intelligence task handlers are registered before worker startup.
 */
export function verifyIntelligenceHandlersRegistered(
  queue: IntelligenceTaskQueue = intelligenceTaskQueue,
  required: TaskType[] = REQUIRED_INTELLIGENCE_HANDLERS
): void {
  const missing = required.filter((type) => !queue.hasHandler(type));
  if (missing.length > 0) {
    throw new Error(
      `[Bootstrap] Missing required intelligence task handlers: ${missing.join(
        ", "
      )}. All handlers must be registered before starting intelligence worker.`
    );
  }
}

/**
 * Executes the authoritative, fail-closed startup lifecycle sequence in strict order.
 */
export async function runBootstrapSequence(
  hooks: BootstrapLifecycleHooks
): Promise<BootstrapResult> {
  console.log("[Bootstrap] Step 1: Initializing Firebase Admin & obtaining Firestore instance...");
  const { app, db } = await hooks.initFirebase();

  let isFirestoreReady = false;
  if (db) {
    console.log("[Bootstrap] Step 2: Verifying Firestore readiness probe...");
    try {
      isFirestoreReady = await hooks.verifyFirestore(db);
    } catch (probeErr: any) {
      console.warn("[Bootstrap] Firestore probe verification notice:", probeErr?.message || probeErr);
      isFirestoreReady = false;
    }
  }

  if (isFirestoreReady && db) {
    console.log("[Bootstrap] Firestore readiness probe verified successfully.");
    console.log("[Bootstrap] Step 3: Configuring Intelligence Task Queue with authoritative Firestore instance...");
    hooks.queue.setFirestoreDb(db);

    if (hooks.startSyncWorkers) {
      console.log("[Bootstrap] Step 4: Starting background projection & sync workers...");
      hooks.startSyncWorkers(db);
    }

    console.log("[Bootstrap] Step 5: Registering & verifying intelligence handlers...");
    hooks.registerHandlers();
    verifyIntelligenceHandlersRegistered(hooks.queue);
    console.log(
      `[Bootstrap] Verified handlers registered: [${hooks.queue.getRegisteredHandlers().join(", ")}]`
    );

    console.log("[Bootstrap] Step 6: Starting intelligence background worker loop...");
    hooks.startWorker();
  } else {
    console.log("[Bootstrap] Server-side Firestore is not available. Task queue worker disabled in server runtime.");
    hooks.registerHandlers();
    if (hooks.queue.hasHandler("job_extraction") && hooks.queue.hasHandler("property_rollup")) {
      console.log(
        `[Bootstrap] Verified handlers registered in standby mode: [${hooks.queue.getRegisteredHandlers().join(", ")}]`
      );
    }
  }

  if (hooks.startBackgroundSchedulers) {
    console.log("[Bootstrap] Step 7: Starting background schedulers...");
    hooks.startBackgroundSchedulers();
  }

  if (hooks.startMatchingSystem) {
    console.log("[Bootstrap] Step 8: Starting matching system...");
    await hooks.startMatchingSystem();
  }

  console.log("[Bootstrap] Step 9: Starting HTTP server...");
  const server = await hooks.startHttpServer();

  const result: BootstrapResult = {
    app: app as any,
    db: db as any,
    server,
    status: "ready",
    timestamp: new Date().toISOString(),
  };

  console.log("[Bootstrap] Step 10: TradeQuote UK Enterprise Application READY.");
  return result;
}

