// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mockVerify = vi.fn();
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

const PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440000";

function pngBytes(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
}

function buildMultipartPng(productId = PRODUCT_ID): Buffer {
  const boundary = "----testboundary";
  const parts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="product_id"\r\n\r\n`,
    `${productId}\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="x.png"\r\n`,
    `Content-Type: image/png\r\n\r\n`,
  ];
  const end = `\r\n--${boundary}--\r\n`;
  return Buffer.concat([Buffer.from(parts.join("")), pngBytes(), Buffer.from(end)]);
}

function mockRes() {
  const resJson = vi.fn();
  const resEnd = vi.fn();
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json: resJson, end: resEnd }),
  } as unknown as VercelResponse;
  return { res, resJson, resEnd };
}

describe("admin-product-image handler", () => {
  let handler: typeof import("./admin-product-image").default;
  let upload: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;
  let getPublicUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    mockVerify.mockReset();
    mockStorageFrom.mockReset();
    upload = vi.fn().mockResolvedValue({ error: null });
    remove = vi.fn().mockResolvedValue({ error: null });
    getPublicUrl = vi.fn((path: string) => ({
      data: { publicUrl: `https://cdn.example/${path}` },
    }));
    mockStorageFrom.mockReturnValue({ upload, remove, getPublicUrl });
    mockVerify.mockResolvedValue({ userId: "admin-1" });
    handler = (await import("./admin-product-image")).default;
  });

  it("returns 401 without Authorization", async () => {
    const { res, resJson } = mockRes();
    await handler(
      {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=----x" },
        body: Buffer.alloc(0),
      } as unknown as VercelRequest,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({ error: "Missing Authorization Bearer" });
  });

  it("uploads a product image and returns object path plus public preview", async () => {
    const { res, resJson } = mockRes();
    await handler(
      {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=----testboundary",
          authorization: "Bearer tok",
        },
        body: buildMultipartPng(),
      } as unknown as VercelRequest,
      res,
    );

    expect(mockStorageFrom).toHaveBeenCalledWith("product-images");
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^products/${PRODUCT_ID}/.+\\.png$`)),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(resJson).toHaveBeenCalledWith({
      object_path: expect.stringMatching(new RegExp(`^products/${PRODUCT_ID}/.+\\.png$`)),
      preview_url: expect.stringContaining("https://cdn.example/products/"),
      mime: "image/png",
    });
  });

  it("rejects unsupported image bytes", async () => {
    const boundary = "----testboundary";
    const body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.txt"\r\nContent-Type: text/plain\r\n\r\nnope\r\n--${boundary}--\r\n`,
    );
    const { res, resJson } = mockRes();

    await handler(
      {
        method: "POST",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: "Bearer tok",
        },
        body,
      } as unknown as VercelRequest,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({ error: "Unsupported or corrupt image file" });
    expect(upload).not.toHaveBeenCalled();
  });

  it("deletes a product image object", async () => {
    const { res, resJson } = mockRes();
    await handler(
      {
        method: "DELETE",
        headers: { authorization: "Bearer tok" },
        query: { object_path: "products/abc/x.png" },
      } as unknown as VercelRequest,
      res,
    );

    expect(mockStorageFrom).toHaveBeenCalledWith("product-images");
    expect(remove).toHaveBeenCalledWith(["products/abc/x.png"]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson).toHaveBeenCalledWith({ ok: true });
  });

  it("rejects deletes outside draft/ or products/ prefixes", async () => {
    const { res, resJson } = mockRes();
    await handler(
      {
        method: "DELETE",
        headers: { authorization: "Bearer tok" },
        query: { object_path: "secrets/x.png" },
      } as unknown as VercelRequest,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({ error: "Invalid or missing object_path" });
    expect(remove).not.toHaveBeenCalled();
  });
});
