const fs = require('fs');
const path = require('path');
const bp = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));

bp.entities.InstantMatch = {
  title: "InstantMatch",
  description: "Represents an Instant Match session for a job.",
  type: "object",
  properties: {
    id: { type: "string" },
    jobId: { type: "string" },
    customerId: { type: "string" },
    chargeAmountPence: { type: "integer" },
    chargeTier: { type: "string", enum: ["free", "instant_match", "emergency"] },
    feeWaived: { type: "boolean" },
    stripePaymentIntent: { type: "string" },
    stripeRefundId: { type: "string" },
    status: { type: "string", enum: ["pending", "searching", "matched", "accepted", "expired", "refunded", "cancelled"] },
    matchedTraderId: { type: "string" },
    matchScore: { type: "number" },
    currentAttempt: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
    searchingAt: { type: "string", format: "date-time" },
    matchedAt: { type: "string", format: "date-time" },
    expiredAt: { type: "string", format: "date-time" },
    refundedAt: { type: "string", format: "date-time" },
    cancelledAt: { type: "string", format: "date-time" },
    refundReason: { type: "string" }
  },
  required: ["id", "jobId", "customerId", "status", "currentAttempt", "createdAt"]
};

bp.entities.InstantMatchAttempt = {
  title: "InstantMatchAttempt",
  description: "A notification attempt sent to a specific trader for an Instant Match.",
  type: "object",
  properties: {
    id: { type: "string" },
    instantMatchId: { type: "string" },
    attemptNumber: { type: "integer" },
    traderId: { type: "string" },
    traderCompositeScore: { type: "number" },
    status: { type: "string", enum: ["pending", "notified", "accepted", "declined", "timeout"] },
    createdAt: { type: "string", format: "date-time" },
    notifiedAt: { type: "string", format: "date-time" },
    respondedAt: { type: "string", format: "date-time" },
    expiresAt: { type: "string", format: "date-time" },
    responseTimeSeconds: { type: "integer" }
  },
  required: ["id", "instantMatchId", "attemptNumber", "traderId", "status", "createdAt"]
};

bp.entities.TraderMatchScore = {
  title: "TraderMatchScore",
  description: "Trader scores for Instant Match targeting based on category.",
  type: "object",
  properties: {
    traderId: { type: "string" },
    categoryId: { type: "string" },
    score: { type: "number" },
    reliability: { type: "number" },
    speed: { type: "number" },
    quality: { type: "number" },
    lastUpdated: { type: "string", format: "date-time" }
  },
  required: ["traderId", "categoryId", "score", "lastUpdated"]
};

bp.entities.Job.properties.instantMatchId = { type: "string" };
bp.entities.Job.properties.matchedViaInstantMatch = { type: "boolean" };
bp.entities.Job.properties.isInstantMatch = { type: "boolean" };
bp.entities.Job.properties.isEmergencyBoost = { type: "boolean" };

bp.firestore["/instant_matches/{matchId}"] = {
  schema: "InstantMatch",
  description: "Instant Match sessions"
};

bp.firestore["/instant_match_attempts/{attemptId}"] = {
  schema: "InstantMatchAttempt",
  description: "Notification attempts for an Instant Match"
};

bp.firestore["/users/{userId}/trader_match_scores/{categoryId}"] = {
  schema: "TraderMatchScore",
  description: "Trader match scores per category"
};

fs.writeFileSync('firebase-blueprint.json', JSON.stringify(bp, null, 2));

console.log("Updated firebase-blueprint.json");
