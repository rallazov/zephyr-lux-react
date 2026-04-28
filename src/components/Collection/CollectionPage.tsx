import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CollectionRouteDef } from "../../catalog/collections";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogListItem } from "../../catalog/types";
import CatalogProductGrid from "../CatalogProductGrid/CatalogProductGrid";
import DiscountMessage from "../DiscountMessages/DiscountMessage";
import Hero from "../Hero/Hero";
import { usePageMeta, formatPageTitleWithBrand } from "../../seo/meta";

type Props = { collection: CollectionRouteDef };

export default function CollectionPage({ collection }: Props) {
  const [products, setProducts] = useState<CatalogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  usePageMeta({
    title: formatPageTitleWithBrand(collection.navLabel),
    description: collection.heroDescription,
    canonicalPath: collection.path,
    ogImage: collection.heroImage,
  });

  useEffect(() => {
    const run = async () => {
      try {
        setLoadError(null);
        const adapter = getDefaultCatalogAdapter();
        const list = await adapter.listProductsByCategory(collection.categoryKey);
        setProducts(list);
      } catch (error) {
        console.error("CollectionPage catalog load:", error);
        setLoadError("Could not load products. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [collection.categoryKey]);

  return (
    <>
      {collection.path === "/sale" && <DiscountMessage />}
      <Hero
        image={collection.heroImage}
        title={collection.heroTitle}
        description={collection.heroDescription}
        primaryTo="/products"
        primaryLabel="Shop all products"
        secondaryTo="/"
        secondaryLabel="Home"
      />
      <div className="product-list" style={{ padding: "0 16px 48px" }}>
        <h2 style={{ marginBottom: 16 }}>{collection.navLabel}</h2>
        {loading && !loadError && <div style={{ padding: 16 }}>Loading…</div>}
        {loadError && (
          <p style={{ color: "#b00020" }} role="alert">
            {loadError}
          </p>
        )}
        {!loadError && products.length === 0 && (
          <div style={{ padding: "24px 0", maxWidth: 420 }}>
            <p style={{ marginBottom: 16, color: "#333" }}>
              Nothing in this collection yet. Explore all styles or try another
              category.
            </p>
            <Link
              to="/products"
              style={{ color: "#1a1a1a", textDecoration: "underline" }}
            >
              Browse all products
            </Link>
          </div>
        )}
        {!loadError && products.length > 0 && (
          <CatalogProductGrid products={products} />
        )}
      </div>
    </>
  );
}
