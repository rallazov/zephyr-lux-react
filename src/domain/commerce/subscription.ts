import { z } from "zod";
import { iso4217CurrencySchema } from "./enums";

export const subscriptionPlanIntervalSchema = z.enum([
  "day",
  "week",
  "month",
  "year",
]);

export const subscriptionPlanStatusSchema = z.enum([
  "draft",
  "active",
  "archived",
]);

/** Stripe Billing Price id when non-null (Stripe-prefixed id). */
export const stripeBillingPriceIdSchema = z
  .string()
  .min(1)
  .regex(/^price_[a-zA-Z0-9_]+$/, "Expected a Stripe price id (price_…)");

/** Stripe Product id when present. */
export const stripeBillingProductIdSchema = z
  .string()
  .min(1)
  .regex(/^prod_[a-zA-Z0-9_]+$/, "Expected a Stripe product id (prod_…)");

/** DB row aligned with `product_subscription_plans` (validated on server/API boundary). */
export const subscriptionPlanRowSchema = z
  .object({
    id: z.string().uuid(),
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().nullable(),
    slug: z
      .string()
      .min(1)
      .refine((s) => s === s.trim() && s === s.toLowerCase(), "slug must be lowercase and trimmed"),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    stripe_product_id: z.string().nullable().optional(),
    stripe_price_id: z.string().nullable(),
    interval: subscriptionPlanIntervalSchema,
    interval_count: z.number().int().positive(),
    price_cents: z.number().int().nonnegative(),
    currency: iso4217CurrencySchema,
    trial_period_days: z.number().int().nonnegative().nullable().optional(),
    status: subscriptionPlanStatusSchema,
  })
  .superRefine((row, ctx) => {
    if (row.stripe_price_id != null && row.stripe_price_id.trim() !== "") {
      const r = stripeBillingPriceIdSchema.safeParse(row.stripe_price_id.trim());
      if (!r.success) {
        r.error.issues.forEach((i) => ctx.addIssue({ ...i, path: ["stripe_price_id"] }));
      }
    }
    if (row.stripe_product_id != null && row.stripe_product_id.trim() !== "") {
      const r = stripeBillingProductIdSchema.safeParse(row.stripe_product_id.trim());
      if (!r.success) {
        r.error.issues.forEach((i) => ctx.addIssue({ ...i, path: ["stripe_product_id"] }));
      }
    }
    if (row.status === "active") {
      const r = stripeBillingPriceIdSchema.safeParse(row.stripe_price_id ?? "");
      if (!r.success) {
        r.error.issues.forEach((i) => ctx.addIssue({ ...i, path: ["stripe_price_id"] }));
      }
    }
  });

export type SubscriptionPlanRow = z.infer<typeof subscriptionPlanRowSchema>;

/**
 * PDP/list surface — excludes Stripe Billing IDs (checkout uses opaque `plan_id` only).
 */
export type SubscriptionPlanPublic = {
  id: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  description: string | null;
  interval: z.infer<typeof subscriptionPlanIntervalSchema>;
  intervalCount: number;
  priceCents: number;
  currency: string;
  trialPeriodDays: number | null;
};

/** PostgREST embed row shape for `product_subscription_plans` (drift guard with migration). */
export type SubscriptionPlanEmbedRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  interval: z.infer<typeof subscriptionPlanIntervalSchema>;
  interval_count: number;
  price_cents: number;
  currency: string;
  stripe_price_id: string | null;
  trial_period_days: number | null;
  status: z.infer<typeof subscriptionPlanStatusSchema>;
};

/**
 * Storefront purchasable plans: `active` and non-empty Stripe price id (matches PostgREST embed → PDP).
 */
export function subscriptionPlansPurchasableFromEmbed(
  rows: SubscriptionPlanEmbedRow[] | undefined | null,
): SubscriptionPlanPublic[] {
  const raw = rows ?? [];
  const out: SubscriptionPlanPublic[] = [];
  for (const r of raw) {
    if (r.status !== "active") continue;
    if (!r.stripe_price_id?.trim()) continue;
    out.push({
      id: r.id,
      productId: r.product_id,
      variantId: r.variant_id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      interval: r.interval,
      intervalCount: r.interval_count,
      priceCents: r.price_cents,
      currency: r.currency,
      trialPeriodDays: r.trial_period_days,
    });
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

export function subscriptionPlanCadenceLabel(
  interval: SubscriptionPlanPublic["interval"],
  intervalCount: number
): string {
  const n = intervalCount;
  if (interval === "day") {
    return n === 1 ? "every day" : `every ${n} days`;
  }
  if (interval === "week") {
    return n === 1 ? "every week" : `every ${n} weeks`;
  }
  if (interval === "month") {
    return n === 1 ? "every month" : `every ${n} months`;
  }
  return n === 1 ? "every year" : `every ${n} years`;
}

/** Plans scoped to PDP selection (Story 8-2 AC1 variant vs product-wide rows). */
export function subscriptionPlansForVariant(
  plans: SubscriptionPlanPublic[] | undefined | null,
  variantId: string | undefined | null,
): SubscriptionPlanPublic[] {
  const list = plans ?? [];
  return list.filter(
    (p) => p.variantId == null || (Boolean(variantId) && p.variantId === variantId),
  );
}

/** DB `customer_subscription_status` — Stripe subscription lifecycle mirror (Story 8-3). */
export const customerSubscriptionStatusSchema = z.enum([
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);

export type CustomerSubscriptionStatus = z.infer<typeof customerSubscriptionStatusSchema>;
