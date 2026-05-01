import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { formatPageTitleWithBrand, usePageMeta } from "../seo/meta";
import {
  buildCustomerOrderStatusViewModel,
  type CustomerOrderStatusResponse,
  type CustomerOrderStatusViewModel,
} from "./customerOrderStatusViewModel";
import { apiUrl } from "../lib/apiBase";

const SUPPORT_MAIL = "mailto:support@zephyrlux.com";

type LoadState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "ready"; view: CustomerOrderStatusViewModel };

const CustomerOrderStatusPage: React.FC = () => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const token = useMemo(
    () => (params.token ?? searchParams.get("token") ?? "").trim(),
    [params.token, searchParams],
  );
  const [loadState, setLoadState] = useState<LoadState>(() =>
    token ? { status: "loading" } : { status: "invalid" },
  );

  usePageMeta({
    title: formatPageTitleWithBrand("Order status"),
    description: "Secure Zephyr Lux customer order status.",
    canonicalPath: "/order-status",
  });

  useEffect(() => {
    if (!token) {
      setLoadState({ status: "invalid" });
      return;
    }

    let cancelled = false;
    setLoadState({ status: "loading" });

    fetch(apiUrl(`/api/customer-order-status?token=${encodeURIComponent(token)}`))
      .then(async (response) => {
        if (!response.ok) throw new Error("order status unavailable");
        return response.json() as Promise<CustomerOrderStatusResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setLoadState({ status: "ready", view: buildCustomerOrderStatusViewModel(data) });
      })
      .catch(() => {
        if (!cancelled) setLoadState({ status: "invalid" });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-[70vh] bg-stone-950 text-stone-50 customer-order-print-root">
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-neutral-400">
              Secure order link
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
              Order status
            </h1>
          </div>
          <a
            className={[
              "text-sm font-medium text-neutral-300 underline-offset-4 hover:text-amber-200 hover:underline",
              loadState.status === "ready" ? "print:hidden" : "",
            ].filter(Boolean).join(" ")}
            href={SUPPORT_MAIL}
          >
            Email support
          </a>
        </div>

        {loadState.status === "loading" && (
          <div
            className="border border-stone-700 bg-stone-900 px-5 py-6 text-stone-200"
            role="status"
          >
            Loading your order status...
          </div>
        )}

        {loadState.status === "invalid" && (
          <div className="max-w-2xl border border-stone-700 bg-stone-900 px-5 py-6">
            <h2 className="text-xl font-semibold text-stone-50">This link is not available</h2>
            <p className="mt-3 text-sm leading-6 text-stone-300" role="alert">
              The order status link may be expired or invalid. Request a fresh secure link,
              or email support if you need help with an order.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-zlx-action px-4 py-2 text-sm font-semibold text-zlx-action-text hover:bg-zlx-action-hover"
                to="/order-status"
              >
                Request a new link
              </Link>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-600 px-4 py-2 text-sm font-semibold text-stone-100 hover:border-stone-400"
                href={SUPPORT_MAIL}
              >
                Email support
              </a>
            </div>
          </div>
        )}

        {loadState.status === "ready" && <OrderStatusReady view={loadState.view} />}
      </section>
    </main>
  );
};

function OrderStatusReady({ view }: { view: CustomerOrderStatusViewModel }) {
  return (
    <div className="order-print-customer-ready space-y-6">
      <section className="grid gap-5 border border-stone-700 bg-stone-900 px-5 py-6 sm:grid-cols-[1.2fr_0.8fr] sm:px-6">
        <div className="flex flex-col gap-4 min-w-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-sm text-stone-400">Order {view.orderNumber}</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-50">
              {view.fulfillmentLabel}
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              Placed {view.placedAt}
              {view.maskedEmail ? ` for ${view.maskedEmail}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="print:hidden shrink-0 min-h-11 rounded-md border border-stone-500 bg-stone-800 px-4 py-2 text-sm font-semibold text-stone-100 hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            onClick={() => window.print()}
          >
            Print order
          </button>
        </div>
        <dl className="grid gap-3 text-sm sm:text-right">
          <div>
            <dt className="text-stone-400">Payment</dt>
            <dd className="font-medium text-stone-50">{view.paymentLabel}</dd>
          </div>
          <div>
            <dt className="text-stone-400">Total</dt>
            <dd className="font-medium text-stone-50">{view.totalDisplay}</dd>
          </div>
        </dl>
      </section>

      <section className="border border-stone-700 bg-stone-900 px-5 py-6 sm:px-6 print:hidden">
        <h2 className="text-lg font-semibold text-stone-50">Progress</h2>
        <ol
          aria-label="Fulfillment progress"
          className="mt-5 grid gap-4 sm:grid-cols-4"
        >
          {view.progress.map((step, index) => (
            <li key={step.status} className="flex items-center gap-3 sm:block">
              <span
                aria-hidden="true"
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold sm:mb-3",
                    step.state === "complete"
                      ? "border-neutral-400 bg-neutral-300 text-stone-950"
                      : step.state === "current"
                        ? "border-amber-500 bg-amber-600 text-white"
                        : "border-stone-600 text-stone-500",
                ].join(" ")}
              >
                {step.state === "complete" ? "✓" : index + 1}
              </span>
              <span
                className={
                  step.state === "upcoming"
                    ? "text-sm font-medium text-stone-500"
                    : "text-sm font-medium text-stone-100"
                }
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="border border-stone-700 bg-stone-900 px-5 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-stone-50">Items</h2>
          <p className="text-sm font-medium text-stone-200">{view.totalDisplay}</p>
        </div>
        <ul className="mt-4 divide-y divide-stone-800">
          {view.items.map((item) => (
            <li key={item.key} className="flex gap-4 py-4">
              {item.imageUrl && (
                <img
                  alt=""
                  className="print:hidden h-16 w-16 shrink-0 rounded-md object-cover"
                  src={item.imageUrl}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-50">{item.title}</p>
                <p className="mt-1 text-xs uppercase text-stone-500">SKU {item.sku}</p>
                <p className="mt-2 text-sm text-stone-300">
                  {item.quantity} x {item.unitPriceDisplay}
                </p>
              </div>
              <p className="text-sm font-medium text-stone-100">{item.totalDisplay}</p>
            </li>
          ))}
        </ul>
      </section>

      {view.tracking && (
        <section
          aria-labelledby="order-tracking-heading"
          className="border border-stone-700 bg-stone-900 px-5 py-6 sm:px-6"
        >
          <h2 id="order-tracking-heading" className="text-lg font-semibold text-stone-50">
            Tracking
          </h2>
          {view.tracking.showPendingNotice ? (
            <p className="mt-3 text-sm leading-6 text-stone-300">
              Tracking details are not available yet.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <dl className="grid gap-3 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
                  <dt className="text-stone-400">Shipment status</dt>
                  <dd className="text-right font-medium text-stone-100 sm:min-w-[12rem]">
                    {view.tracking.shipmentStatusLabel}
                  </dd>
                </div>
                {view.tracking.carrier && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
                    <dt className="text-stone-400">Carrier</dt>
                    <dd className="text-right font-medium text-stone-50 sm:min-w-[12rem]">
                      {view.tracking.carrier}
                    </dd>
                  </div>
                )}
                {view.tracking.trackingNumber && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
                    <dt className="text-stone-400">Tracking number</dt>
                    <dd className="break-all text-right font-medium text-stone-50 sm:min-w-[12rem]">
                      {view.tracking.trackingNumber}
                    </dd>
                  </div>
                )}
                {view.tracking.shippedAtDisplay && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
                    <dt className="text-stone-400">Shipped</dt>
                    <dd className="text-right font-medium text-stone-100 sm:min-w-[12rem]">
                      {view.tracking.shippedAtDisplay}
                    </dd>
                  </div>
                )}
                {view.tracking.deliveredAtDisplay && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
                    <dt className="text-stone-400">Delivered</dt>
                    <dd className="text-right font-medium text-stone-100 sm:min-w-[12rem]">
                      {view.tracking.deliveredAtDisplay}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {view.tracking.trackHref && (
                  <a
                    className="print:hidden inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 sm:w-auto"
                    href={view.tracking.trackHref}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    Open tracking page
                  </a>
                )}
                {view.tracking.opaqueOrUnsafeUrl && (
                  <p className="text-sm leading-6 text-stone-400 break-all">
                    Tracking link (not clickable): {view.tracking.opaqueOrUnsafeUrl}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="border border-stone-700 bg-stone-900 px-5 py-6 sm:px-6">
        <h2 className="text-lg font-semibold text-stone-50">Timeline</h2>
        {view.timeline.length > 0 ? (
          <ol className="mt-4 space-y-3">
            {view.timeline.map((event) => (
              <li key={event.key} className="border-l border-neutral-600 pl-4">
                <p className="text-sm font-medium text-stone-50">{event.label}</p>
                <p className="mt-1 text-xs text-stone-500">{event.createdAt}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm leading-6 text-stone-300">
            We will add updates here as fulfillment moves forward.
          </p>
        )}
      </section>
    </div>
  );
}

export default CustomerOrderStatusPage;
