# Story 2.2: Product list reads canonical catalog

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want the **`/products` page to list only real, current catalog products** from the **same canonical source** the cart and server use,
so that **FR-SF-001** (browse active products), **FR-CAT-001** (one catalog for list and checkout), and **PRD §14 Epic 2 / E2-S2** are satisfied before **E2-S3** deepens product detail behavior.

## Acceptance Criteria

1. **Given** [PRD — FR-SF-001](../planning-artifacts/zephyr-lux-commerce-prd.md) and **FR-CAT-001**, **when** a customer opens `/products`, **then** every card shown is derived **only** from the **catalog adapter** path (`getDefaultCatalogAdapter()` → `listProducts()`) backed by the **authoritative** static bundle / parse pipeline ([`src/catalog/factory.ts`](../../src/catalog/factory.ts), [`src/catalog/parse.ts`](../../src/catalog/parse.ts), [`data/products.json`](../../data/products.json) or its documented successor). **No** parallel “shadow” product sources for the list (e.g. stale `public/products.json`, hardcoded product arrays, or ad-hoc fetches) unless an explicit, documented migration note exists and this story **removes** the duplication.

2. **Given** [PRD — FR-SF-001](../planning-artifacts/zephyr-lux-commerce-prd.md) (“inactive products are hidden”), **when** the canonical product model includes **non-`active`** `product.status` values (see [`productStatusSchema`](../../src/domain/commerce/enums.ts) and [2-1](2-1-canonical-product-variant-seed-data.md)), **then** the product list **must not** render **draft** or **archived** products. The filter must live in **one** obvious place: prefer **`StaticCatalogAdapter.listProducts` / `parseStaticCatalogData` list construction** (not scattered checks in the component). If story **2-1** has not yet landed real statuses in seed, the filter may be a no-op only if **all** parsed rows are still `active`—document that in the Dev Agent Record.

3. **Given** [epics/UX — UX-DR9](../planning-artifacts/epics.md) (empty states must be designed), **when** the filtered active catalog is **empty** (e.g. all archived or no rows), **then** `/products` shows a **clear, intentional empty state** (short message + sensible next step—e.g. return home or contact/support)—**not** a blank grid and **not** a silent success with zero cards. Copy should stay **premium / minimal**, consistent with [UX-DR4](../planning-artifacts/epics.md).

4. **Given** [NFR-PERF-001](../planning-artifacts/epics.md) and current [`ProductList`](../../src/components/ProductList/ProductList.tsx) behavior, **when** the catalog is loading, **then** the UI does **not** permanently look like an empty success: either a **loading** indicator/skeleton, or another pattern that prevents “empty catalog” from being misread (choose the smallest change that is honest in tests). [`ProductDetail`](../../src/components/ProductDetail/ProductDetail.tsx) already uses a simple loading state—**match that level of clarity** unless UX asks otherwise.

5. **Given** [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md), **when** this story ships, **then** `npm run build` and **`npm run smoke`** pass. If `/products` copy or list count assertions change, **update** [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) in the **same** change. Keep the known slug **`boxer-briefs`** in sync with seed unless 2-1 renames it (then update smoke + Dev Notes together).

6. **Given** [PRD §14 — Epic 2 acceptance](../planning-artifacts/zephyr-lux-commerce-prd.md#epic-2-commerce-catalog-and-product-admin-foundation) (“customer cannot add **ambiguous** product without selected variant”) and **FR-CAT-003**, **when** `/products` renders a card for an **active** product, **then** **Add to cart** on the list appears **only** if the product has **exactly one** **purchasable** variant (minimum: **`active`** variant status per [`productVariantStatusSchema`](../../src/domain/commerce/enums.ts) and **`inventory_quantity > 0`**; align precisely with **[2-4](2-4-variant-selector-size-color-price-stock.md)** once that story exists). **If** there are **zero** or **multiple** purchasable variants, the card **must not** offer list add-to-cart; it offers a clear **View details** (or equivalent) link to `/product/:slug`. **When** the single-variant list path runs, the cart line uses **pre–Epic 3** [`CartContext`](../../src/context/CartContext.tsx) shape (`storefrontProductId`, price from that variant). **After [2-4](2-4-variant-selector-size-color-price-stock.md)** lands, list adds on this path **must** include **`sku`** on the line so client merge identity matches the PDP (**Epic 3** still owns persistence, reconciliation, and checkout payloads—see [sprint-status.yaml](sprint-status.yaml) note on **3-1**).

7. **Given** [NFR-A11Y-002](../planning-artifacts/epics.md), **when** list errors or empty states render, **then** important messages remain **perceivable** (e.g. keep or add `role="alert"` for errors; empty state text is visible and not color-only).

## Tasks / Subtasks

- [x] **Task 1 — Trace & close duplicate sources (AC: 1)**  
  - [x] Grep the repo for alternate catalog entry points (`public/products.json`, raw fetch paths, static arrays) used by `/products`.  
  - [x] Remove or gate dead paths; document in Dev Notes if a file must remain for non-storefront reasons.

- [x] **Task 2 — Active-only list (AC: 2)**  
  - [x] Once `Product.status` is present from parse/seed, filter list output so only `active` products appear.  
  - [x] Confirm `inStock` / price range logic still uses **all** variants on the product for the **active** set (align with [toListItem](../../src/catalog/parse.ts)).

- [x] **Task 3 — Empty & loading UX (AC: 3, 4, 7)**  
  - [x] Implement empty state UI for zero active products.  
  - [x] Add loading affordance to `ProductList` (or prove why first frame cannot flash misleading empty).  
  - [x] Keep error path accessible.

- [x] **Task 3b — List CTA vs detail (AC: 6)**  
  - [x] Implement purchasable-variant count (or reuse list adapter fields) to toggle **Add to cart** vs **View details**.  
  - [x] Ensure multi-variant products cannot add an ambiguous line from `/products`.

- [x] **Task 4 — Tests (AC: 2, 5, 6)**  
  - [x] Extend or add tests: e.g. catalog integration test that `listProducts()` length and slugs match expectations for the bundled static catalog; and/or RTL test for empty state with a **mocked** adapter; assertion that a multi-variant product card does **not** expose list ATC (or exposes **View details** only).  
  - [x] Run `npm run smoke` locally.

## Dev Notes

### Dev Agent Guardrails

- **Scope:** Storefront **product list** + catalog **list** contract only. **Do not** implement `SupabaseCatalogAdapter` ( **E2-S5+** ) or product admin (**E2-S6**). **Do not** own full product detail / slug 404 policy beyond what list filtering implies—that is **2-3**. **List ATC** must satisfy Epic 2 acceptance: **no** ambiguous variant from `/products` (**AC6**).  
- **Single seller**; no multi-tenant abstractions.  
- **TypeScript** canonical; no new state libraries for this story.

### Technical requirements

- **FR-SF-001:** Active products at `/products`; inactive hidden; empty state when nothing active.  
- **FR-CAT-001:** List, detail, and APIs should agree on the same catalog facts over time; this story **locks** the list to the adapter.  
- **E2-S2 (PRD):** “Product list reads canonical catalog.”

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): **Catalog adapter** is the long-term seam; `StaticCatalogAdapter` + `parseStaticCatalogData` stay the static implementation until Supabase.  
- [1-3-catalog-adapter-static-and-supabase](1-3-catalog-adapter-static-and-supabase.md): Factory/env behavior (`VITE_CATALOG_BACKEND`, test mode → static) must remain intact.

### Library / framework requirements

- **React 18** + **react-router-dom@6** (existing).  
- **Zod@4** for parse boundary (existing).  
- **Vitest** + **@testing-library/react** for tests (existing).

### File structure requirements

| Area | Likely action |
|------|----------------|
| [`src/components/ProductList/ProductList.tsx`](../../src/components/ProductList/ProductList.tsx) | **UPDATE** — empty/loading, CTA rules (**AC6**), adapter-only data |
| [`src/catalog/parse.ts`](../../src/catalog/parse.ts) and/or [`src/catalog/adapter.ts`](../../src/catalog/adapter.ts) | **UPDATE** — active-only `listItems` (preferred single filter location) |
| [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) | **UPDATE** if `/products` landmarks change |
| [`src/catalog/adapter-smoke.test.ts`](../../src/catalog/adapter-smoke.test.ts) (or new test file) | **UPDATE** / **NEW** — list invariants |

### Testing requirements

- `npm run build` and `npm run smoke` (CI: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).  
- At least one **deterministic** test that would fail if the list bypasses the adapter or shows draft/archived products when those exist in test fixtures (once statuses exist).

### Previous story intelligence (2-1 and Epic 1)

- **2-1** ([2-1-canonical-product-variant-seed-data](2-1-canonical-product-variant-seed-data.md)): When seed and Zod shapes evolve, **do not** fork a second `Product` model—extend [`src/domain/commerce`](../../src/domain/commerce) + [`raw-static`](../../src/catalog/raw-static.ts) in coordination. List filtering should read **`Product.status`**, not ad-hoc JSON fields.  
- **1-3 / 1-5:** `getDefaultCatalogAdapter()` + `import.meta.env.MODE === "test"` → static; smoke slug `boxer-briefs`.

### Git intelligence (recent commits)

- Catalog adapter + `ProductList` / `ProductDetail` already moved to TypeScript and adapter pattern (`feat: implement catalog adapter…`). This story is **hardening** (FR/UX compliance, active filter, empty/loading), not a greenfield list page.

### Latest technical information

- No new npm dependencies required for ACs. If you add **headless UI** for list accessibility later, that is a larger epic-level decision (architecture notes **Radix/shadcn** as future)—**out of scope** unless a gap blocks AC7.

### Project context reference

- No `project-context.md` in repo; use PRD, [architecture.md](../planning-artifacts/architecture.md), [epics.md](../planning-artifacts/epics.md), and this file.

### References

- [PRD §14 — Epic 2](../planning-artifacts/zephyr-lux-commerce-prd.md#epic-2-commerce-catalog-and-product-admin-foundation) (E2-S2)  
- [epics — FR-SF-001, FR-CAT-001, UX-DR4/9](../planning-artifacts/epics.md)  
- [1-3 — Catalog adapter](1-3-catalog-adapter-static-and-supabase.md)  
- [2-1 — Canonical seed](2-1-canonical-product-variant-seed-data.md)

## Story completion status

- **Status:** `done`  
- **Note:** Implementation complete; code-review patches applied (2026-04-26).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `resolve_customization.py` unavailable (Python older than 3.11); workflow defaults used from skill `customize.toml`.

### Completion Notes List

- **AC1 / Task 1:** `ProductList` already used `getDefaultCatalogAdapter()` only; grep found no `public/products.json` and no alternate list sources for `/products`. No code removal required beyond confirming the single path.
- **AC2 / Task 2:** `parseStaticCatalogData` includes only `product.status === "active"` rows in `products`, `listItems`, and `bySlug` (non-browsable slugs are absent from the static index; aligns list and detail). `catalogListItemFromProduct` min/max price still use all variants on the product; `inStock` reflects at least one **purchasable** variant (`active` + `inventory_quantity > 0`). **`data/products.json`** was migrated to the canonical **`staticSeedProductRowSchema`** shape (snake_case, `price_cents`, explicit `status`) so parse + API share one schema; all current rows remain **`active`** (filter is covered by `parse.list.test.ts`).
- **AC3–4,7 / Task 3:** Loading line matches `ProductDetail` pattern; empty catalog message + “Return home”; load errors keep `role="alert"`.
- **AC6 / Task 3b:** `CatalogListItem.purchasableVariantCount` derived in parse (`active` variant + `inventory_quantity > 0`). List shows **Add to cart** only when count is exactly **1** (with `sku` on cart line for forward merge identity); otherwise **View details** link to PDP. Seed product **boxer-briefs** has multiple purchasable variants → list shows **View details** only.
- **AC5 / Task 4:** Added `parse.list.test.ts`, extended `adapter-smoke.test.ts`, `ProductList.test.tsx`; `npm run smoke` green.

### File List

- `data/products.json`
- `src/catalog/parse.ts`
- `src/catalog/types.ts`
- `src/catalog/parse.list.test.ts`
- `src/catalog/adapter-smoke.test.ts`
- `src/components/ProductList/ProductList.tsx`
- `src/components/ProductList/ProductList.test.tsx`
- `src/context/CartContext.tsx`
- `_bmad-output/implementation-artifacts/2-2-product-list-reads-canonical-catalog.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Review Findings

- [x] [Review][Patch] **Stale `CartPage.js` wins module resolution over `CartPage.tsx`** — Removed compiled shadow modules under `src/components/Cart/*.js` and `src/context/CartContext.js` so bundlers resolve the TypeScript sources (`sku`-aware cart and cart UI).

- [x] [Review][Patch] **`inStock` ignores variant status** — Addressed in `catalogListItemFromProduct`: `inStock` uses `some(isPurchasableVariant)` (active + stock).

- [x] [Review][Patch] **Dev Agent Record contradicts implementation for `bySlug`** — Completion notes updated to match `parseStaticCatalogData` (non-`active` products omitted from all indexes).

- [x] [Review][Patch] **RTL coverage gap for loading and error paths** — Added `ProductList` tests for loading copy and `role="alert"` on failed `listProducts`.

## Change Log

- 2026-04-26 — Story 2-2: canonical list from adapter, active-only `listItems`, empty/loading UX, list ATC vs view-details rule, tests, seed JSON aligned to domain schema.
- 2026-04-26 — Code review follow-up: remove shadow `.js` cart/context bundles; align Dev Agent Record; extend `ProductList` RTL tests for loading and error alert.

## Questions (non-blocking; saved for end)

- Should **archived** products with a **direct** `/product/:slug` URL 404? **Decision owner:** story **2-3**; this story only ensures they **do not appear on `/products`**.  
- If marketing wants category filters on the list, that maps to **FR-SF-005 (P2)** / later epic—**out of scope** for E2-S2.
