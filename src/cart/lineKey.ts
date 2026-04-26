/**
 * In-memory cart line identity: (storefrontProductId, sku) with empty string for
 * legacy rows that predate per-variant `sku` (see story 2-4, Epic 3 domain alignment).
 */
export function normalizeLineSku(sku: string | undefined): string {
  if (sku == null || sku === "") {
    return "";
  }
  return sku;
}

export function sameCartLine(
  a: { id: number; sku?: string },
  b: { id: number; sku?: string }
): boolean {
  return a.id === b.id && normalizeLineSku(a.sku) === normalizeLineSku(b.sku);
}
