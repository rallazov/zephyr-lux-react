import { describe, expect, it } from "vitest";
import {
  ADMIN_ORDER_LIST_PAGE_SIZE,
  FULFILLMENT_TERMINAL_POSTGREST_IN,
  ORDER_LIST_PAYMENT_STATUSES,
  TEMPLATE_OWNER_ORDER_PAID,
  formatOrderDateUtc,
  formatOrderMoney,
  getLineItemCount,
  humanizeEnum,
  isOpenFulfillment,
} from "./adminOrderListHelpers";

describe("isOpenFulfillment", () => {
  it("is true for paid and non-terminal fulfillment", () => {
    expect(isOpenFulfillment("paid", "processing")).toBe(true);
    expect(isOpenFulfillment("paid", "packed")).toBe(true);
  });
  it("is false for shipped, delivered, canceled", () => {
    expect(isOpenFulfillment("paid", "shipped")).toBe(false);
    expect(isOpenFulfillment("paid", "delivered")).toBe(false);
    expect(isOpenFulfillment("paid", "canceled")).toBe(false);
  });
  it("is false when not paid", () => {
    expect(isOpenFulfillment("pending_payment", "processing")).toBe(false);
  });
});

describe("formatOrderMoney", () => {
  it("formats cents for USD", () => {
    expect(formatOrderMoney(1999, "usd")).toMatch(/19/);
  });
});

describe("formatOrderDateUtc", () => {
  it("appends UTC label", () => {
    const s = formatOrderDateUtc("2025-11-20T12:00:00.000Z");
    expect(s).toContain("UTC");
  });
});

describe("getLineItemCount", () => {
  it("reads count from array aggregate", () => {
    expect(getLineItemCount([{ count: 3 }])).toBe(3);
  });
  it("reads count from object form", () => {
    expect(getLineItemCount({ count: 2 })).toBe(2);
  });
});

describe("helpers metadata", () => {
  it("exposes page size and template", () => {
    expect(ADMIN_ORDER_LIST_PAGE_SIZE).toBeGreaterThanOrEqual(25);
    expect(TEMPLATE_OWNER_ORDER_PAID).toBe("owner_order_paid");
  });
  it("FULFILLMENT_TERMINAL_POSTGREST_IN matches OPEN terminal set order", () => {
    expect(FULFILLMENT_TERMINAL_POSTGREST_IN).toBe("(shipped,delivered,canceled)");
  });
  it("ORDER_LIST_PAYMENT_STATUSES aligns with story default paid list filter", () => {
    expect(ORDER_LIST_PAYMENT_STATUSES).toEqual(["paid", "partially_refunded"]);
  });
  it("humanizeEnum", () => {
    expect(humanizeEnum("partially_refunded")).toBe("partially refunded");
  });
});
