import { z } from "zod";
import { deriveTrackingUrlFromCarrier } from "../../src/domain/commerce/trackingUrl";

function toTrimmedNullable(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val !== "string") return null;
  const t = val.trim();
  return t === "" ? null : t;
}

/** POST /api/admin-shipment — aligns with shipments.* columns (story 5-5 AC3 snake_case REST body). */
export const adminShipmentUpsertBodySchema = z
  .object({
    order_id: z.string().uuid(),
    carrier: z.preprocess(toTrimmedNullable, z.string().max(160).nullable()),
    tracking_number: z.preprocess(toTrimmedNullable, z.string().max(200).nullable()),
    tracking_url: z.preprocess(toTrimmedNullable, z.string().max(2048).nullable()),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.tracking_url) return;
    try {
      const u = new URL(val.tracking_url);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "tracking_url must be http(s)",
          path: ["tracking_url"],
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tracking_url must be a valid absolute URL",
        path: ["tracking_url"],
      });
    }
  });

export type AdminShipmentUpsertBody = z.infer<typeof adminShipmentUpsertBodySchema>;

/** Prefer explicit manual URL; else USPS/UPS/FedEx auto-fill when recognizable. */
export function normalizedTrackingUrlForDb(
  body: Pick<AdminShipmentUpsertBody, "carrier" | "tracking_number" | "tracking_url">,
): string | null {
  if (body.tracking_url) return body.tracking_url;
  return deriveTrackingUrlFromCarrier(body.carrier, body.tracking_number);
}
