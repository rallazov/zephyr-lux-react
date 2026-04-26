// @vitest-environment node
import { describe, expect, it } from "vitest";
import { QuoteError, quoteCartLines } from "./catalog";

describe("quoteCartLines", () => {
  it("prices a known line and order totals (ZLX-BLK-S)", () => {
    const q = quoteCartLines([{ sku: "ZLX-BLK-S", quantity: 1 }]);
    expect(q.lines[0]!.line_cents).toBe(2400);
    expect(q.subtotal_cents).toBe(2400);
    expect(q.shipping_cents).toBe(500);
    expect(q.tax_cents).toBe(168);
    expect(q.total_cents).toBe(2400 + 500 + 168);
  });

  it("rejects unknown SKU with QuoteError", () => {
    expect(() => quoteCartLines([{ sku: "unknown-sku-xyz", quantity: 1 }])).toThrow(QuoteError);
  });

  it("rejects invalid quantity (non-positive int)", () => {
    expect(() => quoteCartLines([{ sku: "ZLX-BLK-S", quantity: 0 as unknown as number }])).toThrow(QuoteError);
  });

  it("merges duplicate skus in one request (quantities sum)", () => {
    const q = quoteCartLines([
      { sku: "ZLX-BLK-S", quantity: 1 },
      { sku: "ZLX-BLK-S", quantity: 1 },
    ]);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]!.quantity).toBe(2);
    expect(q.subtotal_cents).toBe(4800);
  });
});
