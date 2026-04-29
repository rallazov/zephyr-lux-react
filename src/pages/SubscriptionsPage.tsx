import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDefaultCatalogAdapter } from "../catalog/factory";
import type { CatalogListItem } from "../catalog/types";
import { subscriptionPlanCadenceLabel } from "../domain/commerce/subscription";

function formatMoneyEURStyle(cents: number, currency: string): string {
  const amt = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amt);
  } catch {
    return `${amt.toFixed(2)} ${currency}`;
  }
}

/** Story 8-2 AC1 — products with Stripe Billing subscription options (when Supabase plans exist). */
const SubscriptionsPage: React.FC = () => {
  const [items, setItems] = useState<CatalogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const adapter = getDefaultCatalogAdapter();
        const list = await adapter.listProducts();
        setItems(list.filter((i) => i.subscriptionPlans.length > 0));
      } catch {
        setError("Could not load subscriptions.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-neutral-300">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-red-400" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div data-testid="subscriptions-page" className="mx-auto max-w-3xl px-4 py-10 text-neutral-200 lg:py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-50">Subscribe &amp; save</h1>
      <p className="mt-3 text-neutral-400">
        Choose a product below to open Stripe&apos;s secure subscription checkout — card details stay with Stripe,
        not in this storefront.
      </p>
      {items.length === 0 ? (
        <p className="mt-8 rounded-lg border border-neutral-700 bg-neutral-950/70 p-6 text-sm text-neutral-400">
          No subscription-eligible listings are configured yet. Browse the{' '}
          <Link className="text-amber-200 underline underline-offset-4" to="/products">
            catalog
          </Link>{' '}
          for one-time purchases anytime.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((item) => {
            const p = item.product;
            const minPlan = [...item.subscriptionPlans].sort((a, b) => a.priceCents - b.priceCents)[0];
            return (
              <li
                key={p.slug}
                className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-neutral-700 bg-neutral-950/70 p-4"
              >
                <div className="min-w-0">
                  <Link
                    to={`/product/${p.slug}`}
                    className="text-lg font-medium text-neutral-50 hover:text-amber-100"
                  >
                    {p.title}
                  </Link>
                  {minPlan ? (
                    <p className="mt-1 text-sm text-neutral-400">
                      From {formatMoneyEURStyle(minPlan.priceCents, minPlan.currency)}{" "}
                      {subscriptionPlanCadenceLabel(minPlan.interval, minPlan.intervalCount)} — Stripe Billing.
                    </p>
                  ) : null}
                </div>
                <Link
                  to={`/product/${p.slug}`}
                  className="inline-flex shrink-0 rounded-md bg-zlx-action px-4 py-2 text-sm font-semibold text-zlx-action-text"
                >
                  View options
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SubscriptionsPage;
