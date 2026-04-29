import { describe, expect, it } from "vitest";
import { createPaymentIntentBodySchema, lineItemsToCatalogRows } from "./createPaymentIntentBody";

describe("createPaymentIntentBodySchema", () => {
  it("accepts items[] with quantity and defaults currency to usd", () => {
    const r = createPaymentIntentBodySchema.safeParse({
      items: [{ sku: "ZLX-A", quantity: 2 }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.currency).toBe("usd");
      expect(r.data.items?.[0].quantity).toBe(2);
    }
  });

  it("rejects empty object", () => {
    const r = createPaymentIntentBodySchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects item-free body (no legacy amount path)", () => {
    const r = createPaymentIntentBodySchema.safeParse({ amount: 1000, currency: "usd" });
    expect(r.success).toBe(false);
  });

  it("rejects non-usd currency", () => {
    const r = createPaymentIntentBodySchema.safeParse({
      items: [{ sku: "ZLX-A", quantity: 1 }],
      currency: "eur",
    } as unknown);
    expect(r.success).toBe(false);
  });

  it("accepts optional customer_name and shipping_address", () => {
    const r = createPaymentIntentBodySchema.safeParse({
      items: [{ sku: "ZLX-A", quantity: 1 }],
      customer_name: "Ada Lovelace",
      shipping_address: {
        line1: "1 Main St",
        city: "Austin",
        state: "TX",
        postal_code: "78701",
        country: "US",
      },
    });
    expect(r.success).toBe(true);
  });
});

describe("lineItemsToCatalogRows", () => {
  it("maps quantity to qty", () => {
    expect(
      lineItemsToCatalogRows([{ sku: "S", quantity: 3, variant_id: "550e8400-e29b-41d4-a716-446655440000" }])
    ).toEqual([{ sku: "S", qty: 3 }]);
  });

  it("merges duplicate skus", () => {
    expect(
      lineItemsToCatalogRows([
        { sku: "A", quantity: 1 },
        { sku: "A", quantity: 2 },
      ])
    ).toEqual([{ sku: "A", qty: 3 }]);
  });
});
