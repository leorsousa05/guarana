# Change 2026-10-05 — dashboard skill-scope counts

## Change

The Skills view now displays the number of generated skills beside each Global and Project tab label, deriving both counts from the existing `/api/skills` response. Counts appear only after a successful response; loading and network/API errors do not show false zeros. API shape, filtering, tab semantics, keyboard behavior, and ledger styles remain unchanged.

Created `.opencode/skills/dashboard-change-process/SKILL.md` to capture the reusable dashboard inspection, implementation, bundle, and validation workflow.

## Independent verification

- `node --test dashboard/web/src/components/Skills.test.mjs` — 1 passed, 0 failed.
- `npm test` — 201 passed, 0 failed across 43 suites.
- `npm run build` — Vite transformed 51 modules; dashboard build and CLI bundle synchronization passed.
- `npm run check-cli` — CLI bundle matches canonical sources.
- `npm run specs:validate` — 102 Markdown files, 15 feature specs, 19 ADRs, and 146 local links; PASS after this record was added.
- Bundle references match in `dashboard/web/dist/index.html` and `cli/dashboard/web/dist/index.html`.

**Overall:** worker-verify PASS on all six acceptance criteria in `features/dashboard/skill-scope-counts.md`.
