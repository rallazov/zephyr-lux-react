# Story 2.3: Product detail reads canonical catalog by slug

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want **`/product/:slug` to show the correct product from the same canonical catalog as `/products` and the payment API**, with a **clear not-found experience for invalid or non-browsable slugs**,
so that **FR-CAT-001**, **FR-CAT-002**, **FR-SF-002** (baseline PDP), and **PRD §14 Epic 2 / E2-S3** are satisfied—and **E2-S4** can layer variant selection without re-plumbing data sources.

## Acceptance Criteria

1. **Given** [PRD — FR-CAT-001](../planning-artifacts/zephyr-lux-commerce-prd.md) and [FR-CAT-002](../planning-artifacts/epics.md) (“unknown slugs show a not-found state”), **when** `slug` is **missing**, **unknown**, or **not present in the catalog adapter’s authoritative index**, **then** the customer sees a **deliberate not-found state** (clear message; optional link back to `/products` or home)—**not** an infinite loader, blank screen, or uncaught error. Slug matching must be **exact** (no unsafe fallbacks).

2. **Given** [FR-SF-001](../planning-artifacts/epics.md) (“inactive products are hidden”) and story [2-2-product-list-reads-canonical-catalog](2-2-product-list-reads-canonical-catalog.md) (active-only list), **when** a product exists in seed but is **not browsable** on the list (e.g. `draft` / `archived` once [2-1](2-1-canonical-product-variant-seed-data.md) introduces real `Product.status`), **then** **`getProductBySlug` must not return it for storefront purposes**—treat like AC1 (same UX as unknown slug). Implement this in **one** place consistent with 2-2: prefer **filtering inside [parseStaticCatalogData](../../src/catalog/parse.ts)** (only index browsable products into `bySlug` / `listItems`) **or** a single shared helper both list and detail use—**do not** duplicate status rules in [`ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) only.

3. **Given** [1-3-catalog-adapter-static-and-supabase](1-3-catalog-adapter-static-and-supabase.md), **when** product detail loads, **then** it uses **`getDefaultCatalogAdapter()` → `getProductBySlug(slug)`** only—**no** parallel fetch of `public/products.json`, hardcoded slug→product maps, or legacy JSON paths. Grep the repo and remove or document any dead alternate entry points that could drift from the adapter.

4. **Given** [NFR-A11Y-002](../planning-artifacts/epics.md) and [UX-DR9](../planning-artifacts/epics.md), **when** not-found or load failure renders, **then** the message is **visible text** (not color-only); **errors** (adapter throw, parse failure) should be distinguishable from **not found** where practical—e.g. “Failed to load product” vs “Product not found”—and error paths should remain **perceivable** (e.g. `role="alert"` where appropriate, consistent with [2-2](2-2-product-list-reads-canonical-catalog.md) AC7).

5. **Given** [FR-SF-002](../planning-artifacts/epics.md) and [UX-DR6](../planning-artifacts/epics.md), **when** a **valid, browsable** product loads, **then** the page shows at least **title**, **representative imagery**, **price signal** (min price or selected variant price—today’s “first variant / min” pattern is acceptable), and **add-to-cart** behavior **consistent with pre–Epic 3** [`CartContext`](../../src/context/CartContext.tsx) (coordinate with **[2-2 AC6](2-2-product-list-reads-canonical-catalog.md)** for **list** cart rules; **PDP** baseline here until **[2-4](2-4-variant-selector-size-color-price-stock.md)** adds explicit variant + `sku` on the line). **Out of scope for 2-3:** full size/color **selector**, per-variant price updates, gallery, care/size-guide blocks, and trust copy—those are **E2-S4** / **Epic 6** unless already present; do **not** strip existing copy if seed/UI already provides it.

6. **Given** [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md), **when** this story ships, **then** `npm run build` and **`npm run smoke`** pass. Extend [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) **or** [`src/catalog/adapter-smoke.test.ts`](../../src/catalog/adapter-smoke.test.ts) so a **bogus slug** asserts **not-found copy** (or stable `data-testid`)—not a silent pass. Keep **`boxer-briefs`** in sync with seed across stories.

7. **Given** **Epic 3** is not in scope, **when** the customer adds from detail, **then** **no breaking change** to cart item shape (`storefrontProductId`, dollars price from current display rule)—same **pre–Epic 3** guardrails as **[2-2](2-2-product-list-reads-canonical-catalog.md)** (**AC6** list CTA; **AC6–7** overall).

## Tasks / Subtasks

- [x] **Task 1 — Single source + browsable index (AC: 2, 3)**  
  - [x] Align `bySlug` with list policy: only **active** (browsable) products indexed once 2-1/2-2 introduce `Product.status`; until then document “all parsed rows active.”  
  - [x] Remove or gate any alternate detail data paths found by grep.

- [x] **Task 2 — Not-found + error UX (AC: 1, 4)**  
  - [x] Polish [`ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) (or thin wrapper) for stable not-found layout, optional navigation CTA, a11y.  
  - [x] Preserve loading → error → success ordering; no flash of misleading content.

- [x] **Task 3 — Tests (AC: 1, 6)**  
  - [x] Adapter or RTL test: unknown slug → null; after status filtering, archived slug → null.  
  - [x] Route or component test: bogus slug shows expected not-found UI.  
  - [x] `npm run smoke`.

- [x] **Task 4 — Scope check vs E2-S4 (AC: 5)**  
  - [x] Document in Dev Agent Record what remains first-variant/min-price placeholder for **E2-S4** (sprint key `2-4-variant-selector-size-color-price-stock` when that story is authored).

### Review Findings

- [x] [Review][Patch] Loading and error panels lack committed a11y roles (AC4) — [`src/components/ProductDetail/ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) — Add `role="status"` and `aria-live="polite"` to the loading branch; add `role="alert"` to the error/not-found panel so load vs failure states match story intent and the Dev Agent Record note about `role="status"` / `role="alert"`. **Fixed 2026-04-26.**
- [x] [Review][Patch] `data-testid="product-detail-not-found"` wraps both not-found and “Failed to load product” (same `data-testid` for different outcomes) — [`src/components/ProductDetail/ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) — Use a dedicated test id for the adapter/load failure path (e.g. `product-detail-load-error`) and keep `product-detail-not-found` for slug-not-found only; `routes.smoke.test.tsx` can stay on the not-found test id for the bogus-slug case. **Fixed 2026-04-26.**

## Dev Notes

### Dev Agent Guardrails

- **Scope:** Slug resolution, catalog consistency, not-found, tests—not full PDP redesign. **E2-S4** owns interactive variant selection and stock-aware price display.  
- **Do not** implement `SupabaseCatalogAdapter` (**E2-S5+**). **Do not** implement **Epic 3** persisted cart / checkout server SKU validation (**2-4** may add **client** `(storefrontProductId, sku)` merge—coordinate there).  
- **Single seller**; TypeScript canonical.

### Technical requirements

- **FR-CAT-001 / FR-CAT-002:** One catalog; stable slug; unknown slug → not-found.  
- **FR-SF-002:** Baseline PDP fields as feasible without expanding into E2-S4.  
- **PRD E2-S3:** “Product detail reads canonical catalog by slug.”

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): Catalog adapter seam; shared domain types from [`src/domain/commerce`](../../src/domain/commerce).  
- Parser is the shared boundary: [parseStaticCatalogData](../../src/catalog/parse.ts), [StaticCatalogAdapter](../../src/catalog/adapter.ts), [getDefaultCatalogAdapter](../../src/catalog/factory.ts).

### Library / framework requirements

- **react-router-dom@6** — `useParams` for `slug`; optional `Link` for not-found recovery.  
- **Zod@4** — seed/parse boundary unchanged in spirit; extend only if 2-1/2-2 require.  
- **Vitest** + **@testing-library/react** — tests per AC6.

### File structure requirements

| Area | Likely action |
|------|----------------|
| [`src/components/ProductDetail/ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) | **UPDATE** — UX, a11y, maybe thin presentational split |
| [`src/catalog/parse.ts`](../../src/catalog/parse.ts) | **UPDATE** — browsable-only `bySlug` / `listItems` (coordinate with 2-2) |
| [`src/catalog/adapter.ts`](../../src/catalog/adapter.ts) | **UPDATE** only if adapter needs new behavior (prefer parse-level filter) |
| [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) / [`src/catalog/adapter-smoke.test.ts`](../../src/catalog/adapter-smoke.test.ts) | **UPDATE** — negative slug coverage |
| [`src/components/App/App.tsx`](../../src/components/App/App.tsx) | **READ** — route is `/product/:slug`; change only if product wrapper/test ids needed |

### Testing requirements

- `npm run build` and `npm run smoke`.  
- Deterministic failure if detail bypasses adapter or shows non-browsable products when list hides them.

### Previous story intelligence (2-2, 2-1, Epic 1)

- **2-2:** List must be adapter-only and active-only; **2-3** must not contradict that—**shared parse filter** is the integration point. Non-blocking note from 2-2: **direct URL to archived product** → **this story** treats as not-found.  
- **2-1:** When seed gains real `Product.status`, parse must stop hardcoding `"active"` only—wire real status and filtering.  
- **1-3 / 1-5:** Factory + test mode static; smoke slug **`boxer-briefs`**.

### Git intelligence (recent commits)

- Catalog adapter and TypeScript migration are already landed; this story is **compliance and edge-case hardening** for the **detail** route, not a rewrite to a new data source.

### Latest technical information

- No required npm upgrades for this story. Router v6 `useParams` returns `string | undefined`; treat undefined slug as not-found (already partially done in [`ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx)).

### Project context reference

- No `project-context.md` in repo; use PRD, [architecture.md](../planning-artifacts/architecture.md), [epics.md](../planning-artifacts/epics.md), and this file.

### References

- [PRD §14 — Epic 2, E2-S3](../planning-artifacts/zephyr-lux-commerce-prd.md#epic-2-commerce-catalog-and-product-admin-foundation)  
- [epics — FR-CAT-001/002, FR-SF-001/002, UX-DR6/DR9](../planning-artifacts/epics.md)  
- [2-2 — Product list](2-2-product-list-reads-canonical-catalog.md)  
- [2-1 — Seed data](2-1-canonical-product-variant-seed-data.md)  
- [1-3 — Adapter](1-3-catalog-adapter-static-and-supabase.md)

## Story completion status

- **Status:** `done`  
- **Note:** Code review complete; a11y + test id fixes applied 2026-04-26.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Repo `parseStaticCatalogData` now omits non-`active` products from `products`, `listItems`, and `bySlug` so PDP and list share one rule (`isStorefrontBrowsableProduct`).
- Grep (`products.json`, `getProductBySlug`, `public/products`): detail route uses only `getDefaultCatalogAdapter().getProductBySlug`; no parallel static JSON fetch in components.

### Completion Notes List

- **AC1–2,3:** `parse.ts` skips draft/archived when building indexes; `getProductBySlug` only resolves browsable slugs. Unknown or non-browsable slugs → null → PDP not-found.
- **AC4:** ProductDetail distinguishes not-found vs load failure; `role="alert"`, visible copy, `data-testid` for smoke; loading uses `role="status"` / `aria-live="polite"`. (Post-review: not-found `product-detail-not-found`, load `product-detail-load-error`.)
- **AC5–7:** PDP shows title, image, min-price signal, add-to-cart via `CartContext`; passes first variant `sku` on add for alignment with list single-variant path (still min-price display until 2-4).
- **AC6:** `adapter-smoke.test.ts` (unknown slug), `parse.list.test.ts` (archived/draft absent from `bySlug`), `routes.smoke.test.tsx` (bogus slug → `product-detail-not-found`). `npm run smoke` passes.
- **E2-S4 (2-4):** PDP still uses first-variant hero image and **minimum** variant price for display; no size/color selector, no per-selection price/stock — explicit variant selection and stock-aware price belong to story **2-4-variant-selector-size-color-price-stock**.

### File List

- `src/catalog/parse.ts`
- `src/catalog/parse.list.test.ts`
- `src/catalog/adapter-smoke.test.ts`
- `src/components/ProductDetail/ProductDetail.tsx`
- `src/routes.smoke.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-3-product-detail-by-slug-canonical.md`

## Change Log

- 2026-04-26 — Code review: PDP loading `role="status"` + `aria-live="polite"`; error panels `role="alert"`; split `data-testid` not-found vs `product-detail-load-error`; story status → **done**.

- 2026-04-26 — Story 2-3: browsable-only catalog indexes, PDP not-found/error UX and tests, smoke coverage for bogus slug; sprint status → review.

## Questions (non-blocking; saved for end)

- If marketing needs **trailing-slash** or **case-insensitive** slugs, treat as explicit product decision—default remains **exact** slug only per FR-CAT-002.  
- **SEO / metadata** for product pages is **FR-CONT-003 (P2)** / **Epic 6**—out of scope unless already trivially present.
