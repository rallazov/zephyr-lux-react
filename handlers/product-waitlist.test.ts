// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_WAITLIST_ACK_MESSAGE } from "../src/lib/productWaitlistAck";

const mocks = vi.hoisted(() => ({
  adminFrom: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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
}));

vi.mock("./_lib/logger", () => ({
  log: mocks.log,
}));

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

import handler from "./product-waitlist";

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

describe("product-waitlist handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAdmin.mockReturnValue({ from: mocks.adminFrom });
    mocks.adminFrom.mockReset();
  });

  it("returns 400 for invalid JSON body", async () => {
    const { res, json } = responseDouble();
    await handler(
      {
        method: "POST",
        body: { email: "not-an-email", product_id: "00000000-0000-4000-8000-000000000001" },
      } as VercelRequest,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "Invalid request" });
  });

  it("upserts waitlist row when product is coming_soon", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.adminFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { status: "coming_soon" },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "product_waitlist_signups") {
        return { upsert };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { res, json } = responseDouble();
    await handler(
      {
        method: "POST",
        body: {
          email: " Buyer@Example.COM ",
          product_id: "a0000005-0000-4000-8000-000000000005",
        },
      } as VercelRequest,
      res,
    );

    expect(upsert).toHaveBeenCalledWith(
      {
        product_id: "a0000005-0000-4000-8000-000000000005",
        email: "buyer@example.com",
      },
      expect.objectContaining({
        onConflict: "product_id,email",
        ignoreDuplicates: true,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({ message: PRODUCT_WAITLIST_ACK_MESSAGE });
  });

  it("returns neutral 202 when admin client missing", async () => {
    mocks.getSupabaseAdmin.mockReturnValueOnce(null);
    const { res, json } = responseDouble();
    await handler(
      {
        method: "POST",
        body: {
          email: "buyer@example.com",
          product_id: "a0000005-0000-4000-8000-000000000005",
        },
      } as VercelRequest,
      res,
    );
    expect(mocks.adminFrom).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({ message: PRODUCT_WAITLIST_ACK_MESSAGE });
  });

  it("returns neutral 202 when product is not coming_soon", async () => {
    mocks.adminFrom.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { status: "active" },
                error: null,
              }),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { res, json } = responseDouble();
    await handler(
      {
        method: "POST",
        body: {
          email: "buyer@example.com",
          product_id: "a0000001-0000-4000-8000-000000000001",
        },
      } as VercelRequest,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({ message: PRODUCT_WAITLIST_ACK_MESSAGE });
  });
});
