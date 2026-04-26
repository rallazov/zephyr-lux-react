/**
 * Authoritative static catalog: `data/products.json` (bundled by Vite).
 * Server-side code should read the same path via `fs` and use `parseStaticCatalogData`.
 */
import staticCatalog from "../../data/products.json";

export { staticCatalog };
export type BundledStaticCatalog = typeof staticCatalog;
