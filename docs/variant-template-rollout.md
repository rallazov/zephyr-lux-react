# Variant template rollout (legacy coexistence)

This document describes how to attach [variant templates](../_bmad-output/implementation-artifacts/11-1-variant-template-schema-rls-domain.md) to existing products while keeping **legacy size/color** rows, **SKU** identity for cart/checkout/orders, and **Epic 9** fixed-assortment packs (e.g. `boxer-briefs`) safe.

## Principles

1. **SKU and `product_variants` are authoritative** for price, inventory, images tied to commerce, subscription plan links, and order history. Templates only drive **selector metadata** and optional **display snapshots** at add-to-cart.
2. **`variant_template_id = null`** means legacy selectors and validation paths. Clearing a template in admin **must not** delete variants, SKUs, stock, or images.
3. **Storefront reads** use mapper sanitization (`sanitizeSupabaseProductBundle` in `src/catalog/supabase-map.ts`): malformed template FKs or partial option-value rows **degrade to legacy** for that product so list/search/PDP do not crash and other products keep loading.

## Preconditions

- Template is **active** and axes/options match how you merchandise the product family.
- Every **active/browsable** variant has exactly **one** `product_variant_option_values` row per template axis (complete combination).
- **Epic 9 packs** (`boxer-briefs`): prefer a **size-only** template that matches packs as single retail SKUs; do **not** introduce black/blue “pick one” axes unless merchandising explicitly changes.

## Recommended dry-run checklist (SQL)

Run in Supabase SQL editor or `psql` against a staging project first.

```sql
-- Products already pointing at a template
select id, slug, status, variant_template_id
from public.products
where variant_template_id is not null;

-- Variants missing option-value rows while product has template
select p.slug, pv.sku,
       (select count(*) from public.product_variant_option_values pov
        where pov.variant_id = pv.id) as option_value_rows,
       (select count(*) from public.variant_template_axes vta
        where vta.variant_template_id = p.variant_template_id) as axis_count
from public.products p
join public.product_variants pv on pv.product_id = p.id
where p.variant_template_id is not null
  and p.status in ('active', 'coming_soon');

-- Duplicate complete template selection (two+ variants on same product share the same ordered option_id tuple).
-- Prerequisite: each variant should already satisfy option_value_rows = axis_count from the query above; otherwise investigate rows before trusting collisions.
with variant_sigs as (
  select
    p.id as product_id,
    p.slug,
    pv.id as variant_id,
    pv.sku,
    (
      select array_agg(pov.option_id order by vta.sort_order asc, vta.id asc)
      from public.product_variant_option_values pov
      join public.variant_template_axes vta
        on vta.id = pov.axis_id
       and vta.variant_template_id = p.variant_template_id
      where pov.variant_id = pv.id
    ) as option_sig
  from public.products p
  join public.product_variants pv on pv.product_id = p.id
  where p.variant_template_id is not null
)
select
  product_id,
  slug,
  option_sig,
  count(*) as variant_count,
  array_agg(sku order by sku) as skus
from variant_sigs
where option_sig is not null
group by product_id, slug, option_sig
having count(*) > 1
order by slug;

```
For **ambiguous** mappings (same legacy `(size_text, color_text)` spanning multiple axes, or conflicting template keys), **skip** automated assignment and fix data manually.

## Mapping legacy size/color to axes

| Case | Action |
|------|--------|
| Single axis (e.g. size) with stable string keys | Map `variant.size` labels to axis `option_key` / option rows via a deterministic lookup table per template. |
| Color truly unused (`null`, single SKU, Epic 9 pack semantics) | **Do not** create a synthetic color axis. |
| Both size and color with unique pairs per SKU | Attach a two-axis template only when every SKU maps 1:1 to axis options. |

If a SKU lacks an unambiguous option for an axis: **omit** backfill for that row, report it, resolve in admin before going live.

## Attach template (conceptual migration)

Prefer **transactions** where supported; always **dry-run** counts first.

1. Create or pick an **active** template (`variant_templates`).
2. `update products set variant_template_id = $tpl where ...` — **only** for rows you verified in the checklist.
3. Upsert **`product_variant_option_values`** rows so each `(variant_id, axis_id)` is unique and `option_id` belongs to `variant_template_axis_options` for that `axis_id`.
4. Smoke-test PDP (template controls), cart add, `/api/cart-quote`, and a test payment path for one SKU.

## Rollback / clear template

```sql
-- Clear assignment (preserves variants and legacy size/color text)
update public.products
set variant_template_id = null
where slug = :slug;
delete from public.product_variant_option_values
where variant_id in (
  select id from public.product_variants where product_id = (
    select id from public.products where slug = :slug
  )
);
```

Admin UX should also clear `variant_template_id` via the existing product-save bundle; deleting option-value rows separately is optional if FKs cascade by design—in production, confirm migration behavior before relying on cascading deletes.

## Production verification

- PDP: templated vs legacy products both render; malformed template data falls back without breaking PLP/search.
- Cart/checkout: totals match **SKU** quotes from catalog; snapshots are cosmetic on receipts (`variant_display_snapshot` / `variant_options_snapshot`).
- Orders: completed orders show persisted titles/snapshots, not recomputed labels from mutable templates.

## Deferred / manual

- Bulk attach for every legacy product without business review remains **manual** unless a scripted mapping is audited per category.
