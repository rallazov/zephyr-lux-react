import { createCatalogAdapter, type CatalogAdapter } from "./adapter";
import { staticCatalog } from "./static-bundled";

let _adapter: CatalogAdapter | null = null;

/**
 * Default SPA catalog: static bundle from `data/products.json` unless
 * `VITE_CATALOG_BACKEND=supabase` (stub until Epic 2).
 */
export function getDefaultCatalogAdapter(): CatalogAdapter {
  if (!_adapter) {
    _adapter = createCatalogAdapter(staticCatalog);
  }
  return _adapter;
}
