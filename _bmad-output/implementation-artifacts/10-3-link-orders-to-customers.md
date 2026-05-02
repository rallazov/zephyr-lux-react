# Story 10.3: Link paid orders to customer records

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Dependencies

- [10-1](10-1-customer-identity-passwordless-auth.md) provides the `customers` table and auth-user mapping.
- Epic 4 order persistence and Epic 7 order lookup are complete.

## Story

As a **signed-in customer**,
I want purchases made with my account email to be **associated with my customer record**,
so that my future account page can show order history.

As the **store owner**,
I want order linking to happen **server-side and idempotently**,
so that customer history does not leak PII or duplicate/steal guest orders.

## Acceptance Criteria

1. **Given** an authenticated customer exists in `customers`, **when** a new checkout/order is created with a matching signed-in customer context or verified customer identity, **then** the resulting `orders.customer_id` is set to that customer id by a trusted server path; the browser must not be able to set arbitrary `customer_id`.

2. **Given** guest checkout remains supported, **when** a shopper checks out without an account session, **then** the order still persists with `customer_id = null` and existing confirmation, webhook, inventory, and email flows continue unchanged.

3. **Given** payment success handlers may run more than once, **when** customer linking runs from create-payment-intent, Stripe webhook, or a helper used by those paths, **then** it is idempotent and does not overwrite an already-linked order with a different customer id.

4. **Given** email addresses can differ in case/whitespace, **when** server code matches an order to a customer by email, **then** it normalizes safely and only links when the identity is verified enough for account history; document whether automatic historical backfill is allowed, manual-only, or intentionally out of scope.

5. **Given** existing secure lookup links use token authorization, **when** customer linking is added, **then** [`order_lookup_tokens`](../../supabase/migrations/20260430140000_order_lookup_tokens.sql) behavior and `/order-status/:token` response shape do not change.

6. **Given** `customer_subscriptions.customer_id` is nullable, **when** a subscription checkout or webhook sees a verified customer identity for the same customer, **then** linking subscription rows may be added if low risk; if deferred, document the exact follow-up in Dev Agent Record without blocking order history.

7. **Given** security requirements, **when** tests cover linking, **then** they assert that arbitrary client payloads cannot claim another customer’s id, guest orders still work, and duplicate webhook/apply-payment calls do not relink incorrectly.

8. **Given** implementation is complete, **when** validation runs, **then** run `npm test`, `npm run build`, and focused handler tests around create-payment-intent / webhook order creation.

## Tasks / Subtasks

- [x] **Task 1 — Server linking design (AC: 1, 3, 4, 7)**  
  - [x] Identify the safest owner path: [`create-payment-intent`](../../handlers/create-payment-intent.ts), [`applyPaymentSuccess`](../../handlers/_lib/applyPaymentSuccess.ts), and/or Stripe webhook.
  - [x] Add a shared helper for resolving a verified customer id from session/email context.
  - [x] Refuse arbitrary browser-provided `customer_id`.

- [x] **Task 2 — Order persistence integration (AC: 1, 2, 3)**  
  - [x] Set `orders.customer_id` only from trusted server logic.
  - [x] Preserve guest order creation and payment-event idempotency.
  - [x] Do not alter existing order numbers, totals, line snapshots, inventory, or notification logs.

- [x] **Task 3 — Optional subscription linkage decision (AC: 6)**  
  - [x] Review [`subscriptionLifecycle`](../../handlers/_lib/subscriptionLifecycle.ts) and [`customer_subscriptions`](../../supabase/migrations/20260430150000_customer_subscriptions.sql).
  - [x] Either link rows safely or record a precise follow-up.

- [x] **Task 4 — Tests and documentation (AC: 4, 5, 7, 8)**  
  - [x] Add handler/helper tests for signed-in, guest, duplicate, and mismatch cases.
  - [x] Confirm order lookup token tests still pass.
  - [x] Document any historical backfill/manual production guidance.
  - [x] Run `npm test`, `npm run build`, and focused handler tests.

## Dev Notes

### Scope Boundary

- Do **not** create the account order-history UI here; [10-4](10-4-account-order-history.md) consumes this linked data.
- Do **not** make email equality alone a browser-side authorization mechanism.
- Do **not** break existing admin order list/detail behavior.

### Technical Notes

- Existing order table already has nullable `customer_id`; use that instead of adding parallel account-order tables.
- Prefer a small helper with tests over duplicating linking logic in both create and webhook handlers.
- Be explicit in Dev Agent Record if historical guest orders are not backfilled automatically.

### Trusted linkage shape (implementation preference)

- **Primary path:** set `orders.customer_id` at **order creation** inside [`create-payment-intent`](../../handlers/create-payment-intent.ts): when present, read an **`Authorization: Bearer`** access token from the Checkout request, verify the JWT server-side (same general pattern as admin [`verifyAdminJwt`](../../handlers/_lib/verifyAdminJwt.ts), but **without** requiring `app_metadata.role === admin`), resolve the matching `customers.id`, and persist `customer_id` on insert. [`create-payment-intent`](../../handlers/create-payment-intent.ts) CORS Allow-Headers already includes `Authorization`; [`CheckoutPage`](../../src/components/Cart/CheckoutPage.tsx) must **attach the bearer** when the shopper has an active storefront session (`session.access_token`). Guest checkout stays **omit Bearer → `customer_id` null**.
- **Do not rely on webhook-only linkage** as the authoritative path: Stripe PaymentIntent metadata today carries **`email` plus `order_id`**, not `auth.uid()`, so widening trust downstream is weaker unless metadata is deliberately extended—with full review—not as a shortcut to skip bearer verification at order creation.
- **Idempotency:** any later touch (including [`applyPaymentSuccess`](../../handlers/_lib/applyPaymentSuccess.ts) / Stripe retries) **must never** overwrite a non-null `customer_id` with a different customer.
- **Product decision — email vs linkage rule:** tying linkage to **normalized equality between checkout email and `customers.email`** after verified JWT is **conservative and safe** but **blocks signed-in shoppers from legitimately placing an order whose contact/recipient email differs from their profile** (gifting). If MVP accepts that restriction, encode it explicitly; otherwise document an alternative (**link by verified `auth_user_id` only** and treat checkout email purely as transactional contact).

## References

- [Epics — Epic 10](../planning-artifacts/epics.md)
- [`orders` migration](../../supabase/migrations/20260427090000_orders_and_order_items.sql)
- [`create-payment-intent.ts`](../../handlers/create-payment-intent.ts)
- [`applyPaymentSuccess.ts`](../../handlers/_lib/applyPaymentSuccess.ts)
- [`stripe-webhook.ts`](../../handlers/stripe-webhook.ts)
- [`order_lookup_tokens` migration](../../supabase/migrations/20260430140000_order_lookup_tokens.sql)

## Dev Agent Record

### Agent Model Used

Cursor agent (gpt-5.2-codex)

### Debug Log References

Vitest isolate run showed `ENOTFOUND test.supabase.co` when tests used `vi.mock(..., importOriginal)` for `./_lib/verifyAdminJwt`; `importOriginal` pulled the real resolver, `getUser()` attempted network fetch → handler 500 / mock call count drift. Resolved with **manual `vi.mock`** for `./_lib/verifyAdminJwt` (no network) only in [`handlers/create-payment-intent.handler.test.ts`](../../handlers/create-payment-intent.handler.test.ts).

### Completion Notes List

- **Linkage path:** `handlers/create-payment-intent.ts` parses optional Bearer, calls [`resolveVerifiedCustomerIdForCheckoutOrder`](../../handlers/_lib/verifyAdminJwt.ts) (verified JWT → `customers.auth_user_id` → `customers.id`), inserts `customer_id` on the pending order. No `customer_id` in POST body (`zod` schema unchanged; unknown keys stripped). **`applyPaymentSuccess`** PATCH explicitly does not touch `customer_id` (documented comment + assertion in tests) so Stripe retries cannot relink/overwrite.
- **Product rule (AC4 / gifting):** Link by **verified `auth_user_id` → `customers` row** only (not checkout-email equality to profile). Transactional checkout email stays as today for `customer_email`; `normalizeOrderContactEmail()` remains available for future stricter guards.
- **Historical backfill:** Intentionally **out of scope** for MVP; past guest orders are not auto-associated. Operators may reconcile manually in admin/DB if ever required.
- **Subscriptions (AC6):** Deferred — webhook snapshot still writes `customer_subscriptions` with **`customer_id: null`** (`subscriptionLifecycle`). **Follow-up:** when storefront subscription PI creation carries Bearer the same way as checkout, optionally set both `customer_id` on subscribe rows and reconcile email in one reviewed change (avoid widening trust solely from Stripe email metadata alone).

### File List

- `handlers/_lib/verifyAdminJwt.ts`
- `handlers/create-payment-intent.ts`
- `handlers/create-payment-intent.handler.test.ts`
- `handlers/_lib/applyPaymentSuccess.ts`
- `handlers/_lib/applyPaymentSuccess.test.ts`
- `handlers/customer-account-order-history.ts`
- `handlers/customer-account-order-history.test.ts`
- `handlers/_lib/verifyAdminJwt.customer-resolve.test.ts`
- `src/components/Cart/CheckoutPage.tsx`
- _Removed:_ `handlers/_lib/resolveVerifiedCheckoutCustomerId.ts`, `handlers/_lib/resolveVerifiedCheckoutCustomerId.test.ts` (logic merged into `verifyAdminJwt.ts`)

### Review Findings

BMAD code review (2026-05-01): diff scope `git diff HEAD` for  
`handlers/_lib/verifyAdminJwt.ts`, `handlers/create-payment-intent.ts`,
`handlers/create-payment-intent.handler.test.ts`,
`handlers/_lib/applyPaymentSuccess.ts`,
`handlers/_lib/applyPaymentSuccess.test.ts`,
`src/components/Cart/CheckoutPage.tsx`; spec
`10-3-link-orders-to-customers.md`. Review mode **full**.
Focused tests `npm test -- --run` on the above handler/unit files (12/12 passed);
`npm run build` passed during review.

- **Decision-needed:** none  
- **Patch:** none  
- **Deferred:** none  
- **Dismissed (noise / non-actionable):** optional follow-up refactor to move storefront JWT helpers out of `verifyAdminJwt.ts` for naming clarity; hypothetical Stripe Elements remount when Bearer refetches PI without fingerprint change — no malfunction observed (`storefrontAuthBootstrap` on deps refetches keyed PI; Stripe supports `options.clientSecret` updates).

Layer notes: **Acceptance Auditor** confirms AC alignment with explicit Dev Agent Record trade-offs (auth_user_id linkage vs AC4 email-matching narrative; subscriptions deferred AC6).

## Change Log

- 2026-05-02 — Story created (bmad-create-story). Target: Epic 10 order/customer linkage.
- 2026-05-01 — Clarified trusted linkage at `create-payment-intent` via optional Bearer JWT; webhook-only cautions and email-vs-contact product trade-off.
- 2026-05-01 — Implemented: Bearer + `customers` linkage at order insert; `CheckoutPage` sends `Authorization`; resolver + tests consolidated into `verifyAdminJwt`; subscription `customer_id` linkage deferred per Dev Agent Record.
