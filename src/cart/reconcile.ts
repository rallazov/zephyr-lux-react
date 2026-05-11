import type { CatalogListItem } from "../catalog/types";
import {
  formatOptionLabel,
  isPurchasable,
} from "../components/ProductDetail/variantSelection";
import type { ProductVariant } from "../domain/commerce";
import type { StorefrontCartLine } from "./cartLine";
import { remapLegacyBoxerBriefSku } from "./legacyBoxerBriefSku";
import { normalizeLineSku } from "./lineKey";
import {
  STOREFRONT_MAX_UNITS_PER_LINE,
  effectiveMaxLineQuantity,
} from "./orderLimits";

export type CartLineIssueCode =
  | "unknown_product"
  | "missing_variant"
  | "unknown_sku"
  | "variant_unavailable"
  | "out_of_stock"
  | "quantity_exceeds_stock"
  | "quantity_exceeds_checkout_cap";

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
  /** Catalog `inventory_quantity` when variant resolved & purchasable; else null */
  inventoryQuantity: number | null;
  /** Policy cap applied to every buyer on this storefront (null when N/A). */
  maxUnitsPerOrder: number | null;
  /** Highest allowed line qty: min(inventory, {@link STOREFRONT_MAX_UNITS_PER_LINE}). */
  maxLineQuantity: number | null;
  issues: CartLineIssue[];
};

export type CatalogSyncResult = {
  lines: StorefrontCartLine[];
  priceUpdated: boolean;
  /** Set when sync lowered any line quantity to the checkout ceiling */
  quantityClampNotice: string | null;
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

/**
 * Applies {@link remapLegacyBoxerBriefSku} only for `boxer-briefs` list rows.
 * (BLK/BLU prefixes are legacy listing keys; the pack is always dual-color.)
 */
function remapLegacyBoxerBriefSkuIfNeeded(
  productSlug: string,
  skuNorm: string
): string {
  if (productSlug !== "boxer-briefs") {
    return skuNorm;
  }
  return remapLegacyBoxerBriefSku(skuNorm);
}

function cartDisplayNameForResolvedVariant(
  row: CatalogListItem,
  variant: ProductVariant
): string {
  const parts: string[] = [];
  if (variant.size) {
    parts.push(String(variant.size));
  }
  if (variant.color) {
    parts.push(formatOptionLabel(String(variant.color)));
  }
  const suffix = parts.length ? ` — ${parts.join(" / ")}` : "";
  return `${row.product.title}${suffix}`;
}

function findVariant(
  variants: ProductVariant[],
  sku: string,
  variantId?: string
): ProductVariant | undefined {
  const bySku = variants.filter((v) => v.sku === sku);
  if (bySku.length > 0) {
    if (variantId) {
      const byId = bySku.find((v) => v.id === variantId);
      if (byId) return byId;
    }
    return bySku[0];
  }
  /** SKU rename or stale cart row — still resolve when `variant_id` matches this product (Epic 11 / ops). */
  if (variantId) {
    return variants.find((v) => v.id === variantId);
  }
  return undefined;
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

  const lookupSku = remapLegacyBoxerBriefSkuIfNeeded(row.product.slug, skuNorm);
  const variant = findVariant(variants, lookupSku, line.variant_id);
  if (!variant) {
    return { variant: null, skuNorm, ambiguous: false };
  }
  return { variant, skuNorm: variant.sku, ambiguous: false };
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

/** Matches server quote merge: multiple bag rows with the same purchasable SKU share one cap. */
function applyMergedSkuCheckoutCapIssues(validations: CartLineValidation[]): void {
  const bucketBySku = new Map<string, { indices: number[]; inventory: number }>();
  for (let i = 0; i < validations.length; i++) {
    const v = validations[i]!;
    if (!v.variant) continue;
    if (v.variant.status !== "active" || !isPurchasable(v.variant)) continue;
    const sku = v.variant.sku;
    const inv = v.variant.inventory_quantity;
    const cur = bucketBySku.get(sku);
    if (!cur) bucketBySku.set(sku, { indices: [i], inventory: inv });
    else cur.indices.push(i);
  }

  for (const { indices, inventory } of bucketBySku.values()) {
    if (indices.length < 2) continue;
    const maxLine = effectiveMaxLineQuantity(inventory);
    if (maxLine <= 0) continue;
    const sum = indices.reduce((s, idx) => s + validations[idx]!.line.quantity, 0);
    if (sum <= maxLine) continue;

    const msg = `You have ${sum} of this SKU across multiple bag lines; maximum ${maxLine} per order. Reduce quantities on one or more lines.`;
    for (const idx of indices) {
      const issues = validations[idx]!.issues;
      const existingIdx = issues.findIndex((x) => x.code === "quantity_exceeds_checkout_cap");
      if (existingIdx === -1) {
        issues.push({ code: "quantity_exceeds_checkout_cap", message: msg });
      } else {
        issues[existingIdx] = { code: "quantity_exceeds_checkout_cap", message: msg };
      }
    }
  }
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
        inventoryQuantity: null,
        maxUnitsPerOrder: null,
        maxLineQuantity: null,
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
        inventoryQuantity: null,
        maxUnitsPerOrder: null,
        maxLineQuantity: null,
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
        inventoryQuantity: null,
        maxUnitsPerOrder: null,
        maxLineQuantity: null,
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
        inventoryQuantity: null,
        maxUnitsPerOrder: null,
        maxLineQuantity: null,
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
        inventoryQuantity: null,
        maxUnitsPerOrder: null,
        maxLineQuantity: null,
        issues,
      });
      return;
    }

    const displayUnitPrice = variant.price_cents / 100;
    const purchasable = variant.status === "active" && isPurchasable(variant);
    const inventoryQuantity = purchasable ? variant.inventory_quantity : null;
    const maxUnitsPerOrder = purchasable ? STOREFRONT_MAX_UNITS_PER_LINE : null;
    const maxLineQuantity =
      purchasable && inventoryQuantity !== null
        ? effectiveMaxLineQuantity(inventoryQuantity)
        : null;

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
    } else if (line.quantity > STOREFRONT_MAX_UNITS_PER_LINE) {
      issues.push({
        code: "quantity_exceeds_checkout_cap",
        message: `You can add at most ${STOREFRONT_MAX_UNITS_PER_LINE} units per order for this variant. Reduce the quantity.`,
      });
    }

    out.push({
      lineIndex,
      line,
      variant,
      listRow: row,
      displayUnitPrice,
      inventoryQuantity,
      maxUnitsPerOrder,
      maxLineQuantity,
      issues,
    });
  });

  applyMergedSkuCheckoutCapIssues(out);

  return out;
}

export function isCartOkForCheckout(validation: CartLineValidation[]): boolean {
  if (validation.length === 0) return false;
  return validation.every((v) => v.issues.length === 0);
}

/**
 * `true` when at least one line references something the server can't price
 * (unknown product/SKU or a legacy multi-variant line missing its SKU), or when
 * quantity exceeds available stock or the per-line checkout cap (server quote
 * would reject those lines).
 *
 * Callers use this to suppress `/api/cart-quote` calls that we know will 400.
 */
export function cartHasUnpriceableLine(
  validation: CartLineValidation[] | null | undefined,
): boolean {
  if (!validation) return false;
  return validation.some((v) =>
    v.issues.some(
      (i) =>
        i.code === "unknown_sku" ||
        i.code === "unknown_product" ||
        i.code === "missing_variant" ||
        i.code === "quantity_exceeds_stock" ||
        i.code === "quantity_exceeds_checkout_cap",
    ),
  );
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
  let quantityClampNotice: string | null = null;

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

    const legacyPackSkuRemapped =
      row.product.slug === "boxer-briefs" &&
      normalizeLineSku(line.sku) !== "" &&
      remapLegacyBoxerBriefSkuIfNeeded(row.product.slug, normalizeLineSku(line.sku)) !==
        normalizeLineSku(line.sku);

    const lineCeiling =
      variant.status === "active" && isPurchasable(variant)
        ? effectiveMaxLineQuantity(variant.inventory_quantity)
        : null;
    const qty = lineCeiling != null && line.quantity > lineCeiling ? lineCeiling : line.quantity;
    if (qty < line.quantity) {
      quantityClampNotice =
        "Some quantities were reduced to match per-order limits. Review your bag.";
    }

    return {
      ...line,
      id: row.storefrontProductId,
      sku: skuNorm,
      product_slug: row.product.slug,
      variant_id: variant.id ?? line.variant_id,
      quantity: qty,
      price: newPrice,
      image: variant.image_url ?? line.image,
      ...(legacyPackSkuRemapped ? { name: cartDisplayNameForResolvedVariant(row, variant) } : {}),
    };
  });

  return { lines: next, priceUpdated, quantityClampNotice };
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
