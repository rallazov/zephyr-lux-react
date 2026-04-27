import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV, isSupabaseOrderPersistenceConfigured } from "./env";

let _client: SupabaseClient | null | undefined;

/**
 * Service-role Supabase client for serverless order + webhook persistence only.
 * Returns null when URL/key are not configured (callers should fail fast for Epic 4 paths).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  if (!isSupabaseOrderPersistenceConfigured()) {
    _client = null;
    return _client;
  }
  _client = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** Test helper: reset cached client after env mocks change. */
export function resetSupabaseAdminClientForTests(): void {
  _client = undefined;
}
