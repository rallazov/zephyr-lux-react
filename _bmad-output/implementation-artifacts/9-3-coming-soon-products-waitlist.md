# Story 9.3: Coming soon listings and per-product waitlist

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want to **see upcoming products marked clearly as not yet for sale and join a waitlist with my email**,
so that I **understand what is launching soon and can signal interest without a fake checkout**.

As the **owner / operator**,
I want **listing state, RLS, and signups stored in Supabase**,
so that **`coming_soon` merchandising is honest, secure, and reversible from admin**.

## Acceptance Criteria

1. **Given** [sprint change §4.3](../planning-artifacts/sprint-change-proposal-2026-04-30.md) and today’s schema ([`product_status`](../../supabase/migrations/20260426180000_catalog_inventory.sql) is `draft | active | archived`), **when** migrations run, **then** Postgres enum `public.product_status` gains **`coming_soon`**, storefront anon **SELECT** policies on `products`, `product_variants`, and `product_images` allow rows whose **parent product** has `status IN ('active', 'coming_soon')` (draft/archived still hidden). **Do not** broaden [`product_subscription_plans` storefront policy](../../supabase/migrations/20260428104500_product_subscription_plans.sql) unless explicitly required — default remains **`p.status = 'active'`** so subscription plans stay tied to shippable catalog.

2. **Given** waitlist persistence, **when** migration runs, **then** table **`public.product_waitlist_signups`** exists with at least: `id uuid` PK, **`product_id uuid NOT NULL`** referencing **`public.products(id)`** ON DELETE CASCADE, **`email text NOT NULL`** (normalized trim + lower at application layer), **`created_at timestamptz`**, and a **unique constraint on `(product_id, email)`** (or equivalent) so duplicate signups **upsert / no-op** cleanly. **RLS:** default deny for anon/authenticated on this table; **no** browser direct writes — inserts only via **service-role** API (same trust model as [`order-lookup-request`](../../handlers/order-lookup-request.ts)).

3. **Given** [`productStatusSchema`](../../src/domain/commerce/enums.ts) / [`productSchema`](../../src/domain/commerce/product.ts) / static [`parseStaticCatalogData`](../../src/catalog/parse.ts), **when** `status === 'coming_soon'`, **then** products are **storefront-listable** alongside `active`: extend **`isStorefrontBrowsableProduct`** (or rename to a clearly named helper e.g. `isStorefrontListableProduct` used for list/parse) so **`coming_soon`** rows appear in **`listItems`**, **`bySlug`**, and server **`parseStaticCatalogData`** output. **`draft` / `archived`** remain excluded. Update comments in `parse.ts` that today say only **`active`**.

4. **Given** [`SupabaseCatalogAdapter`](../../src/catalog/adapter.ts), **when** loading PLP/PDP/search, **then** `.eq("status", "active")` is replaced with **`.in("status", ["active", "coming_soon"])`** (or equivalent) for **`listProducts`** and **`getProductBySlug`**. Preserve ordering and embed shape (`PRODUCTS_CATALOG_SELECT`). Update [`SupabaseProductRow.status`](../../src/catalog/supabase-map.ts) union type to include **`coming_soon`**.

5. **Given** honest merchandising ([sprint §1b](../planning-artifacts/sprint-change-proposal-2026-04-30.md)), **when** a product is **`coming_soon`**, **then** it must **not** be checkout-quotable server-side: extend [`quoteCartLines`](../../handlers/_lib/catalog.ts) so that if `hit.product.status === 'coming_soon'`, throw **`QuoteError`** with a distinct code (e.g. **`NOT_FOR_SALE`** or reuse **`INVALID_LINE`** with clear message) and map it to **400** in [`cart-quote`](../../handlers/cart-quote.ts) / [`create-payment-intent`](../../handlers/create-payment-intent.ts) paths that depend on the quote — **grep** call sites so payment cannot charge waitlist SKUs if JSON ever drifts.

6. **Given** PLP UX, **when** a list row’s `product.status === 'coming_soon'`, **then** [`CatalogProductGrid`](../../src/components/CatalogProductGrid/CatalogProductGrid.tsx) shows an unambiguous **“Coming soon”** treatment: visible **badge or label** on the card, **no** “Add to Cart” for that row (even if variant rows are mis-seeded); primary CTA remains **view PDP** / **details**. Reuse existing price/styling patterns where helpful but do not imply immediate purchase.

7. **Given** PDP UX, **when** `product.status === 'coming_soon'`, **then** the page shows **Coming soon** messaging, a **mailto-level privacy note** (e.g. email used only for this product’s availability — one short sentence, consistent with [sprint §4.3](../planning-artifacts/sprint-change-proposal-2026-04-30.md)), and a **waitlist form** (email + submit). **Do not** show a primary **Add to cart** for **`coming_soon`**; variant selectors may be hidden or read-only — pick the simpler path: if **`getPurchasableVariants`** is empty, reuse the existing unavailable region but **replace** generic copy with waitlist module. **Accessibility:** labeled email input, submit button, **`aria-live`** or inline success/error region (follow **UX-DR12–DR13** in [`epics.md`](../planning-artifacts/epics.md)).

8. **Given** waitlist API, **when** the client **POST**s `application/json` to **`/api/product-waitlist`** (name aligns with existing `/api/*` style), **then** the handler validates body with **zod** (`email`, **`product_id` uuid**), verifies **`products.status === 'coming_soon'`** via **`getSupabaseAdmin()`** (if admin client missing, follow neutral **202** pattern like order lookup — see [`order-lookup-request.ts`](../../handlers/order-lookup-request.ts)), inserts with **service role**, **ON CONFLICT DO NOTHING** (or upsert) on `(product_id, email)`, returns **202** with a **generic success message** (no enumeration). Register the handler in [`server/index.ts`](../../server/index.ts) alongside other JSON routes. Wire the PDP form with [`apiUrl`](../../src/lib/apiBase.ts). **CORS** headers consistent with other POST handlers (`ENV.FRONTEND_URL`).

9. **Given** **9-2** storefront search (route/component named in [9-2 story](9-2-storefront-product-search.md)), **when** this story completes, **then** any search or client-side catalog filter **uses the same listable-status rule as PLP** — if code still restricts to **`active` only**, update it so **`coming_soon`** titles/categories are discoverable (prefer one shared helper over duplicated status allowlists).

10. **Given** admin authoring, **when** an operator edits a product, **then** [`AdminProductForm`](../../src/admin/AdminProductForm.tsx) **`productStatuses`** includes **`coming_soon`** after domain types compile. Extend **[`admin_save_product_bundle`](../../supabase/migrations/20260428104600_extend_admin_save_product_bundle_subscription_plans.sql)** validation so **`coming_soon`** requires **at least one variant** the same way **`active`** does (adjust the `v_status = 'active'` guard to **`active OR coming_soon`**). Apply via **new forward migration** (do not edit applied migration files in place).

11. **Given** seed/static parity (**FR-CAT-001**), **when** the story is done, **then** add **at least one** `coming_soon` product to [`supabase/seed.sql`](../../supabase/seed.sql) and [`data/products.json`](../../data/products.json) with coherent slug/title/images and **non-purchasable** variants (e.g. **`inactive`** or **`inventory_quantity = 0`**) so PDP/PLP never advertises stock. Align **SKUs** so server quote tests do not accidentally depend on illegal cart lines.

12. **Given** CI expectations, **when** implementation is complete, **then** **`npm run build`**, **`npm test`**, and **`npm run smoke`** pass; add **focused tests**: handler unit test or integration stub for waitlist validation; RTL for PDP **`coming_soon`** waitlist happy path (mock **`fetch`**); **`quoteCartLines`** / **`catalog.quote.test`** case for rejected **`coming_soon`** SKU.

## Tasks / Subtasks

- [x] **Task 1 — DB + RLS (AC: 1, 2, 10)**  
  - [x] New migration: `ALTER TYPE ... ADD VALUE 'coming_soon'`; replace storefront catalog policies; create `product_waitlist_signups` + RLS deny-by-default.  
  - [x] New migration: patch `admin_save_product_bundle` variant-count rule for `coming_soon`.

- [x] **Task 2 — Domain + adapters + quote (AC: 3, 4, 5)**  
  - [x] Types: `productStatusSchema`, Supabase row unions, `parse.ts` listability + comments.  
  - [x] `SupabaseCatalogAdapter` filters; static parse path.  
  - [x] `handlers/_lib/catalog.ts` quote guard + tests; HTTP mapping for new error code if introduced.

- [x] **Task 3 — API + server mount (AC: 8)**  
  - [x] `handlers/product-waitlist.ts` (or `handlers/product-waitlist-request.ts`) + `server/index.ts` registration.

- [x] **Task 4 — Storefront UX (AC: 6, 7, 9)**  
  - [x] `CatalogProductGrid` badges + CTA rules.  
  - [x] `ProductDetail` waitlist panel + strip purchase CTA for `coming_soon`.  
  - [x] Search filter alignment with PLP.

- [x] **Task 5 — Admin + seed (AC: 10, 11)**  
  - [x] `AdminProductForm` status `<select>`.  
  - [x] `seed.sql` + `data/products.json` minimal `coming_soon` example.

- [x] **Task 6 — Tests (AC: 12)**  
  - [x] Quote rejection, waitlist handler, PDP RTL, smoke if new route.

## Dev Notes

### Dev Agent Guardrails

- **RLS is the main hazard** ([sprint §3](../planning-artifacts/sprint-change-proposal-2026-04-30.md)): double-check **`product_variants`** / **`product_images`** subqueries use **`coming_soon`** consistently with `active`.  
- **Defense in depth:** even with `inventory_quantity = 0`, **quoteCartLines** must reject **`coming_soon`** SKUs present in static JSON.  
- **Reuse patterns:** zod body parse, `getSupabaseAdmin`, CORS, `log` from [`handlers/_lib/logger`](../../handlers/_lib/logger.ts), `ENV` from [`handlers/_lib/env`](../../handlers/_lib/env.ts).  
- **No** customer PII email blast in scope — capture only; optional Resend template is follow-up ([sprint §2](../planning-artifacts/sprint-change-proposal-2026-04-30.md)).  
- **Rate limiting:** deferred (note in Dev Agent Record if desired).

### Technical requirements

- **FR-CAT / storefront listing:** Single adapter surface; **`coming_soon`** is browsable, not sellable.  
- **Privacy:** PDP microcopy for email use ([sprint §4.3](../planning-artifacts/sprint-change-proposal-2026-04-30.md)).  
- **Dependencies:** Story **9-4** expects **`coming_soon`** in place — ship migration before heavy assortment expansion.

### Architecture compliance

- **Split deploy:** Browser → **`apiUrl('/api/product-waitlist')`** → Railway/Vercel handler stack per [`architecture.md`](../planning-artifacts/architecture.md) API notes and [`server/index.ts`](../../server/index.ts).  
- **TypeScript + zod** at boundaries; service role only server-side.

### Library / framework requirements

- **None new** — `zod`, existing Supabase JS, Vitest + RTL.

### File structure requirements

| Area | Action |
|------|--------|
| `supabase/migrations/*.sql` | **NEW** — enum value, policies, waitlist table, RPC tweak |
| [`src/domain/commerce/enums.ts`](../../src/domain/commerce/enums.ts) | **UPDATE** |
| [`src/catalog/parse.ts`](../../src/catalog/parse.ts) | **UPDATE** |
| [`src/catalog/adapter.ts`](../../src/catalog/adapter.ts) | **UPDATE** |
| [`src/catalog/supabase-map.ts`](../../src/catalog/supabase-map.ts) | **UPDATE** |
| [`handlers/_lib/catalog.ts`](../../handlers/_lib/catalog.ts) | **UPDATE** |
| [`handlers/cart-quote.ts`](../../handlers/cart-quote.ts) | **UPDATE** if new quote error code |
| `handlers/product-waitlist*.ts` | **NEW** |
| [`server/index.ts`](../../server/index.ts) | **UPDATE** |
| [`src/components/ProductDetail/ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) | **UPDATE** |
| [`src/components/CatalogProductGrid/CatalogProductGrid.tsx`](../../src/components/CatalogProductGrid/CatalogProductGrid.tsx) | **UPDATE** |
| Search page + tests | **UPDATE** (9-2 alignment) |
| [`src/admin/AdminProductForm.tsx`](../../src/admin/AdminProductForm.tsx) | **UPDATE** |
| [`data/products.json`](../../data/products.json), [`supabase/seed.sql`](../../supabase/seed.sql) | **UPDATE** |

### Testing requirements

- `npm run build`  
- `npm test`  
- `npm run smoke`

### Previous story intelligence

- **[9-2](9-2-storefront-product-search.md)** scoped search to **active** adapter semantics; this story **must** reconcile **listable** statuses so search and PLP agree.  
- **[9-1](9-1-fixed-assortment-pack-catalog.md)** — keep pack SKU/checkout tests green; add **`coming_soon`** fixtures **without** breaking **`ZLX-2PK-*`** (or current pack prefix) assumptions.

### Git intelligence summary

- Recent commits emphasize **Playwright**, **Navbar / storefront UX** — preserve mobile nav and grid styling when adding badges/forms.

### Latest tech information

- PostgreSQL: `ALTER TYPE ... ADD VALUE` is **transaction-safe only when placed alone** in some versions — follow project’s existing migration style (single migration file per logical change if required).

### Project context reference

- No `project-context.md` matched the BMAD glob in-repo; rely on this story + linked sources.

### References

- [Epic 9 — story 9-3 row](../planning-artifacts/epics.md)  
- [Sprint change §1b, §2, §4.3–§4.4](../planning-artifacts/sprint-change-proposal-2026-04-30.md)  
- [Catalog inventory migration — baseline RLS](../../supabase/migrations/20260426180000_catalog_inventory.sql)

### Questions / clarifications (non-blocking)

1. **Ops:** Who exports waitlist CSV from Supabase — document SQL in Dev Agent Record.  
2. **Copy:** Final “Coming soon” headline tone — brand voice left to implementer within existing typography.

## Dev Agent Record

### Agent Model Used

GPT-5.2 / Composer — Story 9-3 dev-story execution pass.

### Debug Log References

- Resolved BMAD customization resolver fallback (`tomllib` missing — workflow merged manually).

### Completion Notes List

- **Postgres:** `product_status` includes `coming_soon`; storefront anon SELECT on products / variants / images allows parent status `active` or `coming_soon`; `product_waitlist_signups` table with unique `(product_id, email)`, default-deny RLS (writes via service role handler only).
- **`admin_save_product_bundle`:** `active` **or** `coming_soon` requires ≥1 variant (forward migration).
- **Domain / adapters:** `isStorefrontListableProduct` (legacy alias `isStorefrontBrowsableProduct`), static seed optional `supabase_product_id` → maps to Product `id` for PDP waitlist; Supabase adapter `.in("status", ["active","coming_soon"])`.
- **Checkout honesty:** `quoteCartLines` throws `QuoteError` code **`NOT_FOR_SALE`** for `coming_soon`; cart-quote returns `{ code }`; create-payment-intent maps distinct shopper-facing message for that path.
- **API:** `POST /api/product-waitlist` (zod body), verifies DB row `status === coming_soon` when configured else neutral **202**; upsert ignore-duplicates on unique constraint.
- **UX:** PLP badge + no quick ATC for coming-soon; PDP hides ATC/subscriptions/options pattern + waitlist panel with privacy microcopy + `aria-live`; JSON-LD skipped for coming-soon.
- **Search:** Listing parity unchanged vs PLP because Search uses adapter `listProducts()` — confirmed smoke catalog lists coming-soon slug.
- **Search UX fix:** `setSearchParams` functional updater on Escape/submit avoids MemoryRouter/jsdom `AbortSignal` mismatch (SearchPage.test Escape timeout).
- **Ops / CSV:** Export waitlist per product — Example SQL: `SELECT email, created_at FROM public.product_waitlist_signups WHERE product_id = '<uuid>' ORDER BY created_at DESC;` (service-role SQL editor or `COPY (...)` in Supabase).

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/9-3-coming-soon-products-waitlist.md`
- `supabase/migrations/20260430201900_product_status_add_coming_soon.sql`
- `supabase/migrations/20260430202000_product_waitlist_and_storefront_catalog_policies.sql`
- `supabase/migrations/20260430202100_admin_bundle_coming_soon_requires_variant.sql`
- `handlers/_lib/catalog.ts`
- `handlers/_lib/catalog.quote.test.ts`
- `handlers/_lib/productWaitlist.ts`
- `handlers/product-waitlist.ts`
- `handlers/product-waitlist.test.ts`
- `handlers/cart-quote.ts`
- `handlers/create-payment-intent.ts`
- `server/index.ts`
- `src/domain/commerce/enums.ts`
- `src/catalog/parse.ts`
- `src/catalog/raw-static.ts`
- `src/catalog/adapter.ts`
- `src/catalog/supabase-map.ts`
- `src/catalog/adapter-smoke.test.ts`
- `src/admin/AdminProductForm.tsx`
- `src/components/CatalogProductGrid/CatalogProductGrid.tsx`
- `src/components/ProductDetail/ProductDetail.tsx`
- `src/components/ProductDetail/ProductDetail.waitlist.test.tsx`
- `src/components/Search/SearchPage.tsx`
- `src/lib/productWaitlistAck.ts`

### Change Log

- 2026-04-30 — Story 9-3: `coming_soon` enum + storefront listing policies + waitlist table + RPC parity + quote/API/UI/tests + SearchPage Escape/setSearchParams hardening.

- 2026-04-30 — Code review complete: no blocking findings; `npm run smoke` passed (build + 83 Vitest files / 454 tests). Story status moved to **done**.

### Review Findings

- [x] [Review][Pass] No blocking findings. Acceptance review covered migrations/RLS, waitlist API, server quote/payment guard, PLP/PDP coming-soon UX, search parity, admin status authoring, seed/static parity, and focused tests.

- [x] [Review][Note] Verification passed with existing non-blocking stderr noise: Browserslist database is stale, React Router v7 future-flag warnings appear in RTL tests, and jsdom logs `window.scrollTo` as not implemented from [`Layout.tsx`](../../src/components/App/Layout.tsx). These did not fail the smoke gate and are not 9-3 blockers.
