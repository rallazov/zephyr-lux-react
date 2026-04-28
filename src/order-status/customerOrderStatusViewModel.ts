import type {
  FulfillmentStatus,
  PaymentStatus,
  ShipmentPipelineStatus,
} from "../domain/commerce/enums";
import { deriveTrackingUrlFromCarrier } from "../domain/commerce/trackingUrl";
import { safeHttpUrlForHref } from "../domain/commerce/safeHttpUrl";
import { formatCents } from "../lib/money";

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
  event_type: string;
  created_at: string;
  from?: FulfillmentStatus | null;
  to?: FulfillmentStatus | null;
};

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

export type CustomerOrderStatusViewModel = {
  orderNumber: string;
  placedAt: string;
  paymentLabel: string;
  fulfillmentLabel: string;
  totalDisplay: string;
  maskedEmail: string | null;
  progress: Array<{
    status: FulfillmentStatus;
    label: string;
    state: "complete" | "current" | "upcoming";
  }>;
  items: Array<{
    key: string;
    title: string;
    sku: string;
    quantity: number;
    unitPriceDisplay: string;
    totalDisplay: string;
    imageUrl: string | null;
  }>;
  timeline: Array<{
    key: string;
    label: string;
    createdAt: string;
  }>;
  tracking: CustomerOrderTrackingView | null;
};

export type CustomerOrderTrackingView = {
  carrier: string | null;
  trackingNumber: string | null;
  shipmentStatusLabel: string;
  shippedAtDisplay: string | null;
  deliveredAtDisplay: string | null;
  /** Safe https URL for primary track action (stored URL or carrier-derived). */
  trackHref: string | null;
  /** Stored URL present but not safe to use as `href` — show as plain text only. */
  opaqueOrUnsafeUrl: string | null;
  showPendingNotice: boolean;
};

const FULFILLMENT_PROGRESS: FulfillmentStatus[] = [
  "processing",
  "packed",
  "shipped",
  "delivered",
];

export function customerFulfillmentLabel(status: FulfillmentStatus): string {
  switch (status) {
    case "processing":
      return "Preparing";
    case "packed":
      return "Packed";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "canceled":
      return "Canceled";
  }
}

export function customerPaymentLabel(status: PaymentStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending_payment":
      return "Payment pending";
    case "refunded":
      return "Refunded";
    case "partially_refunded":
      return "Partially refunded";
    case "payment_failed":
      return "Payment failed";
  }
}

export function formatCustomerOrderDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function displayTitle(item: CustomerOrderStatusItem): string {
  return item.variant_title
    ? `${item.product_title} - ${item.variant_title}`
    : item.product_title;
}

function timelineLabel(event: CustomerOrderTimelineEntry): string {
  if (event.from && event.to) {
    return `${customerFulfillmentLabel(event.from)} to ${customerFulfillmentLabel(event.to)}`;
  }
  if (event.to) {
    return `${customerFulfillmentLabel(event.to)} update`;
  }
  return "Order status updated";
}

function isCustomerTimelineEvent(
  event: CustomerOrderTimelineEntry,
): event is CustomerOrderTimelineEntry & { event_type: "fulfillment_status_changed" } {
  return event.event_type === "fulfillment_status_changed";
}

function shipmentPipelineLabel(status: ShipmentPipelineStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "packed":
      return "Packed";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "returned":
      return "Returned";
    default:
      return String(status);
  }
}

export function buildCustomerOrderTrackingView(
  tracking: CustomerOrderTrackingPayload | undefined,
): CustomerOrderTrackingView | null {
  if (!tracking) return null;

  const carrier = tracking.carrier?.trim() || null;
  const trackingNumber = tracking.tracking_number?.trim() || null;
  const rawUrl = tracking.tracking_url?.trim() ?? "";

  const safeStored = rawUrl ? safeHttpUrlForHref(rawUrl) : null;
  const derivedCandidate =
    !safeStored ? deriveTrackingUrlFromCarrier(carrier, trackingNumber) : null;
  const derivedSafe = derivedCandidate ? safeHttpUrlForHref(derivedCandidate) : null;
  const trackHref = safeStored ?? derivedSafe ?? null;

  const opaqueOrUnsafeUrl = rawUrl && !safeStored && !trackHref ? rawUrl : null;

  const hasReadableDetail = Boolean(carrier || trackingNumber || rawUrl || trackHref);

  return {
    carrier,
    trackingNumber,
    shipmentStatusLabel: shipmentPipelineLabel(tracking.status),
    shippedAtDisplay: tracking.shipped_at ? formatCustomerOrderDate(tracking.shipped_at) : null,
    deliveredAtDisplay: tracking.delivered_at
      ? formatCustomerOrderDate(tracking.delivered_at)
      : null,
    trackHref,
    opaqueOrUnsafeUrl,
    showPendingNotice: !hasReadableDetail,
  };
}

export function buildCustomerOrderStatusViewModel(
  response: CustomerOrderStatusResponse,
): CustomerOrderStatusViewModel {
  const progress: CustomerOrderStatusViewModel["progress"] =
    response.fulfillment_status === "canceled"
      ? [
          {
            status: "canceled",
            label: customerFulfillmentLabel("canceled"),
            state: "current",
          },
        ]
      : (() => {
          const currentIndex = FULFILLMENT_PROGRESS.indexOf(response.fulfillment_status);
          return FULFILLMENT_PROGRESS.map((status, index) => ({
            status,
            label: customerFulfillmentLabel(status),
            state:
              currentIndex < 0
                ? ("upcoming" as const)
                : index < currentIndex
                  ? ("complete" as const)
                  : index === currentIndex
                    ? ("current" as const)
                    : ("upcoming" as const),
          }));
        })();

  return {
    orderNumber: response.order_number,
    placedAt: formatCustomerOrderDate(response.created_at),
    paymentLabel: customerPaymentLabel(response.payment_status),
    fulfillmentLabel: customerFulfillmentLabel(response.fulfillment_status),
    totalDisplay: formatCents(response.total_cents, response.currency),
    maskedEmail: response.customer_email_masked,
    progress,
    items: response.items.map((item) => ({
      key: `${item.sku}-${item.product_title}-${item.variant_title ?? ""}`,
      title: displayTitle(item),
      sku: item.sku,
      quantity: item.quantity,
      unitPriceDisplay: formatCents(item.unit_price_cents, response.currency),
      totalDisplay: formatCents(item.total_cents, response.currency),
      imageUrl: item.image_url,
    })),
    timeline: response.timeline
      .filter(isCustomerTimelineEvent)
      .map((event) => ({
        key: `${event.event_type}-${event.created_at}-${event.to ?? ""}`,
        label: timelineLabel(event),
        createdAt: formatCustomerOrderDate(event.created_at),
      })),
    tracking: buildCustomerOrderTrackingView(response.tracking),
  };
}
