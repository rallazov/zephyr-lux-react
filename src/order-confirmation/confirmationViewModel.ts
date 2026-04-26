/**
 * Pure helpers for /order-confirmation: router state + Stripe return query params.
 * No Stripe network calls — see story 3-6 (FR-PAY-002, UX-DR9).
 */

export type ConfirmationViewMode = "full" | "queryPartial" | "fallback";

export interface ConfirmationItemLine {
  id?: string | number | null;
  name: string;
  quantity: number;
  price: number;
}

/** Shape passed from CheckoutPage via react-router state (legacy key: orderId). */
export interface OrderConfirmationLocationState {
  paymentRef?: string;
  orderId?: string;
  total?: number;
  email?: string;
  items?: ConfirmationItemLine[];
}

export interface StripeQuerySlice {
  paymentIntentId: string | null;
  sessionId: string | null;
  redirectStatus: string | null;
}

const PI_PREFIX = "pi_";
const CS_PREFIX = "cs_";

/** Display subtotal for a normalized line; safe if values drift at runtime. */
export function formatLineSubtotalDollars(item: ConfirmationItemLine): string {
  const t = item.price * item.quantity;
  return Number.isFinite(t) ? t.toFixed(2) : "—";
}

/**
 * Read Stripe-related query parameters (Payment Element return_url, Checkout Session, etc.).
 * Does not read or log client_secret.
 */
export function parseStripeQueryParams(
  searchParams: URLSearchParams
): StripeQuerySlice {
  const paymentIntentId =
    searchParams.get("payment_intent")?.trim() || null;
  const sessionId = searchParams.get("session_id")?.trim() || null;
  const redirectStatus = searchParams.get("redirect_status")?.trim() || null;
  return { paymentIntentId, sessionId, redirectStatus };
}

export function hasUsablePaymentReferenceInQuery(
  q: StripeQuerySlice
): boolean {
  if (q.paymentIntentId && q.paymentIntentId.startsWith(PI_PREFIX)) {
    return true;
  }
  if (q.sessionId && q.sessionId.startsWith(CS_PREFIX)) {
    return true;
  }
  return false;
}

export interface ResolveConfirmationViewInput {
  locationState: unknown;
  searchParams: URLSearchParams;
}

export interface ResolveConfirmationViewResult {
  mode: ConfirmationViewMode;
  /** Primary payment / session id for display (never labeled as a store order #). */
  paymentRef: string | null;
  total: number | null;
  email: string | null;
  items: ConfirmationItemLine[] | null;
  stripeQuery: StripeQuerySlice;
}

function parseItemLine(raw: unknown): ConfirmationItemLine | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" && o.name.trim() ? o.name : "Item";
  const q =
    typeof o.quantity === "number" && Number.isFinite(o.quantity) && o.quantity > 0
      ? o.quantity
      : null;
  const p =
    typeof o.price === "number" && Number.isFinite(o.price) && o.price >= 0
      ? o.price
      : null;
  if (q == null || p == null) return null;
  const id = o.id;
  return {
    name,
    quantity: q,
    price: p,
    ...(id !== undefined && id !== null
      ? { id: id as string | number }
      : {}),
  };
}

function parseLocationState(raw: unknown): OrderConfirmationLocationState | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const paymentRef =
    (typeof o.paymentRef === "string" && o.paymentRef) ||
    (typeof o.orderId === "string" && o.orderId) ||
    null;
  const total = typeof o.total === "number" && Number.isFinite(o.total) ? o.total : null;
  const email = typeof o.email === "string" && o.email ? o.email : null;
  const items = Array.isArray(o.items)
    ? o.items.map(parseItemLine).filter((row): row is ConfirmationItemLine => row != null)
    : undefined;
  return {
    paymentRef: paymentRef ?? undefined,
    orderId: typeof o.orderId === "string" ? o.orderId : undefined,
    total: total ?? undefined,
    email: email ?? undefined,
    items: items && items.length ? items : undefined,
  };
}

/**
 * Determine which UI branch to show (story 3-6 AC1, AC4, AC5).
 */
export function resolveConfirmationView(
  input: ResolveConfirmationViewInput
): ResolveConfirmationViewResult {
  const stripeQuery = parseStripeQueryParams(input.searchParams);
  const state = parseLocationState(input.locationState);

  const stateRef = state?.paymentRef ?? null;
  const hasStatePayload =
    stateRef != null &&
    ((state!.items && state!.items.length > 0) ||
      (state!.total != null && Number.isFinite(state!.total)) ||
      (state!.email != null && state!.email.length > 0));

  const queryOk = hasUsablePaymentReferenceInQuery(stripeQuery);
  const queryRef =
    stripeQuery.paymentIntentId ||
    stripeQuery.sessionId ||
    null;

  if (stateRef && hasStatePayload) {
    return {
      mode: "full",
      paymentRef: stateRef,
      total: state!.total ?? null,
      email: state!.email ?? null,
      items: state?.items && state.items.length ? state.items : null,
      stripeQuery,
    };
  }

  if (queryOk) {
    return {
      mode: "queryPartial",
      paymentRef: queryRef,
      total: null,
      email: null,
      items: null,
      stripeQuery,
    };
  }

  if (stateRef && !hasStatePayload) {
    // Rare: only id in state, no line detail — still better than bare fallback
    return {
      mode: "queryPartial",
      paymentRef: stateRef,
      total: state!.total ?? null,
      email: state!.email ?? null,
      items: null,
      stripeQuery,
    };
  }

  return {
    mode: "fallback",
    paymentRef: null,
    total: null,
    email: null,
    items: null,
    stripeQuery,
  };
}

export function queryPartialHeading(redirectStatus: string | null): string {
  if (!redirectStatus) {
    return "Confirming your payment";
  }
  if (redirectStatus === "succeeded") {
    return "Payment authorized";
  }
  if (redirectStatus === "processing") {
    return "We’re processing your payment";
  }
  if (redirectStatus === "failed") {
    return "We couldn’t complete this payment";
  }
  return "Payment update";
}

export function queryPartialSubtitle(
  redirectStatus: string | null
): string {
  if (!redirectStatus) {
    return "If you completed payment, you’ll get a confirmation email when it’s fully processed.";
  }
  if (redirectStatus === "succeeded") {
    return "Your bank authorized this payment. Final confirmation is sent by email when our systems record it (usually within a few minutes).";
  }
  if (redirectStatus === "processing") {
    return "Payment is still processing. We’ll email you when it’s complete.";
  }
  if (redirectStatus === "failed") {
    return "Your bank declined or could not process this charge. Return to your bag to try a different card or contact your bank, then try again.";
  }
  return "Check your email for updates, or return to your cart to try again.";
}
