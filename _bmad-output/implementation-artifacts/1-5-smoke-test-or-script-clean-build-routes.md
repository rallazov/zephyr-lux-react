# Story 1.5: Smoke test or script — clean build and route availability

Status: ready-for-dev

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

- [ ] **Task 1 — Pick mechanism (AC: 5, 7)**  
  - [ ] Add **Vitest** (+ jsdom, `@testing-library/react`) aligned with Vite, **or** justify a lighter alternative in Dev Agent Record (must still satisfy AC 2–3).  
  - [ ] Ensure `npm run build` stays the single source of truth for production compile (AC 2).

- [ ] **Task 2 — Router testability (AC: 3, 5)**  
  - [ ] If [App.tsx](src/components/App/App.tsx) wraps everything in `BrowserRouter`, refactor minimally: e.g. export inner routes as `AppRoutes` and compose `BrowserRouter` + `AppRoutes` in `App`, so tests use `MemoryRouter` + `AppRoutes`.  
  - [ ] For `/product/:slug`, use a slug that resolves with the **current** catalog adapter / static data (follow [1-3-catalog-adapter-static-and-supabase.md](1-3-catalog-adapter-static-and-supabase.md) if implemented).

- [ ] **Task 3 — Smoke script entry (AC: 1, 2, 6)**  
  - [ ] Add `npm run smoke` (or `npm run test:smoke`) that runs **build + route tests** (or `npm test` if tests include build — prefer explicit ordering: build first, then tests).  
  - [ ] Optionally add `npm run lint` to the same pipeline if fast and stable.

- [ ] **Task 4 — CI or README (AC: 6)**  
  - [ ] Add `.github/workflows/ci.yml` (or similar) running on Node LTS: `npm ci`, `npm run smoke`.  
  - [ ] If skipping CI file, update [README.md](README.md) with copy-paste commands.

- [ ] **Task 5 — Verify clean tree (AC: 1)**  
  - [ ] From clean clone: `npm ci && npm run smoke` exits 0.

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

- **Status:** `ready-for-dev`  
- **Note:** Ultimate context engine analysis completed — comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

_(Populate during dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Questions (non-blocking)

- If product slug list becomes dynamic-only (post–Epic 2), should smoke read one slug from a **test fixture** file? **Recommendation:** yes — avoid coupling to production JSON shape.  
- Should `npm run lint` gate CI? **Recommendation:** enable if current lint is clean; otherwise smoke-only for this story to avoid unrelated cleanup.

## Change Log

- 2026-04-26 — Story created (bmad-create-story). Target: PRD E1-S5; first `backlog` story in [sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) at time of run.

---

**Checklist (create-story self-validation):** ACs trace to PRD E1-S5, NFR-DEP-001, NFR-MAINT-001/003, Epic 1 acceptance; routes grounded in [App.tsx](src/components/App/App.tsx); UX-DR1 gap called out without scope creep; Vitest/RTL preferred; CI or README; no secrets in CI; prior stories 1-1–1-4 referenced.
