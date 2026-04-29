// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { firstPriceIdFromSubscription, resolvePlanFromStripeHints } from "./subscriptionLifecycle";

const validPlanPayload = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  product_id: "660e8400-e29b-41d4-a716-446655440002",
  variant_id: null,
  slug: "monthly",
  name: "Monthly",
  description: null,
  stripe_product_id: "prod_abc_xyz",
  stripe_price_id: "price_test_sub",
  interval: "month" as const,
  interval_count: 1,
  price_cents: 999,
  currency: "usd",
  trial_period_days: null,
  status: "active" as const,
};

describe("subscriptionLifecycle", () => {
  it("firstPriceIdFromSubscription reads first item price id", () => {
    const sub = {
      items: {
        data: [{ price: { id: "price_abc123" } }],
      },
    };
    expect(firstPriceIdFromSubscription(sub as Stripe.Subscription)).toBe("price_abc123");
  });

  it("resolvePlanFromStripeHints finds active plan by stripe_price_id", async () => {
    const maybeSingleOk = vi.fn().mockResolvedValue({ data: validPlanPayload, error: null });

    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: maybeSingleOk,
            })),
          })),
        })),
      })),
    };

    const plan = await resolvePlanFromStripeHints({
      admin: admin as unknown as Parameters<typeof resolvePlanFromStripeHints>[0]["admin"],
      stripePriceId: "price_test_sub",
    });

    expect(plan?.id).toBe(validPlanPayload.id);
    expect(maybeSingleOk).toHaveBeenCalled();
  });
});
