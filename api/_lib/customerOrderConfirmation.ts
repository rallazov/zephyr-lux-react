import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoneyCents, formatShippingAddressForEmail } from "./ownerOrderNotification";
import { PENDING_CHECKOUT_SHIPPING_JSON } from "./orderSnapshots";
import { ENV } from "./env";
import { log } from "./logger";
import {
  insertNotificationLog,
  markNotificationLogFailed,
  markNotificationLogSent,
  NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_CONFIRMATION,
} from "./notificationLog";
import { sendViaResendApi } from "./transactionalEmail";

/** Checkout placeholder — must never receive Resend traffic (AC8). */
export const PLACEHOLDER_CHECKOUT_EMAIL = "pending@checkout.zephyr.local";

export function isUnsendableCustomerEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e === PLACEHOLDER_CHECKOUT_EMAIL || e.endsWith("@checkout.zephyr.local");
}

export function isPendingCheckoutShippingAddress(json: unknown): boolean {
  if (json == null || typeof json !== "object") return true;
  const o = json as Record<string, unknown>;
  return (
    o.line1 === PENDING_CHECKOUT_SHIPPING_JSON.line1 &&
    o.city === PENDING_CHECKOUT_SHIPPING_JSON.city
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type CustomerNotifyItemRow = {
  sku: string;
  product_title: string;
  variant_title: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

export type CustomerNotifyOrderRow = {
  id: string;
  order_number: string;
  customer_email: string;
  customer_name: string | null;
  total_cents: number;
  currency: string;
  shipping_address_json: unknown;
  payment_status: string;
  customer_confirmation_sent_at: string | null;
};

export function supportLineForEmail(): string {
  const s = ENV.SUPPORT_EMAIL.trim();
  if (s) return `Questions? Email us at ${s}.`;
  const from = ENV.RESEND_FROM.trim();
  if (from) return `Reply to this message or contact us at ${from}.`;
  return "Questions? Use the contact options on our site.";
}

export function buildCustomerOrderConfirmationEmail(args: {
  order: Pick<
    CustomerNotifyOrderRow,
    | "order_number"
    | "customer_name"
    | "total_cents"
    | "currency"
    | "shipping_address_json"
  >;
  items: CustomerNotifyItemRow[];
}): { subject: string; html: string; text: string } {
  const { order, items } = args;
  const greet = order.customer_name?.trim() || "Hello";
  const total = formatMoneyCents(order.total_cents, order.currency);
  const shipBlock = formatShippingAddressForEmail(order.shipping_address_json);
  const baseUrl = ENV.FRONTEND_URL.replace(/\/$/, "");
  const support = supportLineForEmail();
  const subject = `Order confirmed — ${order.order_number}`;

  const linesText = items
    .map((it) => {
      const vt = it.variant_title?.trim();
      const label = vt ? `${it.product_title} (${vt})` : it.product_title;
      return `${label} | SKU ${it.sku} × ${it.quantity} — ${formatMoneyCents(it.total_cents, order.currency)}`;
    })
    .join("\n");

  const linesHtml = items
    .map((it) => {
      const vt = it.variant_title?.trim();
      const label = vt ? `${it.product_title} (${vt})` : it.product_title;
      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(it.sku)}</td><td>${escapeHtml(String(it.quantity))}</td><td>${escapeHtml(formatMoneyCents(it.unit_price_cents, order.currency))}</td><td>${escapeHtml(formatMoneyCents(it.total_cents, order.currency))}</td></tr>`;
    })
    .join("");

  const nextSteps = [
    "We're preparing your order for shipment.",
    "You'll receive tracking information by email when it ships.",
    `Store: ${baseUrl}`,
  ].join("\n");

  const text = [
    `${greet},`,
    ``,
    `Thank you for your order ${order.order_number}.`,
    ``,
    `Order total: ${total}`,
    ``,
    `Shipping address:`,
    shipBlock,
    ``,
    `Items:`,
    linesText,
    ``,
    nextSteps,
    ``,
    support,
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.45;color:#111;">
<p>${escapeHtml(greet)},</p>
<p>Thank you for your order <strong>${escapeHtml(order.order_number)}</strong>.</p>
<p><strong>Order total:</strong> ${escapeHtml(total)}</p>
<p><strong>Shipping address</strong><br/>${escapeHtml(shipBlock).replace(/\n/g, "<br/>")}</p>
<table style="width:100%;max-width:560px;border-collapse:collapse;font-size:14px" cellpadding="8"><thead><tr style="text-align:left;border-bottom:1px solid #ccc"><th>Item</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Line</th></tr></thead><tbody>${linesHtml}</tbody></table>
<p style="margin-top:1.2em">We're preparing your order for shipment. You'll receive tracking information when it ships.</p>
<p><a href="${escapeHtml(baseUrl)}">Visit our store</a></p>
<p style="color:#555;font-size:14px">${escapeHtml(support)}</p>
</body></html>`;

  return { subject, html, text };
}

/**
 * After order is durably `paid` and payment_events ledger succeeded, email the customer.
 * Idempotent via `orders.customer_confirmation_sent_at`. Does not throw (webhook must succeed).
 */
export async function maybeSendCustomerOrderConfirmation(args: {
  admin: SupabaseClient;
  orderId: string;
  stripeEventId: string;
  stripePaymentIntentId: string;
  sendViaResend?: typeof sendViaResendApi;
}): Promise<void> {
  const { admin, orderId, stripeEventId, stripePaymentIntentId } = args;
  const sendFn = args.sendViaResend ?? sendViaResendApi;

  const { data: order, error: ordErr } = await admin
    .from("orders")
    .select(
      "id, order_number, customer_email, customer_name, total_cents, currency, shipping_address_json, payment_status, customer_confirmation_sent_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (ordErr || !order) {
    log.error(
      { err: ordErr, orderId, stripeEventId, stripePaymentIntentId },
      "customer_order_confirmation: could not load order",
    );
    return;
  }

  const row = order as CustomerNotifyOrderRow;
  if (row.payment_status !== "paid") {
    log.warn(
      { orderId: row.id, order_number: row.order_number, stripeEventId, stripePaymentIntentId },
      "customer_order_confirmation: skip — order not paid",
    );
    return;
  }

  if (row.customer_confirmation_sent_at) {
    return;
  }

  const customerRecipient = row.customer_email.trim();

  if (isUnsendableCustomerEmail(row.customer_email)) {
    const ins = await insertNotificationLog(admin, {
      order_id: row.id,
      recipient: customerRecipient,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_CONFIRMATION,
      status: "failed",
      error_message: "unsendable_recipient: placeholder or checkout.zephyr.local address",
    });
    log.warn(
      {
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
        reason: "unsendable_recipient",
        ...(ins.ok ? { notification_log_id: ins.id } : {}),
      },
      "customer_order_confirmation: skipped — placeholder or invalid checkout email",
    );
    return;
  }

  if (isPendingCheckoutShippingAddress(row.shipping_address_json)) {
    const ins = await insertNotificationLog(admin, {
      order_id: row.id,
      recipient: customerRecipient,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_CONFIRMATION,
      status: "failed",
      error_message: "shipping_address still pending in snapshot (retry when fixed)",
    });
    log.warn(
      {
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
        ...(ins.ok ? { notification_log_id: ins.id } : {}),
      },
      "customer_order_confirmation: skipped — shipping address still pending in snapshot (retry when fixed)",
    );
    return;
  }

  if (!ENV.RESEND_API_KEY) {
    const ins = await insertNotificationLog(admin, {
      order_id: row.id,
      recipient: customerRecipient,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_CONFIRMATION,
      status: "failed",
      error_message: "RESEND_API_KEY not configured",
    });
    log.info(
      {
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
        ...(ins.ok ? { notification_log_id: ins.id } : {}),
      },
      "customer_order_confirmation: skipped — RESEND_API_KEY not configured",
    );
    return;
  }

  if (!ENV.RESEND_FROM) {
    const ins = await insertNotificationLog(admin, {
      order_id: row.id,
      recipient: customerRecipient,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_CONFIRMATION,
      status: "failed",
      error_message: "RESEND_FROM not configured",
    });
    log.info(
      {
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
        ...(ins.ok ? { notification_log_id: ins.id } : {}),
      },
      "customer_order_confirmation: skipped — RESEND_FROM not configured",
    );
    return;
  }

  const { data: items, error: itemsErr } = await admin
    .from("order_items")
    .select("sku, product_title, variant_title, quantity, unit_price_cents, total_cents")
    .eq("order_id", orderId);

  if (itemsErr || !items?.length) {
    const ins = await insertNotificationLog(admin, {
      order_id: row.id,
      recipient: customerRecipient,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_CONFIRMATION,
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
      "customer_order_confirmation: could not load order_items",
    );
    return;
  }

  const itemRows = items as CustomerNotifyItemRow[];
  const { subject, html, text } = buildCustomerOrderConfirmationEmail({ order: row, items: itemRows });
  const to = [customerRecipient];

  const idempotencyKey = `customer-confirmation/${row.id}`;
  const queued = await insertNotificationLog(admin, {
    order_id: row.id,
    recipient: customerRecipient,
    channel: "email",
    template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_CONFIRMATION,
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
      "customer_order_confirmation: notification log queued",
    );
  } else {
    log.warn(
      {
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
      },
      "customer_order_confirmation: skipping provider send — notification_logs insert (queued) failed; will retry (customer_confirmation_sent_at still null)",
    );
    return;
  }

  const sent = await sendFn({
    from: ENV.RESEND_FROM,
    to,
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
      "customer_order_confirmation: Resend send failed (order remains paid, retry may backfill)",
    );
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
      "customer_order_confirmation: Resend send succeeded",
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
      "customer_order_confirmation: Resend send succeeded but could not mark notification log sent; finalizing order marker anyway to avoid duplicate customer emails (see notification_logs for mismatch)",
    );
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("orders")
    .update({ customer_confirmation_sent_at: now, updated_at: now })
    .eq("id", row.id)
    .is("customer_confirmation_sent_at", null);

  if (updErr) {
    log.error(
      {
        err: updErr,
        orderId: row.id,
        order_number: row.order_number,
        stripeEventId,
        stripePaymentIntentId,
        ...(queued.ok ? { notification_log_id: queued.id } : {}),
      },
      "customer_order_confirmation: email sent but could not persist customer_confirmation_sent_at",
    );
  }
}
