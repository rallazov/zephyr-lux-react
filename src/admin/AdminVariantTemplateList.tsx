import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";
import type { VariantTemplateStatus } from "../domain/commerce/variantTemplate";

type OptRow = { id: string };
type AxisRow = { id: string; variant_template_axis_options?: OptRow[] | null };

type TemplateListRow = {
  id: string;
  name: string;
  status: VariantTemplateStatus;
  updated_at: string | null;
  variant_template_axes?: AxisRow[] | null;
};

function summarizeTemplate(r: TemplateListRow): {
  axes: number;
  options: number;
} {
  const axesArr = [...(r.variant_template_axes ?? [])];
  let options = 0;
  for (const a of axesArr) options += (a.variant_template_axis_options ?? []).length;
  return { axes: axesArr.length, options };
}

export default function AdminVariantTemplateList() {
  const supabase = getSupabaseBrowserClient();
  const [rows, setRows] = useState<TemplateListRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("variant_templates")
        .select(
          "id, name, status, updated_at, variant_template_axes(id, variant_template_axis_options(id))",
        )
        .order("updated_at", { ascending: false });
      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as TemplateListRow[]);
      }
      setLoading(false);
    })();
  }, [supabase]);

  if (!supabase) {
    return <p className="text-slate-600">Supabase is not configured.</p>;
  }
  if (loading) {
    return (
      <p className="text-slate-600" data-testid="admin-variant-template-list-loading">
        Loading templates…
      </p>
    );
  }
  if (err) {
    return (
      <div className="text-red-800" role="alert" data-testid="admin-variant-template-list-error">
        {err}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div data-testid="admin-variant-template-list-empty" className="text-center py-12 border border-dashed border-slate-200 rounded-lg bg-white space-y-3">
        <h2 className="text-lg font-medium text-slate-800">No variant templates yet</h2>
        <p className="text-sm text-slate-600 px-4">
          Variant templates capture ordered axes and options for reusable merchandising grids.
        </p>
        <Link
          to="/admin/variant-templates/new"
          className="inline-block text-blue-700 font-medium underline min-h-11 px-3 py-2"
        >
          Create template
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="admin-variant-template-list">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-4 min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">Variant templates</h1>
        <Link
          to="/admin/variant-templates/new"
          className="shrink-0 inline-flex items-center justify-center min-h-11 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium"
        >
          New template
        </Link>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[32rem]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Axes</th>
              <th className="p-3 font-medium">Options</th>
              <th className="p-3 font-medium">Updated</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const { axes: axisCount, options: optCount } = summarizeTemplate(r);
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-3 align-top">{r.name}</td>
                  <td className="p-3 align-top">{r.status}</td>
                  <td className="p-3 align-top">{axisCount}</td>
                  <td className="p-3 align-top">{optCount}</td>
                  <td className="p-3 align-top whitespace-nowrap text-slate-600">
                    {r.updated_at
                      ? new Date(r.updated_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="p-3 align-top">
                    <Link
                      to={`/admin/variant-templates/${r.id}`}
                      className="text-blue-700 font-medium underline min-h-11 inline-flex items-center"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
