import { useEffect, useId } from "react";
import type { Product, ProductVariant } from "../domain/commerce";
import {
  isLikelyUnstableImageUrl,
  toPublicAbsoluteUrl,
} from "./site";

const JSON_LD_SCRIPT_ID = "zephyr-seo-product-jsonld";
const OWNER_ATTR = "data-zephyr-seo-owner";

export type ProductSelectionForJsonLd =
  | { kind: "purchasable"; variant: ProductVariant }
  | { kind: "not_purchasable"; variant: ProductVariant }
  | { kind: "incomplete" }
  | { kind: "unavailable" };

function moneyFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function availabilityForVariant(v: ProductVariant): string {
  if (v.inventory_quantity <= 0) {
    return "https://schema.org/OutOfStock";
  }
  return "https://schema.org/InStock";
}

export function collectStableProductImages(
  product: Product,
  siteBaseUrl: string
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of product.variants) {
    if (!v.image_url || isLikelyUnstableImageUrl(v.image_url)) {
      continue;
    }
    const abs = toPublicAbsoluteUrl(v.image_url, siteBaseUrl);
    if (abs && !seen.has(abs)) {
      seen.add(abs);
      out.push(abs);
    }
  }
  return out;
}

export function buildProductJsonLd(args: {
  product: Product;
  slug: string;
  siteBaseUrl: string;
  purchasable: ProductVariant[];
  selection: ProductSelectionForJsonLd;
  minPurchasableCents: number;
  maxPurchasableCents: number;
}): Record<string, unknown> {
  const {
    product,
    slug,
    siteBaseUrl,
    purchasable,
    selection,
    minPurchasableCents,
    maxPurchasableCents,
  } = args;

  const base = siteBaseUrl.replace(/\/$/, "");
  const pageUrl = `${base}/product/${encodeURIComponent(slug)}`;

  const images = collectStableProductImages(product, siteBaseUrl);
  const textDescription =
    product.description?.trim()
    || product.fabric_type?.trim()
    || product.subtitle?.trim();

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    url: pageUrl,
  };

  if (textDescription) {
    node.description = textDescription;
  }
  if (images.length > 0) {
    node.image = images;
  }

  if (purchasable.length === 0) {
    const v0 = product.variants[0];
    const cur = (v0?.currency ?? "USD").toUpperCase();
    node.offers = {
      "@type": "Offer",
      url: pageUrl,
      priceCurrency: cur,
      price: v0 ? moneyFromCents(v0.price_cents) : "0.00",
      availability: "https://schema.org/OutOfStock",
    };
    return node;
  }

  if (selection.kind === "purchasable") {
    const v = selection.variant;
    node.sku = v.sku;
    node.offers = {
      "@type": "Offer",
      url: pageUrl,
      priceCurrency: v.currency.toUpperCase(),
      price: moneyFromCents(v.price_cents),
      availability: availabilityForVariant(v),
    };
    return node;
  }

  if (selection.kind === "not_purchasable") {
    const v = selection.variant;
    node.sku = v.sku;
    node.offers = {
      "@type": "Offer",
      url: pageUrl,
      priceCurrency: v.currency.toUpperCase(),
      price: moneyFromCents(v.price_cents),
      availability: "https://schema.org/OutOfStock",
    };
    return node;
  }

  const cur = (purchasable[0]?.currency ?? "USD").toUpperCase();
  if (minPurchasableCents !== maxPurchasableCents) {
    node.offers = {
      "@type": "AggregateOffer",
      url: pageUrl,
      priceCurrency: cur,
      lowPrice: moneyFromCents(minPurchasableCents),
      highPrice: moneyFromCents(maxPurchasableCents),
      offerCount: purchasable.length,
      availability: "https://schema.org/InStock",
    };
  } else {
    node.offers = {
      "@type": "Offer",
      url: pageUrl,
      priceCurrency: cur,
      price: moneyFromCents(minPurchasableCents),
      availability: "https://schema.org/InStock",
    };
  }
  return node;
}

/**
 * Replaces a single JSON-LD script node for the PDP; removes it on unmount or when `payload` is null.
 */
export function useProductJsonLd(payload: Record<string, unknown> | null): void {
  const owner = useId().replace(/:/g, "");
  const serialized = payload == null ? null : JSON.stringify(payload);

  useEffect(() => {
    if (serialized == null) {
      const cur = document.getElementById(JSON_LD_SCRIPT_ID);
      if (cur?.getAttribute(OWNER_ATTR) === owner) {
        cur.remove();
      }
      return;
    }

    let el = document.getElementById(JSON_LD_SCRIPT_ID) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = JSON_LD_SCRIPT_ID;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.setAttribute(OWNER_ATTR, owner);
    el.textContent = serialized;
    return () => {
      const cur = document.getElementById(JSON_LD_SCRIPT_ID);
      if (cur?.getAttribute(OWNER_ATTR) === owner) {
        cur.remove();
      }
    };
  }, [owner, serialized]);
}
