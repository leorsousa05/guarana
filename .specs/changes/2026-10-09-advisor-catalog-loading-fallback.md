# Change — Advisor catalog timeout and dashboard loading feedback · 2026-10-09

**Status:** VALIDATED. Independent worker-verify returned overall PASS (5/5). No shipping confirmation was supplied; this change is not marked SHIPPED.

## Criterion-level proof

1. Every OpenCode catalog command uses a 15000 ms timeout: `cli/lib/opencode-model-catalog.js:5,158,193,206`; `cli/lib/opencode-model-catalog.test.js:20-43` asserts the constant is exactly 15000 and every exec call receives it.
2. The dashboard preserves and displays safe `body.error` text, retains manual model-ID entry, and distinguishes successful empty results: `dashboard/web/src/components/Models.jsx:137-150`; `Models.test.mjs:147-159`.
3. Static safe failure messages do not expose raw output or credentials: `cli/lib/opencode-model-catalog.js:158-181`; `cli/lib/opencode-model-catalog.test.js:140-194`.
4. Loading has a visible spinner and status role with polite announcement and reduced-motion support: `Models.jsx:188-190`; `style.css:1122-1132,1329-1331`; `Models.test.mjs:161-174`.
5. Existing behavior, keyboard handling, responsive source, and CLI bundle sync were verified. Focused tests passed 14/14; the exact focused test command was not supplied.

## Validation

- `npm test` — PASS (293/293).
- `npm run build` — PASS.
- `npm run check-cli` — PASS (CLI bundle matches canonical sources).
- `node bin/guarana.js specs validate . --json` — PASS (`ok: true`, `issues: []`).
- `git diff --check` — PASS.

## Limitation

375px browser rendering was unavailable; responsive source was inspected, including the stack below 600px. Catalog commands can still exceed the 15000 ms timeout; safe errors and manual fallback remain available. Feature record: [Advisor catalog loading fallback](../features/dashboard/advisor-catalog-loading-fallback.md).
