# Payments Setup (Stripe + Vercel Serverless)

## Env

Create `.env.local` with:

```
FRONTEND_URL=http://localhost:5173
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VERCEL_BLOB_READ_WRITE_TOKEN=...
LOG_LEVEL=info
```

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
- Client POSTs `/api/create-payment-intent` with items `{sku,qty}`.
- Server computes amount from `data/products.json`, creates PaymentIntent, returns `clientSecret` + `orderId`.
- Client renders `<PaymentElement>` and confirms.
- Stripe sends webhook; we verify signature, record order (local JSON in dev, Vercel Blob in prod), and (optionally) send receipt.
