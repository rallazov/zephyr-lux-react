-- Story 4-6: durable marker for customer order confirmation email (idempotency / retry backfill).

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_confirmation_sent_at timestamptz;

COMMENT ON COLUMN public.orders.customer_confirmation_sent_at IS 'Set when customer order confirmation email was sent successfully (E4-S6, FR-NOT-002).';
