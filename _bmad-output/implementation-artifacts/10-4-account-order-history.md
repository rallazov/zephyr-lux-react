# Story 10.4: Account order history

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Dependencies

- [10-1](10-1-customer-identity-passwordless-auth.md) provides customer auth and RLS.
- [10-2](10-2-account-route-profile-shell.md) provides `/account`.
- [10-3](10-3-link-orders-to-customers.md) links orders to customer records.

## Story

As a **signed-in customer**,
I want to **see my previous Zephyr Lux orders from `/account`**,
so that I can check fulfillment status, tracking, and order details without finding an email link.

As the **store owner**,
I want account history to expose only **customer-safe order data**,
so that account convenience does not leak admin notes, internal events, or another customer’s order.

## Acceptance Criteria

1. **Given** a signed-in customer with linked orders, **when** they open `/account`, **then** they see a reverse-chronological order history list showing order number, created date, payment status, fulfillment status, total, item count, and a clear affordance to view details/status.

2. **Given** a signed-in customer has no linked orders, **when** `/account` renders, **then** the page shows a helpful empty state with a link to [`/order-status`](../../src/order-status/OrderStatusLookup.tsx) for guest lookup, not an error.

3. **Given** [FR-CUST-001](../planning-artifacts/epics.md) already exposes secure token status, **when** account history opens an order detail/status view, **then** it reuses the same customer-safe semantics as [`buildCustomerOrderStatusResponse`](../../handlers/_lib/customerOrderStatus.ts): line items, fulfillment state, public tracking, and public timeline only; no admin notes, notification logs, internal note events, raw shipping image ids, or service-only identifiers.

4. **Given** a customer is authenticated as user A, **when** they request order history, **then** they can only receive orders linked to their own `customers.id`; tests must prove user A cannot fetch user B’s orders by order id, order number, or customer id.

5. **Given** order history may need server aggregation from `orders`, `order_items`, `order_events`, and `shipments`, **when** the endpoint/RPC is implemented, **then** it validates the bearer/session, uses server-safe Supabase access, and returns a typed, minimal response rather than exposing full table rows to the browser.

6. **Given** guest checkout remains supported, **when** a guest uses `/order-status` or an old secure lookup token, **then** account history changes do not change lookup request, token resolution, or token expiry behavior.

7. **Given** mobile shoppers are primary users, **when** history renders at narrow widths, **then** order cards/rows remain scannable, tappable, and do not overflow totals, statuses, SKUs, or tracking labels.

8. **Given** implementation is complete, **when** validation runs, **then** add handler/helper tests for authorization and serialization plus RTL coverage for loading, empty, error, and populated states; run `npm test`, `npm run build`, and `npm run smoke`.

## Tasks / Subtasks

- [x] **Task 1 — Customer-safe account order API (AC: 3, 4, 5, 6)**  
  - [x] Add a server handler or constrained RPC for the current customer’s order history.
  - [x] Reuse/align with [`customerOrderStatus.ts`](../../handlers/_lib/customerOrderStatus.ts) serialization rules.
  - [x] Exclude admin-only fields and internal notes/events.

- [x] **Task 2 — Account page integration (AC: 1, 2, 7)**  
  - [x] Extend `/account` from [10-2](10-2-account-route-profile-shell.md) with loading, empty, error, and populated history states.
  - [x] Add detail/status link behavior that is explicit and secure.
  - [x] Keep layout dense and readable on mobile.

- [x] **Task 3 — Authorization and regression tests (AC: 4, 6, 8)**  
  - [x] Add tests proving cross-customer order access is denied.
  - [x] Add tests proving guest lookup/token flows remain unchanged (existing coverage retained; resolver mock fixed for stable checkout tests).
  - [x] Add RTL tests for account history states.

- [x] **Task 4 — Verification (AC: 7, 8)**  
  - [x] Run `npm test`, `npm run build`, and `npm run smoke`.
  - [x] Manual QA: signed-out account, signed-in no orders, signed-in with shipped order/tracking, and `/order-status` guest lookup.

## Dev Notes

### Scope Boundary

- Do **not** add reorder, saved addresses, account preferences, refunds, or support messaging unless a future story expands Epic 10.
- Do **not** expose admin order detail or internal timeline data to customers.
- Do **not** require an account to access existing secure token links.

### Technical Notes

- The existing customer status serializer is a useful baseline but currently starts from a lookup token; account history should authorize by session/customer id.
- Prefer a compact view model for list rows, with a separate detail/status fetch only if needed.
- If deep-linking account order detail, route names should be predictable and not collide with `/order-status/:token`.
- **`customer-order-status`** ([`customer-order-status.ts`](../../handlers/customer-order-status.ts)) CORS Allow-Headers is **`Content-Type` only** — correct for GET + query token; any **Bearer-based account history endpoint** exposed to cross-origin SPA fetches needs **`Authorization` in Allow-Headers** (`Cache-Control` / `no-store` as appropriate), matching the checkout handler pattern [`create-payment-intent`](../../handlers/create-payment-intent.ts).
- Do **not** rely on browser Supabase `.from('orders')` reads for storefront users (`orders` RLS is admin-oriented); keep aggregation server-side (**AC 5**) and return minimal DTOs.




- [Epics — Epic 10](../planning-artifacts/epics.md)
- [`customerOrderStatus.ts`](../../handlers/_lib/customerOrderStatus.ts)
- [`CustomerOrderStatusPage.tsx`](../../src/order-status/CustomerOrderStatusPage.tsx)
- [`OrderStatusLookup.tsx`](../../src/order-status/OrderStatusLookup.tsx)
- [`orders` migration](../../supabase/migrations/20260427090000_orders_and_order_items.sql)
- [`shipments` migration](../../supabase/migrations/20260428180000_shipments.sql)

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- `handlers/create-payment-intent.handler.test.ts`: mock `resolveVerifiedCustomerIdForCheckoutOrder` via **partial stub of `./_lib/verifyAdminJwt`** (`vi.spyOn`/spread `importOriginal`); keep `./_lib/resolveVerifiedCheckoutCustomerId` untouched (that module does not expose the verifier). Use `vi.resetModules()` ahead of importing the handler when chaining suites that redefine the verifier mock.

### Completion Notes List

- Added `GET /api/customer-account-order-history` (optional `order_id`): Bearer-only, `Content-Type` + `Authorization` CORS, `Cache-Control: no-store`, minimal list DTOs and detail payloads built via shared `buildCustomerOrderStatusResponse` rules only after `orders.id` + `orders.customer_id` match the verified shopper’s `customers.id`.
- Wired `/account` with passwordless sign-in shell, Bearer session fetches against the API, empty/history/error states, and `/account/orders/:orderId` reuse of exported `CustomerOrderStatusReady`.
- Exported `CustomerOrderStatusReady` from [`CustomerOrderStatusPage.tsx`](../../src/order-status/CustomerOrderStatusPage.tsx) for DRY rendering.
- Tests: `_lib/customerAccountOrderHistory` unit tests (UUID parse + list count parsing), comprehensive handler tests (`handlers/customer-account-order-history.test.ts`), updated RTL `AccountPage.test.tsx`, route smoke additions, and stabilized `create-payment-intent.handler.test.ts` mocking (see Debug Log).

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/10-4-account-order-history.md`
- `handlers/_lib/customerAccountOrderHistory.ts`
- `handlers/_lib/customerAccountOrderHistory.test.ts`
- `handlers/customer-account-order-history.ts`
- `handlers/customer-account-order-history.test.ts`
- `handlers/create-payment-intent.handler.test.ts`
- `server/index.ts`
- `src/components/App/App.tsx`
- `src/order-status/CustomerOrderStatusPage.tsx`
- `src/account/AccountPage.tsx`
- `src/account/AccountPage.test.tsx`
- `src/account/AccountOrderDetailPage.tsx`
- `src/account/AccountOrderDetailPage.test.tsx`
- `src/routes.smoke.test.tsx`
- `src/order-status/customerOrderStatusWirePayload.ts`
- `src/order-status/customerOrderStatusWirePayload.test.ts`
- `src/lib/customerAccountOrderId.ts`

### Review Findings

<!-- BMAD code-review 2026-05-01 -->

- [x] [Review][Defer] Enum fallback masking for list rows — deferred post–Epic 10: unknown payment/fulfillment enums map to storefront-safe defaults to avoid breakage while MVP prioritizes parity over explicit “bad data” surfaced to shoppers—revisit badge/telemetry/strict unknown once ops wants stronger fidelity.

- [x] [Review][Patch] Story Debug Log vs actual checkout test mocks — Resolved: corrected Debug Log to reference `./_lib/verifyAdminJwt` mocking for `resolveVerifiedCustomerIdForCheckoutOrder`.

- [x] [Review][Patch] AC4 list-query authorization assertions — Resolved: list handler tests assert `.eq("customer_id", …)` plus `.limit` cap.

- [x] [Review][Patch] Bounded order-history list payloads — Resolved: `CUSTOMER_ACCOUNT_ORDER_HISTORY_LIST_LIMIT` (200) on list query + unit coverage.

- [x] [Review][Patch] Aggregate `order_items` count resilience — Resolved: tolerant numeric/string counts across array/non-array aggregate shapes.

- [x] [Review][Patch] RTL coverage gaps (AC8) — Resolved: `AccountPage` history-loading RTL + comprehensive `AccountOrderDetailPage.test.tsx`.

- [x] [Review][Patch] Duplicate strict UUID validators — Resolved: shared `CUSTOMER_ACCOUNT_ORDER_UUID_REGEX` in `src/lib/customerAccountOrderId.ts`.

- [x] [Review][Patch] Detail fetch ergonomics vs AC3/AC6 — Resolved: AbortController + `401`→`needs-auth` on `/account/orders/:id`.

- [x] [Review][Patch] Narrow smoke assertion for `/account/orders/:id` — Resolved: dedicated smoke case for **Sign in required** gate.

- [x] [Review][Patch] Detail JSON payload guardrail — Resolved: shared `parseCustomerOrderStatusWirePayload` on handler 200 responses and account detail fetch.

- [x] [Review][Defer] Sprint / epic bookkeeping in one diff [`sprint-status.yaml`](./sprint-status.yaml) — deferred, carve PR/process hygiene alongside other Epic 10 rows unless release train requires pristine separation.

- [x] [Review][Defer] `create-payment-intent.handler.test.ts` stabilization brittleness — deferred, refactoring `verifyAdminJwt` / resolver wiring may shake this suite; revisit when consolidating checkout auth helpers after Epic 10.

- [x] [Review][Defer] Automated proof of responsive non-overflow AC7 — deferred, complements Task 4 manual QA; optionally add RTL viewport/assertions later mirroring Epic 6-4 precedent.

## Change Log

- 2026-05-02 — Story created (bmad-create-story). Target: Epic 10 account order history.
- 2026-05-01 — Bearer API CORS note vs token-only status handler; reaffirm no browser `orders` reads.
- 2026-05-01 — Implemented account order history API, `/account` + detail route, UI states, handler + RTL tests, server route registration.
- 2026-05-02 — BMAD code-review patch pass: shared UUID helper + strict wire JSON parsing, capped list queries, tolerant item-count aggregates, Abort + 401-aware account detail fetching, narrowed smoke + expanded RTL/tests, Debug Log alignment with `verifyAdminJwt` mocking.
