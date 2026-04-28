import { describe, expect, it } from "vitest";
import {
  normalizeCategoryKey,
  productCategoryMatchesCanonical,
  resolveCanonicalCategoryKey,
} from "./categoryNormalize";

describe("normalizeCategoryKey", () => {
  it("returns null for null, undefined, whitespace-only, or empty after trim", () => {
    expect(normalizeCategoryKey(null)).toBeNull();
    expect(normalizeCategoryKey(undefined)).toBeNull();
    expect(normalizeCategoryKey("")).toBeNull();
    expect(normalizeCategoryKey("   ")).toBeNull();
    expect(normalizeCategoryKey("\t\n")).toBeNull();
  });

  it("trims and NFC-normalizes then case-folds with root locale lowercasing", () => {
    expect(normalizeCategoryKey("  Women  ")).toBe("women");
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    expect(normalizeCategoryKey(composed)).toBe(normalizeCategoryKey(decomposed));
  });

  it("Unicode case mapping (basic Latin)", () => {
    expect(normalizeCategoryKey("UNDERWEAR")).toBe("underwear");
  });

  it("applies Unicode simple case fold where it differs from lowercase (İ, ß)", () => {
    expect(normalizeCategoryKey("\u0130stanbul")).toBe("istanbul");
    expect(normalizeCategoryKey("Stra\u00dfe")).toBe("strasse");
  });
});

describe("resolveCanonicalCategoryKey + productCategoryMatchesCanonical", () => {
  it("maps known aliases to canonical keys", () => {
    expect(resolveCanonicalCategoryKey("underware")).toBe("underwear");
    expect(resolveCanonicalCategoryKey("womens")).toBe("women");
  });

  it("matches admin variants to route canonical keys", () => {
    expect(productCategoryMatchesCanonical("Women", "women")).toBe(true);
    expect(productCategoryMatchesCanonical("underware", "underwear")).toBe(true);
    expect(productCategoryMatchesCanonical("UNDERWEAR", "underwear")).toBe(true);
  });

  it("never matches uncategorized product to a named collection", () => {
    expect(productCategoryMatchesCanonical(null, "women")).toBe(false);
    expect(productCategoryMatchesCanonical("", "women")).toBe(false);
    expect(productCategoryMatchesCanonical("   ", "women")).toBe(false);
  });

  it("does not put uncategorized products on women route", () => {
    expect(productCategoryMatchesCanonical(undefined, "women")).toBe(false);
  });
});
