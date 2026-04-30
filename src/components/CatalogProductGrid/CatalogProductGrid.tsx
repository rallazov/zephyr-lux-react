import { Link } from "react-router-dom";
import type { CatalogListItem } from "../../catalog/types";
import { useCart } from "../../context/CartContext";
import "../ProductList/ProductList.css";

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
      className="catalog-product-grid"
      style={{
        display: "grid",
        gap: "24px",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
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
            <Link to={detailPath} className="product-item-image-link">
              <img
                src={heroImageUrl}
                alt={product.title}
              />
            </Link>
            <h3>
              <Link to={detailPath}>{product.title}</Link>
            </h3>
            {product.fabric_type ? <p className="product-item-fabric">{product.fabric_type}</p> : null}
            <p className="product-item-price">{priceLine}</p>
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
