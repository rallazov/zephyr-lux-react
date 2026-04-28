# Story 6.4: Mobile layouts — cart, checkout, admin

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **Epic 3** — [`CartPage`](../../src/components/Cart/CartPage.tsx), [`CheckoutPage`](../../src/components/Cart/CheckoutPage.tsx) implement core flows; **this story** is **responsive/a11y polish**, not payment logic changes.  
- **Epic 5** — [`AdminLayout`](../../src/admin/AdminLayout.tsx), [`AdminOrderList`](../../src/admin/AdminOrderList.tsx), [`AdminOrderDetail`](../../src/admin/AdminOrderDetail.tsx), [`AdminProductList`](../../src/admin/AdminProductList.tsx), [`AdminProductForm`](../../src/admin/AdminProductForm.tsx) — mobile fulfillment is **FR-ADM-007** (P2) but **UX-DR8** pushes **large touch targets** and clarity.  
- **UX-DR5 / FR-CART-005** — **320px** is the hard baseline for **storefront**; admin should be **usable** on phone for **order list + mark shipped** scenarios.

## Story

As a **customer and store owner**,
I want **cart, checkout, and admin screens to lay out cleanly on narrow phones**,
so that **FR-CART-005**, checkout usability (FR-CHK family), **FR-ADM-007**, **UX-DR5**, **UX-DR7**, **UX-DR8**, and PRD **§14 E6-S4** are satisfied.

## Acceptance Criteria

1. **Cart page (FR-CART-005, UX-DR7)**  
   **Given** viewport **320px** wide **when** cart has line items **then** each row shows **image, title, variant, price, quantity, remove** **without** horizontal scroll (wrap/stack permitted). **Given** **subtotal + CTA** **when** visible **then** **checkout** remains **one obvious primary action** below the fold is OK **if** **sticky** summary **or** clear scroll cue — document approach.  
   **Given** **empty cart** **when** viewed **then** preserve existing empty state — only adjust layout.

2. **Checkout page (FR-CHK-002, NFR-A11Y)**  
   **Given** **320px** **when** customer fills shipping/contact fields **then** **all** inputs are **visible**, **labeled**, and errors **not** clipped ([`CheckoutPage`](../../src/components/Cart/CheckoutPage.tsx) historically had **hidden fields** issues per brownfield notes — **regression guard**: no `display:none` on required inputs). **Given** **Payment Element** container **when** narrow **then** Stripe iframe area **not** overlapped by fixed chrome. **Stretch (verify manually if time):** virtual keyboard open **does not** permanently hide the submit CTA (**scrollIntoView** / padding — document outcome in Dev Agent Record).

3. **Admin — orders & fulfillment (UX-DR8, FR-ADM-007 partial)**  
   **Given** **admin** on **phone** **when** opening **order list** **then** **rows** remain **readable** (truncate with ellipsis **+** detail page link, or card stack — choose one). **Given** **order detail** **when** **shipping address** + **actions** shown **then** **address** is **copy-friendly** (existing patterns) and **primary** transitions (**shipped**, etc.) have **min ~44px** touch height **where** buttons exist. **Given** **wide** screen **when** loaded **then** **no** desktop regression.

4. **Admin — products (optional stretch)**  
   **Given** **product form** on **narrow** screen **when** editing **then** **no** unbounded horizontal overflow from tables/image pickers — **fix** **P0** overflow bugs; full “mobile-first admin CRUD” can **stop** at **usable** if timeboxed (document in Dev Agent Record).

5. **Verification**  
   **Given** completion **when** merged **then** run **manual** check at **320px** (document screenshots optional) **and** add **at least one** automated test: **RTL** **viewport** style mock **or** **`container`** query asserting **flex direction** / **grid** class toggles **if** pure enough; **if not**, extend smoke **only** where already stable (avoid flaky viewport CI).  
   **Given** automated coverage is **minimal** **when** merging **then** the developer **must** complete the **Manual QA checklist** in Dev Agent Record (checkboxes **or** bullet notes — evidence that narrow layouts were exercised).

6. **Accessibility**  
   **Given** **tap targets** **when** audited **then** spacing meets **~44×44px** minimum for **primary** actions (**WCAG 2.5.5** target — **align** with **UX-DR8**).

## Tasks / Subtasks

- [x] **Task 1 — Cart responsive pass (AC: 1, 6)**  
  - [x] Review `CartPage.css` / inline layout; prefer **Tailwind** if file already mixed.  
  - [x] Fix line-item grid/flex; test **long** product titles.

- [x] **Task 2 — Checkout responsive pass (AC: 2, 6)**  
  - [x] Audit field grid; **focus** on **small** screens + **error** banners.

- [x] **Task 3 — Admin layout (AC: 3, 4, 6)**  
  - [x] [`AdminLayout`](../../src/admin/AdminLayout.tsx) nav/sidebar collapse.  
  - [x] Order list/detail **CSS**; reuse existing **Tailwind** in admin files.

- [x] **Task 4 — Tests / QA notes (AC: 5)**  
  - [x] Add **minimal** automated coverage **or** **`deferred-work.md`** entry **only if** explicitly justified (prefer **one** concrete test).

### Review Findings

- [x] [Review][Resolved] Cart/checkout meta + `checkout_start` vs story **6-4** guardrails — **Accept coordinated overlap.** **[6-5](6-5-metadata-product-structured-data.md)** Task 3 explicitly wires **`usePageMeta`** from **`CartPage`** and **`CheckoutPage`** (AC 1 lists `/cart` and `/checkout`). **[6-6](6-6-basic-analytics-events.md)** AC 1 normatively requires **`checkout_start`** on **`CheckoutPage`** mount with **`sessionStorage`** scoped to **`location.key`** (matches implemented effect). Those edits are **not** arbitrary scope creep; they satisfy **sibling stories** that share files with **6-4**. What **6-4** still owns is **responsive layout / tap targets / overflow** on those screens + admin — **do not** mix payment quote/API changes. Refine guardrails (below): say **layout-first**, not “meta/analytics forbidden.”

- [x] [Review][Patch] Track layout regression test in git [`src/admin/AdminLayout.test.tsx`] — Staged (`git add`) so Vitest coverage for AC 5 is tracked; commit with your epic branch.

- [x] [Review][Patch] Prefer Testing Library `toHaveClass("min-h-11")` on the Orders nav link — [`src/admin/AdminLayout.test.tsx`](../../src/admin/AdminLayout.test.tsx) asserts `expect(ordersLink).toHaveClass("min-h-11")` (applied 2026-04-28).

- [x] [Review][Defer] Automated layout coverage is admin-only — [`AdminLayout.test.tsx`](../../src/admin/AdminLayout.test.tsx); **Cart**/**Checkout** responsive behavior still relies on manual QA per Dev Agent Record — acceptable under AC5 minimal bar; optional future RTL tests deferred.

- [x] [Review][Defer] **Mobile admin order list** — Two links per row target the same route (mono order id + “View order details”); harmless but slightly redundant for assistive tech — defer as low-priority UX polish.

## Dev Notes

### Dev Agent Guardrails

- **Do not** change **checkout** **API** contracts or **`quoteCartLines`** math. Primary delivery for **6-4** on Cart/Checkout is **responsive layout / a11y tap targets / clipping** — not payment logic. **`usePageMeta`** / **`checkout_start`** belong to **[6-5](6-5-metadata-product-structured-data.md)** / **[6-6](6-6-basic-analytics-events.md)** when implemented in the same components; coordinate acceptance there.  
- **Do not** weaken **admin** **JWT** or RLS — **CSS/markup** only for admin surfaces.

### Technical requirements

| Source | Requirement |
|--------|-------------|
| PRD §9.3 / §9.4 / §9.8 | FR-CART-005, FR-CHK-002, FR-ADM-007 |
| epics.md UX | UX-DR5, UX-DR7, UX-DR8 |
| architecture.md | Mobile-first storefront constraint |

### Architecture compliance

- No new **runtime** dependencies required for **CSS** work.

### File structure expectations

| Action | Paths |
|--------|-------|
| **Update** | [`src/components/Cart/CartPage.tsx`](../../src/components/Cart/CartPage.tsx); [`src/components/Cart/CheckoutPage.tsx`](../../src/components/Cart/CheckoutPage.tsx); cart CSS; [`src/admin/AdminLayout.tsx`](../../src/admin/AdminLayout.tsx); [`src/admin/AdminOrderList.tsx`](../../src/admin/AdminOrderList.tsx); [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx); optional product admin |
| **Tests** | Add or extend Cart/Checkout tests if present; otherwise one narrow layout-focused test |

### Previous story intelligence

- **5-4..5-7** shipped **dense** admin timelines — preserve **readability** when stacking on mobile (don’t collapse critical **fulfillment** actions below excessive chrome).

### Project context reference

- [`project-context.md`](../../project-context.md) if present.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- **Cart (AC1, AC6):** Replaced the narrow-viewport horizontal table with stacked **card line items** (`break-words` / `break-all` for long titles + SKU). Desktop keeps the existing table from `md` breakpoint up. **Sticky mobile bar** (`fixed` bottom) shows subtotal + primary **Checkout** CTA; inline **Proceed to Checkout** is `md+` only; **scroll cue** paragraph explains the pinned bar. Quantity / remove controls use **≥44px** touch sizing (`min-h-11`). No `display:none` on cart fields.
- **Checkout (AC2, AC6):** Main content uses `min-w-0`, `w-full`, and extra **bottom padding** (`pb-28`) so the fixed header + Payment Element + submit are less likely to clip. **PaymentElement** sits in a bordered shell with `relative z-0 isolate` so stacking stays below the `z-10` header chrome. Contact/shipping inputs use `min-h-11` + `box-border`; order summary rows **wrap** long names. **Pay Now** / mock pay: `min-h-12` + `scroll-mt-32` (helps browsers scroll focused controls into view; **virtual keyboard** overlap not E2E-tested here — confirm on a device).
- **Admin (AC3, AC4, AC6):** **AdminLayout** — horizontal **scroll** nav on small screens, links **min-h-11**, storefront + admin chrome unchanged at `sm+`. **AdminOrderList** — **card stack** on `< md`, table **hidden** until `md` (removes `min-w-[720px]` horizontal scroll on phones). **AdminOrderDetail** — fulfillment actions **full-width** on narrow (`w-full sm:w-auto`), shipping block stacks with full-width **Copy address**; primary transition buttons remain **≥44px** height. **AdminProductForm** — `overflow-x-hidden` / `min-w-0` guard for narrow editors.
- **Tests (AC5):** `AdminLayout.test.tsx` asserts **`overflow-x-auto`** on admin nav and **`min-h-11`** on primary nav links (layout signal without flaky viewport CI).

### Manual QA checklist _(required when automated layout coverage is minimal)_

_Check or note outcome for each row before marking story done._

| Area | Check |
|------|--------|
| Cart | **Implemented:** cards + sticky subtotal/checkout + scroll cue — **confirm in browser at 320px** with a long title and ≥1 SKU line. |
| Checkout | **Implemented:** full-width fields, `pb` cushion, payment shell — **confirm** Stripe iframe not under header; errors use `break-words`. |
| Checkout | (Stretch) Keyboard open: submit still reachable — **`scroll-mt` on Pay** added; **verify on iOS/Android**. |
| Admin orders | **Implemented:** list cards + detail stacking + `min-h-11` actions — **spot-check** phone width. |
| Admin products _(if touched)_ | **Implemented:** `max-w-full min-w-0 overflow-x-hidden` on form — **spot-check** variant grids. |

### File List

- `src/components/Cart/CartPage.tsx`
- `src/components/Cart/CheckoutPage.tsx`
- `src/admin/AdminLayout.tsx`
- `src/admin/AdminOrderList.tsx`
- `src/admin/AdminOrderDetail.tsx`
- `src/admin/AdminProductForm.tsx`
- `src/admin/AdminLayout.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-27 — Story 6-4: responsive cart (cards + sticky checkout bar), checkout spacing/payment shell/tap targets, admin mobile nav + order cards + detail stacking, AdminLayout test, sprint status → review.

