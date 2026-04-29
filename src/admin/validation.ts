import { z } from "zod";
import {
  iso4217CurrencySchema,
  productStatusSchema,
  productVariantStatusSchema,
} from "../domain/commerce/enums";
import {
  stripeBillingPriceIdSchema,
  stripeBillingProductIdSchema,
  subscriptionPlanIntervalSchema,
  subscriptionPlanStatusSchema,
} from "../domain/commerce/subscription";
import { productSchema } from "../domain/commerce/product";

/** One variant row in the admin save bundle (id required for sync). */
export const adminVariantRowSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  size: z.string().optional(),
  color: z.string().optional(),
  price_cents: z.number().int().nonnegative(),
  currency: iso4217CurrencySchema,
  inventory_quantity: z.number().int().nonnegative(),
  low_stock_threshold: z.number().int().nonnegative().optional(),
  status: productVariantStatusSchema,
  image_url: z.string().optional(),
});

export const adminImageRowSchema = z.object({
  id: z.string().uuid(),
  storage_path: z.string().min(1),
  alt_text: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_primary: z.boolean().optional(),
  variant_id: z.string().uuid().optional().nullable(),
});

/** One Stripe Billing subscription plan row (`product_subscription_plans`) edited in admin. */
export const adminSubscriptionPlanRowSchema = z
  .object({
    id: z.string().uuid(),
    slug: z
      .string()
      .min(1)
      .transform((s) => s.trim().toLowerCase()),
    name: z.string(),
    description: z.string().optional(),
    stripe_product_id: z.string().optional().nullable(),
    stripe_price_id: z.string().optional().nullable(),
    variant_id: z.string().uuid().optional().nullable(),
    interval: subscriptionPlanIntervalSchema,
    interval_count: z.number().int().positive(),
    price_cents: z.number().int().nonnegative(),
    currency: iso4217CurrencySchema,
    trial_period_days: z.number().int().nonnegative().nullable().optional(),
    status: subscriptionPlanStatusSchema,
  })
  .superRefine((row, ctx) => {
    if (row.status === "active") {
      if (!row.name.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Active billing plans require a name",
          path: ["name"],
        });
      }
      const sp = row.stripe_price_id?.trim();
      if (!sp) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Active billing plans require stripe_price_id",
          path: ["stripe_price_id"],
        });
      } else if (!stripeBillingPriceIdSchema.safeParse(sp).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expected a Stripe price id (price_…)",
          path: ["stripe_price_id"],
        });
      }
    }
    const prod = row.stripe_product_id?.trim();
    if (prod && !stripeBillingProductIdSchema.safeParse(prod).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected a Stripe product id (prod_…)",
        path: ["stripe_product_id"],
      });
    }
    const price = row.stripe_price_id?.trim();
    if (price && row.status !== "active" && !stripeBillingPriceIdSchema.safeParse(price).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected a Stripe price id (price_…)",
        path: ["stripe_price_id"],
      });
    }
  });

export const adminProductPartSchema = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    fabric_type: z.string().optional(),
    care_instructions: z.string().optional(),
    origin: z.string().optional(),
    status: productStatusSchema,
  })
  .strict();

/**
 * Payload sent to `admin_save_product_bundle` after JSON serialization
 * (variant/image ids are client-generated for stable cross-references).
 */
export const adminSaveBundleSchema = z
  .object({
    product: adminProductPartSchema,
    variants: z.array(adminVariantRowSchema).default([]),
    images: z.array(adminImageRowSchema).default([]),
    subscription_plans: z.array(adminSubscriptionPlanRowSchema).default([]),
  })
  .strict();

export type AdminSaveBundle = z.infer<typeof adminSaveBundleSchema>;

/**
 * Merged `Product` (domain) including variants, for alignment with
 * [productSchema](../../src/domain/commerce/product.ts) (AC7).
 */
export function validateMergedProduct(bundle: AdminSaveBundle) {
  return productSchema.safeParse({
    ...bundle.product,
    variants: bundle.variants,
  });
}

export function bundleToRpcPayload(
  b: AdminSaveBundle
): Record<string, unknown> {
  return {
    product: b.product,
    variants: b.variants.map((v) => ({
      ...v,
      currency: v.currency,
    })),
    images: b.images.map((im) => ({
      ...im,
      variant_id: im.variant_id ?? null,
    })),
    subscription_plans: b.subscription_plans.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name.trim(),
      description: p.description?.trim() ? p.description.trim() : null,
      stripe_product_id:
        p.stripe_product_id != null && p.stripe_product_id.trim() !== ""
          ? p.stripe_product_id.trim()
          : null,
      stripe_price_id:
        p.stripe_price_id != null && p.stripe_price_id.trim() !== ""
          ? p.stripe_price_id.trim()
          : null,
      variant_id: p.variant_id ?? null,
      interval: p.interval,
      interval_count: p.interval_count,
      price_cents: p.price_cents,
      currency: p.currency.toLowerCase(),
      trial_period_days: p.trial_period_days ?? null,
      status: p.status,
    })),
  };
}

/** Small helper for clear validation messages at the save boundary. */
export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(" · ");
}
