# Story 6.1: Real homepage & category/collection routes

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **Epic 2 (catalog)** — [`SupabaseCatalogAdapter`](../../src/catalog/adapter.ts) reads **`products`** with **`category`** ([`SupabaseProductRow`](../../src/catalog/supabase-map.ts)); storefront must **not** introduce service-role or bypass RLS.
- **[2-2](2-2-product-list-reads-canonical-catalog.md)** / **[2-3](2-3-product-detail-by-slug-canonical.md)** — list + PDP slug flows are canonical; collection pages must reuse the same adapter/domain types.
- **Story 6-2+** — policy/footer work is separate; keep nav **internally consistent** so no new dead routes land in the primary path.

## Story

As a **prospective customer**,
I want **a branded homepage and collection pages that show real products from the catalog (or clear empty states)**,
so that **FR-SF-003**, **FR-SF-004**, **UX-DR1**, and PRD **§14 E6-S1** are satisfied — **without** placeholder category grids disconnected from Supabase.

## Acceptance Criteria

1. **Homepage is real content (FR-SF-003)**  
   **Given** a visitor on **`/`** **when** the page loads **then** they see **Zephyr Lux**-appropriate **hero / brand introduction** and **actionable links** to **shop all** (**`/products`**) and to **at least one** meaningful collection (see AC2). **Then** **`/`** must **not** be only an immediate redirect to **`/products`** (a redirect **after** brief/SEO-friendly content is **not** the target — the page should **render** real homepage UI).  
   **Given** **zero** active products in Supabase **when** homepage loads **then** the page still explains the brand and routes to **`/products`** with copy that matches an empty-catalog world (reuse or align with existing list empty state tone where possible).

2. **Collection pages tied to catalog (FR-SF-004)**  
   **Given** **`products.category`** values in Supabase **when** a customer opens a collection route **then** the UI lists **active** products whose **`category`** matches that collection using the **normative normalization rules** in Dev Notes (**Category normalization** table). **Given** no products for that collection **when** they open the route **then** show a **designed empty state** (per **UX-DR9**) — not a broken grid — with link back to **`/products`**.  
   **Given** **`products.category`** is **`null`**, empty after trim, or unlisted **when** evaluating listing/filter behavior **then** those rows **never** appear on collection routes keyed to a concrete category key (they **may** still appear on **`/products`** per existing list rules — document in Dev Agent Record if different).  
   **Given** nav advertises a collection **when** that collection has no backing category key **then** either implement the route **or** remove/rename the nav item so **no primary nav link 404s** (today **`Navbar`** links **`/underwear`** with **no** matching route in [`App.tsx`](../../src/components/App/App.tsx) — resolve as part of this story). Route→category mapping **must** live in **one** checked-in module or constant map referenced by nav **and** **`AppRoutes`** so drift cannot recur silently.

3. **No placeholder-only category rails**  
   **Given** current **`GridSection`** + hardcoded **`womenItems` / `menItems`** patterns in [`App.tsx`](../../src/components/App/App.tsx) **when** this story completes **then** category/collection presentation is **driven by catalog data** (or a **small explicit route→filter config** checked into repo that maps to real **`category`** strings used in seed/admin). Remove or repurpose dead placeholder image cards that do not correspond to products.

4. **Routing & smoke tests**  
   **Given** [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) **when** routes change **then** update **`cases`** expectations so CI still asserts **known-good mount** behavior (replace hero title regexes if routes/components change). **Given** **admin** routes **when** unchanged **then** preserve existing admin smoke assertions.

5. **Performance & access**  
   **Given** NFR storefront mobile baseline **when** homepage + collection pages load **then** avoid **N+1** Supabase round-trips per product (prefer single list query + client filter, or one filtered query per page load). Keyboard user can reach primary CTAs and product cards (reuse existing link semantics).

## Tasks / Subtasks

- [x] **Task 1 — Catalog API surface (AC: 2, 3, 5)**  
  - [x] Extend [`CatalogAdapter`](../../src/catalog/adapter.ts) (and static adapter for tests) with e.g. **`listProductsByCategory(category: string)`** **or** document **single `listProducts()` + client filter** if product count stays small; ensure **active-only** parity with **`listProducts`**.  
  - [x] Centralize **category normalization** (trim, NFC, casefold, optional alias map file under `src/catalog/` if admin-entered strings vary); unit-test **Unicode edge cases** called out in Dev Notes table.

- [x] **Task 2 — UI components (AC: 1, 2, 3)**  
  - [x] New or updated components: **`HomePage`**, **`CollectionPage`** (names flexible) under `src/components/…`, using **`CatalogListItem`** / [`ProductList`](../../src/components/ProductList/ProductList.tsx) patterns for cards (reuse grid/card markup where possible — **don’t** fork cart logic).  
  - [x] Replace **`App.tsx`** inline placeholder arrays with routes wired to real data loaders.

- [x] **Task 3 — Nav integrity (AC: 2)**  
  - [x] Align [`Navbar.tsx`](../../src/components/Navbar/Navbar.tsx) routes with **`AppRoutes`** (add **`/underwear`** **or** remove/rename link).  
  - [x] Optional: add **`/products`** to nav if IA improves discoverability without clutter (product decision — if added, keep **UX-DR4** calm).

- [x] **Task 4 — Tests (AC: 4, 5)**  
  - [x] Update **`routes.smoke.test.tsx`**.  
  - [x] Add **Vitest** unit tests for category normalization / adapter filter logic (pure functions) with **mocked** Supabase **or** static adapter.

## Dev Notes

### Intent

Brownfield **`App.tsx`** still ships **placeholder collection rails**. Epic 6 E6-S1 replaces them with **credible** browsing entry points aligned to **real** `products.category` (see [`supabase-map.ts`](../../src/catalog/supabase-map.ts) **`category: string | null`**).

### Dev Agent Guardrails

- **Do not** add authenticated reads or service role to storefront catalog paths.  
- **Do not** invent a **multi-seller** marketplace taxonomy — **single seller**, simple categories.  
- **Preserve** canonical slug PDP at **`/product/:slug`**.  
- **Coordinate** URL strategy with **6-5** (metadata): slugs for collection pages should be **stable** once shipped.  
- **Taxonomy changes:** renaming **`category`** strings in Supabase **without** updating the route→category map breaks bookmarks — **document** owner steps (update map + smoke); **redirect tables** are **out of scope** unless PM asks.

### Category normalization (normative)

Apply **before** comparing route keys to **`products.category`** (and when validating the route→category map):

| Step | Rule |
|------|------|
| Trim | Leading/trailing whitespace removed. |
| Empty | After trim, empty string ⇒ treat as **uncategorized** (see AC2 **`null`/empty** behavior); **do not** match a named collection route by accident. |
| Unicode | Normalize to **NFC** **then** apply casefold for comparison so administration entry variants still match. |
| Case | Compare using **Unicode casefold** (e.g. **`localeCompare`** with **`sensitivity: 'accent'`** **or** **`toLocaleLowerCase`** only if NFC+casefold documented as insufficient — pick one implementation and unit-test it). |
| Aliases | Optional **`src/catalog/categoryAliases.ts`** (or equivalent): maps legacy/admin typo strings → canonical key used in URLs **and** filters. |

Collection URLs remain **single-category** (one dimension); products **cannot** appear on **two** collection routes unless **`category`** values duplicate — **multi-collection membership** is **out of scope**.

### Technical requirements

| Source | Requirement |
|--------|-------------|
| PRD §9.2 | FR-SF-003, FR-SF-004 |
| PRD §14 | Epic 6 E6-S1 |
| UX (epics.md §UX) | UX-DR1 routes; UX-DR4 premium DTC; UX-DR9 empty category |

### Architecture compliance

- Storefront stays in **“boring CRUD”** tier for this surface; still **mobile-first** and **adapter-backed** per [architecture.md](../planning-artifacts/architecture.md).

### File structure expectations

| Action | Paths |
|--------|-------|
| **Update** | [`src/components/App/App.tsx`](../../src/components/App/App.tsx); [`src/components/Navbar/Navbar.tsx`](../../src/components/Navbar/Navbar.tsx); [`src/catalog/adapter.ts`](../../src/catalog/adapter.ts); static catalog adapter peer |
| **New** | `src/components/Home/*` or `src/pages/*` (match existing layout conventions); optional `src/catalog/categoryNormalize.ts` |
| **Tests** | [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx); new `*.test.ts` for normalization/catalog |

### Testing requirements

- **Vitest** only in CI — **no** live Supabase requirement for unit tests.  
- Smoke tests must stay **fast** — avoid real network in `routes.smoke`.

### Previous story intelligence

- **Epic 5** completed admin order flows — **no** dependency on order APIs for this story.  
- **Epic 2** established **Supabase** as default catalog when env configured — verify **`VITE_*`** catalog mode in [`factory`](../../src/catalog/factory.ts) still defaults to static in tests.

### Project context reference

- Load [`project-context.md`](../../project-context.md) if present (skill `persistent_facts`).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Implementation: `listProductsByCategory` delegates to `listProducts()` + `filterListItemsByCategoryKey` (single round-trip for Supabase list; no per-product N+1).
- **AC2 note:** Products with `category` null/empty/whitespace still appear on **`/products`** via full `listProducts()`; they do **not** match any collection route filter (`productCategoryMatchesCanonical` returns false).

### Completion Notes List

- Branded **`/`** home (`HomePage`): Zephyr Lux hero, Shop all → `/products`, secondary CTA to first collection with catalog matches (fallback first route in `COLLECTION_ROUTES`), plus collection chip links.
- **`COLLECTION_ROUTES`** in `src/catalog/collections.ts` is the single map for paths, labels, hero copy, and **`categoryKey`**; **`AppRoutes`** and **`Navbar`** both consume it (includes **`/underwear`**).
- **`CollectionPage`** loads `listProductsByCategory`, reuses **`CatalogProductGrid`** (extracted from **`ProductList`**), empty state + link to **`/products`**.
- Normalization: **`categoryNormalize.ts`** + **`categoryAliases.ts`**; Vitest coverage for NFC-ish pairs, aliases, uncategorized exclusion from collections.
- Seed: **`data/products.json`** sets **`category`: `"underwear"`** on boxer briefs so **`/underwear`** lists real product in static mode.
- Smoke: homepage matcher **`/Premium essentials/i`**; added **`/underwear`**; policy routes assert **`heading`** to avoid footer duplicate text matches.
- Small TS hygiene for **`npm run build`**: `Product` import path in **`supabase-map.ts`**, **`pdpImage.test.ts`** duplicate spread key, **`ProductDetail`** `location.key` via typed narrow for analytics dedupe.

### File List

- data/products.json
- src/catalog/adapter.ts
- src/catalog/adapter-smoke.test.ts
- src/catalog/categoryAliases.ts
- src/catalog/categoryNormalize.ts
- src/catalog/categoryNormalize.test.ts
- src/catalog/collections.ts
- src/catalog/filterByCategory.ts
- src/catalog/filterByCategory.test.ts
- src/catalog/pdpImage.test.ts
- src/catalog/supabase-map.ts
- src/components/App/App.tsx
- src/components/CatalogProductGrid/CatalogProductGrid.tsx
- src/components/Collection/CollectionPage.tsx
- src/components/Hero/Hero.tsx
- src/components/Home/HomePage.tsx
- src/components/Navbar/Navbar.tsx
- src/components/ProductDetail/ProductDetail.tsx
- src/components/ProductList/ProductList.tsx
- src/components/ProductList/ProductList.test.tsx
- src/routes.smoke.test.tsx

### Change Log

- 2026-04-27 — Story 6-1: Real homepage; catalog-backed collection routes; shared `COLLECTION_ROUTES`; `listProductsByCategory`; category normalization + tests; smoke updates; build/test unblockers (`supabase-map`, `pdpImage.test`, `ProductDetail` location key).

### Review Findings

- [ ] [Review][Decision] Story scope vs. combined routing (`App.tsx` policy/contact) — Dependencies say policy/footer follow in **Story 6-2+**; the diff nevertheless registers `/policies/*` and `/contact` in storefront routes alongside homepage/collections. Decide whether this batch merge is intentional (single PR convenience) vs. scope hygiene (split `/policies` + `/contact` into the 6-2 change set).

- [ ] [Review][Patch] Unicode casefold parity for category buckets — Story Dev Notes prescribe NFC then **Unicode casefold** semantics for catalog matching; [`src/catalog/categoryNormalize.ts`](../../src/catalog/categoryNormalize.ts) uses `trim` + NFC + `toLocaleLowerCase('und')`, which differs from canonical case folding for some multilingual strings.

- [ ] [Review][Patch] Homepage loading shell vs. branded homepage — [`HomePage`](../../src/components/Home/HomePage.tsx) renders a bare “Loading…” `<main>` while the catalog hydrates instead of skeleton or Zephyr-branded markup, which weakens FR-SF-003 first paint polish under slow networks.

- [ ] [Review][Patch] Navbar “disabled” chrome controls search/account placeholders — Buttons use [`aria-disabled="true"`](../../src/components/Navbar/Navbar.tsx) without `disabled`; they remain keyboard-focusable with no usable action.

- [ ] [Review][Patch] Analytics effect dependency churn — [`ProductDetail`](../../src/components/ProductDetail/ProductDetail.tsx) `useEffect` for `product_view` depends on `[slug, row, locationNavKey]`; `row` identity may thrash unnecessarily and fire duplicate telemetry even when semantic product state is unchanged—narrow deps to primitives you actually read (`row?.product.id`, etc.).

- [x] [Review][Defer] Supabase `listProductsByCategory` always loads all active rows then filters locally — aligns with Story Dev Agent Record (“single round trip, no per-product N+1”) but will not scale indefinitely; revisit with a Postgres-side category filter once catalog cardinality grows materially. [`defer` rationale: pre-existing MVP trade documented in-record.]