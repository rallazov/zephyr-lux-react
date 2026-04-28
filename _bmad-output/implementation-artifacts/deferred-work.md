# Deferred work (from reviews and triage)

## Deferred from: code review of 5-7-internal-notes-order-timeline.md (2026-04-27)

- **Stale Vitest totals in Story 5-7 Dev Agent Record** (“256 tests”) — reconcile with CI when convenient; harmless until numbers mislead onboarding.

## Deferred from: code review of 5-6-customer-shipment-notification.md (2026-04-27)

- **`loadShipmentTracking` failure vs empty shipment** — Customers may see “tracking not yet available” when the real cause is a **`shipments`** read error; distinguish or reword when operational clarity matters.
- **`admin-order-fulfillment` vs `admin-shipment` handler consistency** — OPTIONS status codes, bearer parsing helpers, and Supabase “configured” checks differ; unify when tightening admin API polish.

## Deferred from: code review of 5-4-order-fulfillment-status-transitions.md (2026-04-27)

- **RPC error mapping relies on substring match** (`api/admin-order-fulfillment.ts`) — Acceptable while Postgres exception text is stable; harden if messages change.
- **`verifyAdminJwt` / handler: no distinction between invalid token and non-admin** — Both become `403`; refine when clients need `401` for expired sessions.
- **`GRANT EXECUTE` to `postgres` on `apply_fulfillment_transition`** — Validate against project’s migration norms (`service_role`-only vs maintenance role).

## Deferred from: code review of 5-3-admin-order-detail.md (2026-04-27)

- **Written AC7/AC11 vs merged implementation** — Review follow-up **3** (defer split): keep combined detail + shipment + `order_events` in `AdminOrderDetail` for now; update story/AC wording or split components when epic boundaries must match the written spec again.
- **`AdminOrderDetail` size and mixed concerns** — Read-only order detail (5-3) shares one module with shipment save (5-5) and `order_events` reads (5-4); defer extraction/split when epic boundaries or reuse demand it.
- **Raw PostgREST errors on admin order load** — Surfacing `error.message` directly is fine for MVP operators; soften or classify errors when customer-facing admin polish is in scope.

## Deferred from: code review of 5-2-admin-order-list.md (2026-04-27)

- **`notification_logs` secondary fetch errors are swallowed (AdminOrderList.tsx)** — Supabase failures clear failed-badge state silently; revisit with non-blocking telemetry or a subtle “signals unavailable” affordance when operator UX needs stronger guarantees than fail-closed.
- **`TEMPLATE_OWNER_ORDER_PAID` duplicated with `notificationLog.ts`** — Acceptable MVP with unit test guarding the string match; unify via a thin shared barrel when the repo adopts a `@shared`/`domain-notification` extraction.

## Deferred from: code review of 5-1-supabase-admin-auth.md (2026-04-27)

- **`RequireAdmin.test.tsx`: `session` mocked as `{} as Session`** — Weak typing hides missing fields or shape regressions when Supabase `Session` evolves; tighten when mocks next change.
- **No Postgres-backed RLS test for Story 5-1 migrations** — Unit tests satisfy AC 5 mocks-only guidance; optional future Supabase test harness policy smoke when CI spins local DB.

## Deferred from: code review of 4-7-log-notification-status.md (2026-04-26)

- **`notificationLog.test` mock shape vs real PostgREST chain** — The Vitest double for `notification_logs` may not assert the full `update().eq("id").eq("status", "queued")` shape; consider tightening the mock or an integration test when the API layer next changes. Pre-existing test-quality gap noted in 4-7 review.

## Deferred from: code review of 4-6-customer-confirmation-email.md (2026-04-26)

- **Resend `fetch` without timeout/retry** — `api/_lib/transactionalEmail.ts` can block a serverless invocation; add `AbortSignal`, backoff, or delegate to 4-7.
- **Dual `validation.ts` / `validation.js` maintenance** — same schema duplicated; consolidate when build pipeline allows a single source.
- **API import from `src/domain/.../address`** — decouple when introducing a shared package for storefront + API.
- **Post-ledger email failure vs Stripe retry** — once `payment_events` is `processed`, Stripe will not re-drive the same event; email failure is logged, not retried by the webhook. Align with 4-7/ops.
- **Placeholder `isPendingCheckoutShippingAddress` heuristics** — `line1` + `city` match to `PENDING_CHECKOUT_SHIPPING_JSON` is brittle; prefer explicit sentinel or full structured validation from checkout.

## Deferred from: code review of 4-5-owner-order-notification.md (2026-04-26)

- **Full notification audit trail (`notification_logs`, `provider_message_id`)** — Story 4-5 uses `owner_order_paid_notified_at` and structured logs; richer rows from **4-7** would improve failure deduplication and operator visibility without changing the paid-order guarantee.

## Deferred from: code review of 4-3-payment-success-order-paid.md (2026-04-26)

- **JSDoc coupling to route/component names** (`api/order-by-payment-intent.ts`) — Comment references `CheckoutPage` / `OrderConfirmation` and AC identifiers; may drift on renames; tidy when those modules move.
- **Broader `order-by-payment-intent` test matrix** — Optional tests for `503` / `500` paths, unpaid `payment_status`, and whether uniform `404` responses are acceptable for observability vs security through obscurity.

## Deferred from: code review of 3-5-stripe-checkout-or-payment-intent.md (2026-04-26)

- **`?checkout=canceled` query banner on `CheckoutPage`:** Renders a “Checkout was canceled” message when `checkout=canceled` is present; the Payment Element path does not set this from Stripe redirects, so the banner is mostly manual URL or future Session `cancel_url`. Defer full polish to **3-6** and any hosted Checkout Session wiring.
- **Stable `checkoutRef` / Stripe idempotency strategy:** Item overlaps with 3-3 code-review note: random per-request `checkoutRef` and effect-driven PI creation limit retry semantics; address when product defines a single stable idempotency story (e.g. hash of line items + email, or client-held nonce) across the Epic 3 checkout stack.

## Deferred from: code review of 3-3-checkout-line-items-sku-quantity.md (2026-04-26)

- **Deterministic PaymentIntent idempotency** (`api/create-payment-intent.ts`): Random `checkoutRef` creates a new PI whenever the client bootstrap effect re-runs; consider deriving Stripe idempotency from `line_digest` + normalized email when product wants stricter retry / duplicate-submit behavior.

## Deferred from: code review of 3-6-checkout-confirmation-cancel-failure-ui.md (2026-04-26)

- **Server `cancel_url` / hosted Checkout Session:** Client banners for `?checkout=canceled` are implemented; wiring `cancel_url` in the Stripe server flow is tracked with story 3-5 per the shared URL contract.
- **Smoke test extended timeout** (`src/routes.smoke.test.tsx`): 15s wait for `/checkout` — consider lowering once checkout loading is more deterministic in tests, to reduce CI flake.

## Deferred from: code review of 3-4-server-subtotal-from-catalog.md (2026-04-26)

- **Unused checkout navigation state** (`src/components/Cart/CartPage.tsx`): `navigate("/checkout", { state: { subtotal, items } })` is unused by `CheckoutPage`; remove when next editing cart navigation to avoid implying a client subtotal contract.
- **Legacy catalog helpers** (`api/_lib/catalog.ts`): `computeAmountCents` (merchandise subtotal only + qty coercion) and `quoteForPaymentItems` (silent qty normalization) remain for backward compatibility / tests; production PI pricing uses `totalChargeCentsFromCatalogLines` + Zod. Consolidate or document when order/checkout hardening is in scope.

## Deferred from: code review of 3-1-cart-sku-variant-identity.md (2026-04-26)

- **Multi-variant same-SKU `findVariant` fallback** (`src/cart/reconcile.ts`): If two variants share a SKU and the cart line’s `variant_id` is wrong or missing, the first match wins. Defer until catalog invariants (unique SKU per product) or stricter resolution are specified.

## Deferred from: code review of story 2-5-supabase-tables-catalog-inventory.md (2026-04-26)

- **Zod at catalog boundary** (`src/catalog/supabase-map.ts`): Malformed API shapes throw `ZodError`; add friendlier error mapping when storefront error UX is standardized.
- **Empty variant embeds on list** (`src/catalog/adapter.ts`): If `product_variants` is empty for an active product, the list can still show the product; add data checks or UI guards if that becomes observable.
- **Image `alt_text` not selected** (`src/catalog/adapter.ts` `PRODUCTS_CATALOG_SELECT`): Select `alt_text` when PDP or shared image components need a11y text from Supabase.

## Deferred from: code review of story 2-4-variant-selector-size-color-price-stock.md (2026-04-26)

- **Unreachable OOS string on resolved selection** (`src/components/ProductDetail/ProductDetail.tsx`): The `"Out of stock for this color and size."` path under `selectedVariant && inventory_quantity === 0` is effectively dead while `selectedVariant` is only set for purchasable rows. Safe to remove or relabel when the PDP is next touched; not a functional defect with current rules.

## Deferred from: code review of 2-1-canonical-product-variant-seed-data.md (2026-04-26)

- **Pair-maintain `api/_lib/catalog.js` and `api/_lib/catalog.ts`:** The repo keeps parallel JS/TS `catalog` modules for Vercel entry points; DRY to a single build artifact or a codegen note if this becomes a repeated merge hazard.

## Deferred from: code review of 1-1-fix-runtime-imports (2026-04-25)

- Planning artifact `epics.md` (brownfield bullet) still describes the historical `main.tsx` → `App.js` import. Reconcile with current code when the epic list or brownfield section is next edited. Not introduced by the runtime-import fix.

## Deferred from: code review of 1-2-define-shared-commerce-domain-types.md (2026-04-26)

- **Cross-field money consistency** (`src/domain/commerce/order.ts`): No refinement tying line `total_cents` to unit price × quantity or order header totals to lines + fees; acceptable until order persistence and checkout write paths exist.

- **Timestamp fields are unvalidated strings** (`src/domain/commerce/order.ts`): Optional / event timestamps use plain `z.string()`; standardize on `z.iso.datetime()` or equivalent when API and DB contracts are fixed.

- **Sprint status YAML expanded in same change set** (`_bmad-output/implementation-artifacts/sprint-status.yaml`): Full epic/story grid added alongside domain module; split process/docs commits from code in future reviews for clarity.

## Deferred from: code review of 1-3-catalog-adapter-static-and-supabase.md (2026-04-26)

- **Product detail uses first variant for hero/price** (`src/components/ProductDetail/ProductDetail.tsx`): Acceptable for E1; defer richer variant selection and pricing display until Epic 2+ product UX.

- **Line-item `qty` validation in `computeAmountCents` and webhook** (`api/_lib/catalog.ts` / `api/stripe-webhook.ts`): Coercion to at least 1 and metadata trust predate the catalog adapter change; add strict positive-integer `qty` checks when order/checkout hardening is in scope.

## Deferred from: code review of 1-4-document-environment-variables.md (2026-04-26)

- **Legacy `.js` siblings** (`CheckoutPage.js`, `config.js`, `SubscriptionForm.js`): Still present alongside TypeScript sources; documentation now points to `.ts/.tsx` as primary. Remove or keep in sync when the brownfield TS migration is finished.

## Deferred from: code review of 1-5-smoke-test-or-script-clean-build-routes.md (2026-04-26)

- **Route smoke asserts on marketing copy strings** (`src/routes.smoke.test.tsx`): Acceptable for story 1.5 (layout `data-testid` + route-level copy); consider more stable selectors later if marketing churn breaks CI often.

- **README omits local `npm run smoke`** (`README.md`): CI covers AC6; add a short “Smoke / CI parity” blurb when README is next edited for onboarding.

## Deferred from: code review of 3-2-cart-validate-stock-variants.md (2026-04-26)

- **`storefrontCartLinesEqual` uses `JSON.stringify`**: Deep equality for cart line arrays may be sensitive to key order; revisit if spurious re-renders or missed hydration updates are observed.
