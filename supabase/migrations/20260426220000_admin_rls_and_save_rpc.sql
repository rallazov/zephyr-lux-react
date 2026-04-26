-- Story 2-6: Admin catalog writes (RLS) + single-transaction product save (RPC)
-- - Authenticated + JWT app_metadata.role = 'admin' for catalog DML/DDL reads (drafts).
-- - admin_save_product_bundle: SECURITY INVOKER, one transaction, validates admin in-function.

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS image_url text;

-- ---------------------------------------------------------------------------
-- RLS: admin policies (authenticated, JWT app_metadata.role = 'admin')
-- ---------------------------------------------------------------------------
CREATE POLICY catalog_admin_all_products ON public.products
  FOR ALL
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin')
  WITH CHECK (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');

CREATE POLICY catalog_admin_all_variants ON public.product_variants
  FOR ALL
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin')
  WITH CHECK (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');

CREATE POLICY catalog_admin_all_images ON public.product_images
  FOR ALL
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin')
  WITH CHECK (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');

-- ---------------------------------------------------------------------------
-- Atomic save: product + variants + product_images
-- JSON shape:
--  { "product": { "id"?, "slug", "title", ... status }, "variants": [...], "images": [...] }
-- Every variant and image must include a client-generated "id" (uuid) for stable references.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_save_product_bundle (p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_p jsonb;
  v_id uuid;
  v_slug text;
  v_status public.product_status;
  v_v jsonb;
  v_g jsonb;
  v_var_id uuid;
  v_var_ids uuid[] := array[]::uuid[];
  v_img_id uuid;
  v_img_ids uuid[] := array[]::uuid[];
  v_sku text;
  v_cents int;
  v_vstatus public.product_variant_status;
  v_var_for_img uuid;
  v_cents_null text;
  v_dup_sku text;
BEGIN
  IF coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') != 'admin' THEN
    RAISE EXCEPTION 'Admin role is required' USING ERRCODE = '42501';
  END IF;

  v_p := p_payload->'product';
  IF v_p IS NULL THEN
    RAISE EXCEPTION 'Missing product payload' USING ERRCODE = '22023';
  END IF;

  v_slug := trim(both FROM (v_p->>'slug'));
  IF v_slug = '' OR (v_p->>'title') IS NULL OR trim(both FROM (v_p->>'title')) = '' THEN
    RAISE EXCEPTION 'Product slug and title are required' USING ERRCODE = '22023';
  END IF;

  v_status := coalesce(
    (v_p->>'status')::public.product_status,
    'draft'::public.product_status
  );

  IF
    v_status = 'active'
    AND coalesce(jsonb_array_length(p_payload->'variants'), 0) = 0
  THEN
    RAISE EXCEPTION 'Active products require at least one variant' USING ERRCODE = '22023';
  END IF;

  IF (v_p->>'id') IS NULL OR trim(both FROM (v_p->>'id')) = '' THEN
    INSERT INTO public.products (
      slug, title, subtitle, description, brand, category, fabric_type, care_instructions, origin, status
    )
    VALUES (
      v_slug,
      trim(both FROM (v_p->>'title')),
      nullif (v_p->>'subtitle', ''),
      nullif (v_p->>'description', ''),
      coalesce (nullif (v_p->>'brand', ''), 'Zephyr Lux'),
      nullif (v_p->>'category', ''),
      nullif (v_p->>'fabric_type', ''),
      nullif (v_p->>'care_instructions', ''),
      nullif (v_p->>'origin', ''),
      v_status
    )
    RETURNING id INTO v_id;
  ELSE
    v_id := (v_p->>'id')::uuid;
    UPDATE public.products
    SET
      slug = v_slug,
      title = trim(both FROM (v_p->>'title')),
      subtitle = nullif (v_p->>'subtitle', ''),
      description = nullif (v_p->>'description', ''),
      brand = coalesce (nullif (v_p->>'brand', ''), 'Zephyr Lux'),
      category = nullif (v_p->>'category', ''),
      fabric_type = nullif (v_p->>'fabric_type', ''),
      care_instructions = nullif (v_p->>'care_instructions', ''),
      origin = nullif (v_p->>'origin', ''),
      status = v_status,
      updated_at = now()
    WHERE
      id = v_id;
    IF NOT found THEN
      RAISE EXCEPTION 'Product not found: %', v_id USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_var_ids := array[]::uuid[];
  FOR v_v IN
  SELECT
    value
  FROM
    jsonb_array_elements (coalesce(p_payload->'variants', '[]'::jsonb)) AS t (value)
  LOOP
    v_var_id := (v_v->>'id')::uuid;
    IF v_var_id IS NULL THEN
      RAISE EXCEPTION 'Each variant must include a client-generated id (uuid)' USING ERRCODE = '22023';
    END IF;
    v_var_ids := array_append (v_var_ids, v_var_id);
  END LOOP;

  IF coalesce (array_length (v_var_ids, 1), 0) > 0 THEN
    DELETE FROM public.product_variants
    WHERE
      product_id = v_id
      AND id != ALL (v_var_ids);
  ELSE
    DELETE FROM public.product_variants
    WHERE
      product_id = v_id;
  END IF;

  FOR v_v IN
  SELECT
    value
  FROM
    jsonb_array_elements (coalesce(p_payload->'variants', '[]'::jsonb)) AS t (value)
  LOOP
    v_var_id := (v_v->>'id')::uuid;
    v_sku := trim(both FROM coalesce (v_v->>'sku', ''));
    IF v_sku = '' THEN
      RAISE EXCEPTION 'Each variant must have a non-empty sku' USING ERRCODE = '22023';
    END IF;
    SELECT
      p.sku INTO v_dup_sku
    FROM
      public.product_variants p
    WHERE
      p.sku = v_sku
      AND p.id != v_var_id
    LIMIT 1;
    IF v_dup_sku IS NOT NULL THEN
      RAISE EXCEPTION 'SKU is already in use: %', v_sku USING ERRCODE = '23505';
    END IF;
    v_cents_null := (v_v->>'price_cents');
    IF v_cents_null IS NULL OR v_cents_null = '' THEN
      RAISE EXCEPTION 'price_cents is required for every variant' USING ERRCODE = '22023';
    END IF;
    v_cents := (v_v->>'price_cents')::int;
    IF v_cents < 0 THEN
      RAISE EXCEPTION 'price_cents must be non-negative' USING ERRCODE = '22023';
    END IF;
    v_vstatus := coalesce(
      (v_v->>'status')::public.product_variant_status,
      'active'::public.product_variant_status
    );
    IF EXISTS (SELECT 1 FROM public.product_variants p WHERE p.id = v_var_id) THEN
      UPDATE public.product_variants
      SET
        product_id = v_id,
        sku = v_sku,
        size = nullif (v_v->>'size', ''),
        color = nullif (v_v->>'color', ''),
        price_cents = v_cents,
        currency = lower (coalesce (nullif (v_v->>'currency', ''), 'usd')),
        inventory_quantity = coalesce (nullif (v_v->>'inventory_quantity', '')::int, 0),
        low_stock_threshold = nullif (v_v->>'low_stock_threshold', '')::int,
        status = v_vstatus,
        image_url = nullif (v_v->>'image_url', ''),
        updated_at = now()
      WHERE
        id = v_var_id
        AND product_id = v_id;
      IF NOT found THEN
        RAISE EXCEPTION 'Variant % is not part of this product or does not exist', v_var_id USING ERRCODE = '23503';
      END IF;
    ELSE
      INSERT INTO public.product_variants (
        id, product_id, sku, size, color, price_cents, currency, inventory_quantity, low_stock_threshold, status, image_url, updated_at
      )
      VALUES (
        v_var_id,
        v_id,
        v_sku,
        nullif (v_v->>'size', ''),
        nullif (v_v->>'color', ''),
        v_cents,
        lower (coalesce (nullif (v_v->>'currency', ''), 'usd')),
        coalesce (nullif (v_v->>'inventory_quantity', '')::int, 0),
        nullif (v_v->>'low_stock_threshold', '')::int,
        v_vstatus,
        nullif (v_v->>'image_url', ''),
        now()
      );
    END IF;
  END LOOP;

  v_img_ids := array[]::uuid[];
  FOR v_g IN
  SELECT
    value
  FROM
    jsonb_array_elements (coalesce(p_payload->'images', '[]'::jsonb)) AS t (value)
  LOOP
    v_img_id := (v_g->>'id')::uuid;
    IF v_img_id IS NULL THEN
      RAISE EXCEPTION 'Each image must include a client-generated id (uuid)' USING ERRCODE = '22023';
    END IF;
    v_img_ids := array_append (v_img_ids, v_img_id);
  END LOOP;

  IF coalesce (array_length (v_img_ids, 1), 0) > 0 THEN
    DELETE FROM public.product_images
    WHERE
      product_id = v_id
      AND id != ALL (v_img_ids);
  ELSE
    DELETE FROM public.product_images
    WHERE
      product_id = v_id;
  END IF;

  FOR v_g IN
  SELECT
    value
  FROM
    jsonb_array_elements (coalesce(p_payload->'images', '[]'::jsonb)) AS t (value)
  LOOP
    v_img_id := (v_g->>'id')::uuid;
    IF trim(both FROM coalesce (v_g->>'storage_path', '')) = '' THEN
      RAISE EXCEPTION 'Each image must have storage_path' USING ERRCODE = '22023';
    END IF;
    v_var_for_img := nullif (v_g->>'variant_id', '')::uuid;
    IF
      v_var_for_img IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.product_variants pv WHERE pv.id = v_var_for_img AND pv.product_id = v_id)
    THEN
      RAISE EXCEPTION 'image variant_id does not match this product' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.product_images i WHERE i.id = v_img_id) THEN
      UPDATE public.product_images
      SET
        product_id = v_id,
        variant_id = v_var_for_img,
        storage_path = (v_g->>'storage_path'),
        alt_text = nullif (v_g->>'alt_text', ''),
        sort_order = coalesce (nullif (v_g->>'sort_order', '')::int, 0),
        is_primary = coalesce (nullif (v_g->>'is_primary', '')::bool, false)
      WHERE
        id = v_img_id
        AND product_id = v_id;
      IF NOT found THEN
        RAISE EXCEPTION 'Image % is not part of this product or does not exist', v_img_id USING ERRCODE = '23503';
      END IF;
    ELSE
      INSERT INTO public.product_images (id, product_id, variant_id, storage_path, alt_text, sort_order, is_primary)
      VALUES (
        v_img_id,
        v_id,
        v_var_for_img,
        (v_g->>'storage_path'),
        nullif (v_g->>'alt_text', ''),
        coalesce (nullif (v_g->>'sort_order', '')::int, 0),
        coalesce (nullif (v_g->>'is_primary', '')::bool, false)
      );
    END IF;
  END LOOP;

  RETURN v_id;
END
$func$;

REVOKE ALL ON FUNCTION public.admin_save_product_bundle (jsonb) FROM public;

GRANT EXECUTE ON FUNCTION public.admin_save_product_bundle (jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_save_product_bundle (jsonb) TO service_role;
