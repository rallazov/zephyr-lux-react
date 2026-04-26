# Story 3.1: Cart SKU / variant identity, persistence, and reconciliation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want **my cart to remember the exact variants I chose, survive reloads, and stay aligned with the live catalog**,
so that **FR-CART-001, FR-CART-003, FR-CAT-003, PRD §9.3 / §14 Epic 3 / E3-S1** are satisfied and **checkout can later trust SKU-centric line items** (without re-merging different variants into one row).

## Acceptance Criteria

1. **Given** [FR-CART-001](../planning-artifacts/epics.md) and **[2-4](2-4-variant-selector-size-color-price-stock.md)** (client merge key already defined), **when** the app loads or the cart is read from storage, **then** each line has a **stable identity** sufficient for storefront and future server use: at minimum **`sku`** (non-empty for all **new** lines added after this story) and **`storefrontProductId`** (numeric, from [`CatalogListItem.storefrontProductId`](../../src/catalog/types.ts) / detail row). **Where the canonical catalog provides it**, persist **`variant_id`** (UUID string matching [`ProductVariant.id`](../../src/domain/commerce/product.ts) / `product_variants.id`) on the line so **Epic 3 follow-on stories** can key server lookups without ambiguous SKU-only joins. **Legacy** lines with **missing** `sku` continue to normalize to `""` per [`normalizeLineSku`](../../src/cart/lineKey.ts) until reconciled or removed.

2. **Given** [FR-CART-003](../planning-artifacts/epics.md) (persist + reconcile), **when** cart state is saved to **`localStorage`**, **then** the payload is **versioned** (e.g. wrapper `{ v: number, items: [...] }` or equivalent) so a **one-time migration** can reshape legacy **flat arrays** currently stored under the key **`cartItems`** ([`CartContext.tsx`](../../src/context/CartContext.tsx)). **On read**, invalid JSON or unknown version must **not** throw uncaught — fall back to **empty cart** or **best-effort** parse with a **console warning** (no customer-facing crash).

3. **Given** the **canonical catalog** from [`getDefaultCatalogAdapter()`](../../src/catalog/factory.ts) (same source as list/detail), **when** the cart is **hydrated** or **before entering checkout** (explicit hook or `CartProvider` effect — **pick one**, document), **then** **reconcile** each line: resolve **SKU + product** (and **`variant_id`** if stored) against live variant data; **remove** or **mark unavailable** lines where the variant no longer exists, is **not purchasable** (`inactive` / `discontinued` per [`productVariantStatusSchema`](../../src/domain/commerce/enums.ts)), or **SKU is unknown** after migration. **Minimum UX for this story:** removing stale lines **or** showing a **single** clear inline notice that an item was removed (defer full **FR-CART-004** warning UI to **[3-2](sprint-status.yaml)** if needed — but reconciliation **must** run). **Do not** silently keep priced lines for dead SKUs.

4. **Given** [FR-CAT-003](../planning-artifacts/epics.md) / [architecture — no client payment amounts](../planning-artifacts/architecture.md), **when** checkout or payment bootstrap runs, **then** the **in-memory** cart passed through the app exposes a **serializable line list** suitable for a future server body: **`sku`**, **`quantity`**, and optional **`variant_id`**, **`product_slug`** or resolvable product key — **without** requiring the server to trust **client `price`**. **This story does not** replace [`/api/create-payment-intent`](../../api/create-payment-intent.ts) amount logic (**[3-3](sprint-status.yaml), [3-4](sprint-status.yaml)**); it **must** add a **typed helper or selector** (e.g. `toCheckoutLines(cartItems): CheckoutLineDraft[]`) and **use it in one place** (e.g. `CheckoutPage` prep or a small `src/cart/` module) so **3-3** only swaps the API contract.

5. **Given** [`src/domain/commerce/cart.ts`](../../src/domain/commerce/cart.ts) (`cartItemSchema` — SKU-forward) and [`CartContext.tsx`](../../src/context/CartContext.tsx) (**different** `CartItem` shape today), **when** this story is complete, **then** duplication is **reduced**: either **extend** the domain schema/type for **persisted** fields (`variant_id`, `storefront_product_id`, display fields) **or** add a **narrow mapper** `contextLineFromDomain` / `domainLineFromContext` with **one** canonical Zod boundary for **API/export** lines. **Do not** leave two unrelated `CartItem` definitions without **explicit import aliasing** or a **shared base type**.

6. **Given** [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md), **when** the story ships, **then** `npm run build` and **`npm run smoke`** pass. Add **Vitest** coverage for: **`lineKey`** behavior unchanged; **storage migration** (legacy array → versioned); **reconciliation** pure function(s) with **mock catalog rows** (no live Supabase). **Vitest** storefront tests keep **static** catalog per [`readCatalogEnv`](../../src/catalog/adapter.ts).

## Tasks / Subtasks

- [x] **Task 1 — Cart line model + storage (AC: 1, 2, 5)**  
  - [x] Extend context `CartItem` (or rename for clarity) with `variant_id?`, `product_slug?` / resolvable id as needed; ensure **PDP** and **list** `addToCart` populate new fields when data exists.  
  - [x] Implement versioned `localStorage` read/write; migrate legacy `cartItems` JSON array.  
  - [x] Align with `cartItemSchema` / shared types in `src/domain/commerce/cart.ts`.

- [x] **Task 2 — Reconciliation (AC: 3)**  
  - [x] Implement pure `reconcileCartLines(lines, catalog): ReconciledCart` (or equivalent) using adapter/list+detail product shapes.  
  - [x] Wire **one** runtime call site (provider mount and/or checkout guard).

- [x] **Task 3 — Checkout draft lines (AC: 4)**  
  - [x] Add `toCheckoutLines` (or similar) producing **SKU + quantity + variant_id** for future API; integrate into [`CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) **without** changing PaymentIntent amount semantics yet.

- [x] **Task 4 — Tests (AC: 6)**  
  - [x] Unit tests for migration + reconciliation + `toCheckoutLines`.  
  - [x] Confirm **CartPage** keys still unique per [`normalizeLineSku`](../../src/cart/lineKey.ts).

### Review Findings

- [x] [Review][Patch] Dev record vs code — completion notes say reconciliation "drops" bad lines and `reconcileNotice` is when "lines removed"; `reconcileCartLines` only calls `syncCartLinesFromCatalog` (keeps bad SKUs) and `reconcile.test.ts` documents "keeps unknown SKU line in cart". Update dev notes to match: validation + checkout block, not line removal. [_bmad-output/implementation-artifacts/3-1-cart-sku-variant-identity.md] **Fixed 2026-04-26** (dev notes + completion list).

- [x] [Review][Patch] `CartPage` subtotal / free-shipping progress — `validations.reduce` uses `v.displayUnitPrice ?? v.line.price`, so lines with `unknown_sku`, OOS, etc. still add **stale `line.price`** to the subtotal and progress message (AC3: do not keep priced lines for dead SKUs in a way that affects displayed money). [src/components/Cart/CartPage.tsx:90-98] **Fixed 2026-04-26** (lines with `issues` contribute `$0` to subtotal / progress).

- [x] [Review][Patch] `toCheckoutLines` / `domainLineFromStorefront` — `checkoutLineDraftSchema.parse` and `cartItemSchema.parse` can **throw** on a non-UUID `variant_id` in persisted storage, breaking `useCartQuote` and any caller. Prefer `safeParse` and omit or sanitize invalid optionals. [src/cart/checkoutLines.ts:17-22] [src/cart/domainBridge.ts:14-18] **Fixed 2026-04-26** (retry without `variant_id` on failed parse; tests added).

- [x] [Review][Defer] `findVariant` when multiple catalog variants share a SKU and `variant_id` is wrong or missing — code picks `bySku[0]`, which can sync the wrong `variant_id` if the catalog ever violates SKU uniqueness. [src/cart/reconcile.ts:65-77] — deferred, pre-existing; enforce uniqueness in data or document invariant.

## Dev Notes

### Dev Agent Guardrails

- **Scope boundary:** **[2-4](2-4-variant-selector-size-color-price-stock.md)** already added **`(storefrontProductId, sku)`** merge in [`sameCartLine`](../../src/cart/lineKey.ts). **Do not** change merge semantics unless **migration** requires it — **extend** with `variant_id` for server alignment.  
- **Out of scope for 3-1:** Full **stock cap** at quantity update (**[3-2](sprint-status.yaml)**), **server subtotal** (**[3-4](sprint-status.yaml)**), **Stripe line items** (**[3-3](sprint-status.yaml), [3-5](sprint-status.yaml)**), **Supabase anonymous cart** (optional future — PRD allows local storage for MVP).  
- **Catalog source:** Only **`getDefaultCatalogAdapter()`** — reconciliation must work for **static** and **Supabase** modes already supported by **[1-3](1-3-catalog-adapter-static-and-supabase.md)**.

### Technical requirements

- **FR-CART-001, FR-CART-003, FR-CAT-003, FR-CHK-003** (prepare line-item identity for server-calculated checkout).  
- **NFR-SEC-002:** no secrets in cart payload.  
- **PRD Epic 3 E3-S1** wording (“SKU/variant ID”) → implement **both** SKU and **variant UUID** when catalog supplies UUID (Supabase-backed variants).

### Architecture compliance

- [_bmad-output/planning-artifacts/architecture.md](../planning-artifacts/architecture.md): SKU-keyed cart; server-authoritative pricing — cart persistence must **not** assert totals as source of truth after reconciliation removes bad lines.  
- **Agent guardrails (PRD §19):** no client-submitted payment amounts in **new** APIs; this story only structures **draft** lines for a future server.

### Library / framework requirements

- **React 18**, **TypeScript**, **Zod** — match [package.json](../../package.json).  
- **No** new runtime dependencies unless unavoidable (default: **none**).

### File structure requirements

| Area | Action |
|------|--------|
| [`src/context/CartContext.tsx`](../../src/context/CartContext.tsx) | **UPDATE** — versioned persistence, reconciliation trigger, types |
| [`src/cart/lineKey.ts`](../../src/cart/lineKey.ts) | **UPDATE** only if merge key must incorporate `variant_id` (prefer **not** unless `sku` collision risk documented) |
| `src/cart/*.ts` (new) | **NEW** — `toCheckoutLines`, migration helpers, reconciliation pure functions |
| [`src/domain/commerce/cart.ts`](../../src/domain/commerce/cart.ts) | **UPDATE** — shared schema/types for export lines |
| [`src/components/ProductDetail/ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx), [`ProductList.tsx`](../../src/components/ProductList/ProductList.tsx) | **UPDATE** — pass `variant_id` / slug when adding |
| [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx) | **UPDATE** — consume `toCheckoutLines` (wire for future POST body; may log in dev only) |
| [`src/components/Cart/CartPage.tsx`](../../src/components/Cart/CartPage.tsx) | **UPDATE** only if line shape or keys change |

### Testing requirements

- `npm run build` + `npm run smoke`.  
- **Vitest:** no live Supabase in unit tests; use fixtures mirroring `Product` / list rows.

### Previous story intelligence (2-6)

- Admin **`admin_save_product_bundle`** and catalog writes are **live**; reconciliation protects storefront users from **edited/removed** SKUs.  
- **`legacy_storefront_id`** in DB (if used) relates to numeric **storefront** id — when wiring `variant_id`, confirm list/detail rows expose UUID from [`ProductVariant`](../../src/domain/commerce/product.ts) in Supabase mode ([`supabase-map.ts`](../../src/catalog/supabase-map.ts)).

### Git intelligence (recent commits)

- Recent work: Vitest, Supabase catalog adapter, types — keep cart work **consistent** with adapter and **env-gated** static tests.

### Latest technical information

- **localStorage:** keep payloads small; avoid storing redundant denormalized blobs beyond display needs.  
- **Stripe:** PaymentIntent creation remains amount-based until **3-3/3-4**; do not break **`/api/create-payment-intent`** signature in this story unless coordinated.

### Project context reference

- No committed `project-context.md` matched the create-story glob; rely on this file, [epics.md](../planning-artifacts/epics.md), [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.3 / §14 Epic 3, and [architecture.md](../planning-artifacts/architecture.md).

### References

- [PRD — FR-CART-001..004, Epic 3 / E3-S1](../planning-artifacts/zephyr-lux-commerce-prd.md)  
- [epics.md — §9.3 Cart, UX-DR7](../planning-artifacts/epics.md)  
- [2-4-variant-selector-size-color-price-stock.md](2-4-variant-selector-size-color-price-stock.md) (merge key split)  
- [2-6-admin-create-edit-product-variants.md](2-6-admin-create-edit-product-variants.md) (live catalog mutations)  
- [sprint-status.yaml](sprint-status.yaml) (Epic 3 ordering)

## Story completion status

- **Status:** `done`  
- **Note:** Code review follow-up 2026-04-26 — review patches applied; `npm run build` and `npm run smoke` pass.

## Dev Agent Record

### Agent Model Used

Cursor agent (Composer)

### Debug Log References

- Vitest: invalid fixture UUIDs under Zod v4 — replaced with RFC-compliant UUIDs in cart tests.

### Completion Notes List

- **Reconciliation / catalog sync:** `CartProvider` mount (and `CartPage` on cart changes) loads `getDefaultCatalogAdapter().listProducts()`, runs `reconcileCartLines` → `syncCartLinesFromCatalog` to refresh price, image, `variant_id`, and IDs from the catalog. **Invalid lines are not auto-removed** (see `reconcile.test.ts`); they stay in state until the user changes the cart, while `validateStorefrontCartLines` drives **“Fix your bag”** and blocks checkout. Catalog load failures: `console.warn` only in provider.
- **Storage:** Same `localStorage` key `cartItems`; writes `{ v: 1, items }`. Reads migrate legacy top-level JSON arrays; invalid JSON / unknown `v` → empty cart + `console.warn`.
- **Types:** `StorefrontCartLine` in `src/cart/cartLine.ts`; context re-exports as `CartItem`. Domain: `DomainCartLineItem`, `checkoutLineDraftSchema`, `domainLineFromStorefront` for Zod boundary.
- **UX:** `reconcileNotice` on `CartPage` when catalog sync updates prices; dismiss control. Stale/invalid line messaging from `validateStorefrontCartLines` (not from line removal).
- **Checkout / quotes:** `useCartQuote` uses `toCheckoutLines` (safe Zod) for `POST` drafts; `CheckoutPage` uses server quote when available.

### File List

- `src/cart/cartLine.ts`
- `src/cart/storage.ts`
- `src/cart/reconcile.ts`
- `src/cart/checkoutLines.ts`
- `src/cart/domainBridge.ts`
- `src/cart/storage.test.ts`
- `src/cart/reconcile.test.ts`
- `src/cart/checkoutLines.test.ts`
- `src/domain/commerce/cart.ts`
- `src/context/CartContext.tsx`
- `src/components/ProductDetail/ProductDetail.tsx`
- `src/components/ProductList/ProductList.tsx`
- `src/components/Cart/CartPage.tsx`
- `src/components/Cart/CheckoutPage.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-1-cart-sku-variant-identity.md`

## Change Log

- 2026-04-26: Code review patch — dev notes corrected; `CartPage` subtotal/progress omits money for lines with validation issues; `toCheckoutLines` / `domainLineFromStorefront` use `safeParse` + drop bad `variant_id`; Vitest cases for invalid UUID.
- 2026-04-26: Story 3-1 — versioned cart persistence, catalog reconciliation, `toCheckoutLines`, domain cart alignment, Vitest coverage; sprint status → review.

## Questions (non-blocking)

- Should reconciliation run on every **focus** / **visibilitychange** or only on **load** + **checkout** (tradeoff: freshness vs. adapter churn)?  
- If **static** catalog has **no** `variant.id` UUIDs, is **`sku`-only** server line item acceptable until Supabase-only deploy (document default)?
