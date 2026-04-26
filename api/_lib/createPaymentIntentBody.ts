import { z } from "zod";

/** One checkout line; `quantity` is the public Epic 3 field (mirrors `checkoutLineDraftSchema`). */
export const paymentIntentLineItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  variant_id: z.string().uuid().optional(),
  product_slug: z.string().min(1).optional(),
});

export type PaymentIntentLineItem = z.infer<typeof paymentIntentLineItemSchema>;

/**
 * POST /api/create-payment-intent body. Amount is always derived from the server catalog — never from the client.
 */
export const createPaymentIntentBodySchema = z
  .object({
    items: z.array(paymentIntentLineItemSchema).min(1, "At least one line item is required"),
    currency: z.enum(["usd"]).default("usd"),
    email: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().email().optional()
    ),
  });

export type CreatePaymentIntentBody = z.infer<typeof createPaymentIntentBodySchema>;

export function parseCreatePaymentIntentBody(raw: unknown): CreatePaymentIntentBody {
  return createPaymentIntentBodySchema.parse(raw);
}

/** Map validated lines to catalog pricing input, merging duplicate SKUs. */
export function lineItemsToCatalogRows(items: PaymentIntentLineItem[]): Array<{ sku: string; qty: number }> {
  const m = new Map<string, number>();
  for (const l of items) {
    m.set(l.sku, (m.get(l.sku) ?? 0) + l.quantity);
  }
  return [...m.entries()].map(([sku, qty]) => ({ sku, qty }));
}
