-- Story 4-1: orders + order_items (Epic 4 E4-S1)
-- Enum labels match `paymentStatusSchema` / `fulfillmentStatusSchema` in src/domain/commerce/enums.ts (AC2).
-- RLS: enabled; no anon/authenticated policies — service role used for server writes in Epic 4 webhooks (AC5).
-- `inventory_movements.order_id` FK from story 2-5 (AC4).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.order_payment_status AS ENUM (
  'pending_payment',
  'paid',
  'refunded',
  'partially_refunded',
  'payment_failed'
);

CREATE TYPE public.order_fulfillment_status AS ENUM (
  'processing',
  'packed',
  'shipped',
  'delivered',
  'canceled'
);

-- ---------------------------------------------------------------------------
-- Atomic ZLX-YYYYMMDD-#### allocation (4-3; used by create-payment-intent RPC)
-- ---------------------------------------------------------------------------
CREATE TABLE public.order_number_counters (
  day text PRIMARY KEY CHECK (day ~ '^\d{8}$'),
  seq integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.allocate_order_number ()
  RETURNS text
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
DECLARE
  d text := to_char((now() AT TIME ZONE 'UTC'), 'YYYYMMDD');
  n int;
BEGIN
  INSERT INTO public.order_number_counters AS c (day, seq)
  VALUES (d, 1)
  ON CONFLICT (day) DO UPDATE
  SET seq = c.seq + 1
  RETURNING seq INTO n;
  IF
    n > 9999 THEN
    RAISE EXCEPTION 'allocate_order_number: daily sequence exceeds 9999 (day %)', d;
  END IF;
  RETURN 'ZLX-' || d || '-' || lpad(n::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_order_number () FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.allocate_order_number () TO service_role;

GRANT EXECUTE ON FUNCTION public.allocate_order_number () TO postgres;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  order_number text NOT NULL,
  customer_id uuid,
  customer_email text NOT NULL,
  customer_name text,
  payment_status public.order_payment_status NOT NULL DEFAULT 'pending_payment',
  fulfillment_status public.order_fulfillment_status NOT NULL DEFAULT 'processing',
  subtotal_cents integer NOT NULL,
  shipping_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  shipping_address_json jsonb NOT NULL,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_order_number_key UNIQUE (order_number),
  CONSTRAINT orders_currency_len_chk CHECK (char_length(trim (both FROM currency)) = 3),
  CONSTRAINT orders_subtotal_cents_nonnegative_chk CHECK (subtotal_cents >= 0),
  CONSTRAINT orders_shipping_cents_nonnegative_chk CHECK (shipping_cents >= 0),
  CONSTRAINT orders_tax_cents_nonnegative_chk CHECK (tax_cents >= 0),
  CONSTRAINT orders_discount_cents_nonnegative_chk CHECK (discount_cents >= 0),
  CONSTRAINT orders_total_cents_nonnegative_chk CHECK (total_cents >= 0),
  CONSTRAINT orders_order_number_format_chk CHECK (
    order_number ~ '^ZLX-[0-9]{8}-[0-9]{4}$'
  )
);

CREATE UNIQUE INDEX orders_stripe_payment_intent_id_partial_uniq
ON public.orders (stripe_payment_intent_id)
WHERE
  stripe_payment_intent_id IS NOT NULL;

COMMENT ON TABLE public.orders IS 'Durable order header; PII — RLS default deny for anon/auth (E4+ service role / future admin in Epic 5).';

COMMENT ON COLUMN public.orders.customer_id IS 'Future: REFERENCES public.customers (id) when customers table exists; nullable UUID until then (4-1).';

COMMENT ON COLUMN public.orders.shipping_address_json IS 'Snapshot JSON; should round-trip with addressSchema when set by server (4-3+).';

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  product_id uuid,
  variant_id uuid,
  sku text NOT NULL,
  product_title text NOT NULL,
  variant_title text,
  size text,
  color text,
  quantity integer NOT NULL,
  unit_price_cents integer NOT NULL,
  total_cents integer NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_quantity_positive_chk CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_nonnegative_chk CHECK (unit_price_cents >= 0),
  CONSTRAINT order_items_line_total_nonnegative_chk CHECK (total_cents >= 0)
);

CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);

COMMENT ON TABLE public.order_items IS 'Line snapshots at purchase (FR-ORD-005); immutability enforced in app/4-3+ — not triggers in 4-1.';

-- ---------------------------------------------------------------------------
-- inventory_movements → orders (2-5 deferred FK)
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_movements
ADD CONSTRAINT inventory_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Intentionally no policy for `anon` or `authenticated` on orders / order_items (default deny; AC5).
-- Service-role and postgres owner bypasses RLS for Epic 4 webhook and future admin APIs.
