// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  normalizeCurrencyCode,
  paymentIntentMatchesOrderTotals,
  sanitizeWebhookErrorMessage,
} from "./paymentIntentOrder";

describe("paymentIntentMatchesOrderTotals", () => {
  it("accepts matching cents and currency case", () => {
    expect(
      paymentIntentMatchesOrderTotals({
        amountReceivedCents: 1099,
        currency: "USD",
        orderTotalCents: 1099,
        orderCurrency: "usd",
      }),
    ).toBe(true);
  });

  it("rejects amount mismatch", () => {
    expect(
      paymentIntentMatchesOrderTotals({
        amountReceivedCents: 100,
        currency: "usd",
        orderTotalCents: 101,
        orderCurrency: "usd",
      }),
    ).toBe(false);
  });
});

describe("normalizeCurrencyCode", () => {
  it("lowercases and trims", () => {
    expect(normalizeCurrencyCode(" USD ")).toBe("usd");
  });
});

describe("sanitizeWebhookErrorMessage", () => {
  it("redacts Stripe secret patterns and truncates", () => {
    const s = sanitizeWebhookErrorMessage(new Error("fail sk_test_abc123 secret"));
    expect(s).not.toContain("sk_test");
    expect(s.length).toBeLessThanOrEqual(500);
  });
});
