import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentEventRow = {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  status: "received" | "processed" | "failed" | "ignored";
  payload_hash: string | null;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type ClaimPaymentEventResult =
  | { outcome: "process"; row: PaymentEventRow }
  | { outcome: "skip_ok"; row: PaymentEventRow }
  | { outcome: "busy"; ledgerId: string }
  | { outcome: "error"; detail: string };

function parseRpcClaimPayload(raw: unknown): {
  ledger_id: string | null;
  outcome: string;
  detail?: string;
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("claim_payment_event returned invalid payload");
  }
  const o = raw as Record<string, unknown>;
  const outcome = o.outcome;
  if (typeof outcome !== "string") {
    throw new Error("claim_payment_event missing outcome");
  }
  const lid = o.ledger_id;
  const ledger_id =
    typeof lid === "string" ? lid : lid == null ? null : String(lid);
  const detail = o.detail;
  return {
    outcome,
    ledger_id,
    detail: typeof detail === "string" ? detail : undefined,
  };
}

async function fetchPaymentEventRow(
  admin: SupabaseClient,
  id: string,
): Promise<PaymentEventRow> {
  const sel = await admin.from("payment_events").select("*").eq("id", id).single();
  if (sel.error || !sel.data) {
    throw new Error(sel.error?.message ?? "payment_events fetch after claim failed");
  }
  return sel.data as PaymentEventRow;
}

/**
 * Atomically claim or skip a Stripe webhook event via `public.claim_payment_event`
 * (insert + `FOR UPDATE` + lease). Use outcomes to avoid double side effects for the same `event.id`.
 */
export async function claimPaymentEvent(
  admin: SupabaseClient,
  args: { eventId: string; eventType: string; payloadHash: string },
): Promise<ClaimPaymentEventResult> {
  const { data, error } = await admin.rpc("claim_payment_event", {
    p_provider: "stripe",
    p_provider_event_id: args.eventId,
    p_event_type: args.eventType,
    p_payload_hash: args.payloadHash,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = parseRpcClaimPayload(data);

  if (payload.outcome === "error") {
    return { outcome: "error", detail: payload.detail ?? "unknown" };
  }

  if (payload.outcome === "busy") {
    if (!payload.ledger_id) {
      throw new Error("claim_payment_event busy without ledger_id");
    }
    return { outcome: "busy", ledgerId: payload.ledger_id };
  }

  if (!payload.ledger_id) {
    throw new Error("claim_payment_event missing ledger_id");
  }

  const row = await fetchPaymentEventRow(admin, payload.ledger_id);

  if (payload.outcome === "skip_ok") {
    return { outcome: "skip_ok", row };
  }
  if (payload.outcome === "process") {
    return { outcome: "process", row };
  }

  throw new Error(`unknown claim outcome: ${payload.outcome}`);
}

export async function markPaymentEventProcessed(
  admin: SupabaseClient,
  id: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("payment_events")
    .update({ status: "processed", processed_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markPaymentEventIgnored(admin: SupabaseClient, id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("payment_events")
    .update({ status: "ignored", processed_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markPaymentEventFailed(
  admin: SupabaseClient,
  id: string,
  errorMessage: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("payment_events")
    .update({ status: "failed", error_message: errorMessage, processed_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
