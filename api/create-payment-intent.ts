import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { computeAmountCents } from "./_lib/catalog";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY);

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { items, currency = "usd", email } = req.body as {
      items: Array<{ sku: string; qty: number }>;
      currency?: string; email?: string;
    };
    if (!items?.length) return res.status(400).json({ error: "No items" });

    const amount = computeAmountCents(items);
    const ts = new Date();
    const orderId = `ZLX-${ts.toISOString().slice(0,10).replace(/-/g,"")}-${Math.floor(Math.random()*10000).toString().padStart(4,"0")}`;

    const metadata = { orderId, itemsJSON: JSON.stringify(items), email: email || "" };

    const pi = await stripe.paymentIntents.create({
      amount, currency,
      automatic_payment_methods: { enabled: true },
      metadata,
    }, { idempotencyKey: `pi_${orderId}` });

    log.info({ orderId, amount, currency }, "PaymentIntent created");
    return res.status(200).json({ clientSecret: pi.client_secret, orderId });
  } catch (err: any) {
    log.error({ err }, "create-payment-intent failed");
    return res.status(500).json({ error: err.message });
  }
}


