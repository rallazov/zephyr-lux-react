# Story 4.4: Decrement inventory exactly once (paid order)

Status: done

## Review Gate (must resolve before dev)

- **Blocked by [4-3](4-3-payment-success-order-paid.md):** 4-3 is still `in-progress` with open review findings. Do not start 4-4 until the paid-order contract is finalized.
- **Structural blocker:** the current API pricing/snapshot path reads `data/products.json`, whose variants have no UUID `id`; therefore PI-created `order_items.variant_id` is currently `null` for every line. Because `inventory_movements.variant_id` is `NOT NULL` and FKs to `product_variants(id)`, 4-4 must first resolve `sku -> public.product_variants.id` server-side (prefer a Supabase-backed API catalog resolver, or a narrow service-role SKU lookup) before any movement insert can work.
- **Retry behavior is mandatory:** the already-paid retry/backfill path in AC3 must be covered by tests, not treated as optional.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **store operator**,
I want **each paid order to reduce on-hand stock exactly once, with `inventory_movements` rows that match the order lines**,
so that **FR-PAY-003, FR-CAT-007 (MVP: paid orders create movement records), NFR-REL-002, PRD E4-S4, and PRD “duplicate webhook does not duplicate inventory movement”** are satisfied and **the catalog `inventory_quantity` stays consistent with real fulfilled demand**.

## Acceptance Criteria

1. **Given** **[4-3](4-3-payment-success-order-paid.md)** has marked an order **`paid`** from a **`payment_intent.succeeded`** path **and** `order_items` include **`variant_id`** (nullable in schema, but **must be present** for sellable lines created by the PI flow) **when** the **first** successful pass applies payment success for that Stripe `event.id` / ledger row, **then** the system **decrements** `public.product_variants.inventory_quantity` by the **line quantity** (per `order_items` row) and **inserts** one **`inventory_movements`** row per distinct decrement unit (or one row per line — document the choice) with **`reason = 'order_paid'`**, **`order_id`** referencing the order, and **`delta`** negative, consistent with [PRD §12 / epics `inventory_movements`](../planning-artifacts/epics.md).

2. **Given** [FR-PAY-003](../planning-artifacts/zephyr-lux-commerce-prd.md) and [NFR-REL-002](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** the **same** Stripe `event.id` is delivered again ( **[4-2](4-2-payment-events-idempotent-webhook.md)** `skip_ok` / duplicate) **or** the handler retries after a **full** success, **then** **no additional** `inventory_movements` rows are created and **`inventory_quantity` is not decremented again** for that order.

3. **Given** a **transient failure** after the order is **`paid` but before inventory completes** (or after partial movements), **when** Stripe retries the webhook, **then** the implementation **must still** reach a correct final state: **idempotent** application (detect missing movements and apply, or use a **single DB transaction** for “mark paid + movements + variant updates”) so stock is not permanently skipped. **Do not** rely solely on the conditional `UPDATE … WHERE payment_status = 'pending_payment'` in [`applyPaymentSuccess.ts`](../../api/_lib/applyPaymentSuccess.ts) for inventory — that path **acknowledges** “already paid” and **finishes the ledger** without re-running 4-3 side effects; **4-4** must add an **explicit** idempotency for inventory (e.g. “apply inventory if not yet applied for this `order_id` / `payment_event`”, **or** a Postgres RPC that does order + stock atomically).

4. **Given** a line references a **variant** with **insufficient** `inventory_quantity` (oversell, race, or data drift), **when** applying decrement, **then** the behavior is **defined and tested**: e.g. **fail the webhook (500)** so Stripe retries and humans can reconcile, **or** allow negative stock with a logged warning — **pick one** and document it in Dev Notes (recommend: **do not** silently clamp to zero without a record).

5. **Given** [NFR-SEC-002](../planning-artifacts/zephyr-lux-commerce-prd.md) and [architecture.md](../planning-artifacts/architecture.md), **when** updating inventory, **then** all writes use **server-side Supabase service role** (same as webhook); **no** new public/anonymousreadof movements beyond existing RLS.

6. **Given** [NFR-MAINT-003](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** the story lands, **then** add **Vitest** coverage: **pure helpers** (if any), and **at minimum** tests that simulate: **(a)** first pass applies movements and quantity changes, **(b)** second pass / already-paid order does **not** change quantities again, **(c)** retry path when order is already `paid` still completes inventory if movements were missing, and **(d)** missing/null `variant_id` cannot insert invalid `inventory_movements` rows. **No** live Stripe or Supabase in CI — mock the admin client or unit-test extracted functions.

## Tasks / Subtasks

- [x] **Task 1 — Idempotency design (AC: 2, 3)**  
  - [x] Decide: **Postgres RPC/transaction** (single round-trip) vs **sequential** Supabase calls with a **durable** “inventory applied” key (e.g. nullable column on `orders`, or a join table keyed by `payment_events.id` / `order_id` uniqueness).  
  - [x] **Patch** [`api/_lib/applyPaymentSuccess.ts`](../../api/_lib/applyPaymentSuccess.ts) **or** add `_lib/applyInventoryForPaidOrder.ts` and wire from [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts) so the “**already paid, finish ledger**” branch **still** runs **inventory backfill** if not yet applied (AC3).
  - [x] Resolve the current static-catalog gap: if `order_items.variant_id` is null, load the canonical variant by `sku` from `public.product_variants` using the service role and persist/use that UUID; do **not** attempt movement inserts with null or static JSON-only IDs.

- [x] **Task 2 — Data writes (AC: 1, 4, 5)**  
  - [x] For each `order_items` row with non-null `variant_id`, update `product_variants.inventory_quantity` and insert `inventory_movements` (`delta` negative, `reason = 'order_paid'`, `order_id` set).  
  - [x] If schema needs a **unique** guard to prevent duplicate `(order_id, …)` movement rows, add a **migration** under `supabase/migrations/` (timestamp after existing) — keep compatible with [2-5 `inventory_movements`](../../supabase/migrations/20260426180000_catalog_inventory.sql) and [4-1 orders + FK](../../supabase/migrations/20260427090000_orders_and_order_items.sql).  
  - [x] Document oversell **policy** (AC4).

- [x] **Task 3 — Tests (AC: 6)**  
  - [x] Unit tests in `api/_lib/*.test.ts` following [`applyPaymentSuccess.test.ts`](../../api/_lib/applyPaymentSuccess.test.ts) patterns.  
  - [x] Ensure `npm test` (or project script) passes for touched files.

## Dev Notes

### Dev Agent Guardrails

- **Prerequisites:** **[4-1](4-1-order-and-order-item-tables.md)** (`orders` / `order_items`), **[4-2](4-2-payment-events-idempotent-webhook.md)** (`claim_payment_event`), **[4-3](4-3-payment-success-order-paid.md)** (order flips to `paid`). **Do not** reimplement order creation; extend the **post-payment** path only.  
- **Explicitly out of scope:** Owner/customer email (**[4-5](sprint-status.yaml)**, **[4-6](sprint-status.yaml)**), **manual** adjustment UI (FR-CAT-007 admin history is **later**; this story is **order_paid** movements only).  
- **Single writer:** Remain in the **Node** webhook path (raw body + Stripe) — [architecture.md](../planning-artifacts/architecture.md).  
- **Code pointer:** `applyPaymentIntentSucceeded` today states it **does not touch inventory** — 4-4 **implements** that responsibility while preserving 4-3’s payment semantics.

### Technical requirements

- **PRD / epics:** E4-S4; FR-PAY-003; [epics.md](../planning-artifacts/epics.md) — *“Inventory decrement must happen inside the same transaction/operation as order creation, keyed to `payment_events.provider_event_id` to prevent double-decrement”* — interpret **operation** as: **one idempotent business operation per successful payment event**, either **one DB transaction** or **an application idempotency key** tied to the **order** and/or **payment event** so retries are safe.  
- **Enums:** `public.inventory_movement_reason` already includes **`order_paid`** ([`20260426180000_catalog_inventory.sql`](../../supabase/migrations/20260426180000_catalog_inventory.sql)).  
- **RLS:** Service role **bypasses** RLS; consistent with 4-1/4-3.

### Architecture compliance

- **No** Supabase service role in the browser.  
- **Logging:** [FR-AN-003](../planning-artifacts/zephyr-lux-commerce-prd.md) — correlate **`event.id`**, `payment_intent` id, `order.id` / `order_number`, and **variant ids**; **no** PII in info logs (use [`api/_lib/logger.ts`](../../api/_lib/logger.ts)).

### Library / framework requirements

- **@supabase/supabase-js** — existing `getSupabaseAdmin` ([`api/_lib/supabaseAdmin.ts`](../../api/_lib/supabaseAdmin.ts)).  
- **Vitest** — existing test stack.

### File structure requirements

| Area | Likely touch |
|------|----------------|
| Payment success / inventory | [`api/_lib/applyPaymentSuccess.ts`](../../api/_lib/applyPaymentSuccess.ts), new `_lib/applyInventory*.ts` if split for clarity |
| Webhook | [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts) — only if orchestration changes |
| Migrations | `supabase/migrations/*` if unique constraints / RPC added |
| Tests | `api/_lib/*.test.ts` |

### Testing requirements

- Mock Supabase **or** unit-test **pure** reducers (line items → movement rows + quantity deltas).  
- Cover **duplicate** and **retry-after-paid** scenarios (AC2–3).

### Previous story intelligence

- **[4-3](4-3-payment-success-order-paid.md):** **Pending order at PI** + conditional update `pending_payment` → `paid`; read path `api/order-by-payment-intent`. Completion notes confirm **no inventory in 4-3** — 4-4 **must** add it. The **“already paid → markPaymentEventProcessed”** branch in `applyPaymentIntentSucceeded` is **necessary** for idempotent payment **status**; inventory **must not** be wedged only in the `updatedRows.length > 0` branch.

### Git intelligence (recent work)

- Recent commits: payment + Supabase integration (`c2f871d`, `a4f8d48`) — follow existing **TypeScript** API layout and **Vitest** patterns in `api/_lib/`.

### Latest technical notes (2026)

- Supabase **JS client** does not offer multi-statement transactions across arbitrary calls from serverless; **prefer** a **Postgres function** for atomicity if you need strict “all or nothing” between `orders`, `order_items` joins, `product_variants`, and `inventory_movements` — or document **compensating** idempotent design if staying JS-only.

### Project context reference

- No `project-context.md` found; use this file + [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.5 / §12 / §14 Epic 4.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented **`public.apply_order_paid_inventory(p_order_id uuid)`** (security definer, service_role): locks order, requires `payment_status = paid`, for each `order_item` skips if a movement with that `order_item_id` + `order_paid` exists, resolves `variant_id` via `product_variants.sku` when null (backfills `order_items.variant_id`), rejects insufficient stock, decrements `product_variants.inventory_quantity`, inserts movements (`delta` negative).
- **Oversell (AC4):** insufficient on-hand stock raises from the RPC; webhook gets **500** / retry until stock or data is fixed.
- **Movement granularity:** one movement row per **`order_items` line**, idempotent via **`order_item_id`** + partial unique index (`order_paid`).
- **`applyPaymentIntentSucceeded`** calls **`applyInventoryForPaidOrder`** (RPC wrapper) **before** `markPaymentEventProcessed` on both the fresh paid transition and the **already paid** branch so webhook retries complete inventory (AC3).
- Vitest: inventory success path, inventory failure → retry without ledger finalize, already-paid → inventory + ledger; RPC wrapper success/failure.

### File List

- `supabase/migrations/20260427180000_apply_order_paid_inventory.sql`
- `api/_lib/applyInventoryForPaidOrder.ts`
- `api/_lib/applyInventoryForPaidOrder.test.ts`
- `api/_lib/applyPaymentSuccess.ts`
- `api/_lib/applyPaymentSuccess.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-4-inventory-decrement-once.md`

### Change Log

- 2026-04-26: Story 4-4 — Postgres RPC for idempotent paid-order inventory; wire payment success path; tests; sprint/story status → review.
- 2026-04-26: Code review — patch webhook retry messaging (`api/stripe-webhook.ts` + test); story → done.

### Review Findings

- [x] [Review][Blocker] Static catalog variants have no UUID ids, so current PI-created `order_items.variant_id` is null for every sellable line. 4-4 must add a Supabase SKU-to-variant resolver or depend on a prerequisite API catalog switch to Supabase before inventory movements can be written.
- [x] [Review][Patch] Retry-after-paid inventory backfill is not optional. Make the already-paid branch run/verify inventory application and add a required Vitest case for missing movements on retry.
- [x] [Review][Sequence] Do not start until 4-3's paid-order review findings are resolved and its status no longer leaves the order/payment contract in flux.
- [x] [Review][Patch] Webhook nack log says “order not marked paid” for any `applyPaymentIntentSucceeded` retry — misleading when the order is already `paid` but inventory RPC failed (ops should see inventory/transient vs payment). [`api/stripe-webhook.ts` ~94–98]

## Story completion status

- **done** — Code review complete; webhook retry log/response aligned with inventory + ledger paths (2026-04-26).

_Questions saved for product/engineering (optional):_

- Should **insufficient stock** at decrement time **block** fulfillment workflow (500 + alert) or **allow negative** with a flag for ops?
