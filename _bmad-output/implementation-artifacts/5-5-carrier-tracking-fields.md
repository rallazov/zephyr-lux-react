# Story 5.5: Carrier and tracking fields

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

Implement after **[5-4](5-4-order-fulfillment-status-transitions.md)** (fulfillment API / server pattern). **Shipment writes must go through `api/*`** so **[5-6](5-6-customer-shipment-notification.md)** can invoke email code on the server — see AC3.

## Story

As an **owner/operator**,
I want **to record carrier name, tracking number, and tracking URL on a paid order’s shipment record** from **admin order detail**,
so that **FR-FUL-002 / FR-ADM-004 are satisfied**, **Story 5-6 can email the customer with a real tracking link**, and **Epic 7 order lookup can surface tracking** once those routes exist — without stuffing opaque blobs into unrelated tables.

## Acceptance Criteria

1. **`shipments` persistence (canonical PRD shape)**  
   **Given** [PRD §12.6 `shipments`](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** migrations run, **then** a **`shipments`** table exists with at least: `id`, `order_id` (FK → `orders`), `carrier` (nullable text), `tracking_number` (nullable text), `tracking_url` (nullable text), `status` enum as specified in PRD (`pending`, `packed`, `shipped`, `delivered`, `returned`), `shipped_at`, `delivered_at`, `created_at`, `updated_at` — aligned with [zephyr-lux-commerce-prd.md §12.6](../planning-artifacts/zephyr-lux-commerce-prd.md) and [epics.md](../planning-artifacts/epics.md) (`shipments` in proposed data model).  

2. **Order association & MVP cardinality**  
   **Given** an order may receive tracking when the operator ships, **then** enforce a clear rule in code + docs: **MVP — at most one active shipment row per order** (upsert/key on `order_id`), unless product explicitly expands to multi-parcel later. Partial updates must not orphan duplicate rows.

3. **Authorization — reads vs writes (pairs with [5-6](5-6-customer-shipment-notification.md))**  
   **Given** [5-1](./5-1-supabase-admin-auth.md) establishes admin JWT + RLS on `orders` / `order_items`, **when** `shipments` lands, **then**:  
   - **Reads:** Add **`SELECT`** RLS for **`authenticated`** admin JWT on **`public.shipments`** using the **same predicate** as catalog/order admin (`coalesce((auth.jwt()->'app_metadata'->>'role'),'')='admin'` — see [`20260426220000_admin_rls_and_save_rpc.sql`](../../supabase/migrations/20260426220000_admin_rls_and_save_rpc.sql)) so order detail can load tracking via `getSupabaseBrowserClient()`.  
   - **Writes:** **`INSERT`/`UPDATE`** on **`shipments`** must **not** be exposed as browser-only PostgREST without a server entry point — implement **`INSERT`/`UPDATE` via a Vercel handler** in [`api/`](../../api/) (e.g. **`api/admin-shipment.ts`**) that verifies the Supabase **Bearer JWT**, asserts admin (same pattern as **[5-4](5-4-order-fulfillment-status-transitions.md)**), then uses **`getSupabaseAdmin()`** (service role server-side). Optionally enforce this by **RLS that denies `INSERT`/`UPDATE` to `authenticated`** on `shipments` while allowing **`service_role`** (mirror webhook-only write boundaries).  
   - **Rationale:** **[5-6](5-6-customer-shipment-notification.md)** must call `maybeSendCustomerShipmentNotification` **only from server code** after durable writes; direct SPA writes would bypass that hook.  
   - **Do not** open `shipments` to **`anon`**. No broad **`DELETE`** unless justified.

4. **Admin UI — capture & display**  
   **Given** [UX admin flow](../planning-artifacts/ux-design-specification.md) (FulfillmentForm / order detail), **when** fulfillment work from **5-4** exposes “shipped” (or equivalent), **then** order detail exposes **labeled fields**: Carrier, Tracking number, Tracking URL, with **visible validation states** [NFR-A11Y-002] and **large touch targets** on mobile ([FR-ADM-007](../planning-artifacts/zephyr-lux-commerce-prd.md) baseline). **Carrier + number are optional in aggregate** unless product pairs 5-4 shipped transition with mandatory tracking — default: **all optional**, matching “Shipped requires **optional** carrier/tracking fields” [FR-ADM-004].  

5. **`tracking_url` semantics**  
   **Given** [FR-FUL-002](../planning-artifacts/zephyr-lux-commerce-prd.md) (“Tracking URL can be generated **or** entered manually”), **when** the owner fills carrier + tracking number **and** leaves URL blank, **then** the implementation **may** auto-fill URL from known carrier templates (document which carriers in dev notes — keep scope small: e.g. USPS/UPS/FedEx patterns) **or** leave null and rely on manual URL — choose one consistent behavior and **test it**.

6. **Domain types & boundaries**  
   **Given** [architecture](../planning-artifacts/architecture.md) (“canonical commerce domain types with zod”), **when** this story completes, **then** add **`Shipment`** (or equivalent) schema/type under [`src/domain/commerce/`](../../src/domain/commerce/) and use it wherever the admin client maps PostgREST rows — **avoid** repeating untyped shapes in JSX.

7. **Downstream compat (5-6 / 7-x)**  
   **Given** [E5-S6](../planning-artifacts/zephyr-lux-commerce-prd.md) (shipment notification) and tracking display in Epic 7, **when** persisting shipment fields, **then** document **exact column names** and **recommended read path** (Supabase query from **`shipments`** joined to `orders` by `order_id`) so **5-6** email templates can reuse **`carrier`, `tracking_number`, `tracking_url`** without refactor.

8. **Tests**  
   **Given** NFR-MAINT-003 / project Vitest usage, **when** this story completes, **then** add automated coverage appropriate to the seams you introduce: migration smoke via types or RPC tests if present; **zod schema** tests; and/or **admin save handler** tests if implemented as a pure TS module (`api/` or shared lib).

## Tasks / Subtasks

- [x] **Task 1 — Schema & RLS (AC: 1–3)**  
  - [x] New migration under `supabase/migrations/` creating `shipments` + enums/indexes/FK; **`updated_at`** trigger if used elsewhere (`orders`).  
  - [x] Unique partial index or constraint for **one row per order** per MVP rule (AC2).  
  - [x] RLS: admin **`SELECT`** on `shipments` for JWT admin role; **`INSERT`/`UPDATE`** only via **`service_role`** (deny `authenticated` writes) **or** equivalent explicit lock-down — document choice so **only** `api/` handlers mutate rows.

- [x] **Task 2 — Server API (AC: 3)**  
  - [x] Add **`api/admin-shipment.ts`** (or extend **`api/admin-order-fulfillment.ts`** if one combined endpoint is preferred — document): verify JWT + admin; upsert **`shipments`** for **`order_id`**; leave a **single documented call site** for **[5-6](5-6-customer-shipment-notification.md)** when **`fulfillment_status === 'shipped'`** (coordinate exact hook with 5-6 — typically **after** tracking persisted when transitioning to shipped, or **after** PATCH when order already shipped).

- [x] **Task 3 — Domain & mapping (AC: 6–7)**  
  - [x] Zod schemas + exported types for `Shipment` aligned to DB snake_case ↔ TS camelCase conventions already used for orders.  
  - [x] Document join/read pattern for **5-6** email module (column names + loader args).

- [x] **Task 4 — Admin UI integration (AC: 4–5)**  
  - [x] Wire fields into **`/admin/orders/:id`** fulfillment area; **save via `fetch` to `api/...`** with **`Authorization: Bearer`**, **not** raw client `.insert()` into `shipments` unless RLS explicitly allows it **and** server hook still runs (preferred: **always API**).  
  - [x] Optional URL derivation helper + unit tests.

- [x] **Task 5 — Tests (AC: 8)**  
  - [x] Minimum: schema tests + handler tests with mocked admin client; add component tests only if interaction logic warrants.

## Dev Notes

### Prerequisites (blocking)

Implement **after** foundational Epic 5 stories that establish **admin routing, order detail loading, and fulfillment transitions**:

| Story | Why it matters to 5-5 |
|-------|----------------------|
| [5-1-supabase-admin-auth.md](./5-1-supabase-admin-auth.md) | RLS patterns for **`authenticated`** admin on order-related tables |
| 5-2 admin order list | Nav to detail |
| 5-3 admin order detail | Surface to attach shipment UI |
| 5-4 fulfillment status transitions | “Shipped” context for tracking |

If earlier stories are unfinished, ship **migration + types** in this story but gate UI toggles behind the routes introduced in 5-3..5-4 to avoid orphaned screens.

### Brownfield findings

- **`shipments` is not yet in the repo** — search `supabase/migrations/` shows **no `shipments` table today**; `orders` has `fulfillment_status` only ([`20260427090000_orders_and_order_items.sql`](../../supabase/migrations/20260427090000_orders_and_order_items.sql)). **E5-S5 introduces the missing persistence** per PRD.
- **`src/domain`** has no **`Shipment`** type yet — add rather than scattering inline interfaces.

### Story boundary vs 5-4 / 5-6

- **5-4**: fulfillment **state transitions** (`orders.fulfillment_status`, `order_events` if used).  
- **5-5**: **carrier/tracking data** on `shipments`; **writes via `api/`** so **5-6** can hook server-side. Default MVP: allow saving/updating tracking only when **`orders.fulfillment_status`** is **`shipped`** (or stricter — document in handler).

- **5-6**: **customer email** — implemented in **`api/_lib`**; **invoke from the same server paths** that persist **`shipped`** and/or **`shipments`** (see **5-6** AC1).

### Technical requirements traceability

- [FR-FUL-002](../planning-artifacts/zephyr-lux-commerce-prd.md): carrier, number, URL.  
- [FR-ADM-004](../planning-artifacts/zephyr-lux-commerce-prd.md): shipped + optional carrier/tracking.  
- [UX-DR8](../planning-artifacts/zephyr-lux-commerce-prd.md) / [ux-design Fulfillment](../planning-artifacts/ux-design-specification.md): fast ops UX, mobile-first.

### Architecture compliance

- **RLS boundary** ([architecture](../planning-artifacts/architecture.md) §8): no widening `anon` access; mirror **5-1** predicates.  
- **Zod at boundaries** ([architecture](../planning-artifacts/architecture.md)): validate payload before persistence.  
- **Mobile admin** ([architecture](../planning-artifacts/architecture.md) §7): tracking row usable ~390px wide.

### File structure expectations

| Area | Paths (typical — adjust if 5-2..5-4 settled elsewhere) |
|------|--------------------------------------------------------|
| Migration | `supabase/migrations/YYYYMMDDHHMMSS_shipments.sql` |
| API | `api/admin-shipment.ts` (or merged fulfillment handler — document) |
| Domain | `src/domain/commerce/shipment.ts` (or adjacent to `order.ts`) |
| Admin UI | `src/admin/...OrderDetail...` — follow structure created in 5-3 |

### Testing expectations

- Prefer **fast unit tests** for zod + URL helper.  
- If using Supabase from the browser under RLS, avoid flaky e2e in CI unless harness exists.

### References

- PRD Epic 5 / E5-S5 — [zephyr-lux-commerce-prd.md §14](../planning-artifacts/zephyr-lux-commerce-prd.md) (`E5-S5: Add carrier/tracking number`).  
- PRD §12.6 — `shipments` columns ([zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md)).  
- [epics.md](../planning-artifacts/epics.md) — Epic 5 list + **`shipments` in proposed data model**.  
- [architecture.md](../planning-artifacts/architecture.md) — Shipment module named in component list.

## Previous story intelligence

- **[5-1-supabase-admin-auth](./5-1-supabase-admin-auth.md)** documents JWT predicate and **`orders`/`order_items`/`notification_logs` SELECT** — extend with **`shipments` SELECT-only** for browser reads; **writes via `api/`** per AC3.  
- Earlier epics (**4-x**) established **notification logging**, **inventory**, **order creation** — do **not** couple tracking saves to Stripe webhook paths; shipments are operator-driven post-payment.

### Git intelligence (recent commits)

Recent work emphasizes **typed API libs**, **`notification_logs`**, **`applyPaymentSuccess`**, **`customerOrderConfirmation`** — **no overlapping shipment code** yet; this story adds the first `shipments` persistence.

### Latest tech information

- Stay on **`zod`** already in repo (see [`package.json`](../../package.json)) — no new validation library.  
- **Supabase RLS**: **`SELECT`** from SPA for admin reads; **`INSERT`/`UPDATE`** from **`api/`** + service role per AC3 — avoid client **`upsert`** for shipment rows unless product explicitly duplicates server hooks (not recommended).

## Project context reference

Persistent `project-context.md` globs yielded **no checked-in project-context.md** in this workspace at story creation — rely on **[5-1](./5-1-supabase-admin-auth.md)** and **`zephyr-lux-commerce-prd.md`** as primary guardrails.

## Story completion status

Status: **done**  
Ultimate context engine analysis completed — comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

—

### Debug Log References

### Completion Notes List

- Implemented **`public.shipments`** + **`shipment_status`** enum migration with **unique `order_id`** (one row/order MVP), **BEFORE UPDATE** `updated_at` trigger, **`http%`-prefixed tracking_url** constraint, and **`shipments_admin_select_only`** JWT admin **`SELECT`** (no authenticated **`INSERT`/`UPDATE`** policies — **`service_role`** / **`api/`** only writes).
- Added **`POST /api/admin-shipment`** using **`verifyAdminJwt`** + **`getBearerAuthorizationHeader`**, **`getSupabaseAdmin()` upsert**, paid + **`fulfillment_status === shipped`** guards, **`normalizedTrackingUrlForDb`** (manual URL wins; else USPS/UPS/FedEx derive), **`maybeSendCustomerShipmentNotification`** after write (idem with **`customer_shipment_notification_sent_at`** versus **`admin-order-fulfillment`**).
- Domain: **`shipmentPipelineStatusSchema`**, **`shipment.ts`** / **`trackingUrl.ts`**, **`shipmentsReadPathDocs`** plus **[5-6]** read notes for **`carrier`, `tracking_number`, `tracking_url`**.
- Admin UI: **`AdminOrderDetail`** shipment form ( **`min-h`** touch targets, **`aria-invalid`**, USPS/UPS/FedEx preview hint) — saves **only via** **`fetch`** to **`/api/admin-shipment`**, no client DML into **`shipments`**.
- Vitest: **`adminShipmentPayload`**, **`shipment`/URL schemas**, **`getBearerAuthorizationHeader`**.

### File List

- `supabase/migrations/20260428180000_shipments.sql`
- `api/admin-shipment.ts`
- `api/_lib/adminShipmentPayload.ts`
- `api/_lib/verifyAdminJwt.ts`
- `api/_lib/verifyAdminJwt.header.test.ts`
- `api/_lib/adminShipmentPayload.test.ts`
- `src/domain/commerce/enums.ts`
- `src/domain/commerce/shipment.ts`
- `src/domain/commerce/shipment.test.ts`
- `src/domain/commerce/trackingUrl.ts`
- `src/domain/commerce/trackingUrl.test.ts`
- `src/domain/commerce/index.ts`
- `src/admin/AdminOrderDetail.tsx`
- `src/admin/AdminLayout.tsx`

### Change Log

- **2026-04-27:** Implemented Story 5-5 carrier/tracking persistence (migration + RLS), **`POST /api/admin-shipment`**, **`maybeSendCustomerShipmentNotification`** hook post-upsert, domain types + URL derivation, **`AdminOrderDetail`** integration and tests.

- **2026-04-27:** Code-review follow-ups: trigger syntax **`EXECUTE FUNCTION`**, stricter **`parseShipmentJsonBody`**, **`400`** payloads with **`issues`**, **`AdminOrderDetail`** field mapping.

### Review Findings

- [x] [Review][Patch] Use `EXECUTE FUNCTION` for the `updated_at` trigger (`EXECUTE PROCEDURE` is legacy trigger syntax on modern Postgres); align with Postgres 14+ / Supabase conventions — [`supabase/migrations/20260428180000_shipments.sql:53`](../../supabase/migrations/20260428180000_shipments.sql#L53). **Applied in code review (2026-04-27).**

- [x] [Review][Patch] **`parseJsonBody`** returns non-string `req.body` values verbatim; reject non-object payloads (arrays, primitives) before **`adminShipmentUpsertBodySchema`** so operators get clearer **400** semantics rather than opaque Zod failures — [`api/admin-shipment.ts:21-52`](../../api/admin-shipment.ts#L21-L52). **Applied:** `parseShipmentJsonBody` rejects non-objects, **`Buffer`** bodies, and missing bodies.** (2026-04-27).

- [x] [Review][Patch] Client shows a single **`Invalid payload`** /**`Save failed`** style message for POST validation failures — consider returning **`issues`** (or **`error`** strings) keyed by field from **`adminShipmentUpsertBodySchema`** (or documenting that operators must inspect network tab), since server already logs **`parsed.error.issues`** — [`api/admin-shipment.ts:86-95`](../../api/admin-shipment.ts#L86-L95), [`src/admin/AdminOrderDetail.tsx:474-513`](../../src/admin/AdminOrderDetail.tsx#L474-L513). **Applied:** API returns **`issues`**; **`AdminOrderDetail`** maps paths to **`aria-invalid`** field errors.** (2026-04-27).

