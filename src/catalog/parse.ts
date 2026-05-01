import { type Product, productSchema } from "../domain/commerce";
import { buildDisplayGalleryUrls } from "./pdpImage";
import { type CatalogListItem, type CatalogProductDetail } from "./types";
import { staticSeedCatalogSchema, type StaticSeedProductRow } from "./raw-static";

/** Deep-replace `null` with `undefined` so Zod optionals match typical JSON. */
function jsonNullsToUndefined(x: unknown): unknown {
  if (x === null) return undefined;
  if (Array.isArray(x)) return x.map(jsonNullsToUndefined);
  if (x !== null && typeof x === "object") {
    return Object.fromEntries(
      Object.entries(x as Record<string, unknown>).map(([k, v]) => [
        k,
        jsonNullsToUndefined(v),
      ])
    );
  }
  return x;
}

function seedRowToProduct(row: StaticSeedProductRow): Product {
  const { id: _storefrontId, supabase_product_id, ...bodyBase } = row;
  void _storefrontId;
  const body = {
    ...bodyBase,
    ...(supabase_product_id ? { id: supabase_product_id } : {}),
  };
  return productSchema.parse(body);
}

/** Variant eligible for cart/checkout list UX (`status` + on-hand inventory). */
export function isPurchasableVariant(v: Product["variants"][number]): boolean {
  return v.status === "active" && v.inventory_quantity > 0;
}

function purchasableVariantCount(product: Product): number {
  return product.variants.filter(isPurchasableVariant).length;
}

/** Storefront PLP/PDP/search listing gate (`draft` / `archived` omitted — Story 9-3 adds coming-soon browsability). */
export function isStorefrontListableProduct(product: Product): boolean {
  return product.status === "active" || product.status === "coming_soon";
}

/** Spec legacy naming (`story 2-3`); prefer {@link isStorefrontListableProduct}. */
export const isStorefrontBrowsableProduct = isStorefrontListableProduct;
/** Shared list-row derivation for static + Supabase catalog adapters. */
export function catalogListItemFromProduct(
  product: Product,
  storefrontProductId: number
): CatalogListItem {
  const prices = product.variants.map((v) => v.price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const inStock = product.variants.some(isPurchasableVariant);
  const hero = product.variants[0]?.image_url ?? "";
  return {
    product,
    storefrontProductId,
    minPriceCents: min,
    maxPriceCents: max,
    heroImageUrl: hero,
    inStock,
    purchasableVariantCount: purchasableVariantCount(product),
    subscriptionPlans: [],
  };
}

/**
 * Parse + validate the authoritative static catalog and build indexes.
 * Use at JSON boundaries: bundled import (SPA) or `JSON.parse` + this (Node).
 *
 * **`active`** and **`coming_soon`** rows surface as storefront browse/detail/search targets.
 * **`draft`** / **`archived`** stay omitted so slug lookups behave as not-found outside curated feeds.
 */
export function parseStaticCatalogData(input: unknown) {
  const preprocessed = jsonNullsToUndefined(input);
  const rawArr = staticSeedCatalogSchema.parse(preprocessed);
  const products: Product[] = [];
  const listItems: CatalogListItem[] = [];
  const bySlug = new Map<string, CatalogProductDetail>();

  for (const raw of rawArr) {
    const product = seedRowToProduct(raw);
    if (!isStorefrontBrowsableProduct(product)) {
      continue;
    }
    products.push(product);
    listItems.push(catalogListItemFromProduct(product, raw.id));
    const galleryImages: string[] = [];
    const variantPrimaryImageBySku: Partial<Record<string, string>> = {};
    const displayGalleryUrls = buildDisplayGalleryUrls(
      product.variants,
      galleryImages,
      variantPrimaryImageBySku
    );
    bySlug.set(product.slug, {
      product,
      storefrontProductId: raw.id,
      galleryImages,
      displayGalleryUrls,
      variantPrimaryImageBySku,
      subscriptionPlans: [],
    });
  }

  return { products, listItems, bySlug };
}
