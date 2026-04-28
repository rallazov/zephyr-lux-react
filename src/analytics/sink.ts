import type { AnalyticsEvent } from "./events";
import { ANALYTICS_EVENTS } from "./events";
import {
  deepRedactEmails,
  stringLooksLikeEmail,
  stringLooksLikeStripeOrPaymentRef,
} from "./pii";

type AnalyticsSink = (event: AnalyticsEvent) => void;

let injectedSink: AnalyticsSink | null = null;

/** Test-only: capture events without going through idle scheduling (see `schedule`). */
let synchronousTestMode = false;

export function registerAnalyticsSink(sink: AnalyticsSink | null): void {
  injectedSink = sink;
}

/** Vitest: flush with microtasks via `await Promise.resolve()`. */
export function setAnalyticsSynchronousTestMode(enabled: boolean): void {
  synchronousTestMode = enabled;
}

function schedule(fn: () => void): void {
  if (synchronousTestMode || import.meta.env.MODE === "test") {
    queueMicrotask(fn);
    return;
  }
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => fn(), { timeout: 2000 });
    return;
  }
  setTimeout(fn, 0);
}

function normalizePathname(path: string): string {
  const base = path.split("?")[0]?.split("#")[0] ?? "/";
  return base || "/";
}

function sanitizeAllowlisted(event: AnalyticsEvent): AnalyticsEvent | null {
  switch (event.name) {
    case ANALYTICS_EVENTS.page_view: {
      const path = normalizePathname(event.payload.path);
      if (stringLooksLikeEmail(path) || stringLooksLikeStripeOrPaymentRef(path)) {
        return null;
      }
      return { name: event.name, payload: { path } };
    }
    case ANALYTICS_EVENTS.product_view: {
      const slug = event.payload.slug.trim();
      if (!slug || stringLooksLikeEmail(slug)) return null;
      const product_id = event.payload.product_id?.trim();
      if (product_id && stringLooksLikeStripeOrPaymentRef(product_id)) return null;
      return {
        name: event.name,
        payload: {
          slug,
          ...(product_id ? { product_id } : {}),
        },
      };
    }
    case ANALYTICS_EVENTS.add_to_cart: {
      const sku = String(event.payload.sku ?? "").trim();
      const product_slug = String(event.payload.product_slug ?? "").trim();
      if (!sku && !product_slug) return null;
      if (stringLooksLikeEmail(sku) || stringLooksLikeEmail(product_slug)) {
        return null;
      }
      const q = event.payload.quantity;
      const base = { sku, product_slug };
      if (typeof q === "number" && Number.isFinite(q) && q > 0) {
        return {
          name: ANALYTICS_EVENTS.add_to_cart,
          payload: { ...base, quantity: Math.floor(q) },
        };
      }
      return {
        name: ANALYTICS_EVENTS.add_to_cart,
        payload: base,
      };
    }
    case ANALYTICS_EVENTS.checkout_start: {
      const n = event.payload.line_item_count;
      if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
      return {
        name: event.name,
        payload: { line_item_count: Math.floor(n) },
      };
    }
    case ANALYTICS_EVENTS.purchase: {
      const order_number = String(event.payload.order_number ?? "").trim();
      if (
        !order_number ||
        stringLooksLikeEmail(order_number) ||
        stringLooksLikeStripeOrPaymentRef(order_number)
      ) {
        return null;
      }
      return { name: event.name, payload: { order_number } };
    }
    default:
      return null;
  }
}

function forwardToThirdParty(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;

  const plausibleDomain = import.meta.env.VITE_ANALYTICS_PLAUSIBLE_DOMAIN?.trim();
  const gaMeasurementId = import.meta.env.VITE_ANALYTICS_GA_MEASUREMENT_ID?.trim();

  const w = window as unknown as Window & {
    plausible?: (n: string, o?: { props: Record<string, unknown> }) => void;
    gtag?: (...args: unknown[]) => void;
  };

  if (plausibleDomain && typeof w.plausible === "function") {
    const props: Record<string, unknown> =
      "payload" in event ? { ...event.payload } : {};
    w.plausible(event.name, { props });
    return;
  }

  if (gaMeasurementId && typeof w.gtag === "function") {
    const params =
      "payload" in event
        ? Object.fromEntries(
            Object.entries(event.payload).map(([k, v]) => [
              k,
              typeof v === "object" ? JSON.stringify(v) : v,
            ])
          )
        : {};
    w.gtag("event", event.name, params);
  }
}

/**
 * Public entry: privacy-normalized, non-blocking dispatch (Story 6-6).
 */
export function dispatchAnalyticsEvent(raw: AnalyticsEvent): void {
  const allowlisted = sanitizeAllowlisted(raw);
  if (!allowlisted) return;

  const safeForLog = deepRedactEmails(allowlisted) as AnalyticsEvent;

  schedule(() => {
    if (injectedSink) {
      injectedSink(safeForLog);
      return;
    }

    if (import.meta.env.DEV) {
      console.debug("[analytics]", safeForLog.name, safeForLog.payload);
      return;
    }

    const hasAdapter =
      Boolean(import.meta.env.VITE_ANALYTICS_PLAUSIBLE_DOMAIN?.trim()) ||
      Boolean(import.meta.env.VITE_ANALYTICS_GA_MEASUREMENT_ID?.trim());

    if (hasAdapter) {
      forwardToThirdParty(safeForLog);
    }
  });
}
