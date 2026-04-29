import { z } from "zod";

export const shipmentImageTypeSchema = z.enum(["label", "package", "receipt", "other"]);

export type ShipmentImageType = z.infer<typeof shipmentImageTypeSchema>;

/** Rows from PostgREST `shipment_images`. */
export const shipmentImageRowSchema = z.object({
  id: z.string().uuid(),
  shipment_id: z.string().uuid(),
  order_id: z.string().uuid(),
  storage_path: z.string().min(1),
  image_type: shipmentImageTypeSchema,
  created_at: z.string(),
});

export type ShipmentImageRow = z.infer<typeof shipmentImageRowSchema>;

/** Max upload size (bytes); keep ≤ Vercel request body limits; mirrored in API. */
export const SHIPMENT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export const SHIPMENT_IMAGE_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ShipmentImageMime = (typeof SHIPMENT_IMAGE_ALLOWED_MIME)[number];
