import { describe, expect, it } from "vitest";
import { parseStaticCatalogData } from "./parse";
import {
  catalogItemMatchesSearchQuery,
  filterCatalogItemsBySearchQuery,
  normalizeSearchNeedle,
} from "./searchMatch";

const rows = parseStaticCatalogData([
  {
    id: 1,
    slug: "alpha-slip",
    title: "Alpha Slip Dress",
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
    slug: "basic-tee",
    title: "Basic Tee",
    status: "active",
    variants: [
      {
        sku: "B1",
        price_cents: 900,
        currency: "USD",
        inventory_quantity: 2,
        status: "active",
      },
    ],
  },
]).listItems;

describe("searchMatch", () => {
  it("normalizeSearchNeedle returns null for whitespace-only", () => {
    expect(normalizeSearchNeedle("   ")).toBeNull();
    expect(normalizeSearchNeedle("\t\n")).toBeNull();
  });

  it("matches title case-insensitively with substring", () => {
    const n = normalizeSearchNeedle("slip")!;
    expect(catalogItemMatchesSearchQuery(rows[0], n)).toBe(true);
    expect(catalogItemMatchesSearchQuery(rows[1], n)).toBe(false);
  });

  it("matches category when present", () => {
    const n = normalizeSearchNeedle("women")!;
    expect(catalogItemMatchesSearchQuery(rows[0], n)).toBe(true);
    expect(catalogItemMatchesSearchQuery(rows[1], n)).toBe(false);
  });

  it("empty category does not match category-only query unless title matches", () => {
    const n = normalizeSearchNeedle("men")!;
    expect(catalogItemMatchesSearchQuery(rows[1], n)).toBe(false);
  });

  it("filterCatalogItemsBySearchQuery returns [] for whitespace query", () => {
    expect(filterCatalogItemsBySearchQuery(rows, "  ")).toEqual([]);
  });
});
