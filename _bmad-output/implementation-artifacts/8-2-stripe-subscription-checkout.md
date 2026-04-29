# Story 8.2: Stripe subscription checkout

Status: done

## Dependencies

- **[8-1](8-1-subscription-capable-products.md)** provides active subscription plans and server-trusted `stripe_price_id` values (migration + catalog embed implemented here as required by checkout).
- **Epic 3 one-time checkout is complete:** subscription checkout is a separate Stripe Billing path and does not regress `PaymentIntent` checkout.
- **[8-3](8-3-subscription-lifecycle-webhooks.md)** will make subscription lifecycle durable after Stripe redirects/webhooks.

## Story

As a **customer interested in repeat deliveries**,
I want **to start a Stripe-hosted subscription checkout for an eligible Zephyr Lux product**,
so that **I can subscribe securely without the site handling raw payment credentials or rewriting the one-time checkout flow**.

## Acceptance Criteria

1. **Subscription purchase surface**  
   **Given** a product or variant has an active subscription plan from Story 8-1 **when** the customer views the product detail or `/subscriptions` route **then** the UI offers a clear subscription option with cadence and price. The subscription CTA must be disabled/hidden for inactive plans, plans missing `stripe_price_id`, out-of-scope variants, or unavailable products. Keep one-time Add to Cart behavior unchanged.

2. **Server-created Stripe Checkout Session**  
   **Given** a customer submits a subscription checkout request **when** the API receives it **then** `POST /api/create-subscription-checkout-session` validates a minimal payload such as `{ plan_id, email, customer_name?, shipping_address? }`, looks up the plan server-side in Supabase, and creates a Stripe Checkout Session with `mode: "subscription"` and `line_items` using the stored `stripe_price_id`. The client must not submit raw prices or arbitrary Stripe price IDs.

3. **Stripe Billing and PCI-light boundary**  
   **Given** payment details are required **when** checkout starts **then** use Stripe-hosted Checkout or Stripe-controlled Billing components only. Do not collect card numbers in the app. Use server-only `STRIPE_SECRET_KEY`, keep `STRIPE_WEBHOOK_SECRET` unchanged, and do not expose Supabase service role keys in browser code.

4. **Redirect and pending-state UX**  
   **Given** Stripe redirects back to the site **when** checkout completes or is canceled **then** route to a subscription confirmation/cancel surface that explains the status neutrally. On success, say the subscription is being confirmed and email/portal access will follow; do not mark it active from the redirect alone. The URL should not expose sensitive customer data.

5. **Customer management portal foundation**  
   **Given** Stripe Billing owns subscription management **when** an authenticated or tokenized customer management path exists **then** provide a server helper or API shape for creating a Stripe Billing Portal session from a known `stripe_customer_id`. If no durable subscription row exists until 8-3, keep the portal UI hidden or gated, but make the server contract explicit and tested enough for 8-3 to connect.

6. **No one-time order side effects**  
   **Given** a subscription checkout session is created **when** the API succeeds **then** do not insert a one-time `orders` row, do not insert `order_items`, and do not decrement inventory. Any recurring fulfillment/order-generation policy is deferred until product explicitly defines how subscriptions ship.

7. **Testing**  
   **Given** the story is complete **when** tests run **then** cover API validation, server-side plan lookup, Stripe Checkout Session parameters, rejection of inactive/missing-price plans, redirect URL construction, and no mutation of one-time order paths. Add component tests for the subscription CTA states if UI is added.

## Tasks / Subtasks

- [x] **Task 1 - Customer subscription UI (AC: 1, 4)** — `PdpSubscriptionBlock`, `SubscriptionsPage`, success/canceled pages, Footer + routes.
- [x] **Task 2 - Checkout Session API (AC: 2, 3, 6)** — `api/create-subscription-checkout-session.ts`, `_lib/subscriptionCheckoutBody.ts`, `_lib/subscriptionPlanCheckout.ts`, Zod validation, Stripe idempotency, metadata `subscription_checkout_v1` + plan/product/variant refs.
- [x] **Task 3 - Billing Portal contract (AC: 5)** — `api/create-billing-portal-session.ts`; no storefront UI until 8-3 provides `stripe_customer_id`.
- [x] **Task 4 - Routes and redirect handling (AC: 4)** — `/subscription/checkout/success|canceled`; success URL query `checkout=done` avoids PII (no Stripe session placeholder in SPA copy headline).
- [x] **Task 5 - Tests (AC: 7)** — Handler tests (`api/create-subscription-checkout-session.test.ts`, `create-billing-portal-session.test.ts`), domain/catalog tests, smoke routes.

## Dev Agent Record

### Agent Model Used

Composer (GPT-5.2)

### Completion Notes List

- Implemented `product_subscription_plans` migration (also satisfies Story **8-1** schema prerequisites for Stripe price linkage).
- Supabase catalog embed surfaces `subscriptionPlans` without exposing `stripe_price_id` to the client; checkout validates `plan_id` only.
- One-time PaymentIntent/order paths unchanged.

### File List

- `supabase/migrations/20260428104500_product_subscription_plans.sql`
- `api/create-subscription-checkout-session.ts`
- `api/create-subscription-checkout-session.test.ts`
- `api/create-billing-portal-session.ts`
- `api/create-billing-portal-session.test.ts`
- `api/_lib/subscriptionCheckoutBody.ts`
- `api/_lib/subscriptionPlanCheckout.ts`
- `src/domain/commerce/subscription.ts`
- `src/domain/commerce/subscription.test.ts`
- `src/domain/commerce/index.ts`
- `src/catalog/types.ts`, `src/catalog/parse.ts`, `src/catalog/adapter.ts`, `src/catalog/supabase-map.ts`, `src/catalog/supabase-map.test.ts`
- `src/components/subscription/PdpSubscriptionBlock.tsx`
- `src/components/ProductDetail/ProductDetail.tsx`
- `src/components/ProductDetail/ProductDetail.gallery.test.tsx`
- `src/pages/SubscriptionsPage.tsx`, `SubscriptionCheckoutSuccessPage.tsx`, `SubscriptionCheckoutCanceledPage.tsx`
- `src/components/App/App.tsx`
- `src/components/Footer/Footer.tsx`
- `src/routes.smoke.test.tsx`
- `README-payments.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-28 - Story created (bmad-create-story). Target: PRD E8-S2; Stripe Billing subscription checkout.
- 2026-04-28 - Implemented Stripe subscription Checkout Session API, PDP + `/subscriptions` UI, Billing Portal endpoint, migration, catalog embed, tests; marked done.

## Story completion status

Status: **done**
