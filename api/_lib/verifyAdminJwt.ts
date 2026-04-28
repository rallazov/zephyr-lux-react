import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

export type VerifiedAdmin = { userId: string };

function extractBearer(raw: string): string | null {
  const m = /^Bearer\s+(\S+)/iu.exec(raw.trim());
  return m?.[1]?.trim() ? m[1] : null;
}

/** Parse `Authorization` from a Vercel/Node header (string or first array entry). */
export function getBearerAuthorizationHeader(
  header: string | string[] | undefined,
): string | null {
  if (!header) return null;
  const h = typeof header === "string" ? header : header[0];
  return extractBearer(h ?? "");
}

/**
 * Validates Bearer JWT and ensures `app_metadata.role === "admin"` (same as `RequireAdmin`).
 */
export async function verifyAdminJwt(accessToken: string): Promise<VerifiedAdmin | null> {
  const token = accessToken.trim();
  if (!token || !ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  const role = (data.user.app_metadata as { role?: string } | null)?.role;
  if (role !== "admin") {
    return null;
  }

  return { userId: data.user.id };
}
