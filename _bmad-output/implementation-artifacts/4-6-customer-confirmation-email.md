# Story 4.6: customer-confirmation-email

Status: done

## Review Gate (must resolve before dev)

- **Blocked by [4-3](4-3-payment-success-order-paid.md):** 4-3 is still `in-progress`; do not implement customer confirmation until the paid-order transition contract is settled.
- **Blocked by checkout contact/shipping persistence:** current checkout only sends `items`, `email`, and `currency` to `api/create-payment-intent`; `orders.shipping_address_json` is a placeholder. 4-6 cannot meet its required email content until checkout stores a real structured address.
- **Prefer [4-7](4-7-log-notification-status.md) first:** notification attempts need durable queued/sent/failed state so a webhook crash after `paid` does not permanently skip the customer email on retry.
- **Placeholder email guard:** never send to the fallback `pending@checkout.zephyr.local`; fail checkout earlier or skip/log the notification as not sendable.
- **Resend launch gate:** before enabling real sends, confirm server env vars are present and the configured `from` domain/address is verified in Resend; document sandbox vs production sender expectations.

<!-- Ultimate context: PRD E4-S6, FR-NOT-002, Epic 4 cross-story ordering with 4-5 / 4-7. -->

## Story

As a **customer who just completed checkout**,
I want **a clear order confirmation email after my payment is confirmed**,
so that **I have a record of my order (number, what I bought, where it ships), know how to get help, and what happens next** — **FR-NOT-002**, **PRD §9.7**, **PRD §14 E4-S6**, **UX-DR1** (one truth across email and UI per [ux-design-specification.md](../planning-artifacts/ux-design-specification.md)).

## Acceptance Criteria

1. **Given** [FR-PAY-002](../planning-artifacts/zephyr-lux-commerce-prd.md) (webhook is source of paid truth) and a successful path through **[4-3](4-3-payment-success-order-paid.md)** where an **`orders` row** reaches **`payment_status = 'paid'`** for the first time, **when** the system sends the customer confirmation, **then** the email is sent **only after** that paid transition (never on `pending_payment` or client-only “success”). *[FR-NOT-002 “not before payment success”]*

2. **Given** [FR-NOT-002](../planning-artifacts/zephyr-lux-commerce-prd.md) acceptance criteria, **when** the email is delivered, **then** it includes at minimum: **order number** (`ZLX-…` from `orders.order_number`), **order summary** (line items with titles/SKU or variant labels, quantities, and money consistent with `order_items` snapshots and order totals in **displayed currency**), **shipping address** (from `orders.shipping_address_json` or equivalent stored snapshot), **support contact** (configurable: env such as `SUPPORT_EMAIL` or `CONTACT_EMAIL` with sensible fallback in Dev Notes), and **next-step messaging** (plain language: e.g. processing time, “you’ll get tracking when it ships,” link to published policies if URLs are available via `FRONTEND_URL`). *[FR-NOT-002 body requirements]*

3. **Given** [NFR-REL-002](../planning-artifacts/zephyr-lux-commerce-prd.md) / duplicate Stripe deliveries, **when** the same payment success is processed more than once, **then** the customer receives **at most one** confirmation email per order while still allowing recovery if the first webhook marked `paid` but crashed before sending. Use a durable `customer_confirmation_sent_at` marker, `notification_logs` keyed by order/template/channel, or equivalent; do **not** rely only on the first `pending_payment` → `paid` branch unless missed sends are recoverable. *[Prevents double email on webhook retry without silent loss]*

4. **Given** [NFR-REL-003](../planning-artifacts/zephyr-lux-commerce-prd.md) (“notification failures must not lose the order”) and [architecture.md](../planning-artifacts/architecture.md) **Cross-Cutting #12**, **when** the email API errors or the provider is unconfigured, **then** the **order/payment state remains valid** (webhook still completes successfully as today); failure is **structured-logged** with correlation (`Stripe event.id`, `order.id`, `order_number`) and is **operationally retriable** (manual resend in admin is Epic 5+; for MVP, document operator workaround). *Do not throw after DB commit in a way that blocks `payment_events` finalization for a delivered payment.*

5. **Given** [FR-AN-003](../planning-artifacts/zephyr-lux-commerce-prd.md) and [NFR-PRI-001/003](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** logging email attempts, **then** do **not** log full message bodies, Resend API keys, or unnecessary PII; stack traces sanitized.

6. **Given** [NFR-SEC-002](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** calling the email provider, **then** use **server-only** config (`RESEND_API_KEY` already in [`api/_lib/env.ts`](../../api/_lib/env.ts)) — **never** expose keys to Vite/client.

7. **Given** [NFR-MAINT-003](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** the feature ships, **then** add **Vitest** coverage for: **pure** HTML/text rendering helpers (snapshots of key fields) and/or a **mocked** email send with **idempotency** assertions (no second send on duplicate `apply` path). **No** live Resend in CI.

8. **Given** a pending checkout fallback email such as `pending@checkout.zephyr.local`, **when** customer confirmation is evaluated, **then** the provider send is skipped or the checkout is rejected before payment; the system logs/records the unsendable recipient and does not call Resend with the placeholder address.

## Tasks / Subtasks

- [x] **Task 1 — Provider + env (AC: 4, 6)**  
  - [x] Add **`resend`** npm package (official SDK) **or** document minimal `fetch` to `https://api.resend.com/emails` with the same security boundaries.  
  - [x] Extend [`api/_lib/env.ts`](../../api/_lib/env.ts) / [`.env.example`](../../.env.example): **`FROM_EMAIL`** (or `RESEND_FROM`) — Resend requires a verified domain/sender; document sandbox vs production.  
  - [x] Add **`SUPPORT_EMAIL`** (or `CONTACT_EMAIL`) for footer/support copy.  
  - [x] If `RESEND_API_KEY` is missing in dev: **no-op** with `info` log (same spirit as optional email in `.env.example` line 43).  
  - [x] Add a launch-readiness check/runbook: `RESEND_API_KEY`, support/contact email, and verified `from` domain/address must be present before production sends are enabled; document local/sandbox sender behavior in [`.env.example`](../../.env.example).

- [x] **Task 2 — Send on paid transition (AC: 1, 3, 4)**  
  - [x] Hook **after** the order is durably `paid`, using a durable marker/log to decide whether this customer confirmation is still pending. The already-paid retry path must be able to send/backfill if the first webhook crashed after marking paid but before notification.  
  - [x] Load **full** order + `order_items` for the message body (use existing Supabase admin client patterns from [`api/_lib/supabaseAdmin.ts`](../../api/_lib/supabaseAdmin.ts)).  
  - [x] **Idempotency:** Prefer [4-7](4-7-log-notification-status.md) `notification_logs` or add a column (e.g. `customer_confirmation_sent_at timestamptz` on `orders`) with a conditional send decision. Do not rely strictly on the single “rows updated = 1” path without a recovery mechanism.
  - [x] Guard against fallback recipients: never send to `pending@checkout.zephyr.local` or any configured placeholder domain; log/record a failed/unsendable notification instead.

- [x] **Task 3 — Content + templates (AC: 2)**  
  - [x] Implement a **plain, readable** HTML body (and optional `text` part) with order number, line table, address block, support line, and next steps; keep styling minimal and **mobile-email** safe.  
  - [x] Use **snapshot** fields from `order_items` (FR-ORD-005), not live catalog.  
  - [x] **Money:** format from cents + `orders.currency` (consistent with server formatting elsewhere).
  - [x] Verify `orders.shipping_address_json` is a real structured address, not `PENDING_CHECKOUT_SHIPPING_JSON`. If checkout still has a single freeform textarea, add/require a prerequisite story to reshape it into `addressSchema` fields or Stripe AddressElement output.

- [x] **Task 4 — Coordination with [4-5](sprint-status.yaml) (AC: —)**  
  - [x] If **[4-5](4-5-owner-order-notification.md)** (owner email) is implemented in the same sprint, **extract** a shared `api/_lib/transactionalEmail.ts` (or similar) for Resend client + logging; if 4-5 is not merged yet, **keep** a small internal module for customer mail only and leave a short note for 4-5 to **reuse** (avoid two competing Resend wrappers).

- [x] **Task 5 — [4-7](4-7-log-notification-status.md) handoff (AC: 4)**  
  - [x] Prefer sequencing **[4-7](4-7-log-notification-status.md) before 4-6** so queued/sent/failed state exists before real customer email. If 4-6 lands first, add an equivalent durable marker now and document exactly how 4-7 will migrate/reuse it.

- [x] **Task 6 — Tests (AC: 7)**  
  - [x] Unit tests for formatters; mock Resend; assert idempotent call counts on duplicate “paid” application.

## Dev Notes

### Developer context

- **Why here:** [PRD §14 Epic 4](../planning-artifacts/zephyr-lux-commerce-prd.md) E4-S6; closes the loop for **“Customer receives confirmation”** in Epic 4 acceptance list (with [4-5](sprint-status.yaml) for owner, [4-7](sprint-status.yaml) for logging polish).  
- **Primary FR:** **FR-NOT-002** — [PRD §9.7 Owner Notifications — FR-NOT-002](../planning-artifacts/zephyr-lux-commerce-prd.md) (customer must receive order confirmation after payment success with required content).

### Technical requirements (guardrails)

| Topic | Direction |
|-------|-----------|
| **Trigger** | Server-side, tied to **webhook** success path that marks order **paid** ([`applyPaymentIntentSucceeded`](../../api/_lib/applyPaymentSuccess.ts)). |
| **Recipient** | `orders.customer_email` (already required NOT NULL in [4-1 migration](../../supabase/migrations/20260427090000_orders_and_order_items.sql)); `applyPaymentSuccess` may patch from PI `metadata.email` when present. |
| **Resend** | `RESEND_API_KEY` in [`env.ts`](../../api/_lib/env.ts). Add **`resend`** dependency if using SDK. |
| **Idempotency** | Stripe **event.id** / ledger already dedupe order writes; **email** must not duplicate on **replay** of the same event, and must be recoverable if the first webhook crashed after `paid`. Use `notification_logs`, `customer_confirmation_sent_at`, or equivalent durable state. |
| **Failure policy** | Swallow/soft-fail after logging; do **not** return `500` for email-only failure if payment and order are already correct (align with NFR-REL-003). Revisit admin “resend” in Epic 5+ . |

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): **Q2** email provider (Resend / SendGrid) — project **prefers Resend** given `RESEND_API_KEY` naming; if you must switch, abstract behind a single `sendOrderEmail` function.  
- **Cross-Cutting #5 / #12:** Correlation in logs: `event.id`, `order.id`; notification durability should come from **[4-7](4-7-log-notification-status.md)** before 4-6 real sends, or from an equivalent marker introduced here with a clear 4-7 migration path.  
- **Webhook Node runtime** — keep email send in **Node** API layer with existing [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts).

### Library / framework

- `stripe@^17` (unchanged).  
- `@supabase/supabase-js@^2` service role in API only.  
- **New:** `resend` (recommended) for typed API, or `fetch` + JSON.

### File structure (expected)

| File / area | Role |
|-------------|------|
| `api/_lib/applyPaymentSuccess.ts` and/or `api/stripe-webhook.ts` | Integration point (after paid) |
| `api/_lib/*email*` or `api/_lib/transactionalEmail.ts` | Resend + templates |
| `api/_lib/env.ts`, `.env.example` | New env vars |
| `supabase/migrations/*` | Optional: `customer_confirmation_sent_at` on `orders` |
| `api/**/*.test.ts` | Vitest |

### Testing requirements

- Mock network / Resend; no real API keys in tests.  
- Test **formatMoney**, address formatting, and **idempotency** of send invocations.  
- Follow existing Vitest layout (`api/_lib/*.test.ts`).

### Previous story intelligence

- **[4-2](4-2-payment-events-idempotent-webhook.md):** Durable `payment_events` + `claim_payment_event` — your send path runs **after** order update in the same processing flow; **replays** of `processed` events must not re-trigger email.  
- **[4-3](4-3-payment-success-order-paid.md):** `applyPaymentIntentSucceeded` marks paid; confirmation UI uses [`api/order-by-payment-intent.ts`](../../api/order-by-payment-intent.ts) — **email should mirror the same order fields** the customer may see on `/order-confirmation`.  
- **4-5 sibling story:** If owner notification lands in the same sprint, **merge** a shared email helper; otherwise 4-6 **owns** the first Resend integration and must leave a clear reuse point for 4-5.

### Git intelligence (recent work)

- Recent commits: Supabase + payment intent + `applyPaymentSuccess` (e.g. `c2f871d` area) — build on that handler rather than a parallel `store` path.

### Latest technical notes (Resend, 2026)

- Resend **REST**: `POST /emails` with `from`, `to`, `subject`, `html` (and optional `text`). **Domain/DNS** verification required for production `from` addresses; for dev, use Resend’s permitted test patterns per their current docs.  
- Keep `subject` and preheader scannable: include **`order_number`**.

### Project context reference

- No `project-context.md` in repo; use this file + [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.6–9.7, §12 `notification_logs` (prefer 4-7 before real sends), and [architecture.md](../planning-artifacts/architecture.md).

## Dev Agent Record

### Agent Model Used

_(Cursor / Composer implementation — 4-6)_

### Debug Log References

### Completion Notes List

- Implemented `customer_confirmation_sent_at` on `orders`, `api/_lib/customerOrderConfirmation.ts` (Resend via shared `sendViaResendApi` in `transactionalEmail.ts`), wired after paid + inventory + ledger in `applyPaymentSuccess` (before owner 4-5). Idempotent send + retry/backfill on already-`paid` path.
- `create-payment-intent` now requires a real customer email (rejects `pending@checkout.zephyr.local` and empty); structured `shipping_address` from checkout is persisted as before.
- `SUPPORT_EMAIL` / `CONTACT_EMAIL` in `env.ts`; production/sandbox + Resend `RESEND_FROM` notes in `.env.example`.
- **4-7 handoff:** `customer_confirmation_sent_at` is the durable per-order marker; future `notification_logs` can treat each send as a row keyed by `order_id` + `template: customer_order_confirmation` while keeping the column as a fast backfill/operator signal or denormalize from the log.

### File List

- `api/_lib/transactionalEmail.ts` (new)
- `api/_lib/customerOrderConfirmation.ts` (new)
- `api/_lib/customerOrderConfirmation.test.ts` (new)
- `api/_lib/applyPaymentSuccess.ts`
- `api/_lib/applyPaymentSuccess.test.ts`
- `api/_lib/env.ts`
- `api/_lib/ownerOrderNotification.ts`
- `api/create-payment-intent.ts`
- `api/create-payment-intent.handler.test.ts`
- `.env.example`
- `supabase/migrations/20260428140000_customer_confirmation_sent_at.sql` (new)

### Review Findings

- [x] [Review][Blocker] Current checkout does not persist a real structured shipping address; `create-payment-intent` stores the placeholder shipping JSON. 4-6 cannot meet required content until checkout passes/persists address data.
- [x] [Review][Blocker] First-paid-branch-only email sending can silently lose customer confirmations after a webhook crash. Add durable notification state (prefer 4-7 first) and allow backfill from already-paid retry paths.
- [x] [Review][Patch] Guard against `pending@checkout.zephyr.local` and other placeholder recipients before calling Resend.
- [x] [Review][Patch] Add Resend sender/domain readiness checks and documentation so the first production order does not discover an unverified `from` address.
- [x] [Review][Sequence] Do not start until 4-3's paid-order review findings are resolved.

#### Code review (2026-04-26) — B-MAD

- [x] [Review][Decision] Idempotency (AC3) — **Resolved (2026-04-26):** D1.1. Customer sends use Resend `Idempotency-Key: customer-confirmation/{orderId}` (24h provider dedupe, same pattern as owner). DB marker `customer_confirmation_sent_at` after send is unchanged; full outbox/claim row remains 4-7 for durable ops visibility.

- [x] [Review][Decision] AC2 “published policies” / `FRONTEND_URL` — **Resolved (2026-04-26):** D2.3. MVP treats the primary storefront link from `FRONTEND_URL` as sufficient for “published policies if URLs are available”; dedicated `/returns` et al. can follow when routes exist (optional envs later).

- [x] [Review][Patch] `.env.example` — duplicate `RESEND_FROM` block removed.

- [x] [Review][Patch] `api/_lib/applyPaymentSuccess.test.ts` — `maybeSendCustomerOrderConfirmation` now asserted on happy paths and not called when inventory blocks.

- [x] [Review][Patch] `api/_lib/customerOrderConfirmation.ts` — HTML `Qty` cell uses `escapeHtml(String(quantity))`.

- [x] [Review][Patch] `stripeEventId` — `stripe-webhook.ts` already passes `event.id`; “already paid” test now passes a non-empty `stripeEventId` for customer/owner notification assertions.

- [x] [Review][Defer] `fetch` in `sendViaResendApi` has no timeout/retry — serverless can hang; defer until reliability pass or 4-7. — *deferred, pre-existing / NFR*

- [x] [Review][Defer] `validation.ts` and `validation.js` both edited — drift risk until one is generated from the other. — *deferred, pre-existing*

- [x] [Review][Defer] `create-payment-intent` / API importing `src/domain/.../address` — cross-layer import; consider `packages/shared` or `api` copy when the repo splits. — *deferred, pre-existing*

- [x] [Review][Defer] After `markPaymentEventProcessed`, the same Stripe event will not re-open the ledger — a failed post-ledger email is not retried by Stripe; recovery is backfill/ops (aligns with NFR-REL-003; 4-7 can improve). — *deferred, architectural*

- [x] [Review][Defer] `isPendingCheckoutShippingAddress` only compares `line1` + `city` to the placeholder — a coincidental real address could be misclassified; broader shape checks or a dedicated sentinel field would be safer. — *deferred, pre-existing / story gate*

## Story completion status

- **done** — Code-review decisions and patches applied (2026-04-26). Apply migration in Supabase and verify `RESEND_FROM` in Resend before first production send.

_— Ultimate context engine analysis completed; comprehensive developer guide created._

## Change Log

- 2026-04-26: Code review — D1.1 + D2.3, Resend idempotency key for customer send, test/assertions, HTML qty escape, `.env.example` dedupe; story marked done; sprint status synced.
- 2026-04-26: Story 4-6 — customer order confirmation email (Resend), `customer_confirmation_sent_at`, shared transactional email module, required checkout email, tests.
