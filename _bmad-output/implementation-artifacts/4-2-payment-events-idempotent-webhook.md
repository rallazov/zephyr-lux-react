# Story 4.2: payment-events-idempotent-webhook

Status: done

## Story

As a **platform**,
I want **every Stripe webhook delivery recorded in a durable `payment_events` ledger with idempotent processing keyed by Stripe `event.id`**,
so that **duplicate deliveries never double-apply side effects, we can audit/replay, and we meet FR-PAY-002 / FR-PAY-003 / NFR-REL-002**.

## Acceptance Criteria

1. **Given** a valid Stripe webhook POST, **when** the handler verifies `stripe-signature` using the **raw** body and `STRIPE_WEBHOOK_SECRET`, **then** verification matches existing behavior (400 on failure, no persistence of invalid requests). *[FR-PAY-002, NFR-SEC-004 — preserves `api/stripe-webhook.ts` pattern with `raw-body` + `bodyParser: false`]*

2. **Given** verified event `event`, **when** the handler first persists the event to Supabase `payment_events`, **then** the row includes at minimum: `provider = 'stripe'`, `provider_event_id = event.id` (**unique**), `event_type = event.type`, **`status = 'received'`** in Postgres (PRD §12 `payment_events.status`; in app/domain types this is **`ingest_status`** — **do not** add a separate DB column named `ingest_status`), `payload_hash` (stable hash of raw payload), `created_at`; optional `processed_at`, `error_message` null. *[PRD §12 / epics.md data model, `paymentEventSchema` in `src/domain/commerce/order.ts`]*

3. **Given** the same Stripe event ID is delivered again, **when** the handler resolves the existing ledger row, **then** behavior depends on **`status`**: if **`processed` or `ignored`**, respond **2xx**, **do not** re-run payment side effects, and indicate duplicate/no-op in logs/body (consistent with today’s `duplicate: true` pattern where applicable); if **`failed`**, **retry processing** from a safe point (re-run handler logic for that `event.id`, or document a **manual replay** path in Dev Agent Record — pick one and test it) so transient post-insert failures are **not** permanently stuck; if **`received`** and another delivery arrives before completion, **do not** double-process (use a single-row **transactional** update from `received` → `processed`/`failed`/`ignored`, **`SELECT … FOR UPDATE`** on the ledger row, or equivalent **in-progress** semantics). *[NFR-REL-002, FR-PAY-003]*

4. **Given** a **new** event row was created with **`status = 'received'`**, **when** the handler runs the existing `payment_intent.succeeded` / `payment_intent.payment_failed` / default branches, **then** on **successful** completion the corresponding `payment_events` row transitions to **`processed`** with `processed_at` set; on handler failure after insert, the row transitions to **`failed`** with a **sanitized** `error_message` (no card numbers, full payment method details, or secrets) — **coordinated with AC3** so Stripe retries of the same `event.id` can still succeed. *[FR-AN-003 correlation; NFR-PRI]*

5. **Given** event types that are intentionally not acted upon yet, **when** they are stored as `received`, **then** they may be marked `ignored` after handling (or left `received` with explicit documentation in Dev Agent Record — pick one approach and apply consistently in code + tests). *[Architecture: persist all events before side effects]*

6. **Given** local dev without Supabase, **when** a developer runs the webhook, **then** behavior is defined: either **fail fast** with a clear config error or **feature-flag** fallback to the existing `Store.markEventProcessed` path — **no silent** dual-write to Blob for new installs; document the chosen behavior in Dev Notes and `.env.example` if new vars are added.

7. **Given** `supabase db reset`, **when** migrations apply, **then** `payment_events` exists with **`UNIQUE (provider_event_id)`** (or equivalent composite unique key if you namespace by `provider`), RLS enabled, and **no** anon/authenticated policies that allow read/write (serverless uses **service role** only for this table). *[NFR-SEC-002, NFR-SEC-005]*

8. **Given** structured logging, **when** payment/webhook errors occur, **then** logs include **Stripe `event.id`** as correlation alongside existing `pino` patterns; do not log raw full payloads or PII beyond what is already required for debugging. *[FR-AN-003]*

## Tasks / Subtasks

- [x] **Schema** (AC: 2, 3, 7)
  - [x] Add `supabase/migrations/*_payment_events.sql`: table columns aligned with PRD §12 and `paymentEventSchema`. **Postgres column name: `status`** (enum values `received`, `processed`, `failed`, `ignored` — see `paymentEventIngestStatusSchema` in `src/domain/commerce/enums.ts`); map to/from domain field **`ingest_status`** in application code only.
  - [x] `UNIQUE` constraint on `provider_event_id` (scope with `provider` if modeled as composite key).
  - [x] RLS: default deny for client roles; document service-role-only access from `api/*`.
- [x] **Server env** (AC: 6, 7)
  - [x] Add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or reuse documented names consistently) to `api/_lib/env.ts` with validation when Supabase webhook persistence is enabled; document in `.env.example` (server-only block already mentions service role).
- [x] **Webhook handler** (AC: 1–5, 8)
  - [x] Replace `getStore().markEventProcessed(event.id)` idempotency with **`claim_payment_event` RPC + outcome handling** in `api/stripe-webhook.ts`.
  - [x] Implement `received` → `processed` / `failed` / `ignored` updates around existing `switch (event.type)` logic.
  - [x] Preserve **Node** runtime (`vercel.json` already pins `api/stripe-webhook.ts` to `nodejs18.x`).
- [x] **Dual-source cleanup** (AC: —)
  - [x] Confirm whether `api/stripe-webhook.js` is still referenced; if not, remove or align with TypeScript-canonical rule (NFR-MAINT-001) without breaking deploy.
- [x] **Tests** (AC: 3, 4, 6)
  - [x] Unit tests for idempotency helper (mock Supabase client): first insert succeeds; **`processed`/`ignored`** duplicate → no-op; **`failed`** → retry path exercised; **`received`** + concurrent delivery → no double side effects (mock locking or single transaction).
  - [x] Optional: handler-level test with mocked Stripe + mocked DB.

### Review Findings

- [x] [Review][Patch] Ledger must use `claim_payment_event` (or equivalent `FOR UPDATE` / lease semantics) and handle `busy` so two concurrent webhook deliveries cannot both run side effects while status is `received` — AC3. [api/_lib/paymentEventLedger.ts, supabase/migrations/20260427120000_payment_events.sql, api/stripe-webhook.ts] — **fixed 2026-04-26**
- [x] [Review][Patch] Extend unit/integration tests for concurrent `received`, `ignored` replay idempotency, and lease/`busy` outcomes. [api/_lib/paymentEventLedger.test.ts] — **fixed 2026-04-26**

## Dev Notes

### Requirements traceability

- **FR-PAY-002:** Webhook is source of truth; signature verification remains mandatory.
- **FR-PAY-003 / NFR-REL-002:** Idempotency via durable unique key, not Blob/local `events.json` or `events/{id}` markers.
- **FR-AN-003:** Correlate logs with `event.id`; avoid sensitive payload logging.
- **NFR-SEC-004:** Raw body verification unchanged.
- **NFR-MAINT-001:** TypeScript source canonical for webhook.

### Current implementation (must read before changing)

- **`api/stripe-webhook.ts`:** `constructEvent` → `store.markEventProcessed` → `payment_intent.succeeded` builds order from PI metadata and calls `store.recordOrder` + `store.decrementInventory`.
- **`api/_lib/store.ts`:** `markEventProcessed` uses local JSON or **public** Vercel Blob prefixes — **not** acceptable long-term system of record for payment idempotency (brownfield note in epics.md).
- **Architecture intent:** verify → **persist event** → then side effects; idempotency gate is the **`payment_events` ledger** keyed on Stripe `event.id` ([`architecture.md`](../planning-artifacts/architecture.md) — Cross-Cutting #1, Epic 0 stabilization #3).

### Ordering with adjacent stories

- **4-1 (`4-1-order-and-order-item-tables.md`)** is **ready-for-dev** (see `sprint-status.yaml`). This story **must not** assume `orders` / `order_items` exist in the **database** until that migration is applied. **Default:** keep existing `getStore().recordOrder` path after ledger insert so checkout→webhook→order JSON/Blob flow keeps working until **4-3-payment-success-order-paid** moves order persistence to Supabase.
- **4-3** will tie `payment_intent.succeeded` processing to Supabase orders + inventory in a transaction keyed to `payment_events.provider_event_id`.

### Domain types

- Use **`paymentEventSchema` / `PaymentEvent`** and **`paymentEventIngestStatusSchema`** from [`src/domain/commerce/order.ts`](../../src/domain/commerce/order.ts) and [`src/domain/commerce/enums.ts`](../../src/domain/commerce/enums.ts). **Do not** conflate domain **`ingest_status`** (maps to DB **`payment_events.status`**) with order **`payment_status`**.

### Stripe / runtime

- **stripe@^17.7.0** (see `package.json`). Webhook verification requires **raw** body — already satisfied.
- **Payment Element path** emits `payment_intent.succeeded` / `payment_intent.payment_failed` (architecture Q1 resolution). Optionally **store** other event types for future Checkout Session work without implementing handlers yet.

### Project Structure Notes

- Migrations live under `supabase/migrations/` (match existing timestamp style).
- Server Supabase access: **`@supabase/supabase-js` v2** with **service role** in `api/*` only — never expose in Vite.

### References

- [epics.md — §9.5 Payments, §9.12 FR-AN-003, Data Model `payment_events`, cross-cutting webhook bullet](../planning-artifacts/epics.md)
- [architecture.md — Cross-cutting #1 idempotency, §11 stack, Q1 PaymentIntent events](../planning-artifacts/architecture.md)
- [README-payments.md — local `stripe listen --forward-to …/api/stripe-webhook`](../../README-payments.md)
- Stripe: [Webhooks — verify signatures](https://docs.stripe.com/webhooks/signature)

## Dev Agent Record

### Agent Model Used

Composer (dev-story workflow)

### Debug Log References

### Completion Notes List

- Implemented `public.payment_events` + `claim_payment_event` RPC (lease on `claim_lease_until`, retry when `status = failed`, skip when `processed`/`ignored`, `503` when `busy`).
- Webhook calls `claim_payment_event` via `claimPaymentEvent` when Supabase is configured; **`503`** if another worker holds the lease (`busy`); **`503`** if Supabase env is missing (fail-fast, no legacy Blob idempotency).
- Terminal states: `payment_intent.succeeded` / `payment_intent.payment_failed` → `processed`; `default` → `ignored` (AC5). Handler exception → `failed` + sanitized `error_message`.
- **Manual replay / stuck `received`:** Operator can set row to `failed` (and clear `error_message` / `claim_lease_until` if needed) so the next Stripe delivery or resend hits the RPC `failed` → `received` + `process` path; or wait for lease expiry then retry.
- Removed duplicate `api/stripe-webhook.js` (TS canonical).

### File List

- `supabase/migrations/20260427120000_payment_events.sql`
- `api/_lib/paymentEventLedger.ts`
- `api/_lib/paymentEventLedger.test.ts`
- `api/stripe-webhook.ts`
- `.env.example`
- `api/stripe-webhook.js` (deleted)

### Change Log

- 2026-04-26: Story 4-2 — payment_events ledger, idempotent Stripe webhook, tests, remove duplicate JS handler.
- 2026-04-26: Code review — wire `claim_payment_event` in `paymentEventLedger.ts`, map `busy` → `503` in `stripe-webhook.ts`, expand ledger unit tests.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (epics list placeholder in `epics.md` compensated via PRD inventory + architecture + codebase).

### Git intelligence (recent patterns)

- Recent work centralized PaymentIntent/cart-quote/checkout on TypeScript server paths (`api/create-payment-intent.ts`, `api/_lib/catalog.ts`). Webhook should follow the same TS-canonical pattern and structured logging (`api/_lib/logger.ts`).

### Latest technical specifics

- **Stripe Node 17.x:** use `constructEvent(rawBody, sig, secret)`; keep `export const config = { api: { bodyParser: false } }` for Vercel.
- **Supabase:** service role bypasses RLS; still add RLS policies so leaked anon keys cannot read payment audit data.

### Project context reference

- No `project-context.md` matched the skill glob at story creation time; rely on this file + linked planning artifacts.

## Open questions (for Product/Architect if blocking)

- Should **every** unhandled event type be marked `ignored` automatically, or only after an explicit allowlist of “known noise” types? (AC5 asks for one consistent policy.)
