import type { SupabaseClient } from "@supabase/supabase-js";
import { subscriptionPlanRowSchema, type SubscriptionPlanRow } from "../../src/domain/commerce/subscription";

/**
 * Load an active subscription plan with Stripe price linked (Story 8-2 checkout).
 */
export async function fetchActiveSubscriptionPlanForCheckout(args: {
  admin: SupabaseClient;
  planId: string;
}): Promise<{ plan: SubscriptionPlanRow } | { error: "not_found_or_inactive" }> {
  const { admin, planId } = args;

  const { data, error } = await admin
    .from("product_subscription_plans")
    .select(
      `
      id,
      product_id,
      variant_id,
      slug,
      name,
      description,
      stripe_product_id,
      stripe_price_id,
      interval,
      interval_count,
      price_cents,
      currency,
      trial_period_days,
      status
    `
    )
    .eq("id", planId)
    .maybeSingle();

  if (error || !data) {
    return { error: "not_found_or_inactive" };
  }

  let row: SubscriptionPlanRow;
  try {
    row = subscriptionPlanRowSchema.parse(data);
  } catch {
    return { error: "not_found_or_inactive" };
  }

  if (row.status !== "active") {
    return { error: "not_found_or_inactive" };
  }
  if (!row.stripe_price_id || !row.stripe_price_id.trim()) {
    return { error: "not_found_or_inactive" };
  }

  return { plan: row };
}
