import React, { useEffect, useMemo, useState } from "react";
import { ANALYTICS_EVENTS } from "../../analytics/events";
import { consumePurchaseAnalyticsSlot } from "../../analytics/purchaseDedupe";
import { dispatchAnalyticsEvent } from "../../analytics/sink";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  formatLineSubtotalDollars,
  queryPartialHeading,
  queryPartialSubtitle,
  resolveConfirmationView,
  type ConfirmationItemLine,
} from "../../order-confirmation/confirmationViewModel";
import { formatPageTitleWithBrand, usePageMeta } from "../../seo/meta";
import { SITE_BRAND } from "../../seo/site";
import { apiUrl } from "../../lib/apiBase";

const SUPPORT_MAIL = "mailto:support@zephyrlux.com";
const ORDER_LOOKUP_POLL_ATTEMPTS = 15;
const ORDER_LOOKUP_POLL_DELAY_MS = 2_000;

type PaidOrderApiResponse = {
  order_number: string;
  email: string;
  total_cents: number;
  items: ConfirmationItemLine[];
};

const OrderConfirmation: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [paidOrder, setPaidOrder] = useState<PaidOrderApiResponse | null>(null);
  const [paidOrderLoading, setPaidOrderLoading] = useState(false);

  const view = useMemo(
    () =>
      resolveConfirmationView({
        locationState: location.state,
        searchParams,
      }),
    [location.state, searchParams]
  );

  const paymentIntentForLookup =
    view.stripeQuery.paymentIntentId ??
    (view.paymentRef?.startsWith("pi_") ? view.paymentRef : null);

  const orderConfirmMeta = useMemo(() => {
    const path = location.pathname || "/order-confirmation";
    if (view.mode === "fallback") {
      return {
        title: `Order help — ${SITE_BRAND}`,
        description:
          "We could not load full order details. Check your email or return to your bag.",
        canonicalPath: path,
      };
    }
    if (paidOrder?.order_number && paymentIntentForLookup) {
      return {
        title: `Order ${paidOrder.order_number} confirmed — ${SITE_BRAND}`,
        description: "Your payment was recorded. Thank you for shopping with Zephyr Lux.",
        canonicalPath: path,
      };
    }
    if (view.mode === "queryPartial") {
      const head = queryPartialHeading(view.stripeQuery.redirectStatus);
      return {
        title: `${head} — ${SITE_BRAND}`,
        description: queryPartialSubtitle(view.stripeQuery.redirectStatus),
        canonicalPath: path,
      };
    }
    return {
      title: formatPageTitleWithBrand("Order confirmation"),
      description: "Your Zephyr Lux order confirmation.",
      canonicalPath: path,
    };
  }, [
    location.pathname,
    view.mode,
    view.stripeQuery.redirectStatus,
    paidOrder?.order_number,
    paymentIntentForLookup,
  ]);

  usePageMeta(orderConfirmMeta);

  useEffect(() => {
    if (!paymentIntentForLookup) return;
    let cancelled = false;
    setPaidOrderLoading(true);
    setPaidOrder(null);
    const q = encodeURIComponent(paymentIntentForLookup);
    let lookup: string | null = null;
    try {
      lookup = sessionStorage.getItem(`zlx_pilu_${paymentIntentForLookup}`);
    } catch {
      lookup = null;
    }
    if (!lookup) {
      setPaidOrderLoading(false);
      return;
    }
    const lq = encodeURIComponent(lookup);
    const lookupUrl = apiUrl(`/api/order-by-payment-intent?payment_intent_id=${q}&order_lookup=${lq}`);
    const wait = (ms: number) =>
      new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const poll = async () => {
      for (let attempt = 0; attempt < ORDER_LOOKUP_POLL_ATTEMPTS && !cancelled; attempt += 1) {
        try {
          const response = await fetch(lookupUrl);
          if (response.ok) {
            const data = (await response.json()) as PaidOrderApiResponse;
            if (!cancelled && data?.order_number) {
              setPaidOrder(data);
              setPaidOrderLoading(false);
              return;
            }
          }
        } catch {
          /* Keep polling briefly; Stripe webhooks can land a moment after redirect. */
        }
        if (attempt < ORDER_LOOKUP_POLL_ATTEMPTS - 1) {
          await wait(ORDER_LOOKUP_POLL_DELAY_MS);
        }
      }
      if (!cancelled) setPaidOrderLoading(false);
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentIntentForLookup]);

  useEffect(() => {
    const orderNumRaw = paidOrder?.order_number;
    if (!orderNumRaw) return;
    const orderNum = orderNumRaw.trim();
    if (!orderNum) return;

    if (!consumePurchaseAnalyticsSlot(orderNum)) return;

    dispatchAnalyticsEvent({
      name: ANALYTICS_EVENTS.purchase,
      payload: { order_number: orderNum },
    });
  }, [paidOrder?.order_number]);

  if (view.mode === "fallback") {
    return (
      <div className="min-h-screen bg-black text-white px-4 py-16 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          We couldn’t load your order details on this page
        </h1>
        <p className="text-gray-300 mb-4">
          If you just paid, your payment may still be processing. Please check
          your email for a receipt or confirmation, or return to your bag to
          try again.
        </p>
        <ul className="list-disc pl-5 text-gray-300 space-y-2 mb-8">
          <li>Check your email for a confirmation or receipt from Stripe or Zephyr Lux.</li>
          <li>
            <Link to="/cart" className="text-neutral-200 underline decoration-neutral-500 underline-offset-4 hover:text-white">
              Return to your bag
            </Link>{" "}
            — your items are still saved if you did not complete checkout.
          </li>
          <li>
            <a className="text-neutral-200 underline decoration-neutral-500 underline-offset-4 hover:text-white" href={SUPPORT_MAIL}>
              Email support
            </a>{" "}
            if you need help.
          </li>
        </ul>
        <p className="text-sm text-gray-500" role="status">
          A full order number will appear after your payment is recorded in our
          system (not shown on this page yet).
        </p>
      </div>
    );
  }

  if (paidOrder && paymentIntentForLookup) {
    const displayItems =
      paidOrder.items?.length ? paidOrder.items : view.items ?? [];
    const displayTotalDollars = paidOrder.total_cents / 100;
    const displayEmail = paidOrder.email || view.email;
    return (
      <div className="min-h-screen bg-black px-4 py-16 text-white">
        <main className="zlx-card mx-auto max-w-2xl p-6 sm:p-8">
        <p className="mb-3 font-bold text-zlx-success" role="status">✓ Order confirmed</p>
        <h1 className="text-3xl font-extrabold mb-2">Thank you for your order</h1>
        <p className="text-neutral-200 font-medium mb-2">
          Order number: {paidOrder.order_number}
        </p>
        <p className="text-gray-200 mb-1">
          <span className="text-gray-400">Payment reference: </span>
          {paymentIntentForLookup}
        </p>
        {displayEmail && (
          <p className="text-gray-300 mb-4">
            <span className="text-gray-400">Email: </span>
            {displayEmail}
          </p>
        )}
        {displayItems.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Items</h2>
            <ul className="border border-gray-700 rounded divide-y divide-gray-800">
              {displayItems.map((item) => (
                <li
                  key={String(item.id ?? item.name)}
                  className="flex justify-between py-2 px-3 text-sm"
                >
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>${formatLineSubtotalDollars(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-lg font-semibold mb-6">
          Total: ${displayTotalDollars.toFixed(2)}
        </p>
        <p className="text-gray-300 mb-4" role="status">
          Your payment is recorded in our system. You’ll receive a confirmation
          email when fulfillment updates are available.
        </p>
        <Link to="/products" className="zlx-btn-primary inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2 font-extrabold no-underline">
          Continue shopping
        </Link>
        </main>
      </div>
    );
  }

  if (view.mode === "queryPartial") {
    const sub = queryPartialSubtitle(view.stripeQuery.redirectStatus);
    const head = queryPartialHeading(view.stripeQuery.redirectStatus);
    return (
      <div className="min-h-screen bg-black text-white px-4 py-16 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{head}</h1>
        {view.paymentRef && (
          <p className="text-gray-200 mb-4">
            <span className="text-gray-400">Payment reference: </span>
            {view.paymentRef}
          </p>
        )}
        {view.stripeQuery.redirectStatus && (
          <p className="text-sm text-gray-500 mb-4">
            Status: {view.stripeQuery.redirectStatus}
          </p>
        )}
        {paidOrderLoading && (
          <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100" role="status">
            Recording your order number. This can take a few seconds after Stripe authorizes the payment.
          </div>
        )}
        <p className="text-gray-300 mb-6">{sub}</p>
        <p className="text-sm text-gray-500 mb-8" role="status">
          {paidOrderLoading
            ? "We are checking for the paid order record now. The order number will appear here as soon as the webhook finishes."
            : "If the order number does not appear, check the payment webhook and confirmation email logs. Your card authorization alone is not the final store order record."}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            to="/cart"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 py-2 text-center font-semibold text-black hover:bg-neutral-200"
          >
            Back to bag
          </Link>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-600 px-5 py-2 text-center font-semibold text-neutral-100 hover:border-neutral-300 hover:bg-neutral-900"
            href={SUPPORT_MAIL}
          >
            Email support
          </a>
        </div>
      </div>
    );
  }

  // full
  return (
    <div className="min-h-screen bg-black px-4 py-16 text-white">
      <main className="zlx-card mx-auto max-w-2xl p-6 sm:p-8">
      <p className="mb-3 font-bold text-zlx-success" role="status">✓ Order confirmed</p>
      <h1 className="text-3xl font-extrabold mb-2">Thank you for your order</h1>
      {paidOrderLoading && (
        <p className="text-sm text-gray-400 mb-4" role="status">
          Loading order details…
        </p>
      )}
      {view.paymentRef && (
        <p className="text-gray-200 mb-1">
          <span className="text-gray-400">Payment reference: </span>
          {view.paymentRef}
        </p>
      )}
      {view.orderNumber && (
        <p className="text-neutral-200 font-medium mb-1">
          <span className="text-gray-400">Mock order number: </span>
          {view.orderNumber}
        </p>
      )}
      {view.email && (
        <p className="text-gray-300 mb-4">
          <span className="text-gray-400">Email: </span>
          {view.email}
        </p>
      )}
      {view.items && view.items.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Items</h2>
          <ul className="border border-gray-700 rounded divide-y divide-gray-800">
            {view.items.map((item) => (
              <li
                key={String(item.id ?? item.name)}
                className="flex justify-between py-2 px-3 text-sm"
              >
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>${formatLineSubtotalDollars(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.total != null && (
        <p className="text-lg font-semibold mb-6">
          Total: ${view.total.toFixed(2)}
        </p>
      )}
      <p className="text-gray-300 mb-4" role="status">
        {view.orderNumber?.startsWith("MOCK-")
          ? "This is a mock checkout confirmation. It does not create a paid order in Supabase or send a customer confirmation email."
          : "You’ll receive a confirmation email when your payment has been fully recorded. If you don’t see it within a few minutes, check spam or contact support."}
      </p>
      <p className="text-sm text-gray-500 mb-8">
        If your payment reference starts with <code className="text-gray-400">pi_</code>,
        we also try to load your store order number from our records once the
        webhook has run.
      </p>
      <Link to="/products" className="zlx-btn-primary inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2 font-extrabold no-underline">
        Continue shopping
      </Link>
      </main>
    </div>
  );
};

export default OrderConfirmation;
