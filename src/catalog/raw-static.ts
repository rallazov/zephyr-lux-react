import { z } from "zod";
import { productSchema, productVariantSchema } from "../domain/commerce";
import { productStatusSchema } from "../domain/commerce/enums";

/** Optional PDP template slice for tests / future static fixtures (Story 11-4). */
export const staticStorefrontTemplateSliceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  axes: z
    .array(
      z.object({
        id: z.string().min(1),
        axis_key: z.string().min(1),
        label: z.string().nullish(),
        sort_order: z.number(),
        options: z
          .array(
            z.object({
              id: z.string().min(1),
              option_key: z.string().min(1),
              label: z.string().nullish(),
              sort_order: z.number(),
            })
          )
          .min(1),
      })
    )
    .min(1),
});

/**
 * Zod input shape for the authoritative file `data/products.json`.
 * Domain-aligned: snake_case, integer `price_cents`, explicit enums.
 *
 * - `id` is the **legacy numeric storefront / cart** key (Epic 3 still keys cart lines by this number).
 * - Each row is validated with `productSchema` on the body (without `id`) in `parse.ts` and via superRefine here.
 */
export const staticSeedProductRowSchema = z
  .object({
    id: z.number().int().positive(),
    /** Supabase `products.id` for waitlist / PDP parity when using service-role APIs (Story 9-3). */
    supabase_product_id: z.string().uuid().optional(),
    /** Mirrors `products.variant_template_id`; omitted in bundled `products.json`. */
    variant_template_id: z.string().uuid().nullish().optional(),
    /** Storefront PDP template metadata (tests only unless added to bundled JSON deliberately). */
    variant_template: staticStorefrontTemplateSliceSchema.optional(),
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
  .superRefine((row, ctx) => {
    const { id: _unused, supabase_product_id, variant_template: _tpl, ...rest } = row;
    void _unused;
    void _tpl;
    const body = {
      ...rest,
      ...(supabase_product_id ? { id: supabase_product_id } : {}),
    };
    const parsed = productSchema.safeParse(body);
    if (parsed.success) return;
    for (const issue of parsed.error.issues) {
      ctx.addIssue({ ...issue, path: issue.path.length ? (issue.path as (string | number)[]) : [] });
    }
  });

export const staticSeedCatalogSchema = z
  .array(staticSeedProductRowSchema)
  .superRefine((rows, ctx) => {
    const skus = new Set<string>();
    for (const row of rows) {
      for (const v of row.variants) {
        if (skus.has(v.sku)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate SKU in static catalog: ${v.sku}`,
            path: [],
          });
          return;
        }
        skus.add(v.sku);
      }
    }
  });

export type StaticSeedProductRow = z.infer<typeof staticSeedProductRowSchema>;
