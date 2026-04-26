# Story 3.5: Stripe Checkout Session or PaymentIntent with correct totals

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want **to pay through Stripe using amounts the server derived from the catalog (not from my browser)**,
so that **FR-CHK-003, FR-CHK-005, FR-CHK-006 (totals), FR-CAT-004, FR-PAY-001, PRD §9.4 / §14 Epic 3 / E3-S5** are satisfied and **E3-S3 + E3-S4 outputs feed a single, auditable payment bootstrap**.

## Acceptance Criteria

1. **Given** **[3-3](sprint-status.yaml)** (checkout request sends **SKU + quantity** / variant keys) and **[3-4](sprint-status.yaml)** (server quote returns **subtotal, shipping, tax, and total cents** from catalog rules), **when** the storefront is ready to collect payment, **then** the app calls a **server** endpoint that **creates a Stripe object** (either **Checkout Session** *or* **PaymentIntent** — see Dev Notes) whose **chargeable `amount` total** matches the **server quote's** `total_cents` for that request **and** the client does **not** send a raw `amount` (or, if a legacy field remains temporarily, the server **ignores** it whenever validated line items are present).

2. **Given** [FR-CHK-003](../planning-artifacts/zephyr-lux-commerce-prd.md) and [FR-CHK-005](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** the payment object is created, **then** **Stripe `metadata` is bounded**: store a **`checkoutRef` / `client_reference_id` / short correlation id** (not a customer-facing fake order number), **customer email** if available, a **compact** reference to line items (e.g. hashed/short id, or small JSON under Stripe metadata size limits) — **not** an unbounded copy of the full cart. Use **`orderId`** only if this story creates or receives a real persisted pre-order identifier; otherwise leave real order numbers to **Epic 4**. **Record the architecture decision** (Checkout Session vs embedded Payment Element) in this story’s Dev Notes and in [architecture.md](../planning-artifacts/architecture.md) (short ADR-style paragraph) if not already decided.

3. **Given** [NFR-SEC-001](../planning-artifacts/epics.md) / [FR-PAY-001](../planning-artifacts/epics.md), **when** the payment flow runs, **then** **only** `VITE_STRIPE_PUBLIC_KEY` (or equivalent) is used in the browser; **all** `STRIPE_SECRET_KEY` usage stays in **`/api/*`** serverless handlers. CORS and `FRONTEND_URL` behavior remain consistent with [ENV](../planning-artifacts/architecture.md) / [1-4](1-4-document-environment-variables.md) patterns.

4. **Given** the **brownfield** [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) and [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) (today: non-mock path posts **`amount`** in cents from client `total`, tax, and shipping — see `fetchClientSecret` ~lines **182–203**; **`toCheckoutLines`** is only used for dev logging, not the POST body), **when** this story is complete, **then** the **production path** for real Stripe (non-mock) uses **server-calculated totals** from the **[3-4](sprint-status.yaml)** pricing module / contract (shared helper with **PI / Session** amount). **Mock payment** ([`IS_MOCK_PAYMENT`](../../src/utils/config.ts)) may remain for local demo but must **not** mask missing server pricing in `npm run build` + documented env.

5. **Given** [FR-CHK-006](../planning-artifacts/zephyr-lux-commerce-prd.md) (shipping/tax clarity) and [UX-DR10 / UX-DR7](../planning-artifacts/epics.md), **when** the customer reviews payables, **then** the **storefront** shows **subtotal, shipping, tax, and total** that **align** with what the **server** will charge (same constants/rules as 3-4; if the server is canonical, the UI should consume a **read-only** quote endpoint or the same **shared** config document — pick one, document in Dev Notes). **Mismatch** (e.g. client-only `0.07` tax) must not ship if the server uses different rules.

6. **Given** [NFR-MAINT-003](../planning-artifacts/epics.md) and **[1-5](1-5-smoke-test-or-script-clean-build-routes.md)**, **when** the change lands, **then** `npm run build` and `npm run smoke` pass. Add **Vitest** for: server handler logic that **rejects** client-supplied amount when line items are provided; and/or **unit tests** for “amount from pricing result === Stripe create payload amount” (mock Stripe SDK). **No live Stripe** in CI — use mocks.

7. **Given** **[3-6](sprint-status.yaml)** (confirmation / cancel / failure UI), **when** this story is implemented, **then** **do not** fully build **success/cancel/failure UX** here — that is **3-6**. For **Checkout Session**, still set **`success_url` / `cancel_url`** to existing routes (may be placeholder query params) so Stripe redirects work; for **PaymentIntent** + Element, keep current **Elements** path unless switching to redirect.

8. **Given** **Epic 4** (webhook, Supabase order) is **separate**, **when** this story completes, **then** the webhook does **not** need to be fully wired yet, but `metadata` keys **should be compatible** with the future `orders.stripe_checkout_session_id` / `orders.stripe_payment_intent_id` model in [epics / data model](../planning-artifacts/epics.md) (document intended keys in Dev Notes for **[4-2](sprint-status.yaml)** / **[4-3](sprint-status.yaml)** handoff).

## Tasks / Subtasks

- [x] **Task 1 — Lock Stripe integration shape (AC: 2, 3, 7, 8)**  
  - [x] Resolve **Q1** from [architecture.md](../planning-artifacts/architecture.md) (Checkout **Session** vs **PaymentIntent** + **Element**): state choice + one paragraph tradeoff; update `architecture.md` if not present.  
  - [x] If **Checkout Session:** add or extend a server route (e.g. `api/create-checkout-session.ts` or `api/…`) and update `CheckoutPage` to **redirect** to `session.url` instead of mounting **Elements** (or keep Elements only in mock); set `client_reference_id` / metadata to the bounded correlation id. **(N/A — PaymentIntent + Element path chosen; Session deferred per Q1 resolution.)**  
  - [x] If **PaymentIntent:** extend [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) to accept the **3-3/3-4** request body, compute amount on server, return `clientSecret`.

- [x] **Task 2 — Server amount + metadata (AC: 1, 2, 8)**  
  - [x] Import or call the **server pricing** function from **3-4** (or stub behind interface if 3-4 not merged yet — **type-only** contract allowed only if this story is blocked; prefer landing **3-4** first or feature-flag in same PR). **(Uses `quoteForPaymentItems` / `quoteCartLines` in [`api/_lib/catalog.ts`](../../api/_lib/catalog.ts) + [`api/_lib/checkoutQuote.ts`](../../api/_lib/checkoutQuote.ts).)**  
  - [x] Remove reliance on `amount` from [`CheckoutPage` `fetchClientSecret`](../../src/components/Cart/CheckoutPage.tsx) for real Stripe; pass **`items`** (from [`toCheckoutLines`](../../src/cart/checkoutLines.ts)) and **`email`**, mapping **`quantity` → `qty`** if [`computeAmountCents`](../../api/_lib/catalog.ts) still uses `qty` until a shared type lands.  
  - [x] Replace or narrow **synthetic** `orderId` + full `itemsJSON` in metadata in [`create-payment-intent.ts`](../../api/create-payment-intent.ts) with **bounded** `checkoutRef` / correlation metadata per AC2 (stop oversized blobs).  
  - [x] Set Stripe **idempotency** keys (existing pattern: `idempotencyKey` on `paymentIntents.create`) for retry safety, derived from the bounded checkout correlation id where possible.

- [x] **Task 3 — Storefront total alignment (AC: 5)**  
  - [x] Replace ad-hoc `total * 0.07` + hardcoded `5` shipping in [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) with the **same** rules as the server (shared module under `src/` for constants, or fetch quote from API — **one** approach). **(POST [`/api/cart-quote`](../../api/cart-quote.ts) + `ServerCartQuote` display.)**

- [x] **Task 4 — Tests and docs (AC: 6)**  
  - [x] Add Vitest tests for API pricing + rejection rules.  
  - [x] Update [README](../../README.md) or env doc only if new env vars (e.g. `STRIPE_*` **already** in 1-4) — follow user rule: **no doc churn** beyond what 3-5 requires. **(No new env vars.)**

### Review Findings

Code review (2026-04-26); **decision: best practice = never trust client `amount`** — `POST /api/create-payment-intent` requires a non-empty `items` array; catalog-only totals; `z.enum(['usd'])` for currency.

- [x] [Review][Decision] Legacy `amount`-only path **removed** (see `createPaymentIntentBodySchema`).

- [x] [Review][Patch] **PI bootstrap** — `paymentBootstrapKey` uses `checkoutLines` + **500ms debounced** email (not every keystroke); `Elements` remounts via `key={paymentBootstrapKey}`; handler verifies `client_secret` before 200.

- [x] [Review][Patch] **cart-quote / useCartQuote** — generic 500; user-safe network error; `isServerCartQuote()` on success JSON.

- [x] [Review][Patch] **`handlePaymentResult`** — existing guards already block non-`succeeded` status (no code change required).

- [x] [Review][Patch] **`quoteCartLines` / `lineItemsToCatalogRows`** — merge duplicate SKUs; validate finite `unit_cents`; JSDoc states flat $5.00 and merchandise-only tax base.

- [x] [Review][Patch] **Tests** — `api/create-payment-intent.handler.test.ts` mocks Stripe and asserts `amount` + `currency: usd` on `paymentIntents.create`.

- [x] [Review][Patch] **Order lines while cart-quote loading** — no client-priced line rows until quote or error path; “Loading line items from the catalog…” when loading.

- [x] [Review][Defer] **`?checkout=canceled` banner** — unchanged; see **3-6**.

- [x] [Review][Defer] **Deterministic idempotency / stable `checkoutRef`** — still random per request; remains on `deferred-work.md` with 3-3 note until product specifies a stable key strategy.

## Dev Notes

### Dev Agent Guardrails

- **Prerequisites:** This story **assumes** **[3-3](sprint-status.yaml)** and **[3-4](sprint-status.yaml)** define the **HTTP contract** and **pricing**. If those are not implemented, **stop** and either narrow scope to a **typed server stub** (must not ship client `amount` as SoT) or implement minimal **3-3/3-4** in the same PR.  
- **Out of scope:** Full **3-6** confirmation/cancel/failure polish; **Epic 4** idempotent **webhook** and Supabase `orders` row.  
- **From [3-1](3-1-cart-sku-variant-identity.md):** Reuse **SKU / variant** lines for the POST body via [`toCheckoutLines`](../../src/cart/checkoutLines.ts) / [`CheckoutLineDraft`](../../src/domain/commerce/cart.ts); do not reintroduce **productId-only** cart keys for payment.  
- **Request shape at API today:** [`computeAmountCents`](../../api/_lib/catalog.ts) takes `{ sku, qty }`; cart export uses **`quantity`**. **[3-3](3-3-checkout-line-items-sku-quantity.md)** / this story should **map** at the server boundary (or normalize types once) so the public JSON contract and zod schema match the epic (**`quantity`**) without silent field drift.  
- **Read-only quote:** `POST` [`/api/cart-quote`](../../api/cart-quote.ts) returns [`quoteCartLines`](../../api/_lib/catalog.ts) (per-line and totals). The PaymentIntent `amount` uses the same `total_cents` via `totalChargeCentsFromCatalogLines` / `quoteForPaymentItems` — **one** math path.  
- **Agent guardrails (PRD §19):** **No** client-submitted payment amounts in **real** payment paths.  
- **Dual-file landmine (architecture):** Ensure **Vercel** runs the **`.ts`** `api` handler, not a stale `.js` pair — if `.js` exists, align or remove per Epic 0 notes in [architecture.md](../planning-artifacts/architecture.md).

### 3-6 handoff: redirects and query params (joint contract)

**Owner:** Full success/cancel/failure **UI** is **[3-6](3-6-checkout-confirmation-cancel-failure-ui.md)**. This story still **must** set server-side URLs so Stripe redirects land predictably.

| Flow | Set in 3-5 | 3-6 consumes |
|------|------------|--------------|
| **Payment Element** + `confirmPayment` | Keep or refine `return_url` (today: `${origin}/order-confirmation` in [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) `confirmParams`). Document whether **`payment_intent` / `payment_intent_client_secret`** are appended by Stripe. | Confirmation page reads query + state per 3-6. |
| **Checkout Session** | `success_url`, `cancel_url` — e.g. `/order-confirmation?session_id={CHECKOUT_SESSION_ID}` and `/cart?checkout=canceled` (exact query flags **document here** when implemented). | Same routes show banners and reference ids per 3-6. |
| **Cart on cancel** | `cancel_url` must **not** clear cart; align with 3-6 AC2. | — |

**Action:** Add a one-line “URL contract” summary to the Dev Agent Record when implementing so 3-6 does not guess.

### Technical requirements

- **FR-CHK-003, FR-CHK-005, FR-CHK-006, FR-CAT-004, FR-PAY-001, NFR-SEC-001.**  
- **Stripe Node SDK** already at **`stripe@^17.7.0`** ([`package.json`](../../package.json)); keep version aligned; use typed `Stripe` APIs.

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): serverless API on Vercel; **PCI-light** via Stripe-hosted surfaces; idempotent creates where applicable; Pino logging in API ([`log`](../../api/_lib/logger.ts)).  
- [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) **§9.4–9.5** checkout and payment.

### Library / framework requirements

- **React 18**, **TypeScript**, **Zod** on all server request bodies, **`stripe`** server-side only, **`@stripe/stripe-js` + `@stripe/react-stripe-js`** only if **Payment Element** path is kept.  
- **No** new payment processor dependencies.

### File structure requirements

| Area | Action |
|------|--------|
| [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) | **UPDATE** (or supersede) — validated body, server totals, no client `amount` trust for line-item checkout |
| `api/create-checkout-session.ts` (optional) | **NEW** if Session-based flow chosen |
| [`api/_lib/catalog.ts`](../../api/_lib/catalog.ts) and/or 3-4 server pricing module | **UPDATE** / **use** — single source for cents |
| [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) | **UPDATE** — request payload, display totals, redirect vs Elements |
| [`src/cart/`](../../src/cart/) or [`toCheckoutLines`](3-1-cart-sku-variant-identity.md) | **USE** — line items for POST |

### Testing requirements

- `npm run build` + `npm run smoke`.  
- **Vitest:** mock `Stripe` constructor or inject test double; no network to Stripe in CI.  
- Optional: manual **Stripe test mode** pay once locally (`npm run dev` + `vercel dev` or documented) — not a CI gate.

### Previous story intelligence (3-1 and Epic 3 ordering)

- **[3-1](3-1-cart-sku-variant-identity.md)** introduced **versioned cart**, **reconciliation**, and **`toCheckoutLines`-style** export for the server. Payment bootstrap **must** consume that shape.  
- Stories **3-2** (stock), **3-3** (line items to API), **3-4** (server subtotal) are **sequential enablers**; this story (E3-S5) is the **Stripe** binding after pricing is server-truth.

### Git intelligence (recent commits)

- Recent (examples): Vitest + Supabase catalog work on the storefront; **server** `api/_lib/catalog.ts` still loads **`data/products.json`** — keep **one** pricing path for API until a story moves server catalog to Supabase. Payment handler remains a thin **Stripe** wrapper without zod until **3-3/3-5** adds validation.

### Latest technical information

- **Stripe (2025–2026):** `PaymentIntent` with `automatic_payment_methods` and **Checkout Session** with `line_items` + `mode: 'payment'` remain supported in **`stripe@17`**. Webhook event shapes differ (`payment_intent.succeeded` vs `checkout.session.completed`); **Epic 4** will subscribe accordingly — this story only needs to **set metadata** and IDs consistently.  
- **Idempotency:** Pass `idempotencyKey` on `paymentIntents.create` / `checkout.sessions.create` (Stripe best practice for POST retries).

### Project context reference

- No `project-context.md` found in repo; rely on this file, [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md), and [architecture.md](../planning-artifacts/architecture.md).

### References

- [PRD — Epic 3, E3-S3–E3-S5](../planning-artifacts/zephyr-lux-commerce-prd.md)  
- [epics.md — §9.4 Checkout, §9.5 Payments](../planning-artifacts/epics.md)  
- [3-1-cart-sku-variant-identity.md](3-1-cart-sku-variant-identity.md)  
- [3-6-checkout-confirmation-cancel-failure-ui.md](3-6-checkout-confirmation-cancel-failure-ui.md) (redirect URL contract; confirmation UI)  
- [sprint-status.yaml](sprint-status.yaml)

## Story completion status

- **Status:** `done`  
- **Note:** E3-S5 + code-review follow-up (2026-04-26): items-only PI, debounced email bootstrap, handler test with mocked Stripe, merge duplicate SKUs in quote, bounded errors. `npm run build` + `npm run smoke` pass.

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### URL contract (3-6)

Payment Element: `return_url: ${window.location.origin}/order-confirmation`. Stripe may append `?payment_intent=…&payment_intent_client_secret=…&redirect_status=…` on return.

### Epic 4 metadata / correlation

PaymentIntent `metadata` keys: `checkoutRef` (idempotency anchor), `line_digest` (32-char SHA-256 prefix of stable line key), `email`, `legacy` (amount-only path), `stripe_intent_purpose: checkout_v1`. The PaymentIntent `id` is the primary join for webhooks; map `orders.stripe_payment_intent_id` in Epic 4.

### Debug Log References

### Completion Notes List

- Q1: **PaymentIntent + embedded Element**; architecture §18 updated; obsolete `api/create-payment-intent.js` removed.
- Checkout: sequential **cart-quote** then **create-payment-intent**; order summary and PI amount both from `quoteCartLines` / `totalChargeCentsFromCatalogLines`.
- Response: `{ clientSecret, checkoutRef }` (replaces fake `ZLX-…` `orderId` in API response).

### File List

- `api/create-payment-intent.ts`
- `api/_lib/checkoutQuote.ts`
- `api/cart-quote.ts` (read-only `quoteCartLines` for storefront)
- `api/create-payment-intent.test.ts`  
- `api/create-payment-intent.handler.test.ts` (mocked `stripe.paymentIntents.create`)
- `api/_lib/checkoutQuote.test.ts`
- `src/components/Cart/CheckoutPage.tsx`
- `src/hooks/useCartQuote.ts`
- `src/lib/cartQuoteTypes.ts`
- `_bmad-output/planning-artifacts/architecture.md`
- Deleted: `api/create-payment-intent.js`

## Change Log

- 2026-04-26: E3-S5 — server-only PI amount + `checkoutRef` metadata, cart quote–driven checkout UI, Q1 decision in architecture, Vitest coverage for quote/PI alignment.

## Questions (non-blocking)

- If **3-4** shipping/tax is **flat constants**, should they live in **`src/lib/pricing.ts`** and be **imported** by `api` via a small duplicated constant file, or is a **single** `api/_lib/pricing.ts` + **GET /api/quote** preferred for DRY?  
- For **Checkout Session**, should shipping/tax be **line items** vs **one** aggregated `amount` on the Session (MVP may allow single total with description)?
