import { normalizeCategoryKey } from "./categoryNormalize";
import type { CatalogListItem } from "./types";

/**
 * Normalize a user query for substring match on title/category.
 * Returns null when the query is empty/whitespace after trim+NFC fold prep.
 */
export function normalizeSearchNeedle(raw: string | null | undefined): string | null {
  return normalizeCategoryKey(raw);
}

export function catalogItemMatchesSearchQuery(
  row: CatalogListItem,
  needle: string
): boolean {
  const titleKey = normalizeCategoryKey(row.product.title);
  if (titleKey !== null && titleKey.includes(needle)) return true;
  const catKey = normalizeCategoryKey(row.product.category);
  if (catKey !== null && catKey.includes(needle)) return true;
  return false;
}

export function filterCatalogItemsBySearchQuery(
  items: CatalogListItem[],
  rawQuery: string
): CatalogListItem[] {
  const needle = normalizeSearchNeedle(rawQuery);
  if (needle === null) return [];
  return items.filter((row) => catalogItemMatchesSearchQuery(row, needle));
}
