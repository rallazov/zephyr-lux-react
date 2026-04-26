import fs from "node:fs";
import path from "node:path";
import { parseStaticCatalogData } from "../../src/catalog/parse";
import type { Product, ProductVariant } from "../../src/domain/commerce";

let _cache: { products: Product[]; bySku: Map<string, { product: Product; variant: ProductVariant }> } | null = null;

function loadFromDisk() {
  if (_cache) return _cache;
  const p = path.join(process.cwd(), "data", "products.json");
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(p, "utf-8")) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Catalog file read/JSON parse failed (${p}): ${msg}`);
  }
  let products: Product[];
  try {
    ({ products } = parseStaticCatalogData(json));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Catalog validation failed (${p}): ${msg}`);
  }
  const bySku = new Map<string, { product: Product; variant: ProductVariant }>();
  for (const product of products) {
    for (const variant of product.variants) {
      if (bySku.has(variant.sku)) {
        console.warn(
          `[catalog] duplicate SKU "${variant.sku}": keeping first mapping; ignored duplicate in product slug "${product.slug}"`,
        );
        continue;
      }
      bySku.set(variant.sku, { product, variant });
    }
  }
  _cache = { products, bySku };
  return _cache;
}

export type { Product, ProductVariant };

export function loadCatalog(): Product[] {
  return loadFromDisk().products;
}

export function findVariantBySku(sku: string) {
  return loadFromDisk().bySku.get(sku) ?? null;
}

export function computeAmountCents(items: Array<{ sku: string; qty: number }>) {
  let total = 0;
  for (const it of items) {
    const hit = findVariantBySku(it.sku);
    if (!hit) throw new Error(`Unknown SKU: ${it.sku}`);
    const q = Math.max(1, it.qty | 0);
    total += hit.variant.price_cents * q;
  }
  return total;
}
