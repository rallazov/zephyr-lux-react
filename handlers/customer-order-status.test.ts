// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOMER_ORDER_STATUS_INVALID_LINK } from "./_lib/customerOrderStatus";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  supabasePersistenceConfigured: true,
}));

vi.mock("./_lib/env", () => ({
  ENV: {
    FRONTEND_URL: "http://localhost:5173",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  },
  isSupabaseOrderPersistenceConfigured: () => mocks.supabasePersistenceConfigured,
}));

vi.mock("./_lib/logger", () => ({
  log: mocks.log,
}));

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

import handler from "./customer-order-status";

const validToken = "a".repeat(43);

function makeRes() {
  const json = vi.fn();
  const end = vi.fn();
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json, end }),
  } as unknown as VercelResponse;
  return { res, json, end };
}

function makeReq(query: Record<string, string | undefined>): VercelRequest {
  return { method: "GET", query } as unknown as VercelRequest;
}

function selectMaybeResult(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

function listResult(data: unknown[] = [], error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
}

function shipmentMaybeResult(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createAdminMock(args: {
  tokenRow?: unknown;
  tokenError?: unknown;
  orderRow?: unknown;
  orderError?: unknown;
  shipment?: unknown;
  shipmentError?: unknown;
  items?: unknown[];
  itemsError?: unknown;
  events?: unknown[];
  eventsError?: unknown;
}) {
  const tokenSelect = selectMaybeResult(args.tokenRow ?? null, args.tokenError ?? null);
  const tokenUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const tokenUpdate = {
    update: vi.fn().mockReturnValue({ eq: tokenUpdateEq }),
  };
  const orderSelect = selectMaybeResult(args.orderRow ?? null, args.orderError ?? null);
  const shipmentSelect = shipmentMaybeResult(args.shipment ?? null, args.shipmentError ?? null);
  const itemsSelect = listResult(args.items ?? [], args.itemsError ?? null);
  const eventsSelect = listResult(args.events ?? [], args.eventsError ?? null);
  let tokenTableCalls = 0;

  const from = vi.fn((table: string) => {
    if (table === "order_lookup_tokens") {
      tokenTableCalls += 1;
      return tokenTableCalls === 1 ? tokenSelect : tokenUpdate;
    }
    if (table === "orders") return orderSelect;
    if (table === "shipments") return shipmentSelect;
    if (table === "order_items") return itemsSelect;
    if (table === "order_events") return eventsSelect;
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    admin: { from } as unknown as SupabaseClient,
    from,
    tokenSelect,
    tokenUpdate,
    tokenUpdateEq,
    eventsSelect,
  };
}

describe("customer-order-status handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabasePersistenceConfigured = true;
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects a missing token before querying Supabase", async () => {
    const { res, json } = makeRes();
    await handler(makeReq({}), res);

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "Missing or invalid token" });
  });

  it("returns 405 for non-GET methods", async () => {
    const { res, json } = makeRes();
    await handler({ method: "POST", query: { token: validToken } } as unknown as VercelRequest, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(json).toHaveBeenCalledWith({ error: "Method not allowed" });
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 503 when order persistence is not configured", async () => {
    mocks.supabasePersistenceConfigured = false;
    const { res, json } = makeRes();

    await handler(makeReq({ token: validToken }), res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({ error: "Order status lookup not configured" });
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 503 when the Supabase admin client is unavailable", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);
    const { res, json } = makeRes();

    await handler(makeReq({ token: validToken }), res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({ error: "Order status lookup not available" });
  });

  it("accepts token from repeated query values (first string wins)", async () => {
    const adminMock = createAdminMock({
      tokenRow: null,
    });
    mocks.getSupabaseAdmin.mockReturnValue(adminMock.admin);
    const { res } = makeRes();

    await handler(
      {
        method: "GET",
        query: { token: [validToken, "b".repeat(43)] },
      } as unknown as VercelRequest,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("sets Cache-Control no-store on OPTIONS preflight responses", async () => {
    const { res, end } = makeRes();
    await handler({ method: "OPTIONS", query: {} } as unknown as VercelRequest, res);

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.status).toHaveBeenCalledWith(204);
    expect(end).toHaveBeenCalled();
  });

  it("returns a generic invalid-link response for expired or unknown tokens", async () => {
    const adminMock = createAdminMock({ tokenRow: null });
    mocks.getSupabaseAdmin.mockReturnValue(adminMock.admin);
    const { res, json } = makeRes();

    await handler(makeReq({ token: validToken }), res);

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: CUSTOMER_ORDER_STATUS_INVALID_LINK });
    expect(adminMock.from).toHaveBeenCalledWith("order_lookup_tokens");
  });

  it("returns a generic invalid-link response when the token row has no linked order", async () => {
    const adminMock = createAdminMock({
      tokenRow: { id: "tok-1", order_id: "order-1" },
      orderRow: null,
    });
    mocks.getSupabaseAdmin.mockReturnValue(adminMock.admin);
    const { res, json } = makeRes();

    await handler(makeReq({ token: validToken }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: CUSTOMER_ORDER_STATUS_INVALID_LINK });
    expect(adminMock.tokenUpdate.update).not.toHaveBeenCalled();
  });

  it("returns sanitized customer-safe order status for a valid token", async () => {
    const adminMock = createAdminMock({
      tokenRow: { id: "tok-1", order_id: "order-1" },
      orderRow: {
        id: "order-1",
        order_number: "ZLX-20260428-0007",
        created_at: "2026-04-28T10:00:00Z",
        payment_status: "paid",
        fulfillment_status: "shipped",
        total_cents: 6400,
        currency: "usd",
        customer_email: "buyer@example.com",
        stripe_payment_intent_id: "pi_secret",
        notes: "internal note",
      },
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
      events: [
        {
          event_type: "fulfillment_status_changed",
          metadata: { from: "packed", to: "shipped", actor_user_id: "admin-1" },
          created_at: "2026-04-28T12:00:00Z",
        },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(adminMock.admin);
    const { res, json } = makeRes();

    await handler(makeReq({ token: validToken }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        order_number: "ZLX-20260428-0007",
        customer_email_masked: "bu***@example.com",
        payment_status: "paid",
        fulfillment_status: "shipped",
        total_cents: 6400,
        currency: "usd",
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
            created_at: "2026-04-28T12:00:00Z",
            from: "packed",
            to: "shipped",
          },
        ],
      }),
    );

    const body = json.mock.calls[0][0];
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("buyer@example.com");
    expect(serialized).not.toContain("pi_secret");
    expect(serialized).not.toContain("actor_user_id");
    expect(serialized).not.toContain("internal note");
    expect(adminMock.eventsSelect.in).toHaveBeenCalledWith("event_type", [
      "fulfillment_status_changed",
    ]);
    expect(adminMock.tokenUpdate.update).toHaveBeenCalledWith({
      last_accessed_at: expect.any(String),
    });
    expect(adminMock.tokenUpdateEq).toHaveBeenCalledWith("id", "tok-1");
  });

  it("returns shipment tracking when shipped and a shipment row exists", async () => {
    const adminMock = createAdminMock({
      tokenRow: { id: "tok-1", order_id: "order-1" },
      orderRow: {
        id: "order-1",
        order_number: "ZLX-20260428-0007",
        created_at: "2026-04-28T10:00:00Z",
        payment_status: "paid",
        fulfillment_status: "shipped",
        total_cents: 6400,
        currency: "usd",
        customer_email: "buyer@example.com",
        stripe_payment_intent_id: "pi_secret",
        notes: "internal note",
      },
      shipment: {
        carrier: "UPS",
        tracking_number: "1Z999",
        tracking_url: "https://www.ups.com/track?tracknum=1Z999",
        status: "shipped",
        shipped_at: "2026-04-28T15:00:00Z",
        delivered_at: null,
      },
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
      events: [
        {
          event_type: "fulfillment_status_changed",
          metadata: { from: "packed", to: "shipped", actor_user_id: "admin-1" },
          created_at: "2026-04-28T12:00:00Z",
        },
      ],
    });
    mocks.getSupabaseAdmin.mockReturnValue(adminMock.admin);
    const { res, json } = makeRes();

    await handler(makeReq({ token: validToken }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        fulfillment_status: "shipped",
        tracking: {
          carrier: "UPS",
          tracking_number: "1Z999",
          tracking_url: "https://www.ups.com/track?tracknum=1Z999",
          status: "shipped",
          shipped_at: "2026-04-28T15:00:00Z",
          delivered_at: null,
        },
      }),
    );
    expect(adminMock.tokenUpdate.update).toHaveBeenCalled();
  });

  it("returns 500 for Supabase lookup failures", async () => {
    const adminMock = createAdminMock({
      tokenError: { message: "db unavailable" },
    });
    mocks.getSupabaseAdmin.mockReturnValue(adminMock.admin);
    const { res, json } = makeRes();

    await handler(makeReq({ token: validToken }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "Order status lookup failed." });
  });
});
