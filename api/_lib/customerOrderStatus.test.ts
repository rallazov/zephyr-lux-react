// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildCustomerOrderStatusResponse,
  maskCustomerEmail,
  parseCustomerOrderStatusToken,
} from "./customerOrderStatus";

const baseOrder = {
  id: "order-1",
  order_number: "ZLX-20260428-0007",
  created_at: "2026-04-28T10:00:00Z",
  payment_status: "paid",
  total_cents: 4200,
  currency: "usd",
  customer_email: "buyer@example.com",
};

describe("customerOrderStatus serializer", () => {
  it("validates opaque lookup token shape", () => {
    expect(parseCustomerOrderStatusToken("abc")).toBeNull();
    expect(parseCustomerOrderStatusToken("a".repeat(32))).toBe("a".repeat(32));
    expect(parseCustomerOrderStatusToken(`${"a".repeat(32)}!`)).toBeNull();
  });

  it("masks customer email for public responses", () => {
    expect(maskCustomerEmail("buyer@example.com")).toBe("bu***@example.com");
    expect(maskCustomerEmail("x@example.com")).toBe("*@example.com");
    expect(maskCustomerEmail("not-an-email")).toBeNull();
  });

  it("returns only customer-safe order fields and timeline events", () => {
    const response = buildCustomerOrderStatusResponse({
      order: {
        id: "order-1",
        order_number: "ZLX-20260428-0007",
        created_at: "2026-04-28T10:00:00Z",
        payment_status: "paid",
        fulfillment_status: "packed",
        total_cents: 4200,
        currency: "usd",
        customer_email: "buyer@example.com",
      },
      items: [
        {
          product_title: "Boxer Briefs",
          variant_title: "Black / M",
          sku: "ZLX-BLK-M",
          quantity: 2,
          unit_price_cents: 2100,
          total_cents: 4200,
          image_url: "/assets/boxer.jpg",
        },
      ],
      events: [
        {
          event_type: "fulfillment_status_changed",
          created_at: "2026-04-28T11:00:00Z",
          metadata: {
            from: "processing",
            to: "packed",
            actor_user_id: "admin-1",
          },
        },
        {
          event_type: "internal_note",
          created_at: "2026-04-28T11:05:00Z",
          metadata: {
            actor_user_id: "admin-1",
            visibility: "internal",
          },
        },
      ],
    });

    expect(response).toEqual(
      expect.objectContaining({
        order_number: "ZLX-20260428-0007",
        customer_email_masked: "bu***@example.com",
        payment_status: "paid",
        fulfillment_status: "packed",
      }),
    );
    expect(response.items).toHaveLength(1);
    expect(response.timeline).toEqual([
      {
        event_type: "fulfillment_status_changed",
        created_at: "2026-04-28T11:00:00Z",
        from: "processing",
        to: "packed",
      },
    ]);

    const json = JSON.stringify(response);
    expect(json).not.toContain("buyer@example.com");
    expect(json).not.toContain("actor_user_id");
    expect(json).not.toContain("internal_note");
    expect(json).not.toContain("Call customer before shipping");
    expect(json).not.toContain("Fulfillment:");
  });

  it("omits tracking when fulfillment is not shipped or delivered", () => {
    const response = buildCustomerOrderStatusResponse({
      order: {
        ...baseOrder,
        fulfillment_status: "packed",
      },
      items: [],
      events: [],
      shipment: {
        carrier: "UPS",
        tracking_number: "1Z999",
        tracking_url: "https://www.ups.com/track?tracknum=1Z999",
        status: "shipped",
        shipped_at: "2026-04-28T14:00:00Z",
        delivered_at: null,
      },
    });
    expect(response.tracking).toBeUndefined();
  });

  it("includes customer-safe shipment fields when shipped and a row exists", () => {
    const response = buildCustomerOrderStatusResponse({
      order: {
        ...baseOrder,
        fulfillment_status: "shipped",
      },
      items: [],
      events: [],
      shipment: {
        carrier: "UPS",
        tracking_number: "1Z999",
        tracking_url: "https://www.ups.com/track?tracknum=1Z999",
        status: "shipped",
        shipped_at: "2026-04-28T14:00:00Z",
        delivered_at: null,
      },
    });
    expect(response.tracking).toEqual({
      carrier: "UPS",
      tracking_number: "1Z999",
      tracking_url: "https://www.ups.com/track?tracknum=1Z999",
      status: "shipped",
      shipped_at: "2026-04-28T14:00:00Z",
      delivered_at: null,
    });
  });

  it("includes tracking for delivered orders", () => {
    const response = buildCustomerOrderStatusResponse({
      order: {
        ...baseOrder,
        fulfillment_status: "delivered",
      },
      items: [],
      events: [],
      shipment: {
        carrier: "USPS",
        tracking_number: "9400111",
        tracking_url: null,
        status: "delivered",
        shipped_at: "2026-04-27T12:00:00Z",
        delivered_at: "2026-04-29T09:00:00Z",
      },
    });
    expect(response.tracking?.status).toBe("delivered");
    expect(response.tracking?.delivered_at).toBe("2026-04-29T09:00:00Z");
  });

  it("omits unsafe tracking_url from the API payload (null instead)", () => {
    const response = buildCustomerOrderStatusResponse({
      order: {
        ...baseOrder,
        fulfillment_status: "shipped",
      },
      items: [],
      events: [],
      shipment: {
        carrier: "UPS",
        tracking_number: "1Z999",
        tracking_url: "javascript:void(0)",
        status: "shipped",
        shipped_at: "2026-04-28T14:00:00Z",
        delivered_at: null,
      },
    });
    expect(response.tracking?.tracking_url).toBeNull();
    expect(response.tracking?.carrier).toBe("UPS");
    const json = JSON.stringify(response);
    expect(json).not.toContain("javascript");
  });

  it("returns null fields when shipped but shipment details are empty", () => {
    const response = buildCustomerOrderStatusResponse({
      order: {
        ...baseOrder,
        fulfillment_status: "shipped",
      },
      items: [],
      events: [],
      shipment: {
        carrier: null,
        tracking_number: null,
        tracking_url: null,
        status: "shipped",
        shipped_at: null,
        delivered_at: null,
      },
    });
    expect(response.tracking).toEqual({
      carrier: null,
      tracking_number: null,
      tracking_url: null,
      status: "shipped",
      shipped_at: null,
      delivered_at: null,
    });
  });

  it("does not attach tracking when fulfillment is shipped but no shipment row exists", () => {
    const response = buildCustomerOrderStatusResponse({
      order: {
        ...baseOrder,
        fulfillment_status: "shipped",
      },
      items: [],
      events: [],
      shipment: null,
    });
    expect(response.tracking).toBeUndefined();
  });
});
