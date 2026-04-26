import {
  cartItemSchema,
  type DomainCartLineItem,
} from "../domain/commerce/cart";
import type { StorefrontCartLine } from "./cartLine";
import { normalizeLineSku } from "./lineKey";

/** Persisted UI line → domain Zod boundary (requires non-empty SKU). */
export function domainLineFromStorefront(
  line: StorefrontCartLine
): DomainCartLineItem | null {
  const sku = normalizeLineSku(line.sku);
  if (sku === "") return null;
  const base = {
    sku,
    quantity: line.quantity,
    storefront_product_id: line.id,
    product_slug: line.product_slug,
    product_title: line.name,
    image_url: line.image,
    unit_price_cents: Math.round(line.price * 100),
  };
  const withVariant = { ...base, variant_id: line.variant_id };
  let r = cartItemSchema.safeParse(withVariant);
  if (!r.success && line.variant_id) {
    r = cartItemSchema.safeParse({ ...base, variant_id: undefined });
  }
  return r.success ? r.data : null;
}
