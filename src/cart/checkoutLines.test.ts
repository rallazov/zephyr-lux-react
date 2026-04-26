import { describe, expect, it } from "vitest";
import type { StorefrontCartLine } from "./cartLine";
import { toCheckoutLines } from "./checkoutLines";
import { domainLineFromStorefront } from "./domainBridge";

describe("toCheckoutLines", () => {
  it("produces SKU-forward drafts with optional ids", () => {
    const lines: StorefrontCartLine[] = [
      {
        id: 10,
        name: "A",
        quantity: 2,
        price: 5,
        image: "",
        sku: "SKU1",
        variant_id: "550e8400-e29b-41d4-a716-446655440000",
        product_slug: "slug-a",
      },
      {
        id: 11,
        name: "Legacy",
        quantity: 1,
        price: 1,
        image: "",
      },
    ];
    const drafts = toCheckoutLines(lines);
    expect(drafts).toEqual([
      {
        sku: "SKU1",
        quantity: 2,
        variant_id: "550e8400-e29b-41d4-a716-446655440000",
        product_slug: "slug-a",
      },
    ]);
  });

  it("omits non-UUID variant_id without throwing", () => {
    const drafts = toCheckoutLines([
      {
        id: 1,
        name: "A",
        quantity: 1,
        price: 1,
        image: "",
        sku: "SK",
        variant_id: "not-a-uuid",
        product_slug: "p",
      },
    ]);
    expect(drafts).toEqual([
      { sku: "SK", quantity: 1, product_slug: "p" },
    ]);
  });
});

describe("domainLineFromStorefront", () => {
  it("returns null when SKU missing", () => {
    expect(
      domainLineFromStorefront({
        id: 1,
        name: "n",
        quantity: 1,
        price: 0,
        image: "",
      })
    ).toBeNull();
  });

  it("parses through cartItemSchema", () => {
    const d = domainLineFromStorefront({
      id: 42,
      name: "N",
      quantity: 3,
      price: 12.34,
      image: "u",
      sku: "S",
      product_slug: "p",
    });
    expect(d?.sku).toBe("S");
    expect(d?.quantity).toBe(3);
    expect(d?.storefront_product_id).toBe(42);
    expect(d?.unit_price_cents).toBe(1234);
  });

  it("drops invalid variant_id and still returns a domain line", () => {
    const d = domainLineFromStorefront({
      id: 1,
      name: "N",
      quantity: 1,
      price: 10,
      image: "u",
      sku: "S",
      product_slug: "p",
      variant_id: "bad",
    });
    expect(d).not.toBeNull();
    expect(d?.variant_id).toBeUndefined();
  });
});
