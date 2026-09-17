# Investigation Report: Task 13E Concurrency & Lease Behavior

After a thorough inspection of `src/server/intelligence/intelligenceTaskQueue.ts` and `tests/unit/firebaseEmulatorIntelligenceV81.test.ts`, below is the breakdown of the 9 critical concurrency invariants, their expected behavior, and an analysis of the root cause behind their previous failures.

## 1. Invariant 1: Atomic Task Claiming
- **Test Name:** `Task 13E Invariant 1: Concurrent claim gives exactly one winner on real Firestore emulator` (Line 1546)
- **Production Method:** `claimTaskTransactional()`
- **Expected Transition:** When 3 concurrent workers attempt to claim a single `pending` task, exactly 1 succeeds (updating `status` to `processing`, setting `workerId` and `leaseId`), while the other 2 return null.
- **Actual Transition (When Failing):** The seeded document (`task_emu_race_*`) vanished mid-execution, causing the Firestore transaction to abort due to a missing document instead of correctly locking the row.
- **Evidence Indicates:** **Emulator/Test-Environment Issue.** The test database was purged by a concurrently running test file.

## 2. Invariant 2: Active Foreign Lease Protection
- **Test Name:** `Task 13E Invariant 2: Active foreign lease with max attempts prevents claim and prevents premature dead-lettering` (Line 1589)
- **Production Method:** `claimTaskTransactional()`
- **Expected Transition:** A task with `status === 'processing'`, a foreign `workerId`, and an unexpired `leaseExpiresAt` remains untouched. Even if `attempts === maxAttempts`, it is NOT prematurely dead-lettered until the lease fully expires.
- **Actual Transition (When Failing):** The task document disappeared from the emulator.
- **Evidence Indicates:** **Emulator/Test-Environment Issue.**

## 3. Invariant 3: Stale Recovery
- **Test Name:** `Task 13E Invariant 3: Stale reclaim clears old workerId and leaseId upon recovery in real Firestore` (Line 1630)
- **Production Method:** `recoverStaleTasksAsync()`
- **Expected Transition:** Queries tasks with `status === 'processing'` and `leaseExpiresAt < now`. It transitions them to `retrying` (or `dead_letter`), nullifying `workerId`, `leaseId`, and `leaseExpiresAt`.
- **Actual Transition (When Failing):** No tasks were found in the query because the emulator database had been purged. 
- **Evidence Indicates:** **Emulator/Test-Environment Issue.**

## 4. Invariant 4: Old Worker Finalization (Failure)
- **Test Name:** `Task 13E Invariant 4: Old worker cannot finalize failure after lease reclaim on real Firestore` (Line 1692)
- **Production Method:** `executeTaskAsync()` (Failure finalization transaction block)
- **Expected Transition:** If a worker's lease expires and another worker claims it, the old worker attempting to log a failure will throw `OwnershipLostError` and abort the state write, leaving the new worker's claim intact.
- **Actual Transition (When Failing):** The transaction aborted unexpectedly due to a missing document rather than throwing a clean `OwnershipLostError` based on a mismatched `leaseId`.
- **Evidence Indicates:** **Emulator/Test-Environment Issue.**

## 5. Invariant 5: Old Worker Finalization (Success)
- **Test Name:** `Task 13E Invariant 5: Old worker cannot finalize success after lease reclaim on real Firestore` (Line 1767)
- **Production Method:** `executeTaskAsync()` (Success finalization transaction block)
- **Expected Transition:** Same as Invariant 4, but for success. Write is aborted with `OwnershipLostError` if `leaseId` or `workerId` no longer match.
- **Actual Transition (When Failing):** Missing document.
- **Evidence Indicates:** **Emulator/Test-Environment Issue.**

## 6. Invariant 6: Different Worker Finalization Rejection
- **Test Name:** `Task 13E Invariant 6: Different worker cannot finalize success or failure on real Firestore` (Line 1841)
- **Production Method:** `executeTaskAsync()`
- **Expected Transition:** A worker explicitly simulating a mismatched `leaseId` or `workerId` cannot overwrite the terminal state of a task.
- **Actual Transition (When Failing):** Missing document.
- **Evidence Indicates:** **Emulator/Test-Environment Issue.**

## 7. Invariant 7: Dead-lettering with Ownership Validation
- **Test Name:** `Task 13E Invariant 7: Missing handler dead-letters own task verifying leaseId; foreign worker cannot overwrite` (Line 1901)
- **Production Method:** `executeTaskAsync()`
- **Expected Transition:** A task with a missing handler transitions to `dead_letter` immediately, provided the worker still holds the lease.
- **Actual Transition (When Failing):** Missing document.
- **Evidence Indicates:** **Emulator/Test-Environment Issue.**

## 8. Invariant 8: Terminal State Protection
- **Test Name:** `Task 13E Invariant 8: Terminal states (succeeded, dead_letter) are protected against claim on real Firestore` (Line 1958)
- **Production Method:** `claimTaskTransactional()`
- **Expected Transition:** Tasks marked `succeeded` or `dead_letter` return `null` immediately during a claim attempt and cannot be processed again.
- **Actual Transition (When Failing):** Missing document.
- **Evidence Indicates:** **Emulator/Test-Environment Issue.**

## 9. Invariant 9: Transaction Failure Propagation
- **Test Name:** `Task 13E Invariant 9: Transaction failures in stale recovery propagate without silent swallowing on real Firestore emulator` (Line 2003)
- **Production Method:** `recoverStaleTasksAsync()`
- **Expected Transition:** If the recovery transaction is denied (e.g., by security rules `PERMISSION_DENIED`), the error propagates up the stack and does not swallow silently.
- **Actual Transition (When Failing):** The collection was wiped, so no documents were found, thus no transaction was attempted. This failed the test's expectation that a `PERMISSION_DENIED` error would be actively thrown.
- **Evidence Indicates:** **Emulator/Test-Environment Issue.**

## Conclusion & Proposed Changes
**Defect Classification:** There are **NO production-code defects** within `src/server/intelligence/intelligenceTaskQueue.ts`. 

The previously observed failures were strictly the result of test-environment isolation failure (specifically, Vitest's default file-level parallelism executing `firebaseEmulatorSecurityRules.test.ts` concurrently with the `firebaseEmulatorIntelligenceV81.test.ts` file, leading to one test wiping the database while the other was in the middle of executing a transaction). 

**Proposed Production Code Change:** **None.** The production implementation is mathematically sound and correctly enforces atomic locking, lease timeouts, dead-lettering, and ownership validation via transactional reads and updates.
