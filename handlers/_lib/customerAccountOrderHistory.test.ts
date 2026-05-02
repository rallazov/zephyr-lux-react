// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CUSTOMER_ACCOUNT_ORDER_HISTORY_LIST_LIMIT,
  fetchCustomerAccountOrderList,
  parseAccountOrderIdParam,
} from "./customerAccountOrderHistory";

describe("parseAccountOrderIdParam", () => {
  it("accepts lower/upper-case UUID variants", () => {
    expect(
      parseAccountOrderIdParam("11111111-1111-4111-8111-111111111111"),
    ).toBe("11111111-1111-4111-8111-111111111111");

    expect(
      parseAccountOrderIdParam(" 22222222-2222-4222-8222-222222222222 "),
    ).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("rejects malformed UUID-ish strings", () => {
    expect(parseAccountOrderIdParam("not-a-uuid")).toBe(null);
    expect(parseAccountOrderIdParam('{"id":"evil"}')).toBe(null);
    expect(parseAccountOrderIdParam("")).toBe(null);
    expect(parseAccountOrderIdParam(null)).toBe(null);
  });
});

describe("fetchCustomerAccountOrderList", () => {
  it("parses bundled order_items aggregate counts safely", async () => {
    const rows = [
      {
        id: "a",
        order_number: "ZLX-9",
        created_at: "2026-01-01T00:00:00.000Z",
        payment_status: "paid",
        fulfillment_status: "shipped",
        total_cents: 100,
        currency: "USD",
        order_items: [{ count: 3 }],
      },
      {
        id: "b",
        order_number: "ZLX-8",
        created_at: "2026-01-02T00:00:00.000Z",
        payment_status: "pending_payment",
        fulfillment_status: "bogus_future_value",
        total_cents: 200,
        currency: "usd",
        order_items: { count: 1 },
      },
      {
        id: "c",
        order_number: "ZLX-7",
        created_at: "2026-01-03T00:00:00.000Z",
        payment_status: "paid",
        fulfillment_status: "processing",
        total_cents: 50,
        currency: "USD",
        order_items: [{ count: "4" }],
      },
    ];

    const limitSpy = vi.fn().mockResolvedValue({ data: rows, error: null });

    const admin = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: limitSpy,
      })),
    } as unknown as SupabaseClient;

    const res = await fetchCustomerAccountOrderList({
      admin,
      customerId: "cust-1",
    });

    expect(limitSpy).toHaveBeenCalledWith(CUSTOMER_ACCOUNT_ORDER_HISTORY_LIST_LIMIT);
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    expect(res.body.orders).toHaveLength(3);
    expect(res.body.orders[0]?.item_count).toBe(3);
    expect(res.body.orders[1]?.payment_status).toBe("pending_payment");
    expect(res.body.orders[1]?.fulfillment_status).toBe("processing");
    expect(res.body.orders[1]?.item_count).toBe(1);
    expect(res.body.orders[2]?.item_count).toBe(4);
  });
});
