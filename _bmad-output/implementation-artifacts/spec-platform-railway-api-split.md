---
title: 'Platform: Railway API + Vercel SPA split'
type: 'chore'
created: '2026-04-28'
status: 'done'
baseline_commit: '2b1346f94266b35e08697965d6c92c1d61151111'
context:
  - '_bmad-output/planning-artifacts/architecture.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Vercel Hobby caps serverless functions at 12; this repo has more `api/*.ts` handlers than that, so production deploys fail without Pro or consolidation.

**Approach:** Run **one** Node HTTP server on **Railway** that serves all existing API routes under `/api/*`, and deploy the Vite storefront as a **static SPA on Vercel** without an `api/` tree in that deployment root. The browser calls the API via a **build-time public origin** (e.g. `VITE_PUBLIC_API_URL`); local dev keeps **`/api` proxied** to the local or remote API process.

## Boundaries & Constraints

**Always:**

- Server-only secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_BLOB_*`, VAPID private key, Resend, etc.) live **only** on Railway — never `VITE_*`.
- `FRONTEND_URL` on Railway must match the **actual** storefront origin Vercel serves (for CORS and links).
- Stripe webhook URL in Dashboard points to **`https://<railway-host>/api/stripe-webhook`** after cutover.
- Preserve existing handler behavior and tests; adapter layer (VercelRequest/Response ↔ Node) must not change business logic.

**Ask First:**

- Exact **Vercel project root** layout (monorepo `web/` vs staying flat and excluding `api` via settings) if multiple valid layouts exist.
- Whether **preview deployments** should call **production** Railway, a **staging** Railway service, or stay broken for API until documented.

**Never:**

- Do not merge unrelated product features into this change.
- Do not expose new tunneled admin APIs without the same JWT checks as today.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Prod browser checkout | `VITE_PUBLIC_API_URL` set to Railway; POST `/api/create-payment-intent` | PaymentIntent created as today | Same status codes as current handler |
| CORS preflight | `Origin` = Vercel storefront; Railway has matching `FRONTEND_URL` | `Access-Control-Allow-Origin` allows request | 403-style CORS failure if misconfigured env |
| Local dev | `DEV_API_PROXY` → local Railway/express (e.g. `:8787`) | Vite proxy `/api` works unchanged mental model | Document port in `.env.example` |
| Stripe webhook | Stripe POSTs to Railway `/api/stripe-webhook` | Signature verify + ledger as today | 400 on bad signature |

</frozen-after-approval>

## Code Map

- `handlers/*.ts` -- Vercel-style default handlers (`VercelRequest` / `VercelResponse`); mounted from `server/index.ts`.
- `handlers/_lib/env.ts` -- All server env reads; Railway must supply these (same names as today).
- `vite.config.ts` -- `server.proxy['/api']` for dev; target may change from `vercel dev` to local API server.
- `package.json` -- `server` / `dev:full` today assume `vercel dev`; update to start standalone API in dev.
- `src/components/Cart/CheckoutPage.tsx`, `useCartQuote.ts`, `PdpSubscriptionBlock.tsx`, order-status pages, `AdminOrderDetail.tsx`, `ShipmentEvidencePanel.tsx`, `AdminOwnerPushPanel.tsx`, `ownerPushClient.ts` -- Relative `/api/...` fetches; switch to shared base URL helper.
- `src/components/SubscriptionForm/SubscriptionForm.tsx` -- Already uses `API_URL`; align naming with new convention.
- `vercel.json` -- SPA rewrites; no `api/` directory in repo root so Hobby deploy creates **zero** serverless functions.
- `.env.example` -- Document `VITE_PUBLIC_API_URL`, Railway vs Vercel split, webhook URL.

## Tasks & Acceptance

**Execution:**

- [x] Add `src/lib/apiBase.ts` (or equivalent) -- `apiUrl(path: string)` returns absolute URL in prod when `VITE_PUBLIC_API_URL` set, else relative `/api/...` for dev/tests -- rationale: single convention for all browser `fetch` calls.
- [x] Replace every storefront/admin/pwa `fetch(\`/api/...\`)` / `fetch("/api/...")` with `fetch(apiUrl("/api/..."))` (or `` fetch(`${apiUrl("")}/api/...`) `` per chosen helper signature) -- rationale: cross-origin prod.
- [x] Add `server/` (or `api-server/`) Node entry -- `import` each handler and route `POST|GET /api/<name>` to match current Vercel paths -- rationale: one Railway process.
- [x] Listen on `process.env.PORT`; health route optional (`GET /health`).
- [x] `package.json` scripts: `api:dev` / adjust `dev:full` to run Vite + new server (remove or document `vercel dev` as optional legacy).
- [x] Railway: `Procfile` or `railway.json` / Dockerfile + start command; document in README snippet.
- [x] Vercel: set **Root Directory** to folder without deployable `api/` (e.g. move app to `web/` **or** document dashboard setting); ensure build receives `VITE_PUBLIC_API_URL`.
- [x] Update tests that assert exact `fetch` strings to use helper or mocked base.
- [x] `.env.example` -- Railway vs Vercel variable split + Stripe webhook note.

**Acceptance Criteria:**

- Given Railway running the new server with production-like env, when the built SPA (with `VITE_PUBLIC_API_URL` pointing at Railway) calls checkout and order-status APIs, then responses match pre-split behavior (no CORS errors for allowed origin).
- Given `npm run dev` with proxy target pointing at local API server, when developers use the app, then `/api` flows work without setting `VITE_PUBLIC_API_URL`.
- Given Vercel deploy of **only** the static app, when deployment runs, then **zero** serverless functions are required (Hobby limit satisfied).

## Spec Change Log

- 2026-04-28 — Initial implementation approved; `api/` renamed to `handlers/` so Vercel does not auto-deploy serverless functions; `server/index.ts` + `apiUrl()` complete the split.

## Suggested Review Order

**API process**

- One Express app; raw Stripe + multipart routes registered before `express.json()`.
  [`index.ts:38`](../../server/index.ts#L38)

- All JSON-backed handlers mounted after body parser; paths match legacy `/api/*`.
  [`index.ts:42`](../../server/index.ts#L42)

**Storefront → API**

- Relative base in dev; `VITE_PUBLIC_API_URL` prefixes absolute API origin in prod.
  [`apiBase.ts:8`](../../src/lib/apiBase.ts#L8)

**Tooling**

- `dev:full` runs Vite + `tsx server/index.ts`; proxy default port 3333.
  [`vite.config.ts:10`](../../vite.config.ts#L10)

- `npm start` / `api:dev` entry and new dependencies.
  [`package.json:15`](../../package.json#L15)

## Design Notes

`@vercel/node` request/response types are Connect-compatible enough that `createServer((req, res) => ...)` can cast or thin-wrap. If a handler needs raw body (`stripe-webhook`, `admin-shipment-image`), the Node server must disable automatic body parsing for those routes or pipe `req` unchanged—mirror current `bodyParser: false` behavior.

## Verification

**Commands:**

- `npm run build` -- expected: success with `VITE_PUBLIC_API_URL` optional empty.
- `npm test` -- expected: all tests pass after fetch URL expectations updated.

**Manual checks (if no CLI):**

- Hit Railway `/api/cart-quote` with `OPTIONS` and storefront `Origin`; confirm CORS headers.
- Stripe CLI or Dashboard test webhook against Railway URL.
