import { describe, expect, it } from "vitest";
import {
  effectiveMaxLineQuantity,
  maxCheckoutUnitsForVariant,
  STOREFRONT_MAX_UNITS_PER_LINE,
} from "./orderLimits";

describe("orderLimits", () => {
  it("effective max is the smaller of sanitized inventory and per-order policy", () => {
    expect(effectiveMaxLineQuantity(999)).toBe(STOREFRONT_MAX_UNITS_PER_LINE);
    expect(effectiveMaxLineQuantity(3)).toBe(3);
  });

  it("aliases maxCheckoutUnitsForVariant to effectiveMaxLineQuantity", () => {
    expect(maxCheckoutUnitsForVariant(999)).toBe(effectiveMaxLineQuantity(999));
  });

  it("sanitizes non-positive inventory to zero", () => {
    expect(effectiveMaxLineQuantity(0)).toBe(0);
    expect(effectiveMaxLineQuantity(-1)).toBe(0);
  });

  it("treats non-finite inventory as zero", () => {
    expect(effectiveMaxLineQuantity(Number.NaN)).toBe(0);
    expect(effectiveMaxLineQuantity(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("floors fractional inventory before applying policy cap", () => {
    expect(effectiveMaxLineQuantity(4.9)).toBe(4);
  });
});
