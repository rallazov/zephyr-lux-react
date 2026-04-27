// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "./logger";
import { OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT } from "./ownerOrderNotification";

vi.mock("./env", () => ({
  ENV: {
    FRONTEND_URL: "http://localhost:5173",
    RESEND_API_KEY: "re_test",
    RESEND_FROM: "Orders <orders@test.com>",
    OWNER_NOTIFICATION_EMAIL: "owner@test.com, second@example.com",
  },
}));

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildOwnerOrderPaidEmail,
  formatMoneyCents,
  formatShippingAddressForEmail,
  maybeSendOwnerOrderPaidNotification,
} from "./ownerOrderNotification";
import { sendViaResendApi } from "./transactionalEmail";

/** Minimal `notification_logs` mock: insert().select().single() + update().eq().eq().select() */
function notificationLogsFromMock(
  logId = "nl-test-1",
  options?: { insertError?: { message: string } },
) {
  return {
    insert: () => ({
      select: () => ({
        single: vi.fn().mockResolvedValue(
          options?.insertError
            ? { data: null, error: { message: options.insertError.message } }
            : { data: { id: logId }, error: null },
        ),
      }),
    }),
    update: () => ({
      eq: () => ({
        eq: () => ({
          select: () =>
            Promise.resolve({ data: [{ id: logId }], error: null }),
        }),
      }),
    }),
  };
}

const sampleOrder = {
  id: "o1",
  order_number: "ZLX-1",
  customer_email: "b@e.com",
  customer_name: "B",
  total_cents: 100,
  currency: "usd",
  shipping_address_json: { line1: "x", city: "c", state: "s", postal_code: "1", country: "US" },
  payment_status: "paid",
  owner_order_paid_notified_at: null as string | null,
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ownerOrderNotification helpers", () => {
  it("formatMoneyCents formats USD", () => {
    expect(formatMoneyCents(5350, "usd")).toMatch(/53\.50/);
  });

  it("formatShippingAddressForEmail renders structured address", () => {
    const s = formatShippingAddressForEmail({
      line1: "1 Main St",
      city: "Austin",
      state: "TX",
      postal_code: "78701",
      country: "US",
    });
    expect(s).toContain("1 Main St");
    expect(s).toContain("Austin");
  });

  it("buildOwnerOrderPaidEmail includes order number, customer, lines, admin target", () => {
    const { subject, text, html } = buildOwnerOrderPaidEmail({
      order: {
        id: "ord-uuid",
        order_number: "ZLX-20260426-0001",
        customer_email: "buyer@example.com",
        customer_name: "Buyer Name",
        total_cents: 1000,
        currency: "usd",
        shipping_address_json: {
          line1: "1 Main",
          city: "Austin",
          state: "TX",
          postal_code: "78701",
          country: "US",
        },
      },
      items: [
        {
          sku: "ZLX-A",
          product_title: "Silk Shirt",
          quantity: 1,
          unit_price_cents: 1000,
          total_cents: 1000,
        },
      ],
    });
    expect(subject).toContain("ZLX-20260426-0001");
    expect(text).toContain("Buyer Name");
    expect(text).toContain("buyer@example.com");
    expect(text).toContain("ZLX-A");
    expect(text).toContain("/admin/orders/ord-uuid");
    expect(html).toContain("Silk Shirt");
  });
});

describe("sendViaResendApi", () => {
  it("returns ok when Resend returns 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const r = await sendViaResendApi({
      from: "a@b.com",
      to: ["c@d.com"],
      subject: "s",
      html: "<p>x</p>",
      text: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toMatchObject({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends Idempotency-Key when provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await sendViaResendApi({
      from: "a@b.com",
      to: ["c@d.com"],
      subject: "s",
      html: "<p>x</p>",
      text: "x",
      idempotencyKey: "owner-order-paid/ord-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const opts = fetchImpl.mock.calls[0][1] as { headers: Record<string, string> };
    expect(opts.headers["Idempotency-Key"]).toBe("owner-order-paid/ord-1");
  });

  it("fails with timeout when fetch does not settle", async () => {
    const fetchHandler = (_url: string, init?: { signal?: AbortSignal }) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    };
    const fetchImpl = vi.fn(fetchHandler) as unknown as typeof fetch;
    const r = await sendViaResendApi({
      from: "a@b.com",
      to: ["c@d.com"],
      subject: "s",
      html: "<p>x</p>",
      text: "x",
      timeoutMs: 30,
      fetchImpl,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/timed out after 30ms/i);
    }
  });
});

describe("maybeSendOwnerOrderPaidNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when owner_order_paid_notified_at is already a real timestamp (idempotent)", async () => {
    const sendViaResend = vi.fn();
    let ordersFromCall = 0;
    const admin = {
      from: vi.fn((table: string) => {
        if (table !== "orders") return {};
        ordersFromCall += 1;
        if (ordersFromCall === 1) {
          return {
            update: () => ({
              eq: () => ({ eq: () => ({ lt: () => Promise.resolve({ error: null }) }) }),
            }),
          };
        }
        if (ordersFromCall === 2) {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    select: () => ({
                      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { ...sampleOrder, owner_order_paid_notified_at: "2026-01-01T00:00:00Z" },
                error: null,
              }),
            }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    await maybeSendOwnerOrderPaidNotification({
      admin,
      orderId: "o1",
      stripeEventId: "evt_1",
      stripePaymentIntentId: "pi_1",
      sendViaResend,
    });

    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it("sends once, passes idempotency key, and finalizes owner_order_paid_notified_at", async () => {
    const sendViaResend = vi.fn().mockResolvedValue({ ok: true as const, messageId: "re_msg_1" });
    const finalizeEq = vi.fn().mockResolvedValue({ error: null });
    const finalizeUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: finalizeEq }) });
    const claimMaybeSingle = vi.fn().mockResolvedValue({
      data: { ...sampleOrder, owner_order_paid_notified_at: OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT },
      error: null,
    });
    const itemsEq = vi.fn().mockResolvedValue({
      data: [
        {
          sku: "S",
          product_title: "P",
          quantity: 1,
          unit_price_cents: 100,
          total_cents: 100,
        },
      ],
      error: null,
    });

    let ordersFromCall = 0;
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "notification_logs") {
          return notificationLogsFromMock();
        }
        if (table === "order_items") {
          return { select: () => ({ eq: itemsEq }) };
        }
        if (table !== "orders") return {};
        ordersFromCall += 1;
        if (ordersFromCall === 1) {
          return {
            update: () => ({
              eq: () => ({ eq: () => ({ lt: () => Promise.resolve({ error: null }) }) }),
            }),
          };
        }
        if (ordersFromCall === 2) {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({ select: () => ({ maybeSingle: claimMaybeSingle }) }),
                }),
              }),
            }),
          };
        }
        return {
          update: finalizeUpdate,
        };
      }),
    } as unknown as SupabaseClient;

    await maybeSendOwnerOrderPaidNotification({
      admin,
      orderId: "o1",
      stripeEventId: "evt_1",
      stripePaymentIntentId: "pi_1",
      sendViaResend,
    });

    expect(sendViaResend).toHaveBeenCalledTimes(1);
    expect(sendViaResend.mock.calls[0][0].idempotencyKey).toBe("owner-order-paid/o1");
    expect(finalizeUpdate).toHaveBeenCalled();
    expect(finalizeEq).toHaveBeenCalledWith("owner_order_paid_notified_at", OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT);
  });

  it("releases in-flight when Resend fails", async () => {
    const sendViaResend = vi.fn().mockResolvedValue({ ok: false, message: "bad from" });
    const claimMaybeSingle = vi.fn().mockResolvedValue({
      data: { ...sampleOrder, owner_order_paid_notified_at: OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT },
      error: null,
    });
    const itemsEq = vi.fn().mockResolvedValue({
      data: [{ sku: "S", product_title: "P", quantity: 1, unit_price_cents: 100, total_cents: 100 }],
      error: null,
    });

    let ordersFromCall = 0;
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "notification_logs") {
          return notificationLogsFromMock();
        }
        if (table === "order_items") {
          return { select: () => ({ eq: itemsEq }) };
        }
        if (table !== "orders") return {};
        ordersFromCall += 1;
        if (ordersFromCall === 1) {
          return {
            update: () => ({
              eq: () => ({ eq: () => ({ lt: () => Promise.resolve({ error: null }) }) }),
            }),
          };
        }
        if (ordersFromCall === 2) {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({ select: () => ({ maybeSingle: claimMaybeSingle }) }),
                }),
              }),
            }),
          };
        }
        if (ordersFromCall === 3) {
          return { update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }) };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendOwnerOrderPaidNotification({
      admin,
      orderId: "o1",
      stripeEventId: "evt_1",
      stripePaymentIntentId: "pi_1",
      sendViaResend,
    });

    expect(sendViaResend).toHaveBeenCalled();
    // Third orders.from is release in-flight: update
    expect(ordersFromCall).toBeGreaterThanOrEqual(3);
  });

  it("releases in-flight and skips Resend when notification_logs insert (queued) fails", async () => {
    const sendViaResend = vi.fn();
    const claimMaybeSingle = vi.fn().mockResolvedValue({
      data: { ...sampleOrder, owner_order_paid_notified_at: OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT },
      error: null,
    });
    const itemsEq = vi.fn().mockResolvedValue({
      data: [{ sku: "S", product_title: "P", quantity: 1, unit_price_cents: 100, total_cents: 100 }],
      error: null,
    });
    const releaseUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    });

    let ordersFromCall = 0;
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "notification_logs") {
          return notificationLogsFromMock("nl-test-1", { insertError: { message: "rls" } });
        }
        if (table === "order_items") {
          return { select: () => ({ eq: itemsEq }) };
        }
        if (table !== "orders") return {};
        ordersFromCall += 1;
        if (ordersFromCall === 1) {
          return {
            update: () => ({
              eq: () => ({ eq: () => ({ lt: () => Promise.resolve({ error: null }) }) }),
            }),
          };
        }
        if (ordersFromCall === 2) {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({ select: () => ({ maybeSingle: claimMaybeSingle }) }),
                }),
              }),
            }),
          };
        }
        if (ordersFromCall === 3) {
          return { update: releaseUpdate };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendOwnerOrderPaidNotification({
      admin,
      orderId: "o1",
      stripeEventId: "evt_1",
      stripePaymentIntentId: "pi_1",
      sendViaResend,
    });

    expect(sendViaResend).not.toHaveBeenCalled();
    expect(releaseUpdate).toHaveBeenCalled();
  });

  it("logs and keeps in-flight when Resend ok but final persist fails (retry via stale + Resend idempotency)", async () => {
    const sendViaResend = vi.fn().mockResolvedValue({ ok: true as const, messageId: "re_msg_1" });
    const claimMaybeSingle = vi.fn().mockResolvedValue({
      data: { ...sampleOrder, owner_order_paid_notified_at: OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT },
      error: null,
    });
    const itemsEq = vi.fn().mockResolvedValue({
      data: [{ sku: "S", product_title: "P", quantity: 1, unit_price_cents: 100, total_cents: 100 }],
      error: null,
    });
    const finalizeEq = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const finalizeUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: finalizeEq }) });

    let ordersFromCall = 0;
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "notification_logs") {
          return notificationLogsFromMock();
        }
        if (table === "order_items") {
          return { select: () => ({ eq: itemsEq }) };
        }
        if (table !== "orders") return {};
        ordersFromCall += 1;
        if (ordersFromCall === 1) {
          return {
            update: () => ({
              eq: () => ({ eq: () => ({ lt: () => Promise.resolve({ error: null }) }) }),
            }),
          };
        }
        if (ordersFromCall === 2) {
          return {
            update: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({ select: () => ({ maybeSingle: claimMaybeSingle }) }),
                }),
              }),
            }),
          };
        }
        return { update: finalizeUpdate };
      }),
    } as unknown as SupabaseClient;

    await maybeSendOwnerOrderPaidNotification({
      admin,
      orderId: "o1",
      stripeEventId: "evt_1",
      stripePaymentIntentId: "pi_1",
      sendViaResend,
    });

    expect(sendViaResend).toHaveBeenCalledTimes(1);
    expect(vi.mocked(log.error)).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "owner-order-paid/o1" }),
      expect.stringContaining("could not persist owner_order_paid_notified_at"),
    );
  });
});
