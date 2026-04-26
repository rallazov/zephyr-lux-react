# Story 3.4: Server catalog quote for authoritative display

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want **the cart and checkout to show line amounts, subtotal, shipping, tax, and total derived from the same server-side catalog and pricing rules the payment API uses**,
so that **FR-CART-004** (accurate subtotal from current catalog), **FR-CAT-004** (server-authoritative price), **FR-CHK-003** (server-calculated line pricing), **FR-CHK-006** (shipping/tax clarity), and **PRD §14 Epic 3 / E3-S4** are satisfied and **I never rely on stored client `price` as the source of truth for what I pay**.

## Acceptance Criteria

1. **Given** [FR-CAT-004](../planning-artifacts/epics.md), [FR-CART-004](../planning-artifacts/epics.md), and [FR-CHK-006](../planning-artifacts/zephyr-lux-commerce-prd.md) **when** a non-empty cart is shown on the **Cart** or **Checkout** experience **then** the **displayed** line totals, order **subtotal**, **shipping**, **tax**, and **total** are **derived from a server response** that recomputes amounts from `data/products.json` via the same catalog/pricing module as payment (`api/_lib/catalog.ts` plus any extracted pricing helper), **not** from summing `item.price * quantity` or hardcoding tax/shipping on the client. **Exception:** a clearly labeled **loading** state and **error/retry** state are allowed while the quote request is in flight or failed.

2. **Given** a request body of checkout-style lines (minimum: **`sku` + `quantity` per line** — align with [`toCheckoutLines`](../../src/cart/checkoutLines.ts) / [`CheckoutLineDraft`](../../src/domain/commerce/cart.ts) from **3-1**; see **snapshot** below for **`qty` vs `quantity`**) **when** the **server** handles a new **read-only** quote endpoint (e.g. `POST /api/cart-quote` — name to be chosen and documented) **then** the handler returns **`subtotal_cents`**, **`shipping_cents`**, **`tax_cents`**, **`total_cents`**, **currency** (e.g. `usd` unless catalog encodes another), and **per-line** `unit_cents` and `line_cents` (or equivalent) for each resolvable SKU, using **one** shared implementation with [`computeAmountCents`](../../api/_lib/catalog.ts) or its extracted replacement (refactor: extract a small **`quoteItems`** / **`priceCheckoutItems`** in `api/_lib/catalog.ts` or `api/_lib/pricing.ts` that both `computeAmountCents` / PaymentIntent creation and the new handler use so the math cannot diverge). **If** a SKU is **unknown** to the server catalog, the response is a **4xx** with a stable machine-readable `code` and human-readable message; the client must surface a non-cryptic error and not show a misleading subtotal.

3. **Given** [UX — CheckoutOrderSummary](../planning-artifacts/ux-design-specification.md#component-strategy) (“Values from server response only”) **when** checkout order summary is rendered after this story **then** line amounts, subtotal, shipping, tax, and total in the main summary **reflect the quote response**. If the MVP policy is flat shipping + flat tax rate, those constants live behind the server quote/pricing contract and the UI consumes returned cents; the client must not keep a parallel `0.07` / `$5` formula for the canonical total.

4. **Given** [architecture — no client payment amounts as source of truth](../planning-artifacts/architecture.md) and existing [`/api/create-payment-intent`](../../api/create-payment-intent.ts) **when** this story is complete **then** **PaymentIntent** creation continues to work; **if** the handler already supports `{ items: { sku, quantity }[] }`, the **total cents** passed to Stripe must remain **server-computed** from the same quote/pricing helper (not from client). **This story** does not require **removing** the legacy `amount` body branch — that is owned by [**3-3**](sprint-status.yaml) — but the **narrative and implementation notes** must state that **quote total and PI amount** must use the **same** catalog helpers so the UI and charge cannot disagree when both use SKU-based items.

5. **Given** CORS and security expectations consistent with [create-payment-intent.ts](../../api/create-payment-intent.ts) **when** the new endpoint is called from the Vite app origin **then** behavior matches the existing API pattern (headers, `OPTIONS` preflight, no secrets in response).

6. **Given** [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md) **when** the story is complete **then** `npm run build` and `npm run smoke` pass. Add **Vitest** coverage for the **shared** pure function in `api/_lib/catalog.ts` (quote/line math + unknown SKU) with **no** live `fetch` in unit tests; optional: thin handler test with mocked body if the project pattern supports it.

## Tasks / Subtasks

- [x] **Task 1 — Server quote API + shared math (AC: 2, 4, 5)**  
  - [x] Refactor `api/_lib/catalog.ts` / `api/_lib/pricing.ts` to expose a single function that returns **line-level**, **subtotal**, **shipping**, **tax**, and **total** cents from `Array<{ sku, quantity }>`, and implement `computeAmountCents` / the PaymentIntent items path in terms of it (or equivalent—no duplicate pricing formulas).  
  - [x] Add `api/cart-quote.ts` (or agreed name) + mirror `.js` only if the repo’s dual-file policy still requires it; prefer **deleting** the obsolete half per architecture notes if already resolved for other routes.  
  - [x] Zod-validate request body (same shape as **3-1** export lines where possible: `sku` non-empty string, `quantity` positive int). Reject invalid quantity rather than silently clamping unless a legacy branch is explicitly documented.

- [x] **Task 2 — Storefront: fetch quote and replace client sum (AC: 1, 3)**  
  - [x] On **Cart** and **Checkout** (at minimum: pages that today use `reduce(... price * quantity ...)` e.g. [`CartPage.tsx`](../../src/components/Cart/CartPage.tsx), [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx)), load server quote from cart lines (map context → `{ sku, quantity }` via `toCheckoutLines` from **3-1** when available, or an interim mapper with the same fields).  
  - [x] Implement loading + error UI; on success, show money from `unit_cents` / `line_cents` (format with a small helper, e.g. `formatCents`—reuse or add under `src/` if a pattern exists).  
  - [x] Keep free-shipping progress bar and similar **consistent** with server subtotal/quote to avoid two truths.

- [x] **Task 3 — Tests + docs (AC: 6)**  
  - [x] Unit tests for catalog quote helper.  
  - [x] Update [README-payments.md](../../README-payments.md) (or cross-link only) to mention the quote endpoint and that displayed totals come from server catalog.

- [x] **Task 4 — Coordination notes**  
  - [x] In dev notes, reference [**3-2**](sprint-status.yaml) (stock/variant validation UI) and [**3-3**](sprint-status.yaml) (checkout POST body to `create-payment-intent`); this story does not implement full **FR-CART-004** warning/block for OOS — only **server-backed pricing** for known SKUs.

### Review Findings

- [x] [Review][Patch] Cart shows client-derived unit/line prices while the catalog quote is still loading — [src/components/Cart/CartPage.tsx](src/components/Cart/CartPage.tsx) — fixed: `…` for unit/line when `quoteLoading` and line not yet in quote.
- [x] [Review][Patch] Shipping comment contradicts implemented policy — [api/_lib/catalog.ts](api/_lib/catalog.ts) — fixed: docstring matches $5.00 / `FLAT_SHIPPING_CENTS`.
- [x] [Review][Patch] Quote `fetch` assumes JSON body on all responses — [src/hooks/useCartQuote.ts](src/hooks/useCartQuote.ts) — fixed: `res.text()` + `JSON.parse` in try/catch.
- [x] [Review][Defer] Unused navigation state passes client `subtotal` to checkout — [src/components/Cart/CartPage.tsx](src/components/Cart/CartPage.tsx) (`navigate(..., { state: { subtotal, items } })`); `CheckoutPage` does not read it — harmless but misleading; remove or pass server quote later — deferred, pre-existing pattern once route state is next touched.
- [x] [Review][Defer] Legacy `computeAmountCents` / `quoteForPaymentItems` still coerce quantity and `computeAmountCents` returns merchandise subtotal only — [api/_lib/catalog.ts](api/_lib/catalog.ts); production `items` path uses Zod + `totalChargeCentsFromCatalogLines` — defer full cleanup to checkout hardening (see deferred-work).

## Dev Notes

### Dev agent guardrails

- **Scope:** **E3-S4** + **FR-CART-004** pricing accuracy, **not** full stale-line warning UX (**3-2**), not Checkout Session / PI contract swap (**3-3/3-5**).  
- **Single source of truth:** All money for display from this feature flows from **server** `price_cents` in catalog, not `CartItem.price` from localStorage. It is acceptable to show **name/image** from client lines while **money** is from the quote.  
- **Supabase mode:** The server `api/_lib/catalog.ts` path today loads **`data/products.json`**; if production later uses a DB-backed server catalog, the **same** quote function must switch—**do not** add a second pricing path on the client.

### Current codebase snapshot (verify before coding)

- **[`api/_lib/catalog.ts`](../../api/_lib/catalog.ts):** `loadCatalog`, `findVariantBySku`, `computeAmountCents(items: { sku: string; qty: number }[])`. Unknown SKU **throws** (wrap in handler for 4xx quote). `qty` uses `Math.max(1, it.qty | 0)` today — **silent clamp**; the shared **quote** path should **Zod-validate** positive integer `quantity` and **reject** invalid bodies instead of clamping, then map to line math.  
- **[`api/create-payment-intent.ts`](../../api/create-payment-intent.ts):** CORS from `ENV.FRONTEND_URL`; POST; body supports `items?: { sku, qty }[]` **or** legacy `amount` cents. Item path: `computeAmountCents(items)`.  
- **Naming boundary:** Storefront [`checkoutLineDraftSchema`](../../src/domain/commerce/cart.ts) and [`toCheckoutLines`](../../src/cart/checkoutLines.ts) use **`quantity`**. The server item shape uses **`qty`**. Unify in one place (e.g. parse request with `quantity` in Zod and map internally, or rename `computeAmountCents` input field to `quantity` everywhere on the server).  
- **[`src/components/Cart/CartPage.tsx`](../../src/components/Cart/CartPage.tsx):** Subtotal and free-shipping progress use `reduce` on **`y.price * y.quantity`** (client). Replace display + threshold with **quote** `subtotal_cents` (and loading/error).  
- **[`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx):** `calculateTotal` uses client `price * quantity`. Order summary shows client subtotal, **7% tax**, **$5** shipping, and a grand total; non-mock `useEffect` posts **`/api/create-payment-intent`** with **`amount: Math.round(grandTotal * 100)`** only (no `items` yet). This story should drive **order summary** from the **quote**; **PaymentIntent** body alignment with the same subtotal+tax+shipping (so charge matches UI) may still require coordinating with **3-3** if the client keeps sending `amount` — **do** share catalog/pricing helpers so whatever amount path ships cannot drift from the quote.  
- **Dual API artifacts:** `api/create-payment-intent.js` and `api/_lib/catalog.js` exist alongside `.ts` — follow the project’s **dual-file** policy (keep in sync or remove dead half per [architecture.md](../planning-artifacts/architecture.md)).

### Technical requirements

- **FR-CART-004, FR-CAT-004, FR-CHK-003, FR-CHK-006** (align display with server-calculated payment math).  
- **NFR-SEC-001 / FR-PAY-001:** No Stripe secret exposure; quote endpoint is public read of **prices** only (same as implicit price exposure on product pages).

### Architecture compliance

- [_bmad-output/planning-artifacts/architecture.md](../planning-artifacts/architecture.md): “Server-calculated Stripe line items”; cart/checkout must not assert client totals as authoritative.  
- [README-payments flow](../../README-payments.md): extend, don’t fork, the “server computes from `data/products.json`” story.

### Library / framework requirements

- **Stripe @17.7**, **Vercel serverless** — match [package.json](../../package.json). **Zod** for request body on the new route.

### File structure requirements

| Area | Action |
|------|--------|
| [`api/_lib/catalog.ts`](../../api/_lib/catalog.ts) / `api/_lib/pricing.ts` | **UPDATE** — shared `quote` / line + total math; keep `findVariantBySku` / `loadCatalog` as today |
| `api/cart-quote.ts` (or `api/quote-subtotal.ts`) | **NEW** — POST quote handler |
| [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) | **UPDATE** (minimal) — call shared helper for `items` path so Stripe amount cannot drift from quote |
| [`src/components/Cart/CartPage.tsx`](../../src/components/Cart/CartPage.tsx) | **UPDATE** — server subtotal + line display |
| [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) | **UPDATE** — order summary from quote; re-fetch when `cartItems` / quote lines change; ensure **total** + tax + shipping still consistent with `create-payment-intent` when moving to `items` in **3-3** |
| `src/cart/*` or small hook (e.g. `useCartQuote`) | **NEW** (optional) — dedupe fetch between cart and checkout |
| [README-payments.md](../../README-payments.md) | **UPDATE** — document quote endpoint |

### Testing requirements

- `npm run build` + `npm run smoke`.  
- **Vitest:** cover catalog quote for: known SKUs, duplicate lines, **unknown** SKU error path, invalid quantity rejection, and subtotal/shipping/tax/total math.

### Previous story intelligence (3-1)

- **Implemented in repo:** [`src/cart/checkoutLines.ts`](../../src/cart/checkoutLines.ts) — **`toCheckoutLines` → `CheckoutLineDraft[]`** (`sku`, **`quantity`**, optional `variant_id`, `product_slug`); lines with empty SKU are skipped. **3-4** should build the quote POST body from this output (or an equivalent in-memory list).  
- [**3-1** story file](3-1-cart-sku-variant-identity.md): versioned storage and reconciliation; **3-1** defers **server subtotal** to this story. PaymentIntent **amount** / `items` contract is tightened in **3-3/3-5**; **3-4** must still **refactor shared catalog math** so **displayed** totals and **PI amount** cannot disagree when both use catalog-backed line math.

### Git intelligence (recent commits)

- Latest `main`/`dev` history (examples): Vitest + Supabase catalog adapter on the **storefront**; env and README payment docs. Server **`api/_lib/catalog.ts`** remains **`data/products.json` file-based** — quote implementation stays in that path until a follow-up adds a Supabase server catalog; **do not** add client-side duplicate pricing.

### Latest technical information

- **Vercel:** Add new `api/*.ts` route alongside existing handlers; `vercel dev` for local E2E.  
- **Money:** Prefer **integer cents** in API JSON to avoid float drift; format to dollars only in UI.

### Project context reference

- No `project-context.md` in repo; use this file, [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §14 Epic 3, and [epics.md](../planning-artifacts/epics.md) (FR table).

### References

- [PRD — E3-S4, FR-CART-004, Epic 3 acceptance](../planning-artifacts/zephyr-lux-commerce-prd.md)  
- [epics.md — FR-CAT-004, FR-CART-004, UX-DR7](../planning-artifacts/epics.md)  
- [ux-design-specification.md — CheckoutOrderSummary](../planning-artifacts/ux-design-specification.md)  
- [3-1-cart-sku-variant-identity.md](3-1-cart-sku-variant-identity.md)  
- [sprint-status.yaml](sprint-status.yaml)

## Story completion status

- **Status:** `done`  
- **Note:** Implementation complete 2026-04-26 — `quoteCartLines`, `POST /api/cart-quote`, `useCartQuote`, cart/checkout UI, `checkoutQuote` ↔ PI alignment, Vitest, README. Code review patches applied same day (cart loading placeholders, catalog docstring, safe quote JSON parse).

## Dev Agent Record

### Agent Model Used

Composer (Cursor) — bmad-dev-story 3-4

### Debug Log References

### Completion Notes List

- Implemented `quoteCartLines` in `api/_lib/catalog.ts` (7% tax on merch, flat $5 ship waived at ≥$50.00 subtotal) with `QuoteError`; `quoteForPaymentItems` and `computeAmountCents` (subtotal) built on the same model; `api/_lib/checkoutQuote.ts` delegates `totalChargeCentsFromCatalogLines` to that stack so PI amount matches `POST /api/cart-quote` for the same lines.
- Added `api/cart-quote.ts` (Zod body, CORS, 4xx for unknown SKU / bad body).
- Added `useCartQuote`, `formatCents`, and `src/lib/cartQuoteTypes.ts` (`ServerCartQuote` / `CartLineQuote`); wired **Cart** and **Checkout** to server line amounts and subtotal, loading/error/retry, free-ship bar from `subtotal_cents`.
- Recovered **Contact & shipping** form on checkout (it had been missing inputs; `setFormData` is wired again) and removed unused `clientSecret` prop on `InnerCheckoutForm`.
- Vitest: `api/_lib/catalog.quote.test.ts`, extended `api/_lib/checkoutQuote.test.ts` (free-shipping case); `vite.config` includes `api/**/*.test.ts`.
- `npm run build`, `npm test`, `npm run smoke` pass.

### File List

- `api/cart-quote.ts` (new)
- `api/_lib/catalog.ts` (quote stack)
- `api/_lib/checkoutQuote.ts` (re-exports, total charge)
- `api/_lib/catalog.quote.test.ts` (new)
- `api/_lib/checkoutQuote.test.ts`
- `vite.config.ts`
- `src/hooks/useCartQuote.ts` (new)
- `src/lib/money.ts` (new)
- `src/lib/cartQuoteTypes.ts`
- `src/components/Cart/CartPage.tsx`
- `src/components/Cart/CheckoutPage.tsx`
- `README-payments.md`

### Change Log

- 2026-04-26: E3-S4 — server cart quote, storefront display, shared checkout/PaymentIntent totals, tests, docs.

## Questions (non-blocking)

- Should the quote endpoint be **`POST` only** (avoid caching surprises) with short client-side debounce on cart changes?  
- If **`IS_MOCK_PAYMENT`**, should the app still call **`/api/cart-quote`** (requires `vercel dev`) or a **dev-only** static fallback—document the chosen local workflow.
