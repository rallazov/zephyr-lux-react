import { CATEGORY_ALIASES } from "./categoryAliases";

/** Code points where default lowercase ≠ Unicode simple case fold (common category-string cases). */
function applyUnicodeSimpleCaseFold(s: string): string {
  return s
    .replace(/\u00df/g, "ss")
    .replace(/\u0130/g, "i")
    .replace(/\u03c2/g, "\u03c3")
    .replace(/\u212a/g, "k")
    .replace(/\u212b/g, "\u00e5");
}

function foldComparableSegment(t: string): string {
  return applyUnicodeSimpleCaseFold(t).toLocaleLowerCase("und");
}

/**
 * Trim → NFC → treat empty as uncategorized → Unicode simple case fold + und lowercase for stable buckets.
 */
export function normalizeCategoryKey(
  input: string | null | undefined
): string | null {
  if (input == null) return null;
  const t = input.normalize("NFC").trim();
  if (!t) return null;
  return foldComparableSegment(t);
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
  const target = foldComparableSegment(canonicalCategoryKey.trim());
  return bucket === target;
}
