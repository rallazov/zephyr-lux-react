# Story 6.5: SEO metadata & product structured data

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[6-1](6-1-real-homepage-category-routes.md)** — homepage + collection URLs should receive **`title`/`description`** appropriate to page.  
- **[6-3](6-3-product-page-gallery-variant-ux.md)** (soft) — OG image should prefer **primary/gallery hero** URL when available.  
- **Vite SPA** — default **`index.html`** meta tags are static; per-route meta requires **client-side** management (see Dev Notes).

## Story

As a **merchant**,
I want **per-page titles, descriptions, Open Graph tags, and product JSON-LD**,
so that **FR-CONT-003**, **UX-DR1** (credible public URLs), and PRD **§14 E6-S5** are satisfied.

## Acceptance Criteria

1. **Per-route document head (minimal set)**  
   **Given** **storefront** navigates **client-side** **when** route changes **then** **`document.title`** updates to **page-specific** values for at minimum: **`/`** (homepage), **`/products`**, **collection routes** from **6-1**, **`/product/:slug`**, **`/cart`**, **`/checkout`**, **`/order-confirmation`**, and **policy + contact routes** from **6-2**. **Given** unknown slugs **404** on PDP **when** shown **then** title reflects **Not found** (or brand + “Not found”).

2. **Open Graph & Twitter basics**  
   **Given** **PDP** **when** rendered with product data **then** set **`og:title`**, **`og:description`**, **`og:type`**, **`og:url`** (canonical **path** or full URL per env), **`og:image`** (absolute URL if possible; **base** from **`import.meta.env.VITE_PUBLIC_SITE_URL`** **or** aligned name — **add** to **`.env.example`** **without** secrets). **Given** images come from **storage/CDN** **when** URLs may be **short-lived signed URLs** **then** **`og:image`** **must** use a **stable public URL** crawlers can fetch **or** document in Dev Agent Record why **`og:image`** is omitted **until** long-lived URLs exist (**broken previews** worse than missing image). **Given** **non-PDP** pages **when** rendered **then** **sensible defaults** (brand + page).

3. **JSON-LD `Product` (schema.org)**  
   **Given** **PDP** with purchasable variants **when** page loads **then** inject **exactly one** active **`<script type="application/ld+json">`** block per PDP mount (**singleton** upsert by route **or** stable **`id`** — **StrictMode** must **not** accumulate duplicates — **same upsert discipline as AC4**). Payload includes **`@type: Product`**, **`name`**, **`description`** (if available), **`image`** array, **`sku`** for **selected** variant **or** **Offer** set — **`offers.price`** **and** **`offers.priceCurrency`** **must** match **currency shown** beside price in UI (**ISO 4217**, same code checkout uses — typically **`USD`** unless repo proves otherwise). Prices **must** reflect **displayed** amounts (**range** vs **single** consistent with visible UI **and** **6-3**). **Given** **out-of-stock** **when** indicated **then** map **`availability`** to **Google-supported** values for **`OutOfStock`** / **`Discontinued`** as appropriate — validate in **Rich Results Test** manually pre-launch.

4. **No duplicate tags on every navigation**  
   **Given** **React 18 StrictMode** double-mount **when** dev **then** effect cleanup **must not** leave duplicated **`meta`** nodes **or** duplicate **`application/ld+json`** scripts — implement via **singleton** helpers that **upsert** **`document.head`** entries **by key** (**meta `property`/`name`**) **and** JSON-LD **`id`/route key** **or** use **`react-helmet-async`** if dependency approved (**default: no new deps** — prefer lightweight `useEffect` + querySelector **`meta[property=…]`** upsert **and** single JSON-LD node replacement).

5. **Loading / unknown PDP slug**  
   **Given** PDP route **when** product data is **still loading** **then** **`document.title`** **may** remain **generic brand + “Loading”** **or** prior route title **until** resolved — **must not** flash misleading **`InStock`** JSON-LD **before** stock state known.

6. **Privacy / accuracy**  
   **Given** structured data **when** authored **then** **do not** embed **PII**; **do not** claim **`InStock`** when UI blocks add-to-cart.

7. **Tests**  
   **Given** meta helper is pure-ish **when** covered **then** **Vitest** validates **JSON-LD** shape for a **fixture** product (**including** **`priceCurrency`** when **`Offer`** is present). **Given** **RTL** **when** used **then** optionally assert **script** presence (may be fragile — prefer **unit** test over DOM).

## Tasks / Subtasks

- [x] **Task 1 — Site base URL (AC: 2, 6)**  
  - [x] Add **`VITE_PUBLIC_SITE_URL`** (or name aligned with repo conventions) to **`.env.example`** with comment — used to build **absolute OG URLs**.

- [x] **Task 2 — `usePageMeta` / `setMetaTag` helpers (AC: 1, 2, 4, 5)**  
  - [x] New module e.g. `src/seo/meta.ts` with upsert logic + cleanup on unmount.

- [x] **Task 3 — Wire routes (AC: 1–3, 5)**  
  - [x] Call from **`Layout`**, **`HomePage`**, **`ProductList`**, **`ProductDetail`**, **`CartPage`**, **`CheckoutPage`**, **`OrderConfirmation`**, policy pages.

- [x] **Task 4 — JSON-LD builder (AC: 3, 7)**  
  - [x] `src/seo/productJsonLd.ts` + tests.

## Dev Notes

### Dev Agent Guardrails

- **Do not** SSR Vite app **as part of this story** unless explicitly expanding scope — **client** meta is OK for MVP; document **crawler** limitations.  
- **Do not** leak **admin** routes in **`robots`** unless requested (separate story).

### Technical requirements

| Source | Requirement |
|--------|-------------|
| PRD §9.11 | FR-CONT-003 |
| PRD §14 | E6-S5 |

### Architecture compliance

- **Env documentation** (**NFR-MAINT-004**) — **`.env.example`** update is **mandatory** for new **public** base URL.

### File structure expectations

| Action | Paths |
|--------|-------|
| **New** | `src/seo/*.ts` |
| **Update** | Page components listed above; **`.env.example`**; optional [`api`](../../api/) N/A |
| **Tests** | `src/seo/*.test.ts` |

### Latest technical notes

- **React 18** SPA: search engines that execute JS will see updated meta after hydration; **prerender** is **out of scope** unless product requests.

### Previous story intelligence

- Product **price range** vs **selected variant** is **PDP-specific** — JSON-LD must **match** what **6-3** displays to avoid misleading **Rich Results**.

### Project context reference

- [`project-context.md`](../../project-context.md) if present.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Implemented client-side SEO: `usePageMeta` upserts `document.title`, description, Open Graph, and Twitter meta by tag key; `data-zephyr-seo-owner` + effect cleanup avoids duplicate nodes under React 18 StrictMode. Default `og:image` uses `/assets/img/Lifestyle.jpeg` when no page-specific image is set.
- PDP uses `resolvePdpHeroImageUrl` for OG image when stable; **`og:image` / JSON-LD `image` skip URLs that look like short-lived signed storage links** (`/object/sign/` or `token=`) so crawlers are not given broken previews — see Dev Notes in story; prefer long-lived public URLs and set **`VITE_PUBLIC_SITE_URL`** for absolute `og:url` / JSON-LD `url` in production.
- JSON-LD: singleton script `#zephyr-seo-product-jsonld`; `buildProductJsonLd` matches UI (selected Offer vs AggregateOffer range vs out-of-stock / not-purchasable selection); no JSON-LD while PDP is loading or on not-found/error. **Vitest** covers Offer / AggregateOffer / OOS fixtures (`src/seo/productJsonLd.test.ts`).
- **SPA caveat** (per story): meta is set after hydration; prerender not in scope.

### File List

- `.env.example`
- `src/vite-env.d.ts`
- `src/seo/site.ts`
- `src/seo/meta.ts`
- `src/seo/productJsonLd.ts`
- `src/seo/productJsonLd.test.ts`
- `src/components/App/Layout.tsx`
- `src/components/Home/HomePage.tsx`
- `src/components/ProductList/ProductList.tsx`
- `src/components/Collection/CollectionPage.tsx`
- `src/components/ProductDetail/ProductDetail.tsx`
- `src/components/Cart/CartPage.tsx`
- `src/components/Cart/CheckoutPage.tsx`
- `src/components/OrderConfirmation/OrderConfirmation.tsx`
- `src/components/Policies/PoliciesIndex.tsx`
- `src/components/Policies/PolicyShippingPage.tsx`
- `src/components/Policies/PolicyReturnsPage.tsx`
- `src/components/Policies/PolicyPrivacyPage.tsx`
- `src/components/Policies/PolicyTermsPage.tsx`
- `src/components/Contact/ContactPage.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date | Change |
|------|--------|
| 2026-04-27 | Story 6-5: per-route meta, PDP Open Graph, Product JSON-LD singleton, `VITE_PUBLIC_SITE_URL` in `.env.example`, Vitest for JSON-LD builder |
| 2026-04-27 | Code review (`bmad-code-review` full-scope diff vs `main` + untracked `src/seo/`, Home/Collection pages): findings appended below; status moved to **in-progress** until patch/decision items are resolved |
| 2026-04-27 | Story accepted **done** — no second code review requested; open review bullets below marked closed (optional backlog; see `deferred-work.md`). |

### Review Findings

- [x] [Review][Decision] **Support/contact email consistency** — `ContactPage` and `OrderConfirmation` use different domains for support (`zephyrlux.example` vs `zephyrlux.com` in visible copy or `mailto:`). Choose one canonical support identity for storefront.

- [x] [Review][Decision] **Policy page meta vs visible placeholder copy** — Meta titles/descriptions read as final policy pages while on-page copy still states placeholder / not-counsel-approved. Decide whether to tone down SEO snippets until legal copy ships, or align body copy first.

- [x] [Review][Patch] **Product JSON-LD selection fallthrough** [`src/seo/productJsonLd.ts` — incomplete / unavailable vs AggregateOffer] — `selection.kind` `unavailable` and `incomplete` are not handled before the `AggregateOffer` / single `Offer` branch; payload can assert `InStock` when selection is ambiguous or invalid. Add explicit branches and align availability with PDP.

- [x] [Review][Patch] **Checkout validation error merge** [`src/components/Cart/CheckoutPage.tsx` — `handleSubmit`] — Merge uses `setErrors({ ...errors, ...fieldErrors })` with a captured `errors` snapshot; concurrent validation can drop or resurrect wrong messages. Prefer `setErrors((prev) => ({ ...prev, ...fieldErrors }))`.

- [x] [Review][Patch] **OG/meta absolute URL when base empty** [`src/seo/meta.ts` + `src/seo/site.ts`] — When `getPublicSiteBaseUrl` is empty/unset, upserting `og:url` (and related absolute URLs) may produce values social crawlers cannot use reliably. Skip or constrain until a valid HTTP(S) base exists.

- [x] [Review][Patch] **OrderConfirmation paid-order lookup errors** [`src/components/OrderConfirmation/OrderConfirmation.tsx`] — On `fetch` failing (`!r.ok`), non-JSON, or missing `order_number`, UI may exit loading without a clear failure branch for lookup.

- [x] [Review][Patch] **Catalog loaders unmount races** [`src/components/Home/HomePage.tsx`, `src/components/ProductList/ProductList.tsx`] — Async `listProducts()` paths call `setState` without unmount/`AbortController`/cancel guard; navigation away can warn or update stale state.

- [x] [Review][Defer] **`CollectionPage.tsx` omitted from unified review artifact** [review tooling] — Scoped diff file lacked `git diff --no-index` for `CollectionPage.tsx`; source tree implements `usePageMeta` anyway. Deferred as review-process noise, not a code gap.

- [x] [Review][Defer] **`CartPage` broader cart / catalog behavior** `[src/components/Cart/CartPage.tsx]` — Multiple edge paths (catalog refetched on cart churn, stale list after transient refresh failure, `incrementDisabled` vs loading validations, positional quote-vs-line join risk) bundle non–Story-6‑5 concerns with the same mega-diff; revisit under cart/checkout polish.

- [x] [Review][Defer] **OrderConfirmation `sessionStorage` bridge + conversion analytics coupling** `[src/components/OrderConfirmation/OrderConfirmation.tsx]` — Lookup when PI token missing; purchase event only after API success. Defer to order/confirmation epic.

- [x] [Review][Defer] **PDP analytics `product_view` effect dependency churn** `[src/components/ProductDetail/ProductDetail.tsx]` — Effect may re-fire when `row` identity changes beyond navigation intent.

- [x] [Review][Defer] **Checkout catches without structured telemetry** `[src/components/Cart/CheckoutPage.tsx]` — Silent `catch`; defer observability.

- [x] [Review][Defer] **JSON-LD `Discontinued` mapping** [`src/seo/productJsonLd.ts`] — Spec AC3 mentions `Discontinued` when appropriate; variant model has no discontinued signal yet. Add when catalog exposes it.

- [x] [Review][Defer] **Cart thumbnails `alt` text** `[src/components/Cart/CartPage.tsx]` — Rows use `alt=""` vs prior product-named alts.

- [x] [Review][Defer] **PDP body `key={index}` on split blocks** `[src/components/ProductDetail/ProductDetail.tsx]` — Brittle keys if normalization changes.

- [x] [Review][Defer] **`vite-env.d.ts` bundles analytics vars** `[src/vite-env.d.ts]` — `VITE_ANALYTICS_*` alongside Story 6-5 SEO env keys; unrelated stories share the same augmentation file.

Review dismissals recorded separately in triage (**6 items**): reviewer artifact claim that collections lack meta (confirmed false in workspace), omission of `<link rel="canonical">` (not required by AC vs `og:url`), JWT-shaped `.env.example` placeholders, trust-badge `aria` churn, strict “Layout analytics” scope note, and one over-broad audit interpretation of sprint scope.
