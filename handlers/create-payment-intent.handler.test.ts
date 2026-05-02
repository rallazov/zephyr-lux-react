// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate, mockCancel, mockResolveCustomer, capture } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue({ id: "pi_test_1", client_secret: "cs_test_secret" }),
  mockCancel: vi.fn().mockResolvedValue({ id: "pi_test_1" }),
  mockResolveCustomer: vi.fn().mockResolvedValue(null),
  capture: {
    /** Last row passed to orders.insert — set by mocked insert (see `_lib/supabaseAdmin` mock factory). */
    lastOrderInsert: null as Record<string, unknown> | null,
  },
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
    SUPABASE_ANON_KEY: "anon_test",
  },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

vi.mock("./_lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./_lib/verifyAdminJwt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_lib/verifyAdminJwt")>();
  return {
    ...actual,
    resolveVerifiedCustomerIdForCheckoutOrder: mockResolveCustomer,
  };
});

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
      if (table === "customers") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "orders") {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            capture.lastOrderInsert = row;
            return {
              select: vi.fn().mockReturnValue({ single: orderInsertSingle }),
            };
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

    capture.lastOrderInsert = null;
    mockCreate.mockClear();
    mockCancel.mockClear();
    mockResolveCustomer.mockClear();
    mockResolveCustomer.mockResolvedValue(null);
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
    expect(mockResolveCustomer).toHaveBeenCalledTimes(1);
    expect(capture.lastOrderInsert?.customer_id).toBe(null);
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

  it("does not persist client-supplied customer_id; linkage only via resolver + Bearer context", async () => {
    const body = {
      items: [{ sku: "ZLX-2PK-S", quantity: 1 }],
      currency: "usd" as const,
      email: "buyer@example.com",
      /** Spoof attempt — omitted from validated body; browser cannot set linkage. */
      customer_id: "99999999-9999-9999-9999-999999999999",
    };
    mockResolveCustomer.mockResolvedValueOnce(null);

    const req = { method: "POST", body } as VercelRequest;
    const resJson = vi.fn();
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnValue({ json: resJson }),
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockResolveCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ bearerAccessToken: null }),
    );
    expect(capture.lastOrderInsert?.customer_id).toBe(null);
    expect(mockResolveCustomer).toHaveBeenCalledTimes(1);
  });

  it("persists customers.id when verified resolver returns linkage for Bearer checkout", async () => {
    const linked = "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    mockResolveCustomer.mockResolvedValueOnce(linked);

    const body = {
      items: [{ sku: "ZLX-2PK-S", quantity: 1 }],
      currency: "usd" as const,
      email: "buyer@example.com",
    };
    const req = {
      method: "POST",
      body,
      headers: { authorization: "Bearer valid.session.jwt.example" },
    } as unknown as VercelRequest;

    const resJson = vi.fn();
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnValue({ json: resJson }),
    } as unknown as VercelResponse;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockResolveCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ bearerAccessToken: "valid.session.jwt.example" }),
    );
    expect(capture.lastOrderInsert?.customer_id).toBe(linked);
  });
});
