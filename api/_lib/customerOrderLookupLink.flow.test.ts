// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

const sendViaResendApi = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true, messageId: "mr_1" }),
);

vi.mock("./transactionalEmail", () => ({
  sendViaResendApi,
}));

vi.mock("./env", () => ({
  ENV: {
    FRONTEND_URL: "http://localhost:5173",
    RESEND_API_KEY: "rk",
    RESEND_FROM: "orders@test.mail",
    SUPPORT_EMAIL: "help@test.shop",
  },
}));

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { hashLookupToken, processOrderLookupLinkRequest } from "./customerOrderLookupLink";

function makePaidOrderAdmin(args: { tokenInsertPayloads: Record<string, unknown>[]; deleteEq?: ReturnType<typeof vi.fn> }) {
  const ordersSingle = vi.fn().mockResolvedValue({
    data: {
      id: "ord-uuid",
      order_number: "ZLX-20260428-0007",
      customer_email: "buyer@example.com",
      payment_status: "paid",
    },
    error: null,
  });

  const recentSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  const tokenInsert = vi.fn((insertRow: Record<string, unknown>) => {
    args.tokenInsertPayloads.push(insertRow);
    return {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "tok-row-id" }, error: null }),
      }),
    };
  });

  const deleteEq = args.deleteEq ?? vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) => {
    if (table === "orders") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: ordersSingle }),
        }),
      };
    }
    if (table === "order_lookup_tokens") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: recentSingle,
                }),
              }),
            }),
          }),
        }),
        insert: tokenInsert,
        delete: vi.fn().mockReturnValue({
          eq: deleteEq,
        }),
      };
    }
    if (table === "notification_logs") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "nlog-uuid" }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [{ id: "nlog-uuid" }], error: null }),
            }),
          }),
        }),
      };
    }
    return {};
  });

  return { admin: { from } as unknown as SupabaseClient, deleteEq };
}

describe("processOrderLookupLinkRequest", () => {
  it("persists SHA-256 token_hash only (never raw token) and sends email via Resend", async () => {
    sendViaResendApi.mockResolvedValueOnce({ ok: true, messageId: "mr_1" });
    const payloads: Record<string, unknown>[] = [];
    const { admin } = makePaidOrderAdmin({ tokenInsertPayloads: payloads });

    await processOrderLookupLinkRequest({
      admin,
      order_number: "ZLX-20260428-0007",
      email: "buyer@example.com",
    });

    expect(payloads.length).toBe(1);
    expect(payloads[0]?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(payloads[0]?.recipient_email).toBe("buyer@example.com");

    expect(sendViaResendApi).toHaveBeenCalled();
    const email = sendViaResendApi.mock.calls[sendViaResendApi.mock.calls.length - 1][0];
    const hrefMatch = String(email.html).match(/href="([^"]+)"/);
    expect(hrefMatch?.[1]).toBeTruthy();
    const href = hrefMatch![1]!;
    const pathStart = href.indexOf("/order-status/");
    expect(pathStart).toBeGreaterThan(-1);
    const opaque = href.slice(pathStart + "/order-status/".length);
    expect(hashLookupToken(decodeURIComponent(opaque))).toBe(payloads[0]?.token_hash);
  });

  it("deletes persisted token row when Resend fails", async () => {
    sendViaResendApi.mockResolvedValueOnce({ ok: false, message: "send failed" });
    const payloads: Record<string, unknown>[] = [];
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const { admin } = makePaidOrderAdmin({ tokenInsertPayloads: payloads, deleteEq });

    await processOrderLookupLinkRequest({
      admin,
      order_number: "ZLX-20260428-0007",
      email: "buyer@example.com",
    });

    expect(payloads.length).toBe(1);
    expect(deleteEq).toHaveBeenCalledWith("id", "tok-row-id");
  });
});
