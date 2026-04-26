import { type Product, productSchema } from "../domain/commerce";
import { type CatalogListItem, type CatalogProductDetail } from "./types";
import { staticRawCatalogSchema, type StaticRawProduct } from "./raw-static";

function rawProductToProduct(raw: StaticRawProduct): Product {
  const variants = raw.variants.map((v) => {
    const priceCents = Math.round(v.price * 100);
    const status =
      v.inventory > 0
        ? ("active" as const)
        : ("inactive" as const);
    return {
      sku: v.sku,
      size: v.options?.size,
      color: v.options?.color,
      price_cents: priceCents,
      currency: "USD" as const,
      inventory_quantity: Math.max(0, v.inventory),
      status,
      image_url: v.image,
    };
  });
  return productSchema.parse({
    slug: raw.slug,
    title: raw.title,
    status: "active" as const,
    fabric_type: raw.fabricType,
    variants,
  });
}

function toListItem(
  product: Product,
  storefrontProductId: number
): CatalogListItem {
  const prices = product.variants.map((v) => v.price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const inStock = product.variants.some((v) => v.inventory_quantity > 0);
  const hero = product.variants[0]?.image_url ?? "";
  return {
    product,
    storefrontProductId,
    minPriceCents: min,
    maxPriceCents: max,
    heroImageUrl: hero,
    inStock,
  };
}

/**
 * Parse + validate the authoritative static catalog and build indexes.
 * Use at JSON boundaries: bundled import (SPA) or `JSON.parse` + this (Node).
 */
export function parseStaticCatalogData(input: unknown) {
  const rawArr = staticRawCatalogSchema.parse(input);
  const products: Product[] = [];
  const listItems: CatalogListItem[] = [];
  const bySlug = new Map<string, CatalogProductDetail>();

  for (const raw of rawArr) {
    const product = rawProductToProduct(raw);
    products.push(product);
    listItems.push(toListItem(product, raw.id));
    bySlug.set(product.slug, {
      product,
      storefrontProductId: raw.id,
    });
  }

  return { products, listItems, bySlug };
}
