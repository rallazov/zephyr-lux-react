# Story 4.5: Owner order notification

Status: done

## Review Gate (must resolve before dev)

- **Resolved in implementation (2026-04-26):** [4-3](4-3-payment-success-order-paid.md) is `done` in sprint status; checkout now sends optional `customer_name` + `shipping_address` (structured) when the debounced contact block is complete; `orders.owner_order_paid_notified_at` provides durable idempotency and backfill on the already-`paid` webhook path; admin link is labeled as future Epic 5 in email copy; `.env.example` documents Resend + owner inbox launch expectations.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the **store owner**,
I want **an email when a new order is paid**,
so that **I can fulfill it without relying on the dashboard alone** (FR-NOT-001 in [epics.md](../planning-artifacts/epics.md), PRD E4-S5 in [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §14).

## Acceptance Criteria

1. **Given** [4-3](4-3-payment-success-order-paid.md) has marked an order **`paid`** via the Stripe webhook (`payment_intent.succeeded` → `applyPaymentIntentSucceeded`) **and** the order row contains real checkout contact/shipping snapshots, **when** the owner notification is due for that order, **then** the system **sends one transactional email** to the **configured owner address** with at least: **order number**, **customer name and email**, **order total** (and currency), **line items** (title/SKU, qty, line or unit money), **shipping address** (from `orders.shipping_address_json`), and a **stable admin deep-link target** for the order. If `/admin/orders/:id` is not implemented in this story, document it as a future Epic 5 URL rather than calling it working.

2. **Given** [FR-PAY-002](../planning-artifacts/zephyr-lux-commerce-prd.md) and [FR-NOT-001](../planning-artifacts/epics.md), **when** the customer sees payment success in the browser, **then** the owner email is still **driven from the server path that commits `paid`** — never from the client alone. Duplicate Stripe deliveries that **do not** re-apply the paid transition **must not** send duplicate owner emails.

3. **Given** [NFR-REL-003](../planning-artifacts/zephyr-lux-commerce-prd.md) (“notification failures must not lose the order”) and [architecture.md](../planning-artifacts/architecture.md) (notification dispatch non-blocking), **when** email delivery **fails** (provider error, missing API key, invalid from-address), **then** the **order remains `paid`**, the **payment event still completes** as today (no spurious 500 that would imply the payment wasn’t processed), and the failure is **observable** via durable notification state and structured logs with correlation: Stripe **`event.id`**, **`payment_intent` id**, **`order.id`**, **`order_number`**. Prefer [4-7](4-7-log-notification-status.md) `notification_logs`; if 4-7 has not landed, this story must add an equivalent marker/log contract.

4. **Given** [NFR-SEC-002](../planning-artifacts/zephyr-lux-commerce-prd.md) and [architecture.md](../planning-artifacts/architecture.md) (trust zones), **when** sending email, **then** use **server-only** secrets (`RESEND_API_KEY` or chosen provider), **never** expose keys to Vite, and **avoid logging** full shipping blobs or unnecessary PII beyond what’s needed for support (prefer ids + order_number in logs).

5. **Given** [NFR-MAINT-003](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** the feature ships, **then** add **Vitest** coverage for: **(a)** “notify” helper builds expected subject/body fields from a **fixture** order + items row shape; **(b)** idempotent **call site** — duplicate delivery does not send again after an owner notification is already marked sent; **(c)** already-`paid` retry/backfill sends or queues the owner notification if durable state shows it is still missing. **No live** Resend calls in CI — HTTP or client mock.

6. **Given** [NFR-MAINT-004](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** env vars are added/changed, **then** update [`.env.example`](../../.env.example) and [`api/_lib/env.ts`](../../api/_lib/env.ts) with documented **server-only** variables (e.g. owner inbox, verified **from** address / domain).

## Tasks / Subtasks

- [x] **Task 1 — Provider + env (AC: 4, 6)**  
  - [x] Confirm **Resend** as MVP provider (matches `RESEND_API_KEY` already documented; [architecture.md](../planning-artifacts/architecture.md) Q2). Add **`resend`** npm dependency **or** a thin `fetch`-based client if you want zero extra deps — justify in Dev Agent Record.  
  - [x] Add env vars (names illustrative — adjust to match code): `OWNER_NOTIFICATION_EMAIL`, `EMAIL_FROM` / `RESEND_FROM` (verified sender), wire into `ENV`.
  - [x] Add a launch-readiness check/runbook: `RESEND_API_KEY`, owner recipient, and verified `from` domain/address must be present before production sends are enabled; document local/sandbox sender behavior in [`.env.example`](../../.env.example).

- [x] **Task 2 — Compose + send (AC: 1, 3, 4)**  
  - [x] Implement `api/_lib/ownerOrderNotification.ts` (name flexible) that loads **`orders` + `order_items`** (or accepts rows passed from the payment-success path) and sends HTML + text body.  
  - [x] Verify checkout has persisted `orders.customer_name` and a real structured `orders.shipping_address_json`; if not, add a prerequisite/follow-up story and keep 4-5 gated.
  - [x] Admin URL: ``${ENV.FRONTEND_URL.replace(/\/$/, '')}/admin/orders/${order.id}`` can be used as the stable future target, but do not describe it as working until an actual route exists.

- [x] **Task 3 — Hook after first paid transition (AC: 1, 2)**  
  - [x] Invoke notify from a durable per-order/template decision: send after the order is durably paid, but allow retry/backfill if the first webhook crashed after `paid` and before notification. Do **not** rely only on the first `updatedRows.length > 0` branch unless a DB marker/log makes the missed-send case recoverable.  
  - [x] Ensure **ordering**: persist **`paid`** first; then **best-effort** email; **`markPaymentEventProcessed`** should remain correct relative to today’s semantics — *email failure must not roll back paid state or cause misleading webhook 500.*

- [x] **Task 4 — Tests (AC: 5)**  
  - [x] Unit tests for formatting + spy on send from `applyPaymentIntentSucceeded` / webhook fixture.

## Dev Notes

### Dev Agent Guardrails

- **Prerequisite:** Paid-order persistence and idempotent webhook path from **4-1 / 4-2 / 4-3** must be in place. Current spine: [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts) → `claimPaymentEvent` → [`applyPaymentIntentSucceeded`](../../api/_lib/applyPaymentSuccess.ts).  
- **Out of scope:** Customer confirmation email (**[4-6](sprint-status.yaml)**), admin “resend” UI (**[4-7](sprint-status.yaml)** / Epic 5+), inventory (**[4-4](sprint-status.yaml)**). Durable notification state should exist before or inside this story; prefer [4-7](4-7-log-notification-status.md) first.  
- **Idempotency:** Owner email is **not** keyed to `payment_events` replay; it is keyed to one logical `owner_order_paid` notification per order, with durable state so already-paid retries can backfill missing sends without duplicating sent ones.  
- **Resend:** Verify **domain / from-address** in Resend dashboard; without it, local dev may fail — document.

### Technical requirements

- **PRD / epics:** E4-S5; FR-NOT-001; NFR-REL-003; FR-AN-003 (correlation in logs).  
- **Data:** [`orders` / `order_items`](../../supabase/migrations/20260427090000_orders_and_order_items.sql) — use `order_number`, `customer_email`, `customer_name`, `total_cents`, `currency`, `shipping_address_json`, line snapshots (`sku`, titles, `quantity`, `unit_price_cents`, `total_cents`, etc.).

### Architecture compliance

- **Non-blocking notifications:** Align with [architecture.md](../planning-artifacts/architecture.md) cross-cutting concern: order + payment ledger correctness first; email is secondary with logging on failure.  
- **Observability:** Use [`api/_lib/logger.ts`](../../api/_lib/logger.ts) / pino patterns already used in webhook.

### File / module expectations

| Area | Likely touch |
|------|----------------|
| Payment success | [`api/_lib/applyPaymentSuccess.ts`](../../api/_lib/applyPaymentSuccess.ts) |
| New module | `api/_lib/ownerOrderNotification.ts` (or split `email/` under `_lib`) |
| Config | [`api/_lib/env.ts`](../../api/_lib/env.ts), [`.env.example`](../../.env.example) |
| Tests | `api/_lib/ownerOrderNotification.test.ts`, extend [`api/_lib/applyPaymentSuccess.test.ts`](../../api/_lib/applyPaymentSuccess.test.ts) |
| Dependencies | [`package.json`](../../package.json) if adding Resend SDK |

### Testing requirements

- Mock outbound HTTP or Resend client; assert **single** send on first paid transition; **zero** sends when simulating already-paid fast path.

### Previous story intelligence

- **[4-3](4-3-payment-success-order-paid.md):** Pending order + snapshot items exist at PI creation; webhook flips `pending_payment` → `paid` with conditional update; **`markPaymentEventProcessed`** runs after success. Place owner email **after** successful paid transition, **without** breaking ledger semantics.  
- **Completion notes in 4-3:** Order lookup by PI; do not duplicate inventory or customer email work.

### Git intelligence (recent commits)

- Recent Epic 4 work: Supabase-backed payment intent + webhook + checkout (`c2f871d` area). Extend that path rather than adding a parallel trigger.

### Latest technical notes (2026)

- **Resend:** Typical pattern is `new Resend(apiKey).emails.send({ from, to, subject, html })` — use the project’s Node runtime on Vercel; keep bundle small.

### Project context reference

- No `project-context.md` in repo; use [epics.md](../planning-artifacts/epics.md), [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.7, §14 Epic 4, [architecture.md](../planning-artifacts/architecture.md), [ux-design-specification.md](../planning-artifacts/ux-design-specification.md) (owner calm / notification failure surfacing — full UI in later epics).

## Dev Agent Record

### Agent Model Used

Composer (Cursor AI agent)

### Debug Log References

_(none)_

### Completion Notes List

- **Resend transport:** Implemented as `fetch` to `https://api.resend.com/emails` in `api/_lib/transactionalEmail.ts` (no `resend` npm package).
- **Owner notify:** `maybeSendOwnerOrderPaidNotification` runs after `markPaymentEventProcessed` (inside `finalizeLedgerThenTransactionalEmails`), uses atomic claim `NULL` → in-flight sentinel then success timestamp, Resend `Idempotency-Key: owner-order-paid/{id}`, 20s HTTP timeout, stale in-flight clear (10m); logs with `stripeEventId`, `stripePaymentIntentId`, `order.id`, `order_number`, `idempotencyKey` on persist failure; skips with warn if env incomplete; never throws.
- **Checkout:** Debounced contact/shipping fingerprint drives PaymentIntent bootstrap; POST includes `customer_name` + `shipping_address` when all structured fields are non-empty; otherwise order keeps placeholder shipping until the shopper completes the block.
- **Tests:** `api/_lib/ownerOrderNotification.test.ts`, extended `applyPaymentSuccess` + `stripe-webhook.handler` tests; `npm test` and `npm run build` pass.

### File List

- `supabase/migrations/20260428120000_owner_order_paid_notification.sql`
- `api/_lib/transactionalEmail.ts`
- `api/_lib/ownerOrderNotification.ts`
- `api/_lib/ownerOrderNotification.test.ts`
- `api/_lib/applyPaymentSuccess.ts`
- `api/_lib/applyPaymentSuccess.test.ts`
- `api/_lib/env.ts`
- `api/_lib/createPaymentIntentBody.ts`
- `api/_lib/createPaymentIntentBody.test.ts`
- `api/create-payment-intent.ts`
- `api/stripe-webhook.ts`
- `api/stripe-webhook.handler.test.ts`
- `src/components/Cart/CheckoutPage.tsx`
- `src/lib/validation.ts`
- `src/lib/validation.js`
- `.env.example`

### Review Findings

- [x] [Review][Blocker] Current checkout does not send customer name or real shipping address to `create-payment-intent`; `orders.customer_name` is unset and `shipping_address_json` is a placeholder. 4-5 cannot satisfy required email content until that is fixed.
- [x] [Review][Blocker] Email idempotency cannot be first-paid-branch-only if inventory/payment retry paths can re-enter after `paid`. Add durable notification state (prefer 4-7 first) so owner email can be sent once and backfilled when missing.
- [x] [Review][Patch] `/admin/orders/:id` is not routed today. Soften the AC to stable future URL or implement a real order route before claiming the link works.
- [x] [Review][Patch] Add Resend sender/domain readiness checks and documentation so the first production order does not discover an unverified `from` address.
- [x] [Review][Sequence] Do not start until 4-3's paid-order review findings are resolved.

- [x] [Review][Decision] Concurrent or overlapping webhook deliveries can both read `owner_order_paid_notified_at` as null and invoke Resend before either update commits, risking duplicate owner emails. **Resolved (2026-04-26 follow-up):** atomic claim `NULL` → `owner_order_paid_notified_at = IN_FLIGHT` sentinel in one `UPDATE` (serializes on row); `Idempotency-Key: owner-order-paid/{orderId}` on Resend; stale in-flight reset after 10m; `release` on send/validation fail.
- [x] [Review][Patch] Add an HTTP timeout (`AbortController` or equivalent) for the Resend `fetch` in `api/_lib/transactionalEmail.ts` so a hung provider does not block the webhook handler indefinitely. **Fixed:** 20s default; optional `timeoutMs` on `sendViaResendApi`.
- [x] [Review][Patch] If Resend returns success but the follow-up `orders` update to set `owner_order_paid_notified_at` fails, a later retry can send a second email. **Fixed:** log includes `idempotencyKey` and guidance; Vitest for finalize failure; in-flight + Resend idempotency limits double-send on retry. Full `notification_logs` still deferred to 4-7.
- [x] [Review][Defer] Deeper `notification_logs` + `provider_message_id` (Epic 4-7) — deferred, pre-existing; `owner_order_paid_notified_at` and logs are the current equivalent.

### Change Log

- 2026-04-26 — Story 4-5: owner paid-order email via Resend (`RESEND_FROM`, `OWNER_NOTIFICATION_EMAIL`), durable `owner_order_paid_notified_at`, checkout structured address + name, Vitest coverage.
- 2026-04-26 — Code review follow-up: in-flight claim + Resend `Idempotency-Key`, 20s Resend `fetch` timeout, regression test and log detail when persist after send fails.

## Story completion status

**done** — Code review findings for concurrency, transport timeout, and post-send persist failure were addressed; `npm test` and full Vitest run pass.

### Saved questions (optional follow-ups)

- Should **bcc** or **multiple** owner addresses be supported at env level (`OWNER_NOTIFICATION_EMAIL` comma-separated)?
- If **`FRONTEND_URL`** points to production but webhook runs in preview, should admin link use a dedicated **`ADMIN_BASE_URL`** env?
