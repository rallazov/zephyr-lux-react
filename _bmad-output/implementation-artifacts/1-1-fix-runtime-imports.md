# Story 1.1: Fix runtime imports (canonical TypeScript entry)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer shipping Zephyr Lux from a clean Git checkout on Vercel,
I want the app entry to import the canonical TypeScript/TSX source (not a parallel `.js` shadow),
so that production builds and local dev resolve the same code and we stop risking stale or divergent JavaScript.

## Acceptance Criteria

1. **Given** a clean clone of the repository, **when** the developer runs `npm install` and `npm run build`, **then** the build completes with **no** errors attributable to the SPA entry import graph and does **not** recreate source-tree JavaScript shadows required for the Vite runtime entry.
2. **Given** `src/main.tsx` is the SPA entry (see `index.html` script `src="/src/main.tsx"`), **when** the app boots, **then** the root `App` component is loaded from the **TypeScript** implementation (`App.tsx`) through an unambiguous resolver path that cannot be satisfied by sibling `App.js`.
3. **Given** the brownfield finding in [PRD §4.2](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#42-important-current-repo-findings), **when** reviewing the fix, **then** the change is **documented in Dev Agent Record** with the import/config/file-deletion decisions and any files intentionally left in place (with rationale) per [PRD §4.3](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#43-brownfield-constraints) (no silent deletion of generated or tracked shadow files without explicit story scope).
4. **Given** NFR-MAINT-001 and NFR-DEP-001, **when** the story is done, **then** the documented “canonical source” for the fixed runtime entry modules is the `.ts`/`.tsx` files, and the dev agent has verified `npm run build` and `npm run lint` (if lint is already configured for the touched paths) do not regress.

## Tasks / Subtasks

- [x] **Task 1 — Fix build/typecheck path and entry import to canonical App (AC: 1, 2, 4)**
  - [x] Confirm the build script/TypeScript config used by `npm run build` will not emit generated `.js` files into `src/` before Vite runs. Current root `tsconfig.json` has no `noEmit`, and tracked `tsconfig.tsbuildinfo` can mask stale source-JS output; make the smallest config/script change needed so the build is a typecheck-only preflight before `vite build`.
  - [x] In `src/main.tsx`, replace `import App from "./components/App/App.js"` with an import strategy that **cannot** resolve to `src/components/App/App.js`. Preferred low-scope path: make the build typecheck no-emit, allow explicit TS/TSX import specifiers if needed, and import `./components/App/App.tsx` directly.
  - [x] Do **not** use extensionless `./components/App/App` while `App.js` exists; Vite's default extension order checks `.js` before `.tsx`, so that form can still load the JavaScript shadow.
  - [x] Run `npm run build` and fix any new TypeScript or bundler resolution errors until green.
- [x] **Task 2 — Classify and handle duplicate `main` / `App` JavaScript files (AC: 2, 3)**
  - [x] Search the repo for references to `main.js`, `App.js`, and `Layout.js` (including docs and configs). Document findings in **Dev Agent Record → Completion Notes**.
  - [x] Use `git ls-files` to identify whether each shadow file is tracked. In this repo, `src/main.js`, `src/components/App/App.js`, `src/components/App/Layout.js`, `vite.config.js`, and `tsconfig.tsbuildinfo` are tracked, so removing them is a tracked deletion decision, not cleanup of ignored output.
  - [x] If `index.html` (or Vite config) only references `src/main.tsx`, mark `src/main.js` as redundant for runtime; either delete in this story *only if* the team accepts removal of duplicate compiled-style files per brownfield rules, or leave the file and document “not used by build” with a follow-up task ID. Same decision pattern for `src/components/App/App.js` if the entry import is made explicit enough that it no longer shadows `App.tsx`.
  - [x] Check the immediate `App.tsx` shell import `import Layout from './Layout'`. If this story claims the fixed App shell is canonical TypeScript, either make `Layout.tsx` resolution unambiguous under the same import/config strategy or document `Layout.js` as a follow-up shadow left intentionally out of scope.
- [x] **Task 3 — Regression and definition of done (AC: 1, 4)**
  - [x] From a clean worktree, run `npm run build` (and `npm run lint` if the project lints the entry path).
  - [x] If TypeScript config changed, run `node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false` or the exact typecheck command now used by `npm run build`; record any unrelated pre-existing failures separately rather than hiding them behind Vite's successful bundle output.
  - [x] **Smoke:** `npm run dev` loads `/` (or the configured redirect) without console import errors. Record command output or screenshot note in **Dev Agent Record** if useful for reviewers.

## Dev Notes

### Problem statement (evidence in repo)

- `src/main.tsx` currently contains:

```3:3:src/main.tsx
import App from "./components/App/App.js";
```

- `index.html` loads `/src/main.tsx` (Vite dev/prod entry).
- Parallel `src/main.js`, `src/components/App/App.js`, and `src/components/App/Layout.js` exist; their content matches compiled JSX-runtime style, suggesting **duplication** with the `.tsx` sources rather than a second source of truth. These files are currently tracked by Git. Production must not prefer `.js` over `.tsx` when both exist on case-sensitive filesystems (see [architecture.md](_bmad-output/planning-artifacts/architecture.md) “Dual-file semantic merges” and “Clean-deploy discipline”).
- `package.json` runs `tsc -b && vite build`, but the project root `tsconfig.json` is the config used by `tsc -b`; `tsconfig.app.json` is not currently wired into the build script. Root `tsconfig.json` can emit `.js` beside source files unless changed to no-emit or the script is adjusted.
- `tsconfig.app.json` uses `module: "NodeNext"`, `moduleResolution: "NodeNext"`, and `allowJs: true`; as-is, it reports broad extension diagnostics such as TS2835 for extensionless imports. Do not rely on `tsconfig.app.json` as the working build source of truth until the implementation explicitly chooses to make it one.
- Import-resolution trap: explicit `.tsx` imports require `allowImportingTsExtensions` with `noEmit`; extensionless imports can still resolve `.js` first in Vite. The story should leave the repo with an import/config combination that makes `App.tsx` resolution mechanically obvious.

### Architecture compliance

- [architecture.md — Brownfield / strangler](_bmad-output/planning-artifacts/architecture.md): Resolving `main.tsx` → `App.tsx` is a prerequisite to the listed dual-file cleanups (`src/main.js` vs `src/main.tsx`, and API `.js` vs `.ts` pairs are **separate** follow-up work; **do not** refactor `api/*` in this story unless an import fix strictly requires it).
- **NFR-MAINT-001:** TypeScript source is canonical.
- **NFR-DEP-001:** Vercel deploy from clean Git must not depend on untracked generated JS for the storefront entry.

### Library / runtime (no new dependencies expected)

- **Vite** `^5.4.1` and **TypeScript** `^5.7.2` are already in [package.json](package.json). Because same-basename `.js` shadows exist, do **not** assume extensionless imports target `.tsx`; the implementation must make the selected TypeScript source path unambiguous and align the TypeScript config used by `npm run build`.

### File structure and files to touch

| Area | Action |
|------|--------|
| `src/main.tsx` | **UPDATE** — import path to `App` |
| `tsconfig.json` and/or `package.json` | **UPDATE IF NEEDED** — make build preflight no-emit so it does not recreate source-tree JS shadows |
| `index.html` | **READ** — confirm entry remains `src/main.tsx` |
| `src/main.js` | **INVESTIGATE** — remove or quarantine per Task 2 |
| `src/components/App/App.js` | **INVESTIGATE** — same as above |
| `src/components/App/Layout.tsx` / `Layout.js` | **INVESTIGATE** — App shell has a direct extensionless import that can hit the JS shadow |
| `api/*` | **OUT OF SCOPE** for 1-1 (Epic 1 later stories / separate story) |

### Testing requirements

- **Build:** `npm run build` must pass (currently `tsc -b && vite build` per [package.json](package.json) scripts). If `tsc -b` remains, ensure its config no longer emits source-tree JS shadows before Vite runs.
- **Typecheck sanity:** `node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false` currently passes and is a useful guard if the root config remains the chosen typecheck path.
- **Optional:** Add or extend a minimal test only if the repo already has a frontend test runner; if no tests exist, do **not** add a new framework in this story—rely on build + manual smoke per PRD Epic 1 acceptance for stabilization.

### UX specification alignment

- No customer-visible UX change is required for a pure import fix; if any route or layout shifts, that indicates wrong module resolution—treat as a **bug to fix** before completion.

### Previous story intelligence

- Not applicable (first implementation story in repo).

### Project context

- `project-context.md` was not found in the repo; follow this story file and the linked PRD/architecture.

### References

- [PRD §14 — Epic 1, E1-S1](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability)
- [PRD §4.2 / §4.3 — Brownfield](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#42-important-current-repo-findings)
- [epics.md — Brownfield constraints](_bmad-output/planning-artifacts/epics.md) (supplements PRD; epic list may still contain template placeholders)
- [architecture.md](_bmad-output/planning-artifacts/architecture.md) — dual-file pairs, clean-deploy discipline
- [ux-design-specification.md](_bmad-output/planning-artifacts/ux-design-specification.md) — no change expected for 1-1

### Latest technical note (Vite + TS)

- Vite 5's default extension order includes `.js` before `.tsx`; extensionless imports are therefore unsafe when same-basename shadows exist.
- TypeScript only permits import specifiers ending in `.ts`/`.tsx` when `allowImportingTsExtensions` is enabled and emit is disabled (`noEmit` or `emitDeclarationOnly`). If the implementation uses explicit `.tsx`, update the exact typecheck config used by `npm run build` accordingly.
- If the team chooses NodeNext-style `.js` specifiers instead, remove/quarantine the sibling `.js` shadow first and verify Vite resolves the import from the TS importer to the `.tsx` source. Do not leave a same-basename `.js` file that can satisfy the runtime import.

## Dev Agent Record

### Agent Model Used

Cursor agent (user-invoked bmad-dev-story; implementation 2026-04-26).

### Debug Log References

(none)

### Completion Notes List

- **TypeScript / build:** `tsconfig.json` now has `noEmit: true`, `allowImportingTsExtensions: true`, and `moduleResolution: "bundler"` so the SPA can use explicit `./App.tsx` and `./Layout.tsx` specifiers with a typecheck-only preflight. `package.json` `build` is `tsc -p tsconfig.json && vite build` (replaces `tsc -b`, avoiding incremental `tsbuildinfo` as the pre-build gate for this config).
- **Imports:** `src/main.tsx` → `./components/App/App.tsx`; `App.tsx` → `./Layout.tsx`. No extensionless `App`/`Layout` to Vite or `.js` shadows for the app shell.
- **Tracked deletions (brownfield, explicit):** Removed duplicate runtime shadows `src/main.js`, `src/components/App/App.js`, and `src/components/App/Layout.js` (they mirrored the `.tsx` sources; `index.html` only ever loaded `src/main.tsx`). Rationale: canonical sources are `.tsx`; leaving same-basename `.js` next to `App`/`Layout` retained Vite/TS foot-guns. Other `src/**/*.js` dual files remain out of scope (separate follow-up; aligns with story scope and api exclusion).
- **Reference search — `main.js` / `App.js` / `Layout.js`:** Under `src/`, only the removed `main.js` and `App.js` referenced `App.js`; `App.js` also imported `./Layout` extensionless. Planning docs (`_bmad-output/…`, `architecture.md`) mention the issue historically—no app config loads `src/main.js`. `index.html` script remains `/src/main.tsx`. **Left in place (documented):** `vite.config.js` (duplicate of `vite.config.ts`)—Vite resolves `vite.config.ts` in this project; a future story can drop the redundant `.js` if desired. `api/**/*.js` untouched per story.
- **`tsconfig.tsbuildinfo`:** Tracked file removed; `*.tsbuildinfo` and `tsconfig.tsbuildinfo` added to `.gitignore` to avoid reintroducing cached build state as a substitute for a clean typecheck.
- **Lint / smoke:** `npx eslint src/main.tsx src/components/App/App.tsx` — clean. Full-repo `npm run lint` still reports pre-existing issues in `api/`, cart/checkout, etc. (unchanged by this story). `npm run build` green. `tsc -p tsconfig.json --noEmit --pretty false` green. **Dev smoke:** Vite `npm run dev` started; `GET http://localhost:5173/` returned HTTP 200; server log showed no import-resolution errors (browserslist advisory only).

### File List

- `tsconfig.json` (modified)
- `package.json` (modified)
- `src/main.tsx` (modified)
- `src/components/App/App.tsx` (modified)
- `.gitignore` (modified)
- `tsconfig.tsbuildinfo` (deleted, now ignored)
- `src/main.js` (deleted)
- `src/components/App/App.js` (deleted)
- `src/components/App/Layout.js` (deleted)

### Review Findings

- [x] [Review][Patch] Story self-validation line is stale — Checklist had said `ready-for-dev` while work was in review. — **Applied:** checklist updated; `Status` is `done`.
- [x] [Review][Patch] "Open questions" on deleting JS shadows is stale — The open-questions block still asks the product owner to confirm deletion while this change set already removes `main.js` / `App.js` / `Layout.js`. Mark resolved or convert to a short "Decision" note so reviewers are not given conflicting instructions. [1-1-fix-runtime-imports.md:152-155] — **Applied:** replaced with **Decision (resolved)** block below.
- [x] [Review][Defer] Planning `epics.md` still states `main.tsx` imports `App.js` — deferred, pre-existing doc drift outside this diff; update when the brownfield section is next revised. [epics.md:170]

## Change Log

- 2026-04-25 — Story created (bmad-create-story). Target: E1-S1 from PRD §14; `epics.md` placeholders noted.
- 2026-04-26 — Story reviewed for implementation readiness; clarified tracked JS shadow files, TypeScript/Vite resolution traps, and build no-emit requirements.
- 2026-04-26 — Implemented: canonical `App`/`Layout` TSX imports, no-emit typecheck, removed entry/App/Layout JS shadows and `tsconfig.tsbuildinfo` handling; build/lint (touched files) and dev smoke verified.
- 2026-04-25 — Code review: story narrative aligned (self-validation + resolved deletion decision); status set to `done`; sprint-status synced.

---

**Decision (resolved — PRD §4.3 brownfield):** Tracked shadows `src/main.js`, `src/components/App/App.js`, and `src/components/App/Layout.js` were **removed** in this story with rationale documented in **Dev Agent Record → Completion Notes**. Rationale: `index.html` only loads `src/main.tsx`; the `.js` files duplicated `.tsx` sources and preserved Vite/TS resolution hazards.

**Open (non-blocking, follow-up only):** If case-only path differences appear (`App` vs `app` in tooling cache), normalize on the canonical `src/components/App/` directory naming on disk.

---

**Checklist (create-story self-validation):** Story maps to E1-S1; ACs are testable; file paths are repo-specific; architecture and brownfield constraints cited; out-of scope (api dual files) explicit; no new libraries required by default; status reviewed through code review and set to `done` when implementation and review findings are closed.
