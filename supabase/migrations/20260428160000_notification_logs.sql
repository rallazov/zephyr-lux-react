-- Story 4-7: notification_logs (E4-S7, PRD §12.7)
-- One row per notification attempt; append-only history (no unique on order/template/channel) so retries and re-attempts remain auditable.
-- order_id: ON DELETE SET NULL preserves audit rows if an order row is removed.

CREATE TYPE public.notification_channel AS ENUM ('email', 'sms', 'push');

CREATE TYPE public.notification_status AS ENUM ('queued', 'sent', 'failed');

CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  recipient text NOT NULL,
  channel public.notification_channel NOT NULL,
  template text NOT NULL,
  status public.notification_status NOT NULL,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX notification_logs_order_id_created_at_desc_idx ON public.notification_logs (order_id, created_at DESC);

COMMENT ON TABLE public.notification_logs IS 'Transactional notification attempts; RLS on — no anon/auth policies (service role writes only until Epic 5 admin read).';

COMMENT ON COLUMN public.notification_logs.order_id IS 'Nullable so logs survive rare order deletion; webhook paths always set this when tied to an order.';

-- RLS: default deny for anon/authenticated; service_role bypasses (same pattern as orders).
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
