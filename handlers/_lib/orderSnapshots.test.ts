// @vitest-environment node
import { describe, expect, it } from "vitest";
import { quoteCartLines } from "./catalog";
import { orderItemRowsFromQuote, variantTitleFromVariant } from "./orderSnapshots";

describe("orderItemRowsFromQuote", () => {
  it("maps catalog snapshots for a known SKU", () => {
    const quote = quoteCartLines([{ sku: "ZLX-2PK-S", quantity: 1 }]);
    const rows = orderItemRowsFromQuote(quote, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("ZLX-2PK-S");
    expect(rows[0].quantity).toBe(1);
    expect(rows[0].unit_price_cents).toBeGreaterThan(0);
    expect(rows[0].total_cents).toBe(rows[0].unit_price_cents);
    expect(rows[0].product_title.length).toBeGreaterThan(0);
    expect(rows[0].variant_options_snapshot).toBeNull();
  });

  it("persists variant_display_snapshot into variant_title and json snapshot", () => {
    const quote = quoteCartLines([{ sku: "ZLX-2PK-S", quantity: 1 }]);
    const snap = [
      { axis_label: "Size", option_label: "M" },
      { axis_label: "Color", option_label: "Black" },
    ];
    const rows = orderItemRowsFromQuote(quote, [
      { sku: "ZLX-2PK-S", quantity: 1, variant_display_snapshot: snap },
    ]);
    expect(rows[0].variant_title).toBe("M / Black");
    expect(rows[0].variant_options_snapshot).toEqual(snap);
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
