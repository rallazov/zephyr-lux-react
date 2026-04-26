# Deferred work (from reviews and triage)

## Deferred from: code review of 1-1-fix-runtime-imports (2026-04-25)

- Planning artifact `epics.md` (brownfield bullet) still describes the historical `main.tsx` → `App.js` import. Reconcile with current code when the epic list or brownfield section is next edited. Not introduced by the runtime-import fix.

## Deferred from: code review of 1-2-define-shared-commerce-domain-types.md (2026-04-26)

- **Cross-field money consistency** (`src/domain/commerce/order.ts`): No refinement tying line `total_cents` to unit price × quantity or order header totals to lines + fees; acceptable until order persistence and checkout write paths exist.

- **Timestamp fields are unvalidated strings** (`src/domain/commerce/order.ts`): Optional / event timestamps use plain `z.string()`; standardize on `z.iso.datetime()` or equivalent when API and DB contracts are fixed.

- **Sprint status YAML expanded in same change set** (`_bmad-output/implementation-artifacts/sprint-status.yaml`): Full epic/story grid added alongside domain module; split process/docs commits from code in future reviews for clarity.
