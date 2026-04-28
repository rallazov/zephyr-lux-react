# Story 7.4: Show tracking when shipped

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[7-3](7-3-customer-order-status-page.md)** provides the token-protected status API and page.
- **[5-5](5-5-carrier-tracking-fields.md)** provides `shipments` persistence, one row per order, and tracking URL derivation semantics.
- **[5-6](5-6-customer-shipment-notification.md)** already emails customers when shipped; this story keeps the status page consistent with that fulfillment path.

## Story

As a **customer viewing my order status**,
I want **tracking details to appear once my order has shipped**,
so that **I can follow delivery progress without contacting support**.

## Acceptance Criteria

1. **Tracking source of truth**  
   **Given** an order has a linked `shipments` row **when** the customer status API from Story 7-3 loads the order **then** it reads tracking from `shipments` by `order_id`, using the exact Epic 5 columns: `carrier`, `tracking_number`, `tracking_url`, `status`, `shipped_at`, and `delivered_at`. Do not read tracking from order notes, notification email bodies, Stripe metadata, or `order_events.metadata`.

2. **Only visible once shipped**  
   **Given** the order is still `processing` or `packed` **when** the customer opens the status page **then** do not show carrier/tracking fields as if a package exists. **Given** `orders.fulfillment_status` is `shipped` or `delivered` **and** a shipment row exists **then** the API may return a `tracking` object and the page shows a tracking section. If shipped but no carrier/number/url exists yet, show a clear "tracking details are not available yet" state instead of an empty panel.

3. **Safe tracking links**  
   **Given** `tracking_url` is present **when** rendered **then** only render it as a clickable link if it is an `http` or `https` URL. Use `target="_blank"` with `rel="noreferrer noopener"` for external carrier links. If `tracking_url` is missing but carrier + tracking number are present, reuse [`deriveTrackingUrlFromCarrier`](../../src/domain/commerce/trackingUrl.ts) rather than inventing a second carrier mapping.

4. **Customer-safe response shape**  
   **Given** tracking is included in the Story 7-3 status API **when** JSON is returned **then** include only customer-safe fields: `carrier`, `tracking_number`, `tracking_url`, `status`, `shipped_at`, `delivered_at`. Do not include shipment row `id`, internal timestamps unless needed for display, admin actor IDs, notification logs, or raw Supabase errors.

5. **UI behavior**  
   **Given** the page renders shipped tracking **when** viewed on mobile or desktop **then** show a compact tracking section with carrier, tracking number, link/button if safe, and shipped/delivered dates when present. The section must not overlap item totals or timeline content and must remain readable at narrow widths.

6. **Email/status consistency**  
   **Given** [`maybeSendCustomerShipmentNotification`](../../api/_lib/customerShipmentNotification.ts) already loads `shipments` for the shipment email **when** this story is implemented **then** keep the same source-of-truth and URL-safety semantics. Do not trigger or resend shipment emails from the status page.

7. **Testing**  
   **Given** implementation is complete **when** tests run **then** cover API serialization for unshipped, shipped-without-tracking, shipped-with-tracking, delivered, unsafe URL, and derived carrier URL cases. Add component/view-model tests for hidden, empty, and populated tracking states.

## Tasks / Subtasks

- [ ] **Task 1 - Extend status API serializer (AC: 1, 2, 4)**  
  - [ ] Update the Story 7-3 API to load the unique `shipments` row by `order_id`.
  - [ ] Gate returned tracking by order fulfillment status (`shipped` / `delivered`) and shipment availability.
  - [ ] Return a narrow `tracking` object, not raw shipment rows.

- [ ] **Task 2 - URL safety and derivation (AC: 3, 6)**  
  - [ ] Reuse [`deriveTrackingUrlFromCarrier`](../../src/domain/commerce/trackingUrl.ts) if a manual URL is missing.
  - [ ] Add/centralize an `isSafeHttpUrl` helper if one does not already exist in a reusable place. `customerShipmentNotification.ts` has a local safe URL helper; consider extracting rather than duplicating.
  - [ ] Never render `javascript:`, `data:`, or malformed URLs as links.

- [ ] **Task 3 - Status page UI (AC: 2, 5)**  
  - [ ] Add a tracking section/card/block to the customer order status page.
  - [ ] Show shipped/delivered date labels with customer-friendly formatting.
  - [ ] Preserve existing order header, item list, and safe timeline layout from Story 7-3.

- [ ] **Task 4 - Tests (AC: 7)**  
  - [ ] API serializer tests for tracking gates and safe response shape.
  - [ ] Pure URL helper tests if extracting URL safety.
  - [ ] Component/view-model tests for tracking hidden/empty/populated states.

## Dev Notes

### Story intent

Story 7-3 answers "what is happening with my order?" This story answers "where is my package?" It should feel like a natural extension of the status page, while keeping all shipment reads behind the same secure token boundary.

### Dev Agent Guardrails

- Do **not** open public RLS on `shipments`; keep reads inside the token-verified API.
- Do **not** duplicate carrier URL mapping if [`trackingUrl.ts`](../../src/domain/commerce/trackingUrl.ts) already covers USPS/UPS/FedEx behavior from Story 5-5.
- Do **not** mutate fulfillment status or shipment rows from this customer page.
- Do **not** expose admin-only shipment internals, notification logs, or owner notes.

### Technical requirements

| Area | Requirement |
|------|-------------|
| Data source | `shipments` table from [`20260428180000_shipments.sql`](../../supabase/migrations/20260428180000_shipments.sql) |
| Gating | Show tracking only for customer-visible shipped/delivered states |
| URL safety | `http`/`https` only; safe external-link attributes |
| Reuse | `deriveTrackingUrlFromCarrier`, `formatCents`, existing status API serializer |
| Tests | Vitest API + view-model/component coverage |

### File structure expectations

| Action | Paths |
|--------|-------|
| Update | `api/customer-order-status.ts` from Story 7-3 |
| Update | `src/order-status/CustomerOrderStatusPage.tsx` and view-model helper |
| Optional update | Extract URL safety helper from [`api/_lib/customerShipmentNotification.ts`](../../api/_lib/customerShipmentNotification.ts) if reuse is cleaner |
| Tests | API serializer tests, `trackingUrl`/URL-safety tests, order-status component tests |

### Previous story intelligence

- **[5-5](5-5-carrier-tracking-fields.md)**: MVP cardinality is one shipment row per order; writes are server-only; URL derivation helper already exists.
- **[5-6](5-6-customer-shipment-notification.md)**: customer shipment email loads tracking from `shipments` and is idempotent. The status page should read, not send.
- **[7-3](7-3-customer-order-status-page.md)**: tracking must be added to the same sanitized token-protected response, not a separate public lookup.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) FR-CUST-001, FR-FUL-002, and Epic 7.
- [`epics.md`](../planning-artifacts/epics.md) data model: `shipments`.
- [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) returning customer and order lookup guidance.
- No checked-in `project-context.md` matched the create-story persistent facts glob at story creation time.

## Dev Agent Record

### Agent Model Used

-

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-04-28 - Story created (bmad-create-story). Target: PRD E7-S4; tracking display on customer status page.

## Story completion status

Status: **ready-for-dev**  
Ultimate context engine analysis completed - comprehensive developer guide created.
