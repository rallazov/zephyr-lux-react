import { z } from "zod";
import {
  iso4217CurrencySchema,
  productStatusSchema,
  productVariantStatusSchema,
} from "./enums";

export const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
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

export const productSchema = z
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
    variants: z.array(productVariantSchema),
  })
  .superRefine((data, ctx) => {
    if (data.status === "draft") return;
    if (data.variants.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Non-draft products require at least one variant",
        path: ["variants"],
      });
    }
  });

export type ProductVariant = z.infer<typeof productVariantSchema>;
/** Alias where specs or APIs say “Variant”; canonical name is `ProductVariant`. */
export type Variant = ProductVariant;
export type Product = z.infer<typeof productSchema>;
