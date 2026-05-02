import type { EmailOtpType, Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  customerSignInWithEmailOtp,
  verifyCustomerEmailOtp,
  type CustomerEmailOtpResult,
} from "./customerAuth";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "../lib/supabaseBrowser";

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  customerSignInWithEmailOtp: (
    email: string,
    options?: { emailRedirectTo?: string }
  ) => Promise<CustomerEmailOtpResult>;
  verifyCustomerEmailOtp: (params: {
    email: string;
    token: string;
    type: EmailOtpType;
    redirectTo?: string;
  }) => Promise<CustomerEmailOtpResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseBrowserConfigured();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
      }
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        return { error: new Error("Supabase is not configured") };
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        return { error: error as Error };
      }
      // Refresh JWT so Dashboard app_metadata.role updates apply without a full reload.
      // Do not fail sign-in if refresh fails — credentials succeeded; user may still sign out/sign in per docs.
      await supabase.auth.refreshSession();
      return { error: null };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
  }, [supabase]);

  const otpSignIn = useCallback(
    (email: string, options?: { emailRedirectTo?: string }) =>
      customerSignInWithEmailOtp(email, options),
    []
  );

  const otpVerify = useCallback(
    (params: {
      email: string;
      token: string;
      type: EmailOtpType;
      redirectTo?: string;
    }) => verifyCustomerEmailOtp(params),
    []
  );

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      configured,
      signIn,
      signOut,
      customerSignInWithEmailOtp: otpSignIn,
      verifyCustomerEmailOtp: otpVerify,
    }),
    [user, session, loading, configured, signIn, signOut, otpSignIn, otpVerify]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const c = useContext(AuthContext);
  if (!c) {
    throw new Error("useAuth must be used under AuthProvider");
  }
  return c;
}
