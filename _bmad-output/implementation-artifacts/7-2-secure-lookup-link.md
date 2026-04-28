# Story 7.2: Secure lookup link

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[7-1](7-1-order-lookup-form.md)** provides the public `/order-status` request form and submit contract.
- **[4-6](4-6-customer-confirmation-email.md)** and **[5-6](5-6-customer-shipment-notification.md)** provide the Resend + `notification_logs` email patterns to reuse.
- **[4-1](4-1-order-and-order-item-tables.md)** provides `orders.order_number` and `orders.customer_email`.
- **[4-3](4-3-payment-success-order-paid.md)** makes `orders.payment_status = 'paid'` the durable paid-order truth.

## Story

As a **returning customer**,
I want **a secure order-status link emailed to the address used at checkout**,
so that **only someone with access to that inbox can open the customer order status page**.

## Acceptance Criteria

1. **Order match is server-only and enumeration-safe**  
   **Given** `POST /api/order-lookup-request` receives a valid email + order number **when** the server checks Supabase **then** it uses `getSupabaseAdmin()` only, matches `orders.order_number` plus case-insensitive `orders.customer_email`, and only proceeds for paid orders unless product explicitly allows pending-payment support. **Regardless** of match/no-match/unpaid/order not found, the client receives the same neutral success response for valid payloads.

2. **Token persistence and expiry**  
   **Given** a matching paid order **when** a link is generated **then** persist a lookup token record in a new table such as `public.order_lookup_tokens` with at least: `id`, `order_id` FK, `token_hash` unique, `recipient_email`, `expires_at`, `created_at`, and optional `last_accessed_at`. Store only a cryptographic hash of the raw token; never store the raw token. Enable RLS with no `anon` / `authenticated` policies; service-role server code is the only writer/reader for this table.

3. **Secure link construction**  
   **Given** a token is created **when** the email is built **then** the link uses `ENV.FRONTEND_URL` and contains only the opaque token, for example `/order-status/<token>` or `/order-status?token=<token>`. It must not include email, order number, payment intent ID, customer name, or any PII. Use a high-entropy token, e.g. `randomBytes(32).toString("base64url")`, and hash it with SHA-256 before storage.

4. **Email delivery with existing transactional patterns**  
   **Given** Resend is configured **when** a matching order is found **then** send a concise customer email with the secure link, order number, expiry copy, and support line using [`sendViaResendApi`](../../api/_lib/transactionalEmail.ts). Add a `notification_logs` row using a new template constant such as `customer_order_lookup_link`; mark sent/failed using the helpers in [`api/_lib/notificationLog.ts`](../../api/_lib/notificationLog.ts). If Resend/env is missing, log a failed notification row when possible and still return neutral success.

5. **Abuse guardrails**  
   **Given** repeated valid requests for the same email/order pair **when** they occur within a short window **then** avoid email spam. Minimum acceptable behavior: if an unexpired token for the same order was created recently (recommend 5 minutes), return neutral success without sending another email. Do not log raw tokens; mask or omit raw customer email in logs.

6. **No account scope creep**  
   **Given** FR-CUST-002 mentions optional passwordless accounts **when** implementing this story **then** do not add Supabase Auth magic-link customer accounts, `/account`, order history, saved addresses, or customer login state. This is an order-scoped link only.

7. **Testing**  
   **Given** implementation is complete **when** tests run **then** cover: invalid payload; match and send path; no-match still returns neutral response and sends nothing; missing Resend config stays neutral; token hash is stored instead of raw token; recent-token suppression; and notification-log sent/failed paths with mocked Supabase and email transport.

## Tasks / Subtasks

- [x] **Task 1 - Token table migration (AC: 2, 5)**  
  - [x] Add `supabase/migrations/*_order_lookup_tokens.sql`.
  - [x] Include FK to `orders(id)`, unique `token_hash`, `expires_at` index, RLS enabled with default deny, and comments documenting raw-token storage prohibition.
  - [x] Consider cleanup-friendly indexes (`expires_at`, `order_id, created_at DESC`).

- [x] **Task 2 - Request handler lookup + token generation (AC: 1-3, 5)**  
  - [x] Complete `api/order-lookup-request.ts` or create it if Story 7-1 only built the UI.
  - [x] Validate the normalized payload with the shared schema from 7-1.
  - [x] Query `orders` by normalized order number and case-insensitive email using service role.
  - [x] Generate and hash token only for matching paid orders.
  - [x] Return neutral success for all valid payload outcomes.

- [x] **Task 3 - Email composition and notification logs (AC: 4)**  
  - [x] Add a small builder/helper under `api/_lib/customerOrderLookupLink.ts` or similar.
  - [x] Reuse `sendViaResendApi`, `supportLineForEmail`, and `notificationLog` helpers.
  - [x] Include expiry copy in both text and HTML bodies.

- [x] **Task 4 - Tests (AC: 7)**  
  - [x] Add handler tests with mocked Supabase chains and mocked email transport.
  - [x] Add pure helper tests for token hashing, link construction, and email body safety.

### Review Findings

- [x] [Review][Defer] **`api` importing shared validation from `src/order-status/orderLookupRequest.ts`** — [`api/order-lookup-request.ts`](../../api/order-lookup-request.ts) couples the API bundle to storefront source for Zod normalization; workable for Epic 7, but refactor to `shared/` or `api/_lib` would clarify boundaries (`7-2-secure-lookup-link.md` review 2026-04-27).
- [x] [Review][Defer] **`/order-status/<token>` deep link vs router** — Emails use [`buildOrderStatusLookupUrl`](../../api/_lib/customerOrderLookupLink.ts) with path `/order-status/<opaque>` per AC3; [`App.tsx`](../../src/components/App/App.tsx) currently registers only the static `/order-status` form route. Token consumption belongs to **7-3-customer-order-status-page**; until then, following the email link may fall through to the app shell 404 unless a stub route exists.
- [x] [Review][Defer] **No server-side rate limiting on `POST /api/order-lookup-request`** — Enumeration and abuse are partially mitigated by neutral responses and send suppression, but IP/user throttling is out of scope for this story; track for a hardening pass if traffic warrants.

## Dev Notes

### Story intent

This story is the security hinge for Epic 7. Email + order number should request access, not grant direct access. The secure link proves inbox access and keeps customer order reads behind a server-verified token.

### Dev Agent Guardrails

- Do **not** reuse `orders.order_confirmation_key` for emailed lookup links. That key was created for checkout-return confirmation and may live longer than the desired status-link TTL.
- Do **not** return "not found", "email mismatch", or "unpaid" from the public request endpoint for valid-shaped payloads.
- Do **not** use Supabase Auth customer magic links; this is not FR-CUST-002.
- Do **not** create browser-readable RLS policies for `order_lookup_tokens`, `orders`, `order_items`, `shipments`, or `order_events`.

### Technical requirements

| Area | Requirement |
|------|-------------|
| Crypto | Node `crypto.randomBytes` for token, SHA-256 hash for storage |
| Email | Existing Resend adapter in [`transactionalEmail.ts`](../../api/_lib/transactionalEmail.ts) |
| Logs | Existing [`notification_logs`](../../supabase/migrations/20260428160000_notification_logs.sql) table; add template constant only |
| Env | Use `ENV.FRONTEND_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `SUPPORT_EMAIL` |
| TTL | Recommend 24 hours for usability; document exact constant in helper and email copy |

### File structure expectations

| Action | Paths |
|--------|-------|
| New | `supabase/migrations/*_order_lookup_tokens.sql` |
| New/update | `api/order-lookup-request.ts` |
| New | `api/_lib/customerOrderLookupLink.ts` and tests |
| Update | [`api/_lib/notificationLog.ts`](../../api/_lib/notificationLog.ts) |
| Update | Story 7-1 UI only if endpoint response shape changes |

### Previous story intelligence

- **[5-6](5-6-customer-shipment-notification.md)** already handles customer email idempotency via durable markers and Resend idempotency. Reuse the logging/sending style, but do not mark order-level shipment or confirmation fields here.
- **[5-7](5-7-internal-notes-order-timeline.md)** says internal notes use `order_events.event_type = 'internal_note'` and must be excluded from customer serializers. This story should not serialize events yet.
- **[4-7](4-7-log-notification-status.md)** makes notification failure visible to admins; customer lookup link email should participate in that audit trail.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) section 9.10 and Epic 7.
- [`epics.md`](../planning-artifacts/epics.md) FR-CUST-001.
- [`architecture.md`](../planning-artifacts/architecture.md) Q10 guest + lookup decision.
- No checked-in `project-context.md` matched the create-story persistent facts glob at story creation time.

## Dev Agent Record

### Agent Model Used

- GPT-5 (Codex)

### Debug Log References

- `npm test -- api/_lib/customerOrderLookupLink.test.ts api/order-lookup-request.test.ts`
- `npm test -- src/order-status/orderLookupRequest.test.ts src/order-status/OrderStatusLookup.test.tsx api/order-lookup-request.test.ts api/_lib/customerOrderLookupLink.test.ts`
- `npm run build`
- `npx eslint api/order-lookup-request.ts api/order-lookup-request.test.ts api/_lib/customerOrderLookupLink.ts api/_lib/customerOrderLookupLink.test.ts`
- `npm test`
- `npm run lint` (blocked by pre-existing unrelated lint errors in `api/_lib/store.ts`, `src/cart/reconcile.ts`, `src/components/SubscriptionForm/SubscriptionForm.tsx`; warnings in `src/auth/AuthContext.tsx`, `src/context/CartContext.tsx`)

### Completion Notes List

- Implemented `order_lookup_tokens` migration (FK, unique `token_hash`, `expires_at` + `order_id, created_at` indexes, RLS enabled, no anon/auth policies).
- `api/order-lookup-request.ts` uses `getSupabaseAdmin()`, shared 7-1 zod schema, neutral 202 for valid payloads; loads order by `order_number`, compares `customer_email` case-insensitively, only persists token + sends for `payment_status === 'paid'`; skips duplicate emails when an unexpired token exists from the last 5 minutes; deletes token row if email cannot be sent so retries are possible.
- Added `api/_lib/customerOrderLookupLink.ts` (SHA-256 hash, `/order-status/<opaque>` URL, transactional email, `notification_logs` queued/sent/failed with template `customer_order_lookup_link`; failed path when Resend env missing or send fails).
- Tests: pure helpers, handler enumeration cases, integration tests for hash vs email link vs Resend, missing-Resend failed log.

### File List

- `supabase/migrations/20260430140000_order_lookup_tokens.sql`
- `api/order-lookup-request.ts`
- `api/order-lookup-request.test.ts`
- `api/_lib/customerOrderLookupLink.ts`
- `api/_lib/customerOrderLookupLink.test.ts`
- `api/_lib/customerOrderLookupLink.flow.test.ts`
- `api/_lib/customerOrderLookupLink.missingResend.test.ts`
- `api/_lib/notificationLog.ts`

## Change Log

- 2026-04-28 - Story created (bmad-create-story). Target: PRD E7-S2; secure emailed status link.
- 2026-04-28 - Implemented lookup token persistence, hashed secure links, transactional email + notification_logs, suppression and tests; sprint status updated to review.

## Story completion status

Status: **done**  
Code review completed 2026-04-27; implementation meets acceptance criteria; deferred items above are follow-ups, not blockers.
