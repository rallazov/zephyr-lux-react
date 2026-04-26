import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAdminUser } from "../auth/isAdmin";
import { useAuth } from "../auth/AuthContext";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "../lib/supabaseBrowser";

function redirectPath(state: { from?: { pathname?: string } } | undefined) {
  const p = state?.from?.pathname;
  if (p && p.startsWith("/admin") && p !== "/admin/login") {
    return p;
  }
  return "/admin/products";
}

export default function AdminLogin() {
  const { user, loading, signIn, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loc = useLocation();
  const from = loc.state as { from?: { pathname?: string } } | undefined;
  const supabase = getSupabaseBrowserClient();

  if (loading) {
    return <p className="text-slate-600">Loading…</p>;
  }

  if (configured && user && isAdminUser(user)) {
    return <Navigate to={redirectPath(from)} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
  }

  if (!isSupabaseBrowserConfigured()) {
    return (
      <div className="max-w-md" data-testid="admin-supabase-missing">
        <h1 className="text-2xl font-bold text-slate-900">Admin sign in</h1>
        <p className="text-slate-600 mt-3">
          Set <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code> and{" "}
          <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in{" "}
          <code className="bg-slate-100 px-1 rounded">.env.local</code> to enable Supabase Auth.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm" data-testid="admin-login">
      <h1 className="text-2xl font-bold text-slate-900">Admin sign in</h1>
      <p className="text-slate-600 text-sm mt-1">
        Sign in with the Supabase user that has <code>role: admin</code> in app metadata.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="admin-email"
            className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="admin-password"
            className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err ? (
          <p className="text-sm text-red-700" role="alert">
            {err}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full py-2 rounded-md bg-slate-900 text-white font-medium disabled:opacity-50"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {user && !isAdminUser(user) ? (
          <p className="text-sm text-amber-800" role="status">
            Signed in, but this account is not an admin. Set{" "}
            <code className="bg-slate-100 px-1">app_metadata.role</code> to <code>admin</code> in
            Supabase, then sign out and sign in again.
          </p>
        ) : null}
        {import.meta.env.DEV && supabase ? (
          <p className="text-xs text-slate-500">
            Session: {user?.email ?? "none"} · admin role: {String(isAdminUser(user))}
          </p>
        ) : null}
      </form>
    </div>
  );
}
