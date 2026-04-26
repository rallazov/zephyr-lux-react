-- Optional local seed: mirrors `data/products.json` (boxer-briefs) for `supabase db reset`.
-- `legacy_storefront_id` = 101 preserves cart / storefrontProductId parity (story 2-5 AC5).

INSERT INTO public.products (
  id,
  slug,
  title,
  subtitle,
  description,
  brand,
  category,
  fabric_type,
  care_instructions,
  origin,
  status,
  legacy_storefront_id
)
VALUES (
  'a0000001-0000-4000-8000-000000000001',
  'boxer-briefs',
  'Zephyr Lux Boxer Briefs',
  'Everyday comfort, refined',
  'Breathable bamboo viscose boxer briefs with a tailored fit. Designed for all-day support without bulk—your daily foundation, elevated.',
  'Zephyr Lux',
  'men',
  'Bamboo Viscose',
  'Machine wash cold with like colors. Tumble dry low. Do not bleach. Cool iron if needed.',
  'USA',
  'active',
  101
);

INSERT INTO public.product_variants (
  id,
  product_id,
  sku,
  size,
  color,
  price_cents,
  currency,
  inventory_quantity,
  status
)
VALUES
  (
    'b0000001-0000-4000-8000-000000000001',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-BLK-S',
    'S',
    'black',
    2400,
    'usd',
    50,
    'active'
  ),
  (
    'b0000002-0000-4000-8000-000000000002',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-BLK-M',
    'M',
    'black',
    2400,
    'usd',
    50,
    'active'
  ),
  (
    'b0000003-0000-4000-8000-000000000003',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-BLK-L',
    'L',
    'black',
    2400,
    'usd',
    50,
    'active'
  ),
  (
    'b0000004-0000-4000-8000-000000000004',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-BLK-XL',
    'XL',
    'black',
    2400,
    'usd',
    50,
    'active'
  ),
  (
    'b0000005-0000-4000-8000-000000000005',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-BLU-M',
    'M',
    'blue',
    2400,
    'usd',
    40,
    'active'
  );

INSERT INTO public.product_images (
  product_id,
  variant_id,
  storage_path,
  sort_order,
  is_primary
)
VALUES (
  'a0000001-0000-4000-8000-000000000001',
  NULL,
  '/assets/img/Listing2.jpeg',
  0,
  true
);
