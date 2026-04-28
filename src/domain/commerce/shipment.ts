import { z } from "zod";
import { shipmentPipelineStatusSchema } from "./enums";

/** Rows from PostgREST `shipments`. */
export const shipmentRowSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  carrier: z.string().nullable(),
  tracking_number: z.string().nullable(),
  tracking_url: z.string().nullable(),
  status: shipmentPipelineStatusSchema,
  shipped_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ShipmentRow = z.infer<typeof shipmentRowSchema>;

/** Client-friendly shape aligned with storefront/admin conventions (camelCase). */
export type Shipment = {
  id: string;
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentRow["status"];
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function shipmentFromRow(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    orderId: row.order_id,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    status: row.status,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Recommended read pattern for transactional email (Story 5-6): join `orders` × `shipments` on `order_id`.
 * Column names persist as `carrier`, `tracking_number`, `tracking_url` (snake_case in DB).
 */
export const shipmentsReadPathDocs = Object.freeze({
  join: "LEFT JOIN shipments ON shipments.order_id = orders.id AND orders.payment_status = 'paid'",
});
