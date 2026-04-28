-- Story 5-2+: List query support on orders (depends on Story 5-1 migration
-- `20260428170000_admin_orders_notification_select_rls.sql` for admin SELECT policies —
-- do not duplicate CREATE POLICY here).

-- ---------------------------------------------------------------------------
-- List query support (5-2: sort + common filters)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS orders_admin_list_idx ON public.orders (payment_status, fulfillment_status, created_at DESC);

COMMENT ON TABLE public.notification_logs IS 'Transactional notification attempts; RLS: service_role writes; admin SELECT via notification_logs_admin_select.';
