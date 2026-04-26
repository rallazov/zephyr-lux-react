# Payments Setup (Stripe + Vercel Serverless)

## Environment variables

The **canonical list** of variable names, scopes (client vs server), and defaults is in [`.env.example`](.env.example) at the repository root. Copy the values you need into **`.env.local`** (gitignored) for the Vite app and set the same server-side names in the environment used by `vercel dev` / Vercel (Preview vs Production). Do not duplicate long env documentation here; keep it in one place in `.env.example` + the main [README](README.md) configuration table.

**Quick local minimum (server / `vercel dev`):** `FRONTEND_URL`, `STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET` (from `stripe listen` or Dashboard). Client: set `VITE_STRIPE_PUBLIC_KEY` to your **`pk_test_...`** in `.env.local` if you are exercising real Stripe Elements (see `.env.example`).

## Local dev

- Terminal 1 (frontend):
```
npm run dev
```
- Terminal 2 (vercel functions):
```
vercel dev
```
- Stripe webhook (in another terminal):
```
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

## Flow
- **Cart + checkout subtotals, tax, shipping, and line amounts** come from `POST /api/cart-quote` (body: `{ items: { sku, quantity }[] }`). The server uses `data/products.json` and the same pricing policy as the PaymentIntent path (7% tax on merchandise, flat $5 shipping waived when subtotal is at or above $50.00 in merchandise).
- Client POSTs `/api/create-payment-intent` with validated line items (including `quantity` per line). The server **ignores** a client `amount` when `items` is non-empty; it computes the charge from the catalog in minor units, **including** tax and shipping, so the charged amount matches the order summary and `/api/cart-quote` for the same lines.
- Server returns `clientSecret` and creates PaymentIntent. Client renders `<PaymentElement>` and confirms.
- Stripe sends webhook; we verify signature, record order (local JSON in dev, Vercel Blob in prod), and (optionally) send receipt.
