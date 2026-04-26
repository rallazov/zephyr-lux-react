# Story 1.3: Catalog adapter (static now, Supabase later)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer building storefront and API features on one commerce model,
I want a **catalog adapter** with a stable interface that reads **static** catalog data today and can be backed by **Supabase** later without rewriting product list/detail callers,
so that FR-CAT-001 (single canonical catalog), PRD Release 0 (“product list and product detail read from a single catalog adapter”), and the architecture’s “Catalog adapter” component are satisfied—**and** the team knows exactly where product data comes from.

## Acceptance Criteria

1. **Given** [PRD §14 E1-S3](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability) and [PRD §8 Release 0 exit criteria](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#release-0-brownfield-stabilization) (“Product list and product detail read from a single catalog adapter”), **when** the storefront loads products for the list route and resolves a product for `/product/:slug`, **then** **both** flows use the **same** catalog module (same interface / same factory), not independent `fetch` + ad-hoc types.
2. **Given** story [1-2-define-shared-commerce-domain-types](1-2-define-shared-commerce-domain-types.md) (E1-S2), **when** the adapter returns catalog entities, **then** they are expressed as the **shared** `Product` / variant types (or explicit view models **derived** from `z.infer<>`) from that module—**no** parallel `interface Product` in `ProductList.tsx` / `ProductDetail.tsx` for the data shape returned by the adapter. *(If E1-S2 is not merged yet, complete E1-S2 first or land both in a single PR so types exist before UI wiring—do not invent a second domain model.)*
3. **Given** the current **three** static shapes in the repo (`data/products.json` = variant-level, matches [api/_lib/catalog.ts](api/_lib/catalog.ts); `public/products.json` and [public/assets/products.json](public/assets/products.json) = flat / marketing list), **when** the static adapter is implemented, **then** the story **documents** which file is the **authoritative** static source for the transition and **normalizes** (parse + map + validate) into the canonical product/variant model so list and detail are consistent. At least one redundant conflicting JSON path is **removed, consolidated, or demoted** with a short comment in Dev Notes (avoid three competing “truths” without explanation).
4. **Given** [api/_lib/catalog.ts](api/_lib/catalog.ts) (server: `loadCatalog`, `findVariantBySku`, `computeAmountCents`), **when** this story is done, **then** the API **reuses the same** normalization/types as the SPA adapter path (import shared mappers or call the same module)—local `Product` / `Variant` types in that file are replaced with shared types or `import type` from the domain module, with behavior preserved for checkout amount calculation.
5. **Given** “Supabase later” in E1-S3, **when** a developer inspects the catalog layer, **then** there is a **defined interface** (e.g. `listProducts`, `getProductBySlug`—exact names are an implementation choice) and a **pluggable** path for a future `Supabase` implementation: either a second implementation class/file that is **not** wired in production, or a factory that selects implementation by config and **defaults to static** for Epic 1. **Do not** add `@supabase/supabase-js` or query Supabase in this story unless you also add the schema (that is Epic 2); a **stub** that throws a clear `Error` or no-ops with a dev-only comment is acceptable to prove the seam.
6. **Given** NFR-SEC-002 and [architecture.md](_bmad-output/planning-artifacts/architecture.md) secret boundaries, **when** the browser bundle is built, **then** the catalog adapter for the SPA does **not** embed Supabase service-role keys or any server-only secret—static path uses public fetches/imports only.
7. **Given** NFR-MAINT-001, **when** the work is finished, **then** `npm run build` passes; new files are TypeScript; no new validation library beyond **Zod** (already in repo) for parsing static JSON at boundaries.

## Tasks / Subtasks

- [ ] **Task 0 — Prerequisite (AC: 2)**  
  - [ ] Confirm [1-2](1-2-define-shared-commerce-domain-types.md) shared module exists (e.g. `src/domain/commerce` or path chosen in 1-2) with `Product` + variant schemas. If not, **stop** and implement/merge 1-2 first.

- [ ] **Task 1 — Interface + static implementation (AC: 1, 3, 6, 7)**  
  - [ ] Add a small `src/catalog/` (or `src/lib/catalog/`) area: `CatalogAdapter` interface, `createCatalogAdapter()` (or env-based factory), **static** implementation that loads/validates JSON → canonical types.  
  - [ ] Replace inline fetch logic in [ProductList.tsx](src/components/ProductList/ProductList.tsx) and [ProductDetail.tsx](src/components/ProductDetail/ProductDetail.tsx) with calls to the adapter.  
  - [ ] Unify `title` vs `name`, dollars vs `*_cents`, and slug presence per canonical model; document any temporary display-only fields.

- [ ] **Task 2 — Server alignment (AC: 4)**  
  - [ ] Refactor [api/_lib/catalog.ts](api/_lib/catalog.ts) to use shared parse/normalize helpers from Task 1 (or re-export the same `loadCatalog` semantics built on the shared model).  
  - [ ] Ensure SKU lookup and `computeAmountCents` still match **integer cents** rules from story 1-2 (no silent dollar/cents mix).

- [ ] **Task 3 — Supabase seam (AC: 5)**  
  - [ ] Add `SupabaseCatalogAdapter` stub (or factory branch) with TODO pointing to Epic 2 / E2-S5; no real DB access in this story.

- [ ] **Task 4 — Verify (AC: 1, 7)**  
  - [ ] `npm run build`.  
  - [ ] Manually: `/products` and `/product/:slug` (for a slug present in the canonical data) show consistent data; unknown slug shows the existing not-found pattern.

## Dev Notes

### Dev Agent Guardrails

- **Single seller;** no multi-tenant catalog abstractions.
- **Do not** implement Supabase schema, RLS, or admin product CRUD in this story (Epic 2).
- **Do not** refactor cart identity to SKU yet (Epic 3); adapter may still coexist with [CartContext](src/context/CartContext.tsx) product-id–shaped items—only **catalog read** is in scope.
- **Vite + `.js` shadows:** [1-1](1-1-fix-runtime-imports.md) fixed entry resolution; avoid extensionless imports that could resolve a stale `ProductList.js` if both exist—prefer **explicit `.tsx`** or delete obsolete `.js` siblings if truly unused and tracked.
- **Zod** is the only runtime schema library for JSON parsing at the adapter boundary (same as 1-2).

### Technical requirements

- **FR-CAT-001 / FR-CAT-002:** One logical catalog; stable slug for detail routes; adapter should enable a single list/detail view of “active” products (filtering rules can be minimal for static data but should be **centralized** in the adapter, not scattered).
- **PRD E1-S3** and **Release 0** exit: list + detail both use the adapter.
- **NFR-MAINT-002:** Reuse shared domain types from E1-S2; centralize “where data comes from” in one module and Dev Notes.

### Architecture compliance

- [architecture.md](_bmad-output/planning-artifacts/architecture.md) — “Catalog adapter” as a named component; [architecture §Epic 0 / strangler](_bmad-output/planning-artifacts/architecture.md) — static catalog unification is part of stabilization before full Epic 2 Supabase.
- [architecture](_bmad-output/planning-artifacts/architecture.md): `api/_lib/` typed contracts — align `catalog.ts` with shared types.
- **Browser vs server:** Prefer shared **pure** parse/normalize functions importable from both Vite and Vercel Node; I/O (fs vs fetch) sits in thin per-environment wrappers if needed.

### Library / framework requirements

- **Zod** `^4.1.11` — validate external JSON at the boundary.  
- **TypeScript** `^5.7.2` / **Vite** `^5.4.1` — no new bundler.  
- **Supabase client:** not required for this story; document optional add in Epic 2.

### File structure requirements

| Area | Action |
|------|--------|
| `src/catalog/**` or `src/lib/catalog/**` (or name aligned with 1-2) | **NEW** — interface, static impl, factory, zod parse |
| `src/components/ProductList/ProductList.tsx` | **UPDATE** — use adapter, remove duplicate `Product` interface for catalog data |
| `src/components/ProductDetail/ProductDetail.tsx` | **UPDATE** — same |
| `api/_lib/catalog.ts` | **UPDATE** — shared types + normalization |
| `data/products.json`, `public/*.json` | **UPDATE** or **consolidate** per AC 3 — document the decision |
| `public/assets/products.json` | **READ** — decide keep vs replace vs generated |

### Testing requirements

- **Build as gate:** `npm run build` must pass.  
- **No new test framework** required unless the repo already has one; if Vitest or similar exists, one unit test for `parseStaticCatalog` (valid/invalid JSON) is valuable but optional.

### Previous story intelligence (1-2)

- **1-2** establishes **`src/domain/commerce` or `src/shared/commerce`**, zod + `z.infer`, cents vs dollars discipline, and **CartItem** with variant/SKU identity for **future** cart work.  
- **1-2** optional touch of [api/_lib/catalog.ts](api/_lib/catalog.ts) — 1-3 **completes** that alignment.  
- **1-1:** `import` paths must not resolve to stale `.js` in `src/`.

### Previous story intelligence (1-1)

- Canonical `.tsx` entry; `tsc -p tsconfig.json` + Vite build; explicit extensions where dual files existed.

### Git intelligence (recent commits)

- Recent work focused on **TypeScript migration**, **Hero**, **Navbar/Header**; catalog work should match **strict TS** and not reintroduce ambiguous module resolution.

### Latest technical information

- **Vite JSON:** Importing JSON from `data/` at repo root may need `resolve.alias` or moving a canonical file under `public/`—choose one approach and document it. [Vite static asset handling](https://vitejs.dev/guide/assets.html).  
- **Zod 4.x:** Reuse patterns from [src/lib/validation.ts](src/lib/validation.ts) if applicable for consistency.

### Project context reference

- `project-context.md` not present in repo; use this file, [zephyr-lux-commerce-prd.md](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md), and [architecture.md](_bmad-output/planning-artifacts/architecture.md).

### References

- [PRD §14 — E1-S3, Epic 1 acceptance](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability)  
- [PRD §8 — Release 0, product list/detail adapter](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#release-0-brownfield-stabilization)  
- [1-2 — Shared commerce types](1-2-define-shared-commerce-domain-types.md)  
- [1-1 — Runtime imports](1-1-fix-runtime-imports.md)  
- [epics.md — FR-CAT, brownfield, data model notes](_bmad-output/planning-artifacts/epics.md) (placeholders in `epics_list` / map—PRD is canonical for E1 story titles)

## Story completion status

- **Status:** `ready-for-dev`  
- **Note:** Ultimate context engine analysis completed — comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

_(Populate during dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Questions (non-blocking)

- Should the canonical static file live under `public/` only (fetch), or `src/`/`data/` with Vite import + copy? **Decision belongs to implementer;** document in Dev Agent Record.  
- If ProductList’s `/assets` vs `/products` fallback is removed, confirm no broken deploys for environments that only had one file.

## Change Log

- 2026-04-26 — Story created (bmad-create-story). Target: PRD E1-S3; first `backlog` story in [sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) at time of run.

---

**Checklist (create-story self-validation):** ACs trace to PRD E1-S3, Release 0 exit, FR-CAT-001, architecture “Catalog adapter”; 1-2 type dependency explicit; three JSON sources and `api/_lib/catalog.ts` called out; Supabase limited to interface/stub; security (no service role in browser); `npm run build` gate; Vite/ dual-file warning preserved.
