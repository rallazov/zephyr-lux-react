/**
 * Aligned with `api/_lib/notificationLog.ts` `NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID` — browser-safe constant.
 * Owner paid email; failed rows surface in the admin list (5-2).
 */
export const TEMPLATE_OWNER_ORDER_PAID = "owner_order_paid" as const;

/** Default page size (AC6); keep in one place for tests. */
export const ADMIN_ORDER_LIST_PAGE_SIZE = 25;

/** “Open fulfillment” backlog (5-2): paid and not in terminal shipped/delivered/canceled. */
export const OPEN_FULFILLMENT_FULFILLMENT_TERMINAL = [
  "shipped",
  "delivered",
  "canceled",
] as const;

/** PostgREST tuple for `.not("fulfillment_status", "in", …)` aligned with OPEN_FULFILLMENT_* (order matches prior literals). */
export const FULFILLMENT_TERMINAL_POSTGREST_IN = `(${OPEN_FULFILLMENT_FULFILLMENT_TERMINAL.join(",")})` as const;

/**
 * List view default: operational paid orders, excluding noise from unpaid/failed.
 * `partially_refunded`: still shown when fulfillable; adjust if finance-only workflows need to hide.
 */
export const ORDER_LIST_PAYMENT_STATUSES = ["paid", "partially_refunded"] as const;

/**
 * True when the order matches the same “open fulfillment” definition as the DB filter
 * (paid + fulfillment not in shipped/delivered/canceled).
 */
export function isOpenFulfillment(
  paymentStatus: string,
  fulfillmentStatus: string
): boolean {
  if (paymentStatus !== "paid") {
    return false;
  }
  return !OPEN_FULFILLMENT_FULFILLMENT_TERMINAL.includes(
    fulfillmentStatus as (typeof OPEN_FULFILLMENT_FULFILLMENT_TERMINAL)[number]
  );
}

export function formatOrderMoney(cents: number, currency: string): string {
  const cur = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
}

/** `created_at` is shown in UTC with an explicit label (5-2). */
export function formatOrderDateUtc(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) {
    return createdAt;
  }
  return (
    d.toLocaleString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }) + " UTC"
  );
}

export function humanizeEnum(s: string): string {
  return s.replaceAll("_", " ");
}

type OrderItemsAgg = { count: number }[] | { count: number } | null | undefined;

export function getLineItemCount(orderItems: OrderItemsAgg): number {
  if (orderItems == null) {
    return 0;
  }
  if (Array.isArray(orderItems)) {
    return orderItems[0]?.count ?? 0;
  }
  if (typeof orderItems === "object" && "count" in orderItems) {
    return orderItems.count;
  }
  return 0;
}
