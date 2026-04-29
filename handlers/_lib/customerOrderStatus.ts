import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fulfillmentStatusSchema,
  paymentStatusSchema,
  shipmentPipelineStatusSchema,
  type FulfillmentStatus,
  type PaymentStatus,
  type ShipmentPipelineStatus,
} from "../../src/domain/commerce/enums";
import { safeHttpUrlForHref } from "../../src/domain/commerce/safeHttpUrl";
import { hashLookupToken } from "./customerOrderLookupLink";

export const CUSTOMER_ORDER_STATUS_INVALID_LINK =
  "Order status link is invalid or expired.";
export const CUSTOMER_ORDER_STATUS_LOOKUP_FAILED = "Order status lookup failed.";

const TOKEN_MIN_LENGTH = 32;
const TOKEN_MAX_LENGTH = 256;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const PUBLIC_TIMELINE_EVENT_TYPES = new Set(["fulfillment_status_changed"]);

export type CustomerOrderStatusItem = {
  product_title: string;
  variant_title: string | null;
  sku: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  image_url: string | null;
};

export type CustomerOrderTimelineEntry = {
  event_type: "fulfillment_status_changed";
  created_at: string;
  from: FulfillmentStatus | null;
  to: FulfillmentStatus | null;
};

/** Customer-safe shipment snapshot — Epic 5 `shipments` columns only (no row ids). */
export type CustomerOrderTrackingPayload = {
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: ShipmentPipelineStatus;
  shipped_at: string | null;
  delivered_at: string | null;
};

export type CustomerOrderStatusResponse = {
  order_number: string;
  created_at: string;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  total_cents: number;
  currency: string;
  customer_email_masked: string | null;
  items: CustomerOrderStatusItem[];
  timeline: CustomerOrderTimelineEntry[];
  tracking?: CustomerOrderTrackingPayload;
};

export type ResolveCustomerOrderStatusResult =
  | { status: 200; body: CustomerOrderStatusResponse }
  | { status: 404; body: { error: typeof CUSTOMER_ORDER_STATUS_INVALID_LINK } }
  | { status: 500; body: { error: typeof CUSTOMER_ORDER_STATUS_LOOKUP_FAILED } };

type TokenRow = {
  id: string;
  order_id: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  customer_email: string | null;
};

type OrderItemRow = {
  product_title: string;
  variant_title: string | null;
  sku: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  image_url: string | null;
};

type OrderEventRow = {
  event_type: string;
  metadata: unknown;
  created_at: string;
};

type ShipmentRow = {
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parseCustomerOrderStatusToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  if (token.length < TOKEN_MIN_LENGTH || token.length > TOKEN_MAX_LENGTH) {
    return null;
  }
  if (!TOKEN_PATTERN.test(token)) return null;
  return token;
}

export function maskCustomerEmail(email: string | null | undefined): string | null {
  const value = typeof email === "string" ? email.trim() : "";
  const at = value.indexOf("@");
  if (at <= 0 || at === value.length - 1) return null;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const visible = local.length <= 1 ? "*" : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function parsePaymentStatus(value: string): PaymentStatus {
  const parsed = paymentStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "pending_payment";
}

function parseFulfillmentStatus(value: unknown): FulfillmentStatus | null {
  if (typeof value !== "string") return null;
  const parsed = fulfillmentStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseShipmentPipelineStatus(value: unknown): ShipmentPipelineStatus {
  if (typeof value !== "string") return "pending";
  const parsed = shipmentPipelineStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "pending";
}

function serializeShipmentTracking(shipment: ShipmentRow): CustomerOrderTrackingPayload {
  const carrier = typeof shipment.carrier === "string" ? shipment.carrier.trim() : "";
  const tracking_number =
    typeof shipment.tracking_number === "string" ? shipment.tracking_number.trim() : "";
  const tracking_url_raw =
    typeof shipment.tracking_url === "string" ? shipment.tracking_url.trim() : "";
  const tracking_url = tracking_url_raw ? safeHttpUrlForHref(tracking_url_raw) : null;

  return {
    carrier: carrier ? carrier : null,
    tracking_number: tracking_number ? tracking_number : null,
    tracking_url,
    status: parseShipmentPipelineStatus(shipment.status),
    shipped_at: typeof shipment.shipped_at === "string" ? shipment.shipped_at : null,
    delivered_at: typeof shipment.delivered_at === "string" ? shipment.delivered_at : null,
  };
}

function publicTimelineEvent(row: OrderEventRow): CustomerOrderTimelineEntry | null {
  if (!PUBLIC_TIMELINE_EVENT_TYPES.has(row.event_type)) return null;
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return {
    event_type: "fulfillment_status_changed",
    created_at: row.created_at,
    from: parseFulfillmentStatus(metadata.from),
    to: parseFulfillmentStatus(metadata.to),
  };
}

export function buildCustomerOrderStatusResponse(args: {
  order: OrderRow;
  items: OrderItemRow[];
  events: OrderEventRow[];
  shipment?: ShipmentRow | null;
}): CustomerOrderStatusResponse {
  const fulfillment_status =
    parseFulfillmentStatus(args.order.fulfillment_status) ?? "processing";

  let tracking: CustomerOrderTrackingPayload | undefined;
  if (
    (fulfillment_status === "shipped" || fulfillment_status === "delivered")
    && args.shipment
  ) {
    tracking = serializeShipmentTracking(args.shipment);
  }

  return {
    order_number: args.order.order_number,
    created_at: args.order.created_at,
    payment_status: parsePaymentStatus(args.order.payment_status),
    fulfillment_status,
    total_cents: args.order.total_cents,
    currency: args.order.currency,
    customer_email_masked: maskCustomerEmail(args.order.customer_email),
    items: args.items.map((item) => ({
      product_title: item.product_title,
      variant_title: item.variant_title ?? null,
      sku: item.sku,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      total_cents: item.total_cents,
      image_url: item.image_url ?? null,
    })),
    timeline: args.events
      .map(publicTimelineEvent)
      .filter((event): event is CustomerOrderTimelineEntry => event !== null),
    ...(tracking ? { tracking } : {}),
  };
}

export async function resolveCustomerOrderStatus(args: {
  admin: SupabaseClient;
  token: string;
  now?: Date;
}): Promise<ResolveCustomerOrderStatusResult> {
  const now = args.now ?? new Date();
  const token_hash = hashLookupToken(args.token);

  const { data: tokenRow, error: tokenErr } = await args.admin
    .from("order_lookup_tokens")
    .select("id, order_id")
    .eq("token_hash", token_hash)
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  if (tokenErr) {
    return { status: 500, body: { error: CUSTOMER_ORDER_STATUS_LOOKUP_FAILED } };
  }

  if (!tokenRow) {
    return { status: 404, body: { error: CUSTOMER_ORDER_STATUS_INVALID_LINK } };
  }

  const token = tokenRow as TokenRow;

  const { data: order, error: orderErr } = await args.admin
    .from("orders")
    .select(
      "id, order_number, created_at, payment_status, fulfillment_status, total_cents, currency, customer_email",
    )
    .eq("id", token.order_id)
    .maybeSingle();

  if (orderErr) {
    return { status: 500, body: { error: CUSTOMER_ORDER_STATUS_LOOKUP_FAILED } };
  }

  if (!order) {
    return { status: 404, body: { error: CUSTOMER_ORDER_STATUS_INVALID_LINK } };
  }

  const { data: shipmentRow, error: shipmentErr } = await args.admin
    .from("shipments")
    .select("carrier, tracking_number, tracking_url, status, shipped_at, delivered_at")
    .eq("order_id", token.order_id)
    .maybeSingle();

  if (shipmentErr) {
    return { status: 500, body: { error: CUSTOMER_ORDER_STATUS_LOOKUP_FAILED } };
  }

  const { data: items, error: itemsErr } = await args.admin
    .from("order_items")
    .select("product_title, variant_title, sku, quantity, unit_price_cents, total_cents, image_url")
    .eq("order_id", token.order_id)
    .order("created_at", { ascending: true });

  if (itemsErr) {
    return { status: 500, body: { error: CUSTOMER_ORDER_STATUS_LOOKUP_FAILED } };
  }

  const { data: events, error: eventsErr } = await args.admin
    .from("order_events")
    .select("event_type, metadata, created_at")
    .eq("order_id", token.order_id)
    .in("event_type", Array.from(PUBLIC_TIMELINE_EVENT_TYPES))
    .order("created_at", { ascending: true });

  if (eventsErr) {
    return { status: 500, body: { error: CUSTOMER_ORDER_STATUS_LOOKUP_FAILED } };
  }

  const body = buildCustomerOrderStatusResponse({
    order: order as OrderRow,
    items: (items ?? []) as OrderItemRow[],
    events: (events ?? []) as OrderEventRow[],
    shipment: shipmentRow as ShipmentRow | null,
  });

  await args.admin
    .from("order_lookup_tokens")
    .update({ last_accessed_at: now.toISOString() })
    .eq("id", token.id);

  return { status: 200, body };
}
