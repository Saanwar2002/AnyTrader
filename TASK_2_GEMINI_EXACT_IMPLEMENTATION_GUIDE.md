# AnyTrader V2 — Task 2 Canonical CreateJob Command — Exact Gemini Implementation Guide

## Purpose

Apply **Task 2 only** to the Task-1-closed source tree. The supplied prepared ZIP contains the intended source implementation. Gemini should use the ZIP and this guide as a deterministic patch, not redesign the solution.

**Baseline:** `AnyTrader-main - 2026-09-30T094204.325.zip`
**Task:** Canonical CreateJob Command
**Do not start:** Task 3 or later. Do not redesign Task 5 lifecycle vocabulary.

## 1. Required production chain

```text
Firebase Auth token
  -> resolveTrustedCanonicalIdentity()
  -> strict CreateJob schema
  -> protected-field rejection
  -> authorization / derived-job relationship checks
  -> Firestore transaction
       -> atomic quota
       -> persistent idempotency
       -> server-generated ID
       -> server timestamps
       -> valid initial state
       -> trusted public projection
  -> JOB_CREATED
```

## 2. Exact files changed

### New

- `src/server/createJobCommand.ts`
- `src/services/jobCommandService.ts`
- `tests/unit/task2CreateJobCommand.test.ts`

### Modified

- `server.ts`
- `firestore.rules`
- `package.json`
- `src/components/PostJobWizard.tsx`
- `src/components/EmergencyJobWizard.tsx`
- `src/components/MyJobs.tsx`
- `src/components/JobDetails.tsx`
- `src/components/PropertyPassportModal.tsx`
- `src/components/Portfolio.tsx`
- `src/services/bomMerchantService.ts`
- `src/services/recurringJobs.ts`
- `tests/unit/firebaseEmulatorSecurityRules.test.ts`
- `TASK_2_GEMINI_EXACT_IMPLEMENTATION_GUIDE.md` (documentation only)

No other production source files should be changed for Task 2 unless a test/build proves a direct dependency requires it.

## 3. `server.ts` — OLD vs NEW

### OLD

The existing `/api/jobs/create` route did all of the following inside the route:

```ts
const homeownerId = (req as any).user.uid;
const rawPayload = req.body;
const sanitizedPayload = sanitizeClientPayload(rawPayload);
// quota was checked with a read before the job write
const jobRef = db.collection("jobs").doc();
await jobRef.set({
  ...sanitizedPayload,
  id: jobRef.id,
  homeownerId,
  status: initialStatus,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
```

### NEW

The route is now a thin production adapter:

```ts
const identity = await resolveTrustedCanonicalIdentity(req as any, async (uid) => {
  const profileSnap = await db!.collection("users").doc(uid).get();
  trustedProfile = profileSnap.exists ? (profileSnap.data() || null) : null;
  return trustedProfile;
});

const quota = resolveCreateJobQuota(trustedProfile, platformConfig, globalTiers);
const result = await executeCreateJobCommand({
  db,
  identity,
  rawPayload: createPayload,
  idempotencyKey,
  quota,
});

res.status(result.wasReplayed ? 200 : 201).json({
  success: true,
  jobId: result.jobId,
  status: result.job.status,
  wasReplayed: result.wasReplayed,
});
```

It accepts both `X-Idempotency-Key` and `Idempotency-Key`. A body `idempotencyKey` is removed before schema validation.

## 4. `src/server/createJobCommand.ts` — NEW FILE

Copy the supplied file **verbatim**. Do not recreate it manually.

It must contain these exports:

```ts
export const JOB_CREATE_PROTECTED_KEYS = new Set([...]);
export const JOB_CREATE_INPUT_SCHEMA = z.object({...}).strict();
export function validateCreateJobInput(...);
export function resolveCreateJobQuota(...);
export async function executeCreateJobCommand(...);
```

### Protected fields: OLD behaviour

The old shared sanitiser silently suppressed protected fields:

```ts
if (protectedSet.has(key)) {
  console.warn(...);
  // field was removed rather than rejected
}
```

### Protected fields: NEW behaviour

CreateJob must reject them:

```ts
const supplied = Object.keys(payload)
  .filter((key) => JOB_CREATE_PROTECTED_KEYS.has(key));

if (supplied.length > 0) {
  throw new BadRequestError(...);
}
```

### Schema

The schema is **strict**. Unknown fields are rejected. The client must not be allowed to smuggle arbitrary fields into the job document.

### Identity

Normal jobs derive `homeownerId` from the trusted canonical identity. The client never supplies the authoritative owner.

Derived BOM and recurring jobs are separately checked against their parent job/schedule before the server derives ownership.

### Lifecycle

Use the existing state machine:

```ts
const initialStatus = "open";
validateJobTransition("draft", initialStatus);
```

Do **not** add `posted` to the state machine in Task 2. Task 5 owns lifecycle vocabulary consolidation.

### Atomic quota

The quota check and quota increment occur inside the same Firestore transaction as the job creation. When the quota document does not exist, the transaction counts existing jobs and creates the quota record in that same transaction. Concurrent creates therefore conflict/retry rather than both passing a stale read.

### Persistent idempotency

Use:

```text
job_creation_idempotency/{sha256(uid + ":" + idempotencyKey)}
```

The idempotency record and job are created in the same transaction. A replay returns the original job ID and does not emit another `JOB_CREATED` event.

### Projection/event

The trusted server job is used to create `public_job_cards/{jobId}` for non-direct jobs. After the transaction commits, dispatch:

```ts
JOB_CREATED
```

## 5. `firestore.rules` — OLD vs NEW

### OLD

`/jobs/{jobId}` had an authenticated `allow create` rule based on client-provided owner fields and state/financial checks.

### NEW

```firestore
// Authoritative job creation is server-only. Clients must use /api/jobs/create,
// which binds ownership to verified Firebase Auth, enforces schema/protected-field
// rejection, atomic quota, idempotency, lifecycle validation and projection.
allow create: if false;
```

Do not change this to `isAdmin()`. The authoritative writer is the server/Admin SDK command.

## 6. Client creation-bypass migrations

### `src/components/PostJobWizard.tsx`

**OLD:** direct `doc(collection(db, "jobs"))` + `setDoc()` and client projection.

**NEW:** `createJobViaCommand()`; server owns ID, status, timestamps, counter and projection. Existing edit/update behaviour remains separate.

### `src/components/EmergencyJobWizard.tsx`

**OLD:** direct emergency `/jobs` write + direct public projection.

**NEW:** `createJobViaCommand()`; notification and checkout use the returned server `jobId`.

### `src/components/MyJobs.tsx`

**OLD:** simulation and repost used `addDoc(collection(db, "jobs"))`.

**NEW:** both call `createJobViaCommand()` and remove server-owned fields before sending.

### `src/components/JobDetails.tsx`

**OLD:** repost used direct Firestore job creation.

**NEW:** repost calls `createJobViaCommand()` and navigates using the returned `jobId`.

### `src/components/PropertyPassportModal.tsx`

**OLD:** 1-tap dispatch wrote directly to `/jobs`.

**NEW:** dispatch calls `createJobViaCommand()` with business/job content only.

### `src/components/Portfolio.tsx`

**OLD:** bulk CP12/EICR dispatch used direct `/jobs` writes.

**NEW:** both paths call `createJobViaCommand()`.

### `src/services/bomMerchantService.ts`

**OLD:** courier dispatch used `addDoc(collection(db, "jobs"))`.

**NEW:** courier creation calls `createJobViaCommand()`. The command verifies the parent job relationship and derives the owner server-side.

### `src/services/recurringJobs.ts`

**OLD:** recurring generation selected a client Firestore ID and wrote `status`, timestamps and owner directly.

**NEW:** recurring generation calls `createJobViaCommand()` with a deterministic schedule/date idempotency key. The command derives schedule ownership server-side.

### Required source scan

After applying the patch, this must return **zero results**:

```bash
grep -RIn --exclude-dir=node_modules \
  -E 'addDoc\(collection\(db, "jobs"\)|doc\(collection\(db, "jobs"\)|setDoc\(doc\(db, "jobs"' \
  src/components src/services
```

Reads, updates, deletes, and quote subcollections are not direct job-creation bypasses.

## 7. Client helper — NEW FILE

`src/services/jobCommandService.ts` must:

1. require a Firebase `User`;
2. obtain `user.getIdToken()`;
3. call `/api/jobs/create`;
4. send `Authorization: Bearer <token>`;
5. send `X-Idempotency-Key`;
6. throw on non-success responses;
7. return the authoritative `jobId`/status.

Do not put Firestore job creation back into this helper.

## 8. Tests

### New

`tests/unit/task2CreateJobCommand.test.ts` covers:

- protected-field rejection;
- strict unknown-field rejection;
- deterministic quota configuration;
- successful authoritative creation;
- server-owned ID/job number/status/owner/counter;
- trusted public projection;
- exactly one `JOB_CREATED` event;
- idempotent replay;
- concurrent quota race with limit `1` resulting in exactly one job.

### Existing emulator rules test

`tests/unit/firebaseEmulatorSecurityRules.test.ts` adds an authenticated direct `/jobs` creation attack and expects `assertFails()`.

### Package scripts

The normal `test` script excludes the new emulator-dependent Task 2 test. `test:emulator` explicitly includes it. The prepared source also keeps the existing release-audit command unchanged.

## 9. Verification — Gemini MUST run actual commands

```bash
npm install
npm run lint
npm test
npm run test:emulator
npm run build
npm run audit:release
```

Record actual counts and results. Do not claim PASS from source inspection.

Minimum Task 2 evidence:

- protected fields rejected rather than stripped;
- unknown schema fields rejected;
- direct client `/jobs` create denied by emulator rules;
- concurrent quota race produces exactly one successful job at quota `1`;
- idempotent retry returns the original job ID;
- retry does not emit another `JOB_CREATED`;
- server-generated ID/timestamps/owner/status/counter verified;
- public projection verified;
- zero direct client `/jobs` creation calls remain;
- lint, full tests, emulator tests, build and release audit all recorded.

## 10. Gemini must not change these decisions

- Do not create a second identity/auth system.
- Do not restore client `/jobs` create permission.
- Do not silently strip protected fields.
- Do not make the UI-generated ID authoritative.
- Do not move quota checking back outside the transaction.
- Do not replace persistent idempotency with an in-memory map.
- Do not introduce `posted` into the state machine for Task 2.
- Do not start Task 3+.

If a test fails, diagnose it against the supplied prepared source and this guide. Do not invent a parallel implementation.

## 11. Prepared-source handling

The supplied modified ZIP is the reference implementation. Gemini should copy the changed files from that ZIP or reproduce the exact edits from this guide; it should not improvise alternate fixes. The separate `.patch` file is provided as a machine-readable diff from the Task-1-closed baseline.

Before reporting completion, Gemini must verify the repository against the exact changed-file list and the zero-direct-create scan above.
