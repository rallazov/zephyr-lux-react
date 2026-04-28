# Epic 6 & 7 — implementation follow-ups

Derived from story reviews (agent). Use this during dev to avoid drift and close cross-story gaps. Not a replacement for story ACs.

## Epic 6

### During implementation

| Area | Follow-up |
|------|-----------|
| **6-1 category compare** | Pick one normalization approach early (`localeCompare` vs Unicode casefold) and unit-test it; story allows either. |
| **6-1 static fixtures** | `data/products.json` has **no `category`** today; Supabase tests use values like **`men`**. Add **`category`** to static seed (aligned to route→category map) and/or **fixtures** so collection routes and tests are not **empty-only** in static catalog mode. |
| **6-1 ↔ 6-5** | Collection URLs should be **stable** once shipped; coordinate slug/key naming between route→category map and metadata. |
| **6-1 + 6-5** | Keep **exact collection pathnames** in **one shared module** (or import the same map) so `document.title` / meta builders do not duplicate route lists. |
| **6-2 ↔ 6-1** | Navbar/footer both touch chrome. Sequence **6-1 before 6-2** (or one coordinated nav pass) to reduce merge conflicts; 6-1 fixes `/underwear` / collection map. |
| **6-2 policy copy** | AC1 “substantive placeholder” can fight **UX-DR11**. Prefer story wording toward **generic, production-safe, merchant-neutral** copy plus **Dev Agent Record** owner checklist — not copy that reads like final legal fact. |
| **6-3 ↔ 6-2** | Policy links on PDP must not 404 — ship **6-2** before or in the same release as PDP trust blocks with `/policies/*` links. |
| **6-3 gallery model** | **`galleryImages: string[]`** is underspecified vs `product_images` (**`alt_text`**, **`variant_id`**, **`sort_order`**, **`is_primary`**). Use a **structured gallery item type** in catalog/detail types so **alt** and **primary/variant precedence** stay testable (matches AC1 + Dev Notes). |
| **6-3 ↔ 6-5** | JSON-LD **`Offer`** price and visibility should **match the PDP** (selected variant vs range) after **6-3**; avoid Rich Results disagreeing with UI. |
| **6-3 ↔ 6-5** | OG image should prefer **primary/gallery hero** when **6-3** lands. |
| **6-4** | Timebox admin product form work; document in Dev Agent Record if only P0 overflow fixes ship. |
| **6-5** | Client-only meta: document crawler limitations for MVP (per story). |
| **6-5 Twitter vs OG** | Section title says **Twitter + OG** but AC2 lists only **`og:*`**. **Patch story**: add **`twitter:card`**, **`twitter:title`**, **`twitter:description`**, **`twitter:image`** where needed **or** state explicitly that **Twitter consumes OG tags** and Twitter-specific tags are out of scope. |
| **6-6 purchase + StrictMode** | A **`useRef`** fallback when `sessionStorage` fails does **not** dedupe across React 18 **StrictMode** remounts (ref resets). Require **`sessionStorage` when available**; otherwise **module-scoped** dedupe (e.g. `Set` of emitted `order_number` for the page session) — **not** component ref alone. Update **6-6** AC text accordingly at kickoff. |
| **6-6** | Confirm product expectation when **`order_number`** is missing on confirmation — **`purchase`** may be omitted per AC; avoids silent under-reporting in funnel metrics. |
| **6-6** | After choosing analytics provider, document in **`.env.example`** so GTM/Plausible/etc. is not half-integrated. |

### Suggested build order (reference)

1. **6-1** → **6-2** (unblocks PDP policy links and policy routes for **6-5**).
2. **6-3** and **6-4** in parallel if capacity allows.
3. **6-5** after **6-1** (and ideally **6-2**); tune PDP meta once **6-3** stabilizes hero/prices.
4. **6-6** last or parallel to **6-5**; watch **`Layout` / `App`** overlap when coordinating PRs.

### Validated review notes (2026-04-28)

Cross-checked against repo (`data/products.json`, story files). These are the same items as the table rows above; **prefer editing the story markdown** so implementers do not miss them.

| Story | Severity | Issue | Resolution |
|-------|----------|--------|------------|
| **6-6** | Medium | `useRef` fallback cannot guarantee no duplicate **`purchase`** under StrictMode. | **`sessionStorage`** when possible; else **module-scoped** emitted-key set — not ref-only. |
| **6-3** | Medium | `string[]` gallery drops `product_images` metadata needed for **alt** and normative precedence. | Introduce **structured gallery items** in types + mapper + tests. |
| **6-5** | Medium | “Twitter basics” in title vs **og-only** AC. | Add **`twitter:*`** AC **or** document **OG fallback only**. |
| **6-2** | Low | “Substantive placeholder” vs **UX-DR11** trust. | Tighten to **generic production-safe** + owner notes. |
| **6-1** | Low | Static catalog seed has **no `category`**; Supabase examples use **`men`**. | Extend **`data/products.json`** (and/or tests) so collections are testable off static data. |

---

## Epic 7

### During implementation

| Area | Follow-up |
|------|-----------|
| **7-1** | Use **one shared** `zod` (or equivalent) schema for `{ email, order_number }` for **both** UI and **`POST /api/order-lookup-request`** so validation never drifts from `orderNumberSchema`. |
| **7-1 ↔ 7-2** | Align **HTTP status** (e.g. 200 vs 202) and **response body shape** for valid payloads so the client cannot infer match vs no-match from differences. |
| **7-2** | **Lock** “paid-only vs allow pending” for lookup email in **one** place (constant + tests); AC allows product choice. |
| **7-2 enumeration timing** | Neutral body/status is not enough if match/no-match timing differs because the matched path waits on Resend. Return before provider latency is observable (or otherwise make valid-payload timing uniform) and test with a slow mocked transport. |
| **7-2 ↔ 6-5 env** | **`FRONTEND_URL`** (email links) vs **`VITE_PUBLIC_SITE_URL`** (storefront/OG): document both in **`.env.example`** and avoid contradictory base URLs in prod. |
| **7-3** | **`/order-status`** (form) vs token route (e.g. `/order-status/:token` or query): define **unambiguous** React Router order so the form route is not shadowed. |
| **7-3 cache control** | Tokenized status responses are bearer-token protected customer data. Add **`Cache-Control: no-store`** (and avoid logging token values) on **`GET /api/customer-order-status`** responses. |
| **7-3** | If response includes **masked email**, define an explicit mask (e.g. `j***@example.com`) so UX is consistent and not misleading. |
| **7-3 ↔ 7-2** | Reuse **token hash helper** from **7-2** in **`GET /api/customer-order-status`**; do not reimplement hashing. |
| **7-3 timeline serializer** | Event-type allow-listing should still avoid passing raw **`order_events.message`** through by default. Build customer-facing timeline text from allow-listed event fields and drop `metadata.actor_user_id`. |
| **7-4** | Clarify **three UI/API states**: tracking **hidden** (not shipped); **shipped but unavailable** (empty/stale); **full tracking**. |
| **7-4** | If `orders.fulfillment_status` and **`shipments`** disagree, define **precedence** (likely: status gates “show section,” `shipments` supplies fields) and add a test. |
| **7-4** | Prefer **one** `isSafeHttpUrl` (or extract from `customerShipmentNotification.ts`) shared with shipment email behavior. |
| **7-4 tracking URL sanitization** | Sanitize or null unsafe **`tracking_url`** in the API response, not only in the component render path; derived carrier URLs should go through the same safety helper. |

### Cross-epic (storefront discovery)

| Area | Follow-up |
|------|-----------|
| **Footer / IA** | If customers should discover lookup without email, add a **Track order** (or similar) link to **`/order-status`** in footer or help column (e.g. align with **6-2** footer work). |

### Optional / later (not required by current ACs)

| Area | Follow-up |
|------|-----------|
| **7-2** | Broader abuse controls (e.g. IP / global rate limits) beyond same email+order resend suppression — document as post-MVP if omitted. |
| **7-2 ↔ 7-3** | **Token TTL** (e.g. 24h) in email copy should match **invalid/expired** messaging on the status page. |

### Build order (strict)

**7-1 → 7-2 → 7-3 → 7-4**. Optionally ship **7-1 + 7-2** together so the form is not wired to a long-lived stub with different behavior than production.

### Validated review notes (2026-04-28)

Cross-checked against Epic 7 stories and current repo patterns (`orderNumberSchema`, `ENV.FRONTEND_URL`, Resend helpers, notification logs, `order_events`, and `shipments`). These are the highest-risk items to tighten before dev-story.

| Story | Severity | Issue | Resolution |
|-------|----------|--------|------------|
| **7-2** | High | The endpoint can still leak match/no-match by timing if matching requests wait on Resend while no-match returns immediately. | Keep the same valid-payload status/body **and** avoid observable provider latency; test with a slow mocked email transport. |
| **7-3** | Medium | Tokenized order status is bearer-token customer data, but the story does not call out no-store cache headers. | Set **`Cache-Control: no-store`** on status API responses and avoid token values in logs/errors. |
| **7-4** | Medium | AC3 focuses on safe rendering; unsafe/stale **`tracking_url`** should not be serialized as-is from the API. | Share/extract one **`isSafeHttpUrl`** helper and return a safe URL or `null`; route derived URLs through it too. |
| **7-3** | Medium | Allow-listing `order_events.event_type` is good, but raw DB **`message`** text can become an accidental customer-data leak later. | Build customer timeline copy from allow-listed event type + safe metadata; never include `actor_user_id`. |
| **7-1 ↔ 7-2 ↔ 7-3** | Low | Several contracts are still described as examples (`200` vs `202`, path vs query token, masked email “if useful”). | Lock exact status/body, token route shape, TTL, and email-mask behavior at kickoff so downstream tests do not fork. |

---

## Revision

| Date | Change |
|------|--------|
| 2026-04-28 | Initial list from epic 6 & 7 story reviews. |
| 2026-04-28 | Epic 6: validated findings (StrictMode analytics, gallery type, Twitter meta, policy copy wording, static `category` fixtures) merged into table + “Validated review notes”. |
| 2026-04-28 | Epic 7: validated findings (lookup timing side-channel, status cache headers, tracking URL sanitization, timeline serialization, contract locks) merged into table + “Validated review notes”. |
| 2026-04-29 | BMad dev-story slice: **6-6 purchase dedupe** (`sessionStorage` + module fallback). **`FRONTEND_URL` ↔ `VITE_PUBLIC_SITE_URL`** documented in `.env.example` (Epic 7 follow-ups). |

---

## Story (BMad — implementation slice)

This artifact doubles as tracking for validated follow-ups implemented outside numbered stories. This slice closes the **StrictMode duplicate `purchase` analytics** risk and reinforces **canonical URL env** documentation (**Epic 7 follow-ups**, **7-2 ↔ 6-5 env**).

## Acceptance Criteria

1. **`purchase`** analytics emits at most once per `order_number` per browser tab session when `sessionStorage` works; when storage APIs throw, duplicates are still suppressed across React StrictMode remounts (module-scoped Set — not component ref alone).
2. **`.env.example`** states that **`FRONTEND_URL`** (server / email links) uses the **same canonical origin** as **`VITE_PUBLIC_SITE_URL`** (client OG/meta) in each deployment environment.

**Documented adjacent delivery (same integration PR — traceability only, not extra AC gates):**

- Confirmation route sets title/description via shared SEO helpers (`usePageMeta`, `SITE_BRAND`) consistent with Story **6-5** direction.
- **`.env.example`** includes optional Plausible/GA4 comment block to reduce half-integrated analytics when Story **6-6** lands.

## Tasks / Subtasks

- [x] Add `consumePurchaseAnalyticsSlot` + Vitest coverage (sessionStorage path + unavailable-storage path).
- [x] Rewire `OrderConfirmation` purchase `useEffect` to the shared helper; remove ref-only guarding.
- [x] Document `FRONTEND_URL` ↔ `VITE_PUBLIC_SITE_URL` in `.env.example` (paired with Epic 7 env follow-ups).

### Review Findings

- [x] [Review][Decision] Scope beyond slice AC — **Resolved (2026-04-27): Option 1 — keep bundle.** Stakeholder input below; artifact updated so PM/QA traceability matches shipped code (adjacent delivery bullets under AC) without expanding formal AC count.

- [x] [Review][Patch] Story File List incomplete — **Resolved:** File List updated to include SEO and analytics modules consumed by `OrderConfirmation`.

### Stakeholder alignment (2026-04-27)

**Winston (System Architect)** — Bundling confirmation-page metadata with purchase instrumentation is reasonable when it reuses a single `src/seo/*` surface and ships with the same route. The maintainability risk is *silent* dependencies: mitigate with an accurate File List and explicit pointers to Stories **6-5** / **6-6**, rather than reverting working meta and forcing a second pass on the same screen.

**John (Product Manager)** — Confirmation-page SEO is user-visible (share previews, trust). Optional analytics env documentation reduces “half-integrated 6-6” operational risk. The non-negotiable is honesty in the story artifact: narrative must reflect what merged so validation scope is clear. Prefer documenting adjacent delivery beside the AC list over pretending the slice is only two bullets of code.

## Dev Agent Record

### Implementation Plan

Centralize **`purchase`** dedupe before `dispatchAnalyticsEvent` in `purchaseDedupe.ts`: marker in `sessionStorage` when usable; **`Set`** fallback when `sessionStorage` throws — addresses React 18 StrictMode (`useRef` reset) per validated Epic 6 table.

### Debug Log

- None.

### Completion Notes

Addressed Epic 6 validated row **6-6 StrictMode / ref**. **Footer → `/order-status`** deliberately skipped: route not implemented until Epic **7-1**. **Structured PDP gallery**, **timing-safe order lookup**, **customer status API headers**, etc. remain in Epic 6–7 numbered stories.

Post–code-review (Architect + PO): kept confirmation **SEO** and **analytics env** documentation in the same integration as purchase dedupe; documented under “Adjacent delivery” for traceability. Numbered Stories **6-5** / **6-6** still own full breadth of metadata and analytics product requirements.

### File List

- `src/analytics/purchaseDedupe.ts`
- `src/analytics/purchaseDedupe.test.ts`
- `src/analytics/events.ts` (event names; `OrderConfirmation` import)
- `src/analytics/sink.ts` (`dispatchAnalyticsEvent`; `OrderConfirmation` import)
- `src/components/OrderConfirmation/OrderConfirmation.tsx`
- `src/seo/meta.ts` (`usePageMeta`, `formatPageTitleWithBrand`)
- `src/seo/site.ts` (`SITE_BRAND`)
- `.env.example` (paired `FRONTEND_URL` + `VITE_PUBLIC_SITE_URL`, Epic 7 env follow-ups; optional analytics vars)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-04-29** — StrictMode-safe purchase analytics; sprint status `epic-6-7-implementation-follow-ups` → review (after tests green).
- **2026-04-27** — Code review closed: Architect + PO alignment recorded; adjacent delivery documented; File List completed; status → done.

## Status

done
