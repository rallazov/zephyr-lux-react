/**
 * @param cents integer minor units
 */
export function formatCents(cents: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}
