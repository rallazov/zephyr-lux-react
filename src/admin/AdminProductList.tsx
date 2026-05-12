import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COLLECTION_ROUTES } from "../catalog/collections";
import { normalizeCategoryKey, resolveCanonicalCategoryKey } from "../catalog/categoryNormalize";
import { PDP_IMAGE_PLACEHOLDER } from "../catalog/pdpImage";
import { resolveProductImageUrl } from "../catalog/productImageUrl";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";

type VariantRow = {
  id: string;
  sku: string;
  price_cents: number;
  currency: string;
  inventory_quantity: number;
  status: string;
};

type ImageRow = {
  storage_path: string;
  sort_order: number;
  is_primary: boolean;
  variant_id: string | null;
};

type CollectionRow = {
  collection_key: string;
};

type Row = {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  product_variants: VariantRow[] | null;
  product_images: ImageRow[] | null;
  product_collection_assignments: CollectionRow[] | null;
};

const statusOptions = ["all", "draft", "active", "coming_soon", "archived"] as const;

const collectionLabelByKey = new Map(
  COLLECTION_ROUTES.map((c) => [c.categoryKey, c.navLabel] as const),
);

function priceHint(v: VariantRow[] | null | undefined): string {
  if (!v || v.length === 0) return "-";
  const cents = v.map((x) => x.price_cents);
  const minC = Math.min(...cents);
  const maxC = Math.max(...cents);
  const c0 = v.find((x) => x.price_cents === minC)!;
  const cur = (c0.currency || "usd").toUpperCase();
  if (minC === maxC) return `$${(minC / 100).toFixed(2)} ${cur}`;
  return `$${(minC / 100).toFixed(2)} - $${(maxC / 100).toFixed(2)} ${cur}`;
}

function stockHint(v: VariantRow[] | null | undefined): { label: string; tone: string } {
  const variants = v ?? [];
  if (variants.length === 0) return { label: "No variants", tone: "text-slate-500" };
  const total = variants.reduce((sum, row) => sum + Math.max(0, row.inventory_quantity ?? 0), 0);
  const purchasable = variants.filter((row) => row.status === "active" && row.inventory_quantity > 0).length;
  if (total === 0 || purchasable === 0) return { label: `${total} on hand`, tone: "text-red-700" };
  if (total <= 5) return { label: `${total} on hand`, tone: "text-amber-700" };
  return { label: `${total} on hand`, tone: "text-emerald-700" };
}

function collectionKeys(row: Row): string[] {
  const explicit = (row.product_collection_assignments ?? [])
    .map((r) => r.collection_key.trim())
    .filter(Boolean);
  if (explicit.length > 0) return [...new Set(explicit)].sort();
  const normalized = normalizeCategoryKey(row.category);
  return normalized ? [resolveCanonicalCategoryKey(normalized)] : [];
}

function heroImage(row: Row): string {
  const images = [...(row.product_images ?? [])]
    .filter((img) => img.storage_path.trim())
    .sort((a, b) => {
      if (a.variant_id !== b.variant_id) return a.variant_id === null ? -1 : 1;
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  return resolveProductImageUrl(images[0]?.storage_path) || PDP_IMAGE_PLACEHOLDER;
}

function statusPill(status: string): string {
  if (status === "active") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "coming_soon") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "archived") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-blue-50 text-blue-800 ring-blue-200";
}

export default function AdminProductList() {
  const supabase = getSupabaseBrowserClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("all");
  const [collection, setCollection] = useState("all");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("products")
        .select(
          [
            "id, title, slug, status, category",
            "product_variants(id, sku, price_cents, currency, inventory_quantity, status)",
            "product_images(storage_path, sort_order, is_primary, variant_id)",
            "product_collection_assignments(collection_key)",
          ].join(", "),
        )
        .order("updated_at", { ascending: false });
      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as unknown as Row[]);
      }
      setLoading(false);
    })();
  }, [supabase]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      const keys = collectionKeys(row);
      if (collection !== "all" && !keys.includes(collection)) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        (row.category ?? "").toLowerCase().includes(q) ||
        (row.product_variants ?? []).some((v) => v.sku.toLowerCase().includes(q))
      );
    });
  }, [collection, query, rows, status]);

  if (loading) {
    return <p className="text-slate-600" data-testid="admin-product-list-loading">Loading products...</p>;
  }
  if (err) {
    return (
      <div className="text-red-800" data-testid="admin-product-list-error" role="alert">
        {err}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div data-testid="admin-product-list-empty" className="text-center py-12 border border-dashed border-slate-200 rounded-lg bg-white">
        <h2 className="text-lg font-medium text-slate-800">No products yet</h2>
        <p className="text-slate-600 mt-2">Create a product to start your catalog in Supabase.</p>
        <Link to="/admin/products/new" className="inline-block mt-4 text-blue-700 font-medium underline">
          New product
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="admin-product-list" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catalog manager</h1>
          <p className="text-sm text-slate-600 mt-1">
            {rows.length} product{rows.length === 1 ? "" : "s"} in catalog
          </p>
        </div>
        <Link
          to="/admin/products/new"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          New product
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-3 grid gap-3 md:grid-cols-[1fr_12rem_12rem]">
        <label className="block text-sm">
          <span className="text-slate-600">Search</span>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, slug, category"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Status</span>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof statusOptions)[number])}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Collection</span>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="all">All collections</option>
            {COLLECTION_ROUTES.map((c) => (
              <option key={c.categoryKey} value={c.categoryKey}>
                {c.navLabel}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Collections</th>
                <th className="p-3 font-medium">Price</th>
                <th className="p-3 font-medium">Stock</th>
                <th className="p-3 font-medium">Variants</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const vars = row.product_variants ?? [];
                const stock = stockHint(vars);
                const keys = collectionKeys(row);
                return (
                  <tr key={row.id} className="border-t border-slate-100 align-middle">
                    <td className="p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={heroImage(row)}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded border border-slate-200 object-cover bg-slate-100"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = PDP_IMAGE_PLACEHOLDER;
                          }}
                        />
                        <div className="min-w-0">
                          <Link className="font-medium text-blue-700 hover:underline" to={`/admin/products/${row.id}`}>
                            {row.title}
                          </Link>
                          <div className="mt-1 font-mono text-xs text-slate-500 truncate">{row.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${statusPill(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {keys.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {keys.map((key) => (
                            <span key={key} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                              {collectionLabelByKey.get(key) ?? key}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">{priceHint(vars)}</td>
                    <td className={`p-3 whitespace-nowrap font-medium ${stock.tone}`}>{stock.label}</td>
                    <td className="p-3">{vars.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRows.length === 0 ? (
          <p className="border-t border-slate-100 p-6 text-center text-sm text-slate-500">
            No products match those filters.
          </p>
        ) : null}
      </div>
    </div>
  );
}
