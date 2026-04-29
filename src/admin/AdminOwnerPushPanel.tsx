import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  pushManagerSupported,
  subscribeOwnerPush,
  revokeOwnerPushOnServer,
  type OwnerPushStatusResponse,
} from "../pwa/ownerPushClient";

type Props = {
  session: Session | null;
  /** When false, panel explains Sign in first. */
  isAdminContext: boolean;
};

/**
 * Opt-in UI for Story 8-6. Server must enable `ENABLE_OWNER_PUSH_NOTIFICATIONS` + VAPID_*.
 */
export function AdminOwnerPushPanel({ session, isAdminContext }: Props) {
  const [status, setStatus] = useState<OwnerPushStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) {
      setStatus(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-push-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setStatus(null);
        setError("Could not load push status.");
        return;
      }
      const j = (await res.json()) as OwnerPushStatusResponse;
      setStatus(j);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  const browserOk = typeof window !== "undefined" && pushManagerSupported();

  if (!isAdminContext) {
    return null;
  }

  if (!session) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Order push alerts (prototype)</p>
        <p className="mt-1">Sign in to manage browser notifications.</p>
      </section>
    );
  }

  const serverOff = status && !status.serverPushEnabled;
  const canSubscribe =
    browserOk && status?.serverPushEnabled && status.vapidPublicKey && typeof navigator !== "undefined";

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700"
      aria-label="Owner push notifications prototype"
    >
      <p className="font-medium text-slate-800">Order push alerts (prototype)</p>
      <p className="mt-1 text-slate-600">
        Optional browser notifications for new paid orders. Email remains the reliable channel. This feature is
        experimental and varies by browser and OS.
      </p>

      {!browserOk ? (
        <p className="mt-2 text-amber-800">
          This browser does not support push subscriptions (no service worker PushManager).
        </p>
      ) : null}

      {loading && !status ? <p className="mt-2 text-slate-500">Loading…</p> : null}

      {serverOff ? (
        <p className="mt-2 text-slate-600">
          Push is not enabled on the server (set <code className="text-xs">ENABLE_OWNER_PUSH_NOTIFICATIONS</code> and
          VAPID keys in deploy).
        </p>
      ) : null}

      {status?.serverPushEnabled ? (
        <p className="mt-2 text-slate-600">
          Active subscriptions for this account:{" "}
          <span className="font-mono">{status.activeSubscriptionCount ?? 0}</span>
        </p>
      ) : null}

      {message ? <p className="mt-2 text-green-800">{message}</p> : null}
      {error ? <p className="mt-2 text-red-700">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 px-3 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          disabled={!canSubscribe || loading}
          onClick={async () => {
            setMessage(null);
            setError(null);
            if (!session.access_token || !status?.vapidPublicKey) return;
            setLoading(true);
            try {
              const perm = await Notification.requestPermission();
              if (perm !== "granted") {
                setError("Notification permission was not granted.");
                return;
              }
              const sub = await subscribeOwnerPush(status.vapidPublicKey);
              const res = await fetch("/api/admin-push-subscription", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  subscription: sub.toJSON(),
                }),
              });
              if (!res.ok) {
                setError("Could not save push subscription on the server.");
                return;
              }
              setMessage("Push subscription enabled for this device.");
              await load();
            } catch {
              setError("Subscribe failed. Check browser support and HTTPS.");
            } finally {
              setLoading(false);
            }
          }}
        >
          Enable on this device
        </button>
        <button
          type="button"
          className="min-h-11 px-3 rounded-md border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          disabled={!session.access_token || loading || !status?.serverPushEnabled}
          onClick={async () => {
            setMessage(null);
            setError(null);
            setLoading(true);
            try {
              await revokeOwnerPushOnServer(session.access_token);
              const reg = await navigator.serviceWorker.ready;
              const existing = await reg.pushManager.getSubscription();
              if (existing) await existing.unsubscribe();
              setMessage("Push disabled for this account (this browser unsubscribed).");
              await load();
            } catch {
              setError("Could not revoke push subscription.");
            } finally {
              setLoading(false);
            }
          }}
        >
          Disable
        </button>
      </div>
    </section>
  );
}
