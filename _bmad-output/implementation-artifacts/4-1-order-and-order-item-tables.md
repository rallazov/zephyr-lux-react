# Story 4.1: Order and order item tables (Supabase)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **platform** and **store operator**,
I want **`orders` and `order_items` in Postgres (Supabase)** with **enums, constraints, and RLS** aligned to the **PRD data model** and the **existing commerce domain types**,
so that **E4-S1 / PRD §14 — Epic 4**, **FR-ORD-001** (durable order + line snapshots), **FR-ORD-002** (order number shape), **FR-ORD-005** (immutable item snapshots at purchase time), **NFR-SEC-005** (RLS boundary), and downstream **[4-2](4-2-payment-events-idempotent-webhook.md) / [4-3](4-3-payment-success-order-paid.md)** (webhook → paid order) have a **real schema to write to** — **without** implementing webhook logic, full confirmation fetch, or email (**[4-2](4-2-payment-events-idempotent-webhook.md)–[4-7](sprint-status.yaml)**).

## PRD / epic anchor

- **E4-S1 (PRD §14):** Create order and order item tables.
- **PRD §12.3** — `orders` / `order_items` column list (authoritative for names and nullability).
- **Cross-cutting (epics / architecture):** `ZLX-YYYYMMDD-####` order number format; `shipping_address_json` for structured address; Stripe correlation ids on the order row.

## Acceptance Criteria

1. **Given** [PRD §12.3 — `orders` / `order_items`](../planning-artifacts/zephyr-lux-commerce-prd.md) **when** a maintainer runs **`supabase db reset`** (or applies migrations) on a **fresh** database **after** [2-5](2-5-supabase-tables-catalog-inventory.md) catalog migrations, **then** the migration(s) add **`public.orders`** and **`public.order_items`** with columns matching the PRD:  
   - `orders`: `id` PK (uuid, `gen_random_uuid()`), `order_number` **unique** not null, `customer_id` **uuid** nullable, `customer_email` not null, `customer_name` nullable, `payment_status` + `fulfillment_status` (Postgres `ENUM` types — see AC2), `subtotal_cents` / `shipping_cents` / `tax_cents` / `discount_cents` / `total_cents` integers with PRD-consistent nullability and defaults, `currency` (text, default **`usd`**, or fixed length-3; must align with [`iso4217CurrencySchema`](../../src/domain/commerce/enums.ts) normalization in app), `shipping_address_json` **jsonb** not null, `stripe_payment_intent_id` / `stripe_checkout_session_id` nullable text, `notes` nullable, `created_at` / `updated_at` `timestamptz` not null with `now()` defaults (application may set `updated_at` on update — match existing project pattern: **no** trigger required unless you add a shared `set_updated_at` for consistency).  
   - **Partial unique index (required):** **`CREATE UNIQUE INDEX … ON public.orders (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL`** so at most one order row is tied to a given PaymentIntent — **supports [4-3](4-3-payment-success-order-paid.md) AC4 / NFR-REL-001** alongside **[4-2](4-2-payment-events-idempotent-webhook.md)** event idempotency.  
   - `order_items`: `id` PK, `order_id` **FK** → `orders.id` **ON DELETE CASCADE** (or **RESTRICT** if you document why orphan line items are preferred — default **CASCADE**), `product_id` / `variant_id` uuid nullable, `sku` not null, `product_title` not null, `variant_title` nullable, `size` / `color` nullable, `quantity` int not null `> 0`, `unit_price_cents` / `total_cents` nonnegative integers not null, `image_url` nullable, `created_at` `timestamptz` not null default `now()`.

2. **Given** [NFR-MAINT-001 / FR-ORD-004 — lifecycle vocabulary](../planning-artifacts/epics.md) and the **existing** Zod source of truth, **when** defining Postgres enums, **then** `payment_status` and `fulfillment_status` **values** match **`paymentStatusSchema`** and **`fulfillmentStatusSchema`** in [`src/domain/commerce/enums.ts`](../../src/domain/commerce/enums.ts) **exactly** (same spellings, same union members). **Do not** reintroduce a single combined status column; PRD FR-ORD-004’s long list is represented across **`payment_status` + `fulfillment_status`** in the app layer — if PRD’s literal list and TS diverge, **TS + this migration** win for 4-1, and log the delta in **Dev Agent Record** as a known documentation skew.

3. **Given** [FR-ORD-002](../planning-artifacts/zephyr-lux-commerce-prd.md) and [`orderNumberSchema`](../../src/domain/commerce/order.ts) (`^ZLX-\d{8}-\d{4}$`), **when** the schema is created, **then** `order_number` has a **CHECK** constraint **or** a documented equivalent that **rejects** values outside this lexical pattern (8-digit **YYYYMMDD** and 4-digit sequence). Uniqueness is already **UNIQUE**; **per-day sequence allocation** and atomic generation are **4-3** unless you add a **non-blocking** SQL helper in 4-1 (optional).

4. **Given** [2-5](2-5-supabase-tables-catalog-inventory.md) left `inventory_movements.order_id` as **uuid without FK** **until Epic 4**, **when** `orders` exists, **then** this migration **adds** `FOREIGN KEY (order_id) REFERENCES public.orders (id)` with **`ON DELETE SET NULL`** (or **RESTRICT** with rationale in Dev Notes) so inventory rows can reference a real order. **No** `customers` table exists in repo today — `orders.customer_id` remains **uuid nullable** **without** FK in 4-1; **COMMENT** the intent to attach `REFERENCES public.customers(id)` when that table lands.

5. **Given** [NFR-SEC-005](../planning-artifacts/zephyr-lux-commerce-prd.md) **when** RLS is enabled on `orders` and `order_items`, **then** **`anon` and `authenticated` storefront users** have **no** `SELECT/INSERT/UPDATE/DELETE` that would leak PII (default **deny**; no broad read policies). **Service-role** server paths ([4-3](4-3-payment-success-order-paid.md), future read APIs) are the **expected** writers; optional **narrow** `authenticated` + claim-based admin policies are **out of scope** for 4-1 (Epic 5 will layer admin RLS) — if you add admin policies now, they **must** match the existing **JWT `app_metadata.role = 'admin'`** pattern from [2-6](2-6-admin-create-edit-product-variants.md) / `20260426220000_admin_rls_and_save_rpc.sql`, not ad-hoc rules.

6. **Given** [3-6](3-6-checkout-confirmation-cancel-failure-ui.md) and FR-PAY-002 / **FR-ORD-003** prep, **when** 4-1 ships, **then** the story **Dev Agent Record** documents that **order confirmation** still **must not** claim DB “paid” until **[4-3](4-3-payment-success-order-paid.md)** — 4-1 is **schema only**.

7. **Given** [1-5](1-5-smoke-test-or-script-clean-build-routes.md), **when** the change lands, **then** `npm run build` and `npm run smoke` **pass** (4-1 is **SQL-only** unless you add a small pure **zod/DB round-trip** test — optional; **no** live Supabase in CI required for AC7).

## Tasks / Subtasks

- [x] **Task 1 — Migration**
  - [x] New file under `supabase/migrations/` (timestamp after existing migrations), creating enums + `orders` + `order_items` + indexes (`order_items(order_id)`, **mandatory** partial unique index on `orders(stripe_payment_intent_id)` **WHERE stripe_payment_intent_id IS NOT NULL** per AC1; `orders(order_number)` already unique).
  - [x] `ALTER TABLE public.inventory_movements` → add FK to `orders.id` per AC4.
- [x] **Task 2 — RLS** — `ENABLE ROW LEVEL SECURITY` on both tables; no permissive `anon` policies; document “service role only for writes in Epic 4 webhook.”
- [x] **Task 3 — Domain alignment**
  - [x] Verify no drift: [`orderSchema` / `orderItemSchema`](../../src/domain/commerce/order.ts) vs DB column names; adjust **Zod** only if the migration exposes a **deliberate** fix (keep **strict**; coordinate with 4-3).
- [x] **Task 4 — Housekeeping** — Update [`supabase/seed.sql`](../../supabase/seed.sql) **only** if a minimal seed is needed for local `db reset` (otherwise leave empty; **do not** seed fake PII in committed seeds without a clear dev story).

## Dev Notes

### Dev Agent Guardrails

- **Scope:** **DDL + RLS + inventory FK** only. **Not** [4-2](4-2-payment-events-idempotent-webhook.md) `payment_events` / webhook edits, **not** [4-3](4-3-payment-success-order-paid.md) business logic, **not** Vercel Blob order removal, **not** `customers` / `order_events` / `shipments` tables (separate stories unless PRD explicitly merges — it does not for E4-S1).  
- **Idempotency:** **Unique** `order_number` and **partial unique on `stripe_payment_intent_id` (required)** are **data-model supports** for at most one order per PI; **durable** Stripe **event** idempotency is **[4-2](4-2-payment-events-idempotent-webhook.md)**.  
- **Single domain model:** [`src/domain/commerce/order.ts`](../../src/domain/commerce/order.ts) is the app boundary; **Postgres names** stay **`snake_case`**.

### Technical requirements

- **PRD:** §12.3 `orders` / `order_items`.  
- **FR-ORD-001, FR-ORD-005:** snapshot columns on `order_items` are **immutable** after insert (enforce in app/4-3; optional DB trigger is **out of scope** for 4-1).  
- **FR-CHK-002 / address:** `shipping_address_json` should be **round-trippable** with [`addressSchema`](../../src/domain/commerce/address.ts) when populated by server code in 4-3.

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): **RLS as boundary**; **service role** for serverless order writes; **no** service role in Vite.  
- **Supabase** migration style: follow **`20260426180000_catalog_inventory.sql`** (explicit `public.` schema, `COMMENT ON COLUMN` where helpful).  
- **Node vs Edge** — N/A for 4-1 (SQL only).

### Library / framework requirements

- **Supabase CLI / Postgres 15+** (local `supabase db reset` applies migrations).  
- **@supabase/supabase-js** — unchanged for 4-1 (no new client code **required**).

### File structure requirements

| Area | Action |
|------|--------|
| `supabase/migrations/*_orders*.sql` (or one combined epic-4-1 file) | **NEW** — `orders`, `order_items`, enums, RLS, `inventory_movements` FK |
| [`src/domain/commerce/enums.ts`](../../src/domain/commerce/enums.ts) | **REVIEW** — enum literals must **match** DB; **UPDATE** if 4-1 fixes an agreed drift |
| [`src/domain/commerce/order.ts`](../../src/domain/commerce/order.ts) | **REVIEW** only unless coordinating a **named** type export for `DbOrderRow` later |

### Testing requirements

- **Optional:** SQL assertion in a dev-only comment or a small **pgTAP**-style follow-up; minimum **AC7** = existing **build + smoke** green.  
- **No** production credentials in tests.

### Previous story intelligence

- **[2-5](2-5-supabase-tables-catalog-inventory.md):** Established **ENUM** style and deferred **`inventory_movements.order_id`** FK — **close that loop** in 4-1 (AC4).  
- **[3-6](3-6-checkout-confirmation-cancel-failure-ui.md):** UI must **not** show a fake `ZLX-…` order number until a **real** row exists; 4-1 **enables** future honest display via **[4-3](4-3-payment-success-order-paid.md)**.  
- **[4-2](4-2-payment-events-idempotent-webhook.md) / [4-3](4-3-payment-success-order-paid.md):** Already drafted — **align** `orders` columns with **`orderSchema`** and with **4-3** tasks (`stripe_payment_intent_id`, `line_items` snapshots, `order_number` generation).

### Git intelligence

- Recent commits focused on **PaymentIntent / cart quote / checkout** (`a4f8d48` and neighbors). 4-1 is **infrastructure**; avoid touching `api/*` in this story unless a **type-only** re-export is necessary.

### Latest technical notes (Postgres)

- Prefer **`timestamptz`** for all timestamps.  
- For `jsonb` **not null** with pre-payment rows, **4-3** must supply a value consistent with `addressSchema` when creating **pending** orders — if that is infeasible, document a **one-shot** follow-up to relax to nullable **in a separate review** (not default for 4-1 without PM agreement).

## References

- [PRD §12.3 — Orders](../planning-artifacts/zephyr-lux-commerce-prd.md)  
- [epics.md — Data model excerpt / FR-ORD-001..005](../planning-artifacts/epics.md)  
- [architecture.md — RLS, snapshot semantics, idempotency spine](../planning-artifacts/architecture.md)  
- [2-5 — Prior migration + `inventory_movements` note](2-5-supabase-tables-catalog-inventory.md)

## Project context reference

- No `project-context.md` file matched; rely on this story + `order.ts` + PRD.

## Story completion status

- **Status:** `done`  
- **Note:** Schema migration implemented; `npm run build` and `npm run smoke` pass (AC7). Code review patch: `allocate_order_number` daily seq guard (>9999) applied.

## Dev Agent Record

### Agent Model Used

Cursor agent (Composer)

### Debug Log References

- Supabase CLI not available in this environment; migration validated by review + `npm run smoke` (AC7). Local maintainers: run `supabase db reset` to apply.

### Completion Notes List

- Added `20260427090000_orders_and_order_items.sql`: `order_payment_status` / `order_fulfillment_status` enums **match** `enums.ts` literals (AC2); `orders` + `order_items` per PRD §12.3 with `order_number` CHECK `^ZLX-[0-9]{8}-[0-9]{4}$` (AC3), partial unique on `stripe_payment_intent_id` (AC1), monetary CHECKs, `shipping_address_json` jsonb NOT NULL, `currency` length-3, timestamps `timestamptz` with `now()` defaults.
- `inventory_movements.order_id` → `orders.id` **ON DELETE SET NULL** (AC4); `customer_id` commented for future `customers` FK; no `customers` table in 4-1.
- RLS **enabled** on `orders` and `order_items`; **no** `anon`/`authenticated` policies (default deny, AC5). Epic 4 writes expected via **service role**; admin JWT policies deferred to Epic 5 per story.
- **Zod:** `orderSchema` / `orderItemSchema` field names align with snake_case DB columns; app uses `line_items` array vs normalized `order_items` table (expected). **No Zod change** (Task 3).
- **AC6 / FR-ORD-003 / 3-6:** Order confirmation UI must **not** assert DB `paid` until **[4-3](4-3-payment-success-order-paid.md)** — this story is **schema only**.
- **FR-ORD-004 documentation skew:** PRD’s combined status list is represented in app by `payment_status` + `fulfillment_status` (`enums.ts`); PRD prose may list mixed labels — **TS + migration win** for 4-1 (per story AC2).

### File List

- `supabase/migrations/20260427090000_orders_and_order_items.sql` (new)

### Change Log

- 2026-04-26: Epic 4-1 — `orders`, `order_items`, enums, RLS, `inventory_movements` FK, indexes (partial unique on Stripe PaymentIntent).
- 2026-04-26: Code review — `allocate_order_number`: `RAISE` if daily `seq` > 9999 (avoids `lpad` truncation / duplicate `order_number` tails).

---

### Clarifications (non-blocking; save for product/docs)

- **FR-ORD-004** lists statuses that **span** payment vs fulfillment in prose; the **implemented** split is in [`enums.ts`](../../src/domain/commerce/enums.ts). Reconcile public docs in a **separate** editorial pass if needed.

### Checklist (create-story self-validation)

- [x] ACs trace to PRD / FR / NFR / prior stories.  
- [x] **UPDATE** files called out; **4-2/4-3** ordering and dependencies explicit.  
- [x] RLS and **no storefront leak** called out.  
- [x] `inventory_movements` FK from 2-5 follow-up included.

### Review Findings

- [x] [Review][Patch] Guard `allocate_order_number` for seq > 9_999 — `lpad` truncates long strings, so `n=10_000` can match `n=1_000`’s 4-digit suffix, breaking uniqueness / format [`supabase/migrations/20260427090000_orders_and_order_items.sql`]
