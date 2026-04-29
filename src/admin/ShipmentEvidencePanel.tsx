import React, { useCallback, useEffect, useRef, useState } from "react";
import { shipmentImageTypeSchema, type ShipmentImageType } from "../domain/commerce/shipmentImage";

export type ShipmentEvidenceItem = {
  id: string;
  image_type: ShipmentImageType;
  created_at: string;
  preview_url: string | null;
};

type ListResponse = { items?: ShipmentEvidenceItem[] };

const IMAGE_TYPE_OPTIONS: { value: ShipmentImageType; label: string }[] = [
  { value: "label", label: "Label" },
  { value: "package", label: "Package" },
  { value: "receipt", label: "Receipt" },
  { value: "other", label: "Other" },
];

function formatLocal (iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Admin-only shipment photo evidence (Story 8-5). Not shown to customers. */
export function ShipmentEvidencePanel (props: {
  orderId: string;
  shipmentId: string | null;
  canUpload: boolean;
  accessToken: string | null;
}) {
  const { orderId, shipmentId, canUpload, accessToken } = props;

  const [imageType, setImageType] = useState<ShipmentImageType>("label");
  const [items, setItems] = useState<ShipmentEvidenceItem[]>([]);
  const [listErr, setListErr] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      return;
    }
    setListLoading(true);
    setListErr(null);
    try {
      const res = await fetch(
        `/api/admin-shipment-images?order_id=${encodeURIComponent(orderId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const body = (await res.json().catch(() => ({}))) as ListResponse & {
        error?: string;
      };
      if (!res.ok) {
        setItems([]);
        setListErr(
          typeof body.error === "string" ? body.error : `List failed (${res.status}).`,
        );
        return;
      }
      const raw = Array.isArray(body.items) ? body.items : [];
      const next: ShipmentEvidenceItem[] = [];
      for (const row of raw) {
        const t = shipmentImageTypeSchema.safeParse(row?.image_type);
        if (
          typeof row?.id === "string"
          && t.success
          && typeof row?.created_at === "string"
        ) {
          next.push({
            id: row.id,
            image_type: t.data,
            created_at: row.created_at,
            preview_url: typeof row.preview_url === "string" ? row.preview_url : null,
          });
        }
      }
      setItems(next);
    } catch {
      setItems([]);
      setListErr("Could not reach the server.");
    } finally {
      setListLoading(false);
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  async function submitUpload (e: React.FormEvent) {
    e.preventDefault();
    setUploadErr(null);
    setUploadOk(false);

    if (!accessToken || !canUpload || !shipmentId) {
      setUploadErr("Upload is not available.");
      return;
    }

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setUploadErr("Choose an image first.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setUploadErr("Only image files are accepted.");
      return;
    }

    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.set("order_id", orderId);
      fd.set("image_type", imageType);
      fd.set("file", file);

      const res = await fetch("/api/admin-shipment-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setUploadErr(
          typeof body.error === "string" ? body.error : `Upload failed (${res.status}).`,
        );
        return;
      }
      setUploadOk(true);
      if (fileRef.current) fileRef.current.value = "";
      window.setTimeout(() => {
        setUploadOk(false);
      }, 2500);
      await loadImages();
    } catch {
      setUploadErr("Could not reach the server.");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="mt-10 pt-8 border-t border-slate-200" data-testid="shipment-evidence-panel">
      <h3 id="shipment-evidence-heading" className="text-base font-semibold text-slate-900 mb-2">
        Shipment evidence (photos)
      </h3>
      <p className="text-sm text-slate-600 mb-4 max-w-2xl">
        Private label or package photos for your records. Customers do not see these on order status
        or email.
      </p>

      {listLoading ? (
        <p className="text-slate-500 text-sm" role="status">
          Loading evidence…
        </p>
      ) : null}
      {listErr ? (
        <p role="alert" className="text-red-800 text-sm mb-4">
          {listErr}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 list-none p-0 m-0">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden"
            >
              {it.preview_url ? (
                <img
                  src={it.preview_url}
                  alt={`${it.image_type} evidence`}
                  className="w-full h-40 object-cover bg-slate-100"
                />
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
                  Preview unavailable
                </div>
              )}
              <div className="px-3 py-2 text-xs text-slate-600 space-y-1">
                <div className="font-medium capitalize text-slate-800">{it.image_type}</div>
                <time dateTime={it.created_at}>{formatLocal(it.created_at)}</time>
              </div>
            </li>
          ))}
        </ul>
      ) : !listLoading ? (
        <p className="text-slate-500 text-sm mb-6">No photos uploaded yet.</p>
      ) : null}

      {!accessToken ? (
        <p className="text-slate-600 text-sm">Sign in to upload shipment photos.</p>
      ) : !canUpload ? (
        <p className="text-amber-800 text-sm" role="status">
          Photos can be uploaded once the order is paid and fulfillment is Shipped.
        </p>
      ) : !shipmentId ? (
        <p className="text-amber-800 text-sm" role="status">
          Save carrier or tracking once to create the shipment record, then you can add photos.
        </p>
      ) : (
        <form noValidate className="max-w-xl space-y-4" onSubmit={(ev) => void submitUpload(ev)}>
          <div>
            <label htmlFor="shipment-image-type" className="block text-sm font-medium text-slate-800 mb-1">
              Image type
            </label>
            <select
              id="shipment-image-type"
              name="imageType"
              value={imageType}
              disabled={uploadBusy}
              onChange={(ev) => {
                const v = shipmentImageTypeSchema.safeParse(ev.target.value);
                if (v.success) setImageType(v.data);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-3 text-base bg-white disabled:bg-slate-100"
            >
              {IMAGE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="shipment-evidence-file" className="block text-sm font-medium text-slate-800 mb-1">
              Photo
            </label>
            <input
              id="shipment-evidence-file"
              name="file"
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={uploadBusy}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            <p className="text-xs text-slate-500 mt-1">
              JPEG, PNG, or WebP — max 4&nbsp;MB. On phones you can take a photo with the camera.
            </p>
          </div>
          {uploadErr ? (
            <p role="alert" className="text-red-800 text-sm">
              {uploadErr}
            </p>
          ) : null}
          {uploadOk ? (
            <p className="text-green-800 text-sm" role="status">
              Upload complete.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={uploadBusy}
            className="min-h-11 px-5 rounded-lg border border-slate-300 bg-blue-900 text-white font-medium hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploadBusy ? "Uploading…" : "Upload photo"}
          </button>
        </form>
      )}
    </div>
  );
}
