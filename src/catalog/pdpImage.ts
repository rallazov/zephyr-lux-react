import type { Product, ProductVariant } from "../domain/commerce";

/** Neutral placeholder when no usable image exists (no remote asset dependency). */
export const PDP_IMAGE_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-label="Placeholder"><rect fill="#e8e6e3" width="800" height="800"/><text x="400" y="400" text-anchor="middle" dy=".35em" fill="#9c9893" font-family="system-ui,sans-serif" font-size="28">No image</text></svg>`
  );

export function buildDisplayGalleryUrls(
  variants: Product["variants"],
  productLevelGallery: string[],
  variantPrimaryImageBySku: Partial<Record<string, string>>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    const t = u.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const u of productLevelGallery) push(u);
  const sorted = [...variants].sort((a, b) => a.sku.localeCompare(b.sku));
  for (const v of sorted) {
    const prim = variantPrimaryImageBySku[v.sku];
    if (prim) push(prim);
    else if (v.image_url) push(v.image_url);
  }
  return out;
}

/**
 * Primary PDP / line-item image (stories 6-3, 2-4): variant row primary → product-level gallery
 * → legacy `image_url` / first browsable URL → placeholder.
 */
export function resolvePdpHeroImageUrl(params: {
  selectedVariant: ProductVariant | null;
  productLevelGallery: string[];
  displayGalleryUrls: string[];
  variantPrimaryImageBySku: Partial<Record<string, string>>;
  fallbackVariant?: ProductVariant | null;
}): string {
  const v = params.selectedVariant;
  if (v) {
    const primary = params.variantPrimaryImageBySku[v.sku]?.trim();
    if (primary) return primary;
  }
  if (params.productLevelGallery.length > 0) {
    const first = params.productLevelGallery[0]?.trim();
    if (first) return first;
  }
  const legacy =
    v?.image_url?.trim()
    || params.fallbackVariant?.image_url?.trim()
    || params.displayGalleryUrls[0]?.trim();
  if (legacy) return legacy;
  return PDP_IMAGE_PLACEHOLDER;
}
