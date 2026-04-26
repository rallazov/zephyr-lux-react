# Story 1.2: Define shared commerce domain types

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer building catalog, cart, checkout, and API boundaries,
I want a single **canonical** TypeScript + Zod definition for Product, Variant, CartItem, Order, Address, and payment-related enums,
so that the SPA, Vercel API routes, and future Supabase shapes stay aligned (NFR-MAINT-002) and every server boundary can validate with the same runtime schemas (architecture: shared domain types + Zod).

## Acceptance Criteria

1. **Given** the PRD data model and commerce FRs, **when** a developer imports the shared module, **then** they have **exported TypeScript types** for the following (each backed by Zod per AC 2):
   - **Product**
   - **ProductVariant** (or **Variant** — pick one public name and document the alias if both strings appear in code)
   - **CartItem**
   - **Order**
   - **OrderItem** (or an embedded snapshot type if `Order` holds line items)
   - **Address** (structured shipping/contact fields per FR-CHK-002)
   - **PaymentStatus** and **FulfillmentStatus** (closed string unions; partition per epics §12 — see Task 2)
   - **Payment** surface so the label is not dead: **Stripe/billing reference fields** on an order and/or **PaymentReference**; plus a **lean `PaymentEvent`-shaped** type for future `payment_events` rows (ingest `status` ≠ order `payment_status` — see Task 2)
   - Alignment references: [PRD §9.6 / FR-ORD-001–004](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#96-orders), [epics.md — Data Model §12](_bmad-output/planning-artifacts/epics.md)
2. **Given** [architecture.md](_bmad-output/planning-artifacts/architecture.md) “Canonical commerce domain types with zod runtime validation,” **when** the module is implemented, **then** each of the above concepts has a **Zod schema** (or a composed schema graph) and **TypeScript types are derived** via `z.infer<typeof schema>` (or equivalent) so there is **one** definition for runtime + compile time.
3. **Given** [package.json](package.json) already depends on `zod@^4.1.11` and [src/lib/validation.ts](src/lib/validation.ts) already uses Zod for the checkout form, **when** this story is complete, **then** **no new validation library** is introduced; **optional:** refactor `checkoutSchema` to **reuse** structured `Address` / customer fields from the new schemas **if** the shapes align without blowing scope—otherwise **document** the overlap and leave a one-line follow-up for E1-S3/cart. **Expectation:** checkout currently uses a **single string** `address`; matching structured `Address` usually implies a **checkout UI / form** follow-up—default is document + follow-up, not a silent form rewrite in this story.
4. **Given** two catalog shapes exist today (`data/products.json` + [api/_lib/catalog.ts](api/_lib/catalog.ts) vs [public/products.json](public/products.json) + storefront components), **when** defining Product/Variant, **then** the **canonical types target PRD/Supabase field naming** (cents vs dollars, `title` vs `name`, variant options, SKU, inventory) and **Dev Notes** document the **known gap** between static JSON files and the canonical model so [E1-S3](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability) can map without re-deriving types.
5. **Given** NFR-MAINT-001 and the repo [tsconfig.json](tsconfig.json) (`baseUrl`: `./src`, `strict`, `noEmit`), **when** the work is finished, **then** `npm run build` (and thus `tsc -p tsconfig.json`) still succeeds; new files are included in compilation; **no** dependency on `any` to paper over the schemas unless strictly necessary and called out.
6. **Given** this story is **type foundation** not a full cart migration, **when** reviewing scope, **then** **CartItem** is modeled with **variant/SKU identity** (FR-CART-001) even if the current [CartContext](src/context/CartContext.tsx) still uses product-id–shaped items — do **not** block on rewriting all cart call sites; **do** make the **exported CartItem** the contract Epic 3 will adopt.

## Tasks / Subtasks

- [x] **Task 1 — Place module and naming (AC: 1, 2, 5)**
  - [x] Add **`src/domain/commerce/`** with a barrel `index.ts` re-export (preferred). [architecture.md](_bmad-output/planning-artifacts/architecture.md) also suggests `src/shared/types/` as a possible location—that path is fine for **non-commerce** shared TS; keeping **commerce Zod + inferred types** under `domain/commerce` avoids mixing domain schemas with miscellaneous UI helpers. If the team standardizes on `src/shared/commerce/` instead, use **one** barrel only and note the choice in Dev Agent Record.
  - [x] Use **`baseUrl` `./src`** so imports are stable (e.g. `from "domain/commerce"`).
  - [x] Split by file if needed: `product.ts`, `cart.ts`, `order.ts`, `address.ts`, `enums.ts` — avoid one 800-line file unless unavoidable.
- [x] **Task 2 — Zod schemas + inferred types (AC: 1, 2, 6)**
  - [x] **Enums — `PaymentStatus` / `FulfillmentStatus`:** PRD FR-ORD-004 lists many lifecycle strings in one place; **epics §12 `orders`** defines **separate** `payment_status` and `fulfillment_status`. **Partition** literals into two closed unions—do **not** merge into one enum. Example mapping (adjust to final PRD wording): **fulfillment** → `processing`, `packed`, `shipped`, `delivered`, and treat `canceled` per product rules; **payment** → `pending_payment`, `paid`, `refunded`, `partially_refunded`, `payment_failed`, etc.
  - [x] **`payment_events` vs order payment state:** Epics `payment_events.status` is **`received` / `processed` / `failed` / `ignored`** (ingest pipeline). That is **not** order **`PaymentStatus`**. If you add a row-shaped type for `payment_events`, name fields so ingest status cannot be confused with order-level payment lifecycle (e.g. `ingestStatus` or a dedicated enum).
  - [x] **Order-level payment + Stripe:** Export **Stripe/reference IDs** on `Order` (or **`PaymentReference`**) as required by AC 1. Include a **lean `PaymentEvent`-shaped** type (mirror of `payment_events` columns) for future webhooks—**no** persistence in this story.
  - [x] **Money:** prefer **integer `*_cents`** in canonical types to match server/Stripe/Supabase; if legacy dollars appear in static JSON, use schema `.transform` or document conversion at adapter boundary — do not silently mix dollars/cents in one field.
  - [x] **Currency:** canonical `currency` as **ISO 4217** (e.g. `z.string().length(3).transform((c) => c.toUpperCase())` or `z.enum` for single-currency MVP) so values stay aligned with Stripe.
  - [x] **Product / Variant:** fields sufficient for catalog + later Supabase: stable `slug`, `sku` uniqueness, size/color (or options object), `price_cents`, `currency`, `inventory_quantity`, and status enums aligned with epics §12 where possible: **`products.status`** — `draft` | `active` | `archived`; **`product_variants.status`** — `active` | `inactive` | `discontinued` (plus FR-CAT-003 needs).
  - [x] **CartItem:** `variantId` or `sku` (choose one primary key for line identity; SKU is acceptable per FR-CAT-003 and existing API patterns), `quantity`, optional display snapshot fields.
  - [x] **Address:** line1, line2, city, state, postal, country; aligns with FR-CHK-002 and future `shipping_address_json`.
  - [x] **Order + OrderItem:** support order number format `ZLX-YYYYMMDD-####` (FR-ORD-002), totals in cents, payment + fulfillment status, line snapshots (FR-ORD-001/005). Optional Zod guard on `order_number` lexical shape, e.g. `^ZLX-\d{8}-\d{4}$` (uniqueness / generation remains out of scope).
- [x] **Task 3 — Wire compatibility and documentation (AC: 3, 4)**
  - [x] Add a short **“Legacy vs canonical”** subsection in Dev Notes: `api/_lib/catalog.ts` local `Product`/`Variant` vs new module; `public/products.json` flat shape vs `data/products.json`.
  - [x] **Optional (low risk):** change [api/_lib/catalog.ts](api/_lib/catalog.ts) to `import type` from the new module **if** types align; if not aligned yet, keep local types with a `// TODO (E1-S3): align with shared catalog types` comment pointing to the new module.
- [x] **Task 4 — Verify (AC: 5)**
  - [x] Run `npm run build`; fix any new strict-mode issues from exports.
  - [x] If `npm run lint` reports only pre-existing issues, note in Dev Agent Record; do not volunteer a repo-wide eslint cleanup.

## Dev Notes

### Dev Agent Guardrails

- **No marketplace / multi-tenant** abstractions. Single seller.
- **Do not** implement Supabase client, migrations, or catalog adapter in this story (E1-S3).
- **Do not** change Stripe or webhook behavior beyond types that future stories will use.
- **Zod** is the only runtime schema library; patterns already in [src/lib/validation.ts](src/lib/validation.ts).

### Technical requirements

- **NFR-MAINT-002:** Commerce domain types centralized in one import path.
- **FR-CAT-003 / FR-CART-001:** Variants and cart lines are **SKU- or variant-ID–keyed** in the **canonical** model even where the UI is still product-id based.
- **FR-CHK-002:** Address and checkout field shapes should be plannable from the shared `Address` schema.

### Architecture compliance

- [architecture.md — Shared commerce domain types + zod](_bmad-output/planning-artifacts/architecture.md): types consumed by **SPA, API,** and reconciled to Supabase later; **server boundaries validate with zod** (this story provides the schemas; call sites migrate over time).
- **Folder vs doc:** Architecture mentions `src/shared/types/` as a likely home; this story **prefers `src/domain/commerce/`** for commerce schemas (see Task 1) so planning and repo structure stay obvious.
- [architecture.md — Epic 0 stabilization sequence / implied strangler](_bmad-output/planning-artifacts/architecture.md): canonical type surface is **step 2** in the listed sequence; E1-S1 (canonical entry) is done — this story is the types slice before the catalog adapter hardens data flow.
- [PRD §14 — E1-S2](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability): exact story title list from the PRD.

### Library / framework requirements

- **Zod** `^4.1.11` (see [package.json](package.json)) — use the same import style as [src/lib/validation.ts](src/lib/validation.ts).
- **TypeScript** `^5.7.2` with `strict` — prefer `satisfies` or inferred types; avoid duplicate manual `interface` that drifts from Zod.

### File structure requirements

| Area | Action |
|------|--------|
| `src/domain/commerce/**` (preferred) or `src/shared/commerce/**` | **NEW** — schemas + re-exports |
| `src/lib/validation.ts` | **UPDATE (optional)** — only to dedupe checkout/address with shared schemas |
| `api/_lib/catalog.ts` | **UPDATE (optional)** — `import type` or TODO as above |
| `src/components/*`, `src/context/*` | **OUT OF SCOPE** for full migration unless a trivial `import type` swap is zero-risk |

### Testing requirements

- **Build as gate:** `npm run build` must pass.
- **No new test framework** is required for this story if none exists; **if** a lightweight test runner already exists, prefer adding 1–2 **schema** tests (e.g. valid/invalid Address) — otherwise **skip** and record in Dev Agent Record.

### Previous story intelligence (1-1)

- **Canonical TypeScript** entry and `App`/`Layout` are **`.tsx`** with explicit extensions; [tsconfig.json](tsconfig.json) uses `noEmit: true`, `allowImportingTsExtensions: true`, `moduleResolution: "bundler"`.
- **Vite** resolves **`.js` before `.tsx`** for extensionless imports — 1-1 removed entry shell shadows; other dual `.js`/` .tsx` pairs may still exist under `src` — do not reintroduce ambiguous imports when touching files.
- **Pre-existing `npm run lint`** may fail in `api/`, cart, checkout; do not treat as this story’s defect unless new files are added and fail lint.

### Git intelligence (recent commits)

- Recent work refactored **JS → TS** and **build/tsconfig**; this story should **fit** the same strict TypeScript direction without fighting the established `tsc` + Vite build.

### Latest technical information

- **Zod 4.x** is already locked in the repo; follow existing [src/lib/validation.ts](src/lib/validation.ts) patterns. For API details, prefer [Zod documentation](https://zod.dev) for v4 (discriminated unions, `.strict()`, coercion rules) as needed.
- **Money:** Industry default for payments is **integer minor units (cents)**; Stripe amounts are in smallest currency unit.
- **Currency codes:** Stripe and Supabase totals expect a **currency** consistent with **ISO 4217** (e.g. `USD`).

### Project context reference

- No `project-context.md` in repo (per 1-1). Use this file + PRD + [architecture.md](_bmad-output/planning-artifacts/architecture.md) + [epics.md](_bmad-output/planning-artifacts/epics.md).

### References

- [PRD §14 Epic 1 — E1-S2](_bmad-output/planning-artifacts/zephyr-lux-commerce-prd.md#epic-1-brownfield-stabilization-and-deployability)
- [epics.md — Data model §12, cross-cutting, agent guardrails](_bmad-output/planning-artifacts/epics.md)
- [architecture.md](_bmad-output/planning-artifacts/architecture.md) — Brownfield sequence, zod, type location
- [implementation-readiness NFR-MAINT-002](_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-25.md) (if cited for “centralized types”)

## Story completion status

- **Status:** `review`
- **Note:** Ultimate context engine analysis completed — comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

Composer (Cursor AI coding agent).

### Debug Log References

- `resolve_customization.py` requires Python 3.11+; workflow block resolved from skill `customize.toml` manually.

### Completion Notes List

- Implemented **`src/domain/commerce/`** with Zod schemas and `z.infer` types: `Product`, `ProductVariant` (exported alias `Variant`), `CartItem` (SKU-keyed), `Order` + `OrderItem` + `line_items`, `Address`, `PaymentStatus` / `FulfillmentStatus`, `PaymentReference`, `PaymentEvent` (`paymentEventSchema` with **`ingest_status`** distinct from order payment), plus product/variant status enums and ISO 4217 currency helper.
- **Module choice:** `domain/commerce` barrel only; import via `from "domain/commerce"` (`baseUrl` `./src`).
- **Legacy vs canonical (AC 4):** `api/_lib/catalog.ts` still uses local types: **dollar** `price`, numeric `id`, `options: { size, color }`, no draft/active/archived. Canonical model uses **`price_cents`**, optional UUID `id`/`product_id`, separate `size`/`color` fields, **status enums**. Storefront **`public/products.json`** may differ from authoritative **`data/products.json`** (API); E1-S3 adapter should map both toward `Product` / `ProductVariant`.
- **Checkout (AC 3):** Left `checkoutSchema` as a single `address` string; added comments in `src/lib/validation.ts` pointing to `addressSchema` for a future checkout/form migration (no silent UI rewrite).
- **Catalog (Task 3):** Added `// TODO (E1-S3)` in `api/_lib/catalog.ts` toward `domain/commerce` (types do not align yet).
- **Tests:** No test runner in `package.json`; **gate:** `npm run build` passes. **`npm run lint`** still fails with **pre-existing** issues only (none in new `domain/commerce` files).

### File List

- `src/domain/commerce/address.ts`
- `src/domain/commerce/cart.ts`
- `src/domain/commerce/enums.ts`
- `src/domain/commerce/index.ts`
- `src/domain/commerce/order.ts`
- `src/domain/commerce/product.ts`
- `api/_lib/catalog.ts`
- `src/lib/validation.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-2-define-shared-commerce-domain-types.md`

### Review Findings

---

**Checklist (create-story self-validation):** ACs trace to PRD E1-S2, NFR-MAINT-002, and architecture; scope boundaries (no Supabase, no full cart rewrite) explicit; `api/_lib/catalog.ts` and dual JSON sources called out; zod-only; `npm run build` gate; previous story 1-1 config warnings preserved; payment vs fulfillment enum partition, `payment_events` ingest status vs order `PaymentStatus`, ISO 4217 currency, product/variant status enums, and `src/domain/commerce` folder rationale documented.

#### Code review (2026-04-26) — BMAD layers

_Blind Hunter, Edge Case Hunter, and Acceptance Auditor were run in-session on the working-tree diff (tracked + new `src/domain/commerce` files); parallel subagents were not invoked._

- [x] [Review][Decision] **Draft products vs `variants.min(1)`** — Resolved 2026-04-26: **option 2** — `draft` may have zero variants; `active` / `archived` require ≥1 via `superRefine` on [`src/domain/commerce/product.ts`](src/domain/commerce/product.ts).

- [x] [Review][Patch] **Duplicate Stripe keys on `Order`** — Fixed 2026-04-26: `orderSchema` spreads `paymentReferenceSchema.shape` so Stripe fields have a single definition. [`src/domain/commerce/order.ts`](src/domain/commerce/order.ts)

- [x] [Review][Patch] **`iso4217CurrencySchema` is length-only** — Fixed 2026-04-26: documented that only length + case are validated, not the official ISO 4217 code list. [`src/domain/commerce/enums.ts`](src/domain/commerce/enums.ts)

- [x] [Review][Defer] **Cross-field money consistency** [`src/domain/commerce/order.ts`](src/domain/commerce/order.ts) — deferred, pre-existing — No `superRefine` tying `orderItem.total_cents` to `unit_price_cents * quantity` or header `total_cents` to line items + tax/shipping/discount; acceptable until order write paths land.

- [x] [Review][Defer] **Timestamp fields are unvalidated strings** [`src/domain/commerce/order.ts`](src/domain/commerce/order.ts) — deferred, pre-existing — `created_at` / `updated_at` / `PaymentEvent.created_at` accept arbitrary strings; defer until the repo picks `z.iso.datetime()` / DB defaults / ISO-8601 convention.

- [x] [Review][Defer] **Sprint status YAML expanded in same change set** [`_bmad-output/implementation-artifacts/sprint-status.yaml`](_bmad-output/implementation-artifacts/sprint-status.yaml) — deferred, pre-existing — Large sprint-board expansion bundled with domain types; consider separate commits next time for reviewability (process only).

## Change Log

- 2026-04-26 — Story created (bmad-create-story). Target: E1-S2 from PRD §14; first backlog item in [sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml).
- 2026-04-26 — Story context pass: AC1 scannable exports; AC3 checkout/address expectation; Task 1 `src/domain/commerce` + architecture note; Task 2 enum partition, `payment_events` vs order payment, `PaymentEvent` lean type, ISO currency, product/variant statuses, optional order-number regex; architecture + file table + tech note aligned.
- 2026-04-26 — Implemented shared commerce domain module (`src/domain/commerce`), catalog TODO + checkout documentation comments; build verified; story marked **review** in sprint-status.
- 2026-04-26 — Code review: draft vs variants `superRefine`, Stripe fields deduped via `paymentReferenceSchema.shape`, ISO currency schema documented; story **done**, sprint-status synced.
