# Exploratory UI QA — findings log

Duplicate the table row block for each issue. Attach screenshots in your issue tracker or PR; here, link or filename is enough.

## How to log

| Field | Guidance |
|--------|----------|
| **ID** | Monotonic e.g. UI-001 |
| **Severity** | P0 = blocks release perception; P1 = polish; P2 = nit |
| **Route** | Path or pattern e.g. `/women`, `/product/example-slug` |
| **Viewport** | e.g. 375×812, 1440×900 |
| **Summary** | One line |
| **Checklist** | Which charter item: rhythm, grid, text, components, breakpoints, touch |
| **Evidence** | Screenshot name or URL |
| **Notes** | Repro, browser, zoom level |

---

## Findings

| ID | Severity | Route | Viewport | Summary | Checklist | Evidence | Notes |
|----|----------|-------|----------|---------|-----------|----------|-------|
| _example_ | P2 | `/` | 375 | Hero CTA not vertically centered with caption | components | `hero-375.png` | Safari iOS |
| | | | | | | | |

(Add rows above the example row or replace the example once real issues exist.)

---

## Triage gate before E2E

- [ ] All **P0** visual issues filed or fixed  
- [ ] **P1** issues either fixed or explicitly accepted  
- [ ] Charter routes re-smoked at phone + one desktop width  

Then proceed per [exploratory-ui-qa-e2e-handoff.md](./exploratory-ui-qa-e2e-handoff.md).
