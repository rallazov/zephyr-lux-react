import {
  fulfillmentStatusSchema,
  paymentStatusSchema,
  shipmentPipelineStatusSchema,
  type FulfillmentStatus,
  type PaymentStatus,
} from "../domain/commerce/enums";
import type {
  CustomerOrderStatusItem,
  CustomerOrderStatusResponse,
  CustomerOrderTimelineEntry,
  CustomerOrderTrackingPayload,
} from "./customerOrderStatusViewModel";

function parseItem(raw: unknown): CustomerOrderStatusItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.product_title !== "string") return null;
  if (typeof o.sku !== "string") return null;
  if (typeof o.quantity !== "number" || !Number.isFinite(o.quantity)) return null;
  if (typeof o.unit_price_cents !== "number" || !Number.isFinite(o.unit_price_cents)) return null;
  if (typeof o.total_cents !== "number" || !Number.isFinite(o.total_cents)) return null;
  if (typeof o.image_url !== "string" && o.image_url !== null) return null;

  let variant_title: string | null;
  if (o.variant_title === null || typeof o.variant_title === "undefined") variant_title = null;
  else if (typeof o.variant_title === "string") variant_title = o.variant_title;
  else return null;

  return {
    product_title: o.product_title,
    variant_title,
    sku: o.sku,
    quantity: o.quantity,
    unit_price_cents: o.unit_price_cents,
    total_cents: o.total_cents,
    image_url: o.image_url,
  };
}

/** `null` = JSON null legal column; `"bad"` = reject payload; otherwise parsed status. */
function parseFulfillmentColumn(value: unknown): FulfillmentStatus | null | "bad" {
  if (value === null) return null;
  const parsed = fulfillmentStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "bad";
}

function parseTimeline(entries: unknown): CustomerOrderTimelineEntry[] | null {
  if (!Array.isArray(entries)) return null;
  const out: CustomerOrderTimelineEntry[] = [];
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (o.event_type !== "fulfillment_status_changed") return null;
    if (typeof o.created_at !== "string") return null;
    if (!("from" in o) || !("to" in o)) return null;

    const fromCol = parseFulfillmentColumn(o.from);
    const toCol = parseFulfillmentColumn(o.to);
    if (fromCol === "bad" || toCol === "bad") return null;

    out.push({
      event_type: "fulfillment_status_changed",
      created_at: o.created_at,
      from: fromCol,
      to: toCol,
    });
  }
  return out;
}

function parseTrackingObject(raw: unknown): CustomerOrderTrackingPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const statusParsed = shipmentPipelineStatusSchema.safeParse(o.status);
  if (!statusParsed.success) return null;

  const carrier = typeof o.carrier === "string" ? o.carrier.trim() || null : null;
  const tracking_number =
    typeof o.tracking_number === "string" ? o.tracking_number.trim() || null : null;
  const tracking_url =
    typeof o.tracking_url === "string" ? o.tracking_url.trim() || null : null;
  const shipped_at = typeof o.shipped_at === "string" ? o.shipped_at : null;
  const delivered_at = typeof o.delivered_at === "string" ? o.delivered_at : null;

  return {
    carrier,
    tracking_number,
    tracking_url,
    status: statusParsed.data,
    shipped_at,
    delivered_at,
  };
}

/**
 * Validates wire JSON returned by customer order status/account detail endpoints
 * before it reaches storefront view-model builders.
 */
export function parseCustomerOrderStatusWirePayload(
  raw: unknown,
): CustomerOrderStatusResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.order_number !== "string") return null;
  if (typeof o.created_at !== "string") return null;

  const pay = paymentStatusSchema.safeParse(o.payment_status);
  if (!pay.success) return null;

  const ful = fulfillmentStatusSchema.safeParse(o.fulfillment_status);
  if (!ful.success) return null;

  if (typeof o.total_cents !== "number" || !Number.isFinite(o.total_cents)) return null;
  if (typeof o.currency !== "string") return null;
  if (!(o.customer_email_masked === null || typeof o.customer_email_masked === "string")) {
    return null;
  }

  if (!Array.isArray(o.items)) return null;

  const items: CustomerOrderStatusItem[] = [];
  for (const row of o.items) {
    const parsed = parseItem(row);
    if (!parsed) return null;
    items.push(parsed);
  }

  const timeline = parseTimeline(o.timeline);
  if (!timeline) return null;

  let tracking: CustomerOrderTrackingPayload | undefined;
  if ("tracking" in o && o.tracking !== null && typeof o.tracking !== "undefined") {
    const t = parseTrackingObject(o.tracking);
    if (!t) return null;
    tracking = t;
  }

  const body: CustomerOrderStatusResponse = {
    order_number: o.order_number,
    created_at: o.created_at,
    payment_status: pay.data as PaymentStatus,
    fulfillment_status: ful.data as FulfillmentStatus,
    total_cents: o.total_cents,
    currency: o.currency,
    customer_email_masked: o.customer_email_masked,
    items,
    timeline,
    ...(tracking ? { tracking } : {}),
  };

  return body;
}
