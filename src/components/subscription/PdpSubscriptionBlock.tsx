import { useEffect, useMemo, useState } from "react";
import type { ProductVariant } from "../../domain/commerce";
import {
  subscriptionPlanCadenceLabel,
  subscriptionPlansForVariant,
  type SubscriptionPlanPublic,
} from "../../domain/commerce/subscription";
import { apiUrl } from "../../lib/apiBase";

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

type PdpSubscriptionBlockProps = {
  plans: SubscriptionPlanPublic[];
  selectedVariant: ProductVariant | null;
};

/**
 * Repeat-delivery signup (Story 8-2): Stripe-hosted Checkout Subscription — no card entry in-app.
 */
export function PdpSubscriptionBlock({ plans, selectedVariant }: PdpSubscriptionBlockProps) {
  const applicable = useMemo(
    () => subscriptionPlansForVariant(plans, selectedVariant?.id ?? null),
    [plans, selectedVariant?.id],
  );

  const [chosenPlanId, setChosenPlanId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const first = applicable[0]?.id ?? "";
    if (!first) return;
    setChosenPlanId((prev) => (prev && applicable.some((p) => p.id === prev) ? prev : first));
  }, [applicable]);

  const effectivePlanId =
    applicable.length <= 1
      ? (applicable[0]?.id ?? "")
      : (chosenPlanId && applicable.some((p) => p.id === chosenPlanId)
          ? chosenPlanId
          : (applicable[0]?.id ?? ""));

  if (applicable.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="pdp-subscription-block"
      className="mt-8 rounded-lg border border-amber-200/25 bg-neutral-900/70 p-4 sm:p-5"
      aria-labelledby="pdp-subscription-heading"
    >
      <h2 id="pdp-subscription-heading" className="text-base font-semibold text-neutral-50">
        Subscribe &amp; save (repeat delivery)
      </h2>
      {!selectedVariant ? (
        <p className="mt-2 text-sm text-neutral-400" data-testid="pdp-subscription-select-variant">
          Select size and color to see subscription pricing for your variant.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-300">
            Billing is handled securely by Stripe. You&apos;ll confirm details on the next page.
          </p>
          <div className="mt-3 space-y-3">
            {applicable.length > 1 ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-200">Plan</span>
                <select
                  data-testid="pdp-subscription-plan-select"
                  className="rounded border border-neutral-600 bg-black px-3 py-2 text-neutral-100"
                  value={effectivePlanId}
                  onChange={(e) => {
                    setChosenPlanId(e.target.value);
                    setError(null);
                  }}
                >
                  {applicable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoneyEURStyle(p.priceCents, p.currency)}{" "}
                      {subscriptionPlanCadenceLabel(p.interval, p.intervalCount)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm font-medium text-white" data-testid="pdp-subscription-single-copy">
                {applicable[0]!.name} —{" "}
                {formatMoneyEURStyle(applicable[0]!.priceCents, applicable[0]!.currency)}{" "}
                {subscriptionPlanCadenceLabel(
                  applicable[0]!.interval,
                  applicable[0]!.intervalCount,
                )}
              </p>
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-200">Email</span>
              <input
                data-testid="pdp-subscription-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                className="rounded border border-neutral-600 bg-black px-3 py-2 text-neutral-100"
                required
              />
            </label>

            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              data-testid="pdp-subscription-start"
              disabled={loading}
              className="w-full min-h-11 rounded-md border border-amber-200/55 bg-transparent px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/15 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={async () => {
                const pid = effectivePlanId;
                const em = email.trim();
                setError(null);
                if (!em) {
                  setError("Enter your email to continue.");
                  return;
                }
                if (!pid) {
                  setError("Choose a subscription option.");
                  return;
                }
                setLoading(true);
                try {
                  const res = await fetch(apiUrl("/api/create-subscription-checkout-session"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      plan_id: pid,
                      email: em,
                    }),
                  });
                  const body = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError(typeof body.error === "string" ? body.error : "Checkout could not be started.");
                    return;
                  }
                  const url = typeof body.url === "string" ? body.url : null;
                  if (!url) {
                    setError("Checkout could not be started.");
                    return;
                  }
                  globalThis.window.location.href = url;
                } catch {
                  setError("Network error. Please try again.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Redirecting…" : "Continue to secure subscription checkout"}
            </button>

            <p className="text-xs leading-relaxed text-neutral-500">
              After Stripe confirms payment, your subscription activates when our systems finalize the
              enrollment (usually moments). Confirmation email and billing management follow Stripe&apos;s flow.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
