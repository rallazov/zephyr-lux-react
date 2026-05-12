import type { Product, ProductVariant } from "../domain/commerce";

/**
 * Storefront image policy: men's boxer brief products use committed pack / lifestyle JPEGs
 * under `/assets/img/`. Categories without photography use SVG placeholders under
 * `/assets/img/placeholder-*.svg`.
 */
export const MENS_BOXER_BRIEFS_PACK_IMAGE = "/assets/img/Listing2.jpeg";

/** PDP gallery order for men's boxer briefs (short leg). */
export const MENS_BOXER_BRIEFS_PDP_GALLERY_URLS: readonly string[] = [
  "/assets/img/Listing2.jpeg",
  "/assets/img/Listing.jpeg",
  "/assets/img/Custom Listing.jpeg",
  "/assets/img/3 Listing copy.jpeg",
  "/assets/img/Lifestyle.jpeg",
  "/assets/img/1 Lifestyle.jpeg",
  "/assets/img/Infographic.jpeg",
  "/assets/img/Infographic2.jpeg",
];

/**
 * Long-leg PDP: dedicated listing hero, then the same lifestyle/detail shots as short leg
 * (short-leg pack hero omitted).
 */
export const MENS_BOXER_BRIEFS_LONG_LEG_PDP_GALLERY_URLS: readonly string[] = [
  "/assets/img/long leg.jpg",
  ...MENS_BOXER_BRIEFS_PDP_GALLERY_URLS.slice(1),
];

export const PLACEHOLDER_IMAGE_GENERIC = "/assets/img/placeholder-generic.svg";
export const PLACEHOLDER_IMAGE_WOMEN = "/assets/img/placeholder-women.svg";
export const PLACEHOLDER_IMAGE_KIDS = "/assets/img/placeholder-kids.svg";
export const PLACEHOLDER_IMAGE_MEN_APPAREL = "/assets/img/placeholder-men-apparel.svg";
export const PLACEHOLDER_IMAGE_SALE = "/assets/img/placeholder-sale.svg";
export const PLACEHOLDER_IMAGE_BRAND = "/assets/img/placeholder-brand.svg";

/** Neutral placeholder when no usable image exists (product cards, PDP fallback, broken imgs). */
export const PDP_IMAGE_PLACEHOLDER = PLACEHOLDER_IMAGE_GENERIC;

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
