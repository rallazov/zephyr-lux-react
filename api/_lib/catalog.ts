import fs from "node:fs";
import path from "node:path";

type Variant = { sku: string; options: { size: string; color: string }; price: number; inventory: number; image: string };
export type Product = { id: number; slug: string; title: string; fabricType: string; variants: Variant[] };

let _cache: Product[] | null = null;

export function loadCatalog(): Product[] {
  if (_cache) return _cache;
  const p = path.join(process.cwd(), "data", "products.json");
  const json = fs.readFileSync(p, "utf-8");
  _cache = JSON.parse(json);
  return _cache!;
}

export function findVariantBySku(sku: string) {
  const catalog = loadCatalog();
  for (const product of catalog) {
    const v = product.variants.find((v) => v.sku === sku);
    if (v) return { product, variant: v };
  }
  return null;
}

export function computeAmountCents(items: Array<{ sku: string; qty: number }>) {
  let total = 0;
  for (const it of items) {
    const hit = findVariantBySku(it.sku);
    if (!hit) throw new Error(`Unknown SKU: ${it.sku}`);
    total += Math.round(hit.variant.price * 100) * Math.max(1, it.qty | 0);
  }
  return total;
}


