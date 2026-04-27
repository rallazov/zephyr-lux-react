# Story 4.5: Owner order notification

Status: ready-for-dev

## Review Gate (must resolve before dev)

- **Blocked by [4-3](4-3-payment-success-order-paid.md):** 4-3 is still `in-progress`; do not implement owner notification until the paid-order transition contract is settled.
- **Blocked by checkout contact/shipping persistence:** current checkout only sends `items`, `email`, and `currency` to `api/create-payment-intent`; `orders.customer_name` is never set and `orders.shipping_address_json` is currently a placeholder. 4-5 cannot honestly meet AC1 until checkout passes/persists customer name and a real structured shipping address.
- **Notification idempotency must be durable:** if a first webhook marks an order `paid` and later retries through the already-paid path, owner email must not be silently skipped forever. Prefer landing [4-7](4-7-log-notification-status.md) first and keying sends by order/template/channel.
- **Admin route caveat:** `/admin/orders/:id` does not exist yet (Epic 5 backlog). Either document a stable future URL or add a real useful route; do not claim a working deep link to a missing page.
- **Resend launch gate:** before enabling real sends, confirm server env vars are present and the configured `from` domain/address is verified in Resend; document sandbox vs production sender expectations.

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

- [ ] **Task 1 — Provider + env (AC: 4, 6)**  
  - [ ] Confirm **Resend** as MVP provider (matches `RESEND_API_KEY` already documented; [architecture.md](../planning-artifacts/architecture.md) Q2). Add **`resend`** npm dependency **or** a thin `fetch`-based client if you want zero extra deps — justify in Dev Agent Record.  
  - [ ] Add env vars (names illustrative — adjust to match code): `OWNER_NOTIFICATION_EMAIL`, `EMAIL_FROM` / `RESEND_FROM` (verified sender), wire into `ENV`.
  - [ ] Add a launch-readiness check/runbook: `RESEND_API_KEY`, owner recipient, and verified `from` domain/address must be present before production sends are enabled; document local/sandbox sender behavior in [`.env.example`](../../.env.example).

- [ ] **Task 2 — Compose + send (AC: 1, 3, 4)**  
  - [ ] Implement `api/_lib/ownerOrderNotification.ts` (name flexible) that loads **`orders` + `order_items`** (or accepts rows passed from the payment-success path) and sends HTML + text body.  
  - [ ] Verify checkout has persisted `orders.customer_name` and a real structured `orders.shipping_address_json`; if not, add a prerequisite/follow-up story and keep 4-5 gated.
  - [ ] Admin URL: ``${ENV.FRONTEND_URL.replace(/\/$/, '')}/admin/orders/${order.id}`` can be used as the stable future target, but do not describe it as working until an actual route exists.

- [ ] **Task 3 — Hook after first paid transition (AC: 1, 2)**  
  - [ ] Invoke notify from a durable per-order/template decision: send after the order is durably paid, but allow retry/backfill if the first webhook crashed after `paid` and before notification. Do **not** rely only on the first `updatedRows.length > 0` branch unless a DB marker/log makes the missed-send case recoverable.  
  - [ ] Ensure **ordering**: persist **`paid`** first; then **best-effort** email; **`markPaymentEventProcessed`** should remain correct relative to today’s semantics — *email failure must not roll back paid state or cause misleading webhook 500.*

- [ ] **Task 4 — Tests (AC: 5)**  
  - [ ] Unit tests for formatting + spy on send from `applyPaymentIntentSucceeded` / webhook fixture.

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Review Findings

- [ ] [Review][Blocker] Current checkout does not send customer name or real shipping address to `create-payment-intent`; `orders.customer_name` is unset and `shipping_address_json` is a placeholder. 4-5 cannot satisfy required email content until that is fixed.
- [ ] [Review][Blocker] Email idempotency cannot be first-paid-branch-only if inventory/payment retry paths can re-enter after `paid`. Add durable notification state (prefer 4-7 first) so owner email can be sent once and backfilled when missing.
- [ ] [Review][Patch] `/admin/orders/:id` is not routed today. Soften the AC to stable future URL or implement a real order route before claiming the link works.
- [ ] [Review][Patch] Add Resend sender/domain readiness checks and documentation so the first production order does not discover an unverified `from` address.
- [ ] [Review][Sequence] Do not start until 4-3's paid-order review findings are resolved.

## Story completion status

**ready-for-dev with review gate** — Story context exists, but dev should not start until the blockers in Review Findings are resolved.

### Saved questions (optional follow-ups)

- Should **bcc** or **multiple** owner addresses be supported at env level (`OWNER_NOTIFICATION_EMAIL` comma-separated)?
- If **`FRONTEND_URL`** points to production but webhook runs in preview, should admin link use a dedicated **`ADMIN_BASE_URL`** env?
