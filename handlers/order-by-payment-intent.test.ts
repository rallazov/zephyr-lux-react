// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";

const getSupabaseAdmin = vi.hoisted(() => vi.fn());

vi.mock("./_lib/env", () => ({
  ENV: { FRONTEND_URL: "http://localhost:5173" },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: getSupabaseAdmin,
}));

vi.mock("./_lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import defaultHandler from "./order-by-payment-intent";

const validKey = "a".repeat(48);
const piId = "pi_test_confirm_1";

function makeRes() {
  const resJson = vi.fn();
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json: resJson, end: vi.fn() }),
    end: vi.fn(),
  } as unknown as VercelResponse;
  return { res, resJson };
}

function req(q: Record<string, string | undefined>): VercelRequest {
  return { method: "GET", query: q } as unknown as VercelRequest;
}

describe("order-by-payment-intent", () => {
  beforeEach(() => {
    getSupabaseAdmin.mockReset();
  });

  it("returns 400 when payment_intent is not a Stripe PI id", async () => {
    const { res, resJson } = makeRes();
    await defaultHandler(req({ payment_intent_id: "not_pi" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({ error: "Invalid payment_intent" });
  });

  it("returns 401 when order_lookup is missing or too short", async () => {
    const { res, resJson } = makeRes();
    await defaultHandler(
      req({ payment_intent_id: piId, order_lookup: "short" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({ error: "Missing or invalid order_lookup" });
  });

  it("returns 401 when order_lookup is 31 characters (below minimum)", async () => {
    const { res, resJson } = makeRes();
    await defaultHandler(
      req({ payment_intent_id: piId, order_lookup: "k".repeat(31) }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({ error: "Missing or invalid order_lookup" });
  });

  it("returns 404 when lookup key does not match stored order_confirmation_key", async () => {
    const otherKey = "b".repeat(48);
    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "o1",
                  order_number: "ZLX-20260426-0001",
                  payment_status: "paid",
                  customer_email: "a@b.com",
                  total_cents: 1000,
                  currency: "usd",
                  stripe_payment_intent_id: piId,
                  order_confirmation_key: validKey,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
    getSupabaseAdmin.mockReturnValue({ from } as unknown as SupabaseClient);

    const { res, resJson } = makeRes();
    await defaultHandler(
      req({ payment_intent_id: piId, order_lookup: otherKey }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(resJson).toHaveBeenCalledWith({ error: "Paid order not found" });
  });

  it("returns 200 when payment_intent query alias is used (not only payment_intent_id)", async () => {
    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "o1",
                  order_number: "ZLX-20260426-0001",
                  payment_status: "paid",
                  customer_email: "a@b.com",
                  total_cents: 2000,
                  currency: "usd",
                  stripe_payment_intent_id: piId,
                  order_confirmation_key: validKey,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "order_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  sku: "SKU1",
                  product_title: "Coat",
                  variant_title: "M",
                  quantity: 1,
                  unit_price_cents: 2000,
                  total_cents: 2000,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    });
    getSupabaseAdmin.mockReturnValue({ from } as unknown as SupabaseClient);

    const { res, resJson } = makeRes();
    await defaultHandler(
      req({ payment_intent: piId, order_lookup: validKey }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({
        order_number: "ZLX-20260426-0001",
        payment_status: "paid",
        payment_intent_id: piId,
        email: "a@b.com",
        total_cents: 2000,
        currency: "usd",
        items: [{ name: "Coat — M", quantity: 1, price: 20 }],
      }),
    );
  });

  it("returns 200 with order details when PI id and order_lookup match a paid order", async () => {
    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "o1",
                  order_number: "ZLX-20260426-0001",
                  payment_status: "paid",
                  customer_email: "a@b.com",
                  total_cents: 2000,
                  currency: "usd",
                  stripe_payment_intent_id: piId,
                  order_confirmation_key: validKey,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "order_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  sku: "SKU1",
                  product_title: "Coat",
                  variant_title: "M",
                  quantity: 1,
                  unit_price_cents: 2000,
                  total_cents: 2000,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    });
    getSupabaseAdmin.mockReturnValue({ from } as unknown as SupabaseClient);

    const { res, resJson } = makeRes();
    await defaultHandler(
      req({ payment_intent_id: piId, order_lookup: validKey }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({
        order_number: "ZLX-20260426-0001",
        payment_status: "paid",
        payment_intent_id: piId,
        email: "a@b.com",
        total_cents: 2000,
        currency: "usd",
        items: [{ name: "Coat — M", quantity: 1, price: 20 }],
      }),
    );
  });

  it("returns 200 when order_lookup is exactly 32 characters and matches stored key", async () => {
    const key32 = "z".repeat(32);
    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "o2",
                  order_number: "ZLX-20260426-0002",
                  payment_status: "paid",
                  customer_email: "c@d.com",
                  total_cents: 500,
                  currency: "usd",
                  stripe_payment_intent_id: piId,
                  order_confirmation_key: key32,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "order_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return {};
    });
    getSupabaseAdmin.mockReturnValue({ from } as unknown as SupabaseClient);

    const { res, resJson } = makeRes();
    await defaultHandler(
      req({ payment_intent_id: piId, order_lookup: key32 }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({
        order_number: "ZLX-20260426-0002",
        payment_status: "paid",
        payment_intent_id: piId,
        currency: "usd",
        items: [],
      }),
    );
  });
});
