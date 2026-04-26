# Story 1.4: Document environment variables (local, preview, production)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer or deployer onboarding to Zephyr Lux,
I want **authoritative, environment-scoped documentation** of every variable the app and Vercel API routes read today (plus clearly marked **future** vars from the PRD/architecture),
so that **NFR-MAINT-004** is satisfied, preview vs production expectations match **NFR-DEP-002** and **NFR-DEP-003**, and secrets never leak into the browser bundle (**FR-PAY-001**, **NFR-SEC-002**).

## Acceptance Criteria

1. **Given** [PRD §14 E1-S4](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability) and **NFR-MAINT-004**, **when** a new contributor opens the repo, **then** they can find a **single committed reference** (recommended: **`.env.example`** at repo root, optionally plus a short pointer from [README.md](README.md)) listing **every variable** read by runtime code, with: **name**, **scope** (`client` = exposed via `VITE_*` / Vite, `server` = Vercel serverless / Node only), **required vs optional**, **example placeholder** (no real secrets), and **where it is read** (file path).
2. **Given** [api/_lib/env.ts](api/_lib/env.ts) is the server env surface, **when** documentation is written, **then** it includes at minimum: `NODE_ENV`, `FRONTEND_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `STORE_BACKEND`, `VERCEL_BLOB_READ_WRITE_TOKEN` (document that code maps this to `ENV.VERCEL_BLOB_RW_TOKEN` in [api/_lib/env.ts](api/_lib/env.ts)), and `LOG_LEVEL` — with notes on defaults from that file.
3. **Given** the SPA reads `import.meta.env` in multiple places, **when** documentation is written, **then** it includes: `VITE_STRIPE_PUBLIC_KEY` ([CheckoutPage.tsx](src/components/Cart/CheckoutPage.tsx)), `VITE_USE_MOCK_STRIPE` ([src/utils/config.ts](src/utils/config.ts) — note duplicate legacy [src/utils/config.js](src/utils/config.js) if still present), and `VITE_API_URL` ([SubscriptionForm.tsx](src/components/SubscriptionForm/SubscriptionForm.tsx)) with the actual default string used in code.
4. **Given** **NFR-DEP-002** / **NFR-DEP-003** and [PRD deployment notes](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md), **when** the doc is read, **then** it explains **three deployment contexts** in a small matrix or subsection: **local** (Vite + `vercel dev` per [README-payments.md](README-payments.md)), **Vercel preview**, and **Vercel production** — including: use **Stripe test** keys in local/preview vs **live** keys only in production; set `FRONTEND_URL` / public URLs to the **actual** origin customers use (preview URL vs production domain); production must have a **real** Stripe webhook endpoint and secret (**NFR-DEP-003**).
5. **Given** **FR-PAY-001** and **NFR-SEC-002**, **when** the documentation is complete, **then** it explicitly states: **never** put `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VERCEL_BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, or any future **Supabase service role** key in `VITE_*` or client code; only **`pk_` / publishable** Stripe material belongs in `VITE_STRIPE_PUBLIC_KEY`.
6. **Given** [README-payments.md](README-payments.md) already partially documents env setup, **when** this story is done, **then** **duplication is eliminated or cross-linked**: either fold payment-specific steps into the main env doc and trim README-payments to “see `.env.example` / ENV doc”, or keep README-payments but add a prominent link to the canonical variable list so one source of truth exists for **names and scopes**.
7. **Given** [architecture.md](_bmad-output/planning-artifacts/architecture.md) and [epics.md](_bmad-output/planning-artifacts/epics.md) (Supabase + email on the roadmap), **when** documenting, **then** add a short **“Reserved for future epics”** subsection listing **anticipated** variables (e.g. `SUPABASE_URL`, `SUPABASE_ANON_KEY` for client if applicable, `SUPABASE_SERVICE_ROLE_KEY` server-only, email provider keys if renamed) marked **not yet read by code** — so Epic 2+ does not invent conflicting names.
8. **Given** **NFR-MAINT-001**, **when** the change set is finished, **then** `npm run build` still passes; documentation-only work must not break the build. **Optional but valuable:** extend [src/vite-env.d.ts](src/vite-env.d.ts) with `ImportMetaEnv` / `ImportMeta` for the `VITE_*` keys actually used (strict typings) — if done, keep it in sync with `.env.example`.

## Tasks / Subtasks

- [x] **Task 1 — Inventory (AC: 1–3, 5)**  
  - [x] Grep / confirm all `process.env.*` and `import.meta.env` usages in `api/**`, `src/**` (re-scan before finalizing; dual `.js`/`.ts` pairs may still exist).  
  - [x] Cross-check [api/_lib/env.ts](api/_lib/env.ts) vs any API route importing env.

- [x] **Task 2 — Author `.env.example` (AC: 1–5, 7)**  
  - [x] Add committed `.env.example` with grouped sections: Server (Vercel), Client (Vite), Future/Reserved.  
  - [x] Use placeholder values only (`sk_test_...`, `whsec_...`, etc.).

- [x] **Task 3 — Environment matrix + README alignment (AC: 4, 6)**  
  - [x] Add local / preview / production guidance (Stripe mode, webhook URL, `FRONTEND_URL`).  
  - [x] Update [README.md](README.md) with a short “Configuration” pointer and reconcile [README-payments.md](README-payments.md).

- [x] **Task 4 — Optional typing (AC: 8)**  
  - [x] Update [src/vite-env.d.ts](src/vite-env.d.ts) for `VITE_*` keys if quick.

- [x] **Task 5 — Verify (AC: 8)**  
  - [x] `npm run build`.

### Review Findings

- [x] [Review][Patch] **Local `dev:full` vs `VITE_API_URL` onboarding** [README.md:Configuration, .env.example:VITE_API_URL] — README points contributors to `npm run dev:full` (Vite + `vercel dev`), but `SubscriptionForm.tsx` still defaults `VITE_API_URL` to `http://localhost:5000` when unset. Document that `VITE_API_URL` must be set to the **actual** origin shown by `vercel dev` (or explain when the code default is still valid) so local subscription/newsletter calls do not silently hit the wrong host. Touches **AC4**, **NFR-MAINT-004**, and the story’s open question on `localhost:5000` staleness. **Applied:** README subsection + `.env.example` comment and example port.

- [x] [Review][Patch] **Reserved “email provider” naming example (AC7)** [.env.example:Reserved] — AC7 calls for anticipated variables including email provider keys **if renamed**. The reserved block lists Supabase placeholders and a generic sentence but no concrete commented example for a future/renamed transactional email key (e.g. a neutral `TRANSACTIONAL_EMAIL_API_KEY` or cross-reference rule). Add one line so Epic 2+ has a named placeholder pattern. **Applied:** `TRANSACTIONAL_EMAIL_API_KEY` placeholder comment in `.env.example`.

- [x] [Review][Defer] **Legacy `.js` siblings still ship beside `.ts/.tsx`** [CheckoutPage.js, config.js, SubscriptionForm.js] — deferred, pre-existing; `.env.example` references these as legacy duplicates. Removing or syncing them is out of scope for this documentation story.

## Dev Notes

### Dev Agent Guardrails

- **Documentation-only scope:** Do not change payment, webhook, or catalog behavior unless a comment in code is objectively wrong and a one-line fix prevents misleading devs (prefer fixing the doc only).
- **Do not commit real secrets.** Ensure `.env` with secrets remains untracked; if the repo currently tracks `.env`, flag in Dev Agent Record and fix `.gitignore` only if agreed (out of scope unless PM asks).
- **Supabase client is not in package.json yet** ([architecture.md](_bmad-output/planning-artifacts/architecture.md)) — reserved section only, no fake `import` of Supabase env in app code in this story.

### Technical requirements

- **NFR-MAINT-004:** Document by environment (local, preview, production).
- **NFR-DEP-002 / NFR-DEP-003:** Preview uses test infrastructure; production requires production webhook configuration.
- **FR-PAY-001:** Secret keys server-side only.

### Architecture compliance

- [architecture.md — Maintainability / env documentation](_bmad-output/planning-artifacts/architecture.md): documented env vars per environment; aligns with deployment NFRs.
- Secret boundaries: mirror **NFR-SEC-002** (no service role in frontend) in the reserved Supabase notes.

### Library / framework requirements

- No new dependencies for this story.
- **Vite:** only `VITE_*` prefixes are exposed to the client ([Vite env variables](https://vitejs.dev/guide/env-and-mode.html)).

### File structure requirements

| Area | Action |
|------|--------|
| `.env.example` | **NEW** (recommended) — canonical list |
| [README.md](README.md) | **UPDATE** — link + 1 short subsection |
| [README-payments.md](README-payments.md) | **UPDATE** — dedupe or link to `.env.example` |
| [src/vite-env.d.ts](src/vite-env.d.ts) | **UPDATE (optional)** — `ImportMetaEnv` |

### Testing requirements

- `npm run build` must pass.

### Previous story intelligence (1-3)

- Catalog adapter story stresses **browser vs server** split and **no Supabase service role in the bundle** — same rule applies to all `VITE_*` documentation.
- **Dual `.js`/`.ts` files:** env usage may appear in both; prefer documenting the **TypeScript** source path and note legacy `.js` if still present.

### Previous story intelligence (1-2)

- Domain types are centralized under `src/domain/**` or similar; env docs are unrelated to types but avoid contradicting E1-S3/E2 paths for “where config lives.”

### Previous story intelligence (1-1)

- Canonical TS entry and explicit imports; documentation should reference `.tsx`/`.ts` files as the source of truth.

### Git intelligence (recent commits)

- Recent focus: TypeScript migration, Hero/Header, merge from `main` — env doc should match **current** file names after TS migration.

### Latest technical information

- **Stripe:** Publishable key (`pk_`) → client; secret (`sk_`) → server only. Webhook signing secret (`whsec_`) → server only.
- **Vercel:** Project env vars are per environment (Production / Preview / Development); document that team should set preview to **test** Stripe and matching webhook secret.

### Project context reference

- No `project-context.md` in repo; use this file, [zephyr-lux-commerce-prd.md](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md), and [architecture.md](_bmad-output/planning-artifacts/architecture.md).

### References

- [PRD §14 — E1-S4](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability)  
- [PRD — NFR-MAINT-004, NFR-DEP-002, NFR-DEP-003, FR-PAY-001, NFR-SEC-002](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md)  
- [epics.md — env var documentation cross-cutting requirement](_bmad-output/planning-artifacts/epics.md)  
- [1-3 — Catalog adapter](1-3-catalog-adapter-static-and-supabase.md)  
- [1-2 — Shared commerce types](1-2-define-shared-commerce-domain-types.md)  
- [1-1 — Runtime imports](1-1-fix-runtime-imports.md)

## Story completion status

- **Status:** `done`  
- **Note:** `.env.example` + README cross-links; `vite-env.d.ts` and minimal client fixes; code review follow-up docs for `VITE_API_URL` + reserved email key placeholder.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `resolve_customization.py` not run: environment lacks Python 3.11+ (`tomllib`); workflow block read from `customize.toml` directly.
- Grep: server env only via `api/_lib/env.ts` → `ENV`; client: `VITE_STRIPE_PUBLIC_KEY`, `VITE_USE_MOCK_STRIPE`, `VITE_API_URL`, `VITE_CATALOG_BACKEND` (`src/catalog/adapter.ts`—documented in `.env.example` as post–story-1-3 addition).

### Completion Notes List

- Added root `.env.example` as the single canonical list: server vars with defaults from `api/_lib/env.ts`, `VERCEL_BLOB_READ_WRITE_TOKEN` → `ENV.VERCEL_BLOB_RW_TOKEN` note, client `VITE_*` with file paths, security boundary (no secrets in `VITE_*`), reserved Supabase names for future epics.
- README: project intro, Configuration section, deployment matrix (local / Vercel Preview / Production) with Stripe test vs live and `FRONTEND_URL` / webhooks; link to `README-payments.md`.
- README-payments: removed duplicate env block; points to `.env.example` and README; kept CLI workflow (`vercel dev`, `stripe listen`).
- `src/vite-env.d.ts`: `ImportMetaEnv` for all `VITE_*` keys in use; `config.ts` and `CheckoutPage.tsx` use `import.meta.env` without `as any` for consistency with AC8.
- `npm run build` passes. `npm run lint` still reports pre-existing issues in other files; not in scope for this story.

### File List

- `.env.example` (new)
- `README.md`
- `README-payments.md`
- `src/vite-env.d.ts`
- `src/utils/config.ts`
- `src/components/Cart/CheckoutPage.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Questions (non-blocking)

- Should the canonical env narrative live only in `.env.example` + README, or also under `docs/`? **Implementer choice** — satisfy AC 1’s “single committed reference” at minimum.  
- If `SubscriptionForm`’s default API URL (`localhost:5000`) is stale vs `vercel dev` port, document the **actual** recommended local stack from [package.json](package.json) scripts (`dev:full` / `server`).

## Change Log

- 2026-04-26 — Story created (bmad-create-story). Target: PRD E1-S4; first `backlog` story in [sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) at time of run.
- 2026-04-26 — Implemented: `.env.example`, README + README-payments alignment, Vite `ImportMetaEnv`, optional `CheckoutPage`/`config` env typing; sprint status `review`.
- 2026-04-26 — Code review: applied README + `.env.example` patches (`VITE_API_URL` vs `vercel dev`, reserved `TRANSACTIONAL_EMAIL_API_KEY`); story `done`.

---

**Checklist (create-story self-validation):** ACs trace to PRD E1-S4, NFR-MAINT-004, NFR-DEP-002/003, FR-PAY-001, NFR-SEC-002; server vars from `api/_lib/env.ts`; client vars from Checkout/config/SubscriptionForm; README-payments deduped; future Supabase vars reserved; `npm run build` gate.
