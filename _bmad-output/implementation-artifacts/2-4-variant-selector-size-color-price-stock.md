# Story 2.4: Variant selector (size/color) with price and stock

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want the **product detail page** to offer **first-class size and color selection** (where the catalog defines them) with **price, image, and stock/availability** that **stay in sync** with my selection, and an **add-to-cart** action that is **only enabled for a real, in-stock, active variant** I have explicitly chosen,
so that **FR-SF-002**, **FR-CAT-003**, **PRD §14 — Epic 2 / E2-S4**, and **UX-DR6 / UX-DR12** are satisfied, **without** taking on **E2-S5 (Supabase tables)** or **full Epic 3 (SKU-only cart + checkout server line items)**.

## Acceptance Criteria

1. **Given** [PRD — FR-SF-002](../planning-artifacts/zephyr-lux-commerce-prd.md) and [epics — same](../planning-artifacts/epics.md), **when** a customer views a **valid, browsable** product on `/product/:slug`, **then** the UI exposes **size and/or color** controls **derived from the canonical `product.variants` list** (not hardcoded). If the catalog only uses **one** dimension, show **only** that control. If a dimension is **absent** on all variants (e.g. all `color: undefined`), **do not** show an empty/placeholder color control.

2. **Given** **FR-SF-002** (“Add-to-cart **disabled** until **required** variants are selected”) and [UX-DR6](../planning-artifacts/epics.md), **when** the product requires **two** dimensions (both size and color exist on at least one variant and together identify the purchasable SKU), **then** the customer **cannot** add to cart until **both** are selected and resolve to **exactly one** [ProductVariant](../../src/domain/commerce/product.ts). If only one dimension is used in data, require only that. **When** a product has **exactly one** active, purchasable variant **and** no meaningful choice, **then** the implementation may **auto-select** that variant for display (price/stock) **or** require one explicit control interaction—**pick one** approach and **document the rule** in the Dev Agent Record (tests must assert it).

3. **Given** [FR-CAT-003](../planning-artifacts/epics.md) and variant [`status`](../../src/domain/commerce/enums.ts) / [`inventory_quantity`](../../src/domain/commerce/product.ts), **when** a variant is **not purchasable** (`inactive` or `discontinued`, or `inventory_quantity === 0` for the resolved SKU), **then** **add-to-cart** is **disabled** and the user sees a **textual** stock/OOS (or “Unavailable”) state **not conveyed by color alone**—aligned with [UX-DR9 / out-of-stock](../planning-artifacts/epics.md) and [NFR-A11Y-003](../planning-artifacts/epics.md). **“Low stock”** (optional P1 polish): if `low_stock_threshold` is set and `0 < inventory_quantity <= threshold`, show a **short** low-stock message.

4. **Given** the **same** product can have **multiple** [ProductVariant](../../src/domain/commerce/product.ts) rows, **when** the customer changes size/color, **then** the **displayed price** reflects the **selected** variant’s `price_cents` (and **hero image** uses that variant’s `image_url` when present, with a **sensible** fallback to product-level/another variant image **only** if needed). **Until** a complete selection exists, the price may show a **from/range** (min–max) or a neutral “Select options” **copy pattern**—**not** a misleading single price that implies a specific SKU. **No** new parallel catalog fetches: all state derives from the already-loaded `CatalogProductDetail`.

5. **Given** [2-3](2-3-product-detail-by-slug-canonical.md), **[2-2 AC6](2-2-product-list-reads-canonical-catalog.md)** (list **Add to cart** only when exactly one purchasable variant), and **pre–Epic 3** cart constraints, **when** the customer adds from the **PDP** or the **single-variant list** path, **then** [`CartContext`](../../src/context/CartContext.tsx) **must** distinguish **separate line rows** for **different SKUs of the same `storefrontProductId`** (merge-by-`id` alone is incorrect for multi-SKU products). **Minimum fix:** extend the in-memory cart line shape with **`sku`** (or another stable per-line key documented in Dev Notes) and set **merge identity** = `(storefrontProductId, sku)` (**normalize** missing `sku` to `""` **only** for **legacy** rows; the **[2-2](2-2-product-list-reads-canonical-catalog.md)** single-variant list path **must** populate **`sku`**). **Price and image** come from the **selected** variant (PDP) or the **sole** purchasable variant (list); **`name` may include** a short variant label (e.g. `" — {size} / {color}"`). **Do not** implement server checkout line-item SKU payloads (**Epic 3**). **Sprint key `3-1`** (see [sprint-status.yaml](sprint-status.yaml)) owns **persisted** cart, **reconciliation**, and **checkout/server** alignment—it **does not** introduce this client merge key (**introduced here**).

6. **Given** [NFR-A11Y-001](../planning-artifacts/epics.md) / [NFR-A11Y-002](../planning-artifacts/epics.md), **when** the customer uses keyboard / screen reader flows, **then** variant controls are **labelled** (`<label htmlFor=…>`, or `aria-label` with visible text nearby), form controls have **visible** focus, and invalid/disabled CTA is **understandable** (text explains OOS or “Select size”, not a silent disabled button with no copy).

7. **Given** [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md), **when** the story ships, **then** `npm run build` and **`npm run smoke`** pass. Extend [`routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) and/or a focused [Vitest](https://vitest.dev/) + [RTL](https://testing-library.com/docs/react-testing-library/intro/) test so **variant selection** is **observable** (e.g. `data-testid` on controls or stable accessible names)—not a blind green build.

8. **Given** this story, **when** the implementation is complete, **then** **2-3**’s “first variant / min price” placeholder is **replaced** on the PDP (document what changed in Dev Agent Record). **Out of scope:** full [UX design](../planning-artifacts/ux-design-specification.md) **image gallery** / **swatch** system beyond what Tailwind + semantic HTML can deliver; **shadcn/Radix** is **not** in [package.json](../../package.json) today—**do not** add a design-system dependency unless a future epic explicitly does; if **native** controls are insufficient for combinatorial UX, prefer **small, local** helpers over new global UI frameworks.

## Tasks / Subtasks

- [x] **Task 1 — Option model + state (AC: 1, 2, 4)**  
  - [x] From `product.variants`, compute purchasable **active** rows; exclude or disable **inactive** / **discontinued** per AC3.  
  - [x] Build **valid** (size, color) combinations; handle one-dimensional vs two-dimensional catalogs without impossible intermediate states.  
  - [x] Derive `selectedVariant: ProductVariant | null` and price/image display rules.

- [x] **Task 2 — PDP UI (AC: 1–4, 6, 8)**  
  - [x] Update [ProductDetail.tsx](../../src/components/ProductDetail/ProductDetail.tsx) (or extract a colocated `VariantSelector` module under the same folder).  
  - [x] Wire CTA: disabled per AC2/3; label reflects OOS vs not-selected.

- [x] **Task 3 — Cart merge fix (AC: 5)**  
  - [x] Update [CartContext.tsx](../../src/context/CartContext.tsx) types + `addToCart` / `removeFromCart` as needed.  
  - [x] Update PDP `addToCart` payload; confirm [ProductList](../../src/components/ProductList/ProductList.tsx) **single-variant** list-add sets **`sku`** per **[2-2 AC6](2-2-product-list-reads-canonical-catalog.md)**.  
  - [x] Smoke-test [CartPage](../../src/components/Cart/CartPage.tsx) line labels if `name` includes variant.

- [x] **Task 4 — Tests (AC: 7)**  
  - [x] Unit/component: selection changes price; OOS disables add; missing selection disables add.  
  - [x] Optional: two SKUs same product do **not** merge incorrectly.

## Dev Notes

### Dev Agent Guardrails

- **Scope:** **PDP** variant selection + honest price/stock + cart line identity fix for **multi-SKU** same product. **Not** E2-S5 Supabase, **not** E2-S6 admin, **not** Epic 3 payment server SKU validation.  
- **Single** catalog path: [getDefaultCatalogAdapter()](../../src/catalog/factory.ts) — no new data sources.  
- **Reuse** [Product](../../src/domain/commerce/product.ts) / [ProductVariant](../../src/domain/commerce/product.ts) types; **no** second product model.  
- **Align** with [2-3](2-3-product-detail-by-slug-canonical.md): not-found, loading, and error paths for slug remain intact.

### Technical requirements

- **FR-SF-002, FR-CAT-003, PRD E2-S4, Epic 2 acceptance** (“Customer cannot add **ambiguous** product without selected **variant**”).  
- [cartItemSchema in domain](../../src/domain/commerce/cart.ts) is **SKU-forward**; **this story** only bridges PDP + compliant list path → **client** cart merge behavior—**do not** claim domain cart migration is complete.

### Epic 3 / sprint `3-1` coordination

- **This story (2-4)** introduces the **in-memory** merge key **`(storefrontProductId, sku)`** so distinct variants do not collapse in the cart.  
- **Epic 3 / `3-1-cart-sku-variant-identity`** (see note in [sprint-status.yaml](sprint-status.yaml)) is **narrowed** to: **persisted** cart (e.g. `localStorage` / future anonymous session), **stale-item reconciliation** against the catalog, **quantity** semantics, and **checkout** payloads / **server** validation—not redefining the merge key. Update the **`3-1`** story file when it is authored so scope matches this split.

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): catalog adapter seam; [StaticCatalogAdapter](../../src/catalog/adapter.ts) + [parseStaticCatalogData](../../src/catalog/parse.ts) unchanged unless a **proven** bug in list/detail indexing (prefer **no** parse change for this story).  
- **A11y:** architecture calls for headless components long-term; **this story** may use **native** controls with labels; **do not** regress keyboard operability of the PDP CTA + selectors.

### Library / framework requirements

- **react-router-dom@6** — `useParams` unchanged.  
- **React 18**, **TypeScript 5.7+**, **Vitest 2** + **@testing-library/react 16** — as in [package.json](../../package.json).  
- **No** new UI library **unless** a short Dev Agent Record justifies a **single** small dependency (default: **none**).

### File structure requirements

| Area | Action |
|------|--------|
| [`ProductDetail.tsx`](../../src/components/ProductDetail/ProductDetail.tsx) | **UPDATE** — selection state, CTA, price/stock, optional split |
| [`ProductDetail/`](../../src/components/ProductDetail/) | **MAY ADD** — `VariantSelector.tsx` (or similar) if it clarifies the tree |
| [`CartContext.tsx`](../../src/context/CartContext.tsx) | **UPDATE** — `CartItem` shape + merge key (AC5) |
| [`ProductList.tsx`](../../src/components/ProductList/ProductList.tsx) | **READ/TOUCH** — single-variant list path sets `sku` (**2-2 AC6**) |
| [`CartPage.tsx`](../../src/components/Cart/CartPage.tsx) | **READ/TOUCH** — display if `name` / keys change |
| [`routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) / `*.test.tsx` | **UPDATE** — PDP variant observability (AC7) |

### Testing requirements

- `npm run build` and `npm run smoke`.  
- Deterministic **RTL** or unit tests; avoid flaking on `localStorage` (follow patterns from existing tests in repo).

### Previous story intelligence (2-3, 2-2, 2-1)

- **2-3** explicitly **deferred** full **size/color** selector, **per-variant** price, and **gallery** to **E2-S4**; **2-3**’s not-found and adapter-only rules **must not** regress.  
- **2-2/2-3:** Cart was **storefront product id** + dollars; this story **adds** line distinction by **variant SKU** on the **client** only—coordinate copy with [cartItemSchema](../../src/domain/commerce/cart.ts) for future Epic 3 alignment.  
- **2-1** seed: **unique SKUs** and **per-variant** `image_url`—use them; **no duplicate SKUs** in data is a maintainer contract.

### Git intelligence (recent commits)

- Recent work landed **StaticCatalogAdapter**, **TypeScript** PDP/list, and **sprint** tracking—this change should stay **PDP- and cart-merge-focused**; avoid unrelated **API/Stripe** edits.

### Latest technical information

- **No** required `npm` major upgrades for this feature. If **Vitest/RTL** APIs are used, follow **Vite 5** + **Vitest 2** docs already in use by the project.

### Project context reference

- No `project-context.md` file matched in repo (skill glob); use PRD, [architecture.md](../planning-artifacts/architecture.md), [epics.md](../planning-artifacts/epics.md), [ux-design-specification.md](../planning-artifacts/ux-design-specification.md) (variant matrix / PriceAndAvailability patterns as **product** guidance), and this file.

### References

- [PRD §14 — Epic 2, E2-S4](../planning-artifacts/zephyr-lux-commerce-prd.md#epic-2-commerce-catalog-and-product-admin-foundation)  
- [epics — FR-SF-002, FR-CAT-003, UX-DR6, UX-DR9, NFR-A11Y](../planning-artifacts/epics.md)  
- [ux-design-specification — Product decision, variant matrix](../planning-artifacts/ux-design-specification.md)  
- [2-3](2-3-product-detail-by-slug-canonical.md)  
- [2-2](2-2-product-list-reads-canonical-catalog.md)  
- [2-1](2-1-canonical-product-variant-seed-data.md)

## Story completion status

- **Status:** `done`  
- **Note:** Code review 2026-04-26: 2D incomplete CTA copy fix applied; see Review Findings.

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- Build initially failed: `purchasableVariantCount` / catalog export; resolved by aligning with existing `parse.ts` and canonical seed.
- `data/products.json` was migrated to **canonical** `staticSeed` shape so `parseStaticCatalogData` matches the bundled adapter (required for E2 list/detail and this story’s fixtures).

### Completion Notes List

- **2-3 replacement:** PDP no longer uses “first variant / min price” for CTA, price, and hero image. Price, stock text, and image follow **resolved** `ProductVariant` from selection (or min–max / “select options” copy when selection is incomplete). Single in-stock purchasable variant: **auto-select** by `useEffect` on load so price/stock/ATC are consistent without an extra click (documented in AC2).
- **Cart merge** uses `(storefrontProductId, sku)` with `normalizeLineSku` for legacy `""` rows: `addToCart` merges on `sameCartLine`, `removeFromCart(id, sku?)` targets a line, `CartPage` row keys and +/- use `item.sku`.
- **A11y:** native `<label htmlFor>`, CTA `aria-describedby` for disabled reasons, `aria-label` on the add button when disabled.

### File List

- `data/products.json` — canonical seed (status, `fabric_type`, variant `price_cents`, `size`/`color`, L variant `low_stock_threshold` for P1 low-stock copy)
- `src/cart/lineKey.ts` — new: `normalizeLineSku`, `sameCartLine`
- `src/cart/lineKey.test.ts` — new
- `src/components/ProductDetail/variantSelection.ts` — new: layout, resolution, low-stock helper
- `src/components/ProductDetail/pdpCta.ts` — new: CTA disabled + copy
- `src/components/ProductDetail/VariantSelector.tsx` — new
- `src/components/ProductDetail/ProductDetail.tsx` — update: selection, price/stock, image, CTA, not-found (adapter-backed)
- `src/components/ProductDetail/variantSelection.test.ts` — new
- `src/components/ProductDetail/pdpCta.test.ts` — new (2D CTA copy)
- `src/components/ProductDetail/ProductDetail.variants.test.tsx` — new
- `src/context/CartContext.tsx` — update: line merge, `removeFromCart(id, sku?)`, exported `CartItem`
- `src/components/Cart/CartPage.tsx` — update: line keys, remove with `sku`
- `src/routes.smoke.test.tsx` — update: PDP `pdp` + `pdp-variant-selector` assertions
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-4` → `done` (post-review)
- `src/catalog/index.ts` / `src/catalog/parse.ts` — **not** modified in this session for story scope (pre-existing in branch); story acceptance satisfied via current parse + seed.

### Change Log

- 2026-04-26: PDP variant selection + cart line identity `(storefrontProductId, sku)`; canonical `data/products.json` seed; tests and smoke updated.
- 2026-04-26: Code review — 2D incomplete PDP CTA text keyed to missing `size` / `color` (`pdpCta.ts`, `pdpCta.test.ts`).

## Questions (non-blocking; saved for end)

- **Combinatorial gaps:** If a **size** is chosen but **no** active variant exists for a **color** (should not happen with clean data), the UI should **not** throw—show “Unavailable” and block ATC.  
- **i18n / locale:** size/color labels are **catalog strings**; no extra localization layer in this story.

### Review Findings

- [x] [Review][Patch] Two-dimension incomplete CTA always says "Select a size and color" — [src/components/ProductDetail/pdpCta.ts:21-28] — **Fixed** 2026-04-26: `pdpCtaState` now uses `size` / `color` in the 2D branch (both missing, size only, color only, defensive fallback) + `pdpCta.test.ts`.

- [x] [Review][Defer] `selectedVariant` stock line can never show the `inventory_quantity === 0` branch in normal data — [src/components/ProductDetail/ProductDetail.tsx:223-225] — deferred, pre-existing: selection is from purchasable-only resolution; the branch is redundant unless selection rules change to include zero-qty matches.
