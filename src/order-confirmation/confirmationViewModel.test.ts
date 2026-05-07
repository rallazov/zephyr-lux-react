import { describe, expect, it } from "vitest";
import {
  formatLineSubtotalDollars,
  hasUsablePaymentReferenceInQuery,
  parseStripeQueryParams,
  queryPartialHeading,
  queryPartialSubtitle,
  resolveConfirmationView,
  shouldClearCartForConfirmation,
} from "./confirmationViewModel";

describe("parseStripeQueryParams", () => {
  it("extracts known Stripe query keys", () => {
    const p = new URLSearchParams(
      "payment_intent=pi_abc&redirect_status=succeeded&session_id=cs_test_123"
    );
    expect(parseStripeQueryParams(p)).toEqual({
      paymentIntentId: "pi_abc",
      sessionId: "cs_test_123",
      redirectStatus: "succeeded",
    });
  });
});

describe("hasUsablePaymentReferenceInQuery", () => {
  it("is true for payment_intent with pi_ prefix", () => {
    expect(
      hasUsablePaymentReferenceInQuery({
        paymentIntentId: "pi_123",
        sessionId: null,
        redirectStatus: null,
      })
    ).toBe(true);
  });
  it("is true for Checkout session_id", () => {
    expect(
      hasUsablePaymentReferenceInQuery({
        paymentIntentId: null,
        sessionId: "cs_test_abc",
        redirectStatus: null,
      })
    ).toBe(true);
  });
  it("is false for random payment_intent string", () => {
    expect(
      hasUsablePaymentReferenceInQuery({
        paymentIntentId: "not_pi",
        sessionId: null,
        redirectStatus: null,
      })
    ).toBe(false);
  });
});

describe("resolveConfirmationView", () => {
  it("uses full mode when state has ref and line context", () => {
    const r = resolveConfirmationView({
      locationState: {
        orderId: "pi_x",
        total: 10,
        items: [{ name: "A", quantity: 1, price: 10 }],
      },
      searchParams: new URLSearchParams(),
    });
    expect(r.mode).toBe("full");
    expect(r.paymentRef).toBe("pi_x");
  });

  it("drops non-numeric line items but keeps full when total still qualifies", () => {
    const r = resolveConfirmationView({
      locationState: {
        orderId: "pi_x",
        total: 10,
        items: [
          { name: "A", quantity: 1, price: 10 },
          { name: "Bad", quantity: 1, price: Number.NaN },
        ] as unknown[],
      },
      searchParams: new URLSearchParams(),
    });
    expect(r.mode).toBe("full");
    expect(r.items).toHaveLength(1);
    expect(r.items![0]!.name).toBe("A");
  });

  it("uses queryPartial when Stripe returns payment_intent (no in-app state)", () => {
    const r = resolveConfirmationView({
      locationState: null,
      searchParams: new URLSearchParams("payment_intent=pi_abc&redirect_status=processing"),
    });
    expect(r.mode).toBe("queryPartial");
    expect(r.paymentRef).toBe("pi_abc");
  });

  it("uses fallback for bare /order-confirmation with no state or ids", () => {
    const r = resolveConfirmationView({
      locationState: null,
      searchParams: new URLSearchParams(),
    });
    expect(r.mode).toBe("fallback");
  });
});

describe("queryPartialSubtitle", () => {
  it("mentions email for undefined redirect", () => {
    expect(queryPartialSubtitle(null)).toMatch(/email/i);
  });
  it("is explicit for failed", () => {
    expect(queryPartialSubtitle("failed")).toMatch(/declined|bank|card/i);
  });
});

describe("queryPartialHeading", () => {
  it("succeeded does not use processing phrasing", () => {
    expect(queryPartialHeading("succeeded")).toBe("Payment authorized");
  });
  it("processing uses processing h1", () => {
    expect(queryPartialHeading("processing")).toMatch(/processing/i);
  });
  it("failed uses recovery tone", () => {
    expect(queryPartialHeading("failed")).toMatch(/couldn|complete/i);
  });
});

describe("formatLineSubtotalDollars", () => {
  it("returns em dash for non-finite product", () => {
    const bad: { name: string; quantity: number; price: number } = {
      name: "X",
      quantity: 1,
      price: Number.NaN,
    };
    expect(formatLineSubtotalDollars(bad)).toBe("—");
  });
});

describe("shouldClearCartForConfirmation", () => {
  it("clears when Stripe redirect_status is succeeded with a payment ref", () => {
    const d = shouldClearCartForConfirmation({
      paymentRef: "pi_abc",
      redirectStatus: "succeeded",
      paidOrderNumber: null,
    });
    expect(d.shouldClear).toBe(true);
    expect(d.dedupeKey).toBe("pi_abc");
  });

  it("clears when redirect_status is processing (intent committed, settle pending)", () => {
    const d = shouldClearCartForConfirmation({
      paymentRef: "pi_abc",
      redirectStatus: "processing",
      paidOrderNumber: null,
    });
    expect(d.shouldClear).toBe(true);
  });

  it("clears once the paid order record resolves even without a redirect_status", () => {
    const d = shouldClearCartForConfirmation({
      paymentRef: "pi_abc",
      redirectStatus: null,
      paidOrderNumber: "ZLX-2026-0001",
    });
    expect(d.shouldClear).toBe(true);
    expect(d.dedupeKey).toBe("pi_abc");
  });

  it("does NOT clear when the redirect reports failure — shopper should retry", () => {
    const d = shouldClearCartForConfirmation({
      paymentRef: "pi_abc",
      redirectStatus: "failed",
      paidOrderNumber: null,
    });
    expect(d.shouldClear).toBe(false);
    expect(d.dedupeKey).toBeNull();
  });

  it("does NOT clear when there is no payment ref (direct nav, fallback view)", () => {
    const d = shouldClearCartForConfirmation({
      paymentRef: null,
      redirectStatus: "succeeded",
      paidOrderNumber: null,
    });
    expect(d.shouldClear).toBe(false);
  });

  it("treats redirect_status case-insensitively", () => {
    expect(
      shouldClearCartForConfirmation({
        paymentRef: "pi_abc",
        redirectStatus: "SUCCEEDED",
        paidOrderNumber: null,
      }).shouldClear,
    ).toBe(true);
  });

  it("does NOT clear for an unknown redirect_status with no order yet", () => {
    expect(
      shouldClearCartForConfirmation({
        paymentRef: "pi_abc",
        redirectStatus: "requires_action",
        paidOrderNumber: null,
      }).shouldClear,
    ).toBe(false);
  });
});
