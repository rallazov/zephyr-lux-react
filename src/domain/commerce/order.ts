import { z } from "zod";
import { addressSchema } from "./address";
import {
  fulfillmentStatusSchema,
  iso4217CurrencySchema,
  paymentEventIngestStatusSchema,
  paymentStatusSchema,
} from "./enums";

/** Stripe (and future provider) references on an order — AC “PaymentReference” surface. */
export const paymentReferenceSchema = z.object({
  stripe_payment_intent_id: z.string().nullable().optional(),
  stripe_checkout_session_id: z.string().nullable().optional(),
});

export type PaymentReference = z.infer<typeof paymentReferenceSchema>;

/** Snapshot line item persisted on orders (FR-ORD-005). */
export const orderItemSchema = z.object({
  sku: z.string().min(1),
  product_title: z.string().min(1),
  variant_title: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  unit_price_cents: z.number().int().nonnegative(),
  total_cents: z.number().int().nonnegative(),
  image_url: z.string().nullable().optional(),
  product_id: z.string().uuid().nullable().optional(),
  variant_id: z.string().uuid().nullable().optional(),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

/** FR-ORD-002 — generation / uniqueness is out of scope; lexical shape only. */
export const orderNumberSchema = z.string().regex(/^ZLX-\d{8}-\d{4}$/);

export const orderSchema = z
  .object({
    id: z.string().uuid().optional(),
    order_number: orderNumberSchema,
    customer_id: z.string().uuid().nullable().optional(),
    customer_email: z.email(),
    customer_name: z.string().nullable().optional(),
    payment_status: paymentStatusSchema,
    fulfillment_status: fulfillmentStatusSchema,
    subtotal_cents: z.number().int().nonnegative(),
    shipping_cents: z.number().int().nonnegative(),
    tax_cents: z.number().int().nonnegative(),
    discount_cents: z.number().int().nonnegative(),
    total_cents: z.number().int().nonnegative(),
    currency: iso4217CurrencySchema,
    shipping_address: addressSchema,
    ...paymentReferenceSchema.shape,
    notes: z.string().nullable().optional(),
    line_items: z.array(orderItemSchema),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export type Order = z.infer<typeof orderSchema>;

/**
 * Lean shape for future `payment_events` rows / webhooks.
 * `ingest_status` maps to DB column `status` — not order `payment_status`.
 */
export const paymentEventSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  provider_event_id: z.string(),
  event_type: z.string(),
  processed_at: z.string().nullable().optional(),
  payload_hash: z.string().nullable().optional(),
  ingest_status: paymentEventIngestStatusSchema,
  error_message: z.string().nullable().optional(),
  created_at: z.string(),
});

export type PaymentEvent = z.infer<typeof paymentEventSchema>;
