import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseStaticCatalogData } from "./parse";
import { staticSeedCatalogSchema } from "./raw-static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsJsonPath = path.join(__dirname, "../../data/products.json");

describe("parseStaticCatalogData", () => {
  it("accepts the repo canonical seed file", () => {
    const raw = JSON.parse(readFileSync(productsJsonPath, "utf-8")) as unknown;
    const { products, listItems, bySlug } = parseStaticCatalogData(raw);
    expect(products).toHaveLength(5);
    expect(listItems.some((l) => l.storefrontProductId === 101)).toBe(true);
    expect(bySlug.get("boxer-briefs")?.product.title).toMatch(/Zephyr Lux Boxer Briefs/);
  });

  it("rejects duplicate SKUs", () => {
    const bad = [
      {
        id: 1,
        slug: "a",
        title: "A",
        status: "active",
        variants: [
          { sku: "SAME", price_cents: 100, currency: "USD", inventory_quantity: 1, status: "active" },
        ],
      },
      {
        id: 2,
        slug: "b",
        title: "B",
        status: "active",
        variants: [
          { sku: "SAME", price_cents: 200, currency: "USD", inventory_quantity: 1, status: "active" },
        ],
      },
    ];
    expect(() => parseStaticCatalogData(bad)).toThrow(/Duplicate SKU/);
  });

  it("rejects a row missing slug", () => {
    const bad = [
      {
        id: 1,
        title: "x",
        status: "active",
        variants: [
          { sku: "A1", price_cents: 100, currency: "USD", inventory_quantity: 1, status: "active" },
        ],
      },
    ];
    expect(() => parseStaticCatalogData(bad)).toThrow();
  });

  it("rejects non-draft product with no variants (productSchema rule)", () => {
    const bad = [
      {
        id: 1,
        slug: "x",
        title: "x",
        status: "active",
        variants: [] as { sku: string; price_cents: number; currency: string; inventory_quantity: number; status: string }[],
      },
    ];
    expect(() => staticSeedCatalogSchema.parse(bad)).toThrow();
  });
});
