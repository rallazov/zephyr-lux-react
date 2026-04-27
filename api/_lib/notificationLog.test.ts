// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "./logger";

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  insertNotificationLog,
  markNotificationLogFailed,
  markNotificationLogSent,
  NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID,
} from "./notificationLog";

function mockLogsTable(options?: { markRows: { id: string }[] | null }) {
  const insertSingle = vi.fn();
  const markRows = options?.markRows ?? [{ id: "log-1" }];
  return {
    insertSingle,
    fromHandler(table: string) {
      if (table !== "notification_logs") return null;
      return {
        insert: () => ({
          select: () => ({
            single: insertSingle,
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () =>
                Promise.resolve({
                  data: markRows,
                  error: null,
                }),
            }),
          }),
        }),
      };
    },
  };
}

describe("notificationLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("insertNotificationLog returns id for queued row", async () => {
    const t = mockLogsTable();
    t.insertSingle.mockResolvedValue({ data: { id: "a1b2c3" }, error: null });
    const admin = {
      from: vi.fn((name: string) => t.fromHandler(name) ?? {}),
    } as unknown as SupabaseClient;

    const r = await insertNotificationLog(admin, {
      order_id: "ord-1",
      recipient: "a@b.com",
      channel: "email",
      template: NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID,
      status: "queued",
    });
    expect(r).toEqual({ ok: true, id: "a1b2c3" });
  });

  it("markNotificationLogSent updates queued row to sent with provider_message_id", async () => {
    const t = mockLogsTable();
    const admin = {
      from: vi.fn((name: string) => t.fromHandler(name) ?? {}),
    } as unknown as SupabaseClient;

    const ok = await markNotificationLogSent(admin, "log-1", { provider_message_id: "re_abc" });
    expect(ok).toBe(true);
  });

  it("markNotificationLogFailed records error on queued row", async () => {
    const t = mockLogsTable();
    const admin = {
      from: vi.fn((name: string) => t.fromHandler(name) ?? {}),
    } as unknown as SupabaseClient;

    const ok = await markNotificationLogFailed(admin, "log-2", "Resend 422");
    expect(ok).toBe(true);
  });

  it("markNotificationLogSent returns false when update matches no rows", async () => {
    const t = mockLogsTable({ markRows: [] });
    const admin = {
      from: vi.fn((name: string) => t.fromHandler(name) ?? {}),
    } as unknown as SupabaseClient;

    const ok = await markNotificationLogSent(admin, "missing", { provider_message_id: "re_x" });
    expect(ok).toBe(false);
    expect(vi.mocked(log.error)).toHaveBeenCalled();
  });

  it("append-only: two queued inserts are independent rows (repeated logical attempts)", async () => {
    const insertSingle = vi.fn();
    insertSingle
      .mockResolvedValueOnce({ data: { id: "first" }, error: null })
      .mockResolvedValueOnce({ data: { id: "second" }, error: null });
    const admin = {
      from: vi.fn(() => ({
        insert: () => ({
          select: () => ({ single: insertSingle }),
        }),
      })),
    } as unknown as SupabaseClient;

    const r1 = await insertNotificationLog(admin, {
      order_id: "o1",
      recipient: "x@y.com",
      channel: "email",
      template: NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID,
      status: "queued",
    });
    const r2 = await insertNotificationLog(admin, {
      order_id: "o1",
      recipient: "x@y.com",
      channel: "email",
      template: NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID,
      status: "queued",
    });
    expect(r1).toEqual({ ok: true, id: "first" });
    expect(r2).toEqual({ ok: true, id: "second" });
    expect(insertSingle).toHaveBeenCalledTimes(2);
  });

  it("insertNotificationLog returns ok false and logs when insert errors", async () => {
    const insertSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "rls" } });
    const admin = {
      from: vi.fn(() => ({
        insert: () => ({
          select: () => ({ single: insertSingle }),
        }),
      })),
    } as unknown as SupabaseClient;

    const r = await insertNotificationLog(admin, {
      order_id: null,
      recipient: "a@b.com",
      channel: "email",
      template: "t",
      status: "failed",
      error_message: "x",
    });
    expect(r).toEqual({ ok: false });
    expect(vi.mocked(log.error)).toHaveBeenCalled();
  });
});
