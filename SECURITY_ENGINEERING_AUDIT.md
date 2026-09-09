# 🛡️ ANYTRADER V6 — SECURITY ENGINEERING AUDIT & THREAT MODEL

## 1. Threat Model & Trust Boundaries

AnyTrader operates across multiple user roles: Customers, Tradespeople, Drivers, Business Managers, and Platform Administrators.

### Primary Trust Boundaries
1. **Client Browser / Capacitor App ↔ Server API**:
   - The client browser is untrusted. All parameters (`userId`, `role`, `amount`, `platformFee`, `status`) sent by the client must be verified server-side.
2. **Server API ↔ Firebase Firestore & Storage**:
   - Firestore security rules act as a secondary defense layer (`default deny`).
   - Server Admin SDK acts with elevated privileges and must validate ownership prior to mutating shared documents.
3. **Stripe ↔ AnyTrader Server**:
   - Webhooks are verified with HMAC SHA256 (`stripe.webhooks.constructEvent`). Missing signatures fail closed with HTTP 400.
   - Client prices are strictly ignored; all billing amounts derive from server catalogs or Stripe metadata.
4. **AI (Gemini) ↔ Core System**:
   - Gemini functions provide recommendation, transcription, and pricing analytics.
   - Core Invariant: **AI output cannot directly release escrow funds, modify user roles, or bypass security rules.**

---

## 2. Attack Vectors & Mitigations

### Vector A: Broken Object-Level Authorization (BOLA / IDOR)
- **Threat**: Customer A modifies Customer B's job; Trader A attempts to release funds on Trader B's milestone.
- **Mitigation**: `assertResourceOwner(user, resourceOwnerId)` and `assertCanManageMilestone(...)` in `src/server/authorization.ts` enforce that the caller's verified JWT UID matches the target resource owner.

### Vector B: Mass Assignment & Privilege Escalation
- **Threat**: Caller injects `{ "role": "admin", "isAdmin": true, "platformFee": 0 }` into update payloads.
- **Mitigation**: `sanitizeClientPayload(...)` strips all server-owned, financial, and privilege keys from request bodies.

### Vector C: Out-of-Order State Machine Attacks
- **Threat**: Attacker attempts to skip from `draft` directly to `completed`, or attempts to release escrow funds on a cancelled/refunded milestone.
- **Mitigation**: `stateMachine.ts` validates that every transition exists in the valid transition table. Illegal transitions throw `InvalidStateTransitionError`.

### Vector D: Race Conditions & Duplicate Webhook Replay
- **Threat**: Double execution of milestone release or duplicate Stripe webhook delivery results in duplicate trader payouts.
- **Mitigation**: `PaymentLedgerEngine.executeIdempotentOperation(...)` utilizes atomic locks on `payment_idempotency` documents. Replayed calls return cached responses without re-executing transactions.

### Vector E: Information Leakage via Stack Traces
- **Threat**: Unhandled exceptions leak database internals, local container paths, or API keys in response JSON.
- **Mitigation**: `httpErrors.ts` and `sendHttpError(...)` suppress raw stack traces and internal paths in production, providing sanitized messages and unique correlation IDs (`err_...`).
