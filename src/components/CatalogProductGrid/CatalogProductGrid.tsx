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
            <h3>
              <Link to={detailPath}>{product.title}</Link>
            </h3>
            <p>{product.fabric_type}</p>
            <p>Price: {priceLine}</p>
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
