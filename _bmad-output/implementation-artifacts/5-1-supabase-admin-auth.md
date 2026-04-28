# Story 5.1: Supabase admin auth

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Epic 5 sequencing (dev)

**This story (5-1) is the sole owner** of the migration that adds admin **`SELECT`** RLS on **`orders`**, **`order_items`**, and **`notification_logs`**. Stories **5-2** and **5-3** consume those policies — **do not** add duplicate migrations there. See [`sprint-status.yaml`](sprint-status.yaml) Epic 5 comments for recommended order: **5-1 → 5-2 → 5-3 → 5-4 → 5-5 → 5-6**.

## Story

As an **owner/operator**,
I want **Supabase-backed sign-in with a verifiable admin role and database policies that honor that role**,
so that **`/admin` is genuinely protected per FR-ADM-001 / NFR-SEC-005** — not only router UI guards — and **Epic 5 order screens (5-2 onward) can safely read orders and notification history** using the **same JWT + RLS pattern** already used for catalog admin (story **2-6**).

## Acceptance Criteria

1. **Auth surface (existing code — audit & complete gaps)**  
   **Given** the app already exposes Supabase Auth in the browser ([`src/lib/supabaseBrowser.ts`](../../src/lib/supabaseBrowser.ts), [`src/auth/AuthContext.tsx`](../../src/auth/AuthContext.tsx)), **`/admin/login`** ([`src/admin/AdminLogin.tsx`](../../src/admin/AdminLogin.tsx)), and **`RequireAdmin`** ([`src/admin/RequireAdmin.tsx`](../../src/admin/RequireAdmin.tsx)) gated on **`isAdminUser`** ([`src/auth/isAdmin.ts`](../../src/auth/isAdmin.ts)) with **`JWT app_metadata.role === "admin"`**, **when** this story completes, **then** behavior is **documented in dev notes**, **misconfiguration paths** (missing env, signed-in non-admin) remain **explicit and accessible** (existing `data-testid`s preserved), and any **critical gap** (e.g., post-metadata-update session not reflecting `role` until refresh) is **closed** with **`refreshSession()`** or documented **sign-out/sign-in** steps only if code fix is unjustified.

2. **RLS — admin SELECT on orders and related read models (sole migration owner for these tables)**  
   **Given** [`supabase/migrations/20260427090000_orders_and_order_items.sql`](../../supabase/migrations/20260427090000_orders_and_order_items.sql) enables RLS on **`orders`** / **`order_items`** with **no** `authenticated` policies (service role only today), **and** [`supabase/migrations/20260428160000_notification_logs.sql`](../../supabase/migrations/20260428160000_notification_logs.sql) defers **`notification_logs`** authenticated access to Epic 5 — **when** migrations run, **then** add **`SELECT` policies** for role **`authenticated`** using the **same JWT predicate as catalog admin** (`coalesce((auth.jwt()->'app_metadata'->>'role'),'')='admin'` — see [`20260426220000_admin_rls_and_save_rpc.sql`](../../supabase/migrations/20260426220000_admin_rls_and_save_rpc.sql)). **Downstream stories (5-2, 5-3) assume these policies exist** — implement **here once** only:  
   - `orders`: admin **`SELECT`** only (no broaden anon; **do not** add general `authenticated` inserts/updates unless a later story specifies fulfillment writes).  
   - `order_items`: admin **`SELECT`**.  
   - `notification_logs`: admin **`SELECT`** only (writes remain **service_role** via [`api/_lib/notificationLog.ts`](../../api/_lib/notificationLog.ts); do not weaken webhook-only write boundary).

3. **No service role / secrets in browser (NFR-SEC-002)**  
   **Given** NFR-SEC-002 and [`.env.example`](../../.env.example), **then** verification is unchanged: **`VITE_*`** exposes only **`VITE_SUPABASE_URL`** + **`VITE_SUPABASE_ANON_KEY`** for admin SPA; **`SUPABASE_SERVICE_ROLE_KEY`** remains server-only.

4. **Operational clarity**  
   **Given** [.env.example](../../.env.example) (Admin / `app_metadata`) already explains Dashboard setup, **when** docs are touched, **then** optionally add **one short subsection** under dev notes **or** a single **README/admin-auth.md** pointer **only if** the team wants a centralized runbook — **prefer** enriching story dev notes unless repo standard is `docs/` (keep scope minimal).

5. **Tests**  
   **Given** NFR-MAINT-003 and existing [`src/auth/isAdmin.test.ts`](../../src/auth/isAdmin.test.ts), **when** the story completes, **then** add or extend tests so **confidence is non-trivial**: e.g. **Vitest tests** for **`RequireAdmin` redirect branches** (using **`MemoryRouter`**) **or** a **small integration test** that mocks Supabase Auth state — **avoid** flaky real-project network calls.

## Tasks / Subtasks

- [x] **Task 1 — RLS migration (AC: 2, 3)**  
  - [x] New migration file under [`supabase/migrations/`](../../supabase/migrations/): **`CREATE POLICY ... FOR SELECT`** on **`orders`**, **`order_items`**, **`notification_logs`** for **`TO authenticated`** with JWT admin predicate; names mirror existing style (`*_admin_*` or `*_select_admin_*`).  
  - [x] Confirm **`payment_events`** and other webhook-only tables: **do not** add permissive reads unless explicitly required — out of scope for 5-1 unless order UI needs them in 5-2 (default: **omit** unless you confirm a foreign join requirement).

- [x] **Task 2 — Auth UX / JWT freshness (AC: 1)**  
  - [x] After successful `signInWithPassword`, if **`user.app_metadata.role`** is stale vs Dashboard, **`auth.getSession()` / `refreshSession()`** behavior verified; align with Supabase documented behavior for metadata updates.

- [x] **Task 3 — Tests (AC: 5)**  
  - [x] Add **`RequireAdmin.test.tsx`** (or equivalent) covering: unauthenticated → `/admin/login`; non-admin → forbidden UI; admin → `Outlet`; not configured → redirect per current contract.

### Review Findings

- [x] [Review][Patch] Duplicate migrations define the same SELECT policies (`orders_admin_select`, `order_items_admin_select`, `notification_logs_admin_select`) — `20260429120000_admin_select_orders_order_items_notification_logs.sql` repeats policies already created in `20260428170000_admin_orders_notification_select_rls.sql`, so sequential `supabase migration up` fails with duplicate policy errors; violates Epic 5 “sole migration owner” and AC 2 wording. Consolidate into one migration (typically keep policies in `20260428170000_*`, move only the admin list index and comment into the later migration or squash before deploy).
- [x] [Review][Patch] `refreshSession()` failure after successful `signInWithPassword` — `signIn` returns `refreshError` as the primary error [`src/auth/AuthContext.tsx:57-62`]; user may believe sign-in failed even when credentials succeeded; consider returning `{ error: null }` while logging/handling stale metadata separately, unless product insists on treating refresh failures as blocking.

- [x] [Review][Defer] No Postgres/RLS integration coverage for new policies [`supabase/migrations/…`] — deferred, CI uses Vitest mocks unless pipeline adds Supabase-backed tests.
- [x] [Review][Defer] `RequireAdmin.test.tsx` mocks `session` as `{} as Session`; weak typings can hide regressions in Supabase shape — deferred, common mock shortcut [`src/admin/RequireAdmin.test.tsx`].

## Dev Notes

### Story intent (brownfield clarity)

Brownfield repo **already wires** Email+Password Auth and `/admin/*` guards. Epic **PRD §14 E5-S1** ("Add Supabase admin auth") in this codebase means: **finish the security boundary for Epic 5** — especially **RLS so server truth matches UI** ([architecture.md § Cross-cutting #8](../../_bmad-output/planning-artifacts/architecture.md): *RLS not app checks alone*) — **without** rewriting working admin product flows (**2-6**).

### Current implementation map (touch only what you must)

| Area | Role today | Notes |
|------|-----------|-------|
| [`src/auth/AuthContext.tsx`](../../src/auth/AuthContext.tsx) | Session + `signInWithPassword` / `signOut` | Client-only; JWT drives RLS |
| [`src/admin/RequireAdmin.tsx`](../../src/admin/RequireAdmin.tsx) | UI gate + `Outlet` | Complements DB — not substitute |
| [`src/admin/AdminLogin.tsx`](../../src/admin/AdminLogin.tsx) | Login + non-admin messaging | Preserve `data-testid`s |
| [`src/admin/AdminLayout.tsx`](../../src/admin/AdminLayout.tsx) | Header + Sign out | Already exposes sign-out |
| Catalog tables | **`FOR ALL`** admin policies ([`20260426220000_admin_rls_and_save_rpc.sql`](../../supabase/migrations/20260426220000_admin_rls_and_save_rpc.sql)) | **Pattern to mirror** |
| **`orders` / `order_items` / `notification_logs`** | RLS deny for anon/auth | **Story adds SELECT-only admin policies** |

### Technical requirements

- **FR** [FR-ADM-001](../../_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md): Admin area protected; unauthorized cannot access admin data via UI **or bypass RLS**.  
- **NFR** [NFR-SEC-003](../../_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md) (admin APIs verify authorization): For **SPA → PostgREST** reads after this story, **`anon` JWT + RLS** is the verifier; future **`/api/admin/*`** routes must **`getUser(access_token)`** or validate JWT separately — note for 5-2..5-4 **if** Edge handlers are introduced.  
- **NFR** [NFR-SEC-005](../../_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md): RLS protects orders and logs.  
- **UX** [UX-DR2](../../_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md): Admin routes remain behind authentication.

### Architecture compliance

- **Three trust zones** ([architecture](../../_bmad-output/planning-artifacts/architecture.md)): browser (anon key + user JWT); serverless service role webhook paths unchanged; Postgres RLS for admin **`authenticated`** role elevated by **`app_metadata.role`**.  
- **Do not** duplicate **owner notification**/`notification_logs`** **writes** in the browser — only **SELECT** policies for read surfaces in Epic 5.

### File structure expectations

| Action | Paths |
|--------|-------|
| **Migration** | `supabase/migrations/YYYYMMDDHHMMSS_admin_orders_notification_select_rls.sql` (timestamp ≥ existing latest) |
| **Tests** | `src/admin/RequireAdmin.test.tsx` or `src/auth/*.test.tsx` adjacent to code |
| **Optional** | tiny helper only if duplication warrants — avoid new `lib/` churn |

### Testing requirements

- **Vitest** + React Testing Library for route guard; mock `useAuth` or wrapper provider.  
- **No live Supabase** in CI unless project already runs local Supabase in pipeline (default: mocks).

### Previous story intelligence (Epic 4 tail)

From **[4-7-log-notification-status.md](4-7-log-notification-status.md)**: `notification_logs` was intentionally **service_role write** until Epic **5** exposes admin read — **this story implements that READ path via RLS**, not UI yet.

### Git intelligence summary

Recent work focused on payments, webhook idempotency, Resend notifications, **`notification_logs`**. **Admin SPA** for catalog already merged in prior epics — **consistent JWT role naming** (`"admin"` string) across JS + SQL.

### Latest technical specifics (Supabase)

- Prefer **`auth.jwt()->'app_metadata'->>'role'`** in policies (matches existing migrations).  
- After changing **`app_metadata`** in Dashboard, **`refreshSession()`** may be needed — refer to [@supabase/supabase-js](https://github.com/supabase/supabase-js) **Auth** docs for **current** SDK behavior (**2026**: verify project’s installed major version in `package.json`).

### Project context reference

- [zephyr-lux-commerce-prd.md § Epic 5](../../_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md) · [epics.md requirements inventory §9.8 Owner Admin](../../_bmad-output/planning-artifacts/epics.md) · [.env.example § Admin](../../.env.example)

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

### Completion Notes List

- **RLS:** Added migration `20260428170000_admin_orders_notification_select_rls.sql` with admin-only `SELECT` policies on `orders`, `order_items`, and `notification_logs` using the same JWT predicate as catalog admin (`coalesce((auth.jwt()->'app_metadata'->>'role'),'')='admin'`). No policies on `payment_events` or other webhook tables (out of scope).
- **Auth:** After successful `signInWithPassword`, `AuthContext.signIn` calls `refreshSession()` so `app_metadata.role` updates from the Supabase Dashboard are reflected in the client JWT without requiring a manual full page reload.
- **Tests:** `RequireAdmin.test.tsx` covers not configured → login redirect, loading, no user → login, non-admin → `admin-forbidden`, admin → outlet. Full Vitest suite: 157 passed.

### File List

- `supabase/migrations/20260428170000_admin_orders_notification_select_rls.sql`
- `src/auth/AuthContext.tsx`
- `src/admin/RequireAdmin.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-27: Story 5-1 — admin SELECT RLS for orders/order_items/notification_logs; `refreshSession` after admin sign-in; `RequireAdmin` Vitest coverage.

---

## Saved questions (optional product calls)

_None blocking — escalate if Stripe-authenticated identities are ever mixed with Supabase Auth for storefront customers (Q10)._
