import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import {
  adminImageRowSchema,
  adminSaveBundleSchema,
  adminVariantRowSchema,
  bundleToRpcPayload,
  formatZodError,
  validateMergedProduct,
} from "./validation";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";
import type { ProductStatus, ProductVariantStatus } from "../domain/commerce/enums";

type VRow = z.infer<typeof adminVariantRowSchema>;
type IRow = z.infer<typeof adminImageRowSchema>;

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

const productStatuses: ProductStatus[] = ["draft", "active", "archived"];
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
        .select("*, product_variants(*), product_images(*)")
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
              m.includes("slug")
                ? m
                : "Slug or SKU must be unique. Check for a duplicate slug in products or sku on another variant."
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
      className="space-y-8"
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
