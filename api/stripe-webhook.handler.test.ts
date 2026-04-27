// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const claimPaymentEvent = vi.hoisted(() => vi.fn());
const applyPaymentIntentSucceeded = vi.hoisted(() => vi.fn());
const mockConstructEvent = vi.hoisted(() => vi.fn());

vi.mock("raw-body", () => ({
  default: vi.fn().mockResolvedValue(Buffer.from("payload")),
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    webhooks = { constructEvent: mockConstructEvent };
  },
}));

vi.mock("./_lib/env", () => ({
  ENV: {
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
  },
  isSupabaseOrderPersistenceConfigured: () => true,
}));

vi.mock("./_lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({}),
}));

vi.mock("./_lib/applyPaymentSuccess", () => ({
  applyPaymentIntentSucceeded,
}));

vi.mock("./_lib/paymentEventLedger", () => ({
  claimPaymentEvent,
  markPaymentEventFailed: vi.fn(),
  markPaymentEventIgnored: vi.fn(),
  markPaymentEventProcessed: vi.fn(),
}));

vi.mock("./_lib/paymentIntentOrder", () => ({
  sanitizeWebhookErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock("./_lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import defaultHandler from "./stripe-webhook";

const skipOkRow = {
  id: "row-1",
  provider: "stripe",
  provider_event_id: "evt_dup_1",
  event_type: "payment_intent.succeeded",
  status: "processed" as const,
  payload_hash: "h",
  processed_at: new Date().toISOString(),
  error_message: null,
  created_at: new Date().toISOString(),
};

describe("stripe-webhook handler", () => {
  beforeEach(() => {
    claimPaymentEvent.mockReset();
    applyPaymentIntentSucceeded.mockReset();
    applyPaymentIntentSucceeded.mockResolvedValue({ outcome: "ledger" });
    mockConstructEvent.mockReset();
  });

  it("returns 200 with duplicate when claim outcome is skip_ok (already finalized)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_dup_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1" } },
    });
    claimPaymentEvent.mockResolvedValue({ outcome: "skip_ok" as const, row: skipOkRow });

    const resJson = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json: resJson, send: vi.fn() }),
    } as unknown as VercelResponse;

    const req = {
      method: "POST",
      headers: { "stripe-signature": "t=0,v1=mock" },
    } as unknown as VercelRequest;

    await defaultHandler(req, res);

    expect(applyPaymentIntentSucceeded).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({ received: true, duplicate: true }),
    );
  });

  it("returns 500 when applyPaymentIntentSucceeded requests retry (Stripe can redeliver)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_retry_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1", metadata: { order_id: "x" } } },
    });
    claimPaymentEvent.mockResolvedValue({
      outcome: "process" as const,
      row: {
        id: "ledger-retry",
        provider: "stripe",
        provider_event_id: "evt_retry_1",
        event_type: "payment_intent.succeeded",
        status: "received",
        payload_hash: "h",
        processed_at: null,
        error_message: null,
        created_at: new Date().toISOString(),
      },
    });
    applyPaymentIntentSucceeded.mockResolvedValue({ outcome: "retry" });

    const resSend = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json: vi.fn(), send: resSend }),
    } as unknown as VercelResponse;

    const req = {
      method: "POST",
      headers: { "stripe-signature": "t=0,v1=mock" },
    } as unknown as VercelRequest;

    await defaultHandler(req, res);

    expect(applyPaymentIntentSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeEventId: "evt_retry_1",
        pi: expect.objectContaining({ id: "pi_1" }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(resSend).toHaveBeenCalledWith(
      expect.stringContaining("Payment-intent handling incomplete"),
    );
  });
});
