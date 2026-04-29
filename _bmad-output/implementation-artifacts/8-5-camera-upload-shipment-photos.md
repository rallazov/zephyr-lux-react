# Story 8.5: Camera upload for shipment labels/packages

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[5-5](5-5-carrier-tracking-fields.md)** creates `shipments` and admin order-detail tracking UI.
- **[5-7](5-7-internal-notes-order-timeline.md)** establishes admin-only timeline behavior and warns that internal/admin artifacts must not leak to customers.
- **[8-4](8-4-admin-pwa-shell.md)** improves mobile installability, but camera upload should still work in normal mobile browsers.

## Story

As a **store owner shipping from a phone**,
I want **to capture or upload shipment label/package photos from admin order detail**,
so that **I can keep fulfillment evidence attached to the order timeline without storing private images in public, enumerable locations**.

## Acceptance Criteria

1. **`shipment_images` persistence and private storage**  
   **Given** Supabase is the system of record **when** migrations run **then** `shipment_images` exists with the PRD shape: `id`, `shipment_id` FK, `order_id` FK, `storage_path`, `image_type` (`label`/`package`/`receipt`/`other`), and `created_at`. Add indexes for order/shipment lookup. Create or document a private Supabase Storage bucket for shipment images. Uploaded shipment photos must not be publicly enumerable unless product explicitly changes that policy (**NFR-SEC-006**).

2. **Admin-only upload API**  
   **Given** the owner is signed into admin **when** they upload an image **then** a server endpoint such as `POST /api/admin-shipment-image` verifies the Supabase Bearer JWT/admin role, validates order/shipment ownership, writes to Supabase Storage using service role, and inserts `shipment_images`. Browser code must not use service role keys and must not write directly to a public bucket.

3. **Mobile camera/file UX**  
   **Given** the owner opens an order detail page on a phone **when** the order has or can resolve a shipment row **then** the UI exposes a labeled file input or button with `accept="image/*"` and mobile camera affordance such as `capture="environment"` where supported. The owner can choose image type (`label`, `package`, `receipt`, `other`), see upload progress/busy/error states, and retry failures.

4. **Validation and storage hygiene**  
   **Given** a file is submitted **when** the API parses it **then** enforce a documented max size, allowed MIME types (`image/jpeg`, `image/png`, `image/webp` unless product narrows it), and a non-enumerable storage path such as `shipment-images/{order_id}/{uuid}.{ext}`. Do not trust filename extension alone. Avoid logging raw filenames or customer details.

5. **Admin timeline/display**  
   **Given** shipment images exist **when** admin order detail loads **then** display image entries in the admin timeline or a dedicated shipment evidence section with image type, timestamp, and short-lived signed preview URLs if previews are needed. Customer order status pages and transactional emails must not expose shipment photos unless a later story explicitly allows it.

6. **Security and privacy**  
   **Given** shipment images may contain labels, addresses, and tracking barcodes **when** URLs are generated **then** use signed URLs with short TTL for admin previews. Do not include storage paths in public customer APIs. RLS/storage policies must deny anon access.

7. **Testing**  
   **Given** the story is complete **when** tests run **then** cover API auth failures, invalid file type/size, missing shipment/order, successful storage insert, signed URL mapping, and UI validation/progress behavior. Add migration/storage policy review notes if full storage integration cannot run in Vitest.

## Tasks / Subtasks

- [x] **Task 1 - Migration and storage policy (AC: 1, 6)**  
  - [x] Add `shipment_images` table and enum/check constraints.
  - [x] Add/private document the Supabase Storage bucket and policies.
  - [x] Allow admin reads and service-role writes; deny anon.

- [x] **Task 2 - Admin upload API (AC: 2, 4)**  
  - [x] Add `api/admin-shipment-image.ts` with multipart/form-data parsing or a signed-upload flow.
  - [x] Verify admin JWT using the existing `verifyAdminJwt` pattern.
  - [x] Validate order/shipment IDs, MIME, size, and image type.
  - [x] Insert `shipment_images` after storage upload succeeds; clean up partial uploads where feasible.

- [x] **Task 3 - Admin order detail UI (AC: 3, 5)**  
  - [x] Extend `src/admin/AdminOrderDetail.tsx` or child component with upload controls.
  - [x] Use `accept="image/*"` and mobile camera capture affordance.
  - [x] Show existing uploaded images/evidence using signed URLs from an admin-safe endpoint/helper.

- [x] **Task 4 - Timeline and privacy boundaries (AC: 5, 6)**  
  - [x] Add admin-only timeline/evidence entries.
  - [x] Confirm `api/customer-order-status.ts` does not return shipment images.
  - [x] Document that labels/package photos are not customer-visible.

- [x] **Task 5 - Tests (AC: 7)**  
  - [x] Add handler tests with mocked Supabase Storage.
  - [x] Add UI tests for validation/progress/error states where practical.
  - [x] Run focused tests plus `npm run build`.

## Dev Notes

### Story intent

This story turns the PRD’s “camera upload for shipment label/package photos” into private fulfillment evidence. Treat these images as sensitive operational data: labels can contain addresses, barcodes, and tracking numbers.

### Dev Agent Guardrails

- Do **not** store shipment images in `public/`, Vercel Blob public paths, or publicly enumerable Supabase buckets.
- Do **not** expose shipment images through `api/customer-order-status.ts` or customer emails.
- Do **not** require PWA install for upload; normal mobile browser file input should work.
- Do **not** use a client-side Supabase service role key.

### Architecture compliance

| Concern | Requirement |
|---------|-------------|
| Storage | Supabase Storage, private bucket |
| API | Admin JWT verified, service-role server writes |
| Data model | `shipment_images` table from PRD §12.6 |
| UX | Mobile camera/file upload in admin order detail |

### File structure expectations

| Action | Paths |
|--------|-------|
| New | `supabase/migrations/YYYYMMDDHHMMSS_shipment_images.sql` |
| New | `api/admin-shipment-image.ts` and tests |
| New/update | `src/domain/commerce/shipmentImage.ts` |
| Update | `src/admin/AdminOrderDetail.tsx` or child component |
| Verify | `api/customer-order-status.ts` remains image-free |

### Previous story intelligence

- **[5-5](5-5-carrier-tracking-fields.md)** uses `api/admin-shipment.ts` for service-role shipment writes; mirror its auth style.
- **[7-3](7-3-customer-order-status-page.md)** has a deliberately narrow customer serializer. Do not widen it to include image evidence.
- **[5-7](5-7-internal-notes-order-timeline.md)** separates admin-only events from customer-safe timeline data.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) §5.3, §7.2, §9.8 `FR-ADM-007`, §9.9 `FR-FUL-003`, §10.1 `NFR-SEC-006`, §12.6, and Epic 8.
- [`epics.md`](../planning-artifacts/epics.md) `FR-FUL-003` and shipment image data model notes.
- [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) device capability/camera notes.

## Dev Agent Record

### Agent Model Used

Cursor agent

### Debug Log References

—

### Completion Notes List

- Added private Storage bucket `shipment-images`, `shipment_images` RLS (admin SELECT only), and storage object policy for authenticated admin read; uploads via service role in `POST /api/admin-shipment-image` only (multipart `busboy`, magic-byte MIME, 4 MiB cap).
- `GET /api/admin-shipment-images?order_id=` returns rows with short-lived signed preview URLs (300s). Customer order status path unchanged; serializer test asserts JSON has no shipment evidence keys.
- Admin UI: `ShipmentEvidencePanel` under Shipment & tracking — `capture="environment"`, type select, upload busy/error/success; requires paid+shipped and existing `shipments` row (save tracking first).

### File List

- package.json
- package-lock.json
- supabase/migrations/20260430160000_shipment_images.sql
- src/domain/commerce/shipmentImage.ts
- src/domain/commerce/index.ts
- api/_lib/shipmentImageBytes.ts
- api/_lib/shipmentImageBytes.test.ts
- api/admin-shipment-image.ts
- api/admin-shipment-image.test.ts
- api/admin-shipment-images.ts
- api/admin-shipment-images.test.ts
- api/_lib/customerOrderStatus.test.ts
- src/admin/ShipmentEvidencePanel.tsx
- src/admin/ShipmentEvidencePanel.test.tsx
- src/admin/AdminOrderDetail.tsx

## Change Log

- 2026-04-28 - Story created (bmad-create-story). Target: PRD E8-S5; mobile shipment photo upload.
- 2026-04-28 - Implemented shipment image persistence, admin APIs, order-detail evidence UI, tests; story ready for review.

## Story completion status

Status: **review**  
Implementation complete; run migrations and apply Supabase remote so Storage bucket and table exist.
