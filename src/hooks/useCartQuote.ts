import { useCallback, useEffect, useMemo, useState } from "react";
import { toCheckoutLines } from "../cart/checkoutLines";
import type { StorefrontCartLine } from "../cart/cartLine";
import { isServerCartQuote, type ServerCartQuote } from "../lib/cartQuoteTypes";
import { apiUrl } from "../lib/apiBase";

export type UseCartQuoteOptions = {
  /**
   * Suppresses the network call. Use when the cart already has a structural problem
   * (e.g. unknown SKU after a catalog migration) so the server doesn't 400 redundantly
   * — the cart-page validation banner already tells the user what to fix.
   */
  skip?: boolean;
};

/**
 * Fetches server catalog quote for current cart. Skips when there are no checkout SKUs
 * or when the caller marks the cart as known-bad via `options.skip`.
 */
export function useCartQuote(
  cartItems: StorefrontCartLine[],
  options: UseCartQuoteOptions = {},
) {
  const { skip = false } = options;
  const drafts = useMemo(() => toCheckoutLines(cartItems), [cartItems]);

  const [quote, setQuote] = useState<ServerCartQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const refetch = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (skip || drafts.length === 0) {
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
          const res = await fetch(apiUrl("/api/cart-quote"), {
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
            const devHint =
              import.meta.env.DEV &&
              (res.status === 502 || res.status === 503 || res.status === 504)
                ? " Start the API (`npm run api:dev`) or run both apps with `npm run dev:full`."
                : "";
            setError(
              `Price quote response was not valid JSON (HTTP ${res.status}).${devHint}`,
            );
            return;
          }
          if (!res.ok) {
            const errBody = json as { error?: string; code?: string };
            const fromServer =
              typeof errBody.error === "string" && errBody.error.trim().length > 0
                ? errBody.error
                : null;
            const devHint =
              import.meta.env.DEV &&
              (res.status === 502 || res.status === 503 || res.status === 504)
                ? " Start the API (`npm run api:dev`) or use `npm run dev:full`."
                : "";
            setQuote(null);
            setError(
              fromServer ?? `Could not get price quote (HTTP ${res.status}).${devHint}`,
            );
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
  }, [drafts, retryToken, skip]);

  return { quote, loading, error, refetch, drafts } as const;
}
