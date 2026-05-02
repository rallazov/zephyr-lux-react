import type { SupabaseClient } from "@supabase/supabase-js";
import { CUSTOMER_ACCOUNT_ORDER_UUID_REGEX } from "../../src/lib/customerAccountOrderId";
import {
  fulfillmentStatusSchema,
  paymentStatusSchema,
  type FulfillmentStatus,
  type PaymentStatus,
} from "../../src/domain/commerce/enums";
import {
  CUSTOMER_ORDER_STATUS_LOOKUP_FAILED,
  buildCustomerOrderStatusResponse,
  type CustomerOrderStatusResponse,
} from "./customerOrderStatus";

export const ACCOUNT_ORDER_HISTORY_FAILED_BODY =
  "Account order history is temporarily unavailable." as const;

/** Matches server list cap documented for customer `/account` order history. */
export const CUSTOMER_ACCOUNT_ORDER_HISTORY_LIST_LIMIT = 200;

type OrderListRowDb = {
  id: string;
  order_number: string;
  created_at: string;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  order_items: { count: number }[] | { count: number } | null;
};

type OrderDetailRow = {
  id: string;
  order_number: string;
  created_at: string;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  customer_email: string | null;
};

type OrderItemRow = Parameters<typeof buildCustomerOrderStatusResponse>[0]["items"][number];

type OrderEventRow = Parameters<typeof buildCustomerOrderStatusResponse>[0]["events"][number];

type ShipmentRow = NonNullable<
  Parameters<typeof buildCustomerOrderStatusResponse>[0]["shipment"]
>;

function parsePaymentForCustomerList(value: string): PaymentStatus {
  const parsed = paymentStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "pending_payment";
}

function parseFulfillmentForCustomerList(value: string): FulfillmentStatus {
  const parsed = fulfillmentStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "processing";
}

function toNonNegativeTruncInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const v = Math.trunc(value);
    return v >= 0 ? v : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    if (!Number.isFinite(n)) return null;
    const v = Math.trunc(n);
    return v >= 0 ? v : null;
  }
  return null;
}

function orderItemsCount(row: OrderListRowDb): number {
  const m = row.order_items;
  if (Array.isArray(m)) {
    for (const cell of m) {
      const c =
        cell && typeof cell === "object" && "count" in cell
          ? (cell as { count: unknown }).count
          : undefined;
      const parsed = toNonNegativeTruncInt(c);
      if (parsed !== null) return parsed;
    }
    return 0;
  }
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const parsed = toNonNegativeTruncInt((m as { count?: unknown }).count);
    if (parsed !== null) return parsed;
  }
  return 0;
}

export function parseAccountOrderIdParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!CUSTOMER_ACCOUNT_ORDER_UUID_REGEX.test(id)) return null;
  return id;
}

export type CustomerAccountOrderListRow = {
  order_id: string;
  order_number: string;
  created_at: string;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  total_cents: number;
  currency: string;
  item_count: number;
};

export type CustomerAccountOrderListResponseBody = {
  orders: CustomerAccountOrderListRow[];
};

export async function fetchCustomerAccountOrderList(args: {
  admin: SupabaseClient;
  customerId: string;
}): Promise<
  | { status: 200; body: CustomerAccountOrderListResponseBody }
  | { status: 500; body: { error: typeof ACCOUNT_ORDER_HISTORY_FAILED_BODY } }
> {
  const { admin, customerId } = args;

  const { data, error } = await admin
    .from("orders")
    .select(
      "id, order_number, created_at, payment_status, fulfillment_status, total_cents, currency, order_items(count)",
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(CUSTOMER_ACCOUNT_ORDER_HISTORY_LIST_LIMIT);

  if (error) {
    return { status: 500, body: { error: ACCOUNT_ORDER_HISTORY_FAILED_BODY } };
  }

  const orders = ((data ?? []) as OrderListRowDb[]).map((row) => ({
    order_id: row.id,
    order_number: row.order_number,
    created_at: row.created_at,
    payment_status: parsePaymentForCustomerList(row.payment_status),
    fulfillment_status: parseFulfillmentForCustomerList(row.fulfillment_status),
    total_cents: row.total_cents,
    currency: row.currency,
    item_count: orderItemsCount(row),
  }));

  return { status: 200, body: { orders } };
}

async function loadFulfillmentBundlesForCustomerOrder(args: {
  admin: SupabaseClient;
  orderId: string;
  orderRow: OrderDetailRow;
}): Promise<
  | { ok: true; response: CustomerOrderStatusResponse }
  | { ok: false; lookupFailed: true }
> {
  const { admin, orderId, orderRow } = args;

  const { data: shipmentRow, error: shipmentErr } = await admin
    .from("shipments")
    .select("carrier, tracking_number, tracking_url, status, shipped_at, delivered_at")
    .eq("order_id", orderId)
    .maybeSingle();

  if (shipmentErr) {
    return { ok: false, lookupFailed: true };
  }

  const { data: items, error: itemsErr } = await admin
    .from("order_items")
    .select(
      "product_title, variant_title, sku, quantity, unit_price_cents, total_cents, image_url",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (itemsErr) {
    return { ok: false, lookupFailed: true };
  }

  const { data: events, error: eventsErr } = await admin
    .from("order_events")
    .select("event_type, metadata, created_at")
    .eq("order_id", orderId)
    .in("event_type", ["fulfillment_status_changed"])
    .order("created_at", { ascending: true });

  if (eventsErr) {
    return { ok: false, lookupFailed: true };
  }

  const response = buildCustomerOrderStatusResponse({
    order: orderRow,
    items: (items ?? []) as OrderItemRow[],
    events: (events ?? []) as OrderEventRow[],
    shipment: shipmentRow as ShipmentRow | null,
  });

  return { ok: true, response };
}

export async function fetchCustomerAccountOrderDetail(args: {
  admin: SupabaseClient;
  customerId: string;
  orderId: string;
}): Promise<
  | { status: 200; body: CustomerOrderStatusResponse }
  | { status: 404 }
  | { status: 500; body: { error: typeof CUSTOMER_ORDER_STATUS_LOOKUP_FAILED } }
> {
  const { admin, customerId, orderId } = args;

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select(
      "id, order_number, created_at, payment_status, fulfillment_status, total_cents, currency, customer_email",
    )
    .eq("id", orderId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (orderErr) {
    return { status: 500, body: { error: CUSTOMER_ORDER_STATUS_LOOKUP_FAILED } };
  }

  if (!order) {
    return { status: 404 };
  }

  const bundles = await loadFulfillmentBundlesForCustomerOrder({
    admin,
    orderId,
    orderRow: order as OrderDetailRow,
  });

  if (!bundles.ok) {
    return { status: 500, body: { error: CUSTOMER_ORDER_STATUS_LOOKUP_FAILED } };
  }

  return { status: 200, body: bundles.response };
}
