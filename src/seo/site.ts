/** Storefront branding and public URL helpers (story 6-5). */

export const SITE_BRAND = "Zephyr Lux";

export const DEFAULT_META_DESCRIPTION =
  "Zephyr Lux: soft bamboo essentials for everyday comfort.";

/** Default OG image path (served from site origin). */
export const DEFAULT_OG_IMAGE_PATH = "/assets/img/Lifestyle.jpeg";

/**
 * Canonical public origin for absolute URLs (Open Graph, JSON-LD).
 * Prefer `VITE_PUBLIC_SITE_URL` in deployed env; falls back to `window.location.origin` in the browser.
 */
export function getPublicSiteBaseUrl(): string {
  const raw = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function absoluteStorefrontUrl(pathname: string): string {
  const base = getPublicSiteBaseUrl();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (!base) {
    return path;
  }
  return `${base}${path}`;
}

/** Signed / tokenized storage URLs are a poor fit for `og:image`; crawlers often cannot refetch them. */
export function isLikelyUnstableImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes("/object/sign/") || u.includes("token=");
}

export function toPublicAbsoluteUrl(
  href: string | null | undefined,
  siteBase: string
): string | null {
  if (!href) {
    return null;
  }
  if (isLikelyUnstableImageUrl(href)) {
    return null;
  }
  try {
    return new URL(href, siteBase).href;
  } catch {
    return null;
  }
}
