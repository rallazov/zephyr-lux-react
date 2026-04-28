# Story 6.6: Basic privacy-aware analytics events

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[6-1](6-1-real-homepage-category-routes.md)** — `page_view` should include **normalized path** (no query **PII**).  
- **[6-3](6-3-product-page-gallery-variant-ux.md)** (soft) — `product_view` should fire when PDP meaningfully loads **slug** (once per navigation, not every gallery swipe).  
- **Epic 3** — `add_to_cart`, `begin_checkout` hooks in [`CartContext`](../../src/context/CartContext.tsx) / [`CartPage`](../../src/components/Cart/CartPage.tsx) / [`CheckoutPage`](../../src/components/Cart/CheckoutPage.tsx).  
- **Epic 4** — `purchase` ideally ties to **order confirmation** with **`order_number`** **only if** non-sensitive and already public on page ([`OrderConfirmation`](../../src/components/OrderConfirmation/OrderConfirmation.tsx)); **never** send **email**, **full address**, **payment ref** to analytics.

## Story

As a **store owner**,
I want **basic storefront funnel analytics (page view, product view, add to cart, checkout start, purchase)**,
so that **FR-AN-002** and PRD **§14 E6-S6** are satisfied with **privacy-aware**, **non-blocking** instrumentation.

## Acceptance Criteria

1. **Event catalog (FR-AN-002)**  
   Implement the following **named** events (string constants in one module):  
   - **`page_view`**: `{ path }` (pathname **only**, strip `search` **unless** explicitly allowlisted).  
   - **`product_view`**: `{ slug, product_id? }` — **no** customer id.  
   - **`add_to_cart`**: `{ sku, product_slug }` — quantity optional.  
   - **`checkout_start`**: `{ line_item_count }` **or** `{ sku_count }` — **no** prices **required** (optional **`cart_subtotal_cents`** **only if** product approves — default **omit**). **Normative trigger:** fire **once per checkout attempt** when **`CheckoutPage`** **mounts** **after** navigation from **`CartPage`** (**cart non-empty**) **or** when checkout is entered with **`line_item_count > 0`** — use **`sessionStorage`** key **`analytics_checkout_session_id`** **or** **`sessionStorage`** flag **`analytics_checkout_start_fired`** scoped to **`location.key`** **or** equivalent **so** React Strict Mode **does not** double-fire **and** browser **Back** → **Checkout** **again** **may** fire a **second** **`checkout_start`** (acceptable funnel noise — document). **Do not** fire on **`checkout_start`** when **`line_item_count === 0`** (empty-cart guard).
   - **`purchase`**: `{ order_number }` **only if** **`order_number`** is **already shown** on [`OrderConfirmation`](../../src/components/OrderConfirmation/OrderConfirmation.tsx) **and** non-sensitive; **omit** **`purchase`** entirely if confirmation is ambiguous — **never** send **`payment_intent`**, **`paymentIntentId`**, **Stripe** identifiers, **email**, **shipping address**, **or** internal UUIDs masquerading as order refs.

2. **Pluggable sink (no PII logging)**  
   **Given** **no** third-party configured **when** prod runs **then** events **no-op** **or** **dev-only `console.debug`** guarded by **`import.meta.env.DEV`** — **must not** spam production console. **Given** **`VITE_ANALYTICS_*`** env vars **when** set **then** forward to **one** concrete provider **adapter** (options: **`window.gtag`** if **GTM** loaded, **`plausible`**, **`@vercel/analytics`** **— pick one** supported path and **document** in **`.env.example`**). **Default implementation**: **internal `dispatchAnalyticsEvent`** with **empty** backend — **prepare** **for** future.

3. **Idempotency / noise control**  
   **Given** **`page_view`** **when** React strict remounts **then** avoid **duplicate** fire for same **pathname** session navigation — use **`location.key`** from **`react-router`** **or** **ref** guard. **Given** **`purchase`** **when** confirmation **re-renders** **then** **fire once** per **`order_number`** — **`sessionStorage`** key e.g. **`analytics_purchase_emitted:${order_number}`** **when** **`sessionStorage`** **is available**; **if** **`sessionStorage`** throws **or** is **unavailable** **then** fall back to a **session-scoped `useRef`** guard (**must still** avoid duplicate **`purchase`** on **StrictMode** double-mount — prefer **ref guard** **before** **`sessionStorage`** write).

4. **Performance**  
   **Given** event dispatch **when** called **then** **non-blocking** (`requestIdleCallback` **or** `setTimeout(0)`) **or** **immediate** if adapter is **< 1ms** — **do not** await network in **checkout** submit path.

5. **Tests**  
   **Given** **`dispatchAnalyticsEvent`** **when** unit tested **then** assert **sink** receives normalized payloads **and** **PII stripper** rejects/o-redacts emails if accidentally passed (defensive programming).

6. **Documentation**  
   **Given** completion **when** merged **then** **`.env.example`** lists analytics vars + **one** paragraph in Dev Agent Record on **GDPR/consent** **— if** only first-party aggregate counts, note **deferred consent banner** if EU traffic expected (**out of scope** unless PM requests).

## Tasks / Subtasks

- [x] **Task 1 — Core module (AC: 1, 2, 4, 5)**  
  - [x] e.g. `src/analytics/events.ts` + `sink.ts` — pure registration API.

- [x] **Task 2 — Wire hooks (AC: 1, 3)**  
  - [x] Router listener for **`page_view`** (**`useLocation`** wrapper in **`Layout`** or **`App`**).  
  - [x] PDP: slug-based **`product_view`** (**route/slug change** only — **not** gallery swipe).  
  - [x] `addToCart` call path.  
  - [x] **`CheckoutPage`** mount **per AC1 `checkout_start` trigger**.  
  - [x] Order confirmation: **`purchase`** **only** when **`order_number`** available **per AC1**.

- [x] **Task 3 — Env + docs (AC: 2, 6)**  
  - [x] `.env.example` keys; **no** secrets.

- [x] **Task 4 — Tests (AC: 5)**  
  - [x] Vitest with mock sink.

## Dev Notes

### Dev Agent Guardrails

- **Do not** send **Stripe** IDs, **payment intent** IDs, **customer email**, or **shipping address** to analytics.  
- **Do not** block **checkout** on analytics failures.  
- **Do not** add **heavy** SDK without **bundle size** check — **vite** bundle report optional.

### Technical requirements

| Source | Requirement |
|--------|-------------|
| PRD §9.12 | FR-AN-002 |
| PRD §14 | E6-S6 |
| NFR | Privacy **P0** — minimize data |

### Architecture compliance

- Analytics is **non-authoritative** — **never** replace server logs (**FR-AN-003**) for payments.

### File structure expectations

| Action | Paths |
|--------|-------|
| **New** | `src/analytics/*.ts` |
| **Update** | [`src/components/App/Layout.tsx`](../../src/components/App/Layout.tsx) **or** [`App.tsx`](../../src/components/App/App.tsx); [`ProductDetail`](../../src/components/ProductDetail/ProductDetail.tsx); [`CartContext`](../../src/context/CartContext.tsx) **or** cart page; [`CheckoutPage`](../../src/components/Cart/CheckoutPage.tsx); [`OrderConfirmation`](../../src/components/OrderConfirmation/OrderConfirmation.tsx); **`.env.example`** |
| **Tests** | `src/analytics/*.test.ts` |

### Previous story intelligence

- **Order confirmation** may **not** always have **`order_number`** on first paint — **read** existing fetch logic before firing **`purchase`**; **subscribe** **or** **`useEffect`** **when** **`order_number`** **hydrates** **without** violating AC3 idempotency.

### Web research note

- For **2026** **GA4** / **Plausible** / **Vercel Analytics**, verify **current** install snippet **at implementation time** — **do not** hardcode outdated **`gtag`** config without checking provider docs.

### Project context reference

- [`project-context.md`](../../project-context.md) if present.

## Dev Agent Record

### Agent Model Used

Cursor / GPT-5.2 (2026-04-27)

### Debug Log References

- `npx tsc -p tsconfig.json --noEmit` — pass after fixing `CartPage.tsx` (stray `</div>`) and adding missing `Product` type import in `supabase-map.ts`.
- `npm run test` — 294 tests passed.
- `npm run lint` — fails on pre-existing issues in `api/_lib/store.ts`, `reconcile.ts`, `SubscriptionForm.tsx`; no new errors in `src/analytics/*`.

### Implementation Plan

- **`events.ts`**: Stable event names + discriminated payload union (`page_view`, `product_view`, `add_to_cart`, `checkout_start`, `purchase`).
- **`pii.ts`**: Email regex + Stripe-like id guard; `deepRedactEmails` for sink output.
- **`sink.ts`**: Allowlisted normalization, `registerAnalyticsSink` for tests, `requestIdleCallback` / `setTimeout(0)` deferral (microtask in Vitest `MODE=test`), production no-op without `VITE_ANALYTICS_*`, dev-only `console.debug` without third-party vars, Plausible (`window.plausible`) vs GA4 (`window.gtag`) forwarding when configured.
- **Wiring**: `Layout` (`page_view` + `sessionStorage` dedupe by `pathname` + `location.key`); `ProductDetail` (`product_view` after catalog row loads; dedupe by slug + `location.key`); `CartContext.addToCart` (`add_to_cart` via `queueMicrotask`); `CheckoutPage` (`checkout_start` with `analytics_checkout_start_fired:${location.key}`); `OrderConfirmation` (`purchase` only when `paidOrder.order_number` hydrated, ref + `analytics_purchase_emitted:${orderNumber}`).

### Completion Notes List

- **GDPR / consent**: Instrumentation sends only allowlisted, non-payment fields (pathname, slug/SKU, line count, public `order_number` when shown on confirmation). No email, address, or Stripe IDs in analytics payloads. A full consent banner / CMP is **out of scope** here; if you expect meaningful EU traffic, plan a consent gate before enabling third-party scripts (`VITE_ANALYTICS_*`) per your legal review.

### File List

- `src/analytics/events.ts`
- `src/analytics/pii.ts`
- `src/analytics/sink.ts`
- `src/analytics/sink.test.ts`
- `src/components/App/Layout.tsx`
- `src/components/ProductDetail/ProductDetail.tsx`
- `src/context/CartContext.tsx`
- `src/components/Cart/CheckoutPage.tsx`
- `src/components/OrderConfirmation/OrderConfirmation.tsx`
- `src/vite-env.d.ts`
- `.env.example`
- `src/components/Cart/CartPage.tsx` (fix stray `</div>` breaking JSX / `tsc`)
- `src/catalog/supabase-map.ts` (add missing `Product` type import)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-27 (post-review): Git-track `src/analytics`; `add_to_cart` sanitization drops payloads where both `sku` and `product_slug` trim empty (+ Vitest case).
- 2026-04-27: Implemented privacy-aware storefront analytics (Story 6-6): core dispatch + Plausible/GA4 hooks, route/cart/checkout/confirmation wiring, Vitest coverage, `.env.example` documentation; repaired `CartPage` JSX and `supabase-map` import for clean `tsc`.

### Review Findings

- [x] [Review][Patch] **`src/analytics` must be tracked in git** — At review time the whole `src/analytics/` tree plus `purchaseDedupe` tests appeared as **untracked** (`??`). Merge/CI would silently drop the implementation unless these paths are staged and committed.

- [x] [Review][Patch] **Drop meaningless `add_to_cart` payloads** [`src/analytics/sink.ts` ~sanitize `add_to_cart`] — After trimming, **both `sku` and `product_slug` can be empty** (e.g. bad cart line metadata) yet the event still forwards. Returning `null` when both are empty matches defensive PII/quality goals and avoids junk funnel rows.

- [x] [Review][Defer] **Storage-disabled duplicate `page_view` / `checkout_start`** [`Layout.tsx`, `CheckoutPage.tsx`] — deferred — When `sessionStorage` throws or is unavailable, dedupe keys fail and React Strict Mode can still duplicate events (comments already note this); follow up with ref-based parity if private-mode fidelity matters.

- [x] [Review][Defer] **Large non-analytics edits in cart/catalog on the same branch** [`CartPage.tsx`, `supabase-map.ts`] — deferred — Substantial diffs unrelated to instrumentation (JSX/`tsc` fixes) inflate review noise; optionally split next time for narrower review scope.

