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
  const { id: _storefrontId, ...body } = row;
  void _storefrontId;
  return productSchema.parse(body);
}

function isPurchasableVariant(v: Product["variants"][number]): boolean {
  return v.status === "active" && v.inventory_quantity > 0;
}

function purchasableVariantCount(product: Product): number {
  return product.variants.filter(isPurchasableVariant).length;
}

/** Storefront list + PDP only surface products with this status (FR-SF-001, story 2-3). */
export function isStorefrontBrowsableProduct(product: Product): boolean {
  return product.status === "active";
}

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
  };
}

/**
 * Parse + validate the authoritative static catalog and build indexes.
 * Use at JSON boundaries: bundled import (SPA) or `JSON.parse` + this (Node).
 *
 * Only **`active`** products are included in `products`, `listItems`, and `bySlug`
 * so list and detail routes agree and non-browsable slugs behave as not found.
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
    });
  }

  return { products, listItems, bySlug };
}
