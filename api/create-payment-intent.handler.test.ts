// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue({ id: "pi_test_1", client_secret: "cs_test_secret" }),
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    paymentIntents = { create: mockCreate };
  },
}));

vi.mock("./_lib/env", () => ({
  ENV: {
    STRIPE_SECRET_KEY: "sk_test_x",
    FRONTEND_URL: "http://localhost:5173",
  },
}));

vi.mock("./_lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let handler: typeof import("./create-payment-intent").default;

describe("create-payment-intent handler (Stripe create)", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockClear();
    mockCreate.mockResolvedValue({ id: "pi_test_1", client_secret: "cs_test_secret" });
    const mod = await import("./create-payment-intent");
    handler = mod.default;
  });

  it("passes server-derived amount to stripe.paymentIntents.create for items body", async () => {
    const { quoteForPaymentItems } = await import("./_lib/catalog");
    const { totalChargeCentsFromCatalogLines } = await import("./_lib/checkoutQuote");

    const body = { items: [{ sku: "ZLX-BLK-S", quantity: 1 }], currency: "usd" as const };
    const expected = totalChargeCentsFromCatalogLines(
      body.items.map((i) => ({ sku: i.sku, qty: i.quantity })),
    );
    expect(expected).toBe(quoteForPaymentItems([{ sku: "ZLX-BLK-S", qty: 1 }]).total_cents);

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
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expected, currency: "usd" }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^pi_cr_[a-f0-9]+$/) }),
    );
  });
});
