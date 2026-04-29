# Story 8.1: Subscription-capable products

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Dependencies

- **Epic 2 catalog/admin product work is complete:** subscription plans should attach to the canonical Supabase `products` / `product_variants` model and the existing admin product form, not resurrect static JSON as a source of truth.
- **Epic 3/4 one-time checkout and order persistence are complete:** this story must keep one-time SKUs, cart pricing, `orders`, `order_items`, and inventory decrement behavior unchanged.
- **Stories [8-2](8-2-stripe-subscription-checkout.md) and [8-3](8-3-subscription-lifecycle-webhooks.md) consume this model:** define enough Stripe Billing identifiers and status fields here so subscription checkout/webhooks do not need to redesign product data.

## Story

As a **store owner**,
I want **to mark selected products or variants as subscription-capable with explicit Stripe Billing plan metadata**,
so that **repeat-purchase subscriptions can launch without rewriting the one-time catalog, cart, or order system**.

## Acceptance Criteria

1. **Subscription plan persistence**  
   **Given** the canonical catalog lives in Supabase **when** migrations run **then** a dedicated subscription-plan table exists (`product_subscription_plans`) with at least: `id` (uuid, PK), `product_id` (FK → `products`), optional `variant_id` (FK → `product_variants`, nullable), **`slug`** (stable human-facing key per product; **canonical**—do not add a separate `code` column), `name`, `description` (nullable), `stripe_product_id` (nullable for drafts), `stripe_price_id` (nullable for drafts), `interval` (enum or check: `day` / `week` / `month` / `year`), `interval_count` (int ≥ 1), `price_cents` (int ≥ 0, informational mirror of Stripe; server checkout still loads from Stripe/DB row, not client), `currency` (ISO 4217, aligned with existing catalog usage), `trial_period_days` (nullable non-negative int; null means no trial), `status` (`draft` / `active` / `archived`), `created_at`, `updated_at`. Enforce FK integrity to `products` / `product_variants`. Enforce **partial unique** constraints for **active** rows per **Specification details** below—not naive global UNIQUE on `slug` or `stripe_price_id`.

2. **Separate from one-time product pricing and inventory**  
   **Given** a product has one-time variants **when** subscription metadata is added **then** existing `product_variants.price_cents`, inventory, cart line keys, and checkout quote math remain untouched. Do not overload one-time `sku` or `order_items` fields to mean subscription cadence. Subscribe-and-save products are modeled separately from one-time products per **FR-PAY-005**.

3. **Domain types and read model**  
   **Given** frontend/admin code reads plan rows **when** mapping DB records **then** add Zod schemas/types under `src/domain/commerce/` for subscription plan rows and client-friendly view models. Validate interval, currency, positive interval count, non-negative price, allowed status, and nullable trial. Export through [`src/domain/commerce/index.ts`](../../src/domain/commerce/index.ts) alongside existing modules.

4. **Admin product configuration**  
   **Given** the owner edits a product or variant in `/admin/products` **when** subscription fields are enabled **then** the admin UI supports creating/updating/archiving subscription plans with labeled fields, visible validation states, and mobile-friendly controls. Writes must use an authenticated admin-safe RPC (preferred: same transactional pattern as catalog) and/or `api/*` handler with server-side validation; RLS must mirror existing catalog admin policies—see **Specification details**.

5. **Storefront availability contract**  
   **Given** a plan is `active` and has a non-null `stripe_price_id` **when** catalog/PDP code asks for subscription availability **then** the read helper returns purchasable subscription options for that product/variant. Plans missing `stripe_price_id` or not `active` must not appear as purchasable options. This story may show a non-purchasing storefront signal only; **no** working subscription checkout path (that is **8-2**).

6. **Security and environment boundaries**  
   **Given** Stripe IDs are stored with catalog data **when** rendered in the browser **then** `stripe_price_id` may be displayed or held as an identifier but must **not** be trusted from the client in checkout APIs (**8-2** will accept `plan_id` only and look up the price server-side). Stripe secret keys and service role keys remain server-only. Document any new env vars in `.env.example` / README-style env docs if added.

7. **Testing**  
   **Given** the story is complete **when** tests run **then** add focused coverage for subscription plan Zod schemas, admin validation/mapping, and the plan availability helper. CI does not need to execute migrations if: (a) migration SQL is reviewed in PR for partial uniques, FKs, and RLS alignment, and (b) at least one **typed fixture test** or schema test asserts the expected row shape matches what the migration defines (drift guard).

## Specification details (finalized)

### Identifier and naming

- Use **`slug` only** (no parallel `code` column). If operators need an internal code, store it in `slug` or `description`.
- **Stripe Billing subscription** (this epic) ≠ **newsletter** [`SubscriptionForm`](../../src/components/SubscriptionForm/SubscriptionForm.tsx). UI copy and variable names in new work should say “billing plan” / “subscribe & save” where ambiguity would confuse QA.

### Multiple active plans

- **Allow more than one `active` plan** per `product_id` (and per `variant_id` when scoped to a variant)—e.g. monthly vs bi-monthly. Do not add a partial unique on `(product_id, variant_id)` alone unless product policy later requires a single active plan.

### Partial unique indexes (active rows only)

Define **partial** unique indexes so `draft` / `archived` rows do not block reuse:

| Constraint | Rule |
|------------|------|
| Slug per product | Unique `(product_id, slug)` where `status = 'active'` (case normalization: store slugs lowercase and validate in Zod, or use a unique index on `(product_id, lower(slug))` where active—pick one approach and apply consistently in app validation). |
| Stripe price | Unique `(stripe_price_id)` where `status = 'active'` and `stripe_price_id is not null` (global: one active local row per Stripe price). |

### RLS and writes (mirror catalog admin)

- Reference existing catalog admin policies in [`supabase/migrations/20260426220000_admin_rls_and_save_rpc.sql`](../../supabase/migrations/20260426220000_admin_rls_and_save_rpc.sql): authenticated + `coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'`.
- Add `FOR ALL` policies for `product_subscription_plans` consistent with `catalog_admin_all_products` / `catalog_admin_all_variants` (same predicate).
- **Writes:** Prefer extending **`admin_save_product_bundle`** with an optional `subscription_plans` JSON array so product + variants + plans save in one transaction; alternatively add `admin_save_product_subscription_plans(product_id, …)` and call it from the same admin save flow. Avoid granting broad `INSERT`/`UPDATE` to `anon`.

### Lifecycle and webhooks (8-3)

- Prefer **`status = archived`** over hard deletes for rows that may need to match historical Stripe events.
- **8-3** may resolve prices to archived rows; storefront rule (AC 5) remains: only `active` + `stripe_price_id` are purchasable.

## Tasks / Subtasks

- [x] **Task 1 - Schema and RLS (AC: 1, 2, 6)**  
  - [x] Add migration `supabase/migrations/YYYYMMDDHHMMSS_product_subscription_plans.sql`: table, interval/status enums or checks, FKs, indexes for `(product_id)`, `(variant_id)` where non-null, **partial uniques** per Specification details.
  - [x] Enable RLS; policies matching `20260426220000_admin_rls_and_save_rpc.sql` admin JWT predicate.
  - [x] Implement admin write path: extend `admin_save_product_bundle` **or** new RPC + wire from admin UI; no anon DML.

- [x] **Task 2 - Domain model (AC: 3)**  
  - [x] Add `src/domain/commerce/subscription.ts` with row schema, form/input schema, types, row → view-model mapping; slug lowercase rule aligned with DB.
  - [x] Export from `src/domain/commerce/index.ts`.
  - [x] Add tests: intervals, statuses, currency, optional `variant_id`, invalid Stripe ID shapes, trial bounds.

- [x] **Task 3 - Admin product integration (AC: 4)**  
  - [x] Extend [`src/admin/AdminProductForm.tsx`](../../src/admin/AdminProductForm.tsx) or adjacent component for plan CRUD + archive.
  - [x] Preserve existing product/variant save and image handling.
  - [x] Block transitioning to `active` unless `name`, `price_cents`, `interval`, `interval_count`, `currency`, and `stripe_price_id` are present and valid.

- [x] **Task 4 - Storefront read helper (AC: 5)**  
  - [x] Helper: active plans with `stripe_price_id` for a product/variant; must not mutate cart pricing.
  - [x] Optional: restrained PDP “available as subscription” copy; no checkout CTA to Stripe subscription (**8-2**).

- [x] **Task 5 - Tests/docs (AC: 6, 7)**  
  - [x] Schema + helper tests; admin validation tests where feasible.
  - [x] PR checklist: migration SQL reviewed; fixture/shape test passes.
  - [x] Document Stripe Product/Price creation and local seed if applicable.

### Review Findings

- [x] [Review][Patch] `admin_save_product_bundle` does not validate Stripe Billing id shapes (`price_…` / `prod_…`) for subscription plans — only non-empty `stripe_price_id` when `active`. A caller with admin JWT could persist malformed ids that pass DB checks; align RPC with `stripeBillingPriceIdSchema` / `stripeBillingProductIdSchema` (or add `CHECK` constraints mirroring those patterns). [`supabase/migrations/20260428104600_extend_admin_save_product_bundle_subscription_plans.sql`] — **fixed 2026-04-28:** RPC `~` checks mirror client Zod.

- [x] [Review][Patch] Subscribe & save panel copy states active plans need “Stripe product/price ids” but `adminSubscriptionPlanRowSchema` only requires `stripe_price_id` (and name) for `active`; `stripe_product_id` remains optional. Tighten copy or require product id when active — pick one for operator clarity. [`src/admin/AdminProductForm.tsx`] — **fixed 2026-04-28:** copy matches optional `prod_` / required `price_` for active.

- [x] [Review][Defer] `sprint-status.yaml` in the same diff advances multiple Epic 8 rows (8-2, 8-3, 8-4, etc.), not story 8-1 alone — deferred, pre-existing branch hygiene. [`_bmad-output/implementation-artifacts/sprint-status.yaml`]

- [x] [Review][Defer] `.env.example` adds a Story **8-4** PWA/service-worker comment unrelated to subscription-capable products — deferred, pre-existing mixed-epic commit. [`.env.example`]

- [x] [Review][Defer] `src/domain/commerce/index.ts` re-exports `shipmentImage` in the same change as subscription exports (cross-story surface area) — deferred, pre-existing; consider splitting PRs later. [`src/domain/commerce/index.ts`]

## Dev Notes

### Story intent

Data-model bridge between today’s one-time catalog and Stripe Billing. Keep subscription plans beside `products` / `product_variants`, not inside cart/order semantics.

### Dev Agent Guardrails

- Do **not** change one-time checkout math in `api/_lib/catalog.ts`, `api/create-payment-intent.ts`, `src/cart/checkoutLines.ts`, or the existing cart storage key.
- Do **not** decrement inventory for subscription plan creation or edits.
- Do **not** store Stripe secret keys, webhook secrets, or service-role credentials in frontend-accessible env vars.
- Do **not** launch a customer subscription purchase flow in this story.

### Architecture compliance

| Concern | Requirement |
|---------|-------------|
| Data model | Supabase is source of truth for catalog and subscription plans |
| Validation | Zod in `src/domain/commerce/` |
| Security | Admin-only writes; no service role in browser |
| Stripe | Store Billing product/price IDs; checkout in **8-2** |

### File structure expectations

| Action | Paths |
|--------|-------|
| New | `supabase/migrations/YYYYMMDDHHMMSS_product_subscription_plans.sql` |
| New | `src/domain/commerce/subscription.ts` and tests |
| Update | `src/domain/commerce/index.ts`, `src/admin/AdminProductForm.tsx`, optional `admin_save_product_bundle` / new RPC in migrations |
| Optional | Product/PDP read path for availability only |

### Previous story intelligence

- **[2-6](2-6-admin-create-edit-product-variants.md)** — admin product editing; extend that UX.
- **[3-3](3-3-checkout-line-items-sku-quantity.md)** / **[3-4](3-4-server-subtotal-from-catalog.md)** — preserve server-trusted pricing for one-time; **8-2** will do the same for plans via `plan_id`.
- **[4-4](4-4-inventory-decrement-once.md)** — inventory only on paid one-time orders.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) §5.2, §5.3, §9.5 `FR-PAY-005`, Epic 8.
- [`epics.md`](../planning-artifacts/epics.md) `FR-PAY-005`.
- [`architecture.md`](../planning-artifacts/architecture.md) Supabase/Stripe boundaries.

## Dev Agent Record

### Agent Model Used

Coding agent.

### Debug Log References

—

### Completion Notes List

Delivered Epic 8 story **8.1** end-to-end: Supabase **`product_subscription_plans`** DDL with partial uniques (`active` slug per product lowercase, active Stripe price), admin-aligned RLS, storefront read policy, **`updated_at`** trigger, and **`admin_save_product_bundle`** extension with **`subscription_plans`** JSON synced in-transaction.

Client: **`subscriptionPlansPurchasableFromEmbed`** storefront helper + stricter **`subscriptionPlanRowSchema`** (Stripe Billing id prefixes, underscore-safe); **`AdminProductForm`** “Subscribe & save” billing-plan panel with **`adminSubscriptionPlanRowSchema`** and RPC payload mapping; **`supabase-map`** delegates purchasable mapping to domain helper.

Docs: Stripe Product/Price ids documented as living in **`product_subscription_plans`** via admin (**.env.example**). Full **`npm run test`** (**387 tests**) passing.

Regressed **`api/_lib/subscriptionLifecycle.test.ts`** fixture UUIDs once **`subscriptionPlanRowSchema`** tightened (strict RFC UUID parsing).

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `supabase/migrations/20260428104500_product_subscription_plans.sql`
- `supabase/migrations/20260428104600_extend_admin_save_product_bundle_subscription_plans.sql`
- `src/domain/commerce/subscription.ts`
- `src/domain/commerce/subscription.test.ts`
- `api/_lib/subscriptionLifecycle.test.ts` (fixture UUIDs aligned with strict Zod so `subscriptionPlanRowSchema` parses in mocks)
- `src/catalog/supabase-map.ts`
- `src/admin/validation.ts`
- `src/admin/AdminProductForm.tsx`
- `.env.example`
- `_bmad-output/implementation-artifacts/8-1-subscription-capable-products.md`

## Change Log

- 2026-04-28 — Story created (bmad-create-story). Target: PRD E8-S1.
- 2026-04-28 — **Spec finalized:** canonical `slug` (no `code`); partial uniques; multi-active-plan policy; RLS/RPC pointers to `20260426220000_admin_rls_and_save_rpc.sql`; newsletter vs Billing disambiguation; AC7 drift guard; `admin_save_product_bundle` extension preference; soft lifecycle via `archived`.
- 2026-04-28 — **Implemented:** schema + RPC + domain + admin UI + tests (.env.example note).
- 2026-04-28 — **Code review:** RPC validates `prod_`/`price_` shapes; admin subscribe & save blurb aligned with Zod (price required when active, product optional).

## Story completion status

- **Specification:** finalized.
- **Implementation:** complete — story Status **done**; sprint **`8-1-subscription-capable-products`** **`done`** (after code-review patches).
