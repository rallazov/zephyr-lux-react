# Story 7.1: Order lookup form

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **Epic 4 order persistence is complete:** customer-facing lookup must resolve against Supabase `orders` / `order_items`, not Vercel Blob or Stripe-only state.
- **Story 4-6 customer confirmation email is complete:** customers already receive an order number by email; this story gives them a place to use it.
- **Story 7-2 owns the secure emailed link:** this story may create the request shell and UI contract, but must not expose order data directly from the form submit.

## Story

As a **returning customer**,
I want **to enter my email address and Zephyr Lux order number on a public order lookup page**,
so that **I can request secure access to my order status without creating an account or contacting the owner**.

## Acceptance Criteria

1. **Public route and storefront integration**  
   **Given** a customer visits **`/order-status`** **when** the app renders **then** a storefront page loads under the normal customer layout, not admin auth, with a focused order lookup form. The route is registered in [`src/components/App/App.tsx`](../../src/components/App/App.tsx) alongside other storefront routes and is covered by route smoke tests.

2. **Inputs and validation**  
   **Given** the form is visible **when** the customer enters lookup details **then** it captures exactly **email** and **order number**. Normalize the order number by trimming and uppercasing, and validate the current order number shape **`ZLX-YYYYMMDD-####`** using the same regex expectation as [`orderNumberSchema`](../../src/domain/commerce/order.ts). Validate email with `zod` / existing validation style; show accessible inline errors without submitting invalid payloads.

3. **Neutral submission contract**  
   **Given** a valid-looking email + order number **when** the form submits **then** call a server endpoint contract such as **`POST /api/order-lookup-request`** with JSON `{ email, order_number }`, show a neutral success message, and never reveal whether the order exists. Use wording like "If we find a matching order, we will email a secure link." **Do not** show order status, line items, tracking, or "not found" on this page.

4. **Privacy boundary**  
   **Given** this is a public customer page **when** implementing the submit path **then** do not use `getSupabaseBrowserClient()` or any browser-side Supabase reads against `orders`, `order_items`, `shipments`, or `order_events`. All lookup checks belong in `api/*` using service-role server code in Story 7-2. The form must not log raw email addresses or token-like values to the browser console.

5. **UX and accessibility**  
   **Given** a mobile customer needs help fast **when** using the page **then** the form uses labeled fields, large touch targets, clear busy/success/error states, and support fallback copy. Keep the page customer-facing and premium/product-storefront in tone; do not reuse admin dashboard visual density. Avoid visible instructional text about implementation details, keyboard shortcuts, or security internals.

6. **Testing**  
   **Given** the story is complete **when** tests run **then** add Vitest / Testing Library coverage for validation helpers, submit-state rendering, neutral success copy, route smoke for `/order-status`, and the request-shell handler if this story creates it before Story 7-2.

## Tasks / Subtasks

- [x] **Task 1 - Route and page shell (AC: 1, 5)**  
  - [x] Add a customer-facing `OrderStatusLookup` page/component under a storefront-appropriate folder such as `src/order-status/` or `src/components/OrderStatus/`.
  - [x] Register `/order-status` in [`AppRoutes`](../../src/components/App/App.tsx) under [`Layout`](../../src/components/App/Layout.tsx), not under `/admin`.
  - [x] Add route smoke coverage in [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx).

- [x] **Task 2 - Form validation and normalization (AC: 2)**  
  - [x] Add a small pure helper/schema for `{ email, order_number }` so both UI and API tests can reuse it.
  - [x] Enforce trimmed email, normalized uppercase order number, length limits, and `ZLX-\d{8}-\d{4}` shape.

- [x] **Task 3 - Submit contract (AC: 3, 4)**  
  - [x] Submit to `POST /api/order-lookup-request` with `Content-Type: application/json`.
  - [x] If the API route is introduced here as a shell, it must validate shape and return the same neutral 200/202 response for valid payloads; Story 7-2 fills in matching + email delivery.
  - [x] Avoid client-side Supabase reads and avoid exposing raw error internals.

- [x] **Task 4 - Tests (AC: 6)**  
  - [x] Add helper tests for normalization and invalid cases.
  - [x] Add component tests for empty fields, invalid order number, loading state, neutral success, and network failure.

### Review Findings

- [x] [Review][Patch] `sprint-status.yaml` `last_updated` was not advanced when story 7-1 moved to review — Fixed 2026-04-28: advanced sprint status timestamp during review completion. [`_bmad-output/implementation-artifacts/sprint-status.yaml`:28]

## Dev Notes

### Story intent

Epic 7 chooses **guest checkout + secure order lookup** over accounts-day-one. This story is the public request surface only. It should reduce support burden while preserving the privacy model established in Epics 4 and 5.

### Dev Agent Guardrails

- Do **not** implement customer accounts or Supabase magic-link sign-in here; **FR-CUST-002** is P3/future.
- Do **not** query `orders` from the browser. Existing RLS intentionally denies public order reads.
- Do **not** reuse [`api/order-by-payment-intent.ts`](../../api/order-by-payment-intent.ts) for email/order-number lookup. That endpoint is narrowly for checkout return confirmation and requires `payment_intent_id` plus `order_confirmation_key`.
- Keep response copy neutral to prevent order/email enumeration.

### Architecture compliance

| Concern | Requirement |
|---------|-------------|
| Routing | React Router v6 route under storefront layout |
| Validation | `zod` is already in [`package.json`](../../package.json); no new form validation library |
| Server boundary | Public request goes to `api/*`; no browser service role and no direct Supabase order reads |
| Tests | Vitest + Testing Library, matching existing route/component test style |

### File structure expectations

| Action | Paths |
|--------|-------|
| New | `src/order-status/OrderStatusLookup.tsx` or equivalent |
| New | `src/order-status/orderLookupRequest.ts` for pure schema/normalization if useful |
| Optional new | `api/order-lookup-request.ts` shell, completed in Story 7-2 |
| Update | [`src/components/App/App.tsx`](../../src/components/App/App.tsx), [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) |

### Previous story intelligence

- **[4-6](4-6-customer-confirmation-email.md)** already sends the order number to customers; do not invent a second order identifier.
- **[5-7](5-7-internal-notes-order-timeline.md)** explicitly warns that `order_events.event_type = 'internal_note'` must never leak to customers. This form should not load events at all.
- **[5-5](5-5-carrier-tracking-fields.md)** establishes `shipments` as the tracking source, but tracking display waits for Story 7-4.

### Git intelligence

Recent commits are Epic 4/5 payment, notification, and admin fulfillment work. Extend the existing Vercel `api/*`, `zod`, Resend, Supabase service-role patterns instead of introducing a separate backend stack.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) section 9.10, 13.1, and Epic 7.
- [`epics.md`](../planning-artifacts/epics.md) FR-CUST-001 and data model notes.
- [`architecture.md`](../planning-artifacts/architecture.md) Q10 lean: guest + lookup for MVP.
- No checked-in `project-context.md` matched the create-story persistent facts glob at story creation time.

## Dev Agent Record

### Agent Model Used

- GPT-5 (Codex)

### Debug Log References

- `npx vitest run src/order-status/orderLookupRequest.test.ts src/order-status/OrderStatusLookup.test.tsx api/order-lookup-request.test.ts src/routes.smoke.test.tsx`
- `npm run build`
- `npm test`
- `npm run lint` (blocked by pre-existing unrelated lint errors in `api/_lib/store.ts`, `src/cart/reconcile.ts`, and `src/components/SubscriptionForm/SubscriptionForm.tsx`)
- `npx eslint api/order-lookup-request.ts api/order-lookup-request.test.ts src/order-status/OrderStatusLookup.tsx src/order-status/OrderStatusLookup.test.tsx src/order-status/orderLookupRequest.ts src/order-status/orderLookupRequest.test.ts src/components/App/App.tsx src/routes.smoke.test.tsx`

### Completion Notes List

- Added `/order-status` under the storefront layout with labeled email and order-number fields, large touch targets, support fallback copy, busy/success/error states, and neutral enumeration-safe success messaging.
- Added shared Zod validation for `{ email, order_number }`, trimming email and normalizing order numbers to uppercase before enforcing the existing `orderNumberSchema` shape.
- Added `POST /api/order-lookup-request` shell that validates payloads and returns neutral `202` success for valid-looking requests; Story 7-2 can replace the shell with matching and email delivery.
- Confirmed the form does not use browser Supabase clients or reveal order status, line items, tracking, or not-found state.

### File List

- `api/order-lookup-request.ts`
- `api/order-lookup-request.test.ts`
- `src/components/App/App.tsx`
- `src/order-status/OrderStatusLookup.tsx`
- `src/order-status/OrderStatusLookup.test.tsx`
- `src/order-status/orderLookupRequest.ts`
- `src/order-status/orderLookupRequest.test.ts`
- `src/routes.smoke.test.tsx`
- `_bmad-output/implementation-artifacts/7-1-order-lookup-form.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-28 - Story created (bmad-create-story). Target: PRD E7-S1; Epic 7 lookup request surface.
- 2026-04-28 - Implemented order lookup request form, validation helper, neutral API shell, and tests (bmad-dev-story).

## Story completion status

Status: **done**  
Ultimate context engine analysis completed - comprehensive developer guide created.
