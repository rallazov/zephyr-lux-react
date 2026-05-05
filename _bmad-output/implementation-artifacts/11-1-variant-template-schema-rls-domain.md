# Story 11.1: Variant template schema, RLS, and domain types

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- [2-5](2-5-supabase-tables-catalog-inventory.md) — baseline `products`, `product_variants`, storefront **anon** catalog RLS.
- [2-6](2-6-admin-create-edit-product-variants.md) — admin JWT predicate (`coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'`) and `admin_save_product_bundle`.
- [Epic 11 — Story 11-1](../planning-artifacts/epics.md) (section **Story 11-1**) — authoritative acceptance criteria summary.

## Story

As a **developer** extending the catalog model,

I want **durable Postgres structures for variant templates**, a **nullable product→template link**, **admin-only RLS** aligned with existing catalog admin policies, and **Zod/domain types** at the TypeScript boundary,

so that **Epic 11** can add admin UI and storefront selectors **without** breaking legacy **size/color** variants when **`variant_template_id` is null**, and **without** introducing a second competing `Product` model.

As the **store owner** (future 11-2/11-3),

I want template data **writable only by admins** and **invisible to anonymous shoppers until explicitly exposed** in a later story,

so that **draft merchandising experiments** do not leak through **anon** catalog reads.

## Acceptance Criteria

1. **Given** [`product_variants`](../../supabase/migrations/20260426180000_catalog_inventory.sql) with `size` / `color` text columns, **when** migrations apply on a fresh DB, **then** new **`variant_templates`** (and supporting structures — see Dev Notes) exist with indexes/FKs/timestamps appropriate for admin CRUD in **11-2**. **`products.variant_template_id`** exists as **`uuid` nullable**, FK to **`variant_templates.id`**, **`ON DELETE SET NULL`** (or equivalent documented behavior). **No** breaking change to existing **`anon`** **SELECT** policies on **`products` / `product_variants` / `product_images`** — storefront behavior for legacy rows remains valid.

2. **Given** a product with **`variant_template_id IS NULL`**, **when** any storefront/admin path runs today’s flows, **then** behavior matches the **legacy** size/color model (**no** requirement for PDP or adapter to read templates in this story).

3. **Given** catalog admin RLS from [**2-6** / `catalog_admin_*`](../../supabase/migrations/20260426220000_admin_rls_and_save_rpc.sql), **when** template rows or **`products.variant_template_id`** are **mutated**, **then** **only** principals satisfying **`app_metadata.role = 'admin'`** may **insert/update/delete** template definitions; **`anon`** must **not** gain **SELECT** on template tables in **this** story (**11-3** may add constrained storefront read policies). **`authenticated` non-admin** must **not** read or write templates.

4. **Given** [`productSchema`](../../src/domain/commerce/product.ts) / [`productVariantSchema`](../../src/domain/commerce/product.ts), **when** types are extended, **then** validation stays **one coherent commerce module** — add **`variantTemplateSchema`** (and related types) alongside existing exports; **avoid** a parallel root `Product` tree. **`productSchema`** gains optional **`variant_template_id`** (`uuid` nullable) **only if** the admin payload and RPC already carry it (recommended for round-trip consistency).

5. **Given** [`admin_save_product_bundle`](../../supabase/migrations/20260430202100_admin_bundle_coming_soon_requires_variant.sql) is the **current** canonical RPC body, **when** the **`product`** JSON includes **`variant_template_id`** (uuid string or empty/null), **then** **INSERT** and **UPDATE** branches persist **`products.variant_template_id`** consistently (normalize empty → **`NULL`**; reject malformed uuid with a **clear** `22023`-style exception). **Do not** loosen existing validations (variants required for **active** / **coming_soon**, SKU uniqueness, etc.).

6. **Given** completion, **when** CI runs, **then** **`npm test`**, **`npm run build`**, and **`npm run smoke`** pass; add **Vitest** coverage for **new Zod schemas** (valid/invalid fixture payloads). Optional: extend **[`supabase/seed.sql`](../../supabase/seed.sql)** with **one** inactive/draft template row **only if** it helps local admin testing — **not** required for storefront.

## Tasks / Subtasks

- [x] **Task 1 — DDL (AC: 1)**  
  - [x] Add timestamped migration under [`supabase/migrations/`](../../supabase/migrations/) defining **`variant_templates`** (+ optional status enum mirroring **draft/active/archived** if you need lifecycle before 11-2).  
  - [x] **`ALTER TABLE public.products ADD COLUMN variant_template_id uuid REFERENCES public.variant_templates(id) ON DELETE SET NULL;`** + index on **`variant_template_id`** for joins.  
  - [x] Document physical shape of template definition (normalized child tables vs **`jsonb`** + check constraint) **in migration comments** — pick **one** approach and justify briefly in Dev Notes.

- [x] **Task 2 — RLS (AC: 3)**  
  - [x] **`ENABLE ROW LEVEL SECURITY`** on new template table(s).  
  - [x] Admin policies mirroring **`catalog_admin_all_products`** predicate (**authenticated** + **`role = admin`**) for **ALL** operations on template entities.  
  - [x] **No** **`anon`** policies on templates in this story.

- [x] **Task 3 — RPC alignment (AC: 5)**  
  - [x] **`CREATE OR REPLACE`** **`admin_save_product_bundle`** in the **same migration** (or follow-up if replace body is huge — prefer single migration for atomic deploy).  
  - [x] Extend **`INSERT`** / **`UPDATE`** column lists for **`products`** to include **`variant_template_id`** from **`v_p->>'variant_template_id'`**.

- [x] **Task 4 — Domain types (AC: 4)**  
  - [x] Add **`src/domain/commerce/variantTemplate.ts`** (or sibling module) exporting **`variantTemplateSchema`** and **`VariantTemplate`** type — shape must match DB/json contract chosen in Task 1.  
  - [x] Extend **`productSchema`** with optional **`variant_template_id`** if RPC/browser payloads need it; keep **legacy** products valid **without** the field.

- [x] **Task 5 — Verification (AC: 6)**  
  - [x] Unit tests for schemas.  
  - [x] **`npm test`**, **`npm run build`**, **`npm run smoke`**.

### Review Findings

- [x] [Review][Patch] Restrict anonymous access to `products.variant_template_id` now — Decision resolved with architect/product input: prefer the stricter product reading that template assignment should not become a public contract before 11-3.
- [x] [Review][Patch] Nullable DB labels are rejected by the domain schema [`src/domain/commerce/variantTemplate.ts`:10]
- [x] [Review][Patch] Template names and stable keys accept blank/whitespace values across DB and Zod [`supabase/migrations/20260504180000_variant_templates_normalized_rls_admin_bundle.sql`:12]
- [x] [Review][Patch] Template timestamps are incomplete for admin CRUD and parent `updated_at` can go stale [`supabase/migrations/20260504180000_variant_templates_normalized_rls_admin_bundle.sql`:14]

## Dev Notes

### Scope boundary

- **Not** admin CRUD UI — story **`11-2-admin-template-crud-assign-product`** (file not created yet).  
- **Not** PDP / cart selector changes — story **`11-3-dynamic-variant-admin-storefront-selectors`**.  
- **Not** `SupabaseCatalogAdapter` / **`supabase-map`** behavior changes beyond **types** needed for future joins — story **`11-4-template-legacy-coexistence-rollout`** owns mixed legacy+templated catalog reads. This story may add **unused** columns/types safely.

### Physical data model (choose deliberately)

**Option A — Normalized:** `variant_templates` + `variant_template_axes` + `variant_template_axis_options` (strong FK integrity, explicit **`sort_order`** per axis/option).

**Option B — Document in JSONB:** single **`variant_templates.definition jsonb`** with CHECK / app-layer **Zod** validation (fewer tables; harder SQL constraints).

Either is acceptable if **Zod** matches Postgres and **11-2** UX requirements are foreseeable (ordered axes, stable **`axis_key`** strings, option lists).

### RLS consistency

Reuse the **exact** admin predicate from existing catalog policies:

```sql
coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
```

Policy names should state intent (e.g. **`variant_templates_admin_all`**).

### `admin_save_product_bundle` fork

The live function body lives in the **latest** migration that **`CREATE OR REPLACE FUNCTION public.admin_save_product_bundle`** — today **[`20260430202100_admin_bundle_coming_soon_requires_variant.sql`](../../supabase/migrations/20260430202100_admin_bundle_coming_soon_requires_variant.sql)** (supersedes **`20260428104600_extend_admin_save_product_bundle_subscription_plans.sql`**). **Copy forward** the full current definition when replacing; **do not** resurrect an older shorter body.

### Naming vs epics text

Planning text sometimes says **`template_id`**; prefer DB column **`variant_template_id`** on **`products`** to avoid ambiguity with unrelated “templates” (email, pages).

### Preserve legacy Epic 9 semantics

Products using **fixed-assortment** / **single-axis** conventions ([Epic 9](../planning-artifacts/epics.md)) typically keep **`variant_template_id` null** until [**11-4**](../planning-artifacts/epics.md) proves coexistence — **do not** force template assignment in this story.

### Technical requirements

- **Single domain model:** extend [`src/domain/commerce/product.ts`](../../src/domain/commerce/product.ts) or colocated modules — **no** duplicate storefront `Product` interface.  
- **Security:** **NFR-SEC-002 / NFR-SEC-005** — **no service role** in browser; templates remain admin-only reads/writes in **this** story.  
- **Testing:** Vitest **offline**; mock-free pure **Zod** tests preferred.

### Architecture compliance

- [**architecture.md**](../planning-artifacts/architecture.md): Supabase system of record; **RLS as boundary**; TypeScript + centralized commerce types.

### Library / framework requirements

- **Zod** — already in repo; match existing strict patterns ([`productVariantSchema`](../../src/domain/commerce/product.ts)).  
- **`@supabase/supabase-js` ^2.x** — [**package.json**](../../package.json); no upgrade required for DDL story.

### File structure requirements

| Area | Action |
|------|--------|
| [`supabase/migrations/*.sql`](../../supabase/migrations/) | **NEW** — templates + **`products.variant_template_id`** + RLS + RPC replace |
| [`src/domain/commerce/`](../../src/domain/commerce/) | **NEW** / **UPDATE** — `variantTemplate` schemas + optional `productSchema` field |
| [`supabase/seed.sql`](../../supabase/seed.sql) | **OPTIONAL** — sample template |
| `src/domain/commerce/*.test.ts` | **NEW** — schema fixtures |

### Testing requirements

- **`npm test`** — new schema tests.  
- **`npm run build`** / **`npm run smoke`** — regressions.

### Previous story intelligence

Epic 11 is new; **prior epic** patterns to mirror:

- [**10-1**](10-1-customer-identity-passwordless-auth.md) — migration + RLS + Zod boundary + explicit **scope exclusions** for later stories.  
- [**2-5**](2-5-supabase-tables-catalog-inventory.md) — **`anon`** catalog **`SELECT`** rules must remain intact when adding tables/policies.

### Git intelligence summary

Recent commits focus on **checkout/payment** handlers — low overlap; keep this change **migration + domain + tests** only.

### Latest technical information

- Supabase JS **v2** line is pinned (**^2.104.1**); DDL/RLS follow [Supabase RLS docs](https://supabase.com/docs/guides/auth/row-level-security).  
- Prefer **`SECURITY INVOKER`** for **`admin_save_product_bundle`** (existing pattern).

### Project context reference

No **`project-context.md`** matched **`file:{project-root}/**/project-context.md`** in this workspace; rely on this story + linked migrations.

## References

- [Epic 11 — full epic + Story 11-1 AC](../planning-artifacts/epics.md)
- [`20260426180000_catalog_inventory.sql`](../../supabase/migrations/20260426180000_catalog_inventory.sql) — core catalog DDL
- [`20260426220000_admin_rls_and_save_rpc.sql`](../../supabase/migrations/20260426220000_admin_rls_and_save_rpc.sql) — admin RLS predicate origin
- [`20260430202100_admin_bundle_coming_soon_requires_variant.sql`](../../supabase/migrations/20260430202100_admin_bundle_coming_soon_requires_variant.sql) — latest **`admin_save_product_bundle`**
- [`src/domain/commerce/product.ts`](../../src/domain/commerce/product.ts)
- [`architecture.md`](../planning-artifacts/architecture.md)

## Dev Agent Record

### Agent Model Used

Cursor agent (Composer).

### Debug Log References

_(none)_

### Completion Notes List

- Chose **normalized** template model (`variant_templates`, `variant_template_axes`, `variant_template_axis_options`) with `variant_template_status` enum; documented in migration header comments.
- Extended `admin_save_product_bundle` (single migration, copy-forward from `20260430202100_admin_bundle_coming_soon_requires_variant.sql`) to parse `product.variant_template_id`: empty/null → SQL NULL; invalid uuid → `22023`.
- Domain: `variantTemplate.ts` + optional `variant_template_id` on `productSchema`; admin bundle + `AdminProductForm` round-trip the FK; `supabase-map` passes column through when present.
- Vitest: `variantTemplate.test.ts` for template + product `variant_template_id` fixtures.

### File List

- `supabase/migrations/20260504180000_variant_templates_normalized_rls_admin_bundle.sql`
- `src/domain/commerce/variantTemplate.ts`
- `src/domain/commerce/variantTemplate.test.ts`
- `src/domain/commerce/product.ts`
- `src/domain/commerce/index.ts`
- `src/admin/validation.ts`
- `src/admin/AdminProductForm.tsx`
- `src/catalog/supabase-map.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/11-1-variant-template-schema-rls-domain.md`

## Change Log

- 2026-05-04 — Implementation: variant template DDL + admin RLS, `products.variant_template_id`, `admin_save_product_bundle` persistence, Zod schemas/tests, admin/catalog wiring.