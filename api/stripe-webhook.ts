import type { VercelRequest, VercelResponse } from "@vercel/node";
import getRawBody from "raw-body";
import Stripe from "stripe";
import { findVariantBySku } from "./_lib/catalog";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";
import { getStore } from "./_lib/store";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  let event: Stripe.Event;
  try {
    const raw = await getRawBody(req);
    const sig = req.headers["stripe-signature"] as string;
    event = stripe.webhooks.constructEvent(raw, sig, ENV.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    log.error({ err }, "Webhook signature verification failed");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const store = getStore();
  const firstTime = await store.markEventProcessed(event.id);
  if (!firstTime) {
    log.warn({ id: event.id }, "Duplicate webhook event");
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = (pi.metadata?.orderId || "").toString();
        const items = JSON.parse(pi.metadata?.itemsJSON || "[]") as { sku: string; qty: number }[];
        const lineItems = items.map(({ sku, qty }) => {
          const hit = findVariantBySku(sku);
          const unitPrice = hit?.variant.price ?? 0;
          return { sku, qty, unitPrice };
        });
        const order = {
          orderId,
          email: (pi.metadata?.email || "").toString(),
          total: pi.amount_received / 100,
          currency: pi.currency,
          lineItems,
          paymentIntentId: pi.id,
          status: "paid" as const,
          createdAt: new Date().toISOString(),
        };
        await store.recordOrder(order);
        await store.decrementInventory(items);
        log.info({ orderId }, "Order recorded");
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        log.warn({ pi: pi.id, reason: pi.last_payment_error?.message }, "Payment failed");
        break;
      }
      default:
        log.info({ type: event.type }, "Unhandled event");
    }
    return res.status(200).json({ received: true });
  } catch (err: any) {
    log.error({ err, type: event.type }, "Webhook handler error");
    return res.status(500).send("Webhook handler error");
  }
}


