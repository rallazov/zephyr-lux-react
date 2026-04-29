// @vitest-environment node
import { Readable } from "node:stream";
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
const SHIPMENT_ID = "660e8400-e29b-41d4-a716-446655440001";

function png1x1 (): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
}

function buildMultipartPng (): Buffer {
  const boundary = "----testboundary";
  const file = png1x1();
  const prelude = `--${boundary}\r\n`
    + `Content-Disposition: form-data; name="order_id"\r\n\r\n`
    + `${ORDER_ID}\r\n`
    + `--${boundary}\r\n`
    + `Content-Disposition: form-data; name="image_type"\r\n\r\n`
    + `label\r\n`
    + `--${boundary}\r\n`
    + `Content-Disposition: form-data; name="file"; filename="x.png"\r\n`
    + `Content-Type: image/png\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;
  return Buffer.concat([Buffer.from(prelude), file, Buffer.from(end)]);
}

function mockRes () {
  const resJson = vi.fn();
  const resEnd = vi.fn();
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json: resJson, end: resEnd }),
  } as unknown as VercelResponse;
  return { res, resJson, resEnd };
}

describe("admin-shipment-image handler", () => {
  let handler: typeof import("./admin-shipment-image").default;

  beforeEach(async () => {
    vi.resetModules();
    mockVerify.mockReset();
    mockFrom.mockReset();
    mockStorageFrom.mockReset();
    mockVerify.mockResolvedValue({ userId: "admin-1" });
    handler = (await import("./admin-shipment-image")).default;
  });

  it("returns 401 without Authorization", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=----x" },
      body: Buffer.alloc(0),
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(resJson).toHaveBeenCalledWith({
      error: "Missing Authorization Bearer",
    });
  });

  it("returns 403 when JWT is not admin", async () => {
    mockVerify.mockResolvedValue(null);
    const { res } = mockRes();
    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=----x",
        authorization: "Bearer x",
      },
      body: Buffer.alloc(0),
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 for non-multipart", async () => {
    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer tok",
      },
      body: {},
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({
      error: "Expected multipart/form-data",
    });
  });

  it("returns 404 when order is missing", async () => {
    const body = buildMultipartPng();
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=----testboundary",
        authorization: "Bearer tok",
      },
      body,
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(resJson).toHaveBeenCalledWith({ error: "Order not found" });
  });

  it("returns 400 when no shipment row", async () => {
    const body = buildMultipartPng();
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ORDER_ID,
              payment_status: "paid",
              fulfillment_status: "shipped",
            },
            error: null,
          }),
        };
      }
      if (table === "shipments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=----testboundary",
        authorization: "Bearer tok",
      },
      body,
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(resJson).toHaveBeenCalledWith({
      error: "No shipment record for this order — save tracking first",
    });
  });

  it("uploads storage and inserts shipment_images on success", async () => {
    const body = buildMultipartPng();

    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockRemove = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      remove: mockRemove,
    });

    const insertRow = {
      id: "770e8400-e29b-41d4-a716-446655440002",
      created_at: new Date().toISOString(),
      image_type: "label",
      storage_path: `${ORDER_ID}/fake.png`,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ORDER_ID,
              payment_status: "paid",
              fulfillment_status: "shipped",
            },
            error: null,
          }),
        };
      }
      if (table === "shipments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: SHIPMENT_ID, order_id: ORDER_ID },
            error: null,
          }),
        };
      }
      if (table === "shipment_images") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: insertRow,
            error: null,
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=----testboundary",
        authorization: "Bearer tok",
      },
      body,
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(mockStorageFrom).toHaveBeenCalledWith("shipment-images");
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload.mock.calls[0][1]).toBeInstanceOf(Buffer);
    expect(res.status).toHaveBeenCalledWith(201);
    const payload = resJson.mock.calls[0][0] as { id: string };
    expect(payload.id).toBe(insertRow.id);
  });

  it("returns 400 when order not paid/shipped", async () => {
    const body = buildMultipartPng();
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ORDER_ID,
              payment_status: "pending_payment",
              fulfillment_status: "processing",
            },
            error: null,
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const { res, resJson } = mockRes();
    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=----testboundary",
        authorization: "Bearer tok",
      },
      body,
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(resJson.mock.calls[0][0]).toMatchObject({
      error: expect.stringMatching(/Shipped/i),
    });
  });

  it("cleans up storage when insert fails", async () => {
    const body = buildMultipartPng();

    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockRemove = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      remove: mockRemove,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ORDER_ID,
              payment_status: "paid",
              fulfillment_status: "shipped",
            },
            error: null,
          }),
        };
      }
      if (table === "shipments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: SHIPMENT_ID, order_id: ORDER_ID },
            error: null,
          }),
        };
      }
      if (table === "shipment_images") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "insert fail" } }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const { res } = mockRes();
    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=----testboundary",
        authorization: "Bearer tok",
      },
      body,
    } as unknown as VercelRequest;

    await handler(req, res);

    expect(mockRemove).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("parses multipart from a readable stream when body is empty", async () => {
    const body = buildMultipartPng();

    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      remove: vi.fn(),
    });

    const insertRow = {
      id: "770e8400-e29b-41d4-a716-446655440002",
      created_at: new Date().toISOString(),
      image_type: "label",
      storage_path: `${ORDER_ID}/x`,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ORDER_ID,
              payment_status: "paid",
              fulfillment_status: "shipped",
            },
            error: null,
          }),
        };
      }
      if (table === "shipments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: SHIPMENT_ID, order_id: ORDER_ID },
            error: null,
          }),
        };
      }
      if (table === "shipment_images") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: insertRow, error: null }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const { res } = mockRes();
    const stream = Readable.from(body);
    const req = Object.assign(stream, {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=----testboundary",
        authorization: "Bearer tok",
      },
      body: undefined,
    }) as unknown as VercelRequest;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockUpload).toHaveBeenCalled();
  });
});
