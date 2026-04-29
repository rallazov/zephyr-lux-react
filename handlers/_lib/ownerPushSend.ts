import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { ENV, isOwnerPushNotificationsConfigured } from "./env";
import { log } from "./logger";
import {
  insertNotificationLog,
  markNotificationLogFailed,
  markNotificationLogSent,
  NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID_PUSH,
} from "./notificationLog";
import { buildOwnerOrderPaidPushPayload, serializeOwnerOrderPaidPushPayload } from "./ownerPushPayload";

export type OwnerPushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

function ensureVapid(): void {
  if (vapidConfigured) return;
  webpush.setVapidDetails(ENV.VAPID_SUBJECT, ENV.VAPID_PUBLIC_KEY, ENV.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

function isGoneStatus(code: number | undefined): boolean {
  return code === 410 || code === 404;
}

async function revokeSubscription(admin: SupabaseClient, subId: string, endpoint: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("owner_push_subscriptions")
    .update({ status: "revoked", updated_at: now })
    .eq("id", subId);
  if (error) {
    log.warn({ err: error, subscription_id: subId, endpoint }, "owner_push: could not revoke subscription");
  }
}

const OWNER_PUSH_QUEUED_STALE_MS = 15 * 60 * 1000;

/** False = another worker is actively sending; true = safe to enqueue (or stale queued was cleared). */
async function canEnqueueOwnerPush(admin: SupabaseClient, orderId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("notification_logs")
    .select("id, created_at")
    .eq("order_id", orderId)
    .eq("channel", "push")
    .eq("template", NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID_PUSH)
    .eq("status", "queued")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    log.warn({ err: error, orderId }, "owner_push: queued log probe failed");
    return true;
  }
  if (!data?.id) return true;
  const created = data.created_at ? new Date(data.created_at as string).getTime() : 0;
  if (Date.now() - created > OWNER_PUSH_QUEUED_STALE_MS) {
    await markNotificationLogFailed(admin, data.id as string, "stale_queued_recovered");
    return true;
  }
  return false;
}

async function alreadyCompletedOwnerPush(admin: SupabaseClient, orderId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("notification_logs")
    .select("id")
    .eq("order_id", orderId)
    .eq("channel", "push")
    .eq("template", NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID_PUSH)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();
  if (error) {
    log.warn({ err: error, orderId }, "owner_push: sent log probe failed");
    return false;
  }
  return Boolean(data?.id);
}

/**
 * Fire-and-forget fan-out for paid orders. Idempotent per order via `notification_logs`.
 * Never throws to payment/email callers.
 */
export async function maybeSendOwnerOrderPaidPush(args: {
  admin: SupabaseClient;
  orderId: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  sendWebPush?: typeof webpush.sendNotification;
}): Promise<void> {
  const { admin, orderId } = args;
  if (!isOwnerPushNotificationsConfigured()) {
    return;
  }

  try {
    ensureVapid();

    const { data: subs, error: subErr } = await admin
      .from("owner_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("status", "active");

    if (subErr) {
      log.warn({ err: subErr, orderId }, "owner_push: could not load subscriptions");
      return;
    }

    const rows = (subs ?? []) as OwnerPushSubscriptionRow[];
    if (rows.length === 0) {
      return;
    }

    if (await alreadyCompletedOwnerPush(admin, orderId)) {
      return;
    }

    if (!(await canEnqueueOwnerPush(admin, orderId))) {
      return;
    }

    const payloadObj = buildOwnerOrderPaidPushPayload({
      orderId: args.orderId,
      orderNumber: args.orderNumber,
      totalCents: args.totalCents,
      currency: args.currency,
    });
    const body = serializeOwnerOrderPaidPushPayload(payloadObj);
    const recipientSummary = `owner_push:${rows.length}_active`;

    const queued = await insertNotificationLog(admin, {
      order_id: orderId,
      recipient: recipientSummary,
      channel: "push",
      template: NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID_PUSH,
      status: "queued",
    });
    if (!queued.ok) {
      return;
    }

    const send = args.sendWebPush ?? webpush.sendNotification.bind(webpush);
    let delivered = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const pushSub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };

      try {
        await send(pushSub, body, { TTL: 86_400 });
        delivered += 1;
      } catch (err: unknown) {
        const code =
          err && typeof err === "object" && "statusCode" in err && typeof err.statusCode === "number"
            ? err.statusCode
            : undefined;
        const msg =
          err && typeof err === "object" && "body" in err && typeof err.body === "string"
            ? err.body
            : err instanceof Error
              ? err.message
              : String(err);
        if (isGoneStatus(code)) {
          await revokeSubscription(admin, row.id, row.endpoint);
        }
        errors.push(`${row.id}:${code ?? "no-status"}:${msg.slice(0, 200)}`);
      }
    }

    const summary =
      delivered === rows.length
        ? `delivered=${delivered}`
        : `delivered=${delivered}/${rows.length}; ${errors.slice(0, 3).join(" | ")}`;

    if (delivered > 0) {
      const marked = await markNotificationLogSent(admin, queued.id, { provider_message_id: summary });
      if (!marked) {
        log.warn({ orderId, notification_log_id: queued.id }, "owner_push: could not mark log sent");
      }
    } else {
      await markNotificationLogFailed(admin, queued.id, summary);
    }
  } catch (err) {
    log.error({ err, orderId }, "owner_push: unexpected failure");
  }
}
