# Story 7.3: Customer order status page

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[7-2](7-2-secure-lookup-link.md)** creates the secure token table and emailed link.
- **[4-1](4-1-order-and-order-item-tables.md)** and **[4-3](4-3-payment-success-order-paid.md)** provide durable order headers and line-item snapshots.
- **[5-4](5-4-order-fulfillment-status-transitions.md)** provides `order_events` for fulfillment timeline entries.
- **[5-7](5-7-internal-notes-order-timeline.md)** establishes that `internal_note` events are admin-only and must be excluded.

## Story

As a **customer with a secure lookup link**,
I want **to view a clear order status page**,
so that **I can see whether my order is paid, processing, packed, shipped, or delivered without asking the owner**.

## Acceptance Criteria

1. **Token route and loading states**  
   **Given** a customer opens the secure link from Story 7-2 **when** the route loads **then** the storefront renders a customer order status page, validates that a token is present, shows a loading state while the API resolves, and shows a generic expired/invalid link state when access fails. Support both the route shape chosen in Story 7-2 (for example `/order-status/:token`) and a query-param fallback only if already committed there.

2. **Server-only token verification**  
   **Given** the page needs order data **when** it fetches status **then** call a server endpoint such as **`GET /api/customer-order-status?token=...`**. The endpoint hashes the token, looks up an unexpired `order_lookup_tokens` row, loads the linked order using service role, and returns sanitized customer-safe JSON. The browser must not query `order_lookup_tokens`, `orders`, `order_items`, `order_events`, or `shipments` directly.

3. **Customer-safe order summary**  
   **Given** the token is valid **when** the API responds **then** include only customer-safe fields needed for status: `order_number`, `created_at`, `payment_status`, `fulfillment_status`, `total_cents`, `currency`, masked/confirmed customer email if useful, and line item snapshots (`product_title`, `variant_title`, `sku`, `quantity`, `unit_price_cents`, `total_cents`, optional image). Do not return `stripe_payment_intent_id`, `stripe_checkout_session_id`, `order_confirmation_key`, `customer_id`, internal `notes`, raw shipping JSON, admin-only notification logs, or service-role-only metadata.

4. **Customer-safe timeline**  
   **Given** fulfillment events exist in `order_events` **when** the API serializes timeline entries **then** use an allow-list. Include safe system/fulfillment events such as `fulfillment_status_changed`; exclude `internal_note` unconditionally. Do not expose `metadata.actor_user_id` or owner actor traces to customers.

5. **Status page UX**  
   **Given** a valid response **when** the page renders **then** show a compact order header, status progression, item list, total, and support fallback. Use customer-facing copy: "Preparing", "Packed", "Shipped", "Delivered" rather than raw enum strings where appropriate. Keep layout mobile-first, readable, and visually consistent with storefront pages, not the admin order detail.

6. **Token lifecycle behavior**  
   **Given** the customer refreshes the page before the token expires **when** the API is called again **then** it should continue working until `expires_at`. Do not consume the token on first page load unless product explicitly accepts one-time links and the UI handles refresh gracefully. Updating `last_accessed_at` is acceptable.

7. **Testing**  
   **Given** implementation is complete **when** tests run **then** cover API behavior for missing/malformed token, expired token, valid token, no linked order, and sanitized response shape. Add component tests for loading, invalid/expired, valid order, and event exclusion behavior if timeline mapping is factored client-side.

## Tasks / Subtasks

- [x] **Task 1 - Public status route (AC: 1, 5)**  
  - [x] Add a route/component for the tokenized status page under `src/order-status/`.
  - [x] Keep `/order-status` as the lookup request page from Story 7-1 and add the tokenized child/path chosen in Story 7-2.
  - [x] Add route smoke coverage for the tokenized route without requiring a real API response.

- [x] **Task 2 - Status API (AC: 2-4, 6)**  
  - [x] Add `api/customer-order-status.ts` (or a clearly named equivalent).
  - [x] Hash incoming token and query `order_lookup_tokens` by `token_hash` + `expires_at > now()`.
  - [x] Load order header and `order_items` via service role.
  - [x] Load `order_events` only through a safe allow-list; exclude `internal_note`.
  - [x] Optionally update `last_accessed_at`.

- [x] **Task 3 - View model and UI (AC: 3, 5)**  
  - [x] Add a typed response/view model helper under `src/order-status/`.
  - [x] Reuse [`formatCents`](../../src/lib/money.ts) for totals.
  - [x] Map raw statuses through customer-friendly labels while preserving exact enum values in data tests.

- [x] **Task 4 - Tests (AC: 7)**  
  - [x] API handler tests with mocked Supabase admin client.
  - [x] Pure serializer tests proving restricted fields and `internal_note` never appear.
  - [x] Component tests for loading, invalid, valid, and safe timeline display.

## Dev Notes

### Story intent

This is the first customer-facing read path for persisted orders after checkout confirmation. Treat it as a public-data serializer protected by a bearer-style random token. The route should be helpful, but the API response must be deliberately narrow.

### Dev Agent Guardrails

- Do **not** add `anon` or `authenticated` customer RLS policies on `orders`, `order_items`, `order_events`, or `shipments`.
- Do **not** import admin UI components wholesale; the page should feel like storefront customer support, not operator tooling.
- Do **not** return or render internal notes, admin actor IDs, notification logs, Stripe IDs, or raw `order_confirmation_key`.
- Do **not** make the token one-time by accident if the UI fetches more than once in React StrictMode/test environments.

### Technical requirements

| Area | Requirement |
|------|-------------|
| API | Vercel `api/*` handler, service-role Supabase only |
| Token | Hash incoming raw token the same way Story 7-2 stored it |
| Money | Reuse [`formatCents`](../../src/lib/money.ts) |
| Status values | Use existing `paymentStatusSchema` and `fulfillmentStatusSchema` where useful |
| Timeline | Allow-list public event types; exclude `internal_note` |

### File structure expectations

| Action | Paths |
|--------|-------|
| New | `api/customer-order-status.ts` and tests |
| New/update | `src/order-status/CustomerOrderStatusPage.tsx` |
| New | `src/order-status/customerOrderStatusViewModel.ts` and tests |
| Update | [`src/components/App/App.tsx`](../../src/components/App/App.tsx), [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) |

### Previous story intelligence

- **[7-2](7-2-secure-lookup-link.md)** should decide the exact token URL shape and token hash helper; reuse it rather than reimplementing hashing.
- **[5-3](5-3-admin-order-detail.md)** has order detail display logic, but customer data should be separately serialized to avoid leaking admin-only fields.
- **[5-7](5-7-internal-notes-order-timeline.md)** is the key privacy warning: `internal_note` rows live in `order_events` and must never reach this response.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) section 9.10, 12.3, and Epic 7.
- [`epics.md`](../planning-artifacts/epics.md) data model: `orders`, `order_items`, `order_events`.
- [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) returning-customer guidance and later order lookup route.
- No checked-in `project-context.md` matched the create-story persistent facts glob at story creation time.

## Dev Agent Record

### Agent Model Used

- GPT-5 (Codex)

### Debug Log References

- `npm test -- api/_lib/customerOrderStatus.test.ts api/customer-order-status.test.ts src/order-status/customerOrderStatusViewModel.test.ts src/order-status/CustomerOrderStatusPage.test.tsx src/routes.smoke.test.tsx`
- `npm run build`
- `npm test`
- `npx eslint api/customer-order-status.ts api/_lib/customerOrderStatus.ts api/customer-order-status.test.ts api/_lib/customerOrderStatus.test.ts src/order-status/CustomerOrderStatusPage.tsx src/order-status/customerOrderStatusViewModel.ts src/order-status/CustomerOrderStatusPage.test.tsx src/order-status/customerOrderStatusViewModel.test.ts src/components/App/App.tsx src/routes.smoke.test.tsx`

### Completion Notes List

- Added `GET /api/customer-order-status?token=...` with service-role-only token hash lookup, expiry check, linked order/item/event reads, and `last_accessed_at` refresh.
- Added a customer-safe API serializer that masks email, excludes Stripe IDs/customer IDs/internal notes/raw shipping JSON/admin metadata, and allow-lists public fulfillment timeline events.
- Added `/order-status/:token` storefront route and status page with loading, invalid/expired link handling, compact order header, progress, line items, total, timeline, and support fallback.
- Added focused API, serializer, view-model, component, and router smoke coverage.

### File List

- `api/customer-order-status.ts`
- `api/customer-order-status.test.ts`
- `api/_lib/customerOrderStatus.ts`
- `api/_lib/customerOrderStatus.test.ts`
- `src/order-status/CustomerOrderStatusPage.tsx`
- `src/order-status/CustomerOrderStatusPage.test.tsx`
- `src/order-status/customerOrderStatusViewModel.ts`
- `src/order-status/customerOrderStatusViewModel.test.ts`
- `src/components/App/App.tsx`
- `src/routes.smoke.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/7-3-customer-order-status-page.md`

## Change Log

- 2026-04-28 - Story created (bmad-create-story). Target: PRD E7-S3; token-protected customer order status page.
- 2026-04-28 - Implemented customer-safe status API, tokenized storefront page, view model, route smoke, and focused tests; sprint status updated to review.
- 2026-04-27 - Applied code review patches: `Cache-Control: no-store` on all customer-order-status responses; timeline JSON omits `order_events.message` (metadata-only); canceled fulfillment UX uses a single milestone; `last_accessed_at` refresh runs only after a successful 200 payload build; tests updated (focused slice).

## Review Findings

- [x] [Review][Patch] **Tokenized status responses are cacheable** [`api/customer-order-status.ts`](../../api/customer-order-status.ts#L24) — `GET /api/customer-order-status?token=...` returns bearer-token protected customer order data without `Cache-Control: no-store`. Add no-store cache headers on the status endpoint responses (including error paths) and cover it in the handler test so browsers/proxies do not retain private order snapshots.

- [x] [Review][Patch] **Timeline API exposes raw DB event messages** [`api/_lib/customerOrderStatus.ts`](../../api/_lib/customerOrderStatus.ts#L31) — the serializer allow-lists `event_type`, but still selects and returns `order_events.message`. Today the client ignores that field, but the API payload can leak future owner/system wording. Build customer-facing timeline entries only from allow-listed event type plus safe `metadata.from` / `metadata.to`, and omit `message` from the select, response type, and tests.

- [x] [Review][Patch] **Canceled orders show a misleading fulfillment ladder** [`src/order-status/customerOrderStatusViewModel.ts`](../../src/order-status/customerOrderStatusViewModel.ts) — `FULFILLMENT_PROGRESS` omits `canceled`, so `indexOf` yields `-1` and every ladder step renders as “upcoming” while the headline uses `customerFulfillmentLabel("canceled")` (“Canceled”). Treat canceled as its own UX path (single message or suppressed ladder).

- [x] [Review][Patch] **`last_accessed_at` updated before confirming a full successful read** [`api/_lib/customerOrderStatus.ts`](../../api/_lib/customerOrderStatus.ts#L246-L250) — the token row is updated immediately after resolving the lookup token but before `/orders`, `shipments`, `order_items`, and `order_events` complete; a failure on those reads returns 500 after “touching” the token’s last-accessed semantics. Prefer updating last accessed only once the handler is committing a 200 response (order + items/events consistent).

### Review Validation

- `npm test -- api/_lib/customerOrderStatus.test.ts api/customer-order-status.test.ts src/order-status/customerOrderStatusViewModel.test.ts src/order-status/CustomerOrderStatusPage.test.tsx src/routes.smoke.test.tsx` — passed (55 tests; React Router future-flag and Browserslist freshness warnings only).

## Story completion status

Status: **done**  
All review patch items above were applied and re-validated on 2026-04-27.
