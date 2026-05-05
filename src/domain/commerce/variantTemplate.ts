import { z } from "zod";

/** Matches `public.variant_template_status`. */
export const variantTemplateStatusSchema = z.enum(["draft", "active", "archived"]);

const stableKeySchema = z.string().trim().regex(/^[a-z0-9][a-z0-9_-]*$/);

/** Single option row under an axis (DB + admin projections). */
export const variantTemplateAxisOptionSchema = z.object({
  id: z.string().uuid(),
  option_key: stableKeySchema,
  label: z.string().nullish(),
  sort_order: z.number().int(),
});

/** Axis row with nested options (ordered merchandising dimension). */
export const variantTemplateAxisSchema = z.object({
  id: z.string().uuid(),
  axis_key: stableKeySchema,
  label: z.string().nullish(),
  sort_order: z.number().int(),
  options: z.array(variantTemplateAxisOptionSchema),
});

/** Full template with axes + options (admin read model / Epic 11-2 payloads). */
export const variantTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  status: variantTemplateStatusSchema,
  axes: z.array(variantTemplateAxisSchema),
});

export type VariantTemplateStatus = z.infer<typeof variantTemplateStatusSchema>;
export type VariantTemplateAxisOption = z.infer<typeof variantTemplateAxisOptionSchema>;
export type VariantTemplateAxis = z.infer<typeof variantTemplateAxisSchema>;
export type VariantTemplate = z.infer<typeof variantTemplateSchema>;
