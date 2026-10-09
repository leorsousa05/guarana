# Change — OpenCode connected-provider model catalog

**Status:** VALIDATED · 2026-10-08

Extended advisor configuration so the CLI and dashboard can show models from
providers connected in OpenCode. Discovery uses OpenCode's `auth list` and
`models` commands, filters out disconnected providers, and returns only provider
and model metadata. The Models view offers the catalog for both primary and
advisor models while retaining manual IDs and remaining usable if discovery is
unavailable.

## Implementation

- `cli/lib/opencode-model-catalog.js` — bounded, shell-free, credential-safe
  OpenCode CLI discovery; handles ANSI/bordered auth output and fails closed on
  malformed provider rows.
- `cli/commands/advisor.js` and `cli/help.js` — `guarana advisor models
  [provider]` listing.
- `dashboard/server/routes/models.js` — `GET /api/models/catalog` for canonical
  and synchronized CLI dashboard servers, using the same catalog implementation.
- `dashboard/web/src/components/Models.jsx` — connected-model choices for both
  roles, with manual ID entry and non-blocking load/error/empty states.
- Regression tests cover actual auth-table layout, connected-provider
  filtering, provider selection, secret sanitization, dashboard API/UI, and
  canonical/mirrored route resolution.
- Design decision: [ADR-022](../decisions/ADR-022-opencode-connected-model-discovery.md).

## Validation

- `node bin/guarana.js specs validate . --json` — PASS (`ok: true`, 115 files,
  18 feature specs, 22 ADRs, 176 links).
- `npm test` — PASS, 247/247 tests across 44 suites.
- `npm run build` — PASS; dashboard built and CLI bundle synchronized.
- `npm run check-cli` — PASS, `CLI bundle matches canonical sources.`
- `npm run specs:validate` — PASS, 115 Markdown, 18 feature specs, 22 ADRs,
  176 local links.
- `git diff --check` — PASS.
- After writing this follow-up's final tracker/state/change references,
  `npm run specs:validate` — PASS (116 Markdown files, 18 feature specs, 22 ADRs,
  180 local links) and `git diff --check` — PASS.
- `node --test cli/lib/opencode-model-catalog.test.js` — PASS, 8/8.
- `node --test dashboard/server/app.test.js dashboard/web/src/components/Models.test.mjs`
  — PASS, 15/15; mirrored `node --test cli/dashboard/server/app.test.js` — PASS,
  14/14 after provisioning the declared server dependency.
- OpenCode 1.18.35 isolated smoke parsed its actual ANSI/bordered `auth list`
  output with dummy credentials and controlled `models` output. CLI, provider
  filtering, and canonical/mirrored dashboard API returned only connected
  providers. No real user auth or inference call was used.
- Independent worker-verify `ses_ee29073ddffeJLQyalwccEqndE` — PASS for criteria
  8–10 and the original packaged criterion 7; proof is in
  [advisor-flow.md](../features/orchestrator/advisor-flow.md).
