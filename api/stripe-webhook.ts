import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import getRawBody from "raw-body";
import Stripe from "stripe";
import { applyPaymentIntentSucceeded } from "./_lib/applyPaymentSuccess";
import { ENV, isSupabaseOrderPersistenceConfigured } from "./_lib/env";
import { log } from "./_lib/logger";
import {
  claimPaymentEvent,
  markPaymentEventIgnored,
  markPaymentEventProcessed,
  markPaymentEventFailed,
} from "./_lib/paymentEventLedger";
import { sanitizeWebhookErrorMessage } from "./_lib/paymentIntentOrder";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY);

function payloadHashFromRaw(raw: Buffer): string {
  return createHash("sha256").update(raw).digest("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  let raw: Buffer;
  let event: Stripe.Event;
  try {
    raw = await getRawBody(req);
    const sig = req.headers["stripe-signature"] as string;
    event = stripe.webhooks.constructEvent(raw, sig, ENV.STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    log.error({ err }, "Webhook signature verification failed");
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).send(`Webhook Error: ${msg}`);
  }

  if (!isSupabaseOrderPersistenceConfigured()) {
    log.error("stripe-webhook: Supabase not configured — refusing to ack without durable ledger");
    return res.status(503).send("Server misconfiguration: Supabase required for webhooks");
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).send("Server misconfiguration: Supabase client unavailable");
  }

  const payloadHash = payloadHashFromRaw(raw);

  let claimed;
  try {
    claimed = await claimPaymentEvent(admin, {
      eventId: event.id,
      eventType: event.type,
      payloadHash,
    });
  } catch (err: unknown) {
    log.error({ err, eventId: event.id }, "claim_payment_event failed");
    return res.status(500).send("Ledger persistence failed");
  }

  if (claimed.outcome === "error") {
    log.error({ eventId: event.id, detail: claimed.detail }, "claim_payment_event error outcome");
    return res.status(500).send("Ledger persistence failed");
  }

  if (claimed.outcome === "busy") {
    log.warn(
      { eventId: event.id, ledgerId: claimed.ledgerId },
      "payment_events lease busy — Stripe should retry",
    );
    return res.status(503).send("Event processing in progress");
  }

  if (claimed.outcome === "skip_ok") {
    log.warn({ id: event.id }, "Duplicate webhook event (already finalized)");
    return res.status(200).json({ received: true, duplicate: true });
  }

  const ledger = { row: claimed.row };

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const applied = await applyPaymentIntentSucceeded({ admin, pi, ledgerRow: ledger.row });
        if (applied.outcome === "retry") {
          log.warn(
            { eventId: event.id, paymentIntentId: pi.id, orderId: pi.metadata?.order_id },
            "payment_intent.succeeded: order not marked paid (transient) — nack for Stripe retry",
          );
          return res.status(500).send("Order payment not committed — will retry");
        }
        log.info(
          { eventId: event.id, paymentIntentId: pi.id, orderId: pi.metadata?.order_id },
          "payment_intent.succeeded handled",
        );
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        log.warn(
          { eventId: event.id, pi: pi.id, reason: pi.last_payment_error?.message },
          "Payment failed",
        );
        await markPaymentEventProcessed(admin, ledger.row.id);
        break;
      }
      default: {
        log.info({ type: event.type, eventId: event.id }, "Unhandled event — marking ignored");
        await markPaymentEventIgnored(admin, ledger.row.id);
      }
    }
    return res.status(200).json({ received: true });
  } catch (err: unknown) {
    log.error({ err, type: event.type, eventId: event.id }, "Webhook handler error");
    try {
      await markPaymentEventFailed(admin, ledger.row.id, sanitizeWebhookErrorMessage(err));
    } catch (e) {
      log.error({ err: e }, "Could not mark payment_event failed");
    }
    return res.status(500).send("Webhook handler error");
  }
}
