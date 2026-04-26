import fs from "node:fs";
import path from "node:path";
import { parseStaticCatalogData } from "../../src/catalog/parse";
import type { Product, ProductVariant } from "../../src/domain/commerce";

let _cache: { products: Product[]; bySku: Map<string, { product: Product; variant: ProductVariant }> } | null = null;

/** $50 — matches Cart free-shipping bar */
export const FREE_SHIPPING_THRESHOLD_CENTS = 5_000;
export const FLAT_SHIPPING_CENTS = 500;
/** 7% of merchandise subtotal (pre-shipping) — matches prior checkout UI. */
export const TAX_BPS = 700;

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

export class QuoteError extends Error {
  constructor(
    public readonly code: "UNKNOWN_SKU" | "INVALID_LINE",
    message: string,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

export function loadCatalog(): Product[] {
  return loadFromDisk().products;
}

export function findVariantBySku(sku: string) {
  return loadFromDisk().bySku.get(sku) ?? null;
}

export type CartLineQuote = {
  sku: string;
  quantity: number;
  unit_cents: number;
  line_cents: number;
  product_title: string;
};

export type CartQuote = {
  currency: "usd";
  lines: CartLineQuote[];
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
};

function mergeQuantitiesBySku(
  items: Array<{ sku: string; quantity: number }>,
): Array<{ sku: string; quantity: number }> {
  const m = new Map<string, number>();
  for (const row of items) {
    m.set(row.sku, (m.get(row.sku) ?? 0) + row.quantity);
  }
  return [...m.entries()].map(([sku, quantity]) => ({ sku, quantity }));
}

/**
 * Resolves per-line and full-order cents from the server catalog. Tax is 7% of
 * merchandise subtotal; shipping is $0 when subtotal ≥ $50, else flat $5.00 (`FLAT_SHIPPING_CENTS`).
 * Duplicate `sku` rows are merged (quantities summed) before pricing.
 */
export function quoteCartLines(
  items: Array<{ sku: string; quantity: number }>,
): CartQuote {
  if (!Array.isArray(items) || items.length === 0) {
    throw new QuoteError("INVALID_LINE", "At least one line item is required");
  }
  const merged = mergeQuantitiesBySku(items);
  const lines: CartLineQuote[] = [];
  for (const row of merged) {
    if (!row.sku || typeof row.sku !== "string") {
      throw new QuoteError("INVALID_LINE", "Each line must include a non-empty sku");
    }
    const q = row.quantity;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 1) {
      throw new QuoteError("INVALID_LINE", "quantity must be a positive integer");
    }
    const hit = findVariantBySku(row.sku);
    if (!hit) {
      throw new QuoteError("UNKNOWN_SKU", `Unknown SKU: ${row.sku}`);
    }
    const unit_cents = hit.variant.price_cents;
    if (typeof unit_cents !== "number" || !Number.isFinite(unit_cents) || unit_cents < 0) {
      throw new QuoteError("INVALID_LINE", `SKU ${row.sku} has no valid price in catalog`);
    }
    const line_cents = unit_cents * q;
    lines.push({
      sku: row.sku,
      quantity: q,
      unit_cents,
      line_cents,
      product_title: hit.product.title,
    });
  }
  const subtotal_cents = lines.reduce((s, l) => s + l.line_cents, 0);
  const shipping_cents =
    subtotal_cents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
  const tax_cents = Math.round((subtotal_cents * TAX_BPS) / 10_000);
  const total_cents = subtotal_cents + shipping_cents + tax_cents;
  return {
    currency: "usd",
    lines,
    subtotal_cents,
    shipping_cents,
    tax_cents,
    total_cents,
  };
}

type LegacyItem = { sku: string; qty?: number; quantity?: number };

/**
 * @deprecated For PaymentIntent, prefer `quoteCartLines` and use `total_cents` so tax/shipping match UI.
 * Merchandise subtotal in cents (legacy `items` with loose qty handling for existing clients).
 */
export function computeAmountCents(items: Array<LegacyItem>) {
  const normalized: Array<{ sku: string; quantity: number }> = [];
  for (const it of items) {
    const raw = it.quantity !== undefined ? it.quantity : it.qty;
    const q = Math.max(1, Math.floor(Math.abs(Number(raw)) || 0) || 1);
    if (!it.sku) continue;
    normalized.push({ sku: it.sku, quantity: q });
  }
  if (normalized.length === 0) return 0;
  try {
    return quoteCartLines(normalized).subtotal_cents;
  } catch (e) {
    if (e instanceof QuoteError && e.code === "UNKNOWN_SKU") {
      throw new Error(e.message);
    }
    throw e;
  }
}

/**
 * One canonical order quote for `items` — use `total_cents` for Stripe when charging tax+shipping the same as cart-quote.
 */
export function quoteForPaymentItems(items: Array<LegacyItem>): CartQuote {
  const normalized: Array<{ sku: string; quantity: number }> = [];
  for (const it of items) {
    const raw = it.quantity !== undefined ? it.quantity : it.qty;
    const q = Math.max(1, Math.floor(Math.abs(Number(raw)) || 0) || 1);
    if (!it.sku) {
      throw new QuoteError("INVALID_LINE", "Each item must have a sku");
    }
    normalized.push({ sku: it.sku, quantity: q });
  }
  if (normalized.length === 0) {
    throw new QuoteError("INVALID_LINE", "No line items to price");
  }
  return quoteCartLines(normalized);
}
