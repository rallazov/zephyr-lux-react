/**
 * Storefront cart line persisted in memory and localStorage (Epic 3).
 * `id` is the numeric storefront product id (see CatalogListItem.storefrontProductId).
 */
export interface StorefrontCartLine {
  id: number;
  name: string;
  quantity: number;
  price: number;
  image: string;
  /** Variant SKU; legacy rows may omit (normalized to "" in lineKey). */
  sku?: string;
  /** Canonical variant UUID when catalog provides it (Supabase-backed). */
  variant_id?: string;
  product_slug?: string;
}
