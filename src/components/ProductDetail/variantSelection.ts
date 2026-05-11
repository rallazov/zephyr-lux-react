import type { Product, ProductVariant } from "../../domain/commerce";
import type { CatalogVariantAxis } from "../../catalog/types";

export function isPurchasable(v: ProductVariant): boolean {
  return v.status === "active" && v.inventory_quantity > 0;
}

export function getPurchasableVariants(
  variants: ProductVariant[]
): ProductVariant[] {
  return variants.filter(isPurchasable);
}

/**
 * Controls which variants drive PDP option axes (sizes/colors).
 * When nothing is in stock, still surface active SKUs so shoppers can pick a
 * size and see accurate out-of-stock messaging instead of hiding the selector.
 */
export function variantsForPdpLayout(variants: ProductVariant[]): ProductVariant[] {
  const purchasable = getPurchasableVariants(variants);
  if (purchasable.length > 0) return purchasable;
  return variants.filter((v) => v.status === "active");
}

function uniqueSorted(
  values: (string | undefined)[]
): string[] {
  return [
    ...new Set(
      values.filter(
        (v): v is string => v != null && String(v).trim() !== ""
      )
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export type OptionLayout = {
  showSize: boolean;
  showColor: boolean;
  uniqueSizes: string[];
  uniqueColors: string[];
  /** When true, the catalog has a single in-stock purchasable SKU — we pre-fill selection. */
  autoSelectSingle: boolean;
  /** Only one meaningful dimension: which control to show. */
  surface: "size" | "color" | "both" | "none";
};

/**
 * From purchasable variants only, decide which option controls to render (AC1).
 * - Show size only if more than one distinct size among purchasable.
 * - Show color only if more than one distinct color among purchasable.
 * - If only one purchasable variant, `surface` is "none" and `autoSelectSingle` is true.
 */
export function computeOptionLayout(
  purchasable: ProductVariant[]
): OptionLayout {
  if (purchasable.length === 0) {
    return {
      showSize: false,
      showColor: false,
      uniqueSizes: [],
      uniqueColors: [],
      autoSelectSingle: false,
      surface: "none",
    };
  }
  if (purchasable.length === 1) {
    return {
      showSize: false,
      showColor: false,
      uniqueSizes: uniqueSorted(purchasable.map((v) => v.size)),
      uniqueColors: uniqueSorted(
        purchasable.map((v) => (v.color != null ? String(v.color) : undefined))
      ),
      autoSelectSingle: true,
      surface: "none",
    };
  }
  const uniqueSizes = uniqueSorted(purchasable.map((v) => v.size));
  const uniqueColors = uniqueSorted(
    purchasable.map((v) => (v.color != null ? String(v.color) : undefined))
  );
  const showSize = uniqueSizes.length > 1;
  const showColor = uniqueColors.length > 1;
  const surface: OptionLayout["surface"] =
    showSize && showColor
      ? "both"
      : showSize
        ? "size"
        : showColor
          ? "color"
          : "none";
  return {
    showSize,
    showColor,
    uniqueSizes,
    uniqueColors,
    autoSelectSingle: false,
    surface,
  };
}

function dimMatch(
  v: string | null | undefined,
  eff: string | null
): boolean {
  if (eff == null) {
    return v == null || v === undefined || String(v).trim() === "";
  }
  return String(v) === eff;
}

export type Selection = {
  size: string | null;
  color: string | null;
};

/**
 * Resolves the chosen SKU from selection + layout, only among purchasable
 * when the combination is in stock; otherwise finds a non-purchasable match for messaging.
 */
export function resolveSelection(
  allVariants: ProductVariant[],
  purchasable: ProductVariant[],
  layout: OptionLayout,
  sel: Selection
):
  | { kind: "purchasable"; variant: ProductVariant }
  | { kind: "incomplete" }
  | { kind: "unavailable" }
  | { kind: "not_purchasable"; variant: ProductVariant } {
  if (layout.autoSelectSingle && purchasable.length === 1) {
    return { kind: "purchasable", variant: purchasable[0] };
  }

  const { showSize, showColor, uniqueSizes, uniqueColors } = layout;
  if (showSize && (sel.size == null || sel.size === "")) {
    return { kind: "incomplete" };
  }
  if (showColor && (sel.color == null || sel.color === "")) {
    return { kind: "incomplete" };
  }

  const effSize = showSize
    ? sel.size
    : uniqueSizes.length === 1
      ? uniqueSizes[0] ?? null
      : null;
  const effColor = showColor
    ? sel.color
    : uniqueColors.length === 1
      ? uniqueColors[0] ?? null
      : null;

  const match = (v: ProductVariant) =>
    dimMatch(v.size, effSize) && dimMatch(v.color, effColor);

  const buying = purchasable.filter(match);
  if (buying.length === 1) {
    return { kind: "purchasable", variant: buying[0] };
  }
  if (buying.length > 1) {
    return { kind: "unavailable" };
  }
  const any = allVariants.find(match);
  if (any) {
    return { kind: "not_purchasable", variant: any };
  }
  return { kind: "unavailable" };
}

export function minMaxPriceCents(
  product: Product
): { min: number; max: number } {
  const cents = product.variants.map((v) => v.price_cents);
  if (cents.length === 0) {
    return { min: 0, max: 0 };
  }
  return { min: Math.min(...cents), max: Math.max(...cents) };
}

export function minMaxPriceCentsFromPurchasable(
  purchasable: ProductVariant[]
): { min: number; max: number } {
  if (purchasable.length === 0) {
    return { min: 0, max: 0 };
  }
  const cents = purchasable.map((v) => v.price_cents);
  return { min: Math.min(...cents), max: Math.max(...cents) };
}

/**
 * For low-stock line (AC3 optional), when 0 < qty <= threshold.
 */
export function lowStockMessage(v: ProductVariant): string | null {
  if (
    v.low_stock_threshold == null ||
    v.inventory_quantity === 0 ||
    v.inventory_quantity > v.low_stock_threshold
  ) {
    return null;
  }
  return `Only ${v.inventory_quantity} left in stock.`;
}

export function formatOptionLabel(s: string): string {
  if (!s) {
    return s;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Per-axis selected option id (template PDP). */
export type TemplateAxisSelection = Record<string, string | null>;

export function allowedOptionIdsForAxisIndex(
  axisIndex: number,
  axes: CatalogVariantAxis[],
  selected: TemplateAxisSelection,
  purchasable: ProductVariant[]
): Set<string> {
  const allowed = new Set<string>();
  for (const v of purchasable) {
    let prefixOk = true;
    for (let i = 0; i < axisIndex; i++) {
      const ax = axes[i]!;
      const sel = selected[ax.id];
      const vid = v.template_option_values?.find((t) => t.axis_id === ax.id)?.option_id;
      if (sel == null || sel === "" || vid !== sel) {
        prefixOk = false;
        break;
      }
    }
    if (!prefixOk) continue;
    const thisAxis = axes[axisIndex]!;
    const vid = v.template_option_values?.find((t) => t.axis_id === thisAxis.id)?.option_id;
    if (vid) allowed.add(vid);
  }
  return allowed;
}

/**
 * Resolves SKU from N-axis template selection (mirrors {@link resolveSelection} outcomes).
 */
export function resolveTemplateSelection(
  allVariants: ProductVariant[],
  purchasable: ProductVariant[],
  axesSorted: CatalogVariantAxis[],
  selected: TemplateAxisSelection
):
  | { kind: "purchasable"; variant: ProductVariant }
  | { kind: "incomplete" }
  | { kind: "unavailable" }
  | { kind: "not_purchasable"; variant: ProductVariant } {
  const axes = axesSorted;
  if (axes.length === 0) {
    return { kind: "unavailable" };
  }

  if (purchasable.length === 1) {
    return { kind: "purchasable", variant: purchasable[0]! };
  }

  for (const ax of axes) {
    const val = selected[ax.id];
    if (val == null || val === "") {
      return { kind: "incomplete" };
    }
  }

  const match = (v: ProductVariant) =>
    axes.every((ax) => {
      const want = selected[ax.id];
      const got = v.template_option_values?.find((t) => t.axis_id === ax.id)?.option_id;
      return want != null && got === want;
    });

  const buying = purchasable.filter(match);
  if (buying.length === 1) {
    return { kind: "purchasable", variant: buying[0]! };
  }
  if (buying.length > 1) {
    return { kind: "unavailable" };
  }
  const any = allVariants.find(match);
  if (any) {
    return { kind: "not_purchasable", variant: any };
  }
  return { kind: "unavailable" };
}

export function formatVariantNameSuffixFromLabels(parts: string[]): string {
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  return cleaned.length ? ` — ${cleaned.join(" / ")}` : "";
}

export function colorsForSize(
  purchasable: ProductVariant[],
  size: string | null
): string[] {
  if (size == null) {
    return uniqueSorted(
      purchasable.map((v) => (v.color != null ? String(v.color) : undefined))
    );
  }
  return uniqueSorted(
    purchasable
      .filter((v) => String(v.size) === size)
      .map((v) => (v.color != null ? String(v.color) : undefined))
  );
}

/** Distinct size values in stock for a color (2D). */
export function sizesForColor(
  purchasable: ProductVariant[],
  color: string | null
): string[] {
  if (color == null) {
    return uniqueSorted(purchasable.map((v) => v.size));
  }
  return uniqueSorted(
    purchasable
      .filter((v) => String(v.color) === color)
      .map((v) => v.size)
  );
}
