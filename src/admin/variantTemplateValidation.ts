import { z } from "zod";
import {
  type VariantTemplate,
  variantTemplateAxisOptionSchema,
  variantTemplateAxisSchema,
  variantTemplateSchema,
  variantTemplateStatusSchema,
} from "../domain/commerce/variantTemplate";

/** Normalizes storefront text for comparisons with stable template keys (lowercase, trim). */
export function normalizeMerchKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

const stableKeyStrict = /^[a-z0-9][a-z0-9_-]*$/;

export const adminVariantTemplateFormOptionSchema = z.object({
  id: z.string().uuid(),
  option_key: z.string().trim().regex(stableKeyStrict, "Option key must be a stable slug-like id"),
  label: z.string().nullable().optional(),
  sort_order: z.number().int(),
});

export const adminVariantTemplateFormAxisSchema = z.object({
  id: z.string().uuid(),
  axis_key: z.string().trim().regex(stableKeyStrict, "Axis key must be a stable slug-like id"),
  label: z.string().nullable().optional(),
  sort_order: z.number().int(),
  options: z.array(adminVariantTemplateFormOptionSchema).min(1, "Each axis needs at least one option"),
});

export const adminVariantTemplateFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Name is required"),
    status: variantTemplateStatusSchema,
    axes: z.array(adminVariantTemplateFormAxisSchema).min(1, "Add at least one axis"),
  })
  .superRefine((data, ctx) => {
    const keys = data.axes.map((a) => a.axis_key);
    const seen = new Set<string>();
    for (const k of keys) {
      if (seen.has(k)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate axis key: ${k}`,
          path: ["axes"],
        });
        return;
      }
      seen.add(k);
    }
    for (const ax of data.axes) {
      const optKeys = ax.options.map((o) => o.option_key);
      const oseen = new Set<string>();
      for (const ok of optKeys) {
        if (oseen.has(ok)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate option key on axis ${ax.axis_key}: ${ok}`,
            path: ["axes"],
          });
          return;
        }
        oseen.add(ok);
      }
    }
  });

export type AdminVariantTemplateForm = z.infer<typeof adminVariantTemplateFormSchema>;

export type VariantRowLite = {
  sku: string;
  size?: string | null;
  color?: string | null;
  template_option_values?: Array<{ axis_id: string; option_id: string }>;
};

/**
 * Validates each variant row has exactly one valid option per template axis, no duplicate
 * full combinations, and options belong to the template (Epic 11-3).
 */
export function variantsSatisfyTemplate(
  variants: VariantRowLite[],
  template: VariantTemplate,
): { ok: true } | { ok: false; message: string } {
  const axes = [...template.axes].sort((a, b) => a.sort_order - b.sort_order);
  if (axes.length === 0) {
    return { ok: false, message: "Selected template has no axes." };
  }
  const allowedByAxis = new Map(
    axes.map((ax) => [ax.id, new Set(ax.options.map((o) => o.id))] as const),
  );
  const sigs = new Set<string>();

  for (const v of variants) {
    const pairs = v.template_option_values ?? [];
    if (pairs.length !== axes.length) {
      return {
        ok: false,
        message: `Variant ${v.sku || "(sku)"} needs one template option selected for each axis (${axes.length} axes).`,
      };
    }
    const seenAxis = new Set<string>();
    const parts: string[] = [];
    for (const ax of axes) {
      const hit = pairs.find((p) => p.axis_id === ax.id);
      if (!hit) {
        return {
          ok: false,
          message: `Variant ${v.sku || "(sku)"} is missing a selection for axis "${ax.axis_key}".`,
        };
      }
      if (seenAxis.has(ax.id)) {
        return {
          ok: false,
          message: `Variant ${v.sku || "(sku)"} has duplicate selections for an axis.`,
        };
      }
      seenAxis.add(ax.id);
      const allow = allowedByAxis.get(ax.id);
      if (!allow?.has(hit.option_id)) {
        return {
          ok: false,
          message: `Variant ${v.sku || "(sku)"} has an invalid option for axis "${ax.axis_key}".`,
        };
      }
      parts.push(`${hit.axis_id}:${hit.option_id}`);
    }
    const sig = [...parts].sort().join("|");
    if (sigs.has(sig)) {
      return {
        ok: false,
        message: `More than one variant row uses the same template combination (see SKU ${v.sku || "?"}).`,
      };
    }
    sigs.add(sig);
  }
  return { ok: true };
}

/**
 * Parses a nested Supabase select into [`variantTemplateSchema`] shape (ordered axes/options).
 */
export function parseVariantTemplateJoinRow(raw: Record<string, unknown>): VariantTemplate {
  type AxisRow = {
    id: string;
    axis_key: string;
    label?: string | null;
    sort_order: number;
    variant_template_axis_options?: Array<{
      id: string;
      option_key: string;
      label?: string | null;
      sort_order: number;
    }>;
  };
  const axesRaw = raw.variant_template_axes as AxisRow[] | undefined;
  const axesSorted = [...(axesRaw ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const axes = axesSorted.map((a) => ({
    id: String(a.id),
    axis_key: String(a.axis_key),
    label: a.label ?? null,
    sort_order: a.sort_order ?? 0,
    options: [...(a.variant_template_axis_options ?? [])]
      .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))
      .map((o) => ({
        id: String(o.id),
        option_key: String(o.option_key),
        label: o.label ?? null,
        sort_order: o.sort_order ?? 0,
      })),
  }));
  return variantTemplateSchema.parse({
    id: String(raw.id),
    name: String(raw.name),
    status: variantTemplateStatusSchema.parse(raw.status),
    axes: axes.map((ax) => variantTemplateAxisSchema.parse(ax)),
  });
}

/**
 * Coerce admin form model to domain template (includes generated template id for new saves).
 */
export function formToVariantTemplate(form: AdminVariantTemplateForm, templateId: string): VariantTemplate {
  return variantTemplateSchema.parse({
    id: templateId,
    name: form.name.trim(),
    status: form.status,
    axes: form.axes
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((ax) =>
        variantTemplateAxisSchema.parse({
          id: ax.id,
          axis_key: ax.axis_key.trim(),
          label: ax.label?.trim() ? ax.label.trim() : null,
          sort_order: ax.sort_order,
          options: ax.options
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((o) =>
              variantTemplateAxisOptionSchema.parse({
                id: o.id,
                option_key: o.option_key.trim(),
                label: o.label?.trim() ? o.label.trim() : null,
                sort_order: o.sort_order,
              }),
            ),
        }),
      ),
  });
}

/** True when an edit removes/changes structural identity that assigned catalog rows might rely on. */
export function isStructuralTemplateDestructive(before: VariantTemplate, after: VariantTemplate): boolean {
  const afterAxisById = new Map(after.axes.map((a) => [a.id, a] as const));
  for (const ax of before.axes) {
    const next = afterAxisById.get(ax.id);
    if (!next) return true;
    if (normalizeMerchKey(next.axis_key) !== normalizeMerchKey(ax.axis_key)) return true;

    const afterOptById = new Map(next.options.map((o) => [o.id, o] as const));
    for (const op of ax.options) {
      const nop = afterOptById.get(op.id);
      if (!nop) return true;
      if (normalizeMerchKey(nop.option_key) !== normalizeMerchKey(op.option_key)) return true;
    }
  }
  return false;
}

/**
 * If the template is assigned to products (`assignedCount > 0`) and variants use an option row that
 * disappears or changes identity, callers must confirm (AC4).
 */
export function destructiveEditRequiresAcknowledgement(
  beforeFull: VariantTemplate | null,
  afterFull: VariantTemplate,
  assignedProductCount: number,
): boolean {
  if (assignedProductCount <= 0) return false;
  if (!beforeFull) return false;
  const beforeAxisIds = new Set(beforeFull.axes.map((a) => a.id));
  for (const ax of afterFull.axes) {
    if (!beforeAxisIds.has(ax.id)) return true;
  }
  return isStructuralTemplateDestructive(beforeFull, afterFull);
}
