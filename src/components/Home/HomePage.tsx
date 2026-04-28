import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { productCategoryMatchesCanonical } from "../../catalog/categoryNormalize";
import { COLLECTION_ROUTES } from "../../catalog/collections";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogListItem } from "../../catalog/types";
import { usePageMeta } from "../../seo/meta";
import { SITE_BRAND } from "../../seo/site";
import Hero from "../Hero/Hero";

export default function HomePage() {
  const location = useLocation();
  const [products, setProducts] = useState<CatalogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoadError(null);
        const adapter = getDefaultCatalogAdapter();
        const list = await adapter.listProducts();
        if (!cancelled) setProducts(list);
      } catch (error) {
        console.error("HomePage catalog load:", error);
        if (!cancelled) {
          setLoadError(
            "We couldn't load the catalog right now. You can still browse collections below."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredCollection = useMemo(() => {
    for (const c of COLLECTION_ROUTES) {
      if (
        products.some((row) =>
          productCategoryMatchesCanonical(row.product.category, c.categoryKey)
        )
      ) {
        return c;
      }
    }
    return COLLECTION_ROUTES[0];
  }, [products]);

  const heroDescription =
    loadError
      ? "Discover thoughtfully crafted comfort. Explore collections below or open the full catalog."
      : loading
        ? "Loading the catalog… Explore collections below or open the full catalog."
        : products.length === 0
          ? "We're preparing our assortment — explore collections below or browse all products when listings go live."
          : "Discover thoughtfully crafted comfort — elevated basics for everyday confidence.";

  usePageMeta({
    title: `${SITE_BRAND} — Premium essentials`,
    description: heroDescription,
    canonicalPath: location.pathname,
    ogTitle: `${SITE_BRAND} — Premium essentials`,
    ogDescription: heroDescription,
  });

  if (loading && !loadError) {
    return (
      <main>
        <Hero
          title={
            <>
              Zephyr Lux
              <br />
              <span className="text-red-400">Premium essentials</span>
            </>
          }
          description="Loading the catalog…"
          primaryTo="/products"
          primaryLabel="Shop all products"
          secondaryTo={COLLECTION_ROUTES[0]?.path ?? "/products"}
          secondaryLabel={`Shop ${COLLECTION_ROUTES[0]?.navLabel ?? "collection"}`}
        />
        <section
          style={{ padding: "24px 16px 48px", maxWidth: 720, margin: "0 auto" }}
          aria-busy="true"
          aria-live="polite"
        >
          <h2 className="text-xl font-semibold text-neutral-100 mb-3">
            Browse by collection
          </h2>
          <p className="text-neutral-400 text-sm">Preparing links…</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Hero
        title={
          <>
            Zephyr Lux
            <br />
            <span className="text-red-400">Premium essentials</span>
          </>
        }
        description={heroDescription}
        primaryTo="/products"
        primaryLabel="Shop all products"
        secondaryTo={featuredCollection.path}
        secondaryLabel={`Shop ${featuredCollection.navLabel}`}
      />
      {loadError && (
        <p style={{ padding: "0 24px 16px", color: "#b00020" }} role="alert">
          {loadError}
        </p>
      )}
      <section
        style={{ padding: "24px 16px 48px", maxWidth: 720, margin: "0 auto" }}
      >
        <h2 className="text-xl font-semibold text-neutral-100 mb-3">
          Browse by collection
        </h2>
        <ul
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {COLLECTION_ROUTES.map((c) => (
            <li key={c.path}>
              <Link
                to={c.path}
                className="inline-block rounded-md border border-neutral-600 px-3.5 py-2 text-neutral-100 no-underline transition-colors hover:border-amber-500/70 hover:text-amber-100"
              >
                {c.navLabel}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
