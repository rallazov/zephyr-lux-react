import type { Product } from "../domain/commerce/product";
import {
  subscriptionPlansPurchasableFromEmbed,
  type SubscriptionPlanEmbedRow,
} from "../domain/commerce/subscription";
import { productSchema, productVariantSchema } from "../domain/commerce";
import { buildDisplayGalleryUrls } from "./pdpImage";
import type { CatalogProductDetail } from "./types";
import { catalogListItemFromProduct } from "./parse";
import type { CatalogListItem } from "./types";

/**
 * Image resolution (story 2-5 AC6):
 * 1) `product_images` row for this variant_id — best by `is_primary` desc, then `sort_order` asc.
 * 2) Else product-level rows (`variant_id` null) — same ordering.
 * `storage_path` is exposed as `image_url` (site-relative paths OK until FR-CAT-006).
 */
export type SupabaseProductImageRow = {
  product_id: string;
  variant_id: string | null;
  storage_path: string;
  sort_order: number;
  is_primary: boolean;
};

export type SupabaseProductVariantRow = {
  id: string;
  product_id: string;
  sku: string;
  size: string | null;
  color: string | null;
  price_cents: number;
  currency: string;
  inventory_quantity: number;
  low_stock_threshold: number | null;
  status: "active" | "inactive" | "discontinued";
};

export type SupabaseProductRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  brand: string | null;
  category: string | null;
  fabric_type: string | null;
  care_instructions: string | null;
  origin: string | null;
  status: "draft" | "active" | "archived";
  legacy_storefront_id: number | null;
};

export type SupabaseSubscriptionPlanRow = SubscriptionPlanEmbedRow;

export type SupabaseProductWithRelations = SupabaseProductRow & {
  product_variants?: SupabaseProductVariantRow[] | null;
  product_images?: SupabaseProductImageRow[] | null;
  product_subscription_plans?: SubscriptionPlanEmbedRow[] | null;
};

function sortImageCandidates(
  rows: SupabaseProductImageRow[]
): SupabaseProductImageRow[] {
  return [...rows].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
}

function pickStoragePath(candidates: SupabaseProductImageRow[]): string | undefined {
  const sorted = sortImageCandidates(candidates);
  return sorted[0]?.storage_path;
}

function pickVariantOnlyPrimary(
  variantId: string | undefined,
  images: SupabaseProductImageRow[]
): string | undefined {
  if (!variantId) return undefined;
  return pickStoragePath(
    images.filter((i) => i.variant_id === variantId)
  );
}

export function orderedProductLevelGalleryUrls(
  images: SupabaseProductImageRow[],
  productId: string
): string[] {
  const rows = sortImageCandidates(
    images.filter(
      (i) => i.variant_id === null && i.product_id === productId
    )
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const p = r.storage_path.trim();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function resolveVariantImageUrl(
  variantId: string,
  productId: string,
  images: SupabaseProductImageRow[]
): string | undefined {
  const forVariant = pickStoragePath(
    images.filter((i) => i.variant_id === variantId)
  );
  if (forVariant) return forVariant;
  return pickStoragePath(
    images.filter((i) => i.variant_id === null && i.product_id === productId)
  );
}

export function supabaseRowsToProduct(row: SupabaseProductWithRelations): Product {
  const variantsRaw = row.product_variants ?? [];
  const images = row.product_images ?? [];

  const variantsSorted = [...variantsRaw].sort((a, b) =>
    a.sku.localeCompare(b.sku)
  );

  const variants = variantsSorted.map((v) =>
    productVariantSchema.parse({
      id: v.id,
      product_id: v.product_id,
      sku: v.sku,
      size: v.size ?? undefined,
      color: v.color ?? undefined,
      price_cents: v.price_cents,
      currency: v.currency,
      inventory_quantity: v.inventory_quantity,
      low_stock_threshold: v.low_stock_threshold ?? undefined,
      status: v.status,
      image_url: resolveVariantImageUrl(v.id, row.id, images),
    })
  );

  return productSchema.parse({
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    description: row.description ?? undefined,
    brand: row.brand ?? undefined,
    category: row.category ?? undefined,
    fabric_type: row.fabric_type ?? undefined,
    care_instructions: row.care_instructions ?? undefined,
    origin: row.origin ?? undefined,
    status: row.status,
    variants,
  });
}

function requireLegacyStorefrontId(
  row: SupabaseProductRow,
  context: string
): number {
  if (row.legacy_storefront_id == null) {
    throw new Error(
      `${context}: product "${row.slug}" (${row.id}) is missing legacy_storefront_id. ` +
        "Backfill from static seed `id` for pre–Epic 3 cart parity (story 2-5 AC5)."
    );
  }
  return row.legacy_storefront_id;
}

export function supabaseBundleToCatalogDetail(
  row: SupabaseProductWithRelations
): CatalogProductDetail {
  const product = supabaseRowsToProduct(row);
  const storefrontProductId = requireLegacyStorefrontId(
    row,
    "Supabase catalog"
  );
  const images = row.product_images ?? [];
  const galleryImages = orderedProductLevelGalleryUrls(images, row.id);
  const variantPrimaryImageBySku: Partial<Record<string, string>> = {};
  for (const v of product.variants) {
    const path = pickVariantOnlyPrimary(v.id, images);
    if (path) variantPrimaryImageBySku[v.sku] = path;
  }
  const displayGalleryUrls = buildDisplayGalleryUrls(
    product.variants,
    galleryImages,
    variantPrimaryImageBySku
  );
  const subscriptionPlans = subscriptionPlansPurchasableFromEmbed(
    row.product_subscription_plans,
  );
  return {
    product,
    storefrontProductId,
    galleryImages,
    displayGalleryUrls,
    variantPrimaryImageBySku,
    subscriptionPlans,
  };
}

export function supabaseBundleToListItem(
  row: SupabaseProductWithRelations
): CatalogListItem {
  const detail = supabaseBundleToCatalogDetail(row);
  return {
    ...catalogListItemFromProduct(detail.product, detail.storefrontProductId),
    subscriptionPlans: detail.subscriptionPlans,
  };
}
