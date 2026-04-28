/**
 * Maps normalized category strings (see categoryNormalize) to canonical route keys.
 * Update when admin-entered labels need to converge on one collection slug.
 */
export const CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  underware: "underwear",
  womens: "women",
  mens: "men",
};
