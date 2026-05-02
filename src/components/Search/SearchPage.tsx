import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link, useSearchParams } from "react-router-dom";
import {
  filterCatalogItemsBySearchQuery,
  normalizeSearchNeedle,
} from "../../catalog/searchMatch";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogListItem } from "../../catalog/types";
import { usePageMeta, formatPageTitleWithBrand } from "../../seo/meta";
import CatalogProductGrid from "../CatalogProductGrid/CatalogProductGrid";
import "./SearchPage.css";

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
  const visibleProducts = hasCommittedSearch ? hits : products;
  const resultHeading = hasCommittedSearch
    ? `Results for "${qInUrl.trim()}"`
    : "Browse the catalog";
  const resultCount =
    visibleProducts.length === 1
      ? "1 product"
      : `${visibleProducts.length} products`;

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
    <div className="search-page">
      <header className="search-page__header">
        <div>
          <p className="search-page__eyebrow">Product discovery</p>
          <h1>Search</h1>
          <p className="search-page__intro">
            Find Zephyr Lux styles by product name or category.
          </p>
        </div>

        <form className="search-page__form" role="search" onSubmit={onSubmit}>
          <label className="search-page__label" htmlFor={fieldId}>
            Search products
          </label>
          <div className="search-page__control">
            <input
              ref={inputRef}
              id={fieldId}
              className="search-page__input"
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
            />
            <button
              className="search-page__icon-button search-page__clear"
              type="button"
              aria-label="Clear search"
              title="Clear search"
              disabled={draft.length === 0}
              onClick={() => {
                setDraft("");
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete(Q_PARAM);
                    return next;
                  },
                  { replace: true },
                );
                inputRef.current?.focus();
              }}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <button
              className="search-page__icon-button search-page__submit"
              type="submit"
              aria-label="Search"
              title="Search"
              disabled={!trimmedDraftHasChars || Boolean(loadError)}
            >
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </button>
          </div>

          {whitespaceSubmitted && (
            <p role="status" className="search-page__message">
              Search needs a product name or category; spaces alone will not return products.
            </p>
          )}
        </form>
      </header>

      <div className="search-page__body">
        {loading && !loadError && <p className="search-page__message">Loading catalog...</p>}

        {!loading && (
          <>
            {loadError && (
              <p className="search-page__message search-page__message--error" role="alert">
                {loadError}
              </p>
            )}

            {!loadError && hasCommittedSearch && hits.length === 0 && (
              <section className="search-page__empty" aria-labelledby="search-empty-heading">
                <h2 id="search-empty-heading">No matching products</h2>
                <p>
                  Nothing in the catalog matches &ldquo;{qInUrl.trim()}&rdquo;.
                </p>
                <div className="search-page__links">
                  <Link to="/products" className="search-page__link">
                    Browse all products
                  </Link>
                  <Link to="/" className="search-page__link">
                    Return home
                  </Link>
                </div>
              </section>
            )}

            {!loadError && visibleProducts.length > 0 && (
              <section aria-labelledby="search-results-heading">
                <div className="search-page__results-bar">
                  <h2 id="search-results-heading">{resultHeading}</h2>
                  <p className="search-page__count" aria-live="polite">
                    {resultCount}
                  </p>
                </div>
                <CatalogProductGrid products={visibleProducts} />
              </section>
            )}

            {!loadError && !hasCommittedSearch && visibleProducts.length === 0 && (
              <section className="search-page__empty" aria-labelledby="search-empty-heading">
                <h2 id="search-empty-heading">No products available</h2>
                <p>The catalog is empty right now.</p>
                <div className="search-page__links">
                  <Link to="/" className="search-page__link">
                    Return home
                  </Link>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
