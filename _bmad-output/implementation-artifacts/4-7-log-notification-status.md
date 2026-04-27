# Story 4.7: Log notification status

Status: done

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

- [x] **Task 1 — Schema (AC: 1, 2)**  
  - [x] Add Supabase migration: enums + `notification_logs` + FK to `orders` + indexes sensible for Epic 5 list queries (e.g. `(order_id, created_at desc)`).  
  - [x] Align with PRD §12.7; add `ON DELETE SET NULL` or `RESTRICT` for `order_id` per product preference (document choice).
  - [x] Confirm final status enum labels before migration (`queued` / `sent` / `failed` vs any PRD-preferred alternatives such as `pending` or `retrying`).
  - [x] Decide uniqueness/history semantics: one logical row per `(order_id, template, channel)` updated across attempts, or multiple rows preserving every provider attempt.

- [x] **Task 2 — Server helper (AC: 3, 4)**  
  - [x] Add `api/_lib/notificationLog.ts` (or equivalent): `insertQueued`, `markSent`, `markFailed` (or single transactional update pattern).  
  - [x] Use existing `supabaseAdmin` client; **never** expose service role to the browser.

- [x] **Task 3 — Wire send paths (AC: 3)**  
  - [x] If **[4-5](sprint-status.yaml)** / **[4-6](sprint-status.yaml)** are **not** implemented yet: land **Task 1+2** and a documented integration contract for idempotent notification decisions. Prefer this story **before** 4-5/4-6, not as an optional follow-up.
  - [x] If 4-5/4-6 **exist**: wrap each Resend/SendGrid (or chosen provider) send with **queued → terminal** updates; failures must **not** fail the webhook HTTP response for order persistence (fire-and-forget or `catch` + `markFailed`).

- [x] **Task 4 — Tests (AC: 5)**  
  - [x] `api/_lib/notificationLog.test.ts` with mocked `admin.from(...).insert/update`.

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

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Landed `notification_logs` migration with `notification_channel` / `notification_status` enums (`email|sms|push`, `queued|sent|failed`), FK `order_id` → `orders` **ON DELETE SET NULL**, index `(order_id, created_at DESC)`, RLS enabled with no anon/auth policies (service role only).
- **History semantics:** append-only attempts — each send path may insert a new row; no unique constraint on `(order_id, template, channel)` so retries and repeated attempts remain auditable.
- Added `api/_lib/notificationLog.ts` (`insertNotificationLog`, `markNotificationLogSent`, `markNotificationLogFailed`) and wired **owner** + **customer** Resend paths to `queued` → `sent`/`failed`, including pre-provider validation failures as terminal `failed` rows.
- Extended `sendViaResendApi` to parse Resend `id` into `messageId` for `provider_message_id`.
- Pino correlation: `notification_log_id` + `order_id` / `order_number` on queue/success/error paths (no email bodies in logs).
- AC6: no new env vars — `.env.example` unchanged.
- Full Vitest suite green (`npm test -- --run`).

### File List

- `supabase/migrations/20260428160000_notification_logs.sql`
- `api/_lib/notificationLog.ts`
- `api/_lib/notificationLog.test.ts`
- `api/_lib/transactionalEmail.ts`
- `api/_lib/ownerOrderNotification.ts`
- `api/_lib/ownerOrderNotification.test.ts`
- `api/_lib/customerOrderConfirmation.ts`
- `api/_lib/customerOrderConfirmation.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-26 — Story 4-7: `notification_logs` schema, server helpers, Resend path wiring, Vitest coverage for logging helper and append-only behavior.

### Review Findings

- [x] [Review][Sequence] Land durable notification state before 4-5/4-6 real sends so webhook retries can recover missed emails after `paid`.
- [x] [Review][Decision] Resolve enum labels before migration; changing Postgres enum labels later is painful.
- [x] [Review][Decision] Decide one logical row per notification vs append-only attempt history before coding helpers and indexes.

### Review Findings (adversarial code review, 2026-04-26)

- [x] [Review][Decision] Queued `notification_logs` insert may fail, but the Resend call still runs — In `api/_lib/ownerOrderNotification.ts` and `api/_lib/customerOrderConfirmation.ts`, `insertNotificationLog` with `status: "queued"` can return `{ ok: false }` (e.g. DB/RLS failure), yet `sendViaResendApi` is still invoked. That can deliver mail without a matching `queued` row, so AC3’s “insert `queued` before the provider” is not always satisfied, even though the order remains paid (NFR-REL-003). You need a product choice before patching.
  - **Resolution (2026-04-26):** Strict AC3: if the `queued` insert fails, do not call the provider. Owner: `releaseOwnerNotifyInFlight` so the next `payment_intent.succeeded` / webhook delivery can re-claim and retry. Customer: return with `customer_confirmation_sent_at` still `null` so a later run can try again. Added Vitest cases for both paths.

- [x] [Review][Patch] `markNotificationLogSent` / `markNotificationLogFailed` can report success when no row was updated — PostgREST returns `error: null` when an `UPDATE` matches zero rows. A wrong `id` or a row that is not `status = queued` can still return `true` and hide state bugs. Harden with an explicit row count or a returning `select` and treat zero rows as failure. `api/_lib/notificationLog.ts` (roughly the `markNotificationLogSent` and `markNotificationLogFailed` functions).
  - **Resolution (2026-04-26):** `mark*` helpers now use `.select("id")` after the filtered `update` and return `false` with a structured log if no row was updated. If Resend already succeeded but `markNotificationLogSent` returns `false`, owner/customer still finalize the order idempotency markers and log an error to avoid double-email retries (different from the pre-provider path).

- [x] [Review][Defer] `notificationLog.test.ts` update mock is not a full chain — The Vitest double for `update` may not model `.eq("id").eq("status", "queued")` the way the real client does, so a breaking API shape could slip through. `api/_lib/notificationLog.test.ts` (mock `fromHandler`). Deferred as test-harness quality, not a production defect by itself.

## Story completion status

- **done** — Code review 2026-04-26: decision + patch items resolved in code; defer item remains in `deferred-work.md`.

_Saved questions (optional):_

- Should **`notification_logs`** include an optional **`metadata jsonb`** for provider-specific fields, or stay strictly PRD-minimal until needed?
- For **duplicate** provider retries, is a **unique constraint** on `(order_id, template, channel)` desired, or allow **multiple rows** per order to preserve history?
