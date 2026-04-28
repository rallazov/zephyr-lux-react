import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_EVENTS } from "./events";
import { deepRedactEmails, stringLooksLikeEmail } from "./pii";
import { dispatchAnalyticsEvent, registerAnalyticsSink } from "./sink";

describe("dispatchAnalyticsEvent", () => {
  afterEach(() => {
    registerAnalyticsSink(null);
  });

  it("normalizes page_view path and forwards to sink", async () => {
    const sink = vi.fn();
    registerAnalyticsSink(sink);
    dispatchAnalyticsEvent({
      name: ANALYTICS_EVENTS.page_view,
      payload: { path: "/shop?utm=x" },
    });
    await Promise.resolve();
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toEqual({
      name: ANALYTICS_EVENTS.page_view,
      payload: { path: "/shop" },
    });
  });

  it("drops add_to_cart when sku and product_slug are both empty", async () => {
    const sink = vi.fn();
    registerAnalyticsSink(sink);
    dispatchAnalyticsEvent({
      name: ANALYTICS_EVENTS.add_to_cart,
      payload: { sku: "  ", product_slug: "\t" },
    });
    await Promise.resolve();
    expect(sink).not.toHaveBeenCalled();
  });

  it("drops add_to_cart when product_slug looks like email", async () => {
    const sink = vi.fn();
    registerAnalyticsSink(sink);
    dispatchAnalyticsEvent({
      name: ANALYTICS_EVENTS.add_to_cart,
      payload: { sku: "SKU-1", product_slug: "evil@example.com", quantity: 1 },
    });
    await Promise.resolve();
    expect(sink).not.toHaveBeenCalled();
  });

  it("drops purchase when order_number looks like a Stripe id", async () => {
    const sink = vi.fn();
    registerAnalyticsSink(sink);
    dispatchAnalyticsEvent({
      name: ANALYTICS_EVENTS.purchase,
      payload: { order_number: "pi_abc123" },
    });
    await Promise.resolve();
    expect(sink).not.toHaveBeenCalled();
  });

  it("forwards checkout_start to sink with allowlisted payload", async () => {
    const sink = vi.fn();
    registerAnalyticsSink(sink);
    dispatchAnalyticsEvent({
      name: ANALYTICS_EVENTS.checkout_start,
      payload: { line_item_count: 2 },
    });
    await Promise.resolve();
    expect(sink).toHaveBeenCalledWith({
      name: ANALYTICS_EVENTS.checkout_start,
      payload: { line_item_count: 2 },
    });
  });
});

describe("deepRedactEmails", () => {
  it("redacts email-like strings in nested structures", () => {
    const out = deepRedactEmails({
      a: "ok",
      b: "user@example.com",
      c: [{ x: "x@y.co" }],
    });
    expect(out).toEqual({
      a: "ok",
      b: "[REDACTED]",
      c: [{ x: "[REDACTED]" }],
    });
  });

  it("stringLooksLikeEmail detects common shapes", () => {
    expect(stringLooksLikeEmail("a@b.co")).toBe(true);
    expect(stringLooksLikeEmail("not-an-email")).toBe(false);
  });
});
