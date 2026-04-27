// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { applyPaymentIntentSucceeded } from "./applyPaymentSuccess";
import { applyInventoryForPaidOrder } from "./applyInventoryForPaidOrder";
import { maybeSendCustomerOrderConfirmation } from "./customerOrderConfirmation";
import { maybeSendOwnerOrderPaidNotification } from "./ownerOrderNotification";
import * as ledger from "./paymentEventLedger";

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./applyInventoryForPaidOrder", () => ({
  applyInventoryForPaidOrder: vi.fn(),
}));

vi.mock("./customerOrderConfirmation", () => ({
  maybeSendCustomerOrderConfirmation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./ownerOrderNotification", () => ({
  maybeSendOwnerOrderPaidNotification: vi.fn().mockResolvedValue(undefined),
}));

const ledgerRowBase = {
  provider: "stripe" as const,
  provider_event_id: "evt_1",
  event_type: "payment_intent.succeeded",
  status: "received" as const,
  payload_hash: "x",
  processed_at: null,
  error_message: null,
  created_at: new Date().toISOString(),
};

describe("applyPaymentIntentSucceeded", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(applyInventoryForPaidOrder).mockResolvedValue({ ok: true });
    vi.mocked(maybeSendCustomerOrderConfirmation).mockClear();
    vi.mocked(maybeSendCustomerOrderConfirmation).mockResolvedValue(undefined);
    vi.mocked(maybeSendOwnerOrderPaidNotification).mockClear();
    vi.mocked(maybeSendOwnerOrderPaidNotification).mockResolvedValue(undefined);
  });

  it("updates pending order to paid and marks ledger processed", async () => {
    vi.spyOn(ledger, "markPaymentEventProcessed").mockResolvedValue();
    const markFailed = vi.spyOn(ledger, "markPaymentEventFailed").mockResolvedValue();

    const orderRow = {
      id: "o1",
      order_number: "ZLX-20260426-0001",
      payment_status: "pending_payment",
      total_cents: 5350,
      currency: "usd",
      stripe_payment_intent_id: "pi_test_1",
    };

    const updateEq2 = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: "o1" }], error: null }),
    });
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq1 });

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table !== "orders") return {};
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: orderRow, error: null }),
            }),
          }),
          update: updateFn,
        };
      }),
    } as unknown as SupabaseClient;

    const pi = {
      id: "pi_test_1",
      amount_received: 5350,
      currency: "usd",
      metadata: { email: "buyer@example.com" },
    } as unknown as Stripe.PaymentIntent;

    const r = await applyPaymentIntentSucceeded({
      admin: client,
      pi,
      ledgerRow: { id: "ledger-1", ...ledgerRowBase },
      stripeEventId: "evt_test_1",
    });

    expect(r).toEqual({ outcome: "ledger" });
    expect(applyInventoryForPaidOrder).toHaveBeenCalledWith(client, "o1");
    expect(ledger.markPaymentEventProcessed).toHaveBeenCalledWith(client, "ledger-1");
    expect(maybeSendCustomerOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "o1",
        stripePaymentIntentId: "pi_test_1",
        stripeEventId: "evt_test_1",
      }),
    );
    expect(maybeSendOwnerOrderPaidNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "o1",
        stripePaymentIntentId: "pi_test_1",
        stripeEventId: "evt_test_1",
      }),
    );
    expect(markFailed).not.toHaveBeenCalled();
    expect(updateFn).toHaveBeenCalled();
  });

  it("marks ledger failed when PI amount does not match order", async () => {
    vi.spyOn(ledger, "markPaymentEventProcessed").mockResolvedValue();
    const markFailed = vi.spyOn(ledger, "markPaymentEventFailed").mockResolvedValue();

    const orderRow = {
      id: "o1",
      order_number: "ZLX-20260426-0001",
      payment_status: "pending_payment",
      total_cents: 9999,
      currency: "usd",
      stripe_payment_intent_id: "pi_x",
    };

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table !== "orders") return {};
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: orderRow, error: null }),
            }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    const r = await applyPaymentIntentSucceeded({
      admin: client,
      pi: {
        id: "pi_x",
        amount_received: 100,
        currency: "usd",
        metadata: {},
      } as unknown as Stripe.PaymentIntent,
      ledgerRow: { id: "l-bad", ...ledgerRowBase },
    });

    expect(r).toEqual({ outcome: "ledger" });
    expect(markFailed).toHaveBeenCalledWith(
      client,
      "l-bad",
      "PaymentIntent amount/currency does not match order totals",
    );
  });

  it("returns retry when no order is found and does not mark the ledger", async () => {
    const markFailed = vi.spyOn(ledger, "markPaymentEventFailed").mockResolvedValue();

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table !== "orders") return {};
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    const r = await applyPaymentIntentSucceeded({
      admin: client,
      pi: { id: "pi_orphan", amount_received: 1, currency: "usd", metadata: {} } as unknown as Stripe.PaymentIntent,
      ledgerRow: { id: "l-x", ...ledgerRowBase },
    });

    expect(r).toEqual({ outcome: "retry" });
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("returns retry when inventory apply fails and does not finalize the ledger", async () => {
    vi.mocked(applyInventoryForPaidOrder).mockResolvedValue({ ok: false });
    vi.spyOn(ledger, "markPaymentEventProcessed").mockResolvedValue();

    const orderRow = {
      id: "o1",
      order_number: "ZLX-20260426-0001",
      payment_status: "pending_payment",
      total_cents: 5350,
      currency: "usd",
      stripe_payment_intent_id: "pi_test_1",
    };

    const updateEq2 = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: "o1" }], error: null }),
    });
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq1 });

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table !== "orders") return {};
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: orderRow, error: null }),
            }),
          }),
          update: updateFn,
        };
      }),
    } as unknown as SupabaseClient;

    const r = await applyPaymentIntentSucceeded({
      admin: client,
      pi: {
        id: "pi_test_1",
        amount_received: 5350,
        currency: "usd",
        metadata: {},
      } as unknown as Stripe.PaymentIntent,
      ledgerRow: { id: "ledger-1", ...ledgerRowBase },
    });

    expect(r).toEqual({ outcome: "retry" });
    expect(ledger.markPaymentEventProcessed).not.toHaveBeenCalled();
    expect(maybeSendCustomerOrderConfirmation).not.toHaveBeenCalled();
    expect(maybeSendOwnerOrderPaidNotification).not.toHaveBeenCalled();
  });

  it("when order already paid, applies inventory then marks ledger processed", async () => {
    vi.spyOn(ledger, "markPaymentEventProcessed").mockResolvedValue();

    const orderRow = {
      id: "o-paid",
      order_number: "ZLX-20260426-0002",
      payment_status: "pending_payment",
      total_cents: 100,
      currency: "usd",
      stripe_payment_intent_id: "pi_retry",
    };

    const updateEq2 = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq1 });

    let maybeSingleCalls = 0;
    const maybeSingle = vi.fn().mockImplementation(() => {
      maybeSingleCalls += 1;
      if (maybeSingleCalls === 1) {
        return Promise.resolve({ data: orderRow, error: null });
      }
      return Promise.resolve({ data: { payment_status: "paid" }, error: null });
    });

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table !== "orders") return {};
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle }),
          }),
          update: updateFn,
        };
      }),
    } as unknown as SupabaseClient;

    const r = await applyPaymentIntentSucceeded({
      admin: client,
      pi: {
        id: "pi_retry",
        amount_received: 100,
        currency: "usd",
        metadata: { order_id: "o-paid" },
      } as unknown as Stripe.PaymentIntent,
      ledgerRow: { id: "ledger-retry", ...ledgerRowBase },
      stripeEventId: "evt_retry_1",
    });

    expect(r).toEqual({ outcome: "ledger" });
    expect(applyInventoryForPaidOrder).toHaveBeenCalledWith(client, "o-paid");
    expect(ledger.markPaymentEventProcessed).toHaveBeenCalledWith(client, "ledger-retry");
    expect(maybeSendCustomerOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "o-paid",
        stripePaymentIntentId: "pi_retry",
        stripeEventId: "evt_retry_1",
      }),
    );
    expect(maybeSendOwnerOrderPaidNotification).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "o-paid", stripePaymentIntentId: "pi_retry" }),
    );
  });
});
