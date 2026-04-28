-- Story 5-6: durable marker for customer shipment notification email (E5-S6, FR-NOT-004).

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_shipment_notification_sent_at timestamptz;

COMMENT ON COLUMN public.orders.customer_shipment_notification_sent_at IS 'Set when customer shipment email was sent successfully (E5-S6, FR-NOT-004); prevents duplicate sends on retry (MVP).';
