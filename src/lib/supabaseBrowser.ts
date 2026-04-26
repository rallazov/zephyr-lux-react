import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(
    url && url.trim() !== "" && anon && anon.trim() !== ""
  );
}

let client: SupabaseClient | null = null;

/**
 * Supabase client for the browser. Returns null if URL/anon key are not set.
 * Never use service role keys here.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseBrowserConfigured()) {
    return null;
  }
  if (!client) {
    client = createClient(url!.trim(), anon!.trim());
  }
  return client;
}

const REQUIRED_ENV_MESSAGE =
  "Supabase catalog requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY when VITE_CATALOG_BACKEND=supabase. See .env.example.";

/**
 * Same singleton as `getSupabaseBrowserClient`, but throws if env is missing.
 * Use when the app has already selected the Supabase catalog path.
 */
export function requireSupabaseBrowserClient(): SupabaseClient {
  const c = getSupabaseBrowserClient();
  if (!c) {
    throw new Error(REQUIRED_ENV_MESSAGE);
  }
  return c;
}
