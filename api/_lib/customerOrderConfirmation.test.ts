// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./env", () => ({
  ENV: {
    NODE_ENV: "test",
    FRONTEND_URL: "https://store.example.com",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    RESEND_API_KEY: "re_test",
    RESEND_FROM: "orders@store.example.com",
    OWNER_NOTIFICATION_EMAIL: "",
    SUPPORT_EMAIL: "help@store.example.com",
    STORE_BACKEND: "auto",
    VERCEL_BLOB_RW_TOKEN: "",
    LOG_LEVEL: "info",
  },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildCustomerOrderConfirmationEmail,
  isPendingCheckoutShippingAddress,
  isUnsendableCustomerEmail,
  maybeSendCustomerOrderConfirmation,
} from "./customerOrderConfirmation";
import { PENDING_CHECKOUT_SHIPPING_JSON } from "./orderSnapshots";
import { sendViaResendApi } from "./transactionalEmail";

function notificationLogsFromMock(
  logId = "nl-cust-1",
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

describe("customerOrderConfirmation helpers", () => {
  it("flags placeholder checkout email as unsendable", () => {
    expect(isUnsendableCustomerEmail("pending@checkout.zephyr.local")).toBe(true);
    expect(isUnsendableCustomerEmail("  Pending@CHECKOUT.zephyr.local  ")).toBe(true);
    expect(isUnsendableCustomerEmail("ok@example.com")).toBe(false);
  });

  it("detects pending shipping snapshot", () => {
    expect(isPendingCheckoutShippingAddress(PENDING_CHECKOUT_SHIPPING_JSON)).toBe(true);
    expect(
      isPendingCheckoutShippingAddress({
        line1: "123 Main",
        city: "NYC",
        state: "NY",
        postal_code: "10001",
        country: "US",
      }),
    ).toBe(false);
  });
});

describe("buildCustomerOrderConfirmationEmail", () => {
  it("embeds order number, lines, and support line in HTML", () => {
    const { subject, html, text } = buildCustomerOrderConfirmationEmail({
      order: {
        order_number: "ZLX-20260426-0001",
        customer_name: "Pat",
        total_cents: 12050,
        currency: "usd",
        shipping_address_json: {
          line1: "1 Test Way",
          city: "Austin",
          state: "TX",
          postal_code: "78701",
          country: "US",
        },
      },
      items: [
        {
          sku: "ZLX-BLK-S",
          product_title: "Crew",
          variant_title: "S / Black",
          quantity: 1,
          unit_price_cents: 12000,
          total_cents: 12000,
        },
      ],
    });
    expect(subject).toBe("Order confirmed — ZLX-20260426-0001");
    expect(html).toContain("ZLX-20260426-0001");
    expect(html).toContain("Crew (S / Black)");
    expect(html).toContain("ZLX-BLK-S");
    expect(text).toContain("help@store.example.com");
  });
});

describe("maybeSendCustomerOrderConfirmation", () => {
  it("does not call Resend when customer_confirmation_sent_at is already set", async () => {
    const sendMock = vi.fn().mockResolvedValue({ ok: true as const, messageId: "re_cust_1" });
    const order = {
      id: "o1",
      order_number: "ZLX-1",
      customer_email: "c@x.com",
      customer_name: "C",
      total_cents: 100,
      currency: "usd",
      shipping_address_json: { line1: "a", city: "b", state: "c", postal_code: "d", country: "US" },
      payment_status: "paid",
      customer_confirmation_sent_at: "2026-01-01T00:00:00.000Z",
    };

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: order, error: null }),
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerOrderConfirmation({
      admin: client,
      orderId: "o1",
      stripeEventId: "evt_1",
      stripePaymentIntentId: "pi_1",
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends once when marker is null", async () => {
    const sendMock = vi.fn().mockResolvedValue({ ok: true as const, messageId: "re_cust_1" });
    const order = {
      id: "o1",
      order_number: "ZLX-1",
      customer_email: "c@x.com",
      customer_name: "C",
      total_cents: 100,
      currency: "usd",
      shipping_address_json: { line1: "a", city: "b", state: "c", postal_code: "d", country: "US" },
      payment_status: "paid",
      customer_confirmation_sent_at: null,
    };
    const items = [
      {
        sku: "S",
        product_title: "P",
        variant_title: null,
        quantity: 1,
        unit_price_cents: 100,
        total_cents: 100,
      },
    ];

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "notification_logs") {
          return notificationLogsFromMock();
        }
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: order, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ is: vi.fn().mockResolvedValue({ error: null }) }),
            }),
          };
        }
        if (table === "order_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: items, error: null }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerOrderConfirmation({
      admin: client,
      orderId: "o1",
      stripeEventId: "evt_1",
      stripePaymentIntentId: "pi_1",
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "customer-confirmation/o1",
      }),
    );
  });

  it("skips Resend when notification_logs insert (queued) fails — marker stays null for retry", async () => {
    const sendMock = vi.fn();
    const order = {
      id: "o1",
      order_number: "ZLX-1",
      customer_email: "c@x.com",
      customer_name: "C",
      total_cents: 100,
      currency: "usd",
      shipping_address_json: { line1: "a", city: "b", state: "c", postal_code: "d", country: "US" },
      payment_status: "paid",
      customer_confirmation_sent_at: null,
    };
    const items = [
      {
        sku: "S",
        product_title: "P",
        variant_title: null,
        quantity: 1,
        unit_price_cents: 100,
        total_cents: 100,
      },
    ];
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ is: vi.fn().mockResolvedValue({ error: null }) }),
    });
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "notification_logs") {
          return notificationLogsFromMock("nl-cust-1", { insertError: { message: "db" } });
        }
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: order, error: null }),
              }),
            }),
            update: updateSpy,
          };
        }
        if (table === "order_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: items, error: null }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerOrderConfirmation({
      admin: client,
      orderId: "o1",
      stripeEventId: "evt_1",
      stripePaymentIntentId: "pi_1",
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });
    expect(sendMock).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
