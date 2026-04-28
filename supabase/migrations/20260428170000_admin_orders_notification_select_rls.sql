-- Story 5-1: Admin SELECT on orders, order_items, notification_logs (Epic 5 E5-S1)
-- Mirrors catalog admin JWT predicate from 20260426220000_admin_rls_and_save_rpc.sql.
-- SELECT only for authenticated users with app_metadata.role = 'admin'.
-- Writes remain service_role / server paths; do not add broad authenticated DML here.

CREATE POLICY orders_admin_select ON public.orders
  FOR SELECT
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');

CREATE POLICY order_items_admin_select ON public.order_items
  FOR SELECT
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');

CREATE POLICY notification_logs_admin_select ON public.notification_logs
  FOR SELECT
  TO authenticated
  USING (coalesce((auth.jwt () -> 'app_metadata' ->> 'role'), '') = 'admin');
