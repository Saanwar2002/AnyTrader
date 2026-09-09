/**
 * Centralized Formal State Machine Engine for AnyTrader V6
 * Mathematically forbids invalid status jumps, out-of-order execution,
 * and malicious state manipulation across Jobs, Milestones, Payments, and Rides.
 */
import { BadRequestError, ConflictError } from "./httpErrors.ts";

export class InvalidStateTransitionError extends ConflictError {
  constructor(entity: string, currentStatus: string, targetStatus: string) {
    super(`Invalid ${entity} transition from '${currentStatus}' to '${targetStatus}'.`, {
      entity,
      currentStatus,
      targetStatus,
    });
  }
}

// -------------------------------------------------------------
// 1. Job Lifecycle
// -------------------------------------------------------------
export type JobStatus =
  | "draft"
  | "open"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "disputed";

export const VALID_JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  draft: ["open", "cancelled"],
  open: ["quoted", "accepted", "cancelled"],
  quoted: ["open", "accepted", "cancelled"],
  accepted: ["in_progress", "cancelled", "disputed"],
  in_progress: ["completed", "disputed", "cancelled"],
  completed: ["disputed"],
  disputed: ["completed", "cancelled"],
  cancelled: [], // Terminal
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return VALID_JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateJobTransition(from: JobStatus, to: JobStatus): void {
  if (from === to) return; // Idempotent no-op
  if (!canTransitionJob(from, to)) {
    throw new InvalidStateTransitionError("Job", from, to);
  }
}

// -------------------------------------------------------------
// 2. Milestone Lifecycle
// -------------------------------------------------------------
export type MilestoneStatus =
  | "pending"
  | "funded"
  | "in_progress"
  | "submitted"
  | "approved"
  | "released"
  | "funds_released"
  | "disputed"
  | "refunded";

export const VALID_MILESTONE_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["funded", "refunded"],
  funded: ["in_progress", "released", "funds_released", "refunded", "disputed"],
  in_progress: ["submitted", "disputed", "refunded", "released", "funds_released"],
  submitted: ["approved", "in_progress", "disputed", "released", "funds_released"],
  approved: ["released", "funds_released", "disputed"],
  released: [], // Terminal - cannot be refunded or double-released
  funds_released: [], // Terminal
  disputed: ["released", "funds_released", "refunded"],
  refunded: [], // Terminal - cannot be re-funded or released
};

export function canTransitionMilestone(from: MilestoneStatus, to: MilestoneStatus): boolean {
  const normFrom = from === "funds_released" ? "released" : from;
  const normTo = to === "funds_released" ? "released" : to;
  return (VALID_MILESTONE_TRANSITIONS[normFrom] as readonly string[])?.includes(normTo) ?? false;
}

export function validateMilestoneTransition(from: MilestoneStatus, to: MilestoneStatus): void {
  const normFrom = from === "funds_released" ? "released" : from;
  const normTo = to === "funds_released" ? "released" : to;
  if (normFrom === normTo && normFrom !== "released" && normFrom !== "refunded") return;
  if (!canTransitionMilestone(from, to)) {
    throw new InvalidStateTransitionError("Milestone", from, to);
  }
}

// -------------------------------------------------------------
// 3. Payment & Escrow Lifecycle
// -------------------------------------------------------------
export type PaymentLedgerStatus =
  | "created"
  | "pending_capture"
  | "captured"
  | "escrowed"
  | "disbursed"
  | "failed"
  | "refunded";

export const VALID_PAYMENT_TRANSITIONS: Record<PaymentLedgerStatus, readonly PaymentLedgerStatus[]> = {
  created: ["pending_capture", "captured", "failed"],
  pending_capture: ["captured", "failed"],
  captured: ["escrowed", "refunded"],
  escrowed: ["disbursed", "refunded"],
  disbursed: [], // Terminal
  failed: [], // Terminal
  refunded: [], // Terminal
};

export function canTransitionPayment(from: PaymentLedgerStatus, to: PaymentLedgerStatus): boolean {
  return VALID_PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validatePaymentTransition(from: PaymentLedgerStatus, to: PaymentLedgerStatus): void {
  if (from === to) return;
  if (!canTransitionPayment(from, to)) {
    throw new InvalidStateTransitionError("Payment", from, to);
  }
}

// -------------------------------------------------------------
// 4. AnyRoller Ride Lifecycle
// -------------------------------------------------------------
export type RideStatus =
  | "draft"
  | "requested"
  | "searching"
  | "offered"
  | "accepted"
  | "arriving"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export const VALID_RIDE_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["searching", "requested", "cancelled"],
  requested: ["searching", "offered", "cancelled"],
  searching: ["offered", "cancelled"],
  offered: ["accepted", "searching", "cancelled"],
  accepted: ["arriving", "arrived", "cancelled"],
  arriving: ["arrived", "in_progress", "cancelled"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [], // Terminal
  cancelled: [], // Terminal
};

export function canTransitionRide(from: RideStatus, to: RideStatus): boolean {
  const normFrom = from === "requested" ? "searching" : from;
  return (VALID_RIDE_TRANSITIONS[normFrom] as readonly string[])?.includes(to) ?? false;
}

export function validateRideTransition(from: RideStatus, to: RideStatus): void {
  if (from === to && from !== "completed" && from !== "cancelled") return;
  if (!canTransitionRide(from, to)) {
    throw new InvalidStateTransitionError("Ride", from, to);
  }
}

// -------------------------------------------------------------
// 5. Dispute Lifecycle
// -------------------------------------------------------------
export type DisputeStatus =
  | "opened"
  | "evidence_gathering"
  | "under_review"
  | "resolved_customer"
  | "resolved_trader"
  | "split"
  | "escalated";

export const VALID_DISPUTE_TRANSITIONS: Record<DisputeStatus, readonly DisputeStatus[]> = {
  opened: ["evidence_gathering", "under_review"],
  evidence_gathering: ["under_review"],
  under_review: ["resolved_customer", "resolved_trader", "split", "escalated"],
  escalated: ["resolved_customer", "resolved_trader", "split"],
  resolved_customer: [],
  resolved_trader: [],
  split: [],
};

export function canTransitionDispute(from: DisputeStatus, to: DisputeStatus): boolean {
  return VALID_DISPUTE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateDisputeTransition(from: DisputeStatus, to: DisputeStatus): void {
  if (from === to) return;
  if (!canTransitionDispute(from, to)) {
    throw new InvalidStateTransitionError("Dispute", from, to);
  }
}
