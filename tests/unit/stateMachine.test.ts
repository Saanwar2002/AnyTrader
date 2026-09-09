import { describe, it, expect } from "vitest";
import {
  canTransitionJob,
  validateJobTransition,
  canTransitionMilestone,
  validateMilestoneTransition,
  canTransitionPayment,
  validatePaymentTransition,
  canTransitionRide,
  validateRideTransition,
  InvalidStateTransitionError,
} from "../../src/server/stateMachine.ts";

describe("State Machine Engine", () => {
  describe("Job Transitions", () => {
    it("allows valid sequential transitions", () => {
      expect(canTransitionJob("draft", "open")).toBe(true);
      expect(canTransitionJob("open", "accepted")).toBe(true);
      expect(canTransitionJob("accepted", "in_progress")).toBe(true);
      expect(canTransitionJob("in_progress", "completed")).toBe(true);
    });

    it("rejects illegal skip jumps (e.g. draft to completed)", () => {
      expect(canTransitionJob("draft", "completed")).toBe(false);
      expect(() => validateJobTransition("draft", "completed")).toThrow(InvalidStateTransitionError);
    });

    it("forbids transitions from terminal cancelled state", () => {
      expect(canTransitionJob("cancelled", "open")).toBe(false);
      expect(canTransitionJob("cancelled", "completed")).toBe(false);
      expect(() => validateJobTransition("cancelled", "open")).toThrow(InvalidStateTransitionError);
    });

    it("permits idempotent self-transitions without error", () => {
      expect(() => validateJobTransition("open", "open")).not.toThrow();
    });
  });

  describe("Milestone Escrow Transitions", () => {
    it("allows pending to funded", () => {
      expect(canTransitionMilestone("pending", "funded")).toBe(true);
    });

    it("allows submitted to approved to released", () => {
      expect(canTransitionMilestone("submitted", "approved")).toBe(true);
      expect(canTransitionMilestone("approved", "released")).toBe(true);
    });

    it("strictly forbids re-releasing or refunding once released", () => {
      expect(canTransitionMilestone("released", "released")).toBe(false);
      expect(canTransitionMilestone("released", "refunded")).toBe(false);
      expect(canTransitionMilestone("released", "funded")).toBe(false);
      expect(() => validateMilestoneTransition("released", "refunded")).toThrow(InvalidStateTransitionError);
    });

    it("strictly forbids releasing once refunded", () => {
      expect(canTransitionMilestone("refunded", "released")).toBe(false);
      expect(() => validateMilestoneTransition("refunded", "released")).toThrow(InvalidStateTransitionError);
    });
  });

  describe("Payment Ledger Transitions", () => {
    it("validates payment progression from created to escrowed to disbursed", () => {
      expect(canTransitionPayment("created", "captured")).toBe(true);
      expect(canTransitionPayment("captured", "escrowed")).toBe(true);
      expect(canTransitionPayment("escrowed", "disbursed")).toBe(true);
    });

    it("forbids disbursement directly from created", () => {
      expect(canTransitionPayment("created", "disbursed")).toBe(false);
      expect(() => validatePaymentTransition("created", "disbursed")).toThrow(InvalidStateTransitionError);
    });
  });

  describe("AnyRoller Ride Transitions", () => {
    it("allows ride flow: searching -> offered -> accepted -> arriving -> in_progress -> completed", () => {
      expect(canTransitionRide("searching", "offered")).toBe(true);
      expect(canTransitionRide("offered", "accepted")).toBe(true);
      expect(canTransitionRide("accepted", "arriving")).toBe(true);
      expect(canTransitionRide("arriving", "in_progress")).toBe(true);
      expect(canTransitionRide("in_progress", "completed")).toBe(true);
    });

    it("rejects completed to in_progress or cancelled", () => {
      expect(canTransitionRide("completed", "in_progress")).toBe(false);
      expect(canTransitionRide("completed", "cancelled")).toBe(false);
    });
  });
});
