// @vitest-environment node
import { describe, expect, it } from "vitest";
import { quoteCartLines } from "./catalog";
import { orderItemRowsFromQuote, variantTitleFromVariant } from "./orderSnapshots";

describe("orderItemRowsFromQuote", () => {
  it("maps catalog snapshots for a known SKU", () => {
    const quote = quoteCartLines([{ sku: "ZLX-2PK-S", quantity: 1 }]);
    const rows = orderItemRowsFromQuote(quote);
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("ZLX-2PK-S");
    expect(rows[0].quantity).toBe(1);
    expect(rows[0].unit_price_cents).toBeGreaterThan(0);
    expect(rows[0].total_cents).toBe(rows[0].unit_price_cents);
    expect(rows[0].product_title.length).toBeGreaterThan(0);
  });
});

describe("variantTitleFromVariant", () => {
  it("joins size and color", () => {
    expect(variantTitleFromVariant("S", "Black")).toBe("S / Black");
  });

  it("returns null when empty", () => {
    expect(variantTitleFromVariant(undefined, undefined)).toBeNull();
  });
});
