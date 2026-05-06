# Story 11.2: Admin template CRUD and product assignment

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- [11-1](11-1-variant-template-schema-rls-domain.md) — **must be completed or landed in the same stacked PR first**. This story consumes the template tables/types/RLS and `products.variant_template_id` created there; it should not re-invent the schema.
- [2-6](2-6-admin-create-edit-product-variants.md) — existing protected admin catalog UI, `RequireAdmin`, Supabase browser client, `admin_save_product_bundle`, and admin validation pattern.
- [2-4](2-4-variant-selector-size-color-price-stock.md) — current storefront SKU/variant semantics and legacy size/color behavior.
- [Epic 11 — Story 11-2](../planning-artifacts/epics.md) — authoritative acceptance criteria summary.

## Story

As the **store owner**,
I want to **create, edit, archive, and assign variant templates from the protected admin area**,
so that new product families can use ordered, reusable variant axes without hand-editing SQL or JSON.

As a **developer maintaining catalog integrity**,
I want template assignment to validate against existing product variants and block destructive edits unless explicitly acknowledged,
so that SKU identity, legacy products, and Epic 9 fixed-assortment semantics are not silently broken.

## Acceptance Criteria

1. **Given** an authenticated admin session, **when** the owner opens an admin template management surface (for example `/admin/variant-templates`), **then** they can list existing templates with name, status, axis count, option count (or equivalent summary), updated time, and clear create/edit/archive affordances. Unauthenticated or non-admin users remain blocked by the existing [`RequireAdmin`](../../src/admin/RequireAdmin.tsx) flow.

2. **Given** an admin creates a template with ordered axes (for example `fit`, `rise`) and option sets, **when** the save succeeds, **then** the persisted template reloads with the same axis order, option order, stable axis keys, display labels, and lifecycle status. Axis keys must be normalized/validated as stable identifiers (lowercase slug-like strings are acceptable); duplicate axis keys within a template are rejected with a visible error.

3. **Given** an admin edits a template, **when** the change is non-destructive (label copy, description, ordering, adding new options that do not invalidate existing assigned product variants), **then** it saves without changing existing product SKUs, prices, inventory, images, or status fields.

4. **Given** a template edit would invalidate existing assigned products or SKUs (for example removing an axis/option already used by variants, renaming a stable axis key, or clearing required option lists), **when** the owner attempts the save, **then** the UI/API blocks the change or requires an explicit acknowledgment workflow that is auditable in code and impossible to trigger accidentally. Silent data loss is not allowed.

5. **Given** a draft or active product in [`AdminProductForm`](../../src/admin/AdminProductForm.tsx), **when** the admin assigns or clears a template, **then** the form persists `product.variant_template_id` through the same admin save boundary and surfaces actionable errors when the product's existing variants do not match the selected template. Clearing a template preserves legacy size/color behavior.

6. **Given** a product has `variant_template_id` set, **when** story 11-2 is complete, **then** the product editor can display the assigned template identity and basic axis summary, but **does not** need to replace the variant row editor with dynamic template-driven controls; full dynamic variant editing belongs to [11-3](../planning-artifacts/epics.md).

7. **Given** **NFR-A11Y-002 / UX-DR13**, **when** template and assignment forms render, **then** every input/select/checkbox has a visible label, validation errors are visible and associated with the relevant section, keyboard tab order is usable, and controls do not overflow at narrow admin widths.

8. **Given** completion, **when** validation runs, **then** add tests that do not require live Supabase credentials: pure validation tests for axis/option rules and destructive-change detection, plus RTL/route coverage for protected template management and product assignment states where practical. Run **`npm test`**, **`npm run build`**, and **`npm run smoke`**.

## Tasks / Subtasks

- [x] **Task 1 — Admin template route and list (AC: 1, 7)**  
  - [x] Add a protected route such as `/admin/variant-templates` under [`AppRoutes`](../../src/components/App/App.tsx) and navigation in [`AdminLayout`](../../src/admin/AdminLayout.tsx).  
  - [x] Add a list page under [`src/admin/`](../../src/admin/) that loads template rows via the Supabase browser client under 11-1 admin RLS.  
  - [x] Provide loading, empty, error, and populated states; keep the layout consistent with existing admin products/orders.

- [x] **Task 2 — Template editor and validation model (AC: 2, 3, 7)**  
  - [x] Add admin-side Zod schemas/helper functions for template form rows, axis keys, option ordering, duplicate detection, and lifecycle status. Prefer reusing 11-1 domain exports instead of duplicating shapes.  
  - [x] Build create/edit form UI for template name, description (if supported by 11-1), status, ordered axes, and ordered options.  
  - [x] Normalize blank optional fields to `null` / omitted values consistently with the 11-1 DB contract.

- [x] **Task 3 — Destructive edit guardrails (AC: 4)**  
  - [x] Detect whether a template is assigned to products and whether existing variant metadata/options would be invalidated by an edit.  
  - [x] Block unsafe changes by default with a clear message, or implement an explicit acknowledgment checkbox/button path.  
  - [x] Unit-test the guard helper with safe edits, axis-key removal/rename, option removal, and assigned/unassigned templates.

- [x] **Task 4 — Product assignment integration (AC: 5, 6)**  
  - [x] Extend [`AdminProductForm`](../../src/admin/AdminProductForm.tsx) load query to include `variant_template_id` and available template choices.  
  - [x] Extend [`src/admin/validation.ts`](../../src/admin/validation.ts) / `bundleToRpcPayload` to carry `variant_template_id` through `admin_save_product_bundle` after 11-1 adds RPC support.  
  - [x] Add assignment UI with current template summary and clear-template option. Do **not** replace fixed size/color variant fields yet unless required to show validation errors.

- [x] **Task 5 — Tests and verification (AC: 8)**  
  - [x] Add validation tests for template form schemas and destructive-change helpers.  
  - [x] Add RTL or smoke coverage for template routes and product assignment UI without live Supabase.  
  - [x] Run `npm test`, `npm run build`, and `npm run smoke`.

## Dev Notes

### Scope boundary

- **Not** schema/RLS/domain creation — [11-1](11-1-variant-template-schema-rls-domain.md). If `variant_templates` / `products.variant_template_id` / `variantTemplateSchema` are absent, finish 11-1 first rather than building placeholder storage.
- **Not** customer PDP selector changes — [11-3](../planning-artifacts/epics.md).
- **Not** catalog adapter mixed-shape rollout or static seed migration — [11-4](../planning-artifacts/epics.md).
- **Not** a configurable bundle composer or customer-facing "build your own pack" flow; Epic 11 is admin-defined variant metadata only.

### Expected implementation shape

- Reuse the existing admin stack: [`AuthProvider`](../../src/auth/AuthContext.tsx), [`RequireAdmin`](../../src/admin/RequireAdmin.tsx), [`getSupabaseBrowserClient`](../../src/lib/supabaseBrowser.ts), and admin route layout.
- Direct Supabase browser reads/writes are acceptable **only** because 11-1 RLS is admin-only. If destructive validation needs transactional guarantees, add a narrow RPC rather than several independent writes that can partially succeed.
- Prefer small local helpers in `src/admin/` for form state and validation; keep shared commerce/domain schemas in `src/domain/commerce/`.

### Data model notes from 11-1

- Planning text says `template_id`, but story 11-1 prefers `products.variant_template_id`; use that column name unless the 11-1 implementation deliberately chose and documented another name.
- If 11-1 chose normalized child tables (`variant_template_axes`, `variant_template_axis_options`), preserve `sort_order` and stable `axis_key` / option identifiers when saving.
- If 11-1 chose a single JSONB definition column, save through a Zod-validated object and avoid ad hoc JSON string editing in React state.

### Destructive-change policy

At minimum, treat these as unsafe when the template is assigned to at least one product:

- Removing an axis or changing an axis stable key.
- Removing an option already represented by assigned product variants.
- Changing definition shape in a way that would make existing variant rows fail the 11-1 template schema.

Renaming display labels, editing descriptions, reordering, adding axes/options, or archiving an unused template may be safe if tests prove current product variants still validate.

### Product assignment behavior

- Assignment should persist through the existing product save action so the owner does not need a separate product-template save step.
- Clearing a template sets `variant_template_id` to `null` and leaves current `size` / `color` fields intact.
- If a selected template does not match existing variant rows, show a precise validation message and keep the save blocked. Full UI for generating/filling dynamic variant axes waits for 11-3.

### Technical requirements

- **FR-CAT-005 / FR-ADM-006:** product admin remains the catalog management surface; template CRUD extends it without weakening existing product/variant validation.
- **FR-ADM-001 / NFR-SEC-003:** all template pages and mutations remain admin-only through existing auth + 11-1 RLS/RPC checks.
- **NFR-A11Y-002 / UX-DR13:** visible labels and validation states for every template field.
- **NFR-MAINT-001:** keep one coherent template/domain model; avoid parallel "admin-only template" types when 11-1 domain exports exist.

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): Supabase is the system of record; RLS is the data boundary; admin UI should stay boring, typed, and predictable.
- Existing admin UI is intentionally compact and operational. Do not turn template management into a marketing-style page or add a new design-system dependency unless implementation proves the current stack cannot support the workflow.

### Library / framework requirements

- **React 18**, **react-router-dom 6**, **TypeScript 5.7**, **Zod 4**, **Vitest 2**, and **@testing-library/react** as already present in [`package.json`](../../package.json).
- **`@supabase/supabase-js` v2** through the existing browser client. No service-role key in browser code.
- No new UI framework by default.

### File structure requirements

| Area | Action |
|------|--------|
| [`src/components/App/App.tsx`](../../src/components/App/App.tsx) | **UPDATE** — protected `/admin/variant-templates` route(s) |
| [`src/admin/AdminLayout.tsx`](../../src/admin/AdminLayout.tsx) | **UPDATE** — template navigation |
| `src/admin/AdminVariantTemplateList.tsx` | **NEW** — list/empty/error states |
| `src/admin/AdminVariantTemplateForm.tsx` | **NEW** — create/edit/archive form |
| `src/admin/variantTemplateValidation.ts` | **NEW** or equivalent — form schemas + destructive-change helpers |
| [`src/admin/AdminProductForm.tsx`](../../src/admin/AdminProductForm.tsx) | **UPDATE** — assign/clear template |
| [`src/admin/validation.ts`](../../src/admin/validation.ts) | **UPDATE** — `variant_template_id` in save payload |
| `src/admin/*.test.ts(x)` / [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) | **UPDATE/NEW** — route, validation, assignment coverage |

### Testing requirements

- `npm test` — pure helpers + relevant component tests.
- `npm run build` — TypeScript and Vite build.
- `npm run smoke` — route smoke remains green. Add a protected route smoke assertion if route registration changes.

### Previous story intelligence

- **11-1:** establishes admin-only template persistence and optional `products.variant_template_id`; 11-2 must consume it.
- **2-6:** product admin writes use `admin_save_product_bundle` as the transactional save boundary; do not bypass it for product assignment unless a new RPC is explicitly safer.
- **8-4 / 6-4:** admin layout is mobile-conscious and PWA-aware; keep template forms touch-friendly and horizontally stable.
- **Epic 9:** fixed-assortment / single-axis products should remain legacy (`variant_template_id = null`) until 11-4 validates rollout.

### Git intelligence summary

Current workspace already contains uncommitted Epic 11 planning/story prep (`epics.md`, `sprint-status.yaml`, and 11-1). Keep this story additive and avoid editing implementation code during create-story.

### Project context reference

No `project-context.md` matched in this workspace; rely on this story, [epics.md](../planning-artifacts/epics.md), [architecture.md](../planning-artifacts/architecture.md), and linked prior stories.

## References

- [Epic 11 — full epic + Story 11-2 AC](../planning-artifacts/epics.md)
- [11-1 — Variant template schema, RLS, and domain types](11-1-variant-template-schema-rls-domain.md)
- [2-6 — Admin create/edit product and variants](2-6-admin-create-edit-product-variants.md)
- [`AdminProductForm.tsx`](../../src/admin/AdminProductForm.tsx)
- [`src/admin/validation.ts`](../../src/admin/validation.ts)
- [`AdminLayout.tsx`](../../src/admin/AdminLayout.tsx)
- [`App.tsx`](../../src/components/App/App.tsx)
- [architecture.md](../planning-artifacts/architecture.md)

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

Python 3 resolver `resolve_customization.py` failed on PATH Python <3.11; workflow customization read from `bmad-dev-story/customize.toml` directly.

### Completion Notes List

- Added `variantTemplateValidation` (Zod admin form schema, Supabase row → domain parse, destructive edit + variant-vs-template checks) with Vitest coverage.
- Added `admin_save_variant_template` RPC migration for atomic template writes; `AdminVariantTemplateForm` now saves via RPC instead of sequential client DML.
- `AdminVariantTemplateList`, routes, and nav were already present; list page confirmed and assignment flow in `AdminProductForm` validated (template picklist, summary, `variantsSatisfyTemplate` at save).
- Smoke test covers unauthenticated `/admin/variant-templates` gate. Ran `npm test`, `npm run build`, `npm run smoke` successfully.

### File List

- `src/components/App/App.tsx`
- `src/admin/AdminLayout.tsx`
- `src/admin/AdminLayout.test.tsx`
- `src/admin/variantTemplateValidation.ts`
- `src/admin/variantTemplateValidation.test.ts`
- `supabase/migrations/20260505183000_admin_save_variant_template_rpc.sql`
- `src/admin/AdminVariantTemplateForm.tsx`
- `src/admin/AdminVariantTemplateList.tsx`
- `src/admin/AdminProductForm.tsx`
- `src/routes.smoke.test.tsx`

### Review Findings

- [ ] [Review][Decision] **Clarify stacked Epic 11 scope before closing 11-2** — The review diff captured a wide working tree (storefront PDP/cart/checkout/catalog paths and Epic 11-3 sprint/docs changes alongside template admin work). Decide whether delivery is intentional **stacked Epic 11** vs **must split commits/PRs** so Story 11-2 acceptance traces only template CRUD + product assignment.

- [ ] [Review][Decision] **Reconcile variant editor UX with AC6 (“summary vs dynamic axes”)** — `AdminProductForm` includes per-variant “Template axes” `<select>`s per SKU row (`fieldset`). Story AC6 states the editor can show assignment **summary** and does **not** need dynamic template-driven controls for rows (11-3). Confirm retaining this richer UI vs peeling back for scope alignment.

- [ ] [Review][Patch] **Dedupe SKU snapshot merge ignores later `variant_display_snapshot`** `[handlers/_lib/orderSnapshots.ts:~47]`

- [ ] [Review][Patch] **Preserve `variant_display_snapshot` when retrying checkout line parse without `variant_id`** `[src/cart/checkoutLines.ts:~31]`

- [ ] [Review][Patch] **Stale `template_option_values` when `variant_template_id` changes before templates load** `[src/admin/AdminProductForm.tsx:~568]`

- [ ] [Review][Patch] **Broaden RTL beyond validation/unit coverage for AC8** (`AdminVariantTemplateList` / form assignment flows vs smoke-only gate).

- [x] [Review][Defer] **Destructive template edit acknowledgement has no persisted audit/event** `[src/admin/AdminVariantTemplateForm.tsx]` — deferred; acknowledgement is UX-only vs AC4 “auditable” wording.

- [x] [Review][Defer] **Destructive guards lean on structural diff + assignment count vs per-variant option-id usage** `[src/admin/variantTemplateValidation.ts]` — deferred refinement for “option already referenced” precision.

- [x] [Review][Defer] **`variant_display_snapshot` / display labels trusted from client on payment intent payload** `[handlers/_lib/createPaymentIntentBody.ts]` — deferred to hardening story (derive or verify server-side).

- [x] [Review][Defer] **Storefront PDP/catalog/checkout edge gaps in stacked hunks** (e.g. list vs detail selects, PDP branch conditions, RLS anon column posture) — deferred to owning **11-3 / 11-4** stories rather than blocking 11-2 template admin closure.

## Change Log

- 2026-05-05 — Story created (bmad-create-story). Target: Epic 11 admin template CRUD + product assignment; depends on 11-1 schema/RLS/domain completion.
- 2026-05-05 — Implemented 11-2: validation module + tests, transactional template RPC + form wiring, product assignment checks, smoke route.
