import { CATEGORY_ALIASES } from "./categoryAliases";

/**
 * Trim → NFC → treat empty as uncategorized → lowercase using root locale for stable buckets.
 */
export function normalizeCategoryKey(
  input: string | null | undefined
): string | null {
  if (input == null) return null;
  const t = input.normalize("NFC").trim();
  if (!t) return null;
  return t.toLocaleLowerCase("und");
}

export function resolveCanonicalCategoryKey(normalized: string): string {
  return CATEGORY_ALIASES[normalized] ?? normalized;
}

/**
 * Whether a product `category` belongs on a collection keyed by `canonicalCategoryKey`
 * (values from `collections.ts`, ASCII lowercase).
 */
export function productCategoryMatchesCanonical(
  productCategory: string | null | undefined,
  canonicalCategoryKey: string
): boolean {
  const n = normalizeCategoryKey(productCategory);
  if (n === null) return false;
  const bucket = resolveCanonicalCategoryKey(n);
  const target = canonicalCategoryKey.trim().toLocaleLowerCase("und");
  return bucket === target;
}
