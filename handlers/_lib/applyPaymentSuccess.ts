import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  markPaymentEventFailed,
  markPaymentEventProcessed,
  type PaymentEventRow,
} from "./paymentEventLedger";
import { applyInventoryForPaidOrder } from "./applyInventoryForPaidOrder";
import { log } from "./logger";
import { paymentIntentMatchesOrderTotals } from "./paymentIntentOrder";
import { maybeSendCustomerOrderConfirmation } from "./customerOrderConfirmation";
import { maybeSendOwnerOrderPaidNotification } from "./ownerOrderNotification";

export type OrderHeaderRow = {
  id: string;
  order_number: string;
  payment_status: string;
  total_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
};

/** `ledger` = payment_events row finalized (processed or terminal failed). `retry` = leave ledger open; webhook should 500 so Stripe retries. */
export type ApplyPaymentIntentSucceededResult =
  | { outcome: "ledger" }
  | { outcome: "retry" };

async function finalizeInventoryAndLedger(args: {
  admin: SupabaseClient;
  orderId: string;
  ledgerRowId: string;
}): Promise<ApplyPaymentIntentSucceededResult> {
  const inv = await applyInventoryForPaidOrder(args.admin, args.orderId);
  if (!inv.ok) {
    return { outcome: "retry" };
  }
  await markPaymentEventProcessed(args.admin, args.ledgerRowId);
  return { outcome: "ledger" };
}

async function finalizeLedgerThenTransactionalEmails(args: {
  admin: SupabaseClient;
  orderId: string;
  ledgerRowId: string;
  pi: Stripe.PaymentIntent;
  stripeEventId: string | undefined;
}): Promise<ApplyPaymentIntentSucceededResult> {
  const result = await finalizeInventoryAndLedger({
    admin: args.admin,
    orderId: args.orderId,
    ledgerRowId: args.ledgerRowId,
  });
  if (result.outcome === "ledger") {
    const eventId = args.stripeEventId ?? "";
    await maybeSendCustomerOrderConfirmation({
      admin: args.admin,
      orderId: args.orderId,
      stripePaymentIntentId: args.pi.id,
      stripeEventId: eventId,
    });
    await maybeSendOwnerOrderPaidNotification({
      admin: args.admin,
      orderId: args.orderId,
      stripePaymentIntentId: args.pi.id,
      stripeEventId: eventId,
    });
  }
  return result;
}

/**
 * Mark a pending order paid when `payment_intent.succeeded` matches totals (idempotent),
 * then apply inventory (4-4) before finalizing the payment_events ledger.
 */
export async function applyPaymentIntentSucceeded(args: {
  admin: SupabaseClient;
  pi: Stripe.PaymentIntent;
  ledgerRow: PaymentEventRow;
  /** Stripe `Event.id` — owner notification logs / correlation (AC3). */
  stripeEventId?: string;
}): Promise<ApplyPaymentIntentSucceededResult> {
  const { admin, pi, ledgerRow, stripeEventId } = args;

  try {
    const order = await loadOrderForPaymentIntent(admin, pi);
    if (!order) {
      return { outcome: "retry" };
    }

    if (!paymentIntentMatchesOrderTotals({
      amountReceivedCents: pi.amount_received,
      currency: pi.currency,
      orderTotalCents: order.total_cents,
      orderCurrency: order.currency,
    })) {
      await markPaymentEventFailed(
        admin,
        ledgerRow.id,
        "PaymentIntent amount/currency does not match order totals",
      );
      return { outcome: "ledger" };
    }

    const emailMeta = (pi.metadata?.email ?? "").toString().trim();
    const patch: Record<string, unknown> = {
      payment_status: "paid",
      updated_at: new Date().toISOString(),
    };
    if (emailMeta && emailMeta !== "_") {
      patch.customer_email = emailMeta.slice(0, 256);
    }
    if (!order.stripe_payment_intent_id) {
      patch.stripe_payment_intent_id = pi.id;
    }

    const { data: updatedRows, error: updErr } = await admin
      .from("orders")
      .update(patch)
      .eq("id", order.id)
      .eq("payment_status", "pending_payment")
      .select("id");

    if (updErr) {
      return { outcome: "retry" };
    }

    if (updatedRows?.length) {
      return finalizeLedgerThenTransactionalEmails({
        admin,
        orderId: order.id,
        ledgerRowId: ledgerRow.id,
        pi,
        stripeEventId,
      });
    }

    const { data: cur } = await admin
      .from("orders")
      .select("payment_status")
      .eq("id", order.id)
      .maybeSingle();
    if (cur && (cur as { payment_status: string }).payment_status === "paid") {
      return finalizeLedgerThenTransactionalEmails({
        admin,
        orderId: order.id,
        ledgerRowId: ledgerRow.id,
        pi,
        stripeEventId,
      });
    }

    return { outcome: "retry" };
  } catch (err) {
    log.error(
      { err, ledgerId: ledgerRow.id },
      "applyPaymentIntentSucceeded: transient error — nack webhook for Stripe retry",
    );
    return { outcome: "retry" };
  }
}

async function loadOrderForPaymentIntent(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
): Promise<OrderHeaderRow | null> {
  const { data: byPi } = await admin
    .from("orders")
    .select("id, order_number, payment_status, total_cents, currency, stripe_payment_intent_id")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();

  if (byPi) return byPi as OrderHeaderRow;

  const orderId = (pi.metadata?.order_id ?? "").toString().trim();
  if (!orderId) return null;

  const { data: byId } = await admin
    .from("orders")
    .select("id, order_number, payment_status, total_cents, currency, stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();

  return (byId as OrderHeaderRow) ?? null;
}
