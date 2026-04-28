import { z } from "zod";
import { addressSchema, type Address } from "../domain/commerce/address";

/** RFC 4122 UUID v1–v5 string (path param `:id`). */
const uuidParamSchema = z.string().uuid();

export function isValidOrderIdParam(id: string | undefined): boolean {
  if (!id) {
    return false;
  }
  return uuidParamSchema.safeParse(id).success;
}

export function formatAdminMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.trim().toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** Enum strings like `pending_payment` → "Pending payment". */
export function formatDomainEnumLabel(raw: string): string {
  return raw
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type ParsedShippingSnapshot =
  | { ok: true; lines: string[]; address: Address }
  | { ok: false; lines: string[] };

/** Safe parse `shipping_address_json` for display + copy (FR-FUL-001). */
export function parseShippingAddressJson(json: unknown): ParsedShippingSnapshot {
  const r = addressSchema.safeParse(json);
  if (!r.success) {
    return {
      ok: false,
      lines: ["(Address snapshot missing or invalid.)"],
    };
  }
  const a = r.data;
  const lines: string[] = [];
  if (a.name) {
    lines.push(a.name);
  }
  lines.push(a.line1);
  if (a.line2) {
    lines.push(a.line2);
  }
  lines.push(`${a.city}, ${a.state} ${a.postal_code}`);
  lines.push(a.country);
  if (a.phone) {
    lines.push(a.phone);
  }
  return { ok: true, lines, address: a };
}

export interface NotificationLogRow {
  id: string;
  channel: string;
  template: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

export interface OrderRowForTimeline {
  created_at: string;
  updated_at: string;
  payment_status: string;
  owner_order_paid_notified_at: string | null;
  customer_confirmation_sent_at: string | null;
}

/** Stable short label for admin timeline actor trace (E5-S7). */
export function formatInternalNoteActorLabel(actorUserId: string): string {
  const u = actorUserId.trim();
  if (!u) {
    return "Unknown actor";
  }
  const compact = u.replace(/-/g, "");
  const head = compact.slice(0, 8);
  return `…${head}`;
}

export interface TimelineEntry {
  /** ISO timestamp for sorting */
  at: string;
  tieBreak: number;
  title: string;
  detail?: string;
  /** Set for `internal_note` order_events — distinct callout + actor line in admin UI */
  internalNote?: { actorLabel: string };
}

const emailForMailtoSchema = z.string().trim().email();

/** True when `email` is safe for a `mailto:` href (excludes placeholders like "—"). */
export function isPlausibleOrderEmailForMailto(email: string): boolean {
  return emailForMailtoSchema.safeParse(email).success;
}

/** Deterministic ordering: valid timestamps first (ascending), then invalid `at` strings by locale + tieBreak. */
export function compareTimelineEntries(a: TimelineEntry, b: TimelineEntry): number {
  const ta = Date.parse(a.at);
  const tb = Date.parse(b.at);
  const aOk = Number.isFinite(ta);
  const bOk = Number.isFinite(tb);
  if (aOk && bOk) {
    if (ta !== tb) {
      return ta - tb;
    }
    return a.tieBreak - b.tieBreak;
  }
  if (aOk !== bOk) {
    return aOk ? -1 : 1;
  }
  const cmp = a.at.localeCompare(b.at);
  if (cmp !== 0) {
    return cmp;
  }
  return a.tieBreak - b.tieBreak;
}

export function buildOrderTimeline(
  order: OrderRowForTimeline,
  logs: NotificationLogRow[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  entries.push({
    at: order.created_at,
    tieBreak: 0,
    title: "Order placed",
    detail: "Order recorded in system.",
  });

  if (order.payment_status === "paid") {
    entries.push({
      at: order.updated_at,
      tieBreak: 1,
      title: "Payment confirmed",
      detail: "Marked paid in system.",
    });
  }

  if (order.owner_order_paid_notified_at) {
    entries.push({
      at: order.owner_order_paid_notified_at,
      tieBreak: 2,
      title: "Owner notified",
      detail: "Owner transactional email sent for paid order.",
    });
  }

  if (order.customer_confirmation_sent_at) {
    entries.push({
      at: order.customer_confirmation_sent_at,
      tieBreak: 3,
      title: "Customer confirmation sent",
      detail: "Customer order confirmation email sent.",
    });
  }

  logs.forEach((log, i) => {
    entries.push({
      at: log.created_at,
      tieBreak: 100 + i,
      title: `Notification: ${log.template}`,
      detail: `${formatDomainEnumLabel(log.channel)} · ${formatDomainEnumLabel(log.status)}`,
    });
  });

  entries.sort(compareTimelineEntries);

  return entries;
}
