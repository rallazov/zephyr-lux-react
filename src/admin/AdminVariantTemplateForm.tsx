import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";
import { useAuth } from "../auth/AuthContext";
import type { VariantTemplate } from "../domain/commerce/variantTemplate";
import {
  adminVariantTemplateFormSchema,
  destructiveEditRequiresAcknowledgement,
  formToVariantTemplate,
  parseVariantTemplateJoinRow,
  type AdminVariantTemplateForm,
} from "./variantTemplateValidation";

type AxisForm = AdminVariantTemplateForm["axes"][number];
type OptionForm = AxisForm["options"][number];

function newOption(sort: number): OptionForm {
  return {
    id: crypto.randomUUID(),
    option_key: "",
    label: null,
    sort_order: sort,
  };
}

function newAxis(sort: number): AxisForm {
  return {
    id: crypto.randomUUID(),
    axis_key: "",
    label: null,
    sort_order: sort,
    options: [newOption(0)],
  };
}

export default function AdminVariantTemplateForm() {
  const { id: routeId } = useParams();
  const { pathname } = useLocation();
  const isNew = pathname.endsWith("/new");
  const templateId = isNew ? null : (routeId ?? null);
  const supabase = getSupabaseBrowserClient();
  const { session } = useAuth();
  const nav = useNavigate();

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [status, setStatus] = useState<AdminVariantTemplateForm["status"]>("draft");
  const [axes, setAxes] = useState<AxisForm[]>(() => [newAxis(0)]);

  const [previousDomain, setPreviousDomain] = useState<VariantTemplate | null>(null);
  const [assignedProductCount, setAssignedProductCount] = useState(0);
  const [destructiveAck, setDestructiveAck] = useState(false);

  useEffect(() => {
    if (isNew || !templateId || !supabase) {
      if (isNew) {
        setLoading(false);
      }
      return;
    }
    void (async () => {
      setLoadErr(null);
      setLoading(true);
      const { data: tplRow, error: tErr } = await supabase
        .from("variant_templates")
        .select(
          "id, name, status, variant_template_axes(id, axis_key, label, sort_order, variant_template_axis_options(id, option_key, label, sort_order))",
        )
        .eq("id", templateId)
        .single();

      let countProducts = 0;
      const { count, error: cErr } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("variant_template_id", templateId);
      if (!cErr && typeof count === "number") {
        countProducts = count;
      }

      if (tErr || !tplRow) {
        setLoadErr(tErr?.message ?? "Not found");
        setLoading(false);
        return;
      }
      const domain = parseVariantTemplateJoinRow(tplRow as Record<string, unknown>);
      setPreviousDomain(domain);
      setName(domain.name);
      setStatus(domain.status);
      setAxes(
        domain.axes.map((ax) => ({
          id: ax.id,
          axis_key: ax.axis_key,
          label: ax.label,
          sort_order: ax.sort_order,
          options: ax.options.map((o) => ({
            id: o.id,
            option_key: o.option_key,
            label: o.label,
            sort_order: o.sort_order,
          })),
        })),
      );
      setAssignedProductCount(countProducts);
      setLoading(false);
    })();
  }, [isNew, templateId, supabase]);

  const onSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormErr(null);
      if (!supabase || !session) {
        setFormErr("Not signed in");
        return;
      }

      const payloadTry = adminVariantTemplateFormSchema.safeParse({
        name,
        status,
        axes,
      });
      if (!payloadTry.success) {
        setFormErr(payloadTry.error.issues.map((i) => i.message).join(" · "));
        return;
      }
      const payload = payloadTry.data;
      const domainNext = formToVariantTemplate(payload, templateId ?? crypto.randomUUID());

      if (!isNew && templateId && previousDomain) {
        if (
          destructiveEditRequiresAcknowledgement(previousDomain, domainNext, assignedProductCount) &&
          !destructiveAck
        ) {
          setFormErr(
            "This change can break catalog rows tied to this template. Check the acknowledgment box, or adjust axes/options.",
          );
          return;
        }
      }

      setSaving(true);
      try {
        const rpcPayload: Record<string, unknown> = {
          name: domainNext.name,
          status: domainNext.status,
          axes: [...domainNext.axes].map((ax) => ({
            id: ax.id,
            axis_key: ax.axis_key,
            label: ax.label,
            sort_order: ax.sort_order,
            options: [...ax.options].map((o) => ({
              id: o.id,
              option_key: o.option_key,
              label: o.label,
              sort_order: o.sort_order,
            })),
          })),
        };
        if (!isNew && templateId) {
          rpcPayload.id = templateId;
        }

        const { data: rpcId, error: rpcErr } = await supabase.rpc("admin_save_variant_template", {
          p_payload: rpcPayload,
        });
        if (rpcErr || !rpcId) {
          setFormErr(rpcErr?.message ?? "Save failed");
          return;
        }
        const newIdStr = rpcId as string;

        if (isNew && newIdStr) {
          setDestructiveAck(false);
          nav(`/admin/variant-templates/${newIdStr}`, { replace: true });
        } else if (templateId) {
          setPreviousDomain(domainNext);
          setDestructiveAck(false);
          nav("/admin/variant-templates");
        }
      } catch (err) {
        setFormErr(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [
      supabase,
      session,
      isNew,
      templateId,
      name,
      status,
      axes,
      previousDomain,
      assignedProductCount,
      destructiveAck,
      nav,
    ],
  );

  if (!supabase) {
    return <p className="text-slate-600">Supabase is not configured.</p>;
  }
  if (loading) {
    return (
      <p className="text-slate-600" data-testid="admin-variant-template-form-loading">
        Loading template…
      </p>
    );
  }
  if (loadErr) {
    return (
      <p className="text-red-800" role="alert" data-testid="admin-variant-template-form-error">
        {loadErr}
      </p>
    );
  }

  const statuses: AdminVariantTemplateForm["status"][] = ["draft", "active", "archived"];

  const parsedLive = adminVariantTemplateFormSchema.safeParse({ name, status, axes });
  const needsDestructiveAck =
    !isNew &&
    templateId &&
    previousDomain &&
    parsedLive.success &&
    destructiveEditRequiresAcknowledgement(
      previousDomain,
      formToVariantTemplate(parsedLive.data, templateId),
      assignedProductCount,
    );

  return (
    <form
      onSubmit={onSave}
      className="space-y-8 max-w-full min-w-0 overflow-x-hidden"
      data-testid="admin-variant-template-form"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">
          {isNew ? "New variant template" : "Edit variant template"}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 border border-slate-300 rounded-md text-slate-700"
            onClick={() => nav("/admin/variant-templates")}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white rounded-md font-medium disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {formErr ? (
        <p className="p-3 rounded-md bg-red-50 text-red-900 text-sm" role="alert">
          {formErr}
        </p>
      ) : null}

      {!isNew && assignedProductCount > 0 ? (
        <p className="text-sm text-slate-600" data-testid="admin-variant-template-assigned-hint">
          {assignedProductCount} product{assignedProductCount === 1 ? "" : "s"} use this template.
          Structural edits may require confirmation.
        </p>
      ) : null}

      {needsDestructiveAck ? (
        <div
          className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-950 text-sm space-y-2"
          role="status"
          data-testid="admin-variant-template-destructive-panel"
        >
          <p className="font-medium">This save may invalidate existing product variants.</p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={destructiveAck}
              onChange={(e) => setDestructiveAck(e.target.checked)}
            />
            <span>I understand this change may break existing SKUs or product variants.</span>
          </label>
        </div>
      ) : null}

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">Template</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600">Name *</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Status</span>
            <select
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              value={status}
              onChange={(e) => setStatus(e.target.value as AdminVariantTemplateForm["status"])}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex justify-between items-center gap-2">
          <h2 className="font-semibold text-slate-800">Axes & options</h2>
          <button
            type="button"
            className="text-sm text-blue-700 min-h-11"
            onClick={() => setAxes((ax) => [...ax, newAxis(ax.length)])}
          >
            + Add axis
          </button>
        </div>

        {axes.map((ax, ai) => (
          <div
            key={ax.id}
            className="border border-slate-100 rounded p-3 space-y-3"
            data-axis-index={ai}
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Axis {ai + 1}</span>
              <button
                type="button"
                className="text-sm text-red-700 min-h-11"
                onClick={() =>
                  setAxes((list) =>
                    list.length > 1 ? list.filter((_, j) => j !== ai) : list,
                  )
                }
              >
                Remove axis
              </button>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <label>
                Stable key *{" "}
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1 font-mono"
                  value={ax.axis_key}
                  onChange={(e) => {
                    const n = axes.slice();
                    n[ai] = { ...n[ai]!, axis_key: e.target.value };
                    setAxes(n);
                  }}
                  placeholder="size"
                  autoComplete="off"
                />
              </label>
              <label>
                Label{" "}
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={ax.label ?? ""}
                  onChange={(e) => {
                    const n = axes.slice();
                    const v = e.target.value;
                    n[ai] = { ...n[ai]!, label: v === "" ? null : v };
                    setAxes(n);
                  }}
                  placeholder="Size"
                  autoComplete="off"
                />
              </label>
              <label>
                Sort order{" "}
                <input
                  type="number"
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={ax.sort_order}
                  onChange={(e) => {
                    const n = axes.slice();
                    n[ai] = { ...n[ai]!, sort_order: Number(e.target.value) || 0 };
                    setAxes(n);
                  }}
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-600">Options</span>
                <button
                  type="button"
                  className="text-xs text-blue-700"
                  onClick={() => {
                    const n = axes.slice();
                    const nextSort = Math.max(0, ...n[ai]!.options.map((o) => o.sort_order)) + 1;
                    n[ai] = {
                      ...n[ai]!,
                      options: [...n[ai]!.options, newOption(nextSort)],
                    };
                    setAxes(n);
                  }}
                >
                  + Option
                </button>
              </div>
              {ax.options.map((op, oi) => (
                <div
                  key={op.id}
                  className="grid sm:grid-cols-2 md:grid-cols-4 gap-2 border border-slate-50 rounded p-2"
                >
                  <label className="text-xs">
                    Option key *{" "}
                    <input
                      className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1 font-mono"
                      value={op.option_key}
                      onChange={(e) => {
                        const n = axes.slice();
                        const opts = n[ai]!.options.slice();
                        opts[oi] = { ...opts[oi]!, option_key: e.target.value };
                        n[ai] = { ...n[ai]!, options: opts };
                        setAxes(n);
                      }}
                      autoComplete="off"
                    />
                  </label>
                  <label className="text-xs">
                    Label{" "}
                    <input
                      className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                      value={op.label ?? ""}
                      onChange={(e) => {
                        const n = axes.slice();
                        const opts = n[ai]!.options.slice();
                        const v = e.target.value;
                        opts[oi] = { ...opts[oi]!, label: v === "" ? null : v };
                        n[ai] = { ...n[ai]!, options: opts };
                        setAxes(n);
                      }}
                      autoComplete="off"
                    />
                  </label>
                  <label className="text-xs">
                    Sort{" "}
                    <input
                      type="number"
                      className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                      value={op.sort_order}
                      onChange={(e) => {
                        const n = axes.slice();
                        const opts = n[ai]!.options.slice();
                        opts[oi] = { ...opts[oi]!, sort_order: Number(e.target.value) || 0 };
                        n[ai] = { ...n[ai]!, options: opts };
                        setAxes(n);
                      }}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="text-xs text-red-700 mb-0.5"
                      onClick={() => {
                        const n = axes.slice();
                        const opts = n[ai]!.options.filter((_, j) => j !== oi);
                        n[ai] = {
                          ...n[ai]!,
                          options: opts.length ? opts : [newOption(0)],
                        };
                        setAxes(n);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </form>
  );
}
