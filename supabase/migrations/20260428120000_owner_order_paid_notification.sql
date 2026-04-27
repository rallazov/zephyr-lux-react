-- Story 4-5: durable marker for owner "order paid" email (idempotency / backfill).

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS owner_order_paid_notified_at timestamptz;

COMMENT ON COLUMN public.orders.owner_order_paid_notified_at IS 'Set when owner transactional email for paid order was sent successfully (E4-S5).';
