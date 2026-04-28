-- Story 5-5: shipments (Epic 5 E5-S5) — carrier / tracking / URL persistence (PRD §12.6).
-- Writes: api handlers + service_role only (SPA uses fetch to /api; no authenticated PostgREST DML).

CREATE TYPE public.shipment_status AS ENUM (
  'pending',
  'packed',
  'shipped',
  'delivered',
  'returned'
);

CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  carrier text,
  tracking_number text,
  tracking_url text,
  status public.shipment_status NOT NULL DEFAULT 'pending'::public.shipment_status,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT shipments_one_row_per_order_mvp UNIQUE (order_id),
  CONSTRAINT shipments_tracking_url_nonempty_chk CHECK (tracking_url IS NULL OR tracking_url LIKE 'http%'),
  CONSTRAINT shipments_carrier_len_chk CHECK (carrier IS NULL OR char_length(trim (both FROM carrier)) <= 160),
  CONSTRAINT shipments_tracking_number_len_chk CHECK (
    tracking_number IS NULL OR char_length(trim (both FROM tracking_number)) <= 200
  )
);

COMMENT ON TABLE public.shipments IS 'Per-order fulfillment parcel metadata; MVP cardinality = one row per order (`order_id` unique). Prefer reads via SPA admin JWT (SELECT policy); INSERT/UPDATE only service_role (+ api/).';

COMMENT ON COLUMN public.shipments.tracking_url IS 'Full HTTPS URL — may be operator-entered or derived from carrier + tracking_number in api (FR-FUL-002).';

COMMENT ON COLUMN public.shipments.status IS 'Shipment record lifecycle (PRD shipment_status enum) — mirrors packed/shipped milestones; differs from orders.fulfillment_status naming but both may read `shipped` when dispatched.';

CREATE INDEX shipments_order_id_idx ON public.shipments (order_id);

CREATE OR REPLACE FUNCTION public.shipments_set_updated_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
BEGIN
  NEW.updated_at = now ();
  RETURN NEW;
END;
$$;

CREATE TRIGGER shipments_before_update_touch_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.shipments_set_updated_at ();

-- RLS: admin SPA may SELECT with JWT predicate (same as orders); no INSERT/UPDATE/DELETE for authenticated.
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY shipments_admin_select_only ON public.shipments
  FOR SELECT
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');
