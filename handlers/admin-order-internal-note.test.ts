// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mockVerify = vi.fn();
const mockRpc = vi.fn();

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

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    rpc: mockRpc,
  }),
}));

vi.mock("./_lib/env", () => ({
  ENV: {
    FRONTEND_URL: "http://localhost:5173",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "anon_test_key",
    SUPABASE_SERVICE_ROLE_KEY: "service_role_test",
  },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

let handler: typeof import("./admin-order-internal-note").default;
let INTERNAL_NOTE_MAX_CHARS: number;

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";

function mockRes() {
  const resJson = vi.fn();
  const resEnd = vi.fn();
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json: resJson, end: resEnd }),
  } as unknown as VercelResponse;
  return { res, resJson, resEnd };
}

describe("admin-order-internal-note handler", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockVerify.mockReset();
    mockRpc.mockReset();
    mockVerify.mockResolvedValue({ userId: "admin-user-uuid" });
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    const mod = await import("./admin-order-internal-note");
    handler = mod.default;
    INTERNAL_NOTE_MAX_CHARS = mod.INTERNAL_NOTE_MAX_CHARS;
  });

  it("returns 401 without Authorization", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      body: { order_id: ORDER_ID, message: "Hello" },
      headers: {},
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("returns 403 when JWT is not admin", async () => {
    mockVerify.mockResolvedValue(null);
    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      body: { order_id: ORDER_ID, message: "Hello" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(resJson).toHaveBeenCalledWith({ error: "Forbidden" });
  });

  it("returns 400 for whitespace-only message", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      body: { order_id: ORDER_ID, message: "   \n\t  " },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({ error: "Note text is required." });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 when message exceeds max length", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      body: { order_id: ORDER_ID, message: "x".repeat(INTERNAL_NOTE_MAX_CHARS + 1) },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(resJson.mock.calls[0][0].error).toMatch(/too long/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls append_order_internal_note with actor from JWT only", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      body: { order_id: ORDER_ID, message: "  Needs trim  " },
      headers: { authorization: "Bearer valid.jwt" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(mockRpc).toHaveBeenCalledWith("append_order_internal_note", {
      p_order_id: ORDER_ID,
      p_message: "Needs trim",
      p_actor_user_id: "admin-user-uuid",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson.mock.calls[0][0]).toMatchObject({ ok: true });
  });

  it("returns 404 when RPC reports order_not_found", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "append_order_internal_note: order_not_found" },
    });
    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      body: { order_id: ORDER_ID, message: "Hi" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(resJson).toHaveBeenCalledWith({ error: "Order not found" });
  });

  it("maps order_not_found from details/hint when PostgREST splits EXCEPTION text", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "ERROR",
        details: "append_order_internal_note: order_not_found\nPL/pgSQL function append_order_internal_note(...) line 12",
      },
    });
    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      body: { order_id: ORDER_ID, message: "Hi" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(resJson).toHaveBeenCalledWith({ error: "Order not found" });
  });
});
