import { describe, expect, it } from "vitest";
import {
  subscriptionPlansForVariant,
  subscriptionPlanCadenceLabel,
  subscriptionPlanRowSchema,
  subscriptionPlansPurchasableFromEmbed,
  type SubscriptionPlanPublic,
  type SubscriptionPlanEmbedRow,
} from "./subscription";

const base = (partial: Partial<SubscriptionPlanPublic>): SubscriptionPlanPublic => ({
  id: "550e8400-e29b-41d4-a716-446655440001",
  productId: "550e8400-e29b-41d4-a716-446655440000",
  variantId: null,
  slug: "test",
  name: "Test",
  description: null,
  interval: "month",
  intervalCount: 1,
  priceCents: 2000,
  currency: "USD",
  trialPeriodDays: null,
  ...partial,
});

describe("subscriptionPlansForVariant", () => {
  it("includes product-wide plans (no variant)", () => {
    const plans = [base({ id: "1", variantId: null }), base({ id: "2", variantId: "v1" })];
    expect(subscriptionPlansForVariant(plans, undefined).map((p) => p.id)).toEqual(["1"]);
  });

  it("includes scoped plans when variant matches", () => {
    const vid = "b0000001-0000-4000-8000-000000000001";
    const plans = [base({ id: "1", variantId: null }), base({ id: "2", variantId: vid })];
    expect(subscriptionPlansForVariant(plans, vid).map((p) => p.id)).toEqual(["1", "2"]);
  });
});

describe("subscriptionPlanCadenceLabel", () => {
  it("handles monthly cadence", () => {
    expect(subscriptionPlanCadenceLabel("month", 2)).toBe("every 2 months");
  });
});

const rowUuid = "550e8400-e29b-41d4-a716-446655440001";
const productUuid = "660e8400-e29b-41d4-a716-446655440002";

function validSubscriptionPlanDbRow(status: "draft" | "active" | "archived" = "active") {
  return {
    id: rowUuid,
    product_id: productUuid,
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
    status,
  };
}

describe("subscriptionPlanRowSchema", () => {
  it("parses active row from DB-ish payload", () => {
    const r = subscriptionPlanRowSchema.parse(validSubscriptionPlanDbRow());
    expect(r.currency).toBe("USD");
  });

  it("rejects slug that is not trimmed lowercase", () => {
    expect(() =>
      subscriptionPlanRowSchema.parse({ ...validSubscriptionPlanDbRow("draft"), slug: " Monthly" }),
    ).toThrow();
  });

  it("rejects malformed Stripe price when active", () => {
    expect(() =>
      subscriptionPlanRowSchema.parse({
        ...validSubscriptionPlanDbRow(),
        stripe_price_id: "bogus",
      }),
    ).toThrow();
  });
});

describe("subscriptionPlansPurchasableFromEmbed", () => {
  const embedOk = (): SubscriptionPlanEmbedRow => ({
    id: rowUuid,
    product_id: productUuid,
    variant_id: null,
    slug: "monthly",
    name: "Monthly",
    description: null,
    interval: "month",
    interval_count: 1,
    price_cents: 1000,
    currency: "USD",
    stripe_price_id: "price_xx",
    trial_period_days: null,
    status: "active",
  });

  it("keeps active + priced; drops drafts and missing stripe_price_id", () => {
    const rows: SubscriptionPlanEmbedRow[] = [
      embedOk(),
      { ...embedOk(), id: "770e8400-e29b-41d4-a716-446655440003", stripe_price_id: null },
      { ...embedOk(), id: "880e8400-e29b-41d4-a716-446655440004", status: "draft" },
    ];
    const out = subscriptionPlansPurchasableFromEmbed(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.slug).toBe("monthly");
  });
});
