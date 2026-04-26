import { z } from "zod";
import {
  iso4217CurrencySchema,
  productStatusSchema,
  productVariantStatusSchema,
} from "../domain/commerce/enums";
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
  };
}

/** Small helper for clear validation messages at the save boundary. */
export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(" · ");
}
