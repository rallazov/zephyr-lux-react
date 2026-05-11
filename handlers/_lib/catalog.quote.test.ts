// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isQuoteError, QuoteError, quoteCartLines } from "./catalog";

describe("quoteCartLines", () => {
  it("accepts legacy BLK/BLU-prefixed boxer-brief SKU and returns canonical ZLX-2PK pack SKU", () => {
    const q = quoteCartLines([{ sku: "ZLX-BLK-L", quantity: 1 }]);
    expect(q.lines[0]!.sku).toBe("ZLX-2PK-L");
    expect(q.lines[0]!.unit_cents).toBe(1899);
  });

  it("prices short-leg boxer (ZLX-2PK-S) with bundled catalog cents + tax/shipping", () => {
    const q = quoteCartLines([{ sku: "ZLX-2PK-S", quantity: 1 }]);
    expect(q.lines[0]!.line_cents).toBe(1899);
    expect(q.subtotal_cents).toBe(1899);
    expect(q.shipping_cents).toBe(500);
    expect(q.tax_cents).toBe(133);
    expect(q.total_cents).toBe(1899 + 500 + 133);
  });

  it("prices long-leg boxer separately from short-leg", () => {
    const q = quoteCartLines([{ sku: "ZLX-2PK-LONG-M", quantity: 1 }]);
    expect(q.lines[0]!.sku).toBe("ZLX-2PK-LONG-M");
    expect(q.lines[0]!.unit_cents).toBe(1699);
  });

  it("resolves unit and line cents from bundled catalog by SKU only (no display metadata on quote lines)", () => {
    const q = quoteCartLines([{ sku: "ZLX-2PK-M", quantity: 1 }]);
    expect(q.lines[0]!.sku).toBe("ZLX-2PK-M");
    expect(q.lines[0]!.unit_cents).toBe(1899);
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
    expect(q.subtotal_cents).toBe(3798);
  });

  it("rejects quantity above per-order line cap", () => {
    let err: unknown;
    try {
      quoteCartLines([{ sku: "ZLX-2PK-S", quantity: 6 }]);
    } catch (e) {
      err = e;
    }
    expect(isQuoteError(err)).toBe(true);
    expect((err as QuoteError).code).toBe("QUANTITY_EXCEEDS_CAP");
  });

  it("rejects merged quantities above per-order line cap", () => {
    let err: unknown;
    try {
      quoteCartLines([
        { sku: "ZLX-2PK-S", quantity: 4 },
        { sku: "ZLX-2PK-S", quantity: 2 },
      ]);
    } catch (e) {
      err = e;
    }
    expect(isQuoteError(err)).toBe(true);
    expect((err as QuoteError).code).toBe("QUANTITY_EXCEEDS_CAP");
  });
});
