# Exploratory UI QA charter (feel-and-touch before functional tests)

Use this for **time-boxed, visual/tactile** passes. Defer deep functional paths unless navigation is blocked. Log issues in [exploratory-ui-qa-findings.md](./exploratory-ui-qa-findings.md).

## Time-box

| Session | Suggested duration | Focus |
|--------|---------------------|--------|
| Storefront shell + home | 45 min | Header, footer, hero rhythm, first scroll |
| Category + PLP + PDP | 60–90 min | Grids, cards, alignment, one product deep |
| Cart + checkout | 45–60 min | Form alignment, steps, error states (light) |
| Order status + policies + contact | 45 min | Typography, narrow layouts, links |

## Environment

- Run `npm run dev` (or `npm run dev:full` if APIs needed for realistic data).
- Base URL: default Vite dev origin (e.g. `http://localhost:5173`).

## Viewports and surfaces

Exercise each route at minimum:

- **Phone:** ~375px width (slow scroll, tap targets).
- **Tablet:** ~768px.
- **Desktop:** ~1024px and ~1440px.

Also: **keyboard** tab order on primary actions; **browser zoom** 110–150% to catch overflow and clipping.

## Storefront routes (under `Layout`)

| Priority | Path | Notes |
|----------|------|--------|
| P0 | `/` | Home |
| P0 | `/women`, `/men`, `/underwear`, `/kids`, `/sale` | Collection heroes + grids (see `COLLECTION_ROUTES`) |
| P0 | `/products` | Product list |
| P0 | `/product/:slug` | Pick any visible slug from list |
| P1 | `/cart` | |
| P1 | `/checkout` | |
| P1 | `/order-confirmation` | As reachable after flow or stub |
| P1 | `/order-status` | Lookup form |
| P1 | `/order-status/:token` | Magic-link style page when token available |
| P2 | `/policies`, `/policies/shipping`, `/policies/returns`, `/policies/privacy`, `/policies/terms` | |
| P2 | `/contact` | |

Admin (`/admin/...`) is optional for this charter unless the sprint targets admin UI.

## Misalignment checklist (log each hit)

- **Baseline rhythm:** uneven vertical gaps between sections/cards vs. rest of site.
- **Grid and edges:** asymmetric horizontal padding; full-bleed vs. contained sections inconsistent.
- **Text blocks:** headings and body not sharing one left edge; clipping; bad line breaks.
- **Components:** icon + label vertical alignment; buttons/chips different heights in one row.
- **Breakpoints:** jumps, overlap, or horizontal scroll between ~375 / 768 / 1024 / 1440.
- **Touch:** cramped targets; nested scroll fighting the parent.

## Structured human review (BMad)

After the pass—or for a PR/release slice—use Cursor skills in a **fresh chat** as needed:

1. **Checkpoint (human-in-the-loop):** say *“checkpoint — walk me through the UI changes on [branch/feature] for visual review.”*  
   Skill: `bmad-checkpoint-preview` (Checkpoint, CK).

2. **UX heuristics / spacing rubric:** say *“I want the UX designer (Sally) to review [page or route] for spacing and alignment consistency.”*  
   Skill: `bmad-agent-ux-designer`.

## After exploration (before investing in new automation)

1. Triage and fix **P0** layout issues from [exploratory-ui-qa-findings.md](./exploratory-ui-qa-findings.md).
2. Follow [exploratory-ui-qa-e2e-handoff.md](./exploratory-ui-qa-e2e-handoff.md) for functional/E2E automation next steps.
