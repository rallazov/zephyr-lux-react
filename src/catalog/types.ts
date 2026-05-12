import type { Product } from "../domain/commerce";
import type { SubscriptionPlanPublic } from "../domain/commerce/subscription";

/** Stable labels captured at add-to-cart / checkout for receipts (Epic 11-3). */
export type VariantDisplaySnapshotLine = {
  axis_label: string;
  option_label: string;
};

export type CatalogVariantAxisOption = {
  id: string;
  option_key: string;
  label: string | null;
  sort_order: number;
};

export type CatalogVariantAxis = {
  id: string;
  axis_key: string;
  label: string | null;
  sort_order: number;
  options: CatalogVariantAxisOption[];
};

/** Storefront-safe template slice for PDP selectors (active templates only via RLS). */
export type CatalogVariantTemplateSlice = {
  id: string;
  name: string;
  axes: CatalogVariantAxis[];
};

/** Storefront list row: canonical product plus list-specific fields (derived). */
export type CatalogListItem = {
  product: Product;
  /** Legacy numeric id from static JSON until cart uses variant SKU (Epic 3). */
  storefrontProductId: number;
  minPriceCents: number;
  maxPriceCents: number;
  heroImageUrl: string;
  /** Explicit admin-managed storefront collections; category remains a fallback when empty. */
  collectionKeys: string[];
  inStock: boolean;
  /** Variants with `active` status and `inventory_quantity > 0` (list ATC rule). */
  purchasableVariantCount: number;
  /** Supabase Billing plans only (`[]` when static catalog). */
  subscriptionPlans: SubscriptionPlanPublic[];
};

export type CatalogProductDetail = {
  product: Product;
  storefrontProductId: number;
  /** `product_images` rows with `variant_id` null, ordered by `is_primary` desc then `sort_order` asc. */
  galleryImages: string[];
  /** Unique image URLs for PDP browsing (product-level first, then variant-specific). */
  displayGalleryUrls: string[];
  /** Explicit admin-managed storefront collections; category remains a fallback when empty. */
  collectionKeys: string[];
  /** Primary storage path per SKU from variant-attached `product_images` rows only (Supabase). */
  variantPrimaryImageBySku: Partial<Record<string, string>>;
  /** Supabase Billing plans only (`[]` when static catalog). Stripe ids never appear here — checkout uses opaque `plan_id`. */
  subscriptionPlans: SubscriptionPlanPublic[];
  /** When set, PDP renders N-axis controls from template metadata instead of legacy size/color only. */
  variantTemplate?: CatalogVariantTemplateSlice | null;
};
