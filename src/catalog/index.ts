export type { CatalogAdapter } from "./adapter";
export {
  createCatalogAdapter,
  StaticCatalogAdapter,
  SupabaseCatalogAdapter,
} from "./adapter";
export { getDefaultCatalogAdapter } from "./factory";
export { parseStaticCatalogData } from "./parse";
export type { CatalogListItem, CatalogProductDetail } from "./types";
export { staticCatalog } from "./static-bundled";
export {
  staticSeedCatalogSchema,
  staticSeedProductRowSchema,
} from "./raw-static";
