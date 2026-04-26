---
stepsCompleted:
  - step-01-init
  - step-02-context
inputDocuments:
  - _bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/implementation-readiness-report-2026-04-25.md
workflowType: architecture
project_name: zephyr-lux-react
user_name: Raminallazov
date: 2026-04-25
---

# Zephyr Lux Commerce — Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (56 total across 12 categories):**

The architecture must support a complete single-seller ecommerce loop: catalog
(FR-CAT-001..007), storefront browse (FR-SF-001..005), SKU-keyed cart
(FR-CART-001..005), server-authoritative checkout (FR-CHK-001..006),
Stripe-webhook-driven payments (FR-PAY-001..005), durable orders with snapshots
and a fulfillment state machine (FR-ORD-001..005), owner/customer transactional
notifications (FR-NOT-001..004), protected owner admin (FR-ADM-001..007), manual
fulfillment with tracking and photo upload (FR-FUL-001..004), future customer
order lookup / passwordless account (FR-CUST-001..002), policy/SEO/trust content
(FR-CONT-001..003), and basic analytics/observability (FR-AN-001..003).

The 29 P0 FRs define the MVP surface that must be architecturally solid from day
one: canonical catalog, SKU-based cart, server-calculated Stripe line items,
webhook-as-source-of-truth with idempotent processing, Supabase-persisted orders
with human-readable order numbers, protected admin, and owner email
notification.

**Non-Functional Requirements (25 total across 7 categories):**

Architecturally-binding NFRs:

- **Security (P0):** PCI-light via Stripe-hosted fields; service-role keys only
  server-side; admin APIs verify authorization; webhooks verify signatures. (P1)
  RLS protects customer/order/admin data; uploaded shipment photos are not
  publicly enumerable.
- **Reliability (P0):** exactly one order per successful payment; duplicate
  webhooks are safe. (P1) notification failures do not lose the order; DB
  backups enabled pre-launch.
- **Performance (P1):** storefront usable on mobile within ~3s on 4G; admin
  list usable at 10k+ orders (pagination/indexing required).
- **Accessibility (P1):** keyboard nav for core flows; labelled form fields
  with visible validation; acceptable contrast. **This is a hard constraint
  against hand-rolled primitives** — an accessible headless component library
  (Radix, shadcn/ui, or Headless UI) is a requirement, not a preference.
- **Maintainability (P0):** TypeScript is canonical. (P1) centralized commerce
  types; focused tests on checkout/order logic; documented env vars per
  environment.
- **Deployment (P0):** clean Git checkout deploys to Vercel. (P1) preview
  deployments use test Stripe/Supabase; production requires a production Stripe
  webhook endpoint.
- **Privacy (P0):** store only data needed for fulfillment and support.

### Scale & Complexity — Honest Shape

The system has a **small surface area with a high-correctness core, surrounded
by boring CRUD.** "Medium complexity" is a misleading average. The honest
picture:

- **High-correctness core (must be engineered carefully):** Stripe webhook
  handler + `payment_events` ledger + idempotent order creation + inventory
  decrement + RLS-as-boundary. This is the spine of NFR-REL-001/002 and
  NFR-SEC-001..004. Small in line count, large in failure-mode space.
- **Boring CRUD (can be conventional):** product/variant/image admin, order
  list and detail views, notes, policy pages.
- **UX-sensitive surface:** product detail with variant selection, cart,
  checkout, order confirmation, admin mobile fulfillment view. Correctness
  bar is user-visible here (out-of-stock states, payment failure recovery,
  mobile touch targets, empty states).

- Primary domain: **full-stack web commerce** — React SPA + Vercel serverless
  API routes + managed Postgres (Supabase) + Stripe + transactional email
- Logical components (named for traceability, not as a complexity claim):
  Frontend SPA; Serverless API layer; Catalog adapter; Cart/checkout
  orchestration; Stripe integration (session creation + webhook); Payment
  event ledger + idempotency gate; Order persistence (orders, order_items,
  order_events); Inventory movement engine; Shipment & shipment_images
  module; Notification dispatcher + retry log; Supabase Auth + RLS policy
  surface; Shared commerce domain types + zod schemas.

### Technical Constraints & Dependencies

**Platform constraints (from PRD §11.1 + §5.3):**

- Hosting: Vercel (frontend + serverless API routes on same deploy target)
- System of record: Supabase (Postgres, Auth, Storage, RLS)
- Payments: Stripe (PaymentIntent or Checkout Session; Stripe Billing later)
- Email: Resend or SendGrid (provider TBD — PRD §18 Q2)
- SMS: Twilio optional and deferred (PRD §18 Q3)
- No Railway for MVP unless long-running workers appear

**Brownfield realities — verified against the current repo:**

The landmine list is a symptoms inventory; the ordering below is the
**strangler sequence** that must precede Epic 2. Doing these in the wrong
order leaves the storefront half-migrated and nothing stable.

- **Dual-file semantic merges (not deletes):** each pair below has almost
  certainly diverged; Vercel's module resolution may be running the `.js`
  in production while tests run the `.ts`. Each pair requires a diff,
  end-to-end parity run against Stripe test mode, and an explicit
  choose-and-delete commit:
  - `api/create-payment-intent.js` vs. `api/create-payment-intent.ts`
  - `api/stripe-webhook.js` vs. `api/stripe-webhook.ts`
  - `vite.config.js` vs. `vite.config.ts`
  - `src/main.js` vs. `src/main.tsx` (compounded by `src/main.tsx`
    importing `App.js` per PRD §4.2)
  - `public/products.json` vs. `data/products.json`
- **Committed `dist/`:** removing it may surface a latent bug on first
  clean-build PR. Treat as a stabilization-block concern, not a
  housekeeping chore.
- **`api/_lib/` is JS-shaped** (no central typed contract today).
- **Cart is product-id based** (FR-CART-001 refactor blocker).
- **Checkout sends client-calculated amount** (FR-CHK-003, FR-CAT-004
  blocker).
- **Vercel Blob holds orders publicly** (FR-ORD-001 replacement blocker).
- **Inventory decrement is a no-op** (FR-PAY-003, FR-ORD-001 dependency).
- **Hidden/unrendered checkout form fields** (FR-CHK-002 blocker).

**Implied Epic 0 (Stabilization) before Epic 2 stories can be safely
picked up:**

1. Resolve every dual-file pair with a documented decision per pair;
   remove committed `dist/`; single-source the product JSON; `tsc -b`
   green from clean checkout.
2. Create a canonical shared types surface (likely `src/shared/types/`
   or a `packages/shared` — physical location is itself a decision) with
   zod schemas for `CartItem`, `CheckoutLineItemsRequest`, `WebhookEvent`,
   `OrderItem`, `Address`, `PaymentStatus`, `FulfillmentStatus`.
3. Stand up Supabase schema including the `payment_events` ledger with a
   uniqueness constraint on `provider_event_id`; baseline RLS policies;
   one smoke test that runs a real Stripe test-mode webhook through the
   idempotency gate end-to-end.
4. Resolve the architecture-blocking open questions below.

**Dependencies (runtime packages already in repo):**

- `@stripe/react-stripe-js@3.1.1`, `@stripe/stripe-js@5.4.0`, `stripe@17.7.0`
  — ready for both Checkout Session and Payment Element paths
- `@vercel/blob@1.1.1` — scheduled for removal as source of truth once
  Supabase lands (will remain only for non-order asset use if any)
- `zod@4.1.11` — available for request validation at every server boundary
  and for shared schema definitions
- `pino@9.11.0` — available for structured server logs with correlation IDs
- `react-router-dom@6.28.1`, `tailwindcss@3.4.17`, `@tailwindcss/forms`,
  `@tailwindcss/typography`, `@tailwindcss/aspect-ratio`
- Not present: `@supabase/supabase-js`, any email SDK, any headless
  component library (Radix/shadcn/Headless UI)

### §18 Open Questions — Tiered by Architectural Blast Radius

**Tier A — Architecture-blocking (must be resolved before Step 3
starter-template evaluation):**

- **Q1 — Stripe Checkout Session vs. embedded Payment Element**
  (FR-CHK-005). Dictates PCI scope, webhook event shape, order state
  machine, refund flow, and the customer's checkout visual continuity.
  This is simultaneously a UX decision (redirect vs. embedded brand
  continuity) and a technical decision (how much of cart→order lives in
  our code vs. Stripe's).
- **Q10 — Guest + order lookup vs. accounts-day-one**. Reshapes the
  Supabase Auth configuration, RLS policy topology, order-confirmation
  email content, nav structure, and whether `customers` is an
  auth-linked or email-keyed table in practice. Cannot scaffold auth
  cleanly without this answer.

**Tier B — Pick-now-swap-later (decide in Step 4, swappable behind an
adapter):**

- **Q2 — email provider** (Resend / SendGrid / Postmark). Adapter
  interface is stable regardless of provider. Pick one for MVP.
- **Q4 — shipping model** (flat-rate / free threshold / carrier-calc).
  Flat + free threshold is a config value; carrier-calc is a distinct
  integration. MVP should anchor on flat + free threshold; carrier-calc
  is a future epic.
- **Q6 — product admin at first launch vs. seed-only migration**.
  Seed-only deletes roughly half of Epic 5's admin scope; if chosen, the
  remaining admin work is just orders/fulfillment. High product impact,
  low architectural impact once the catalog schema is fixed.

**Tier C — Defer (does not affect MVP architecture):**

- **Q9 — admin subdomain vs. `/admin` same-origin**. A DNS and
  middleware decision, not a structural one. Can be flipped later.
- **Q3 — SMS at launch**. Already deferred to FR-NOT-003 (P2).
- **Q5 — Amazon MCF**. Already deferred to FR-FUL-004 (P3).
- **Q7 — real product reviews**. Not on MVP path.
- **Q8 — return/refund policy content**. Content decision, not
  architecture.

### Cross-Cutting Concerns Identified

1. **Idempotency & event-sourced payment processing.** A `payment_events`
   ledger keyed on Stripe `event.id` with a uniqueness constraint gates
   all order/inventory side effects. Stripe webhook flow: verify
   signature → persist event → return 2xx → process side effects (order
   creation, inventory movement, notification dispatch) in a transaction
   bound to the event ID. Spans checkout API, webhook handler, order
   creation, inventory movement, and notification dispatch. Deserves its
   own architecture section, not a bullet.
2. **Secret & configuration boundaries.** Three distinct trust zones:
   browser (publishable keys only), Vercel serverless (service keys,
   Stripe secret, webhook secret, email API key), and Supabase RLS
   (customer/admin partitioning). The `.env` matrix must be explicit
   across local / preview / production, and per runtime (browser /
   serverless Node / potentially Edge).
3. **Epic 0 stabilization sequence as a hard gate.** The strangler
   ordering in "Brownfield realities" above is itself a cross-cutting
   concern: every Epic 2+ story implicitly depends on it. The
   architecture must name it as a prerequisite block, not bury it in
   Epic 1 ACs.
4. **Canonical commerce domain types with zod runtime validation.**
   `Product`, `Variant`, `CartItem`, `Order`, `OrderItem`, `Address`,
   `PaymentEvent`, `Shipment`, `FulfillmentStatus`, `PaymentStatus`
   defined once, imported by SPA, API routes, and derived from (or
   reconciled to) Supabase-generated types. Physical location (single
   `src/shared/`, a `packages/shared`, or file-colocated) is an
   explicit Step 4 decision. Every server boundary validates input
   with zod.
5. **Observability & correlation.** A consistent correlation ID flowing
   Stripe `event.id` → `order.id` → `log` entries → `notification_logs`
   rows (FR-AN-003). Pino on the server side; structured logging with
   no PII beyond what's already in the order.
6. **Customer storefront mobile-first (320px minimum).** Storefront
   works one-handed on 4G. Standard responsive design, but with a real
   LCP budget for product imagery (see #10).
7. **Admin mobile-usable from day one.** Distinct from Release 3's PWA
   polish. The operator ships from her phone *now*. Admin order list,
   order detail, mark-shipped, and tracking-entry flows must be usable
   on a 390px screen in MVP, even without service worker / push /
   offline support yet. FR-ADM-007 is tagged P2 but its *usability*
   floor is P0 the moment there's a real paid order.
8. **RLS as the protective boundary.** Not application-layer checks
   alone. Every admin and customer data access path goes through
   policies; service-role key only used in explicitly whitelisted
   server paths (notification dispatch, order creation from webhook).
9. **Snapshot semantics.** `order_items` and `order_events` store
   immutable snapshots of product/variant data at purchase time; later
   catalog edits must not mutate history (FR-ORD-005). Enforced at the
   data model level (denormalized `product_title`, `variant_title`,
   `image_url`, `unit_price_cents` on `order_items`).
10. **Image pipeline / LCP budget.** "Large, clear product imagery" at
    320px and at 2560px is an LCP and bandwidth question. Storage
    (Supabase Storage) + transformation strategy (signed URLs, on-the-fly
    resize, or pre-rendered sizes) + CDN behavior must be decided in
    Step 4; the wrong choice now means re-platforming the gallery later.
11. **PWA-readiness from day one.** The Release 3 mobile admin/PWA is
    easier to reach if the app shell, router, and build tool already
    tolerate service workers. This is a Step 3/4 constraint on starter
    template and Vite plugin choice, not a Release 3 implementation
    question.
12. **Notification resilience including operator-side recovery UI.**
    Dispatch must not block order creation; failures are logged to
    `notification_logs` and retryable. But also: the *operator's* UI
    must surface notification failures so a missed email never means a
    missed order. Admin order list should show a "notification failed"
    badge at the row level. Admin mobile view needs pull-to-refresh
    against the server, not just trust of push email.
13. **Clean-deploy discipline.** No runtime dependencies on untracked
    generated artifacts; canonical TypeScript source (NFR-MAINT-001,
    NFR-DEP-001). Every serverless function is `.ts`; `dist/` is never
    committed; `tsc -b` is green from clean checkout.
14. **Environment separation.** Test Stripe, test Supabase, test email
    sandbox for previews; production keys only on production
    (NFR-DEP-002/003). Spans every external integration.
15. **Local development story.** Supabase CLI for local Postgres +
    migrations; Stripe CLI for webhook tunneling; an explicit `.env`
    matrix spanning browser / serverless / webhook runtime; a documented
    seed path. Not decided yet — will be a Step 4 decision.
16. **Webhook runtime choice (Node vs. Edge).** Stripe SDK behavior and
    raw-body handling differ between Vercel Node and Edge runtimes. The
    webhook handler must run on Node (for Stripe SDK compatibility and
    raw-body signature verification); other API routes may run on
    Edge. This is a Step 4 decision per endpoint.
17. **Accessible component library as a constraint.** NFR-A11Y-001/002/003
    rules out rolling our own inputs, dialogs, menus, listboxes, or
    comboboxes. A headless accessible library (Radix, shadcn/ui, or
    Headless UI) must be selected in Step 4; this constrains starter
    templates in Step 3.

### UX-Blocks-Architecture Items

The absence of a standalone UX spec creates specific architectural risk.
The following are not "downstream polish" — they are input constraints
on the stack:

- **Checkout flow storyboard** (one page or three, embedded or hosted,
  error surface count). Must precede Q1 resolution.
- **Variant-selection interaction model** (out-of-stock-in-selected-color
  behavior dictates the variant + inventory schema, not the other way
  around).
- **Empty / error / loading state inventory per route.** "First-class UI"
  without a concrete catalog is aspirational. Applies to: empty cart,
  no-active-products storefront, empty category, out-of-stock variant,
  invalid cart at checkout entry, payment failure, payment cancellation,
  order-confirmation direct-fetch fallback, admin webhook-failure alert,
  admin notification-failure alert.
- **Mobile admin interaction contract** (touch target sizes, camera
  upload flow for FR-FUL-003, webhook-failure recovery UI).

These are surfaced here so Step 4 decisions (component library, checkout
mode, image pipeline, service worker posture) can be made against actual
UX constraints rather than backfilled.

### Pre-Step-3 Asks to User

- Answer **Q1** (Stripe Checkout Session vs. Payment Element), or
  explicitly green-light a default proposal with trade-offs laid out in
  Step 4.
- Answer **Q10** (guest + order lookup vs. accounts-day-one). Roundtable
  lean is guest + lookup for MVP.
- Confirm **admin mobile-usable is a day-one constraint** (not Release 3).
- Confirm the **Epic 0 stabilization sequence** should be named in the
  architecture document as an explicit prerequisite block to Epic 2+.
