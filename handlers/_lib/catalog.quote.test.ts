// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isQuoteError, QuoteError, quoteCartLines } from "./catalog";

describe("quoteCartLines", () => {
  it("prices a known line and order totals (ZLX-2PK-S)", () => {
    const q = quoteCartLines([{ sku: "ZLX-2PK-S", quantity: 1 }]);
    expect(q.lines[0]!.line_cents).toBe(2400);
    expect(q.subtotal_cents).toBe(2400);
    expect(q.shipping_cents).toBe(500);
    expect(q.tax_cents).toBe(168);
    expect(q.total_cents).toBe(2400 + 500 + 168);
  });

  it("rejects unknown SKU with QuoteError", () => {
    expect(() => quoteCartLines([{ sku: "unknown-sku-xyz", quantity: 1 }])).toThrow(QuoteError);
  });

  it("rejects coming_soon SKU with NOT_FOR_SALE QuoteError", () => {
    let err: unknown;
    try {
      quoteCartLines([{ sku: "ZLX-SALE-ARCHIVE-PLACEHOLDER", quantity: 1 }]);
    } catch (e) {
      err = e;
    }
    expect(isQuoteError(err)).toBe(true);
    expect(err).toMatchObject({ code: "NOT_FOR_SALE" });
  });

  it("rejects invalid quantity (non-positive int)", () => {
    expect(() => quoteCartLines([{ sku: "ZLX-2PK-S", quantity: 0 as unknown as number }])).toThrow(QuoteError);
  });

  it("merges duplicate skus in one request (quantities sum)", () => {
    const q = quoteCartLines([
      { sku: "ZLX-2PK-S", quantity: 1 },
      { sku: "ZLX-2PK-S", quantity: 1 },
    ]);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]!.quantity).toBe(2);
    expect(q.subtotal_cents).toBe(4800);
  });
});
