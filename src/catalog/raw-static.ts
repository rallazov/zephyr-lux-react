import { z } from "zod";

/**
 * Zod input shape for the authoritative file `data/products.json`
 * (variant-level rows; dollars at leaf).
 */
export const staticRawVariantSchema = z.object({
  sku: z.string().min(1),
  options: z
    .object({
      size: z.string().optional(),
      color: z.string().optional(),
    })
    .optional(),
  price: z.number().nonnegative(),
  inventory: z.number().int(),
  image: z.string().optional(),
});

export const staticRawProductSchema = z.object({
  id: z.number().int(),
  slug: z.string().min(1),
  title: z.string().min(1),
  fabricType: z.string().optional(),
  variants: z.array(staticRawVariantSchema).min(1),
});

export const staticRawCatalogSchema = z.array(staticRawProductSchema);

export type StaticRawProduct = z.infer<typeof staticRawProductSchema>;
export type StaticRawVariant = z.infer<typeof staticRawVariantSchema>;
