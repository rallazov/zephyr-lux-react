// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./env", () => ({
  ENV: {
    ENABLE_OWNER_PUSH_NOTIFICATIONS: true,
    VAPID_PUBLIC_KEY: "BKxFakePublicKeyMaterialForUnitTestsOnly",
    VAPID_PRIVATE_KEY: "secret",
    VAPID_SUBJECT: "mailto:test@example.com",
  },
  isOwnerPushNotificationsConfigured: () => true,
}));

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const sendNotificationMock = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification(...args: unknown[]) {
      return sendNotificationMock(...args);
    },
  },
}));

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";

/** Minimal fluent client matching chains used by maybeSendOwnerOrderPaidPush + insertNotificationLog + markNotificationLogSent. */
function mockAdminForPushFanout(subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>): SupabaseClient {
  const notificationLogs = {
    insert: () => ({
      select: () => ({
        single: async () => ({ data: { id: "nl-new" }, error: null }),
      }),
    }),
    select: () => makeNotificationLogsSelectChain(),
    update: () => ({
      eq: () => ({
        eq: () => ({
          select: async () => ({ data: [{ id: "nl-new" }], error: null }),
        }),
      }),
    }),
  };

  function makeNotificationLogsSelectChain() {
    const intermediate = {
      eq: (_col: string, val: string) => {
        if (val === "sent") {
          return {
            limit: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          };
        }
        if (val === "queued") {
          return {
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          };
        }
        return intermediate;
      },
    };
    return intermediate;
  }

  return {
    from(table: string) {
      if (table === "owner_push_subscriptions") {
        return {
          select: () => ({
            eq: async () => ({ data: subs, error: null }),
          }),
        };
      }
      if (table === "notification_logs") {
        return notificationLogs;
      }
      return {};
    },
  } as unknown as SupabaseClient;
}

describe("maybeSendOwnerOrderPaidPush", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendNotificationMock.mockReset();
    sendNotificationMock.mockResolvedValue(undefined);
  });

  it("does not call web-push when there are no active subscriptions", async () => {
    const { maybeSendOwnerOrderPaidPush } = await import("./ownerPushSend");
    await maybeSendOwnerOrderPaidPush({
      admin: mockAdminForPushFanout([]),
      orderId: ORDER_ID,
      orderNumber: "ZLX-1",
      totalCents: 100,
      currency: "usd",
    });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("fans out web-push to each active subscription", async () => {
    const { maybeSendOwnerOrderPaidPush } = await import("./ownerPushSend");
    const admin = mockAdminForPushFanout([
      { id: "s1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
      { id: "s2", endpoint: "https://push.example/2", p256dh: "p2", auth: "a2" },
    ]);
    await maybeSendOwnerOrderPaidPush({
      admin,
      orderId: ORDER_ID,
      orderNumber: "ZLX-9",
      totalCents: 2500,
      currency: "usd",
    });
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    const firstBody = String(sendNotificationMock.mock.calls[0]?.[1] ?? "");
    expect(firstBody).toContain("ZLX-9");
    expect(firstBody).not.toContain("@");
  });
});
