# Task 17 — Property AI Security Boundary

## Status

VERIFIED

## Verified Commit

`9019dc2bd4a0e966121f695c484adec487ae8e45`

## Objective

Task 17 establishes the mandatory security boundary between untrusted AI-generated property candidates and authoritative AnyTrader property intelligence.

## Production Security Path

```
AI Provider
→ Untrusted Candidate
→ processAICandidateToCanonical()
→ Structural Schema Validation
→ Server-Owned Metadata
→ Evidence Lineage Validation
→ Deterministic Canonicalization
→ Immutable Intelligence Persistence
→ Property Intelligence Projection
```

## Production Implementation

In `src/server/intelligence/propertyIntelligence.ts`, untrusted AI outputs are never directly projected into property intelligence records. Instead, all raw candidates are routed through `processAICandidateToCanonical()`:

```ts
const { canonical } = await processAICandidateToCanonical(
  rawCandidateObj,
  serverContext,
  {
    firestoreDb: activeDb,
    persistToStore: false,
  }
);
```

### Security Boundary Guarantees

1. **Untrusted Input Isolation**: All provider outputs are treated as untrusted JSON input and subjected to Zod structural schema validation.
2. **Server-Owned Metadata Authority**: Critical aggregate metadata (`aggregateType`, `aggregateId`, `tenantId`, `sourceVersion`, `createdAt`, `schemaVersion`, `provenance`) is strictly server-derived and overrides any claims from the model.
3. **Evidence Lineage Validation**: Candidates must cite existing, valid evidence items associated with the aggregate; references to fabricated evidence or evidence belonging to other entities fail closed with `AICandidateSecurityError`.
4. **Deterministic Canonicalization**: Canonical forms ensure consistent hashing, deterministic ordering, and deduplication.
5. **Immutable Intelligence Persistence**: Validated aggregates are persisted to the immutable intelligence store with full cryptographic provenance.
6. **Property Intelligence Projection**: Authoritative property rollup and digital passport specs project solely from validated canonical structures.

## Verification & Test Results

### Real Firebase Emulator CI Gate

The real Firebase emulator test suite verified security rules, concurrency, Tier-B raw storage, and the Property AI security boundary:

- `tests/unit/firebaseEmulatorSecurityRules.test.ts`
- `tests/unit/firebaseEmulatorIntelligenceV81.test.ts`
- `tests/unit/task16TierBStorage.test.ts`
- `tests/unit/task17PropertySecurity.test.ts`

**Result**: 4 test files passed, 229 tests passed (100% pass rate).

### Task 17 Security Boundary Suite

`tests/unit/task17PropertySecurity.test.ts`:
- **10/10 tests passed**
- Verified valid candidate persistence through production pipeline
- Verified server-owned metadata overrides model claims
- Verified rejection of server-owned metadata hijack attempts
- Verified fail-closed defense against fabricated evidence citations
- Verified fail-closed defense against cross-property evidence citations
- Verified fail-closed rejection of structural schema violations
- Verified immutable persistence and idempotent re-execution without duplicate historical records
- Verified fail-closed behavior on null database references
- Verified end-to-end `property_rollup` task execution via `intelligenceTaskQueue`
- Verified dead-letter routing upon security boundary rejection in real emulator
