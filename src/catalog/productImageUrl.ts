import { PRODUCT_IMAGE_BUCKET_ID } from "../domain/commerce/productImage";

function readSupabaseUrl(): string | undefined {
  if (typeof import.meta === "undefined" || !import.meta.env) return undefined;
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const t = raw?.trim();
  return t || undefined;
}

function encodeObjectPath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function resolveProductImageUrl(
  storagePath: string | null | undefined,
  supabaseUrl = readSupabaseUrl(),
): string {
  const raw = storagePath?.trim() ?? "";
  if (!raw) return "";
  if (
    raw.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(raw)
  ) {
    return raw;
  }

  if (!supabaseUrl) return raw;

  const objectPath = raw.startsWith(`${PRODUCT_IMAGE_BUCKET_ID}/`)
    ? raw.slice(PRODUCT_IMAGE_BUCKET_ID.length + 1)
    : raw;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET_ID}/${encodeObjectPath(objectPath)}`;
}
