import { z } from "zod";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { ENV } from "./_lib/env";
import { log } from "./_lib/logger";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import {
  getBearerAuthorizationHeader,
  verifyAdminJwt,
} from "./_lib/verifyAdminJwt";

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY);

const billingPortalBodySchema = z.object({
  stripe_customer_id: z
    .string()
    .trim()
    .regex(/^cus_[a-zA-Z0-9]+$/, "Invalid Stripe customer id"),
});

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

/**
 * Stripe Billing Portal — **admin only**. Requires a `customer_subscriptions` row so arbitrary
 * `cus_*` ids from the open internet cannot open billing sessions. Future customer self-service
 * should use a separate authenticated flow (e.g. magic link + server-side lookup), not this shape.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!ENV.STRIPE_SECRET_KEY.trim()) {
      log.error("create-billing-portal-session: STRIPE_SECRET_KEY missing");
      return res.status(503).json({ error: "Payments are not configured." });
    }

    if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
      log.error("create-billing-portal-session: Supabase env missing for admin JWT verification");
      return res.status(503).json({ error: "Billing portal is not configured." });
    }

    const bearer = getBearerAuthorizationHeader(req.headers.authorization);
    if (!bearer) {
      return res.status(401).json({ error: "Missing Authorization Bearer" });
    }
    const adminUser = await verifyAdminJwt(bearer);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin role required" });
    }

    const parsed = billingPortalBodySchema.safeParse(req.body);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, "create-billing-portal-session: validation failed");
      return res.status(400).json({ error: "Invalid billing portal request" });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Billing portal is not available." });
    }

    const cusId = parsed.data.stripe_customer_id;
    const { data: subRow, error: subErr } = await supabaseAdmin
      .from("customer_subscriptions")
      .select("id")
      .eq("stripe_customer_id", cusId)
      .limit(1)
      .maybeSingle();

    if (subErr) {
      log.warn({ err: subErr, cusId }, "create-billing-portal-session: subscription lookup failed");
      return res.status(500).json({ error: "Billing portal is not available." });
    }
    if (!subRow) {
      log.warn({ cusId, adminUserId: adminUser.userId }, "create-billing-portal-session: unknown customer");
      return res.status(404).json({ error: "No subscription on file for this customer." });
    }

    const returnUrl = `${ENV.FRONTEND_URL.replace(/\/$/, "")}/subscription/checkout/success`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: cusId,
      return_url: returnUrl,
    });

    log.info({ customer: cusId }, "Stripe Billing Portal session created");

    return res.status(200).json({ url: portal.url });
  } catch (err: unknown) {
    log.error({ err }, "create-billing-portal-session failed");
    return res.status(500).json({ error: "Billing portal is not available." });
  }
}
