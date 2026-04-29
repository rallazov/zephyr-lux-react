import { ENV } from "./env";

const DEFAULT_RESEND_TIMEOUT_MS = 20_000;

/** Shared Resend transport — server-only. Used by owner + customer transactional mail (4-5, 4-6). */
export async function sendViaResendApi(args: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** Resend de-dupes same key+payload for 24h; recommended for `owner-order-paid/{orderId}` et al. */
  idempotencyKey?: string;
  /** Abort outbound HTTP when exceeded (default 20s so webhooks are not stuck on Resend). */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; messageId?: string } | { ok: false; message: string }> {
  const fetchFn = args.fetchImpl ?? fetch;
  const timeoutMs = args.timeoutMs ?? DEFAULT_RESEND_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ENV.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (args.idempotencyKey) {
    headers["Idempotency-Key"] = args.idempotencyKey;
  }
  try {
    const res = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        from: args.from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const j = (await res.json()) as { message?: string };
        if (typeof j?.message === "string") message = j.message;
      } catch {
        /* ignore */
      }
      return { ok: false, message };
    }
    let messageId: string | undefined;
    try {
      const j = (await res.json()) as { id?: string };
      if (typeof j?.id === "string") messageId = j.id;
    } catch {
      /* ignore */
    }
    return { ok: true, messageId };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? `Resend request timed out after ${timeoutMs}ms`
          : err.message
        : "Resend request failed";
    return { ok: false, message };
  } finally {
    clearTimeout(timer);
  }
}
