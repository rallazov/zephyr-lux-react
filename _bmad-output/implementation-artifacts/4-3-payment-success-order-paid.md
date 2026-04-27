# Story 4.3: Payment success — create/update order as paid

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **store operator** and **end customer**,
I want **a successful Stripe payment to result in exactly one paid order in Supabase** (the system of record),
so that **FR-ORD-001, FR-PAY-002, NFR-REL-001, PRD E4-S3, and PRD §9.5/§9.6** are satisfied and **the storefront confirmation path can show the same order the backend will fulfill**.

## Acceptance Criteria

1. **Given** **[4-1](sprint-status.yaml)** has defined **`orders` / `order_items`** in Supabase (or equivalent migration applied) and **[4-2](sprint-status.yaml)** has the **idempotent** `payment_events` ingest path (or the webhook uses the same **first-process-wins** semantics with a **durable** store — not only in-memory) **when** Stripe emits **`payment_intent.succeeded`** (and, if applicable in a future path, `checkout.session.completed`) **for a completed checkout,** **then** the handler **creates or updates** an order so that **payment and identity fields** match the event: at minimum **`payment_status` reflects `paid`**, **`stripe_payment_intent_id`** (and session id if used) is stored, and **totals and currency** are consistent with the **server-authoritative** quote rules from Epic 3 ([`api/_lib/checkoutQuote.ts`](../../api/_lib/checkoutQuote.ts) / [`api/_lib/catalog.ts`](../../api/_lib/catalog.ts)) — **not** a recomputation from client-submitted money.

2. **Given** [FR-ORD-001](../planning-artifacts/zephyr-lux-commerce-prd.md) and the [data model in PRD §12](../planning-artifacts/zephyr-lux-commerce-prd.md) and [epics.md](../planning-artifacts/epics.md) (orders / order_items), **when** the order is finalized as paid, **then** **order line items** are **snapshots** (SKU, titles, size/color, quantity, **unit and line cents**, optional image URL) so **FR-ORD-005** holds: later catalog edits do not rewrite history.

3. **Given** [FR-PAY-002](../planning-artifacts/zephyr-lux-commerce-prd.md) and [ux-design-specification.md](../planning-artifacts/ux-design-specification.md) (asynchronous truth — one coherent story between UI and “paid/fulfillment”), **when** the customer lands on order confirmation, **then** the **definitive** paid state is **reachable from the webhook-written row** (by `payment_intent` id, order number, or other documented key) — **not** only from `paymentIntent.status` in the browser.

4. **Given** [NFR-REL-001](../planning-artifacts/zephyr-lux-commerce-prd.md) and Epic 4 acceptance in [PRD §14 Epic 4](../planning-artifacts/zephyr-lux-commerce-prd.md) (“Stripe webhook creates **one** paid order for one successful payment”), **when** the same `payment_intent` or Stripe **event** is delivered **more than once**, **then** **no second order** is inserted and **no double application** of side effects that belong in **[4-4](sprint-status.yaml)** (inventory) occurs **here** — coordinate with **4-2** so idempotency keys align (`provider_event_id` / `event.id`); **[4-1](4-1-order-and-order-item-tables.md)** must ship the **partial unique index** on `orders(stripe_payment_intent_id)` so the database also rejects duplicate PI → order rows.

5. **Given** the **current** [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) and [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts) implementations, **when** this story is complete, **then** the **end-to-end contract is coherent**: either **(A)** PI **metadata** carries a **bounded, server-set** representation of **SKU + quantity** lines and correlation ids needed to build snapshots, and/or **(B)** a **`pending_payment` order** row is created **before** confirmation and the webhook **only flips** status to paid — **document the chosen contract** in Dev Notes. **Do not** leave the webhook reading **`orderId` / `itemsJSON`** that `create-payment-intent.ts` no longer sets (3-5 removed oversized metadata).

6. **Given** [NFR-SEC-002](../planning-artifacts/zephyr-lux-commerce-prd.md) and [architecture.md](../planning-artifacts/architecture.md) (RLS / trust zones), **when** writing orders from the webhook, **then** use the **Supabase service role** only inside the **serverless** handler (never in the browser) and keep **PII** out of **info** logs (use ids / event ids; follow [`api/_lib/logger.ts`](../../api/_lib/logger.ts) patterns).

7. **Given** [NFR-MAINT-003](../planning-artifacts/zephyr-lux-commerce-prd.md) (and epics NFR-MAINT-003 in [epics.md](../planning-artifacts/epics.md)), **when** the change lands, **then** add **Vitest** coverage for: idempotent “second delivery” of the same event; mapping from a **mock** `payment_intent.succeeded` payload to the **expected** `orders` / `order_items` **shape** (mock Supabase client or extract pure **mapper** functions). **No live Stripe** in CI.

## Tasks / Subtasks

- [x] **Task 0 — Unblockers (AC: 1, 4)**  
  - [x] Confirm **[4-1](sprint-status.yaml)** migrations exist for `orders` / `order_items` (and enums for payment/fulfillment as designed).  
  - [x] Confirm **[4-2](sprint-status.yaml)** persists **`payment_events`** and defines the **single** processing entry point for `payment_intent.succeeded` (or merge 4-2+4-3 in one PR with clear commits).

- [x] **Task 1 — PI ↔ webhook metadata contract (AC: 5)**  
  - [x] Decide and implement **(A) metadata lines**, **(B) pending order row** at PI creation, or **(C) hybrid**; align [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) and [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts). Respect Stripe **metadata value size limits** (500 chars per value; plan chunking or DB lookup if the cart cannot fit).  
  - [x] Remove or replace the legacy Vercel [`api/_lib/store.ts`](../../api/_lib/store.ts) `recordOrder` path for the **primary** order of record if Supabase is now authoritative (4-1/4-3).

- [x] **Task 2 — Supabase write on success (AC: 1, 2, 3, 6)**  
  - [x] On first-time processing of a successful payment event, **insert** full order + line items **or** **update** existing `pending_payment` row to **`paid`** with **snapshot** lines via catalog lookup (reuse `findVariantBySku` and related helpers in [`api/_lib/catalog.ts`](../../api/_lib/catalog.ts) or Supabase catalog access — not client JSON).  
  - [x] Set **`order_number`** per PRD format **`ZLX-YYYYMMDD-####**` (generation rules may be specified in 4-1; if not, implement atomically in DB or advisory lock).  
  - [x] Link **`orders.stripe_payment_intent_id`**; set **`fulfillment_status`** to the appropriate initial “paid/awaiting processing” per your enum.

- [x] **Task 3 — Order confirmation read path (AC: 3)**  
  - [x] Extend or add a **read API** (or direct Supabase read with RLS-safe pattern) so [`OrderConfirmation`](../../src/components/OrderConfirmation/OrderConfirmation.tsx) / [`confirmationViewModel.ts`](../../src/order-confirmation/confirmationViewModel.ts) can resolve **paid** order details from **`payment_intent` id** or **`order_number`** on refresh — at minimum document the key used in Dev Agent Record.

- [x] **Task 4 — Tests (AC: 7)**  
  - [x] Unit tests for mapper + idempotency; optional integration test with mocked Stripe event fixture.

## Dev Notes

### Dev Agent Guardrails

- **Prerequisites (hard):** This story **does not** replace **[4-1](sprint-status.yaml)** (schema) or **[4-2](sprint-status.yaml)** (durable idempotency). If those are not implemented, **implement 4-1 and 4-2 first** or in the **same** change set with a single coherent webhook module.  
- **Brownfield fact:** [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts) still references **`pi.metadata.orderId`** and **`itemsJSON`**, but **[3-5](3-5-stripe-checkout-or-payment-intent.md)** / [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) now sets **`checkoutRef`**, **`email`**, **`line_digest`**, **`stripe_intent_purpose`** only. **`line_digest` alone cannot** reconstruct SKU lines — 4-3 **must** restore a **server-trusted** line list (metadata or DB).  
- **Single source of truth:** [FR-PAY-002](../planning-artifacts/zephyr-lux-commerce-prd.md) — **webhook** confirms paid; UI success is optimistic only.  
- **Type reuse:** Align persisted shapes with [`src/domain/commerce/order.ts`](../../src/domain/commerce/order.ts) (`orderSchema`, `orderItemSchema`); do not fork competing Order types.  
- **Runtime:** Webhook must stay on **Node** (raw body + Stripe SDK) per [architecture.md](../planning-artifacts/architecture.md) (webhook Node vs Edge).  
- **Out of scope for 4-3:** **Owner/customer email** ([4-5](sprint-status.yaml), [4-6](sprint-status.yaml)), **inventory decrement** ([4-4](sprint-status.yaml)) — but **do not** duplicate those side effects; call order only what 4-3 owns (paid order persistence).

### Technical requirements

- **PRD:** E4-S3; FR-ORD-001, FR-ORD-002, FR-ORD-005; FR-PAY-002, FR-PAY-003 (idempotency coordination); NFR-REL-001; NFR-SEC-002.  
- **Stripe:** `stripe@^17.7.0` ([`package.json`](../../package.json)); events of interest: `payment_intent.succeeded` (current Payment Element path); `payment_intent.payment_failed` may update or leave order in failed/canceled as designed — **at minimum** do not mark paid.  
- **Supabase:** `@supabase/supabase-js` (already added per recent work); service role in API only.

### Architecture compliance

- **Strangler / dual files:** Remove or align [`api/stripe-webhook.js`](../../api/stripe-webhook.js) with the **TypeScript** handler so Vercel does not run stale JS.  
- **Idempotency:** All order side effects that must run **once** should be **keyed to** the **Stripe event id** (4-2) or a **unique payment_events row** before mutating `orders`.  
- **Correlations:** Log **Stripe `event.id`**, **`payment_intent` id**, and **`order.id` / `order_number`** together for [FR-AN-003](../planning-artifacts/zephyr-lux-commerce-prd.md).

### File / module expectations

| Area | Likely touch |
|------|----------------|
| Webhook | [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts), possibly split `_lib` for “apply payment success” |
| PI creation | [`api/create-payment-intent.ts`](../../api/create-payment-intent.ts) (metadata / optional `orders` insert) |
| Order domain | [`src/domain/commerce/order.ts`](../../src/domain/commerce/order.ts) (assert shapes; optional small helpers) |
| Confirmation | [`src/order-confirmation/confirmationViewModel.ts`](../../src/order-confirmation/confirmationViewModel.ts), [`src/components/OrderConfirmation/OrderConfirmation.tsx`](../../src/components/OrderConfirmation/OrderConfirmation.tsx) |
| Legacy store | [`api/_lib/store.ts`](../../api/_lib/store.ts) — deprioritize or narrow to local dev only |

### Testing requirements

- **Unit:** Pure functions that map Stripe `PaymentIntent` + catalog rows → `order_items` snapshots (money in **cents**, `number` types).  
- **Idempotency:** Assert second run with same event does not insert a second `orders` row.  
- **No secrets** in test fixtures.

### Previous story intelligence

- **[3-5](3-5-stripe-checkout-or-payment-intent.md):** Server-only totals; **bounded** metadata; **`checkoutRef`** on PI; do **not** put fake **`orderId`** in metadata until a **real** order row exists (or switch to real id from 4-1).  
- **[3-6](3-6-checkout-confirmation-cancel-failure-ui.md):** Confirmation UX and query-param contract; 4-3 should **supply data** the confirmation view can **fetch** for deep links / refresh.  
- **Story files:** [4-1-order-and-order-item-tables.md](4-1-order-and-order-item-tables.md) (schema + partial unique on PI), [4-2-payment-events-idempotent-webhook.md](4-2-payment-events-idempotent-webhook.md) (ledger + retry semantics for `failed` / locking for `received`); **PRD §12** + **[epics.md](../planning-artifacts/epics.md)** remain authoritative for column-level detail.

### Git intelligence (recent commits)

- Recent work: PaymentIntent path in TypeScript, cart quote, checkout validation (`a4f8d48` area). **Webhook + PI metadata** were **not** updated in one shot — 4-3 closes that gap.

### Latest technical notes (2026)

- **Stripe API version:** follow existing SDK usage in project; do not pin a new `apiVersion` without testing webhooks.  
- **Metadata limits:** 50 keys, 500 char values — plan for **small carts** in-metadata; **larger** carts → **DB-backed pending order** keyed by `checkoutRef` or `payment_intent` id.

### Project context reference

- No `project-context.md` found in the repo glob; primary context is [epics.md](../planning-artifacts/epics.md), [zephyr-lux-commerce-prd.md](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.5–9.6, §12, §14 Epic 4, and [architecture.md](../planning-artifacts/architecture.md).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- **Contract (AC5):** **(B) pending `pending_payment` order** — `create-payment-intent` allocates `order_number` via `allocate_order_number()`, inserts `orders` + snapshot `order_items` from `quoteCartLines` / `findVariantBySku`, creates Stripe PI with metadata `order_id` (+ existing `checkoutRef`, `line_digest`, etc.), then links `orders.stripe_payment_intent_id`. Webhook **does not** read legacy `itemsJSON` / fake `orderId`; it loads the order by PI id or `metadata.order_id`, verifies `amount_received` + currency vs persisted totals, and flips `payment_status` to `paid` with a **conditional update** (`pending_payment` only) for idempotency. **No inventory decrement** here (4-4).
- **Read path (AC3):** Paid order for confirmation uses **GET** [`api/order-by-payment-intent.ts`](../../api/order-by-payment-intent.ts) with `payment_intent_id` **and** `order_lookup` (must match `orders.order_confirmation_key`, issued once from `create-payment-intent` and held in `sessionStorage` for the PI). Not PI-id-only (NFR-SEC-002). Vitest: [`api/order-by-payment-intent.test.ts`](../../api/order-by-payment-intent.test.ts).
- **4-1 + 4-2 in repo:** Migrations [`supabase/migrations/20260427090000_orders_and_order_items.sql`](../../supabase/migrations/20260427090000_orders_and_order_items.sql) (orders, `order_items`, `allocate_order_number`, partial unique on `stripe_payment_intent_id`, RLS, `inventory_movements` → `orders` FK) and [`supabase/migrations/20260427120000_payment_events.sql`](../../supabase/migrations/20260427120000_payment_events.sql) (`payment_events`, `claim_payment_event`). Webhook requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (503 if missing).
- **Tests:** `paymentIntentOrder`, `paymentEventLedger`, `orderSnapshots`, `applyPaymentSuccess`, updated `create-payment-intent.handler` (Vitest). Removed unfinished duplicate `paymentEventsLedger` module that assumed an unimplemented `claim_payment_event` RPC.
- **Lint:** `npm run lint` still reports pre-existing issues in other files; touched files pass `tsc` + `vitest`.

### File List

- `supabase/migrations/20260427090000_orders_and_order_items.sql`
- `supabase/migrations/20260427120000_payment_events.sql`
- `api/_lib/env.ts`
- `api/_lib/supabaseAdmin.ts`
- `api/_lib/orderSnapshots.ts`
- `api/_lib/paymentIntentOrder.ts`
- `api/_lib/paymentEventLedger.ts`
- `api/_lib/applyPaymentSuccess.ts`
- `api/create-payment-intent.ts`
- `api/stripe-webhook.ts`
- `api/order-by-payment-intent.ts`
- `api/order-by-payment-intent.test.ts`
- `supabase/migrations/20260427150000_order_confirmation_key.sql`
- `api/_lib/paymentIntentOrder.test.ts`
- `api/_lib/paymentEventLedger.test.ts`
- `api/_lib/orderSnapshots.test.ts`
- `api/_lib/applyPaymentSuccess.test.ts`
- `api/create-payment-intent.handler.test.ts`
- `src/components/OrderConfirmation/OrderConfirmation.tsx`
- `.env.example`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-3-payment-success-order-paid.md`
- `api/_lib/paymentEventsLedger.ts` (deleted)
- `api/_lib/paymentEventsLedger.test.ts` (deleted)

### Change Log

- 2026-04-26 — Story 4-3: Supabase orders + payment_events, pending order at PI creation, webhook marks paid idempotently, confirmation read API + UI, Vitest coverage; bundled 4-1/4-2 schema into one migration.
- 2026-04-26 — Closed review: confirmation lookup is two-factor (PI id + `order_confirmation_key`); added `api/order-by-payment-intent.test.ts` and JSDoc; story marked **review**.

### Review Findings

- [x] [Review][Decision] Align app ledger with `claim_payment_event` (4-2) — *Resolved in tree:* `api/stripe-webhook.ts` uses `claimPaymentEvent` → `public.claim_payment_event` and handles `process` / `skip_ok` / `busy` / `error` (see `api/_lib/paymentEventLedger.ts`). Prior review text referred to the older `insertOrGet` path.

- [x] [Review][Decision] Unauthenticated `GET` order-by-PI — **Resolved for v1:** lookup requires **both** `payment_intent` / `payment_intent_id` **and** `order_lookup` (≥32 chars) matching `orders.order_confirmation_key` (random, issued in `create-payment-intent`, compared with `timingSafeEqual`). `OrderConfirmation` + `CheckoutPage` pass the key via `sessionStorage` (`zlx_pilu_{pi}`). Documented in handler JSDoc; covered by [`api/order-by-payment-intent.test.ts`](../../api/order-by-payment-intent.test.ts). Future: optional signed deep-link token if email links need read without session.

- [x] [Review][Patch] Failed link from order to PI still returns 200 — When `update` to set `orders.stripe_payment_intent_id` fails after Stripe create (`create-payment-intent.ts`, link step after PI create), the handler logs but returns success. The confirmation `fetch` and `order-by-payment-intent` query key off `stripe_payment_intent_id`; the webhook can still find the order via `metadata.order_id`, but the read path may stay 404 until the row is fixed. Prefer failing the request, retrying the update, or a reconciled read path. — *Addressed: retries, then cancel PI, delete pending order, 500; see `api/create-payment-intent.ts`.*

- [x] [Review][Patch] Local Vite and `/api` — `OrderConfirmation` uses `fetch('/api/order-by-payment-intent?…')` with no base URL. `vite.config` has no `server.proxy` for `/api`, so pure `vite` dev returns 404 for that fetch unless the user runs `vercel dev` or an equivalent. Add a dev proxy, env-based API origin, or document the required dev command. — *Addressed: `vite.config` proxy + `DEV_API_PROXY` in `.env.example`.*

- [x] [Review][Patch] Strengthen AC4/7 coverage — `paymentEventLedger.test` covers first insert and duplicate-`processed` / duplicate-`failed`. Consider a handler-level or integration test: same `event.id` after full success returns `{ duplicate: true }` and does not re-mutate `orders`. — *Addressed: `api/stripe-webhook.handler.test.ts`.*

- [x] [Review][Decision] Sprint status: epic-4 follow-on stories — This diff sets `4-4-inventory-decrement-once` … `4-7-log-notification-status` from **backlog** to **ready-for-dev** in the same edit as `4-3` → **review**. Confirm that promoting those rows now (before `4-3` is **done**) matches your process, or revert those lines until `4-3` closes. — *Resolved 2026-04-26: reviewer confirmed **keep `ready-for-dev`** (option 1).*

- [x] [Review][Patch] `sprint-status.yaml` `last_updated` regression — Timestamp went from `2026-04-26T23:59:59Z` to `2026-04-26T20:50:00Z` (backward). Update to the actual edit time (monotonic) so audit trail is trustworthy. [`_bmad-output/implementation-artifacts/sprint-status.yaml`:28] — *Addressed: `last_updated` set to `2026-04-27T00:00:00Z` (monotonic after prior max).*

- [x] [Review][Patch] Vitest: `payment_intent` query alias — Handler accepts both `payment_intent` and `payment_intent_id` (`api/order-by-payment-intent.ts`); new tests only exercise `payment_intent_id`. Add a case using `payment_intent` for parity (AC3 read path). [`api/order-by-payment-intent.test.ts`] — *Addressed: test “returns 200 when payment_intent query alias is used”.*

- [x] [Review][Patch] Vitest: `order_lookup` length boundary — Assert `401` for length 31 and success path only when length ≥32 (matches `lookupKeysEqual` / trim behavior). [`api/order-by-payment-intent.test.ts`, `api/order-by-payment-intent.ts`:37-38, :122] — *Addressed: 31-char `401` test + 32-char happy path test.*

- [x] [Review][Patch] Vitest: tighten 200 JSON assertion — Include `currency`, `payment_status`, and `payment_intent_id` in the expected payload so shape regressions fail CI (currently `expect.objectContaining` omits them). [`api/order-by-payment-intent.test.ts`] — *Addressed: assertions extended on alias + primary happy-path tests.*

- [x] [Review][Defer] JSDoc coupling to route/component names — Handler comment cites `CheckoutPage`, `OrderConfirmation`, and AC ids; harmless but can drift; fix when those files rename. — deferred, pre-existing doc pattern

- [x] [Review][Defer] Broader `order-by-payment-intent` test matrix — Optional coverage for `503` (env not configured / no admin), `500` (Supabase errors), unpaid `payment_status`, and observability of uniform `404` messages; not introduced solely by this diff slice. — deferred, pre-existing gap

## Story completion status

- **done** — Code review complete (2026-04-26); decision + patch findings resolved; Vitest extended for `order-by-payment-intent`; sprint `last_updated` corrected.

_Saved questions (optional follow-ups):_

- If **4-1/4-2** are not ready, should the team **bundle** all three in one PR, or **strictly** sequence 4-1 → 4-2 → 4-3?
- Should **`pending_payment` orders** be visible to the admin, or only **`paid`** (product decision)?
