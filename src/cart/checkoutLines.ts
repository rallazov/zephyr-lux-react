import {
  checkoutLineDraftSchema,
  type CheckoutLineDraft,
} from "../domain/commerce/cart";
import type { StorefrontCartLine } from "./cartLine";
import { normalizeLineSku } from "./lineKey";

/**
 * Serializable checkout body lines: SKU + quantity + optional variant UUID and product slug.
 * Omits legacy rows with empty SKU (cannot be keyed server-side).
 * Malformed `variant_id` in storage is dropped (safeParse) so callers never throw.
 */
export function toCheckoutLines(items: StorefrontCartLine[]): CheckoutLineDraft[] {
  const out: CheckoutLineDraft[] = [];
  for (const item of items) {
    const sku = normalizeLineSku(item.sku);
    if (sku === "") continue;
    const base = {
      sku,
      quantity: item.quantity,
      product_slug: item.product_slug,
    };
    const withVariant = { ...base, variant_id: item.variant_id };
    let r = checkoutLineDraftSchema.safeParse(withVariant);
    if (!r.success && item.variant_id) {
      r = checkoutLineDraftSchema.safeParse(base);
    }
    if (r.success) {
      out.push(r.data);
    }
  }
  return out;
}
