/**
 * Pure helpers: verify Stripe PaymentIntent matches a persisted order quote (Epic 3 rules).
 */

export function normalizeCurrencyCode(currency: string): string {
  return currency.trim().toLowerCase();
}

export function paymentIntentMatchesOrderTotals(args: {
  amountReceivedCents: number;
  currency: string;
  orderTotalCents: number;
  orderCurrency: string;
}): boolean {
  return (
    args.amountReceivedCents === args.orderTotalCents &&
    normalizeCurrencyCode(args.currency) === normalizeCurrencyCode(args.orderCurrency)
  );
}

/** Strip obvious secret/PII noise from webhook handler errors before persisting to payment_events. */
export function sanitizeWebhookErrorMessage(err: unknown, maxLen = 500): string {
  const raw = err instanceof Error ? err.message : String(err);
  let s = raw.replace(/\bsk_live_[^\s]+\b/gi, "[redacted]").replace(/\bsk_test_[^\s]+\b/gi, "[redacted]");
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}
