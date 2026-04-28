import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumePurchaseAnalyticsSlot,
  resetPurchaseDedupeForTests,
} from "./purchaseDedupe";

describe("consumePurchaseAnalyticsSlot", () => {
  beforeEach(() => {
    resetPurchaseDedupeForTests();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows first emission and blocks duplicate via sessionStorage", () => {
    expect(consumePurchaseAnalyticsSlot("ORD-1")).toBe(true);
    expect(consumePurchaseAnalyticsSlot("ORD-1")).toBe(false);
  });

  it("uses distinct keys per order", () => {
    expect(consumePurchaseAnalyticsSlot("A")).toBe(true);
    expect(consumePurchaseAnalyticsSlot("B")).toBe(true);
  });

  it("falls back to module dedupe when sessionStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(consumePurchaseAnalyticsSlot("ORD-strict")).toBe(true);
    expect(consumePurchaseAnalyticsSlot("ORD-strict")).toBe(false);
  });
});
