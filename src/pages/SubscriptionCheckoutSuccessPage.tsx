import React from "react";
import { Link } from "react-router-dom";

/** Story 8-2 AC4 — neutral messaging; activation is webhook-driven (Story 8-3). */
const SubscriptionCheckoutSuccessPage: React.FC = () => {
  return (
    <div
      data-testid="subscription-checkout-success"
      className="mx-auto max-w-xl px-4 py-16 text-neutral-200"
    >
      <h1 className="text-2xl font-semibold text-neutral-50">Thank you</h1>
      <p className="mt-4 text-neutral-400">
        If you completed Stripe checkout, your enrollment is processing. Activation and confirmation email timing
        follow Stripe Billing — refresh your inbox shortly. When our systems finish reconciling enrollment, billing
        and subscription management typically appear through Stripe&apos;s email links and Billing Portal flows.
      </p>
      <p className="mt-6 text-neutral-400">
        If you canceled or abandoned checkout, you can start again from product pages or{' '}
        <Link className="font-medium text-amber-200 underline underline-offset-4" to="/subscriptions">
          Subscribe &amp; save
        </Link>.
      </p>
      <Link
        to="/products"
        className="mt-8 inline-flex rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
      >
        Back to catalog
      </Link>
    </div>
  );
};

export default SubscriptionCheckoutSuccessPage;
