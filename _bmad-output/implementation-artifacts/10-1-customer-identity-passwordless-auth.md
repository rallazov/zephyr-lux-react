# Story 10.1: Customer identity and passwordless auth foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **returning customer**,
I want to **sign in with my email using a passwordless flow**,
so that I can later view my account without being forced to create or remember a password.

As the **store owner**,
I want customer identity to be **modeled separately from admin auth**,
so that account features can grow without weakening guest checkout, order lookup, or admin security.

## Acceptance Criteria

1. **Given** [FR-CUST-002](../planning-artifacts/epics.md) and PRD §9.10, **when** Supabase migrations run, **then** a first-class **`customers`** table exists with at least `id`, `auth_user_id`, `email`, optional `display_name`, optional `phone`, `created_at`, and `updated_at`; `auth_user_id` is unique when present and references Supabase auth identity by UUID convention. Keep `orders.customer_id` and `customer_subscriptions.customer_id` nullable for guest rows and future linking.

2. **Given** existing [`orders.customer_id`](../../supabase/migrations/20260427090000_orders_and_order_items.sql) and [`customer_subscriptions.customer_id`](../../supabase/migrations/20260430150000_customer_subscriptions.sql) comments already reserve customer linkage, **when** this story adds the customer table, **then** add safe indexes/FKs for customer-linked reads without requiring all historical orders/subscriptions to have a customer id.

3. **Given** the project already has [`AuthContext`](../../src/auth/AuthContext.tsx) for admin password auth, **when** customer passwordless auth is added, **then** introduce a clearly named customer auth path (e.g. `signInWithOtp` / `verifyOtp` or an account auth helper) without breaking admin sign-in with password and `RequireAdmin`.

4. **Given** no service-role key may reach the browser (NFR-SEC-002 / NFR-SEC-005), **when** customer auth helpers run in the SPA, **then** they use only [`getSupabaseBrowserClient`](../../src/lib/supabaseBrowser.ts) with anon credentials; any privileged customer-row creation/linking runs server-side or through constrained RPC/RLS.

5. **Given** guest checkout and `/order-status` are still supported, **when** a shopper has no account session, **then** existing cart, checkout, order confirmation, lookup request, and secure token status flows continue to work unchanged.

6. **Given** an authenticated customer session, **when** the app reads that customer’s own profile row, **then** RLS permits only the matching user to read/update their non-sensitive profile fields; admin policies remain role-gated and are not broadened to all authenticated customers.

7. **Given** this is an auth/security story, **when** implementation is complete, **then** add focused tests for auth helper behavior/configuration states and migration/RLS review notes; run `npm test`, `npm run build`, and `npm run smoke`.

## Tasks / Subtasks

- [x] **Task 1 — Customer schema and indexes (AC: 1, 2, 6)**  
  - [x] Add a migration for `public.customers` with nullable historical linkage support.
  - [x] Add indexes for `auth_user_id` and normalized `email` lookup where needed.
  - [x] Add FK constraints from `orders.customer_id` and `customer_subscriptions.customer_id` only if compatible with existing nullable data.

- [x] **Task 2 — RLS and server-side creation path (AC: 4, 6)**  
  - [x] Enable RLS on `customers`.
  - [x] Add self-read/self-update policies keyed by `auth.uid()` and admin policies that preserve existing `app_metadata.role = admin` behavior.
  - [x] Choose and document how customer rows are created after OTP sign-in: constrained RPC, server handler, or Supabase trigger (**land this decision early—see Dev Notes downstream dependency on [10-2](10-2-account-route-profile-shell.md)**).

- [x] **Task 3 — Browser auth helper (AC: 3, 4, 5)**  
  - [x] Extend `AuthContext` or add an account-specific helper for passwordless email sign-in.
  - [x] Preserve admin `signIn(email, password)` semantics and tests.
  - [x] Add clear errors for missing Supabase env using existing configured-state patterns.

- [x] **Task 4 — Tests and verification (AC: 5, 7)**  
  - [x] Add unit tests for auth helper configured/unconfigured states.
  - [x] Add migration review notes for RLS, FK behavior, and service-role boundaries.
  - [x] Run `npm test`, `npm run build`, and `npm run smoke`.

## Dev Notes

### Scope Boundary

- Do **not** build the `/account` UI here; that is [10-2](10-2-account-route-profile-shell.md).
- Do **not** expose order history yet; customer/order linking is [10-3](10-3-link-orders-to-customers.md), and history UI is [10-4](10-4-account-order-history.md).
- Do **not** replace `/order-status` or secure lookup links.

### Architecture / Security Notes

- Keep admin auth and customer auth behavior distinct even if they share Supabase sessions under the hood.
- Customer sessions must not gain admin table reads through broad `authenticated` policies.
- Prefer normalized lowercase email for matching, but never treat email-only browser input as authorization to read order PII.
- **`AuthProvider` is shared:** admin and storefront use the **same browser Supabase session**. **Sign-out** from `/account` or admin clears **that whole session**. Treat as intentional for MVP unless you later separate projects or UX flows.

### Downstream dependency ([10-2](10-2-account-route-profile-shell.md))

- [10-2](10-2-account-route-profile-shell.md) depends on deterministic behavior after OTP: **finalize Task 2 (customer-row creation path) and commit it** (Dev Agent Record / architecture note) **before finishing** `/account`, so `/account` can assume concrete behavior for **“authenticated but missing profile row”** vs profile reads—either impossible by design or handled with explicit UX.

### Magic-link configuration (coordinate with [10-2](10-2-account-route-profile-shell.md))

- Document **OTP `emailRedirectTo`** (normally storefront **`/account`**) and matching **Redirect URLs / Site URL** in Supabase Dashboard; SPA must **consume the redirect** (exchange code / `detectSessionInUrl` handling). Details live primarily in **10-2**, but **10-1** should state the OTP options so signup and row-creation behave consistently.

## References

- [Epics — FR-CUST-002 and Epic 10](../planning-artifacts/epics.md)
- [PRD §9.10 — Customer Order Lookup](../planning-artifacts/zephyr-lux-commerce-prd.md)
- [`AuthContext.tsx`](../../src/auth/AuthContext.tsx)
- [`supabaseBrowser.ts`](../../src/lib/supabaseBrowser.ts)
- [`orders` migration](../../supabase/migrations/20260427090000_orders_and_order_items.sql)
- [`customer_subscriptions` migration](../../supabase/migrations/20260430150000_customer_subscriptions.sql)

## Dev Agent Record

### Agent Model Used

composer (Cursor agent session); Codex GPT-5 follow-up hardening/validation

### Debug Log References

- `resolve_customization.py` requires Python 3.11+; workflow merge ran from inline skill defaults (`customize.toml` only).

### Completion Notes List

- **Customer schema:** Migration `20260502103000_public_customers_identity.sql` adds `public.customers` with unique nullable `auth_user_id` FK to `auth.users` (ON DELETE CASCADE), normalized-email CHECK, FKs from `orders.customer_id` / `customer_subscriptions.customer_id` (ON DELETE SET NULL), indexes, `updated_at` trigger.
- **Migration hardening:** Customer-linked read indexes now cover `orders.customer_id` and `customer_subscriptions.customer_id`; FK constraints are `NOT VALID` so historical guest-era rows with nullable/reserved customer IDs do not block deploys while new writes are enforced.
- **Row creation:** `SECURITY DEFINER` triggers after `INSERT` on `auth.users` (+ email sync after `UPDATE` of `email`) provision/update `customers` without granting JWT INSERT; identity columns guarded from shopper updates (`set_config`-gated Auth email sync bypasses guard).
- **Existing auth users:** Migration backfills `customers` rows from existing `auth.users` emails so OTP sign-in has deterministic profile-row behavior after the migration is applied.
- **RLS:** Self `SELECT`/`UPDATE` for `authenticated` where `auth.uid() = auth_user_id`; admin `SELECT` when `jwt app_metadata.role = 'admin'` (SELECT-only mirroring subscriptions).
- **Browser OTP:** [`customerAuth`](../../src/auth/customerAuth.ts) uses anon browser client only + `CUSTOMER_OTP_ACCOUNT_REDIRECT_PATH` (`/account`); [`AuthContext`](../../src/auth/AuthContext.tsx) exposes `customerSignInWithEmailOtp` / `verifyCustomerEmailOtp`; [`supabaseBrowser`](../../src/lib/supabaseBrowser.ts) sets PKCE + `detectSessionInUrl`.
- **Tests:** [`customerAuth.test.ts`](../../src/auth/customerAuth.test.ts) covers configured/unconfigured, validation, OTP redirect defaults, OTP verify paths; [`customersMigration.test.ts`](../../src/auth/customersMigration.test.ts) locks key migration/RLS/FK guardrails; admin mocks updated for new context surface.
- **Verification:** `npm test` passed (85 files / 468 tests), `npm run build` passed, and `npm run smoke` passed. Full-repo `npm run lint` still reports pre-existing errors in untouched files (`handlers/_lib/store.ts`, `server/index.ts`, `src/cart/reconcile.ts`, `src/components/Search/SearchPage.test.tsx`, `src/components/SubscriptionForm/SubscriptionForm.tsx`); targeted lint for changed TS files has 0 errors and one longstanding `react-refresh/only-export-components` warning on [`AuthContext`](../../src/auth/AuthContext.tsx).

### File List

- `supabase/migrations/20260502103000_public_customers_identity.sql`
- `src/auth/customerAuth.ts`
- `src/auth/customerAuth.test.ts`
- `src/auth/customersMigration.test.ts`
- `src/auth/AuthContext.tsx`
- `src/lib/supabaseBrowser.ts`
- `src/admin/RequireAdmin.test.tsx`
- `src/admin/AdminLayout.test.tsx`
- `_bmad-output/implementation-artifacts/10-1-customer-identity-passwordless-auth.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] Handle `refreshSession` errors after successful OTP verify — Today `verifyCustomerEmailOtp` ignores the result of `refreshSession()`; callers can see `{ error: null }` while the session is stale or the call throws. [src/auth/customerAuth.ts:61-62]

- [x] [Review][Patch] Provision `customers` on auth email change when row is missing — `customers_sync_email_after_auth_update` only `UPDATE`s by `auth_user_id`. Users created with a blank email skip `customers_provision_after_auth_users`; a later email change updates zero rows, leaving no profile row (conflicts with deterministic post-OTP expectations for story 10-2). [supabase/migrations/20260502103000_public_customers_identity.sql — `customers_sync_email_after_auth_update`]

- [x] [Review][Patch] Normalize/validate OTP redirect targets before calling Supabase — Trim `emailRedirectTo` / `redirectTo` and reject empty strings so whitespace-only values and accidental blank defaults from `resolveCustomerOtpRedirectUrl()` do not reach `signInWithOtp` / `verifyOtp`. [src/auth/customerAuth.ts:28-33,52-57]

- [x] [Review][Defer] OTP abuse and volumetric defenses (rate limits, CAPTCHA, server-side throttles) — Not in story scope; Supabase/project limits and future hardening. [auth platform] — deferred from review

- [x] [Review][Defer] Operator checklist for magic-link allowlists (`Site URL`, Redirect URLs, `/account` parity with `CUSTOMER_OTP_ACCOUNT_REDIRECT_PATH`) and production referrer/log hygiene — Coordinate with 10-2; not enforced in code. — deferred from review

## Change Log

- 2026-05-01 — Code review patches: OTP redirect trim/validation, `refreshSession` error handling, `customers_sync_email_after_auth_update` upsert for missing profile rows; tests extended.
- 2026-05-02 — Hardening: added deploy-safe `NOT VALID` customer FKs, customer_id read indexes, auth.users customer backfill, and migration/RLS guard tests.
- 2026-05-02 — Implementation: customers migration (RLS + auth.users provisioning triggers), OTP helpers (`customerAuth`), `AuthContext` surface + browser PKCE, unit tests (`customerAuth.test.ts`).
- 2026-05-02 — Story created (bmad-create-story). Target: Epic 10 customer identity and passwordless auth foundation.
- 2026-05-01 — Sharpened Task 2 for 10-2 dependency; shared-session sign-out + magic-link coordination notes.
