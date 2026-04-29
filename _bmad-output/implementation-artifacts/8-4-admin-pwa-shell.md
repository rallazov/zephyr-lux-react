# Story 8.4: Admin PWA shell

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies


- **[6-4](6-4-mobile-cart-checkout-admin-layouts.md)** made admin order list/detail usable on small screens; this story adds installability and PWA shell behavior, not a wholesale admin redesign.
- **Epic 5 admin auth/order flows are complete:** PWA shell must preserve `AuthProvider`, `RequireAdmin`, Supabase RLS, and admin API authorization.
- **[8-6](8-6-owner-push-notification-prototype.md)** may depend on the service worker registration and installable shell created here.

## Story

As a **store owner using a phone**,
I want **the admin area to be installable as a lightweight PWA shell**,
so that **I can open fulfillment workflows quickly from my home screen without requiring a native app**.

## Acceptance Criteria

1. **Web app manifest**  
   **Given** the app is served in a browser **when** the document head loads **then** it links a valid manifest such as `/manifest.webmanifest` with Zephyr Lux Admin app name/short name, `start_url` targeting `/admin/orders`, `scope`, `display: "standalone"` or equivalent, theme/background colors, and required icon entries. Icons may reuse or derive existing assets, but must not point at missing files.

2. **Service worker shell**  
   **Given** production build is loaded **when** supported browsers initialize **then** register a service worker from a small client module. The service worker may cache static app shell assets, but must not cache admin API responses, order/customer JSON, tokenized order-status pages, Stripe responses, or any request with `Authorization`. Provide a clear no-op path for unsupported/test/dev environments.

3. **Admin-first mobile launch**  
   **Given** the owner launches the installed app **when** the PWA opens **then** it lands on `/admin/orders` or redirects through existing admin auth if signed out. Existing admin routes, sign-in, sign-out, and deep links continue to work under normal browser and standalone display modes.

4. **Mobile shell polish**  
   **Given** the admin is used on a phone **when** in standalone/PWA display mode **then** the layout respects viewport/safe-area constraints, does not create horizontal overflow, and keeps primary order navigation/actions touch friendly. Avoid introducing a new landing page; the first useful screen should be orders or login.

5. **Security and privacy**  
   **Given** admin order data is sensitive **when** PWA storage/caching is configured **then** do not persist customer/order payloads in Cache Storage beyond the normal Supabase/browser auth behavior. Document this boundary in a code comment or dev note near service worker caching rules.

6. **Verification**  
   **Given** the story is complete **when** tests/build run **then** add automated checks for manifest validity and service-worker registration behavior where practical, run `npm run build`, and complete a short manual QA note for Chrome/Edge or Safari mobile installability if device access is available.

## Tasks / Subtasks

- [x] **Task 1 - Manifest and icons (AC: 1)**  
  - [x] Add `public/manifest.webmanifest`.
  - [x] Add or reuse valid icon assets in `public/` or `public/assets/`.
  - [x] Link the manifest and theme-color metadata from `index.html`.

- [x] **Task 2 - Service worker registration (AC: 2, 5)**  
  - [x] Add a small registration module, imported from `src/main.tsx` or an app bootstrap file.
  - [x] Add `public/service-worker.js` or equivalent with conservative static-shell caching only.
  - [x] Explicitly bypass API, Supabase, Stripe, order-status token, and authorized requests.

- [x] **Task 3 - Admin launch path (AC: 3, 4)**  
  - [x] Confirm `/admin/orders` works as manifest `start_url`.
  - [x] Preserve auth redirects and deep links.
  - [x] Add safe-area/standalone CSS only where needed for admin chrome.

- [x] **Task 4 - Tests and QA (AC: 6)**  
  - [x] Add tests for manifest shape and registration environment guards.
  - [x] Run build.
  - [x] Add manual QA notes to this story’s Dev Agent Record.

## Dev Notes

### Story intent

The PRD explicitly prefers a responsive admin/PWA before considering a native app. This story makes the existing admin installable and app-like while keeping the browser-hosted architecture intact.

### Dev Agent Guardrails

- Do **not** cache admin API responses or customer/order data.
- Do **not** add offline order editing, background sync, or local order queues.
- Do **not** weaken `RequireAdmin`, Supabase session handling, RLS, or API JWT verification.
- Do **not** build a marketing landing page; PWA launch should go to useful admin work.

### Architecture compliance

| Concern | Requirement |
|---------|-------------|
| PWA | Manifest + conservative service worker |
| Privacy | Static assets only; no admin/customer API caching |
| Mobile admin | Builds on existing admin layout from 6-4 |
| Native app | Deferred until PWA limits are known |

### File structure expectations

| Action | Paths |
|--------|-------|
| New | `public/manifest.webmanifest` |
| New | `public/service-worker.js` or equivalent |
| New/update | `src/pwa/registerServiceWorker.ts`, `src/main.tsx` |
| Update | `index.html`, possible admin layout CSS/classes |
| Tests | `src/pwa/*.test.ts` or manifest tests |

### Previous story intelligence

- **[6-4](6-4-mobile-cart-checkout-admin-layouts.md)** added mobile admin nav and touch targets; refine, do not restart.
- **[5-1](5-1-supabase-admin-auth.md)** and `src/auth/AuthContext.tsx` define admin auth behavior that must survive PWA launch.
- **[8-6](8-6-owner-push-notification-prototype.md)** should reuse the service worker registration and manifest where possible.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) Release 3, §5.3, §6 non-goals, Epic 8, and risk mitigation for mobile admin.
- [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) PWA-readiness and device capability notes.
- [`architecture.md`](../planning-artifacts/architecture.md) PWA-readiness and admin mobile-usable constraints.

## Dev Agent Record

### Agent Model Used

—

### Debug Log References

—

### Completion Notes List

Implemented story **8-4-admin-pwa-shell** (first `ready-for-dev` entry in sprint order).

**Manifest (`/manifest.webmanifest`):** Zephyr Lux Admin naming, `start_url` `/admin/orders`, `scope` `/admin/`, `standalone`, theme/background colors, PNG icons shipped at `public/pwa-icon-{192,512}.png` and copied into `dist/` by Vite.

**Service worker (`public/service-worker.js`):** `install`/`activate` with `clients.claim()` for a minimal shell; **no Cache Storage-backed fetch interception** — all traffic uses the browser default network path so admin APIs, Supabase-derived data, Stripe, tokenized URLs, etc. cannot be persisted in this worker layer (boundary documented in-file).

**Registration (`src/pwa/registerServiceWorker.ts`):** Registers only when `navigator.serviceWorker` exists, `import.meta.env.PROD`, and `VITE_DISABLE_SERVICE_WORKER` is not `"true"`; otherwise no-op.

**Bootstrap:** `src/main.tsx` calls `registerServiceWorker()` once.

**Admin chrome:** `src/admin/admin-pwa.css` + `AdminLayout` classes for `@media (display-mode: standalone)` safe-area inset and `overflow-x-hidden` on the shell.

**Automated verification:** `src/pwa/manifest.test.ts` (manifest JSON shape); `src/pwa/registerServiceWorker.test.ts` (pure guard logic). **`npm run build`** and **`npm run test`** (full suite) succeeded.

**Unrelated test unblock:** Extended `resolvePlanFromStripeHints` Supabase stub in `api/_lib/subscriptionLifecycle.test.ts` with `.order().limit()` so the archived branch matches production query shape (full-suite green).

**Manual QA:** Not exercised on hardware this session. Recommended: deploy preview → Chrome/Edge Lighthouse PWA; Android Chrome “Install app”; iOS Safari “Add to Home Screen”; confirm standalone opens at `/admin/orders` then sign-in redirects as today when logged out.

### File List

- `public/manifest.webmanifest`
- `public/service-worker.js`
- `public/pwa-icon-192.png`
- `public/pwa-icon-512.png`
- `index.html`
- `.env.example`
- `src/main.tsx`
- `src/vite-env.d.ts`
- `src/admin/AdminLayout.tsx`
- `src/admin/admin-pwa.css`
- `src/pwa/registerServiceWorker.ts`
- `src/pwa/registerServiceWorker.test.ts`
- `src/pwa/manifest.test.ts`
- `api/_lib/subscriptionLifecycle.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-28 - Story created (bmad-create-story). Target: PRD E8-S4; mobile-first admin PWA shell.
- 2026-04-29 - Implemented manifest, SW registration network-only boundary, standalone safe-area polish, Vitest guards; sprint status → review.

## Story completion status

Status: **review**  
Ultimate context engine analysis completed - comprehensive developer guide created.
