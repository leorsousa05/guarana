# Change — Advisor model variant discovery and loading feedback · 2026-10-09

**Status:** VALIDATED. Independent worker-verify returned overall PASS for all five acceptance criteria. No shipping confirmation was supplied.

## Criterion-level proof

1. Configured project Primary and Advisor variant lookups run automatically: `Models.jsx:89-94,290-322`; focused checks cover both roles and skip unconfigured roles: `Models.test.mjs:110-115`.
2. Results stay associated with the matching model: `Models.jsx:181-184`; stale suggestions are hidden: `Models.test.mjs:103-108`; lookup does not overwrite the variant field: `Models.jsx:117-129`; saved value coverage: `Models.test.mjs:100-102`.
3. API `{variants:[],error}` is shown as an actionable manual/default fallback: `Models.jsx:96-105,193-198`; test: `Models.test.mjs:117-130`; safe errors: `cli/lib/opencode-model-catalog.js:216-253`.
4. Spinner, role-specific accessible status, disabled lookup, and duplicate in-flight guard: `Models.jsx:190-192,107-117,244-248`; loading/single-request checks: `Models.test.mjs:79-84,132-145`; reduced motion: `style.css:1328-1330`.
5. Existing manual/default/keyboard behavior: `Models.test.mjs:48-58,86-102`; mobile/source layout stacks below 600px and relevant fields/status wrap: `style.css:1092-1100,1120,1317-1325`.

## Validation

- `node bin/guarana.js specs validate . --json` — PASS (`ok: true`, zero issues).
- Focused Models test — PASS; the verifier did not provide the exact command.
- `npm test` — PASS (293/293).
- `npm run build` — PASS.
- `npm run check-cli` — PASS (canonical/CLI sync).
- `git diff --check` — PASS.

## Limitation

No browser/viewport tooling was available, so no rendered 375px viewport is claimed; responsive source was inspected. Feature record: [advisor variant discovery](../features/dashboard/advisor-variant-discovery.md).
