import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogListItem } from "../../catalog/types";
import { usePageMeta, formatPageTitleWithBrand } from "../../seo/meta";
import CatalogProductGrid from "../CatalogProductGrid/CatalogProductGrid";
import "./ProductList.css";

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<CatalogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  usePageMeta({
    title: formatPageTitleWithBrand("All products"),
    description: "Browse the full Zephyr Lux catalog.",
    canonicalPath: "/products",
  });

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
      <div className="product-list bg-black text-neutral-100">
        <h1>Product List</h1>
        <div style={{ padding: 16 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="product-list bg-black text-neutral-100">
      <h1>Product List</h1>
      {loadError && (
        <p style={{ color: "#b00020", marginBottom: 16 }} role="alert">
          {loadError}
        </p>
      )}
      {!loadError && products.length === 0 && (
        <div style={{ padding: "24px 0", maxWidth: 420 }}>
          <p style={{ marginBottom: 16, color: "#d4d4d4" }}>
            There are no products available right now.
          </p>
          <Link
            to="/"
            style={{ color: "#ffffff", textDecoration: "underline" }}
          >
            Return home
          </Link>
        </div>
      )}
      {!loadError && products.length > 0 && (
        <CatalogProductGrid products={products} />
      )}
    </div>
  );
};

export default ProductList;
