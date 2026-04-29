# Story 8.3: Subscription lifecycle webhooks

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[8-1](8-1-subscription-capable-products.md)** provides plan records that Stripe subscription events can map back to. **Prerequisite:** the `product_subscription_plans` migration from 8-1 must be merged and applied in target environments before 8-3 deploys; otherwise plan resolution and integration tests will fail consistently.
- **[8-2](8-2-stripe-subscription-checkout.md)** creates Checkout Sessions in `mode: "subscription"`.
- **[4-2](4-2-payment-events-idempotent-webhook.md)** and current [`api/stripe-webhook.ts`](../../api/stripe-webhook.ts) provide the Stripe signature verification and `payment_events` idempotency pattern to extend.

## Story

As a **store owner**,
I want **Stripe subscription lifecycle events captured durably in Supabase**,
so that **customer subscription state is trustworthy, retry-safe, and available for future portal/account and fulfillment flows**.

## Acceptance Criteria

1. **Webhook event coverage**  
   **Given** Stripe sends subscription-related events **when** `api/stripe-webhook.ts` receives them **then** verified events are persisted through the existing `payment_events` ledger before side effects. Handle at least `checkout.session.completed` for subscription sessions, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. Unrecognized events remain ignored/processed per the existing ledger pattern.

2. **Durable subscription state**  
   **Given** a subscription event contains a Stripe subscription/customer **when** processing succeeds **then** upsert a `customer_subscriptions` table keyed by `stripe_subscription_id`, with at least: `id`, `customer_id` nullable, `customer_email`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_latest_invoice_id`, `subscription_plan_id`, `product_id`, optional `variant_id`, `status` (`incomplete`/`trialing`/`active`/`past_due`/`canceled`/`unpaid`/`paused` or Stripe-compatible subset), `current_period_start`, `current_period_end`, `cancel_at_period_end`, `canceled_at`, `metadata`, `created_at`, `updated_at`, and **`updated_from_stripe_event_created`** (unix seconds from the Stripe **Event** object used for that upsert; required for AC 4 stale guards — see Dev Notes).

3. **Plan mapping and validation**  
   **Given** a webhook references a Stripe price or checkout metadata **when** mapping to local plans **then** resolve it to an active or historical `product_subscription_plans` row from Story 8-1. If no matching plan exists, mark the ledger failed or ignored according to recoverability and log enough correlation data (`event.id`, subscription ID, price ID) for operations without leaking secrets.

4. **Idempotency and out-of-order safety**  
   **Given** Stripe retries or sends events out of order **when** processing runs multiple times **then** no duplicate subscription rows are created, later `current_period_*` / status data is not overwritten by stale events **using the stale-event rule in Dev Notes**, and `payment_events` is marked processed only after durable subscription state is committed. Failed transient DB errors should return non-2xx so Stripe retries. Duplicate deliveries of the **same** `event.id` remain idempotent via the existing ledger (`skip_ok`).

5. **Boundary with one-time orders and inventory**  
   **Given** a subscription becomes active or an invoice is paid **when** this story processes lifecycle events **then** do not create one-time `orders`, do not insert `order_items`, and do not decrement inventory unless a separate recurring fulfillment story is added. Record subscription state only; future shipment generation remains deferred.

6. **Customer management compatibility**  
   **Given** a customer later asks to manage billing **when** the app needs a Stripe Billing Portal session **then** `customer_subscriptions.stripe_customer_id` is enough for Story 8-2/8-x portal APIs to create a portal session without searching raw webhook payloads.

7. **Testing**  
   **Given** the story is complete **when** tests run **then** add handler/lib tests for each supported event type, duplicate events, missing plan mapping, stale status handling, DB failure retry behavior, and confirmation that one-time order/inventory paths are not called.

## Tasks / Subtasks

- [x] **Task 1 - Subscription persistence (AC: 2, 6)**  
  - [x] Add a migration for `customer_subscriptions` and required enums/indexes (include `updated_from_stripe_event_created` per AC 2).
  - [x] Add RLS per **Access model** in Dev Notes: service-role writes; optional admin-role reads for admin UI; no storefront/`authenticated` read policy in this story unless an account epic explicitly adds “my subscriptions.”
  - [x] Add domain schemas/types for subscription rows and status mapping.

- [x] **Task 2 - Webhook handler extension (AC: 1, 3, 4)**  
  - [x] Factor subscription event processing into `api/_lib/` to keep `api/stripe-webhook.ts` readable.
  - [x] Reuse `claimPaymentEvent`, `markPaymentEventProcessed`, `markPaymentEventFailed`, and existing signature verification.
  - [x] Map checkout/session and subscription/invoice payloads back to local plan rows using metadata and Stripe price IDs.

- [x] **Task 3 - Lifecycle rules (AC: 4, 5)**  
  - [x] Implement stale guards exactly as **Stale vs fresh webhook events** and **Invoice vs subscription responsibilities** (including the invoice-pointer carve-out) in Dev Notes (no alternate ordering logic).
  - [x] Keep recurring invoice/order fulfillment intentionally out of scope and document the handoff.
  - [x] Ensure webhook failures return retryable status where appropriate.

- [x] **Task 4 - Portal compatibility (AC: 6)**  
  - [x] Expose a typed lookup helper for `stripe_customer_id` by subscription/customer context.
  - [x] Coordinate with any portal API introduced in 8-2.

- [x] **Task 5 - Tests (AC: 7)**  
  - [x] Add unit tests for event serializers/mappers.
  - [x] Add `api/stripe-webhook` tests for new event cases with mocked Stripe/Supabase.
  - [x] Run focused tests plus `npm run build`.

## Dev Notes

### Story intent

Stripe webhooks are the source of truth for subscription state, just as payment-intent webhooks are the source of truth for one-time paid orders. This story records subscription lifecycle state, not recurring fulfillment.

### Dev Agent Guardrails

- Do **not** bypass `payment_events`; every Stripe event still needs durable idempotency.
- Do **not** call `applyPaymentIntentSucceeded` for subscription invoices.
- Do **not** create `orders` / `order_items` or inventory movements from subscription events in this story.
- Do **not** store entire raw Stripe payloads in customer-facing tables. Keep operational metadata narrow and safe.

### Access model (RLS)

- **Writes:** `service_role` only (Stripe webhook handler and any dedicated admin/server APIs using the admin client). No `authenticated` or `anon` inserts/updates.
- **Reads (this story):** Grant **optional** read to an **admin** JWT role or equivalent used by the admin shell (e.g. Epic 8-4), consistent with other admin-only commerce tables. Do **not** add a general “customer reads own rows” policy here unless a separate account/subscriptions epic requires it—future “billing portal” flows can rely on server-side lookups by `stripe_customer_id` without exposing this table to the browser.

### Stale vs fresh webhook events (AC 4)

Use the Stripe **Event** object’s `created` field (Unix seconds, UTC) as the global ordering key for **whether** to mutate subscription snapshot fields (`status`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `canceled_at`, plan linkage fields, etc.).

1. Persist **`updated_from_stripe_event_created`** on `customer_subscriptions` after each successful mutation driven by an event.
2. When handling an event that would update those fields: let `t_in = event.created`. Read existing row’s `updated_from_stripe_event_created` as `t_prev` (null if first write).
3. **If `t_prev` is not null and `t_in < t_prev`:** do **not** overwrite snapshot fields; still **finalize** the ledger row (`markPaymentEventProcessed` / equivalent) so Stripe does not retry forever. Log at info/debug with `event.id`, `stripe_subscription_id`, `t_in`, `t_prev` for ops.
4. **If `t_in > t_prev` or `t_prev` is null:** apply the upsert and set `updated_from_stripe_event_created = t_in`.
5. **If `t_in === t_prev`** (extremely rare): treat as duplicate logical attempt; either no-op snapshot fields or merge idempotently; still finalize ledger.

Do **not** use subscription object timestamps alone for ordering across **different** webhook deliveries—different events can carry the same subscription at different times; **`event.created`** is the stable per-delivery ordering signal Stripe documents for replay/out-of-order scenarios.

### Checkout session vs subscription events (ordering)

- **Canonical subscription fields** (`status`, periods, cancel flags, items/prices) come from **`customer.subscription.created`**, **`customer.subscription.updated`**, and **`customer.subscription.deleted`** payloads (expand or retrieve subscription as needed inside the handler).
- **`checkout.session.completed`** (`mode === subscription`): use to **seed or enrich** the row—e.g. tie `stripe_customer_id`, session/subscription IDs from the session, **`customer_email`** from `customer_details` / `customer_email`, and **plan metadata** from session/`metadata` per 8-2. Upsert by `stripe_subscription_id` when `session.subscription` is present.
- Either order is allowed at Stripe’s edge: subscription hooks may arrive before or after session completion. Because **stale guards use `event.created`**, a later event always wins for conflicting snapshot fields; session completion can fill email/metadata gaps when it is the newer event, and subscription events fill lifecycle fields when newer.

### Nullable `customer_id` resolution

- **Populate `stripe_customer_id` and `customer_email`** from Stripe payloads whenever present (session or subscription paths).
- **`customer_id` (internal Supabase user/customer FK):** optional **best-effort** in this story: if a `customers` (or equivalent) row exists matching **`stripe_customer_id`**, set FK; else leave **null**. Do **not** block webhook success on profile linking failures.
- A future epic may backfill links by email or auth identity; portal flows in AC 6 remain satisfied via **`stripe_customer_id`** on the row.

### Invoice vs subscription responsibilities

- **`customer.subscription.*`:** authoritative for **`status`**, billing periods, cancel schedule, and price/plan IDs on the subscription items (map to `product_subscription_plans`).
- **`invoice.paid`:** update **`stripe_latest_invoice_id`** (and any narrow invoice pointers you add); do **not** flip subscription lifecycle **`status`** based only on invoice state. Activation/trialing/active/past_due/unpaid/canceled remain driven by subscription objects (invoice lines may inform reconciliation later, not replace status).
- **Invoice pointer vs stale guard:** `stripe_latest_invoice_id` is **not** solely governed by the global `event.created` stale rule against subscription snapshots—an `invoice.paid` webhook may legitimately arrive **after** a newer subscription event but refer to the **latest** paid invoice. When updating invoice pointers, compare Stripe **`invoice.created`** (or invoice id / number) to the stored invoice reference and set the pointer when the incoming invoice is **newer than** the stored one, regardless of `event.created` ordering versus `updated_from_stripe_event_created`. Still **never** derive **`status`** from invoice alone.
- **`invoice.payment_failed`:** record failure hints in **`metadata`** if useful; prefer **`customer.subscription.updated`** for **`past_due` / unpaid status**. Still handle `invoice.payment_failed` per AC 1 so billing ops can correlate dunning without creating orders.

### Architecture compliance

| Concern | Requirement |
|---------|-------------|
| Webhooks | Stripe signature verification and durable event ledger |
| Persistence | Supabase `customer_subscriptions` as local read model |
| Retry behavior | Non-2xx for transient failures so Stripe retries |
| Privacy | Store only needed customer/subscription identifiers |

### File structure expectations

| Action | Paths |
|--------|-------|
| New | `supabase/migrations/YYYYMMDDHHMMSS_customer_subscriptions.sql` |
| New | `api/_lib/subscriptionLifecycle.ts` and tests |
| Update | `api/stripe-webhook.ts`, `api/stripe-webhook.handler.test.ts` |
| New/update | `src/domain/commerce/subscription.ts` if not fully covered in 8-1 |

### Previous story intelligence

- **[4-2](4-2-payment-events-idempotent-webhook.md)** created the event ledger and lease behavior; reuse its semantics rather than creating a second webhook ledger.
- **[4-3](4-3-payment-success-order-paid.md)** is one-time order specific; subscription events need a separate handler.
- **[8-2](8-2-stripe-subscription-checkout.md)** should set metadata like `plan_id` and `subscription_checkout_v1` to simplify mapping here.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.5 `FR-PAY-005`, §10.1 `NFR-SEC-004`, §12 payment/customer data model, and Epic 8.
- [`epics.md`](../planning-artifacts/epics.md) subscription and Stripe Billing requirements.

## Dev Agent Record

### Agent Model Used

Composer (GPT-5.2)

### Debug Log References

—

### Completion Notes List

Implemented `customer_subscriptions` migration with `customer_subscription_status` enum, `updated_from_stripe_event_created`, invoice pointer (`stripe_latest_invoice_id` + `stripe_latest_invoice_created`) for carve-out ordering, admin SELECT RLS aligned with shipments/orders patterns. Subscription webhook paths use `api/_lib/subscriptionLifecycle.ts`: plan resolution (`metadata.plan_id`, then Stripe `price_` lookup on active/archived `product_subscription_plans`), `event.created` stale snapshots, subscription payloads for lifecycle fields + checkout-session completion for seeding (subscription retrieve + email), invoice paid/failed handlers without order/inventory. Added `getStripeCustomerIdForSubscription` for Billing Portal callers. Ledger: `finalize_ignored` when plan truly unmappable (`markPaymentEventIgnored`); Stripe subscription DB errors propagate 500 for retry.

**Out of scope (handoff):** recurring shipment/order generation from paid subscription invoices stays a future epic; webhook path does not call `applyPaymentIntentSucceeded`.

### File List

- `supabase/migrations/20260430150000_customer_subscriptions.sql`
- `api/_lib/subscriptionLifecycle.ts`
- `api/_lib/subscriptionLifecycle.test.ts`
- `api/stripe-webhook.ts`
- `api/stripe-webhook.handler.test.ts`
- `src/domain/commerce/subscription.ts`
## Change Log

- 2026-04-28 - Implemented subscription lifecycle ingestion: `customer_subscriptions` table + RLS, `subscriptionLifecycle` lib, extended `stripe-webhook`, tests (`npm run build` + full `vitest`).
- 2026-04-28 - Story created (bmad-create-story). Target: PRD E8-S3; subscription lifecycle webhook state.
- 2026-04-28 - Gaps closed for implementation: prerequisite 8-1 migration, `updated_from_stripe_event_created`, stale-event rule (`event.created`), checkout vs subscription sourcing, `customer_id` resolution, invoice vs subscription roles + invoice-pointer carve-out, RLS/access model; AC 2/4 and tasks aligned.

## Story completion status

Status: **review** — Implementation complete per AC/tasks; awaits human/`code-review` workflow.
