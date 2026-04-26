import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogProductDetail } from "../../catalog/types";
import { useCart } from "../../context/CartContext";
import type { ProductVariant } from "../../domain/commerce";
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

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
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

  const product = row?.product;
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
    // purchasableSkuKey replaces `purchasable` in deps to avoid array identity noise.
  }, [product, layout.autoSelectSingle, purchasableSkuKey]);

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
  const heroFromSelection =
    selectedVariant?.image_url
    || purchasable[0]?.image_url
    || product.variants[0]?.image_url
    || "";
  const showPriceRange = selectionRes.kind === "incomplete" && pMin !== pMax;
  const showSelectCopy = selectionRes.kind === "incomplete" && pMin === pMax;

  const addHandler = () => {
    if (cta.disabled || !selectedVariant) {
      return;
    }
    const price = selectedVariant.price_cents / 100;
    const img = selectedVariant.image_url || heroFromSelection;
    addToCart({
      id: storefrontProductId,
      name: `${product.title}${variantNameSuffix(selectedVariant)}`,
      quantity: 1,
      price,
      image: img,
      sku: selectedVariant.sku,
    });
  };

  return (
    <div
      data-testid="pdp"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        padding: 16,
      }}
    >
      <div>
        <img
          src={heroFromSelection}
          alt={product.title}
          style={{ width: "100%", height: "auto" }}
        />
      </div>
      <div>
        <h1 style={{ marginBottom: 8 }}>{product.title}</h1>
        {selectedVariant && (
          <p data-testid="pdp-selected-price" style={{ fontWeight: 600, marginBottom: 8 }}>
            ${(selectedVariant.price_cents / 100).toFixed(2)}
          </p>
        )}
        {showPriceRange && (
          <p data-testid="pdp-price-range" style={{ fontWeight: 600, marginBottom: 8 }}>
            ${(pMin / 100).toFixed(2)}&nbsp;–&nbsp;${(pMax / 100).toFixed(2)}
          </p>
        )}
        {showSelectCopy && purchasable.length > 0 && (
          <p
            data-testid="pdp-price-select"
            style={{ color: "#555", marginBottom: 8 }}
          >
            ${(pMin / 100).toFixed(2)} — select options to confirm price.
          </p>
        )}

        {selectedVariant && (
          <p
            data-testid="pdp-stock-message"
            style={{ color: "#333", marginBottom: 8 }}
          >
            {selectedVariant.inventory_quantity === 0
              ? "Out of stock for this color and size."
              : lowStockMessage(selectedVariant) ?? "In stock."}
          </p>
        )}
        {purchasable.length === 0 && (
          <p data-testid="pdp-oos" style={{ color: "#333", marginBottom: 8 }}>
            Unavailable. No purchasable variants.
          </p>
        )}

        {layout.showSize || layout.showColor ? (
          <VariantSelector
            purchasable={purchasable}
            layout={layout}
            selectedSize={selSize}
            selectedColor={selColor}
            onSizeChange={setSelSize}
            onColorChange={setSelColor}
          />
        ) : null}

        <p style={{ color: "#666", marginBottom: 16 }}>{product.fabric_type}</p>
        <div className="flex flex-col gap-2">
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
      </div>
    </div>
  );
};

export default ProductDetail;
