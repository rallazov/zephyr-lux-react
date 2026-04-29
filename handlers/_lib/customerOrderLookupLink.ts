import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUnsendableCustomerEmail, supportLineForEmail } from "./customerOrderConfirmation";
import { ENV } from "./env";
import { log } from "./logger";
import {
  insertNotificationLog,
  markNotificationLogFailed,
  markNotificationLogSent,
  NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_LOOKUP_LINK,
} from "./notificationLog";
import { sendViaResendApi } from "./transactionalEmail";

/** Wall-clock lifetime of a lookup link (AC: ~24h). */
export const ORDER_LOOKUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Do not send another email if a still-valid token was created within this window (AC5). */
export const ORDER_LOOKUP_RECENT_SUPPRESS_MS = 5 * 60 * 1000;

export function hashLookupToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateLookupTokenRaw(): string {
  return randomBytes(32).toString("base64url");
}

export function emailsMatchCaseInsensitive(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Human-readable expiry line for transactional copy (ties to ORDER_LOOKUP_TOKEN_TTL_MS). */
export function orderLookupExpiryCopy(): string {
  return "This link expires in 24 hours.";
}

export function buildOrderLookupUrlWithFrontendBase(rawToken: string, frontendUrl: string): string {
  const base = frontendUrl.replace(/\/$/, "");
  return `${base}/order-status/${encodeURIComponent(rawToken)}`;
}

export function buildOrderStatusLookupUrl(rawToken: string): string {
  return buildOrderLookupUrlWithFrontendBase(rawToken, ENV.FRONTEND_URL);
}

export function buildCustomerOrderLookupLinkEmail(args: {
  order_number: string;
  lookupUrl: string;
  expiryCopy: string;
}): { subject: string; html: string; text: string } {
  const orderNum = String(args.order_number ?? "");
  const support = supportLineForEmail();
  const subject = `View your order ${orderNum}`;

  const text = [
    `Order ${orderNum}`,
    ``,
    `Open your secure order status page:`,
    args.lookupUrl,
    ``,
    args.expiryCopy,
    ``,
    support,
  ].join("\n");

  const safeUrl = escapeHtml(args.lookupUrl);
  const html =
    `<!doctype html><html><body style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.45;color:#111;">` +
    `<p><strong>Order</strong> ${escapeHtml(orderNum)}</p>` +
    `<p><a href="${safeUrl}">View order status</a></p>` +
    `<p style="color:#555;font-size:14px">${escapeHtml(args.expiryCopy)}</p>` +
    `<p style="color:#555;font-size:14px">${escapeHtml(support)}</p>` +
    `</body></html>`;

  return { subject, html, text };
}

/** Reduces PII in structured logs. */
export function maskEmailForLog(email: string): string {
  const t = email.trim();
  const at = t.indexOf("@");
  if (at <= 0) return "[redacted]";
  const local = t.slice(0, at);
  const domain = t.slice(at + 1);
  const show = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${show}@${domain}`;
}

type OrderLookupRow = {
  id: string;
  order_number: string;
  customer_email: string;
  payment_status: string;
};

type ProcessOrderLookupLinkRequestArgs = {
  admin: SupabaseClient;
  order_number: string;
  email: string;
  sendViaResend?: typeof sendViaResendApi;
};

/**
 * For a valid parsed lookup request: match paid order, optional token+email, neutral outcome for caller.
 * Never throws — handler always returns 202 for valid payloads.
 */
export async function processOrderLookupLinkRequest(args: ProcessOrderLookupLinkRequestArgs): Promise<void> {
  try {
    await processOrderLookupLinkRequestCore(args);
  } catch (err) {
    log.error({ err }, "order_lookup: unexpected processing failure");
  }
}

async function processOrderLookupLinkRequestCore(args: ProcessOrderLookupLinkRequestArgs): Promise<void> {
  const sendFn = args.sendViaResend ?? sendViaResendApi;
  const requestEmail = args.email.trim();

  const { data: order, error: orderErr } = await args.admin
    .from("orders")
    .select("id, order_number, customer_email, payment_status")
    .eq("order_number", args.order_number)
    .maybeSingle();

  if (orderErr) {
    log.error({ err: orderErr, email: maskEmailForLog(requestEmail) }, "order_lookup: orders query failed");
    return;
  }

  if (!order) {
    return;
  }

  const row = order as OrderLookupRow;
  if (!emailsMatchCaseInsensitive(row.customer_email, requestEmail)) {
    return;
  }

  if (row.payment_status !== "paid") {
    return;
  }

  if (isUnsendableCustomerEmail(requestEmail)) {
    await insertNotificationLog(args.admin, {
      order_id: row.id,
      recipient: requestEmail,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_LOOKUP_LINK,
      status: "failed",
      error_message: "unsendable_recipient: placeholder or checkout.zephyr.local address",
    });
    log.warn(
      { order_id: row.id, email: maskEmailForLog(requestEmail) },
      "order_lookup: unsendable recipient — notification failed row only",
    );
    return;
  }

  const nowIso = new Date().toISOString();
  const recentAfter = new Date(Date.now() - ORDER_LOOKUP_RECENT_SUPPRESS_MS).toISOString();

  const { data: recentTok, error: recentErr } = await args.admin
    .from("order_lookup_tokens")
    .select("id")
    .eq("order_id", row.id)
    .gt("expires_at", nowIso)
    .gt("created_at", recentAfter)
    .limit(1)
    .maybeSingle();

  if (recentErr) {
    log.error({ err: recentErr, order_id: row.id }, "order_lookup: recent token lookup failed");
    return;
  }

  if (recentTok) {
    log.info({ order_id: row.id }, "order_lookup: suppressed — recent unexpired token exists");
    return;
  }

  const rawToken = generateLookupTokenRaw();
  const token_hash = hashLookupToken(rawToken);
  const expires_at = new Date(Date.now() + ORDER_LOOKUP_TOKEN_TTL_MS).toISOString();

  const { data: inserted, error: insErr } = await args.admin
    .from("order_lookup_tokens")
    .insert({
      order_id: row.id,
      token_hash,
      recipient_email: requestEmail,
      expires_at,
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    log.error(
      { err: insErr, order_id: row.id },
      "order_lookup: could not persist lookup token",
    );
    return;
  }

  const tokenRowId = inserted.id as string;
  const lookupUrl = buildOrderStatusLookupUrl(rawToken);
  const expiryCopy = orderLookupExpiryCopy();
  const { subject, html, text } = buildCustomerOrderLookupLinkEmail({
    order_number: row.order_number,
    lookupUrl,
    expiryCopy,
  });

  if (!ENV.RESEND_API_KEY || !ENV.RESEND_FROM) {
    await args.admin.from("order_lookup_tokens").delete().eq("id", tokenRowId);
    const insFail = await insertNotificationLog(args.admin, {
      order_id: row.id,
      recipient: requestEmail,
      channel: "email",
      template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_LOOKUP_LINK,
      status: "failed",
      error_message: !ENV.RESEND_API_KEY ? "RESEND_API_KEY not configured" : "RESEND_FROM not configured",
    });
    log.info(
      {
        order_id: row.id,
        ...(insFail.ok ? { notification_log_id: insFail.id } : {}),
      },
      "order_lookup: Resend not configured — token rolled back, failed notification row",
    );
    return;
  }

  const queued = await insertNotificationLog(args.admin, {
    order_id: row.id,
    recipient: requestEmail,
    channel: "email",
    template: NOTIFICATION_TEMPLATE_CUSTOMER_ORDER_LOOKUP_LINK,
    status: "queued",
  });

  if (!queued.ok) {
    await args.admin.from("order_lookup_tokens").delete().eq("id", tokenRowId);
    log.warn({ order_id: row.id }, "order_lookup: queued log insert failed — token rolled back");
    return;
  }

  let sent: Awaited<ReturnType<typeof sendViaResendApi>>;
  try {
    sent = await sendFn({
      from: ENV.RESEND_FROM,
      to: [requestEmail],
      subject,
      html,
      text,
      idempotencyKey: `order-lookup/${row.id}/${tokenRowId}`,
    });
  } catch (err) {
    sent = {
      ok: false,
      message: err instanceof Error ? err.message : "Resend request failed",
    };
  }

  if (!sent.ok) {
    await args.admin.from("order_lookup_tokens").delete().eq("id", tokenRowId);
    await markNotificationLogFailed(args.admin, queued.id, sent.message);
    log.error(
      { order_id: row.id, providerError: sent.message, notification_log_id: queued.id },
      "order_lookup: Resend failed — token rolled back",
    );
    return;
  }

  const marked = await markNotificationLogSent(args.admin, queued.id, { provider_message_id: sent.messageId });
  if (!marked) {
    log.error(
      { order_id: row.id, notification_log_id: queued.id },
      "order_lookup: Resend ok but could not mark notification sent",
    );
  } else {
    log.info(
      { order_id: row.id, notification_log_id: queued.id, provider_message_id: sent.messageId },
      "order_lookup: secure link emailed",
    );
  }
}
