import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "./logger";

export type NotificationChannel = "email" | "sms" | "push";

export const NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID = "owner_order_paid" as const;
export const NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_CONFIRMATION = "customer_order_confirmation" as const;
export const NOTIFICATION_TEMPLATE_CUSTOMER_SHIPMENT = "customer_shipment" as const;
export const NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_LOOKUP_LINK = "customer_order_lookup_link" as const;

export type NotificationLogInsert = {
  order_id: string | null;
  recipient: string;
  channel: NotificationChannel;
  template: string;
  status: "queued" | "failed";
  provider_message_id?: string | null;
  error_message?: string | null;
  sent_at?: string | null;
};

/**
 * Insert a `queued` row before calling the provider, or a terminal `failed` row when validation fails before transport.
 */
export async function insertNotificationLog(
  admin: SupabaseClient,
  row: NotificationLogInsert,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const payload = {
    order_id: row.order_id,
    recipient: row.recipient,
    channel: row.channel,
    template: row.template,
    status: row.status,
    provider_message_id: row.provider_message_id ?? null,
    error_message: row.error_message ?? null,
    sent_at: row.sent_at ?? null,
  };
  const { data, error } = await admin.from("notification_logs").insert(payload).select("id").single();
  if (error || !data?.id) {
    log.error(
      { err: error, order_id: row.order_id, template: row.template, status: row.status },
      "notification_logs: insert failed",
    );
    return { ok: false };
  }
  return { ok: true, id: data.id as string };
}

export async function markNotificationLogSent(
  admin: SupabaseClient,
  logId: string,
  args: { provider_message_id?: string | null },
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("notification_logs")
    .update({
      status: "sent",
      sent_at: now,
      provider_message_id: args.provider_message_id ?? null,
      error_message: null,
    })
    .eq("id", logId)
    .eq("status", "queued")
    .select("id");
  if (error) {
    log.error({ err: error, notification_log_id: logId }, "notification_logs: mark sent failed");
    return false;
  }
  if (!data?.length) {
    log.error({ notification_log_id: logId }, "notification_logs: mark sent did not match a queued row");
    return false;
  }
  return true;
}

export async function markNotificationLogFailed(
  admin: SupabaseClient,
  logId: string,
  errorMessage: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("notification_logs")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 4000),
    })
    .eq("id", logId)
    .eq("status", "queued")
    .select("id");
  if (error) {
    log.error({ err: error, notification_log_id: logId }, "notification_logs: mark failed failed");
    return false;
  }
  if (!data?.length) {
    log.error({ notification_log_id: logId }, "notification_logs: mark failed did not match a queued row");
    return false;
  }
  return true;
}
