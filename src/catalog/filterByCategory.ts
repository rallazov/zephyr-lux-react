import { productCategoryMatchesCanonical } from "./categoryNormalize";
import type { CatalogListItem } from "./types";

export function filterListItemsByCategoryKey(
  items: CatalogListItem[],
  canonicalCategoryKey: string
): CatalogListItem[] {
  return items.filter((row) => {
    if (row.collectionKeys.length > 0) {
      return row.collectionKeys.includes(canonicalCategoryKey);
    }
    return productCategoryMatchesCanonical(row.product.category, canonicalCategoryKey);
  });
}
