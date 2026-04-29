/**
 * Browser API base for split deploy (Vite on Vercel, handlers on Railway).
 * When `VITE_PUBLIC_API_URL` is unset, returns a path-only URL so Vite dev proxy
 * can forward `/api/*` to the local API server.
 */
export function apiUrl(path: string): string {
  const raw = import.meta.env.VITE_PUBLIC_API_URL?.trim();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!raw) return p;
  return `${raw.replace(/\/$/, "")}${p}`;
}
