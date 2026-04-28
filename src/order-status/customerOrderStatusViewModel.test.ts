import { describe, expect, it } from "vitest";
import { buildCustomerOrderStatusViewModel } from "./customerOrderStatusViewModel";

describe("customerOrderStatusViewModel", () => {
  it("maps raw statuses and money into customer-facing display values", () => {
    const view = buildCustomerOrderStatusViewModel({
      order_number: "ZLX-20260428-0007",
      created_at: "2026-04-28T10:00:00Z",
      payment_status: "paid",
      fulfillment_status: "shipped",
      total_cents: 6400,
      currency: "usd",
      customer_email_masked: "bu***@example.com",
      items: [
        {
          product_title: "Boxer Briefs",
          variant_title: "Black / M",
          sku: "ZLX-BLK-M",
          quantity: 2,
          unit_price_cents: 3200,
          total_cents: 6400,
          image_url: "/assets/boxer.jpg",
        },
      ],
      timeline: [
        {
          event_type: "fulfillment_status_changed",
          created_at: "2026-04-28T11:00:00Z",
          from: "packed",
          to: "shipped",
        },
      ],
    });

    expect(view.fulfillmentLabel).toBe("Shipped");
    expect(view.paymentLabel).toBe("Paid");
    expect(view.totalDisplay).toBe("$64.00");
    expect(view.items[0]).toEqual(
      expect.objectContaining({
        title: "Boxer Briefs - Black / M",
        unitPriceDisplay: "$32.00",
        totalDisplay: "$64.00",
      }),
    );
    expect(view.progress.map((step) => [step.label, step.state])).toEqual([
      ["Preparing", "complete"],
      ["Packed", "complete"],
      ["Shipped", "current"],
      ["Delivered", "upcoming"],
    ]);
    expect(view.timeline).toEqual([
      expect.objectContaining({
        label: "Packed to Shipped",
      }),
    ]);
    expect(view.tracking).toBeNull();
  });

  it("excludes internal timeline events if a server bug ever returns one", () => {
    const view = buildCustomerOrderStatusViewModel({
      order_number: "ZLX-20260428-0007",
      created_at: "2026-04-28T10:00:00Z",
      payment_status: "paid",
      fulfillment_status: "processing",
      total_cents: 2100,
      currency: "usd",
      customer_email_masked: null,
      items: [],
      timeline: [
        {
          event_type: "internal_note",
          created_at: "2026-04-28T11:00:00Z",
        },
        {
          event_type: "fulfillment_status_changed",
          created_at: "2026-04-28T12:00:00Z",
          to: "packed",
        },
      ],
    });

    expect(view.timeline).toHaveLength(1);
    expect(view.timeline[0].label).toBe("Packed update");
    expect(JSON.stringify(view)).not.toContain("Call customer before shipping");
  });

  it("uses a single canceled milestone instead of the four fulfillment steps", () => {
    const view = buildCustomerOrderStatusViewModel({
      order_number: "ZLX-20260428-0007",
      created_at: "2026-04-28T10:00:00Z",
      payment_status: "paid",
      fulfillment_status: "canceled",
      total_cents: 2100,
      currency: "usd",
      customer_email_masked: null,
      items: [],
      timeline: [],
    });

    expect(view.fulfillmentLabel).toBe("Canceled");
    expect(view.progress).toEqual([
      { status: "canceled", label: "Canceled", state: "current" },
    ]);
  });

  it("maps shipment tracking for display including carrier-derived URLs", () => {
    const view = buildCustomerOrderStatusViewModel({
      order_number: "ZLX-20260428-0007",
      created_at: "2026-04-28T10:00:00Z",
      payment_status: "paid",
      fulfillment_status: "shipped",
      total_cents: 6400,
      currency: "usd",
      customer_email_masked: "bu***@example.com",
      items: [],
      timeline: [],
      tracking: {
        carrier: "UPS",
        tracking_number: "1ZTRACK",
        tracking_url: null,
        status: "shipped",
        shipped_at: "2026-04-28T12:00:00Z",
        delivered_at: null,
      },
    });

    expect(view.tracking?.trackHref).toContain("ups.com");
    expect(view.tracking?.showPendingNotice).toBe(false);
    expect(view.tracking?.shippedAtDisplay).toMatch(/Apr/);
  });

  it("surfaces unsafe tracking URLs as plain text, not hrefs", () => {
    const view = buildCustomerOrderStatusViewModel({
      order_number: "ZLX-20260428-0007",
      created_at: "2026-04-28T10:00:00Z",
      payment_status: "paid",
      fulfillment_status: "shipped",
      total_cents: 6400,
      currency: "usd",
      customer_email_masked: null,
      items: [],
      timeline: [],
      tracking: {
        carrier: null,
        tracking_number: null,
        tracking_url: "javascript:void(0)",
        status: "shipped",
        shipped_at: null,
        delivered_at: null,
      },
    });

    expect(view.tracking?.trackHref).toBeNull();
    expect(view.tracking?.opaqueOrUnsafeUrl).toContain("javascript:");
    expect(view.tracking?.showPendingNotice).toBe(false);
  });

  it("derives carrier tracking URL when stored URL is unsafe but carrier and number exist", () => {
    const view = buildCustomerOrderStatusViewModel({
      order_number: "ZLX-20260428-0007",
      created_at: "2026-04-28T10:00:00Z",
      payment_status: "paid",
      fulfillment_status: "shipped",
      total_cents: 6400,
      currency: "usd",
      customer_email_masked: null,
      items: [],
      timeline: [],
      tracking: {
        carrier: "UPS",
        tracking_number: "1ZTRACK",
        tracking_url: "javascript:void(0)",
        status: "shipped",
        shipped_at: null,
        delivered_at: null,
      },
    });

    expect(view.tracking?.trackHref).toContain("ups.com");
    expect(view.tracking?.opaqueOrUnsafeUrl).toBeNull();
  });

  it("shows pending notice when shipment exists but tracking fields are empty", () => {
    const view = buildCustomerOrderStatusViewModel({
      order_number: "ZLX-20260428-0007",
      created_at: "2026-04-28T10:00:00Z",
      payment_status: "paid",
      fulfillment_status: "shipped",
      total_cents: 6400,
      currency: "usd",
      customer_email_masked: null,
      items: [],
      timeline: [],
      tracking: {
        carrier: null,
        tracking_number: null,
        tracking_url: null,
        status: "shipped",
        shipped_at: null,
        delivered_at: null,
      },
    });

    expect(view.tracking?.showPendingNotice).toBe(true);
  });
});
