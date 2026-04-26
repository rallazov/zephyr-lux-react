import { z } from "zod";

/**
 * Cart line identity is **SKU** (FR-CART-001 / FR-CAT-003). Epic 3 will adopt this
 * shape; current `CartContext` may still use product-id keys until migrated.
 */
export const cartItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  product_title: z.string().optional(),
  variant_title: z.string().optional(),
  image_url: z.string().optional(),
  unit_price_cents: z.number().int().nonnegative().optional(),
});

export type CartItem = z.infer<typeof cartItemSchema>;
