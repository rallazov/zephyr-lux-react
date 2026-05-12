import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { COLLECTION_ROUTES } from "../catalog/collections";
import { PDP_IMAGE_PLACEHOLDER } from "../catalog/pdpImage";
import { resolveProductImageUrl } from "../catalog/productImageUrl";
import type { ProductStatus, ProductVariantStatus } from "../domain/commerce/enums";
import { PRODUCT_IMAGE_MAX_BYTES, isDeletableProductImageStoragePath } from "../domain/commerce/productImage";
import type { VariantTemplate } from "../domain/commerce/variantTemplate";
import { apiUrl } from "../lib/apiBase";
import {
  parseVariantTemplateJoinRow,
  variantsSatisfyTemplate,
} from "./variantTemplateValidation";
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
    template_option_values: [],
    price_cents: 0,
    currency: "USD",
    inventory_quantity: 0,
    status: "active",
  };
}

function defaultTemplateSelections(template: VariantTemplate): Array<{ axis_id: string; option_id: string }> {
  const axes = [...template.axes].sort((a, b) => a.sort_order - b.sort_order);
  const out: Array<{ axis_id: string; option_id: string }> = [];
  for (const ax of axes) {
    const opts = [...ax.options].sort((a, b) => a.sort_order - b.sort_order);
    const first = opts[0];
    if (!first) return [];
    out.push({ axis_id: ax.id, option_id: first.id });
  }
  return out;
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
  const [variantTemplateId, setVariantTemplateId] = useState<string | null>(null);
  const [variantTemplates, setVariantTemplates] = useState<
    { id: string; name: string; status: string; domain: VariantTemplate }[]
  >([]);
  const [templatesLoadErr, setTemplatesLoadErr] = useState<string | null>(null);
  const [variants, setVariants] = useState<VRow[]>(() => [newVariantRow()]);
  const [images, setImages] = useState<IRow[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanAdminRow[]>(() => []);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroPreview = useMemo(() => {
    const sorted = [...images]
      .filter((im) => im.storage_path.trim() && im.variant_id == null)
      .sort((a, b) => {
        if ((a.is_primary ?? false) !== (b.is_primary ?? false)) return a.is_primary ? -1 : 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
    return resolveProductImageUrl(sorted[0]?.storage_path) || PDP_IMAGE_PLACEHOLDER;
  }, [images]);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      setTemplatesLoadErr(null);
      const { data, error } = await supabase
        .from("variant_templates")
        .select(
          "id, name, status, variant_template_axes(id, axis_key, label, sort_order, variant_template_axis_options(id, option_key, label, sort_order))",
        )
        .order("name");
      if (error) {
        setTemplatesLoadErr(error.message);
        setVariantTemplates([]);
        return;
      }
      setVariantTemplates(
        (data ?? []).map((row) => ({
          id: row.id as string,
          name: row.name as string,
          status: row.status as string,
          domain: parseVariantTemplateJoinRow(row as Record<string, unknown>),
        })),
      );
    })();
  }, [supabase]);

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
        .select(
          "*, product_variants(*, product_variant_option_values(axis_id, option_id)), product_images(*), product_subscription_plans(*), product_collection_assignments(collection_key)",
        )
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
      setVariantTemplateId(
        (data as { variant_template_id?: string | null }).variant_template_id ?? null,
      );

      const vRows = (data as { product_variants: Record<string, unknown>[] }).product_variants
        .slice()
        .map((r) => {
          const tovRaw = r.product_variant_option_values as
            | Array<{ axis_id: string; option_id: string }>
            | undefined;
          const template_option_values = (tovRaw ?? []).map((x) => ({
            axis_id: String(x.axis_id),
            option_id: String(x.option_id),
          }));
          return {
            id: r.id as string,
            sku: (r.sku as string) ?? "",
            size: (r.size as string | null) ?? "",
            color: (r.color as string | null) ?? "",
            template_option_values,
            price_cents: (r.price_cents as number) ?? 0,
            currency: ((r.currency as string) ?? "usd").toUpperCase(),
            inventory_quantity: (r.inventory_quantity as number) ?? 0,
            low_stock_threshold: r.low_stock_threshold as number | undefined,
            status: (r.status as ProductVariantStatus) ?? "active",
            image_url: (r.image_url as string | null) ?? undefined,
          } as VRow;
        }) as VRow[];
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
      setSelectedCollections(
        ((data as { product_collection_assignments?: Record<string, unknown>[] })
          .product_collection_assignments ?? [])
          .map((r) => String(r.collection_key ?? "").trim())
          .filter(Boolean),
      );

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

  const toggleCollection = useCallback((key: string) => {
    setSelectedCollections((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key].sort((a, b) => a.localeCompare(b)),
    );
  }, []);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploadErr(null);
      if (!session?.access_token) {
        setUploadErr("Sign in again before uploading images.");
        return;
      }
      for (const file of list) {
        if (!file.type.startsWith("image/")) {
          setUploadErr("Only image files are accepted.");
          return;
        }
        if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
          setUploadErr("Image is too large for product media upload.");
          return;
        }
      }

      setUploadBusy(true);
      try {
        const uploaded: Array<Omit<IRow, "sort_order" | "is_primary">> = [];
        for (const file of list) {
          const fd = new FormData();
          if (productId) fd.set("product_id", productId);
          fd.set("file", file);
          const res = await fetch(apiUrl("/api/admin-product-image"), {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: fd,
          });
          const body = (await res.json().catch(() => ({}))) as {
            object_path?: string;
            error?: string;
          };
          if (!res.ok || typeof body.object_path !== "string") {
            throw new Error(
              typeof body.error === "string" ? body.error : `Upload failed (${res.status}).`,
            );
          }
          uploaded.push({
            id: crypto.randomUUID(),
            storage_path: body.object_path,
            alt_text: title.trim() || file.name,
            variant_id: null,
          });
        }
        setImages((prev) => [
          ...prev,
          ...uploaded.map((row, index) => ({
            ...row,
            sort_order: prev.length + index,
            is_primary: prev.length === 0 && index === 0,
          })),
        ]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        setUploadErr(err instanceof Error ? err.message : String(err));
      } finally {
        setUploadBusy(false);
      }
    },
    [productId, session?.access_token, title],
  );

  const removeImageAtIndex = useCallback(
    async (index: number) => {
      const row = images[index];
      if (!row) return;
      const path = row.storage_path.trim();
      if (path && isDeletableProductImageStoragePath(path)) {
        if (!session?.access_token) {
          setUploadErr("Sign in again before removing stored images.");
          return;
        }
        try {
          const q = new URLSearchParams({ object_path: path });
          const res = await fetch(apiUrl(`/api/admin-product-image?${q.toString()}`), {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            setUploadErr(
              typeof body.error === "string" ? body.error : `Remove failed (${res.status}).`,
            );
            return;
          }
        } catch (err) {
          setUploadErr(err instanceof Error ? err.message : String(err));
          return;
        }
      }
      setUploadErr(null);
      setImages((r) => r.filter((_, j) => j !== index));
    },
    [images, session?.access_token],
  );

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
        variant_template_id: variantTemplateId,
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
          template_option_values: variantTemplateId ? v.template_option_values : undefined,
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
      const tid = parse.data.product.variant_template_id;
      if (tid) {
        const entry = variantTemplates.find((t) => t.id === tid);
        if (!entry) {
          setFormErr("Selected variant template could not be loaded. Refresh and try again.");
          return;
        }
        const sat = variantsSatisfyTemplate(
          parse.data.variants.map((v) => ({
            sku: v.sku,
            size: v.size,
            color: v.color,
            template_option_values: v.template_option_values,
          })),
          entry.domain,
        );
        if (!sat.ok) {
          setFormErr(sat.message);
          return;
        }
      }
      setSaving(true);
      try {
        const json = {
          ...(bundleToRpcPayload(parse.data) as { [key: string]: unknown }),
          collection_keys: selectedCollections,
        };
        const { data, error } = await supabase.rpc("admin_save_product_catalog_bundle", {
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
      variantTemplateId,
      variants,
      variantTemplates,
      images,
      selectedCollections,
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

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="grid gap-4 sm:grid-cols-[7rem_1fr] sm:items-center">
            <img
              src={heroPreview}
              alt=""
              className="aspect-square w-28 rounded border border-slate-200 bg-slate-100 object-cover"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = PDP_IMAGE_PLACEHOLDER;
              }}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Product-first editor
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 truncate">
                {title.trim() || "Untitled product"}
              </h2>
              <p className="mt-1 font-mono text-xs text-slate-500 truncate">
                {slug.trim() || "slug-not-set"}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Manage content, storefront collections, images, variants, price, stock, and publish state from one save.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="font-semibold text-slate-800">Publishing</h2>
          <p className="mt-2 text-sm text-slate-600">
            {status === "active"
              ? "Visible and purchasable when at least one active variant has stock."
              : status === "coming_soon"
                ? "Visible on storefront with purchase blocked and waitlist behavior."
                : status === "archived"
                  ? "Hidden from storefront browsing and product detail routes."
                  : "Hidden while you build the listing."}
          </p>
          <div className="mt-4 rounded bg-slate-50 p-3 text-xs text-slate-600">
            {images.filter((im) => im.storage_path.trim()).length} image
            {images.filter((im) => im.storage_path.trim()).length === 1 ? "" : "s"} · {variants.length} variant
            {variants.length === 1 ? "" : "s"} · {selectedCollections.length} collection
            {selectedCollections.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

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
        <fieldset className="rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Storefront collections</legend>
          <p className="mb-3 mt-1 text-xs text-slate-500">
            Explicit collection placement takes priority over the legacy category fallback.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="admin-product-collections">
            {COLLECTION_ROUTES.map((c) => (
              <label
                key={c.categoryKey}
                className="flex min-h-11 items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedCollections.includes(c.categoryKey)}
                  onChange={() => toggleCollection(c.categoryKey)}
                />
                <span>{c.navLabel}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section
        className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
        data-testid="admin-product-variant-template-section"
      >
        <h2 className="font-semibold text-slate-800">Variant template</h2>
        <p className="text-xs text-slate-500 max-w-2xl">
          Optional. Assign a reusable axis layout from{" "}
          <span className="font-medium">Admin → Templates</span>. Leave unset to keep classic size/color only.
        </p>
        {templatesLoadErr ? (
          <p className="text-sm text-amber-800" role="status">
            Could not load templates: {templatesLoadErr}
          </p>
        ) : null}
        <label className="block text-sm max-w-xl">
          <span className="text-slate-600">Template</span>
          <select
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
            value={variantTemplateId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const nextId = v === "" ? null : v;
              setVariantTemplateId(nextId);
              if (!nextId) {
                setVariants((rows) =>
                  rows.map((row) => ({ ...row, template_option_values: [] })),
                );
                return;
              }
              const t = variantTemplates.find((x) => x.id === nextId);
              if (!t) return;
              const defaults = defaultTemplateSelections(t.domain);
              setVariants((rows) =>
                rows.map((row) => ({ ...row, template_option_values: defaults })),
              );
            }}
          >
            <option value="">(none — legacy size / color only)</option>
            {variantTemplates
              .filter((t) => t.status !== "archived" || t.id === variantTemplateId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
          </select>
        </label>
        {variantTemplateId ? (
          <div
            className="text-sm text-slate-700 border border-slate-100 rounded p-3 bg-slate-50"
            data-testid="admin-product-variant-template-summary"
          >
            {(() => {
              const sel = variantTemplates.find((x) => x.id === variantTemplateId);
              if (!sel) {
                return <p>Template details loading…</p>;
              }
              const d = sel.domain;
              return (
                <ul className="list-disc pl-5 space-y-1">
                  <li className="list-none -ml-5 mb-2">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-slate-500"> — {d.status}</span>
                  </li>
                  {d.axes.map((ax) => (
                    <li key={ax.id}>
                      Axis <span className="font-mono">{ax.axis_key}</span>
                      {ax.label ? ` (${ax.label})` : ""}: {ax.options.length} option
                      {ax.options.length === 1 ? "" : "s"}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        ) : null}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Variants</h2>
          <button
            type="button"
            className="text-sm text-blue-700"
            onClick={() =>
              setVariants((rows) => {
                const base = newVariantRow();
                const t = variantTemplateId
                  ? variantTemplates.find((x) => x.id === variantTemplateId)
                  : null;
                return [
                  ...rows,
                  {
                    ...base,
                    template_option_values: t ? defaultTemplateSelections(t.domain) : [],
                  },
                ];
              })
            }
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
              {variantTemplateId ? (
                (() => {
                  const tplEntry = variantTemplates.find((x) => x.id === variantTemplateId);
                  if (!tplEntry) {
                    return (
                      <p className="md:col-span-3 text-sm text-amber-800" role="status">
                        Template rows are unavailable until templates finish loading.
                      </p>
                    );
                  }
                  const axes = [...tplEntry.domain.axes].sort(
                    (a, b) => a.sort_order - b.sort_order,
                  );
                  return (
                    <fieldset className="md:col-span-3 space-y-2 rounded border border-slate-200 p-3">
                      <legend className="px-1 text-xs font-medium text-slate-600">
                        Template axes
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {axes.map((ax) => {
                          const options = [...ax.options].sort(
                            (a, b) => a.sort_order - b.sort_order,
                          );
                          const current =
                            v.template_option_values?.find((p) => p.axis_id === ax.id)
                              ?.option_id ?? "";
                          const labelText = ax.label?.trim() || ax.axis_key;
                          return (
                            <label key={ax.id} className="block text-sm">
                              <span className="text-slate-600">{labelText}</span>
                              <select
                                className="mt-0.5 w-full rounded border border-slate-300 px-1 py-1"
                                aria-label={`${labelText} option for SKU ${v.sku || "variant"}`}
                                value={current}
                                onChange={(e) => {
                                  const optId = e.target.value;
                                  const n = variants.slice();
                                  const row = { ...n[i]! };
                                  const pairs = [...(row.template_option_values ?? [])].filter(
                                    (p) => p.axis_id !== ax.id,
                                  );
                                  if (optId !== "") pairs.push({ axis_id: ax.id, option_id: optId });
                                  row.template_option_values = pairs;
                                  n[i] = row;
                                  setVariants(n);
                                }}
                              >
                                <option value="">Select…</option>
                                {options.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label?.trim() || o.option_key}
                                  </option>
                                ))}
                              </select>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })()
              ) : null}
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

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="font-semibold text-slate-800">Images</h2>
            <p className="mt-1 text-xs text-slate-500">
              Upload product photos, keep manual paths for existing assets, and assign images to variants when needed.
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-blue-700"
            onClick={() => setImages((im) => [...im, newImageRow()])}
          >
            + Add manual path
          </button>
        </div>

        <div
          className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
            }}
          />
          <p className="text-sm font-medium text-slate-800">Drop product images here</p>
          <p className="mt-1 text-xs text-slate-500">JPG, PNG, or WebP. Original quality is preserved.</p>
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
            disabled={uploadBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadBusy ? "Uploading..." : "Choose images"}
          </button>
        </div>

        {uploadErr ? (
          <p className="rounded bg-red-50 p-3 text-sm text-red-900" role="alert">
            {uploadErr}
          </p>
        ) : null}

        {images.length === 0 ? (
          <p className="text-sm text-slate-500">No product images yet.</p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {images.map((im, i) => {
            const previewUrl = resolveProductImageUrl(im.storage_path) || PDP_IMAGE_PLACEHOLDER;
            return (
              <div
                key={im.id}
                className="border border-slate-200 rounded-lg p-3 grid gap-3 text-sm"
                data-testid="admin-product-image-row"
              >
                <div className="grid grid-cols-[5rem_1fr] gap-3">
                  <img
                    src={previewUrl}
                    alt=""
                    className="aspect-square w-20 rounded border border-slate-200 bg-slate-100 object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = PDP_IMAGE_PLACEHOLDER;
                    }}
                  />
                  <div className="min-w-0 space-y-2">
                    <label className="block">
                      Storage path / URL *
                      <input
                        className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1 font-mono text-xs"
                        value={im.storage_path}
                        onChange={(e) => {
                          const c = images.slice();
                          c[i] = { ...c[i]!, storage_path: e.target.value };
                          setImages(c);
                        }}
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={im.is_primary ?? false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setImages((rows) =>
                            rows.map((row, idx) =>
                              idx === i
                                ? { ...row, is_primary: checked }
                                : checked && row.variant_id === im.variant_id
                                  ? { ...row, is_primary: false }
                                  : row,
                            ),
                          );
                        }}
                      />
                      Primary for this scope
                    </label>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label>
                    Alt text
                    <input
                      className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1"
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
                      min={0}
                      className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1"
                      value={im.sort_order ?? 0}
                      onChange={(e) => {
                        const c = images.slice();
                        c[i] = { ...c[i]!, sort_order: Number(e.target.value) || 0 };
                        setImages(c);
                      }}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    Optional variant
                    <select
                      className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1"
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
                      <option value="">Product-level gallery</option>
                      {variants.map((vr) => (
                        <option key={vr.id} value={vr.id}>
                          {vr.sku || vr.id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-mono text-xs text-slate-500">id: {im.id}</span>
                  <button
                    type="button"
                    className="shrink-0 text-sm text-red-700"
                    onClick={() => void removeImageAtIndex(i)}
                  >
                    Remove image
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </form>
  );
}
