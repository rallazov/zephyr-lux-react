# Story 9.1: Fixed-assortment pack catalog (boxer briefs)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer** buying the flagship boxer briefs,
I want the **product** to represent **one retail pack** that **always includes both black and blue pieces**,
so that I **only choose size** (where relevant), see **clear pack contents**, and am never asked to pick **black vs blue** as if they were alternatives.

As the **owner / operator**,
I want **canonical catalog data** (static JSON, Supabase seed, and production DB guidance) to match that merchandising model,
so that **inventory**, **checkout quoting**, and **admin edits** stay consistent end-to-end.

## Acceptance Criteria

1. **Given** [approved sprint change §4.3](../planning-artifacts/sprint-change-proposal-2026-04-30.md) and existing PDP rules in [`computeOptionLayout`](../../src/components/ProductDetail/variantSelection.ts), **when** canonical catalog (`data/products.json` and [`supabase/seed.sql`](../../supabase/seed.sql)) defines the flagship **`boxer-briefs`** product, **then** **all purchasable variants** use **`color` absent / null / empty on every row** *or* the **exact same non-empty color string** on every row so that **`uniqueColors.length ≤ 1`** and the PDP shows **at most one** of size vs color — **for this product, only size** (S–XL or agreed subset). **Do not** leave mutually exclusive black-only vs blue-only purchasable SKUs on the same product.

2. **Given** [UX-DR6](../planning-artifacts/epics.md) / trust copy expectations, **when** the customer views PDP `/product/boxer-briefs`, **then** they see explicit copy that the unit is a **2-piece pack** including **one black and one blue** item (e.g. subtitle, description lead sentence, or a short **“What’s included”** line — pick one consistent pattern and document it in the Dev Agent Record). Copy must not contradict inventory (still **one line item = one physical pack**).

3. **Given** [FR-CAT-001](../planning-artifacts/epics.md) / [`handlers/_lib/catalog.ts`](../../handlers/_lib/catalog.ts), **when** checkout / cart quote resolves SKUs, **then** **every SKU** in static JSON exists in server catalog import and **Supabase seed** uses aligned SKUs, prices (`price_cents`), currency, and inventory so **`quoteCartLines`** and storefront adapter agree for **`import.meta.env.MODE === "test"`** static paths **and** Supabase-backed paths used in CI/integration.

4. **Given** legacy **`ZLX-BLK-*` / `ZLX-BLU-*`** rows must not remain **active** purchasable variants for **`boxer-briefs`**, **when** the change ships, **then** either:  
   - **(A)** those variant rows are **removed** from seed/static catalog and replaced by new pack SKUs, **and** any surviving rows in optional fixtures are **`discontinued`** / **`inactive`** / **`inventory_quantity = 0`** only if tests require historic shapes — prefer **clean removal** in seed + JSON; **or**  
   - **(B)** owner-run production migration (documented in Dev Agent Record / Story Tasks) marks old variants non-purchasable.  
   **New pack SKU naming:** use a single consistent prefix for this story, e.g. **`ZLX-2PK-S`**, **`ZLX-2PK-M`**, **`ZLX-2PK-L`**, **`ZLX-2PK-XL`** (adjust if XL excluded — match owner assortment).

5. **Given** [`resolveSelection`](../../src/components/ProductDetail/variantSelection.ts) behavior when `showColor` is false and **`uniqueColors.length === 0`** (all null colors), **when** the customer selects size, **then** **`dimMatch`** on color matches **null/empty** variant colors — **verify with tests** that multi-size + all-null-color purchasable variants resolve to **exactly one** purchasable SKU per size without exposing a color control.

6. **Given** [`ProductDetail.variants.test.tsx`](../../src/components/ProductDetail/ProductDetail.variants.test.tsx) currently assumes **two-dimensional** selection, **when** this story completes, **then** tests are rewritten to assert **size-only** selection for static `boxer-briefs`, correct price/stock for at least one size, and **`pdp-select-color`** is **absent** (queryBy / expect not in document). Maintain [`routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) / slug **`boxer-briefs`** alignment per [2-2](2-2-product-list-reads-canonical-catalog.md).

7. **Given** catalog-driven tests that hard-code **`ZLX-BLK-S`** (and siblings) as **real catalog SKUs**, **when** SKUs change, **then** update [`handlers/_lib/catalog.quote.test.ts`](../../handlers/_lib/catalog.quote.test.ts), [`handlers/_lib/checkoutQuote.test.ts`](../../handlers/_lib/checkoutQuote.test.ts), [`handlers/create-payment-intent.handler.test.ts`](../../handlers/create-payment-intent.handler.test.ts), [`handlers/create-payment-intent.test.ts`](../../handlers/create-payment-intent.test.ts), and any other **`grep`** hits where the SKU must exist in **`data/products.json`**. Keep unrelated tests that use **`ZLX-*` only as order snapshots** unchanged unless they embed catalog-dependent SKU quotes.

8. **Given** [`src/catalog/supabase-map.test.ts`](../../src/catalog/supabase-map.test.ts) fixture `baseProduct`, **when** fixtures still represent boxer briefs, **then** update embedded variant SKU/color/size so **`supabaseRowsToProduct`** / gallery assertions remain coherent (can stay single-variant fixture — merely align SKU string if referenced).

9. **Given** **Epic 9 scope boundary**, **when** implementation is complete, **then** **`npm run build`**, **`npm test`**, and **`npm run smoke`** pass. **Out of scope:** `coming_soon` status (9-3), storefront search (9-2), new admin fields beyond existing **`admin_save_product_bundle`** payload shape.

## Tasks / Subtasks

- [x] **Task 1 — Data model & copy (AC: 1, 2, 4)**  
  - [x] Update [`data/products.json`](../../data/products.json): `title` / `subtitle` / `description` per AC2; variants = pack SKUs; **`color` null** on all variants (preferred); sizes per owner; sensible `inventory_quantity` / optional `low_stock_threshold`.  
  - [x] Update [`supabase/seed.sql`](../../supabase/seed.sql): same product id optional **or** document replacement UUID strategy; align **`legacy_storefront_id` = 101** with static **`id`: 101**; replace variant INSERT list; ensure **`product_images`** still resolve for PDP.  
  - [x] Remove or non-purchase-disable legacy black/blue exclusive variants from seed + JSON.

- [x] **Task 2 — PDP / tests (AC: 5, 6)**  
  - [x] Rewrite [`ProductDetail.variants.test.tsx`](../../src/components/ProductDetail/ProductDetail.variants.test.tsx) for size-only flow; add assertion pack copy visible (string match agreed in Task 1).  
  - [x] Optional: focused unit test on [`computeOptionLayout`](../../src/components/ProductDetail/variantSelection.ts) / [`resolveSelection`](../../src/components/ProductDetail/variantSelection.ts) with multi-row **null color** purchasable variants if PDP test alone is insufficient.

- [x] **Task 3 — Server quote & payment tests (AC: 3, 7)**  
  - [x] Grep `ZLX-BLK` / `ZLX-BLU` under `handlers/` and `src/`; update catalog-dependent tests to new **`ZLX-2PK-*`** (or chosen prefix).  
  - [x] Confirm [`handlers/_lib/catalog.ts`](../../handlers/_lib/catalog.ts) still validates JSON via [`parseStaticCatalogData`](../../src/catalog/parse.ts).

- [x] **Task 4 — Supabase map fixtures (AC: 8)**  
  - [x] Touch [`src/catalog/supabase-map.test.ts`](../../src/catalog/supabase-map.test.ts) only where SKU / `variantPrimaryImageBySku` keys must match new SKUs.

- [x] **Task 5 — Production / operator handoff (AC: 4B)**  
  - [x] Document in Dev Agent Record a short **SQL or admin checklist** for production Supabase: deactivate old variants, insert/update pack variants, verify admin UI save round-trip.

### Review Findings

- [x] [Review][Decision] `epics.md` still contains `{{epics_list}}` above the new Epic 9–11 course-correction block — **Resolved (2026-04-30):** Keep `{{epics_list}}` for BMad / generator workflows; no edit.

- [x] [Review][Patch] Canonicalize pack variant `color` across static JSON, tests, and domain — **Done (2026-04-30):** explicit `"color": null` in [`data/products.json`](../../data/products.json) (normalized via `jsonNullsToUndefined` before Zod); pack-row fixtures in [`variantSelection.test.ts`](../../src/components/ProductDetail/variantSelection.test.ts) use explicit `color: undefined` to match parsed catalog shape.

- [x] [Review][Defer] AC9 command verification — Confirm `npm run build`, `npm test`, and `npm run smoke` before closing the story; not evidenced by the code diff alone.

- [x] [Review][Defer] PDP regression belt for pack copy — Tests assert pack language via `pdp-product-subtitle` only; optional follow-up to assert [`PlainTextBlocks`](../../src/components/ProductDetail/ProductDetail.tsx) / description includes the same pack facts if the team wants belt-and-suspenders coverage.

## Dev Notes

### Dev Agent Guardrails

- **No new product types table** — fixed pack is **represented by variant rows + honest copy**, per [sprint proposal §1b](../planning-artifacts/sprint-change-proposal-2026-04-30.md).  
- **Reuse** existing variant columns (`size`, `color`, `sku`, `price_cents`, …); **prefer `color: null`** across all pack variants so `uniqueColors` is empty and **`effColor`** resolves via [`resolveSelection`](../../src/components/ProductDetail/variantSelection.ts) (`null` matches all empty colors).  
- **Preserve** [`legacy_storefront_id`](../../supabase/seed.sql) / storefront numeric id **101** for cart identity continuity unless a migration story explicitly changes it.  
- **Do not** implement Epic **9-2 / 9-3** here.

### Technical requirements

- **FR-CAT-001, FR-CAT-003, FR-SF-002** — single canonical catalog; variant-level checkout identity unchanged.  
- **Cart:** Existing carts with **old SKUs** may fail reconciliation — acceptable for MVP; optional note in Dev Record (clear site data / cart removes stale lines).

### Architecture compliance

- Catalog seam: [`getDefaultCatalogAdapter()`](../../src/catalog/factory.ts) + static bundle; API: [`handlers/_lib/catalog.ts`](../../handlers/_lib/catalog.ts) reads [`data/products.json`](../../data/products.json).  
- Railway/API split: browser `fetch` uses [`apiUrl`](../../src/lib/apiBase.ts); **no change** required for this story.

### Library / framework requirements

- **None new.** Vitest + RTL patterns already in repo.

### File structure requirements

| Area | Action |
|------|--------|
| [`data/products.json`](../../data/products.json) | **UPDATE** — flagship product variants + copy |
| [`supabase/seed.sql`](../../supabase/seed.sql) | **UPDATE** — mirror JSON semantics |
| [`src/components/ProductDetail/ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) | **READ / MAY UPDATE** — only if copy placement needs structural hook (prefer product fields first) |
| [`ProductDetail.variants.test.tsx`](../../src/components/ProductDetail/ProductDetail.variants.test.tsx) | **UPDATE** |
| `handlers/**/*.test.ts` | **UPDATE** catalog SKU fixtures |
| [`src/catalog/supabase-map.test.ts`](../../src/catalog/supabase-map.test.ts) | **UPDATE** if SKU strings embedded |

### Testing requirements

- `npm run build`  
- `npm test`  
- `npm run smoke`  
- Grep residual **`pdp-select-color`** expectations tied to **`boxer-briefs`** static catalog — remove or replace.

### Previous story intelligence

- **Epic 9 is new** — no prior 9-x story. **Continuity:** [2-4](2-4-variant-selector-size-color-price-stock.md) defined **`computeOptionLayout`** rules exploited here; [8-x](8-6-owner-push-notification-prototype.md) unrelated to catalog rows.

### Project structure notes

- Static catalog is bundled via [`src/catalog/static-bundled.ts`](../../src/catalog/static-bundled.ts); changing JSON requires **restart / rebuild** for dev clarity.

### References

- [Sprint change proposal §1b–§4.3](../planning-artifacts/sprint-change-proposal-2026-04-30.md) — approved pack semantics  
- [Epic 9 appendix](../planning-artifacts/epics.md) — Course correction block  
- [`variantSelection.ts`](../../src/components/ProductDetail/variantSelection.ts) — option visibility + resolution

### Questions / clarifications (non-blocking)

1. **Retail price** for one 2-pack vs old single-color pair — owner sets **`price_cents`** per variant row (all sizes same or tiered).  
2. **Assortment**: Confirm **S, M, L, XL** all sold as packs; drop sizes that are not manufactured.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent).

### Debug Log References

### Completion Notes List

- **Pack copy pattern:** Trust copy lives on the product record as **`subtitle`** plus an expanded **`description`** lead in `data/products.json` / seed. The PDP renders **`subtitle`** under the title when present (`data-testid="pdp-product-subtitle"`), so customers always see the **2-piece pack (one black + one blue)** message without extra PDP-only strings.
- **Catalog:** Flagship **`boxer-briefs`** now has four purchasable variants **`ZLX-2PK-S` … `ZLX-2PK-XL`** with **`color` omitted** (static JSON) / **`NULL`** (seed); legacy **`ZLX-BLK-*` / `ZLX-BLU-*`** removed from canonical seed + JSON (path **A**). Legacy **`ZLX-BLK-*`** remains only in **order-snapshot** tests that do not quote `data/products.json`.
- **Resolution:** `computeOptionLayout` shows **size only**; `variantSelection.test.ts` asserts **`resolveSelection`** returns one purchasable row per size with **`color: null`** on variants.
- **Carts:** Lines persisted with old SKUs will not reconcile against the new catalog; clearing site cart data removes stale lines (per Dev Notes).

**Production Supabase checklist (path B supplement / live DB already seeded with legacy SKUs)**

1. Identify product id: `SELECT id FROM products WHERE slug = 'boxer-briefs';`
2. Deactivate legacy rows (adjust SKUs if yours differ):  
   `UPDATE product_variants SET status = 'discontinued', inventory_quantity = 0 WHERE product_id = '<uuid>' AND (sku LIKE 'ZLX-BLK-%' OR sku LIKE 'ZLX-BLU-%');`
3. Upsert pack variants to match seed semantics: **`ZLX-2PK-{S,M,L,XL}`**, **`color` NULL**, **`price_cents` 2400**, **`currency` usd**, **`status` active**, inventory per ops.
4. Align **`products.subtitle`** / **`products.description`** with storefront copy (mirror `supabase/seed.sql` or JSON).
5. In **Admin → product**, open boxer briefs and run **save** once to confirm **`admin_save_product_bundle`** round-trip and gallery linkage.

### File List

- data/products.json  
- supabase/seed.sql  
- src/components/ProductDetail/ProductDetail.tsx  
- src/components/ProductDetail/ProductDetail.variants.test.tsx  
- src/components/ProductDetail/variantSelection.test.ts  
- handlers/_lib/catalog.quote.test.ts  
- handlers/_lib/checkoutQuote.test.ts  
- handlers/_lib/orderSnapshots.test.ts  
- handlers/create-payment-intent.test.ts  
- handlers/create-payment-intent.handler.test.ts  
- src/catalog/supabase-map.test.ts  
- src/routes.smoke.test.tsx  
- _bmad-output/implementation-artifacts/sprint-status.yaml  

### Change Log

- **2026-04-30:** Fixed-assortment pack catalog for `boxer-briefs` (`ZLX-2PK-*`), PDP subtitle + tests, quote/payment/smoke alignment; sprint status → review.
