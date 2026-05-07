/**
 * Epic 9 replaced separate purchasable variants per legacy “color” with one fixed-assortment pack
 * per size (`ZLX-2PK-*`: one black + one blue brief per unit). Persisted carts may still use the
 * old codes `ZLX-BLK-*` and `ZLX-BLU-*` — those prefixes reflected the prior PDP option (black-only
 * vs blue-only row), not the contents of the pack; both map to the same pack SKU for that size.
 */
export function remapLegacyBoxerBriefSku(skuNorm: string): string {
  if (skuNorm === "") {
    return skuNorm;
  }
  // Historical identifiers only — must match strings already stored in bags / order snapshots.
  const blk = /^ZLX-BLK-(.+)$/.exec(skuNorm);
  const blu = /^ZLX-BLU-(.+)$/.exec(skuNorm);
  const suffix = blk?.[1] ?? blu?.[1];
  if (!suffix) {
    return skuNorm;
  }
  return `ZLX-2PK-${suffix}`;
}
