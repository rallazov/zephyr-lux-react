import { productCategoryMatchesCanonical } from "./categoryNormalize";
import type { CatalogListItem } from "./types";

export function filterListItemsByCategoryKey(
  items: CatalogListItem[],
  canonicalCategoryKey: string
): CatalogListItem[] {
  return items.filter((row) =>
    productCategoryMatchesCanonical(row.product.category, canonicalCategoryKey)
  );
}
