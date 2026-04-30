import { Link } from "react-router-dom";
import type { CatalogListItem } from "../../catalog/types";
import { useCart } from "../../context/CartContext";

type Props = {
  products: CatalogListItem[];
};

/**
 * Shared storefront grid for product cards (list + collection routes).
 */
export default function CatalogProductGrid({ products }: Props) {
  const { addToCart } = useCart();

  return (
    <div
      style={{
        display: "grid",
        gap: "20px",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
      }}
    >
      {products.map((row) => {
        const {
          product,
          storefrontProductId,
          minPriceCents,
          maxPriceCents,
          heroImageUrl,
          inStock,
          purchasableVariantCount,
        } = row;
        const priceLine =
          minPriceCents === maxPriceCents
            ? `$${(minPriceCents / 100).toFixed(2)}`
            : `$${(minPriceCents / 100).toFixed(2)} - $${(maxPriceCents / 100).toFixed(2)}`;
        const singlePurchasable =
          purchasableVariantCount === 1
            ? product.variants.find(
                (v) =>
                  v.status === "active" && v.inventory_quantity > 0
              )
            : undefined;
        const detailPath = `/product/${product.slug}`;

        return (
          <div key={product.slug} className="product-item">
            <Link to={detailPath}>
              <img
                src={heroImageUrl}
                alt={product.title}
                style={{ width: "100%", height: "auto" }}
              />
            </Link>
            <h3 style={{ marginBottom: 6, marginTop: 12, fontSize: 18 }}>
              <Link to={detailPath} style={{ color: "#f5f5f5" }}>{product.title}</Link>
            </h3>
            <p style={{ color: "#a8a8a8", marginTop: 0 }}>{product.fabric_type}</p>
            <p style={{ fontWeight: 800, fontSize: 20, marginTop: 8 }}>Price: {priceLine}</p>
            {singlePurchasable ? (
              <button
                type="button"
                disabled={!inStock}
                className="product-item-button"
                onClick={() =>
                  addToCart({
                    id: storefrontProductId,
                    name: product.title,
                    quantity: 1,
                    price: singlePurchasable.price_cents / 100,
                    image:
                      singlePurchasable.image_url ?? heroImageUrl,
                    sku: singlePurchasable.sku,
                    variant_id: singlePurchasable.id,
                    product_slug: product.slug,
                  })
                }
              >
                {inStock ? "Add to Cart" : "Out of Stock"}
              </button>
            ) : (
              <Link
                to={detailPath}
                className="product-item-button"
                style={{
                  display: "inline-block",
                  boxSizing: "border-box",
                  width: "100%",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                View details
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
