import { describe, expect, it } from "vitest";
import type { Product, ProductVariant } from "../domain/commerce";
import { buildProductJsonLd } from "./productJsonLd";

const variant = (
  o: Partial<ProductVariant> & { sku: string }
): ProductVariant => ({
  sku: o.sku,
  size: o.size,
  color: o.color,
  price_cents: o.price_cents ?? 1999,
  currency: o.currency ?? "USD",
  inventory_quantity: o.inventory_quantity ?? 3,
  status: o.status ?? "active",
  image_url: o.image_url ?? "https://cdn.example.com/p.jpg",
});

describe("buildProductJsonLd", () => {
  const siteBase = "https://shop.example.com";

  it("includes Offer with priceCurrency USD when a purchasable variant is selected", () => {
    const product: Product = {
      slug: "bamboo-tee",
      title: "Bamboo Tee",
      description: "Soft tee.",
      status: "active",
      variants: [variant({ sku: "SKU1", price_cents: 1999 })],
    };
    const v = product.variants[0]!;
    const ld = buildProductJsonLd({
      product,
      slug: "bamboo-tee",
      siteBaseUrl: siteBase,
      purchasable: [v],
      selection: { kind: "purchasable", variant: v },
      minPurchasableCents: 1999,
      maxPurchasableCents: 1999,
    });
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe("Bamboo Tee");
    expect(ld.description).toBe("Soft tee.");
    const offers = ld.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("Offer");
    expect(offers.priceCurrency).toBe("USD");
    expect(offers.price).toBe("19.99");
    expect(offers.availability).toBe("https://schema.org/InStock");
    expect(ld.sku).toBe("SKU1");
    expect(ld.image).toEqual(["https://cdn.example.com/p.jpg"]);
  });

  it("uses AggregateOffer with low/high prices when selection is incomplete", () => {
    const product: Product = {
      slug: "mix",
      title: "Mix",
      status: "active",
      variants: [
        variant({ sku: "a", price_cents: 1000 }),
        variant({ sku: "b", price_cents: 2000 }),
      ],
    };
    const purchasable = product.variants;
    const ld = buildProductJsonLd({
      product,
      slug: "mix",
      siteBaseUrl: siteBase,
      purchasable,
      selection: { kind: "incomplete" },
      minPurchasableCents: 1000,
      maxPurchasableCents: 2000,
    });
    const offers = ld.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("AggregateOffer");
    expect(offers.priceCurrency).toBe("USD");
    expect(offers.lowPrice).toBe("10.00");
    expect(offers.highPrice).toBe("20.00");
  });

  it("marks OutOfStock when no purchasable variants exist", () => {
    const product: Product = {
      slug: "gone",
      title: "Gone",
      status: "active",
      variants: [
        variant({ sku: "x", inventory_quantity: 0, price_cents: 1500 }),
      ],
    };
    const ld = buildProductJsonLd({
      product,
      slug: "gone",
      siteBaseUrl: siteBase,
      purchasable: [],
      selection: { kind: "unavailable" },
      minPurchasableCents: 0,
      maxPurchasableCents: 0,
    });
    const offers = ld.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("Offer");
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
    expect(offers.priceCurrency).toBe("USD");
    expect(offers.price).toBe("15.00");
  });
});
