-- Admin Catalog And Media Manager
-- Product image storage + collection assignments.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE public.product_collection_assignments (
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  collection_key text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, collection_key),
  CONSTRAINT product_collection_assignments_key_format CHECK (
    collection_key = lower(collection_key)
    AND collection_key ~ '^[a-z0-9][a-z0-9-]{0,62}$'
  )
);

CREATE INDEX product_collection_assignments_collection_key_idx
  ON public.product_collection_assignments (collection_key);

COMMENT ON TABLE public.product_collection_assignments IS
  'Admin-managed storefront collection membership. Category remains a compatibility fallback.';

ALTER TABLE public.product_collection_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_collection_assignments_storefront_select
  ON public.product_collection_assignments
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE
        p.id = product_collection_assignments.product_id
        AND p.status IN ('active'::public.product_status, 'coming_soon'::public.product_status)
    )
  );

CREATE POLICY product_collection_assignments_admin_all
  ON public.product_collection_assignments
  FOR ALL
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin')
  WITH CHECK (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');

GRANT SELECT ON public.product_collection_assignments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_collection_assignments TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_product_collections (
  p_product_id uuid,
  p_collection_keys text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_key text;
  v_keys text[] := array[]::text[];
  v_count int := 0;
BEGIN
  IF coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') != 'admin' THEN
    RAISE EXCEPTION 'Admin role is required' USING ERRCODE = '42501';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product id is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = p_product_id) THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id USING ERRCODE = 'P0002';
  END IF;

  FOREACH v_key IN ARRAY coalesce(p_collection_keys, array[]::text[])
  LOOP
    v_key := lower(trim(both FROM coalesce(v_key, '')));
    IF v_key = '' THEN
      CONTINUE;
    END IF;
    IF v_key !~ '^[a-z0-9][a-z0-9-]{0,62}$' THEN
      RAISE EXCEPTION 'Invalid collection key: %', v_key USING ERRCODE = '22023';
    END IF;
    IF NOT v_key = ANY (v_keys) THEN
      v_keys := array_append(v_keys, v_key);
    END IF;
  END LOOP;

  DELETE FROM public.product_collection_assignments
  WHERE product_id = p_product_id;

  FOREACH v_key IN ARRAY v_keys
  LOOP
    INSERT INTO public.product_collection_assignments (product_id, collection_key)
    VALUES (p_product_id, v_key);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END
$func$;

REVOKE ALL ON FUNCTION public.admin_save_product_collections (uuid, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_save_product_collections (uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_product_collections (uuid, text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_save_product_catalog_bundle (p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_product_id uuid;
  v_keys text[] := array[]::text[];
  v_key jsonb;
BEGIN
  v_product_id := public.admin_save_product_bundle(p_payload);

  FOR v_key IN
    SELECT value
    FROM jsonb_array_elements(coalesce(p_payload->'collection_keys', '[]'::jsonb)) AS t(value)
  LOOP
    v_keys := array_append(v_keys, v_key #>> '{}');
  END LOOP;

  PERFORM public.admin_save_product_collections(v_product_id, v_keys);

  RETURN v_product_id;
END
$func$;

REVOKE ALL ON FUNCTION public.admin_save_product_catalog_bundle (jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_save_product_catalog_bundle (jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_product_catalog_bundle (jsonb) TO service_role;
