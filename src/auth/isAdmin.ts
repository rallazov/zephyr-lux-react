import type { User } from "@supabase/supabase-js";

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const r = (user.app_metadata as { role?: string } | null)?.role;
  return r === "admin";
}
