import type { Product } from "../domain/commerce/product";
import {
  subscriptionPlansPurchasableFromEmbed,
  type SubscriptionPlanEmbedRow,
} from "../domain/commerce/subscription";
import { productSchema, productVariantSchema } from "../domain/commerce";
import { buildDisplayGalleryUrls } from "./pdpImage";
import { resolveProductImageUrl } from "./productImageUrl";
import type { CatalogProductDetail, CatalogVariantTemplateSlice } from "./types";
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
  product_variant_option_values?: Array<{
    axis_id: string;
    option_id: string;
  }> | null;
};

export type SupabaseVariantTemplateEmbed = {
  id: string;
  name: string;
  status: string;
  variant_template_axes?: Array<{
    id: string;
    axis_key: string;
    label: string | null;
    sort_order: number;
    variant_template_axis_options?: Array<{
      id: string;
      axis_id: string;
      option_key: string;
      label: string | null;
      sort_order: number;
    }> | null;
  }> | null;
};

export type SupabaseProductRow = {
  id: string;
  variant_template_id?: string | null;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  brand: string | null;
  category: string | null;
  fabric_type: string | null;
  care_instructions: string | null;
  origin: string | null;
  status: "draft" | "active" | "coming_soon" | "archived";
  legacy_storefront_id: number | null;
  variant_templates?: SupabaseVariantTemplateEmbed | null;
};

export type SupabaseSubscriptionPlanRow = SubscriptionPlanEmbedRow;

export type SupabaseProductWithRelations = SupabaseProductRow & {
  product_variants?: SupabaseProductVariantRow[] | null;
  product_images?: SupabaseProductImageRow[] | null;
  product_subscription_plans?: SubscriptionPlanEmbedRow[] | null;
  product_collection_assignments?: Array<{ collection_key: string }> | null;
};

/**
 * Validates mixed legacy + templated Supabase payloads before domain mapping:
 * rejects cross-product FK leakage, inactive/missing embeds, and option rows that
 * do not belong to the assigned template. Degrades to legacy size/color when the
 * templated row is not coherent (Story 11-4).
 */
export function sanitizeSupabaseProductBundle(
  row: SupabaseProductWithRelations
): SupabaseProductWithRelations {
  const variantsRaw = row.product_variants ?? [];

  const tid = row.variant_template_id;
  const hasTid = tid != null && String(tid).trim() !== "";

  const stripToLegacy = (): SupabaseProductWithRelations => ({
    ...row,
    variant_template_id: null,
    variant_templates: null,
    product_variants: variantsRaw.map((v) => ({
      ...v,
      product_variant_option_values: undefined,
    })),
  });

  if (!hasTid) {
    return stripToLegacy();
  }

  const emb = row.variant_templates;
  const embedOk =
    emb != null &&
    String(emb.id) === String(tid) &&
    String(emb.status).toLowerCase() === "active";

  if (!embedOk) {
    return stripToLegacy();
  }

  if (variantsRaw.length === 0) {
    return stripToLegacy();
  }

  const axesSorted = [...(emb.variant_template_axes ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  if (axesSorted.length === 0) {
    return stripToLegacy();
  }

  const uniqueAxisIds = new Set(axesSorted.map((a) => String(a.id)));
  if (uniqueAxisIds.size !== axesSorted.length) {
    return stripToLegacy();
  }

  const axisById = new Map(
    axesSorted.map((a) => [String(a.id), a] as const)
  );
  const allowedOptionIdsForAxisId = new Map<string, Set<string>>();
  for (const a of axesSorted) {
    const opts = a.variant_template_axis_options ?? [];
    const set = new Set(
      opts
        .filter((o) => String(o.axis_id) === String(a.id))
        .map((o) => String(o.id))
    );
    allowedOptionIdsForAxisId.set(String(a.id), set);
  }

  const filteredVariants = variantsRaw.map((v) => {
    const rows = v.product_variant_option_values ?? [];
    const filtered = rows.filter((r) => {
      const axId = String(r.axis_id);
      const axis = axisById.get(axId);
      if (!axis) return false;
      const allowed = allowedOptionIdsForAxisId.get(axId);
      return allowed?.has(String(r.option_id)) ?? false;
    });
    return {
      ...v,
      product_variant_option_values:
        filtered.length > 0 ? filtered : undefined,
    };
  });

  const coherent = (): boolean => {
    const axisIds = new Set(axesSorted.map((a) => String(a.id)));
    for (const v of filteredVariants) {
      const pairs = v.product_variant_option_values ?? [];
      if (pairs.length !== axesSorted.length) {
        return false;
      }
      for (const ax of axesSorted) {
        const id = String(ax.id);
        const forAxis = pairs.filter((p) => String(p.axis_id) === id);
        if (forAxis.length !== 1) {
          return false;
        }
      }
      if (pairs.some((p) => !axisIds.has(String(p.axis_id)))) {
        return false;
      }
    }
    return true;
  };

  if (!coherent()) {
    return stripToLegacy();
  }

  return {
    ...row,
    variant_templates: emb,
    product_variants: filteredVariants,
  };
}

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
  const path = sorted[0]?.storage_path;
  return path ? resolveProductImageUrl(path) : undefined;
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
    const url = resolveProductImageUrl(p);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
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

function supabaseRowsToProductInner(row: SupabaseProductWithRelations): Product {
  const variantsRaw = row.product_variants ?? [];
  const images = row.product_images ?? [];

  const variantsSorted = [...variantsRaw].sort((a, b) =>
    a.sku.localeCompare(b.sku)
  );

  const variants = variantsSorted.map((v) => {
    const tov = (v.product_variant_option_values ?? []).map((r) => ({
      axis_id: String(r.axis_id),
      option_id: String(r.option_id),
    }));
    return productVariantSchema.parse({
      id: v.id,
      product_id: v.product_id,
      sku: v.sku,
      size: v.size ?? undefined,
      color: v.color ?? undefined,
      ...(tov.length > 0 ? { template_option_values: tov } : {}),
      price_cents: v.price_cents,
      currency: v.currency,
      inventory_quantity: v.inventory_quantity,
      low_stock_threshold: v.low_stock_threshold ?? undefined,
      status: v.status,
      image_url: resolveVariantImageUrl(v.id, row.id, images),
    });
  });

  return productSchema.parse({
    id: row.id,
    variant_template_id: row.variant_template_id ?? undefined,
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

export function supabaseRowsToProduct(row: SupabaseProductWithRelations): Product {
  return supabaseRowsToProductInner(sanitizeSupabaseProductBundle(row));
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

function storefrontVariantTemplateFromEmbed(
  row: SupabaseProductWithRelations
): CatalogVariantTemplateSlice | null {
  const tid = row.variant_template_id;
  if (tid == null || String(tid).trim() === "") {
    return null;
  }
  const emb = row.variant_templates;
  if (!emb || emb.status !== "active") {
    return null;
  }
  const axesRaw = emb.variant_template_axes ?? [];
  const axesSorted = [...axesRaw].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
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
  return {
    id: String(emb.id),
    name: String(emb.name),
    axes,
  };
}

function collectionKeysFromEmbed(row: SupabaseProductWithRelations): string[] {
  const keys = new Set<string>();
  for (const r of row.product_collection_assignments ?? []) {
    const key = String(r.collection_key ?? "").trim();
    if (key) keys.add(key);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function supabaseBundleToCatalogDetail(
  row: SupabaseProductWithRelations
): CatalogProductDetail {
  const sanitized = sanitizeSupabaseProductBundle(row);
  const product = supabaseRowsToProductInner(sanitized);
  const storefrontProductId = requireLegacyStorefrontId(
    sanitized,
    "Supabase catalog"
  );
  const images = sanitized.product_images ?? [];
  const galleryImages = orderedProductLevelGalleryUrls(images, sanitized.id);
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
  const collectionKeys = collectionKeysFromEmbed(sanitized);
  const subscriptionPlans = subscriptionPlansPurchasableFromEmbed(
    sanitized.product_subscription_plans,
  );
  return {
    product,
    storefrontProductId,
    galleryImages,
    displayGalleryUrls,
    collectionKeys,
    variantPrimaryImageBySku,
    subscriptionPlans,
    variantTemplate: storefrontVariantTemplateFromEmbed(sanitized),
  };
}

export function supabaseBundleToListItem(
  row: SupabaseProductWithRelations
): CatalogListItem {
  const detail = supabaseBundleToCatalogDetail(row);
  const base = catalogListItemFromProduct(
    detail.product,
    detail.storefrontProductId,
    detail.collectionKeys,
  );
  const primaryProductHero = detail.galleryImages[0]?.trim();
  return {
    ...base,
    collectionKeys: detail.collectionKeys,
    subscriptionPlans: detail.subscriptionPlans,
    heroImageUrl: primaryProductHero || base.heroImageUrl,
  };
}
