-- Story 9-3 (depends on enum value from prior migration).

DROP POLICY IF EXISTS products_storefront_select ON public.products;

CREATE POLICY products_storefront_select ON public.products FOR SELECT TO anon USING (
  status IN ('active'::public.product_status, 'coming_soon'::public.product_status)
);

DROP POLICY IF EXISTS product_variants_storefront_select ON public.product_variants;

CREATE POLICY product_variants_storefront_select ON public.product_variants FOR SELECT TO anon USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE
      p.id = product_variants.product_id
      AND p.status IN (
        'active'::public.product_status,
        'coming_soon'::public.product_status
      )
  )
);

DROP POLICY IF EXISTS product_images_storefront_select ON public.product_images;

CREATE POLICY product_images_storefront_select ON public.product_images FOR SELECT TO anon USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE
      p.id = product_images.product_id
      AND p.status IN (
        'active'::public.product_status,
        'coming_soon'::public.product_status
      )
  )
);

CREATE TABLE public.product_waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT product_waitlist_signups_unique_email_per_product UNIQUE (product_id, email)
);

COMMENT ON TABLE public.product_waitlist_signups IS 'Story 9-3 — waitlist signups; default-deny RLS; server service-role handler only';

ALTER TABLE public.product_waitlist_signups ENABLE ROW LEVEL SECURITY;
