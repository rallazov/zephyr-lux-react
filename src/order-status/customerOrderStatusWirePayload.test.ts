import { describe, expect, it } from "vitest";
import { parseCustomerOrderStatusWirePayload } from "./customerOrderStatusWirePayload";

describe("parseCustomerOrderStatusWirePayload", () => {
  it("accepts a minimal legal customer detail payload", () => {
    const raw = {
      order_number: "ZLX-1",
      created_at: "2026-01-01T00:00:00.000Z",
      payment_status: "paid",
      fulfillment_status: "processing",
      total_cents: 100,
      currency: "USD",
      customer_email_masked: null,
      items: [
        {
          product_title: "Boxers",
          variant_title: null,
          sku: "ZLX-1",
          quantity: 1,
          unit_price_cents: 100,
          total_cents: 100,
          image_url: null,
        },
      ],
      timeline: [],
    };

    expect(parseCustomerOrderStatusWirePayload(raw)).toMatchObject(raw);
  });

  it("rejects drifted payloads missing required subtrees", () => {
    expect(
      parseCustomerOrderStatusWirePayload({
        order_number: "ZLX-1",
        created_at: "2026-01-01T00:00:00.000Z",
        payment_status: "paid",
        fulfillment_status: "processing",
        total_cents: 100,
        currency: "USD",
        customer_email_masked: null,
        items: [],
        timeline: "nope",
      }),
    ).toBeNull();
  });

  it("parses fulfillment timeline transitions with nullable ends", () => {
    const raw = {
      order_number: "ZLX-9",
      created_at: "2026-01-02T00:00:00.000Z",
      payment_status: "paid",
      fulfillment_status: "shipped",
      total_cents: 200,
      currency: "USD",
      customer_email_masked: "sh***r@example.com",
      items: [
        {
          product_title: "Boxers",
          variant_title: "M",
          sku: "ZLX-M",
          quantity: 1,
          unit_price_cents: 200,
          total_cents: 200,
          image_url: null,
        },
      ],
      timeline: [
        {
          event_type: "fulfillment_status_changed",
          created_at: "2026-01-02T02:00:00.000Z",
          from: null,
          to: "packed",
        },
      ],
      tracking: {
        carrier: "UPS",
        tracking_number: "1Z999",
        tracking_url: "https://example.com/track",
        status: "shipped",
        shipped_at: null,
        delivered_at: null,
      },
    };

    expect(parseCustomerOrderStatusWirePayload(raw)?.timeline[0]?.to).toBe("packed");
  });
});
