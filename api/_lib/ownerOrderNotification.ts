import type { SupabaseClient } from "@supabase/supabase-js";
import { addressSchema } from "../../src/domain/commerce/address";
import { ENV } from "./env";
import { log } from "./logger";
import {
  insertNotificationLog,
  markNotificationLogFailed,
  markNotificationLogSent,
  NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID,
} from "./notificationLog";
import { sendViaResendApi } from "./transactionalEmail";

/**
 * Durable in-flight marker for owner paid notification (4-5). `owner_order_paid_notified_at` must be
 * NULL or this sentinel before we claim; real completion uses a current ISO timestamp. Stale
 * in-flight rows (see `IN_FLIGHT_STALE_MS`) are cleared so webhooks can retry. Resend
 * `Idempotency-Key: owner-order-paid/{orderId}` further dedupes if DB and provider race.
 * For full audit/history, prefer Epic 4-7 `notification_logs` and `provider_message_id`.
 */
export const OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT = "1970-01-01T00:00:00.000Z" as const;

const IN_FLIGHT_STALE_MS = 10 * 60 * 1000;

export function isOwnerOrderPaidNotifiedAtComplete(value: string | null | undefined): boolean {
  return value != null && value !== OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT;
}

export function isOwnerOrderPaidNotifiedInFlight(value: string | null | undefined): boolean {
  return value === OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT;
}

export type OwnerNotifyOrderRow = {
  id: string;
  order_number: string;
  customer_email: string;
  customer_name: string | null;
  total_cents: number;
  currency: string;
  shipping_address_json: unknown;
  payment_status: string;
  owner_order_paid_notified_at: string | null;
  updated_at?: string;
};

export type OwnerNotifyItemRow = {
  sku: string;
  product_title: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

export function formatMoneyCents(cents: number, currency: string): string {
  const cur = currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format shipping for email bodies only (not for logs). */
export function formatShippingAddressForEmail(shippingAddressJson: unknown): string {
  const parsed = addressSchema.safeParse(shippingAddressJson);
  if (!parsed.success) {
    return "[Address on file]";
  }
  const a = parsed.data;
  const lines = [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
    a.country,
    a.phone,
  ]
    .filter((x): x is string => Boolean(x && x.trim()))
    .map((x) => x.trim());
  return lines.join("\n");
}

export function buildOwnerOrderPaidEmail(args: {
  order: Pick<
    OwnerNotifyOrderRow,
    "order_number" | "customer_email" | "customer_name" | "total_cents" | "currency" | "shipping_address_json" | "id"
  >;
  items: OwnerNotifyItemRow[];
}): { subject: string; html: string; text: string } {
  const { order, items } = args;
  const cust = order.customer_name?.trim() || "—";
  const total = formatMoneyCents(order.total_cents, order.currency);
  const shipBlock = formatShippingAddressForEmail(order.shipping_address_json);
  const adminTarget = `${ENV.FRONTEND_URL.replace(/\/$/, "")}/admin/orders/${order.id}`;
  const subject = `New paid order ${order.order_number}`;

  const linesText = items
    .map(
      (it) =>
        `${it.product_title} | SKU ${it.sku} × ${it.quantity} — ${formatMoneyCents(it.total_cents, order.currency)} (unit ${formatMoneyCents(it.unit_price_cents, order.currency)})`,
    )
    .join("\n");

  const linesHtml = items
    .map(
      (it) =>
        `<tr><td>${escapeHtml(it.product_title)}</td><td>${escapeHtml(it.sku)}</td><td>${it.quantity}</td><td>${escapeHtml(formatMoneyCents(it.unit_price_cents, order.currency))}</td><td>${escapeHtml(formatMoneyCents(it.total_cents, order.currency))}</td></tr>`,
    )
    .join("");

  const text = [
    `Order ${order.order_number} is paid.`,
    ``,
    `Customer: ${cust}`,
    `Email: ${order.customer_email}`,
    `Total: ${total}`,
    ``,
    `Shipping:`,
    shipBlock,
    ``,
    `Line items:`,
    linesText,
    ``,
    `Admin (Epic 5 — link target, not a live route yet):`,
    adminTarget,
  ].join("\n");

  const html = `<!doctype html><html><body>
<p><strong>Paid order ${escapeHtml(order.order_number)}</strong></p>
<p>Customer: ${escapeHtml(cust)}<br/>Email: ${escapeHtml(order.customer_email)}<br/>Total: ${escapeHtml(total)}</p>
<p><strong>Shipping</strong><br/>${escapeHtml(shipBlock).replace(/\n/g, "<br/>")}</p>
<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Line</th></tr></thead><tbody>${linesHtml}</tbody></table>
<p><small>Admin deep link (planned): <a href="${escapeHtml(adminTarget)}">${escapeHtml(adminTarget)}</a></small></p>
</body></html>`;

  return { subject, html, text };
}

function parseOwnerRecipients(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const orderNotifySelect =
  "id, order_number, customer_email, customer_name, total_cents, currency, shipping_address_json, payment_status, owner_order_paid_notified_at, updated_at";

async function clearStaleOwnerNotifyInFlight(args: { admin: SupabaseClient; orderId: string }): Promise<void> {
  const staleBefore = new Date(Date.now() - IN_FLIGHT_STALE_MS).toISOString();
  const now = new Date().toISOString();
  await args.admin
    .from("orders")
    .update({ owner_order_paid_notified_at: null, updated_at: now })
    .eq("id", args.orderId)
    .eq("owner_order_paid_notified_at", OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT)
    .lt("updated_at", staleBefore);
}

async function releaseOwnerNotifyInFlight(
  admin: SupabaseClient,
  order: Pick<OwnerNotifyOrderRow, "id">,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("orders")
    .update({ owner_order_paid_notified_at: null, updated_at: now })
    .eq("id", order.id)
    .eq("owner_order_paid_notified_at", OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT);
  if (error) {
    log.error({ err: error, orderId: order.id }, "owner_order_paid_notification: could not clear in-flight marker");
  }
}

/**
 * After order is durably `paid` and inventory + payment_events ledger succeeded, notify the store owner.
 * Failures are logged with correlation ids; never throws to callers (webhook must not 500 for email alone).
 */
export async function maybeSendOwnerOrderPaidNotification(args: {
  admin: SupabaseClient;
  orderId: string;
  stripeEventId: string;
  stripePaymentIntentId: string;
  sendViaResend?: typeof sendViaResendApi;
}): Promise<void> {
  const { admin, orderId, stripeEventId, stripePaymentIntentId } = args;
  const sendFn = args.sendViaResend ?? sendViaResendApi;

  await clearStaleOwnerNotifyInFlight({ admin, orderId });

  const nowIso = new Date().toISOString();
  const { data: claimed, error: claimErr } = await admin
    .from("orders")
    .update({ owner_order_paid_notified_at: OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT, updated_at: nowIso })
    .eq("id", orderId)
    .eq("payment_status", "paid")
    .is("owner_order_paid_notified_at", null)
    .select(orderNotifySelect)
    .maybeSingle();

  if (claimErr) {
    log.error(
      { err: claimErr, orderId, stripeEventId, stripePaymentIntentId },
      "owner_order_paid_notification: could not claim send slot",
    );
    return;
  }

  if (!claimed) {
    const { data: row, error: rowErr } = await admin
      .from("orders")
      .select(orderNotifySelect)
      .eq("id", orderId)
      .maybeSingle();
    if (rowErr) {
      log.error(
        { err: rowErr, orderId, stripeEventId, stripePaymentIntentId },
        "owner_order_paid_notification: could not re-load order after failed claim",
      );
    }
    const peer = row as OwnerNotifyOrderRow | null;
    if (peer && isOwnerOrderPaidNotifiedAtComplete(peer.owner_order_paid_notified_at)) {
      return;
    }
    if (peer && isOwnerOrderPaidNotifiedInFlight(peer.owner_order_paid_notified_at)) {
      // Another worker is sending for this order.
      return;
    }
    return;
  }

  const row = claimed as OwnerNotifyOrderRow;
  const recipients = parseOwnerRecipients(ENV.OWNER_NOTIFICATION_EMAIL);
  const recipientSummary = recipients.length ? recipients.join(", ") : "(none)";
  if (!ENV.RESEND_API_KEY || recipients.length === 0 || !ENV.RESEND_FROM) {
    const ins = await insertNotificationLog(admin, {
      order_id: row.id,
      recipient: recipientSummary,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID,
      status: "failed",
      error_message:
        "missing RESEND_API_KEY, RESEND_FROM, or OWNER_NOTIFICATION_EMAIL before provider call",
    });
    log.warn(
      {
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
        hasKey: Boolean(ENV.RESEND_API_KEY),
        hasFrom: Boolean(ENV.RESEND_FROM),
        recipientCount: recipients.length,
        ...(ins.ok ? { notification_log_id: ins.id } : {}),
      },
      "owner_order_paid_notification: skipped — missing RESEND_API_KEY, RESEND_FROM, or OWNER_NOTIFICATION_EMAIL",
    );
    await releaseOwnerNotifyInFlight(admin, row);
    return;
  }

  const { data: items, error: itemsErr } = await admin
    .from("order_items")
    .select("sku, product_title, quantity, unit_price_cents, total_cents")
    .eq("order_id", orderId);

  if (itemsErr || !items?.length) {
    const ins = await insertNotificationLog(admin, {
      order_id: row.id,
      recipient: recipientSummary,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID,
      status: "failed",
      error_message: itemsErr
        ? `order_items load error: ${itemsErr.message ?? String(itemsErr)}`
        : "order_items empty",
    });
    log.error(
      {
        err: itemsErr,
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
        ...(ins.ok ? { notification_log_id: ins.id } : {}),
      },
      "owner_order_paid_notification: could not load order_items",
    );
    await releaseOwnerNotifyInFlight(admin, row);
    return;
  }

  const itemRows = items as OwnerNotifyItemRow[];
  const { subject, html, text } = buildOwnerOrderPaidEmail({ order: row, items: itemRows });

  const idempotencyKey = `owner-order-paid/${row.id}`;

  const queued = await insertNotificationLog(admin, {
    order_id: row.id,
    recipient: recipientSummary,
    channel: "email",
    template: NOTIFICATION_TEMPLATE_OWNER_ORDER_PAID,
    status: "queued",
  });
  if (queued.ok) {
    log.info(
      {
        orderId: row.id,
        order_number: row.order_number,
        notification_log_id: queued.id,
        stripeEventId,
        stripePaymentIntentId,
      },
      "owner_order_paid_notification: notification log queued",
    );
  } else {
    log.warn(
      {
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
      },
      "owner_order_paid_notification: skipping provider send — notification_logs insert (queued) failed; releasing in-flight for webhook retry",
    );
    await releaseOwnerNotifyInFlight(admin, row);
    return;
  }

  const sent = await sendFn({
    from: ENV.RESEND_FROM,
    to: recipients,
    subject,
    html,
    text,
    idempotencyKey,
  });

  if (!sent.ok) {
    if (queued.ok) {
      await markNotificationLogFailed(admin, queued.id, sent.message);
    }
    log.error(
      {
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
        providerError: sent.message,
        ...(queued.ok ? { notification_log_id: queued.id } : {}),
      },
      "owner_order_paid_notification: Resend send failed (order remains paid)",
    );
    await releaseOwnerNotifyInFlight(admin, row);
    return;
  }

  const markSent = await markNotificationLogSent(admin, queued.id, { provider_message_id: sent.messageId });
  if (markSent) {
    log.info(
      {
        orderId: row.id,
        order_number: row.order_number,
        notification_log_id: queued.id,
        stripeEventId,
        stripePaymentIntentId,
        provider_message_id: sent.messageId,
      },
      "owner_order_paid_notification: Resend send succeeded",
    );
  } else {
    log.error(
      {
        orderId: row.id,
        order_number: row.order_number,
        notification_log_id: queued.id,
        stripeEventId,
        stripePaymentIntentId,
        provider_message_id: sent.messageId,
        idempotencyKey,
      },
      "owner_order_paid_notification: Resend send succeeded but could not mark notification log sent; finalizing order anyway to avoid duplicate owner emails (see notification_logs for mismatch)",
    );
  }

  const doneAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("orders")
    .update({ owner_order_paid_notified_at: doneAt, updated_at: doneAt })
    .eq("id", row.id)
    .eq("owner_order_paid_notified_at", OWNER_ORDER_PAID_NOTIFY_IN_FLIGHT_AT);

  if (updErr) {
    log.error(
      {
        err: updErr,
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
        idempotencyKey,
        ...(queued.ok ? { notification_log_id: queued.id } : {}),
      },
      "owner_order_paid_notification: email sent but could not persist owner_order_paid_notified_at (in-flight left set; use stale recovery or 4-7; Resend may dedupe via idempotency key)",
    );
  }
}
