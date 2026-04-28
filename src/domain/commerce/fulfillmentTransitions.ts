import type { FulfillmentStatus, PaymentStatus } from "./enums";

/** Single-hop fulfillment graph + cancel rules (mirrors `apply_fulfillment_transition` in DB). */
const FORWARD: Record<FulfillmentStatus, FulfillmentStatus | null> = {
  processing: "packed",
  packed: "shipped",
  shipped: "delivered",
  delivered: null,
  canceled: null,
};

/**
 * Legal **target** statuses for one mutating step from `current` when `payment_status === "paid"`.
 * Empty when unpaid, terminal, or otherwise blocked.
 */
export function allowedFulfillmentTargets(
  current: FulfillmentStatus,
  paymentStatus: PaymentStatus,
): FulfillmentStatus[] {
  if (paymentStatus !== "paid") return [];
  if (current === "canceled" || current === "delivered") return [];

  const out: FulfillmentStatus[] = [];

  const next = FORWARD[current];
  if (next) out.push(next);

  if (current === "processing" || current === "packed") {
    out.push("canceled");
  }

  return out;
}

/**
 * Whether `to` is allowed in one step from `from` for a **paid** order (mutating).
 * Does **not** treat `from === to` as allowed here — callers handle idempotency separately.
 */
export function isPaidFulfillmentTransitionAllowed(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean {
  return allowedFulfillmentTargets(from, "paid").includes(to);
}

export class FulfillmentTransitionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_paid"
      | "invalid_transition"
      | "terminal_state"
      | "order_not_found",
  ) {
    super(message);
    this.name = "FulfillmentTransitionError";
  }
}

/**
 * Pure validation for API layer (DB RPC remains authoritative).
 * @throws FulfillmentTransitionError
 */
export function assertFulfillmentTransition(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
  paymentStatus: PaymentStatus,
): void {
  if (from === to) return;

  if (from === "canceled" || from === "delivered") {
    throw new FulfillmentTransitionError("Fulfillment is final for this order.", "terminal_state");
  }

  if (paymentStatus !== "paid") {
    throw new FulfillmentTransitionError(
      "Order must be paid before fulfillment can advance.",
      "not_paid",
    );
  }

  if (!isPaidFulfillmentTransitionAllowed(from, to)) {
    throw new FulfillmentTransitionError("This fulfillment step is not allowed.", "invalid_transition");
  }
}
