import { createHash, randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { quoteCartLines, QuoteError } from "./_lib/catalog";
import {
  createPaymentIntentBodySchema,
  lineItemsToCatalogRows,
} from "./_lib/createPaymentIntentBody";
import { ENV, isSupabaseOrderPersistenceConfigured } from "./_lib/env";
import { log } from "./_lib/logger";
import { orderItemRowsFromQuote, PENDING_CHECKOUT_SHIPPING_JSON } from "./_lib/orderSnapshots";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY);

const ORDER_PI_LINK_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function linkOrderToPaymentIntentId(args: {
  admin: SupabaseClient;
  orderId: string;
  paymentIntentId: string;
}): Promise<{ error: { message: string } | null }> {
  const { admin, orderId, paymentIntentId } = args;
  let last: { message: string } | null = null;
  for (let attempt = 0; attempt < ORDER_PI_LINK_RETRIES; attempt++) {
    const { error } = await admin
      .from("orders")
      .update({
        stripe_payment_intent_id: paymentIntentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    if (!error) return { error: null };
    last = { message: error.message };
    if (attempt < ORDER_PI_LINK_RETRIES - 1) await sleep(50 * (attempt + 1));
  }
  return { error: last };
}

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let pendingOrderCleanupId: string | null = null;
  try {
    const parsed = createPaymentIntentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, "create-payment-intent: validation failed");
      return res.status(400).json({ error: "Invalid checkout request" });
    }

    const data = parsed.data;
    const catalogRows = lineItemsToCatalogRows(data.items);

    let quote: ReturnType<typeof quoteCartLines>;
    try {
      quote = quoteCartLines(
        catalogRows.map((r) => ({ sku: r.sku, quantity: r.qty })),
      );
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

    const amount = quote.total_cents;

    if (!isSupabaseOrderPersistenceConfigured()) {
      log.error("create-payment-intent: Supabase service credentials missing");
      return res.status(503).json({
        error: "Checkout persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({ error: "Checkout persistence is not available." });
    }

    const checkoutRef = `cr_${randomBytes(12).toString("hex")}`;
    const orderConfirmationKey = randomBytes(24).toString("hex");

    const emailRaw = (data.email ?? "").trim().slice(0, 256);
    const customerEmail =
      emailRaw.length > 0 ? emailRaw : "pending@checkout.zephyr.local";

    const lineKey = catalogRows
      .map((l) => ({ sku: l.sku, q: l.qty }))
      .sort((a, b) => a.sku.localeCompare(b.sku));
    const lineDigest = createHash("sha256")
      .update(JSON.stringify(lineKey))
      .digest("hex")
      .slice(0, 32);

    const { data: orderNumber, error: numErr } = await admin.rpc("allocate_order_number");
    if (numErr || typeof orderNumber !== "string") {
      log.error({ err: numErr }, "create-payment-intent: allocate_order_number failed");
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }

    let itemRows: ReturnType<typeof orderItemRowsFromQuote>;
    try {
      itemRows = orderItemRowsFromQuote(quote);
    } catch (err) {
      log.error({ err }, "create-payment-intent: snapshot build failed");
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }

    const orderInsert = {
      order_number: orderNumber,
      order_confirmation_key: orderConfirmationKey,
      customer_email: customerEmail,
      payment_status: "pending_payment" as const,
      fulfillment_status: "processing" as const,
      subtotal_cents: quote.subtotal_cents,
      shipping_cents: quote.shipping_cents,
      tax_cents: quote.tax_cents,
      discount_cents: 0,
      total_cents: quote.total_cents,
      currency: quote.currency,
      shipping_address_json: PENDING_CHECKOUT_SHIPPING_JSON,
      stripe_payment_intent_id: null as string | null,
    };

    const { data: orderRow, error: orderErr } = await admin
      .from("orders")
      .insert(orderInsert)
      .select("id")
      .single();

    if (orderErr || !orderRow?.id) {
      log.error({ err: orderErr }, "create-payment-intent: order insert failed");
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }

    const orderId = orderRow.id as string;
    pendingOrderCleanupId = orderId;

    const { error: itemsErr } = await admin.from("order_items").insert(
      itemRows.map((row) => ({
        order_id: orderId,
        sku: row.sku,
        product_title: row.product_title,
        variant_title: row.variant_title,
        size: row.size,
        color: row.color,
        quantity: row.quantity,
        unit_price_cents: row.unit_price_cents,
        total_cents: row.total_cents,
        image_url: row.image_url,
        product_id: row.product_id,
        variant_id: row.variant_id,
      })),
    );

    if (itemsErr) {
      log.error({ err: itemsErr }, "create-payment-intent: order_items insert failed");
      await admin.from("orders").delete().eq("id", orderId);
      pendingOrderCleanupId = null;
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }

    const metadata: Record<string, string> = {
      checkoutRef,
      email: emailRaw.length ? emailRaw : "_",
      line_digest: lineDigest,
      stripe_intent_purpose: "checkout_v1",
      order_id: orderId,
    };

    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.create(
        {
          amount,
          currency: data.currency,
          automatic_payment_methods: { enabled: true },
          metadata,
        },
        { idempotencyKey: `pi_${checkoutRef}` },
      );
    } catch (stripeErr: unknown) {
      log.error({ err: stripeErr }, "create-payment-intent: Stripe PaymentIntent create failed");
      await admin.from("orders").delete().eq("id", orderId);
      pendingOrderCleanupId = null;
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }

    if (!pi.client_secret) {
      log.error(
        { id: pi.id },
        "create-payment-intent: Stripe returned PaymentIntent without client_secret",
      );
      await admin.from("orders").delete().eq("id", orderId);
      pendingOrderCleanupId = null;
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }

    const { error: linkErr } = await linkOrderToPaymentIntentId({
      admin,
      orderId,
      paymentIntentId: pi.id,
    });

    if (linkErr) {
      log.error(
        { err: linkErr, orderId, paymentIntentId: pi.id },
        "create-payment-intent: failed to link PaymentIntent to order after retries",
      );
      try {
        await stripe.paymentIntents.cancel(pi.id);
      } catch (cancelErr) {
        log.warn(
          { err: cancelErr, paymentIntentId: pi.id },
          "create-payment-intent: could not cancel PaymentIntent after link failure",
        );
      }
      await admin.from("orders").delete().eq("id", orderId);
      pendingOrderCleanupId = null;
      return res.status(500).json({ error: "Payment setup failed. Please try again." });
    }

    pendingOrderCleanupId = null;

    log.info(
      {
        checkoutRef,
        orderId,
        amount,
        currency: data.currency,
        paymentIntentId: pi.id,
      },
      "PaymentIntent created (pending order in Supabase)",
    );
    return res.status(200).json({
      clientSecret: pi.client_secret,
      checkoutRef,
      orderId,
      orderLookupKey: orderConfirmationKey,
    });
  } catch (err: unknown) {
    log.error({ err }, "create-payment-intent failed");
    if (pendingOrderCleanupId) {
      const supa = getSupabaseAdmin();
      if (supa) {
        try {
          await supa.from("orders").delete().eq("id", pendingOrderCleanupId);
        } catch (delErr) {
          log.error(
            { err: delErr, orderId: pendingOrderCleanupId },
            "create-payment-intent: failed to delete orphan order after error",
          );
        }
      }
    }
    return res.status(500).json({ error: "Payment setup failed. Please try again." });
  }
}
