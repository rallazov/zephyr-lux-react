// @vitest-environment node
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  ENV: {
    NODE_ENV: "test",
    FRONTEND_URL: "https://store.example.com",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SUPABASE_ANON_KEY: "",
    RESEND_API_KEY: "re_test",
    RESEND_FROM: "orders@store.example.com",
    OWNER_NOTIFICATION_EMAIL: "",
    SUPPORT_EMAIL: "help@store.example.com",
    STORE_BACKEND: "auto",
    VERCEL_BLOB_RW_TOKEN: "",
    LOG_LEVEL: "info",
    ENABLE_CUSTOMER_SHIPMENT_NOTIFICATION: false,
  },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ENV } from "./env";
import {
  NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_LOOKUP_LINK,
} from "./notificationLog";
import {
  buildCustomerOrderLookupLinkEmail,
  buildOrderLookupUrlWithFrontendBase,
  emailsMatchCaseInsensitive,
  hashLookupToken,
  maskEmailForLog,
  orderLookupExpiryCopy,
  processOrderLookupLinkRequest,
} from "./customerOrderLookupLink";

type OrderLookupTestRow = {
  id: string;
  order_number: string;
  customer_email: string;
  payment_status: string;
};

type AdminMockOptions = {
  order?: OrderLookupTestRow | null;
  orderError?: unknown;
  recentToken?: { id: string } | null;
  recentError?: unknown;
  tokenInsertError?: unknown;
  tokenRowId?: string;
  notificationInsertError?: unknown;
  notificationMarkRows?: { id: string }[] | null;
  notificationMarkError?: unknown;
};

const paidOrder: OrderLookupTestRow = {
  id: "ord-1",
  order_number: "ZLX-20260428-0001",
  customer_email: "buyer@example.com",
  payment_status: "paid",
};

const originalEnv = { ...ENV };

function createAdminMock(options: AdminMockOptions = {}) {
  const calls = {
    orderEq: [] as Array<[string, unknown]>,
    recentEq: [] as Array<[string, unknown]>,
    recentGt: [] as Array<[string, unknown]>,
    tokenInserts: [] as Array<Record<string, unknown>>,
    tokenDeletes: [] as Array<{ column: string; value: unknown }>,
    notificationInserts: [] as Array<Record<string, unknown>>,
    notificationUpdates: [] as Array<Record<string, unknown>>,
  };

  const orderQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      calls.orderEq.push([column, value]);
      return orderQuery;
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.order === undefined ? paidOrder : options.order,
      error: options.orderError ?? null,
    }),
  };

  const recentQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      calls.recentEq.push([column, value]);
      return recentQuery;
    }),
    gt: vi.fn((column: string, value: unknown) => {
      calls.recentGt.push([column, value]);
      return recentQuery;
    }),
    limit: vi.fn(() => recentQuery),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.recentToken ?? null,
      error: options.recentError ?? null,
    }),
  };

  const tokenTable = {
    select: vi.fn(() => recentQuery),
    insert: vi.fn((payload: Record<string, unknown>) => {
      calls.tokenInserts.push(payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: options.tokenInsertError ? null : { id: options.tokenRowId ?? "tok-row-1" },
            error: options.tokenInsertError ?? null,
          }),
        })),
      };
    }),
    delete: vi.fn(() => ({
      eq: vi.fn((column: string, value: unknown) => {
        calls.tokenDeletes.push({ column, value });
        return Promise.resolve({ error: null });
      }),
    })),
  };

  const notificationTable = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      calls.notificationInserts.push(payload);
      const index = calls.notificationInserts.length;
      return {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: options.notificationInsertError ? null : { id: `log-${index}` },
            error: options.notificationInsertError ?? null,
          }),
        })),
      };
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      calls.notificationUpdates.push(payload);
      return {
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn().mockResolvedValue({
              data: options.notificationMarkRows ?? [{ id: "log-1" }],
              error: options.notificationMarkError ?? null,
            }),
          })),
        })),
      };
    }),
  };

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => orderQuery),
        };
      }
      if (table === "order_lookup_tokens") return tokenTable;
      if (table === "notification_logs") return notificationTable;
      return {};
    }),
  } as unknown as SupabaseClient;

  return { admin, calls };
}

function lookupTokenFromSendCall(sendViaResend: ReturnType<typeof vi.fn>) {
  const message = sendViaResend.mock.calls[0]?.[0] as { text?: string } | undefined;
  const match = message?.text?.match(/https:\/\/store\.example\.com\/order-status\/([^\s]+)/);
  expect(match?.[1]).toBeTruthy();
  return decodeURIComponent(match![1]);
}

describe("customerOrderLookupLink helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.assign(ENV, originalEnv);
  });

  it("hashes lookup tokens with SHA-256 hex", () => {
    const raw = "test-token";
    expect(hashLookupToken(raw)).toBe(createHash("sha256").update(raw, "utf8").digest("hex"));
  });

  it("matches emails case-insensitively after trim", () => {
    expect(emailsMatchCaseInsensitive("Buyer@Example.com ", "buyer@example.com")).toBe(true);
    expect(emailsMatchCaseInsensitive("a@b.co", "a@c.co")).toBe(false);
  });

  it("builds order-status path with only the opaque token", () => {
    const url = buildOrderLookupUrlWithFrontendBase("opaque-token-part", "https://shop.example/");
    expect(url).toBe("https://shop.example/order-status/opaque-token-part");
    expect(url).not.toMatch(/email|order_number|stripe|intent|name/i);
  });

  it("masks email local part for application logs", () => {
    expect(maskEmailForLog("alice@corp.io")).toBe("a***@corp.io");
  });

  it("email bodies include expiry copy and keep the secure link free of PII", () => {
    const built = buildCustomerOrderLookupLinkEmail({
      order_number: "ZLX-20260401-0001",
      lookupUrl: "https://app.example/order-status/the-token",
      expiryCopy: orderLookupExpiryCopy(),
    });
    expect(built.subject).toContain("ZLX-20260401-0001");
    expect(built.text).toContain("https://app.example/order-status/the-token");
    expect(built.text.toLowerCase()).toContain("24 hour");
    expect(built.html).toContain('href="https://app.example/order-status/the-token"');
    expect(built.html).not.toMatch(/buyer@example|payment_intent|customer_name/i);
  });
});

describe("processOrderLookupLinkRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.assign(ENV, originalEnv);
  });

  it("sends email, stores only token hash, and marks notification sent on paid match", async () => {
    const sendViaResend = vi.fn().mockResolvedValue({ ok: true, messageId: "res-1" });
    const { admin, calls } = createAdminMock();

    await processOrderLookupLinkRequest({
      admin,
      order_number: paidOrder.order_number,
      email: " buyer@example.com ",
      sendViaResend,
    });

    expect(calls.orderEq).toContainEqual(["order_number", paidOrder.order_number]);
    expect(calls.recentEq).toContainEqual(["order_id", paidOrder.id]);
    expect(sendViaResend).toHaveBeenCalledTimes(1);

    const rawToken = lookupTokenFromSendCall(sendViaResend);
    expect(rawToken).toHaveLength(43);
    expect(calls.tokenInserts).toHaveLength(1);
    expect(calls.tokenInserts[0]).toEqual(
      expect.objectContaining({
        order_id: paidOrder.id,
        token_hash: hashLookupToken(rawToken),
        recipient_email: "buyer@example.com",
        expires_at: expect.any(String),
      }),
    );
    expect(calls.tokenInserts[0]).not.toHaveProperty("token");
    expect(calls.tokenInserts[0]).not.toHaveProperty("rawToken");

    expect(sendViaResend.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        from: "orders@store.example.com",
        to: ["buyer@example.com"],
        idempotencyKey: "order-lookup/ord-1/tok-row-1",
      }),
    );
    expect(sendViaResend.mock.calls[0][0].text).not.toContain("buyer@example.com");
    expect(calls.notificationInserts).toContainEqual(
      expect.objectContaining({
        order_id: paidOrder.id,
        recipient: "buyer@example.com",
        channel: "email",
        template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_LOOKUP_LINK,
        status: "queued",
      }),
    );
    expect(calls.notificationUpdates).toContainEqual(
      expect.objectContaining({
        status: "sent",
        provider_message_id: "res-1",
        error_message: null,
      }),
    );
  });

  it("sends nothing for no order, email mismatch, or unpaid order", async () => {
    const cases: Array<OrderLookupTestRow | null> = [
      null,
      { ...paidOrder, customer_email: "someoneelse@example.com" },
      { ...paidOrder, payment_status: "pending" },
    ];

    for (const order of cases) {
      const sendViaResend = vi.fn();
      const { admin, calls } = createAdminMock({ order });

      await processOrderLookupLinkRequest({
        admin,
        order_number: paidOrder.order_number,
        email: "buyer@example.com",
        sendViaResend,
      });

      expect(sendViaResend).not.toHaveBeenCalled();
      expect(calls.tokenInserts).toHaveLength(0);
      expect(calls.notificationInserts).toHaveLength(0);
    }
  });

  it("suppresses a repeated request when a recent unexpired token exists", async () => {
    const sendViaResend = vi.fn();
    const { admin, calls } = createAdminMock({ recentToken: { id: "recent-token-row" } });

    await processOrderLookupLinkRequest({
      admin,
      order_number: paidOrder.order_number,
      email: "buyer@example.com",
      sendViaResend,
    });

    expect(sendViaResend).not.toHaveBeenCalled();
    expect(calls.tokenInserts).toHaveLength(0);
    expect(calls.notificationInserts).toHaveLength(0);
  });

  it("records a failed notification and rolls back the token when Resend config is missing", async () => {
    ENV.RESEND_API_KEY = "";
    const sendViaResend = vi.fn();
    const { admin, calls } = createAdminMock();

    await processOrderLookupLinkRequest({
      admin,
      order_number: paidOrder.order_number,
      email: "buyer@example.com",
      sendViaResend,
    });

    expect(sendViaResend).not.toHaveBeenCalled();
    expect(calls.tokenInserts).toHaveLength(1);
    expect(calls.tokenDeletes).toEqual([{ column: "id", value: "tok-row-1" }]);
    expect(calls.notificationInserts).toContainEqual(
      expect.objectContaining({
        order_id: paidOrder.id,
        template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_LOOKUP_LINK,
        status: "failed",
        error_message: "RESEND_API_KEY not configured",
      }),
    );
  });

  it("marks notification failed and rolls back the token when Resend rejects", async () => {
    const sendViaResend = vi.fn().mockResolvedValue({ ok: false, message: "Resend rejected" });
    const { admin, calls } = createAdminMock();

    await processOrderLookupLinkRequest({
      admin,
      order_number: paidOrder.order_number,
      email: "buyer@example.com",
      sendViaResend,
    });

    expect(sendViaResend).toHaveBeenCalledTimes(1);
    expect(calls.tokenDeletes).toEqual([{ column: "id", value: "tok-row-1" }]);
    expect(calls.notificationUpdates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        error_message: "Resend rejected",
      }),
    );
  });

  it("treats thrown transport errors as failed notifications", async () => {
    const sendViaResend = vi.fn().mockRejectedValue(new Error("network down"));
    const { admin, calls } = createAdminMock();

    await processOrderLookupLinkRequest({
      admin,
      order_number: paidOrder.order_number,
      email: "buyer@example.com",
      sendViaResend,
    });

    expect(calls.tokenDeletes).toEqual([{ column: "id", value: "tok-row-1" }]);
    expect(calls.notificationUpdates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        error_message: "network down",
      }),
    );
  });
});
