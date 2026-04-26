# Story 2.6: Admin create/edit product and variants

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the **store owner**,
I want **to create and edit products and their variants in a protected admin area**,
so that **I can grow catalog variety without code or JSON edits**, satisfying **PRD §14 — Epic 2 / E2-S6**, **FR-CAT-005**, **FR-ADM-006**, **UX-DR2** (admin routes behind authentication), and **FR-ADM-001** / **NFR-SEC-003** (admin is not public and mutations are authorized).

## Acceptance Criteria

1. **Given** [PRD — FR-CAT-005](../planning-artifacts/zephyr-lux-commerce-prd.md) and [FR-ADM-006](../planning-artifacts/zephyr-lux-commerce-prd.md), **when** an **unauthenticated** user visits **`/admin`**, **`/admin/products`**, or **`/admin/products/:id`**, **then** they are **redirected to a sign-in experience** (or blocked with no data leakage) — **no** catalog write APIs are usable without verification.

2. **Given** **Supabase Auth** session for an **authorized** owner account, **when** the owner opens **`/admin/products`**, **then** they see a **list** of products (at minimum: title, slug, status, variant count or primary price hint) loaded from the **same Supabase catalog** established in **[2-5](2-5-supabase-tables-catalog-inventory.md)**. Empty state is explicit (not a blank screen).

3. **Given** an authorized session, **when** the owner **creates** a product, **then** they can set **title**, **slug**, **description**, **category**, **fabric** (maps to `fabric_type` or PRD-aligned column), **care** (`care_instructions`), **brand**, **subtitle**, **origin** where the schema supports them, and **product status** (`draft` / `active` / `archived` per [productStatusSchema](../../src/domain/commerce/enums.ts)). **Required fields** are validated **client-side and server-side** (Zod or equivalent on the write boundary). **Slug conflicts** return a **clear, actionable** error (DB unique violation on `products.slug` must be surfaced).

4. **Given** an authorized session, **when** the owner **adds or edits variants**, **then** each variant supports **SKU** (globally unique), **size**, **color**, **price** (persist as **integer cents** + **currency**), **inventory quantity**, **variant status** (`active` / `inactive` / `discontinued` per [productVariantStatusSchema](../../src/domain/commerce/enums.ts)), and **image URL or path** consistent with how **[2-5](2-5-supabase-tables-catalog-inventory.md)** populates [ProductVariant.image_url](../../src/domain/commerce/product.ts). **Out-of-stock** is reflected by **inventory_quantity** (and/or inactive status) so the storefront rules from **[2-4](2-4-variant-selector-size-color-price-stock.md)** remain coherent — **do not** invent a parallel “OOS enum” unless the DB already has one.

5. **Given** [PRD — FR-CAT-005](../planning-artifacts/zephyr-lux-commerce-prd.md) (images) and scope discipline vs **FR-CAT-006**, **when** the owner manages images, **then** they can maintain **`product_images`** rows (**storage path** / URL, **alt**, **sort order**, **is primary**, optional **variant_id**) — **acceptable MVP:** text/URL/path fields **without** binary Storage upload in this story; **if** upload is implemented, use **Supabase Storage** + server-safe keys only (never service role in the browser).

6. **Given** [2-5 — RLS](2-5-supabase-tables-catalog-inventory.md), **when** this story is complete, **then** **`anon`** still **cannot** insert/update/delete catalog tables. **`authenticated`** users may **INSERT/UPDATE/DELETE** `products`, `product_variants`, and `product_images` **only** when **`coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'`** (canonical model: set `app_metadata` to include `"role":"admin"` for each owner account—Supabase Dashboard → **Authentication** → user → **raw app metadata**, or controlled SQL against `auth.users`; document exact bootstrap steps in Dev Notes). RLS policy names should state intent (e.g. `catalog_write_requires_admin`). **Do not** use a **browser-only** email allowlist as the **sole** production gate; optional **`ALLOWED_ADMIN_EMAILS`** (**server-only**, read in `api/admin/*`) may **supplement** local/dev—document if present. Storefront **`anon`** read policies from **2-5** must **still** hide **draft** / **archived** products.

7. **Given** **NFR-MAINT-001** and **[productSchema](../../src/domain/commerce/product.ts)**, **when** admin saves data, **then** persisted shapes **align** with existing Zod/domain enums — **no second Product model**; reuse or extend shared schemas for DTO validation where practical.

8. **Given** a **save** that creates or updates a **product** together with **variants** and **`product_images`** in one user action, **when** validation fails or the database errors mid-save, **then** the catalog must **not** be left in a **silent partial** state: implement **all-or-nothing** persistence (**single Postgres transaction** via **RPC**, **`api/admin/*`** + service role with rollback, or equivalent—**pick one** and document). The owner sees **one** clear, actionable error. **Orphan** variant/image rows after a failed **create** must **not** remain without cleanup or an explicit recovery path.

9. **Given** [1-5-smoke-test-or-script-clean-build-routes](1-5-smoke-test-or-script-clean-build-routes.md), **when** the story ships, **then** `npm run build` and **`npm run smoke`** pass. Add **tests** that do **not** require live Supabase (mock client, pure validators, or route guards). **Vitest** must keep forcing **static** catalog for storefront tests per [readCatalogEnv](../../src/catalog/adapter.ts).

## Tasks / Subtasks

- [x] **Task 1 — Auth + route shell (AC: 1, 9)**  
  - [x] Add admin routes under [`App.tsx`](../../src/components/App/App.tsx) (or extracted router module): `/admin/login`, `/admin/products`, `/admin/products/new`, `/admin/products/:id` (align with [UX-DR2](../planning-artifacts/epics.md)).  
  - [x] Integrate **Supabase Auth** (sign-in / session / sign-out). **Coordinate with Epic 5 E5-S1:** prefer a **single** auth module/layout both epics will reuse; this story may deliver the **first** usable sign-in if E5-S1 is not done yet.

- [x] **Task 2 — RLS / authorization model (AC: 1, 6)**  
  - [x] Add migration(s) under `supabase/migrations/` extending 2-5: policies for **`authenticated`** INSERT/UPDATE/DELETE on `products`, `product_variants`, `product_images` (and **`inventory_movements` only if** this story writes adjustments — default **no** movement writes unless you implement manual adjustment).  
  - [x] Encode **AC6**: writes allowed only when **`app_metadata.role = 'admin'`**; document owner bootstrap (Dashboard / SQL) in Dev Notes and [`../../.env.example`](../../.env.example) **comments** (no secrets).

- [x] **Task 3 — Admin UI: list + form (AC: 2–5, 7)**  
  - [x] Product list + create/edit form with accessible labels (**NFR-A11Y-002**, **UX-DR13**).  
  - [x] Variant editor (add/remove rows or sub-form) with SKU/price/inventory validation.  
  - [x] Image rows editor (paths/URLs) per AC5.  
  - [x] Wire saves to satisfy **AC8** (surface one error; no silent partial state—or delegate to Task 4 transaction/RPC).

- [x] **Task 4 — Server API / RPC for writes (AC: 3–6, 8)**  
  - [x] Prefer **`api/admin/*`** or **`supabase.rpc`** for **transactional** product+variant+image saves (**AC8**). Verify **Supabase JWT** server-side; **`SUPABASE_SERVICE_ROLE_KEY`** only on the server — **never** in client bundles (**NFR-SEC-002**). If all writes stay client-side, **prove** equivalent atomicity (rare—document).

- [x] **Task 5 — Tests (AC: 9)**  
  - [x] Unit tests for validators/guards; smoke unchanged.

## Dev Notes

### Dev Agent Guardrails

- **Depends on:** **[2-5](2-5-supabase-tables-catalog-inventory.md)** migrations + Supabase catalog existing; **do not** re-derive dollars or parallel types — stay on [`product.ts`](../../src/domain/commerce/product.ts).  
- **Epic sequencing:** Official **E5-S1** is “Supabase admin auth” — this story **must still satisfy FR-ADM-001**. Prefer implementing **shared** auth plumbing so E5 does not redo it.  
- **Not in scope:** Full **FR-CAT-006** Storage upload UX, **Epic 3** cart/checkout changes, **Epic 4** `inventory_movements` automation, order admin (**E5-S2+**).  
- **PRD §12** variant status values: schema uses `active` / `inactive` / `discontinued` — stay consistent with [productVariantStatusSchema](../../src/domain/commerce/enums.ts) even if early PRD prose says “out of stock” as a state.

### Technical requirements

- **FR-CAT-005:** create/edit product + variants + validation + slug conflict prevention.  
- **FR-ADM-006:** product/variant fields + active/inactive semantics.  
- **NFR-SEC-002 / NFR-SEC-003:** no service role in browser; admin writes verified via RLS and/or server.  
- **UX-DR2 / UX-DR8:** fast, clear admin; mobile-usable forms (**FR-ADM-007** is P2 but do not build desktop-only traps).

### Admin authorization model (canonical for this story)

- **Production:** Supabase JWT **`app_metadata.role === 'admin'`** gates catalog writes (**AC6**). Bootstrap each owner account once (Dashboard raw JSON or SQL). **E5-S1** should **reuse** this claim—avoid introducing a second admin model later.  
- **Local/dev only:** optional **`ALLOWED_ADMIN_EMAILS`** on the **server** (e.g. Vercel env) for `api/admin/*` smoke tests—**never** the only check in production.

### Architecture compliance

- [architecture.md](../planning-artifacts/architecture.md): Supabase system of record; **RLS as boundary**; boring CRUD is acceptable — keep writes **predictable and typed**.  
- Accessibility: architecture prefers **headless primitives** (Radix / shadcn / Headless UI) — repo may not have them yet; **minimum** is labeled inputs and visible errors (**NFR-A11Y-002**).

### Library / framework requirements

- **`@supabase/supabase-js` v2** — Auth + client writes (or server client with service role in API only). Pin consistent with **[2-5](2-5-supabase-tables-catalog-inventory.md)**.  
- **Zod** — validate admin payloads at boundaries ([package.json](../../package.json)).

### File structure requirements

| Area | Action |
|------|--------|
| [`App.tsx`](../../src/components/App/App.tsx) (or new `src/routes/*`) | **UPDATE** — register `/admin/*` routes **outside** or **inside** `Layout` per UX (admin often skips storefront chrome — **decide** and stay consistent). |
| `src/admin/**/*` or `src/components/Admin/**/*` | **NEW** — pages, forms, auth gate |
| `supabase/migrations/*.sql` | **UPDATE** — RLS policies for admin writes |
| `api/admin/**/*.ts` | **NEW** (optional) — server-side mutations |
| [`.env.example`](../../.env.example) | **UPDATE** — comments only: `app_metadata.role=admin` bootstrap reminder; optional **server-only** `ALLOWED_ADMIN_EMAILS` for dev |

### Testing requirements

- `npm run build` + `npm run smoke`.  
- No CI dependency on real Supabase credentials; mock Supabase or test pure functions.

### Previous story intelligence (2-5)

- Storefront **`anon`** reads are **narrow**; admin writes require **new** policies.  
- **`legacy_storefront_id`** (if present) must remain coherent for pre–Epic 3 cart — editing products should **not** break numeric identity expectations from **[2-4](2-4-variant-selector-size-color-price-stock.md)** without an explicit migration note.  
- **`inventory_movements`:** 2-5 defers `orders` FK; do not assume movement triggers exist.

### Git intelligence (recent commits)

- Catalog adapter + TypeScript migration trajectory: keep admin work **orthogonal** to Stripe/webhook files unless integrating auth cookies/session globally.

### Latest technical information

- **Supabase Auth (JS v2):** use current `createClient` + `auth.getSession()` / `onAuthStateChange` patterns from [Supabase Auth docs](https://supabase.com/docs/guides/auth).  
- **RLS:** use `auth.uid()` / JWT claims in policies; test with SQL policy names that state intent (e.g. `admin_write_products`).

### Project context reference

- No committed `project-context.md` matched the skill glob; rely on PRD §9.1 / §9.8, [epics.md](../planning-artifacts/epics.md), [architecture.md](../planning-artifacts/architecture.md), and stories **2-1 … 2-5**.

### References

- [PRD §14 — Epic 2, E2-S6](../planning-artifacts/zephyr-lux-commerce-prd.md#epic-2-commerce-catalog-and-product-admin-foundation)  
- [PRD — FR-CAT-005, FR-ADM-001, FR-ADM-006](../planning-artifacts/zephyr-lux-commerce-prd.md)  
- [epics.md — UX-DR2, data model §12](../planning-artifacts/epics.md)  
- [2-5-supabase-tables-catalog-inventory.md](2-5-supabase-tables-catalog-inventory.md), [2-4-variant-selector-size-color-price-stock.md](2-4-variant-selector-size-color-price-stock.md)

## Story completion status

- **Status:** `done`  
- **Note:** Code review 2026-04-26: two patch items applied (save `try`/`finally`, JSDoc cleanup).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented Supabase Auth via `AuthProvider` + `getSupabaseBrowserClient()`; admin routes use `AdminLayout` (no storefront chrome) and `RequireAdmin` (JWT `app_metadata.role === 'admin'`).
- RLS migration `20260426220000_admin_rls_and_save_rpc.sql`: `catalog_admin_all_*` policies for `authenticated` + admin JWT; `product_variants.image_url` column; atomic `admin_save_product_bundle` RPC (`SECURITY INVOKER`, single transaction, admin check via `auth.jwt()`).
- Writes use `supabase.rpc('admin_save_product_bundle', { p_payload })` with the user session (no service role in browser). Vercel `api/admin/*` not required for MVP; document in notes.
- Client validation: `src/admin/validation.ts` + `productSchema` merge via `validateMergedProduct`; unit tests in `src/admin/validation.test.ts`, `src/auth/isAdmin.test.ts`; route smoke extended in `src/routes.smoke.test.tsx` (no live Supabase).
- `.env.example` comments for `VITE_SUPABASE_*` and admin `app_metadata.role` bootstrap.

### File List

- `.env.example`
- `src/components/App/App.tsx`
- `src/lib/supabaseBrowser.ts`
- `src/auth/AuthContext.tsx`
- `src/auth/isAdmin.ts`
- `src/auth/isAdmin.test.ts`
- `src/admin/AdminLayout.tsx`
- `src/admin/RequireAdmin.tsx`
- `src/admin/AdminLogin.tsx`
- `src/admin/AdminProductList.tsx`
- `src/admin/AdminProductForm.tsx`
- `src/admin/validation.ts`
- `src/admin/validation.test.ts`
- `src/routes.smoke.test.tsx`
- `supabase/migrations/20260426220000_admin_rls_and_save_rpc.sql`

### Change Log

- 2026-04-26: Story 2-6 — admin routes, Supabase Auth, RLS + RPC save, admin list/form, tests, env example comments.

## Questions (non-blocking; saved for end)

- **Product ID in URL:** PRD shows `/admin/products/:id` — use **UUID** from `products.id` (recommended) vs slug for editor routes.  
- **Inventory adjustments:** Should quantity edits append **`inventory_movements`** with `reason = manual_adjustment` (FR-CAT-007 preview) or stay **plain UPDATE** until a later story?

### Review Findings

- [x] [Review][Patch] Reset `saving` if `supabase.rpc` throws — wrap the save path in `try`/`finally` (or `catch`) in `onSave` so a thrown client/network error cannot leave the submit button disabled indefinitely [`src/admin/AdminProductForm.tsx` save handler, ~`setSaving` around `admin_save_product_bundle` RPC]
- [x] [Review][Patch] Remove duplicated/overlapping JSDoc comments above `validateMergedProduct` in [`src/admin/validation.ts`](../../src/admin/validation.ts) (lines ~62–70)
