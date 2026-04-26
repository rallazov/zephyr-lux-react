# Story 1.4: Document environment variables (local, preview, production)

Status: ready-for-dev

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

- [ ] **Task 1 — Inventory (AC: 1–3, 5)**  
  - [ ] Grep / confirm all `process.env.*` and `import.meta.env` usages in `api/**`, `src/**` (re-scan before finalizing; dual `.js`/`.ts` pairs may still exist).  
  - [ ] Cross-check [api/_lib/env.ts](api/_lib/env.ts) vs any API route importing env.

- [ ] **Task 2 — Author `.env.example` (AC: 1–5, 7)**  
  - [ ] Add committed `.env.example` with grouped sections: Server (Vercel), Client (Vite), Future/Reserved.  
  - [ ] Use placeholder values only (`sk_test_...`, `whsec_...`, etc.).

- [ ] **Task 3 — Environment matrix + README alignment (AC: 4, 6)**  
  - [ ] Add local / preview / production guidance (Stripe mode, webhook URL, `FRONTEND_URL`).  
  - [ ] Update [README.md](README.md) with a short “Configuration” pointer and reconcile [README-payments.md](README-payments.md).

- [ ] **Task 4 — Optional typing (AC: 8)**  
  - [ ] Update [src/vite-env.d.ts](src/vite-env.d.ts) for `VITE_*` keys if quick.

- [ ] **Task 5 — Verify (AC: 8)**  
  - [ ] `npm run build`.

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

- **Status:** `ready-for-dev`  
- **Note:** Ultimate context engine analysis completed — comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

_(Populate during dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Questions (non-blocking)

- Should the canonical env narrative live only in `.env.example` + README, or also under `docs/`? **Implementer choice** — satisfy AC 1’s “single committed reference” at minimum.  
- If `SubscriptionForm`’s default API URL (`localhost:5000`) is stale vs `vercel dev` port, document the **actual** recommended local stack from [package.json](package.json) scripts (`dev:full` / `server`).

## Change Log

- 2026-04-26 — Story created (bmad-create-story). Target: PRD E1-S4; first `backlog` story in [sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) at time of run.

---

**Checklist (create-story self-validation):** ACs trace to PRD E1-S4, NFR-MAINT-004, NFR-DEP-002/003, FR-PAY-001, NFR-SEC-002; server vars from `api/_lib/env.ts`; client vars from Checkout/config/SubscriptionForm; README-payments deduped; future Supabase vars reserved; `npm run build` gate.
