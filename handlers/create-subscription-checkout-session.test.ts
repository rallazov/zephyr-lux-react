// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mockSessionsCreate = vi.fn().mockResolvedValue({
  id: "cs_test_1",
  url: "https://checkout.stripe.com/test",
});

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = {
      sessions: {
        create: mockSessionsCreate,
      },
    };
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

const mockMaybeSingle = vi.fn();

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    })),
  }),
}));

function activePlanFixture() {
  return {
    id: "00000000-0000-4000-a000-000000000099",
    product_id: "a0000001-0000-4000-8000-000000000001",
    variant_id: null,
    slug: "monthly-save",
    name: "Monthly",
    description: null,
    stripe_product_id: "prod_test",
    stripe_price_id: "price_test_subscription",
    interval: "month",
    interval_count: 1,
    price_cents: 2100,
    currency: "usd",
    trial_period_days: null,
    status: "active",
  } as const;
}

let handler: typeof import("./create-subscription-checkout-session").default;

describe("create-subscription-checkout-session", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockSessionsCreate.mockClear();
    mockMaybeSingle.mockClear();
    mockSessionsCreate.mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/test",
    });
    mockMaybeSingle.mockResolvedValue({
      data: activePlanFixture(),
      error: null,
    });
    const mod = await import("./create-subscription-checkout-session");
    handler = mod.default;
  });

  async function invoke(body: unknown) {
    const json = vi.fn().mockResolvedValue({});
    await handler({ method: "POST", body } as Partial<VercelRequest> as VercelRequest, {
      status: () => ({ json }),
      setHeader: vi.fn(),
    } as unknown as VercelResponse);
    return json;
  }

  it("creates a Stripe Checkout Session in subscription mode with server-derived price id", async () => {
    const json = await invoke({
      plan_id: "00000000-0000-4000-a000-000000000099",
      email: "buyer@test.local",
    });
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      url: "https://checkout.stripe.com/test",
    });
    expect(mockSessionsCreate).toHaveBeenCalled();
    const [args] = mockSessionsCreate.mock.calls[0] as [unknown];
    const a = args as { mode?: string; line_items?: unknown[]; metadata?: Record<string, string> };
    expect(a.mode).toBe("subscription");
    expect(a.metadata?.subscription_checkout_v1).toBe("true");
    expect(Array.isArray(a.line_items)).toBe(true);
    expect((a.line_items as { price?: string }[])[0]).toMatchObject({
      price: "price_test_subscription",
      quantity: 1,
    });
  });

  it("rejects archived plans without calling Stripe", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        ...activePlanFixture(),
        status: "archived",
      },
      error: null,
    });
    const json = await invoke({
      plan_id: "00000000-0000-4000-a000-000000000099",
      email: "buyer@test.local",
    });
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      error: "This subscription option is no longer available.",
    });
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });
});
