-- Story 8-5: Private shipment label/package photos (PRD NFR-SEC-006). Admin-only reads via JWT;
-- DML and Storage writes via service_role API only.

CREATE TYPE public.shipment_image_type AS ENUM (
  'label',
  'package',
  'receipt',
  'other'
);

CREATE TABLE public.shipment_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  shipment_id uuid NOT NULL REFERENCES public.shipments (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  image_type public.shipment_image_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now ()
);

COMMENT ON TABLE public.shipment_images IS 'Fulfillment evidence photos (labels, packages). Private bucket; not exposed on customer order status APIs.';

CREATE INDEX shipment_images_order_id_idx ON public.shipment_images (order_id);

CREATE INDEX shipment_images_shipment_id_idx ON public.shipment_images (shipment_id);

-- order_id + shipment_id consistency enforced in api/admin-shipment-image (shipments.order_id match).

ALTER TABLE public.shipment_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY shipment_images_admin_select_only ON public.shipment_images
  FOR SELECT
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');

-- Private bucket: no anon policies; service_role bypasses RLS for server uploads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'shipment-images',
    'shipment-images',
    FALSE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id)
  DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY shipment_images_storage_admin_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'shipment-images'
    AND coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');
