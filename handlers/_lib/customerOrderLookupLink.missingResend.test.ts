// @vitest-environment node
/** Missing Resend: DB rollback + notification_log failed row — no outbound email. */

import { describe, expect, it, vi } from "vitest";

const sendViaResendApi = vi.hoisted(() => vi.fn());

vi.mock("./transactionalEmail", () => ({
  sendViaResendApi,
}));

vi.mock("./env", () => ({
  ENV: {
    FRONTEND_URL: "http://localhost:5173",
    RESEND_API_KEY: "",
    RESEND_FROM: "",
    SUPPORT_EMAIL: "help@test.shop",
  },
}));

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { SupabaseClient } from "@supabase/supabase-js";

import { processOrderLookupLinkRequest } from "./customerOrderLookupLink";


describe("processOrderLookupLinkRequest missing Resend", () => {
  it("rolls back lookup token row and inserts failed notification (no outbound email)", async () => {
    sendViaResendApi.mockClear();
    const tokenPayloads: Record<string, unknown>[] = [];
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const queuedFailedRows: Record<string, unknown>[] = [];

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
          insert: vi.fn((insertRow: Record<string, unknown>) => {
            tokenPayloads.push(insertRow);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "tok-row-id" }, error: null }),
              }),
            };
          }),
          delete: vi.fn().mockReturnValue({
            eq: deleteEq,
          }),
        };
      }
      if (table === "notification_logs") {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            queuedFailedRows.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "nf-1" }, error: null }),
              }),
            };
          }),
        };
      }
      return {};
    });

    await processOrderLookupLinkRequest({
      admin: { from } as unknown as SupabaseClient,
      order_number: "ZLX-20260428-0007",
      email: "buyer@example.com",
    });

    expect(sendViaResendApi).not.toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("id", "tok-row-id");
    expect(tokenPayloads.length).toBe(1);
    expect(
      queuedFailedRows.some(
        (r) =>
          r.status === "failed" &&
          r.template === "customer_order_lookup_link" &&
          String(r.error_message).includes("RESEND"),
      ),
    ).toBe(true);
  });
});
