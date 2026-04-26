import { parseStaticCatalogData } from "./parse";
import type { CatalogListItem, CatalogProductDetail } from "./types";
import type { BundledStaticCatalog } from "./static-bundled";

export interface CatalogAdapter {
  listProducts(): Promise<CatalogListItem[]>;
  getProductBySlug(slug: string): Promise<CatalogProductDetail | null>;
}

const DEFAULT_ENV_KEY = "VITE_CATALOG_BACKEND";

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

  async getProductBySlug(slug: string): Promise<CatalogProductDetail | null> {
    return this._bySlug.get(slug) ?? null;
  }
}

/**
 * Intentionally unimplemented. Wire when Supabase schema exists (Epic 2, E2-S5+).
 * Do not add server secrets to the browser bundle.
 */
export class SupabaseCatalogAdapter implements CatalogAdapter {
  async listProducts(): Promise<CatalogListItem[]> {
    throw new Error(
      "SupabaseCatalogAdapter: not implemented — add Supabase schema and wire in Epic 2 (E2-S5+)."
    );
  }

  async getProductBySlug(slug: string): Promise<CatalogProductDetail | null> {
    throw new Error(
      `SupabaseCatalogAdapter: not implemented (slug: ${slug}) — add Supabase schema and wire in Epic 2 (E2-S5+).`
    );
  }
}

function readCatalogEnv(): "static" | "supabase" {
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
