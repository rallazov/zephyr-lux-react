# Story 10.2: Account route and profile shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Dependencies

- [10-1](10-1-customer-identity-passwordless-auth.md) provides customer identity, RLS, and passwordless auth helpers.

## Story

As a **shopper**,
I want an **optional `/account` page** where I can request a magic link and see my signed-in state,
so that returning to Zephyr Lux feels easier without blocking guest checkout.

As the **store owner**,
I want account navigation to be **honest about what works today**,
so that customers are not sent into dead-end account chrome.

## Acceptance Criteria

1. **Given** [UX-DR3](../planning-artifacts/epics.md) reserves `/account`, **when** the app routes are loaded, **then** `/account` renders inside the storefront [`Layout`](../../src/components/App/Layout.tsx) without breaking existing routes for `/order-status`, `/subscriptions`, `/cart`, admin, or product pages.

2. **Given** a signed-out customer, **when** they open `/account`, **then** they see a passwordless email sign-in form with labeled email input, accessible submit button, pending/success/error states, and no password field.

3. **Given** Supabase browser auth is not configured, **when** `/account` renders, **then** the UI shows a restrained unavailable state and does not throw, blank-screen, or expose implementation secrets.

4. **Given** a customer is signed in, **when** they open `/account`, **then** they see their email/profile shell and a working sign-out control; if no linked orders exist yet, the page clearly offers the existing [`/order-status`](../../src/order-status/OrderStatusLookup.tsx) lookup path.

5. **Given** [9-5](9-5-real-content-placeholder-sweep.md) required the account affordance not to pretend login works before Epic 10, **when** this story ships, **then** [`Navbar`](../../src/components/Navbar/Navbar.tsx) may link the account icon to `/account` with an accessible label such as “Account”; it must not regress search/cart/mobile menu behavior.

6. **Given** guest checkout remains supported, **when** a signed-out shopper adds to cart, checks out, or uses order lookup, **then** no account gate appears in those flows.

7. **Given** accessibility expectations (UX-DR12–DR14 / architecture NFR-A11Y), **when** account form states change, **then** errors and success messages are announced with appropriate semantics (`role="alert"` or equivalent) and keyboard flow remains predictable.

8. **Given** implementation is complete, **when** tests run, **then** add RTL coverage for signed-out, signed-in, and unconfigured states; run `npm test`, `npm run build`, and `npm run smoke`.

## Tasks / Subtasks

- [x] **Task 1 — Route and page shell (AC: 1, 3, 4)**  
  - [x] Add `src/account/AccountPage.tsx` or equivalent and register `/account` in [`App.tsx`](../../src/components/App/App.tsx).
  - [x] Use existing storefront layout and visual language; avoid a marketing landing page.
  - [x] Include link to `/order-status` for guest or no-history fallback.

- [x] **Task 2 — Passwordless sign-in form (AC: 2, 3, 7)**  
  - [x] Wire email submission to the helper from [10-1](10-1-customer-identity-passwordless-auth.md).
  - [x] Align **OTP `emailRedirectTo`** with this route (normally **`https://…/account`** incl. localhost in dev); list required **Redirect URLs** in Dev Agent Record to match Supabase Dashboard.
  - [x] Ensure `/account` (or router root) completes **magic-link redirect handling** (`detectSessionInUrl` / `#`/`?` fragment code exchange)—no blank stall after inbox click.
  - [x] Validate email before submit with local form feedback.
  - [x] Show pending, success, and failure states without leaking provider internals.

- [x] **Task 3 — Signed-in profile state (AC: 4, 6)**  
  - [x] Read current session/user from auth context.
  - [x] Render signed-in email/profile summary and sign-out.
  - [x] Keep checkout and order lookup unauthenticated-friendly.

- [x] **Task 4 — Navigation and tests (AC: 5, 8)**  
  - [x] Update [`Navbar.tsx`](../../src/components/Navbar/Navbar.tsx) account icon target/label.
  - [x] Add route/nav tests for `/account` and existing nav behavior.
  - [x] Run `npm test`, `npm run build`, and `npm run smoke`.

## Dev Notes

### Scope Boundary

- **2026-05-01 — Code review / PO–architect call:** Shipped as a **stacked Epic 10 vertical slice** on this branch (account shell + checkout `customer_id` linkage + authenticated order-history read path). Narrative ownership for linkage vs list/detail fidelity stays with [10-3](10-3-link-orders-to-customers.md) / [10-4](10-4-account-order-history.md)—keep story files and sprint status consistent at merge time.
- Do **not** require account sign-in before checkout.
- Do **not** add subscription billing portal customer self-service unless Epic 10 is explicitly expanded later.

### UX Notes

- Account should feel like a utility surface, not a hero/landing page.
- Prefer concise copy: “Check your email for a sign-in link” after OTP request.
- Mobile nav behavior in [`Navbar.tsx`](../../src/components/Navbar/Navbar.tsx) is easy to regress; preserve `setIsMenuOpen(false)` behavior.

### Auth / session UX

- **`AuthProvider` ([`AuthContext.tsx`](../../src/auth/AuthContext.tsx)) wraps the whole SPA:** storefront customer session and admin session are **one Supabase session**. **Sign-out** on `/account` ends the session for admin too—document as intentional for MVP.
- Depends on **[10-1 Task 2](10-1-customer-identity-passwordless-auth.md)** for **when/whether a `customers` row exists relative to OTP success**, so `/account` can distinguish **session present but missing `customers` row** vs **profile row hydrated** consistently (avoid ambiguous empty states unless explicitly designed).

## References

- [Epics — Epic 10](../planning-artifacts/epics.md)
- [UX design specification — guest-first, account-ready](../planning-artifacts/ux-design-specification.md)
- [`App.tsx`](../../src/components/App/App.tsx)
- [`Navbar.tsx`](../../src/components/Navbar/Navbar.tsx)
- [`OrderStatusLookup.tsx`](../../src/order-status/OrderStatusLookup.tsx)

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- `python3 _bmad/scripts/resolve_customization.py --skill .cursor/skills/bmad-dev-story --key workflow`
- `npm test -- src/account/AccountPage.test.tsx src/components/Navbar/Navbar.scroll.test.tsx src/routes.smoke.test.tsx`
- `npm test -- handlers/create-payment-intent.handler.test.ts`
- `npm test`
- `npm run build`
- `npm run smoke`
- `npm run lint`

### Completion Notes List

- Added `/account` inside the storefront route tree with an account utility shell, unconfigured auth fallback, auth-loading state, guest lookup affordance, signed-out passwordless email form, signed-in email/profile summary, and sign-out control.
- Passwordless OTP requests use `resolveCustomerOtpRedirectUrl()` so `emailRedirectTo` resolves to the current origin plus `/account`. Supabase Auth redirect URLs for this story should include production `https://<production-domain>/account`, any deployed preview domains ending in `/account`, `http://localhost:5173/account`, and `http://127.0.0.1:5173/account`.
- Magic-link redirect handling is covered by the shared Supabase browser client with `detectSessionInUrl: true` and PKCE enabled; `/account` renders from the shared `AuthProvider` session state.
- Updated the navbar account affordance to link honestly to `/account` while preserving search/cart/mobile drawer behavior.
- Kept checkout and order lookup guest-friendly. Also fixed a small checkout/request-header test stabilization issue encountered during full regression validation.
- Note: overlapping Epic 10 account-history work is present in the worktree from story 10-4; **2026-05-01 code review**: team chose **stacked Epic 10** merge (see Scope Boundary)—this branch intentionally carries linkage + history UX alongside `/account`; keep sprint/story statuses honest at merge time.

### File List

- `_bmad-output/implementation-artifacts/10-2-account-route-profile-shell.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/account/AccountPage.tsx`
- `src/account/AccountPage.test.tsx`
- `src/components/App/App.tsx`
- `src/components/Navbar/Navbar.tsx`
- `src/components/Navbar/Navbar.scroll.test.tsx`
- `src/routes.smoke.test.tsx`
- `src/components/Cart/CheckoutPage.tsx`
- `handlers/create-payment-intent.ts`
- `handlers/create-payment-intent.handler.test.ts`
- `handlers/_lib/store.ts`
- `server/index.ts`
- `src/cart/reconcile.ts`
- `src/components/Search/SearchPage.test.tsx`
- `src/components/SubscriptionForm/SubscriptionForm.tsx`

### Review Findings

- [x] [Review][Decision] **Epic 10 stacking vs story 10.2 scope** — **Resolved 2026-05-01:** Accept **stacked Epic 10** delivery on this branch; update Dev Notes / related stories for backlog truth. Co-shipped: order-history API wiring, `/account/orders/:orderId`, checkout Bearer → `customer_id` linkage, and related tests.

- [x] [Review][Patch] **`Store` implementations diverge from the `Store` type** [`handlers/_lib/store.ts`] — Restored `_items`- / `_orderId`-bearing method signatures matching `Store` while keeping stubs no-op.

- [x] [Review][Patch] **Order history fetch can race sign-out/navigation** [`src/account/AccountPage.tsx`] — AbortController + user-id guard skip late `setHistory` after sign-out/account switch.

- [x] [Review][Patch] **`history.status === "idle"` renders as “loading orders”** [`src/account/AccountPage.tsx`] — “Loading…” only renders when status is `"loading"` (idle shows no loading line).

- [x] [Review][Patch] **PaymentIntent bootstrap may miss bearer-only churn** [`src/components/Cart/CheckoutPage.tsx`] — Effect deps include `session?.access_token` alongside storefront auth bootstrap fingerprint.

- [x] [Review][Patch] **Treat flaky JSON success as an error** [`src/account/AccountPage.tsx`] — HTTP 200 with failed parse, absent body, or non-array `orders` surfaces an explicit error instead of silently showing empty history.

- [x] [Review][Patch] **Guard OTP verify “success without session”** [`src/auth/customerAuth.ts`] — Successful `refreshSession()` must return `data.session` or callers get `{ error }`.

- [x] [Review][Patch] **Bearer checkout + missing `SUPABASE_ANON_KEY`** [`handlers/create-payment-intent.ts` / `./_lib/env`] — `log.warn` when Bearer is present but `SUPABASE_ANON_KEY` is empty so linkage skip is observable.

- [x] [Review][Patch] **Harden formatted money rendering** [`src/account/AccountPage.tsx`] — `formatOrderMoneyLine` clamps non-finite cents and Intl failures to “—”.

- [x] [Review][Patch] **Handler tests duplicate production parsing** [`handlers/create-payment-intent.handler.test.ts`] — `vi.mock("./_lib/verifyAdminJwt")` preserves real exports and overrides only `resolveVerifiedCustomerIdForCheckoutOrder`.

- [x] [Review][Patch] **Smoke assertions tied to brittle copy/auth strings** [`src/routes.smoke.test.tsx`] — Account order-detail smoke heading matcher widened to plausible account-detail error/title headings.

## Change Log

- 2026-05-02 — Story created (bmad-create-story). Target: Epic 10 `/account` route and profile shell.
- 2026-05-01 — OTP redirect URLs, SPA callback handling, shared-session sign-out, 10-1 profile-row sequencing.
- 2026-05-02 — Implemented `/account` route/profile shell, passwordless sign-in form, navbar account target, tests, validation, and lint cleanup.
- 2026-05-01 — Code review: decision **1** (stacked Epic 10 vertical slice); Dev Notes scope note added for backlog alignment.
- 2026-05-02 — Code review patches **applied** (store stubs, account history resilience, checkout PI deps + warnings, OTP session guard, money formatting, smoke + handler mocks).
