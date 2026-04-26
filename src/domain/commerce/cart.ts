import { z } from "zod";

/**
 * Cart line identity is **SKU** (FR-CART-001 / FR-CAT-003), with optional server keys
 * for Epic 3. UI persistence uses `StorefrontCartLine` in `src/cart/cartLine.ts`; map here
 * for API/export validation.
 */
export const cartItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  variant_id: z.string().uuid().optional(),
  storefront_product_id: z.number().int().nonnegative().optional(),
  product_slug: z.string().min(1).optional(),
  product_title: z.string().optional(),
  variant_title: z.string().optional(),
  image_url: z.string().optional(),
  unit_price_cents: z.number().int().nonnegative().optional(),
});

/** Zod-validated cart/API line; prefer this name over `CartItem` to avoid clashing with React context. */
export type DomainCartLineItem = z.infer<typeof cartItemSchema>;

/** @deprecated Use `DomainCartLineItem` — collides with `CartItem` in `CartContext`. */
export type CartItem = DomainCartLineItem;

/** Minimal serializable payload for future checkout POST (no client-trusted price). */
export const checkoutLineDraftSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  variant_id: z.string().uuid().optional(),
  product_slug: z.string().min(1).optional(),
});

export type CheckoutLineDraft = z.infer<typeof checkoutLineDraftSchema>;
