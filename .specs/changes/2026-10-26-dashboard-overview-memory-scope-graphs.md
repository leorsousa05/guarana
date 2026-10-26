# Dashboard Overview memory scope graphs

**Status: VALIDATED, not SHIPPED.**

## Scope

Overview now presents separate Project knowledge and User preferences maps backed by the existing scope-filtered graph APIs. Each retains Network and exact one-hop Neighborhood views, scoped selection, active-root injection highlights, truthful per-scope states, and read-only behavior. The mobile overflow correction is Overview-only (`main.app-main:has(.ov)`) and has CSS regression coverage. No API, server, or schema changes were made.

## Verification

Fresh independent `worker-verify` returned overall PASS for all six acceptance criteria. Real Chromium against synthetic fixtures verified scope requests and separate maps, complete Network and exact Neighborhood contents, injection and selection behavior, privacy and absence of mutation requests, keyboard/focus and reduced motion. At 1440x900 and 375x812, document and body dimensions exactly matched the viewport with no overflow. No real vault/provider data or external-font production rendering was used.

- `node --test dashboard/web/src/components/Overview.test.mjs` — PASS (16/16).
- `npm test` — PASS (658/658).
- `npm run build` — PASS; Dashboard assets rebuilt and synchronized to CLI.
- `npm run check-cli` — PASS.
- `npm run specs:validate` — PASS (246 Markdown, 97 feature specs, 44 ADRs, 278 local links, 0 issues); the verifier independently reran validation with the same result.
- `git diff --check` — exit 0, no output.

## Evidence

`/tmp/opencode/overview-memory-scope-graphs-verify-20261026/results.json`, `preflight.json`, `synthetic-server.log`, `desktop.png`, `mobile.png`, and `browser-check.cjs`.

No commit, push, deploy, release, or shipping occurred.
