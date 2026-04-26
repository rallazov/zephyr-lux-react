# Story 2.5: Supabase tables — catalog and inventory movements

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer** establishing Supabase as the **system of record** for the catalog,
I want **durable Postgres tables** for **`products`**, **`product_variants`**, **`product_images`**, and **`inventory_movements`** (plus **RLS** and a **documented env surface**) aligned to **PRD §12**,
so that **PRD §14 — Epic 2 / E2-S5**, **FR-CAT-001** (single canonical catalog path can evolve toward Supabase), **NFR-SEC-002** / **NFR-SEC-005** (no service-role leakage; RLS baseline), and the **cross-cutting seed/migration** note in [epics.md](_bmad-output/planning-artifacts/epics.md) are satisfied — **without** shipping **E2-S6 admin CRUD**, **Epic 4 `orders`**, or **full Storage upload** (FR-CAT-006 remains future work).

## Acceptance Criteria

1. **Given** [PRD §12.1 — Products / Variants / Images](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md) and [PRD §12.5 — `inventory_movements`](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md), **when** a maintainer applies the project’s **Supabase migrations** to a fresh database, **then** all four tables exist with **columns and enum domains** matching the PRD (names may be `snake_case`; use Postgres `ENUM` or `CHECK` constraints — **pick one** approach and use it consistently). **Required constraints:** `products.slug` **UNIQUE**; `product_variants.sku` **UNIQUE**; FK `product_variants.product_id` → `products.id`; FK `product_images.product_id` → `products.id`; FK `product_images.variant_id` → `product_variants.id` (nullable); FK `inventory_movements.variant_id` → `product_variants.id`. **`inventory_movements.order_id`:** store as **`UUID NULL`** per PRD, but **do not** add a foreign key to `orders` in this story — the `orders` table arrives in **Epic 4**; add a **follow-up migration** in E4-S1 (or document the exact story) to attach the FK.

2. **Given** **NFR-SEC-005** and storefront needs, **when** RLS is **enabled** on these tables, **then** the **`anon`** role can **`SELECT`** only what a **public storefront** needs: **active** catalog surface (e.g. `products.status = 'active'` and variant rows that should be visible — align with [productVariantStatusSchema](src/domain/commerce/enums.ts); typically expose **`active`** variants; **`inactive`/`discontinued`** behavior should match [2-4](2-4-variant-selector-size-color-price-stock.md) / PDP rules — **document** the policy choice). **`inventory_movements`:** **no** `anon` **`SELECT`** (admin/service paths only, future E2-S6 / Epic 4). **Inserts/updates/deletes** on catalog tables: **not** granted to `anon` in this story (admin/service role later).

3. **Given** **NFR-SEC-002** and [src/catalog/adapter.ts](src/catalog/adapter.ts), **when** the **browser** uses Supabase for catalog reads, **then** only **`VITE_`-safe** configuration is used (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — or the names already reserved in [.env.example](.env.example)); **`SUPABASE_SERVICE_ROLE_KEY`** stays **server-only** and **never** appears in client bundles. Update `.env.example` and [src/vite-env.d.ts](src/vite-env.d.ts) when new `VITE_*` keys are actually read.

4. **Given** [1-3-catalog-adapter-static-and-supabase](1-3-catalog-adapter-static-and-supabase.md) and [createCatalogAdapter](src/catalog/adapter.ts), **when** `VITE_CATALOG_BACKEND=supabase` (case-insensitive) and **not** in Vitest `import.meta.env.MODE === "test"`, **then** **`SupabaseCatalogAdapter`** implements **`listProducts()`** and **`getProductBySlug()`** returning the same **semantic shapes** as `StaticCatalogAdapter` ([CatalogListItem](src/catalog/types.ts), [CatalogProductDetail](src/catalog/types.ts)) by reusing **`productSchema` / `productVariantSchema`** ([src/domain/commerce/product.ts](src/domain/commerce/product.ts)) at the boundary — **no second Product model**. **If** env vars are missing in dev, fail with a **clear** error (not a silent empty catalog).

5. **Given** [2-1-canonical-product-variant-seed-data](2-1-canonical-product-variant-seed-data.md) and [parseStaticCatalogData](src/catalog/parse.ts), **when** data is loaded from Supabase, **then** **`storefrontProductId`** in `CatalogListItem` / `CatalogProductDetail` remains **defined** for **pre–Epic 3** cart behavior: add a **`products` column** (e.g. `legacy_storefront_id integer UNIQUE` **nullable**) populated for migrated rows **or** document a **breaking** cart strategy — **prefer** explicit column + backfill from seed JSON **`id`** so list/detail/cart parity matches static mode.

6. **Given** **`product_images`** exists, **when** building `Product` / variants for the SPA, **then** **`image_url`** on each [ProductVariant](src/domain/commerce/product.ts) is populated from **`product_images`** (variant-specific row wins; else product-level / `is_primary` / `sort_order` — **document** resolution). **`storage_path`** may be a **site-relative path** (e.g. `/assets/...`) consistent with current static assets until Supabase Storage is mandatory (**FR-CAT-006**).

7. **Given** **`inventory_movements`**, **when** this story completes, **then** the table is **ready** for Epic 4’s idempotent decrement (no trigger required here unless you choose to add a **documented** guardrail — default **no** triggers; Epic 4 owns write paths).

8. **Given** [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md), **when** the story ships, **then** `npm run build` and **`npm run smoke`** pass. **Vitest** must keep forcing **static** catalog ([readCatalogEnv](src/catalog/adapter.ts)). Add **unit tests** that **mock** the Supabase client **or** test **pure mappers** (rows → `Product`) so CI does **not** require live Supabase credentials.

## Tasks / Subtasks

- [x] **Task 1 — Repo layout + migrations (AC: 1, 7)**  
  - [x] Add `supabase/migrations/` with a timestamped migration (Supabase CLI convention).  
  - [x] Create enums + tables + indexes; defer `orders` FK on `inventory_movements.order_id`.

- [x] **Task 2 — RLS policies (AC: 2)**  
  - [x] Enable RLS on all four tables.  
  - [x] `anon` read policies for catalog; deny `anon` on `inventory_movements`.

- [x] **Task 3 — Env + client dependency (AC: 3)**  
  - [x] Add `@supabase/supabase-js` (pin **v2.x**, e.g. `^2.104` or current stable from npm at implementation time).  
  - [x] Document `VITE_SUPABASE_*` in `.env.example`; extend `vite-env.d.ts` if used.

- [x] **Task 4 — Adapter + mapping (AC: 4, 5, 6)**  
  - [x] Implement `SupabaseCatalogAdapter` queries (joins or multiple selects — avoid N+1 explosions on typical catalog sizes).  
  - [x] Centralize row→domain mapping (new module under `src/catalog/` recommended).  
  - [x] Handle `legacy_storefront_id` / cart compatibility per AC5.

- [x] **Task 5 — Seed path (optional but valuable)**  
  - [x] `supabase/seed.sql` **or** documented one-shot script from `data/products.json` → SQL inserts (must respect SKU/slug uniqueness).

- [x] **Task 6 — Tests (AC: 8)**  
  - [x] Mapper/unit tests; keep smoke green.

### Review Findings

- [x] [Review][Patch] Unify Supabase browser client construction — [src/lib/supabaseBrowser.ts](src/lib/supabaseBrowser.ts) `requireSupabaseBrowserClient()`; [src/catalog/adapter.ts](src/catalog/adapter.ts) default client uses it (singleton + single throw message). Applied 2026-04-26.
- [x] [Review][Patch] `getProductBySlug` normalizes `slug` with `trim()`; empty after trim returns `null`. [src/catalog/adapter.ts](src/catalog/adapter.ts). Applied 2026-04-26.
- [x] [Review][Defer] Malformed PostgREST embed payloads surface as `ZodError` from `productSchema` / `productVariantSchema` in [src/catalog/supabase-map.ts](src/catalog/supabase-map.ts) without a user-facing wrapper — pre-existing “fail fast at boundary” pattern; refine when error UX is in scope. — deferred, pre-existing
- [x] [Review][Defer] `listProducts` does not filter out products with an empty `product_variants` embed; bad data could list products with no variants — operational/data-integrity follow-up, not a 2-5 contract gap. — deferred, pre-existing
- [x] [Review][Defer] `PRODUCTS_CATALOG_SELECT` omits `alt_text` from `product_images`; a11y copy would need a follow-up when PDP consumes it. — deferred, pre-existing

## Dev Notes

### Dev Agent Guardrails

- **Scope:** **DDL + RLS + read-only storefront adapter** for catalog tables + **`inventory_movements` table only**. **Not** E2-S6 admin UI/API, **not** Epic 3 cart/checkout, **not** Epic 4 order/payment writes, **not** replacing Vercel Blob for orders.  
- **Single domain model:** reuse Zod schemas from [src/domain/commerce/product.ts](src/domain/commerce/product.ts).  
- **Test mode:** preserve `import.meta.env.MODE === "test"` → **static** catalog ([adapter.ts](src/catalog/adapter.ts)).

### Technical requirements

- **PRD E2-S5:** tables for products, variants, images, inventory movements.  
- **FR-CAT-001 / FR-CAT-003:** eventual single source; adapter output must stay variant/SKU-aligned.  
- **epics.md — Data Model:** match §12 field intent; seed/migration path from JSON without losing imagery.

### Architecture compliance

- [architecture.md](_bmad-output/planning-artifacts/architecture.md): Supabase system of record; **RLS as boundary**; service role only on server paths (none required in this story for storefront reads).  
- **Strangler:** static path remains default; Supabase is opt-in via `VITE_CATALOG_BACKEND`.

### Library / framework requirements

- **`@supabase/supabase-js` v2** — isomorphic client; use `createClient` with anon key only in SPA. See [Supabase JS reference](https://supabase.com/docs/reference/javascript/introduction).  
- **Postgres / Supabase CLI** — local `supabase db reset` should apply migrations cleanly.

### File structure requirements

| Area | Action |
|------|--------|
| `supabase/migrations/*.sql` | **NEW** — schema + RLS |
| `supabase/seed.sql` | **NEW** (optional) |
| [src/catalog/adapter.ts](src/catalog/adapter.ts) | **UPDATE** — implement `SupabaseCatalogAdapter` |
| `src/catalog/supabase-map.ts` (or similar) | **NEW** — row → `Product` / list/detail assembly |
| [.env.example](.env.example) | **UPDATE** — uncomment/document `VITE_SUPABASE_*` when wired |
| [src/vite-env.d.ts](src/vite-env.d.ts) | **UPDATE** if new `VITE_*` keys |
| `src/catalog/*.test.ts` | **NEW** or **UPDATE** — mapper / adapter unit tests |

### Testing requirements

- `npm run build` + `npm run smoke`.  
- No flaky network-dependent tests in CI; mock PostgREST responses or test mappers in isolation.

### Previous story intelligence (2-4, 2-3, 2-2, 2-1)

- **2-4** defines PDP variant UX and cart line identity (`storefrontProductId` + SKU); Supabase must not break **numeric** `storefrontProductId` until Epic 3 refactors cart ([2-4 AC5](2-4-variant-selector-size-color-price-stock.md)).  
- **2-3 / 2-2:** slug-based detail and list; indexes on `slug` matter for performance.  
- **2-1:** canonical seed in `data/products.json` — column mapping should be **mechanical** (cents, enums, SKU uniqueness).

### Git intelligence (recent commits)

- Recent work: catalog adapter (static + stub), TypeScript migration, env docs — keep this change **focused** on Supabase schema + adapter; avoid unrelated Stripe/API edits.

### Latest technical information

- **`@supabase/supabase-js`:** current **v2** line (e.g. **2.104.x** on npm as of early 2026); pin a **2.x** compatible version in [package.json](package.json). Follow [release notes](https://supabase.com/docs/reference/javascript/release-notes) for breaking changes when bumping.

### Project context reference

- No committed `project-context.md` matched the skill glob; rely on PRD §11–§12, [architecture.md](_bmad-output/planning-artifacts/architecture.md), [epics.md](_bmad-output/planning-artifacts/epics.md), and prior story files **2-1 … 2-4**.

### References

- [PRD §12 — Proposed Data Model](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md)  
- [PRD §14 — Epic 2, E2-S5](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-2-commerce-catalog-and-product-admin-foundation)  
- [epics.md — FR-CAT / Data Model / NFR-SEC](_bmad-output/planning-artifacts/epics.md)  
- [1-3](1-3-catalog-adapter-static-and-supabase.md), [2-1](2-1-canonical-product-variant-seed-data.md), [2-4](2-4-variant-selector-size-color-price-stock.md)

## Story completion status

- **Status:** `done`  
- **Note:** Schema, RLS, Supabase adapter, mapper tests, and optional seed delivered; code-review patches applied 2026-04-26 (`requireSupabaseBrowserClient` + slug `trim`). Epic 4 adds `orders` FK on `inventory_movements.order_id`.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

- `resolve_customization.py` unavailable (Python < 3.11); workflow merged manually from skill defaults.

### Completion Notes List

- **DDL:** `supabase/migrations/20260426180000_catalog_inventory.sql` — Postgres ENUMs for `product_status`, `product_variant_status`, `inventory_movement_reason`; tables per PRD §12.1 + §12.5; `products.legacy_storefront_id` (nullable UNIQUE) for cart parity; `inventory_movements.order_id` UUID without FK; column comments for `created_by` / `order_id` follow-up.
- **RLS:** `anon` SELECT on `products` where `status = 'active'`; `product_variants` and `product_images` only when parent product is active (variants of all **statuses** visible so PDP can show inactive/discontinued/OOS per 2-4); no `anon` policies on `inventory_movements`.
- **Client:** `@supabase/supabase-js` v2; `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` documented; adapter throws a clear error if missing when `VITE_CATALOG_BACKEND=supabase`.
- **Mapping:** `src/catalog/supabase-map.ts` — image resolution: variant-specific `product_images` wins (primary + sort_order), else product-level; `storage_path` → `image_url`; `legacy_storefront_id` required for list/detail assembly (throws with backfill guidance if null).
- **Shared list row:** `catalogListItemFromProduct` exported from `parse.ts` for static + Supabase parity.
- **Tests:** `supabase-map.test.ts` exercises mapper and image resolution; Vitest still forces static catalog via `readCatalogEnv`; no live Supabase in CI.
- **Smoke:** `ProductDetail` not-found path now exposes `data-testid="product-detail-not-found"`, heading, and `Link` to `/products` for `routes.smoke.test.tsx`.
- **Catalog index:** fixed broken `staticRawCatalogSchema` export → `staticSeedCatalogSchema` / `staticSeedProductRowSchema`.

### File List

- `supabase/migrations/20260426180000_catalog_inventory.sql`
- `supabase/seed.sql`
- `package.json`
- `package-lock.json`
- `.env.example`
- `src/vite-env.d.ts`
- `src/catalog/adapter.ts`
- `src/catalog/supabase-map.ts`
- `src/catalog/supabase-map.test.ts`
- `src/catalog/parse.ts`
- `src/catalog/index.ts`
- `src/components/ProductDetail/ProductDetail.tsx`

### Change Log

- 2026-04-26: Story 2-5 — Supabase catalog schema + RLS, SupabaseCatalogAdapter + mapper, env docs, seed.sql, unit tests; PDP not-found UI for route smoke; catalog barrel export fix.

## Questions (non-blocking; saved for end)

- **RLS nuance:** If **`draft`** products must never leak, confirm policies filter `products.status` and join paths cannot expose hidden variants — add regression test in SQL comments or policy names.  
- **`inventory_movements.created_by`:** PRD references UUID; align with future **Supabase Auth** user id vs nullable until admin exists — document chosen interpretation.
