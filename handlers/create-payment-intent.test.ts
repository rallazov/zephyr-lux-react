// @vitest-environment node
import { describe, expect, it } from "vitest";
import { quoteForPaymentItems } from "./_lib/catalog";
import { totalChargeCentsFromCatalogLines } from "./_lib/checkoutQuote";

describe("create-payment-intent / checkout quote alignment (E3-S3)", () => {
  it("totalChargeCentsFromCatalogLines matches quoteForPaymentItems for a known SKU", () => {
    const fromQuote = quoteForPaymentItems([{ sku: "ZLX-2PK-S", qty: 1 }]).total_cents;
    const fromHelper = totalChargeCentsFromCatalogLines([{ sku: "ZLX-2PK-S", qty: 1 }]);
    expect(fromHelper).toBe(fromQuote);
  });
});
