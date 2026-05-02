/** Matches RFC-ish UUID variants accepted for account/order detail URLs and query params (strict). */
export const CUSTOMER_ACCOUNT_ORDER_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
