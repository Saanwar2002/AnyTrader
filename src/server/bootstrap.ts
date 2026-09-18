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
import { evidenceRegistry } from "./intelligence/evidenceRegistry.ts";
import { setGlobalIntelligenceDb } from "./intelligence/immutableStore.ts";
import { setGlobalRawArtifactBucket } from "./intelligence/rawArtifactStore.ts";

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
    throw new Error("[Bootstrap] Firestore database instance is null or undefined. Startup aborted (Fail-Closed).");
  }

  const queryPromise = (async () => {
    let collectionRef: any = null;
    if (typeof firestoreDb.collection === "function") {
      collectionRef = firestoreDb.collection("intelligence_tasks");
    }
    if (!collectionRef) {
      throw new Error("[Bootstrap] Invalid Firestore DB instance: .collection() method missing.");
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
    if (!isReady) {
      throw new Error("[Bootstrap] Firestore readiness query returned non-ready result.");
    }
    return true;
  } catch (err: any) {
    throw new Error(`[Bootstrap] Firestore readiness verification failed: ${err?.message || err}`);
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

  if (!db) {
    throw new Error("[Bootstrap] Failed to obtain valid Firestore database instance from Firebase Admin. Startup aborted (Fail-Closed).");
  }

  console.log("[Bootstrap] Step 2: Verifying Firestore readiness probe...");
  const isFirestoreReady = await hooks.verifyFirestore(db);
  if (!isFirestoreReady) {
    throw new Error("[Bootstrap] Firestore readiness probe returned false. Startup aborted (Fail-Closed).");
  }
  console.log("[Bootstrap] Firestore readiness probe verified successfully.");

  console.log("[Bootstrap] Step 3: Configuring Intelligence Task Queue & Evidence Registry with authoritative Firestore instance...");
  hooks.queue.setFirestoreDb(db);
  evidenceRegistry.setDb(db);
  setGlobalIntelligenceDb(db);
  try {
    const storage = typeof (app as any).storage === "function" ? (app as any).storage() : null;
    if (storage && typeof storage.bucket === "function") {
      const bucket = storage.bucket();
      setGlobalRawArtifactBucket(bucket);
      console.log(`[Bootstrap] Tier-B raw artifact bucket configured: ${bucket.name || 'default'}`);
    } else {
      console.warn("[Bootstrap] Storage bucket unavailable on Admin app context.");
    }
  } catch (err) {
    console.warn("[Bootstrap] Storage bucket initialization notice:", err);
  }

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

