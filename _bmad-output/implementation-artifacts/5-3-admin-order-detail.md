# Story 5.3: Admin order detail

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

Requires **[5-1](5-1-supabase-admin-auth.md)** merged first (admin **`SELECT`** RLS on **`orders`**, **`order_items`**, **`notification_logs`**). **Do not** duplicate that migration here.

## Story

As an **owner** (authenticated admin),
I want **a dedicated admin order detail page** for a single order,
so that **I can see line items, customer and shipping data, payment and fulfillment state, a basic timeline, and notes** to fulfill the order manually (FR-ADM-003, FR-FUL-001, PRD E5-S3, UX-DR2).

## Acceptance Criteria

1. **Route & access (UX-DR2, FR-ADM-001)**  
   **Given** MVP admin routes require `/admin/orders/:id` behind authentication **when** an unauthenticated user opens the URL **then** they are redirected to the existing admin sign-in flow (same pattern as `/admin/products`). **When** a signed-in user lacks `app_metadata.role === "admin"` **then** they see the existing forbidden experience (`RequireAdmin`). **When** a valid admin opens `/admin/orders/:id` **then** the order detail screen loads inside `AdminLayout` (no storefront chrome).

2. **Identity parameter**  
   **Given** orders are keyed by UUID in `public.orders.id` **when** the detail route resolves **then** `:id` is interpreted as that UUID (same convention as `/admin/products/:id`). Invalid UUID → clear error state (404-style messaging, no server leak). Unknown id → not-found state.

3. **Header & money (FR-ADM-002/003 alignment)**  
   **When** the order loads **then** the page shows at minimum: `order_number`, `created_at` (storefront/admin-local formatting), `payment_status`, `fulfillment_status`, `total_cents` + `currency`, and line-item count. Use labels consistent with domain enums in [`src/domain/commerce/enums.ts`](../../src/domain/commerce/enums.ts).

4. **Line items (FR-ADM-003, FR-ORD-005)**  
   **When** data is available **then** list every `order_items` row for the order with: SKU, product/variant titles, size, color (when present), quantity, unit price, line total (cents → display money), optional `image_url` thumbnail if present. Data is read-only in this story.

5. **Customer & shipping (FR-ADM-003, FR-FUL-001)**  
   **When** the order loads **then** show `customer_email`, `customer_name` (nullable), and **full** shipping address parsed from `shipping_address_json` using the same shape as [`src/domain/commerce/address.ts`](../../src/domain/commerce/address.ts) / `addressSchema`. **FR-FUL-001:** present address in a **copy-friendly** block (e.g. plain multi-line text or `<pre>` with sensible whitespace, optional “Copy address” control — keep minimal).

6. **Notes (FR-ADM-003)**  
   **When** `orders.notes` is non-null **then** show it in an “Internal notes” (or “Order notes”) section. **When** null **then** show empty state copy (editing notes is E5-S7 / FR-ADM-005 — out of scope here unless already populated by server).

7. **Order timeline (FR-ADM-003, pragmatic MVP)**  
   There is **no** `order_events` table in migrations yet (E5-S7 will deepen timeline + owner-authored events). **For this story**, implement a **read-only timeline** by composing:  
   - `orders.created_at` (order placed / recorded).  
   - If `payment_status === 'paid'`, a “Payment confirmed” milestone (use `updated_at` only if you cannot infer better; prefer not to lie — if needed, use copy like “Marked paid in system” tied to `payment_status`).  
   - `owner_order_paid_notified_at` when set ([`20260428120000_owner_order_paid_notification.sql`](../../supabase/migrations/20260428120000_owner_order_paid_notification.sql)).  
   - `customer_confirmation_sent_at` when set ([`20260428140000_customer_confirmation_sent_at.sql`](../../supabase/migrations/20260428140000_customer_confirmation_sent_at.sql)).  
   - Rows from `notification_logs` for this `order_id`, ordered by `created_at` ascending (template, channel, status, timestamps — no PII beyond what’s already admin-visible).  
   If no events beyond created_at, timeline still shows at least one row. **Do not** expose `payment_events` to the browser for MVP unless you add an explicit admin RLS policy and product need — ledger rows are not keyed by `order_id` today.

8. **Supabase read path & RLS (NFR-SEC-003, NFR-SEC-005)**  
   Admin **`SELECT`** on `orders`, `order_items`, and `notification_logs` is **owned by [5-1](5-1-supabase-admin-auth.md)** — verify those policies exist before merge; **do not** add a duplicate migration in this story. Baseline RLS state is described in [`20260427090000_orders_and_order_items.sql`](../../supabase/migrations/20260427090000_orders_and_order_items.sql) and [`20260428160000_notification_logs.sql`](../../supabase/migrations/20260428160000_notification_logs.sql).  
   **Preferred:** browser `getSupabaseBrowserClient()` + **5-1** policies, consistent with [`src/admin/AdminProductList.tsx`](../../src/admin/AdminProductList.tsx).  
   **Alternative** (heavier): a Vercel API that verifies JWT and uses `getSupabaseAdmin()` — only if you document why RLS reads are insufficient.

9. **Navigation (UX-DR8)**  
   Add an **Orders** nav entry in [`src/admin/AdminLayout.tsx`](../../src/admin/AdminLayout.tsx) pointing to `/admin/orders`. If E5-S2 (list) is not implemented yet, the list route may be a stub — detail must still work when linked from future list or typed URL.

10. **Testing (NFR-MAINT-003)**  
    Add coverage appropriate to what you implement: e.g. extend [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) so `/admin/orders/00000000-0000-4000-8000-000000000001` (or similar) **unauthenticated** shows sign-in (mirror `/admin/products`). If you extract pure formatters/mappers (address formatting, timeline sorting), add **Vitest** unit tests. **No live Supabase** required in CI — mock client or stub fetches where needed.

11. **Out of scope (explicit)**  
    Fulfillment status **edits** (E5-S4), carrier/tracking fields (E5-S5), shipment email (E5-S6), rich `order_events` / note authoring (E5-S7). Do not duplicate the public [`api/order-by-payment-intent.ts`](../../api/order-by-payment-intent.ts) contract (that path is **customer** confirmation with `order_lookup` secret).

## Tasks / Subtasks

- [x] **Task 1 — Verify 5-1 policies (AC: 8)**  
  - [x] Confirm **[5-1](5-1-supabase-admin-auth.md)** migration applied; no duplicate RLS migration in this story.

- [x] **Task 2 — Routing & layout (AC: 1, 2, 9)**  
  - [x] Register `/admin/orders/:id` under `RequireAdmin` in [`src/components/App/App.tsx`](../../src/components/App/App.tsx).  
  - [x] Create `AdminOrderDetail` (or equivalent) component.  
  - [x] Update `AdminLayout` nav.

- [x] **Task 3 — Data fetch & UI (AC: 3–7)**  
  - [x] Single-order select + nested `order_items`; separate query or join for `notification_logs`.  
  - [x] Format money and dates; parse `shipping_address_json` safely (zod `addressSchema` safeParse).  
  - [x] Timeline builder (deterministic sort).

- [x] **Task 4 — Tests (AC: 10)**  
  - [x] Smoke or unit tests per above.

## Dev Notes

### Dev Agent Guardrails

- **Epic / sprint order:** **[5-1](5-1-supabase-admin-auth.md)** must land before reliable reads; **[5-2](5-2-admin-order-list.md)** can ship before or after detail — the **codebase already has** Supabase admin gate (`RequireAdmin`, [`src/auth/isAdmin.ts`](../../src/auth/isAdmin.ts)). Implement detail **without blocking** on 5-2 if needed, but keep URLs compatible so the list can link `to={`/admin/orders/${id}`}` later. See [`sprint-status.yaml`](sprint-status.yaml) Epic 5 sequencing comments.  
- **Do not** use service role key in the browser (NFR-SEC-002).  
- **Reuse types:** [`src/domain/commerce/order.ts`](../../src/domain/commerce/order.ts) for mental model; UI may use narrower DTOs from Supabase rows.  
- **Accessibility:** headings, landmark sections, table semantics or list semantics for line items (NFR-A11Y).  
- **Performance:** single order — no pagination required; keep queries indexed (existing `order_items_order_id_idx`).  
- **Privacy:** admin screens should minimize exposure (NFR-PRI-003) — this page is explicitly full PII for fulfillment; do not log emails/addresses in `pino` from the client.

### Technical requirements

| Source | Requirement |
|--------|-------------|
| PRD §9.8 | FR-ADM-003 acceptance (detail fields + timeline + notes) |
| PRD §9.9 | FR-FUL-001 copy-friendly shipping |
| PRD §14 Epic 5 | E5-S3 scope |
| PRD §13 | UX-DR2 routes, UX-DR8 admin clarity |
| [`epics.md`](../planning-artifacts/epics.md) | FR inventory; data model lists `order_events` for **future** stories |

### Architecture compliance

- **Stack:** React 18 + Vite + TS + Tailwind + react-router-dom 6; Supabase JS `^2.104.1`; RLS as security boundary.  
- **Admin shell:** [`src/admin/AdminLayout.tsx`](../../src/admin/AdminLayout.tsx) — match spacing/typography of existing admin pages.  
- **Orders schema:** [`supabase/migrations/20260427090000_orders_and_order_items.sql`](../../supabase/migrations/20260427090000_orders_and_order_items.sql) — note `fulfillment_status` default `processing` at creation.  
- **Reference read pattern:** public order confirmation uses service role in API — admin detail should **not** reuse that endpoint; use authenticated Supabase reads after RLS.

### File / module expectations

| Area | Likely touch |
|------|----------------|
| Router | [`src/components/App/App.tsx`](../../src/components/App/App.tsx) |
| Admin UI | `src/admin/AdminOrderDetail.tsx` (new), [`src/admin/AdminLayout.tsx`](../../src/admin/AdminLayout.tsx) |
| DB | RLS via **5-1** only — no new read-policy migration here |
| Tests | [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx), optional `src/admin/AdminOrderDetail.test.tsx` |

### Previous story intelligence

- **Epic 5** story files live under `implementation-artifacts/`; **Epic 4** stories document webhook + order persistence patterns — see [`4-3-payment-success-order-paid.md`](4-3-payment-success-order-paid.md) for order shape and confirmation boundaries.  
- **4-1** explicitly deferred `order_events` — timeline for 5-3 must not assume that table exists.

### Git intelligence (recent patterns)

- Recent work centers on **Supabase order persistence**, **notification logs**, and **Vitest** API tests (`api/_lib/*`, `api/stripe-webhook.ts`). Follow **existing migration naming** and **RLS policy style** from catalog admin migration.

### Latest technical specifics

- **Supabase RLS:** policies use `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` — match existing catalog policies exactly to avoid drift.  
- **`@supabase/supabase-js`:** keep client usage consistent with [`src/lib/supabaseBrowser.ts`](../../src/lib/supabaseBrowser.ts).

### Project context reference

- Skill `persistent_facts` referenced `**/project-context.md` — **file not present** in repo; rely on this story + [`architecture.md`](../planning-artifacts/architecture.md) + PRD.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented `/admin/orders/:id` behind existing `RequireAdmin` + `AdminLayout`; UUID validation surfaces “Invalid order link”; unknown id → “Order not found” without leaking internals.
- Order fetch uses browser Supabase client with separate `order_items` and `notification_logs` queries; timeline composed from order timestamps + logs with deterministic sort (`adminOrderDetailFormat.ts`).
- Smoke tests: unauthenticated `/admin/orders` and `/admin/orders/<uuid>` show admin sign-in (aligned with `/admin/products`).
- `AdminOrderList.tsx`: fixed `useLatestOwnerPaidFailed` effect deps (`orderIdsKey`) for eslint `react-hooks/exhaustive-deps`.
- Verified existing migration [`supabase/migrations/20260428170000_admin_orders_notification_select_rls.sql`](../../supabase/migrations/20260428170000_admin_orders_notification_select_rls.sql) (5-1 scope); no new RLS migration added here.
- **[2026-04-27 follow-up]** Restored Story 5-3 detail sections on [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx) after later Epic 5 work had narrowed the screen to shipment-only: header totals and money, line-items table + optional thumbnails, customer/shipping with copy-friendly address block, internal notes empty state, read-only timeline (`buildOrderTimeline` + `notification_logs` + merged `order_events` for Epic 5-4 cohesion), alongside existing Story 5-5 shipment form — secondary query warnings surface as a partial-load notice instead of failing the whole page.

### File List

- `src/admin/AdminOrderDetail.tsx` (new)
- `src/admin/adminOrderDetailFormat.ts` (new)
- `src/admin/adminOrderDetailFormat.test.ts` (new)
- `src/admin/AdminLayout.tsx`
- `src/admin/AdminOrderList.tsx`
- `src/components/App/App.tsx`
- `src/routes.smoke.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/5-3-admin-order-detail.md`

### Change Log

- 2026-04-27 — Story 5-3: Admin order detail route, read-only UI (line items, customer/shipping, notes, timeline), Orders nav, formatters + tests.
- 2026-04-27 — Re-verified Epic 5-3 acceptance coverage in `AdminOrderDetail` (full detail + shipment block); regression closure doc only (no sprint status change — already `review`).

### Review Findings

- [x] [Review][Defer] Epic 5-3 AC vs merged 5-4/5-5 in `AdminOrderDetail` — **Resolved 2026-04-27:** option *defer split* (review choice **3**). Single screen keeps `order_events`, `shipments`, and `/api/admin-shipment`; realign written AC7/AC11 or extract modules in a follow-up story.

- [x] [Review][Patch] Broken `mailto` when email is placeholder — [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx): fixed 2026-04-27 via `isPlausibleOrderEmailForMailto` + plain text fallback.

- [x] [Review][Patch] Timeline sort unstable if timestamps are non-ISO / invalid — [`src/admin/adminOrderDetailFormat.ts`](../../src/admin/adminOrderDetailFormat.ts) (`compareTimelineEntries`), [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx) (`mergeFulfillmentTimeline`): fixed 2026-04-27.

- [x] [Review][Patch] Line item image `alt` is empty while product title is available — [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx): fixed 2026-04-27 (product + variant title / fallback).

- [x] [Review][Defer] Monolithic `AdminOrderDetail` (~800 LOC) mixing read-only fulfillment detail with shipment save UX — defer split/refactor unless scope contract requires separation now. [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx)

- [x] [Review][Defer] Raw Supabase/PostgREST error strings on primary load failure — acceptable MVP; map to operator-friendly copy when hardening admin error UX. [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx)

---

## Saved questions / clarifications (non-blocking)

1. If product wants `:id` to be **order_number** instead of UUID, that would be a follow-up UX change; current schema and admin product routes favor **UUID in path**.
