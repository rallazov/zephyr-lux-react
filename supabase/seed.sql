-- Optional local seed: mirrors `data/products.json` for `supabase db reset`.
-- `legacy_storefront_id` preserves cart / storefrontProductId parity (stories 2-5, 9-1).

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
  'Zephyr Lux Men''s Boxer Briefs — Short leg',
  'Regular inseam · 2-piece pack: one black + one blue boxer brief per unit.',
  'Short-leg (regular) fit. Each unit is one retail pack containing two boxer briefs—one black, one blue—in breathable bamboo viscose with a tailored fit. Designed for all-day support without bulk—your daily foundation, elevated.',
  'Zephyr Lux',
  'underwear',
  'Bamboo Viscose',
  'Machine wash cold with like colors. Tumble dry low. Do not bleach. Cool iron if needed.',
  'USA',
  'active',
  101
),
(
  'a0000002-0000-4000-8000-000000000002',
  'silk-relaxed-shell',
  'Zephyr Lux Silk Relaxed Shell',
  'Bias-cut shell with a fluid drape for polished layering.',
  'A lightweight silk-forward shell designed for desk-to-dinner layering—easy tuck, soft shoulder line, and clean hem.',
  'Zephyr Lux',
  'women',
  'Stretch Silk Charmeuse',
  'Dry clean recommended. Steam to refresh between wears.',
  'USA',
  'active',
  102
),
(
  'a0000003-0000-4000-8000-000000000003',
  'merino-everyday-crew',
  'Zephyr Lux Merino Everyday Crew',
  'Temperature-regulating crew built for daily rotation.',
  'Ultra-fine merino blend crew that stays breathable indoors yet holds warmth when temps dip—your dependable neutral layer.',
  'Zephyr Lux',
  'men',
  'Merino Blend',
  'Machine wash cold gentle. Lay flat to dry.',
  'USA',
  'active',
  103
),
(
  'a0000004-0000-4000-8000-000000000004',
  'kids-play-shorts',
  'Zephyr Lux Kids Play Shorts',
  'Movement-friendly shorts with a soft brushed waist.',
  'Designed for recess-to-road-trip comfort—breathable jersey with reinforced seams for everyday wear.',
  'Zephyr Lux',
  'kids',
  'Cotton Jersey',
  'Machine wash cold. Tumble dry low.',
  'USA',
  'active',
  104
),
(
  'a0000005-0000-4000-8000-000000000005',
  'seasonal-archive-sale',
  'Seasonal Archive (Coming Soon)',
  'Limited archival picks — launching shortly.',
  'We are preparing a tight rotation of archival silhouettes at approachable pricing. Join the waitlist and we will email you when this capsule unlocks.',
  'Zephyr Lux',
  'sale',
  'Mixed premium blends',
  'Care varies by piece — details ship with each style.',
  'USA',
  'coming_soon',
  105
),
(
  'a0000006-0000-4000-8000-000000000006',
  'boxer-briefs-long-leg',
  'Zephyr Lux Men''s Boxer Briefs — Long leg',
  'Extended inseam · 2-piece pack: one black + one blue boxer brief per unit.',
  'Long-leg fit with the same dual-color retail pack as our short-leg style—one black and one blue boxer brief per unit—in breathable bamboo viscose. Same packaging and color bundle; choose long leg when you want extra coverage.',
  'Zephyr Lux',
  'underwear',
  'Bamboo Viscose',
  'Machine wash cold with like colors. Tumble dry low. Do not bleach. Cool iron if needed.',
  'USA',
  'active',
  106
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
  low_stock_threshold,
  status
)
VALUES
  (
    'b0000001-0000-4000-8000-000000000001',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-2PK-S',
    'S',
    NULL,
    1899,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000002-0000-4000-8000-000000000002',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-2PK-M',
    'M',
    NULL,
    1899,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000003-0000-4000-8000-000000000003',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-2PK-L',
    'L',
    NULL,
    1899,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000004-0000-4000-8000-000000000004',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-2PK-XL',
    'XL',
    NULL,
    1899,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000005-0000-4000-8000-000000000005',
    'a0000002-0000-4000-8000-000000000002',
    'ZLX-WM-SHELL-S',
    'S',
    NULL,
    8900,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000006-0000-4000-8000-000000000006',
    'a0000002-0000-4000-8000-000000000002',
    'ZLX-WM-SHELL-M',
    'M',
    NULL,
    8900,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000007-0000-4000-8000-000000000007',
    'a0000003-0000-4000-8000-000000000003',
    'ZLX-MN-CREW-S',
    'S',
    NULL,
    6200,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000008-0000-4000-8000-000000000008',
    'a0000003-0000-4000-8000-000000000003',
    'ZLX-MN-CREW-M',
    'M',
    NULL,
    6200,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000009-0000-4000-8000-000000000009',
    'a0000004-0000-4000-8000-000000000004',
    'ZLX-KD-SHORTS-XS',
    'XS',
    NULL,
    2800,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000010-0000-4000-8000-000000000010',
    'a0000004-0000-4000-8000-000000000004',
    'ZLX-KD-SHORTS-S',
    'S',
    NULL,
    2800,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000011-0000-4000-8000-000000000011',
    'a0000005-0000-4000-8000-000000000005',
    'ZLX-SALE-ARCHIVE-PLACEHOLDER',
    'OS',
    NULL,
    4500,
    'usd',
    0,
    NULL,
    'inactive'
  ),
  (
    'b0000012-0000-4000-8000-000000000012',
    'a0000006-0000-4000-8000-000000000006',
    'ZLX-2PK-LONG-S',
    'S',
    NULL,
    1699,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000013-0000-4000-8000-000000000013',
    'a0000006-0000-4000-8000-000000000006',
    'ZLX-2PK-LONG-M',
    'M',
    NULL,
    1699,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000014-0000-4000-8000-000000000014',
    'a0000006-0000-4000-8000-000000000006',
    'ZLX-2PK-LONG-L',
    'L',
    NULL,
    1699,
    'usd',
    25,
    NULL,
    'active'
  ),
  (
    'b0000015-0000-4000-8000-000000000015',
    'a0000006-0000-4000-8000-000000000006',
    'ZLX-2PK-LONG-XL',
    'XL',
    NULL,
    1699,
    'usd',
    25,
    NULL,
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
),
(
  'a0000002-0000-4000-8000-000000000002',
  NULL,
  '/assets/img/placeholder-women.svg',
  0,
  true
),
(
  'a0000003-0000-4000-8000-000000000003',
  NULL,
  '/assets/img/placeholder-men-apparel.svg',
  0,
  true
),
(
  'a0000004-0000-4000-8000-000000000004',
  NULL,
  '/assets/img/placeholder-kids.svg',
  0,
  true
),
(
  'a0000005-0000-4000-8000-000000000005',
  NULL,
  '/assets/img/placeholder-sale.svg',
  0,
  true
),
(
  'a0000006-0000-4000-8000-000000000006',
  NULL,
  '/assets/img/Listing2.jpeg',
  0,
  true
);
