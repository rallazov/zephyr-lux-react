# Story 3.2: Cart validates stock and active variants before checkout

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want **my cart to stay aligned with the live catalog** (stock, active variants, and stale lines),
so that **I see accurate pricing and availability, cannot exceed on-hand quantity, and cannot proceed to checkout while any line is invalid** — satisfying **PRD §14 — Epic 3 / E3-S2**, **FR-CART-002**, **FR-CART-003**, **FR-CART-004**, **FR-CHK-001**, **UX-DR7** (cart composition), and **UX-DR9** (invalid cart at checkout entry).

## Acceptance Criteria

1. **Given** a non-empty cart and the **canonical catalog** from [`getDefaultCatalogAdapter()`](../../src/catalog/factory.ts) (static or Supabase per `VITE_CATALOG_BACKEND`), **when** the customer views **`/cart`**, **then** each line is **reconciled** against the catalog: the implementation resolves the line using **`(storefrontProductId, sku)`** via [`sameCartLine` / `normalizeLineSku`](../../src/cart/lineKey.ts) (see **[2-4](2-4-variant-selector-size-color-price-stock.md)**). **Unknown product** (no matching active list row), **unknown SKU** for that product, **legacy line without `sku`** where resolution is ambiguous, **inactive/discontinued** variant, or **out-of-stock** variant (`inventory_quantity === 0`) must be surfaced as a **line-level problem** with **plain language** (not color-only). **Reuse** [`isPurchasable`](../../src/components/ProductDetail/variantSelection.ts) for “may purchase” semantics so PDP, list rules, and cart **do not diverge**.

2. **Given** [FR-CART-002](../planning-artifacts/zephyr-lux-commerce-prd.md) (*quantity cannot exceed available stock*), **when** a line’s `quantity` is **greater than** the variant’s current `inventory_quantity` **and** the variant is otherwise valid, **then** the UI **prevents checkout** for that cart state and the customer can **correct quantity** (steppers capped or validation error on increment) **or remove** the line. Pick one consistent approach (prefer **cap + message** or **block increment** with message) and **document** it in the Dev Agent Record.

3. **Given** [FR-CART-004](../planning-artifacts/zephyr-lux-commerce-prd.md) (*subtotal from current catalog*), **when** reconciliation runs, **then** **displayed unit price and line subtotals** on **`/cart`** reflect **current** `price_cents` from the matched variant (convert to display currency consistently with today’s `$` formatting — **do not** invent multi-currency UX unless data already supports it). If price changed, the customer sees **current** price after refresh/reconcile (optional short non-blocking notice is acceptable). **Coordination:** this is the client/catalog validation view for **3-2**; once **[3-4](3-4-server-subtotal-from-catalog.md)** lands, server quote values supersede client-derived money display while this story's validity flags still block checkout.

4. **Given** [FR-CART-003](../planning-artifacts/zephyr-lux-commerce-prd.md) (*invalid/stale items reconciled*), **when** the app loads or the cart page gains focus (minimum: **mount** of cart + **when `cartItems` change** from context), **then** reconciliation runs **without** requiring a full page reload. Persisted cart in [`CartContext`](../../src/context/CartContext.tsx) (`localStorage` key `cartItems`) must **not** silently keep impossible lines: either **auto-remove** clearly dead lines (with a **single** concise toast/banner summary) or **mark lines invalid** and block checkout — **choose one** strategy and test it.

5. **Given** [FR-CHK-001](../planning-artifacts/zephyr-lux-commerce-prd.md) (*invalid cart explains what to fix*) and **UX-DR9**, **when** the customer navigates to **`/checkout`** with an **invalid** cart, **then** they are **redirected back to `/cart`** (or checkout shows a **blocking** summary with link to cart) with **actionable** copy listing **what** failed (OOS, discontinued, missing SKU, quantity too high, unknown product). **Checkout must not** create/refresh a **PaymentIntent** while the cart is invalid (guard the existing [`CheckoutPage`](../../src/components/Cart/CheckoutPage.tsx) `useEffect` that posts to `/api/create-payment-intent`).

6. **Given** [NFR-A11Y-002](../planning-artifacts/epics.md) / **UX-DR13**, **when** validation messages appear, **then** they are **visible text** associated with the affected line or a page-level **alert** region (not icon-only). Quantity controls remain **labeled** and keyboard operable.

7. **Given** [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md), **when** the story ships, **then** `npm run build` and **`npm run smoke`** pass. Add **Vitest** coverage for **pure** reconciliation helpers (fixture catalog + cart lines → expected flags/caps) **without** live Supabase; **do not** break [`readCatalogEnv`](../../src/catalog/adapter.ts) / static-forcing rules used in tests.

## Tasks / Subtasks

- [x] **Task 1 — Catalog index + pure validation helpers (AC: 1, 2, 3, 7)**  
  - [x] Build a small module (e.g. under `src/cart/`) that, given `CatalogListItem[]` from `adapter.listProducts()`, indexes **storefrontProductId → product.variants** and resolves **SKU** → `ProductVariant`.  
  - [x] Implement `reconcileCartLines(...)` (or equivalent) returning per-line **status**, **effective price**, **max quantity**, and **messages**; use **`isPurchasable`** for eligibility; apply **quantity cap** rules (AC2).  
  - [x] Unit-test edge cases: unknown id, unknown sku, inactive variant, OOS, quantity over stock, legacy missing sku, price change.

- [x] **Task 2 — Wire Cart UI (AC: 1–4, 6)**  
  - [x] Update [`CartPage.tsx`](../../src/components/Cart/CartPage.tsx) to load catalog (same adapter as rest of storefront), run reconciliation, show **warnings/errors** per line, **disable** “Proceed to Checkout” when **any** line invalid or any **blocking** condition exists.  
  - [x] Optionally sync reconciled **prices** back into context **or** derive display from reconciliation snapshot only — **avoid double sources of truth**; document choice.

- [x] **Task 3 — Checkout guard (AC: 5, 6)**  
  - [x] Update [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx): on mount, if cart invalid per same rules, **redirect** to `/cart` **or** show blocking panel; **skip** payment intent fetch until valid.  
  - [x] Ensure **mock** and **real** Stripe paths both respect the guard.

- [x] **Task 4 — Coordination with Epic 3 sequencing (AC: 4)**  
  - [x] If **[3-1](sprint-status.yaml)** lands first, **reuse** its persistence/reconciliation entry points if present; if **3-2** ships first, keep reconciliation logic **in one module** so **3-1** can call it without duplication.

### Review Findings

- [x] [Review][Patch] Harden mock checkout primary button — add `!checkoutOk` to the mock “Pay Now” `disabled` expression so the control cannot be enabled if validation state regresses. [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) (~line 572)

- [x] [Review][Patch] Cover `variant.status === "inactive"` in `validateStorefrontCartLines` unit tests (discontinued is covered; inactive uses `variant_unavailable` via `variantUnavailableMessage` but should be locked by a test). [`src/cart/reconcile.test.ts`](../../src/cart/reconcile.test.ts)

- [x] [Review][Defer] `storefrontCartLinesEqual` relies on `JSON.stringify` for deep equality; key order and floating formatting could theoretically cause spurious or missed updates — acceptable for now; revisit if flakiness appears. [`src/cart/reconcile.ts`](../../src/cart/reconcile.ts):38

## Dev Notes

### As-built baseline (brownfield)

Use this as the **pre–3-2** behavior contract; adjust if **[3-1](3-1-cart-sku-variant-identity.md)** lands first and already moves persistence or reconciliation.

- **`CartContext`** ([`src/context/CartContext.tsx`](../../src/context/CartContext.tsx)): Writes a **flat** `CartItem[]` JSON array to `localStorage` under **`cartItems`** (no versioned wrapper in repo today — 3-1 may add one). `CartItem`: `id` (**numeric storefront product id**, same role as `storefrontProductId` on catalog rows), `name`, `quantity`, `price` (**dollars** in UI), `image`, optional `sku`. **`addToCart`** always increments quantity — **no** stock cap. **`removeFromCart(id, sku?)`** decrements the matched line via [`sameCartLine`](../../src/cart/lineKey.ts).

- **`CartPage`** ([`src/components/Cart/CartPage.tsx`](../../src/components/Cart/CartPage.tsx)): Subtotal and line totals use **persisted** `item.price` only — **no** live catalog reconciliation. Quantity **+** calls `addToCart(item)` with **no** max. List row key: ``${item.id}::${normalizeLineSku(item.sku)}``. “Proceed to Checkout” uses `navigate("/checkout", { state: … })`, but **`CheckoutPage` reads `cartItems` from context**, not route state — keep that pattern or clean it up without breaking navigation.

- **`CheckoutPage`** ([`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx)): When **`!IS_MOCK_PAYMENT`**, a **`useEffect` keyed on `[total]`** posts **`{ amount, currency }`** to `/api/create-payment-intent` — **no** guard for empty cart, invalid lines, or reconciliation (AC5). **`loadStripe`** is created when `VITE_STRIPE_PUBLIC_KEY` is set. Mock mode skips PaymentIntent but still renders checkout for whatever is in context — **invalid-cart behavior must apply to both paths**.

- **`isPurchasable`** ([`src/components/ProductDetail/variantSelection.ts`](../../src/components/ProductDetail/variantSelection.ts)): **`active` status and `inventory_quantity > 0`**. OOS lines are **not** purchasable; **quantity-over-stock** is a **separate** concern (line can be purchasable at qty 1 but invalid at cart qty 10) — implement caps/messages per AC2 without redefining `isPurchasable`.

### Dev Agent Guardrails

- **Depends on:** canonical catalog + **[2-4](2-4-variant-selector-size-color-price-stock.md)** line identity `(storefrontProductId, sku)`; **[2-5](2-5-supabase-tables-catalog-inventory.md)** / **[2-6](2-6-admin-create-edit-product-variants.md)** for live Supabase data when enabled.  
- **Not in scope:** server-authoritative checkout line items (**[3-3](sprint-status.yaml)**+), Stripe session totals (**3-4** / **3-5**), or full **`cartItemSchema`** migration in [`src/domain/commerce/cart.ts`](../../src/domain/commerce/cart.ts) — align **behavior** with that schema for future stories but **do not** block on renaming `CartContext` types unless **3-1** already did.  
- **No client-submitted payment amounts** beyond today’s pattern — this story **does not** fix [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts); it only **prevents** obviously invalid carts from reaching payment setup.

### Technical requirements

- **FR-CART-002, FR-CART-003, FR-CART-004, FR-CHK-001** as quoted in ACs.  
- **Single purchasability definition:** [`isPurchasable`](../../src/components/ProductDetail/variantSelection.ts) (same as PDP).  
- **Active products only:** [`parseStaticCatalogData`](../../src/catalog/parse.ts) omits non-`active` products — cart lines pointing at removed/deactivated products should become **invalid** after reconcile.

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): catalog via **adapter seam**; **no** service role in browser; validation is **client truth for UX** — server hardening remains **Epic 3/4**.  
- Prefer **pure functions** + thin React wiring for testability (**NFR-MAINT-003**).

### Library / framework requirements

- **React 18.3**, **react-router-dom 6.28**, **TypeScript** (see [package.json](../../package.json)).  
- **Zod 4.x** already in project — optional for boundary parsing; **do not** upgrade major deps in this story.  
- **Vitest 2** + **@testing-library/react 16** for tests.

### File structure requirements

| Area | Action |
|------|--------|
| `src/cart/*.ts` | **ADD** — reconciliation + types (keep [`lineKey.ts`](../../src/cart/lineKey.ts) as single identity helper) |
| [`CartContext.tsx`](../../src/context/CartContext.tsx) | **MAY UPDATE** — optional `setCartItems`/`updateLine` if syncing prices/qty caps; avoid breaking existing consumers |
| [`CartPage.tsx`](../../src/components/Cart/CartPage.tsx) | **UPDATE** — reconcile, warnings, checkout CTA state |
| [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) | **UPDATE** — invalid-cart guard, payment init gating |
| `src/cart/*.test.ts` | **ADD** — pure reconciliation tests |

### Testing requirements

- `npm run build` + `npm run smoke`.  
- Deterministic unit tests **without** network; respect existing catalog test env patterns.

### Previous story intelligence (3-1 + latest Epic 2)

- **[3-1](3-1-cart-sku-variant-identity.md):** owns versioned persistence, reconciliation entry points, and `toCheckoutLines`; reuse its helpers if it lands first, and keep reconciliation behavior in one module if this story lands first.
- **[2-4](2-4-variant-selector-size-color-price-stock.md):** merge key and legacy `sku` normalization rules; PDP uses **`getPurchasableVariants` / `isPurchasable`**.  
- **[2-6](2-6-admin-create-edit-product-variants.md):** admin can flip **variant status** and **inventory** — cart **must** react after reconcile, not assume add-time state forever.  
- **[sprint-status.yaml](sprint-status.yaml)** note on **3-1:** identity/persistence split; **3-2** should **not** redefine line keys.

### Git intelligence summary

- Recent work tightened **catalog adapter**, **Vitest**, and **Supabase** paths (`feat: integrate Vitest…`, `feat: implement catalog adapter…`). Expect **`listProducts`** + **`getProductBySlug`** as the public read API; **no** `getByStorefrontId` — build index client-side.

### Latest tech information

- **Stripe React `@stripe/react-stripe-js` ^3** / **Stripe.js ^5** — checkout gating should occur **before** `loadStripe` / `Elements` setup where practical to avoid useless API calls.

### Project context reference

- No `project-context.md` matched the workflow glob in this repo; treat **[epics.md](../planning-artifacts/epics.md)** requirements inventory + **[zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md)** §9.3–9.4 and **§14 Epic 3 / E3-S2** as canonical.

### References (planning)

- [PRD §14 — Epic 3, E3-S2](../planning-artifacts/zephyr-lux-commerce-prd.md)  
- [PRD §9.3 Cart / §9.4 Checkout](../planning-artifacts/zephyr-lux-commerce-prd.md)

## Story completion status

- **Status:** `done`  
- **Note:** Implementation complete; code review patch items applied; `npm run build` and `npm run smoke` pass.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Removed stale `api/_lib/catalog.js` that shadowed `catalog.ts` and broke `quoteForPaymentItems` resolution under Vitest.

### Completion Notes List

- **`validateStorefrontCartLines`** + **`isCartOkForCheckout`** in [`src/cart/reconcile.ts`](../../src/cart/reconcile.ts): line-level issues (unknown product, missing/ambiguous variant, unknown SKU, discontinued/inactive, OOS via `isPurchasable`, quantity over stock); exposes `displayUnitPrice` and `maxQuantity`.
- **`syncCartLinesFromCatalog`** / **`reconcileCartLines`**: updates price, `sku` (single-variant fill), `variant_id`, slug, image from catalog **without dropping** invalid lines (mark-invalid strategy for AC4).
- **`CartContext`**: `hydrateCartFromCatalog`; initial + CartPage-driven sync; price-change notice; `storefrontCartLinesEqual` avoids pointless writes.
- **`CartPage`**: loads catalog on mount and when `cartItems` change; subtotals from validation snapshot; **block increment** at max stock or when line has issues + “Maximum N available” copy (AC2).
- **`CheckoutPage`**: blocking panel with actionable list + link to bag when invalid; empty cart → `/cart`; **`loadStripe` only when `checkoutOk`**; PaymentIntent fetch gated on `checkoutOk` and non-empty `checkoutLines` (integrates with existing line-item PI body).
- **Tests:** expanded [`src/cart/reconcile.test.ts`](../../src/cart/reconcile.test.ts); smoke seeds valid cart for `/checkout`; PDP variant test clears `localStorage` before each run for isolation.

### File List

- `src/cart/reconcile.ts`
- `src/cart/reconcile.test.ts`
- `src/context/CartContext.tsx`
- `src/components/Cart/CartPage.tsx`
- `src/components/Cart/CheckoutPage.tsx`
- `src/routes.smoke.test.tsx`
- `src/components/ProductDetail/ProductDetail.variants.test.tsx`
- `api/_lib/catalog.js` (deleted)

## Change Log

- 2026-04-26: Story 3-2 — cart validation, checkout guard, reconcile tests; test/smoke fixes; remove stale `catalog.js`.
