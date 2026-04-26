# Story 2.1: Canonical product/variant seed data

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer preparing the Supabase-backed catalog (and keeping the static path honest until E2-S5),
I want **current Zephyr Lux products expressed as canonical, validated seed data** (products + purchasable variants) in one authoritative place,
so that **FR-CAT-001** (single canonical catalog), **FR-CAT-003** (every purchasable option is a variant with SKU, size, color, price, currency, inventory, status, image mapping), and **PRD §14 Epic 2 / E2-S1** are satisfied—and **E2-S5** can load the same facts without re-deriving dollars/camelCase in code.

## Acceptance Criteria

1. **Given** [PRD §14 — Epic 2, E2-S1](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-2-commerce-catalog-and-product-admin-foundation) and **FR-CAT-003**, **when** a maintainer inspects the repo’s **authoritative static seed**, **then** every **current** purchasable variant for Zephyr Lux appears **once** with a **unique SKU**, and each row includes at minimum: linkage to a product slug, **size** and **color** (where applicable), **price** in a **non-ambiguous** representation (integer **cents** preferred in the canonical file), **currency**, **inventory quantity**, **variant status** (active/inactive/discontinued per domain enums), and **image URL/path** where the storefront expects imagery.
2. **Given** [src/domain/commerce/product.ts](src/domain/commerce/product.ts) (`productSchema`, `productVariantSchema`) and story [1-2-define-shared-commerce-domain-types](1-2-define-shared-commerce-domain-types.md), **when** seed data is loaded at the JSON boundary, **then** it is validated with **Zod** (reuse or extend existing schemas—**no second parallel Product model**). Invalid seed must **fail fast** with a clear error (same discipline as [src/catalog/parse.ts](src/catalog/parse.ts) today).
3. **Given** [epics.md — Data Model §12](_bmad-output/planning-artifacts/epics.md) (`products` / `product_variants` / `product_images` fields) and current MVP needs, **when** seed is authored, **then** product-level fields needed for storefront trust and future admin (e.g. **description**, **care_instructions**, **category**, **brand**, **subtitle**, **origin**—where known) are **either** populated from existing copy/assets **or** explicitly documented as deferred with `null`/omit only if the schema allows and UX still matches **PRD §13 UX-DR6** for fields already shown in the UI. **Do not** silently drop fields that the live product page already displays without replacing them from seed.
4. **Given** story [1-3-catalog-adapter-static-and-supabase](1-3-catalog-adapter-static-and-supabase.md), **when** E2-S1 completes, **then** the **same** file remains the **single authoritative static source** for [src/catalog/static-bundled.ts](src/catalog/static-bundled.ts) and [api/_lib/catalog.ts](api/_lib/catalog.ts) (or a **documented rename** with all import sites updated in one change). No revival of competing `public/*.json` catalog “truths” without consolidation notes in Dev Notes.
5. **Given** [src/context/CartContext.tsx](src/context/CartContext.tsx) still keys cart rows by numeric **`id`** until Epic 3, **when** seed is reshaped, **then** either **preserve** a stable numeric **storefront / legacy id** per product in the seed (recommended) **or** document a deliberate breaking change and the mitigation (e.g. cart clear migration)—**prefer non-breaking** for this story.
6. **Given** **NFR-MAINT-001** and [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md), **when** implementation lands, **then** `npm run build` and **`npm run smoke`** still pass; **known-good slug** for product detail smoke remains valid (today **`boxer-briefs`** from [data/products.json](data/products.json)) **or** smoke + Dev Notes are updated together in the same PR.
7. **Given** **NFR-SEC-002**, **when** adding any tooling to generate seed from Supabase, **then** **no** service-role or secret keys are committed; any future CLI stays local/env-driven (out of scope to implement Supabase in this story unless you explicitly split scope with PM).

## Tasks / Subtasks

- [x] **Task 1 — Inventory current catalog surface (AC: 1, 3, 4)**  
  - [x] List all product slugs and SKUs that must exist after E2-S1; confirm none missing vs. current storefront and `data/products.json`.  
  - [x] Scan UI/components for displayed fields (title, fabric, care, images, price range) and map to seed fields.

- [x] **Task 2 — Define canonical seed shape (AC: 1, 2, 4)**  
  - [x] Choose **one** authoring format: e.g. domain-aligned JSON (snake_case, `price_cents`) **or** keep a thin raw layer but **document** it as intentional and ensure validation produces `Product`/`ProductVariant` identically for SPA + API.  
  - [x] Add/adjust Zod for the **file** shape in [src/catalog/](src/catalog/) (extend [raw-static.ts](src/catalog/raw-static.ts) or replace with `seedCatalogSchema` wrapping `productSchema` + metadata like legacy numeric id).  
  - [x] Update [parse.ts](src/catalog/parse.ts) mappers so **`parseStaticCatalogData`** output matches current behavior unless the story **intentionally** improves fidelity (document deltas).

- [x] **Task 3 — Author / migrate JSON (AC: 1, 3, 5)**  
  - [x] Update [data/products.json](data/products.json) (or successor path) with canonical content; preserve imagery paths under [public/](public/) or [public/assets/](public/assets/) as today.  
  - [x] Ensure **SKU uniqueness**; align duplicate-SKU policy with [api/_lib/catalog.ts](api/_lib/catalog.ts) (warn + first-wins today—prefer fixing data over hiding duplicates).

- [x] **Task 4 — Wire server + bundle (AC: 4, 6)**  
  - [x] Confirm [api/_lib/catalog.ts](api/_lib/catalog.ts) still loads `data/products.json` and uses `parseStaticCatalogData`.  
  - [x] Confirm [static-bundled.ts](src/catalog/static-bundled.ts) still resolves after any path/name change.

- [x] **Task 5 — Tests (AC: 2, 6)**  
  - [x] Extend or add a focused unit test (e.g. alongside [src/catalog/adapter-smoke.test.ts](src/catalog/adapter-smoke.test.ts)) that valid seed parses and invalid seed throws.  
  - [x] Run `npm run smoke` locally; fix route smoke if slug or copy landmarks change.

## Dev Notes

### Dev Agent Guardrails

- **Scope:** Seed data + validation + parse/adapter wiring only. **Do not** implement `SupabaseCatalogAdapter` queries, RLS, or admin CRUD (E2-S5, E2-S6). **Do not** refactor cart to SKU identity (Epic 3).  
- **Single seller**; no multi-tenant modeling.  
- **Preserve** [readCatalogEnv()](src/catalog/adapter.ts) test-mode `static` behavior and **do not** embed secrets in the client bundle.  
- **TypeScript** remains canonical; no new runtime validation library beyond **Zod**.

### Technical requirements

- **FR-CAT-001 / FR-CAT-003:** One catalog source; variants are the purchasable unit with explicit SKU, pricing, inventory, status.  
- **PRD E2-S1:** “Convert current products to canonical product/variant seed data.”  
- **Epic 2 acceptance (PRD):** “Current Zephyr Lux product(s) can be represented with all purchasable variants.”

### Architecture compliance

- [architecture.md](_bmad-output/planning-artifacts/architecture.md): Catalog adapter + shared domain types; strangler sequence—static catalog must stay coherent before Supabase migration.  
- [epics.md — Cross-cutting](_bmad-output/planning-artifacts/epics.md): “Seed/migration path: existing JSON catalog must migrate to Supabase `products`/`product_variants`/`product_images` without losing current product imagery.” E2-S1 should make that migration **mechanical** (field alignment).

### Library / framework requirements

- **Zod** `^4.x` (repo pin)—match patterns in [src/domain/commerce](src/domain/commerce).  
- **Vite 5** JSON import for bundled catalog unchanged unless you change strategy (then update [vite.config.ts](vite.config.ts) only if required).

### File structure requirements

| Area | Action |
|------|--------|
| [data/products.json](data/products.json) (or documented successor) | **UPDATE** — canonical seed content |
| [src/catalog/raw-static.ts](src/catalog/raw-static.ts) | **UPDATE** or **REPLACE** — Zod input shape for seed file |
| [src/catalog/parse.ts](src/catalog/parse.ts) | **UPDATE** — mapping into `Product` / `CatalogListItem` / `CatalogProductDetail` |
| [src/catalog/static-bundled.ts](src/catalog/static-bundled.ts) | **UPDATE** if import path changes |
| [api/_lib/catalog.ts](api/_lib/catalog.ts) | **UPDATE** only if path or parse signature changes |
| `src/catalog/*.test.ts` or similar | **UPDATE** or **NEW** — seed validation tests |

### Testing requirements

- `npm run build` and `npm run smoke` must pass (CI in [.github/workflows/ci.yml](.github/workflows/ci.yml)).  
- Prefer **one** deterministic test that rejects malformed seed (duplicate SKU, missing slug, draft with zero variants, etc.).

### Previous story intelligence (Epic 1)

- **1-5:** Vitest + RTL smoke; slug **`boxer-briefs`**; `import.meta.env.MODE === "test"` forces static catalog; `AppRoutes` test pattern—keep smoke green.  
- **1-3:** Authoritative file is `data/products.json`; [parseStaticCatalogData](src/catalog/parse.ts) is the shared normalization entry for SPA + API.  
- **1-2:** All catalog outputs must trace to `src/domain/commerce` types—extend schemas there if the **domain** truly needs new fields, not ad-hoc TS in components.

### Git intelligence (recent commits)

- Recent history emphasizes **catalog adapter**, **TypeScript migration**, and **docs/env**—keep changes **focused** on seed + parse; avoid unrelated API/checkout edits in the same PR.

### Latest technical information

- **Supabase** CLI seeding (for **later** E2-S5): production projects often use `supabase/seed.sql` or a seed script; this story may **note** the intended column mapping in Dev Agent Record when JSON shape stabilizes—**no obligation** to add Supabase folders until E2-S5.  
- **Zod 4**: use `.superRefine` on product-level invariants consistently with [product.ts](src/domain/commerce/product.ts).

### Project context reference

- No `project-context.md` matched the skill glob; rely on this file, [zephyr-lux-commerce-prd.md §14 Epic 2](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md), [architecture.md](_bmad-output/planning-artifacts/architecture.md), and [epics.md](_bmad-output/planning-artifacts/epics.md).

### References

- [PRD §14 — Epic 2, E2-S1, acceptance](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-2-commerce-catalog-and-product-admin-foundation)  
- [epics.md — FR-CAT-003, Data Model §12, seed/migration note](_bmad-output/planning-artifacts/epics.md)  
- [1-3 — Catalog adapter](1-3-catalog-adapter-static-and-supabase.md)  
- [1-2 — Domain types](1-2-define-shared-commerce-domain-types.md)  
- [1-5 — Smoke / CI](1-5-smoke-test-or-script-clean-build-routes.md)

## Story completion status

- **Status:** `done`  
- **Note:** E2-S1 delivered: `data/products.json` is domain-aligned, Zod-validated, single source for bundle + API. Code review 2026-04-26 patches applied (list `inStock` + seed `description`/`care_instructions`).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

(none)

### Completion Notes List

- **Task 1 inventory:** One product slug `boxer-briefs` (MVP), SKUs `ZLX-BLK-S` … `ZLX-BLU-M` unchanged in count. List/detail UI use `title`, `fabric_type` (as “fabric” line), price from variants, and `image_url` / hero. **`description`** matches the [Hero](src/components/Hero/Hero.tsx) marketing line; **`care_instructions`** is standard bamboo-garment care. PDP (post–2-3) can read these from the adapter; they are optional at the Zod/parse boundary.
- **Canonical file shape:** `data/products.json` is snake_case, `price_cents` + `currency`, explicit `status` on product and variants, `image_url` on variants, legacy `id` = `101` preserved for `storefrontProductId` / cart.
- **Zod:** `staticSeedProductRowSchema` = legacy `id` + fields validated by `productSchema` in `superRefine`; `staticSeedCatalogSchema` = array + global **unique SKU** (invalid seed throws before adapter). `parseStaticCatalogData` null→undefined preprocess for JSON.
- **E2-S5 column mapping (mechanical):** `id` (seed) → future `storefront`/`external_id` or products metadata until UUIDs exist; `slug`, `title`, `subtitle`, `description`, `brand`, `category`, `fabric_type`, `care_instructions`, `origin`, `status` → `products` row; variant rows map to `product_variants` (`sku`, `size`, `color`, `price_cents`, `currency`, `inventory_quantity`, `low_stock_threshold?`, `status`, `image_url`); multiple images in DB can be modeled later from per-variant `image_url` and/or a `product_images` join.
- **api/_lib/catalog.js** aligned with [api/_lib/catalog.ts](api/_lib/catalog.ts) (parse + `price_cents`) so plain-JS Vercel entry points don’t read obsolete dollar `price` from JSON.

### Change Log

- 2026-04-26 — Story 2-1: canonical `data/products.json`, `raw-static` + `parse` Zod pipeline, `parse.test.ts`, duplicate-SKU hard fail, `catalog.js` sync; tests updated for new seed shape; `npm run build` and `npm run smoke` pass.
- 2026-04-26 — Code review follow-up: list `inStock` uses purchasable predicate; `description` + `care_instructions` in seed; `parse.list.test` regression for inactive+stocked edge case.

### File List

- `data/products.json`
- `src/catalog/raw-static.ts`
- `src/catalog/parse.ts`
- `src/catalog/parse.test.ts` (new)
- `src/catalog/parse.list.test.ts`
- `api/_lib/catalog.js`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-1-canonical-product-variant-seed-data.md`

### Review Findings

- [x] [Review][Patch] Align list `inStock` with purchasable rules — [src/catalog/parse.ts:44-55](src/catalog/parse.ts) — fixed: `inStock` uses `some(isPurchasableVariant)`.
- [x] [Review][Patch] AC3 / seed: `description` and `care_instructions` added in [data/products.json](data/products.json); Dev Agent Record updated.
- [x] [Review][Defer] Pair-maintain `api/_lib/catalog.js` and `api/_lib/catalog.ts` for plain-JS Vercel entry points — [api/_lib/catalog.js](api/_lib/catalog.js) — deferred, pre-existing dual-file API pattern; ensure changes stay in sync in reviews.

## Questions (non-blocking)

- Should canonical seed include **placeholder UUIDs** for `product.id` / variant `id` to match future Supabase rows, or stay **id-less** until E2-S5 migration assigns them? **Recommendation:** optional UUIDs only if migration script needs them; otherwise omit to avoid false stability.  
- If marketing copy for care/fabric lives only in JSX today, should E2-S1 **pull** it into JSON or accept **minimal** seed and defer to **2-2/2-3**? **Recommendation:** pull any string already shown on the live PDP into seed so copy is data-driven for Epic 2.
