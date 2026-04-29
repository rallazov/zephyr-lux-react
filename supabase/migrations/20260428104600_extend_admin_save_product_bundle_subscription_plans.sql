-- Story 8-1: include `product_subscription_plans` rows in atomic admin saves.
-- Depends on subscription_plan enums + table from 20260428104500.

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
  v_pl jsonb;
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
  v_plan_id uuid;
  v_plan_ids uuid[] := array[]::uuid[];
  v_pslug text;
  v_pnm text;
  v_pstat public.subscription_plan_status;
  v_sp_id text;
  v_stripe_price text;
  v_interval public.subscription_plan_interval;
  v_icount int;
  v_pcents int;
  v_cur text;
  v_trial int;
  v_var_plan uuid;
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

  v_plan_ids := array[]::uuid[];
  FOR v_pl IN
  SELECT
    value
  FROM
    jsonb_array_elements (coalesce(p_payload->'subscription_plans', '[]'::jsonb)) AS t (value)
  LOOP
    v_plan_id := (v_pl->>'id')::uuid;
    IF v_plan_id IS NULL THEN
      RAISE EXCEPTION 'Each subscription plan must include a client-generated id (uuid)' USING ERRCODE = '22023';
    END IF;
    v_plan_ids := array_append (v_plan_ids, v_plan_id);
  END LOOP;

  IF coalesce (array_length (v_plan_ids, 1), 0) > 0 THEN
    DELETE FROM public.product_subscription_plans
    WHERE
      product_id = v_id
      AND id != ALL (v_plan_ids);
  ELSE
    DELETE FROM public.product_subscription_plans
    WHERE
      product_id = v_id;
  END IF;

  FOR v_pl IN
  SELECT
    value
  FROM
    jsonb_array_elements (coalesce(p_payload->'subscription_plans', '[]'::jsonb)) AS t (value)
  LOOP
    v_plan_id := (v_pl->>'id')::uuid;
    v_pslug := lower(trim(both FROM coalesce (v_pl->>'slug', '')));
    IF v_pslug = '' THEN
      RAISE EXCEPTION 'subscription plan slug required' USING ERRCODE = '22023';
    END IF;
    v_pstat := coalesce(
      (v_pl->>'status')::public.subscription_plan_status,
      'draft'::public.subscription_plan_status
    );
    v_pnm := trim(both FROM coalesce (v_pl->>'name', ''));
    v_sp_id := nullif(trim(both FROM coalesce (v_pl->>'stripe_product_id', '')), '');
    v_stripe_price := nullif(trim(both FROM coalesce (v_pl->>'stripe_price_id', '')), '');
    IF v_sp_id IS NOT NULL AND v_sp_id !~ '^prod_[a-zA-Z0-9_]+$' THEN
      RAISE EXCEPTION 'subscription plan stripe_product_id must be a Stripe product id (prod_…)' USING ERRCODE = '22023';
    END IF;
    IF v_stripe_price IS NOT NULL AND v_stripe_price !~ '^price_[a-zA-Z0-9_]+$' THEN
      RAISE EXCEPTION 'subscription plan stripe_price_id must be a Stripe price id (price_…)' USING ERRCODE = '22023';
    END IF;
    v_interval := coalesce (
      nullif(trim(both FROM coalesce(v_pl->>'interval', '')), '')::public.subscription_plan_interval,
      'month'::public.subscription_plan_interval
    );
    v_icount := coalesce(nullif(trim(both FROM coalesce(v_pl->>'interval_count', '')), '')::int, 1);
    IF v_icount < 1 THEN
      RAISE EXCEPTION 'subscription plan interval_count must be at least 1' USING ERRCODE = '22023';
    END IF;
    v_pcents := coalesce(nullif(trim(both FROM coalesce(v_pl->>'price_cents', '')), '')::int, 0);
    IF v_pcents < 0 THEN
      RAISE EXCEPTION 'subscription plan price_cents must be non-negative' USING ERRCODE = '22023';
    END IF;
    v_cur := lower (coalesce (nullif(trim(both FROM coalesce(v_pl->>'currency', '')), ''), 'usd'));
    IF v_pl->>'trial_period_days' IS NULL OR trim(both FROM coalesce(v_pl->>'trial_period_days', '')) = '' THEN
      v_trial := NULL::int;
    ELSE
      v_trial := (v_pl->>'trial_period_days')::int;
      IF v_trial < 0 THEN
        RAISE EXCEPTION 'subscription plan trial_period_days must be non-negative' USING ERRCODE = '22023';
      END IF;
    END IF;
    v_var_plan := nullif(trim(both FROM coalesce(v_pl->>'variant_id', '')), '')::uuid;
    IF
      v_var_plan IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.product_variants pv WHERE pv.id = v_var_plan AND pv.product_id = v_id)
    THEN
      RAISE EXCEPTION 'subscription plan variant_id does not match this product' USING ERRCODE = '22023';
    END IF;
    IF v_pstat = 'active'::public.subscription_plan_status THEN
      IF v_pnm = '' THEN
        RAISE EXCEPTION 'Active subscription plans require name' USING ERRCODE = '22023';
      END IF;
      IF v_stripe_price IS NULL OR btrim(v_stripe_price) = '' THEN
        RAISE EXCEPTION 'Active subscription plans require stripe_price_id' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM public.product_subscription_plans spp WHERE spp.id = v_plan_id) THEN
      UPDATE public.product_subscription_plans spp
      SET
        product_id = v_id,
        variant_id = v_var_plan,
        slug = v_pslug,
        name =
          CASE
            WHEN v_pnm <> '' THEN v_pnm
            ELSE spp.name
          END,
        description = nullif(trim(both FROM coalesce(v_pl->>'description', '')), ''),
        stripe_product_id = v_sp_id,
        stripe_price_id = v_stripe_price,
        interval = v_interval,
        interval_count = v_icount,
        price_cents = v_pcents,
        currency = v_cur,
        trial_period_days = v_trial,
        status = v_pstat
      WHERE spp.id = v_plan_id
        AND spp.product_id = v_id;
      IF NOT found THEN
        RAISE EXCEPTION 'Subscription plan % is not part of this product or does not exist', v_plan_id USING ERRCODE = '23503';
      END IF;
    ELSE
      INSERT INTO public.product_subscription_plans (
        id,
        product_id,
        variant_id,
        slug,
        name,
        description,
        stripe_product_id,
        stripe_price_id,
        interval,
        interval_count,
        price_cents,
        currency,
        trial_period_days,
        status
      )
      VALUES (
        v_plan_id,
        v_id,
        v_var_plan,
        v_pslug,
        CASE WHEN v_pnm <> '' THEN v_pnm ELSE '(draft plan)' END,
        nullif(trim(both FROM coalesce(v_pl->>'description', '')), ''),
        v_sp_id,
        v_stripe_price,
        v_interval,
        v_icount,
        v_pcents,
        v_cur,
        v_trial,
        v_pstat
      );
    END IF;
  END LOOP;

  RETURN v_id;
END
$func$;
