import type { Product, ProductVariant } from "../../domain/commerce";

export function isPurchasable(v: ProductVariant): boolean {
  return v.status === "active" && v.inventory_quantity > 0;
}

export function getPurchasableVariants(
  variants: ProductVariant[]
): ProductVariant[] {
  return variants.filter(isPurchasable);
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

/** Distinct color values in stock for a size (2D). */
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
