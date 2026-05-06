import type { CartQuote } from "./catalog";
import { findVariantBySku } from "./catalog";
import type { PaymentIntentLineItem } from "./createPaymentIntentBody";

/** Placeholder shipping JSON until checkout collects a full address (FR-CHK-002 follow-up). */
export const PENDING_CHECKOUT_SHIPPING_JSON = {
  line1: "Pending checkout",
  city: "—",
  state: "—",
  postal_code: "00000",
  country: "US",
} as const;

export function variantTitleFromVariant(size?: string, color?: string): string | null {
  const parts = [size, color].filter((x): x is string => Boolean(x && x.trim()));
  return parts.length ? parts.join(" / ") : null;
}

export type OrderItemInsertRow = {
  sku: string;
  product_title: string;
  variant_title: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  image_url: string | null;
  product_id: string | null;
  variant_id: string | null;
  variant_options_snapshot: unknown | null;
};

/**
 * Build persisted order line snapshots from a server quote (FR-ORD-005) — never from client money JSON.
 */
export function orderItemRowsFromQuote(
  quote: CartQuote,
  paymentLines: PaymentIntentLineItem[],
): OrderItemInsertRow[] {
  const snapBySku = new Map<
    string,
    NonNullable<PaymentIntentLineItem["variant_display_snapshot"]>
  >();
  for (const pl of paymentLines) {
    if (
      pl.variant_display_snapshot &&
      pl.variant_display_snapshot.length > 0 &&
      !snapBySku.has(pl.sku)
    ) {
      snapBySku.set(pl.sku, pl.variant_display_snapshot);
    }
  }

  return quote.lines.map((line) => {
    const hit = findVariantBySku(line.sku);
    if (!hit) {
      throw new Error(`Unknown SKU in quote: ${line.sku}`);
    }
    const snap = snapBySku.get(line.sku);
    const legacyTitle = variantTitleFromVariant(hit.variant.size, hit.variant.color);
    const snapTitle =
      snap && snap.length > 0
        ? snap
            .map((s) => s.option_label.trim())
            .filter(Boolean)
            .join(" / ") || null
        : null;
    return {
      sku: line.sku,
      product_title: line.product_title,
      variant_title: snapTitle ?? legacyTitle,
      size: hit.variant.size ?? null,
      color: hit.variant.color ?? null,
      quantity: line.quantity,
      unit_price_cents: line.unit_cents,
      total_cents: line.line_cents,
      image_url: hit.variant.image_url ?? null,
      product_id: hit.product.id ?? null,
      variant_id: hit.variant.id ?? null,
      variant_options_snapshot: snap ?? null,
    };
  });
}
