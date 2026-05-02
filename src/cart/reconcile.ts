import type { CatalogListItem } from "../catalog/types";
import { isPurchasable } from "../components/ProductDetail/variantSelection";
import type { ProductVariant } from "../domain/commerce";
import type { StorefrontCartLine } from "./cartLine";
import { normalizeLineSku } from "./lineKey";

export type CartLineIssueCode =
  | "unknown_product"
  | "missing_variant"
  | "unknown_sku"
  | "variant_unavailable"
  | "out_of_stock"
  | "quantity_exceeds_stock";

export type CartLineIssue = {
  code: CartLineIssueCode;
  message: string;
};

export type CartLineValidation = {
  lineIndex: number;
  line: StorefrontCartLine;
  variant: ProductVariant | null;
  listRow: CatalogListItem | null;
  /** Catalog unit price in dollars when variant resolved */
  displayUnitPrice: number | null;
  /** `inventory_quantity` when variant resolved; else null */
  maxQuantity: number | null;
  issues: CartLineIssue[];
};

export type CatalogSyncResult = {
  lines: StorefrontCartLine[];
  priceUpdated: boolean;
};

/** Deep equality for cart lines (persisted shape). */
export function storefrontCartLinesEqual(
  a: StorefrontCartLine[],
  b: StorefrontCartLine[]
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildIndexes(catalogList: CatalogListItem[]) {
  const bySlug = new Map<string, CatalogListItem>();
  const byStorefrontId = new Map<number, CatalogListItem>();
  for (const row of catalogList) {
    bySlug.set(row.product.slug, row);
    byStorefrontId.set(row.storefrontProductId, row);
  }
  return { bySlug, byStorefrontId };
}

function listItemByLine(
  line: StorefrontCartLine,
  bySlug: Map<string, CatalogListItem>,
  byStorefrontId: Map<number, CatalogListItem>
): CatalogListItem | undefined {
  const slug = line.product_slug?.trim();
  if (slug) return bySlug.get(slug);
  return byStorefrontId.get(line.id);
}

function findVariant(
  variants: ProductVariant[],
  sku: string,
  variantId?: string
): ProductVariant | undefined {
  const bySku = variants.filter((v) => v.sku === sku);
  if (bySku.length === 0) return undefined;
  if (variantId) {
    const byId = bySku.find((v) => v.id === variantId);
    if (byId) return byId;
  }
  return bySku[0];
}

/**
 * Resolve normalized SKU and variant. Empty SKU + exactly one catalog variant fills SKU.
 */
export function resolveVariantForLine(
  line: StorefrontCartLine,
  row: CatalogListItem
): { variant: ProductVariant | null; skuNorm: string; ambiguous: boolean } {
  const variants = row.product.variants;
  const skuNorm = normalizeLineSku(line.sku);

  if (skuNorm === "") {
    if (variants.length === 1) {
      const v = variants[0];
      return { variant: v, skuNorm: v.sku, ambiguous: false };
    }
    return { variant: null, skuNorm: "", ambiguous: true };
  }

  const variant = findVariant(variants, skuNorm, line.variant_id);
  return { variant: variant ?? null, skuNorm, ambiguous: false };
}

function variantUnavailableMessage(v: ProductVariant): string {
  if (v.status === "discontinued") {
    return "This option is discontinued and can't be purchased.";
  }
  if (v.status === "inactive") {
    return "This option is not available for purchase.";
  }
  return "This option is not available for purchase.";
}

/**
 * Per-line validation for cart / checkout (pure). Uses `isPurchasable` for stock semantics.
 */
export function validateStorefrontCartLines(
  lines: StorefrontCartLine[],
  catalogList: CatalogListItem[]
): CartLineValidation[] {
  const { bySlug, byStorefrontId } = buildIndexes(catalogList);
  const out: CartLineValidation[] = [];

  lines.forEach((line, lineIndex) => {
    const issues: CartLineIssue[] = [];

    if (line.quantity <= 0) {
      out.push({
        lineIndex,
        line,
        variant: null,
        listRow: null,
        displayUnitPrice: null,
        maxQuantity: null,
        issues: [
          {
            code: "missing_variant",
            message: "This line has an invalid quantity.",
          },
        ],
      });
      return;
    }

    const row = listItemByLine(line, bySlug, byStorefrontId);
    if (!row) {
      issues.push({
        code: "unknown_product",
        message: "This product is no longer available in our catalog.",
      });
      out.push({
        lineIndex,
        line,
        variant: null,
        listRow: null,
        displayUnitPrice: null,
        maxQuantity: null,
        issues,
      });
      return;
    }

    if (row.product.status !== "active") {
      issues.push({
        code: "unknown_product",
        message: "This product is no longer available in our catalog.",
      });
      out.push({
        lineIndex,
        line,
        variant: null,
        listRow: row,
        displayUnitPrice: null,
        maxQuantity: null,
        issues,
      });
      return;
    }

    const { variant, ambiguous } = resolveVariantForLine(line, row);

    if (ambiguous) {
      issues.push({
        code: "missing_variant",
        message:
          "Choose a size and color on the product page, then add this item again.",
      });
      out.push({
        lineIndex,
        line,
        variant: null,
        listRow: row,
        displayUnitPrice: null,
        maxQuantity: null,
        issues,
      });
      return;
    }

    if (!variant) {
      issues.push({
        code: "unknown_sku",
        message: "This size or color is no longer available.",
      });
      out.push({
        lineIndex,
        line,
        variant: null,
        listRow: row,
        displayUnitPrice: null,
        maxQuantity: null,
        issues,
      });
      return;
    }

    const displayUnitPrice = variant.price_cents / 100;
    const maxQuantity = variant.inventory_quantity;

    if (variant.status !== "active") {
      issues.push({
        code: "variant_unavailable",
        message: variantUnavailableMessage(variant),
      });
    } else if (!isPurchasable(variant)) {
      issues.push({
        code: "out_of_stock",
        message: "This item is out of stock.",
      });
    } else if (line.quantity > variant.inventory_quantity) {
      issues.push({
        code: "quantity_exceeds_stock",
        message: `Only ${variant.inventory_quantity} available. Reduce the quantity or remove the line.`,
      });
    }

    out.push({
      lineIndex,
      line,
      variant,
      listRow: row,
      displayUnitPrice,
      maxQuantity,
      issues,
    });
  });

  return out;
}

export function isCartOkForCheckout(validation: CartLineValidation[]): boolean {
  if (validation.length === 0) return false;
  return validation.every((v) => v.issues.length === 0);
}

/**
 * Refresh catalog-backed fields without removing lines. Fills SKU for single-variant products.
 */
export function syncCartLinesFromCatalog(
  lines: StorefrontCartLine[],
  catalogList: CatalogListItem[]
): CatalogSyncResult {
  const { bySlug, byStorefrontId } = buildIndexes(catalogList);
  let priceUpdated = false;

  const next = lines.map((line) => {
    if (line.quantity <= 0) return line;

    const row = listItemByLine(line, bySlug, byStorefrontId);
    if (!row || row.product.status !== "active") return line;

    const { variant, skuNorm, ambiguous } = resolveVariantForLine(line, row);
    if (ambiguous || !variant) return line;

    const newPrice = variant.price_cents / 100;
    if (Math.abs(line.price - newPrice) > 0.001) {
      priceUpdated = true;
    }

    return {
      ...line,
      id: row.storefrontProductId,
      sku: skuNorm,
      product_slug: row.product.slug,
      variant_id: variant.id ?? line.variant_id,
      price: newPrice,
      image: variant.image_url ?? line.image,
    };
  });

  return { lines: next, priceUpdated };
}

export type ReconciledCart = CatalogSyncResult & { removedLineSlots: number };

/**
 * Aligns cart lines with catalog prices/ids. Does **not** drop invalid lines (see story 3-2).
 * `removedLineSlots` is always `0`; kept for call-site compatibility.
 */
export function reconcileCartLines(
  lines: StorefrontCartLine[],
  catalogList: CatalogListItem[]
): ReconciledCart {
  const r = syncCartLinesFromCatalog(lines, catalogList);
  return { ...r, removedLineSlots: 0 };
}
