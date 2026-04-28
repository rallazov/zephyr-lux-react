# Story 5.7: Internal notes & order timeline

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Dependencies

- **[5-1](5-1-supabase-admin-auth.md)** — admin RLS **`SELECT`** on **`orders`**, **`order_items`**, **`notification_logs`** (and **`order_events`** from **5-4** migration). Do **not** duplicate read policies here.
- **[5-3](5-3-admin-order-detail.md)** — `/admin/orders/:id`, timeline composition (`buildOrderTimeline` + **`order_events`** merge).
- **[5-4](5-4-order-fulfillment-status-transitions.md)** (**hard gate**) — **`order_events`** table, admin **`SELECT`** only, **writes via `SECURITY DEFINER` RPC** using **`service_role`** from **`api/*`** after JWT verification (same pattern as **`append_order_internal_note`**). Do **not** start implementation until story **5-4** is **`done`** and its migration/API shape is accepted. Apply **`20260428190000_order_events_fulfillment_rpc.sql`** (and prerequisites) to **staging/production** before QA against live Supabase.

## Story

As a **store owner** (authenticated admin),
I want **to add internal notes that stay private to admin and show up on the order timeline with a clear time and actor trace**,
so that **FR-ADM-005** (P1), **PRD §14 E5-S7**, and **UX `OrderEventTimeline`** (private vs system events) are satisfied — **without** exposing notes to customers or storefront APIs.

## Acceptance Criteria

1. **Authoring (FR-ADM-005)**  
   **Given** an admin on **`/admin/orders/:id`** with a valid order **when** they submit a non-empty internal note **then** the note is **persisted** and **visible** on the same order detail after refresh (or equivalent client re-fetch). **Given** empty/whitespace-only input **when** they submit **then** the client or server rejects with actionable validation (no DB row).

2. **Privacy & security (FR-ADM-001, NFR-SEC-002/003)**  
   **Given** internal notes **when** any storefront or public order API is used **then** notes **must not** appear in customer-facing responses (no change to [`api/order-by-payment-intent.ts`](../../api/order-by-payment-intent.ts) contract; no new public reads of note payloads). **Given** a non-admin or missing JWT **when** the note write API is called **then** respond **403/401** consistent with [`api/admin-order-fulfillment.ts`](../../api/admin-order-fulfillment.ts) + [`api/_lib/verifyAdminJwt.ts`](../../api/_lib/verifyAdminJwt.ts) — **never** expose **`SUPABASE_SERVICE_ROLE_KEY`** to the browser.  
   **Future Epic 7 / customer timelines:** notes live as **`order_events`** rows with **`event_type = 'internal_note'`**. Any future serializer or SQL that exposes **`order_events`** to customers **must exclude** **`internal_note`** (allow-list safe **`event_type`** values or equivalent filter). Optional convention: set **`metadata.visibility = 'internal'`** on insert if that helps reviewers grep for risk — **not** required for MVP if exclusion-by-**`event_type`** is documented on the Epic 7 story.

3. **Actor & timestamp (FR-ADM-005)**  
   **Given** a persisted note **when** stored **then** the durable record includes **who** (at minimum **`actor_user_id`** in **`order_events.metadata`** and **`actor_type = 'owner'`**) and **when** (**`order_events.created_at`**). Display in admin **must** show human-readable time (reuse existing local formatting patterns from [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx)), a clear label that the row is an **internal note**, **and** a visible **actor trace** for that row (e.g. short stable label derived from **`metadata.actor_user_id`** — shortened UUID or similar **until** product adds richer identity).

4. **Timeline integration (FR-ADM-003, E5-S7, UX §Component Strategy)**  
   **Given** existing timeline rows from [`src/admin/adminOrderDetailFormat.ts`](../../src/admin/adminOrderDetailFormat.ts) (`buildOrderTimeline`) and **`order_events`** rows merged in **`mergeFulfillmentTimeline`** ([`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx)) **when** a new internal note exists **then** it appears **chronologically merged** with the same deterministic sort as today ([`compareTimelineEntries`](../../src/admin/adminOrderDetailFormat.ts)). Today’s browser query only selects **`created_at`**, **`event_type`**, **`message`** — **extend** it to **`actor_type`** + **`metadata`**, extend **`TimelineEntry`** (or add a typed variant only for **`internal_note`** rows) so **`internal_note`** rows **carry actor fields through to React**, and branch rendering on **`event_type === 'internal_note'`**. **UX:** Timeline entry for notes is **visually distinct** from system/notification-style rows (e.g. bordered callout, muted background, or “Internal note” badge — match existing Tailwind admin density; no new design system).

5. **Server authority & atomicity**  
   **Given** note persistence **when** implemented **then** use a **single server round-trip** pattern consistent with **5-4**: **Vercel `api/*` handler** verifies admin JWT, derives **`actor_user_id`** from the **verified session only** (JWT **`sub`** / Supabase user id — **never** accept actor identity from unchecked client JSON), then **`getSupabaseAdmin()`** invokes a **`SECURITY DEFINER` Postgres function** (e.g. **`append_order_internal_note(p_order_id, p_message, p_actor_user_id)`**) that **only** `INSERT`s into **`order_events`** with a **stable `event_type`** (recommended constant: **`internal_note`**). **Do not** grant blanket authenticated **`INSERT`** on **`order_events`** to the browser — keeps RLS story simple and matches table comment in [`20260428190000_order_events_fulfillment_rpc.sql`](../../supabase/migrations/20260428190000_order_events_fulfillment_rpc.sql).

6. **Constraints & abuse guardrails**  
   **Given** note text **when** accepted **then** enforce a **reasonable max length** server-side (recommend **2–10k chars**, document chosen value); reject oversize with **400** and safe message. **Given** **`message`** content **when** rendered in React **then** treat as **plain text** (no `dangerouslySetInnerHTML`); preserve newlines (`whitespace-pre-wrap` or equivalent).

7. **Legacy `orders.notes` column**  
   **Given** [`orders.notes`](../../supabase/migrations/20260427090000_orders_and_order_items.sql) may be non-null from older flows **when** implementing **then** **keep** read-only display in the “Internal notes” section **or** consolidate copy to avoid duplicate confusing blocks — **document the chosen UX** in Dev Agent Record (recommended: show **legacy** `orders.notes` under a “Legacy”/“Single-field notes” subheading if non-empty; **new** notes live as **`order_events`** only).

8. **Testing (NFR-MAINT-003)**  
   **Given** completion **when** merged **then** add **Vitest** coverage for: handler rejects non-admin; happy path inserts (mock Supabase admin client + RPC args include **`actor_user_id`** / **`internal_note`**); empty body / oversize body; optional pure helper tests for timeline labeling / **`internal_note`** merge if factored out.

## Tasks / Subtasks

- [x] **Task 1 — Migration: `append_order_internal_note` (AC: 5, 3, 6)**  
  - [x] New migration under [`supabase/migrations/`](../../supabase/migrations/): `INSERT` into **`order_events`** with `event_type = 'internal_note'`, `message = trim(p_message)`, `actor_type = 'owner'`, `metadata` including `actor_user_id` (and optional future fields).  
  - [x] Validate **paid order not required** for notes (support / CS before pay) — **unless** product explicitly forbids; default: **allow for any order row that exists**; reject if **`order_id`** not found.  
  - [x] `REVOKE ALL ON FUNCTION … FROM PUBLIC` then **`GRANT EXECUTE`** **`TO service_role`** **and** **`TO postgres`** — copy the grant pattern from **`apply_fulfillment_transition`** in [`20260428190000_order_events_fulfillment_rpc.sql`](../../supabase/migrations/20260428190000_order_events_fulfillment_rpc.sql) (~122–129).

- [x] **Task 2 — API route (AC: 2, 5, 6)**  
  - [x] Add e.g. [`api/admin-order-internal-note.ts`](../../api/admin-order-internal-note.ts): **POST**, JSON `{ "order_id": "<uuid>", "message": "..." }`, CORS consistent with [`api/admin-order-fulfillment.ts`](../../api/admin-order-fulfillment.ts).  
  - [x] `verifyAdminJwt` then **`getSupabaseAdmin().rpc('append_order_internal_note', { p_order_id, p_message, p_actor_user_id })`** where **`p_actor_user_id`** comes **only** from the verified JWT user id (same trust model as **`apply_fulfillment_transition`**).  
  - [x] Structured logging with [`api/_lib/logger.ts`](../../api/_lib/logger.ts) — **order_id** only; **never** log full note body in production paths.

- [x] **Task 3 — Admin UI (AC: 1, 3, 4, 7)**  
  - [x] [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx): labeled **textarea**, submit control (**min ~44px** height on touch targets per admin patterns), loading/error/success feedback (inline or short toast — match existing page patterns).  
  - [x] **`order_events`** select: **`created_at`**, **`event_type`**, **`message`**, **`actor_type`**, **`metadata`** (minimum for **`internal_note`** actor trace). Update **`OrderEventRow`** / **`mergeFulfillmentTimeline`** (and optionally **[`TimelineEntry`](../../src/admin/adminOrderDetailFormat.ts)**) so **`internal_note`** rows retain **`metadata`** through merge → render (**distinct styling** + **actor label** per AC3–4).  
  - [x] Timeline rendering: branch on **`event_type === 'internal_note'`** for distinct styling **and** actor line (do **not** rely solely on **`formatDomainEnumLabel(event_type)`** for titles — **`internal_note`** needs explicit copy).

- [x] **Task 4 — Tests (AC: 8)**  
  - [x] `api/admin-order-internal-note.test.ts` (or parallel to [`api/admin-order-fulfillment.handler.test.ts`](../../api/admin-order-fulfillment.handler.test.ts)).

### Review Findings

- [x] [Review][Patch] Domain errors — map using combined PostgREST `message` + `details` + `hint` (not **`message`** alone), with anchored migration fault tokens (`order_not_found`, `empty_message`, `message_too_long`). [`api/admin-order-internal-note.ts`](../../api/admin-order-internal-note.ts) · regression: Vitest asserts `details`-only fault maps to **404**.
- [x] [Review][Patch] **`INTERNAL_NOTE_MAX_CHARS` in Vitest** — binds `INTERNAL_NOTE_MAX_CHARS` from the same `./admin-order-internal-note` dynamic import as the handler (`beforeEach`). [`api/admin-order-internal-note.test.ts`](../../api/admin-order-internal-note.test.ts)
- [x] [Review][Defer] **Dev Agent Record “256 tests” line** — keep current text as historical snapshot unless refreshed on next milestone; treat as non-blocking documentation drift vs live `vitest run` totals. `_bmad-output/implementation-artifacts/5-7-internal-notes-order-timeline.md`

## Dev Notes

### Story intent

**5-3** shipped a **read-only** timeline and displayed **`orders.notes`** as static text (editing deferred to E5-S7). **5-4** added **`order_events`** for **fulfillment** transitions. **This story** completes **FR-ADM-005 / E5-S7** by making **owner-authored** entries **first-class timeline events**, preserving **admin-only** visibility and **server-side** trust.

### Dev Agent Guardrails

- **Reuse** JWT admin verification and handler structure from **`admin-order-fulfillment`** / **`admin-shipment`**; aim for **consistent** error JSON shapes and status codes where practical.  
- **Do not** add customer **`SELECT`** policies on **`order_events`**.  
- **Do not** write internal notes from Stripe webhooks or storefront — **owner UI + admin API only**.  
- **Preserve** [`apply_fulfillment_transition`](../../supabase/migrations/20260428190000_order_events_fulfillment_rpc.sql) behavior; notes RPC is **additive**.  
- **Ship actor trace in UI**, not only in DB — **`TimelineEntry`** currently has **`title`** / **`detail`** only; **`internal_note`** needs **`metadata`** surfaced or modeled explicitly so the timeline is not accidentally implemented as DB-only.

### Technical requirements

| Source | Requirement |
|--------|-------------|
| PRD §9.8 | **FR-ADM-005** — internal notes, actor, timestamp |
| PRD §14 | **E5-S7** |
| UX spec §Component Strategy | **OrderEventTimeline** — clear distinction for private notes |
| [`epics.md`](../planning-artifacts/epics.md) | FR inventory; **`order_events`** in data model §12 |
| [`architecture.md`](../planning-artifacts/architecture.md) | Serverless API + RLS boundary; TS + Zod + Vitest |

### Architecture compliance

- **Three trust zones:** note **writes** only in **`api/*`** after JWT proof; **persistence** via **service role** + **`SECURITY DEFINER`**.  
- **Boring CRUD** bucket per architecture doc — still requires **tests** at the API boundary.

### File structure expectations

| Action | Paths |
|--------|--------|
| **New** | `supabase/migrations/*_append_order_internal_note.sql`; `api/admin-order-internal-note.ts`; `api/admin-order-internal-note*.test.ts` |
| **Update** | [`src/admin/AdminOrderDetail.tsx`](../../src/admin/AdminOrderDetail.tsx); possibly [`src/admin/adminOrderDetailFormat.ts`](../../src/admin/adminOrderDetailFormat.ts) for timeline labeling helpers |
| **Register API** | Follow Vercel filesystem routing convention used by sibling `api/admin-*.ts` files |

### Testing requirements

- Mock **Supabase** admin client `rpc` chain (patterns from existing handler tests).  
- No live Supabase in CI.

### Previous story intelligence

- **[5-6](5-6-customer-shipment-notification.md)** — idempotent email markers and **`notification_logs`**; **do not** tie internal notes to Resend.  
- **[5-3](5-3-admin-order-detail.md)** — timeline tie-break and merge sort are **subtle**; extend carefully to avoid **unstable ordering**; reuse [`compareTimelineEntries`](../../src/admin/adminOrderDetailFormat.ts).  
- **[5-4](5-4-order-fulfillment-status-transitions.md)** — **RPC + service_role** is the **canonical** write pattern for **`order_events`**.

### Git intelligence (sanitized)

Recent commits on branch focus on **Epic 4** payment/notification hardening; **Epic 5** work in working tree aligns with **admin fulfillment + shipment** APIs — **extend** those patterns rather than inventing parallel auth.

### Latest technical specifics

- **`@supabase/supabase-js` ^2.104** — keep client usage aligned with [`src/lib/supabaseBrowser.ts`](../../src/lib/supabaseBrowser.ts) for reads; admin **`rpc`** via [`api/_lib/supabaseAdmin.ts`](../../api/_lib/supabaseAdmin.ts).  
- **`order_events.message`** is **`NOT NULL`** today — internal notes use **trimmed** message text as the body.

### Project context reference

- [`zephyr-lux-commerce-prd.md`](../planning-artifacts/zephyr-lux-commerce-prd.md) §9.8 (**FR-ADM-005**), §12 **`order_events`**, §14 Epic 5.  
- [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) — **OrderEventTimeline** row semantics.  
- Skill `persistent_facts` referenced `**/project-context.md` — **file not present** in repo at time of story creation.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `resolve_customization.py` requires Python 3.11+; workflow block resolved from bundled `customize.toml` (no team/user overrides).

### Completion Notes List

- **UX (AC7):** Non-empty `orders.notes` is shown under **Legacy (single-field)**; new admin-authored notes are **`order_events`** with `event_type = 'internal_note'` only. **Add timeline note** form + success line on the same section.
- **Limits (AC6):** Server-side max note length **8000** characters after trim (`append_order_internal_note` + `api/admin-order-internal-note.ts` export `INTERNAL_NOTE_MAX_CHARS`; UI constant kept in sync in `AdminOrderDetail.tsx`).
- **Timeline (AC3–4):** `TimelineEntry.internalNote` + `formatInternalNoteActorLabel` for a short actor trace; internal rows use a violet callout + plain-text body (`whitespace-pre-wrap`).
- **Tests:** `api/admin-order-internal-note.test.ts` (auth, validation, RPC args, 404); `formatInternalNoteActorLabel` in `adminOrderDetailFormat.test.ts`.
- **Regression:** Full Vitest suite passing (256 tests). `tsc --noEmit` clean. Repo ESLint still reports pre-existing issues in unrelated files.

### File List

- `supabase/migrations/20260429130000_append_order_internal_note.sql`
- `api/admin-order-internal-note.ts`
- `api/admin-order-internal-note.test.ts`
- `src/admin/adminOrderDetailFormat.ts`
- `src/admin/adminOrderDetailFormat.test.ts`
- `src/admin/AdminOrderDetail.tsx`
- `_bmad-output/implementation-artifacts/5-7-internal-notes-order-timeline.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-27 — Story 5-7: `append_order_internal_note` RPC, POST `/api/admin-order-internal-note`, admin order detail form + timeline styling, Vitest coverage.

## Saved questions / clarifications (non-blocking)

1. If product later wants **@mentions** or **rich text**, treat as **out of scope**; **`internal_note`** stays plain text.  
2. **5-4** is **`done`** in sprint tracking — **still** confirm **`order_events`** migrations are applied to **staging/production** Supabase before QA (repo **`done`** ≠ remote DB migrated).
