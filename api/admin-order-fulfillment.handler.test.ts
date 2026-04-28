// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mockVerify = vi.fn();
const mockRpc = vi.fn();

const { shipmentNotifySpy, envHoist } = vi.hoisted(() => ({
  shipmentNotifySpy: vi.fn().mockResolvedValue(undefined),
  envHoist: { enableCustomerShipmentNotification: false },
}));

vi.mock("./_lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./_lib/customerShipmentNotification", () => ({
  maybeSendCustomerShipmentNotification: (...args: unknown[]) => shipmentNotifySpy(...args),
}));

vi.mock("./_lib/verifyAdminJwt", () => ({
  verifyAdminJwt: (...args: unknown[]) => mockVerify(...args),
}));

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
    get ENABLE_CUSTOMER_SHIPMENT_NOTIFICATION() {
      return envHoist.enableCustomerShipmentNotification;
    },
  },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

let handler: typeof import("./admin-order-fulfillment").default;

/** Zod `uuid()`-compatible v4-style id */
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

describe("admin-order-fulfillment handler", () => {
  beforeEach(async () => {
    vi.resetModules();
    envHoist.enableCustomerShipmentNotification = false;
    mockVerify.mockReset();
    mockRpc.mockReset();
    shipmentNotifySpy.mockReset();
    shipmentNotifySpy.mockResolvedValue(undefined);
    mockVerify.mockResolvedValue({ userId: "admin-user-uuid" });
    mockRpc.mockResolvedValue({
      data: { ok: true, changed: true, from: "processing", to: "packed" },
      error: null,
    });
    const mod = await import("./admin-order-fulfillment");
    handler = mod.default;
  });

  it("returns 401 without Authorization", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "packed" },
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
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "packed" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(resJson).toHaveBeenCalledWith({ error: "Forbidden" });
  });

  it("returns 400 for invalid order_id", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: "not-a-uuid" },
      body: { fulfillment_status: "packed" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({ error: "Invalid order_id" });
  });

  it("calls apply_fulfillment_transition with actor id", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "packed" },
      headers: { authorization: "Bearer valid.jwt" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(mockRpc).toHaveBeenCalledWith("apply_fulfillment_transition", {
      p_order_id: ORDER_ID,
      p_to: "packed",
      p_actor_user_id: "admin-user-uuid",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson.mock.calls[0][0]).toMatchObject({
      fulfillment_status: "packed",
      changed: true,
    });
  });

  it("returns 404 when RPC reports order_not_found", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'apply_fulfillment_transition: order_not_found' },
    });
    const { res, resJson } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "packed" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(resJson).toHaveBeenCalledWith({ error: "Order not found" });
  });

  it("returns 409 when RPC reports invalid_transition", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "apply_fulfillment_transition: invalid_transition" },
    });
    const { res, resJson } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "shipped" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(resJson.mock.calls[0][0].error).toMatch(/not allowed/);
  });

  it("returns 204 when RPC no-op (changed false)", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, changed: false, fulfillment_status: "packed" },
      error: null,
    });
    const { res, resEnd } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "packed" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(resEnd).toHaveBeenCalled();
    expect(shipmentNotifySpy).not.toHaveBeenCalled();
  });

  it("accepts order_id as first entry when query repeats the key", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: [ORDER_ID, "duplicate-ignored"] },
      body: { fulfillment_status: "packed" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(mockRpc).toHaveBeenCalledWith("apply_fulfillment_transition", {
      p_order_id: ORDER_ID,
      p_to: "packed",
      p_actor_user_id: "admin-user-uuid",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson.mock.calls[0][0]).toMatchObject({ fulfillment_status: "packed" });
  });

  it("does not invoke shipment notification when flag is off (default)", async () => {
    envHoist.enableCustomerShipmentNotification = false;
    mockRpc.mockResolvedValue({
      data: { ok: true, changed: true, from: "packed", to: "shipped" },
      error: null,
    });
    const { res } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "shipped" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(shipmentNotifySpy).not.toHaveBeenCalled();
  });

  it("invokes customer shipment notification when flag is on and transitioning to shipped", async () => {
    envHoist.enableCustomerShipmentNotification = true;
    mockRpc.mockResolvedValue({
      data: { ok: true, changed: true, from: "packed", to: "shipped" },
      error: null,
    });
    const { res } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "shipped" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(shipmentNotifySpy).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      admin: expect.objectContaining({ rpc: mockRpc }),
    });
  });

  it("returns 200 when notify fails after successful ship transition (flag on)", async () => {
    envHoist.enableCustomerShipmentNotification = true;
    shipmentNotifySpy.mockRejectedValue(new Error("resend down"));
    mockRpc.mockResolvedValue({
      data: { ok: true, changed: true, from: "packed", to: "shipped" },
      error: null,
    });
    const { res, resJson } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "shipped" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson.mock.calls[0][0]).toMatchObject({ fulfillment_status: "shipped" });
  });

  it("does not invoke shipment notification when advancing to packed", async () => {
    const { res } = mockRes();
    const req = {
      method: "PATCH",
      query: { order_id: ORDER_ID },
      body: { fulfillment_status: "packed" },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(shipmentNotifySpy).not.toHaveBeenCalled();
  });
});
