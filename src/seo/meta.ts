import { useEffect, useId } from "react";
import {
  absoluteStorefrontUrl,
  DEFAULT_META_DESCRIPTION,
  DEFAULT_OG_IMAGE_PATH,
  getPublicSiteBaseUrl,
  SITE_BRAND,
  toPublicAbsoluteUrl,
} from "./site";

const OWNER_ATTR = "data-zephyr-seo-owner";

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function upsertMeta(
  owner: string,
  attr: "name" | "property",
  key: string,
  content: string
): void {
  const sel = `meta[${attr}="${escapeAttrValue(key)}"]`;
  let el = document.head.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute(OWNER_ATTR, owner);
  el.setAttribute("content", content);
}

function removeOwnerNodes(owner: string): void {
  document.head
    .querySelectorAll(`[${OWNER_ATTR}="${escapeAttrValue(owner)}"]`)
    .forEach((n) => n.remove());
}

export type PageMetaConfig = {
  title: string;
  description?: string;
  /** Path only, e.g. `/products` — used for `og:url` if `ogUrl` omitted. */
  canonicalPath?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  /** Absolute URL, or site-relative path resolved against public base. Null/undefined skips `og:image`. */
  ogImage?: string | null;
  /** Full URL preferred; if omitted, derived from `canonicalPath` and site base. */
  ogUrl?: string;
  twitterCard?: "summary" | "summary_large_image";
};

/**
 * Upserts document title and meta tags; removes managed nodes on unmount (StrictMode-safe).
 */
export function usePageMeta(config: PageMetaConfig): void {
  const owner = useId().replace(/:/g, "");

  useEffect(() => {
    document.title = config.title;

    const base = getPublicSiteBaseUrl();
    const desc = config.description ?? DEFAULT_META_DESCRIPTION;
    upsertMeta(owner, "name", "description", desc);

    const ogTitle = config.ogTitle ?? config.title;
    const ogDesc = config.ogDescription ?? desc;
    upsertMeta(owner, "property", "og:title", ogTitle);
    upsertMeta(owner, "property", "og:description", ogDesc);
    upsertMeta(owner, "property", "og:type", config.ogType ?? "website");

    const ogUrl =
      config.ogUrl
      ?? (config.canonicalPath != null
        ? absoluteStorefrontUrl(config.canonicalPath)
        : absoluteStorefrontUrl("/"));
    upsertMeta(owner, "property", "og:url", ogUrl);

    const twitterCard = config.twitterCard ?? "summary_large_image";
    upsertMeta(owner, "name", "twitter:card", twitterCard);
    upsertMeta(owner, "name", "twitter:title", ogTitle);
    upsertMeta(owner, "name", "twitter:description", ogDesc);

    let ogImageAbs: string | null = null;
    if (config.ogImage === undefined) {
      ogImageAbs =
        base
          ? toPublicAbsoluteUrl(DEFAULT_OG_IMAGE_PATH, base)
          : toPublicAbsoluteUrl(DEFAULT_OG_IMAGE_PATH, "http://localhost:5173");
    } else if (config.ogImage) {
      ogImageAbs = config.ogImage.includes("://")
        ? config.ogImage
        : base
          ? toPublicAbsoluteUrl(config.ogImage, base)
          : null;
    }

    if (ogImageAbs) {
      upsertMeta(owner, "property", "og:image", ogImageAbs);
      upsertMeta(owner, "name", "twitter:image", ogImageAbs);
    } else {
      document.head
        .querySelectorAll(
          `meta[property="og:image"][${OWNER_ATTR}="${escapeAttrValue(owner)}"], meta[name="twitter:image"][${OWNER_ATTR}="${escapeAttrValue(owner)}"]`
        )
        .forEach((n) => n.remove());
    }

    return () => {
      removeOwnerNodes(owner);
    };
  }, [
    owner,
    config.title,
    config.description,
    config.canonicalPath,
    config.ogTitle,
    config.ogDescription,
    config.ogType,
    config.ogImage,
    config.ogUrl,
    config.twitterCard,
  ]);
}

/** @internal exported for tests */
export function formatPageTitleWithBrand(page: string): string {
  return `${page} — ${SITE_BRAND}`;
}
