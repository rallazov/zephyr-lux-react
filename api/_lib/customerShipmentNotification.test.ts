// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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

import { ENV } from "./env";
import {
  buildCustomerShipmentEmail,
  maybeSendCustomerShipmentNotification,
  type CustomerShipmentNotifyOrderRow,
} from "./customerShipmentNotification";
import { sendViaResendApi } from "./transactionalEmail";

function notificationLogsQueuedMock(logId = "nl-ship-1") {
  return {
    insert: () => ({
      select: () => ({
        single: vi.fn().mockResolvedValue({ data: { id: logId }, error: null }),
      }),
    }),
    update: () => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: [{ id: logId }], error: null })),
        })),
      })),
    }),
  };
}

function notificationLogsInsertFails() {
  return {
    insert: () => ({
      select: () => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "insert_failed" },
        }),
      }),
    }),
  };
}

function shipmentsChain(data: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  };
}

const paidShipped: CustomerShipmentNotifyOrderRow = {
  id: "o-ship",
  order_number: "ZLX-20260426-0900",
  customer_email: "buyer@example.com",
  customer_name: "Taylor",
  payment_status: "paid",
  fulfillment_status: "shipped",
  customer_shipment_notification_sent_at: null,
};

describe("buildCustomerShipmentEmail", () => {
  it("includes carrier, tracking link, and support line when tracking is present", () => {
    const { html, text } = buildCustomerShipmentEmail({
      order_number: "ZLX-1234",
      customer_name: "Pat",
      tracking: {
        carrier: "USPS",
        tracking_number: "9405",
        tracking_url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9405",
      },
    });
    expect(text).toContain("9405");
    expect(html).toContain('href="https://tools.usps.com/go/');
    expect(html).toContain("help@store.example.com");
  });

  it("uses short copy when tracking is unavailable", () => {
    const { text } = buildCustomerShipmentEmail({
      order_number: "ZLX-5678",
      customer_name: null,
      tracking: null,
    });
    expect(text).toContain("marked as shipped");
  });

  it("keeps query strings intact in tracking href (no HTML-entity ampersands in href)", () => {
    const url = "https://tools.usps.com/go/TrackConfirmAction?tLabels=9405&other=1";
    const { html } = buildCustomerShipmentEmail({
      order_number: "ZLX-1",
      customer_name: null,
      tracking: { carrier: null, tracking_number: null, tracking_url: url },
    });
    expect(html).toContain('href="https://tools.usps.com/go/TrackConfirmAction?tLabels=9405&other=1"');
    expect(html).not.toContain("href=&quot;");
  });

  it("does not emit a clickable link for non-http(s) tracking URLs", () => {
    const { html } = buildCustomerShipmentEmail({
      order_number: "ZLX-2",
      customer_name: null,
      tracking: {
        carrier: "X",
        tracking_number: "1",
        tracking_url: "javascript:alert(1)",
      },
    });
    expect(html).not.toContain("<a ");
    expect(html).toContain("javascript:alert(1)");
  });
});

describe("maybeSendCustomerShipmentNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    ENV.RESEND_API_KEY = "re_test";
    ENV.RESEND_FROM = "orders@store.example.com";
  });

  it("queues, sends via Resend, marks sent, and sets customer_shipment_notification_sent_at", async () => {
    const sendMock = vi.fn().mockResolvedValue({ ok: true as const, messageId: "re_ship_1" });
    const orderUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "notification_logs") {
          return notificationLogsQueuedMock();
        }
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: paidShipped, error: null }),
              }),
            }),
            update: orderUpdate,
          };
        }
        if (table === "shipments") {
          return shipmentsChain({
            carrier: "UPS",
            tracking_number: "1Z999",
            tracking_url: "https://www.ups.com/track",
          });
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerShipmentNotification({
      admin: client,
      orderId: "o-ship",
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]?.idempotencyKey).toBe("customer-shipment/o-ship");
    expect(sendMock.mock.calls[0][0]?.subject).toContain("has shipped");

    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_shipment_notification_sent_at: expect.any(String),
      }),
    );
  });

  it("does not send when customer_shipment_notification_sent_at is already set", async () => {
    const sendMock = vi.fn();
    const ord: CustomerShipmentNotifyOrderRow = {
      ...paidShipped,
      customer_shipment_notification_sent_at: "2026-01-01T00:00:00.000Z",
    };
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table !== "orders") return {};
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: ord, error: null }),
            }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerShipmentNotification({
      admin: client,
      orderId: ord.id,
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("inserts terminal failed ledger and skips provider when RESEND_FROM is missing", async () => {
    ENV.RESEND_FROM = "";
    const sendMock = vi.fn();
    let lastInsert: Record<string, unknown> | undefined;
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: paidShipped, error: null }),
              }),
            }),
          };
        }
        if (table === "notification_logs") {
          return {
            insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              lastInsert = payload;
              return {
                select: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "nl-no-from" },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerShipmentNotification({
      admin: client,
      orderId: paidShipped.id,
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });

    expect(lastInsert?.status).toBe("failed");
    expect(String(lastInsert?.error_message)).toContain("RESEND_FROM");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("inserts terminal failed ledger and skips provider when RESEND_API_KEY is missing", async () => {
    ENV.RESEND_API_KEY = "";
    const sendMock = vi.fn();
    let lastInsert: Record<string, unknown> | undefined;
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: paidShipped, error: null }),
              }),
            }),
          };
        }
        if (table === "notification_logs") {
          return {
            insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              lastInsert = payload;
              return {
                select: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "nl-no-key" },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerShipmentNotification({
      admin: client,
      orderId: paidShipped.id,
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });

    expect(lastInsert?.status).toBe("failed");
    expect(lastInsert?.template).toBe("customer_shipment");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("marks queued row failed when Resend rejects — leaves customer_shipment_notification_sent_at unset", async () => {
    const sendMock = vi.fn().mockResolvedValue({
      ok: false as const,
      message: "429 rate limit",
    });
    let orderUpdates = 0;
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "notification_logs") {
          return notificationLogsQueuedMock();
        }
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: paidShipped, error: null }),
              }),
            }),
            update: () => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => {
                  orderUpdates++;
                  return Promise.resolve({ error: null });
                }),
              })),
            }),
          };
        }
        if (table === "shipments") {
          return shipmentsChain(null);
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerShipmentNotification({
      admin: client,
      orderId: paidShipped.id,
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });

    expect(sendMock).toHaveBeenCalled();
    expect(orderUpdates).toBe(0);
  });

  it("records failed ledger for checkout placeholder recipient without contacting Resend", async () => {
    const sendMock = vi.fn();
    const ord = { ...paidShipped, customer_email: "pending@checkout.zephyr.local" };
    let inserted: Record<string, unknown> | undefined;
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: ord, error: null }),
              }),
            }),
          };
        }
        if (table === "notification_logs") {
          return {
            insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              inserted = payload;
              return {
                select: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "nl-bad-email" },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerShipmentNotification({
      admin: client,
      orderId: ord.id,
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });

    expect(inserted?.status).toBe("failed");
    expect(String(inserted?.error_message)).toContain("unsendable");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("skips send when fulfillment_status is not shipped", async () => {
    const sendMock = vi.fn();
    const ord = { ...paidShipped, fulfillment_status: "packed" };

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table !== "orders") return {};
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: ord, error: null }),
            }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerShipmentNotification({
      admin: client,
      orderId: ord.id,
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("skips when customer_email is not a string from the database", async () => {
    const sendMock = vi.fn();
    const ord = { ...paidShipped, customer_email: null as unknown as string };
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table !== "orders") return {};
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: ord, error: null }),
            }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerShipmentNotification({
      admin: client,
      orderId: ord.id,
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does not call Resend when queued insert fails", async () => {
    const sendMock = vi.fn();
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "notification_logs") return notificationLogsInsertFails();
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: paidShipped, error: null }),
              }),
            }),
          };
        }
        if (table === "shipments") {
          return shipmentsChain(null);
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await maybeSendCustomerShipmentNotification({
      admin: client,
      orderId: paidShipped.id,
      sendViaResend: sendMock as unknown as typeof sendViaResendApi,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
