// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mockPortalCreate = vi.fn().mockResolvedValue({
  url: "https://billing.stripe.com/p/session_z",
});

const mockMaybeSingle = vi.fn();

const verifyAdminJwtMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ userId: "admin-user-1" }),
);

vi.mock("stripe", () => ({
  default: class Stripe {
    billingPortal = {
      sessions: {
        create: mockPortalCreate,
      },
    };
  },
}));

vi.mock("./_lib/env", () => ({
  ENV: {
    STRIPE_SECRET_KEY: "sk_test_x",
    FRONTEND_URL: "http://localhost:5173",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "anon_test",
    SUPABASE_SERVICE_ROLE_KEY: "service_role_test",
  },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

vi.mock("./_lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      })),
    })),
  }),
}));

vi.mock("./_lib/verifyAdminJwt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_lib/verifyAdminJwt")>();
  return {
    ...actual,
    verifyAdminJwt: verifyAdminJwtMock,
  };
});

let handler: typeof import("./create-billing-portal-session").default;

describe("create-billing-portal-session", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockPortalCreate.mockClear();
    mockPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/session_z" });
    mockMaybeSingle.mockReset();
    mockMaybeSingle.mockResolvedValue({ data: { id: "sub-row-1" }, error: null });
    verifyAdminJwtMock.mockReset();
    verifyAdminJwtMock.mockResolvedValue({ userId: "admin-user-1" });
    const mod = await import("./create-billing-portal-session");
    handler = mod.default;
  });

  async function invoke(
    body: unknown,
    opts?: { authorization?: string | undefined },
  ) {
    const json = vi.fn().mockResolvedValue({});
    await handler(
      {
        method: "POST",
        body,
        headers: opts?.authorization
          ? { authorization: opts.authorization }
          : {},
      } as Partial<VercelRequest> as VercelRequest,
      {
        status: () => ({ json }),
        setHeader: vi.fn(),
      } as unknown as VercelResponse,
    );
    return json;
  }

  it("returns a Stripe Billing Portal URL for an admin with a known subscription customer", async () => {
    const json = await invoke(
      { stripe_customer_id: "cus_ABCDEFGHIJKlmno" },
      { authorization: "Bearer valid_admin_jwt" },
    );
    expect(json.mock.calls[0]?.[0]).toEqual({
      url: "https://billing.stripe.com/p/session_z",
    });
    expect(mockPortalCreate.mock.calls[0]?.[0]).toMatchObject({
      customer: "cus_ABCDEFGHIJKlmno",
      return_url: "http://localhost:5173/subscription/checkout/success",
    });
  });

  it("rejects invalid customer ids", async () => {
    const json = await invoke(
      { stripe_customer_id: "bad" },
      { authorization: "Bearer valid_admin_jwt" },
    );
    expect(mockPortalCreate).not.toHaveBeenCalled();
    expect(json.mock.calls[0]?.[0]).toHaveProperty("error");
  });

  it("returns 401 without Authorization", async () => {
    const json = await invoke({ stripe_customer_id: "cus_ABCDEFGHIJKlmno" });
    expect(mockPortalCreate).not.toHaveBeenCalled();
    expect(json.mock.calls[0]?.[0]).toMatchObject({ error: "Missing Authorization Bearer" });
  });

  it("returns 403 when JWT is not an admin", async () => {
    verifyAdminJwtMock.mockResolvedValue(null);
    const json = await invoke(
      { stripe_customer_id: "cus_ABCDEFGHIJKlmno" },
      { authorization: "Bearer not_admin" },
    );
    expect(mockPortalCreate).not.toHaveBeenCalled();
    expect(json.mock.calls[0]?.[0]).toMatchObject({ error: "Admin role required" });
  });

  it("returns 404 when customer has no subscription row", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const json = await invoke(
      { stripe_customer_id: "cus_ABCDEFGHIJKlmno" },
      { authorization: "Bearer valid_admin_jwt" },
    );
    expect(mockPortalCreate).not.toHaveBeenCalled();
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      error: "No subscription on file for this customer.",
    });
  });
});
