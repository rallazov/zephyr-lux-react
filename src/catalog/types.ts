import type { Product } from "../domain/commerce";

/** Storefront list row: canonical product plus list-specific fields (derived). */
export type CatalogListItem = {
  product: Product;
  /** Legacy numeric id from static JSON until cart uses variant SKU (Epic 3). */
  storefrontProductId: number;
  minPriceCents: number;
  maxPriceCents: number;
  heroImageUrl: string;
  inStock: boolean;
  /** Variants with `active` status and `inventory_quantity > 0` (list ATC rule). */
  purchasableVariantCount: number;
};

export type CatalogProductDetail = {
  product: Product;
  storefrontProductId: number;
  /** `product_images` rows with `variant_id` null, ordered by `is_primary` desc then `sort_order` asc. */
  galleryImages: string[];
  /** Unique image URLs for PDP browsing (product-level first, then variant-specific). */
  displayGalleryUrls: string[];
  /** Primary storage path per SKU from variant-attached `product_images` rows only (Supabase). */
  variantPrimaryImageBySku: Partial<Record<string, string>>;
};
