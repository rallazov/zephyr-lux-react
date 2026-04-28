# Handoff: exploratory UI QA → functional / E2E automation

Run this **after** misalignment issues are triaged so tests are not chasing moving layout.

## Current test stack (repo)

- **Runner:** Vitest (`npm test`, `npm run smoke` after build)
- **UI tests:** React Testing Library + jsdom (no Playwright/Cypress in `package.json` today)
- **Existing smoke-style coverage:** e.g. `src/routes.smoke.test.tsx` for route wiring

## Invoke BMad QA automation

In Cursor, after fixes land:

> *“create qa automated tests for [feature or route]”*

Skill: **`bmad-qa-generate-e2e-tests`** (QA Automation Test, QA).  
That workflow detects the project’s framework and aligns new tests with existing patterns.

## High-value flows to automate (suggested order)

1. Home loads and main nav visible  
2. At least one **collection** route (`/women`, etc.) renders grid/hero  
3. **PDP** `/product/:slug` from catalog  
4. **Cart** add/update (if data fixtures allow)  
5. **Order status** lookup and/or token page (neutral/error/success as applicable)  
6. Policy index + one policy child route  

Prefer **stable selectors** (roles, labels) over snapshot-only layout unless you add a dedicated visual regression tool later.

## Optional later: visual regression

If capturing alignment regressions in CI becomes important, introduce snapshots (e.g. Playwright `toHaveScreenshot`) **only after** exploratory baselines are clean, or use a hosted visual-diff service. Not required for the handoff from this charter.
