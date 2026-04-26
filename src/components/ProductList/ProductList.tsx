import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogListItem } from "../../catalog/types";
import { useCart } from "../../context/CartContext";
import "./ProductList.css";

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<CatalogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    const run = async () => {
      try {
        setLoadError(null);
        const adapter = getDefaultCatalogAdapter();
        const list = await adapter.listProducts();
        setProducts(list);
      } catch (error) {
        console.error("Error loading products from catalog: ", error);
        setLoadError("Could not load products. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  if (loading && !loadError) {
    return (
      <div className="product-list">
        <h1>Product List</h1>
        <div style={{ padding: 16 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="product-list">
      <h1>Product List</h1>
      {loadError && (
        <p style={{ color: "#b00020", marginBottom: 16 }} role="alert">
          {loadError}
        </p>
      )}
      {!loadError && products.length === 0 && (
        <div style={{ padding: "24px 0", maxWidth: 420 }}>
          <p style={{ marginBottom: 16, color: "#333" }}>
            There are no products available right now.
          </p>
          <Link
            to="/"
            style={{ color: "#1a1a1a", textDecoration: "underline" }}
          >
            Return home
          </Link>
        </div>
      )}
      {!loadError && products.length > 0 && (
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
      )}
    </div>
  );
};

export default ProductList;
