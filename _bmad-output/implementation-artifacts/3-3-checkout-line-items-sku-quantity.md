# Story 3.3: Checkout request sends line items (SKU + quantity)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want **checkout to authorize payment using server-calculated amounts derived from the SKUs and quantities in my cart**,
so that **FR-CHK-003, FR-CAT-004, E3-S3** are satisfied: the browser **does not** drive the Stripe PaymentIntent amount from client-computed merchandise totals, and the server can price lines from the catalog.

## Acceptance Criteria

1. **Given** [FR-CHK-003](../planning-artifacts/epics.md) / [PRD §9.4 / Epic 3 E3-S3](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** the real (non-mock) checkout flow requests a PaymentIntent from [`/api/create-payment-intent`](../../api/create-payment-intent.ts), **then** the JSON body **includes** a non-empty **`items`** array of **`{ sku: string, quantity: number }`** (quantity integer >= 1) derived from the live cart, **plus** checkout **`email`** when collected (existing metadata use). **Optional** **`variant_id`** (UUID string) may be included per line when the cart row has it ([3-1](3-1-cart-sku-variant-identity.md) / future cart shape) so the server can disambiguate or audit without trusting client price. **Contract:** `quantity` is the canonical request field for Epic 3; server helpers may temporarily adapt from/to the existing internal `qty` shape, but new frontend/domain DTOs should not introduce a second public field name.

2. **Given** [FR-CAT-004](../planning-artifacts/epics.md) (server-authoritative merchandise pricing), **when** `items` is present and valid, **then** the PaymentIntent **`amount`** (minor units) is computed **only** from server catalog pricing via existing [`computeAmountCents`](../../api/_lib/catalog.ts) or its extracted Epic 3 pricing helper for line merchandise **and** the same **shipping + tax policy** the UI currently shows (today: flat **$5** shipping and **7%** tax on merchandise subtotal in [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx)), implemented **on the server** so the charged amount matches the displayed total without sending a raw **client** `amount` for the full PI. **Do not** accept a client-supplied total that overrides catalog-derived merchandise for this path: if the request includes **`amount`** alongside **`items`**, **ignore** `amount` for pricing (or reject with 400 — pick one behavior and document). **Coordination:** if **[3-4](3-4-server-subtotal-from-catalog.md)** lands first, reuse its quote/total helper; if this story lands first, extract the helper here so **3-4** exposes the same math through a read-only quote endpoint. **Out of scope for 3-3:** DB-backed server catalog replacement; keep the existing `data/products.json` server path unless a separate story changes it.

3. **Given** an **empty cart**, invalid lines, or **missing / empty SKU** on any line intended for checkout, **when** the user would create a PaymentIntent, **then** checkout **does not** call the API with unusable `items` — align with [FR-CHK-001](../planning-artifacts/epics.md) (block or redirect with a clear message). Until **[3-2](sprint-status.yaml)** adds full stock validation UI, at minimum **block** payment bootstrap if any line lacks a non-empty SKU after normalization ([`normalizeLineSku`](../../src/cart/lineKey.ts)).

4. **Given** [`computeAmountCents`](../../api/_lib/catalog.ts) throws on unknown SKU, **when** the API processes the request, **then** the handler returns a **4xx** with a safe message (no stack trace to client) and structured server log; the storefront shows an actionable error (e.g. cart changed — return to cart).

5. **Given** [`IS_MOCK_PAYMENT`](../../src/utils/config.ts) is **true**, **when** checkout runs, **then** behavior may remain **without** PaymentIntent creation — document that AC 1–2 apply to the **real** Stripe path only; mock flow unchanged unless trivially broken.

6. **Given** [NFR-MAINT-001 / centralized contracts](../planning-artifacts/architecture.md), **when** the story is complete, **then** the POST body for `create-payment-intent` is validated with **zod** on the server (new or shared schema under `api/_lib/`, reusing or mirroring [`checkoutLineDraftSchema`](../../src/domain/commerce/cart.ts) for each line), and the frontend uses **[`toCheckoutLines`](../../src/cart/checkoutLines.ts)** as the **only** cart → line-list mapper, then maps to the wire shape the API accepts (`qty` for `computeAmountCents` or normalized field names in one function—no ad-hoc mapping in multiple files).

7. **Given** [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md), **when** the story ships, **then** `npm run build` and **`npm run smoke`** pass. Add **Vitest** coverage for: zod boundary (valid / invalid bodies); pure **total** helper if extracted (merchandise + flat shipping + tax); mapper unit tests with fixture cart rows.

## Tasks / Subtasks

- [x] **Task 1 — Server: trusted PI amount from items (AC: 2, 4, 6)**  
  - [x] Add zod schema for POST body (`items`, optional `variant_id` per line, `email`, no trusted `amount` for pricing).  
  - [x] PI amount from [`quoteCartLines`](../../api/_lib/catalog.ts) via [`totalChargeCentsFromCatalogLines`](../../api/_lib/checkoutQuote.ts) (merchandise + tax + shipping per catalog policy).  
  - [x] Map unknown SKU / validation failures to 4xx + log.

- [x] **Task 2 — Client: send line items (AC: 1, 3, 6)**  
  - [x] [`useCartQuote`](../../src/hooks/useCartQuote.ts) / [`toCheckoutLines`](../../src/cart/checkoutLines.ts) — POST **`items`** + **`email`**; no client `amount` on the real Stripe path.  
  - [x] Gated on `checkoutOk` + non-empty draft lines; [`CheckoutPage`](../../src/components/Cart/CheckoutPage.tsx) fetches PI only when a server **quote** exists so totals align.  
  - [x] PI bootstrap `useEffect` depends on `paymentBootstrapKey` (lines + email), `checkoutOk`, and **`quote`**.

- [x] **Task 3 — Tests (AC: 7)**  
  - [x] Vitest: `api/_lib/createPaymentIntentBody.test.ts`, `api/_lib/checkoutQuote.test.ts`, `api/create-payment-intent.test.ts`; `npm run build` + `npm test` pass.  
  - [x] No live Stripe in tests.

### Review Findings

- [x] [Review][Patch] Align PaymentIntent metadata with `api/stripe-webhook.ts` — new PIs set `checkoutRef` and `line_digest` only, but `payment_intent.succeeded` still reads `metadata.orderId` and `metadata.itemsJSON`. Paid webhooks can record orders with an empty `orderId`, empty line items, and skip inventory decrement. — [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts), [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts) — **fixed 2026-04-26:** `orderId` + `itemsJSON` restored on create PI.

- [x] [Review][Patch] Guard success navigation on explicit `succeeded` status — `InnerCheckoutForm` / `handlePaymentResult` only block when `status` is truthy and not `succeeded`; if `status` is missing/undefined, the flow still clears the cart. Require `status === "succeeded"` before `clearCart` / navigation. — [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) — **fixed 2026-04-26**

- [x] [Review][Patch] Catalog hydration effect dependency — `getDefaultCatalogAdapter().listProducts()` is tied to `[cartItems]` identity, so benign parent re-renders can refetch the full catalog. Prefer a stable dependency (e.g. serialized cart line keys or length-only where valid). — [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) — **fixed 2026-04-26:** `catalogFetchKey`

- [x] [Review][Patch] Misleading 4xx for unexpected pricing failures — non-`QuoteError` throws reuse the same "no longer available" 400 as catalog quote errors; consider distinguishing true server faults (500 + safe message) from known quote/SKU failures (AC4). — [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) — **fixed 2026-04-26**

- [x] [Review][Patch] Test describe string references wrong story id — `E3-S5` in `create-payment-intent.test.ts` should match Epic 3 / E3-S3 (or a neutral label). — [`api/create-payment-intent.test.ts`](../../api/create-payment-intent.test.ts) — **fixed 2026-04-26**

- [x] [Review][Defer] Deterministic Stripe idempotency for identical checkout payloads — random `checkoutRef` yields a new PaymentIntent whenever the bootstrap effect re-runs; optional follow-up to key idempotency off `line_digest` + normalized email if strict retry semantics are required. — deferred, enhancement

## Dev Notes

### Current code state (read before changing)

- **[`api/create-payment-intent.ts`](../../api/create-payment-intent.ts):** POST body is typed inline as `items?: Array<{ sku: string; qty: number }>` and optional `amount` / `email`. If `items?.length` is truthy, `amount` for the PI is **`computeAmountCents(items)` only** — that sum is **merchandise subtotal in cents** from [`api/_lib/catalog.ts`](../../api/_lib/catalog.ts) (`price_cents * qty` per line). It **does not** include the **$5** flat shipping or **7%** tax the UI shows in [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) (`shipping = 5`, `tax = total * 0.07` on the client `total`). **3-3 must** add server-side shipping + tax (same policy as the UI) whenever pricing from `items`, so the PI amount matches the order summary. Unknown-SKU errors from `computeAmountCents` currently bubble to a **500** with `err.message` — AC 4 requires **4xx** + safe client message + structured log. **CORS** helper: preserve `FRONTEND_URL` behavior.
- **[`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx):** Real (non-mock) path `fetch`es `/api/create-payment-intent` with **`body: JSON.stringify({ amount: Math.round(grandTotal * 100), currency: "usd" })`** only — no `items`, no `email`. `useEffect` depends on `[total]`; cart line identity changes that do not change `total` (e.g. swap same-price SKU) are a secondary edge case—prefer dependencies aligned with **checkout lines** once `items` is sent.
- **[`api/_lib/catalog.ts`](../../api/_lib/catalog.ts):** `computeAmountCents` takes `{ sku, qty }` (field name **`qty`**, not `quantity`).  
- **Mapper already in tree:** [`toCheckoutLines`](../../src/cart/checkoutLines.ts) returns [`CheckoutLineDraft[]`](../../src/domain/commerce/cart.ts) with **`quantity`** (and optional `variant_id`, `product_slug`). It skips empty-SKU lines. **CheckoutPage does not import it yet** — 3-3 should wire it and map drafts → API `items`, converting **`quantity` → `qty`** at one boundary (or extend `computeAmountCents` / zod to accept `quantity` and normalize internally—single place only).

### Dev Agent Guardrails

- **Brownfield:** The primary defect is the storefront posting **client** `amount`; the handler’s **`items`** path exists but is unused and **under-prices** (no ship/tax) until this story.  
- **3-1:** `toCheckoutLines` + `checkoutLineDraftSchema` **exist** in `src/cart/` and `src/domain/commerce/cart.ts` — use them; do not add a second parallel mapper.  
- **Ordering with 3-2:** **[3-2](sprint-status.yaml)** adds stock/variant validation UI; 3-3 must not assume 3-2 is done — still block empty SKU and handle server 4xx for unknown SKUs.  
- **Scope boundary:** Do not implement Stripe Checkout Session (**[3-5](sprint-status.yaml)**) or order persistence (**Epic 4**). Do not remove the Payment Element flow unless required.

### Technical requirements

- **FR-CHK-003, FR-CHK-001, FR-CAT-004, E3-S3**; **PRD §19:** no client-submitted payment amounts on the **trusted** path.  
- **NFR-SEC-002:** secrets stay server-side; no service role in browser.

### Architecture compliance

- [_bmad-output/planning-artifacts/architecture.md](../planning-artifacts/architecture.md): Server validates inputs with zod; SKU-keyed commerce; strangler pattern for API — extend TypeScript [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts), not a parallel `.js` handler.

### Library / framework requirements

- **Stripe Node** ([`package.json`](../../package.json)), **zod** for request validation — no new deps unless unavoidable.

### File structure requirements

| Area | Action |
|------|--------|
| [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) | **UPDATE** — zod validate; PI amount from items + server fees/tax; error mapping |
| [`api/_lib/`](../../api/_lib/) | **UPDATE or NEW** — request schema, optional `pricing.ts` for shipping/tax cents |
| [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) | **UPDATE** — POST `items` + `email`; gate on SKU |
| [`src/cart/checkoutLines.ts`](../../src/cart/checkoutLines.ts) | **USE** (`toCheckoutLines` already implemented) — wire from CheckoutPage; change only if API schema requires |
| [`src/domain/commerce/cart.ts`](../../src/domain/commerce/cart.ts) | **REFERENCE** — `checkoutLineDraftSchema` / `CheckoutLineDraft` for line shape |

### Testing requirements

- `npm run build` + `npm run smoke`.  
- **Vitest** for schema + pricing + mapper; mock catalog or stub `computeAmountCents` if needed.

### Previous story intelligence (3-1)

- [`toCheckoutLines`](../../src/cart/checkoutLines.ts) and [`checkoutLineDraftSchema`](../../src/domain/commerce/cart.ts) are **in the repo**; 3-3 **consumes** that output for the POST body.  
- **3-1** defers PaymentIntent / server amount semantics to **3-3/3-4**; this story is the **contract swap** on the client + server trust boundary.

### Previous story intelligence (3-2)

- **[3-2](3-2-cart-validate-stock-variants.md)** defines invalid-cart guard UX. Reuse that guard when available; if 3-3 ships first, still block missing SKU client-side and handle server 4xx errors safely.

### Git intelligence (recent commits)

- Recent focus: Vitest, Supabase catalog adapter, catalog types — keep API catalog (`api/_lib/catalog.ts`) behavior explicit: today it reads **`data/products.json`** only; **3-4** should expose the same server-side pricing as a quote endpoint. DB-backed server catalog replacement is a separate future decision unless explicitly pulled into the implementation PR.

### Latest technical information

- **Stripe PaymentIntents:** Amount is integer in smallest currency unit; metadata must stay small (no oversized order blobs per FR-CHK-003).  
- **CORS:** Existing [`cors()`](../../api/create-payment-intent.ts) pattern — preserve for local/dev.

### Project context reference

- `project-context.md` is not present in the repo (create-story `persistent_facts` glob found nothing). Rely on this file, [epics.md](../planning-artifacts/epics.md), [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md), and [architecture.md](../planning-artifacts/architecture.md).

### References

- [PRD — §9.4 Checkout, Epic 3, E3-S3](../planning-artifacts/zephyr-lux-commerce-prd.md)  
- [epics.md — FR-CHK-001, FR-CHK-003, FR-CAT-004](../planning-artifacts/epics.md)  
- [3-1-cart-sku-variant-identity.md](3-1-cart-sku-variant-identity.md)  
- [sprint-status.yaml](sprint-status.yaml)  

## Story completion status

- **Status:** `done`  
- **Note:** Server zod + client `items` + email; PI amount from shared catalog quote; CheckoutPage uses `useCartQuote` + `quote`-gated PI fetch. Code review patches applied 2026-04-26 (webhook metadata, payment status guard, catalog fetch key, 500 on unexpected pricing errors, test label).

## Dev Agent Record

### Agent Model Used

Composer (dev-story 2026-04-26)

### Debug Log References

### Completion Notes List

- Implemented `api/_lib/createPaymentIntentBody.ts` (zod) and `api/_lib/checkoutQuote.ts` wrapping `quoteCartLines` for PaymentIntent `amount`.
- Refactored `api/create-payment-intent.ts`: safeParse body, 4xx on validation/unknown SKU, generic 500 message; `items` with `quantity` + optional `variant_id` / `product_slug`.
- Checkout: `useCartQuote` provides quote + `drafts` (`toCheckoutLines`); PI fetch only after `quote` loads; body `{ items: checkoutLines, email, currency }`.
- Added `export type CartQuote = ServerCartQuote` in `src/lib/cartQuoteTypes.ts` for the hook; fixed `serverQuote` → `quote` naming in `CheckoutPage`.
- Tests: new API unit tests; route smoke uses longer wait for `/checkout` where applicable.

### File List

- `api/_lib/createPaymentIntentBody.ts`
- `api/_lib/createPaymentIntentBody.test.ts`
- `api/_lib/checkoutQuote.ts`
- `api/_lib/checkoutQuote.test.ts`
- `api/create-payment-intent.ts`
- `api/create-payment-intent.test.ts`
- `src/lib/cartQuoteTypes.ts`
- `src/components/Cart/CheckoutPage.tsx`
- `src/routes.smoke.test.tsx`
- `vite.config.ts`

## Change Log

- **2026-04-26:** Story 3-3 — server-trusted PaymentIntent from SKU line items; client posts `items` + `email`; tests and smoke updated.

## Questions (non-blocking)

- Should flat shipping/tax move to **env constants** (e.g. `CHECKOUT_FLAT_SHIPPING_CENTS`, `CHECKOUT_TAX_BPS`) in this story or wait for **3-4**?  
- When **`variant_id`** is present but **SKU** mismatches catalog, should the server reject the request immediately or prefer one identifier after a future DB-backed pricing path exists? (For 3-3, SKU remains primary for `computeAmountCents`.)
