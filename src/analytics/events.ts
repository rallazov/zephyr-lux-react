/**
 * Storefront analytics event catalog (FR-AN-002, Story 6-6).
 * Names are stable string literals for adapters (Plausible, GA4, etc.).
 */

export const ANALYTICS_EVENTS = {
  page_view: "page_view",
  product_view: "product_view",
  add_to_cart: "add_to_cart",
  checkout_start: "checkout_start",
  purchase: "purchase",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsEvent =
  | { name: typeof ANALYTICS_EVENTS.page_view; payload: { path: string } }
  | {
      name: typeof ANALYTICS_EVENTS.product_view;
      payload: { slug: string; product_id?: string };
    }
  | {
      name: typeof ANALYTICS_EVENTS.add_to_cart;
      payload: { sku: string; product_slug: string; quantity?: number };
    }
  | {
      name: typeof ANALYTICS_EVENTS.checkout_start;
      payload: { line_item_count: number };
    }
  | {
      name: typeof ANALYTICS_EVENTS.purchase;
      payload: { order_number: string };
    };
