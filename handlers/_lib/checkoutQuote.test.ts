// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FLAT_SHIPPING_CENTS, TAX_BPS, quoteCartLines } from "./catalog";
import { totalChargeCentsFromCatalogLines } from "./checkoutQuote";

describe("totalChargeCentsFromCatalogLines", () => {
  it("matches quoteCartLines total (ZLX-BLK-S @ 2400¢ × 1, flat ship until free threshold)", () => {
    const items = [{ sku: "ZLX-BLK-S", qty: 1 }];
    const got = totalChargeCentsFromCatalogLines(items);
    const q = quoteCartLines(items.map((l) => ({ sku: l.sku, quantity: l.qty })));
    expect(got).toBe(q.total_cents);
    const merchandise = 2400;
    const tax = Math.round((merchandise * TAX_BPS) / 10_000);
    const shipping = merchandise >= 5_000 ? 0 : FLAT_SHIPPING_CENTS;
    expect(got).toBe(merchandise + tax + shipping);
  });

  it("throws for unknown SKU (propagates catalog error)", () => {
    expect(() => totalChargeCentsFromCatalogLines([{ sku: "no-such-sku-xyz", qty: 1 }])).toThrow();
  });

  it("waives flat shipping at or above $50 merchandise (3 × ZLX-BLK-S)", () => {
    const got = totalChargeCentsFromCatalogLines([{ sku: "ZLX-BLK-S", qty: 3 }]);
    const sub = 7200;
    const tax = Math.round((sub * TAX_BPS) / 10_000);
    expect(got).toBe(sub + tax);
  });
});
