// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimPaymentEvent, type PaymentEventRow } from "./paymentEventLedger";

function baseRow(overrides: Partial<PaymentEventRow> = {}): PaymentEventRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    provider: "stripe",
    provider_event_id: "evt_1",
    event_type: "payment_intent.succeeded",
    status: "received",
    payload_hash: "h",
    processed_at: null,
    error_message: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function clientWithClaim(
  rpcReturn: { data: unknown; error: { message: string } | null },
  row: PaymentEventRow,
): SupabaseClient {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  return {
    rpc: vi.fn().mockResolvedValue(rpcReturn),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("claimPaymentEvent", () => {
  it("returns process with row after RPC process", async () => {
    const row = baseRow();
    const client = clientWithClaim(
      {
        data: { ledger_id: row.id, outcome: "process" },
        error: null,
      },
      row,
    );

    const got = await claimPaymentEvent(client, {
      eventId: "evt_1",
      eventType: "payment_intent.succeeded",
      payloadHash: "h",
    });
    expect(got.outcome).toBe("process");
    if (got.outcome === "process") {
      expect(got.row.id).toBe(row.id);
      expect(got.row.status).toBe("received");
    }
    expect(client.rpc).toHaveBeenCalledWith("claim_payment_event", {
      p_provider: "stripe",
      p_provider_event_id: "evt_1",
      p_event_type: "payment_intent.succeeded",
      p_payload_hash: "h",
    });
  });

  it("returns skip_ok with row for finalized duplicate (processed)", async () => {
    const row = baseRow({
      id: "00000000-0000-4000-8000-000000000002",
      status: "processed",
      processed_at: new Date().toISOString(),
    });
    const client = clientWithClaim(
      {
        data: { ledger_id: row.id, outcome: "skip_ok" },
        error: null,
      },
      row,
    );

    const got = await claimPaymentEvent(client, {
      eventId: "evt_dup",
      eventType: "payment_intent.succeeded",
      payloadHash: "h",
    });
    expect(got.outcome).toBe("skip_ok");
    if (got.outcome === "skip_ok") {
      expect(got.row.status).toBe("processed");
    }
  });

  it("returns skip_ok with row for ignored replay", async () => {
    const row = baseRow({
      id: "00000000-0000-4000-8000-000000000003",
      status: "ignored",
      processed_at: new Date().toISOString(),
    });
    const client = clientWithClaim(
      {
        data: { ledger_id: row.id, outcome: "skip_ok" },
        error: null,
      },
      row,
    );

    const got = await claimPaymentEvent(client, {
      eventId: "evt_noise",
      eventType: "customer.created",
      payloadHash: "h2",
    });
    expect(got.outcome).toBe("skip_ok");
    if (got.outcome === "skip_ok") {
      expect(got.row.status).toBe("ignored");
    }
  });

  it("returns busy without loading row", async () => {
    const busyId = "00000000-0000-4000-8000-000000000099";
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: { ledger_id: busyId, outcome: "busy" },
        error: null,
      }),
      from: vi.fn(),
    } as unknown as SupabaseClient;

    const got = await claimPaymentEvent(client, {
      eventId: "evt_concurrent",
      eventType: "payment_intent.succeeded",
      payloadHash: "h",
    });
    expect(got.outcome).toBe("busy");
    if (got.outcome === "busy") {
      expect(got.ledgerId).toBe(busyId);
    }
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns error when RPC reports row_missing", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: { ledger_id: null, outcome: "error", detail: "row_missing" },
        error: null,
      }),
      from: vi.fn(),
    } as unknown as SupabaseClient;

    const got = await claimPaymentEvent(client, {
      eventId: "evt_bad",
      eventType: "payment_intent.succeeded",
      payloadHash: "h",
    });
    expect(got.outcome).toBe("error");
    if (got.outcome === "error") {
      expect(got.detail).toBe("row_missing");
    }
    expect(client.from).not.toHaveBeenCalled();
  });

  it("throws when PostgREST returns an error", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "permission denied" },
      }),
      from: vi.fn(),
    } as unknown as SupabaseClient;

    await expect(
      claimPaymentEvent(client, {
        eventId: "evt_x",
        eventType: "payment_intent.succeeded",
        payloadHash: "h",
      }),
    ).rejects.toThrow("permission denied");
  });

  it("after failed retry, process outcome loads row in received state", async () => {
    const row = baseRow({
      id: "00000000-0000-4000-8000-000000000004",
      status: "received",
      error_message: null,
    });
    const client = clientWithClaim(
      {
        data: { ledger_id: row.id, outcome: "process" },
        error: null,
      },
      row,
    );

    const got = await claimPaymentEvent(client, {
      eventId: "evt_retry",
      eventType: "payment_intent.succeeded",
      payloadHash: "h",
    });
    expect(got.outcome).toBe("process");
  });
});
