import { randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createSubscriptionCheckoutBodySchema } from "./_lib/subscriptionCheckoutBody";
import { fetchActiveSubscriptionPlanForCheckout } from "./_lib/subscriptionPlanCheckout";
import { ENV, isSupabaseOrderPersistenceConfigured } from "./_lib/env";
import { log } from "./_lib/logger";
import { isUnsendableCustomerEmail } from "./_lib/customerOrderConfirmation";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

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
    const parsed = createSubscriptionCheckoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, "create-subscription-checkout-session: validation failed");
      return res.status(400).json({ error: "Invalid subscription checkout request" });
    }

    const data = parsed.data;

    if (!ENV.STRIPE_SECRET_KEY.trim()) {
      log.error("create-subscription-checkout-session: STRIPE_SECRET_KEY missing");
      return res.status(503).json({ error: "Payments are not configured." });
    }

    if (!isSupabaseOrderPersistenceConfigured()) {
      log.error("create-subscription-checkout-session: Supabase service credentials missing");
      return res
        .status(503)
        .json({ error: "Subscription checkout is not configured on the server." });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({ error: "Subscription checkout is not available." });
    }

    const emailRaw = data.email.trim();
    if (!emailRaw || isUnsendableCustomerEmail(emailRaw)) {
      return res.status(400).json({ error: "A valid email is required to start subscription checkout." });
    }

    const loaded = await fetchActiveSubscriptionPlanForCheckout({
      admin,
      planId: data.plan_id,
    });
    if ("error" in loaded) {
      log.warn({ plan_id: data.plan_id }, "create-subscription-checkout-session: inactive or unknown plan");
      return res.status(400).json({ error: "This subscription option is no longer available." });
    }

    const { plan } = loaded;
    const checkoutRef = `sub_ck_${randomBytes(12).toString("hex")}`;
    const successUrl = `${ENV.FRONTEND_URL.replace(/\/$/, "")}/subscription/checkout/success?checkout=done`;
    const cancelUrl = `${ENV.FRONTEND_URL.replace(/\/$/, "")}/subscription/checkout/canceled`;

    const md: Record<string, string> = {
      subscription_checkout_v1: "true",
      plan_id: plan.id,
      product_id: plan.product_id,
      variant_id: plan.variant_id ?? "",
    };

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: checkoutRef,
          customer_email: emailRaw,
          line_items: [
            {
              price: plan.stripe_price_id ?? "",
              quantity: 1,
            },
          ],
          metadata: md,
          subscription_data:
            plan.trial_period_days && plan.trial_period_days > 0
              ? { trial_period_days: plan.trial_period_days }
              : undefined,
          allow_promotion_codes: false,
          billing_address_collection: "required",
        },
        {
          idempotencyKey: `sub_cs_${checkoutRef}`,
        },
      );

      const url = session.url;
      if (!url) {
        log.error({ id: session.id }, "create-subscription-checkout-session: Stripe session missing URL");
        return res.status(500).json({ error: "Checkout could not be started." });
      }

      log.info(
        {
          checkoutRef,
          sessionId: session.id,
          planId: plan.id,
        },
        "Stripe Checkout Session created for subscription",
      );

      return res.status(200).json({
        checkoutRef,
        checkoutSessionId: session.id,
        url,
      });
    } catch (stripeErr: unknown) {
      log.error({ err: stripeErr }, "create-subscription-checkout-session: Stripe Checkout create failed");
      return res.status(500).json({ error: "Checkout could not be started." });
    }
  } catch (err: unknown) {
    log.error({ err }, "create-subscription-checkout-session failed");
    return res.status(500).json({ error: "Checkout could not be started." });
  }
}
