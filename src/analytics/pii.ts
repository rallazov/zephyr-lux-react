/** Basic email shape for defensive redaction (Story 6-6). */
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

const STRIPE_LIKE_RE =
  /^(pi_|cs_|ch_|pm_|seti_|acct_|cus_|price_|prod_|evt_)/i;

export function stringLooksLikeStripeOrPaymentRef(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (STRIPE_LIKE_RE.test(t)) return true;
  if (t.includes("payment_intent") || t.includes("paymentIntent")) return true;
  return false;
}

export function stringLooksLikeEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

/**
 * Returns a deep-cloned plain object with string values redacted when they look
 * like email. Used for defensive logging only; primary protection is allowlisted
 * payloads per event in `sink.ts`.
 */
export function deepRedactEmails<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    return (stringLooksLikeEmail(value) ? "[REDACTED]" : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepRedactEmails(v)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepRedactEmails(v);
    }
    return out as T;
  }
  return value;
}
