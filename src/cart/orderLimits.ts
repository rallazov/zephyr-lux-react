/**
 * Per-order policy: max units of one SKU on a single cart line, regardless of
 * how much inventory is on hand (`inventory_quantity` can be higher).
 */
export const STOREFRONT_MAX_UNITS_PER_LINE = 5;

/**
 * Highest quantity allowed on one line this order — the tighter of inventory
 * and {@link STOREFRONT_MAX_UNITS_PER_LINE}. Inventory itself is unchanged;
 * callers that show stock to shoppers should use raw `inventory_quantity`.
 */
export function effectiveMaxLineQuantity(inventory_quantity: number): number {
  if (!Number.isFinite(inventory_quantity) || inventory_quantity <= 0) return 0;
  const inv = Math.floor(inventory_quantity);
  return Math.min(inv, STOREFRONT_MAX_UNITS_PER_LINE);
}

/** Alias for server quote paths; same as {@link effectiveMaxLineQuantity}. */
export function maxCheckoutUnitsForVariant(inventory_quantity: number): number {
  return effectiveMaxLineQuantity(inventory_quantity);
}
