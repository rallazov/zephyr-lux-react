---
title: Sprint Change Proposal — Epic 9 catalog realism & discovery
type: correct-course
created: '2026-04-30'
status: approved
approved_at: '2026-04-30'
communication_language: English
---

# Sprint Change Proposal (Correct Course)

## Section 1 — Issue summary

**Trigger:** Post–Epic 8, the owner wants the storefront to reflect real merchandising: the flagship SKU is a **fixed-assortment pack** (one unit sold = one black + one blue garment), but the live catalog and PDP still behave like **mutually exclusive color choices**. Separately, the site needs **credibility density** (more products/categories, real content), **discovery** (search), **demand capture** (waitlist on not-yet-stock items), and lightweight **order artifacts** (print-friendly views). Larger items—logged-in customer accounts, arbitrary variant “template builders,” and customer push/SMS—are explicitly deferred.

**Context:** Canonical catalog is Supabase (`products`, `product_variants`, `product_images`). PDP variant UX (`computeOptionLayout` in `variantSelection.ts`) already hides the color control when purchasable variants expose **at most one distinct color**—so the correct modeling for a pack is primarily **data + copy**, not a redesign of checkout.

**Evidence:**

- Seed shows multiple SKUs differing by **both** size and color (`supabase/seed.sql`), which drives two-dimensional selection.
- FR-SF-005 (search/filter) remains P2 in `epics.md`; footer/nav historically had placeholder search.
- PRD and epic backlog did not yet encode `coming_soon` listings or per-product waitlist.

---

## Section 1b — Industry patterns: fixed-assortment / bulk packs

These are common, boring approaches that avoid misleading shoppers:

| Pattern | When to use | Notes |
|--------|-------------|--------|
| **Single sellable SKU (pack UOM)** | One retail unit = fixed contents (your case) | Inventory, pricing, and decrement are **per pack**. Contents are explained in title, bullets, or specs—not via a fake color swatch. |
| **Configurable bundle** | Customer chooses components | Needs bundle rules UI and cart composition (you do **not** need this for a fixed black+blue pack). |
| **Multi-pack quantity** | Same SKU, buyer picks count | Straightforward `qty` only; still one variant axis if contents are fixed. |

**Recommendation for Zephyr Lux:** Treat the 2-color pack as **one variant per purchasable size** (e.g. S–XL), with **no real color choice**: either `color` **NULL on all pack variants** or the **same display string on every row** (e.g. `Black & Blue`). PDP then shows **size only** (already supported). Surface “Includes 1× Black, 1× Blue” in description or a short **pack contents** line on the PDP.

**Coming soon + waitlist:** Use a dedicated **`coming_soon` visibility state** (see Epic 9 stories) so PLP/PDP can show serious assortment without implying checkout is available; capture email + `product_id` for reorder signals.

---

## Section 2 — Impact analysis

### Epic impact

| Epic | Impact |
|------|--------|
| **Epic 2 (catalog)** | Seed + production data alignment; possible enum/status extension for `coming_soon`. |
| **Epic 6 (storefront)** | Search UI/route; collection/grid density; placeholder replacement. |
| **Epic 7 (order lookup)** | Printable stylesheet builds on existing customer order status page. |
| **New Epic 9** | Primary home for scope below. |
| **Epic 10–11 (new, backlog)** | No immediate code; captures deferred strategic work. |

### Story / artifact impact

- **`supabase/seed.sql`** — Rewrite boxer-briefs variants to pack semantics; add placeholder products as approved.
- **Migrations** — Likely: extend `product_status` (or equivalent) for `coming_soon`; `product_waitlist_signups` table; RLS for anon read of coming-soon rows where intended.
- **Handlers** — Waitlist POST endpoint (service role insert); optional rate limit note in `deferred-work`-style follow-ups.
- **PRD / epics** — Append Epic 9–11 narrative; map FR-SF-005 to concrete search story.

### Technical / ops

- Email provider unchanged for waitlist (new template optional).
- No Railway/Vercel split change (per frozen platform spec).

---

## Section 3 — Recommended approach

**Selected path:** **Direct adjustment** within Epic 9 (Option 1 from checklist §4), plus **explicit backlog epics** for account login and variant-template UI (Option 1 deferral, not MVP rollback).

**Rationale:**

- Pack correction fits existing variant and PDP rules—low risk.
- Search + real content + waitlist increase perceived legitimacy without auth complexity.
- Customer accounts and dynamic variant builders fail your stated “useful vs complexity” bar for this phase.

**Effort:** Moderate (mostly storefront + one migration + seed).  
**Risk:** Low–medium (RLS/policy mistakes on `coming_soon` visibility are the main hazard).

---

## Section 4 — Detailed change proposals

### 4.1 PRD (incremental edit targets)

When editing `zephyr-lux-commerce-prd.md`, add/adjust:

- **§5 / catalog:** Explicit requirement that **fixed-assortment products** do not expose meaningless color axes; contents described in copy or structured “included items” later.
- **§9.1 / FR-CAT:** Clarify that variant rows may represent **pack UOM**; color/size remain strings but UX hides axes per layout rules.
- **FR-SF-005:** Elevate minimal **title/category search** from “should” to agreed MVP+ scope for Epic 9.

### 4.2 Epics (`epics.md`)

Append **Epic 9–11** block (also mirrored in repo appendix section—see git).

### 4.3 Stories — Epic 9 (implementation order)

| ID | Story | Dependencies |
|----|-------|----------------|
| **9-1** | **Fixed-assortment pack catalog** — Align boxer-briefs (and prod DB) to size-only purchasable variants with identical/null color; hero copy lists included colors; discontinue or archive legacy single-color SKUs per owner decision; admin save smoke tests. | — |
| **9-2** | **Storefront product search** — Entry point from nav; query filters active products by title/category (client or lightweight API); empty state; keyboard/a11y. | 9-1 optional parallel |
| **9-3** | **`coming_soon` + per-product waitlist** — Migration for listing state; PDP/PLP badges; POST waitlist `{ email, product_id }`; duplicate signup tolerated or upsert; privacy note on PDP. | Migration before 9-4 |
| **9-4** | **Placeholder assortment + imagery** — Additional products/categories (mix active + `coming_soon`); real-ish imagery paths or uploads; keeps PLP busy without lying about checkout. | After 9-3 |
| **9-5** | **Placeholder content sweep** — Audit collection/home/help tabs still using filler; replace with owner-supplied or concise real copy (tie to FR-CONT / UX-DR1). | Parallel |
| **9-6** | **Print-friendly order views** — `@media print` (and optional “Print” control) on customer order status + admin order detail packing slip–friendly layout. | — |

### 4.4 Deferred — Epic 10 & 11 (backlog only)

- **Epic 10 — Customer accounts:** Supabase customer auth, `/account`, order history linked to customer row; guest + magic link remain.  
- **Epic 11 — Variant template builder:** Admin-defined axes beyond size/color; deferred until multiple product families need it.

---

## Section 5 — Implementation handoff

| Scope | Classification | Primary owner |
|-------|----------------|---------------|
| Epic 9 stories | **Moderate** — migrations + UI + seed | Dev agent (`bmad-dev-story` / `bmad-quick-dev`) |
| PRD/epic text edits | **Minor** | PM or self |
| Epic 10–11 | **Major** — future phase | Architect + PM before implementation |

**Success criteria**

- Pack PDP: size selector only; clear pack contents; checkout decrements pack SKU inventory.
- Search returns relevant products on real catalog sizes.
- At least one `coming_soon` product visible with working waitlist capture stored in DB.
- Print preview for order status usable for customer support.

---

## Section 6 — Checklist trace (Correct Course)

| Section | Summary status |
|---------|----------------|
| 1 Trigger | Done — pack semantics + discovery + waitlist |
| 2 Epic impact | Done — Epic 9 add; 10–11 backlog |
| 3 Artifacts | Done — PRD touch-ups, seed, migrations, handlers |
| 4 Path forward | Done — Direct adjustment + deferred epics |
| 5 Proposal components | Done — this document |
| 6 Final review | Done — approved **2026-04-30** (owner confirmation in chat) |

---

## Approval

- [x] Approved as-is  
- [ ] Revise: ___________________________

Implementers: create story files under `_bmad-output/implementation-artifacts/` for `9-1` … `9-6` and run dev workflow per story (`bmad-create-story` → `bmad-dev-story`, or `bmad-quick-dev`).
