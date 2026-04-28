import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { allowedFulfillmentTargets } from "../domain/commerce/fulfillmentTransitions";
import {
  fulfillmentStatusSchema,
  paymentStatusSchema,
  type FulfillmentStatus,
} from "../domain/commerce/enums";
import { shipmentRowSchema } from "../domain/commerce/shipment";
import { deriveTrackingUrlFromCarrier } from "../domain/commerce/trackingUrl";
import { useAuth } from "../auth/AuthContext";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";
import {
  buildOrderTimeline,
  compareTimelineEntries,
  formatAdminMoney,
  formatDomainEnumLabel,
  formatInternalNoteActorLabel,
  isPlausibleOrderEmailForMailto,
  type NotificationLogRow,
  isValidOrderIdParam,
  parseShippingAddressJson,
  type TimelineEntry,
} from "./adminOrderDetailFormat";
import { formatOrderDateUtc, humanizeEnum } from "./adminOrderListHelpers";

/** Keep in sync with `INTERNAL_NOTE_MAX_CHARS` in `api/admin-order-internal-note.ts`. */
const INTERNAL_NOTE_MAX_CHARS = 8000;

function formatDetailLocalTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type OrderItemRow = {
  id: string;
  sku: string;
  product_title: string;
  variant_title: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  image_url: string | null;
};

type OrderDetailRow = {
  id: string;
  order_number: string;
  created_at: string;
  updated_at: string;
  customer_email: string;
  customer_name: string | null;
  payment_status: string;
  fulfillment_status: string;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  shipping_address_json: unknown;
  notes: string | null;
  owner_order_paid_notified_at: string | null;
  customer_confirmation_sent_at: string | null;
};

/** Order lite for shipment UX — unlocked when paid + shipped */
type OrderShipmentGate = Pick<
  OrderDetailRow,
  "payment_status" | "fulfillment_status" | "id" | "order_number" | "customer_email"
>;

type OrderEventRow = {
  created_at: string;
  event_type: string;
  message: string;
  actor_type: string;
  metadata: unknown;
};

/** Story 5-5 fulfillment events — compose into timeline after MVP entries (Story 5-3 §AC7 vs 5-4 `order_events`). */
function mergeFulfillmentTimeline(
  base: TimelineEntry[],
  events: OrderEventRow[]
): TimelineEntry[] {
  const extra = events.map((e, i) => {
    if (e.event_type === "internal_note") {
      const meta =
        e.metadata !== null
        && typeof e.metadata === "object"
        && !Array.isArray(e.metadata)
          ? (e.metadata as Record<string, unknown>)
          : {};
      const rawActor = meta.actor_user_id;
      const actorId =
        typeof rawActor === "string"
          ? rawActor
          : typeof rawActor === "number"
            ? String(rawActor)
            : "";
      return {
        at: e.created_at,
        tieBreak: 150 + i,
        title: "Internal note",
        detail: e.message,
        internalNote: { actorLabel: formatInternalNoteActorLabel(actorId) },
      };
    }
    return {
      at: e.created_at,
      tieBreak: 150 + i,
      title: formatDomainEnumLabel(e.event_type),
      detail: e.message,
    };
  });
  const merged = [...base, ...extra];
  merged.sort(compareTimelineEntries);
  return merged;
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function strOrEmpty(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Order ops — Story 5-5 shipment fields (Fulfillment UX from 5-4 uses `fulfillment_status === shipped`). */

export default function AdminOrderDetail() {
  const rawId = useParams<{ id: string }>().id;
  const orderId = isValidOrderIdParam(rawId) ? rawId : null;
  const { session } = useAuth();
  const sb = getSupabaseBrowserClient();

  const [order, setOrder] = useState<OrderDetailRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLogRow[]>([]);
  const [fulfillmentEvents, setFulfillmentEvents] = useState<OrderEventRow[]>([]);

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [cargoErr, setCargoErr] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);

  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  const [carrierErr, setCarrierErr] = useState<string | undefined>();
  const [numberErr, setNumberErr] = useState<string | undefined>();
  const [urlErr, setUrlErr] = useState<string | undefined>();
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fulfillmentErr, setFulfillmentErr] = useState<string | null>(null);
  const [fulfillmentSaving, setFulfillmentSaving] = useState(false);

  const [newInternalNote, setNewInternalNote] = useState("");
  const [internalNoteErr, setInternalNoteErr] = useState<string | null>(null);
  const [internalNoteSaving, setInternalNoteSaving] = useState(false);
  const [internalNoteOk, setInternalNoteOk] = useState(false);

  /** Minimal row for shipment form + gate copy */
  const orderGate: OrderShipmentGate | null = order;

  const load = useCallback(async () => {
    if (!sb || !orderId) return;
    setLoadErr(null);
    setCargoErr(null);
    const { data: oRaw, error: oErr } = await sb
      .from("orders")
      .select(
        [
          "id",
          "order_number",
          "created_at",
          "updated_at",
          "customer_email",
          "customer_name",
          "payment_status",
          "fulfillment_status",
          "subtotal_cents",
          "shipping_cents",
          "tax_cents",
          "discount_cents",
          "total_cents",
          "currency",
          "shipping_address_json",
          "notes",
          "owner_order_paid_notified_at",
          "customer_confirmation_sent_at",
        ].join(", ")
      )
      .eq("id", orderId)
      .maybeSingle();

    if (oErr) {
      setLoadErr(oErr.message);
      setOrder(null);
      setItems([]);
      setNotificationLogs([]);
      setFulfillmentEvents([]);
      return;
    }

    const oRow = oRaw as Record<string, unknown> | null;
    if (!oRow?.id || typeof oRow.id !== "string") {
      setLoadErr("Order not found");
      setOrder(null);
      setItems([]);
      setNotificationLogs([]);
      setFulfillmentEvents([]);
      return;
    }

    const next: OrderDetailRow = {
      id: oRow.id as string,
      order_number: strOrEmpty(oRow.order_number) || "—",
      created_at: strOrEmpty(oRow.created_at),
      updated_at: strOrEmpty(oRow.updated_at),
      customer_email: strOrEmpty(oRow.customer_email) || "—",
      customer_name: typeof oRow.customer_name === "string" ? oRow.customer_name : null,
      payment_status:
        typeof oRow.payment_status === "string" ? oRow.payment_status : "pending_payment",
      fulfillment_status:
        typeof oRow.fulfillment_status === "string" ? oRow.fulfillment_status : "processing",
      subtotal_cents: numOr(oRow.subtotal_cents, 0),
      shipping_cents: numOr(oRow.shipping_cents, 0),
      tax_cents: numOr(oRow.tax_cents, 0),
      discount_cents: numOr(oRow.discount_cents, 0),
      total_cents: numOr(oRow.total_cents, 0),
      currency: typeof oRow.currency === "string" ? oRow.currency : "usd",
      shipping_address_json: oRow.shipping_address_json,
      notes: oRow.notes == null ? null : String(oRow.notes),
      owner_order_paid_notified_at:
        typeof oRow.owner_order_paid_notified_at === "string"
          ? oRow.owner_order_paid_notified_at
          : null,
      customer_confirmation_sent_at:
        typeof oRow.customer_confirmation_sent_at === "string"
          ? oRow.customer_confirmation_sent_at
          : null,
    };
    setOrder(next);

    const [{ data: iRaw, error: iErr }, { data: lRaw, error: lErr }, { error: evErr, data: evRaw }, { data: sRaw, error: sErr }] =
      await Promise.all([
        sb.from("order_items").select("*").eq("order_id", orderId).order("created_at", {
          ascending: true,
        }),
        sb.from("notification_logs").select("id, channel, template, status, created_at, sent_at").eq("order_id", orderId).order("created_at", {
          ascending: true,
        }),
        sb
          .from("order_events")
          .select("created_at, event_type, message, actor_type, metadata")
          .eq("order_id", orderId)
          .order("created_at", {
            ascending: true,
          }),
        sb.from("shipments").select("*").eq("order_id", orderId).maybeSingle(),
      ]);

    const warnParts: string[] = [];

    if (iErr) {
      warnParts.push(iErr.message);
      setItems([]);
    } else if (Array.isArray(iRaw)) {
      const parsed: OrderItemRow[] = [];
      for (const r of iRaw as Record<string, unknown>[]) {
        if (typeof r.id !== "string" || typeof r.sku !== "string") {
          continue;
        }
        parsed.push({
          id: r.id,
          sku: r.sku,
          product_title: typeof r.product_title === "string" ? r.product_title : "—",
          variant_title: typeof r.variant_title === "string" ? r.variant_title : null,
          size: typeof r.size === "string" ? r.size : null,
          color: typeof r.color === "string" ? r.color : null,
          quantity: numOr(r.quantity, 1),
          unit_price_cents: numOr(r.unit_price_cents, 0),
          total_cents: numOr(r.total_cents, 0),
          image_url: typeof r.image_url === "string" ? r.image_url : null,
        });
      }
      setItems(parsed);
    } else {
      setItems([]);
    }

    if (Array.isArray(lRaw)) {
      const logs: NotificationLogRow[] = [];
      for (const r of lRaw as Record<string, unknown>[]) {
        if (typeof r.id !== "string" || typeof r.created_at !== "string") {
          continue;
        }
        logs.push({
          id: r.id,
          channel: typeof r.channel === "string" ? r.channel : "email",
          template: typeof r.template === "string" ? r.template : "",
          status: typeof r.status === "string" ? r.status : "queued",
          created_at: r.created_at,
          sent_at: typeof r.sent_at === "string" ? r.sent_at : null,
        });
      }
      setNotificationLogs(logs);
    } else {
      setNotificationLogs([]);
    }

    if (!evErr && Array.isArray(evRaw)) {
      const evs: OrderEventRow[] = [];
      for (const r of evRaw as Record<string, unknown>[]) {
        if (typeof r.created_at !== "string") {
          continue;
        }
        evs.push({
          created_at: r.created_at,
          event_type: typeof r.event_type === "string" ? r.event_type : "event",
          message: typeof r.message === "string" ? r.message : "",
          actor_type: typeof r.actor_type === "string" ? r.actor_type : "system",
          metadata: r.metadata,
        });
      }
      setFulfillmentEvents(evs);
    } else {
      setFulfillmentEvents([]);
      if (evErr) {
        warnParts.push(evErr.message);
      }
    }

    if (lErr) {
      warnParts.push(lErr.message);
    }

    if (sErr) {
      warnParts.push(sErr.message);
      setCarrier("");
      setTrackingNumber("");
      setTrackingUrl("");
    } else {
      const parsedShip = shipmentRowSchema.safeParse(sRaw);
      if (parsedShip.success) {
        setCarrier(parsedShip.data.carrier ?? "");
        setTrackingNumber(parsedShip.data.tracking_number ?? "");
        setTrackingUrl(parsedShip.data.tracking_url ?? "");
      } else {
        setCarrier("");
        setTrackingNumber("");
        setTrackingUrl("");
      }
    }

    setCargoErr(warnParts.length > 0 ? warnParts.join(" · ") : null);
  }, [orderId, sb]);

  useEffect(() => {
    void load();
  }, [load]);

  const shippingSnapshot = order ? parseShippingAddressJson(order.shipping_address_json) : null;
  const addressBlock = shippingSnapshot ? shippingSnapshot.lines.join("\n") : "";

  async function copyAddress() {
    if (!addressBlock) return;
    try {
      await navigator.clipboard.writeText(addressBlock);
      setAddressCopied(true);
      window.setTimeout(() => {
        setAddressCopied(false);
      }, 2000);
    } catch {
      /* ignore */
    }
  }

  const timelineEntries = useMemo(() => {
    if (!order) {
      return [];
    }
    const base = buildOrderTimeline(
      {
        created_at: order.created_at,
        updated_at: order.updated_at,
        payment_status: order.payment_status,
        owner_order_paid_notified_at: order.owner_order_paid_notified_at,
        customer_confirmation_sent_at: order.customer_confirmation_sent_at,
      },
      notificationLogs
    );
    return mergeFulfillmentTimeline(base, fulfillmentEvents);
  }, [order, notificationLogs, fulfillmentEvents]);

  const fulfillmentActionTargets = useMemo(() => {
    if (!order) return [];
    const pay = paymentStatusSchema.safeParse(order.payment_status);
    const ful = fulfillmentStatusSchema.safeParse(order.fulfillment_status);
    if (!pay.success || !ful.success) return [];
    return allowedFulfillmentTargets(ful.data, pay.data);
  }, [order]);

  const applyFulfillment = useCallback(
    async (to: FulfillmentStatus) => {
      if (!session?.access_token || !orderId) return;
      setFulfillmentErr(null);
      setFulfillmentSaving(true);
      try {
        const res = await fetch(
          `/api/admin-order-fulfillment?order_id=${encodeURIComponent(orderId)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ fulfillment_status: to }),
          },
        );
        if (res.status === 204) {
          await load();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setFulfillmentErr(
            typeof body.error === "string" ? body.error : `Update failed (${res.status}).`,
          );
          return;
        }
        await load();
      } catch {
        setFulfillmentErr("Could not reach the server.");
      } finally {
        setFulfillmentSaving(false);
      }
    },
    [load, orderId, session?.access_token],
  );

  const submitInternalNote = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setInternalNoteErr(null);
      setInternalNoteOk(false);
      const text = newInternalNote.trim();
      if (!text) {
        setInternalNoteErr("Enter a note before saving.");
        return;
      }
      if (text.length > INTERNAL_NOTE_MAX_CHARS) {
        setInternalNoteErr(`Note is too long (max ${INTERNAL_NOTE_MAX_CHARS} characters).`);
        return;
      }
      if (!session?.access_token || !orderId) {
        setInternalNoteErr("Session or order missing.");
        return;
      }
      setInternalNoteSaving(true);
      try {
        const res = await fetch("/api/admin-order-internal-note", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ order_id: orderId, message: newInternalNote }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setInternalNoteErr(
            typeof body.error === "string" ? body.error : `Save failed (${res.status}).`,
          );
          return;
        }
        setNewInternalNote("");
        setInternalNoteOk(true);
        window.setTimeout(() => {
          setInternalNoteOk(false);
        }, 2500);
        await load();
      } catch {
        setInternalNoteErr("Could not reach the server.");
      } finally {
        setInternalNoteSaving(false);
      }
    },
    [load, newInternalNote, orderId, session?.access_token],
  );

  const canEditShipment = Boolean(
    orderGate &&
      orderGate.payment_status === "paid" &&
      orderGate.fulfillment_status === "shipped"
  );

  const suggestedUrlPreview = useMemo(() => {
    const u = deriveTrackingUrlFromCarrier(carrier, trackingNumber);
    return u;
  }, [carrier, trackingNumber]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitErr(null);
    setCarrierErr(undefined);
    setNumberErr(undefined);
    setUrlErr(undefined);

    if (!session?.access_token || !canEditShipment || !orderId) {
      setSubmitErr("Session or prerequisites missing.");
      return;
    }

    if (carrier.trim().length > 160) {
      setCarrierErr("Carrier is too long (max 160).");
      return;
    }

    if (trackingNumber.trim().length > 200) {
      setNumberErr("Tracking number is too long (max 200).");
      return;
    }

    if (trackingUrl.trim()) {
      try {
        const u = new URL(trackingUrl.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          setUrlErr("Use http(s) URLs only.");
          return;
        }
      } catch {
        setUrlErr("Tracking URL must be a valid absolute URL.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        order_id: orderId,
        carrier: carrier.trim() || null,
        tracking_number: trackingNumber.trim() || null,
        tracking_url: trackingUrl.trim() ? trackingUrl.trim() : null,
      };
      const res = await fetch("/api/admin-shipment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        issues?: { path?: (string | number)[]; message: string }[];
      };

      if (!res.ok) {
        const issues = Array.isArray(body.issues) ? body.issues : [];
        let anyFieldMapped = false;
        for (const iss of issues) {
          if (typeof iss.message !== "string") continue;
          const pathStr = [...(iss.path ?? [])].filter((p): p is string => typeof p === "string");
          const leaf = pathStr[pathStr.length - 1] ?? pathStr[0];
          if (!leaf || !["carrier", "tracking_number", "tracking_url", "order_id"].includes(leaf)) {
            continue;
          }
          anyFieldMapped = true;
          switch (leaf) {
            case "carrier":
              setCarrierErr(iss.message);
              break;
            case "tracking_number":
              setNumberErr(iss.message);
              break;
            case "tracking_url":
              setUrlErr(iss.message);
              break;
            case "order_id":
              setSubmitErr(iss.message);
              break;
            default:
              break;
          }
        }
        if (!issues.length || !anyFieldMapped) {
          setSubmitErr(
            typeof body.error === "string" && body.error.trim() !== ""
              ? body.error
              : `Save failed (${res.status}).`,
          );
        }
      } else {
        await load();
      }
    } catch {
      setSubmitErr("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (!orderId) {
    return (
      <p role="alert" data-testid="admin-order-detail-invalid-param">
        Invalid order link — use an order UUID from the list or email.
      </p>
    );
  }

  if (!sb) {
    return (
      <p role="alert" data-testid="admin-order-detail-supabase-off">
        Supabase browser client is missing.
      </p>
    );
  }

  if (loadErr && !order) {
    return (
      <div data-testid="admin-order-detail-error">
        <p role="alert" className="text-red-800">
          {loadErr}
        </p>
        <Link className="text-blue-700 underline mt-4 inline-block" to="/admin/orders">
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="admin-order-detail">
      <nav className="mb-6 text-sm" aria-label="Breadcrumb">
        <Link className="text-blue-700 hover:underline" to="/admin/orders">
          Orders
        </Link>
        <span className="mx-2 text-slate-400" aria-hidden>
          /
        </span>
        <span>{order?.order_number ?? ""}</span>
      </nav>

      {order ? (
        <>
          <header className="mb-8">
            <h1 className="text-xl font-semibold">{order.order_number}</h1>
            <p className="text-slate-600 mt-2">
              Placed{" "}
              <time dateTime={order.created_at}>{formatDetailLocalTs(order.created_at)}</time>
              {" · "}
              <span className="text-slate-500">({formatOrderDateUtc(order.created_at)})</span>
            </p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-slate-500">Payment</dt>
                <dd className="font-medium capitalize">{humanizeEnum(order.payment_status)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Fulfillment</dt>
                <dd className="font-medium capitalize">{humanizeEnum(order.fulfillment_status)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Total</dt>
                <dd className="font-medium">
                  {formatAdminMoney(order.total_cents, order.currency)}{" "}
                  <span className="text-slate-500 font-normal">
                    ({items.length} line {items.length === 1 ? "item" : "items"})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Subtotal</dt>
                <dd>{formatAdminMoney(order.subtotal_cents, order.currency)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Shipping / tax</dt>
                <dd>
                  {formatAdminMoney(order.shipping_cents, order.currency)} /{" "}
                  {formatAdminMoney(order.tax_cents, order.currency)}
                </dd>
              </div>
              {order.discount_cents > 0 ? (
                <div>
                  <dt className="text-slate-500">Discount</dt>
                  <dd>−{formatAdminMoney(order.discount_cents, order.currency)}</dd>
                </div>
              ) : null}
            </dl>
          </header>

          <section className="mb-10" aria-labelledby="fulfillment-actions-heading">
            <h2 id="fulfillment-actions-heading" className="text-lg font-semibold mb-3">
              Fulfillment actions
            </h2>
            {!session?.access_token ? (
              <p className="text-slate-600 text-sm">Sign in to update fulfillment status.</p>
            ) : fulfillmentActionTargets.length === 0 ? (
              <p className="text-slate-600 text-sm">No further fulfillment steps for this order.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
                {fulfillmentActionTargets.map((target) => (
                  <li key={target}>
                    <button
                      type="button"
                      disabled={fulfillmentSaving}
                      onClick={() => void applyFulfillment(target)}
                      className="min-h-[44px] min-w-[44px] px-4 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {target === "canceled" ? "Cancel fulfillment" : `Mark as ${humanizeEnum(target)}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {fulfillmentErr ? (
              <p role="alert" className="text-red-800 text-sm mt-3">
                {fulfillmentErr}
              </p>
            ) : null}
          </section>

          <section className="mb-10" aria-labelledby="customer-heading">
            <h2 id="customer-heading" className="text-lg font-semibold mb-3">
              Customer &amp; contact
            </h2>
            <p className="text-slate-800">
              <span className="text-slate-500">Email: </span>
              {isPlausibleOrderEmailForMailto(order.customer_email) ? (
                <a href={`mailto:${order.customer_email}`} className="text-blue-800 underline">
                  {order.customer_email}
                </a>
              ) : (
                <span>{order.customer_email}</span>
              )}
            </p>
            {order.customer_name ? (
              <p className="text-slate-800 mt-1">
                <span className="text-slate-500">Name: </span>
                {order.customer_name}
              </p>
            ) : (
              <p className="text-slate-500 mt-1">Name not provided.</p>
            )}
          </section>

          <section className="mb-10" aria-labelledby="shipping-heading">
            <h2 id="shipping-heading" className="text-lg font-semibold mb-3">
              Shipping address
            </h2>
            <div className="flex flex-wrap items-start gap-3">
              <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm flex-1 min-w-[12rem] max-w-xl">
                {shippingSnapshot?.lines.join("\n") ??
                  "(No address snapshot.)"}
              </pre>
              <button
                type="button"
                disabled={!addressBlock}
                onClick={() => void copyAddress()}
                className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium ${
                  addressBlock
                    ? "border-slate-300 bg-white hover:bg-slate-50"
                    : "border-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {addressCopied ? "Copied" : "Copy address"}
              </button>
            </div>
          </section>

          <section className="mb-10" aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="text-lg font-semibold mb-3">
              Internal notes
            </h2>
            {order.notes?.trim() ? (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-600 mb-2">Legacy (single-field)</h3>
                <p className="whitespace-pre-wrap text-slate-800 border border-slate-200 rounded-md p-4 bg-amber-50/40">
                  {order.notes}
                </p>
              </div>
            ) : null}

            <div className="mb-4">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Add timeline note</h3>
              {!session?.access_token ? (
                <p className="text-slate-600 text-sm">Sign in to add internal notes.</p>
              ) : (
                <form noValidate className="max-w-2xl space-y-3" onSubmit={(ev) => void submitInternalNote(ev)}>
                  <label className="block text-sm font-medium text-slate-800" htmlFor="new-internal-note">
                    Note <span className="text-slate-500 font-normal">(plain text, max {INTERNAL_NOTE_MAX_CHARS})</span>
                  </label>
                  <textarea
                    id="new-internal-note"
                    name="newInternalNote"
                    rows={4}
                    value={newInternalNote}
                    onChange={(ev) => {
                      setNewInternalNote(ev.target.value);
                    }}
                    disabled={internalNoteSaving}
                    className="w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-3 text-base shadow-sm bg-white focus:border-blue-700 disabled:bg-slate-100 whitespace-pre-wrap"
                    placeholder="Visible only to admins; appears on the order timeline."
                  />
                  {internalNoteErr ? (
                    <p role="alert" className="text-red-800 text-sm">
                      {internalNoteErr}
                    </p>
                  ) : null}
                  {internalNoteOk ? (
                    <p className="text-green-800 text-sm" role="status">
                      Note saved.
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={internalNoteSaving}
                    className="min-h-[44px] px-5 rounded-lg border border-slate-300 bg-blue-900 text-white font-medium hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {internalNoteSaving ? "Saving…" : "Save note to timeline"}
                  </button>
                </form>
              )}
            </div>
            {!order.notes?.trim() ? (
              <p className="text-slate-500 text-sm">No legacy single-field notes for this order.</p>
            ) : null}
          </section>

          <section className="mb-10" aria-labelledby="line-items-heading">
            <h2 id="line-items-heading" className="text-lg font-semibold mb-4">
              Line items
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium text-slate-700">SKU</th>
                    <th className="px-3 py-2 font-medium text-slate-700">Product</th>
                    <th className="px-3 py-2 font-medium text-slate-700">Qty</th>
                    <th className="px-3 py-2 font-medium text-slate-700 text-right">Unit</th>
                    <th className="px-3 py-2 font-medium text-slate-700 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((li) => (
                    <tr key={li.id} className="border-t border-slate-100">
                      <td className="px-3 py-3 align-top font-mono text-xs sm:text-sm">{li.sku}</td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex gap-3">
                          {li.image_url ? (
                            <img
                              src={li.image_url}
                              alt={
                                [li.product_title, li.variant_title].filter(Boolean).join(" — ") ||
                                "Product thumbnail"
                              }
                              className="h-12 w-12 rounded object-cover border border-slate-200 shrink-0"
                            />
                          ) : null}
                          <div>
                            <div className="font-medium text-slate-900">{li.product_title}</div>
                            {(li.variant_title || li.size || li.color) ? (
                              <div className="text-slate-600 text-xs mt-0.5">
                                {[li.variant_title, li.size ? `Size ${li.size}` : null, li.color]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">{li.quantity}</td>
                      <td className="px-3 py-3 align-top text-right font-mono text-xs">
                        {formatAdminMoney(li.unit_price_cents, order.currency)}
                      </td>
                      <td className="px-3 py-3 align-top text-right font-mono font-medium">
                        {formatAdminMoney(li.total_cents, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length === 0 ? (
              <p className="text-slate-500 text-sm mt-2">No line items returned.</p>
            ) : null}
          </section>

          <section className="mb-10" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="text-lg font-semibold mb-4">
              Order timeline
            </h2>
            <ol className="list-decimal space-y-3 pl-6 text-slate-800">
              {timelineEntries.map((e, idx) => (
                <li key={`${e.at}-${e.tieBreak}-${idx}`}>
                  {e.internalNote ? (
                    <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 -ml-2 list-none">
                      <div className="flex flex-wrap items-baseline gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-violet-900 bg-violet-100/80 px-1.5 py-0.5 rounded">
                          Internal note
                        </span>
                        <time className="text-slate-500 text-sm" dateTime={e.at}>
                          {formatDetailLocalTs(e.at)}
                        </time>
                      </div>
                      <div className="text-xs text-slate-500 mb-1">
                        Actor: <span className="font-mono">{e.internalNote.actorLabel}</span>
                      </div>
                      {e.detail ? (
                        <div className="text-slate-800 text-sm whitespace-pre-wrap">{e.detail}</div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <time className="text-slate-500 text-sm" dateTime={e.at}>
                        {formatDetailLocalTs(e.at)}
                      </time>
                      <div className="font-medium">{e.title}</div>
                      {e.detail ? (
                        <div className="text-slate-600 text-sm">{e.detail}</div>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <p className="text-slate-600">Loading…</p>
      )}

      <section aria-labelledby="shipment-tracking-heading" className="border-t border-slate-200 pt-8 mt-8">
        <h2 id="shipment-tracking-heading" className="text-lg font-semibold mb-4">
          Shipment &amp; tracking
        </h2>

        <form noValidate className="max-w-xl space-y-6" onSubmit={(e) => void submit(e)}>
          <div>
            <label
              className="block text-sm font-medium text-slate-800 mb-1"
              htmlFor="carrier-input"
            >
              Carrier <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              id="carrier-input"
              name="carrier"
              type="text"
              autoComplete="off"
              aria-invalid={Boolean(carrierErr)}
              disabled={!canEditShipment || saving}
              className={`w-full rounded-md border px-3 py-3 text-base shadow-sm bg-white disabled:bg-slate-100 ${
                carrierErr ? "border-red-600 outline-red-700" : "border-slate-300 focus:border-blue-700"
              }`}
              value={carrier}
              onChange={(ev) => {
                setCarrier(ev.target.value);
              }}
              placeholder="e.g. USPS, UPS, FedEx"
            />
            {carrierErr ? (
              <p className="text-red-700 text-sm mt-1" role="alert">
                {carrierErr}
              </p>
            ) : null}
          </div>

          <div>
            <label
              className="block text-sm font-medium text-slate-800 mb-1"
              htmlFor="tracking-number-input"
            >
              Tracking number <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              id="tracking-number-input"
              name="trackingNumber"
              inputMode="text"
              aria-invalid={Boolean(numberErr)}
              disabled={!canEditShipment || saving}
              className={`w-full rounded-md border px-3 py-3 text-base shadow-sm bg-white disabled:bg-slate-100 font-mono ${
                numberErr ? "border-red-600 outline-red-700" : "border-slate-300 focus:border-blue-700"
              }`}
              value={trackingNumber}
              onChange={(ev) => {
                setTrackingNumber(ev.target.value);
              }}
            />
            {numberErr ? (
              <p className="text-red-700 text-sm mt-1" role="alert">
                {numberErr}
              </p>
            ) : null}
          </div>

          <div>
            <label
              className="block text-sm font-medium text-slate-800 mb-1"
              htmlFor="tracking-url-input"
            >
              Tracking URL <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              id="tracking-url-input"
              name="trackingUrl"
              type="url"
              inputMode="url"
              autoComplete="off"
              aria-invalid={Boolean(urlErr)}
              disabled={!canEditShipment || saving}
              className={`w-full rounded-md border px-3 py-3 text-base shadow-sm bg-white disabled:bg-slate-100 break-all ${
                urlErr ? "border-red-600 outline-red-700" : "border-slate-300 focus:border-blue-700"
              }`}
              value={trackingUrl}
              onChange={(ev) => {
                setTrackingUrl(ev.target.value);
              }}
              placeholder="https://…"
            />
            {!trackingUrl.trim() && suggestedUrlPreview ? (
              <p className="text-xs text-slate-500 mt-2" role="status">
                We’ll derive the carrier link from USPS/UPS/FedEx when saved:{" "}
                <span className="break-all font-mono text-slate-600">{suggestedUrlPreview}</span>
              </p>
            ) : null}
            {urlErr ? (
              <p className="text-red-700 text-sm mt-1" role="alert">
                {urlErr}
              </p>
            ) : null}
          </div>

          {submitErr ? (
            <p role="alert" className="text-red-800">
              {submitErr}
            </p>
          ) : null}
          <div className="space-y-2">
            <button
              type="submit"
              className={`min-h-[48px] px-6 rounded-lg font-semibold text-white shadow ${
                canEditShipment ? "bg-blue-900 hover:bg-blue-800" : "bg-slate-400 cursor-not-allowed"
              }`}
              disabled={!canEditShipment || saving}
            >
              {saving ? "Saving…" : "Save shipment"}
            </button>
            {orderGate?.payment_status !== "paid" ? (
              <p className="text-amber-800 text-sm" role="status">
                Shipments unlock after payment is Paid.
              </p>
            ) : null}
            {orderGate?.fulfillment_status !== "shipped" ? (
              <p className="text-amber-800 text-sm" role="status">
                Carrier and tracking editing unlocks when Fulfillment is Shipped (Story 5-4 transitions).
              </p>
            ) : null}
          </div>
        </form>
      </section>
      {(loadErr && order) || cargoErr ? (
        <p className="text-amber-800 text-sm mt-6" role="status">
          Partial load notice: {[loadErr, cargoErr].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
