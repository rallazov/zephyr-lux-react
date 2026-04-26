import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogListItem } from "../../catalog/types";
import { useCart } from "../../context/CartContext";
import "./ProductList.css";

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<CatalogListItem[]>([]);
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
      }
    };
    void run();
  }, []);

  return (
    <div className="product-list">
      <h1>Product List</h1>
      {loadError && (
        <p style={{ color: "#b00020", marginBottom: 16 }} role="alert">
          {loadError}
        </p>
      )}
      <div
        style={{
          display: "grid",
          gap: "20px",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        {products.map((row) => {
          const { product, storefrontProductId, minPriceCents, maxPriceCents, heroImageUrl, inStock } = row;
          const priceLine =
            minPriceCents === maxPriceCents
              ? `$${(minPriceCents / 100).toFixed(2)}`
              : `$${(minPriceCents / 100).toFixed(2)} - $${(maxPriceCents / 100).toFixed(2)}`;
          return (
            <div key={product.slug} className="product-item">
              <Link to={`/product/${product.slug}`}>
                <img
                  src={heroImageUrl}
                  alt={product.title}
                  style={{ width: "100%", height: "auto" }}
                />
              </Link>
              <h3>
                <Link to={`/product/${product.slug}`}>{product.title}</Link>
              </h3>
              <p>{product.fabric_type}</p>
              <p>Price: {priceLine}</p>
              <button
                disabled={!inStock}
                className="product-item-button"
                onClick={() =>
                  addToCart({
                    id: storefrontProductId,
                    name: product.title,
                    quantity: 1,
                    price: minPriceCents / 100,
                    image: heroImageUrl,
                  })
                }
              >
                {inStock ? "Add to Cart" : "Out of Stock"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductList;
