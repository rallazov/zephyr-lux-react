import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  filterCatalogItemsBySearchQuery,
  normalizeSearchNeedle,
} from "../../catalog/searchMatch";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogListItem } from "../../catalog/types";
import { usePageMeta, formatPageTitleWithBrand } from "../../seo/meta";
import CatalogProductGrid from "../CatalogProductGrid/CatalogProductGrid";
import "../ProductList/ProductList.css";

const Q_PARAM = "q";

export default function SearchPage() {
  const [products, setProducts] = useState<CatalogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawQ = searchParams.get(Q_PARAM);
  const qInUrl = rawQ ?? "";

  const [draft, setDraft] = useState(qInUrl);
  useEffect(() => {
    setDraft(qInUrl);
  }, [qInUrl]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fieldId = useId();

  usePageMeta({
    title: formatPageTitleWithBrand("Search"),
    description: "Search Zephyr Lux products by name or category.",
    canonicalPath: "/search",
  });

  useEffect(() => {
    const run = async () => {
      try {
        setLoadError(null);
        const adapter = getDefaultCatalogAdapter();
        const list = await adapter.listProducts();
        setProducts(list);
      } catch (error) {
        console.error("Error loading products for search: ", error);
        setLoadError("Could not load products. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const needle = useMemo(() => normalizeSearchNeedle(qInUrl), [qInUrl]);
  const hasQParam = searchParams.has(Q_PARAM);
  const whitespaceSubmitted = hasQParam && needle === null;
  const hasCommittedSearch = needle !== null;

  const hits = useMemo(() => {
    if (!hasCommittedSearch) return [];
    return filterCatalogItemsBySearchQuery(products, qInUrl);
  }, [products, qInUrl, hasCommittedSearch]);

  const trimmedDraftHasChars = normalizeSearchNeedle(draft) !== null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    const n = normalizeSearchNeedle(trimmed);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (n === null) {
          next.delete(Q_PARAM);
        } else {
          next.set(Q_PARAM, trimmed);
        }
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="product-list bg-black text-neutral-100">
      <h1>Search</h1>

      {loading && !loadError && <div style={{ padding: 16 }}>Loading…</div>}

      {!loading && (
        <>
          <form onSubmit={onSubmit} style={{ marginBottom: 24, maxWidth: 480 }}>
            <label
              htmlFor={fieldId}
              style={{ display: "block", marginBottom: 8, color: "#e5e5e5" }}
            >
              Search products
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <input
                ref={inputRef}
                id={fieldId}
                type="search"
                autoComplete="off"
                placeholder="Product name or category"
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Escape") {
                    ev.preventDefault();
                    setDraft("");
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        next.delete(Q_PARAM);
                        return next;
                      },
                      { replace: true },
                    );
                    inputRef.current?.blur();
                  }
                }}
                style={{
                  flex: "1 1 220px",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #404040",
                  background: "#0a0a0a",
                  color: "#fafafa",
                }}
              />
              <button
                type="submit"
                disabled={!trimmedDraftHasChars || Boolean(loadError)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 6,
                  border: "none",
                  background:
                    trimmedDraftHasChars && !loadError ? "#fafafa" : "#525252",
                  color: trimmedDraftHasChars && !loadError ? "#0a0a0a" : "#a3a3a3",
                  cursor:
                    trimmedDraftHasChars && !loadError ? "pointer" : "not-allowed",
                }}
              >
                Search
              </button>
            </div>
            {!trimmedDraftHasChars && !loadError && (
              <p style={{ marginTop: 12, fontSize: 14, color: "#a3a3a3" }}>
                Enter a search term and press Enter or Search to find products.
              </p>
            )}
          </form>

          {loadError && (
            <p style={{ color: "#b00020", marginBottom: 16 }} role="alert">
              {loadError}
            </p>
          )}

          {whitespaceSubmitted && (
            <p role="status" style={{ marginBottom: 16, color: "#d4d4d4" }}>
              Enter a search term to see matching products — spaces alone are not enough.
            </p>
          )}

          {!loadError && hasCommittedSearch && hits.length === 0 && (
            <section
              aria-labelledby="search-empty-heading"
              style={{
                padding: "32px 0",
                maxWidth: 440,
                borderTop: "1px solid #262626",
              }}
            >
              <h2 id="search-empty-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
                No matching products
              </h2>
              <p style={{ marginBottom: 20, color: "#d4d4d4" }}>
                Nothing in the catalog matches &ldquo;{qInUrl.trim()}&rdquo;. Try another term or
                browse the full catalog.
              </p>
              <p style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                <Link
                  to="/products"
                  style={{ color: "#ffffff", textDecoration: "underline", fontWeight: 500 }}
                >
                  Browse all products
                </Link>
                <Link to="/" style={{ color: "#ffffff", textDecoration: "underline" }}>
                  Return home
                </Link>
              </p>
            </section>
          )}

          {!loadError && hasCommittedSearch && hits.length > 0 && (
            <>
              <p style={{ marginBottom: 16, color: "#a3a3a3" }} aria-live="polite">
                {hits.length === 1 ? "1 match" : `${hits.length} matches`}
              </p>
              <CatalogProductGrid products={hits} />
            </>
          )}
        </>
      )}
    </div>
  );
}
