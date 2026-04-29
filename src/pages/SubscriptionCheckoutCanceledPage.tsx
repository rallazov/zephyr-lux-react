import React from "react";
import { Link } from "react-router-dom";

/** Story 8-2 AC4 — cancel return from Stripe Checkout. */
const SubscriptionCheckoutCanceledPage: React.FC = () => {
  return (
    <div
      data-testid="subscription-checkout-canceled"
      className="mx-auto max-w-xl px-4 py-16 text-neutral-200"
    >
      <h1 className="text-2xl font-semibold text-neutral-50">Checkout canceled</h1>
      <p className="mt-4 text-neutral-400">
        Nothing was billed. Your cart for one-time purchases was not changed — repeat delivery signup is handled
        separately from standard checkout.
      </p>
      <Link
        to="/subscriptions"
        className="mt-8 inline-flex rounded-md bg-zlx-action px-4 py-2 text-sm font-semibold text-zlx-action-text"
      >
        Return to Subscribe &amp; save
      </Link>
      <Link
        to="/products"
        className="ml-4 mt-8 inline-flex rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
      >
        Browse products
      </Link>
    </div>
  );
};

export default SubscriptionCheckoutCanceledPage;
