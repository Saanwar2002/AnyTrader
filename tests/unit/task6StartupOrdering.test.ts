import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  runBootstrapSequence,
  verifyFirestoreReadiness,
  verifyIntelligenceHandlersRegistered,
  BootstrapLifecycleHooks,
  REQUIRED_INTELLIGENCE_HANDLERS,
} from "../../src/server/bootstrap.ts";
import {
  IntelligenceTaskQueue,
} from "../../src/server/intelligence/intelligenceTaskQueue.ts";

describe("Task 6: Application Startup & Readiness Ordering Hardening", () => {
  let mockQueue: IntelligenceTaskQueue;
  let mockDb: any;
  let mockApp: any;

  beforeEach(() => {
    mockQueue = new IntelligenceTaskQueue();
    mockDb = {
      collection: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: false, docs: [] }),
        }),
      }),
    };
    mockApp = {
      name: "[DEFAULT]",
      options: {},
    };
  });

  afterEach(() => {
    mockQueue.stopWorker();
    vi.restoreAllMocks();
  });

  it("Test A (FIRESTORE BEFORE WORKER): worker cannot start before Firestore initialization resolves", async () => {
    const sequenceOrder: string[] = [];

    const hooks: BootstrapLifecycleHooks = {
      initFirebase: vi.fn().mockImplementation(async () => {
        sequenceOrder.push("firebaseInit");
        return { app: mockApp, db: mockDb };
      }),
      verifyFirestore: vi.fn().mockImplementation(async (db: any) => {
        sequenceOrder.push("firestoreVerified");
        return true;
      }),
      queue: mockQueue,
      registerHandlers: vi.fn().mockImplementation(() => {
        sequenceOrder.push("handlersRegistered");
        for (const type of REQUIRED_INTELLIGENCE_HANDLERS) {
          mockQueue.registerHandler(type, vi.fn() as any);
        }
      }),
      startWorker: vi.fn().mockImplementation(() => {
        sequenceOrder.push("workerStarted");
        mockQueue.startWorker(5000);
      }),
      startHttpServer: vi.fn().mockImplementation(async () => {
        sequenceOrder.push("httpServerStarted");
        return { listen: vi.fn() };
      }),
    };

    const result = await runBootstrapSequence(hooks);

    expect(result.status).toBe("ready");
    expect(sequenceOrder).toEqual([
      "firebaseInit",
      "firestoreVerified",
      "handlersRegistered",
      "workerStarted",
      "httpServerStarted",
    ]);

    const firebaseIdx = sequenceOrder.indexOf("firebaseInit");
    const firestoreVerifiedIdx = sequenceOrder.indexOf("firestoreVerified");
    const workerIdx = sequenceOrder.indexOf("workerStarted");
    const serverIdx = sequenceOrder.indexOf("httpServerStarted");

    expect(firebaseIdx).toBeLessThan(firestoreVerifiedIdx);
    expect(firestoreVerifiedIdx).toBeLessThan(workerIdx);
    expect(workerIdx).toBeLessThan(serverIdx);
    expect(mockQueue.isWorkerActive()).toBe(true);
  });

  it("Test B (FIRESTORE FAILURE): startup rejects and worker does not start on Firestore initialization failure", async () => {
    let workerStarted = false;
    let serverStarted = false;

    const hooks: BootstrapLifecycleHooks = {
      initFirebase: vi.fn().mockRejectedValue(new Error("Firebase service account credentials missing")),
      verifyFirestore: vi.fn(),
      queue: mockQueue,
      registerHandlers: vi.fn(),
      startWorker: vi.fn().mockImplementation(() => {
        workerStarted = true;
        mockQueue.startWorker(5000);
      }),
      startHttpServer: vi.fn().mockImplementation(() => {
        serverStarted = true;
      }),
    };

    await expect(runBootstrapSequence(hooks)).rejects.toThrow("Firebase service account credentials missing");
    expect(workerStarted).toBe(false);
    expect(serverStarted).toBe(false);
    expect(mockQueue.isWorkerActive()).toBe(false);
  });

  it("Test C (HANDLER REGISTRATION BEFORE WORKER): handlers must be ready before worker start", async () => {
    const sequenceOrder: string[] = [];

    const hooks: BootstrapLifecycleHooks = {
      initFirebase: vi.fn().mockResolvedValue({ app: mockApp, db: mockDb }),
      verifyFirestore: vi.fn().mockImplementation(async () => {
        sequenceOrder.push("firestoreReady");
        return true;
      }),
      queue: mockQueue,
      registerHandlers: vi.fn().mockImplementation(() => {
        sequenceOrder.push("handlersReady");
        // Only register one handler (missing property_rollup)
        mockQueue.registerHandler("job_extraction", vi.fn() as any);
      }),
      startWorker: vi.fn().mockImplementation(() => {
        sequenceOrder.push("workerStarted");
        mockQueue.startWorker(5000);
      }),
      startHttpServer: vi.fn().mockResolvedValue({}),
    };

    // Missing required handler must cause fail-closed rejection
    await expect(runBootstrapSequence(hooks)).rejects.toThrow("Missing required intelligence task handlers: property_rollup");
    expect(mockQueue.isWorkerActive()).toBe(false);
  });

  it("Test D (NO STARTUP RACE): delayed Firebase initialization keeps worker inactive during delay", async () => {
    let firebaseResolved = false;

    const hooks: BootstrapLifecycleHooks = {
      initFirebase: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        firebaseResolved = true;
        return { app: mockApp, db: mockDb };
      }),
      verifyFirestore: vi.fn().mockImplementation(async (db: any) => {
        await verifyFirestoreReadiness(db);
        return true;
      }),
      queue: mockQueue,
      registerHandlers: vi.fn().mockImplementation(() => {
        for (const type of REQUIRED_INTELLIGENCE_HANDLERS) {
          mockQueue.registerHandler(type, vi.fn() as any);
        }
      }),
      startWorker: vi.fn().mockImplementation(() => {
        mockQueue.startWorker(5000);
      }),
      startHttpServer: vi.fn().mockResolvedValue({}),
    };

    // Launch bootstrap asynchronously
    const bootstrapPromise = runBootstrapSequence(hooks);

    // During delay, worker must not be active
    expect(mockQueue.isWorkerActive()).toBe(false);
    expect(firebaseResolved).toBe(false);

    // Await completion
    const res = await bootstrapPromise;
    expect(firebaseResolved).toBe(true);
    expect(res.status).toBe("ready");
    expect(mockQueue.isWorkerActive()).toBe(true);
  });

  it("Test E (WORKER STARTED ONCE): startWorker is strictly idempotent and cannot start duplicate loops", async () => {
    mockQueue.setFirestoreDb(mockDb);
    for (const type of REQUIRED_INTELLIGENCE_HANDLERS) {
      mockQueue.registerHandler(type, vi.fn() as any);
    }

    expect(mockQueue.isWorkerActive()).toBe(false);

    // Start worker first time
    mockQueue.startWorker(5000);
    expect(mockQueue.isWorkerActive()).toBe(true);

    // Start worker second time (must be idempotent without creating a second interval)
    mockQueue.startWorker(5000);
    expect(mockQueue.isWorkerActive()).toBe(true);

    mockQueue.stopWorker();
    expect(mockQueue.isWorkerActive()).toBe(false);
  });

  it("Test F (FAIL CLOSED ON UNINITIALIZED QUEUE): queue.startWorker throws immediately if Firestore DB is missing", () => {
    const freshQueue = new IntelligenceTaskQueue();
    expect(freshQueue.getFirestoreDb()).toBeNull();

    expect(() => {
      freshQueue.startWorker(5000);
    }).toThrow("[IntelligenceTaskQueue] Cannot start worker: Firestore task store is not configured or not ready.");

    expect(freshQueue.isWorkerActive()).toBe(false);
  });

  it("Test G (READINESS TIMEOUT): verifyFirestoreReadiness times out and throws if probe hangs", async () => {
    const hangingDb = {
      collection: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(new Promise(() => {})), // Never resolves
        }),
      }),
    };

    await expect(verifyFirestoreReadiness(hangingDb, 50)).rejects.toThrow("Firestore readiness verification timed out after 50ms");
  });

  it("Test H (FAIL CLOSED ON PERMISSION DENIED OR READINESS FAILURE): rejects immediately and does not start worker or server", async () => {
    const permDeniedDb = {
      collection: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockRejectedValue(new Error("7 PERMISSION_DENIED: Missing or insufficient permissions.")),
        }),
      }),
    };

    // Probe must throw fail-closed
    await expect(verifyFirestoreReadiness(permDeniedDb, 500)).rejects.toThrow("Firestore readiness verification failed");

    // Bootstrap must reject fail-closed without starting worker or server
    let serverStarted = false;
    let workerStarted = false;

    const hooks: BootstrapLifecycleHooks = {
      initFirebase: vi.fn().mockResolvedValue({ app: mockApp, db: permDeniedDb }),
      verifyFirestore: vi.fn().mockImplementation(async (db: any) => {
        return verifyFirestoreReadiness(db, 500);
      }),
      queue: mockQueue,
      registerHandlers: vi.fn().mockImplementation(() => {
        for (const type of REQUIRED_INTELLIGENCE_HANDLERS) {
          mockQueue.registerHandler(type, vi.fn() as any);
        }
      }),
      startWorker: vi.fn().mockImplementation(() => {
        workerStarted = true;
      }),
      startHttpServer: vi.fn().mockImplementation(() => {
        serverStarted = true;
        return { listen: vi.fn() };
      }),
    };

    await expect(runBootstrapSequence(hooks)).rejects.toThrow("Firestore readiness verification failed");
    expect(serverStarted).toBe(false);
    expect(workerStarted).toBe(false);
    expect(mockQueue.isWorkerActive()).toBe(false);
  });

  it("Test I (FAIL CLOSED ON NULL DB): rejects if db instance is null or missing", async () => {
    let serverStarted = false;
    let workerStarted = false;

    const hooks: BootstrapLifecycleHooks = {
      initFirebase: vi.fn().mockResolvedValue({ app: mockApp, db: null as any }),
      verifyFirestore: vi.fn(),
      queue: mockQueue,
      registerHandlers: vi.fn(),
      startWorker: vi.fn().mockImplementation(() => {
        workerStarted = true;
      }),
      startHttpServer: vi.fn().mockImplementation(() => {
        serverStarted = true;
      }),
    };

    await expect(runBootstrapSequence(hooks)).rejects.toThrow("Failed to obtain valid Firestore database instance");
    expect(serverStarted).toBe(false);
    expect(workerStarted).toBe(false);
  });
});

