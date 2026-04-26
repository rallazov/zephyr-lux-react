/**
 * Browser-side mirror of `CartQuote` from `api/_lib/catalog` (JSON from POST /api/cart-quote).
 */
export type ServerCartLineQuote = {
  sku: string;
  quantity: number;
  unit_cents: number;
  line_cents: number;
  product_title: string;
};

/** @alias for cart row display (same as `ServerCartLineQuote`) */
export type CartLineQuote = ServerCartLineQuote;

export type ServerCartQuote = {
  currency: "usd";
  lines: ServerCartLineQuote[];
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
};

/** Alias used by `useCartQuote` and API responses (same shape as `CartQuote` in `api/_lib/catalog`). */
export type CartQuote = ServerCartQuote;

export function isServerCartQuote(x: unknown): x is ServerCartQuote {
  if (x === null || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.currency === "usd" &&
    Array.isArray(o.lines) &&
    Number.isFinite(o.subtotal_cents) &&
    Number.isFinite(o.shipping_cents) &&
    Number.isFinite(o.tax_cents) &&
    Number.isFinite(o.total_cents)
  );
}
