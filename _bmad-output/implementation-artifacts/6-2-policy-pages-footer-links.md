# Story 6.2: Policy pages & footer links

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[6-1](6-1-real-homepage-category-routes.md)** (soft) — primary nav should stay coherent; footer links are independent but **ship together** for “no placeholder customer path.”
- **Epic 3 checkout** — confirmation emails and checkout copy may reference policies later; keep URLs **stable** once published.

## Story

As a **customer**,
I want **shipping, returns, privacy, terms, and contact pages linked from the footer (and reachable at stable URLs)**,
so that **FR-CONT-001**, **UX-DR1**, **UX-DR10**, and PRD **§14 E6-S2** are satisfied — replacing **`href="#"`** dead-ends in [`Footer.tsx`](../../src/components/Footer/Footer.tsx).

## Acceptance Criteria

1. **Required routes (UX-DR1)**  
   **Given** the storefront **when** visiting these paths **then** each renders **real layout** (storefront chrome via [`Layout`](../../src/components/App/Layout.tsx)) with **substantive placeholder or launch-ready copy**:  
   - **`/policies/shipping`**  
   - **`/policies/returns`**  
   - **`/policies/privacy`**  
   - **`/policies/terms`**  
   - **`/contact`**  
   **Given** **`/policies`** (exact parent path, no subsegment) **when** requested **then** render a minimal **policy index** page listing **`Link`**s to **`/policies/shipping`**, **`/policies/returns`**, **`/policies/privacy`**, **`/policies/terms`** (**preferred**) **or** **`Navigate`** redirect to **`/policies/shipping`** — pick **one**, implement **once**, document in Dev Agent Record (bare **404** on **`/policies`** alone is **not** acceptable).  
   **Given** unknown policy subpaths **`/policies/:unknown`** **when** requested **then** **`NotFound`** (**404**) **or** redirect to the policy index above — pick **one** and match **`App`** patterns.

2. **Footer & primary links (FR-CONT-001)**  
   **Given** [`Footer.tsx`](../../src/components/Footer/Footer.tsx) **when** updated **then** **policy** links use **`react-router-dom` `Link`** (or `NavLink`) to the routes above — **not** `href="#"`. **Given** non-policy items (e.g. social, newsletter) **when** no real destination exists **then** either **remove**, **disable** with explanation, or link to **`/contact`** — **no** silent `href="#"` in the **Help / About** columns for MVP launch path.  
   **Given** **`Navbar`** search/account **`#`** links **when** not implemented **then** follow **FR-SF-005** spirit: **remove** icon buttons **or** wire **search** to a real **`/search`** when that epic exists — for **this story**, minimum bar: **no broken **`Link to="#"**`** in chrome that fails a11y/UX audit (either `button` + “coming soon” **`aria-disabled`** **or** remove).

3. **Trust alignment (UX-DR11)**  
   **Given** PRD §18 **Q4/Q8** may still be open **when** drafting copy **then** label **legal-ish** pages with **“Template — replace before production”** in **HTML comment** or **internal dev-only** note **not** visible to customers **or** use clearly **generic** merchant-neutral language that **cannot** misrepresent actual operations. Document in Dev Agent Record what **owner** must replace pre-launch.

4. **Accessibility**  
   **Given** policy pages are text-heavy **when** rendered **then** use sensible heading hierarchy (`h1` page title), **focus order**, and **skip** decorative-only markup; forms on **`/contact`** (if any) require **labels** + error text (**NFR-A11Y-002**).

5. **Tests**  
   **Given** completion **when** merged **then** extend [`routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) with mounts for **each** new route (minimal text assertion). **Given** **Vitest** **when** running **then** no new network dependency.

## Tasks / Subtasks

- [x] **Task 1 — Routes (AC: 1)**  
  - [x] Register nested routes in [`App.tsx`](../../src/components/App/App.tsx) under **`Layout`** (**`<Outlet />`** pattern already used), including **`/policies`** index **or** redirect per AC1.  
  - [x] Add simple presentational components under e.g. `src/components/Policies/` or `src/pages/policies/` — **prefer** shared **`PolicyLayout`** (title + prose container using **`@tailwindcss/typography`** if already configured).

- [x] **Task 2 — Footer + nav cleanup (AC: 2)**  
  - [x] Refactor [`Footer.tsx`](../../src/components/Footer/Footer.tsx) link lists; **optional** trim columns to what’s honest for MVP.  
  - [x] Audit [`Navbar.tsx`](../../src/components/Navbar/Navbar.tsx) for **`#`** **Link** usage; align with story decision.

- [x] **Task 3 — Contact channel (AC: 1, 4)**  
  - [x] **`/contact`**: **MVP** may be **mailto + support hours + physical support policy** without backend — **if** a form is added, **do not** POST PII to an unimplemented API **without** clear handling (prefer **mailto:** / **displayed** email for MVP unless email endpoint already exists).

- [x] **Task 4 — Tests (AC: 5)**  
  - [x] Smoke **each** path.

### Review Findings

- [x] [Review][Patch] Track policy and contact sources in version control — committed `src/components/Policies/*.tsx` and `src/components/Contact/ContactPage.tsx`.
- [x] [Review][Patch] Navbar “coming soon” icon buttons — use native `disabled` on search and account buttons; `aria-label`s retained. [Navbar.tsx:53-67]
- [x] [Review][Defer] Footer newsletter still POSTs email to `VITE_API_URL/api/subscribe` [SubscriptionForm.tsx:34] — deferred, pre-existing outside this story’s contact-page scope; align with honest MVP if the endpoint is absent.

## Dev Notes

### Dev Agent Guardrails

- **Do not** promise GDPR/legal accuracy with fake company addresses — keep **template** stance until owner edits.  
- **Do not** break **admin** routes or **cart/checkout** URLs.  
- **Preserve** existing **Footer** styling tokens (`Footer.css`) where possible — **extend** rather than full redesign unless necessary.

### Technical requirements

| Source | Requirement |
|--------|-------------|
| PRD §9.11 | FR-CONT-001 |
| PRD §14 | E6-S2 |
| epics.md UX | UX-DR1, UX-DR10, UX-DR11 |

### Architecture compliance

- Policy pages are **static** SPA routes — no server secrets; if later **CMS**, behind future epic.

### File structure expectations

| Action | Paths |
|--------|-------|
| **Update** | [`src/components/App/App.tsx`](../../src/components/App/App.tsx); [`src/components/Footer/Footer.tsx`](../../src/components/Footer/Footer.tsx); [`src/components/Navbar/Navbar.tsx`](../../src/components/Navbar/Navbar.tsx) |
| **New** | Policy + contact components; optional `src/content/policies/*.md` **only if** build pipeline supports — **otherwise** inline TSX |
| **Tests** | [`src/routes.smoke.test.tsx`](../../src/routes.smoke.test.tsx) |

### Testing requirements

- Smoke coverage for new routes.  
- Optional: RTL test that **Footer** renders **`to="/policies/privacy"`** (href normalization).

### Previous story intelligence

- **6-1** may change **nav** structure — reconcile **footer** IA with **collection** links (e.g. “Shop” vs category).

### Project context reference

- [`project-context.md`](../../project-context.md) if present.

## Dev Agent Record

### Agent Model Used

Cursor agent

### Implementation plan (AC1 routing decision)

- **`/policies`**: Implemented a **policy index** page with `Link`s to shipping, returns, privacy, and terms (preferred option in AC1).
- **`/policies/*`** (unknown segment): **`Navigate`** to **`/policies`** (matches simple redirect pattern; no global 404 route in `App` today).

### Owner pre-launch checklist (trust / legal)

Replace before production:

- **`src/components/Contact/ContactPage.tsx`**: `SUPPORT_EMAIL`, support hours text, and any published address or fulfillment copy.
- **All policy TSX** under `src/components/Policies/`: shipping, returns, privacy, and terms — align with counsel-approved language and real operations (carriers, regions, return windows, data practices).
- **Footer**: Promotions / About lines that currently point to **`/contact`** as an honest MVP stand-in — replace with real destinations when available.
- **Navbar**: Search and account controls are **`aria-disabled` “coming soon”** buttons — wire to real **`/search`** and account flows when those epics land.

### Debug Log References

- Removed stale `Footer.js` / `Navbar.js` alongside `.tsx` sources so bundler/tests resolved the updated React components (avoided duplicate “Returns” and `href="#"` in smoke output).

### Completion Notes List

- Storefront routes registered under `Layout` for `/policies`, nested policy pages, `/contact`, and redirect for unknown `/policies/*`.
- Shared `PolicyLayout` + Tailwind `prose` for policy copy; JSX comments mark template stance.
- Footer uses `Link`; social icons replaced with visible note; bottom bar links to policies + contact.
- Navbar search/account use disabled-pattern buttons with `aria-disabled` + descriptive labels.
- Contact page: mailto + placeholder hours (no PII-submitting form).
- Extended `routes.smoke.test.tsx` (heading-based assertions + unknown policy redirect test).
- Deleted shadowing compiled `src/components/Footer/Footer.js` and `src/components/Navbar/Navbar.js`.

### File List

- `src/components/App/App.tsx`
- `src/components/Policies/PolicyLayout.tsx`
- `src/components/Policies/PoliciesIndex.tsx`
- `src/components/Policies/PolicyShippingPage.tsx`
- `src/components/Policies/PolicyReturnsPage.tsx`
- `src/components/Policies/PolicyPrivacyPage.tsx`
- `src/components/Policies/PolicyTermsPage.tsx`
- `src/components/Contact/ContactPage.tsx`
- `src/components/Footer/Footer.tsx`
- `src/components/Footer/Footer.css`
- `src/components/Navbar/Navbar.tsx`
- `src/components/Navbar/Navbar.css`
- `src/routes.smoke.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- deleted: `src/components/Footer/Footer.js`
- deleted: `src/components/Navbar/Navbar.js`

### Change Log

- 2026-04-27: Story 6.2 — policy routes, policy index + unknown redirect, contact page, footer/nav cleanup, route smoke tests, removed stale `.js` shadows next to Footer/Navbar.
