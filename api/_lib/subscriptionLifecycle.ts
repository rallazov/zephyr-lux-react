/**
 * Stripe subscription lifecycle ingestion (Story 8-3): map events → `customer_subscriptions`.
 * Does not create orders or touch inventory — subscription snapshot only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  customerSubscriptionStatusSchema,
  subscriptionPlanRowSchema,
  type SubscriptionPlanRow,
  type CustomerSubscriptionStatus,
} from "../../src/domain/commerce/subscription";
import { log } from "./logger";

export type SubscriptionWebhookOutcome =
  | { ledger: "finalize_processed" }
  /** Bad config / unmappable catalog — ledger ignored (Stripe stops retry). */
  | { ledger: "finalize_ignored"; reason?: string };

const PLAN_SELECT = `
  id,
  product_id,
  variant_id,
  slug,
  name,
  description,
  stripe_product_id,
  stripe_price_id,
  interval,
  interval_count,
  price_cents,
  currency,
  trial_period_days,
  status
`.replace(/\s+/g, " ");

function parsePlanRow(raw: unknown): SubscriptionPlanRow | null {
  try {
    return subscriptionPlanRowSchema.parse(raw);
  } catch {
    return null;
  }
}

async function fetchPlanById(
  admin: SupabaseClient,
  planId: string,
): Promise<SubscriptionPlanRow | null> {
  const { data, error } = await admin
    .from("product_subscription_plans")
    .select(PLAN_SELECT)
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return parsePlanRow(data);
}

/**
 * Prefer active Stripe price mapping; fall back to archived rows for historical continuity.
 */
export async function resolvePlanFromStripeHints(args: {
  admin: SupabaseClient;
  metadataPlanId?: string | null;
  stripePriceId?: string | null;
  logCorrelation?: Record<string, string | undefined>;
}): Promise<SubscriptionPlanRow | null> {
  const { admin, metadataPlanId, stripePriceId } = args;

  if (metadataPlanId && /^[0-9a-f-]{36}$/i.test(metadataPlanId.trim())) {
    const byMeta = await fetchPlanById(admin, metadataPlanId.trim());
    if (byMeta && (byMeta.status === "active" || byMeta.status === "archived")) {
      return byMeta;
    }
  }

  const priceId = stripePriceId?.trim();
  if (!priceId?.startsWith("price_")) {
    log.warn(
      { ...args.logCorrelation, metadataPlanId, stripePriceId },
      "subscription plan mapping: missing price id",
    );
    return null;
  }

  const active = await admin
    .from("product_subscription_plans")
    .select(PLAN_SELECT)
    .eq("stripe_price_id", priceId)
    .eq("status", "active")
    .maybeSingle();

  if (!active.error && active.data) {
    const parsed = parsePlanRow(active.data);
    if (parsed) return parsed;
  }

  const archived = await admin
    .from("product_subscription_plans")
    .select(PLAN_SELECT)
    .eq("stripe_price_id", priceId)
    .eq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!archived.error && archived.data) {
    const parsed = parsePlanRow(archived.data);
    if (parsed) return parsed;
  }

  log.warn(
    { ...args.logCorrelation, stripePriceId: priceId },
    "subscription plan mapping: no product_subscription_plans row for price",
  );
  return null;
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): CustomerSubscriptionStatus {
  const literal = customerSubscriptionStatusSchema.safeParse(status);
  if (literal.success) return literal.data;
  if ((status as string) === "ended") return "canceled";
  log.warn({ status }, "unknown Stripe subscription status — defaulting to active");
  return "active";
}

export function firstPriceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item0 = sub.items?.data?.[0];
  const price = item0?.price;
  const id = typeof price === "string" ? price : price?.id;
  return id?.startsWith("price_") ? id : null;
}

type CustomerSubRow = {
  id: string;
  stripe_subscription_id: string;
  updated_from_stripe_event_created: number;
  stripe_latest_invoice_id: string | null;
  stripe_latest_invoice_created: number | null;
  metadata: Record<string, unknown>;
};

async function loadCustomerSubscription(
  admin: SupabaseClient,
  stripeSubscriptionId: string,
): Promise<CustomerSubRow | null> {
  const { data, error } = await admin
    .from("customer_subscriptions")
    .select(
      "id, stripe_subscription_id, updated_from_stripe_event_created, stripe_latest_invoice_id, stripe_latest_invoice_created, metadata",
    )
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CustomerSubRow;
}

function isStaleSnapshot(tIn: number, tPrev: number | null): boolean {
  if (tPrev == null) return false;
  return tIn < tPrev;
}

/** Portal / server: durable Stripe customer id for a subscription id. */
export async function getStripeCustomerIdForSubscription(args: {
  admin: SupabaseClient;
  stripeSubscriptionId: string;
}): Promise<string | null> {
  const { admin, stripeSubscriptionId } = args;
  const { data, error } = await admin
    .from("customer_subscriptions")
    .select("stripe_customer_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (error || !data?.stripe_customer_id) return null;
  const id = data.stripe_customer_id as string;
  return id.startsWith("cus_") ? id : null;
}

async function resolveCustomerEmail(args: {
  stripe: Stripe;
  sub: Stripe.Subscription;
  customerEmailFallback: string | null;
}): Promise<string | null> {
  const direct =
    (args.sub as Stripe.Subscription & { customer_email?: string }).customer_email?.trim() ||
    args.customerEmailFallback?.trim() ||
    null;
  if (direct) return direct;

  const cid =
    typeof args.sub.customer === "string" ? args.sub.customer : args.sub.customer?.id;
  if (!cid?.startsWith("cus_")) return null;

  try {
    const cust = await args.stripe.customers.retrieve(cid);
    if ("deleted" in cust && cust.deleted) return null;
    return cust.email?.trim() ?? null;
  } catch {
    return null;
  }
}

async function upsertSnapshotFromSubscription(args: {
  admin: SupabaseClient;
  stripe: Stripe;
  eventCreated: number;
  plan: SubscriptionPlanRow;
  sub: Stripe.Subscription;
  customerEmailFallback: string | null;
  mergeMetadata?: Record<string, unknown>;
}): Promise<SubscriptionWebhookOutcome> {
  const { admin, stripe, eventCreated, plan, sub, customerEmailFallback, mergeMetadata } = args;

  const stripeSubId = sub.id;
  const priceHint = firstPriceIdFromSubscription(sub);

  let customerEmail = await resolveCustomerEmail({ stripe, sub, customerEmailFallback });
  customerEmail = customerEmail?.trim() || customerEmailFallback?.trim() || null;

  const custId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!custId?.startsWith("cus_")) {
    log.warn({ stripeSubId }, "subscription snapshot: missing stripe customer id");
    return { ledger: "finalize_ignored", reason: "missing_stripe_customer" };
  }
  if (!customerEmail) {
    log.warn({ stripeSubId }, "subscription snapshot: missing customer email");
    return { ledger: "finalize_ignored", reason: "missing_customer_email" };
  }

  const existing = await loadCustomerSubscription(admin, stripeSubId);
  const tPrev = existing?.updated_from_stripe_event_created ?? null;

  if (isStaleSnapshot(eventCreated, tPrev)) {
    log.info(
      {
        stripe_subscription_id: stripeSubId,
        event_created: eventCreated,
        t_prev: tPrev,
      },
      "subscription webhook: stale event for snapshot — finalize ledger without snapshot overwrite",
    );
    return { ledger: "finalize_processed" };
  }

  const status = mapStripeSubscriptionStatus(sub.status);
  const periodStart = Math.floor(Number(sub.current_period_start));
  const periodEnd = Math.floor(Number(sub.current_period_end));

  const canceledAt = sub.canceled_at == null ? null : Math.floor(Number(sub.canceled_at));

  const mergedMeta: Record<string, unknown> = {
    ...(typeof existing?.metadata === "object" && existing.metadata ? existing.metadata : {}),
    ...(mergeMetadata ?? {}),
    stripe_subscription_price_hint: priceHint ?? undefined,
  };

  const row = {
    customer_id: null,
    customer_email: customerEmail,
    stripe_customer_id: custId,
    stripe_subscription_id: stripeSubId,
    stripe_latest_invoice_id: existing?.stripe_latest_invoice_id ?? null,
    stripe_latest_invoice_created: existing?.stripe_latest_invoice_created ?? null,
    subscription_plan_id: plan.id,
    product_id: plan.product_id,
    variant_id: plan.variant_id,
    status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    canceled_at: canceledAt,
    metadata: Object.fromEntries(
      Object.entries(mergedMeta).filter(([, v]) => v !== undefined),
    ) as Record<string, unknown>,
    updated_from_stripe_event_created: eventCreated,
  };

  const { error } = await admin.from("customer_subscriptions").upsert(row, {
    onConflict: "stripe_subscription_id",
  });

  if (error) {
    log.error({ err: error, stripeSubId }, "customer_subscriptions upsert failed");
    throw new Error(error.message);
  }

  return { ledger: "finalize_processed" };
}

async function patchInvoicePointerOnly(args: {
  admin: SupabaseClient;
  invoice: Stripe.Invoice;
}): Promise<SubscriptionWebhookOutcome> {
  const { admin, invoice } = args;
  const subRef = invoice.subscription;
  const subId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!subId?.startsWith("sub_")) {
    log.info({ invoiceId: invoice.id }, "invoice.paid: no subscription on invoice — no pointer update");
    return { ledger: "finalize_processed" };
  }

  const invCreated = Math.floor(Number(invoice.created));

  const existing = await loadCustomerSubscription(admin, subId);
  if (!existing) {
    log.info({ subId, invoiceId: invoice.id }, "invoice pointer: subscription row not yet present — ok");
    return { ledger: "finalize_processed" };
  }

  const prevInvCreated = existing.stripe_latest_invoice_created;
  const shouldSet =
    prevInvCreated == null ||
    invCreated > prevInvCreated ||
    (invoice.id && invoice.id === existing.stripe_latest_invoice_id);

  if (!shouldSet) {
    return { ledger: "finalize_processed" };
  }

  const meta =
    typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
      ? { ...existing.metadata }
      : {};
  if (invoice.billing_reason) {
    meta.last_invoice_billing_reason = invoice.billing_reason;
  }

  const { error } = await admin
    .from("customer_subscriptions")
    .update({
      stripe_latest_invoice_id: invoice.id ?? null,
      stripe_latest_invoice_created: invCreated,
      metadata: meta,
    })
    .eq("stripe_subscription_id", subId);

  if (error) {
    log.error({ err: error, subId }, "invoice pointer update failed");
    throw new Error(error.message);
  }

  return { ledger: "finalize_processed" };
}

async function mergeInvoiceFailureMetadata(args: {
  admin: SupabaseClient;
  invoice: Stripe.Invoice;
  eventCreated: number;
}): Promise<SubscriptionWebhookOutcome> {
  const { admin, invoice, eventCreated } = args;
  const subRef = invoice.subscription;
  const subId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!subId?.startsWith("sub_")) {
    return { ledger: "finalize_processed" };
  }

  const existing = await loadCustomerSubscription(admin, subId);
  if (!existing) {
    return { ledger: "finalize_processed" };
  }

  const meta =
    typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
      ? { ...existing.metadata }
      : {};
  meta.last_invoice_payment_failed_at = eventCreated;
  if (invoice.id) meta.last_failed_invoice_id = invoice.id;

  const { error } = await admin
    .from("customer_subscriptions")
    .update({ metadata: meta })
    .eq("stripe_subscription_id", subId);

  if (error) throw new Error(error.message);
  return { ledger: "finalize_processed" };
}

async function handleCheckoutSessionSubscription(args: {
  admin: SupabaseClient;
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  eventCreated: number;
}): Promise<SubscriptionWebhookOutcome> {
  const { admin, stripe, session, eventCreated } = args;
  if (session.mode !== "subscription") {
    return { ledger: "finalize_ignored", reason: "checkout_not_subscription_mode" };
  }

  const subRef = session.subscription;
  const subId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!subId?.startsWith("sub_")) {
    log.warn({ sessionId: session.id }, "checkout.session.completed missing subscription id");
    return { ledger: "finalize_processed" };
  }

  const sub = await stripe.subscriptions.retrieve(subId);
  const md = session.metadata ?? {};
  const plan = await resolvePlanFromStripeHints({
    admin,
    metadataPlanId: md.plan_id,
    stripePriceId: firstPriceIdFromSubscription(sub),
    logCorrelation: { event: "checkout.session.completed", sessionId: session.id },
  });

  if (!plan) {
    log.warn(
      { sessionId: session.id, subId },
      "checkout.session.completed: could not map plan — ignoring ledger",
    );
    return { ledger: "finalize_ignored", reason: "plan_unresolved" };
  }

  const emailRaw =
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    (typeof session.customer === "object" &&
    session.customer &&
    !session.customer.deleted &&
    "email" in session.customer
      ? session.customer.email?.trim()
      : null) ||
    null;

  return upsertSnapshotFromSubscription({
    admin,
    stripe,
    eventCreated,
    plan,
    sub,
    customerEmailFallback: emailRaw,
    mergeMetadata: { subscription_checkout_session_id: session.id },
  });
}

async function handleSubscriptionObjectEvent(args: {
  admin: SupabaseClient;
  stripe: Stripe;
  object: Stripe.Subscription;
  eventCreated: number;
  eventType: string;
}): Promise<SubscriptionWebhookOutcome> {
  const { admin, stripe, object: sub, eventCreated, eventType } = args;
  const md = sub.metadata ?? {};
  const plan = await resolvePlanFromStripeHints({
    admin,
    metadataPlanId: md.plan_id,
    stripePriceId: firstPriceIdFromSubscription(sub),
    logCorrelation: { event: eventType, subscriptionId: sub.id },
  });

  if (!plan) {
    log.warn({ subId: sub.id, eventType }, "subscription event: plan unresolved — ignoring ledger");
    return { ledger: "finalize_ignored", reason: "plan_unresolved" };
  }

  return upsertSnapshotFromSubscription({
    admin,
    stripe,
    eventCreated,
    plan,
    sub,
    customerEmailFallback: null,
    mergeMetadata: { last_subscription_event: eventType },
  });
}

export async function processSubscriptionStripeEvent(args: {
  admin: SupabaseClient;
  stripe: Stripe;
  event: Stripe.Event;
}): Promise<SubscriptionWebhookOutcome> {
  const { admin, stripe, event } = args;
  const t = event.created;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      return handleCheckoutSessionSubscription({ admin, stripe, session, eventCreated: t });
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      return handleSubscriptionObjectEvent({
        admin,
        stripe,
        object: sub,
        eventCreated: t,
        eventType: event.type,
      });
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      return patchInvoicePointerOnly({ admin, invoice });
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      return mergeInvoiceFailureMetadata({ admin, invoice, eventCreated: t });
    }
    default:
      return { ledger: "finalize_ignored", reason: "not_a_subscription_event" };
  }
}
