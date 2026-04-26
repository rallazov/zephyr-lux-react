import { useCallback, useEffect, useMemo, useState } from "react";
import { toCheckoutLines } from "../cart/checkoutLines";
import type { StorefrontCartLine } from "../cart/cartLine";
import { isServerCartQuote, type ServerCartQuote } from "../lib/cartQuoteTypes";

/**
 * Fetches server catalog quote for current cart. Skips when there are no checkout SKUs.
 */
export function useCartQuote(cartItems: StorefrontCartLine[]) {
  const drafts = useMemo(() => toCheckoutLines(cartItems), [cartItems]);

  const [quote, setQuote] = useState<ServerCartQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const refetch = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (drafts.length === 0) {
      setQuote(null);
      setError(null);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch("/api/cart-quote", {
            method: "POST",
            signal: ctrl.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: drafts }),
          });
          const raw = await res.text();
          let json: unknown;
          try {
            json = raw ? (JSON.parse(raw) as unknown) : {};
          } catch {
            setQuote(null);
            setError("Could not get price quote from the server.");
            return;
          }
          if (!res.ok) {
            const errBody = json as { error?: string; code?: string };
            const msg =
              typeof errBody.error === "string"
                ? errBody.error
                : "Could not get price quote from the server.";
            setQuote(null);
            setError(msg);
            return;
          }
          if (!isServerCartQuote(json)) {
            setQuote(null);
            setError("We received an invalid price response. Please try again.");
            return;
          }
          setQuote(json);
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          setQuote(null);
          setError("We could not reach the server. Check your network and try again.");
        } finally {
          if (!ctrl.signal.aborted) setLoading(false);
        }
      })();
    }, 200);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [drafts, retryToken]);

  return { quote, loading, error, refetch, drafts } as const;
}
