# Story 6.3: Product page gallery & variant UX polish

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[2-3](2-3-product-detail-by-slug-canonical.md)** — PDP reads via [`getProductBySlug`](../../src/catalog/adapter.ts).  
- **[2-4](2-4-variant-selector-size-color-price-stock.md)** — [`VariantSelector`](../../src/components/ProductDetail/VariantSelector.tsx), [`variantSelection`](../../src/components/ProductDetail/variantSelection.ts), and [`pdpCta`](../../src/components/ProductDetail/pdpCta.ts) are authoritative for SKU logic — **extend**, don’t rewrite.  
- **`product_images`** / **FR-CAT-006** — multi-image data exists in Supabase; PDP today shows **one** hero [`img`](../../src/components/ProductDetail/ProductDetail.tsx) derived from variant/product images.

## Story

As a **customer**,
I want **a proper image gallery and clearer variant selection on the product page**,
so that **FR-SF-002**, **FR-CAT-006** (storefront side), **UX-DR6**, and PRD **§14 E6-S3** are satisfied on **desktop and mobile**.

## Acceptance Criteria

1. **Image gallery (multi-image)**  
   **Given** a product with **multiple** images from **`product_images`** (product-level and/or variant-attached) **when** PDP loads **then** the customer can **browse** more than one image (thumbnail strip, dots, or swipe on mobile — pick one pattern and stay consistent with **UX-DR4** minimalism). **Given** only **one** image **when** PDP loads **then** gallery UI **degrades gracefully** (no empty controls). **Given** variant change **when** variant-specific image exists **then** gallery **focus** moves to that image **or** clearly surfaces it as primary — **hero URL resolution** **must** follow the **normative precedence** in Dev Notes (**Primary image precedence**) **and** align with **cart line thumbnail** resolution (**same helper** or **documented parity** so PDP hero **never** disagrees with cart preview for the **same** SKU).  
   **Given** **zero** usable images **when** PDP loads **then** show a single **neutral placeholder** (existing asset or branded skeleton) — **no** broken **`img`** icons; **`alt`** text remains meaningful.

2. **Data plumbing**  
   **Given** [`CatalogProductDetail`](../../src/catalog/types.ts) currently wraps **`Product` only** **when** this story ships **then** extend catalog types + [`supabase-map.ts`](../../src/catalog/supabase-map.ts) / adapter **select** to carry **ordered** image URLs **without** breaking [`productSchema`](../../src/domain/commerce/product.ts) validation (prefer **parallel field** on `CatalogProductDetail`, e.g. `galleryImages: string[]`, rather than overloading **`Product`** unless schema intentionally grows). **Given** **static** catalog adapter used in tests **when** fixtures lack gallery **then** **[]** or single hero — tests remain deterministic.

3. **Variant UX polish (UX-DR6)**  
   **Given** size/color selectors **when** displayed **then** meet **keyboard** operability (**NFR-A11Y-001**): focus rings, **`aria-pressed` / `aria-checked`** or native **`input[type="radio"]`** patterns — align with existing **`VariantSelector`** implementation before swapping primitives. **Given** **out-of-stock** combinations **when** shown **then** reuse existing messaging (**[`pdpCta`](../../src/components/ProductDetail/pdpCta.ts)**, stock copy) — **don’t** introduce second conflicting rules.

4. **Trust & product copy blocks**  
   **Given** **UX-DR6** **when** PDP renders **then** add or surface **shipping/processing** and **returns** **summaries** with **`Link`** to **`/policies/shipping`** / **`/policies/returns`** (**ship in same release as [6-2](6-2-policy-pages-footer-links.md)** **or** omit links until routes exist — **no** dead **`Link`** to missing routes). **Given** **`description` / `care_instructions`** **when** present **then** render in readable prose (typography plugin / simple **`prose`** wrapper); **if** stored content may contain HTML **then** sanitize **or** plain-text escape — **never** **`dangerouslySetInnerHTML`** without a reviewed sanitizer policy (**XSS** guardrail). **Given** **fit/size guide** **when** no real content exists **then** **omit** section or single “Size guide coming soon” **only if** it matches UX-DR6 optional wording — prefer **hiding** over fake FAQs.

5. **Responsive layout**  
   **Given** **320px** viewport **when** PDP loads **then** **image + buy box** stack vertically (today CSS grid **`1fr 1fr`** in [`ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) is **not** mobile-first — fix). **Given** **1024px+** **when** viewed **then** two-column **or** intentional single-column premium layout — **document** choice.

6. **Tests**  
   **Given** gallery helpers (pure) **when** factored **then** **Vitest** covers ordering + variant-primary resolution. **Given** **RTL** **when** available **then** at least **one** test that variant selection updates visible **main** image URL (mock catalog).

## Tasks / Subtasks

- [x] **Task 1 — Types + adapter (AC: 2)**  
  - [x] Expand Supabase **select** for `product_images` ordering (`sort_order`, `is_primary`).  
  - [x] Map to `CatalogProductDetail.galleryImages` (or equivalent). Update **static** path.

- [x] **Task 2 — Gallery UI (AC: 1, 5)**  
  - [x] New subcomponent e.g. `ProductImageGallery.tsx` colocated under `ProductDetail/`.  
  - [x] Mobile swipe: CSS scroll-snap **or** minimal touch handlers — avoid heavy deps unless approved.

- [x] **Task 3 — PDP layout + trust (AC: 4, 5)**  
  - [x] Tailwind `@screen` or CSS grid `minmax` to stack on small viewports.  
  - [x] Trust blocks + policy `Link`s.

- [x] **Task 4 — A11y pass on selectors (AC: 3)**  
  - [x] **`VariantSelector`** audit; fix label / `id` associations per **NFR-A11Y-002**.

- [x] **Task 5 — Tests (AC: 6)**  
  - [x] Unit + optional component tests.

## Dev Notes

### Dev Agent Guardrails

- **Do not** fork price/stock truth — server checkout remains authoritative (**Epic 3**).  
- **Do not** load full-resolution images without **`width`/`height`** or CSS constraints — respect **NFR-PERF-001**.  
- Architecture doc mentions **headless UI** as target for a11y — **if** adding a library, get explicit approval (dependency budget); **prefer** improving **existing** markup first.

### Primary image precedence (normative)

When resolving **hero + gallery ordering** after variant selection:

1. **Variant-attached** primary image **for the selected SKU** (if any).  
2. Else **product-level** gallery **`is_primary` / `sort_order`** from **`product_images`**.  
3. Else **first** gallery URL **or** legacy single **`image_url`** field on variant/product.  
4. Else **placeholder** (see AC1 zero-images).

Document any deviation in Dev Agent Record; unit tests **must** lock steps **1–3** for fixtures.

### Technical requirements

| Source | Requirement |
|--------|-------------|
| PRD §9.1 / §9.2 | FR-CAT-006 (images), FR-SF-002 |
| PRD §14 | E6-S3 |
| epics.md UX | UX-DR6, UX-DR10 |

### File structure expectations

| Action | Paths |
|--------|-------|
| **Update** | [`src/components/ProductDetail/ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx); [`src/catalog/types.ts`](../../src/catalog/types.ts); [`src/catalog/adapter.ts`](../../src/catalog/adapter.ts); [`src/catalog/supabase-map.ts`](../../src/catalog/supabase-map.ts); static catalog |
| **New** | `ProductImageGallery.tsx` (or similar); optional `galleryUtils.ts` |
| **Tests** | New `*.test.ts` / `*.test.tsx` |

### Previous story intelligence

- **Variant auto-select** logic is **subtle** ([`ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) `useEffect` keyed by `purchasableSkuKey`) — gallery must not reset selection on image-only state changes.

### Project context reference

- [`project-context.md`](../../project-context.md) if present.

## Dev Agent Record

### Agent Model Used

Cursor Composer

### Debug Log References

_(none)_

### Completion Notes List

- Extended `CatalogProductDetail` with `galleryImages`, `displayGalleryUrls`, and `variantPrimaryImageBySku`; static catalog fills empty / derived lists; Supabase bundle maps ordered product-level images and per-SKU variant primaries from `product_images`.
- Introduced `resolvePdpHeroImageUrl` in `src/catalog/pdpImage.ts` (steps 1–4 per Dev Notes) for PDP hero and add-to-cart line image parity; SVG data-URI placeholder when no usable URL.
- `ProductImageGallery`: single hero + thumbnail strip with scroll-snap on narrow viewports; variant/`selectionKey` resets manual thumb pick so primary tracks the selected SKU.
- PDP: mobile-first `grid-cols-1` / `lg:grid-cols-2`; trust copy with `Link` to `/policies/shipping` and `/policies/returns`; `description` / `care_instructions` as plain text in Tailwind `prose` blocks (no `dangerouslySetInnerHTML`).
- `VariantSelector`: `fieldset` + `legend`, visible focus rings, `aria-describedby` when color is gated on size.
- **Layout choice (AC 5):** two columns from `lg` breakpoint; single column below.
- **Supabase select:** existing embed already returns `sort_order` / `is_primary`; ordering is applied in `supabase-map` (no PostgREST embed sort required).
- Vitest: `pdpImage.test.ts`, extended `supabase-map.test.ts`, `ProductDetail.gallery.test.tsx` (mock catalog).

### File List

- src/catalog/pdpImage.ts
- src/catalog/pdpImage.test.ts
- src/catalog/types.ts
- src/catalog/parse.ts
- src/catalog/supabase-map.ts
- src/catalog/supabase-map.test.ts
- src/components/ProductDetail/ProductImageGallery.tsx
- src/components/ProductDetail/ProductDetail.tsx
- src/components/ProductDetail/VariantSelector.tsx
- src/components/ProductDetail/ProductDetail.gallery.test.tsx

### Change Log

- 2026-04-27 — Story 6-3: PDP gallery, variant hero resolution, responsive layout, trust/policy links, a11y selector pass, tests.

### Review Findings

- [x] [Review][Patch] Thumbnail strip uses tab ARIA without full tabs pattern [`ProductImageGallery.tsx`](../../src/components/ProductDetail/ProductImageGallery.tsx) — fixed: `role="group"`, thumbnail buttons use `aria-pressed` (no tablist/tab).
- [x] [Review][Defer] PLP list hero still uses first variant `image_url` only [`parse.ts:49`](../../src/catalog/parse.ts) — not required by story 6-3 (AC focuses on PDP/cart parity with `resolvePdpHeroImageUrl`); product cards may disagree with PDP for multi-image products. — deferred, pre-existing
