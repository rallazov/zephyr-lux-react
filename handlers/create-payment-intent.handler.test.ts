// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const { mockCreate, mockCancel } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue({ id: "pi_test_1", client_secret: "cs_test_secret" }),
  mockCancel: vi.fn().mockResolvedValue({ id: "pi_test_1" }),
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    paymentIntents = { create: mockCreate, cancel: mockCancel };
  },
}));

vi.mock("./_lib/env", () => ({
  ENV: {
    STRIPE_SECRET_KEY: "sk_test_x",
    FRONTEND_URL: "http://localhost:5173",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service_role_test",
  },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

vi.mock("./_lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const rpc = vi.fn().mockResolvedValue({ data: "ZLX-20991231-0001", error: null });
const orderInsertSingle = vi.fn().mockResolvedValue({
  data: { id: "11111111-1111-1111-1111-111111111111" },
  error: null,
});
const orderItemsInsert = vi.fn().mockResolvedValue({ error: null });
const orderUpdateEq = vi.fn().mockResolvedValue({ error: null });

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    rpc,
    from: vi.fn((table: string) => {
      if (table === "orders") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: orderInsertSingle }),
          }),
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          update: vi.fn().mockReturnValue({ eq: orderUpdateEq }),
        };
      }
      if (table === "order_items") {
        return { insert: orderItemsInsert };
      }
      return {};
    }),
  }),
}));

let handler: typeof import("./create-payment-intent").default;

describe("create-payment-intent handler (Stripe create)", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockClear();
    mockCancel.mockClear();
    rpc.mockClear();
    orderInsertSingle.mockClear();
    orderItemsInsert.mockClear();
    orderUpdateEq.mockClear();
    mockCreate.mockResolvedValue({ id: "pi_test_1", client_secret: "cs_test_secret" });
    rpc.mockResolvedValue({ data: "ZLX-20991231-0001", error: null });
    orderInsertSingle.mockResolvedValue({
      data: { id: "11111111-1111-1111-1111-111111111111" },
      error: null,
    });
    const mod = await import("./create-payment-intent");
    handler = mod.default;
  });

  it("passes server-derived amount to stripe.paymentIntents.create for items body", async () => {
    const { quoteForPaymentItems } = await import("./_lib/catalog");

    const body = {
      items: [{ sku: "ZLX-2PK-S", quantity: 1 }],
      currency: "usd" as const,
      email: "buyer@example.com",
    };
    const expected = quoteForPaymentItems([{ sku: "ZLX-2PK-S", qty: 1 }]).total_cents;

    const req = { method: "POST", body } as VercelRequest;
    const resJson = vi.fn();
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnValue({ json: resJson }),
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonArg = resJson.mock.calls[0][0];
    expect(jsonArg.clientSecret).toBe("cs_test_secret");
    expect(jsonArg.orderId).toBe("11111111-1111-1111-1111-111111111111");
    expect(typeof jsonArg.orderLookupKey).toBe("string");
    expect((jsonArg.orderLookupKey as string).length).toBeGreaterThan(40);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: expected,
        currency: "usd",
        metadata: expect.objectContaining({
          order_id: "11111111-1111-1111-1111-111111111111",
          stripe_intent_purpose: "checkout_v1",
        }),
      }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^pi_cr_[a-f0-9]+$/) }),
    );
    expect(rpc).toHaveBeenCalledWith("allocate_order_number");
    expect(orderItemsInsert).toHaveBeenCalled();
  });
});
