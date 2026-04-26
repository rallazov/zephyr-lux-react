# Story 3.6: Checkout confirmation, cancel, and payment-failure UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want **clear, trustworthy outcomes when payment succeeds, when I cancel, or when my card fails** — including when I open the confirmation URL directly,
so that **FR-CHK-004**, **PRD §14 — Epic 3 / E3-S6**, **FR-ORD-003** (honest confirmation content), **FR-PAY-002** (webhook is source of paid truth — copy must not over-claim), and **UX-DR9** (checkout payment failure, checkout cancellation, order-confirmation cold load) are satisfied without stranding or confusing the user.

## PRD / epic anchor

**E3-S6 (PRD §14):** Confirmation/cancel/failure UI paths.

**Epic 3 acceptance (PRD):** Customer can add variant, checkout, pay in Stripe test mode, and land on order confirmation; client cannot change price.

## Acceptance Criteria

1. **Given** a **successful** payment flow (**[3-5](sprint-status.yaml)** / existing Payment Element or future Checkout Session), **when** the customer lands on **`/order-confirmation`**, **then** they see a **designed** confirmation view (not a bare heading only): at minimum **reference** to the payment (e.g. Stripe **PaymentIntent** id or **Checkout Session** id / `payment_intent` from return URL — whatever **[3-5](sprint-status.yaml)** standardizes), **email** hint (from checkout form state or server metadata when available), **line summary or total** when passed via **router state** or **recoverable** from query params, and **next steps** in plain language (e.g. confirmation email, support). **If [Epic 4](sprint-status.yaml) order numbers are not available yet**, **do not** show a fake **`ZLX-…`** order number; use copy that matches **FR-PAY-002** (payment recorded when webhook processes — “You’ll receive a confirmation email” / “Payment reference: …”). **UI label:** do not call a PaymentIntent id an “order number” — use “Payment reference” or equivalent.

2. **Given** [FR-CHK-004](../planning-artifacts/zephyr-lux-commerce-prd.md) (*cancellation: return to cart without losing items*), **when** the user **cancels** at Stripe (Checkout Session **cancel_url**) **or** abandons via an explicit in-app “Back to cart” / cancel affordance, **then** the **cart is not cleared** and they arrive at a **routed** destination (e.g. **`/cart`** or **`/checkout`** with a **visible, non-color-only** banner: “Checkout canceled — your bag is saved.”). **Coordinate** **`cancel_url`** and any **query flags** with story **[3-5](sprint-status.yaml)** when it is implemented (add shared URL contract to both story files’ Dev Notes). **Do not** call `clearCart` on cancel. **Note:** `clearCart` **after confirmed success** is expected; this AC targets **cancel** and **failed** payment only.

3. **Given** [FR-CHK-004](../planning-artifacts/zephyr-lux-commerce-prd.md) (*failure: recoverable error*) and **UX-DR9** (*checkout payment failure*), **when** `stripe.confirmPayment` (or session-complete failure path) returns an **error** or a **non-succeeded** intent, **then** the customer stays on **`/checkout`**, sees **actionable** error text (Stripe `message` or safe generic), and the **cart remains** (no `clearCart`). Inline errors use **`role="alert"`** and remain keyboard-accessible. **No** silent failure.

4. **Given** **UX-DR9** (*order-confirmation fallback when fetched directly*), **when** the user opens **`/order-confirmation`** with **no** `location.state` **and** no **usable** payment reference in the **URL** (Stripe may append `payment_intent`, `redirect_status` — see [Stripe: Accept a payment — Handle redirect](https://docs.stripe.com/payments/accept-a-payment?platform=web#handle-redirect)), **then** the page shows a **dedicated** fallback state: e.g. “We couldn’t load your order details on this page” + **links** to **`/cart`**, **contact/support** route or mailto, and “**Check your email**” if they completed payment. **Do not** show an **empty** success shell.

5. **Given** a **return from Stripe** `return_url` / `success_url` where the app loads `/order-confirmation?payment_intent=…&…`, **when** the SPA hydrates, **then** the confirmation page **attempts** to derive display fields from **query** (and/or client Stripe.js retrieve where appropriate — **only** if in scope of **[3-5](sprint-status.yaml)**; if **[3-5](sprint-status.yaml)** defers full retrieve, at minimum show **“Payment in progress / reference: …”** from params and honest copy). **Document** the chosen approach in the Dev Agent Record so **3-5** and **3-6** stay aligned.

6. **Given** [NFR-A11Y-002](../planning-artifacts/epics.md) / **UX-DR13**, **when** validation or system messages appear on checkout/confirmation, **then** they are **visible text** with appropriate **live regions** (`role="status"` or `role="alert"` as appropriate — align with patterns in **[2-3](2-3-product-detail-by-slug-canonical.md)** for loading vs error).

7. **Given** [1-5](1-5-smoke-test-or-script-clean-build-routes.md), **when** the story ships, **then** `npm run build` and **`npm run smoke`** pass. Update [`routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) if headings/copy change. Add **Vitest** for **pure** helpers (e.g. parsing `redirect_status` / building confirmation view-model from `URLSearchParams`) **without** live Stripe.

## Current codebase snapshot (pre-implementation)

Use this to avoid re-deriving behavior from memory.

| Area | Finding |
|------|--------|
| [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) | `InnerCheckoutForm` uses `return_url: ${origin}/order-confirmation` and `handlePaymentResult` calls **`clearCart()`** then **`navigate(..., { state: { orderId, total, items } })`**. On **error**, `setPaymentError` only — **no** `clearCart` (good for AC3). |
| Same | Success path **clears cart** (lines ~37–44 inner form, ~241–252 outer mock path). **Do not** “fix” that as a cancel bug — it is post-success. |
| Same | Payment error in `InnerCheckoutForm` is a `<p className="text-red-500">` **without** `role="alert"` (line ~83) — add for AC3/6. |
| [`OrderConfirmation.tsx`](../../src/components/OrderConfirmation/OrderConfirmation.tsx) | Reads **only** `location.state` — **no** `useSearchParams` for Stripe `payment_intent` / `redirect_status`. Renders “Order ID” for `orderId` (rename per AC1). **No** cold-load / empty-state branch — gap for AC4–5. |
| [`OrderConfirmation.js`](../../src/components/OrderConfirmation/OrderConfirmation.js) | Transpiled artifact mirroring TSX. Align with [architecture.md](../planning-artifacts/architecture.md) / project rule: **TypeScript source canonical**; remove or stop importing `.js` if anything still does. `App` imports **`.tsx`**. |
| [`App.tsx`](../../src/components/App/App.tsx) | Route `/order-confirmation` wraps `OrderConfirmation` in `storefront` layout. |

## Tasks / Subtasks

- [x] **Task 1 — Order confirmation: happy path + cold load (AC: 1, 4, 5, 6, 7)**  
  - [x] Refactor [`OrderConfirmation.tsx`](../../src/components/OrderConfirmation/OrderConfirmation.tsx) (and align/remove stale [`OrderConfirmation.js`](../../src/components/OrderConfirmation/OrderConfirmation.js) per brownfield **single-source** rules).  
  - [x] Branches: **full state** (from `navigate` state), **query-param return** (Stripe), **empty** (fallback per AC4).  
  - [x] Copy that respects **FR-PAY-002** until Epic 4 provides real `order_number`.

- [x] **Task 2 — Cancel and failure paths (AC: 2, 3, 6)**  
  - [x] Ensure [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) **never** clears cart on error/cancel; add **cancel** navigation + messaging as needed.  
  - [x] If **[3-5](sprint-status.yaml)** adds Checkout Session, wire **`cancel_url`** to a route (e.g. `/cart?checkout=canceled`); read **`useSearchParams`** and show **banner** on **`CartPage`** or **`CheckoutPage`**.

- [x] **Task 3 — Tests + smoke (AC: 7)**  
  - [x] Unit tests for URL/state branching.  
  - [x] **Smoke** regex updates if “Order Confirmed” copy changes.

- [x] **Task 4 — Cross-story handoff to 3-5 (AC: 2, 5)**  
  - [x] Leave a short **“3-5 contract”** subsection in Dev Agent Record: required URL shapes for `success_url` / `cancel_url` / `return_url` so server and client match.

## Dev Notes

### Dev Agent Guardrails

- **Depends on:** **[3-5](sprint-status.yaml)** (Stripe session or PaymentIntent behavior defines redirects and query params). Implement **UI** in **3-6**; **URL contracts** are **joint** with **3-5** — if **3-5** is not done, implement **3-6** against **current** Payment Element + `return_url` and **extend** when **3-5** lands.  
- **Prerequisite product behavior:** **[3-2](3-2-cart-validate-stock-variants.md)** invalid-cart guard on checkout — do **not** break it when adding cancel banners.  
- **Not in scope:** Supabase order fetch on confirmation (**[Epic 4](sprint-status.yaml)**), Resend email content, or admin order UI.

### 3-5 URL contract (fill at implementation time)

| Contract piece | Suggested / placeholder | Owner |
|----------------|------------------------|--------|
| `return_url` / `success_url` | `https://<origin>/order-confirmation?payment_intent={CHECKOUT_SESSION_ID}` or app-specific; **match** [Stripe redirect docs](https://docs.stripe.com/payments/accept-a-payment?platform=web#handle-redirect) for Payment Element | **3-5** sets URL; **3-6** renders |
| `cancel_url` | e.g. `/cart?checkout=canceled` or `/checkout?canceled=1` | **3-5**; **3-6** reads query + UI |
| **Never** in customer copy | Expose **checkoutRef** / PI id as **“payment reference”**, not `ZLX-…` order number | **3-6** |

### Technical requirements

- **FR-CHK-004, FR-ORD-003, FR-PAY-002** (wording: UI must not assert “order paid in database” before Epic 4).  
- **UX-DR1** route **`/order-confirmation`** must remain a real page.

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): high-correctness payment spine is **webhook**; customer-facing copy should **not** contradict that.  
- **PCI-light:** no secret keys in client; confirmation page only uses **public** IDs or session params as already exposed by Stripe redirects. **Do not** log `client_secret` (sometimes present in query for redirect flows) to console or analytics.

### Library / framework requirements

- **React 18.3**, **react-router-dom 6.28** — `useLocation`, `useSearchParams`, `useNavigate` ([package.json](../../package.json)).  
- **@stripe/stripe-js** / **@stripe/react-stripe-js** — only if retrieving PaymentIntent on confirmation is in scope; otherwise **param-only** display is enough for MVP.

### File structure requirements

| Area | Action |
|------|--------|
| [`src/components/OrderConfirmation/OrderConfirmation.tsx`](../../src/components/OrderConfirmation/OrderConfirmation.tsx) | **UPDATE** — states: success, partial (params only), empty fallback |
| [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) | **UPDATE** — error/cancel never clear cart; `role="alert"` on payment errors; optional cancel handoff |
| [`src/components/Cart/CartPage.tsx`](../../src/components/Cart/CartPage.tsx) | **MAY UPDATE** — canceled banner when `?checkout=canceled` |
| [`src/components/App/App.tsx`](../../src/components/App/App.tsx) | **REVIEW** — routes only if new query-driven layout needed |
| `src/**` colocated or `src/order-confirmation/*.test.ts` | **ADD** — pure URL/state view-model tests |

### Testing requirements

- `npm run build` + `npm run smoke`.  
- **Vitest** for pure functions; **no** real Stripe network calls in unit tests.

### Previous story intelligence

- **[3-2](3-2-cart-validate-stock-variants.md):** checkout **must not** initialize payment for **invalid** cart — keep **3-6** cancel/failure behavior consistent with that guard.  
- **[3-1](3-1-cart-sku-variant-identity.md):** `toCheckoutLines` / line shape — confirmation line items may mirror **navigate state**; keep types aligned with **`CartItem`** / domain cart types when displaying items.  
- **[3-5](3-5-stripe-checkout-or-payment-intent.md):** owns **server** session `success_url` / `cancel_url` / `client_reference_id` or PaymentIntent return URL. **3-6** owns **what those URLs render** and must not turn a checkout correlation id into a customer-facing order number before Epic 4 persists one.

### Git intelligence summary

- Recent work focused on **catalog adapter**, **Vitest**, and **env docs**; touch checkout/confirmation in a way that **matches existing Tailwind** and **App** layout patterns (see **`storefront-layout`** in smoke tests).

### Latest tech information

- **Stripe redirect returns:** Browsers may land on `/order-confirmation` with `payment_intent` and `payment_intent_client_secret` in query (and `redirect_status`). Prefer **documented** behavior for your Stripe API version; **never** log **client_secret** to analytics or console.  
- **react-router 6** preserves **`location.state`** only for in-app **navigation**; **full-page return** from Stripe **will not** have state — **AC4–5** are essential.

### Project context reference

- No `project-context.md` matched the create-story glob; use this file, [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.4, and [ux-design-specification.md](../planning-artifacts/ux-design-specification.md) (recovery: declined card, cancel, stale line).

### References

- [PRD — FR-CHK-004, Epic 3 E3-S6](../planning-artifacts/zephyr-lux-commerce-prd.md)  
- [epics.md — §9.4 Checkout, UX-DR9](../planning-artifacts/epics.md)  
- [ux-design-specification.md — recovery / failure visibility](../planning-artifacts/ux-design-specification.md)  
- [Stripe: Payment Element redirect handling](https://docs.stripe.com/payments/accept-a-payment?platform=web#handle-redirect) (query params)  
- [sprint-status.yaml](sprint-status.yaml)

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude) — bmad-dev-story 3-6

### Debug Log References

— 

### Implementation — 3-5 URL contract (for story 3-5)

| Route / param | Contract implemented in 3-6 |
|---------------|-----------------------------|
| `return_url` (Payment Element) | `${origin}/order-confirmation` (existing). Stripe appends `payment_intent`, `redirect_status` (and may append `client_secret` — do not log). **3-5** may extend query or switch to Checkout Session `success_url`. |
| `cancel_url` (future Checkout Session) | **`/cart?checkout=canceled`** (documented for 3-5). **3-6** shows banners on `CartPage` and `CheckoutPage` when this query is present. |
| In-app state after success | `navigate(..., { state: { orderId, total, items, email? }})` — display uses **Payment reference** label, not order number. |

### Completion Notes List

- Added `src/order-confirmation/confirmationViewModel.ts` and Vitest for full / `queryPartial` / `fallback` resolution from router state and Stripe query params.
- Rebuilt `OrderConfirmation` with three branches; removed generated `OrderConfirmation.js`.
- Checkout: `role="alert"` on payment errors; non-`succeeded` PaymentIntent does not clear cart; email passed in `location.state` when `formData.email` is set; cancel banner and “Back to bag” link; bootstrap `paymentError` shown with `role="alert"` when client secret cannot be created.
- Cart: banner when `?checkout=canceled`.
- Smoke test matcher updated for bare `/order-confirmation` (fallback copy).

### File List

- `src/order-confirmation/confirmationViewModel.ts` (new)
- `src/order-confirmation/confirmationViewModel.test.ts` (new)
- `src/components/OrderConfirmation/OrderConfirmation.tsx` (updated)
- `src/components/OrderConfirmation/OrderConfirmation.js` (deleted)
- `src/components/Cart/CheckoutPage.tsx` (updated)
- `src/components/Cart/CartPage.tsx` (updated)
- `src/routes.smoke.test.tsx` (updated)
- `_bmad-output/implementation-artifacts/3-6-checkout-confirmation-cancel-failure-ui.md` (this file — status/tasks)

## Change Log

- 2026-04-26: Implemented 3-6 confirmation, cancel, and payment-failure UI; `npm run build` and `npm run smoke` pass.
- 2026-04-26: Code review patches — `queryPartialHeading`, per-line `parseItemLine` / `formatLineSubtotalDollars`, `redirect_status=failed` copy; Vitest updated.

## Story completion status

- **Status:** `done`  
- **Note:** Code review complete; review patches applied.

### Review Findings

- [x] [Review][Patch] **`queryPartial` heading vs `redirect_status`** — **Applied:** `queryPartialHeading()`; H1 now follows `redirect_status` (e.g. “Payment authorized” for `succeeded`, “We’re processing your payment” for `processing`).

- [x] [Review][Patch] **Defensive display for line `price` / `quantity` from router state** — **Applied:** `parseItemLine` filters bad rows; `formatLineSubtotalDollars` for display.

- [x] [Review][Patch] **Explicit `redirect_status=failed` messaging (optional)** — **Applied:** `queryPartialHeading` + `queryPartialSubtitle` branches for `failed`.

- [x] [Review][Defer] **Server `cancel_url` / hosted Checkout** — [deferred, pre-existing] No `cancel_url` appears in the server Stripe integration in this repo; the story and Dev Agent Record assign that contract to 3-5, while 3-6 implements the client for `/cart?checkout=canceled` and `/checkout?checkout=canceled`. Track under 3-5 until hosted cancel lands.

- [x] [Review][Defer] **Smoke: long timeout on `/checkout`** — [deferred, pre-existing] `waitOpts` of `15_000` ms for the checkout route may increase flake risk in slow CI; acceptable follow-up for test harness tuning. [routes.smoke.test.tsx]
