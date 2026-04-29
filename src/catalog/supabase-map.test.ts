import { describe, expect, it } from "vitest";
import {
  orderedProductLevelGalleryUrls,
  resolveVariantImageUrl,
  supabaseBundleToCatalogDetail,
  supabaseRowsToProduct,
  type SupabaseProductWithRelations,
} from "./supabase-map";

const baseProduct: SupabaseProductWithRelations = {
  id: "a0000001-0000-4000-8000-000000000001",
  slug: "boxer-briefs",
  title: "Zephyr Lux Boxer Briefs",
  subtitle: null,
  description: null,
  brand: "Zephyr Lux",
  category: "men",
  fabric_type: "Bamboo Viscose",
  care_instructions: null,
  origin: "USA",
  status: "active",
  legacy_storefront_id: 101,
  product_variants: [
    {
      id: "b0000001-0000-4000-8000-000000000001",
      product_id: "a0000001-0000-4000-8000-000000000001",
      sku: "ZLX-BLK-S",
      size: "S",
      color: "black",
      price_cents: 2400,
      currency: "usd",
      inventory_quantity: 2,
      low_stock_threshold: null,
      status: "active",
    },
  ],
  product_images: [
    {
      product_id: "a0000001-0000-4000-8000-000000000001",
      variant_id: "b0000001-0000-4000-8000-000000000001",
      storage_path: "/assets/v.jpg",
      sort_order: 0,
      is_primary: true,
    },
    {
      product_id: "a0000001-0000-4000-8000-000000000001",
      variant_id: null,
      storage_path: "/assets/p.jpg",
      sort_order: 0,
      is_primary: true,
    },
  ],
};

describe("supabase-map", () => {
  it("prefers variant-specific image over product-level", () => {
    const url = resolveVariantImageUrl(
      "b0000001-0000-4000-8000-000000000001",
      "a0000001-0000-4000-8000-000000000001",
      baseProduct.product_images ?? []
    );
    expect(url).toBe("/assets/v.jpg");
  });

  it("falls back to product-level image when no variant row", () => {
    const url = resolveVariantImageUrl(
      "b0000001-0000-4000-8000-000000000001",
      "a0000001-0000-4000-8000-000000000001",
      [
        {
          product_id: "a0000001-0000-4000-8000-000000000001",
          variant_id: null,
          storage_path: "/assets/p.jpg",
          sort_order: 0,
          is_primary: false,
        },
      ]
    );
    expect(url).toBe("/assets/p.jpg");
  });

  it("maps rows to Product with Zod boundary", () => {
    const product = supabaseRowsToProduct(baseProduct);
    expect(product.slug).toBe("boxer-briefs");
    expect(product.variants[0]?.sku).toBe("ZLX-BLK-S");
    expect(product.variants[0]?.image_url).toBe("/assets/v.jpg");
    expect(product.variants[0]?.currency).toBe("USD");
  });

  it("throws when legacy_storefront_id is missing on catalog detail", () => {
    const row = {
      ...baseProduct,
      legacy_storefront_id: null,
    };
    expect(() => supabaseBundleToCatalogDetail(row)).toThrow(/legacy_storefront_id/);
  });

  it("builds CatalogProductDetail with storefront id and gallery fields", () => {
    const detail = supabaseBundleToCatalogDetail(baseProduct);
    expect(detail.storefrontProductId).toBe(101);
    expect(detail.product.title).toContain("Boxer Briefs");
    expect(detail.galleryImages).toEqual(["/assets/p.jpg"]);
    expect(detail.variantPrimaryImageBySku["ZLX-BLK-S"]).toBe("/assets/v.jpg");
    expect(detail.displayGalleryUrls).toContain("/assets/p.jpg");
    expect(detail.displayGalleryUrls).toContain("/assets/v.jpg");
    expect(detail.subscriptionPlans).toEqual([]);
  });

  it("maps active subscription embeds to storefront plan views (Stripe price id withheld)", () => {
    const detail = supabaseBundleToCatalogDetail({
      ...baseProduct,
      product_subscription_plans: [
        {
          id: "c0000001-0000-4000-8000-000000000099",
          product_id: "a0000001-0000-4000-8000-000000000001",
          variant_id: null,
          slug: "save-monthly",
          name: "Subscribe monthly",
          description: null,
          interval: "month",
          interval_count: 1,
          price_cents: 2000,
          currency: "usd",
          stripe_price_id: "price_from_stripe_dashboard",
          trial_period_days: null,
          status: "active",
        },
        {
          id: "d0000001-0000-4000-8000-000000000098",
          product_id: "a0000001-0000-4000-8000-000000000001",
          variant_id: null,
          slug: "draft",
          name: "Hidden",
          description: null,
          interval: "month",
          interval_count: 1,
          price_cents: 2000,
          currency: "usd",
          stripe_price_id: null,
          trial_period_days: null,
          status: "draft",
        },
      ],
    });
    expect(detail.subscriptionPlans).toHaveLength(1);
    expect(detail.subscriptionPlans[0]).toMatchObject({
      slug: "save-monthly",
      intervalCount: 1,
      priceCents: 2000,
    });
    expect(detail.subscriptionPlans[0]).not.toHaveProperty("stripe_price_id");
  });

  it("orders product-level gallery by primary then sort_order", () => {
    const urls = orderedProductLevelGalleryUrls(
      [
        {
          product_id: "a0000001-0000-4000-8000-000000000001",
          variant_id: null,
          storage_path: "/second.jpg",
          sort_order: 1,
          is_primary: false,
        },
        {
          product_id: "a0000001-0000-4000-8000-000000000001",
          variant_id: null,
          storage_path: "/first.jpg",
          sort_order: 0,
          is_primary: true,
        },
      ],
      "a0000001-0000-4000-8000-000000000001"
    );
    expect(urls).toEqual(["/first.jpg", "/second.jpg"]);
  });
});
