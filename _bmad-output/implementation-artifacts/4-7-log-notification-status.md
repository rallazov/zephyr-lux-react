# Story 4.7: Log notification status

Status: ready-for-dev

## Review Gate (must resolve before dev)

- **Sequence ahead of [4-5](4-5-owner-order-notification.md) and [4-6](4-6-customer-confirmation-email.md):** durable notification state should land before real owner/customer sends so webhook retries can backfill missed notifications instead of silently losing them.
- **Enum decision required before migration:** confirm the final `notification_logs.status` labels from PRD/epics before creating Postgres enums. Renaming enum labels after migration is expensive.
- **Dedupe/history decision required:** decide whether `notification_logs` represents one logical send per `(order_id, template, channel)` or multiple attempts/history rows; this affects uniqueness, retry queries, and 4-5/4-6 idempotency.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **store operator** and **platform maintainer**,
I want **every transactional notification attempt** (owner alert, customer confirmation, and future channels) **recorded in Supabase** with **recipient, template, channel, and terminal status**,
so that **FR-NOT-001 / FR-NOT-002** (“failure is logged and retryable”), **NFR-REL-003** (a failed email does not lose the paid order), **FR-AN-003** (correlation from payment → order → notifications), and **PRD §12.7 / E4-S7** are satisfied — and **Epic 5** can surface “notification failed” without guessing from logs alone ([architecture.md](../planning-artifacts/architecture.md) notification resilience).

## Acceptance Criteria

1. **Given** [PRD §12.7](../planning-artifacts/zephyr-lux-commerce-prd.md) and [epics data model](../planning-artifacts/epics.md), **when** migrations are applied, **then** a **`notification_logs`** table exists with at least: `id` (uuid PK), `order_id` (nullable FK → `orders.id`), `recipient` (text not null), `channel` (`email` | `sms` | `push`), `template` (text not null — logical name e.g. `owner_order_paid`, `customer_order_confirmation`), `status` (`queued` | `sent` | `failed`), `provider_message_id` nullable, `error_message` nullable, `created_at`, `sent_at` nullable. Match enum labels to PRD; use `timestamptz` if the project standard is UTC (consistent with other migrations).

2. **Given** [NFR-SEC-005](../planning-artifacts/zephyr-lux-commerce-prd.md) and existing **`orders` RLS** pattern ([`supabase/migrations/20260427090000_orders_and_order_items.sql`](../../supabase/migrations/20260427090000_orders_and_order_items.sql)), **when** the table is created, **then** **RLS is enabled** with **no** broad anon/authenticated `ALL` policies — **server-side** inserts/updates use **`SUPABASE_SERVICE_ROLE_KEY`** only (same boundary as webhook / [`api/_lib/supabaseAdmin.ts`](../../api/_lib/supabaseAdmin.ts)). Document whether **authenticated admin read** is deferred to Epic 5 or add a narrow policy if admin client already exists.

3. **Given** **[4-5](sprint-status.yaml)** (owner email) and **[4-6](sprint-status.yaml)** (customer confirmation) **or** a single combined “post-payment notify” module, **when** the system attempts to send a transactional message tied to an order, **then** the code path **inserts** a row in **`queued`** (or **`failed`** immediately if validation fails before provider call — with **`error_message`**) and **updates** to **`sent`** with **`sent_at`** and **`provider_message_id`** on provider success, or **`failed`** with **`error_message`** on provider/transport failure. **Order creation / `payment_status = paid` must not roll back** if logging or email fails ([NFR-REL-003](../planning-artifacts/zephyr-lux-commerce-prd.md)).

4. **Given** [FR-AN-003](../planning-artifacts/zephyr-lux-commerce-prd.md) and [architecture observability](../planning-artifacts/architecture.md) (Stripe `event.id` → `order` → logs → `notification_logs`), **when** a notification is logged for a **webhook-driven** paid order, **then** structured **Pino** logs ([`api/_lib/logger.ts`](../../api/_lib/logger.ts)) include **correlation**: at minimum **`order_id`** / **`order_number`** and **`notification_log` id**; **do not** log full email bodies or unnecessary PII.

5. **Given** [NFR-MAINT-003](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** the feature lands, **then** **Vitest** covers the **logging helper** (mock Supabase): `queued` → `sent`, `queued` → `failed`, and the chosen uniqueness/history behavior for repeated logical sends — **no** live email provider in CI.

6. **Given** [.env matrix](../planning-artifacts/zephyr-lux-commerce-prd.md) (NFR-MAINT-004), **when** documentation is updated, **then** [`.env.example`](../../.env.example) mentions any **new** vars only if this story adds them (prefer **none** if only DB schema + code).

## Tasks / Subtasks

- [ ] **Task 1 — Schema (AC: 1, 2)**  
  - [ ] Add Supabase migration: enums + `notification_logs` + FK to `orders` + indexes sensible for Epic 5 list queries (e.g. `(order_id, created_at desc)`).  
  - [ ] Align with PRD §12.7; add `ON DELETE SET NULL` or `RESTRICT` for `order_id` per product preference (document choice).
  - [ ] Confirm final status enum labels before migration (`queued` / `sent` / `failed` vs any PRD-preferred alternatives such as `pending` or `retrying`).
  - [ ] Decide uniqueness/history semantics: one logical row per `(order_id, template, channel)` updated across attempts, or multiple rows preserving every provider attempt.

- [ ] **Task 2 — Server helper (AC: 3, 4)**  
  - [ ] Add `api/_lib/notificationLog.ts` (or equivalent): `insertQueued`, `markSent`, `markFailed` (or single transactional update pattern).  
  - [ ] Use existing `supabaseAdmin` client; **never** expose service role to the browser.

- [ ] **Task 3 — Wire send paths (AC: 3)**  
  - [ ] If **[4-5](sprint-status.yaml)** / **[4-6](sprint-status.yaml)** are **not** implemented yet: land **Task 1+2** and a documented integration contract for idempotent notification decisions. Prefer this story **before** 4-5/4-6, not as an optional follow-up.
  - [ ] If 4-5/4-6 **exist**: wrap each Resend/SendGrid (or chosen provider) send with **queued → terminal** updates; failures must **not** fail the webhook HTTP response for order persistence (fire-and-forget or `catch` + `markFailed`).

- [ ] **Task 4 — Tests (AC: 5)**  
  - [ ] `api/_lib/notificationLog.test.ts` with mocked `admin.from(...).insert/update`.

## Dev Notes

### Dev Agent Guardrails

- **Prerequisites:** **[4-1](4-1-order-and-order-item-tables.md)** (`orders` exists). **[4-3](4-3-payment-success-order-paid.md)** establishes paid orders and webhook/service-role writes. **Ideal order after review:** implement **4-7 before [4-5](sprint-status.yaml) / [4-6](sprint-status.yaml)** so real sends have durable queued/sent/failed state from the start; if this cannot be sequenced first, 4-5/4-6 must introduce equivalent durable markers and document how 4-7 will reuse/migrate them.  
- **Out of scope:** Full **admin UI** for retry/resend ([architecture.md](../planning-artifacts/architecture.md) “operator recovery UI”) is **Epic 5+**; this story only **persists** status for those screens.  
- **Do not** block **`applyPaymentSuccess`** / order paid transition on email ([`api/_lib/applyPaymentSuccess.ts`](../../api/_lib/applyPaymentSuccess.ts)); notifications run **after** order is durably paid or in a **detached** async path.

### Technical requirements

- **PRD:** E4-S7; §12.7 `notification_logs`; FR-NOT-001/002 AC (“logged and retryable”); NFR-REL-003; FR-AN-003.  
- **Stack:** Supabase JS client already in repo; follow migration naming convention under [`supabase/migrations/`](../../supabase/migrations/).  
- **Templates:** `template` is a **stable string key**, not the full HTML body.

### Architecture compliance

- **Correlation:** Extend the same structured logging mindset as payment webhook ([`api/stripe-webhook.ts`](../../api/stripe-webhook.ts), [`api/_lib/paymentEventLedger.ts`](../../api/_lib/paymentEventLedger.ts)).  
- **Webhook runtime:** Node serverless for any code that shares the webhook bundle.

### File / module expectations

| Area | Likely touch |
|------|----------------|
| DB | New `supabase/migrations/*_notification_logs.sql` |
| API lib | `api/_lib/notificationLog.ts`, tests alongside |
| Email (if present) | Modules introduced in 4-5 / 4-6 |
| Env | `.env.example` only if new secrets |

### Testing requirements

- Mock Supabase client; assert correct `status` transitions and timestamps.  
- No Stripe live calls; no real email API calls.

### Previous story intelligence

- **[4-3](4-3-payment-success-order-paid.md):** Pending order at PI creation; webhook marks `paid` idempotently; use **service role** and **RLS** patterns from **`orders`**. **Notification dispatch** was explicitly **out of scope** for 4-3 — 4-7 adds the **durable notification ledger** without changing paid-order semantics.  
- **[4-2](4-2-payment-events-idempotent-webhook.md):** Do not conflate **`payment_events`** with **`notification_logs`**; different lifecycles (Stripe idempotency vs. email provider attempts).

### Git intelligence (recent commits)

- Recent work centered on **Supabase-backed payment + orders** (`applyPaymentSuccess`, `paymentEventLedger`, migrations). **No `notification_logs` table** exists in `supabase/` yet — this story introduces it.

### Latest technical notes (2026)

- Email provider (Resend vs SendGrid) may still be an open PRD question — **template + channel** fields should remain **provider-agnostic**.

### Project context reference

- Primary: [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.7, §12.7, §14 Epic 4; [architecture.md](../planning-artifacts/architecture.md) cross-cutting #5 and #12; [ux-design-specification.md](../planning-artifacts/ux-design-specification.md) operator notification failure visibility (downstream).

## Dev Agent Record

### Agent Model Used

_(filled by dev agent)_

### Debug Log References

### Completion Notes List

### File List

### Review Findings

- [ ] [Review][Sequence] Land durable notification state before 4-5/4-6 real sends so webhook retries can recover missed emails after `paid`.
- [ ] [Review][Decision] Resolve enum labels before migration; changing Postgres enum labels later is painful.
- [ ] [Review][Decision] Decide one logical row per notification vs append-only attempt history before coding helpers and indexes.

## Story completion status

- **ready-for-dev with review gate** — Story context exists, but dev should resolve the decisions in Review Findings before implementation.

_Saved questions (optional):_

- Should **`notification_logs`** include an optional **`metadata jsonb`** for provider-specific fields, or stay strictly PRD-minimal until needed?
- For **duplicate** provider retries, is a **unique constraint** on `(order_id, template, channel)` desired, or allow **multiple rows** per order to preserve history?
