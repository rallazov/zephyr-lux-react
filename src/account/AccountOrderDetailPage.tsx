import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiUrl } from "../lib/apiBase";
import { CUSTOMER_ACCOUNT_ORDER_UUID_REGEX } from "../lib/customerAccountOrderId";
import {
  buildCustomerOrderStatusViewModel,
} from "../order-status/customerOrderStatusViewModel";
import { CustomerOrderStatusReady } from "../order-status/CustomerOrderStatusPage";
import { parseCustomerOrderStatusWirePayload } from "../order-status/customerOrderStatusWirePayload";
import { formatPageTitleWithBrand, usePageMeta } from "../seo/meta";

type DetailState =
  | { status: "loading" }
  | { status: "bad-id" }
  | { status: "needs-auth" }
  | { status: "missing-config" }
  | { status: "error" }
  | { status: "not-found" }
  | { status: "ready"; view: ReturnType<typeof buildCustomerOrderStatusViewModel> };

const AccountOrderDetailPage: React.FC = () => {
  const params = useParams<{ orderId: string }>();
  const orderId = useMemo(() => (params.orderId ?? "").trim(), [params.orderId]);

  usePageMeta({
    title: formatPageTitleWithBrand("Your order"),
    description: "Zephyr Lux order details for signed-in shoppers.",
    canonicalPath: CUSTOMER_ACCOUNT_ORDER_UUID_REGEX.test(orderId)
      ? `/account/orders/${orderId}`
      : "/account",
  });

  const { session, loading: authLoading, configured } = useAuth();
  const [state, setState] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    if (!CUSTOMER_ACCOUNT_ORDER_UUID_REGEX.test(orderId)) {
      setState({ status: "bad-id" });
      return;
    }
    if (!configured) {
      setState({ status: "missing-config" });
      return;
    }
    if (authLoading) {
      setState({ status: "loading" });
      return;
    }
    if (!session?.access_token) {
      setState({ status: "needs-auth" });
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    setState({ status: "loading" });

    fetch(apiUrl(`/api/customer-account-order-history?order_id=${encodeURIComponent(orderId)}`), {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: ac.signal,
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setState({ status: "needs-auth" });
          return;
        }
        if (res.status === 404) {
          setState({ status: "not-found" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }

        let raw: unknown;
        try {
          raw = await res.json();
        } catch {
          raw = undefined;
        }
        if (cancelled) return;

        const data = parseCustomerOrderStatusWirePayload(raw);
        if (!data) {
          setState({ status: "error" });
          return;
        }

        setState({
          status: "ready",
          view: buildCustomerOrderStatusViewModel(data),
        });
      })
      .catch((e: unknown) => {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [orderId, session?.access_token, authLoading, configured]);

  return (
    <main className="min-h-[70vh] bg-stone-950 text-stone-50">
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-6 print:hidden">
          <Link
            to="/account"
            className="text-sm font-medium text-amber-300 underline-offset-4 hover:text-amber-200 hover:underline"
          >
            ← Back to account
          </Link>
        </div>

        {state.status === "loading" ? (
          <div
            className="border border-stone-700 bg-stone-900 px-5 py-6 text-stone-200"
            role="status"
            data-testid="account-order-detail-loading"
          >
            Loading your order…
          </div>
        ) : null}

        {state.status === "bad-id" ? (
          <div className="max-w-2xl border border-stone-700 bg-stone-900 px-5 py-6" role="alert">
            <h1 className="text-xl font-semibold">Order not available</h1>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              This link does not point to a valid order. Return to your account or use guest order lookup.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-zlx-action px-4 py-2 text-sm font-semibold text-zlx-action-text hover:bg-zlx-action-hover"
                to="/account"
              >
                Back to account
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-600 px-4 py-2 text-sm font-semibold text-stone-100 hover:border-stone-400"
                to="/order-status"
              >
                Guest order lookup
              </Link>
            </div>
          </div>
        ) : null}

        {state.status === "missing-config" ? (
          <div className="max-w-2xl border border-stone-700 bg-stone-900 px-5 py-6">
            <h1 className="text-xl font-semibold text-stone-50">Unavailable</h1>
            <p className="mt-3 text-sm text-stone-300" role="alert">
              Sign-in features are disabled because Supabase is not configured in this browser build.
            </p>
          </div>
        ) : null}

        {state.status === "needs-auth" ? (
          <div className="max-w-2xl border border-stone-700 bg-stone-900 px-5 py-6">
            <h1 className="text-xl font-semibold text-stone-50">Sign in required</h1>
            <p className="mt-3 text-sm text-stone-300">
              Sign in on the account page to view orders linked to your profile.
            </p>
            <Link
              to="/account"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-zlx-action px-4 py-2 text-sm font-semibold text-zlx-action-text hover:bg-zlx-action-hover"
            >
              Go to account
            </Link>
          </div>
        ) : null}

        {state.status === "not-found" ? (
          <div className="max-w-2xl border border-stone-700 bg-stone-900 px-5 py-6" role="alert">
            <h1 className="text-xl font-semibold text-stone-50">Order not available</h1>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              You do not have access to this order, or it may have been placed as a guest. Try guest lookup instead.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-zlx-action px-4 py-2 text-sm font-semibold text-zlx-action-text hover:bg-zlx-action-hover"
                to="/account"
              >
                Back to account
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-600 px-4 py-2 text-sm font-semibold text-stone-100 hover:border-stone-400"
                to="/order-status"
              >
                Guest order lookup
              </Link>
            </div>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="max-w-2xl border border-stone-700 bg-stone-900 px-5 py-6" role="alert">
            <h1 className="text-xl font-semibold text-stone-50">Something went wrong</h1>
            <p className="mt-3 text-sm text-stone-300">We could not load this order. Try again in a moment.</p>
          </div>
        ) : null}

        {state.status === "ready" ? (
          <div className="customer-order-print-root">
            <header className="mb-8">
              <p className="text-sm font-semibold uppercase text-neutral-400">Your order</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Order status</h1>
            </header>
            <CustomerOrderStatusReady view={state.view} />
          </div>
        ) : null}
      </section>
    </main>
  );
};

export default AccountOrderDetailPage;
