/**
 * Dedupes storefront `purchase` analytics (Story 6-6 epic follow-up):
 * Prefer `sessionStorage` when available; when it throws or is unavailable, use a
 * module-scoped Set so React 18 StrictMode remounts do not emit duplicate purchases.
 */

const emittedFallback = new Set<string>();

const markerKey = (orderNumber: string): string =>
  `analytics_purchase_emitted:${orderNumber}`;

/** @internal Exported for Vitest isolation only. */
export function resetPurchaseDedupeForTests(): void {
  emittedFallback.clear();
}

/**
 * Reserve a single emit slot for this order number this browser session.
 *
 * Call once before `dispatchAnalyticsEvent(purchase)`. Returns whether this call
 * may emit (`true`), or duplicate (`false`).
 */
export function consumePurchaseAnalyticsSlot(trimmedOrderNumber: string): boolean {
  const key = trimmedOrderNumber.trim();
  if (!key) return false;

  try {
    const m = markerKey(key);
    if (sessionStorage.getItem(m)) return false;
    sessionStorage.setItem(m, "1");
    return true;
  } catch {
    /* private mode / disabled storage — ref alone is wrong under StrictMode */
    if (emittedFallback.has(key)) return false;
    emittedFallback.add(key);
    return true;
  }
}
