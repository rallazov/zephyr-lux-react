import { describe, expect, it } from "vitest";
import type { ProductVariant } from "../domain/commerce";
import {
  PDP_IMAGE_PLACEHOLDER,
  buildDisplayGalleryUrls,
  resolvePdpHeroImageUrl,
} from "./pdpImage";

const minV = (over: Partial<ProductVariant> & { sku: string }): ProductVariant =>
  ({
    price_cents: over.price_cents ?? 100,
    currency: "USD",
    inventory_quantity: over.inventory_quantity ?? 1,
    status: "active",
    ...over,
  }) as ProductVariant;

describe("pdpImage", () => {
  it("prefers variant-attached primary from map (step 1)", () => {
    const v = minV({ sku: "A", image_url: "/legacy.jpg" });
    expect(
      resolvePdpHeroImageUrl({
        selectedVariant: v,
        productLevelGallery: ["/p.jpg"],
        displayGalleryUrls: ["/p.jpg", "/other.jpg"],
        variantPrimaryImageBySku: { A: "/var-primary.jpg" },
      })
    ).toBe("/var-primary.jpg");
  });

  it("uses product-level gallery head when no variant primary (step 2)", () => {
    const v = minV({ sku: "A", image_url: "/legacy.jpg" });
    expect(
      resolvePdpHeroImageUrl({
        selectedVariant: v,
        productLevelGallery: ["/p1.jpg", "/p2.jpg"],
        displayGalleryUrls: ["/p1.jpg"],
        variantPrimaryImageBySku: {},
      })
    ).toBe("/p1.jpg");
  });

  it("falls back to legacy variant image (step 3)", () => {
    const v = minV({ sku: "A", image_url: "/legacy-only.jpg" });
    expect(
      resolvePdpHeroImageUrl({
        selectedVariant: v,
        productLevelGallery: [],
        displayGalleryUrls: ["/browse.jpg"],
        variantPrimaryImageBySku: {},
      })
    ).toBe("/legacy-only.jpg");
  });

  it("uses display gallery head when no selected variant legacy", () => {
    const v = minV({ sku: "A" });
    expect(
      resolvePdpHeroImageUrl({
        selectedVariant: v,
        productLevelGallery: [],
        displayGalleryUrls: ["/browse.jpg"],
        variantPrimaryImageBySku: {},
      })
    ).toBe("/browse.jpg");
  });

  it("uses fallback variant for hero when selection incomplete", () => {
    expect(
      resolvePdpHeroImageUrl({
        selectedVariant: null,
        productLevelGallery: [],
        displayGalleryUrls: [],
        variantPrimaryImageBySku: {},
        fallbackVariant: minV({ sku: "Z", image_url: "/fb.jpg" }),
      })
    ).toBe("/fb.jpg");
  });

  it("returns placeholder when no source", () => {
    expect(
      resolvePdpHeroImageUrl({
        selectedVariant: null,
        productLevelGallery: [],
        displayGalleryUrls: [],
        variantPrimaryImageBySku: {},
      })
    ).toBe(PDP_IMAGE_PLACEHOLDER);
  });

  it("buildDisplayGalleryUrls dedupes and orders product level before variant primaries", () => {
    const variants = [
      minV({ sku: "B", size: "M" }),
      minV({ sku: "A", size: "S" }),
    ];
    const urls = buildDisplayGalleryUrls(variants, ["/p.jpg"], {
      A: "/va.jpg",
      B: "/vb.jpg",
    });
    expect(urls).toEqual(["/p.jpg", "/va.jpg", "/vb.jpg"]);
  });
});
