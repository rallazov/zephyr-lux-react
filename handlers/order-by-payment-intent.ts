import { timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ENV, isSupabaseOrderPersistenceConfigured } from "./_lib/env";
import { log } from "./_lib/logger";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

/**
 * Public read for order confirmation: resolves a **paid** order by Stripe PaymentIntent id
 * **and** a server-issued secret (`order_lookup` must match `orders.order_confirmation_key`, timing-safe).
 * Knowing only `pi_…` is insufficient (NFR-SEC-002 / AC3): the key is returned once from
 * `create-payment-intent` and kept in `sessionStorage` for the return journey (`CheckoutPage` → `OrderConfirmation`).
 * Definitive paid state still comes from DB (FR-PAY-002), not browser PI status alone.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const piRaw =
    (typeof req.query.payment_intent === "string" && req.query.payment_intent) ||
    (typeof req.query.payment_intent_id === "string" && req.query.payment_intent_id) ||
    "";
  const paymentIntentId = piRaw.trim();
  if (!paymentIntentId.startsWith("pi_")) {
    return res.status(400).json({ error: "Invalid payment_intent" });
  }

  const lookupRaw =
    (typeof req.query.order_lookup === "string" && req.query.order_lookup) || "";
  const orderLookup = lookupRaw.trim();
  if (orderLookup.length < 32) {
    return res.status(401).json({ error: "Missing or invalid order_lookup" });
  }

  if (!isSupabaseOrderPersistenceConfigured()) {
    return res.status(503).json({ error: "Order lookup not configured" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Order lookup not available" });
  }

  try {
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select(
        "id, order_number, payment_status, customer_email, total_cents, currency, stripe_payment_intent_id, order_confirmation_key",
      )
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (oErr) {
      log.warn({ err: oErr }, "order-by-payment-intent: query error");
      return res.status(500).json({ error: "Lookup failed" });
    }

    const storedKey = order && (order as { order_confirmation_key?: string }).order_confirmation_key;
    if (!order || !lookupKeysEqual(orderLookup, storedKey ?? "")) {
      return res.status(404).json({ error: "Paid order not found" });
    }

    if (order.payment_status !== "paid") {
      return res.status(404).json({ error: "Paid order not found" });
    }

    const { data: lines, error: lErr } = await admin
      .from("order_items")
      .select(
        "sku, product_title, variant_title, quantity, unit_price_cents, total_cents",
      )
      .eq("order_id", order.id);

    if (lErr) {
      log.warn({ err: lErr }, "order-by-payment-intent: items error");
      return res.status(500).json({ error: "Lookup failed" });
    }

    const items = (lines ?? []).map(
      (row: {
        product_title: string;
        variant_title: string | null;
        quantity: number;
        unit_price_cents: number;
      }) => {
        const name = row.variant_title
          ? `${row.product_title} — ${row.variant_title}`
          : row.product_title;
        return {
          name,
          quantity: row.quantity,
          price: row.unit_price_cents / 100,
        };
      },
    );

    return res.status(200).json({
      order_number: order.order_number,
      payment_status: order.payment_status,
      email: order.customer_email,
      total_cents: order.total_cents,
      currency: order.currency,
      payment_intent_id: order.stripe_payment_intent_id,
      items,
    });
  } catch (err: unknown) {
    log.error({ err }, "order-by-payment-intent failed");
    return res.status(500).json({ error: "Lookup failed" });
  }
}

function lookupKeysEqual(provided: string, stored: string): boolean {
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(stored, "utf8");
    if (a.length !== b.length || a.length < 32) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
