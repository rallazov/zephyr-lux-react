# Story 9.5: Real content — placeholder sweep (collections, policies, contact, marketing)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **storefront customer**,
I want **collection pages, policies, contact, and global marketing copy** to read as **intentional Zephyr Lux content** (not template filler),
so that I **trust the brand** and understand **shipping, returns, privacy, and how to get help** without “replace before launch” noise.

As the **owner / operator**,
I want **residual placeholder language removed** from primary routes,
so that the site meets **FR-CONT-001/002**, **UX-DR1**, and **UX-DR11** expectations for **real** storefront content.

## Acceptance Criteria

1. **Given** [`src/catalog/collections.ts`](../../src/catalog/collections.ts) drives collection **hero titles and descriptions** (and SEO descriptions via [`CollectionPage.tsx`](../../src/components/Collection/CollectionPage.tsx)), **when** this story ships, **then** each listed collection’s `heroTitle` and `heroDescription` are **concise, brand-consistent copy** (no obvious template tone). **Out of scope for this story:** swapping image assets named `*_placeholder.jpeg` — that is [**9-4**](9-4-placeholder-catalog-expansion-images.md) unless the owner bundles imagery here; focus on **words**, not new image files.

2. **Given** [`Hero.tsx`](../../src/components/Hero/Hero.tsx) default props (`DEFAULT_TITLE`, `DEFAULT_DESCRIPTION`, hero image `alt` text) still read as **men’s boxer-brief–centric** marketing, **when** a route uses the Hero **without** overriding title/description, **then** defaults match the **current** brand positioning (elevated basics / premium essentials — aligned with [`HomePage.tsx`](../../src/components/Home/HomePage.tsx) tone), not a single-product strapline unless that is the deliberate default.

3. **Given** [`ContactPage.tsx`](../../src/components/Contact/ContactPage.tsx) contains explicit **“placeholder”** headings and `support@zephyrlux.example`, **when** complete, **then** the page presents **production-credible** support contact: **realistic** support email (prefer **`import.meta.env.VITE_SUPPORT_EMAIL`** with documented fallback in [`.env.example`](../../.env.example), consistent with server-side `SUPPORT_EMAIL` notes there), **named support hours** with **timezone** (owner-supplied or honest “by appointment” pattern — not “placeholder” labels), and **physical fulfillment** copy that either states the **real** returns/office address policy **or** clearly states **online-only / no public showroom** without telling the user to “replace placeholder text” in the visible body.

4. **Given** policy surfaces under `src/components/Policies/` — [`PoliciesIndex.tsx`](../../src/components/Policies/PoliciesIndex.tsx), [`PolicyShippingPage.tsx`](../../src/components/Policies/PolicyShippingPage.tsx), [`PolicyReturnsPage.tsx`](../../src/components/Policies/PolicyReturnsPage.tsx), [`PolicyPrivacyPage.tsx`](../../src/components/Policies/PolicyPrivacyPage.tsx), [`PolicyTermsPage.tsx`](../../src/components/Policies/PolicyTermsPage.tsx) — **when** complete, **then** **no paragraph** in the customer-visible policy body instructs the merchant to *“replace before production”* or frames the page as *“generic placeholder language.”** Instead, each page reads as **Zephyr Lux–specific operational copy** (processing times, regions served, return windows, data practices at a high level) per **UX-DR11**. **Legal guardrail:** a **short** note that terms/privacy are **not legal advice** and should be **counsel-reviewed** may remain where appropriate — but it must **not** read as “this page is unfinished.”

5. **Given** [`Footer.tsx`](../../src/components/Footer/Footer.tsx) still routes **About us**, **FAQs**, **Careers**, and **Store information** through **`/contact`** with comments admitting placeholders, **when** complete, **then** either: **(A)** links point to **real** destinations (new minimal `/about` or `/faq` routes **only if** you add substantive content in the same story), **or** **(B)** nav labels honestly describe the destination (e.g. “Contact customer service” instead of “FAQs” if there is no FAQ page). Remove or rewrite the **“Social profile links are not configured”** note so it is **not** a dev-facing apology unless social links are added; prefer **neutral** copy (“Connect with us via the contact page”) if no social URLs exist.

6. **Given** [`DiscountMessage.tsx`](../../src/components/DiscountMessages/DiscountMessage.tsx) shows **specific discount percentages** on `/sale`, **when** those numbers are **not** backed by catalog or promo rules in code, **then** replace with **truthful** sale messaging (owner-approved percentages **or** non-numeric promotional CTA) so customers are not misled.

7. **Given** [**9-2** storefront search](9-2-storefront-product-search.md) enables the search icon, **when** this story is implemented **after** 9-2, **then** **do not** reintroduce `aria-label="Search (coming soon)"` or a disabled search button. If 9-2 is **not** yet merged in your branch, either land 9-2 first or implement search enablement per 9-2 in the same branch to avoid contradicting this AC.

8. **Given** **Epic 10 (customer accounts)** is **backlog**, **`Navbar.tsx`** may still expose a **non-functional account** control — **when** this story completes, **then** the account affordance must **not** pretend to be a working login: use an honest label (e.g. **“Account (soon)”** or **“Order lookup”** linking to [`/order-status`](../../src/order-status/OrderStatusLookup.tsx) if that is the supported path) per **UX-DR1** / UX spec (**no fake account** chrome).

9. **Given** repository standards, **when** done, **then** **`npm run build`**, **`npm test`**, and **`npm run smoke`** pass. Add or update **RTL** tests only where assertions depend on **removed placeholder strings** (e.g. contact page smoke string); avoid brittle copy snapshots unless already project pattern.

## Tasks / Subtasks

- [x] **Task 1 — Collections & Hero defaults (AC: 1, 2)**  
  - [x] Rewrite `COLLECTION_ROUTES` marketing strings in [`collections.ts`](../../src/catalog/collections.ts).  
  - [x] Align [`Hero.tsx`](../../src/components/Hero/Hero.tsx) defaults and image `alt` with the same brand voice.

- [x] **Task 2 — Contact & env (AC: 3)**  
  - [x] Introduce `VITE_SUPPORT_EMAIL` (or reuse an existing documented `VITE_*` pattern) in [`.env.example`](../../.env.example); read it in `ContactPage`.  
  - [x] Remove template comments from the **rendered** DOM where they clutter UX (HTML comments OK).

- [x] **Task 3 — Policies sweep (AC: 4)**  
  - [x] Rewrite all five policy components + index intro to operational Zephyr Lux copy.  
  - [x] Cross-check that [`usePageMeta`](../../src/seo/meta.ts) descriptions still match page intent.

- [x] **Task 4 — Footer & sale strip (AC: 5, 6)**  
  - [x] Footer link honesty + copyright year if still outdated.  
  - [x] `DiscountMessage` truthfulness.

- [x] **Task 5 — Navbar coherence (AC: 7, 8)**  
  - [x] Reconcile search + account controls with 9-2 / Epic 10 rules.

- [x] **Task 6 — Verification (AC: 9)**  
  - [x] `npm run build && npm test && npm run smoke`  
  - [x] Manual pass: `/`, `/women`, `/sale`, `/policies`, `/policies/*`, `/contact`, footer links.

## Dev Notes

### Dev Agent Guardrails

- **Truth in advertising:** Do not invent **specific** legal entities, addresses, processing times, or discount numbers **without** owner input — use **ranges**, **“typically”**, or **contact us for your region** patterns that remain honest.  
- **Scope:** **Copy and light nav/footer routing only** — no Supabase schema, no new payment paths. Do **not** implement **9-3** waitlist / **9-4** catalog rows here.  
- **Reuse:** Prefer one **support email source** for the SPA (`VITE_SUPPORT_EMAIL`) aligned with backend `SUPPORT_EMAIL` documentation in `.env.example`.  
- **Accessibility:** Policy pages stay semantic (`h1`/`h2`); changing copy must not drop heading order or landmarks from [`PolicyLayout`](../../src/components/Policies/PolicyLayout.tsx).

### Technical requirements

- **FR-CONT-001:** Policies + contact remain real, linked from footer.  
- **FR-CONT-002:** Trust copy on PDP is **not** this story’s primary target; do not weaken existing product trust blocks.  
- **UX-DR1 / UX-DR11:** Primary routes render **real** content; policies aligned to **actual** operations as far as known.

### Architecture compliance

- **Stack:** React SPA + Vite; TypeScript canonical per [`architecture.md`](../planning-artifacts/architecture.md).  
- **No new API** for contact form unless separately specified — contact remains **mailto**-centric unless PM extends.

### Library / framework requirements

- **None new.**

### File structure requirements

| Area | Action |
|------|--------|
| [`src/catalog/collections.ts`](../../src/catalog/collections.ts) | **UPDATE** — collection marketing copy |
| [`src/components/Hero/Hero.tsx`](../../src/components/Hero/Hero.tsx) | **UPDATE** — defaults + `alt` |
| [`src/components/Contact/ContactPage.tsx`](../../src/components/Contact/ContactPage.tsx) | **UPDATE** |
| [`src/components/Policies/*.tsx`](../../src/components/Policies/) | **UPDATE** — index + four policy pages |
| [`src/components/Footer/Footer.tsx`](../../src/components/Footer/Footer.tsx) | **UPDATE** |
| [`src/components/DiscountMessages/DiscountMessage.tsx`](../../src/components/DiscountMessages/DiscountMessage.tsx) | **UPDATE** |
| [`src/components/Navbar/Navbar.tsx`](../../src/components/Navbar/Navbar.tsx) | **UPDATE** — conditional on 9-2 / account rule |
| [`.env.example`](../../.env.example) | **UPDATE** — document `VITE_SUPPORT_EMAIL` (if added) |

### Testing requirements

- `npm run build`  
- `npm test`  
- `npm run smoke`  
- Update [`Navbar.scroll.test.tsx`](../../src/components/Navbar/Navbar.scroll.test.tsx) or related navbar tests if `aria-label` / disabled states change.

### Previous story intelligence

- **[9-1](9-1-fixed-assortment-pack-catalog.md)** and catalog seed work — PDP/boxer copy may already describe packs; **align** global Hero defaults so they do not contradict PDP merchandising.  
- **[9-2](9-2-storefront-product-search.md)** — search UX must stay enabled once delivered; coordinate merge order.

### Git intelligence summary

- Recent commits emphasize storefront UX / premium dark shell — **preserve** navbar scroll and mobile menu behavior when editing [`Navbar.tsx`](../../src/components/Navbar/Navbar.tsx).

### Latest tech information

- Vite **environment variables** for client: prefix with `VITE_`; document in `.env.example` only (no secrets in client bundle).

### Project context reference

- No `project-context.md` matched the BMAD skill glob in-repo; rely on this story + [`epics.md`](../planning-artifacts/epics.md) + [`architecture.md`](../planning-artifacts/architecture.md).

### References

- [Epic 9 — story 9-5](../planning-artifacts/epics.md)  
- [Sprint change §4.3 — story 9-5](../planning-artifacts/sprint-change-proposal-2026-04-30.md)  
- **FR-CONT-001..003**, **UX-DR1**, **UX-DR11** — [`epics.md`](../planning-artifacts/epics.md)

### Questions / clarifications (non-blocking)

- Owner should supply **exact** support email, **timezone**, **regions shipped**, and **return window** numbers so copy stays legally and operationally truthful.  
- If **FAQ** or **About** pages are desired as separate routes, confirm whether they belong in **9-5** or a follow-up story.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Collection hero copy and default Hero align with elevated-essentials positioning; meta descriptions follow `heroDescription` on collection routes.
- Contact uses `VITE_SUPPORT_EMAIL` with fallback `support@zephyrlux.com`; hours and online-only fulfillment spelled out; `VITE_SUPPORT_EMAIL` + `SUPPORT_EMAIL` cross-doc in `.env.example`.
- Policies index + four pages + `PolicyLayout` template comment removed; privacy/terms retain short counsel-review guardrails without “unfinished page” tone.
- Footer labels point honestly to `/contact` where there is no separate FAQ/About; dynamic copyright year; neutral “stay connected” copy.
- Sale strip uses non-numeric truthful messaging; removed legacy `DiscountMessage.js` so Vite resolves `.tsx` (`.js` was shadowing).
- Navbar: search unchanged from 9-2 pattern; user icon is **Order lookup** → `/order-status`.
- Tests: `routes.smoke.test.tsx` expectations updated for new collection titles; `Navbar.scroll.test.tsx` asserts order lookup link.

### File List

- `src/catalog/collections.ts`
- `src/components/Hero/Hero.tsx`
- `src/components/Contact/ContactPage.tsx`
- `src/components/Policies/PoliciesIndex.tsx`
- `src/components/Policies/PolicyShippingPage.tsx`
- `src/components/Policies/PolicyReturnsPage.tsx`
- `src/components/Policies/PolicyPrivacyPage.tsx`
- `src/components/Policies/PolicyTermsPage.tsx`
- `src/components/Policies/PolicyLayout.tsx`
- `src/components/Footer/Footer.tsx`
- `src/components/DiscountMessages/DiscountMessage.tsx`
- `src/components/DiscountMessages/DiscountMessage.css`
- `src/components/Navbar/Navbar.tsx`
- `src/vite-env.d.ts`
- `.env.example`
- `src/routes.smoke.test.tsx`
- `src/components/Navbar/Navbar.scroll.test.tsx`
- _Deleted:_ `src/components/DiscountMessages/DiscountMessage.js`

### Review Findings

- [x] [Review][Decision] **Confirm or soften concrete ops/legal claims in policies and contact** — No copy changes in this pass except the privacy retention patch below. **Clarification:** the post-review reply `1` meant **patch-handling option 1** (apply patches), not decision-menu “claims approved as written.” Operator/counsel should still validate stated SLAs, regions, return window, and domain before production per story Questions.

- [x] [Review][Patch] **Privacy retention copy implies customer accounts** [`src/components/Policies/PolicyPrivacyPage.tsx`] — Updated retention paragraph to order- and support-related records (no logged-in account implied).

- [x] [Review][Defer] **Smoke test couples `/products` to multi-tile catalog** [`src/routes.smoke.test.tsx`] — deferred, pre-existing bundle hygiene: new case expects more than one `catalog-product-tile`; ties smoke stability to seed/catalog breadth rather than 9-5 copy ACs.

## Change Log

- 2026-04-30 — Story 9-5: real content sweep (collections, Hero, contact, policies, footer, sale messaging, navbar order lookup); env + smoke/navbar tests; removed shadowing DiscountMessage.js.
- 2026-04-30 — Code review follow-up: privacy retention wording (order/support-related).

---

_Ultimate context engine analysis completed — comprehensive developer guide created._
