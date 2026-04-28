# Story 5.6: Customer shipment notification

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

Requires server write paths from **[5-4](5-4-order-fulfillment-status-transitions.md)** (fulfillment → **`shipped`**) and **[5-5](5-5-carrier-tracking-fields.md)** (`shipments` persistence via **`api/`**). Email send runs **only** in Node **`api/*`** / `_lib` — not from the SPA.

## Story

As a **customer**,
I want **an email when my order ships** with **carrier and tracking details**,
so that **I can follow delivery** without contacting support — satisfying **FR-NOT-004** (P2), **FR-FUL-002** (tracking in customer shipment email), **PRD §14 E5-S6**, and **MVP scenario step 17** ([zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §15).

## Acceptance Criteria

1. **Trigger semantics**  
   **Invocation:** Call `maybeSendCustomerShipmentNotification` **only from server code** ([`api/`](../../api/) handlers or shared `_lib` used by those handlers) — **never** from the browser — aligned with **[5-4](5-4-order-fulfillment-status-transitions.md)** / **[5-5](5-5-carrier-tracking-fields.md)** (JWT-verified APIs, not raw PostgREST from the SPA for the durable write path).  
   **When to send (MVP):** **Given** `payment_status = 'paid'`, **`fulfillment_status`** has transitioned to **`shipped`** per **[5-4](5-4-order-fulfillment-status-transitions.md)**, **`orders.customer_shipment_notification_sent_at`** is **null**, **when** the handler completes the **first eligible ship-notification attempt** for that order **then** send a **transactional email** to **`orders.customer_email`** (same recipient rules as **[4-6](4-6-customer-confirmation-email.md)**).  
   **Tracking content:** Load **`carrier`**, **`tracking_number`**, **`tracking_url`** from **`shipments`** when present ([**5-5**](5-5-carrier-tracking-fields.md)); **email still sends** if those fields are **null** (omit tracking lines; short “marked shipped” message). **Optional tracking filled later** does **not** re-send email in MVP — gated by **`customer_shipment_notification_sent_at`** (see AC5).  
   **Coordination:** Prefer invoking **after** **`shipments`** row is upserted when **`shipped`** is set; if transition and tracking land in **one** server request, call once after both are durable. If tracking is saved **only** via **5-5** API **after** transition, invoke from the **5-5** handler when transitioning to shipped **or** immediately after persist when order is already **`shipped`** — document the single chosen call site in dev notes.

2. **Email content**  
   **Given** FR-NOT-004 / FR-FUL-002, **when** the email is composed, **then** it includes at minimum: **order number**, **short fulfillment message**, **carrier name** (if present), **tracking number** (if present), a **clickable tracking link** when `tracking_url` is present, **support/contact line** (reuse `supportLineForEmail` / `SUPPORT_EMAIL` pattern from [`api/_lib/customerOrderConfirmation.ts`](../../api/_lib/customerOrderConfirmation.ts)), and **plain HTML + text** parts consistent with **mobile-email-safe** styling used in **4-6**.

3. **Provider + env**  
   **Given** the project uses **Resend** via [`api/_lib/transactionalEmail.ts`](../../api/_lib/transactionalEmail.ts), **when** sending, **then** use **`ENV.RESEND_API_KEY`**, **`ENV.RESEND_FROM`**, and the same **no-send** behavior when keys/`RESEND_FROM` are missing (**log at `info`**, no throw) as in **4-6**. Use **`Idempotency-Key`** on the Resend request (e.g. `customer-shipment/{orderId}` or a variant that still dedupes accidental double-clicks within 24h).

4. **Notification ledger (4-7)**  
   **Given** [`api/_lib/notificationLog.ts`](../../api/_lib/notificationLog.ts) and **NFR-REL-003**, **when** a send is attempted, **then** insert **`notification_logs`** as **`queued`** before the provider call, then **`sent`** / **`failed`** with **`provider_message_id`** / **`error_message`** on the same patterns as **owner** and **customer confirmation** modules. Add a **stable `template` string constant** (e.g. `customer_shipment`) exported next to `NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_CONFIRMATION`.

5. **Idempotency / retry**  
   **Given** webhook-style reliability expectations from **4-6**, **when** the ship path is retried or invoked twice, **then** the customer must **not** receive duplicate shipment emails for the **same logical ship event**. Implement a **durable marker** on `orders` (recommended: `customer_shipment_notification_sent_at timestamptz`, mirroring `customer_confirmation_sent_at`) **or** an equivalently strong documented strategy using **`notification_logs`** + conditional updates; preference is **order-column marker** for simple backfill/retry queries. **Order state / fulfillment updates must not roll back** if email fails.

6. **Unsendable / placeholder emails**  
   **Given** [`isUnsendableCustomerEmail`](../../api/_lib/customerOrderConfirmation.ts) / `pending@checkout.zephyr.local`, **when** the recipient is unsendable, **then** **do not** call Resend; log and record **`notification_logs`** as **`failed`** with a clear **`error_message`** (mirror **4-6**).

7. **Security & correlation**  
   **Given** **NFR-SEC-002** and **FR-AN-003**, **when** logging, **then** use **Pino** [`api/_lib/logger.ts`](../../api/_lib/logger.ts) with **`order_id`**, **`order_number`**, **`notification_log_id`** where applicable; **never** log full email bodies or unnecessary PII.

8. **Tests**  
   **Given** **NFR-MAINT-003**, **when** the feature lands, **then** add **Vitest** coverage (mock Supabase + mock `sendViaResendApi`) for: happy path **queued → sent** + marker set; skip when **`customer_shipment_notification_sent_at`** already set; skip when **Resend** not configured; **failed** provider path marks **`notification_logs`** **`failed`** and **does not** set the order marker.

## Tasks / Subtasks

- [x] **Task 1 — Template constant + migration (AC: 4, 5)**  
  - [x] Add `NOTIFICATION_TEMPLATE_CUSTOMER_SHIPMENT` in [`api/_lib/notificationLog.ts`](../../api/_lib/notificationLog.ts).  
  - [x] New Supabase migration: `customer_shipment_notification_sent_at` on `public.orders` (nullable `timestamptz`, comment referencing E5-S6 / FR-NOT-004) — follow naming/timestamp convention under [`supabase/migrations/`](../../supabase/migrations/).

- [x] **Task 2 — Email builder + sender (AC: 1–4, 6–7)**  
  - [x] New module e.g. [`api/_lib/customerShipmentNotification.ts`](../../api/_lib/customerShipmentNotification.ts): `buildCustomerShipmentEmail(...)`, `maybeSendCustomerShipmentNotification({ admin, orderId, ... })` — **non-throwing** caller contract (same as `maybeSendCustomerOrderConfirmation`).  
  - [x] Reuse **`sendViaResendApi`**, **`insertNotificationLog`**, **`markNotificationLogSent`**, **`markNotificationLogFailed`**, and shared formatting helpers from [`api/_lib/ownerOrderNotification.ts`](../../api/_lib/ownerOrderNotification.ts) where appropriate.

- [x] **Task 3 — Integration hook (AC: 1)**  
  - [x] Wire **`maybeSendCustomerShipmentNotification`** from **`api/`** code introduced in **[5-4](5-4-order-fulfillment-status-transitions.md)** (transition to **`shipped`**) and/or **[5-5](5-5-carrier-tracking-fields.md)** (`shipments` upsert) — **after** DB writes succeed and while **`customer_shipment_notification_sent_at`** is still null. Pick **one or two** documented call sites (avoid duplicate sends — rely on AC5 marker + idempotent guard inside `maybeSend*`).  
  - [x] If **5-4/5-5** are not merged yet: land **Task 1–2** + a **single documented stub call site** + tests proving the hook contract. _(Fulfillment/shipment handlers exist; wired both endpoints — idempotent **`maybeSend*`** avoids duplicate deliveries.)_

- [x] **Task 4 — Tests (AC: 8)**  
  - [x] `api/_lib/customerShipmentNotification.test.ts` mirroring patterns in [`api/_lib/customerOrderConfirmation.test.ts`](../../api/_lib/customerOrderConfirmation.test.ts).

### Review Findings

- [x] [Review][Patch] Tracking link `href` HTML-escapes the raw URL (`escapeHtml(url)`), which breaks valid URLs containing `&` and weakens safe linking; use a safe href (e.g. http(s)-only + unescaped attribute or `encodeURI`) — `api/_lib/customerShipmentNotification.ts` (fixed: `safeHttpUrlForHref` + tests)

- [x] [Review][Patch] AC8 / AC3 parity — add Vitest for missing **`RESEND_FROM`** (skip send, failed `notification_logs`, no order marker), mirroring the existing **`RESEND_API_KEY`** case — `api/_lib/customerShipmentNotification.test.ts` (fixed)

- [x] [Review][Patch] Guard **`customer_email`** shape before **`.trim()`** and unsendable checks so a null/non-string row from PostgREST cannot throw mid-handler — `api/_lib/customerShipmentNotification.ts` (fixed + test)

- [x] [Review][Defer] **`loadShipmentTracking`** errors omit carrier lines and the email copy reads like “tracking not yet available,” which is indistinguishable from an empty shipment row — `api/_lib/customerShipmentNotification.ts:95-113` — deferred, pre-existing

- [x] [Review][Defer] **Admin handler drift** — `admin-order-fulfillment` vs `admin-shipment`: OPTIONS status (204 vs 200), local bearer parsing vs `getBearerAuthorizationHeader`, `isSupabaseOrderPersistenceConfigured` vs `getSupabaseAdmin()`-only gate — `api/admin-order-fulfillment.ts`, `api/admin-shipment.ts` — deferred, pre-existing

## Dev Notes

### Story intent

This story delivers **FR-NOT-004** after **Epic 4** established **Resend**, **`notification_logs`**, and **customer confirmation** (**[4-6](4-6-customer-confirmation-email.md)**, **[4-7](4-7-log-notification-status.md)**). **Fulfillment and tracking persistence** are **[5-4](5-4-order-fulfillment-status-transitions.md)** and **[5-5](5-5-carrier-tracking-fields.md)** (server **`api/`** paths); **this story owns the customer email** and **`customer_shipment_notification_sent_at`**, and **hooks only into those server paths**.

### Prerequisites / ordering

| Story | Why it matters |
|-------|----------------|
| **5-4** | Produces **`shipped`** (or equivalent) fulfillment transition to hang the trigger on. |
| **5-5** | Supplies **carrier / tracking number / URL** fields expected in the email body. |
| **4-6 / 4-7** | Patterns for **Resend**, **notification_logs**, **idempotency**, **tests**. |
| **5-1** | Admin **RLS SELECT** on `orders` + `notification_logs` for future “notification failed” UI — **writes** remain service-role only. |

### Technical requirements (guardrails)

| Topic | Direction |
|-------|-----------|
| **FR** | **FR-NOT-004**, **FR-FUL-002**; **E5-S6** in [PRD §14](../planning-artifacts/zephyr-lux-commerce-prd.md). |
| **NFR** | **NFR-REL-003** — email failure must not lose order; **NFR-SEC-002** — no secrets in browser. |
| **Data** | PRD §12 proposes **`shipments`** (`carrier`, `tracking_number`, `tracking_url`). If **5-5** stores tracking on **`orders`** instead, the email module should accept **explicit arguments** (carrier, number, url) loaded by the caller so schema evolution does not require rewriting templates. |
| **Duplicate sends** | If the owner **updates tracking** after the first ship email, **out of scope for MVP** unless **[5-5]** explicitly requires re-notification — default: **one email per order** gated by `customer_shipment_notification_sent_at`. |

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): **Notification dispatch must not block** primary writes; **failures logged and retryable**; **Resend** behind shared transport.  
- **Three trust zones**: shipment email send runs **only** in **Node serverless** (`api/*`), not in the SPA.

### File structure expectations

| Action | Paths |
|--------|--------|
| **New** | `api/_lib/customerShipmentNotification.ts`, `api/_lib/customerShipmentNotification.test.ts` |
| **Update** | `api/_lib/notificationLog.ts` (template constant); `supabase/migrations/*_customer_shipment_notification_sent_at.sql` |
| **Wire-up** | **`api/admin-order-fulfillment.ts`** / **`api/admin-shipment.ts`** (see **5-4**, **5-5**) |

### Testing requirements

- Mock **`SupabaseClient`** chains like existing notification tests.  
- Mock **`sendViaResendApi`**; no live Resend or Stripe.

### Previous story intelligence

- **[4-6](4-6-customer-confirmation-email.md)**: Use **`customer_confirmation_sent_at`** pattern as the **blueprint** for **`customer_shipment_notification_sent_at`**; reuse **placeholder email** guards and **support line** helper.  
- **[4-7](4-7-log-notification-status.md)**: **Append-only** `notification_logs`; each attempt may insert a new row; terminal **`sent`/`failed`** must be consistent with **`markNotificationLogSent`/`Failed`**.  
- **[5-1](5-1-supabase-admin-auth.md)**: Admin may **read** `notification_logs` via RLS; **never** expose **service role** to the client for sends.

### Git intelligence (recent commits)

Recent work completed **Epic 4** notification stack (`customerOrderConfirmation`, `ownerOrderNotification`, `notificationLog`, Resend transport). **5-6** extends that stack for **post-fulfillment** mail.

### Latest technical notes (2026)

- **Resend** REST API + **`Idempotency-Key`** header already implemented in [`transactionalEmail.ts`](../../api/_lib/transactionalEmail.ts).  
- **`stripe@^17`** unchanged.

### Project context reference

- [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.6–9.7, §12, §14 Epic 5, §15 scenario step 17.  
- [epics.md](../planning-artifacts/epics.md) FR-NOT-004, FR-FUL-002, FR-ADM-004.

## Dev Agent Record

### Agent Model Used

Composer — BMad Dev Story workflow (`5-6-customer-shipment-notification`).

### Debug Log References

_(None.)_

### Completion Notes List

- Added `customer_shipment_notification_sent_at` + `customer_shipment` notification template constant; **`maybeSendCustomerShipmentNotification`** follows 4-6 ledger + Resend `Idempotency-Key` `customer-shipment/{orderId}` and sets the order marker only after a successful outbound send attempt path (skipped when unsendable placeholder, missing Resend env, unpaid/not-shipped fulfillment, duplicate marker, or Resend **`ok: false`**).
- Loads optional **`carrier` / `tracking_number` / `tracking_url`** from **`shipments`** by `order_id` (best-effort warn + omit lines if the table/read fails until 5-5 DDL is universally applied).
- Integration: **`await maybeSendCustomerShipmentNotification`** after successful **`apply_fulfillment_transition`** when target is **`shipped`**, and after **`shipments` upsert** in **`admin-shipment`** for retry when fulfillment is already **`shipped`** ([`api/admin-order-fulfillment.ts`](../../api/admin-order-fulfillment.ts), [`api/admin-shipment.ts`](../../api/admin-shipment.ts)); extended [`api/admin-order-fulfillment.handler.test.ts`](../../api/admin-order-fulfillment.handler.test.ts).

### Change Log

- 2026-04-27 — Implemented customer shipment transactional email (`api/_lib/customerShipmentNotification.ts`), migration, handler wiring, and Vitest coverage; sprint status **`5-6-customer-shipment-notification` → review**.
- 2026-04-27 — Code review: safe http(s) tracking `href`, **`RESEND_FROM`** Vitest, **`customer_email`** runtime guard; story **`review` → done**.

### File List

- `_bmad-output/implementation-artifacts/5-6-customer-shipment-notification.md` (tasks, Dev Agent Record, status — Dev Story workflow only)
- `supabase/migrations/20260428190000_customer_shipment_notification_sent_at.sql`
- `api/_lib/notificationLog.ts`
- `api/_lib/customerShipmentNotification.ts`
- `api/_lib/customerShipmentNotification.test.ts`
- `api/admin-order-fulfillment.ts`
- `api/admin-shipment.ts`
- `api/admin-order-fulfillment.handler.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
