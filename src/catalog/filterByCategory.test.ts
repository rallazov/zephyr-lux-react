import { describe, expect, it } from "vitest";
import { parseStaticCatalogData } from "./parse";
import { filterListItemsByCategoryKey } from "./filterByCategory";

describe("filterListItemsByCategoryKey", () => {
  const list = parseStaticCatalogData([
    {
      id: 1,
      slug: "a",
      title: "A",
      category: "women",
      status: "active",
      variants: [
        {
          sku: "A1",
          price_cents: 1000,
          currency: "USD",
          inventory_quantity: 1,
          status: "active",
        },
      ],
    },
    {
      id: 2,
      slug: "b",
      title: "B",
      category: "underwear",
      status: "active",
      variants: [
        {
          sku: "B1",
          price_cents: 1000,
          currency: "USD",
          inventory_quantity: 1,
          status: "active",
        },
      ],
    },
    {
      id: 3,
      slug: "c",
      title: "C",
      status: "active",
      variants: [
        {
          sku: "C1",
          price_cents: 1000,
          currency: "USD",
          inventory_quantity: 1,
          status: "active",
        },
      ],
    },
  ]).listItems;

  it("keeps only rows whose category resolves to the canonical key", () => {
    const w = filterListItemsByCategoryKey(list, "women");
    expect(w.map((x) => x.product.slug)).toEqual(["a"]);

    const u = filterListItemsByCategoryKey(list, "underwear");
    expect(u.map((x) => x.product.slug)).toEqual(["b"]);
  });

  it("excludes rows with missing category from category routes", () => {
    const w = filterListItemsByCategoryKey(list, "women");
    expect(w.some((x) => x.product.slug === "c")).toBe(false);
  });
});
