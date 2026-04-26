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
};
