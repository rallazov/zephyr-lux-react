import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  formatLineSubtotalDollars,
  queryPartialHeading,
  queryPartialSubtitle,
  resolveConfirmationView,
  type ConfirmationItemLine,
} from "../../order-confirmation/confirmationViewModel";

const SUPPORT_MAIL = "mailto:support@zephyrlux.com";

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
    fetch(
      `/api/order-by-payment-intent?payment_intent_id=${q}&order_lookup=${lq}`,
    )
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<PaidOrderApiResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.order_number) setPaidOrder(data);
      })
      .finally(() => {
        if (!cancelled) setPaidOrderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentIntentForLookup]);

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
            <Link to="/cart" className="text-amber-300 underline">
              Return to your bag
            </Link>{" "}
            — your items are still saved if you did not complete checkout.
          </li>
          <li>
            <a className="text-amber-300 underline" href={SUPPORT_MAIL}>
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
      <div className="min-h-screen bg-black text-white px-4 py-16 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Order confirmed</h1>
        <p className="text-amber-200 font-medium mb-2" role="status">
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
        <Link to="/products" className="text-amber-300 underline">
          Continue shopping
        </Link>
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
          <p className="text-sm text-gray-400 mb-4" role="status">
            Checking your order in our system…
          </p>
        )}
        <p className="text-gray-300 mb-6">{sub}</p>
        <p className="text-sm text-gray-500 mb-8" role="status">
          Your order is confirmed in our system only after we receive a successful
          payment notification — you’ll get email confirmation when that happens.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            to="/cart"
            className="inline-block text-center border border-gray-500 rounded px-4 py-2 hover:bg-gray-800"
          >
            Back to bag
          </Link>
          <a
            className="inline-block text-center border border-amber-700 text-amber-200 rounded px-4 py-2"
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
    <div className="min-h-screen bg-black text-white px-4 py-16 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Order confirmed</h1>
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
        You’ll receive a confirmation email when your payment has been fully
        recorded. If you don’t see it within a few minutes, check spam or contact
        support.
      </p>
      <p className="text-sm text-gray-500 mb-8">
        If your payment reference starts with <code className="text-gray-400">pi_</code>,
        we also try to load your store order number from our records once the
        webhook has run.
      </p>
      <Link to="/products" className="text-amber-300 underline">
        Continue shopping
      </Link>
    </div>
  );
};

export default OrderConfirmation;
