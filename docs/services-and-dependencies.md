# Zephyr Lux Services and Dependencies

This is the living checklist for outside accounts, deploy targets, API keys, and the main packages used by Zephyr Lux. Secret values belong in provider dashboards and local `.env.local` files, never in git.

## Production Services

| Service | Purpose | Where It Is Configured | Required For |
| --- | --- | --- | --- |
| Vercel | Static storefront hosting for the Vite React app | Vercel project env vars, build settings | Customer-facing site |
| Railway | Node API host for `server/index.ts` and `handlers/*` | Railway service env vars; `railway.toml` | Checkout APIs, webhooks, order lookup email requests, admin APIs |
| Supabase | Postgres database, RLS, RPCs, Auth, customer/admin sessions | Supabase dashboard, SQL migrations in `supabase/migrations` | Catalog, orders, admin auth, customer account sign-in, order lookup token storage |
| Stripe | Payments, PaymentIntent, webhooks, billing portal/subscriptions | Stripe dashboard and Railway env vars | Checkout, paid-order lifecycle, subscriptions |
| Resend | Transactional email delivery | Resend dashboard and Railway env vars | Owner paid-order emails, customer order confirmations, guest order lookup links, optional shipment emails |
| Vercel Blob | Optional blob/file storage | Vercel dashboard token mirrored into API env if used | Store/blob backend and uploaded shipment images when configured |
| GitHub | Source control and CI workflows | GitHub repo settings and `.github/workflows` | Collaboration, automated checks, deployments where connected |

## Resend Setup

Yes, you need a Resend account and an API key for the current custom transactional email flow.

1. Create or sign in to Resend.
2. Add and verify a Zephyr Lux sending domain, ideally a subdomain such as `mail.zephyrlux.com` or `transactional.zephyrlux.com`.
3. Add the DNS records Resend gives you for SPF/DKIM/return-path style verification.
4. Create an API key.
5. Add these server-only env vars to Railway:

```sh
RESEND_API_KEY=re_...
RESEND_FROM="Zephyr Lux <orders@mail.zephyrlux.com>"
SUPPORT_EMAIL=help@zephyrlux.com
OWNER_NOTIFICATION_EMAIL=you@zephyrlux.com
```

Do not add `RESEND_API_KEY` to Vercel or any `VITE_*` variable. It is a server secret.

For Supabase Auth magic-link emails, Supabase's default sender is fine for early testing but not production. For production, configure Supabase Auth custom SMTP using a real email provider. Resend can be that provider too, so customer account sign-in emails can also come from a Zephyr Lux sender instead of a Supabase sender.

## Main Environment Variables

The full canonical env list lives in [`.env.example`](../.env.example). The most important split is:

| Location | Variables |
| --- | --- |
| Vercel storefront, public only | `VITE_PUBLIC_SITE_URL`, `VITE_PUBLIC_API_URL`, `VITE_STRIPE_PUBLIC_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional analytics vars |
| Railway API, server-only | `FRONTEND_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `SUPPORT_EMAIL`, `OWNER_NOTIFICATION_EMAIL`, `VERCEL_BLOB_READ_WRITE_TOKEN`, `LOG_LEVEL` |
| Local development | `.env.local`; use `npm run dev:full` for Vite plus the local API |

Never expose Stripe secret keys, webhook secrets, Supabase service role keys, Resend keys, Vercel Blob write tokens, VAPID private keys, or future server secrets through `VITE_*`.

## Runtime Packages

| Package | Purpose |
| --- | --- |
| `react`, `react-dom`, `react-router-dom` | Storefront and admin UI |
| `vite`, `@vitejs/plugin-react` | App build and dev server |
| `typescript`, `tsx` | TypeScript build and Node server execution |
| `express` | Railway API server |
| `@supabase/supabase-js` | Supabase browser/admin clients |
| `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js` | Server payments and client checkout integration |
| `@vercel/blob` | Blob storage integration |
| `zod` | Runtime validation |
| `pino` | Server logging |
| `raw-body`, `busboy` | Webhook body parsing and uploads |
| `web-push` | Optional owner push notification prototype |
| `@fortawesome/*` | UI icons |
| `tailwindcss`, `@tailwindcss/*`, `postcss`, `autoprefixer` | Styling pipeline |
| `concurrently` | Local full-stack dev script |

## Dev and QA Tooling

| Tool | Purpose |
| --- | --- |
| Vitest, jsdom, Testing Library | Unit and component tests |
| Playwright | End-to-end browser tests and visual checks |
| ESLint, TypeScript ESLint | Static checks |
| Vercel CLI | Legacy/local serverless workflow support |

## Operational Notes

- Keep production API secrets in Railway, not Vercel.
- Keep Vercel focused on the static storefront and public `VITE_*` values.
- `FRONTEND_URL` should match the customer-facing Vercel URL so email links point to the right site.
- `VITE_PUBLIC_API_URL` should point the browser to the Railway API origin in production.
- Supabase migrations in `supabase/migrations` are part of deployment readiness and should be applied before relying on new order/admin features.
- Before turning on production email, verify the sender domain and send test order lookup, confirmation, owner notification, and shipment emails.
