import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { resolveCustomerOtpRedirectUrl } from "../auth/customerAuth";
import type { FulfillmentStatus, PaymentStatus } from "../domain/commerce/enums";
import { formatCents } from "../lib/money";
import { apiUrl } from "../lib/apiBase";
import {
  customerFulfillmentLabel,
  customerPaymentLabel,
  formatCustomerOrderDate,
} from "../order-status/customerOrderStatusViewModel";
import { formatPageTitleWithBrand, usePageMeta } from "../seo/meta";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ApiListRow = {
  order_id: string;
  order_number: string;
  created_at: string;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  total_cents: number;
  currency: string;
  item_count: number;
};

type HistoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; orders: ApiListRow[] };

function formatOrderMoneyLine(cents: number, currency: string): string {
  if (!Number.isFinite(cents)) return "—";
  try {
    return formatCents(Math.trunc(cents), currency || "USD");
  } catch {
    return "—";
  }
}

const AccountPage: React.FC = () => {
  usePageMeta({
    title: formatPageTitleWithBrand("Account"),
    description: "Sign in or review your Zephyr Lux account and order history.",
    canonicalPath: "/account",
  });

  const {
    signOut,
    user,
    session,
    loading: authLoading,
    configured,
    customerSignInWithEmailOtp,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [signInPhase, setSignInPhase] = useState<"idle" | "submitting" | "sent">("idle");
  const [signInError, setSignInError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryState>({ status: "idle" });

  const loadHistory = useCallback(
    async (accessToken: string, signal: AbortSignal, guardUserId: string) => {
      setHistory({ status: "loading" });
      try {
        const res = await fetch(apiUrl("/api/customer-account-order-history"), {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal,
        });

        let body: { orders?: ApiListRow[]; error?: string } | null = null;
        try {
          body = (await res.json()) as { orders?: ApiListRow[]; error?: string };
        } catch {
          body = null;
        }
        if (signal.aborted) return;

        if (!res.ok) {
          const msg =
            body && typeof body.error === "string"
              ? body.error
              : "Unable to load order history right now.";
          if (!signal.aborted) setHistory({ status: "error", message: msg });
          return;
        }

        if (body === null) {
          if (!signal.aborted) {
            setHistory({
              status: "error",
              message: "Unable to load order history right now.",
            });
          }
          return;
        }

        if (!("orders" in body) || !Array.isArray(body.orders)) {
          if (!signal.aborted) {
            setHistory({
              status: "error",
              message: "Unable to load order history right now.",
            });
          }
          return;
        }

        const rows = body.orders as ApiListRow[];
        if (signal.aborted || user?.id !== guardUserId) return;
        setHistory({ status: "ready", orders: rows });
      } catch (e) {
        if (signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setHistory({ status: "error", message: "Unable to load order history right now." });
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (!user?.id || !session?.access_token) {
      setHistory({ status: "idle" });
      return;
    }
    const ctrl = new AbortController();
    const token = session.access_token;
    const uid = user.id;
    void loadHistory(token, ctrl.signal, uid);
    return () => {
      ctrl.abort();
    };
  }, [user?.id, session?.access_token, loadHistory]);

  const onSubmitMagicLink = async (evt: React.FormEvent) => {
    evt.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setSignInError("Enter a valid email address.");
      return;
    }

    setSignInPhase("submitting");
    setSignInError(null);
    const { error } = await customerSignInWithEmailOtp(trimmed, {
      emailRedirectTo: resolveCustomerOtpRedirectUrl(),
    });
    if (error) {
      setSignInPhase("idle");
      setSignInError("We could not send a sign-in link. Try again in a moment.");
      return;
    }
    setSignInPhase("sent");
  };

  if (!configured) {
    return (
      <main
        className="min-h-[60vh] bg-stone-950 px-4 py-10 text-stone-100 sm:px-6"
        data-testid="account-page"
      >
        <div className="mx-auto max-w-lg border border-stone-700 bg-stone-900 px-5 py-6">
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="mt-3 text-sm leading-6 text-stone-300" role="alert">
            Sign-in is not available in this environment. Check that Supabase is configured.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-[60vh] bg-stone-950 px-4 py-10 text-stone-50 sm:px-6 lg:py-14"
      data-testid="account-page"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header>
          <h1 className="text-3xl font-semibold">Account</h1>
          <p className="mt-2 max-w-xl text-sm text-stone-400">
            Optional sign-in lets you revisit orders signed to your profile. Guests can always check out
            and use secure order-status links — no password required here.
          </p>
          <Link
            to="/order-status"
            className="mt-6 inline-flex min-h-11 items-center rounded-md border border-stone-600 px-4 py-2 text-sm font-medium text-stone-100 underline-offset-4 hover:border-stone-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            Guest order lookup
          </Link>
        </header>

        {authLoading ? (
          <section
            className="border border-stone-700 bg-stone-900 px-5 py-6 text-sm text-stone-200"
            role="status"
            data-testid="account-auth-loading"
          >
            Checking your session...
          </section>
        ) : !user ? (
          <section className="border border-stone-700 bg-stone-900 px-5 py-6 sm:px-6">
            <h2 className="text-lg font-semibold text-stone-50">Sign in without a password</h2>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Enter your email and we will send a one-time magic link.
            </p>
            <form className="mt-6 grid gap-4" onSubmit={onSubmitMagicLink} noValidate>
              <label className="grid gap-1 text-sm font-medium text-stone-100" htmlFor="account-email">
                Email
                <input
                  id="account-email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  disabled={signInPhase === "submitting" || signInPhase === "sent"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-md border border-stone-600 bg-stone-950 px-3 py-2 text-stone-50 outline-none ring-amber-500/70 focus-visible:ring-2"
                />
              </label>

              {signInError ? (
                <p className="text-sm font-medium text-red-300" role="alert">
                  {signInError}
                </p>
              ) : null}

              {signInPhase === "sent" ? (
                <p className="text-sm font-medium text-emerald-300" role="status">
                  Check your email for a sign-in link. You can close this tab after you click it.
                </p>
              ) : null}

              <button
                type="submit"
                disabled={signInPhase === "submitting" || signInPhase === "sent"}
                className="inline-flex min-h-11 w-full max-w-xs items-center justify-center rounded-md bg-zlx-action px-4 py-2 text-sm font-semibold text-zlx-action-text hover:bg-zlx-action-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signInPhase === "submitting" ? "Sending link…" : "Email me a sign-in link"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="border border-stone-700 bg-stone-900 px-5 py-6 sm:px-6">
              <h2 className="text-lg font-semibold text-stone-50">Signed in</h2>
              <p className="mt-2 break-all text-sm text-stone-300" data-testid="account-profile-email">
                {user.email ?? "—"}
              </p>
              <button
                type="button"
                className="mt-5 inline-flex min-h-11 items-center rounded-md border border-stone-500 px-4 py-2 text-sm font-semibold text-stone-100 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </section>

            <section className="border border-stone-700 bg-stone-900 px-5 py-6 sm:px-6" aria-labelledby="order-history-heading">
              <h2 id="order-history-heading" className="text-lg font-semibold text-stone-50">
                Order history
              </h2>

              {history.status === "loading" ? (
                <p className="mt-4 text-sm text-stone-300" role="status" data-testid="account-history-loading">
                  Loading your orders…
                </p>
              ) : null}

              {history.status === "error" ? (
                <p className="mt-4 text-sm font-medium text-red-300" role="alert" data-testid="account-history-error">
                  {history.message}
                </p>
              ) : null}

              {history.status === "ready" && history.orders.length === 0 ? (
                <div className="mt-4 space-y-4" data-testid="account-history-empty">
                  <p className="text-sm leading-6 text-stone-300">
                    No orders are linked to this account yet. Guest purchases stay findable with a secure
                    link from your email.
                  </p>
                  <Link
                    to="/order-status"
                    className="inline-flex min-h-11 items-center rounded-md bg-zlx-action px-4 py-2 text-sm font-semibold text-zlx-action-text hover:bg-zlx-action-hover"
                  >
                    Look up an order
                  </Link>
                </div>
              ) : null}

              {history.status === "ready" && history.orders.length > 0 ? (
                <ul className="mt-4 grid gap-3" data-testid="account-history-list">
                  {history.orders.map((o) => (
                    <li key={o.order_id}>
                      <Link
                        to={`/account/orders/${encodeURIComponent(o.order_id)}`}
                        className="block min-h-[4.5rem] rounded-md border border-stone-700 bg-stone-950/40 px-4 py-3 transition hover:border-amber-600/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 sm:flex sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-stone-50">{o.order_number}</p>
                          <p className="mt-1 text-xs uppercase text-stone-500">{formatCustomerOrderDate(o.created_at)}</p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-300">
                            <span className="shrink-0">{customerPaymentLabel(o.payment_status)}</span>
                            <span className="shrink-0">{customerFulfillmentLabel(o.fulfillment_status)}</span>
                          </div>
                          <p className="mt-1 text-xs text-stone-400">
                            {o.item_count} item{o.item_count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="mt-3 shrink-0 text-left sm:mt-0 sm:text-right">
                          <p className="text-sm font-semibold text-stone-50 tabular-nums">
                            {formatOrderMoneyLine(o.total_cents, o.currency)}
                          </p>
                          <p className="mt-2 text-xs font-semibold uppercase text-amber-400">View status</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  );
};

export default AccountPage;
