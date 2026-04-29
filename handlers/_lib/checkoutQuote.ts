import {
  quoteCartLines,
  FLAT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
  TAX_BPS,
  type CartQuote,
} from "./catalog";

export type { CartQuote };
export { FLAT_SHIPPING_CENTS, FREE_SHIPPING_THRESHOLD_CENTS, TAX_BPS };

/** @deprecated use `FLAT_SHIPPING_CENTS` / `TAX_BPS` (alias for story 3-3 / tests) */
export const CHECKOUT_FLAT_SHIPPING_CENTS = FLAT_SHIPPING_CENTS;
export const CHECKOUT_TAX_BPS = TAX_BPS;

/**
 * One PaymentIntent `amount` (minor units) — same rules as `quoteCartLines` / cart-quote `total_cents`.
 */
export function totalChargeCentsFromCatalogLines(
  items: Array<{ sku: string; qty: number }>,
): number {
  return quoteCartLines(
    items.map((i) => ({ sku: i.sku, quantity: i.qty })),
  ).total_cents;
}
