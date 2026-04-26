import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";

type Row = {
  id: string;
  title: string;
  slug: string;
  status: string;
  product_variants: { id: string; price_cents: number; currency: string }[] | null;
};

function priceHint(
  v: { price_cents: number; currency: string }[] | null | undefined
): string {
  if (!v || v.length === 0) {
    return "—";
  }
  const cents = v.map((x) => x.price_cents);
  const minC = Math.min(...cents);
  const c0 = v.find((x) => x.price_cents === minC)!;
  return `${(minC / 100).toFixed(2)} ${(c0.currency || "usd").toUpperCase()}`;
}

export default function AdminProductList() {
  const supabase = getSupabaseBrowserClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        .select("id, title, slug, status, product_variants(id, price_cents, currency)")
        .order("updated_at", { ascending: false });
      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    })();
  }, [supabase]);

  if (loading) {
    return <p className="text-slate-600" data-testid="admin-product-list-loading">Loading products…</p>;
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
        <Link
          to="/admin/products/new"
          className="inline-block mt-4 text-blue-700 font-medium underline"
        >
          New product
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="admin-product-list">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <Link
          to="/admin/products/new"
          className="px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium"
        >
          New product
        </Link>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Slug</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Variants</th>
              <th className="p-3 font-medium">From price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const vars = r.product_variants ?? [];
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <Link className="text-blue-700 hover:underline" to={`/admin/products/${r.id}`}>
                      {r.title}
                    </Link>
                  </td>
                  <td className="p-3 font-mono text-slate-700">{r.slug}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">{vars.length}</td>
                  <td className="p-3">{priceHint(vars)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
