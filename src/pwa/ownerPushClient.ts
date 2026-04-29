/** Browser push helpers for Story 8-6 (admin owner alerts). */

import { apiUrl } from "../lib/apiBase";
export type OwnerPushStatusResponse = {
  serverPushEnabled: boolean;
  vapidPublicKey: string | null;
  activeSubscriptionCount: number;
};

export function pushManagerSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeOwnerPush(vapidPublicKey: string): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready;
  const key = urlBase64ToUint8Array(vapidPublicKey);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  return sub;
}

export async function revokeOwnerPushOnServer(accessToken: string): Promise<void> {
  const res = await fetch(apiUrl("/api/admin-push-subscription"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action: "revoke" }),
  });
  if (!res.ok) {
    throw new Error("revoke failed");
  }
}
