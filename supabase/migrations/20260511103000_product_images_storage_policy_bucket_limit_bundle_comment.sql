-- Public read policy parity for storefront product-images; align bucket ceiling with handler (20 MiB).

UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'product-images';

CREATE POLICY product_images_public_select ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

COMMENT ON FUNCTION public.admin_save_product_catalog_bundle (jsonb)
IS 'Wraps admin_save_product_bundle then replaces product_collection_assignments from p_payload.collection_keys. Omitted collection_keys key or empty array clears assignments; invalid keys rollback.';
