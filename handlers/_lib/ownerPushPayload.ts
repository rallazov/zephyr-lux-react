import { formatMoneyCents } from "./ownerOrderNotification";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** Minimal Web Push JSON for the service worker — no PII beyond order number + money preview. */
export function buildOwnerOrderPaidPushPayload(args: {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
}): { title: string; body: string; orderId: string } {
  if (!UUID_RE.test(args.orderId)) {
    throw new Error("buildOwnerOrderPaidPushPayload: invalid order id");
  }
  const total = formatMoneyCents(args.totalCents, args.currency);
  const num = args.orderNumber.trim().slice(0, 64);
  return {
    title: "New paid order",
    body: `${num} · ${total}`,
    orderId: args.orderId,
  };
}

/** Serialize for `web-push` / PushManager; SW parses with `event.data.json()`. */
export function serializeOwnerOrderPaidPushPayload(payload: {
  title: string;
  body: string;
  orderId: string;
}): string {
  const body = payload.body.replace(/[\n\r\t]/g, " ").slice(0, 500);
  return JSON.stringify({
    title: payload.title.slice(0, 120),
    body,
    orderId: payload.orderId,
  });
}
