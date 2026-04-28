import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ANALYTICS_EVENTS } from "../../analytics/events";
import { dispatchAnalyticsEvent } from "../../analytics/sink";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import { resolvePdpHeroImageUrl } from "../../catalog/pdpImage";
import type { CatalogProductDetail } from "../../catalog/types";
import { useCart } from "../../context/CartContext";
import type { ProductVariant } from "../../domain/commerce";
import { usePageMeta } from "../../seo/meta";
import {
  buildProductJsonLd,
  useProductJsonLd,
  type ProductSelectionForJsonLd,
} from "../../seo/productJsonLd";
import {
  DEFAULT_META_DESCRIPTION,
  getPublicSiteBaseUrl,
  isLikelyUnstableImageUrl,
  SITE_BRAND,
  toPublicAbsoluteUrl,
} from "../../seo/site";
import ProductImageGallery from "./ProductImageGallery";
import { pdpCtaState } from "./pdpCta";
import {
  colorsForSize,
  computeOptionLayout,
  formatOptionLabel,
  getPurchasableVariants,
  lowStockMessage,
  minMaxPriceCentsFromPurchasable,
  resolveSelection,
} from "./variantSelection";
import VariantSelector from "./VariantSelector";

function variantNameSuffix(v: ProductVariant | null): string {
  if (!v) {
    return "";
  }
  const parts: string[] = [];
  if (v.size) {
    parts.push(String(v.size));
  }
  if (v.color) {
    parts.push(formatOptionLabel(String(v.color)));
  }
  return parts.length ? ` — ${parts.join(" / ")}` : "";
}

function PlainTextBlocks({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\n+/).filter(Boolean);
  if (blocks.length === 0) {
    return null;
  }
  return (
    <div className="prose prose-stone prose-sm max-w-none">
      {blocks.map((b, i) => (
        <p key={i} className="whitespace-pre-wrap text-stone-700">
          {b}
        </p>
      ))}
    </div>
  );
}

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  /** React Router provides `key` at runtime; typings omit it in some versions. */
  const locationNavKey =
    typeof (location as { key?: string }).key === "string"
      ? (location as { key: string }).key
      : "";
  const [row, setRow] = useState<CatalogProductDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();
  const [selSize, setSelSize] = useState<string | null>(null);
  const [selColor, setSelColor] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!slug) {
        setError("Product not found");
        setLoading(false);
        return;
      }
      try {
        const adapter = getDefaultCatalogAdapter();
        const found = await adapter.getProductBySlug(slug);
        if (!found) {
          setError("Product not found");
        } else {
          setRow(found);
        }
      } catch {
        setError("Failed to load product");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug]);

  useEffect(() => {
    if (!slug || !row?.product) return;
    const storageKey = `analytics_product_view:${slug}:${locationNavKey}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    const productId = row.product.id;
    dispatchAnalyticsEvent({
      name: ANALYTICS_EVENTS.product_view,
      payload: {
        slug,
        ...(productId ? { product_id: productId } : {}),
      },
    });
  }, [slug, row, locationNavKey]);

  const product = row?.product;

  const catalogGallery = useMemo(() => {
    if (!row) {
      return {
        galleryImages: [] as string[],
        displayGalleryUrls: [] as string[],
        variantPrimaryImageBySku: {} as Partial<Record<string, string>>,
      };
    }
    return {
      galleryImages: row.galleryImages,
      displayGalleryUrls: row.displayGalleryUrls,
      variantPrimaryImageBySku: row.variantPrimaryImageBySku,
    };
  }, [row]);

  const purchasable = useMemo(
    () => (product ? getPurchasableVariants(product.variants) : []),
    [product]
  );
  const layout = useMemo(
    () => computeOptionLayout(purchasable),
    [purchasable]
  );

  const purchasableSkuKey = useMemo(
    () => purchasable.map((v) => v.sku).sort().join(","),
    [purchasable]
  );

  useEffect(() => {
    if (!product) {
      return;
    }
    if (layout.autoSelectSingle && purchasable.length === 1) {
      const v = purchasable[0];
      setSelSize(v.size != null ? String(v.size) : null);
      setSelColor(v.color != null ? String(v.color) : null);
    } else {
      setSelSize(null);
      setSelColor(null);
    }
  }, [product, layout.autoSelectSingle, purchasableSkuKey, purchasable]);

  useEffect(() => {
    if (!layout.showSize || !layout.showColor) {
      return;
    }
    if (!selSize) {
      return;
    }
    const valid = colorsForSize(purchasable, selSize);
    if (selColor && !valid.includes(selColor)) {
      setSelColor(null);
    }
  }, [selSize, purchasable, layout.showSize, layout.showColor, selColor]);

  const selectionRes = useMemo(
    () =>
      product
        ? resolveSelection(
            product.variants,
            purchasable,
            layout,
            { size: selSize, color: selColor }
          )
        : { kind: "incomplete" as const },
    [product, purchasable, layout, selSize, selColor]
  );

  const selectedVariant: ProductVariant | null =
    selectionRes.kind === "purchasable" ? selectionRes.variant : null;

  const gallerySelectionKey = `${selectedVariant?.sku ?? "none"}|${selSize ?? ""}|${selColor ?? ""}`;

  const { min: pMin, max: pMax } = useMemo(
    () => (product ? minMaxPriceCentsFromPurchasable(purchasable) : { min: 0, max: 0 }),
    [product, purchasable]
  );

  const cta = product
    ? pdpCtaState(purchasable, layout, product.variants, selSize, selColor)
    : {
        disabled: true,
        text: "Add to cart",
        hint: "",
      };

  const resolvedHeroUrl = useMemo(() => {
    if (!product) {
      return "";
    }
    return resolvePdpHeroImageUrl({
      selectedVariant,
      productLevelGallery: catalogGallery.galleryImages,
      displayGalleryUrls: catalogGallery.displayGalleryUrls,
      variantPrimaryImageBySku: catalogGallery.variantPrimaryImageBySku,
      fallbackVariant: purchasable[0] ?? null,
    });
  }, [
    product,
    selectedVariant,
    catalogGallery.galleryImages,
    catalogGallery.displayGalleryUrls,
    catalogGallery.variantPrimaryImageBySku,
    purchasable,
  ]);

  const originBase =
    getPublicSiteBaseUrl()
    || (typeof globalThis !== "undefined" &&
      "location" in globalThis &&
      globalThis.location
      ? globalThis.location.origin
      : "http://localhost:5173");

  const selectionForJsonLd: ProductSelectionForJsonLd = useMemo(() => {
    if (selectionRes.kind === "purchasable" || selectionRes.kind === "not_purchasable") {
      return selectionRes;
    }
    if (selectionRes.kind === "incomplete") {
      return { kind: "incomplete" };
    }
    return { kind: "unavailable" };
  }, [selectionRes]);

  const pageMeta = useMemo(() => {
    const path = slug ? `/product/${slug}` : "/product";
    const origin = originBase.replace(/\/$/, "");
    if (loading) {
      return {
        title: `${SITE_BRAND} — Loading`,
        description: DEFAULT_META_DESCRIPTION,
        canonicalPath: path,
        ogType: "website",
        ogTitle: SITE_BRAND,
        ogDescription: DEFAULT_META_DESCRIPTION,
        ogUrl: `${origin}${path}`,
      };
    }
    if (error) {
      const notFound = /not found/i.test(error);
      return {
        title: notFound ? `Not found — ${SITE_BRAND}` : `Error — ${SITE_BRAND}`,
        description: notFound
          ? "This product could not be found."
          : "Something went wrong loading this product.",
        canonicalPath: path,
        ogType: "website",
        ogTitle: notFound ? `Not found — ${SITE_BRAND}` : SITE_BRAND,
        ogDescription: notFound
          ? "This product could not be found."
          : DEFAULT_META_DESCRIPTION,
        ogUrl: `${origin}${path}`,
        ogImage: null as string | null,
      };
    }
    if (!row || !product) {
      return {
        title: SITE_BRAND,
        description: DEFAULT_META_DESCRIPTION,
        canonicalPath: path,
        ogType: "website",
      };
    }
    let ogImage: string | null = null;
    if (resolvedHeroUrl) {
      if (resolvedHeroUrl.includes("://")) {
        ogImage = isLikelyUnstableImageUrl(resolvedHeroUrl) ? null : resolvedHeroUrl;
      } else {
        ogImage = toPublicAbsoluteUrl(resolvedHeroUrl, origin);
      }
    }
    const desc =
      product.description?.trim()
      || product.fabric_type?.trim()
      || DEFAULT_META_DESCRIPTION;
    return {
      title: `${product.title} — ${SITE_BRAND}`,
      description: desc,
      canonicalPath: path,
      ogType: "product",
      ogTitle: `${product.title} — ${SITE_BRAND}`,
      ogDescription: desc,
      ogUrl: `${origin}${path}`,
      ogImage,
    };
  }, [
    loading,
    error,
    slug,
    row,
    product,
    resolvedHeroUrl,
    originBase,
  ]);

  usePageMeta(pageMeta);

  const siteForLd = originBase.replace(/\/$/, "");

  const productJsonLdPayload = useMemo(() => {
    if (loading || error || !row?.product || !slug) {
      return null;
    }
    return buildProductJsonLd({
      product: row.product,
      slug,
      siteBaseUrl: siteForLd,
      purchasable,
      selection: selectionForJsonLd,
      minPurchasableCents: pMin,
      maxPurchasableCents: pMax,
    });
  }, [
    loading,
    error,
    row?.product,
    slug,
    purchasable,
    selectionForJsonLd,
    pMin,
    pMax,
    siteForLd,
  ]);

  useProductJsonLd(productJsonLdPayload);

  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{ padding: 16 }}>
        Loading…
      </div>
    );
  }
  if (error) {
    const isNotFound = /not found/i.test(error);
    return (
      <div
        data-testid={
          isNotFound ? "product-detail-not-found" : "product-detail-load-error"
        }
        role="alert"
        style={{ padding: 16 }}
      >
        <h1>{isNotFound ? "Product not found" : "Something went wrong"}</h1>
        <p>{error}</p>
        <Link to="/products">Back to products</Link>
      </div>
    );
  }
  if (!row || !product) {
    return null;
  }

  const { storefrontProductId } = row;
  const showPriceRange = selectionRes.kind === "incomplete" && pMin !== pMax;
  const showSelectCopy = selectionRes.kind === "incomplete" && pMin === pMax;

  const addHandler = () => {
    if (cta.disabled || !selectedVariant) {
      return;
    }
    const price = selectedVariant.price_cents / 100;
    const img = resolvePdpHeroImageUrl({
      selectedVariant,
      productLevelGallery: catalogGallery.galleryImages,
      displayGalleryUrls: catalogGallery.displayGalleryUrls,
      variantPrimaryImageBySku: catalogGallery.variantPrimaryImageBySku,
      fallbackVariant: purchasable[0] ?? null,
    });
    addToCart({
      id: storefrontProductId,
      name: `${product.title}${variantNameSuffix(selectedVariant)}`,
      quantity: 1,
      price,
      image: img,
      sku: selectedVariant.sku,
      variant_id: selectedVariant.id,
      product_slug: product.slug,
    });
  };

  return (
    <div
      data-testid="pdp"
      className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2 lg:gap-10 lg:p-8 max-w-6xl mx-auto"
    >
      <div>
        <ProductImageGallery
          urls={catalogGallery.displayGalleryUrls}
          resolvedHeroUrl={resolvedHeroUrl}
          alt={product.title}
          selectionKey={gallerySelectionKey}
        />
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 mb-2">
          {product.title}
        </h1>
        {selectedVariant && (
          <p data-testid="pdp-selected-price" className="font-semibold text-lg mb-2">
            ${(selectedVariant.price_cents / 100).toFixed(2)}
          </p>
        )}
        {showPriceRange && (
          <p data-testid="pdp-price-range" className="font-semibold text-lg mb-2">
            ${(pMin / 100).toFixed(2)}&nbsp;–&nbsp;${(pMax / 100).toFixed(2)}
          </p>
        )}
        {showSelectCopy && purchasable.length > 0 && (
          <p
            data-testid="pdp-price-select"
            className="text-stone-600 text-sm mb-2"
          >
            ${(pMin / 100).toFixed(2)} — select options to confirm price.
          </p>
        )}

        {selectedVariant && (
          <p data-testid="pdp-stock-message" className="text-stone-800 text-sm mb-3">
            {selectedVariant.inventory_quantity === 0
              ? "Out of stock for this color and size."
              : lowStockMessage(selectedVariant) ?? "In stock."}
          </p>
        )}
        {purchasable.length === 0 && (
          <p data-testid="pdp-oos" className="text-stone-800 text-sm mb-3">
            Unavailable. No purchasable variants.
          </p>
        )}

        <VariantSelector
          purchasable={purchasable}
          layout={layout}
          selectedSize={selSize}
          selectedColor={selColor}
          onSizeChange={setSelSize}
          onColorChange={setSelColor}
        />

        {product.fabric_type ? (
          <p className="text-stone-600 text-sm mt-3 mb-4">{product.fabric_type}</p>
        ) : (
          <div className="mb-4" />
        )}

        <div className="flex flex-col gap-2 mb-8">
          <button
            type="button"
            data-testid="pdp-add-to-cart"
            disabled={cta.disabled}
            onClick={addHandler}
            className="product-item-button"
            aria-describedby="pdp-add-hint"
            aria-label={
              cta.disabled
                ? `Add to cart. ${cta.hint} Currently disabled.`
                : "Add to cart"
            }
          >
            {cta.text}
          </button>
          <p id="pdp-add-hint" className="sr-only">
            {cta.hint}
          </p>
        </div>

        <section
          className="border-t border-stone-200 pt-6 text-sm text-stone-600 space-y-2"
          aria-labelledby="pdp-trust-heading"
        >
          <h2 id="pdp-trust-heading" className="text-base font-medium text-stone-900">
            Shipping &amp; returns
          </h2>
          <p>
            Standard processing is typically 1–2 business days. Read our{" "}
            <Link to="/policies/shipping" className="underline text-stone-900 font-medium">
              shipping policy
            </Link>{" "}
            and{" "}
            <Link to="/policies/returns" className="underline text-stone-900 font-medium">
              returns policy
            </Link>
            .
          </p>
        </section>

        {product.description ? (
          <section className="mt-8" aria-labelledby="pdp-desc-heading">
            <h2
              id="pdp-desc-heading"
              className="text-base font-medium text-stone-900 mb-3"
            >
              Details
            </h2>
            <PlainTextBlocks text={product.description} />
          </section>
        ) : null}

        {product.care_instructions ? (
          <section className="mt-8" aria-labelledby="pdp-care-heading">
            <h2
              id="pdp-care-heading"
              className="text-base font-medium text-stone-900 mb-3"
            >
              Care
            </h2>
            <PlainTextBlocks text={product.care_instructions} />
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default ProductDetail;
