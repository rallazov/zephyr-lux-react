import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "../lib/supabaseBrowser";

/** Magic-link redirect path — list under Supabase Auth redirect URLs (10-2 implements `/account`). */
export const CUSTOMER_OTP_ACCOUNT_REDIRECT_PATH = "/account";

export type CustomerEmailOtpResult = { error: Error | null };

export function resolveCustomerOtpRedirectUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return `${window.location.origin}${CUSTOMER_OTP_ACCOUNT_REDIRECT_PATH}`;
}

function resolveEmailRedirectTo(
  options: { emailRedirectTo?: string } | undefined
): string | null {
  const raw =
    options?.emailRedirectTo !== undefined
      ? options.emailRedirectTo
      : resolveCustomerOtpRedirectUrl();
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function customerSignInWithEmailOtp (
  email: string,
  options?: { emailRedirectTo?: string }
): Promise<CustomerEmailOtpResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !isSupabaseBrowserConfigured()) {
    return { error: new Error("Supabase is not configured") };
  }
  const trimmed = email.trim();
  if (!trimmed) {
    return { error: new Error("Email is required") };
  }
  const emailRedirectTo = resolveEmailRedirectTo(options);
  if (!emailRedirectTo) {
    return { error: new Error("Email redirect URL is required") };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo,
    },
  });
  return { error: (error ?? null) as Error | null };
}

export async function verifyCustomerEmailOtp (params: {
  email: string;
  token: string;
  type: EmailOtpType;
  redirectTo?: string;
}): Promise<CustomerEmailOtpResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !isSupabaseBrowserConfigured()) {
    return { error: new Error("Supabase is not configured") };
  }
  const trimmedEmail = params.email.trim();
  const trimmedToken = params.token.trim();
  if (!trimmedEmail || !trimmedToken) {
    return { error: new Error("Email and verification token are required") };
  }
  let redirectTo: string | undefined;
  if (params.redirectTo !== undefined) {
    const t = params.redirectTo.trim();
    if (!t) {
      return { error: new Error("Redirect URL cannot be empty") };
    }
    redirectTo = t;
  }
  const { error } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: params.type,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (error) {
    return { error: error as Error };
  }
  try {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) {
      return { error: refreshed.error as Error };
    }
    if (!refreshed.data?.session) {
      return { error: new Error("Session was not established after verification") };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
  return { error: null };
}
