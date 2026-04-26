# Deferred work (from reviews and triage)

## Deferred from: code review of story 2-5-supabase-tables-catalog-inventory.md (2026-04-26)

- **Zod at catalog boundary** (`src/catalog/supabase-map.ts`): Malformed API shapes throw `ZodError`; add friendlier error mapping when storefront error UX is standardized.
- **Empty variant embeds on list** (`src/catalog/adapter.ts`): If `product_variants` is empty for an active product, the list can still show the product; add data checks or UI guards if that becomes observable.
- **Image `alt_text` not selected** (`src/catalog/adapter.ts` `PRODUCTS_CATALOG_SELECT`): Select `alt_text` when PDP or shared image components need a11y text from Supabase.

## Deferred from: code review of story 2-4-variant-selector-size-color-price-stock.md (2026-04-26)

- **Unreachable OOS string on resolved selection** (`src/components/ProductDetail/ProductDetail.tsx`): The `"Out of stock for this color and size."` path under `selectedVariant && inventory_quantity === 0` is effectively dead while `selectedVariant` is only set for purchasable rows. Safe to remove or relabel when the PDP is next touched; not a functional defect with current rules.

## Deferred from: code review of 2-1-canonical-product-variant-seed-data.md (2026-04-26)

- **Pair-maintain `api/_lib/catalog.js` and `api/_lib/catalog.ts`:** The repo keeps parallel JS/TS `catalog` modules for Vercel entry points; DRY to a single build artifact or a codegen note if this becomes a repeated merge hazard.

## Deferred from: code review of 1-1-fix-runtime-imports (2026-04-25)

- Planning artifact `epics.md` (brownfield bullet) still describes the historical `main.tsx` → `App.js` import. Reconcile with current code when the epic list or brownfield section is next edited. Not introduced by the runtime-import fix.

## Deferred from: code review of 1-2-define-shared-commerce-domain-types.md (2026-04-26)

- **Cross-field money consistency** (`src/domain/commerce/order.ts`): No refinement tying line `total_cents` to unit price × quantity or order header totals to lines + fees; acceptable until order persistence and checkout write paths exist.

- **Timestamp fields are unvalidated strings** (`src/domain/commerce/order.ts`): Optional / event timestamps use plain `z.string()`; standardize on `z.iso.datetime()` or equivalent when API and DB contracts are fixed.

- **Sprint status YAML expanded in same change set** (`_bmad-output/implementation-artifacts/sprint-status.yaml`): Full epic/story grid added alongside domain module; split process/docs commits from code in future reviews for clarity.

## Deferred from: code review of 1-3-catalog-adapter-static-and-supabase.md (2026-04-26)

- **Product detail uses first variant for hero/price** (`src/components/ProductDetail/ProductDetail.tsx`): Acceptable for E1; defer richer variant selection and pricing display until Epic 2+ product UX.

- **Line-item `qty` validation in `computeAmountCents` and webhook** (`api/_lib/catalog.ts` / `api/stripe-webhook.ts`): Coercion to at least 1 and metadata trust predate the catalog adapter change; add strict positive-integer `qty` checks when order/checkout hardening is in scope.

## Deferred from: code review of 1-4-document-environment-variables.md (2026-04-26)

- **Legacy `.js` siblings** (`CheckoutPage.js`, `config.js`, `SubscriptionForm.js`): Still present alongside TypeScript sources; documentation now points to `.ts/.tsx` as primary. Remove or keep in sync when the brownfield TS migration is finished.

## Deferred from: code review of 1-5-smoke-test-or-script-clean-build-routes.md (2026-04-26)

- **Route smoke asserts on marketing copy strings** (`src/routes.smoke.test.tsx`): Acceptable for story 1.5 (layout `data-testid` + route-level copy); consider more stable selectors later if marketing churn breaks CI often.

- **README omits local `npm run smoke`** (`README.md`): CI covers AC6; add a short “Smoke / CI parity” blurb when README is next edited for onboarding.
