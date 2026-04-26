-- Story 2-5: catalog + inventory_movements (Epic 2 E2-S5)
-- RLS: storefront anon may read active catalog only; inventory_movements has no anon access.
-- inventory_movements.order_id: UUID NULL, no FK to orders until Epic 4 (E4-S1+).

-- Enum domains (single consistent approach: Postgres ENUM types)
CREATE TYPE public.product_status AS ENUM ('draft', 'active', 'archived');

CREATE TYPE public.product_variant_status AS ENUM ('active', 'inactive', 'discontinued');

CREATE TYPE public.inventory_movement_reason AS ENUM (
  'order_paid',
  'manual_adjustment',
  'return',
  'restock',
  'correction'
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  description text,
  brand text NOT NULL DEFAULT 'Zephyr Lux',
  category text,
  fabric_type text,
  care_instructions text,
  origin text,
  status public.product_status NOT NULL DEFAULT 'draft',
  legacy_storefront_id integer UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  size text,
  color text,
  price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  inventory_quantity integer NOT NULL DEFAULT 0,
  low_stock_threshold integer,
  status public.product_variant_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_variants_product_id_idx ON public.product_variants (product_id);

CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_images_product_id_idx ON public.product_images (product_id);

CREATE INDEX product_images_variant_id_idx ON public.product_images (variant_id);

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE CASCADE,
  order_id uuid,
  delta integer NOT NULL,
  reason public.inventory_movement_reason NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_movements_variant_id_idx ON public.inventory_movements (variant_id);

COMMENT ON COLUMN public.inventory_movements.created_by IS 'Reserved for future Supabase Auth user id on admin/service writes; nullable until admin paths exist (E2-S6 / Epic 4).';

COMMENT ON COLUMN public.inventory_movements.order_id IS 'Epic 4: add FK to orders when that table exists (E4-S1+); kept nullable UUID here per story 2-5.';

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Policy choice (AC2, NFR-SEC-005):
-- - products: anon sees rows with status = active only (draft/archived never leak).
-- - product_variants: anon sees variants whose parent product is active (all variant statuses),
--   so PDP can show inactive/discontinued/OOS per productVariantStatusSchema + 2-4 rules.
-- - product_images: anon sees images for active products only (same storefront surface).
-- - inventory_movements: no SELECT for anon (admin/service later).

CREATE POLICY products_storefront_select ON public.products FOR SELECT TO anon USING (status = 'active');

CREATE POLICY product_variants_storefront_select ON public.product_variants FOR SELECT TO anon USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE
      p.id = product_variants.product_id
      AND p.status = 'active'
  )
);

CREATE POLICY product_images_storefront_select ON public.product_images FOR SELECT TO anon USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE
      p.id = product_images.product_id
      AND p.status = 'active'
  )
);

-- inventory_movements: default deny for anon (no policy)
