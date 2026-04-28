import { describe, expect, it } from "vitest";
import {
  allowedFulfillmentTargets,
  assertFulfillmentTransition,
  isPaidFulfillmentTransitionAllowed,
} from "./fulfillmentTransitions";
import type { FulfillmentStatus, PaymentStatus } from "./enums";

describe("allowedFulfillmentTargets", () => {
  it("returns forward + cancel for paid processing", () => {
    expect(allowedFulfillmentTargets("processing", "paid").sort()).toEqual(
      ["canceled", "packed"].sort(),
    );
  });

  it("returns forward + cancel for paid packed", () => {
    expect(allowedFulfillmentTargets("packed", "paid").sort()).toEqual(
      ["canceled", "shipped"].sort(),
    );
  });

  it("returns only delivered for paid shipped", () => {
    expect(allowedFulfillmentTargets("shipped", "paid")).toEqual(["delivered"]);
  });

  it.each<[FulfillmentStatus, PaymentStatus]>([
    ["delivered", "paid"],
    ["canceled", "paid"],
    ["processing", "pending_payment"],
    ["processing", "partially_refunded"],
    ["packed", "refunded"],
  ])("returns empty for terminal or unpaid (%s, %s)", (status, pay) => {
    expect(allowedFulfillmentTargets(status, pay)).toEqual([]);
  });
});

describe("isPaidFulfillmentTransitionAllowed", () => {
  const allowed: [FulfillmentStatus, FulfillmentStatus][] = [
    ["processing", "packed"],
    ["processing", "canceled"],
    ["packed", "shipped"],
    ["packed", "canceled"],
    ["shipped", "delivered"],
  ];

  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(isPaidFulfillmentTransitionAllowed(from, to)).toBe(true);
  });

  const rejected: [FulfillmentStatus, FulfillmentStatus][] = [
    ["processing", "shipped"],
    ["processing", "delivered"],
    ["packed", "delivered"],
    ["packed", "packed"],
    ["shipped", "canceled"],
    ["shipped", "packed"],
    ["delivered", "packed"],
    ["canceled", "packed"],
  ];

  it.each(rejected)("rejects %s → %s", (from, to) => {
    expect(isPaidFulfillmentTransitionAllowed(from, to)).toBe(false);
  });
});

describe("assertFulfillmentTransition", () => {
  it("allows idempotent same status", () => {
    expect(() =>
      assertFulfillmentTransition("processing", "processing", "pending_payment"),
    ).not.toThrow();
  });

  it("throws not_paid when advancing unpaid order", () => {
    expect(() => assertFulfillmentTransition("processing", "packed", "pending_payment")).toThrow(
      /paid/,
    );
  });

  it("throws invalid_transition for skip hop", () => {
    expect(() => assertFulfillmentTransition("processing", "shipped", "paid")).toThrow(
      /not allowed/,
    );
  });

  it("throws terminal_state from delivered", () => {
    expect(() => assertFulfillmentTransition("delivered", "shipped", "paid")).toThrow(/final/);
  });
});
