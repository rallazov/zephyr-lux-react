# Story 11.4: Template legacy coexistence and rollout

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story before dev-story if you want the extra quality gate. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- [11-1](11-1-variant-template-schema-rls-domain.md) - template tables, `products.variant_template_id`, admin-only RLS, and shared `variantTemplateSchema`.
- [11-2](11-2-admin-template-crud-assign-product.md) - template CRUD, product assignment, destructive-change guardrails, and `admin_save_variant_template`; currently `review` in sprint status.
- [11-3](11-3-dynamic-variant-admin-storefront-selectors.md) - dynamic admin variant values and PDP selector behavior; currently `in-progress` in sprint status. Implement this story only after 11-3 lands, or as an explicitly coordinated stacked change.
- [2-4](2-4-variant-selector-size-color-price-stock.md), [2-6](2-6-admin-create-edit-product-variants.md), and [9-1](9-1-fixed-assortment-pack-catalog.md) - legacy selector rules, admin save boundary, and fixed-assortment pack semantics that must continue to work.
- [Epic 11 - Story 11-4](../planning-artifacts/epics.md) - authoritative epic-level AC summary.

## Story

As the **store owner**,
I want **legacy size/color products and templated products to coexist during rollout**,
so that existing catalog rows, Epic 9 pack products, cart lines, checkout, and admin edits keep working while new product families adopt reusable templates.

As a **developer maintaining catalog integrity**,
I want **Supabase and static catalog adapters to resolve template metadata only when it belongs to the product being loaded**,
so that mixed catalog data cannot throw at runtime, leak unrelated template definitions, or silently change SKU/price authority.

## Acceptance Criteria

1. **Mixed catalog read safety**  
   **Given** catalog data contains both products with `variant_template_id` and products with `variant_template_id` null, **when** storefront list, category, search, PDP, cart hydration, checkout entry, and smoke route loaders run through the static or Supabase catalog adapter, **then** both shapes resolve without throwing. Template metadata and option-value rows must be associated only with the loaded product/variant; no cross-product or unrelated-template leakage is allowed.

2. **Legacy fallback is explicit**  
   **Given** a product has no assigned template, **when** the static parser, Supabase mapper, PDP selector model, cart validation, checkout line generation, or admin product save runs, **then** current legacy `size` / `color` behavior remains the source of truth. Template DTO fields may be `null`, `undefined`, or empty arrays, but they must not cause alternate selector behavior for legacy rows.

3. **Templated read model is coherent**  
   **Given** a product has an active template and per-variant template option values from 11-3, **when** `getProductBySlug` or any detail-level mapper builds `CatalogProductDetail`, **then** the public selector metadata includes ordered axes, ordered options, and each variant's option values using the same DTO shape for Supabase and static fixtures. Price, inventory, status, image, subscription-plan scope, and SKU remain read from `product_variants`, not from template metadata.

4. **Epic 9 fixed-assortment semantics do not regress**  
   **Given** `boxer-briefs` and other fixed-assortment or hidden-axis products use legacy conventions such as `color` null/single-valued and pack copy, **when** templates are absent or later attached through a documented rollout path, **then** PDP shows the same meaningful choice surface, one line item still means one retail pack, SKUs remain unique, `legacy_storefront_id` remains stable, and old black/blue alternative semantics are not reintroduced.

5. **Rollout guidance or script exists**  
   **Given** existing products may be migrated gradually, **when** this story completes, **then** the repo contains clear migration notes, and optionally a dry-run-capable SQL/script, explaining how to attach templates to existing products. The guidance must map legacy `size` / `color` to template axes only when unambiguous, skip or flag ambiguous rows, preserve SKU uniqueness/product images/subscription-plan links, and describe rollback/clear-template behavior.

6. **Admin assign/clear path remains safe**  
   **Given** the admin assigns or clears a template on a product, **when** the product is saved, **then** active/browsable products cannot be left in a state where storefront selectors need template option values that do not exist. Clearing a template preserves legacy fields and does not delete SKUs, inventory, images, or product copy. If 11-3 changed `admin_save_product_bundle`, 11-4 must keep its validation and error messages aligned.

7. **Cart, checkout, and order snapshots stay SKU-based**  
   **Given** a templated or legacy product is added to cart, **when** cart reconciliation, `/api/cart-quote`, PaymentIntent setup, and order item snapshot creation run, **then** line identity and price authority stay SKU/quantity based. Template labels are display metadata only. Historical order lines must continue to use persisted snapshots and must not re-resolve mutable template labels after purchase.

8. **Graceful malformed-data handling**  
   **Given** catalog data is partially rolled out, such as a product with `variant_template_id` but missing public template rows, a variant missing option values, or a static fixture with invalid template shape, **when** mappers parse the data, **then** failures are test-covered and actionable. Prefer blocking only the affected templated product/detail path with clear error handling; legacy products and unrelated catalog rows must continue to load.

9. **Verification**  
   **Given** completion, **when** validation runs, **then** tests cover at least: legacy-only product, templated product detail, mixed static fixture, mixed Supabase mapper fixture, Epic 9 pack regression, admin assign/clear template path, malformed/cross-product template row rejection, and cart/checkout SKU invariants. Run `npm test`, `npm run build`, and `npm run smoke`.

## Tasks / Subtasks

- [ ] **Task 1 - Catalog read-model audit and DTO decision (AC: 1, 2, 3, 8)**  
  - [ ] Read current 11-3 branch state before editing: `src/domain/commerce/product.ts`, `src/catalog/types.ts`, `src/catalog/adapter.ts`, `src/catalog/supabase-map.ts`, `src/catalog/parse.ts`, `src/catalog/raw-static.ts`, and any new template/value helpers.  
  - [ ] Define one public template selector DTO shared by Supabase and static code paths. Reuse `src/domain/commerce/variantTemplate.ts` where possible; do not create a second root product model.  
  - [ ] Decide whether list reads carry template metadata or only detail reads do. If list reads stay light, ensure PLP/search/category rows for templated products still parse without embedded template relations.

- [ ] **Task 2 - Supabase adapter coexistence (AC: 1, 3, 8)**  
  - [ ] Update `PRODUCTS_CATALOG_SELECT` and mapper row types only as needed for public template metadata and per-variant option values.  
  - [ ] Ensure `products.variant_template_id`, `variant_templates`, axes/options, and `product_variant_option_values` are read only through 11-3-approved RLS/projection rules.  
  - [ ] In `supabaseBundleToCatalogDetail` / `supabaseRowsToProduct`, validate that every option value belongs to the product's assigned template and variant. Reject or safely omit malformed templated details without affecting legacy rows.  
  - [ ] Add Supabase mapper fixtures for one legacy product, one templated product, and one malformed/cross-product template relation.

- [ ] **Task 3 - Static catalog compatibility (AC: 1, 2, 3, 4, 8)**  
  - [ ] Extend `staticSeedProductRowSchema` and `parseStaticCatalogData` only if static templated fixtures/data need template metadata. Keep current `data/products.json` valid without template fields.  
  - [ ] Add at least one pure static templated fixture in tests so Vite `MODE === "test"` has coverage for the template DTO path without live Supabase.  
  - [ ] Preserve duplicate-SKU validation across all static rows. Template option values must not affect SKU uniqueness.

- [ ] **Task 4 - Rollout notes / optional migration script (AC: 4, 5, 6)**  
  - [ ] Add a rollout document, recommended path `docs/variant-template-rollout.md`, or an equivalent clearly linked handoff.  
  - [ ] Include dry-run queries/checklists for: products with `variant_template_id`, variants missing option values, duplicate complete combinations, templates attached to active/coming-soon products, and Epic 9 pack products.  
  - [ ] Document safe mappings from legacy `size` / `color` to template axes, ambiguous-case behavior, clear-template rollback, and production verification steps.

- [ ] **Task 5 - Admin assignment/clear regression belt (AC: 6, 8, 9)**  
  - [ ] Update or add tests around `AdminProductForm`, `variantTemplateValidation`, and `bundleToRpcPayload` for assign/clear behavior after 11-3 value rows.  
  - [ ] Confirm clearing `variant_template_id` does not delete legacy `size` / `color`, SKUs, images, or subscription plans.  
  - [ ] Confirm assigning a template to an active/browsable product blocks save unless complete option values exist or the rollout doc/script has populated them.

- [ ] **Task 6 - Cart, checkout, and historical display invariants (AC: 7, 9)**  
  - [ ] Add tests proving `StorefrontCartLine`, `normalizeLineSku`, `toCheckoutLines`, `quoteCartLines`, and order snapshot creation remain SKU/quantity based for templated and legacy products.  
  - [ ] Ensure cart display may show template labels when present, but reconciliation and pricing still use catalog variant price by SKU.  
  - [ ] Confirm `order_items.variant_options_snapshot` or the 11-3-equivalent snapshot remains display-only and historical order/status views do not depend on live template label changes.

- [ ] **Task 7 - Verification (AC: 9)**  
  - [ ] Run `npm test`.  
  - [ ] Run `npm run build`.  
  - [ ] Run `npm run smoke`.  
  - [ ] Record any intentionally deferred rollout/manual production steps in the Dev Agent Record.

## Dev Notes

### Start gate

- Sprint status currently has `11-3-dynamic-variant-admin-storefront-selectors: in-progress`. Do not start 11-4 implementation until 11-3 is merged or the branch owner explicitly chooses a stacked flow.
- The current worktree already contains in-progress 11-3 artifacts: `src/domain/commerce/product.ts` has `template_option_values`, and `supabase/migrations/20260506120000_product_variant_option_values_storefront_template_reads.sql` adds option values, storefront template reads, and `order_items.variant_options_snapshot`. Treat those as existing work; do not rewrite them during 11-4 unless you are deliberately finishing that stack.

### Scope boundary

- **Not** template schema/RLS creation - 11-1.
- **Not** template CRUD/product assignment UI - 11-2.
- **Not** initial dynamic admin variant controls or PDP selector implementation - 11-3.
- **Not** a forced production migration that assigns every existing product a template.
- **Not** checkout repricing by template metadata. Server totals remain SKU/variant authoritative.

### Current implementation state to preserve

- `data/products.json` and `supabase/seed.sql` contain the Epic 9 pack model for `boxer-briefs`: one retail pack per line item, SKUs `ZLX-2PK-*`, `color` null, and explicit pack copy.
- Test mode uses the static adapter (`readCatalogEnv()` returns `static` when `import.meta.env.MODE === "test"`), while `handlers/_lib/catalog.ts` also prices from bundled `data/products.json`. This means static catalog compatibility is not optional for CI even if production storefront uses Supabase.
- `SupabaseCatalogAdapter` currently uses one `PRODUCTS_CATALOG_SELECT` for list and detail. Be deliberate if embedding template relations there; list pages should not become fragile or leak unrelated templates.
- `supabaseRowsToProduct` is the Zod boundary for Supabase rows. Keep legacy rows valid when `variant_template_id` and template embeds are absent.
- `parseStaticCatalogData` validates duplicate SKUs globally and builds `CatalogProductDetail` for static rows. Keep `data/products.json` valid if no template fields are present.

### Adapter guardrails

- A product with `variant_template_id = null` is legacy. Do not inspect unrelated template rows to infer behavior.
- A product with `variant_template_id` may use template selector metadata only if the template is public under the 11-3 storefront rule and option values are complete enough for the selector model.
- Every per-variant option-value pair must belong to the selected variant and to an axis/option under the product's assigned template. Independent UUID presence is not enough.
- Static and Supabase adapters should expose the same **public** template selector shape to `ProductDetail`; avoid one-off Supabase-only branches in PDP where a mapper can normalize instead.

### Epic 9 pack guardrails

- Hidden-axis / fixed-assortment semantics are intentional. `boxer-briefs` must not show a color choice unless a future story explicitly changes the merchandising model.
- If a rollout template is attached to `boxer-briefs`, it should likely be a size-only template for the current pack model. Do not create a color axis with black/blue as alternatives for the pack.
- Preserve `legacy_storefront_id` values, static numeric product IDs, SKU strings, and product images unless a separate migration story changes them.

### Admin and rollout guidance

- Assignment can be gradual. Legacy products should work indefinitely with `variant_template_id` cleared.
- A rollout/backfill script should be safe-by-default: dry-run first, transaction where practical, skip ambiguous mappings, report affected products/SKUs, and never delete variants to make a template fit.
- Clearing a template should preserve legacy `size` / `color`; those fields are the fallback path and are also valuable for rollback.

### Technical requirements

- **FR-CAT-003 / FR-CART-001 / FR-CHK-003:** SKU/variant remains durable cart and checkout identity.
- **FR-CAT-004:** price authority remains catalog `product_variants.price_cents`, recomputed server-side.
- **FR-CAT-005 / FR-ADM-006:** admin can safely assign/clear templates without corrupting variants.
- **FR-ORD-005:** order item display stays snapshot-based after purchase.
- **NFR-SEC-002 / NFR-SEC-005:** no service role in browser; public template reads must be constrained by RLS or a safe projection.
- **UX-DR12 / UX-DR13:** selector/admin controls remain keyboard-operable with visible labels and errors.

### Architecture compliance

- Supabase remains the catalog system of record for production; static JSON remains a bundled/test/server quote path until explicitly retired.
- RLS/projection is the public privacy boundary for template reads.
- Shared commerce/domain types live under `src/domain/commerce`; catalog mappers adapt external rows into that shape.
- Keep admin UI operational and compact; no new UI framework is needed.

### Library / framework requirements

- Use the versions already present in `package.json`: React 18, react-router-dom 6, TypeScript 5.7, Zod 4, Vitest 2, Testing Library, and `@supabase/supabase-js` v2.
- No dependency upgrades or new catalog framework are expected for this story.

### File structure requirements

| Area | Action |
|------|--------|
| `src/catalog/types.ts` | **UPDATE** - public template selector DTO if 11-3 has not already added it |
| `src/catalog/adapter.ts` | **UPDATE** - Supabase select/projection shape; preserve static/list behavior |
| `src/catalog/supabase-map.ts` | **UPDATE** - normalize mixed legacy/templated relations with validation |
| `src/catalog/raw-static.ts` / `src/catalog/parse.ts` | **UPDATE IF NEEDED** - optional static template fixture support while keeping current JSON valid |
| `src/domain/commerce/product.ts` / `variantTemplate.ts` | **READ/UPDATE CAREFULLY** - reuse existing 11-3 fields; no parallel model |
| `src/admin/AdminProductForm.tsx` / `src/admin/variantTemplateValidation.ts` / `src/admin/validation.ts` | **READ/UPDATE** - assign/clear and bundle validation regressions |
| `src/components/ProductDetail/variantSelection.ts` / `VariantSelector.tsx` | **READ/UPDATE ONLY IF REQUIRED** - ensure mapper DTO feeds existing dynamic selector rules |
| `src/cart/*`, `src/context/CartContext.tsx`, `handlers/_lib/catalog.ts`, `handlers/_lib/orderSnapshots.ts` | **READ/TEST** - SKU invariants and snapshots |
| `data/products.json` / `supabase/seed.sql` | **READ/MAY UPDATE** - only if rollout fixture/seed alignment is required |
| `docs/variant-template-rollout.md` | **NEW RECOMMENDED** - rollout/backfill guidance |
| `*.test.ts(x)` / `src/routes.smoke.test.tsx` | **UPDATE/NEW** - mixed adapter, admin, cart/checkout, Epic 9 regression coverage |

### Testing requirements

- `npm test` - unit/RTL coverage for mixed catalog adapters, admin assign/clear, cart/checkout invariants, malformed template rows, and Epic 9 regression.
- `npm run build` - TypeScript + Vite.
- `npm run smoke` - route-level regressions.
- No test should require live Supabase credentials; use pure fixtures and mocked clients.

### Previous story intelligence

- **11-1:** normalized templates are admin-only until later storefront reads; `products.variant_template_id` exists but was initially hidden from anon column grants.
- **11-2:** assignment UI and destructive guards were originally legacy-oriented; after 11-3, guards must consult real option-value rows.
- **11-3:** owns option-value persistence, dynamic selectors, and line display snapshots. 11-4 should verify and harden coexistence rather than duplicate the selector implementation.
- **9-1:** fixed-assortment pack semantics are a real merchandising decision, not a data-cleanup accident.
- **3-1 / Epic 3:** cart identity remains `(storefrontProductId, sku)` and checkout payloads are SKU/quantity based.

### Git intelligence summary

- Recent commits and current uncommitted work focus on Epic 11 template assignment/dynamic values. Expect overlap in `src/catalog/*`, `src/domain/commerce/product.ts`, `AdminProductForm`, and `admin_save_product_bundle`; check `git status` and coordinate before editing.

### Latest technical information

- No new external technical dependency is required. Use repo-pinned package versions and existing Supabase RLS/RPC patterns.

### Project context reference

No `project-context.md` matched in this workspace; rely on this story, [epics.md](../planning-artifacts/epics.md), [architecture.md](../planning-artifacts/architecture.md), and linked prior stories.

## References

- [Epic 11 - Variant template builder](../planning-artifacts/epics.md)
- [11-1 - Variant template schema, RLS, and domain types](11-1-variant-template-schema-rls-domain.md)
- [11-2 - Admin template CRUD and product assignment](11-2-admin-template-crud-assign-product.md)
- [11-3 - Dynamic variant editing and storefront selectors](11-3-dynamic-variant-admin-storefront-selectors.md)
- [9-1 - Fixed-assortment pack catalog](9-1-fixed-assortment-pack-catalog.md)
- [`src/catalog/adapter.ts`](../../src/catalog/adapter.ts)
- [`src/catalog/supabase-map.ts`](../../src/catalog/supabase-map.ts)
- [`src/catalog/parse.ts`](../../src/catalog/parse.ts)
- [`src/catalog/raw-static.ts`](../../src/catalog/raw-static.ts)
- [`src/domain/commerce/variantTemplate.ts`](../../src/domain/commerce/variantTemplate.ts)
- [`src/domain/commerce/product.ts`](../../src/domain/commerce/product.ts)
- [`handlers/_lib/catalog.ts`](../../handlers/_lib/catalog.ts)
- [`handlers/_lib/orderSnapshots.ts`](../../handlers/_lib/orderSnapshots.ts)
- [architecture.md](../planning-artifacts/architecture.md)

## Dev Agent Record

### Agent Model Used

_(Record during implementation.)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-05-05 - Story created (bmad-create-story 11-4). Target: mixed legacy/template catalog adapter coexistence, Epic 9 pack-safe rollout guidance, and SKU-based cart/checkout invariants. Implementation gated on 11-3 landing or explicit stacked coordination.
