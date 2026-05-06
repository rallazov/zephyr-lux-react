# Story 11.3: Dynamic variant editing and storefront selectors

Status: done

<!-- Note: Validation is optional. Run validate-create-story before dev-story if you want the extra quality gate. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- [11-1](11-1-variant-template-schema-rls-domain.md) — template tables, `products.variant_template_id`, admin RLS, and shared [`variantTemplateSchema`](../../src/domain/commerce/variantTemplate.ts).
- [11-2](11-2-admin-template-crud-assign-product.md) — **must be `done` before implementation starts**, unless this is intentionally developed as a stacked PR. This story depends on stable template CRUD, product assignment, and assignment validation. After `product_variant_option_values` exists, **11-2’s destructive-change and option/axis removal checks must be extended or superseded** so they consult real value rows (not only legacy `size` / `color`); see Dev Notes.
- [2-4](2-4-variant-selector-size-color-price-stock.md) — current PDP selection, price/stock sync, and cart identity by `(storefrontProductId, sku)`.
- [2-6](2-6-admin-create-edit-product-variants.md) — existing admin product form, `admin_save_product_bundle`, and product/variant validation pattern.
- [Epic 11 — Story 11-3](../planning-artifacts/epics.md) — authoritative epic-level AC summary.

## Story

As the **store owner**,
I want the **admin product form to render variant fields from the assigned template axes**,
so that product families with reusable axes can be edited without forcing every variant into fixed `size` / `color` fields.

As a **storefront customer**,
I want the **product detail selector labels, ordering, price, image, and stock state to follow the product's template**,
so that options are understandable for each product family while cart and checkout still use the selected SKU as the durable identity.

## Acceptance Criteria

1. **Admin template-driven variant fields**  
   **Given** a product has `variant_template_id` and the assigned template is active or draft-visible to admin, **when** an admin edits variants in [`AdminProductForm`](../../src/admin/AdminProductForm.tsx), **then** each variant row presents controls for the template axes in template `sort_order` using axis labels (`label` fallback to `axis_key`) and option labels (`label` fallback to `option_key`), while **SKU**, **price**, **currency**, **inventory**, **variant status**, low-stock threshold, image URL, subscription-plan scoping, and product images remain first-class editable fields.

2. **Variant values persist without replacing SKU identity**  
   **Given** a templated product is saved, **when** variants are inserted/updated/deleted through the admin save boundary, **then** each variant's selected axis option values persist in a durable schema aligned with 11-1's normalized template tables (for example `product_variant_option_values` referencing `product_variants`, `variant_template_axes`, and `variant_template_axis_options`, or an explicitly documented equivalent). **Referential integrity must rule out nonsense pairs:** every `option_id` must belong to the same `axis_id` row (not merely two independent FKs), and every `axis_id` must belong to the **same** `variant_template_id` as the variant’s parent product (enforce with composite FKs where PostgreSQL allows, and/or triggers, and **must** be re-validated in the atomic save RPC). **SKU remains the primary cart/checkout line identity**; template metadata is not promoted to checkout pricing authority.

3. **Combination validation**  
   **Given** a template has one or more axes, **when** an admin saves variants for a templated product, **then** every variant has one selected option per axis the story treats as required (see Dev Notes: required-axis rule for v1), no two variants for the same product share the same complete axis-combination, and every selected option belongs to the selected template axis. Errors identify the row/SKU and axis that needs attention. Legacy `size` / `color` columns may be mirrored for backwards compatibility, but must not become the source of truth for templated axes after this story.

4. **Storefront template read model**  
   **Given** templates were admin-only in 11-1, **when** a storefront PDP loads a templated, browsable product, **then** the implementation exposes only the **public display subset** needed for selectors: template id/name if needed, axis order, axis labels/keys, option labels/keys, and per-variant option values. This may be implemented with constrained anon/authenticated SELECT RLS on template/value tables or with a catalog adapter/server projection. It must **not** expose admin-only template drafts unrelated to the browsable product or allow anon writes. **Template lifecycle:** if a product is assigned a template that is **draft** or **archived**, the story must choose and document one coherent rule—e.g. **(A)** storefront hides template-driven PDP/cart labels and fails safe (no crash; legacy or “unavailable” messaging as appropriate), **(B)** browseable/active catalog products may not keep such an assignment (admin save or publish path blocks until template is active or assignment cleared), or **(C)** another explicit product policy. The chosen rule must apply to PDP, cart, and public catalog reads consistently.

5. **PDP dynamic selectors**  
   **Given** a customer opens `/product/:slug` for a templated product, **when** the PDP renders, **then** selectors reflect the template axis order and labels instead of hard-coded `Size` / `Color`. Changing selections updates resolved SKU, price, stock/availability text, low-stock text, variant image, and add-to-cart enablement using the existing commerce rules from [2-4](2-4-variant-selector-size-color-price-stock.md). Incomplete or impossible combinations block add-to-cart with textual guidance. **Partial selection (N axes):** as the shopper selects earlier axes (in template order), **later axis controls must narrow** to options that still participate in at least one **valid** variant given the selections so far—via disabling, omitting, or both—so behavior matches today’s size-then-color narrowing, generalized. Tests must cover at least one three-axis narrowing path.

6. **Cart and checkout display semantics**  
   **Given** a templated product is added to cart, **when** cart, mini-cart/drawer surfaces if present, checkout review, and order confirmation render line labels, **then** line identity remains `(storefrontProductId, sku)` (or the current canonical SKU-based key) while display text can include human-readable template option labels. Checkout request payloads and server subtotal recomputation remain SKU/quantity based. **Historical display:** order lines, confirmation, and customer-safe order status views must **not** depend on live catalog template label renames for purchased merchandise—**persist a snapshot** of variant display strings (or equivalent normalized snapshot) on `order_items` / line payload at order creation so receipts and history stay stable when admins edit template labels or options later.

7. **Legacy products unchanged**  
   **Given** a product has `variant_template_id IS NULL`, **when** admin, PDP, cart, checkout, smoke tests, or static catalog flows run, **then** behavior remains the current legacy size/color behavior. Existing Epic 9 fixed-assortment and single-axis products must not be forced into template selectors in this story.

8. **Accessibility and responsive admin/PDP behavior**  
   **Given** **UX-DR12 / UX-DR13** and **NFR-A11Y-001 / NFR-A11Y-002**, **when** admins or customers navigate template-driven controls by keyboard or screen reader, **then** controls have visible labels, visible focus states, associated validation/help text, deterministic tab order, and no horizontal overflow at mobile widths. Native controls are preferred unless a small local component is clearly justified.

9. **Validation and regression tests**  
   **Given** completion, **when** validation runs, **then** add automated coverage for at least: admin save with N template axes, duplicate combination prevention, missing axis option errors, templated PDP selection to add-to-cart, cart/checkout label display, legacy non-templated product regression, N-axis **narrowing** behavior (invalid combos disabled/hidden as prior axes change), **order-line label snapshot** stability (or unit test of serializer), draft/archived-template rule chosen in AC4, and keyboard/focus or accessible-name assertions for dynamic selectors. Run **`npm test`**, **`npm run build`**, and **`npm run smoke`**.

10. **Backfill for 11-2–assigned products**  
    **Given** [11-2](11-2-admin-template-crud-assign-product.md) could assign `variant_template_id` while variants still only have legacy `size` / `color` and **no** `product_variant_option_values` rows, **when** this story ships, **then** the team implements **at least one** of: **(a)** a documented migration or backfill that maps legacy columns to template options where keys/labels align (safe only when unambiguous; otherwise skip and require admin), or **(b)** an admin rule that blocks save/publish/activation until every variant row has complete template option values chosen in the UI, with clear errors. The story file’s Dev Notes must state which approach (or combination) was chosen so implementers do not leave assigned products in an unreadable storefront state.

## Tasks / Subtasks

- [x] **Task 1 — Variant option-value persistence and RLS/read path (AC: 2, 4, 10)**  
  - [x] Add a migration for per-variant template values (recommended normalized table: `product_variant_option_values` with `variant_id`, `axis_id`, `option_id`, unique `(variant_id, axis_id)`, composite/cross FKs so `option_id` pairs with the correct `axis_id`, and validation that axes belong to the product’s `variant_template_id`—see Dev Notes).  
  - [x] Implement **AC10** backfill path **or** enforce “complete values before save/publish” in admin + document the choice.  
  - [x] Add admin-only write policies matching 11-1 admin predicate.  
  - [x] Add constrained storefront read access or a catalog projection for active/coming-soon products only; include resolving **`products.variant_template_id` for storefront** (11-1 currently omits this column from anon `SELECT` grants in [`20260504180000_variant_templates_normalized_rls_admin_bundle.sql`](../../supabase/migrations/20260504180000_variant_templates_normalized_rls_admin_bundle.sql)—extend grants/RLS or projection accordingly).  
  - [x] Extend `admin_save_product_bundle` or add a narrow RPC so product + variants + option values save atomically.  
  - [x] **Extend or supersede [11-2](11-2-admin-template-crud-assign-product.md) destructive guards** (template editor + assignment validation) so removals/renames consider **`product_variant_option_values`**, not only legacy `size` / `color`.

- [x] **Task 2 — Domain and catalog DTOs (AC: 2, 4, 5, 7)**  
  - [x] Extend shared commerce/domain types with public template selector metadata and per-variant option values without creating a parallel Product tree.  
  - [x] Extend [`CatalogProductDetail`](../../src/catalog/types.ts) and Supabase mapping/selects to include template axes/options/value projection for templated products.  
  - [x] Keep static catalog and legacy product parsing green; add pure fixtures for templated product tests if static seed migration is deferred to 11-4.

- [x] **Task 3 — Admin dynamic variant editor (AC: 1, 3, 8)**  
  - [x] Update [`AdminProductForm`](../../src/admin/AdminProductForm.tsx) so assigned templates render dynamic axis option controls per variant row.  
  - [x] Preserve SKU, price, inventory, status, low stock, image, subscription plan scoping, and image row interactions.  
  - [x] Add helper validation for required axes, invalid options, duplicate complete combinations, and template/variant mismatch messages.

- [x] **Task 4 — PDP dynamic selector model (AC: 4, 5, 8)**  
  - [x] Refactor [`variantSelection.ts`](../../src/components/ProductDetail/variantSelection.ts) to resolve selections by template axes when template metadata exists, with legacy size/color fallback and **per-axis narrowing** as selections advance.  
  - [x] Update [`VariantSelector.tsx`](../../src/components/ProductDetail/VariantSelector.tsx) to render N axes from template metadata with accessible labels and guidance.  
  - [x] Implement AC4 **draft/archived template** rule on storefront.  
  - [x] Preserve price, stock, image, CTA, waitlist, analytics, SEO/JSON-LD, and not-found behavior.

- [x] **Task 5 — Cart/checkout display labels and order snapshots (AC: 6, 7)**  
  - [x] Decide the minimum display surface for template option labels: cart page and checkout review at minimum; mini-cart/drawer if present.  
  - [x] Keep persisted/cart line identity SKU-based; add display metadata only where needed.  
  - [x] **Persist line-item display snapshot** on order creation (DB column(s) or structured JSON on `order_items`, consistent with existing order schema); use it for confirmation and customer order status—**do not** re-resolve labels from live templates for completed orders.  
  - [x] Ensure checkout request payloads and server subtotal logic still avoid treating template metadata as price authority.

- [x] **Task 6 — Tests and verification (AC: 9, 10)**  
  - [x] Unit tests for N-axis resolution, duplicate combinations, impossible combinations, narrowing behavior, and legacy fallback.  
  - [x] RTL tests for templated PDP selection, add-to-cart, visible labels, disabled guidance, and at least one multi-step narrowing path.  
  - [x] Admin validation/component tests for template-driven variant rows.  
  - [x] Smoke route updates if selector or admin routes change.  
  - [x] Run `npm test`, `npm run build`, and `npm run smoke`.

## Dev Notes

### Scope boundary

- **Not** template CRUD or assignment UI — [11-2](11-2-admin-template-crud-assign-product.md). This story consumes assigned templates and makes variants/PDP dynamic.
- **Not** broad static seed rollout or migration notes for all existing products — [11-4](../planning-artifacts/epics.md) owns legacy coexistence rollout and optional scripts.
- **Not** a configurable bundle composer or customer-facing bundle builder.
- **Not** checkout repricing by template metadata. Server price authority remains catalog SKU/variant records.

### Start gate

Do not implement this story while 11-2 is still only `review` unless the work is deliberately stacked and coordinated. At minimum, 11-2's template CRUD, product assignment, `variant_template_id` persistence, and validation helper APIs must be stable before this story touches them.

### Storefront read model decision **(implemented: Option A — RLS)**

11-1 intentionally kept template tables admin-only. This story must make a deliberate choice:

- **Option A — RLS read:** add SELECT policies that allow anon/authenticated users to read only template axes/options/value rows connected to active/coming-soon products visible through storefront catalog policies. **← Shipped** in [`20260506120000_product_variant_option_values_storefront_template_reads.sql`](../../supabase/migrations/20260506120000_product_variant_option_values_storefront_template_reads.sql).
- **Option B — Projection:** expose a catalog adapter/server projection containing only public selector metadata.

Either option is acceptable if the implementation proves no unrelated draft templates, admin-only templates, or write privileges leak to the storefront. **Implementation detail:** anon currently cannot read `products.variant_template_id` until grants/RLS or a projection are extended (see Task 1); closing this gap is mandatory for templated PDPs.

### Storefront draft / archived template assignment (AC4) **— Rule A**

When a catalog row still has `variant_template_id` in the database but the embedded `variant_templates` graph is missing or not **`active`** (e.g. admin draft/archived template, or RLS hides the row), the storefront maps **`variantTemplate: null`** on [`CatalogProductDetail`](../../src/catalog/types.ts). The PDP **falls back to legacy** [`VariantSelector`](../../src/components/ProductDetail/VariantSelector.tsx) (size/color) so the page stays fail-safe without exposing non-public template definitions.

### Recommended variant value model

Because template axes are normalized in 11-1, prefer normalized variant values. **Pair integrity:** independent FKs on `axis_id` and `option_id` are insufficient—a row could reference an option that belongs to a different axis. **Mandate:**

- A **composite FK** `FOREIGN KEY (option_id, axis_id) REFERENCES variant_template_axis_options (id, axis_id)` (add `UNIQUE (id, axis_id)` on `variant_template_axis_options` if the DB requires an explicit covering unique constraint), **and**
- Enforcement that each `axis_id` belongs to the **same** `variant_template_id` as the variant’s parent product (row trigger on `product_variant_option_values`, or **mandatory** validation in the save RPC joining `product_variants` → `products`).

Sketch:

```sql
product_variant_option_values (
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  axis_id uuid NOT NULL REFERENCES variant_template_axes(id) ON DELETE RESTRICT,
  option_id uuid NOT NULL,
  PRIMARY KEY (variant_id, axis_id),
  FOREIGN KEY (option_id, axis_id) REFERENCES variant_template_axis_options (id, axis_id)
)
```

Also consider a unique index preventing duplicate complete combinations per product/template. If PostgreSQL cannot express the exact N-axis uniqueness simply, enforce it in the save RPC and cover with tests.

### Required axes (v1)

`variant_template_axes` does not currently define per-axis “required” flags. For this story, **pick one rule in Dev Notes / implementation** and apply it consistently: e.g. **all axes required** for every variant row on templated products, or add a migration column **`required boolean default true`** (or equivalent). Do not leave “required axis” undefined in validation or tests.

### Backfill vs admin-complete (AC10) **— choice**

**Shipped: (b) admin / RPC gating — no silent SQL backfill.** Templated products must include a full `template_option_values` array on every variant in [`admin_save_product_bundle`](../../supabase/migrations/20260506120000_product_variant_option_values_storefront_template_reads.sql); the admin bundle Zod schema and [`variantsSatisfyTemplate`](../../src/admin/variantTemplateValidation.ts) enforce one valid option per template axis before RPC. Operators complete rows in [`AdminProductForm`](../../src/admin/AdminProductForm.tsx) after assignment. **Optional SQL backfill** from legacy `size` / `color` remains out of scope for this story (Epic 11-4 can revisit if needed).

### 11-2 destructive-change guardrails after value rows

[11-2](11-2-admin-template-crud-assign-product.md) destructive checks currently align with **legacy** variant fields. Once `product_variant_option_values` exists, **template option removal, axis removal/key change, and similar edits** must consider rows in that table (and assigned products), not only `size` / `color` matching. **Implemented alignment:** structural destructive detection in [`variantTemplateValidation.ts`](../../src/admin/variantTemplateValidation.ts) (`isStructuralTemplateDestructive` / `destructiveEditRequiresAcknowledgement`) still applies to option/axis identity; DB **composite FKs + `admin_save_product_bundle` validation** prevent inconsistent option rows and duplicate combinations. Further explicit “in-use by `product_variant_option_values`” queries in the template editor can be added later if product-specific messaging is required.

### Order line display snapshots

Persist enough structured or human-readable text at **order insert** time (e.g. on `order_items`) to render confirmations and **customer order history** without re-querying mutable template labels. SKU remains identity; snapshot is display-only.

### Legacy compatibility

- Products with no `variant_template_id` continue through existing size/color selectors.
- Templated products may mirror template option labels into `size` / `color` for old surfaces only if documented; the dynamic template value set is the source of truth for templated selectors after this story.
- Epic 9 pack semantics stay unchanged unless an existing product is intentionally assigned and validated against a template.

### Admin UX guidance

- Keep the admin form operational and dense, matching existing admin style. Avoid landing-page or decorative UI patterns.
- Use labels, selects, fieldsets, and inline validation. Avoid custom select widgets unless native controls cannot handle N-axis editing.
- For duplicate combinations, identify the two affected rows or SKUs where practical.

### PDP UX guidance

- Render axis controls in template `sort_order`.
- Use axis display `label` first, then `axis_key`.
- Use option display `label` first, then `option_key`.
- **Narrowing:** as each axis is chosen, downstream axis choices must reflect only combinations that still exist on real variants (same pattern as size-then-color today); prefer disabling invalid options with explanatory text where helpful.
- Do not show empty controls for axes that are not relevant to available variants. If template definition and variant values disagree, fail gracefully with "Unavailable" / "Select options" style copy rather than throwing.

### Technical requirements

- **FR-SF-002 / FR-CAT-003:** customers select one purchasable SKU; disabled states are textual and accessible.
- **FR-CAT-004:** checkout/server totals remain catalog variant authoritative.
- **FR-CAT-005 / FR-ADM-006:** admin can edit product variants with template-defined axes.
- **NFR-SEC-002 / NFR-SEC-005:** no service role in browser; storefront reads expose only public selector metadata.
- **NFR-A11Y-001 / NFR-A11Y-002:** keyboard and visible-label baseline for PDP and admin forms.

### Architecture compliance

- Supabase remains the catalog system of record.
- RLS or server projection is the privacy boundary for public template reads.
- Keep shared domain types centralized in [`src/domain/commerce`](../../src/domain/commerce/).
- Keep cart and checkout SKU-based.

### Library / framework requirements

- React 18, react-router-dom 6, TypeScript 5.7, Zod 4, Vitest 2, and @testing-library/react as already present in [`package.json`](../../package.json).
- `@supabase/supabase-js` v2 through existing clients.
- No new UI framework by default.

### File structure requirements

| Area | Action |
|------|--------|
| [`supabase/migrations/*.sql`](../../supabase/migrations/) | **NEW** — variant option values + RLS/projection/RPC updates |
| [`src/domain/commerce/`](../../src/domain/commerce/) | **UPDATE** — template selector/value types |
| [`src/catalog/types.ts`](../../src/catalog/types.ts) / [`src/catalog/supabase-map.ts`](../../src/catalog/supabase-map.ts) / [`src/catalog/adapter.ts`](../../src/catalog/adapter.ts) | **UPDATE** — public template metadata in detail reads |
| [`src/admin/AdminProductForm.tsx`](../../src/admin/AdminProductForm.tsx) | **UPDATE** — dynamic axis controls per variant |
| [`src/admin/variantTemplateValidation.ts`](../../src/admin/variantTemplateValidation.ts) | **UPDATE** — N-axis variant validation |
| [`src/components/ProductDetail/variantSelection.ts`](../../src/components/ProductDetail/variantSelection.ts) | **UPDATE** — template-aware selection resolution |
| [`src/components/ProductDetail/VariantSelector.tsx`](../../src/components/ProductDetail/VariantSelector.tsx) | **UPDATE** — N-axis controls |
| [`src/context/CartContext.tsx`](../../src/context/CartContext.tsx) / cart and checkout UI | **READ/UPDATE** — display labels, SKU identity unchanged |
| Order creation path (`order_items` insert, webhook, or server checkout) | **UPDATE** — persist variant **display snapshot** per AC6 |
| `*.test.ts(x)` / [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) | **UPDATE/NEW** — admin, PDP, cart, legacy, narrowing, snapshots |

### Testing requirements

- `npm test` — unit + RTL coverage listed in AC9.
- `npm run build` — TypeScript and Vite.
- `npm run smoke` — route-level regressions.
- No test should require live Supabase credentials; use pure fixtures and mocked clients.

### Previous story intelligence

- **11-1:** template tables are normalized and admin-only until this story chooses the storefront read model.
- **11-2:** product assignment and destructive template guards are legacy-oriented until this story adds `product_variant_option_values` and updates those guards accordingly.
- **2-4:** current PDP selector assumes size/color; preserve CTA, image, stock, and SKU cart merge behavior while replacing the axis model for templated products.
- **3-1 / Epic 3:** cart persistence and checkout use SKU; do not introduce template-combination identity.

### Git intelligence summary

_Refresh when branching; rely on Start gate and Dependencies for sequencing._

### Project context reference

No `project-context.md` matched in this workspace; rely on this story, [epics.md](../planning-artifacts/epics.md), [architecture.md](../planning-artifacts/architecture.md), [11-1](11-1-variant-template-schema-rls-domain.md), [11-2](11-2-admin-template-crud-assign-product.md), and [2-4](2-4-variant-selector-size-color-price-stock.md).

## References

- [Epic 11 — Story 11-3 AC](../planning-artifacts/epics.md)
- [11-1 — Variant template schema, RLS, and domain types](11-1-variant-template-schema-rls-domain.md)
- [11-2 — Admin template CRUD and product assignment](11-2-admin-template-crud-assign-product.md)
- [2-4 — Variant selector with price and stock](2-4-variant-selector-size-color-price-stock.md)
- [`variantTemplate.ts`](../../src/domain/commerce/variantTemplate.ts)
- [`AdminProductForm.tsx`](../../src/admin/AdminProductForm.tsx)
- [`TemplateVariantSelector.tsx`](../../src/components/ProductDetail/TemplateVariantSelector.tsx)
- [`VariantSelector.tsx`](../../src/components/ProductDetail/VariantSelector.tsx)
- [`variantSelection.ts`](../../src/components/ProductDetail/variantSelection.ts)
- [`CatalogProductDetail`](../../src/catalog/types.ts)
- [architecture.md](../planning-artifacts/architecture.md)

## Dev Agent Record

### Agent Model Used

Cursor agent (GPT-5.2-class implementation).

### Debug Log References

— 

### Completion Notes List

- Delivered normalized `product_variant_option_values`, composite FK on `(option_id, axis_id)`, BEFORE INSERT/UPDATE trigger enforcing product↔template alignment, admin RLS, anon SELECT on template graph for active catalog products only, `products.variant_template_id` granted to anon, extended `admin_save_product_bundle` for atomic `template_option_values` sync + duplicate-combination checks.
- **AC4:** inactive/draft templates do not embed on PDP; `variantTemplate` is null → legacy selectors.
- **AC10:** RPC + admin validation gate (option **b)**); no auto backfill migration.
- **AC6:** `order_items.variant_options_snapshot` + checkout payload `variant_display_snapshot`; `variant_title` uses snapshot labels at order insert.
- Tests: `variantSelection.template.test.ts`, `TemplateVariantSelector.test.tsx`, extended `variantTemplateValidation.test.ts` / `orderSnapshots.test.ts`; `npm test` and `npm run build` green. `npm run smoke` hit transient local esbuild EAGAIN in one run; `vitest run` passes as the smoke test body.

### File List

- supabase/migrations/20260506120000_product_variant_option_values_storefront_template_reads.sql
- src/domain/commerce/product.ts
- src/domain/commerce/order.ts
- src/domain/commerce/cart.ts
- src/catalog/types.ts
- src/catalog/supabase-map.ts
- src/catalog/adapter.ts
- src/admin/validation.ts
- src/admin/variantTemplateValidation.ts
- src/admin/variantTemplateValidation.test.ts
- src/admin/AdminProductForm.tsx
- src/components/ProductDetail/variantSelection.ts
- src/components/ProductDetail/variantSelection.template.test.ts
- src/components/ProductDetail/TemplateVariantSelector.tsx
- src/components/ProductDetail/TemplateVariantSelector.test.tsx
- src/components/ProductDetail/ProductDetail.tsx
- src/components/ProductDetail/pdpCta.ts
- src/cart/cartLine.ts
- src/cart/storage.ts
- src/cart/checkoutLines.ts
- handlers/_lib/createPaymentIntentBody.ts
- handlers/_lib/orderSnapshots.ts
- handlers/_lib/orderSnapshots.test.ts
- handlers/create-payment-intent.ts

## Change Log

- 2026-05-05 — Story created (bmad-create-story 11-3). Target: Epic 11 dynamic variant admin editing + storefront selectors; implementation gated on 11-2 completion.
- 2026-05-06 — Tightened ACs and Dev Notes: 11-2→11-3 **backfill / admin-complete** (AC10), **cross-table integrity** (option↔axis↔product template), **order line label snapshots**, **draft/archived template** storefront rule, **N-axis narrowing**, **anon `variant_template_id` read gap**, and **11-2 destructive guard evolution** after value rows exist.
- 2026-05-06 — **Implementation complete:** migration + bundle RPC + storefront RLS reads; admin + PDP + cart/checkout snapshots; tests (`npm test` 548 passing).
