import { describe, expect, it } from "vitest";
import { parseStaticCatalogData } from "./parse";

const usd = (
  sku: string,
  priceCents: number,
  inventory: number,
  variantStatus: "active" | "inactive" | "discontinued" = "active"
) =>
  ({
    sku,
    price_cents: priceCents,
    currency: "USD" as const,
    inventory_quantity: inventory,
    status: variantStatus,
  }) as const;

describe("parseStaticCatalogData list construction", () => {
  it("indexes only active products in listItems, products, and bySlug", () => {
    const { listItems, bySlug, products } = parseStaticCatalogData([
      {
        id: 1,
        slug: "live",
        title: "Live",
        status: "active",
        variants: [usd("A", 100, 1)],
      },
      {
        id: 2,
        slug: "draft-p",
        title: "Draft",
        status: "draft",
        variants: [usd("B", 100, 1)],
      },
      {
        id: 3,
        slug: "archived-p",
        title: "Archived",
        status: "archived",
        variants: [usd("C", 100, 1)],
      },
    ]);
    expect(listItems.map((i) => i.product.slug)).toEqual(["live"]);
    expect(products.map((p) => p.slug)).toEqual(["live"]);
    expect(bySlug.has("draft-p")).toBe(false);
    expect(bySlug.has("archived-p")).toBe(false);
    expect(bySlug.has("live")).toBe(true);
  });

  it("sets purchasableVariantCount from active variants with inventory", () => {
    const { listItems } = parseStaticCatalogData([
      {
        id: 1,
        slug: "p",
        title: "P",
        status: "active",
        variants: [
          usd("ok", 1000, 2, "active"),
          usd("dead", 1000, 0, "inactive"),
        ],
      },
    ]);
    expect(listItems[0].purchasableVariantCount).toBe(1);
  });

  it("list inStock is false when only non-purchasable variants have inventory", () => {
    const { listItems } = parseStaticCatalogData([
      {
        id: 1,
        slug: "p",
        title: "P",
        status: "active",
        variants: [usd("held", 1000, 10, "inactive")],
      },
    ]);
    expect(listItems[0].purchasableVariantCount).toBe(0);
    expect(listItems[0].inStock).toBe(false);
  });
});
