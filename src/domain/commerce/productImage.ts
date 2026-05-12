export const PRODUCT_IMAGE_BUCKET_ID = "product-images";

/** Product photos are public storefront media. Keep generous but bounded for admin uploads. */
export const PRODUCT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Safe object keys under the product-images bucket (admin upload API only ever uses
 * `draft/…` and `products/{uuid}/…`). Used for delete validation server-side and
 * when removing uploads from the admin editor (skips `/assets/` and absolute URLs).
 */
export function isDeletableProductImageStoragePath(raw: string): boolean {
  const t = raw.trim();
  return (
    t.length > 0 &&
    t.length <= 512 &&
    !t.startsWith("/") &&
    !t.includes("..") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(t) &&
    /^(draft|products)\/[A-Za-z0-9/_!.*'()-]+\.[A-Za-z0-9]+$/.test(t)
  );
}
