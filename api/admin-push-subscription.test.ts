// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mockVerify = vi.fn();

vi.mock("./_lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./_lib/verifyAdminJwt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_lib/verifyAdminJwt")>();
  return {
    ...actual,
    verifyAdminJwt: (...args: unknown[]) => mockVerify(...args),
  };
});

const mockFrom = vi.fn();

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

const mockIsPushConfigured = vi.fn();

vi.mock("./_lib/env", () => ({
  ENV: {
    FRONTEND_URL: "http://localhost:5173",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "anon_test_key",
    SUPABASE_SERVICE_ROLE_KEY: "service_role_test",
    VAPID_PUBLIC_KEY: "BKxTestPublic",
    VAPID_PRIVATE_KEY: "private",
    VAPID_SUBJECT: "mailto:a@b.com",
  },
  isSupabaseOrderPersistenceConfigured: () => true,
  isOwnerPushNotificationsConfigured: () => mockIsPushConfigured(),
}));

let handler: typeof import("./admin-push-subscription").default;

function mockRes() {
  const resJson = vi.fn();
  const resEnd = vi.fn();
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json: resJson, end: resEnd }),
  } as unknown as VercelResponse;
  return { res, resJson, resEnd };
}

describe("admin-push-subscription handler", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockVerify.mockReset();
    mockFrom.mockReset();
    mockIsPushConfigured.mockReset();
    mockVerify.mockResolvedValue({ userId: "550e8400-e29b-41d4-a716-446655440001" });
    mockIsPushConfigured.mockReturnValue(true);
    const mod = await import("./admin-push-subscription");
    handler = mod.default;
  });

  it("GET returns 401 without Authorization", async () => {
    const { res, resJson } = mockRes();
    await handler({ method: "GET", headers: {} } as unknown as VercelRequest, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("GET returns serverPushEnabled false when push env not configured", async () => {
    mockIsPushConfigured.mockReturnValue(false);
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: async () => ({ count: 0, error: null }),
        }),
      }),
    });
    const { res, resJson } = mockRes();
    await handler(
      {
        method: "GET",
        headers: { authorization: "Bearer tok" },
      } as unknown as VercelRequest,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({ serverPushEnabled: false, vapidPublicKey: null }),
    );
  });

  it("POST returns 503 when push is disabled on server", async () => {
    mockIsPushConfigured.mockReturnValue(false);
    const { res, resJson } = mockRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer valid" },
        body: { subscription: { endpoint: "https://e", keys: { p256dh: "p", auth: "a" } } },
      } as unknown as VercelRequest,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(resJson).toHaveBeenCalledWith({ error: "Owner push is not enabled on the server" });
  });

  it("POST upserts subscription when configured", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "owner_push_subscriptions") {
        return { upsert };
      }
      return {};
    });
    const { res, resJson } = mockRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer valid", "user-agent": "vitest" },
        body: {
          subscription: {
            endpoint: "https://push.example/sub",
            keys: { p256dh: "kp", auth: "ka" },
          },
        },
      } as unknown as VercelRequest,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "550e8400-e29b-41d4-a716-446655440001",
        endpoint: "https://push.example/sub",
        status: "active",
      }),
      { onConflict: "endpoint" },
    );
    expect(resJson).toHaveBeenCalledWith({ ok: true });
  });

  it("POST revoke marks rows revoked", async () => {
    const done = Promise.resolve({ error: null });
    const builder: {
      eq: (col: string, val?: string) => typeof builder | Promise<{ error: null }>;
    } = {
      eq: (col: string) => {
        if (col === "status") return done;
        return builder;
      },
    };
    const updateMock = vi.fn(() => builder);
    mockFrom.mockReturnValue({ update: updateMock });
    const { res, resJson } = mockRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer valid" },
        body: { action: "revoke" },
      } as unknown as VercelRequest,
      res,
    );
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "revoked" }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson).toHaveBeenCalledWith({ ok: true });
  });
});
