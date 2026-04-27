-- Story 4-3 follow-up: gate order-by-PI reads with a server-issued lookup key (not pi_ alone).

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_confirmation_key text;

UPDATE public.orders
SET
  order_confirmation_key = encode(gen_random_bytes (24), 'hex')
WHERE
  order_confirmation_key IS NULL;

ALTER TABLE public.orders
ALTER COLUMN order_confirmation_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_confirmation_key_uniq ON public.orders (order_confirmation_key);

COMMENT ON COLUMN public.orders.order_confirmation_key IS 'Random secret returned once at checkout; required to read paid order by PaymentIntent id (public API).';
