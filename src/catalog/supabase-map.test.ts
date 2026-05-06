import { describe, expect, it } from "vitest";
import {
  orderedProductLevelGalleryUrls,
  sanitizeSupabaseProductBundle,
  resolveVariantImageUrl,
  supabaseBundleToCatalogDetail,
  supabaseRowsToProduct,
  type SupabaseProductWithRelations,
} from "./supabase-map";

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";
const WRONG_TEMPLATE_ID = "99999999-9999-4999-8999-999999999999";
const AXIS_SIZE = "22222222-2222-4222-8222-222222222222";
const OPT_S = "33333333-3333-4333-8333-333333333333";
const OPT_M = "44444444-4444-4444-8444-444444444444";

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
      sku: "ZLX-2PK-S",
      size: "S",
      color: null,
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
    expect(product.variants[0]?.sku).toBe("ZLX-2PK-S");
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
    expect(detail.variantPrimaryImageBySku["ZLX-2PK-S"]).toBe("/assets/v.jpg");
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

  it("drops cross-product template embed and stray option pairs (sanitized)", () => {
    const vId = "b0000001-0000-4000-8000-000000000001";
    const row: SupabaseProductWithRelations = {
      ...baseProduct,
      variant_template_id: TEMPLATE_ID,
      variant_templates: {
        id: WRONG_TEMPLATE_ID,
        name: "Other",
        status: "active",
        variant_template_axes: [
          {
            id: AXIS_SIZE,
            axis_key: "size",
            label: "Size",
            sort_order: 0,
            variant_template_axis_options: [
              {
                id: OPT_S,
                axis_id: AXIS_SIZE,
                option_key: "s",
                label: "S",
                sort_order: 0,
              },
            ],
          },
        ],
      },
      product_variants: [
        {
          id: vId,
          product_id: baseProduct.id,
          sku: "ZLX-TPL-X",
          size: null,
          color: null,
          price_cents: 100,
          currency: "usd",
          inventory_quantity: 5,
          low_stock_threshold: null,
          status: "active",
          product_variant_option_values: [
            { axis_id: AXIS_SIZE, option_id: OPT_S },
          ],
        },
      ],
    };
    const s = sanitizeSupabaseProductBundle(row);
    expect(s.variant_template_id).toBeNull();
    expect(s.variant_templates).toBeNull();
    expect(s.product_variants?.[0]?.product_variant_option_values).toBeUndefined();

    const detail = supabaseBundleToCatalogDetail(row);
    expect(detail.variantTemplate).toBeNull();
    expect(detail.product.variants[0]?.template_option_values).toBeUndefined();
  });

  it("builds template slice when FK, embed, axes, and option rows are coherent", () => {
    const vId1 = "b0000002-0000-4000-8000-000000000001";
    const vId2 = "b0000002-0000-4000-8000-000000000002";
    const row: SupabaseProductWithRelations = {
      id: "a0000002-0000-4000-8000-000000000001",
      slug: "templated-tee",
      title: "Templated tee",
      subtitle: null,
      description: null,
      brand: "ZLX",
      category: "men",
      fabric_type: null,
      care_instructions: null,
      origin: null,
      status: "active",
      legacy_storefront_id: 202,
      variant_template_id: TEMPLATE_ID,
      variant_templates: {
        id: TEMPLATE_ID,
        name: "Sized",
        status: "active",
        variant_template_axes: [
          {
            id: AXIS_SIZE,
            axis_key: "size",
            label: "Size",
            sort_order: 0,
            variant_template_axis_options: [
              {
                id: OPT_S,
                axis_id: AXIS_SIZE,
                option_key: "s",
                label: "S",
                sort_order: 0,
              },
              {
                id: OPT_M,
                axis_id: AXIS_SIZE,
                option_key: "m",
                label: "M",
                sort_order: 1,
              },
            ],
          },
        ],
      },
      product_variants: [
        {
          id: vId1,
          product_id: "a0000002-0000-4000-8000-000000000001",
          sku: "ZLX-TPL-S",
          size: null,
          color: null,
          price_cents: 4999,
          currency: "usd",
          inventory_quantity: 2,
          low_stock_threshold: null,
          status: "active",
          product_variant_option_values: [{ axis_id: AXIS_SIZE, option_id: OPT_S }],
        },
        {
          id: vId2,
          product_id: "a0000002-0000-4000-8000-000000000001",
          sku: "ZLX-TPL-M",
          size: null,
          color: null,
          price_cents: 4999,
          currency: "usd",
          inventory_quantity: 2,
          low_stock_threshold: null,
          status: "active",
          product_variant_option_values: [{ axis_id: AXIS_SIZE, option_id: OPT_M }],
        },
      ],
      product_images: [],
    };
    const detail = supabaseBundleToCatalogDetail(row);
    expect(detail.variantTemplate).not.toBeNull();
    expect(detail.variantTemplate?.id).toBe(TEMPLATE_ID);
    expect(detail.product.variants.every((v) => (v.template_option_values ?? []).length === 1)).toBe(true);
  });

  it("degrades to legacy when option_id does not belong to the assigned template", () => {
    const rogueOpt = "77777777-7777-4777-8777-777777777777";
    const row: SupabaseProductWithRelations = {
      ...baseProduct,
      id: "a0000999-0000-4000-8000-000000000099",
      slug: "malformed-opt",
      variant_template_id: TEMPLATE_ID,
      variant_templates: {
        id: TEMPLATE_ID,
        name: "Sized",
        status: "active",
        variant_template_axes: [
          {
            id: AXIS_SIZE,
            axis_key: "size",
            label: null,
            sort_order: 0,
            variant_template_axis_options: [
              {
                id: OPT_S,
                axis_id: AXIS_SIZE,
                option_key: "s",
                label: null,
                sort_order: 0,
              },
            ],
          },
        ],
      },
      product_variants: [
        {
          id: "b0000999-0000-4000-8000-000000000099",
          product_id: "a0000999-0000-4000-8000-000000000099",
          sku: "ZLX-BAD-OPT",
          size: null,
          color: null,
          price_cents: 100,
          currency: "usd",
          inventory_quantity: 1,
          low_stock_threshold: null,
          status: "active",
          product_variant_option_values: [{ axis_id: AXIS_SIZE, option_id: rogueOpt }],
        },
      ],
    };
    const detail = supabaseBundleToCatalogDetail(row);
    expect(detail.variantTemplate).toBeNull();
    expect(detail.product.variants[0]?.template_option_values).toBeUndefined();
  });

  it("nulls template FK when product_variants is empty before domain mapping", () => {
    const row: SupabaseProductWithRelations = {
      ...baseProduct,
      id: "a0000003-0000-4000-8000-000000000003",
      slug: "no-variants-tpl",
      variant_template_id: TEMPLATE_ID,
      variant_templates: {
        id: TEMPLATE_ID,
        name: "Sized",
        status: "active",
        variant_template_axes: [
          {
            id: AXIS_SIZE,
            axis_key: "size",
            label: "Size",
            sort_order: 0,
            variant_template_axis_options: [
              {
                id: OPT_S,
                axis_id: AXIS_SIZE,
                option_key: "s",
                label: "S",
                sort_order: 0,
              },
            ],
          },
        ],
      },
      product_variants: [],
    };
    const s = sanitizeSupabaseProductBundle(row);
    expect(s.variant_template_id).toBeNull();
    expect(s.variant_templates).toBeNull();
    expect(s.product_variants).toEqual([]);
  });

  it("strips template when embed lists duplicate axis ids", () => {
    const vId = "b0000003-0000-4000-8000-000000000001";
    const dupAxisId = AXIS_SIZE;
    const row: SupabaseProductWithRelations = {
      ...baseProduct,
      id: "a0000004-0000-4000-8000-000000000004",
      slug: "dup-axis",
      variant_template_id: TEMPLATE_ID,
      variant_templates: {
        id: TEMPLATE_ID,
        name: "Broken",
        status: "active",
        variant_template_axes: [
          {
            id: dupAxisId,
            axis_key: "size",
            label: "Size",
            sort_order: 0,
            variant_template_axis_options: [
              {
                id: OPT_S,
                axis_id: dupAxisId,
                option_key: "s",
                label: "S",
                sort_order: 0,
              },
            ],
          },
          {
            id: dupAxisId,
            axis_key: "width",
            label: "W",
            sort_order: 1,
            variant_template_axis_options: [
              {
                id: OPT_M,
                axis_id: dupAxisId,
                option_key: "m",
                label: "M",
                sort_order: 0,
              },
            ],
          },
        ],
      },
      product_variants: [
        {
          id: vId,
          product_id: "a0000004-0000-4000-8000-000000000004",
          sku: "ZLX-DUP",
          size: null,
          color: null,
          price_cents: 100,
          currency: "usd",
          inventory_quantity: 1,
          low_stock_threshold: null,
          status: "active",
          product_variant_option_values: [
            { axis_id: dupAxisId, option_id: OPT_S },
            { axis_id: dupAxisId, option_id: OPT_M },
          ],
        },
      ],
    };
    const detail = supabaseBundleToCatalogDetail(row);
    expect(detail.variantTemplate).toBeNull();
  });
});
