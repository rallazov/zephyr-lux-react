# Test Automation Summary

## Scope

Vitest + Testing Library for fast CI. **Playwright** (`tests/e2e/`) runs manually or via `workflow_dispatch` after major storefront changes—see README **End-to-end tests**.

Vitest covers **integrated** behaviors: navbar scroll/menu dismissal, catalog loading placeholders (not shimmer skeletons—the app uses text/busy regions), and pointer hover smoke where CSS `:hover` cannot be asserted in jsdom.

**Excluded by request:** Non-integrated UI (e.g. disabled Search/Account), checkout/subscriptions flows, and pure CSS hover appearance (needs Playwright-style browser tests).

## Generated / updated tests

### Scroll & menu behavior

- [x] `src/components/Navbar/Navbar.scroll.test.tsx` — `window.scrollY` threshold toggles `.scrolled`; hamburger opens drawer with Shop/Women links; scroll and wheel close drawer; cart/collection links tolerate `userEvent.hover`.

### Mobile-oriented storefront markup

- [x] `src/components/Cart/CartPage.mobile.test.tsx` — Tailwind mobile contract: stacked `cart-line-mobile-*`, `cart-mobile-checkout-bar` (`md:hidden`, fixed bottom, safe-area padding), main `pb-28 md:pb-4`, pinned-checkout `role="note"`, `min-h-11` / `min-h-12` tap targets; desktop table shell still mounted (`columnheader` Product).

### Playwright E2E (manual / major changes)

- [x] `tests/e2e/storefront.smoke.spec.ts` — home, `/products`, `/women`; mobile drawer → Shop on narrow viewport only (skipped on desktop project).
- [x] `.github/workflows/e2e.yml` — `workflow_dispatch` only (artifact upload on failure).

### Loading placeholders (“skeleton-like” UX)

- [x] `src/components/Home/HomePage.loading.test.tsx` — loading hero copy, `aria-busy` section, “Preparing links…” until adapter resolves.
- [x] `src/components/Collection/CollectionPage.loading.test.tsx` — grid-area “Loading…” until `listProductsByCategory` resolves.
- [x] `src/components/ProductList/ProductList.test.tsx` — existing loading test retained; added hover smoke on integrated Add to Cart.

## Coverage notes

| Area | Covered in CI |
|------|----------------|
| Navbar scroll class + dismiss drawer | Yes |
| Cart mobile markup (`md:hidden`, fixed bar, tap targets) | Yes (class/DOM contract; not real viewport) |
| Playwright storefront smoke | Yes — run `npm run playwright:install` then `npm run test:e2e:ci` |
| Home/collection/list loading copy | Yes |
| CSS navbar/card hover visuals | No (browser-only) |

## Next steps

- Playwright is installed; run `npm run playwright:install` once per machine/CI image, then `npm run test:e2e:ci` after major storefront changes (see README **End-to-end tests**).
