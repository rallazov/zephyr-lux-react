import { z } from "zod";

/** Order-level payment lifecycle (not `payment_events` ingest status). */
export const paymentStatusSchema = z.enum([
  "pending_payment",
  "paid",
  "refunded",
  "partially_refunded",
  "payment_failed",
]);

/** Order-level fulfillment pipeline (partitioned from `PaymentStatus`). */
export const fulfillmentStatusSchema = z.enum([
  "processing",
  "packed",
  "shipped",
  "delivered",
  "canceled",
]);

/** PRD §12.6 / `shipments.status` — parcel-level lifecycle (≠ `orders.fulfillment_status`). */
export const shipmentPipelineStatusSchema = z.enum([
  "pending",
  "packed",
  "shipped",
  "delivered",
  "returned",
]);

export const productStatusSchema = z.enum([
  "draft",
  "active",
  "coming_soon",
  "archived",
]);

export const productVariantStatusSchema = z.enum([
  "active",
  "inactive",
  "discontinued",
]);

/** Ingest pipeline status for `payment_events.status` — distinct from order `payment_status`. */
export const paymentEventIngestStatusSchema = z.enum([
  "received",
  "processed",
  "failed",
  "ignored",
]);

/**
 * ISO 4217-style currency code: length 3, uppercased. Intentionally does **not**
 * check against the official code list (invalid codes like `ZZZ` pass); narrow
 * with `z.enum([...])` at boundaries if MVP is single-currency or add a list refine later.
 */
export const iso4217CurrencySchema = z
  .string()
  .length(3)
  .transform((c) => c.toUpperCase());

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;
export type ShipmentPipelineStatus = z.infer<typeof shipmentPipelineStatusSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type ProductVariantStatus = z.infer<typeof productVariantStatusSchema>;
export type PaymentEventIngestStatus = z.infer<
  typeof paymentEventIngestStatusSchema
>;
