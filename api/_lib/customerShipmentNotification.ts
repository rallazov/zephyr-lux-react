import type { SupabaseClient } from "@supabase/supabase-js";
import { isUnsendableCustomerEmail, supportLineForEmail } from "./customerOrderConfirmation";
import { ENV } from "./env";
import { log } from "./logger";
import {
  insertNotificationLog,
  markNotificationLogFailed,
  markNotificationLogSent,
  NOTIFICATION_TEMPLATE_CUSTOMER_SHIPMENT,
} from "./notificationLog";
import { sendViaResendApi } from "./transactionalEmail";

/** Row shape for `maybeSendCustomerShipmentNotification` order load — keep aligned with migrations. */
export type CustomerShipmentNotifyOrderRow = {
  id: string;
  order_number: string;
  customer_email: string;
  customer_name: string | null;
  payment_status: string;
  fulfillment_status: string;
  customer_shipment_notification_sent_at: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Returns normalized http(s) href or null (no `javascript:` / opaque `href` injection). */
function safeHttpUrlForHref(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

export type ShipmentTrackingFields = {
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
};

export function buildCustomerShipmentEmail(args: {
  order_number: string;
  customer_name: string | null;
  tracking: ShipmentTrackingFields | null;
}): { subject: string; html: string; text: string } {
  const greet = args.customer_name?.trim() || "Hello";
  const support = supportLineForEmail();
  const orderNum = String(args.order_number ?? "");
  const subject = `Your order ${orderNum} has shipped`;

  const t = args.tracking;
  const carrier = t?.carrier?.trim() || "";
  const num = t?.tracking_number?.trim() || "";
  const url = t?.tracking_url?.trim() || "";

  const hasAnyTracking = Boolean(carrier || num || url);
  const shortLine = hasAnyTracking
    ? "Your package is on the way."
    : "Your order has been marked as shipped. Tracking details were not yet available.";

  const textLines = [
    `${greet},`,
    ``,
    shortLine,
    ``,
    `Order ${orderNum}`,
  ];
  if (carrier) textLines.push(`Carrier: ${carrier}`);
  if (num) textLines.push(`Tracking number: ${num}`);
  if (url) textLines.push(`Track your package: ${url}`);
  textLines.push(``, support);

  const htmlParts: string[] = [
    `<p>${escapeHtml(greet)},</p>`,
    `<p>${escapeHtml(shortLine)}</p>`,
    `<p><strong>Order</strong> ${escapeHtml(orderNum)}</p>`,
  ];
  if (carrier) htmlParts.push(`<p><strong>Carrier:</strong> ${escapeHtml(carrier)}</p>`);
  if (num) htmlParts.push(`<p><strong>Tracking number:</strong> ${escapeHtml(num)}</p>`);
  if (url) {
    const href = safeHttpUrlForHref(url);
    if (href) {
      htmlParts.push(`<p><a href="${href}">${escapeHtml(url)}</a></p>`);
    } else {
      htmlParts.push(`<p>${escapeHtml(url)}</p>`);
    }
  }
  htmlParts.push(`<p style="color:#555;font-size:14px">${escapeHtml(support)}</p>`);

  const html =
    `<!doctype html><html><body style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.45;color:#111;">` +
    htmlParts.join("") +
    `</body></html>`;

  return {
    subject,
    text: textLines.join("\n"),
    html,
  };
}

async function loadShipmentTracking(
  admin: SupabaseClient,
  orderId: string,
): Promise<ShipmentTrackingFields | null> {
  const { data, error } = await admin
    .from("shipments")
    .select("carrier, tracking_number, tracking_url")
    .eq("order_id", orderId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    log.warn(
      { err: error, order_id: orderId },
      "customer_shipment_notification: could not load shipments row; sending without carrier/tracking lines",
    );
    return null;
  }

  if (!data) return null;

  const row = data as {
    carrier: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
  };

  return {
    carrier: row.carrier ?? null,
    tracking_number: row.tracking_number ?? null,
    tracking_url: row.tracking_url ?? null,
  };
}

/**
 * After order is **`paid`**, **`shipped`**, and notification not yet marked, emails the customer.
 * Idempotent via `orders.customer_shipment_notification_sent_at`. Does not throw — fulfillment writes must succeed regardless.
 *
 * **Integrations:** Call **`notifyCustomerShipmentAfterPersistedWrites`** (alias below) once from **`api/admin-order-fulfillment.ts`** (Story 5-4—after transitioning to **`shipped`**) **or** **`api/admin-shipment.ts`** (Story 5-5—after **`shipments` upsert** when **`fulfillment_status` is already `shipped`). Prefer exactly one primary call site plus optional secondary if split across handlers; **`maybeSend*`** guards duplicate sends via the durable marker + Resend `Idempotency-Key`.
 */
export async function maybeSendCustomerShipmentNotification(args: {
  admin: SupabaseClient;
  orderId: string;
  sendViaResend?: typeof sendViaResendApi;
}): Promise<void> {
  const sendFn = args.sendViaResend ?? sendViaResendApi;

  const { data: order, error: ordErr } = await args.admin
    .from("orders")
    .select(
      "id, order_number, customer_email, customer_name, payment_status, fulfillment_status, customer_shipment_notification_sent_at",
    )
    .eq("id", args.orderId)
    .maybeSingle();

  if (ordErr || !order) {
    log.error({ err: ordErr, orderId: args.orderId }, "customer_shipment_notification: could not load order");
    return;
  }

  const row = order as CustomerShipmentNotifyOrderRow;

  if (row.payment_status !== "paid") {
    log.warn(
      { orderId: row.id, order_number: row.order_number },
      "customer_shipment_notification: skip — order not paid",
    );
    return;
  }

  if (row.fulfillment_status !== "shipped") {
    log.warn(
      { orderId: row.id, order_number: row.order_number, fulfillment_status: row.fulfillment_status },
      "customer_shipment_notification: skip — fulfillment_status is not shipped",
    );
    return;
  }

  if (row.customer_shipment_notification_sent_at) {
    return;
  }

  if (typeof row.customer_email !== "string") {
    log.warn(
      { orderId: row.id, order_number: row.order_number },
      "customer_shipment_notification: skip — customer_email missing or invalid",
    );
    return;
  }

  const customerRecipient = row.customer_email.trim();

  if (isUnsendableCustomerEmail(row.customer_email)) {
    const ins = await insertNotificationLog(args.admin, {
      order_id: row.id,
      recipient: customerRecipient,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_SHIPMENT,
      status: "failed",
      error_message: "unsendable_recipient: placeholder or checkout.zephyr.local address",
    });
    log.warn(
      {
        orderId: row.id,
        order_number: row.order_number,
        reason: "unsendable_recipient",
        ...(ins.ok ? { notification_log_id: ins.id } : {}),
      },
      "customer_shipment_notification: skipped — unsendable customer email",
    );
    return;
  }

  if (!ENV.RESEND_API_KEY) {
    const ins = await insertNotificationLog(args.admin, {
      order_id: row.id,
      recipient: customerRecipient,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_SHIPMENT,
      status: "failed",
      error_message: "RESEND_API_KEY not configured",
    });
    log.info(
      {
        orderId: row.id,
        order_number: row.order_number,
        ...(ins.ok ? { notification_log_id: ins.id } : {}),
      },
      "customer_shipment_notification: skipped — RESEND_API_KEY not configured",
    );
    return;
  }

  if (!ENV.RESEND_FROM) {
    const ins = await insertNotificationLog(args.admin, {
      order_id: row.id,
      recipient: customerRecipient,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_SHIPMENT,
      status: "failed",
      error_message: "RESEND_FROM not configured",
    });
    log.info(
      {
        orderId: row.id,
        order_number: row.order_number,
        ...(ins.ok ? { notification_log_id: ins.id } : {}),
      },
      "customer_shipment_notification: skipped — RESEND_FROM not configured",
    );
    return;
  }

  const tracking = await loadShipmentTracking(args.admin, row.id);
  const { subject, html, text } = buildCustomerShipmentEmail({
    order_number: row.order_number,
    customer_name: row.customer_name,
    tracking,
  });

  const idempotencyKey = `customer-shipment/${row.id}`;

  const queued = await insertNotificationLog(args.admin, {
    order_id: row.id,
    recipient: customerRecipient,
    channel: "email",
    template: NOTIFICATION_TEMPLATE_CUSTOMER_SHIPMENT,
    status: "queued",
  });
  if (queued.ok) {
    log.info(
      {
        orderId: row.id,
        order_number: row.order_number,
        notification_log_id: queued.id,
      },
      "customer_shipment_notification: notification log queued",
    );
  } else {
    log.warn(
      { orderId: row.id, order_number: row.order_number },
      "customer_shipment_notification: skipping provider — notification_logs insert (queued) failed; marker unchanged for retry",
    );
    return;
  }

  const sent = await sendFn({
    from: ENV.RESEND_FROM,
    to: [customerRecipient],
    subject,
    html,
    text,
    idempotencyKey,
  });

  if (!sent.ok) {
    if (queued.ok) {
      await markNotificationLogFailed(args.admin, queued.id, sent.message);
    }
    log.error(
      {
        orderId: row.id,
        order_number: row.order_number,
        providerError: sent.message,
        ...(queued.ok ? { notification_log_id: queued.id } : {}),
      },
      "customer_shipment_notification: Resend send failed — order fulfillment unchanged",
    );
    return;
  }

  const markSentOk = await markNotificationLogSent(args.admin, queued.id, { provider_message_id: sent.messageId });
  if (markSentOk) {
    log.info(
      {
        orderId: row.id,
        order_number: row.order_number,
        notification_log_id: queued.id,
        provider_message_id: sent.messageId,
      },
      "customer_shipment_notification: Resend send succeeded",
    );
  } else {
    log.error(
      {
        orderId: row.id,
        order_number: row.order_number,
        notification_log_id: queued.id,
        provider_message_id: sent.messageId,
        idempotencyKey,
      },
      "customer_shipment_notification: Resend succeeded but could not mark notification log sent — setting order marker anyway to avoid duplicate shipment emails",
    );
  }

  const now = new Date().toISOString();
  const { error: updErr } = await args.admin
    .from("orders")
    .update({ customer_shipment_notification_sent_at: now, updated_at: now })
    .eq("id", row.id)
    .is("customer_shipment_notification_sent_at", null);

  if (updErr) {
    log.error(
      {
        err: updErr,
        orderId: row.id,
        order_number: row.order_number,
        ...(queued.ok ? { notification_log_id: queued.id } : {}),
      },
      "customer_shipment_notification: email sent but could not persist customer_shipment_notification_sent_at",
    );
  }
}

/**
 * Call after durable **`orders` / `shipments`** writes succeed (Stories **5-4**, **5-5**) when the fulfillment state is **`shipped`**. Idempotent wrapper around **`maybeSendCustomerShipmentNotification`**.
 */
export function notifyCustomerShipmentAfterPersistedWrites(args: {
  admin: SupabaseClient;
  orderId: string;
  sendViaResend?: typeof sendViaResendApi;
}): Promise<void> {
  return maybeSendCustomerShipmentNotification(args);
}
