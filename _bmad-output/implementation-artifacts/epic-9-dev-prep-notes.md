# Epic 9 — pre-development notes

**Purpose:** Single place to read before implementing stories **9-2 … 9-6**. Source: story files, [_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-30.md](../planning-artifacts/sprint-change-proposal-2026-04-30.md), and code review triage (2026-04-30).

**Approved scope anchor:** Sprint change proposal §4.3 (stories table + success criteria).

---

## 1. Recommended implementation order

| Order | Story | Rationale |
|-------|-------|-----------|
| 0 | **Land 9-1 cleanly** | `data/products.json`, `supabase/seed.sql`, `ProductDetail*`, handler tests, `routes.smoke.test.tsx` overlap with 9-3/9-4. Merge or commit 9-1 before starting 9-3/9-4 to avoid thrash. |
| 1 | **9-2** Search | Independent of `coming_soon`; coordinate **Navbar** with 9-5 later. |
| 2 | **9-3** `coming_soon` + waitlist | **Linchpin:** enum migration, RLS, parse/adapter, quote guard, PDP/PLP, API. Must complete before **9-4**. |
| 3 | **9-4** Catalog expansion | Hard prerequisite: 9-3 list/detail + quote behavior for `coming_soon`. |
| 4 | **9-5** Content sweep | After **9-2** (or same branch): AC7 forbids re-disabling search. Needs owner copy inputs (see §6). |
| Any | **9-6** Print views | Independent of catalog/search; safe in parallel once someone owns layout/CSS risk. |

**Sprint YAML** encodes `ready-for-dev` for several stories at once; **logical** order is above.

---

## 2. Cross-cutting technical contract (do not duplicate)

**Problem:** Listability is expressed in three places today:

- `src/catalog/parse.ts` — `isStorefrontBrowsableProduct` (currently **active only**).
- `src/catalog/adapter.ts` — `SupabaseCatalogAdapter` **`.eq("status", "active")`** on list + bySlug.
- Future **9-2** search filter over `listProducts()`.

**Requirement for 9-3 (+ 9-2 follow-through):**

1. Introduce **one** shared rule for “storefront listable” (extend existing `isStorefrontBrowsableProduct` or rename to e.g. `isStorefrontListableProduct`) that includes **`active` and `coming_soon`** for browse/search/parse static path.
2. **Supabase adapter** must use the same allowlist (`.in("status", …)` or equivalent), not a second hard-coded policy.
3. **9-2** implementer (or 9-3 Task 4) must **not** hand-roll `status === 'active'` in search if 9-3 already widened the adapter—prefer filtering the same list the PLP uses.

**Performance:** Dev note in 9-2 already mentions ~500 rows for client-side filter; if catalog grows past that, plan a follow-up (not blocking MVP).

---

## 3. Story-specific implementation notes

### 9-1 (done) — hygiene before other epic work

- Confirm **`npm run build`**, **`npm test`**, **`npm run smoke`** were run on the merge that closed 9-1 (AC9).
- **Production Supabase:** If live DB still has legacy **`ZLX-BLK-*` / `ZLX-BLU-*`** active for `boxer-briefs`, run the operator checklist (also recorded under [deferred-work.md](deferred-work.md) § “Epic 9 / 9-1 production”) **before** applying 9-3 migrations on production.
- Story file **Change Log** line that still says “sprint status → review” should be updated to **done** when someone touches the file.

### 9-2 — Storefront search

- **AC8** (“do not require 9-1 merge”) is **obsolete** now that 9-1 is done—remove or reword when editing the story.
- **Pin nav shape:** AC1 allows optional visible “Search” link; pick **yes or no** and align with **9-5** (navbar edits).
- **Deep link:** Promote **`/search?q=…`** to an **AC** (sync URL ↔ input); it currently lives only in Task 3.
- **Listability:** Add explicit note to use the **shared listability helper** once 9-3 exists; until 9-3, adapter is active-only by design.

### 9-3 — `coming_soon` + waitlist

- **Migrations:** Split so enum extension is safe on managed Postgres:
  - Migration **A:** `ALTER TYPE … ADD VALUE 'coming_soon'` only (nothing in the same transaction that *uses* the new value if your provider is picky).
  - Migration **B:** Policies, `product_waitlist_signups`, `admin_save_product_bundle` patch (`CREATE OR REPLACE`), etc.
- **`admin_save_product_bundle`:** Current guard requires variants only when `v_status = 'active'` (`20260428104600_…sql`). Extend to **`active OR coming_soon`** in a **new** migration only.
- **PDP gating (AC7):** Drive **coming soon UX only from `product.status === 'coming_soon'`**, not from “`getPurchasableVariants` is empty”—otherwise an **active** product with no stock mimics coming soon.
- **Quote (AC5):** Pick **one** `QuoteError` code (e.g. `NOT_FOR_SALE` vs reuse `INVALID_LINE`) in the story; require **`cart-quote.ts` and `create-payment-intent.ts`** to map it to **400** consistently.
- **Waitlist handler (AC8):** Repeat **trim + lower** on email in the handler AC; require **`z.string().email()`**. Optional **per-IP rate limit**—if skipped, log under [deferred-work.md](deferred-work.md).
- **Tests (AC12):** Add explicit coverage: load **`/product/<coming-soon-slug>`** — PDP renders, **no** add-to-cart, waitlist form present.
- **Subscriptions:** RLS keeps `product_subscription_plans` storefront reads on **`active`** products only—good. **MVP:** Do not show subscription / subscribe UI on **`coming_soon`** PDP even if a future data mistake occurs (defense in depth).

### 9-4 — Catalog expansion

- **Prerequisite:** 9-3 merged; story AC1 is explicit—do not start on a branch without `coming_soon` behavior.
- **Stale prose:** Remove “**9-3 (not authored in repo yet)**” from Dev Notes—replace with pointer to **9-3** story file.
- **AC hardening (recommended):** Every `image_url` / hero path **resolves to a file under `public/`** (or documented CDN parity)—avoid silent 404s.
- **Measurable caps:** Replace “moderate” with something checkable (e.g. JSON size / max product count for MVP).
- **Numeric ids:** Reserve a band (e.g. **102–199** for expansion); flag **101** as reserved for flagship `legacy_storefront_id`.
- **Ethics:** Promote **sale** / fake discount concern from “Questions” to an **AC** if merchandising must stay truthful.

### 9-5 — Content / placeholder sweep

- **Pre-dev intake:** Owner must supply (or explicitly defer with honest fallback copy): support email, hours, timezone, regions shipped, return window. Story is `ready-for-dev` but copy is blocked on inputs.
- **Resolve either/or ACs** so nobody waits mid-sprint:
  - **AC5** Footer: default **relabel** links vs adding `/about` `/faq` unless content exists.
  - **AC6** `DiscountMessage`: default to **non-numeric** promo CTA unless owner supplies real percentages.
  - **AC8** Account: default honest label—e.g. **“Order lookup”** → `/order-status` vs fake login.
- **AC4 policies:** Consider one cheap test per page that a known **placeholder substring** cannot return.
- **`VITE_SUPPORT_EMAIL`:** Add to `.env.example`; public bundle is OK for a support address.

### 9-6 — Printable order views

- **Fix broken markdown links** in the story body: `../../planning-artifacts/…` and `../../admin/AdminOwnerPushPanel.tsx` should be **`../planning-artifacts/…`** and **`../../src/admin/AdminOwnerPushPanel.tsx`** (same folder pattern as 9-1).
- **`Layout.tsx`:** First **`useMatch`**—scope **print chrome hiding** to **`/order-status/:token`** only; **`/order-status`** (lookup form **without** token) must keep **header/footer**.
- **Cleanup:** Remove fluff line and **`{{agent_model_name_version}}`** from Dev Agent Record when implementing.
- **Optional stretch:** Playwright `page.emulateMedia({ media: 'print' })` smoke—manual AC6 remains primary.

---

## 4. Files that often conflict (serialize or one branch)

- `src/components/Navbar/Navbar.tsx` — **9-2** + **9-5**
- `data/products.json`, `supabase/seed.sql` — **9-3**, **9-4**, residual **9-1**
- `src/catalog/parse.ts`, `src/catalog/adapter.ts` — **9-2**, **9-3**

---

## 5. Definition of Done (Epic 9 stories)

Per story: **`npm run build`**, **`npm test`**, **`npm run smoke`** pass unless a story explicitly narrows (none should).

---

## 6. Owner / PM inputs before 9-5 starts

- Support email (and whether it matches server `SUPPORT_EMAIL` story).
- Support hours + **IANA timezone**.
- Ships to: regions/countries (or “contact us for international”).
- Return window and high-level shipping SLA (ranges like “typically 3–5 business days” OK if honest).
- Sale messaging: real discount rules vs non-numeric CTA only.

---

## 7. Reference docs

- [sprint-change-proposal-2026-04-30.md](../planning-artifacts/sprint-change-proposal-2026-04-30.md)
- [epics.md](../planning-artifacts/epics.md) — Epic 9 appendix, FR/UX IDs cited in stories
- Story files: `9-1` … `9-6` in this folder
