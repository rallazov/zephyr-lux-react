# Story 8.6: Owner push notification prototype

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[4-5](4-5-owner-order-notification.md)** and `notification_logs` establish owner notification logging for paid orders.
- **[8-4](8-4-admin-pwa-shell.md)** should provide the service worker/manifest foundation for browser push subscription.
- **Epic 5 admin auth is complete:** push subscription management must be admin-only and must not expose customer/order detail in public browser storage.

## Story

As a **store owner**,
I want **an opt-in browser push notification prototype for new paid orders**,
so that **I can evaluate mobile/PWA notification usefulness while email remains the reliable fallback channel**.

## Acceptance Criteria

1. **Feature-gated push prototype**  
   **Given** push support is experimental **when** the app is deployed **then** push is disabled unless required env/config is present, recommended as `ENABLE_OWNER_PUSH_NOTIFICATIONS`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. The admin UI should gracefully hide or explain unavailable push setup in unsupported browsers.

2. **Admin-only subscription capture**  
   **Given** the owner is signed into admin **when** they opt in **then** the browser requests notification permission, uses the registered service worker’s `PushManager.subscribe()` with the VAPID public key, and sends the subscription JSON to a server endpoint such as `POST /api/admin-push-subscription`. The endpoint verifies the Supabase Bearer JWT/admin role before persisting.

3. **Push subscription persistence**  
   **Given** a push subscription is accepted **when** the server stores it **then** a table such as `owner_push_subscriptions` stores `id`, `user_id`, `endpoint` unique, `p256dh`, `auth`, `user_agent` nullable, `status` (`active`/`revoked`/`failed`), `last_seen_at`, `created_at`, and `updated_at`. Do not store customer data in this table.

4. **New paid order notification hook**  
   **Given** a paid order is durably recorded **when** the existing owner notification path runs **then** a push notification can be sent to active owner subscriptions with a minimal payload such as title “New paid order” and body containing only order number/total or a similarly low-risk preview. Sensitive details such as full shipping address, full email, line items, and payment references must not be included in the push payload.

5. **Logging, idempotency, and fallback**  
   **Given** push send succeeds or fails **when** the hook runs **then** write `notification_logs` rows with `channel = 'push'` and `template` such as `owner_order_paid_push`. Invalid/expired subscriptions should be marked inactive/revoked. Email owner notification remains unchanged and should not depend on push success.

6. **Service worker notification click behavior**  
   **Given** the owner taps a notification **when** the service worker handles `notificationclick` **then** it opens/focuses the admin order detail route if a safe order ID is included, or `/admin/orders` otherwise. The route still requires admin auth; the notification payload must not grant access.

7. **Testing and manual validation**  
   **Given** the story is complete **when** tests run **then** add tests for admin subscription API auth, VAPID config guards, push payload redaction, notification log writes, invalid endpoint handling, and service-worker click routing where feasible. Document browser support and manual QA result because push behavior varies by platform.

## Tasks / Subtasks

- [x] **Task 1 - Config and service worker support (AC: 1, 6)**  
  - [x] Add env/config parsing for push feature flags and VAPID keys.
  - [x] Extend the PWA service worker from 8-4 with `push` and `notificationclick` handlers.
  - [x] Keep all push logic inert when unsupported or disabled.

- [x] **Task 2 - Subscription persistence/API (AC: 2, 3)**  
  - [x] Add `owner_push_subscriptions` migration with RLS/admin read policy and server-only writes.
  - [x] Add `api/admin-push-subscription.ts` for upsert/revoke, verifying admin JWT.
  - [x] Add client helper/admin UI control for opt-in, opt-out, and current support status.

- [x] **Task 3 - Paid order push sender (AC: 4, 5)**  
  - [x] Add an `api/_lib` push sender using a proven Web Push implementation if needed.
  - [x] Hook after durable owner paid-order notification/order creation, keeping email as fallback.
  - [x] Log push attempts in `notification_logs` and revoke failed subscriptions on gone/invalid endpoint responses.

- [x] **Task 4 - Payload privacy and routing (AC: 4, 6)**  
  - [x] Keep notification text minimal and free of address/full-email/payment details.
  - [x] Open `/admin/orders/:id` only as a convenience route; auth remains required.
  - [x] Add tests proving redacted payload shape.

- [x] **Task 5 - Tests and QA (AC: 7)**  
  - [x] Add API/lib tests with mocked push provider.
  - [x] Add service-worker/client helper tests where practical.
  - [x] Run focused tests plus `npm run build`.
  - [x] Record manual browser/PWA push validation notes.

## Dev Notes

### Story intent

This is a prototype channel for the owner, not the primary alerting system. Email notification remains the reliable path. Push should prove whether PWA notifications are useful while keeping payloads intentionally sparse.

### Dev Agent Guardrails

- Do **not** include shipping addresses, full customer emails, line items, Stripe references, or raw order metadata in push payloads.
- Do **not** make push success required for order creation, inventory decrement, or email notification.
- Do **not** expose VAPID private key or service role credentials to the browser.
- Do **not** add customer push notifications in this story.

### Architecture compliance

| Concern | Requirement |
|---------|-------------|
| Notifications | Optional push channel; email fallback remains |
| Privacy | Minimal payload, admin auth still required for detail |
| PWA | Reuse service worker/manifest from 8-4 |
| Persistence | Supabase subscription table + `notification_logs` push rows |

### File structure expectations

| Action | Paths |
|--------|-------|
| New | `supabase/migrations/YYYYMMDDHHMMSS_owner_push_subscriptions.sql` |
| New | `api/admin-push-subscription.ts` and tests |
| New/update | `api/_lib/ownerPushNotification.ts`, owner notification hook |
| Update | `public/service-worker.js`, `src/pwa/` helpers, admin UI |
| Update | `api/_lib/env.ts`, env docs |

### Previous story intelligence

- **[4-5](4-5-owner-order-notification.md)** already logs/sends owner order alerts; push should plug in after the paid-order state is durable.
- **[4-7](4-7-log-notification-status.md)** established `notification_logs.channel` values including `push` in the PRD model.
- **[8-4](8-4-admin-pwa-shell.md)** owns installability/service worker basics; reuse rather than duplicate registration code.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.7 `FR-NOT-003`, §9.8 `FR-ADM-007`, §12.7, Release 3, and Epic 8.
- [`epics.md`](../planning-artifacts/epics.md) `FR-NOT-003` and notification log data model.
- [`architecture.md`](../planning-artifacts/architecture.md) PWA push notification and admin mobile notes.

## Dev Agent Record

### Agent Model Used

—

### Debug Log References

—

### Completion Notes List

- Implemented feature-gated owner push: `ENABLE_OWNER_PUSH_NOTIFICATIONS` plus VAPID env vars (`api/_lib/env.ts`, `isOwnerPushNotificationsConfigured`), `.env.example` documentation.
- Added `owner_push_subscriptions` table + admin SELECT RLS (`supabase/migrations/20260430201000_owner_push_subscriptions.sql`).
- `api/admin-push-subscription.ts`: GET status (VAPID public key only when enabled), POST subscribe upsert + revoke; admin JWT via existing `verifyAdminJwt`.
- `api/_lib/ownerPushSend.ts` + `ownerPushPayload.ts`: `web-push` fan-out, `notification_logs` `owner_order_paid_push` with stale-queued recovery, revoke subscription on 404/410; idempotent per order (`sent` / fresh `queued` guards).
- `maybeSendOwnerOrderPaidNotification` calls `maybeSendOwnerOrderPaidPush` on missing-email, items-error, Resend-failure, and email-success paths without blocking email (`api/_lib/ownerOrderNotification.ts`).
- `public/service-worker.js`: `push` + `notificationclick` open `/admin/orders/:uuid` when payload orderId validates, else `/admin/orders`.
- Admin UI: `AdminOwnerPushPanel` in `AdminLayout`; client helpers `src/pwa/ownerPushClient.ts`.
- Tests: `api/admin-push-subscription.test.ts`, `ownerPushPayload.test.ts`, `ownerPushSend.test.ts`, `ownerPushClient.test.ts`; `ownerOrderNotification.test.ts` mocks `ownerPushSend`. Fixed unrelated `ShipmentEvidencePanel.test.tsx` RTL helper; added `@testing-library/user-event`. Declared `web-push` / `busboy` in `src/vite-env.d.ts`; fixed `subscriptionLifecycle.test.ts` cast for `tsc`.
- **Manual QA (not run here):** Full push requires HTTPS, deployed worker, applied migration, real VAPID keys, and a PushManager-capable browser/OS; run opt-in from `/admin`, pay a test order, confirm notification + click routing.

### File List

- `_bmad-output/implementation-artifacts/8-6-owner-push-notification-prototype.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `supabase/migrations/20260430201000_owner_push_subscriptions.sql`
- `api/_lib/env.ts`
- `api/_lib/notificationLog.ts`
- `api/_lib/ownerPushPayload.ts`
- `api/_lib/ownerPushPayload.test.ts`
- `api/_lib/ownerPushSend.ts`
- `api/_lib/ownerPushSend.test.ts`
- `api/_lib/ownerOrderNotification.ts`
- `api/_lib/ownerOrderNotification.test.ts`
- `api/_lib/subscriptionLifecycle.test.ts`
- `api/admin-push-subscription.ts`
- `api/admin-push-subscription.test.ts`
- `public/service-worker.js`
- `src/admin/AdminLayout.tsx`
- `src/admin/AdminOwnerPushPanel.tsx`
- `src/admin/ShipmentEvidencePanel.test.tsx`
- `src/pwa/ownerPushClient.ts`
- `src/pwa/ownerPushClient.test.ts`
- `src/vite-env.d.ts`
- `.env.example`
- `package.json`
- `package-lock.json`

## Change Log

- 2026-04-28 - Story created (bmad-create-story). Target: PRD E8-S6; owner push notification prototype.
- 2026-04-28 - Implemented owner push prototype (env, migration, admin API, web-push sender, SW handlers, admin UI, tests, build fixes).

## Story completion status

Status: **review** — ready for code review; apply Supabase migration and configure VAPID in deploy before manual QA.
