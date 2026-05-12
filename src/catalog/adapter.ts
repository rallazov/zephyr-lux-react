import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseBrowserClient } from "../lib/supabaseBrowser";
import { parseStaticCatalogData } from "./parse";
import { filterListItemsByCategoryKey } from "./filterByCategory";
import type { CatalogListItem, CatalogProductDetail } from "./types";
import type { BundledStaticCatalog } from "./static-bundled";
import {
  supabaseBundleToCatalogDetail,
  supabaseBundleToListItem,
  type SupabaseProductWithRelations,
} from "./supabase-map";

export interface CatalogAdapter {
  listProducts(): Promise<CatalogListItem[]>;
  /** Active products whose normalized category matches the route canonical key (see `collections.ts`). */
  listProductsByCategory(categoryKey: string): Promise<CatalogListItem[]>;
  getProductBySlug(slug: string): Promise<CatalogProductDetail | null>;
}

const DEFAULT_ENV_KEY = "VITE_CATALOG_BACKEND";

const PRODUCT_IMAGES_EMBED = `
  product_images (
    product_id,
    variant_id,
    storage_path,
    sort_order,
    is_primary
  )
`;

const PRODUCT_PLANS_EMBED = `
  product_subscription_plans (
    id,
    product_id,
    variant_id,
    slug,
    name,
    description,
    interval,
    interval_count,
    price_cents,
    currency,
    stripe_price_id,
    trial_period_days,
    status
  )
`;

const PRODUCT_COLLECTIONS_EMBED = `
  product_collection_assignments (
    collection_key
  )
`;

/** PDP + template axes: embed option values and template graph (Epic 11-3). */
const PRODUCTS_DETAIL_SELECT = `
  id,
  slug,
  title,
  subtitle,
  description,
  brand,
  category,
  fabric_type,
  care_instructions,
  origin,
  status,
  legacy_storefront_id,
  variant_template_id,
  variant_templates (
    id,
    name,
    status,
    variant_template_axes (
      id,
      axis_key,
      label,
      sort_order,
      variant_template_axis_options (
        id,
        axis_id,
        option_key,
        label,
        sort_order
      )
    )
  ),
  product_variants (
    id,
    product_id,
    sku,
    size,
    color,
    price_cents,
    currency,
    inventory_quantity,
    low_stock_threshold,
    status,
    product_variant_option_values (
      axis_id,
      option_id
    )
  ),
  ${PRODUCT_IMAGES_EMBED},
  ${PRODUCT_PLANS_EMBED},
  ${PRODUCT_COLLECTIONS_EMBED}
`;

/** PLP list: omit template graph + per-variant option rows. */
const PRODUCTS_LIST_SELECT = `
  id,
  slug,
  title,
  subtitle,
  description,
  brand,
  category,
  fabric_type,
  care_instructions,
  origin,
  status,
  legacy_storefront_id,
  variant_template_id,
  product_variants (
    id,
    product_id,
    sku,
    size,
    color,
    price_cents,
    currency,
    inventory_quantity,
    low_stock_threshold,
    status
  ),
  ${PRODUCT_IMAGES_EMBED},
  ${PRODUCT_PLANS_EMBED},
  ${PRODUCT_COLLECTIONS_EMBED}
`;

export class StaticCatalogAdapter implements CatalogAdapter {
  private readonly _list: CatalogListItem[];
  private readonly _bySlug: Map<string, CatalogProductDetail>;

  constructor(data: BundledStaticCatalog) {
    const parsed = parseStaticCatalogData(data);
    this._list = parsed.listItems;
    this._bySlug = parsed.bySlug;
  }

  async listProducts(): Promise<CatalogListItem[]> {
    return this._list;
  }

  async listProductsByCategory(categoryKey: string): Promise<CatalogListItem[]> {
    return filterListItemsByCategoryKey(this._list, categoryKey);
  }

  async getProductBySlug(slug: string): Promise<CatalogProductDetail | null> {
    return this._bySlug.get(slug) ?? null;
  }
}

/**
 * Storefront catalog reads via Supabase anon key + RLS (Epic 2 E2-S5).
 * Never pass `SUPABASE_SERVICE_ROLE_KEY` or other server secrets here.
 */
export class SupabaseCatalogAdapter implements CatalogAdapter {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? requireSupabaseBrowserClient();
  }

  async listProducts(): Promise<CatalogListItem[]> {
    const { data, error } = await this.client
      .from("products")
      .select(PRODUCTS_LIST_SELECT.replace(/\s+/g, " ").trim())
      .in("status", ["active", "coming_soon"])
      .order("title", { ascending: true });

    if (error) {
      throw new Error(`Supabase catalog listProducts: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as SupabaseProductWithRelations[];
    return rows.map((r) => supabaseBundleToListItem(r));
  }

  async listProductsByCategory(categoryKey: string): Promise<CatalogListItem[]> {
    const all = await this.listProducts();
    return filterListItemsByCategoryKey(all, categoryKey);
  }

  async getProductBySlug(slug: string): Promise<CatalogProductDetail | null> {
    const s = slug.trim();
    if (!s) return null;
    const { data, error } = await this.client
      .from("products")
      .select(PRODUCTS_DETAIL_SELECT.replace(/\s+/g, " ").trim())
      .eq("slug", s)
      .in("status", ["active", "coming_soon"])
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase catalog getProductBySlug: ${error.message}`);
    }
    if (!data) return null;
    return supabaseBundleToCatalogDetail(
      data as unknown as SupabaseProductWithRelations
    );
  }
}

function readCatalogEnv(): "static" | "supabase" {
  /** Vitest runs Vite with `mode: "test"`; always use bundled static catalog in tests. */
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env?.MODE === "test"
  ) {
    return "static";
  }
  if (typeof import.meta === "undefined" || !import.meta.env) {
    return "static";
  }
  const v = (import.meta.env as Record<string, string | undefined>)[
    DEFAULT_ENV_KEY
  ]?.trim();
  return v?.toLowerCase() === "supabase" ? "supabase" : "static";
}

export function createCatalogAdapter(
  staticData: BundledStaticCatalog
): CatalogAdapter {
  if (readCatalogEnv() === "supabase") {
    return new SupabaseCatalogAdapter();
  }
  return new StaticCatalogAdapter(staticData);
}
