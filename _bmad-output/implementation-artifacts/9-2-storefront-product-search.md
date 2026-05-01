# Story 9.2: Storefront product search

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want to **find products by typing a few words that match the product name or its category**,
so that I can **reach relevant PDPs without browsing every collection**.

## Acceptance Criteria

1. **Given** the storefront header today exposes a **disabled** search control with `aria-label="Search (coming soon)"` in [`Navbar.tsx`](../../src/components/Navbar/Navbar.tsx), **when** this story ships, **then** there is a **real entry point**: the search icon is **enabled** and navigates customers to a dedicated search experience (recommended: `/search`), and optionally a **visible nav link** (e.g. “Search”) appears alongside existing collection/home/shop links for keyboard and mobile menu parity.

2. **Given** [`getDefaultCatalogAdapter()`](../../src/catalog/factory.ts) and [`CatalogAdapter.listProducts()`](../../src/catalog/adapter.ts) (already restricted to **active** products for Supabase; static parse already drops non-browsable rows per [`parseStaticCatalogData`](../../src/catalog/parse.ts)), **when** the customer submits a non-empty query, **then** results include only **storefront-browsable / active** products whose **`product.title`** matches **case-insensitively** (Unicode-aware normalization consistent with existing category helpers—at minimum **trim + locale-insensitive fold**; prefer reusing patterns from [`categoryNormalize.ts`](../../src/catalog/categoryNormalize.ts) where sensible) **or** whose **`product.category`** matches the query after the same normalization (treat missing/empty category as non-matching for category leg unless title matches).

3. **Given** a query with **only whitespace**, **when** the customer searches, **then** the UI does not claim “no matches” without intent: show **guidance to enter a term** or disable submit—pick one explicit pattern and test it.

4. **Given** a valid query that matches **no** products, **when** results render, **then** the customer sees a **designed empty state** (copy + link to `/products` or home—not a blank grid), aligned with **UX-DR9** empty-state expectations in [`epics.md`](../planning-artifacts/epics.md).

5. **Given** [`FR-SF-005`](../planning-artifacts/epics.md) and the **Epic 9** row (“title/category” only), **when** implementation is complete, **then** **facet filters** (size, color, price band, availability facets) remain **out of scope**—do not block this story on full FR-SF-005; a follow-up may extend search.

6. **Given** **NFR-A11Y** / **UX-DR12–DR13**, **when** using search, **then** the query field has an associated **visible label** (or `aria-label` + unambiguous `placeholder` policy—prefer visible label), **Enter** submits, **Escape** clears or closes any overlay if you implement a modal pattern (prefer full **`/search`** page to reduce focus complexity), and focus order works in mobile nav after navigation.

7. **Given** repository standards, **when** the feature is done, **then** **`npm run build`**, **`npm test`**, and **`npm run smoke`** pass; add focused **RTL** coverage for the search page (happy path + empty matches + whitespace handling) and extend [`routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) to hit **`/search`**.

8. **Given** **dependency note** from [sprint change §4.3](../planning-artifacts/sprint-change-proposal-2026-04-30.md) (9-1 optional parallel), **when** implementing, **then** do **not** require 9-1 merge for search logic—search operates on whatever active catalog the adapter returns; avoid hard-coding SKU assumptions from 9-1.

## Tasks / Subtasks

- [x] **Task 1 — Routing & shell (AC: 1, 7)**  
  - [x] Add `/search` route under the storefront [`Layout`](../../src/components/App/Layout.tsx) in [`App.tsx`](../../src/components/App/App.tsx).  
  - [x] New page component (e.g. `src/components/Search/SearchPage.tsx` or `src/pages/SearchPage.tsx`)—match colocation patterns used by [`ProductList.tsx`](../../src/components/ProductList/ProductList.tsx).

- [x] **Task 2 — Navbar entry (AC: 1, 6)**  
  - [x] Replace disabled search **`button`** with [`Link`](https://reactrouter.com/en/main/components/link) to `/search` **or** `useNavigate` + `button` that navigates—ensure **no** `disabled` state; update **`aria-label`** to describe action (e.g. “Search products”).  
  - [x] Optional: add **Search** `<li>` inside `.nav-links` beside Home/Shop; mirror close-mobile-menu behavior.

- [x] **Task 3 — Search logic (AC: 2, 3, 8)**  
  - [x] Load products via `getDefaultCatalogAdapter().listProducts()` once per mount (or cached pattern consistent with [`ProductList`](../../src/components/ProductList/ProductList.tsx)).  
  - [x] Implement **client-side** filter (sprint proposal allows “client or lightweight API”; default client to avoid new API surface).  
  - [x] Parse optional **`q`** from [`useSearchParams`](https://reactrouter.com/en/main/hooks/use-search-params) so `/search?q=briefs` is deep-linkable—keep in sync with input on submit.

- [x] **Task 4 — UI & empty states (AC: 3, 4)**  
  - [x] Reuse [`CatalogProductGrid`](../../src/components/CatalogProductGrid/CatalogProductGrid.tsx) for hits.  
  - [x] Loading and error patterns align with [`ProductList.tsx`](../../src/components/ProductList/ProductList.tsx) (spinner text + user-facing error).

- [x] **Task 5 — Tests (AC: 7)**  
  - [x] `SearchPage` RTL tests with **mocked adapter** if existing patterns allow; else `MemoryRouter` + static-mode catalog like [`ProductList.test.tsx`](../../src/components/ProductList/ProductList.test.tsx).  
  - [x] Smoke route for `/search`.

- [x] **Task 6 — SEO / meta (AC: 7)**  
  - [x] Call [`usePageMeta`](../../src/seo/meta.ts) with sensible title/description for `/search` (and optionally noindex for thin pages—default to simple title unless PM specifies).

## Dev Notes

### Dev Agent Guardrails

- **Canonical catalog:** Single source per **FR-CAT-001**—never duplicate product lists from ad-hoc JSON fetches; use **`CatalogAdapter` only**.  
- **Category matching:** `Product.category` is optional (`z.string().optional()` in [`product.ts`](../../src/domain/commerce/product.ts)); use [`normalizeCategoryKey`](../../src/catalog/categoryNormalize.ts) for stable comparison; do not invent parallel taxonomies.  
- **Scope:** Title + category only—no Stripe, no checkout, no Supabase schema changes for this story.  
- **Do not** implement **9-3** `coming_soon` badges or waitlist in the search grid unless already present in list items from the adapter.

### Technical requirements

- **FR-SF-005 (minimal):** Deliver **title/category** search and remove “coming soon” search affordance—satisfies approved sprint scope, not the full filter matrix in the PRD bullet.  
- **Performance:** Small catalog—client filter is fine; if list grows >~500 rows, extract shared API later (not required here).

### Architecture compliance

- **Stack:** React SPA + React Router v6; TypeScript canonical per [`architecture.md`](../planning-artifacts/architecture.md).  
- **Accessibility:** Architecture flags a11y as binding—prefer native labeled controls; if introducing primitives later, prefer headless accessible components; **this story** should not regress keyboard nav.  
- **API split:** No Railway/Vercel handler required for default implementation; keep **`apiUrl`** / server catalog paths unchanged.

### Library / framework requirements

- **None new.** React Router hooks + existing Vitest/RTL.

### File structure requirements

| Area | Action |
|------|--------|
| [`src/components/App/App.tsx`](../../src/components/App/App.tsx) | **UPDATE** — register `/search` route |
| [`src/components/Navbar/Navbar.tsx`](../../src/components/Navbar/Navbar.tsx) | **UPDATE** — enable search entry |
| New `SearchPage` module | **NEW** — page + CSS if needed |
| [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) | **UPDATE** |
| [`src/components/Navbar/Navbar.scroll.test.tsx`](../../src/components/Navbar/Navbar.scroll.test.tsx) or new navbar test | **UPDATE** if tests assert disabled search |

### Testing requirements

- `npm run build`  
- `npm test`  
- `npm run smoke`

### Previous story intelligence

- **[9-1](9-1-fixed-assortment-pack-catalog.md)** focuses on pack SKUs, seed/static alignment, and PDP tests—**search** should rely on **adapter list items**, not specific boxer-briefs SKU strings. After 9-1, titles/categories may change; tests should use **stable mock data** or generic strings.

### Git intelligence summary

- Recent work touched storefront/nav (`Refine storefront UX and mobile header behavior`, premium dark system). **Preserve** Navbar scroll / mobile menu behaviors when adding Search link.

### Latest tech information

- React Router **v6** `useSearchParams` for shareable queries; no additional dependencies.

### Project context reference

- No `project-context.md` found in-repo via BMAD skill glob; rely on this story + [`epics.md`](../planning-artifacts/epics.md) + [`architecture.md`](../planning-artifacts/architecture.md).

### References

- [Epic 9 table — story 9-2](../planning-artifacts/epics.md)  
- [Sprint change §4.3 — story 9-2 acceptance wording](../planning-artifacts/sprint-change-proposal-2026-04-30.md)  
- **FR-SF-005** — [`epics.md` §9.2](../planning-artifacts/epics.md)

### Questions / clarifications (non-blocking)

1. **Exact URL:** `/search` vs `/products/search`—default **`/search`** for shorter nav; change if SEO requires hierarchy.  
2. **Substring vs tokenized:** MVP **substring** on folded title/category is acceptable unless PM requires multi-word AND logic.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent implementing dev-story workflow).

### Debug Log References

—

### Completion Notes List

- Added `/search` route and `SearchPage`: loads catalog via `getDefaultCatalogAdapter().listProducts()`, filters client-side using `normalizeCategoryKey`-based needles in [`searchMatch`](../../src/catalog/searchMatch.ts); `q` search param synced on submit and with input via `useSearchParams`; Enter submits via form; Escape clears draft and drops `q`.
- Whitespace-only queries: Submit disabled until a normalized needle exists; URL-only whitespace (`has(Q_PARAM)` + null needle) shows `role="status"` guidance—not the “no matches” panel.
- Navbar: Search icon is a `Link` to `/search` with `aria-label="Search products"`; added “Search” link in nav list with mobile menu close on navigate; `Navbar.css` splits `button.nav-icon-btn` vs `a.nav-icon-btn` so the search control is clickable (account remains disabled button).
- Tests: `searchMatch.test.ts`, `SearchPage.test.tsx` (happy path, empty state, whitespace URL, idle no fake empty, disabled submit, Escape); smoke includes `/search`.
- Verified: `npm test -- --run`, `npm run build`, `npm run smoke`.

### File List

- `src/components/App/App.tsx`
- `src/components/Navbar/Navbar.tsx`
- `src/components/Navbar/Navbar.scroll.test.tsx`
- `src/components/Search/SearchPage.tsx`
- `src/components/Search/SearchPage.test.tsx`
- `src/catalog/searchMatch.ts`
- `src/catalog/searchMatch.test.ts`
- `src/routes.smoke.test.tsx`

### Change Log

- **2026-04-30** — Implemented storefront `/search`: adapter-backed client filtering (title/category, Unicode-normalized substring), Navbar entry points, UX-DR9-style zero-hit empty state with links to `/products` and `/`, RTL + smoke coverage. Story moved to review.

- **2026-04-30** — Code review: added deep-link RTL coverage and Escape clears `location.search`; Data Router avoided in tests (jsdom `AbortSignal`), using `MemoryRouter` + `useLocation` probe instead.

### Review Findings

- [x] [Review][Patch] Cover deep-linked `/search?q=…` in RTL (results without submit) — AC / Task 3 requires shareable `q`; implementation matches `useSearchParams`, but tests only submit via the form or exercise `q` for Escape/whitespace; add e.g. `renderSearch("/search?q=slip")` + assert hit grid after load to guard regressions. [`src/components/Search/SearchPage.test.tsx`]

- [x] [Review][Patch] Strengthen Escape test: assert `q` is removed from the URL — asserted via `MemoryRouter` + `useLocation` probe (`createMemoryRouter`/`RouterProvider` hits jsdom `AbortSignal` issues with RR data APIs). [`src/components/Search/SearchPage.test.tsx`]
