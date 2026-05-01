import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import {
  adminImageRowSchema,
  adminSaveBundleSchema,
  adminSubscriptionPlanRowSchema,
  adminVariantRowSchema,
  bundleToRpcPayload,
  formatZodError,
  validateMergedProduct,
} from "./validation";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";
import type { ProductStatus, ProductVariantStatus } from "../domain/commerce/enums";

type VRow = z.infer<typeof adminVariantRowSchema>;
type IRow = z.infer<typeof adminImageRowSchema>;
type SubscriptionPlanAdminRow = z.infer<typeof adminSubscriptionPlanRowSchema>;

function newSubscriptionPlanRow(): SubscriptionPlanAdminRow {
  return {
    id: crypto.randomUUID(),
    slug: "",
    name: "",
    description: "",
    stripe_product_id: null,
    stripe_price_id: null,
    variant_id: null,
    interval: "month",
    interval_count: 1,
    price_cents: 0,
    currency: "USD",
    trial_period_days: null,
    status: "draft",
  };
}

const subscriptionPlanIntervals: SubscriptionPlanAdminRow["interval"][] = [
  "day",
  "week",
  "month",
  "year",
];
const billingPlanStatuses: SubscriptionPlanAdminRow["status"][] = [
  "draft",
  "active",
  "archived",
];

function newVariantRow(): VRow {
  return {
    id: crypto.randomUUID(),
    sku: "",
    size: "",
    color: "",
    price_cents: 0,
    currency: "USD",
    inventory_quantity: 0,
    status: "active",
  };
}

function newImageRow(): IRow {
  return {
    id: crypto.randomUUID(),
    storage_path: "",
    alt_text: "",
    sort_order: 0,
    is_primary: false,
    variant_id: null,
  };
}

const productStatuses: ProductStatus[] = ["draft", "active", "coming_soon", "archived"];
const variantStatuses: ProductVariantStatus[] = [
  "active",
  "inactive",
  "discontinued",
];

export default function AdminProductForm() {
  const { id: paramId } = useParams();
  const { pathname } = useLocation();
  const isNew = pathname.endsWith("/new");
  const productId = isNew ? null : (paramId ?? null);
  const supabase = getSupabaseBrowserClient();
  const { session } = useAuth();
  const nav = useNavigate();

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("Draft product");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("Zephyr Lux");
  const [category, setCategory] = useState("");
  const [fabricType, setFabricType] = useState("");
  const [care, setCare] = useState("");
  const [origin, setOrigin] = useState("");
  const [status, setStatus] = useState<ProductStatus>("draft");
  const [variants, setVariants] = useState<VRow[]>(() => [newVariantRow()]);
  const [images, setImages] = useState<IRow[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanAdminRow[]>(() => []);

  useEffect(() => {
    if (isNew || !productId || !supabase) {
      if (!isNew && productId) {
        setLoading(false);
      }
      return;
    }
    void (async () => {
      setLoadErr(null);
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*, product_variants(*), product_images(*), product_subscription_plans(*)")
        .eq("id", productId)
        .single();
      if (error) {
        setLoadErr(error.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setLoadErr("Not found");
        setLoading(false);
        return;
      }
      setSlug((data as { slug: string }).slug);
      setTitle((data as { title: string }).title);
      setSubtitle((data as { subtitle: string | null }).subtitle ?? "");
      setDescription((data as { description: string | null }).description ?? "");
      setBrand((data as { brand: string | null }).brand ?? "Zephyr Lux");
      setCategory((data as { category: string | null }).category ?? "");
      setFabricType((data as { fabric_type: string | null }).fabric_type ?? "");
      setCare((data as { care_instructions: string | null }).care_instructions ?? "");
      setOrigin((data as { origin: string | null }).origin ?? "");
      setStatus((data as { status: ProductStatus }).status);

      const vRows = (data as { product_variants: Record<string, unknown>[] }).product_variants
        .slice()
        .map((r) => ({
          id: r.id as string,
          sku: (r.sku as string) ?? "",
          size: (r.size as string | null) ?? "",
          color: (r.color as string | null) ?? "",
          price_cents: (r.price_cents as number) ?? 0,
          currency: ((r.currency as string) ?? "usd").toUpperCase(),
          inventory_quantity: (r.inventory_quantity as number) ?? 0,
          low_stock_threshold: r.low_stock_threshold as number | undefined,
          status: (r.status as ProductVariantStatus) ?? "active",
          image_url: (r.image_url as string | null) ?? undefined,
        })) as VRow[];
      setVariants(vRows.length > 0 ? vRows : [newVariantRow()]);

      const iRows = (data as { product_images: Record<string, unknown>[] }).product_images
        .slice()
        .sort(
          (a, b) =>
            ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0)
        )
        .map((r) => ({
          id: r.id as string,
          storage_path: (r.storage_path as string) ?? "",
          alt_text: (r.alt_text as string | null) ?? "",
          sort_order: (r.sort_order as number) ?? 0,
          is_primary: (r.is_primary as boolean) ?? false,
          variant_id: (r.variant_id as string | null) ?? null,
        })) as IRow[];
      setImages(iRows);

      const planRows = (data as { product_subscription_plans?: Record<string, unknown>[] })
        .product_subscription_plans;
      if (planRows && planRows.length > 0) {
        setSubscriptionPlans(
          planRows
            .slice()
            .map((r) => ({
              id: r.id as string,
              slug: String((r.slug as string) ?? ""),
              name: String((r.name as string) ?? ""),
              description: (r.description as string | null) ?? "",
              stripe_product_id: (r.stripe_product_id as string | null) ?? null,
              stripe_price_id: (r.stripe_price_id as string | null) ?? null,
              variant_id: (r.variant_id as string | null) ?? null,
              interval: (r.interval as SubscriptionPlanAdminRow["interval"]) ?? "month",
              interval_count: (r.interval_count as number) ?? 1,
              price_cents: (r.price_cents as number) ?? 0,
              currency: ((r.currency as string) ?? "usd").toUpperCase(),
              trial_period_days: (r.trial_period_days as number | null) ?? null,
              status: (r.status as SubscriptionPlanAdminRow["status"]) ?? "draft",
            }))
            .sort((a, b) => a.slug.localeCompare(b.slug)),
        );
      } else {
        setSubscriptionPlans([]);
      }
      setLoading(false);
    })();
  }, [isNew, productId, supabase]);

  const onSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormErr(null);
      if (!supabase || !session) {
        setFormErr("Not signed in");
        return;
      }
      const productPart = {
        id: productId ?? undefined,
        slug: slug.trim(),
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        fabric_type: fabricType.trim() || undefined,
        care_instructions: care.trim() || undefined,
        origin: origin.trim() || undefined,
        status,
      };
      const imagesToSave = images.filter((im) => im.storage_path.trim() !== "");
      const parse = adminSaveBundleSchema.safeParse({
        product: productPart,
        variants: variants.map((v) => ({
          ...v,
          sku: v.sku.trim(),
          size: v.size || undefined,
          color: v.color || undefined,
          low_stock_threshold: v.low_stock_threshold,
          image_url: v.image_url || undefined,
        })),
        images: imagesToSave.map((im) => ({
          ...im,
          storage_path: im.storage_path.trim(),
          alt_text: im.alt_text || undefined,
          sort_order: im.sort_order ?? 0,
          is_primary: im.is_primary ?? false,
        })),
        subscription_plans: subscriptionPlans.map((p) => ({
          ...p,
          slug: p.slug.trim().toLowerCase(),
          name: p.name,
          description: p.description || undefined,
        })),
      });
      if (!parse.success) {
        setFormErr(formatZodError(parse.error));
        return;
      }
      const domain = validateMergedProduct(parse.data);
      if (!domain.success) {
        setFormErr(formatZodError(domain.error));
        return;
      }
      setSaving(true);
      try {
        const json = bundleToRpcPayload(parse.data) as { [key: string]: unknown };
        const { data, error } = await supabase.rpc("admin_save_product_bundle", {
          p_payload: json,
        });
        if (error) {
          const m = (error as { message?: string }).message ?? String(error);
          if (/duplicate|unique|23505|slug/i.test(m)) {
            setFormErr(
              m.includes("slug") || /subscription/i.test(m)
                ? m
                : "Slug, SKU, or billing-plan slug must be unique. Check product slug, variant SKUs, and active billing plan slugs."
            );
          } else {
            setFormErr(m);
          }
          return;
        }
        const newId = data as string;
        if (isNew && newId) {
          nav(`/admin/products/${newId}`, { replace: true });
        } else {
          nav("/admin/products");
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
      productId,
      slug,
      title,
      subtitle,
      description,
      brand,
      category,
      fabricType,
      care,
      origin,
      status,
      variants,
      images,
      subscriptionPlans,
      isNew,
      nav,
    ]
  );

  if (!supabase) {
    return <p className="text-slate-600">Supabase is not configured.</p>;
  }
  if (loading) {
    return <p className="text-slate-600" data-testid="admin-product-form-loading">Loading product…</p>;
  }
  if (loadErr) {
    return (
      <p className="text-red-800" role="alert" data-testid="admin-product-form-error">
        {loadErr}
      </p>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="space-y-8 max-w-full min-w-0 overflow-x-hidden"
      data-testid="admin-product-form"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">
          {isNew ? "New product" : "Edit product"}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 border border-slate-300 rounded-md text-slate-700"
            onClick={() => nav("/admin/products")}
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

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">Product</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600">Title *</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Slug *</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600">Subtitle</span>
          <input
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Description</span>
          <textarea
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 min-h-[5rem]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600">Brand</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Category</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Fabric type</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              value={fabricType}
              onChange={(e) => setFabricType(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Care</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              value={care}
              onChange={(e) => setCare(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Origin</span>
            <input
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Status</span>
            <select
              className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
            >
              {productStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Variants</h2>
          <button
            type="button"
            className="text-sm text-blue-700"
            onClick={() => setVariants((v) => [...v, newVariantRow()])}
          >
            + Add variant
          </button>
        </div>
        {variants.map((v, i) => (
          <div
            key={v.id}
            className="border border-slate-100 rounded p-3 space-y-2"
          >
            <div className="text-xs text-slate-500 font-mono">id: {v.id}</div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <label>
                SKU *{" "}
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={v.sku}
                  onChange={(e) => {
                    const n = variants.slice();
                    n[i] = { ...n[i]!, sku: e.target.value };
                    setVariants(n);
                  }}
                />
              </label>
              <label>
                Size{" "}
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={v.size}
                  onChange={(e) => {
                    const n = variants.slice();
                    n[i] = { ...n[i]!, size: e.target.value };
                    setVariants(n);
                  }}
                />
              </label>
              <label>
                Color{" "}
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={v.color}
                  onChange={(e) => {
                    const n = variants.slice();
                    n[i] = { ...n[i]!, color: e.target.value };
                    setVariants(n);
                  }}
                />
              </label>
              <label>
                Price (cents) *{" "}
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={v.price_cents}
                  onChange={(e) => {
                    const n = variants.slice();
                    n[i] = { ...n[i]!, price_cents: Number(e.target.value) || 0 };
                    setVariants(n);
                  }}
                />
              </label>
              <label>
                Currency *{" "}
                <input
                  maxLength={3}
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1 font-mono"
                  value={v.currency}
                  onChange={(e) => {
                    const n = variants.slice();
                    n[i] = { ...n[i]!, currency: e.target.value.toUpperCase() };
                    setVariants(n);
                  }}
                />
              </label>
              <label>
                Inventory *{" "}
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={v.inventory_quantity}
                  onChange={(e) => {
                    const n = variants.slice();
                    n[i] = { ...n[i]!, inventory_quantity: Number(e.target.value) || 0 };
                    setVariants(n);
                  }}
                />
              </label>
              <label>
                Low stock
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={v.low_stock_threshold ?? ""}
                  onChange={(e) => {
                    const n = variants.slice();
                    const raw = e.target.value;
                    n[i] = {
                      ...n[i]!,
                      low_stock_threshold: raw === "" ? undefined : Number(raw),
                    };
                    setVariants(n);
                  }}
                />
              </label>
              <label>
                Variant status
                <select
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={v.status}
                  onChange={(e) => {
                    const n = variants.slice();
                    n[i] = { ...n[i]!, status: e.target.value as ProductVariantStatus };
                    setVariants(n);
                  }}
                >
                  {variantStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2">
                Image URL
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={v.image_url ?? ""}
                  onChange={(e) => {
                    const n = variants.slice();
                    n[i] = { ...n[i]!, image_url: e.target.value || undefined };
                    setVariants(n);
                  }}
                />
              </label>
            </div>
            {variants.length > 1 || status === "draft" ? (
              <button
                type="button"
                className="text-sm text-red-700"
                onClick={() => setVariants((ar) => ar.filter((_, j) => j !== i))}
              >
                Remove variant
              </button>
            ) : null}
          </div>
        ))}
      </section>

      <section
        className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
        data-testid="admin-product-subscribe-save-section"
      >
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="font-semibold text-slate-800">Subscribe & save (Stripe Billing)</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Optional recurring billing plans. Marking <span className="font-medium">active</span> requires a valid
              Stripe <span className="font-medium">price</span> id (<span className="font-mono">price_…</span>) plus
              name, cadence, currency, and list price; Stripe <span className="font-medium">product</span> id (
              <span className="font-mono">prod_…</span>) is optional. Use a lowercase plan slug unique among active
              plans for this product.
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-blue-700 shrink-0"
            onClick={() => setSubscriptionPlans((p) => [...p, newSubscriptionPlanRow()])}
          >
            + Add billing plan
          </button>
        </div>
        {subscriptionPlans.length === 0 ? (
          <p className="text-sm text-slate-500">No billing plans. One-time catalog and checkout are unchanged.</p>
        ) : null}
        {subscriptionPlans.map((pl, pi) => (
          <div key={pl.id} className="border border-slate-100 rounded p-3 space-y-3">
            <div className="text-xs text-slate-500 font-mono break-all">plan id: {pl.id}</div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <label className="md:col-span-1">
                Plan slug *
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1 font-mono"
                  placeholder="monthly-save"
                  value={pl.slug}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = {
                      ...arr[pi]!,
                      slug: e.target.value,
                    };
                    setSubscriptionPlans(arr);
                  }}
                />
              </label>
              <label className="md:col-span-1">
                Plan name *
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={pl.name}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = { ...arr[pi]!, name: e.target.value };
                    setSubscriptionPlans(arr);
                  }}
                />
              </label>
              <label className="md:col-span-1">
                Billing plan status
                <select
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={pl.status}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = {
                      ...arr[pi]!,
                      status: e.target.value as SubscriptionPlanAdminRow["status"],
                    };
                    setSubscriptionPlans(arr);
                  }}
                >
                  {billingPlanStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sm:col-span-2 md:col-span-3">
                Description
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={pl.description ?? ""}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = { ...arr[pi]!, description: e.target.value };
                    setSubscriptionPlans(arr);
                  }}
                />
              </label>
              <label>
                Stripe price id ({pl.status === "active" ? "required" : "optional"})
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1 font-mono text-xs"
                  placeholder="price_…"
                  value={pl.stripe_price_id ?? ""}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = {
                      ...arr[pi]!,
                      stripe_price_id: e.target.value.trim() === "" ? null : e.target.value.trim(),
                    };
                    setSubscriptionPlans(arr);
                  }}
                />
              </label>
              <label>
                Stripe product id
                <input
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1 font-mono text-xs"
                  placeholder="prod_…"
                  value={pl.stripe_product_id ?? ""}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = {
                      ...arr[pi]!,
                      stripe_product_id: e.target.value.trim() === "" ? null : e.target.value.trim(),
                    };
                    setSubscriptionPlans(arr);
                  }}
                />
              </label>
              <label>
                Scope variant
                <select
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1 font-mono text-xs"
                  value={pl.variant_id ?? ""}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = {
                      ...arr[pi]!,
                      variant_id: e.target.value ? e.target.value : null,
                    };
                    setSubscriptionPlans(arr);
                  }}
                >
                  <option value="">All variants (product-wide)</option>
                  {variants.map((vr) => (
                    <option key={vr.id} value={vr.id}>
                      {vr.sku || vr.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Interval
                <select
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={pl.interval}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = {
                      ...arr[pi]!,
                      interval: e.target.value as SubscriptionPlanAdminRow["interval"],
                    };
                    setSubscriptionPlans(arr);
                  }}
                >
                  {subscriptionPlanIntervals.map((iv) => (
                    <option key={iv} value={iv}>
                      {iv}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Interval count
                <input
                  type="number"
                  min={1}
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={pl.interval_count}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = {
                      ...arr[pi]!,
                      interval_count: Math.max(1, Number(e.target.value) || 1),
                    };
                    setSubscriptionPlans(arr);
                  }}
                />
              </label>
              <label>
                Price (cents, info)
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={pl.price_cents}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = {
                      ...arr[pi]!,
                      price_cents: Math.max(0, Number(e.target.value) || 0),
                    };
                    setSubscriptionPlans(arr);
                  }}
                />
              </label>
              <label>
                Currency *
                <input
                  maxLength={3}
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1 font-mono"
                  value={pl.currency}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    arr[pi] = {
                      ...arr[pi]!,
                      currency: e.target.value.toUpperCase(),
                    };
                    setSubscriptionPlans(arr);
                  }}
                />
              </label>
              <label>
                Trial days
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                  value={pl.trial_period_days ?? ""}
                  onChange={(e) => {
                    const arr = subscriptionPlans.slice();
                    const raw = e.target.value;
                    arr[pi] = {
                      ...arr[pi]!,
                      trial_period_days: raw === "" ? null : Number(raw),
                    };
                    setSubscriptionPlans(arr);
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              className="text-sm text-red-700"
              onClick={() => setSubscriptionPlans((ar) => ar.filter((_, j) => j !== pi))}
            >
              Remove billing plan
            </button>
          </div>
        ))}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Images (paths / URLs)</h2>
          <button
            type="button"
            className="text-sm text-blue-700"
            onClick={() => setImages((im) => [...im, newImageRow()])}
          >
            + Add image
          </button>
        </div>
        {images.length === 0 ? (
          <p className="text-sm text-slate-500">No product images. Optional for MVP (path/URL only).</p>
        ) : null}
        {images.map((im, i) => (
          <div
            key={im.id}
            className="border border-slate-100 rounded p-3 grid sm:grid-cols-2 gap-2 text-sm"
          >
            <label className="sm:col-span-2">
              Storage path / URL *{" "}
              <input
                className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                value={im.storage_path}
                onChange={(e) => {
                  const c = images.slice();
                  c[i] = { ...c[i]!, storage_path: e.target.value };
                  setImages(c);
                }}
              />
            </label>
            <label>
              Alt
              <input
                className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                value={im.alt_text ?? ""}
                onChange={(e) => {
                  const c = images.slice();
                  c[i] = { ...c[i]!, alt_text: e.target.value };
                  setImages(c);
                }}
              />
            </label>
            <label>
              Sort order
              <input
                type="number"
                className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                value={im.sort_order ?? 0}
                onChange={(e) => {
                  const c = images.slice();
                  c[i] = { ...c[i]!, sort_order: Number(e.target.value) || 0 };
                  setImages(c);
                }}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={im.is_primary ?? false}
                onChange={(e) => {
                  const c = images.slice();
                  c[i] = { ...c[i]!, is_primary: e.target.checked };
                  setImages(c);
                }}
              />
              Primary
            </label>
            <label>
              Optional variant
              <select
                className="mt-0.5 w-full border border-slate-300 rounded px-1 py-1"
                value={im.variant_id ?? ""}
                onChange={(e) => {
                  const c = images.slice();
                  c[i] = {
                    ...c[i]!,
                    variant_id: e.target.value ? e.target.value : null,
                  };
                  setImages(c);
                }}
              >
                <option value="">(none)</option>
                {variants.map((vr) => (
                  <option key={vr.id} value={vr.id}>
                    {vr.sku || vr.id}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2 text-xs text-slate-500 font-mono">id: {im.id}</div>
            <button
              type="button"
              className="text-sm text-red-700 sm:col-span-2"
              onClick={() => setImages((r) => r.filter((_, j) => j !== i))}
            >
              Remove image
            </button>
          </div>
        ))}
      </section>
    </form>
  );
}
