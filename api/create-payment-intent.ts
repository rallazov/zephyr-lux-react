import { createHash, randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { QuoteError } from "./_lib/catalog";
import { totalChargeCentsFromCatalogLines } from "./_lib/checkoutQuote";
import {
  createPaymentIntentBodySchema,
  lineItemsToCatalogRows,
} from "./_lib/createPaymentIntentBody";
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
    const parsed = createPaymentIntentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, "create-payment-intent: validation failed");
      return res.status(400).json({ error: "Invalid checkout request" });
    }

    const data = parsed.data;
    const catalogRows = lineItemsToCatalogRows(data.items);

    let amount: number;
    try {
      amount = totalChargeCentsFromCatalogLines(catalogRows);
    } catch (err) {
      if (err instanceof QuoteError) {
        log.warn({ err, code: err.code }, "create-payment-intent: quote error");
        return res.status(400).json({
          error:
            "One or more items are no longer available. Please return to your cart and try again.",
        });
      }
      log.error({ err }, "create-payment-intent: unexpected catalog pricing failure");
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }

    const checkoutRef = `cr_${randomBytes(12).toString("hex")}`;

    const email = (data.email ?? "").trim().slice(0, 256);
    const metadata: Record<string, string> = {
      checkoutRef,
      email: email.length ? email : "_",
    };

    const lineKey = catalogRows
      .map((l) => ({ sku: l.sku, q: l.qty }))
      .sort((a, b) => a.sku.localeCompare(b.sku));
    const lineDigest = createHash("sha256").update(JSON.stringify(lineKey)).digest("hex").slice(0, 32);
    metadata.line_digest = lineDigest;

    metadata.stripe_intent_purpose = "checkout_v1";

    const pi = await stripe.paymentIntents.create(
      {
        amount,
        currency: data.currency,
        automatic_payment_methods: { enabled: true },
        metadata,
      },
      { idempotencyKey: `pi_${checkoutRef}` }
    );

    if (!pi.client_secret) {
      log.error({ id: pi.id }, "create-payment-intent: Stripe returned PaymentIntent without client_secret");
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }

    log.info(
      { checkoutRef, amount, currency: data.currency, paymentIntentId: pi.id },
      "PaymentIntent created"
    );
    return res.status(200).json({ clientSecret: pi.client_secret, checkoutRef });
  } catch (err: unknown) {
    log.error({ err }, "create-payment-intent failed");
    return res.status(500).json({ error: "Payment setup failed. Please try again." });
  }
}
