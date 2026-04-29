import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { ENV, isOwnerPushNotificationsConfigured, isSupabaseOrderPersistenceConfigured } from "./_lib/env";
import { log } from "./_lib/logger";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import { getBearerAuthorizationHeader, verifyAdminJwt } from "./_lib/verifyAdminJwt";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ENV.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

const subscribeBodySchema = z.object({
  subscription: z.object({
    endpoint: z.string().min(1),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

const revokeBodySchema = z.object({
  action: z.literal("revoke"),
  endpoint: z.string().min(1).optional(),
});

const postBodySchema = z.union([subscribeBodySchema, revokeBodySchema]);

/**
 * Admin-only GET/POST for owner push prototype (Story 8-6).
 * POST body: `{ subscription: PushSubscriptionJSON }` or `{ action: "revoke", endpoint?: string }`.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    log.warn("admin-push-subscription: missing Supabase URL or anon key for JWT verify");
    return res.status(503).json({ error: "Push API not configured" });
  }

  if (!isSupabaseOrderPersistenceConfigured()) {
    return res.status(503).json({ error: "Push API not configured" });
  }

  const adminClient = getSupabaseAdmin();
  if (!adminClient) {
    return res.status(503).json({ error: "Push API not available" });
  }

  const token = getBearerAuthorizationHeader(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const verified = await verifyAdminJwt(token);
  if (!verified) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const serverConfigured = isOwnerPushNotificationsConfigured();

  if (req.method === "GET") {
    const { count, error } = await adminClient
      .from("owner_push_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", verified.userId)
      .eq("status", "active");
    if (error) {
      log.warn({ err: error, userId: verified.userId }, "admin-push-subscription: count failed");
      return res.status(500).json({ error: "Could not read subscription status" });
    }
    return res.status(200).json({
      serverPushEnabled: serverConfigured,
      vapidPublicKey: serverConfigured ? ENV.VAPID_PUBLIC_KEY : null,
      activeSubscriptionCount: count ?? 0,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!serverConfigured) {
    return res.status(503).json({ error: "Owner push is not enabled on the server" });
  }

  const parsed = postBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const now = new Date().toISOString();
  const uaHeader = req.headers["user-agent"];
  const userAgent = typeof uaHeader === "string" ? uaHeader.slice(0, 2000) : null;

  try {
    if ("action" in parsed.data) {
      let q = adminClient
        .from("owner_push_subscriptions")
        .update({ status: "revoked", updated_at: now })
        .eq("user_id", verified.userId);
      if (parsed.data.endpoint) {
        q = q.eq("endpoint", parsed.data.endpoint);
      }
      const { error } = await q.eq("status", "active");
      if (error) {
        log.warn({ err: error, userId: verified.userId }, "admin-push-subscription: revoke failed");
        return res.status(500).json({ error: "Could not revoke subscription" });
      }
      return res.status(200).json({ ok: true });
    }

    const sub = parsed.data.subscription;
    const row = {
      user_id: verified.userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent,
      status: "active" as const,
      last_seen_at: now,
      updated_at: now,
    };

    const { error } = await adminClient.from("owner_push_subscriptions").upsert(row, {
      onConflict: "endpoint",
    });

    if (error) {
      log.warn({ err: error, userId: verified.userId }, "admin-push-subscription: upsert failed");
      return res.status(500).json({ error: "Could not save subscription" });
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    log.error({ err, userId: verified.userId }, "admin-push-subscription failed");
    return res.status(500).json({ error: "Push subscription request failed" });
  }
}
