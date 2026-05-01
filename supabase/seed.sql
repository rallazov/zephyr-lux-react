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
  'Zephyr Lux Boxer Briefs',
  '2-piece pack: one black + one blue boxer brief per unit.',
  'Each unit is one retail pack containing two boxer briefs—one black, one blue—in breathable bamboo viscose with a tailored fit. Designed for all-day support without bulk—your daily foundation, elevated.',
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
    2400,
    'usd',
    50,
    NULL,
    'active'
  ),
  (
    'b0000002-0000-4000-8000-000000000002',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-2PK-M',
    'M',
    NULL,
    2400,
    'usd',
    50,
    NULL,
    'active'
  ),
  (
    'b0000003-0000-4000-8000-000000000003',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-2PK-L',
    'L',
    NULL,
    2400,
    'usd',
    3,
    5,
    'active'
  ),
  (
    'b0000004-0000-4000-8000-000000000004',
    'a0000001-0000-4000-8000-000000000001',
    'ZLX-2PK-XL',
    'XL',
    NULL,
    2400,
    'usd',
    50,
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
    14,
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
    18,
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
    20,
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
    24,
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
    16,
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
    22,
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
  '/assets/img/Lifestyle.jpeg',
  0,
  true
),
(
  'a0000003-0000-4000-8000-000000000003',
  NULL,
  '/assets/img/Listing.jpeg',
  0,
  true
),
(
  'a0000004-0000-4000-8000-000000000004',
  NULL,
  '/assets/img/kids_placeholder.jpeg',
  0,
  true
),
(
  'a0000005-0000-4000-8000-000000000005',
  NULL,
  '/assets/img/sale_placeholder.jpeg',
  0,
  true
);
