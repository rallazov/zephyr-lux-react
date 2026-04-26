# Zephyr Lux Single-Seller Commerce PRD

Status: Draft v0.1  
Date: 2026-04-26  
Application Type: Brownfield ecommerce storefront and owner operations system  
Primary Goal: Replace Shopify for a single owned brand, not recreate Shopify as a platform  
Primary Users: Customers, store owner/operator, future support/fulfillment helpers  
Canonical BMAD Artifact: `_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md`

## 1. Executive Summary

Zephyr Lux currently has a React/Vite storefront prototype with product listings, a cart context, Stripe-oriented API routes, and static JSON catalog data. The project should evolve into a focused single-seller ecommerce system that lets the owner sell current products directly from the brand domain, accept customer payments, receive order notifications, fulfill orders manually, and manage products/orders without relying on Shopify.

This PRD does not define a multi-seller marketplace, SaaS admin platform, or Shopify-equivalent system. The product is intentionally smaller:

- Customers can browse products, select variants, checkout securely, and receive order confirmation.
- The owner can add/edit products, receive paid order notifications, view orders, update fulfillment status, and record shipment/tracking information.
- The system can grow into subscriptions, a mobile-friendly owner app/PWA, shipping-label photo capture, Amazon MCF/3PL fulfillment integration, and customer order lookup.

The initial launch target is a production-safe end-to-end order flow for a small product catalog. Future readiness should come from clean data models, restrained architecture, and clear workflows rather than overbuilding.

## 2. Product Vision

Zephyr Lux should feel like a premium direct-to-consumer essentials brand, with the operational simplicity of a single-seller store:

- A customer trusts the site enough to buy.
- The owner immediately knows a paid order arrived.
- Fulfillment can happen from a simple admin view.
- Inventory and product data stay organized as variety grows.
- Future subscriptions and mobile fulfillment tools fit naturally into the same data model.

The product should be easy to operate by one person. Every admin feature must reduce owner workload or prevent missed orders.

## 3. Business Context

The owner currently sells through Shopify and Amazon Seller Central. Shopify provides a broad merchant platform, but the owner does not need multi-tenant seller infrastructure. The owner needs direct ecommerce capability for one brand and one inventory/catalog operation.

Amazon can remain a marketplace and/or fulfillment channel. The direct site should increase ownership of customer relationship, brand presentation, customer data, and margin control.

## 4. Brownfield Starting Point

### 4.1 Current Stack

- Frontend: React 18, Vite, TypeScript, Tailwind, component CSS.
- Routing: `react-router-dom`.
- Payments: Stripe dependencies and Vercel API functions exist.
- Storage attempt: Vercel Blob order storage in API layer.
- Catalog: Static JSON files in `public/`, `public/assets/`, and `data/`.
- Hosting config: Vercel config exists.
- Database: No Supabase integration yet.
- Admin: No owner admin.
- Tests: No meaningful automated ecommerce tests currently configured.

### 4.2 Important Current Repo Findings

The implementation has useful pieces but is not currently safe for production commerce:

- Runtime import risk: `src/main.tsx` imports `App.js`, while `.js` files are untracked generated artifacts. A clean Vercel deployment from Git may fail or run stale code unless imports and generated artifacts are cleaned up.
- Catalog fragmentation: storefront list, product detail, and server payment catalog read different JSON files.
- Product detail mismatch: product list data does not consistently include `slug`, while product detail depends on slug lookup.
- Cart model is product-id based, not SKU/variant based.
- Checkout UI has hidden/unrendered customer form fields, leaving payment disabled in the current flow.
- Checkout sends a raw client-calculated amount to the payment API instead of server-calculated SKU/quantity line items.
- Webhook records orders but production Blob storage is public and not appropriate as the long-term order system of record.
- Inventory decrement is currently a no-op.
- Footer and nav contain placeholder links for search, account, policy, and help pages.
- Category routes contain placeholder collection content.

### 4.3 Brownfield Constraints

- Preserve useful existing visual assets and product images.
- Avoid deleting or reverting untracked/generated files unless explicitly approved.
- Move toward TypeScript source as canonical runtime code.
- Keep scope narrow enough for fast launch.
- Avoid introducing complex backend infrastructure until there is a specific need.
- Use boring, managed services for payments, database, auth, file storage, and email.

## 5. Goals

### 5.1 MVP Business Goals

- Stop depending on Shopify for basic direct-store ordering.
- Sell current Zephyr Lux products from the owned domain.
- Accept real customer payments securely.
- Record paid orders reliably.
- Notify the owner immediately when an order is paid.
- Allow the owner to view orders and mark them fulfilled/shipped.
- Send customers a useful confirmation email and order status.

### 5.2 Product Goals

- Make product buying feel trustworthy and straightforward.
- Keep customer checkout friction low.
- Keep owner admin flows simple enough to use from a phone.
- Support product variants from day one: SKU, size, color, price, inventory, images.
- Support future product variety without data rewrites.
- Support future subscription products without changing the core order model.

### 5.3 Technical Goals

- Establish Supabase as system of record for catalog, customers, orders, inventory, fulfillment status, and uploaded shipment photos.
- Use Stripe as payment processor and future subscription billing provider.
- Use Vercel for frontend and lightweight API routes.
- Defer Railway unless long-running background jobs, custom service workers, or heavier fulfillment integrations require it.
- Remove clean-deploy ambiguity from generated JavaScript artifacts.
- Add minimal but meaningful automated tests around order-critical behavior.

## 6. Non-Goals

The following are explicitly out of MVP scope:

- Multi-seller marketplace.
- Shopify-style app marketplace.
- Multi-store or agency dashboard.
- Complex warehouse management.
- Native mobile app before a mobile-friendly admin/PWA.
- Full accounting platform.
- Built-in ad platform.
- Marketplace reviews at Amazon scale.
- Custom payment processing beyond Stripe.
- Full CMS with arbitrary page builders.
- Automated shipping label purchasing in MVP unless chosen later.

## 7. Users and Personas

### 7.1 Customer

The customer visits the Zephyr Lux site from search, social, referral, direct domain, or Amazon brand discovery. They want to understand the product quickly, select size/color, trust the store, pay securely, and know when their order will ship.

Needs:

- Clear product imagery.
- Accurate size/color/price availability.
- Fast mobile shopping.
- Secure checkout.
- Confirmation email.
- Order status and tracking once shipped.

Pain points to avoid:

- Broken product links.
- Confusing variant selection.
- Surprise totals.
- Checkout buttons that are disabled without explanation.
- No order confirmation.
- No tracking.

### 7.2 Store Owner / Operator

The owner manages the direct site, receives orders, ships items, and updates order status. The owner needs confidence that every paid order is visible and actionable.

Needs:

- Immediate order notification.
- Simple order dashboard.
- Order detail with customer address, line items, payment state, and fulfillment state.
- Mark shipped, add carrier/tracking number, upload shipment or label photo.
- Product and inventory editing.
- Low maintenance overhead.

Pain points to avoid:

- Missing webhook events.
- Paid orders not recorded.
- Manual catalog edits in multiple files.
- Needing a laptop for every fulfillment task.
- No audit trail for order changes.

### 7.3 Returning Customer

The returning customer may not need a full account initially. They need a way to find an order by email/order number and eventually reorder or subscribe.

Needs:

- Order lookup.
- Tracking status.
- Reorder path.
- Future saved addresses or passwordless account.

### 7.4 Future Fulfillment Helper

A future helper may ship orders but should not edit payments, products, or settings.

Needs:

- Restricted admin role.
- View open orders.
- Mark packed/shipped.
- Upload shipment photos.

## 8. Product Scope by Release

### Release 0: Brownfield Stabilization

Purpose: Make the existing repo reliable enough for ecommerce work.

Includes:

- Resolve `.js`/`.tsx` runtime confusion.
- Ensure clean Git checkout builds on Vercel.
- Decide canonical source files.
- Clean essential lint errors or define temporary lint baseline.
- Add environment documentation.
- Add shared commerce types.

Exit criteria:

- `npm run build` passes from clean checkout.
- Frontend imports TypeScript source or intentionally committed compiled artifacts.
- Product list and product detail read from a single catalog adapter.

### Release 1: End-to-End Order MVP

Purpose: A real customer can place a paid order, and the owner can fulfill it manually.

Includes:

- Unified catalog with variants/SKUs.
- Product detail with variant selection.
- Cart keyed by SKU.
- Stripe checkout/payment flow.
- Supabase order persistence.
- Stripe webhook idempotency.
- Owner email notification.
- Customer confirmation email.
- Owner admin order dashboard.
- Mark order as shipped with tracking.

Exit criteria:

- A test order can be completed end to end.
- Paid order appears in Supabase and admin.
- Owner receives notification.
- Customer receives confirmation.
- Duplicate webhook does not duplicate order.
- Owner can mark shipped.

### Release 2: Launch Polish

Purpose: Make the store credible and comfortable for real traffic.

Includes:

- Homepage.
- Collection page.
- Product page UX polish.
- Footer policy links.
- Return/refund/shipping/privacy/terms pages.
- Mobile layout verification.
- SEO metadata and product structured data.
- Basic analytics.
- Error states and empty states.
- Basic E2E tests.

Exit criteria:

- Store can be linked publicly without obvious placeholder content.
- Main mobile flows are usable.
- Policy pages exist.
- Critical order path has automated smoke coverage.

### Release 3: Owner Mobile Admin / PWA

Purpose: Let owner operate fulfillment from phone.

Includes:

- Mobile admin layout.
- Push or email/SMS order notifications.
- Camera upload for shipment label/package photos.
- Quick filters: paid, unfulfilled, shipped, needs attention.
- Fulfillment activity timeline.

Exit criteria:

- Owner can handle a new order from phone without desktop.

### Release 4: Growth Features

Purpose: Improve retention and operations after MVP.

Includes:

- Subscription products through Stripe Billing.
- Customer order lookup.
- Customer passwordless account.
- Reorder flow.
- Discount codes.
- Inventory low-stock notifications.
- Amazon MCF or other fulfillment integration.
- Shipping-label purchase integration.

Exit criteria:

- Growth features can be added without rewriting catalog/order/payment foundations.

## 9. Functional Requirements

Priority definitions:

- P0: Required for first safe end-to-end order.
- P1: Required before public launch comfort.
- P2: Valuable soon after launch.
- P3: Future-ready extension.

### 9.1 Catalog and Product Management

FR-CAT-001 P0: The system must maintain a single canonical product catalog.

Acceptance criteria:

- Product list, product detail, cart, checkout, and payment API all use the same product/variant source.
- No production-critical price or SKU logic depends on divergent JSON files.
- Product data supports a migration path from JSON to Supabase.

FR-CAT-002 P0: Each product must have a stable slug.

Acceptance criteria:

- Product cards link to `/product/:slug`.
- Product detail returns a clear not-found state for unknown slugs.
- Slugs are unique.

FR-CAT-003 P0: Each purchasable option must be represented as a variant with SKU.

Acceptance criteria:

- Variant includes SKU, product ID, size, color, price, currency, inventory quantity, active status, and image mapping.
- Cart items reference SKU or variant ID, not only product ID.
- Checkout line items reference SKU or variant ID.

FR-CAT-004 P0: Product price must be server-authoritative during checkout.

Acceptance criteria:

- Customer-visible prices may render client-side.
- Payment amount must be recomputed server-side from catalog/variant records.
- Client cannot override price by editing request body.

FR-CAT-005 P1: Owner must be able to add and edit products from admin.

Acceptance criteria:

- Owner can create product title, slug, description, category, care details, fabric details, images, and active status.
- Owner can create/edit variants and inventory.
- Admin validates required fields.
- Slug conflicts are prevented.

FR-CAT-006 P1: Product images must support multiple images per product.

Acceptance criteria:

- Product detail has gallery.
- Admin can upload product images.
- Images are stored in Supabase Storage or another agreed managed asset store.
- Primary image can be selected.

FR-CAT-007 P2: Product inventory must support manual adjustment history.

Acceptance criteria:

- Owner can increase/decrease stock.
- Each adjustment records reason, timestamp, actor, variant, and delta.
- Paid orders create inventory movement records.

### 9.2 Storefront Browse Experience

FR-SF-001 P0: Customer must be able to view all active products.

Acceptance criteria:

- `/products` lists active products only.
- Inactive products are hidden from storefront.
- Empty state appears if no products are active.

FR-SF-002 P0: Customer must be able to view a product detail page.

Acceptance criteria:

- Product page shows title, images, price/range, fabric, care, size/color options, availability, add-to-cart, shipping/returns trust text, and product description.
- Add-to-cart is disabled until required variant options are selected.
- Out-of-stock variant cannot be added.

FR-SF-003 P1: Storefront must include a real homepage.

Acceptance criteria:

- Homepage communicates Zephyr Lux brand and current product focus.
- Homepage routes customers to product/collection pages.
- No placeholder category cards remain.

FR-SF-004 P1: Storefront must support category/collection pages.

Acceptance criteria:

- Category routes correspond to real product collections.
- Empty categories show a polished empty/coming-soon state or are hidden from nav.

FR-SF-005 P2: Storefront should support search/filtering.

Acceptance criteria:

- Customer can filter by category, size, color, availability, and price range.
- Search icon in nav opens a real search UI or is removed until ready.

### 9.3 Cart

FR-CART-001 P0: Customer must be able to add selected variants to cart.

Acceptance criteria:

- Cart item identity is SKU/variant ID.
- Adding same SKU increments quantity.
- Adding different size/color creates distinct cart item.

FR-CART-002 P0: Customer must be able to update cart quantity.

Acceptance criteria:

- Quantity can be increased/decreased.
- Quantity cannot go below 1 except via remove.
- Quantity cannot exceed available stock if inventory checking is enabled at cart time.

FR-CART-003 P0: Cart must persist across page reloads.

Acceptance criteria:

- Guest cart persists in local storage or Supabase anonymous cart strategy.
- Invalid/stale cart items are reconciled before checkout.

FR-CART-004 P0: Cart must show accurate subtotal from current catalog.

Acceptance criteria:

- Cart display recalculates using current variant price.
- If variant is inactive or out of stock, cart shows warning and blocks checkout for that item.

FR-CART-005 P1: Cart must have mobile-friendly layout.

Acceptance criteria:

- Cart is usable on 320px width.
- Product image, name, variant, price, quantity, and remove action are readable.

### 9.4 Checkout

FR-CHK-001 P0: Customer must be able to start checkout from a non-empty valid cart.

Acceptance criteria:

- Empty cart cannot create payment intent/session.
- Invalid cart explains what needs to be fixed.

FR-CHK-002 P0: Checkout must collect required customer contact and shipping information.

Acceptance criteria:

- Required fields include email, name, shipping address, city, state/region, postal code, country.
- Validation errors are visible and actionable.
- Data is saved to order/customer records after successful payment.

FR-CHK-003 P0: Checkout must create a Stripe payment using server-calculated line items.

Acceptance criteria:

- Frontend sends variant IDs/SKUs and quantities.
- Server fetches current product/variant price.
- Server creates Stripe PaymentIntent or Checkout Session.
- Payment metadata includes order/cart reference, not oversized full order data.

FR-CHK-004 P0: Checkout must handle payment success, failure, and cancellation.

Acceptance criteria:

- Success redirects to order confirmation.
- Failure displays recoverable error.
- Cancellation returns to cart without losing items.

FR-CHK-005 P1: Checkout should use Stripe Checkout Session unless custom embedded checkout is justified.

Acceptance criteria:

- Architecture decision records whether Stripe Checkout or Payment Element is used.
- If Checkout Session is used, line items and customer/shipping settings are configured server-side.

FR-CHK-006 P1: Shipping and tax must be clear to customer before payment.

Acceptance criteria:

- MVP may use flat-rate shipping and clear tax assumptions.
- Future tax automation path is documented.
- Order totals match Stripe totals.

### 9.5 Payments

FR-PAY-001 P0: Stripe secret keys must never be exposed to browser.

Acceptance criteria:

- Only publishable key is exposed in frontend env.
- Secret key exists only in Vercel environment variables.

FR-PAY-002 P0: Stripe webhook must be source of truth for paid order confirmation.

Acceptance criteria:

- UI success alone does not mark order paid.
- Webhook validates signature.
- Webhook records payment success/failure.

FR-PAY-003 P0: Webhook processing must be idempotent.

Acceptance criteria:

- Duplicate Stripe event IDs do not create duplicate orders.
- Duplicate payment events do not duplicate inventory decrement.

FR-PAY-004 P1: Refund/cancellation state must be representable.

Acceptance criteria:

- Data model includes refunded, partially refunded, canceled, and payment_failed states.
- Admin can see payment state clearly.
- Full refund execution may remain manual in Stripe Dashboard for MVP.

FR-PAY-005 P3: Subscriptions must use Stripe Billing.

Acceptance criteria:

- Subscribe-and-save products are modeled separately from one-time products.
- Customer subscription lifecycle events are captured by webhook.
- Customer can manage subscription through Stripe customer portal or future account page.

### 9.6 Orders

FR-ORD-001 P0: A paid order must be recorded in Supabase.

Acceptance criteria:

- Order record includes order number, customer, email, shipping address, totals, currency, payment provider, payment reference, payment status, fulfillment status, timestamps.
- Order items include product snapshot, variant snapshot, SKU, quantity, unit price, and total.

FR-ORD-002 P0: Order number must be human-readable.

Acceptance criteria:

- Order number follows a stable format, e.g. `ZLX-YYYYMMDD-####`.
- Order number is unique.
- Customer emails and admin screens show order number.

FR-ORD-003 P0: Order confirmation page must show meaningful order information.

Acceptance criteria:

- Shows order number, customer email, items, total, and current status.
- If page is refreshed directly, system can fetch order by secure reference or instruct customer to check email.

FR-ORD-004 P1: Order lifecycle must support fulfillment statuses.

Required statuses:

- `pending_payment`
- `paid`
- `processing`
- `packed`
- `shipped`
- `delivered`
- `canceled`
- `refunded`
- `partially_refunded`

Acceptance criteria:

- Admin can transition paid orders through fulfillment statuses.
- Invalid transitions are prevented or warned.

FR-ORD-005 P1: Order history must preserve product snapshots.

Acceptance criteria:

- If product title/price changes later, old orders still display purchased item details.

### 9.7 Owner Notifications

FR-NOT-001 P0: Owner must receive notification when a paid order is created.

Acceptance criteria:

- Email notification includes order number, customer name/email, total, items, shipping address, and admin link.
- Notification is sent only after payment success.
- Notification failure is logged and retryable.

FR-NOT-002 P1: Customer must receive order confirmation email.

Acceptance criteria:

- Email includes order number, order summary, shipping address, support contact, and next-step messaging.
- Email is not sent before payment success.

FR-NOT-003 P2: Owner should receive optional SMS/push notification.

Acceptance criteria:

- Notification channel can be configured.
- Sensitive customer details are limited in SMS/push preview.

FR-NOT-004 P2: Customer should receive shipment notification.

Acceptance criteria:

- When owner marks shipped and adds tracking, customer receives email.
- Email includes carrier/tracking link when available.

### 9.8 Owner Admin

FR-ADM-001 P0: Admin area must be protected.

Acceptance criteria:

- Owner must sign in before viewing admin.
- Unauthorized users cannot access admin data via UI or API.
- Supabase RLS or server-side authorization protects data.

FR-ADM-002 P0: Owner must be able to view paid orders.

Acceptance criteria:

- Admin order list shows order number, date, customer, total, payment status, fulfillment status, item count.
- Owner can filter by unfulfilled orders.

FR-ADM-003 P0: Owner must be able to view order detail.

Acceptance criteria:

- Detail page shows line items, variants/SKUs, customer contact, shipping address, payment status, fulfillment status, order timeline, and notes.

FR-ADM-004 P1: Owner must be able to update fulfillment status.

Acceptance criteria:

- Owner can mark processing, packed, shipped.
- Shipped requires optional carrier/tracking fields.
- Fulfillment changes create timeline events.

FR-ADM-005 P1: Owner must be able to add internal notes.

Acceptance criteria:

- Notes are visible only in admin.
- Notes record actor and timestamp.

FR-ADM-006 P1: Owner must be able to add/edit products and variants.

Acceptance criteria:

- Admin product form supports product and variant fields.
- Product can be active/inactive.
- Variant can be active/inactive or out of stock.

FR-ADM-007 P2: Admin must be mobile-friendly.

Acceptance criteria:

- Owner can view new orders and mark shipped from phone.
- Camera/file upload works on mobile browsers.

### 9.9 Fulfillment Support

FR-FUL-001 P0: Owner must have enough order data to ship manually.

Acceptance criteria:

- Admin order detail shows full shipping address.
- Printable or copy-friendly layout exists.

FR-FUL-002 P1: Owner must be able to add tracking data.

Acceptance criteria:

- Tracking carrier and number fields exist.
- Tracking URL can be generated or entered manually.
- Customer shipment email includes tracking.

FR-FUL-003 P2: Owner must be able to upload shipment/label photos.

Acceptance criteria:

- Admin order detail supports uploading image from phone.
- Image is stored in Supabase Storage.
- Image is attached to order timeline.

FR-FUL-004 P3: System should support Amazon MCF or 3PL integration.

Acceptance criteria:

- Data model can map local SKU to fulfillment SKU.
- Fulfillment provider status can be stored.
- Manual fulfillment remains available if integration fails.

### 9.10 Customer Order Lookup

FR-CUST-001 P2: Customer should be able to look up order status.

Acceptance criteria:

- Customer can enter email and order number.
- System sends secure lookup link or verifies access.
- Order status page shows fulfillment state and tracking.

FR-CUST-002 P3: Customer should have optional passwordless account.

Acceptance criteria:

- Customer can sign in with email magic link/OTP.
- Customer can see order history.
- Guest checkout remains supported.

### 9.11 Content, Policy, and Trust

FR-CONT-001 P1: Store must include required policy pages.

Required pages:

- Shipping policy.
- Returns/refunds policy.
- Privacy policy.
- Terms of service.
- Contact/support page.

Acceptance criteria:

- Footer links route to real pages.
- Checkout/order emails link to relevant policies.

FR-CONT-002 P1: Product pages must include trust information.

Acceptance criteria:

- Shipping estimate or processing time appears.
- Return/refund policy summary appears.
- Fabric/care details appear where available.

FR-CONT-003 P2: Store must support SEO metadata.

Acceptance criteria:

- Product pages have title, description, Open Graph image, and product structured data.
- Homepage and collection pages have meaningful metadata.

### 9.12 Analytics and Observability

FR-AN-001 P1: Owner should see basic commerce metrics.

Acceptance criteria:

- Admin dashboard shows recent orders, total sales, open fulfillment count, low-stock variants.

FR-AN-002 P2: Store should capture frontend analytics.

Acceptance criteria:

- Page views, product views, add-to-cart, checkout-start, purchase events are tracked with privacy-aware analytics.

FR-AN-003 P1: Backend errors must be logged.

Acceptance criteria:

- Payment and webhook errors are logged with correlation IDs.
- Sensitive customer/payment data is not logged.

## 10. Non-Functional Requirements

### 10.1 Security

NFR-SEC-001 P0: Payment processing must remain PCI-light through Stripe-hosted or Stripe-controlled payment fields.

NFR-SEC-002 P0: Supabase service role keys must never be exposed in frontend code.

NFR-SEC-003 P0: Admin APIs must verify admin authorization.

NFR-SEC-004 P0: Webhooks must verify Stripe signatures.

NFR-SEC-005 P1: RLS policies must protect customer/order/admin data.

NFR-SEC-006 P1: Uploaded shipment photos must not be publicly enumerable unless explicitly intended.

### 10.2 Privacy

NFR-PRI-001 P0: Store only customer data required for order fulfillment and support.

NFR-PRI-002 P1: Privacy policy must describe collected data and processors.

NFR-PRI-003 P1: Admin screens must avoid exposing customer data unnecessarily.

### 10.3 Reliability

NFR-REL-001 P0: A successful payment must result in exactly one order record.

NFR-REL-002 P0: Duplicate webhooks must be safe.

NFR-REL-003 P1: Notification failures must not lose the order.

NFR-REL-004 P1: Database backups must be enabled before real launch.

### 10.4 Performance

NFR-PERF-001 P1: Product list should load quickly on mobile.

Target:

- Initial storefront page should feel usable on mobile within 3 seconds on typical 4G.
- Product images should be optimized and appropriately sized.

NFR-PERF-002 P1: Admin order list should remain usable for at least 10,000 orders.

### 10.5 Accessibility

NFR-A11Y-001 P1: Storefront must support keyboard navigation for core flows.

NFR-A11Y-002 P1: Form fields must have labels and visible validation states.

NFR-A11Y-003 P1: Color contrast must be acceptable for product, cart, checkout, and admin screens.

### 10.6 Maintainability

NFR-MAINT-001 P0: TypeScript source should be canonical.

NFR-MAINT-002 P1: Commerce domain types should be centralized.

NFR-MAINT-003 P1: Critical checkout/order logic should have focused tests.

NFR-MAINT-004 P1: Environment variables should be documented by environment.

### 10.7 Deployment

NFR-DEP-001 P0: Vercel production deployment must work from a clean Git checkout.

NFR-DEP-002 P1: Preview deployments should use test Stripe/Supabase environments.

NFR-DEP-003 P1: Production deployment must require production Stripe webhook endpoint configured.

## 11. Recommended Architecture

### 11.1 MVP Architecture

- Vercel hosts React app and API routes.
- Supabase stores catalog, customers, orders, payments, inventory, admin data, notification logs, and shipment images.
- Stripe handles checkout/payment and future subscriptions.
- Resend or SendGrid sends owner and customer emails.
- Optional Twilio sends SMS alerts.

Railway is not required for MVP unless a separate long-running backend or worker is introduced.

### 11.2 Future Architecture Extension

Potential future additions:

- Railway worker for fulfillment polling, scheduled jobs, or MCF integration.
- Shipping provider API such as Shippo/EasyPost for label purchase.
- Stripe Billing for subscriptions.
- PWA push notifications for owner admin.
- Native Expo app if PWA is insufficient.

## 12. Proposed Data Model

This section is intentionally detailed so future architecture and implementation agents can derive schema without guessing.

### 12.1 Products

`products`

- `id` UUID primary key
- `slug` text unique not null
- `title` text not null
- `subtitle` text nullable
- `description` text nullable
- `brand` text default `Zephyr Lux`
- `category` text nullable
- `fabric_type` text nullable
- `care_instructions` text nullable
- `origin` text nullable
- `status` enum: `draft`, `active`, `archived`
- `created_at` timestamp
- `updated_at` timestamp

`product_variants`

- `id` UUID primary key
- `product_id` UUID references products
- `sku` text unique not null
- `size` text nullable
- `color` text nullable
- `price_cents` integer not null
- `currency` text default `usd`
- `inventory_quantity` integer not null default 0
- `low_stock_threshold` integer nullable
- `status` enum: `active`, `inactive`, `discontinued`
- `created_at` timestamp
- `updated_at` timestamp

`product_images`

- `id` UUID primary key
- `product_id` UUID references products
- `variant_id` UUID nullable references product_variants
- `storage_path` text not null
- `alt_text` text nullable
- `sort_order` integer default 0
- `is_primary` boolean default false
- `created_at` timestamp

### 12.2 Customers and Addresses

`customers`

- `id` UUID primary key
- `email` text unique not null
- `first_name` text nullable
- `last_name` text nullable
- `phone` text nullable
- `stripe_customer_id` text nullable
- `created_at` timestamp
- `updated_at` timestamp

`customer_addresses`

- `id` UUID primary key
- `customer_id` UUID references customers
- `name` text nullable
- `line1` text not null
- `line2` text nullable
- `city` text not null
- `state` text not null
- `postal_code` text not null
- `country` text not null
- `phone` text nullable
- `created_at` timestamp

### 12.3 Orders

`orders`

- `id` UUID primary key
- `order_number` text unique not null
- `customer_id` UUID nullable references customers
- `customer_email` text not null
- `customer_name` text nullable
- `payment_status` enum
- `fulfillment_status` enum
- `subtotal_cents` integer not null
- `shipping_cents` integer not null default 0
- `tax_cents` integer not null default 0
- `discount_cents` integer not null default 0
- `total_cents` integer not null
- `currency` text default `usd`
- `shipping_address_json` jsonb not null
- `stripe_payment_intent_id` text nullable
- `stripe_checkout_session_id` text nullable
- `notes` text nullable
- `created_at` timestamp
- `updated_at` timestamp

`order_items`

- `id` UUID primary key
- `order_id` UUID references orders
- `product_id` UUID nullable
- `variant_id` UUID nullable
- `sku` text not null
- `product_title` text not null
- `variant_title` text nullable
- `size` text nullable
- `color` text nullable
- `quantity` integer not null
- `unit_price_cents` integer not null
- `total_cents` integer not null
- `image_url` text nullable
- `created_at` timestamp

`order_events`

- `id` UUID primary key
- `order_id` UUID references orders
- `event_type` text not null
- `message` text nullable
- `metadata` jsonb nullable
- `actor_type` enum: `system`, `owner`, `customer`, `stripe`, `fulfillment_provider`
- `created_at` timestamp

### 12.4 Payments and Webhooks

`payment_events`

- `id` UUID primary key
- `provider` text default `stripe`
- `provider_event_id` text unique not null
- `event_type` text not null
- `processed_at` timestamp nullable
- `payload_hash` text nullable
- `status` enum: `received`, `processed`, `failed`, `ignored`
- `error_message` text nullable
- `created_at` timestamp

### 12.5 Inventory

`inventory_movements`

- `id` UUID primary key
- `variant_id` UUID references product_variants
- `order_id` UUID nullable references orders
- `delta` integer not null
- `reason` enum: `order_paid`, `manual_adjustment`, `return`, `restock`, `correction`
- `note` text nullable
- `created_by` UUID nullable
- `created_at` timestamp

### 12.6 Fulfillment

`shipments`

- `id` UUID primary key
- `order_id` UUID references orders
- `carrier` text nullable
- `tracking_number` text nullable
- `tracking_url` text nullable
- `status` enum: `pending`, `packed`, `shipped`, `delivered`, `returned`
- `shipped_at` timestamp nullable
- `delivered_at` timestamp nullable
- `created_at` timestamp
- `updated_at` timestamp

`shipment_images`

- `id` UUID primary key
- `shipment_id` UUID references shipments
- `order_id` UUID references orders
- `storage_path` text not null
- `image_type` enum: `label`, `package`, `receipt`, `other`
- `created_at` timestamp

### 12.7 Notifications

`notification_logs`

- `id` UUID primary key
- `order_id` UUID nullable references orders
- `recipient` text not null
- `channel` enum: `email`, `sms`, `push`
- `template` text not null
- `status` enum: `queued`, `sent`, `failed`
- `provider_message_id` text nullable
- `error_message` text nullable
- `created_at` timestamp
- `sent_at` timestamp nullable

## 13. UX Requirements

### 13.1 Storefront Information Architecture

Required MVP routes:

- `/`
- `/products`
- `/product/:slug`
- `/cart`
- `/checkout` or Stripe-hosted checkout flow
- `/order-confirmation`
- `/policies/shipping`
- `/policies/returns`
- `/policies/privacy`
- `/policies/terms`
- `/contact`
- `/admin`
- `/admin/orders`
- `/admin/orders/:id`
- `/admin/products`
- `/admin/products/:id`

Future routes:

- `/order-status`
- `/account`
- `/subscriptions`

### 13.2 Storefront Design Direction

The design should feel premium, direct, and product-first. Zephyr Lux sells comfort essentials; the interface should support tactile product understanding and trust.

Principles:

- Product imagery should be large and clear.
- Variant selection should be obvious.
- Checkout path should be calm and minimal.
- Avoid placeholder category pages.
- Avoid SaaS dashboard visual language on customer-facing pages.
- Use trust elements sparingly: secure checkout, shipping, returns, support.
- Mobile must be treated as a primary storefront, not an afterthought.

### 13.3 Product Page Requirements

The product page should include:

- Image gallery.
- Title.
- Review/rating placeholder only if real reviews exist or imported truthfully.
- Price or selected variant price.
- Size selector.
- Color selector.
- Stock state.
- Add to cart.
- Fit/size guide.
- Fabric and care.
- Shipping/returns summary.
- Product benefits.
- FAQ accordion if useful.

### 13.4 Cart Requirements

Cart should include:

- Product image.
- Product title.
- Variant details.
- Quantity controls.
- Price and subtotal.
- Remove item.
- Shipping/tax note.
- Checkout CTA.
- Continue shopping.
- Free shipping threshold only if true.

### 13.5 Admin UX Requirements

Admin must prioritize speed and clarity:

- New paid orders at top.
- Open fulfillment count visible immediately.
- One-tap/click status transitions.
- Copyable shipping address.
- Large touch targets on mobile.
- Minimal decorative UI.
- Clear error states when notification or payment webhook fails.

## 14. Epics

MVP requires Epics 1-5. Epics 6-8 are future-ready extensions.

### Epic 1: Brownfield Stabilization and Deployability

Objective: Make the current app reliable enough for commerce development and deployment.

Scope:

- Resolve `.js`/`.tsx` source confusion.
- Ensure clean checkout build.
- Establish canonical TypeScript imports.
- Document env vars.
- Add shared commerce types.
- Remove or quarantine placeholder flows that break core UX.

Stories:

- E1-S1: Fix runtime imports so clean Vercel deployment uses canonical source.
- E1-S2: Define shared Product, Variant, CartItem, Order, Address, and Payment types.
- E1-S3: Create catalog adapter that can read static data now and Supabase later.
- E1-S4: Document required environment variables for local, preview, production.
- E1-S5: Add minimum smoke test or script for clean build and route availability.

Acceptance:

- Clean clone can run `npm install` and `npm run build`.
- No required runtime code depends on untracked generated JS.
- Developer can understand where product data comes from.

### Epic 2: Commerce Catalog and Product Admin Foundation

Objective: Establish a variant/SKU-based catalog that supports current products and future variety.

Scope:

- Unified product data model.
- Product/variant seed data for current products.
- Storefront product list/detail compatibility.
- Supabase schema or migration path.
- Basic admin product management.

Stories:

- E2-S1: Convert current products to canonical product/variant seed data.
- E2-S2: Product list reads canonical catalog.
- E2-S3: Product detail reads canonical catalog by slug.
- E2-S4: Variant selector supports size/color and price/stock state.
- E2-S5: Supabase tables for products, variants, images, inventory movements.
- E2-S6: Admin can create/edit product and variants.

Acceptance:

- Current Zephyr Lux product(s) can be represented with all purchasable variants.
- Customer cannot add ambiguous product without selected variant.
- Owner has a path to add more product variety.

### Epic 3: Cart and Checkout

Objective: Let customers select products and complete checkout with accurate server-authoritative totals.

Scope:

- SKU-based cart.
- Cart validation.
- Checkout customer/shipping information.
- Stripe checkout/session/payment flow.
- Clear success/cancel/failure handling.

Stories:

- E3-S1: Refactor cart item identity to SKU/variant ID.
- E3-S2: Cart validates stock and active variants before checkout.
- E3-S3: Checkout request sends line items as SKU/quantity.
- E3-S4: Server calculates subtotal from catalog.
- E3-S5: Create Stripe Checkout Session or PaymentIntent with correct totals.
- E3-S6: Confirmation/cancel/failure UI paths.

Acceptance:

- Customer can add variant, checkout, pay in Stripe test mode, and land on order confirmation.
- Client cannot change price.

### Epic 4: Orders, Payments, and Notifications

Objective: Persist paid orders reliably and notify owner/customer.

Scope:

- Supabase order tables.
- Stripe webhook processing.
- Idempotency.
- Customer and owner emails.
- Payment and fulfillment status model.

Stories:

- E4-S1: Create order and order item tables.
- E4-S2: Create payment event table and idempotent webhook processor.
- E4-S3: On payment success, create/update order as paid.
- E4-S4: Decrement inventory exactly once.
- E4-S5: Send owner order notification.
- E4-S6: Send customer confirmation email.
- E4-S7: Log notification status.

Acceptance:

- Stripe webhook creates one paid order for one successful payment.
- Owner receives notification.
- Customer receives confirmation.
- Duplicate webhook does not duplicate order or inventory movement.

### Epic 5: Owner Admin and Manual Fulfillment

Objective: Let owner operate the business without Shopify.

Scope:

- Protected admin.
- Order list/detail.
- Fulfillment status updates.
- Tracking fields.
- Internal notes.
- Mobile-friendly layout.

Stories:

- E5-S1: Add Supabase admin auth.
- E5-S2: Build admin order list.
- E5-S3: Build admin order detail.
- E5-S4: Mark order processing/packed/shipped.
- E5-S5: Add carrier/tracking number.
- E5-S6: Send shipment notification to customer.
- E5-S7: Add internal notes and order timeline.

Acceptance:

- Owner can see new paid order, ship it, add tracking, and customer can be notified.

### Epic 6: Launch UX, Policy, SEO, and Trust

Objective: Make the direct store credible for public customers.

Scope:

- Real homepage.
- Collection pages.
- Product page polish.
- Policy pages.
- Mobile design.
- SEO metadata.

Stories:

- E6-S1: Replace placeholder homepage/category routes.
- E6-S2: Create policy pages and footer links.
- E6-S3: Improve product page gallery and variant UX.
- E6-S4: Improve mobile cart/checkout/admin layouts.
- E6-S5: Add metadata and product structured data.
- E6-S6: Add basic analytics events.

Acceptance:

- No obvious placeholder links/content remain in primary customer path.
- Mobile purchase path is usable.

### Epic 7: Customer Order Lookup

Objective: Reduce support burden by letting customers check order status.

Scope:

- Order lookup by email/order number.
- Secure access link or verification.
- Status/tracking page.

Stories:

- E7-S1: Build order lookup form.
- E7-S2: Send secure lookup link.
- E7-S3: Build customer order status page.
- E7-S4: Show tracking once shipped.

Acceptance:

- Customer can retrieve status without owner manually responding.

### Epic 8: Growth: Subscriptions and Owner Mobile App/PWA

Objective: Prepare for repeat purchases and better mobile operations.

Scope:

- Stripe Billing subscription products.
- Customer subscription management.
- PWA owner admin.
- Push notifications.
- Shipment/photo capture.
- Future native app if needed.

Stories:

- E8-S1: Model subscription-capable products.
- E8-S2: Create Stripe subscription checkout.
- E8-S3: Handle subscription lifecycle webhooks.
- E8-S4: Build mobile-first admin PWA shell.
- E8-S5: Add camera upload for shipment labels/packages.
- E8-S6: Add owner push notification prototype.

Acceptance:

- Subscription path can be launched without rewriting one-time order system.
- Owner can manage fulfillment from phone.

## 15. MVP End-to-End Acceptance Scenario

Scenario: Customer places a paid order and owner ships it.

1. Owner has at least one active product with variants and inventory.
2. Customer visits product page.
3. Customer selects size/color.
4. Customer adds selected variant to cart.
5. Cart shows correct item, variant, quantity, subtotal.
6. Customer starts checkout.
7. Server validates line items and creates Stripe checkout/payment with server-calculated totals.
8. Customer pays successfully in Stripe test mode.
9. Stripe webhook validates event and creates/updates paid order in Supabase.
10. Inventory decrements once.
11. Owner receives order notification email.
12. Customer receives confirmation email.
13. Customer sees order confirmation page.
14. Owner signs into admin.
15. Owner opens order detail.
16. Owner marks order shipped and adds tracking.
17. Customer receives shipment notification.
18. Order timeline reflects payment, notification, and shipment events.

## 16. Success Metrics

### MVP Readiness Metrics

- 100% of Stripe test orders create exactly one Supabase order.
- 100% of paid test orders notify owner.
- 100% of paid test orders send customer confirmation.
- 0 critical placeholder links in customer purchase path.
- Clean production build from Git.

### Business Metrics

- Conversion rate from product view to purchase.
- Checkout start rate.
- Checkout completion rate.
- Average order value.
- Repeat purchase rate.
- Fulfillment time from paid to shipped.
- Number of support emails per order.

### Operational Metrics

- Webhook processing failures.
- Notification failures.
- Open unfulfilled orders.
- Low-stock variants.
- Admin mobile usage.

## 17. Risks and Mitigations

Risk: Payment succeeds but order is not recorded.  
Mitigation: Stripe webhook is source of truth, payment event table, idempotent processing, alert on webhook failure.

Risk: Client manipulates price.  
Mitigation: Server calculates totals from canonical catalog.

Risk: Owner misses an order.  
Mitigation: Owner email notification, admin open-order dashboard, optional SMS/push later.

Risk: Catalog inconsistency causes wrong item/order.  
Mitigation: Single canonical catalog and SKU-based cart/order items.

Risk: Supabase RLS accidentally exposes orders.  
Mitigation: Explicit RLS policies, admin API checks, service key only server-side.

Risk: Building native mobile too early slows launch.  
Mitigation: Start with responsive admin/PWA; revisit native app after real operating patterns emerge.

Risk: Fulfillment integrations add complexity before needed.  
Mitigation: Manual fulfillment first; provider integration as Epic 8 or later.

Risk: Shopify replacement misses policy/legal basics.  
Mitigation: Required policy pages in Release 2 before public launch.

## 18. Open Questions

1. Should MVP use Stripe Checkout Session or embedded Payment Element?
2. What email provider should be used: Resend, SendGrid, Postmark, or another?
3. Does the owner want SMS notifications at launch or email only?
4. What is the initial shipping policy: flat rate, free threshold, manual estimate, or carrier-calculated?
5. Will Amazon inventory be used for direct-site fulfillment initially?
6. Should product admin be included in first launch, or is seed/migration acceptable for first week?
7. Are real product reviews available and permitted to display?
8. What return/refund policy should be shown?
9. Which domain/subdomain will host admin, if separate?
10. Should customer accounts be deferred in favor of guest checkout plus order lookup?

## 19. Implementation Guidance for Dev Agents

Agents should not attempt to implement all epics at once. Work should be story-sized with clear ownership.

Recommended sequencing:

1. Stabilize build/imports and types.
2. Unify catalog and variants.
3. Refactor cart around SKU/variant.
4. Build Stripe checkout using server-priced line items.
5. Add Supabase schema and webhook order persistence.
6. Add owner/customer notifications.
7. Build admin order list/detail and fulfillment.
8. Polish storefront UX and policy pages.

Agent guardrails:

- Do not build multi-seller abstractions.
- Do not invent a full CMS before product/admin forms are needed.
- Do not use client-submitted amount for real payment totals.
- Do not store production orders in public blobs.
- Do not expose Supabase service role key in browser.
- Do not remove existing user changes without explicit instruction.
- Keep current product assets unless replacing with better approved assets.
- Prefer mobile-friendly owner admin over native app until PWA limits are known.

## 20. BMAD Next Artifacts

Recommended next BMAD outputs:

1. Architecture document for Supabase/Stripe/Vercel implementation.
2. UX design specification for customer storefront and owner admin.
3. Epics and stories document derived from this PRD.
4. Implementation readiness report.
5. Sprint plan for MVP Epics 1-5.

## 21. Definition of Done for MVP

MVP is done when:

- Clean deployment builds from Git.
- Current products exist as active products with variants/SKUs.
- Customer can complete paid test checkout.
- Stripe webhook creates exactly one paid order.
- Order persists in Supabase with item snapshots.
- Owner receives order notification.
- Customer receives confirmation.
- Owner can view order in protected admin.
- Owner can mark shipped and add tracking.
- Customer can receive shipment update.
- Product/cart/checkout/admin flows work on mobile.
- Required policy pages exist.
- At least one automated smoke or E2E test covers the critical order flow.

