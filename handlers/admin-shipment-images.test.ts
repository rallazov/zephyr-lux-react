// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mockVerify = vi.fn();
const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();

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
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }),
}));

vi.mock("./_lib/env", () => ({
  ENV: {
    FRONTEND_URL: "http://localhost:5173",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "anon_test_key",
    SUPABASE_SERVICE_ROLE_KEY: "service_role_test",
  },
}));

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";

function mockRes () {
  const resJson = vi.fn();
  const resEnd = vi.fn();
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json: resJson, end: resEnd }),
  } as unknown as VercelResponse;
  return { res, resJson };
}

describe("admin-shipment-images handler", () => {
  let handler: typeof import("./admin-shipment-images").default;

  beforeEach(async () => {
    vi.resetModules();
    mockVerify.mockReset();
    mockFrom.mockReset();
    mockStorageFrom.mockReset();
    mockVerify.mockResolvedValue({ userId: "admin-1" });
    handler = (await import("./admin-shipment-images")).default;
  });

  it("returns 401 without Authorization", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "GET",
      query: { order_id: ORDER_ID },
      headers: {},
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({
      error: "Missing Authorization Bearer",
    });
  });

  it("returns signed preview URLs for rows", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "shipment_images") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "770e8400-e29b-41d4-a716-446655440002",
                image_type: "label",
                created_at: "2026-04-28T12:00:00.000Z",
                storage_path: `${ORDER_ID}/a.png`,
              },
            ],
            error: null,
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    mockStorageFrom.mockReturnValue({
      createSignedUrl: vi
        .fn()
        .mockResolvedValue({ data: { signedUrl: "https://signed.example/preview" }, error: null }),
    });

    const { res, resJson } = mockRes();
    const req = {
      method: "GET",
      query: { order_id: ORDER_ID },
      headers: { authorization: "Bearer tok" },
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = resJson.mock.calls[0][0] as {
      items: { preview_url: string }[];
    };
    expect(body.items[0].preview_url).toBe("https://signed.example/preview");
  });
});
