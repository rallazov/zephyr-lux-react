# Story 1.5: Smoke test or script — clean build and route availability

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer or CI pipeline,
I want an **automated smoke path** that proves a **clean checkout builds** and **core storefront routes mount without runtime errors**,
so that **NFR-DEP-001** holds (deploy from clean Git), **Epic 1 acceptance** stays verifiable, and regressions like broken imports or missing routes are caught before merge.

## Acceptance Criteria

1. **Given** [PRD §14 E1-S5](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability) and **NFR-DEP-001**, **when** a contributor runs the documented smoke command from a **fresh** `git clone` after `npm install`, **then** it **exits 0** without relying on untracked generated `.js` sources (align with E1-S1 / **NFR-MAINT-001**).
2. **Given** the smoke workflow, **when** it runs, **then** it includes **`npm run build`** (same as [package.json](package.json): `tsc -p tsconfig.json && vite build`) so TypeScript + Vite production build is always exercised.
3. **Given** [App.tsx](src/components/App/App.tsx) defines the live customer router tree, **when** smoke runs, **then** it **verifies route availability** for at minimum these paths (must match router, not marketing copy): `/` (redirect behavior acceptable), `/products`, `/women`, `/men`, `/kids`, `/sale`, `/cart`, `/checkout`, `/order-confirmation`, `/product/:slug` (use one **known-good slug** from current static/seed catalog — document which slug in Dev Notes after implementation).
4. **Given** **PRD §13 UX-DR1** lists additional MVP routes (`/policies/*`, `/contact`, etc.), **when** those routes **do not exist** in [App.tsx](src/components/App/App.tsx) yet, **then** the smoke suite **must not falsely pass** by testing non-existent paths — instead, **document** “not yet routed” under Tasks with a pointer to future Epic 6 stories; the **implemented** check must cover **only** routes that exist today unless this story also adds missing routes (out of scope unless PM expands scope).
5. **Given** **NFR-MAINT-003** (focused tests on critical paths), **when** implementation is chosen, **then** prefer a **maintainable** approach: e.g. **Vitest** + **React Testing Library** with **`MemoryRouter`** (or an **`AppRoutes`** extract that accepts a router wrapper) rather than a one-off brittle string scrape of `App.tsx`.
6. **Given** there is **no** `.github/workflows` CI today, **when** this story completes, **then** either: (a) add a minimal **GitHub Actions** workflow that runs `npm ci` + smoke on push/PR, **or** (b) document in [README.md](README.md) exactly how CI **should** call the smoke script so the next infra story can wire it — **(a) preferred** if repo is GitHub-hosted.
7. **Given** **E1-S4** ([1-4-document-environment-variables.md](1-4-document-environment-variables.md)) may introduce `.env.example`, **when** smoke runs in CI, **then** it must **not require real Stripe/Supabase secrets**; use empty/placeholder `VITE_*` only if the build demands them (if build fails without vars, document required dummy values for CI in README or `.env.example`).

## Tasks / Subtasks

- [x] **Task 1 — Pick mechanism (AC: 5, 7)**  
  - [x] Add **Vitest** (+ jsdom, `@testing-library/react`) aligned with Vite, **or** justify a lighter alternative in Dev Agent Record (must still satisfy AC 2–3).  
  - [x] Ensure `npm run build` stays the single source of truth for production compile (AC 2).

- [x] **Task 2 — Router testability (AC: 3, 5)**  
  - [x] If [App.tsx](src/components/App/App.tsx) wraps everything in `BrowserRouter`, refactor minimally: e.g. export inner routes as `AppRoutes` and compose `BrowserRouter` + `AppRoutes` in `App`, so tests use `MemoryRouter` + `AppRoutes`.  
  - [x] For `/product/:slug`, use a slug that resolves with the **current** catalog adapter / static data (follow [1-3-catalog-adapter-static-and-supabase.md](1-3-catalog-adapter-static-and-supabase.md) if implemented).

- [x] **Task 3 — Smoke script entry (AC: 1, 2, 6)**  
  - [x] Add `npm run smoke` (or `npm run test:smoke`) that runs **build + route tests** (or `npm test` if tests include build — prefer explicit ordering: build first, then tests).  
  - [ ] Optionally add `npm run lint` to the same pipeline if fast and stable.

- [x] **Task 4 — CI or README (AC: 6)**  
  - [x] Add `.github/workflows/ci.yml` (or similar) running on Node LTS: `npm ci`, `npm run smoke`.  
  - [x] If skipping CI file, update [README.md](README.md) with copy-paste commands.

- [x] **Task 5 — Verify clean tree (AC: 1)**  
  - [x] From clean clone: `npm ci && npm run smoke` exits 0.
  - [x] **AC4 (UX-DR1):** Routes such as `/policies/*`, `/contact`, etc. are **not** in [App.tsx](src/components/App/App.tsx) yet; smoke covers **only** paths that exist today. Planned under Epic 6 (e.g. [epics.md](_bmad-output/planning-artifacts/epics.md) story `6-2-policy-pages-footer-links`).


## Dev Notes

### Dev Agent Guardrails

- **Scope:** Smoke + automation only — do **not** implement policy pages, Stripe webhook tests, or Supabase (architecture’s “real Stripe webhook smoke” is a **later** hardening item; see [architecture.md](_bmad-output/planning-artifacts/architecture.md) Epic 0 note).
- **Do not** reintroduce dependency on committed `dist/` or duplicate `.js`/`.ts` runtime pairs for imports.
- **Route list:** Derive the canonical list from [App.tsx](src/components/App/App.tsx) at implementation time; if new routes land mid-sprint, update the test list in the same PR.

### Technical requirements

- **NFR-DEP-001:** Clean Git checkout → install → build (and now smoke) succeeds.
- **NFR-MAINT-001:** TypeScript canonical; smoke must run `tsc` via `npm run build`.
- **NFR-MAINT-003:** Establishes first automated test hook for future checkout/order tests.

### Architecture compliance

- [architecture.md — Clean-deploy discipline](_bmad-output/planning-artifacts/architecture.md): `tsc` green from clean checkout; no reliance on untracked artifacts; aligns with item 13 (*Clean-deploy discipline*).
- [architecture.md — Stabilization sequence](_bmad-output/planning-artifacts/architecture.md): Epic 1 completes stabilization before Epic 2 catalog work depends on a trustworthy baseline.

### Library / framework requirements

- **Vite 5** + **React 18** — use official Vitest + Vite integration ([Vitest](https://vitest.dev/guide/)) unless team standard says otherwise.
- **No Playwright/Cypress required** for this story’s “minimum” bar unless you explicitly choose E2E for route checks — document trade-off in Dev Agent Record (speed vs fidelity).

### File structure requirements

| Area | Action |
|------|--------|
| [package.json](package.json) | **UPDATE** — `test`, `smoke` scripts; devDependencies for Vitest/RTL if added |
| [vite.config.ts](vite.config.ts) (or `.js`) | **UPDATE** — `test` config if needed |
| [src/components/App/App.tsx](src/components/App/App.tsx) | **UPDATE** — optional `AppRoutes` extract for testability |
| `src/**/*.test.tsx` or `src/**/__tests__/**` | **NEW** — route smoke tests |
| `.github/workflows/*.yml` | **NEW (preferred)** — CI running smoke |

### Testing requirements

- Local: `npm run smoke` (or documented equivalent) must pass.  
- Each route test should assert **no uncaught render error** and, where cheap, a **stable landmark** (e.g. heading, `data-testid` on layout shell) — avoid snapshotting entire pages.

### Previous story intelligence (1-4)

- Env documentation may live in `.env.example`; CI must not need production secrets.  
- Server env vars from [api/_lib/env.ts](api/_lib/env.ts) are irrelevant to **client build** unless something imports them into the bundle (should not).

### Previous story intelligence (1-3)

- Catalog adapter determines valid product slugs — smoke’s `/product/:slug` must use a slug that **exists** for the active backend (`static` vs `supabase`).

### Previous story intelligence (1-2)

- Domain types under `src/domain/**` (or as established in 1-2) should not break smoke; if tests import types, follow the same paths.

### Previous story intelligence (1-1)

- [main.tsx](src/main.tsx) imports [App.tsx](src/components/App/App.tsx) as canonical entry — smoke indirectly validates the import graph.

### Git intelligence (recent commits)

- Recent work: TypeScript migration, merge conflict resolution on imports — smoke catches **import/path regressions** early.

### Latest technical information

- **Vitest 2.x / 3.x** with **Vite 5** is the common default; pin versions in `package.json` consistent with Node LTS used in CI.  
- **React Router 6**: use `MemoryRouter` + `initialEntries` for deterministic route tests.

### Project context reference

- No `project-context.md` matched the skill glob; use this file, [zephyr-lux-commerce-prd.md](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md) §14 Epic 1, and [architecture.md](_bmad-output/planning-artifacts/architecture.md).

### References

- [PRD §14 — Epic 1, E1-S5, acceptance bullets](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability)  
- [epics.md — Epic 1 scope](_bmad-output/planning-artifacts/epics.md)  
- [1-4 — Environment variables](1-4-document-environment-variables.md)  
- [1-3 — Catalog adapter](1-3-catalog-adapter-static-and-supabase.md)  
- [1-2 — Domain types](1-2-define-shared-commerce-domain-types.md)  
- [1-1 — Runtime imports](1-1-fix-runtime-imports.md)

## Story completion status

- **Status:** `done`  
- **Note:** Code review complete; CI triggers include `dev/zephyr`; sprint `last_updated` corrected.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Vitest/jsdom: polyfilled `localStorage` in `src/test/setup.ts` for `CartContext`.
- RTL: `afterEach(cleanup)` to avoid duplicate `data-testid` matches across `it.each`.
- Stale `ProductDetail.js` / `ProductList.js` shadowed `.tsx` (Vite resolves `.js` before `.tsx`); removed so catalog adapter + bundled JSON are used (aligns with NFR-MAINT-001).
- `readCatalogEnv()`: force `static` catalog when `import.meta.env.MODE === "test"` so local `.env` with `VITE_CATALOG_BACKEND=supabase` does not break smoke.

### Completion Notes List

- Added Vitest 2 + jsdom + `@testing-library/react` / `@testing-library/jest-dom`; `npm run test` runs `vitest run`; `npm run smoke` runs `npm run build` then `vitest run`.
- Exported `AppRoutes` from `App.tsx`; route smoke tests use `MemoryRouter` + `CartProvider` + landmarks (`data-testid="storefront-layout"`, route-specific copy).
- Product detail smoke uses slug **`boxer-briefs`** from [data/products.json](data/products.json) (bundled static catalog).
- CI: [.github/workflows/ci.yml](.github/workflows/ci.yml) on push/PR to `main`/`master`: `npm ci`, `npm run smoke` (Node 22). No secrets required for client build/tests.
- Optional **lint in smoke** not enabled: `npm run lint` still fails on pre-existing issues elsewhere; smoke stays green per story recommendation.

### File List

- package.json
- package-lock.json
- vite.config.ts
- .github/workflows/ci.yml
- src/components/App/App.tsx
- src/components/App/Layout.tsx
- src/catalog/adapter.ts
- src/test/setup.ts
- src/routes.smoke.test.tsx
- src/catalog/adapter-smoke.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/1-5-smoke-test-or-script-clean-build-routes.md
- src/components/ProductDetail/ProductDetail.js (deleted)
- src/components/ProductList/ProductList.js (deleted)

## Questions (non-blocking)

- If product slug list becomes dynamic-only (post–Epic 2), should smoke read one slug from a **test fixture** file? **Recommendation:** yes — avoid coupling to production JSON shape.  
- Should `npm run lint` gate CI? **Recommendation:** enable if current lint is clean; otherwise smoke-only for this story to avoid unrelated cleanup.

## Change Log

- 2026-04-26 — Story created (bmad-create-story). Target: PRD E1-S5; first `backlog` story in [sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) at time of run.
- 2026-04-26 — Dev-story complete: Vitest + RTL route smoke, `AppRoutes` extract, GitHub Actions CI, removed stale `.js` shadows for Product list/detail; story status → `review`.

### Review Findings

- [x] [Review][Decision] **CI workflow branch filters vs `dev/zephyr` integration** — Resolved (2026-04-26): option 2 — [.github/workflows/ci.yml](.github/workflows/ci.yml) now also runs on `push` / `pull_request` for `dev/zephyr`.

- [x] [Review][Patch] **Sprint tracker `last_updated` went backwards** — Fixed: [sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) `last_updated` set to `2026-04-26T19:04:28Z` (forward from the erroneous `12:30` edit; synced at review closeout).

- [x] [Review][Defer] **Route smoke asserts on marketing copy strings** — [src/routes.smoke.test.tsx](src/routes.smoke.test.tsx) — deferred, pre-existing: matches story guidance (landmark + copy); copy-only changes can fail CI without a functional bug.

- [x] [Review][Defer] **README omits local smoke command** — [README.md](README.md) — deferred, pre-existing: CI satisfies AC6 preferred path; optional doc gap for `npm run smoke` on a clean clone.

---

**Checklist (create-story self-validation):** ACs trace to PRD E1-S5, NFR-DEP-001, NFR-MAINT-001/003, Epic 1 acceptance; routes grounded in [App.tsx](src/components/App/App.tsx); UX-DR1 gap called out without scope creep; Vitest/RTL preferred; CI or README; no secrets in CI; prior stories 1-1–1-4 referenced.
