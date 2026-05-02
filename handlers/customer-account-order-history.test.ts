// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  supabasePersistenceConfigured: true,
  resolvedCustomerId: "customer-row-uuid-1",
}));

vi.mock("./_lib/env", () => ({
  ENV: {
    FRONTEND_URL: "http://localhost:5173",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon",
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

vi.mock("./_lib/verifyAdminJwt", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./_lib/verifyAdminJwt")>();
  return {
    ...mod,
    resolveVerifiedCustomerIdForCheckoutOrder: vi.fn(),
  };
});

import { CUSTOMER_ACCOUNT_ORDER_HISTORY_LIST_LIMIT } from "./_lib/customerAccountOrderHistory";
import { resolveVerifiedCustomerIdForCheckoutOrder } from "./_lib/verifyAdminJwt";
import handler from "./customer-account-order-history";

function makeRes() {
  const json = vi.fn();
  const end = vi.fn();
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json, end }),
  } as unknown as VercelResponse;
  return { res, json, end };
}

function makeReq(parts: Partial<VercelRequest> & Pick<VercelRequest, "method">): VercelRequest {
  return {
    query: {},
    headers: {},
    ...parts,
  } as VercelRequest;
}

describe("customer-account-order-history handler", () => {
  beforeEach(() => {
    mocks.supabasePersistenceConfigured = true;
    mocks.resolvedCustomerId = "customer-row-uuid-1";
    mocks.getSupabaseAdmin.mockReset();
    vi.mocked(resolveVerifiedCustomerIdForCheckoutOrder).mockResolvedValue(mocks.resolvedCustomerId);

    mocks.getSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: vi.fn(),
        in: vi.fn(),
      })),
    } as unknown as SupabaseClient);
  });

  it("allows Authorization in CORS preflight headers", async () => {
    const { res, end } = makeRes();

    await handler(
      makeReq({ method: "OPTIONS", headers: { authorization: undefined } }),
      res,
    );

    expect(end).toHaveBeenCalled();

    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
  });

  it("responds 401 when Authorization Bearer is absent", async () => {
    const { res, json } = makeRes();
    await handler(makeReq({ method: "GET" }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(json.mock.calls.at(-1)?.[0]?.error).toMatch(/missing or invalid session/i);
  });

  it("responds 401 when customer id cannot be resolved", async () => {
    vi.mocked(resolveVerifiedCustomerIdForCheckoutOrder).mockResolvedValueOnce(null);

    const { res, json } = makeRes();
    await handler(
      makeReq({ method: "GET", headers: { authorization: "Bearer stale-token" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(json.mock.calls.at(-1)?.[0]?.error).toMatch(/missing or invalid session/i);
  });

  it("responds 400 when order_id is malformed", async () => {
    const { res, json } = makeRes();
    await handler(
      makeReq({
        method: "GET",
        headers: { authorization: "Bearer tok" },
        query: { order_id: "not-a-uuid" },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json.mock.calls.at(-1)?.[0]?.error).toMatch(/invalid order/i);
  });

  it("returns list rows owned by bearer-authenticated shopper", async () => {
    const listStub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "ord-1",
            order_number: "ZLX-1",
            created_at: "2026-01-01T00:00:00.000Z",
            payment_status: "paid",
            fulfillment_status: "processing",
            total_cents: 1999,
            currency: "USD",
            order_items: [{ count: 2 }],
          },
        ],
        error: null,
      }),
    };

    mocks.getSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "orders") return listStub as unknown as ReturnType<SupabaseClient["from"]>;
        throw new Error(`unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient);

    const { res, json } = makeRes();
    await handler(
      makeReq({ method: "GET", headers: { authorization: "Bearer tok" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const body = json.mock.calls.at(-1)?.[0] as { orders: unknown[] };
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders).toHaveLength(1);
    expect(listStub.eq).toHaveBeenCalledWith("customer_id", mocks.resolvedCustomerId);
    expect(listStub.limit).toHaveBeenCalledWith(CUSTOMER_ACCOUNT_ORDER_HISTORY_LIST_LIMIT);
  });

  it("responds 404 for detail when order is not scoped to shopper customer id", async () => {
    const orderUuid = "11111111-1111-4111-8111-111111111111";

    const detailOrdersStub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mocks.getSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return detailOrdersStub as unknown as ReturnType<SupabaseClient["from"]>;
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient);

    const { res, json } = makeRes();
    await handler(
      makeReq({
        method: "GET",
        headers: { authorization: "Bearer tok" },
        query: { order_id: orderUuid },
      }),
      res,
    );

    expect(detailOrdersStub.eq).toHaveBeenCalledWith("id", orderUuid);
    expect(detailOrdersStub.eq).toHaveBeenCalledWith("customer_id", mocks.resolvedCustomerId);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(json.mock.calls.at(-1)?.[0]?.error).toMatch(/order not available/i);
  });

  it("returns customer-safe payload for shopper-owned orders", async () => {
    const orderUuid = "22222222-2222-4222-8222-222222222222";
    const customerOrder = {
      id: orderUuid,
      order_number: "ZLX-2",
      created_at: "2026-01-02T00:00:00.000Z",
      payment_status: "paid",
      fulfillment_status: "processing",
      total_cents: 2500,
      currency: "USD",
      customer_email: "shopper@example.com",
    };

    const detailOrdersStub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: customerOrder,
        error: null,
      }),
    };

    const shipmentsStub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    const itemsStub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            product_title: "Boxer Briefs",
            variant_title: "M — Black",
            sku: "ZLX-TEST",
            quantity: 1,
            unit_price_cents: 2500,
            total_cents: 2500,
            image_url: null,
          },
        ],
        error: null,
      }),
    };

    const eventsStub = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mocks.getSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        switch (table) {
          case "orders":
            return detailOrdersStub as unknown as ReturnType<SupabaseClient["from"]>;
          case "shipments":
            return shipmentsStub as unknown as ReturnType<SupabaseClient["from"]>;
          case "order_items":
            return itemsStub as unknown as ReturnType<SupabaseClient["from"]>;
          case "order_events":
            return eventsStub as unknown as ReturnType<SupabaseClient["from"]>;
          default:
            throw new Error(`unexpected ${table}`);
        }
      }),
    } as unknown as SupabaseClient);

    const { res, json } = makeRes();
    await handler(
      makeReq({
        method: "GET",
        headers: { authorization: "Bearer tok" },
        query: { order_id: orderUuid },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);

    const body = json.mock.calls.at(-1)?.[0] as {
      order_number: string;
      items: unknown[];
      id?: unknown;
    };

    expect(body.order_number).toBe("ZLX-2");
    expect(body.items).toHaveLength(1);
    expect(body).not.toHaveProperty("stripe_payment_intent_id");
    expect(body).not.toHaveProperty("id");
  });
});
