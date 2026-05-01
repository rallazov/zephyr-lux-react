# Story 9.4: Placeholder catalog expansion (assortment + imagery)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront visitor** evaluating the brand,
I want **more products across real collection categories**, each with **credible visuals** and **honest availability** (`active` vs **not-yet purchasable**),
so that the **browse + collection grids feel substantive** without implying I can checkout items that are not ready ([sprint proposal §4.3 — story 9-4](../planning-artifacts/sprint-change-proposal-2026-04-30.md)).

As the **operator**,
I want **canonical catalog** (`data/products.json`, [`supabase/seed.sql`](../../supabase/seed.sql), and eventual production DB) to mirror **the same merchandising**, so **static**, **seeded**, and **Sup-backed** storefront paths stay aligned ([FR-CAT-001](../planning-artifacts/epics.md)).

## Acceptance Criteria

1. **Prerequisite (hard):** **`coming_soon` listing semantics** exist end-to-end per **Story 9-3** (Postgres enum / `products.status`, Zod [`productStatusSchema`](../../src/domain/commerce/enums.ts), storefront browse filters in [`isStorefrontBrowsableProduct`](../../src/catalog/parse.ts) — or equivalent centralized rule — PLP + PDP badges, waitlist POST, checkout blocked for non-active). **Do not** ship **9-4** on a codebase that cannot **list** and **detail** `coming_soon` products without allowing purchase. If 9-3 is not merged, **implement 9-3 first** or land both in one ordered PR stack.

2. **Given** collection routes defined in [`COLLECTION_ROUTES`](../../src/catalog/collections.ts) (`women`, `men`, `underwear`, `kids`, `sale`), **when** expanded catalog ships, **then** add **at least three net-new products** **beyond** the flagship `boxer-briefs`, distributed so **≥ three distinct canonical category keys** among those routes receive **≥ one browsable listing each** (`CollectionPage` via [`filterListItemsByCategoryKey`](../../src/catalog/filterByCategory.ts)). Existing single-product-catalog empty states must not remain the default perception on `/products` once data is wired.

3. **Given** [sprint change §4.3](../planning-artifacts/sprint-change-proposal-2026-04-30.md) (“mix active + **coming_soon**”), **when** data is seeded, **then** include **both**:  
   - **≥ one** **`active`** product with **≥ one purchasable variant** (`active` variant + **`inventory_quantity` > 0** per [`isPurchasableVariant`](../../src/catalog/parse.ts)), and  
   - **≥ one** **`coming_soon`** product (no falsification of checkout — PDP add-to-cart / cart merge behavior defers entirely to **9-3**; this story verifies no regression).

4. **Given** [**FR-CAT-006**/imagery conventions](../planning-artifacts/epics.md) (`image_url` on static rows; **`product_images.storage_path`** in Supabase seed per [`supabase-map.ts`](../../src/catalog/supabase-map.ts) commentary), **when** each net-new row is authored, **then** assign **explicit** storefront-resolvable URLs (site-relative **`/assets/...`** or Supabase-relative paths consistent with deployed storage/CDN conventions used elsewhere — **never** ambiguous empty strings for deliberate merchandising heroes). Prefer **distinct** visuals per SKU or per product row where it improves credibility; reused paths are acceptable if documented in Dev Agent Record.

5. **Given** **FR-CAT-001** canonical rules, **`data/products.json`** and **`supabase/seed.sql`** must **mirror** slug, titles, subtitles, **`category`** strings (**must normalize consistently** so [`productCategoryMatchesCanonical`](../../src/catalog/categoryNormalize.ts) behaves identically across static vs SQL — **fix legacy drift** between JSON and seed for any touched rows, e.g. confirm `boxer-briefs` category alignment when editing).

6. **Given** storefront performance baseline [**NFR-PERF-001**](../planning-artifacts/epics.md) / [`architecture.md`](../planning-artifacts/architecture.md), **when** enlarging static bundle + seed, **then** catalog size stays **moderate** (no gratuitous duplication of huge blobs in JSON — image paths remain **references**).

7. **Given** QA standards from prior storefront stories (**9-2**, **6-x**), **when** closing, **`npm run build`**, **`npm test`**, and **`npm run smoke`** must pass **and** extend coverage where breakage is likely:
   - If product count assertions or **`/women`/`/products`** snapshots exist, refresh them thoughtfully;  
   - **Optional but recommended:** one RTL or smoke assertion that **`/products`** renders **>** 1 tile after expansion OR that a designated new slug resolves on PDP smoke.

## Tasks / Subtasks

- [x] **Task 0 — Gate / merge hygiene (AC: 1)**  
  - [x] Confirm `coming_soon` path from **9-3** merged; skim migration + enums + PDP/PLP behaviors.

- [x] **Task 1 — Merchandising plan (AC: 2–4)**  
  - [x] Sketch a small matrix: slug × categoryKey × **`active` | `coming_soon`** × hero image paths × SKU strategy (minimal variant rows per product acceptable if valid per schemas).

- [x] **Task 2 — `data/products.json` (AC: 2–6)**  
  - [x] Add net-new storefront rows + assign unique numeric `id`s (≠ **101**) for [`catalogListItemFromProduct`](../../src/catalog/parse.ts) parity.  
  - [x] Extend [`staticSeedCatalogSchema`](../../src/catalog/raw-static.ts) / parsers only if 9-3 introduced new fields (e.g. waitlist-facing flags not on product row).

- [x] **Task 3 — `supabase/seed.sql` (AC: 5–6)**  
  - [x] Insert matching `products`, `product_variants`, and `product_images` with stable deterministic UUID scheme (mirror existing boxer-briefs style or document new block).  
  - [x] Keep currency lowercasing consistent with seed (`usd` lowercase in SQL aligns with Postgres usage today).

- [x] **Task 4 — Optional collection hero realism (AC: 2, 6)**  
  - [x] **Deferred:** no swap of `COLLECTION_ROUTES` hero filenames — no new raster committed under `public/` this pass (optional when assets land).

- [x] **Task 5 — Parity sweep (AC: 5)**  
  - [x] `grep`/`diff` parity: **`handlers/_lib/catalog.ts`** consumes [`data/products.json`](../../data/products.json) — ensure new SKUs slug/title coherence for **`quoteCartLines`** if any checkout tests synthesize payloads with new IDs (unlikely if tests stay boxer-focused).

- [x] **Task 6 — Tests + regression (AC: 7)**  
  - [x] Run full suite + fix brittle counts; optionally add assertions for richer PLP (**do not import production-only secrets**).

## Dev Notes

### Dev Agent Guardrails

- **Single catalog seam:** storefront continues through [`getDefaultCatalogAdapter()`](../../src/catalog/factory.ts) — do **not** introduce parallel JSON loaders for grids.  
- **Category discipline:** **`product.category`** is optional (`z.string().optional()` in [`product.ts`](../../src/domain/commerce/product.ts)); always reconcile with **`categoryNormalize`** + collection keys (`COLLECTION_ROUTES`).  
- **Story boundary:** imagery + assortment + parity — **09-5** owns broader **marketing/tab copy sweep**; **09-6** owns print layouts.  
- **Do not** widen search facets here — **[9-2](9-2-storefront-product-search.md)** already scoped FR-SF-005 minimal slice.

### Technical requirements

- **FR-CAT-001, FR-SF-001, FR-CAT-006** — canonical list/detail data; storefront-only sees browsable statuses per centralized parse rules (**must include `coming_soon` post–9-3**).  
- **UX:** [`UX-DR9`](../planning-artifacts/epics.md) — collection empty states remain valid routes with **honest empties** after expansion (no fictional stock).

### Architecture compliance

- **Stack:** TypeScript SPA + Supabase adapters per [`architecture.md`](../planning-artifacts/architecture.md).  
- **Static bundle:** edits to JSON require rebuild awareness ([`static-bundled.ts`](../../src/catalog/static-bundled.ts)).

### Library / framework requirements

- **None new** unless asset pipeline demands (prefer existing public path references).

### File structure requirements

| Area | Action |
|------|--------|
| [`data/products.json`](../../data/products.json) | **UPDATE** — additive catalog rows (+ category parity fixes if encountered) |
| [`supabase/seed.sql`](../../supabase/seed.sql) | **UPDATE** — mirror JSON semantics |
| [`src/domain/commerce/enums.ts`](../../src/domain/commerce/enums.ts) | **READ ONLY** normally — **`coming_soon`** belongs to **9-3** (`product_status` enum alignment) |
| [`src/catalog/parse.ts`](../../src/catalog/parse.ts) | **READ / MAY UPDATE** only if **`isStorefrontBrowsableProduct`** tightening/bugs surface while importing `coming_soon` — prefer fixes in **9-3**, not duplicate policy forks |
| [`src/catalog/collections.ts`](../../src/catalog/collections.ts) | **OPTIONAL UPDATE** — hero images if swapping placeholder JPEGs |
| `public/` imagery | **LIKELY NEW FILES** — commit raster assets referenced by URLs (currently JSON references **`/assets/img/Listing2.jpeg`**; ensure files exist locally or intentional CDN parity) |

### Testing requirements

- `npm run build`  
- `npm test`  
- `npm run smoke`

### Previous story intelligence

- **[9-2 — Search](9-2-storefront-product-search.md)** — results must stay consistent with **`listProducts`**; new titles/categories should appear in substring search without hard-coded slug lists in tests unless unavoidable.  
- **[9-1 — Pack SKUs](9-1-fixed-assortment-pack-catalog.md)** — preserve **`legacy_storefront_id` / storefront id 101** for flagship continuity; allocate **102+** for expansion rows (`seed.sql` parity).  
- **9-3 (not authored in repo yet):** treat **`coming_soon`** + waitlist as **upstream contract** — read its story file once created before conflicting enum edits.

### Git intelligence summary

- Recent pushes emphasize **premium storefront shell + Navbar** behaviors — assortment changes touch grid density only; preserve scroll/mobile patterns.

### Latest tech information

- **No mandated dependency upgrades.** Image URLs remain standard web paths; defer Next-Gen responsive `<picture>` to future perf story unless trivial.

### Project context reference

- No `project-context.md` surfaced via BMAD persistent-facts glob — rely on **`epics.md`**, **`architecture.md`**, this file, **`sprint-change-proposal-2026-04-30.md`**.

### References

- [Epic 9 appendix — story 9-4](../planning-artifacts/epics.md)  
- [Sprint change §4.3 — sequencing & intent](../planning-artifacts/sprint-change-proposal-2026-04-30.md)  
- [`parseStaticCatalogData`](../../src/catalog/parse.ts)

### Questions / clarifications (non-blocking)

1. Exact **SKU prefix scheme** for new rows (e.g. **`ZLX-WS-001`**) vs functional naming (`ZLX-<category>-NN`).  
2. Whether **`sale`** category should expose **priced promotional** fictitious SKUs or stay **ethical** promotional messaging only (**owner call**).

## Dev Agent Record

### Agent Model Used

GPT-5.2 / Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Confirmed **9-3** primitives present (enum `coming_soon`, list gate, Supabase `.in("status", …)`, `quoteCartLines` **`NOT_FOR_SALE`**, `/api/product-waitlist`, migrations **302019–302021**).
- **Merchandising matrix (net-new beyond boxer):** `silk-relaxed-shell` (**women**, active, SKUs `ZLX-WM-SHELL-*`, hero `/assets/img/Lifestyle.jpeg`); `merino-everyday-crew` (**men**, active, `ZLX-MN-CREW-*`, `/assets/img/Listing.jpeg`); `kids-play-shorts` (**kids**, active, `ZLX-KD-SHORTS-*`, `/assets/img/kids_placeholder.jpeg`); `seasonal-archive-sale` (**sale**, **coming_soon**, placeholder SKU **`ZLX-SALE-ARCHIVE-PLACEHOLDER`** inactive + `inventory_quantity: 0`, hero `/assets/img/sale_placeholder.jpeg`). Flagship **`boxer-briefs`** kept **`id` 101**; **`supabase_product_id`** + seed **`category` `underwear`** aligned JSON ↔ SQL (was **`men`** drift in seed).
- **`isPurchasableVariant`** exported from [`parse.ts`](../../src/catalog/parse.ts) per AC wording for reuse/tests.
- **Task 4:** No swap of `COLLECTION_ROUTES` hero filenames — **no new committed raster under `public/`** in this pass (optional deferred).
- **Tests:** [`adapter-smoke.test.ts`](../../src/catalog/adapter-smoke.test.ts) expectations refreshed for expanded categories; smoke asserts **`/products`** **`> 1`** **`catalog-product-tile`**; existing **`quoteCartLines`** **`NOT_FOR_SALE`** coverage keeps **`coming_soon`** SKUs out of checkout.
- **`npm run build`**, **`npm test`**, **`npm run smoke`** executed successfully after changes.

### File List

- `data/products.json`
- `supabase/seed.sql`
- `src/catalog/parse.ts`
- `src/components/CatalogProductGrid/CatalogProductGrid.tsx`
- `src/components/ProductDetail/ProductDetail.tsx`
- `src/routes.smoke.test.tsx`

### Change Log

- **2026-04-30** — Story 9-4: expanded static + seed catalog (women/men/kids/sale + underwear parity), exported purchasable-variant helper, consolidated PDP waitlist path with `ComingSoonWaitlistPanel`, PLP tile test id + smoke assertion for multi-tile `/products`.

### Review Findings

- [x] [Review][Decision] PLP price line for `coming_soon` rows — **Resolved (A):** keep preview MSRP on the list view beside the “Coming soon” label; purchasability remains communicated by status + CTA, not by hiding price. No code change.

- [x] [Review][Patch] Reuse `isPurchasableVariant` in PLP quick-add path — [`CatalogProductGrid.tsx`](../../src/components/CatalogProductGrid/CatalogProductGrid.tsx) inlines `v.status === "active" && v.inventory_quantity > 0` for `singlePurchasable` while [`parse.ts`](../../src/catalog/parse.ts) exports the same rule; divergence risk if purchasability rules change. *(Addressed: import `isPurchasableVariant` in grid.)*

- [x] [Review][Patch] Smoke test cart key consistency — [`routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) imports `CART_LOCAL_STORAGE_KEY` for cleanup but seeds checkout with a hard-coded `"cartItems"` string in `localStorage.setItem`; use the constant for both. *(Addressed: `setItem` uses `CART_LOCAL_STORAGE_KEY`.)*
