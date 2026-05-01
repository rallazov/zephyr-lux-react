# Story 9.6: Printable order views

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **customer** with a secure order-status link,
I want to **print or save a clear PDF** of my order summary,
so that I have a **paper trail** and can share it with support without screenshots.

As the **owner / fulfillment operator**,
I want **admin order detail** to **print as a packing-slip–friendly document** (shipping address, line items, key identifiers),
so that I can **pick, pack, and ship** without juggling on-screen chrome or dark-theme backgrounds.

## Acceptance Criteria

1. **Given** the customer opens **`/order-status/:token`** with a valid token and the **ready** view is shown ([`CustomerOrderStatusPage`](../../src/order-status/CustomerOrderStatusPage.tsx) → `OrderStatusReady`), **when** they use the browser **Print** dialog (or an in-page **Print** control if implemented), **then** the printed page shows **order number**, **placed-at context**, **payment / fulfillment labels**, **line items** (title, SKU, qty, money), **tracking section when present**, and **timeline** in **readable black-on-white** (or equivalent high-contrast neutrals), **without** the storefront **header, footer, or nav** consuming meaningful space.

2. **Given** an authenticated admin views **`/admin/orders/:id`** with a loaded order ([`AdminOrderDetail`](../../src/admin/AdminOrderDetail.tsx)), **when** they print, **then** the output emphasizes **ship-to address**, **customer contact**, **line items table**, **order number**, and **fulfillment/payment summary**, with **admin chrome** (top nav, breadcrumb, sign-out row, [`AdminOwnerPushPanel`](../../admin/AdminOwnerPushPanel.tsx)) **hidden** for print.

3. **Given** print output for either surface, **when** the document is rendered, **then** **interactive-only** UI (e.g. **Copy address**, fulfillment transition **buttons**, shipment **form inputs**, **internal note** composer, **tracking “Open tracking page”** button where redundant) is **hidden or suppressed** so the paper/PDF is **not cluttered** — while **tracking numbers and carrier names remain visible as plain text**.

4. **Given** [FR-FUL-001](../../planning-artifacts/epics.md) (*admin order detail shows full shipping address with a printable or copy-friendly layout*), **when** admin print runs, **then** the **shipping address block** remains **fully visible** and **legible** (wrap long lines; avoid clipped overflow).

5. **Given** accessibility expectations ([UX-DR12–DR14](../../planning-artifacts/epics.md), architecture NFR-A11Y), **when** an optional **Print** button is added, **then** it is a **real `<button type="button">`** with an **accessible name** (e.g. “Print order”), keyboard operable, and **`window.print()`** does not navigate away.

6. **Given** [`sprint-change-proposal-2026-04-30.md` §4.3 / success criteria](../../planning-artifacts/sprint-change-proposal-2026-04-30.md) (*print preview for order status usable for customer support*), **when** QA prints both surfaces from current Chrome/Safari/Firefox, **then** **no critical content** is clipped **and** backgrounds do not consume excessive toner (avoid large solid dark fills on print).

## Tasks / Subtasks

- [x] **Task 1 — Print stylesheet strategy (AC: 1–4, 6)**  
  - [x] Introduce shared print styling (recommended: small **`src/styles/order-print.css`** imported from both targets, **or** Tailwind **`print:`** utilities where they keep the diff localized).  
  - [x] Ensure **screen UX unchanged** — only `@media print` (and optional `print:hidden` / `hidden print:block` pairs) affects output.  
  - [x] **Customer route chrome:** [`Layout`](../../src/components/App/Layout.tsx) wraps order-status pages under [`Header`](../../src/components/Header/Header.tsx) / [`Footer`](../../src/components/Footer/Footer.tsx). Hide storefront chrome **only for token order-status** (e.g. `useMatch('/order-status/:token')` adding a class on the root layout wrapper — avoid hiding header on **`/order-status`** lookup form unless product explicitly wants it).  
  - [x] **Admin chrome:** Hide [`AdminLayout`](../../src/admin/AdminLayout.tsx) header block / [`AdminOwnerPushPanel`](../../admin/AdminOwnerPushPanel.tsx) for print on order-detail route (`useMatch('/admin/orders/:id')` or equivalent).

- [x] **Task 2 — Customer order status markup hooks (AC: 1, 3, 5)**  
  - [x] On **`OrderStatusReady`**, add **`no-print` / `print:hidden`** (consistent convention) to: support mail link in header row, decorative progress chrome if it wastes space, primary CTA buttons that duplicate print.  
  - [x] Optionally add a **Print order** control next to the title row calling `window.print()` — **optional** per epic wording; if omitted, AC1 still passes via browser Print only.

- [x] **Task 3 — Admin order detail markup hooks (AC: 2–4)**  
  - [x] Tag sections for print: keep **shipping address**, **customer & contact**, **line items**, **header summary**, **timeline** (consider compressing internal-note styling for print).  
  - [x] Hide: breadcrumb, fulfillment action buttons, shipment **form**, internal-note **textarea/submit**, copy-address button, notification/evidence panels if they are not packing-slip relevant (ship photo upload UI should not appear on paper).

- [x] **Task 4 — Tests & verification (AC: 5–6)**  
  - [x] Extend [`CustomerOrderStatusPage.test.tsx`](../../src/order-status/CustomerOrderStatusPage.test.tsx) or add a focused test: render ready state, **assert Print button exists** *if* implemented; optionally spy `window.print` on click.  
  - [x] Document manual verification steps in Dev Agent Record (three browsers).  
  - [x] Run **`npm test`**, **`npm run build`**, **`npm run smoke`** (per Epic 9 boundary in sibling stories).

## Dev Notes

### Epic / product context

- Epic 9 builds on existing **Epic 7** customer order status and **Epic 5** admin order detail — **no new APIs**.  
- Sprint proposal wording: **`@media print`** + **optional** print control; **packing slip–friendly** layout.  
- Cross-story: independent of **9-2 … 9-5** data work — safe to implement against current order pages.

### Dev Agent Guardrails

- **Do not** add PDF libraries or server-side rendering for MVP — **browser print CSS + optional `window.print()`** only.  
- **Do not** hide shipping address or line items on admin print.  
- **Preserve** all existing **screen** behaviors and **`data-testid="admin-order-detail"`** contract.  
- **Avoid** global `@media print` rules that hide **all** site headers on unrelated storefront routes — scope using layout route detection or a dedicated wrapper class.

### Technical requirements

- **React + Vite SPA** — print uses current DOM; ensure **foreground/background** colors reset under `@media print` for dark customer theme (`stone-950` / `stone-900` surfaces → light paper).  
- **Tailwind:** `print:` variant is available in Tailwind v3+ ([`tailwind.config.js`](../../tailwind.config.js)); project has not used `print:` yet — **either** approach is fine if consistent.

### Architecture compliance

- Align with architecture doc: **TypeScript**, **accessible controls**, **no PCI scope change**.  
- Admin vs storefront separation unchanged ([`App.tsx`](../../src/components/App/App.tsx) routing).

### Library / framework requirements

- **None new.**

### File structure requirements

| Area | Action |
|------|--------|
| [`src/order-status/CustomerOrderStatusPage.tsx`](../../src/order-status/CustomerOrderStatusPage.tsx) | **UPDATE** — print hooks, optional Print button |
| [`src/components/App/Layout.tsx`](../../src/components/App/Layout.tsx) | **UPDATE** — conditional class for token order-status print chrome hiding |
| [`src/admin/AdminLayout.tsx`](../../src/admin/AdminLayout.tsx) | **UPDATE** — optional print chrome hiding when `orders/:id` |
| [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx) | **UPDATE** — `print:hidden` / structural wrappers for non-essential sections |
| **New** `src/styles/order-print.css` (or co-located CSS) | **ADD** (recommended) — shared `@media print` rules imported by the two flows |
| [`src/order-status/CustomerOrderStatusPage.test.tsx`](../../src/order-status/CustomerOrderStatusPage.test.tsx) | **UPDATE** if Print button shipped |

### Testing requirements

- **`npm test`** — extend RTL coverage as above.  
- **`npm run build`** / **`npm run smoke`**.  
- **Manual:** Print preview for **customer ready state** and **admin loaded order**; confirm address + SKUs visible.

### Previous story intelligence

- Story file **`9-5-*`** is not present yet; **`9-1-fixed-assortment-pack-catalog.md`** demonstrates local conventions: explicit file tables, AC numbering, links to [`apiUrl`](../../src/lib/apiBase.ts) / catalog — **match that tone**.  
- No dependency on pack SKU work for **printing**.

### Git intelligence summary

- Recent commits emphasize **Playwright e2e** and **storefront UX** — no conflicting print work; follow existing **Vitest + RTL** patterns in [`CustomerOrderStatusPage.test.tsx`](../../src/order-status/CustomerOrderStatusPage.test.tsx).

### Latest tech information

- **CSS `@media print`:** Prefer **`color-adjust: exact`** / **`print-color-adjust: exact`** only when brand colors must survive print; default to **economical** grayscale-friendly layout for operator packing slips.  
- **`window.print()`:** Invoke from user gesture (button click); test stub in Vitest via `vi.spyOn(window, "print")`.

### Project context reference

- Skill `persistent_facts` referenced `**/project-context.md` — **file not found** in repo; rely on this story + [`architecture.md`](../planning-artifacts/architecture.md).

## References

- [Epics — Epic 9, story 9-6](../planning-artifacts/epics.md)  
- [`sprint-change-proposal-2026-04-30.md` §4.3](../planning-artifacts/sprint-change-proposal-2026-04-30.md)  
- [`architecture.md`](../planning-artifacts/architecture.md) — NFR accessibility, TypeScript baseline  
- Customer implementation: [`CustomerOrderStatusPage.tsx`](../../src/order-status/CustomerOrderStatusPage.tsx), [`customerOrderStatusViewModel.ts`](../../src/order-status/customerOrderStatusViewModel.ts)  
- Admin implementation: [`AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx), [`AdminLayout.tsx`](../../src/admin/AdminLayout.tsx)

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Shared `order-print.css` plus `print:hidden` / print-only blocks: token `/order-status/:token` hides storefront header/footer in print; admin `/admin/orders/:id` hides layout header and owner push panel; customer ready view uses light-paper print colors, hides progress strip, item thumbs, tracking CTA, and adds **Print order** (`window.print()`).
- Admin detail: breadcrumb, fulfillment actions, copy-address, internal-note composer, shipment form, evidence panel, and partial-load notice hidden for print; read-only shipment summary shown only when printing if carrier/number/URL exist; mailto email shows as plain text on print; `admin-print-address-block` / line-items / timeline note styles for legibility.
- **Manual QA (AC6):** In Chrome, Safari, and Firefox, open print preview for a loaded token order-status “ready” view and for a loaded admin order detail; confirm order number, addresses, SKUs, money, and tracking text are visible, no large dark fills, and chrome/buttons are absent.
- Catalog tests `parse.test.ts` / `adapter-smoke.test.ts` updated to match current five-product `data/products.json` so `npm test` stays green on this branch.

### File List

- `src/main.tsx`
- `src/styles/order-print.css`
- `src/components/App/Layout.tsx`
- `src/admin/AdminLayout.tsx`
- `src/admin/AdminOrderDetail.tsx`
- `src/order-status/CustomerOrderStatusPage.tsx`
- `src/order-status/CustomerOrderStatusPage.test.tsx`
- `src/catalog/parse.test.ts`
- `src/catalog/adapter-smoke.test.ts`

### Review Findings

- [x] [Review][Patch] Admin print: outer admin shell may retain slate background in print preview — add `@media print` rule for `.admin-pwa-shell` (white background) in `src/styles/order-print.css` or Tailwind `print:` on `AdminLayout.tsx`.
- [x] [Review][Patch] Admin print: legacy internal notes box uses tinted background on paper — neutralize for print (e.g. hook class on the `bg-amber-50/40` block in `AdminOrderDetail.tsx` + print rules in `order-print.css`).
- [x] [Review][Defer] Catalog `parse.test.ts` / `adapter-smoke.test.ts` bundled for `data/products.json` alignment — not print AC scope [`src/catalog/parse.test.ts`, `src/catalog/adapter-smoke.test.ts`] — deferred, pre-existing hygiene on branch
- [x] [Review][Defer] User can invoke print while order status or admin detail is still loading — output may be incomplete; no screen guard [`CustomerOrderStatusPage.tsx`, `AdminOrderDetail.tsx`] — deferred, pre-existing

## Change Log

- 2026-04-30 — Printable order views: shared print CSS, scoped layout chrome hiding, customer Print control + hooks, admin packing-slip print hooks, RTL test for print; catalog smoke tests aligned with expanded seed data.
