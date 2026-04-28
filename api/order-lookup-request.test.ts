// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORDER_LOOKUP_NEUTRAL_MESSAGE } from "../src/order-status/orderLookupRequest";

const mocks = vi.hoisted(() => ({
  admin: { kind: "supabase-admin" },
  getSupabaseAdmin: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  processOrderLookupLinkRequest: vi.fn(),
}));

vi.mock("./_lib/env", () => ({
  ENV: {
    NODE_ENV: "test",
    FRONTEND_URL: "http://localhost:5173",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SUPABASE_ANON_KEY: "",
    RESEND_API_KEY: "",
    RESEND_FROM: "",
    OWNER_NOTIFICATION_EMAIL: "",
    SUPPORT_EMAIL: "",
    STORE_BACKEND: "auto",
    VERCEL_BLOB_RW_TOKEN: "",
    LOG_LEVEL: "info",
    ENABLE_CUSTOMER_SHIPMENT_NOTIFICATION: false,
  },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

vi.mock("./_lib/logger", () => ({
  log: mocks.log,
}));

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

vi.mock("./_lib/customerOrderLookupLink", () => ({
  processOrderLookupLinkRequest: mocks.processOrderLookupLinkRequest,
}));

import handler from "./order-lookup-request";

function responseDouble() {
  const json = vi.fn();
  const end = vi.fn();
  const statusResult = { json, end };
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue(statusResult),
  } as unknown as VercelResponse;

  return { res, json, end };
}

describe("order-lookup-request handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAdmin.mockReturnValue(mocks.admin);
    mocks.processOrderLookupLinkRequest.mockResolvedValue(undefined);
  });

  it("returns the neutral response and processes normalized valid lookup details", async () => {
    const { res, json } = responseDouble();

    await handler(
      {
        method: "POST",
        body: {
          email: " buyer@example.com ",
          order_number: " zlx-20260428-0007 ",
        },
      } as VercelRequest,
      res,
    );

    expect(mocks.processOrderLookupLinkRequest).toHaveBeenCalledWith({
      admin: mocks.admin,
      order_number: "ZLX-20260428-0007",
      email: "buyer@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({ message: ORDER_LOOKUP_NEUTRAL_MESSAGE });
  });

  it("rejects invalid payloads without revealing lookup state", async () => {
    const { res, json } = responseDouble();

    await handler(
      {
        method: "POST",
        body: {
          email: "buyer@example.com",
          order_number: "ZLX-2026-7",
        },
      } as VercelRequest,
      res,
    );

    expect(mocks.processOrderLookupLinkRequest).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "Invalid lookup request" });
  });

  it("handles missing Supabase config as a neutral valid request", async () => {
    const { res, json } = responseDouble();
    mocks.getSupabaseAdmin.mockReturnValueOnce(null);

    await handler(
      {
        method: "POST",
        body: {
          email: "buyer@example.com",
          order_number: "ZLX-20260428-0007",
        },
      } as VercelRequest,
      res,
    );

    expect(mocks.processOrderLookupLinkRequest).not.toHaveBeenCalled();
    expect(mocks.log.warn).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({ message: ORDER_LOOKUP_NEUTRAL_MESSAGE });
  });

  it("keeps the neutral response if processing fails unexpectedly", async () => {
    const { res, json } = responseDouble();
    mocks.processOrderLookupLinkRequest.mockRejectedValueOnce(new Error("boom"));

    await handler(
      {
        method: "POST",
        body: {
          email: "buyer@example.com",
          order_number: "ZLX-20260428-0007",
        },
      } as VercelRequest,
      res,
    );

    expect(mocks.log.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({ message: ORDER_LOOKUP_NEUTRAL_MESSAGE });
  });

  it("handles preflight without a body", async () => {
    const { res, end } = responseDouble();

    await handler({ method: "OPTIONS", body: {} } as VercelRequest, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(end).toHaveBeenCalled();
  });
});
