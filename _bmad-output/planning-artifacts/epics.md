---
stepsCompleted:
  - step-01-validate-prerequisites
inputDocuments:
  - _bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md
  - _bmad-output/planning-artifacts/implementation-readiness-report-2026-04-25.md
---

# zephyr-lux-react - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for `zephyr-lux-react` (Zephyr Lux Single-Seller Commerce), decomposing the requirements from the PRD (which also contains inline §11 Architecture, §12 Data Model, and §13 UX Requirements) into implementable stories. No separate Architecture or UX specification documents exist; the PRD is the canonical planning artifact, supplemented by the implementation readiness report for brownfield context.

## Requirements Inventory

### Functional Requirements

**9.1 Catalog and Product Management**

- **FR-CAT-001 (P0):** The system must maintain a single canonical product catalog (product list, detail, cart, checkout, and payment API all read the same source).
- **FR-CAT-002 (P0):** Each product must have a stable, unique slug. Product cards link to `/product/:slug`; unknown slugs show a not-found state.
- **FR-CAT-003 (P0):** Each purchasable option must be represented as a variant with SKU, product ID, size, color, price, currency, inventory quantity, active status, and image mapping. Cart and checkout line items reference SKU/variant ID, not only product ID.
- **FR-CAT-004 (P0):** Product price must be server-authoritative during checkout. Server recomputes totals from catalog/variant records; clients cannot override price.
- **FR-CAT-005 (P1):** Owner must be able to add and edit products from admin (title, slug, description, category, care, fabric, images, active status, variants, inventory). Admin validates required fields and prevents slug conflicts.
- **FR-CAT-006 (P1):** Product images must support multiple images per product with a gallery on product detail, admin upload, Supabase Storage backing, and selectable primary image.
- **FR-CAT-007 (P2):** Product inventory must support manual adjustment history. Adjustments record reason, timestamp, actor, variant, and delta; paid orders create inventory movement records.

**9.2 Storefront Browse Experience**

- **FR-SF-001 (P0):** Customer must be able to view all active products at `/products`. Inactive products are hidden; empty state appears if no products are active.
- **FR-SF-002 (P0):** Customer must be able to view a product detail page with title, images, price/range, fabric, care, size/color options, availability, add-to-cart, shipping/returns trust text, and description. Add-to-cart disabled until required variants are selected; out-of-stock variants cannot be added.
- **FR-SF-003 (P1):** Storefront must include a real homepage that communicates Zephyr Lux brand, routes customers to product/collection pages, and contains no placeholder category cards.
- **FR-SF-004 (P1):** Storefront must support category/collection pages tied to real collections. Empty categories show a polished empty/coming-soon state or are hidden from nav.
- **FR-SF-005 (P2):** Storefront should support search/filtering by category, size, color, availability, and price range. Search icon opens real search UI or is removed until ready.

**9.3 Cart**

- **FR-CART-001 (P0):** Customer must be able to add selected variants to cart with item identity keyed on SKU/variant ID; adding same SKU increments quantity, different size/color creates a distinct item.
- **FR-CART-002 (P0):** Customer must be able to update cart quantity; quantity cannot go below 1 except via remove; quantity cannot exceed available stock when inventory checking is enabled.
- **FR-CART-003 (P0):** Cart must persist across page reloads via local storage or Supabase anonymous cart strategy; invalid/stale cart items are reconciled before checkout.
- **FR-CART-004 (P0):** Cart must show accurate subtotal from current catalog. If a variant is inactive or out of stock, cart shows a warning and blocks checkout for that item.
- **FR-CART-005 (P1):** Cart must have mobile-friendly layout usable at 320px; product image, name, variant, price, quantity, and remove action remain readable.

**9.4 Checkout**

- **FR-CHK-001 (P0):** Customer must be able to start checkout from a non-empty, valid cart. Empty carts cannot create payment intent/session; invalid carts explain what to fix.
- **FR-CHK-002 (P0):** Checkout must collect required customer contact and shipping information (email, name, address line1/line2, city, state, postal, country). Validation errors are visible and actionable; data is saved to order/customer records after successful payment.
- **FR-CHK-003 (P0):** Checkout must create a Stripe payment using server-calculated line items. Frontend sends variant IDs/SKUs + quantities; server fetches current variant price and creates PaymentIntent or Checkout Session with order/cart reference in metadata (no oversized full-order data).
- **FR-CHK-004 (P0):** Checkout must handle payment success (redirect to confirmation), failure (recoverable error), and cancellation (return to cart without losing items).
- **FR-CHK-005 (P1):** Checkout should use Stripe Checkout Session unless a custom embedded checkout is justified. The architecture decision must be recorded; if Checkout Session is used, line items and customer/shipping settings are configured server-side.
- **FR-CHK-006 (P1):** Shipping and tax must be clear to customer before payment. MVP may use flat-rate shipping with documented tax assumptions; future tax-automation path is documented; order totals match Stripe totals.

**9.5 Payments**

- **FR-PAY-001 (P0):** Stripe secret keys must never be exposed to browser. Only publishable key is in frontend env; secret key exists only in Vercel server env.
- **FR-PAY-002 (P0):** Stripe webhook must be source of truth for paid order confirmation. UI success alone does not mark an order paid; webhook validates signature and records payment success/failure.
- **FR-PAY-003 (P0):** Webhook processing must be idempotent. Duplicate Stripe event IDs do not create duplicate orders; duplicate payment events do not duplicate inventory decrements.
- **FR-PAY-004 (P1):** Refund/cancellation state must be representable. Data model includes refunded, partially refunded, canceled, and payment_failed states; admin can see payment state; full refund execution may remain manual in Stripe Dashboard for MVP.
- **FR-PAY-005 (P3):** Subscriptions must use Stripe Billing. Subscribe-and-save products are modeled separately; lifecycle events captured by webhook; customer manages via Stripe customer portal or future account page.

**9.6 Orders**

- **FR-ORD-001 (P0):** A paid order must be recorded in Supabase with order number, customer, email, shipping address, totals, currency, payment provider, payment reference, payment status, fulfillment status, timestamps, and order items (product/variant snapshot, SKU, quantity, unit price, total).
- **FR-ORD-002 (P0):** Order number must follow a stable human-readable format (e.g. `ZLX-YYYYMMDD-####`), be unique, and appear in customer emails and admin screens.
- **FR-ORD-003 (P0):** Order confirmation page must show order number, customer email, items, total, and current status. If refreshed directly, system fetches order by secure reference or instructs customer to check email.
- **FR-ORD-004 (P1):** Order lifecycle must support fulfillment statuses: `pending_payment`, `paid`, `processing`, `packed`, `shipped`, `delivered`, `canceled`, `refunded`, `partially_refunded`. Invalid transitions are prevented or warned.
- **FR-ORD-005 (P1):** Order history must preserve product snapshots so historical orders keep their purchased item details even if product title/price changes later.

**9.7 Owner Notifications**

- **FR-NOT-001 (P0):** Owner must receive an email notification when a paid order is created, including order number, customer name/email, total, items, shipping address, and admin link. Sent only after payment success; failures are logged and retryable.
- **FR-NOT-002 (P1):** Customer must receive an order confirmation email after payment success, including order number, summary, shipping address, support contact, and next-step messaging.
- **FR-NOT-003 (P2):** Owner should optionally receive SMS/push notification. Channel is configurable; sensitive customer details are limited in SMS/push preview.
- **FR-NOT-004 (P2):** Customer should receive a shipment notification email with carrier/tracking link when the owner marks shipped.

**9.8 Owner Admin**

- **FR-ADM-001 (P0):** Admin area must be protected. Owner signs in before viewing admin; unauthorized users cannot access admin data via UI or API; Supabase RLS or server-side authorization protects data.
- **FR-ADM-002 (P0):** Owner must be able to view paid orders in an admin list showing order number, date, customer, total, payment status, fulfillment status, and item count, with filter for unfulfilled orders.
- **FR-ADM-003 (P0):** Owner must be able to view order detail with line items, variants/SKUs, customer contact, shipping address, payment status, fulfillment status, order timeline, and notes.
- **FR-ADM-004 (P1):** Owner must be able to update fulfillment status (processing, packed, shipped). Shipped requires optional carrier/tracking fields. Changes create timeline events.
- **FR-ADM-005 (P1):** Owner must be able to add internal notes visible only in admin; notes record actor and timestamp.
- **FR-ADM-006 (P1):** Owner must be able to add/edit products and variants through admin forms with active/inactive/out-of-stock states.
- **FR-ADM-007 (P2):** Admin must be mobile-friendly. Owner can view new orders and mark shipped from phone; camera/file upload works on mobile browsers.

**9.9 Fulfillment Support**

- **FR-FUL-001 (P0):** Owner must have enough order data to ship manually. Admin order detail shows full shipping address with a printable or copy-friendly layout.
- **FR-FUL-002 (P1):** Owner must be able to add tracking data (carrier, number, URL). Customer shipment email includes tracking.
- **FR-FUL-003 (P2):** Owner must be able to upload shipment/label photos from phone, stored in Supabase Storage and attached to order timeline.
- **FR-FUL-004 (P3):** System should support Amazon MCF or 3PL integration. Data model maps local SKU to fulfillment SKU; provider status can be stored; manual fulfillment remains available if integration fails.

**9.10 Customer Order Lookup**

- **FR-CUST-001 (P2):** Customer should be able to look up order status by entering email + order number; system sends a secure lookup link or verifies access; page shows fulfillment state and tracking.
- **FR-CUST-002 (P3):** Customer should have an optional passwordless account via email magic link/OTP with order history visible; guest checkout remains supported.

**9.11 Content, Policy, and Trust**

- **FR-CONT-001 (P1):** Store must include required policy pages: shipping, returns/refunds, privacy, terms of service, contact/support. Footer links route to real pages; checkout/order emails link to relevant policies.
- **FR-CONT-002 (P1):** Product pages must include trust information: shipping estimate or processing time, return/refund summary, fabric/care details.
- **FR-CONT-003 (P2):** Store must support SEO metadata. Product pages have title, description, Open Graph image, and product structured data; homepage and collection pages have meaningful metadata.

**9.12 Analytics and Observability**

- **FR-AN-001 (P1):** Owner should see basic commerce metrics on an admin dashboard: recent orders, total sales, open fulfillment count, low-stock variants.
- **FR-AN-002 (P2):** Store should capture frontend analytics for page views, product views, add-to-cart, checkout-start, and purchase events with privacy-aware analytics.
- **FR-AN-003 (P1):** Backend errors must be logged. Payment and webhook errors are logged with correlation IDs; sensitive customer/payment data is not logged.

**Total FRs: 56**

### NonFunctional Requirements

**10.1 Security**

- **NFR-SEC-001 (P0):** Payment processing must remain PCI-light through Stripe-hosted or Stripe-controlled payment fields.
- **NFR-SEC-002 (P0):** Supabase service role keys must never be exposed in frontend code.
- **NFR-SEC-003 (P0):** Admin APIs must verify admin authorization.
- **NFR-SEC-004 (P0):** Webhooks must verify Stripe signatures.
- **NFR-SEC-005 (P1):** RLS policies must protect customer/order/admin data.
- **NFR-SEC-006 (P1):** Uploaded shipment photos must not be publicly enumerable unless explicitly intended.

**10.2 Privacy**

- **NFR-PRI-001 (P0):** Store only customer data required for order fulfillment and support.
- **NFR-PRI-002 (P1):** Privacy policy must describe collected data and processors.
- **NFR-PRI-003 (P1):** Admin screens must avoid exposing customer data unnecessarily.

**10.3 Reliability**

- **NFR-REL-001 (P0):** A successful payment must result in exactly one order record.
- **NFR-REL-002 (P0):** Duplicate webhooks must be safe.
- **NFR-REL-003 (P1):** Notification failures must not lose the order.
- **NFR-REL-004 (P1):** Database backups must be enabled before real launch.

**10.4 Performance**

- **NFR-PERF-001 (P1):** Product list should load quickly on mobile. Target: initial storefront page usable on mobile within ~3s on typical 4G; product images optimized and appropriately sized.
- **NFR-PERF-002 (P1):** Admin order list should remain usable for at least 10,000 orders (pagination, indexing, or virtual scrolling as needed).

**10.5 Accessibility**

- **NFR-A11Y-001 (P1):** Storefront must support keyboard navigation for core customer flows.
- **NFR-A11Y-002 (P1):** Form fields must have labels and visible validation states.
- **NFR-A11Y-003 (P1):** Color contrast must be acceptable for product, cart, checkout, and admin screens.

**10.6 Maintainability**

- **NFR-MAINT-001 (P0):** TypeScript source should be canonical.
- **NFR-MAINT-002 (P1):** Commerce domain types should be centralized.
- **NFR-MAINT-003 (P1):** Critical checkout/order logic should have focused tests.
- **NFR-MAINT-004 (P1):** Environment variables should be documented by environment.

**10.7 Deployment**

- **NFR-DEP-001 (P0):** Vercel production deployment must work from a clean Git checkout.
- **NFR-DEP-002 (P1):** Preview deployments should use test Stripe/Supabase environments.
- **NFR-DEP-003 (P1):** Production deployment must require production Stripe webhook endpoint configured.

**Total NFRs: 25**

### Additional Requirements

Drawn from PRD §4 (Brownfield Starting Point), §11 (Recommended Architecture), §12 (Proposed Data Model), §17 (Risks), and §19 (Implementation Guidance). No standalone architecture document exists.

**Brownfield constraints (impacts Epic 1 Story 1):**

- **No starter template** — this is a brownfield React 18 + Vite + TypeScript + Tailwind project with `react-router-dom`, existing Stripe dependencies, and Vercel API functions. Do **not** scaffold a new project.
- `src/main.tsx` imports `App.js` while `.js` files are untracked generated artifacts; clean Vercel deployment from Git may fail or run stale code. Must be resolved.
- Catalog data is fragmented across `public/`, `public/assets/`, and `data/` JSON files read differently by storefront list, detail, and payment API.
- Product list data does not consistently include `slug`; product detail depends on slug lookup.
- Existing cart model is product-id based, not SKU/variant based.
- Existing checkout UI has hidden/unrendered customer form fields.
- Existing checkout sends a raw client-calculated amount to the payment API instead of server-calculated SKU/quantity line items.
- Existing webhook records orders but uses Vercel Blob public storage, which is not appropriate as long-term system of record.
- Existing inventory decrement is a no-op.
- Footer/nav contain placeholder links (search, account, policies, help); category routes contain placeholder collection content.
- Preserve existing product images and visual assets.
- Avoid deleting untracked/generated files without explicit approval.
- Move toward TypeScript source as canonical runtime code (per NFR-MAINT-001).

**MVP Architecture stack (§11.1):**

- **Vercel** hosts the React app and serverless API routes (frontend + backend on same deploy target).
- **Supabase** is the system of record for catalog, customers, orders, payments, inventory, admin data, notification logs, and shipment images. Supabase Storage holds product/shipment images. Supabase Auth handles admin sign-in; RLS protects customer/order/admin data.
- **Stripe** handles checkout/payment and future subscription billing. Stripe Checkout Session is preferred unless embedded Payment Element is justified (open question in PRD §18 Q1).
- **Resend or SendGrid** sends owner and customer transactional emails (provider choice is PRD §18 Q2).
- **Optional Twilio** sends SMS alerts (deferred, PRD §18 Q3).
- **No Railway required for MVP** unless long-running workers or heavier fulfillment integrations are introduced (Epic 8+).

**Data Model (§12) — Supabase tables to be created:**

- `products` (id, slug unique, title, subtitle, description, brand, category, fabric_type, care_instructions, origin, status[draft/active/archived], timestamps)
- `product_variants` (id, product_id FK, sku unique, size, color, price_cents, currency, inventory_quantity, low_stock_threshold, status[active/inactive/discontinued], timestamps)
- `product_images` (id, product_id FK, variant_id FK nullable, storage_path, alt_text, sort_order, is_primary, created_at)
- `customers` (id, email unique, first_name, last_name, phone, stripe_customer_id, timestamps)
- `customer_addresses` (id, customer_id FK, name, line1, line2, city, state, postal_code, country, phone, created_at)
- `orders` (id, order_number unique, customer_id FK nullable, customer_email, customer_name, payment_status enum, fulfillment_status enum, subtotal_cents, shipping_cents, tax_cents, discount_cents, total_cents, currency, shipping_address_json jsonb, stripe_payment_intent_id, stripe_checkout_session_id, notes, timestamps)
- `order_items` (id, order_id FK, product_id nullable, variant_id nullable, sku, product_title, variant_title, size, color, quantity, unit_price_cents, total_cents, image_url, created_at)
- `order_events` (id, order_id FK, event_type, message, metadata jsonb, actor_type[system/owner/customer/stripe/fulfillment_provider], created_at)
- `payment_events` (id, provider, provider_event_id unique, event_type, processed_at, payload_hash, status[received/processed/failed/ignored], error_message, created_at) — powers idempotency
- `inventory_movements` (id, variant_id FK, order_id FK nullable, delta, reason[order_paid/manual_adjustment/return/restock/correction], note, created_by, created_at)
- `shipments` (id, order_id FK, carrier, tracking_number, tracking_url, status[pending/packed/shipped/delivered/returned], shipped_at, delivered_at, timestamps)
- `shipment_images` (id, shipment_id FK, order_id FK, storage_path, image_type[label/package/receipt/other], created_at)
- `notification_logs` (id, order_id FK nullable, recipient, channel[email/sms/push], template, status[queued/sent/failed], provider_message_id, error_message, created_at, sent_at)

**Cross-cutting technical requirements:**

- Order number format: `ZLX-YYYYMMDD-####` (human-readable, unique per day).
- Stripe webhook endpoint must verify signature and persist every event to `payment_events` before side effects (enables idempotency and replay).
- Inventory decrement must happen inside the same transaction/operation as order creation, keyed to `payment_events.provider_event_id` to prevent double-decrement.
- Notification dispatch must not block order creation; failures logged to `notification_logs` and retryable.
- Env var documentation must cover local, preview, and production (NFR-MAINT-004, NFR-DEP-002, NFR-DEP-003).
- Seed/migration path: existing JSON catalog must migrate to Supabase `products`/`product_variants`/`product_images` without losing current product imagery.
- Correlation IDs on payment/webhook errors (FR-AN-003) should be consistent across Stripe event ID, order ID, and log entries.

**Agent guardrails (§19):**

- No multi-seller / marketplace abstractions.
- No full CMS / arbitrary page builder.
- No client-submitted payment amounts in real payment paths.
- No production orders in public blobs.
- No Supabase service role key in browser code.
- Do not remove existing user changes without explicit instruction.
- Keep existing product assets unless approved replacements are provided.
- Prefer mobile-friendly responsive admin / PWA over native app until PWA limits are known.

### UX Design Requirements

Extracted from PRD §13 (UX Requirements), §7 (Users/Personas), and pain points cited inline in §4 and §9. No standalone UX specification exists; these UX-DRs are first-class sources for stories.

**Information architecture & routes**

- **UX-DR1:** MVP storefront routes must exist and render real content (no placeholders): `/`, `/products`, `/product/:slug`, `/cart`, `/checkout` (or hosted Stripe equivalent), `/order-confirmation`, `/policies/shipping`, `/policies/returns`, `/policies/privacy`, `/policies/terms`, `/contact`.
- **UX-DR2:** MVP admin routes must exist behind authentication: `/admin`, `/admin/orders`, `/admin/orders/:id`, `/admin/products`, `/admin/products/:id`.
- **UX-DR3:** Future routes must not break current routing when added later: `/order-status`, `/account`, `/subscriptions`.

**Storefront visual direction**

- **UX-DR4:** Storefront must feel premium direct-to-consumer and product-first: large clear product imagery, obvious variant selection, calm minimal checkout, no SaaS dashboard visual language on customer-facing pages, trust elements used sparingly.
- **UX-DR5:** Mobile must be treated as a primary storefront, not an afterthought — all customer flows usable at 320px width (NFR-A11Y baseline + FR-CART-005).

**Product detail page composition**

- **UX-DR6:** Product detail page must include: image gallery, title, price (or selected variant price), size selector, color selector, stock state indicator, add-to-cart CTA (disabled until variants selected), fit/size guide, fabric and care info, shipping/returns summary, product benefits, and optional FAQ accordion. Review/rating block only if real reviews exist and are truthful.

**Cart page composition**

- **UX-DR7:** Cart must include: product image, title, variant details, quantity controls, price and subtotal, remove-item action, shipping/tax note, checkout CTA, continue-shopping link, and an optional free-shipping threshold indicator shown only if actually offered.

**Admin UX priorities**

- **UX-DR8:** Admin must prioritize speed and clarity: new paid orders at top, open-fulfillment count visible immediately, one-tap/click status transitions, copyable shipping address, large mobile touch targets, minimal decorative UI, and clear error states when notification or payment webhook fails.

**Empty states & error states**

- **UX-DR9:** Required empty/error states must be explicitly designed (not just absence of content): empty cart, no-active-products storefront, empty category, out-of-stock variant, invalid cart at checkout entry, checkout payment failure, checkout cancellation, order-confirmation fallback when fetched directly, admin webhook-failure and notification-failure alerts.

**Trust and content**

- **UX-DR10:** Trust elements on product page and checkout must cover: secure checkout cue, shipping estimate/processing time, return/refund summary, and support contact — applied sparingly, not as a banner array.
- **UX-DR11:** Policy pages (shipping, returns/refunds, privacy, terms, contact) must contain real content aligned to the store's actual operations (PRD §18 open questions Q4 Q8 must be resolved before launch content is finalized).

**Accessibility baseline**

- **UX-DR12:** Core customer flows (browse → product → variant select → cart → checkout → confirmation) must be fully keyboard-operable (NFR-A11Y-001).
- **UX-DR13:** All form fields (variant selectors, quantity, checkout fields, admin forms) must have visible labels and visible validation states (NFR-A11Y-002).
- **UX-DR14:** Color contrast must meet acceptable thresholds across product, cart, checkout, and admin screens (NFR-A11Y-003) — audit required given current Tailwind/CSS mix.

### FR Coverage Map

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
