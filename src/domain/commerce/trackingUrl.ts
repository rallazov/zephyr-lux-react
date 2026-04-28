/** Known carrier keys for automatic tracking URL derivation (Story 5-5 AC5). */

const TRACKING_BASE: Record<
  string,
  (trackingNumber: string) => string
> = {
  usps: (n) =>
    `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  ups: (n) =>
    `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  fedex: (n) =>
    `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
};

/**
 * Normalize `carrier` free text → `TRACKING_BASE` key, or undefined if unrecognized.
 */
export function deriveCarrierKey(carrierRaw: string | null | undefined): string | undefined {
  if (!carrierRaw) return undefined;
  const s = carrierRaw.trim().toLowerCase();
  if (!s) return undefined;
  if (s.includes("usps")) return "usps";
  if (s.includes("ups")) return "ups";
  if (
    s.includes("fedex")
    || /^fx/u.test(s)
    || s.includes("federal express")
  ) return "fedex";
  return undefined;
}

/** When manual URL omitted, USPS/UPS/FedEx only — otherwise leaves URL null so operators paste one manually. */
export function deriveTrackingUrlFromCarrier(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const num = trackingNumber?.trim();
  const key = deriveCarrierKey(carrier);
  if (!key || !num) return null;
  const fn = TRACKING_BASE[key];
  return fn ? fn(num) : null;
}
