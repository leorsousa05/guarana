# Change — Optional model advisor flow

**Status:** VALIDATED · 2026-10-08

Added an opt-in `/guarana-advisor` OpenCode command that runs requests with a
configured primary model and permits one bounded, read-only native Task advice
call for a blocked context. The primary remains responsible for changes and the
existing workflow. CLI supports project/global model settings with per-field
project precedence; the dashboard edits project values and shows global fallback.
Global OpenCode artifacts honor `XDG_CONFIG_HOME`, and setup-only command state
guides configuration without executing the submitted task under an unintended
model. The canonical and packaged dashboard Models route both resolve the same
CLI settings/profile implementation.

## Implementation

- CLI: `guarana advisor read|set|clear|status`, project/global settings, model
  variants, safe profile lifecycle and XDG-aware OpenCode paths.
- OpenCode: generated `/guarana-advisor` command, configured primary agent,
  read-only advisor agent, one-consultation Task guard, and advisor-child
  workflow isolation.
- Dashboard: validated project settings API and accessible/responsive Models
  view, with field-level project/global source display.
- Architecture and criteria: [ADR-021](../decisions/ADR-021-optional-model-advisor-flow.md)
  and [feature spec/proof](../features/orchestrator/advisor-flow.md).

## Validation

- `node bin/guarana.js specs validate . --json` — PASS (`ok: true`, 113 files,
  18 feature specs, 21 ADRs, 170 links).
- `npm test` — PASS, 237/237 tests across 44 suites.
- `npm run build` — PASS, dashboard built and CLI bundle synchronized.
- `npm run check-cli` — PASS, `CLI bundle matches canonical sources.`
- `npm run specs:validate` — PASS (113 Markdown, 18 feature specs, 21 ADRs,
  170 local links).
- `git diff --check` — PASS.
- After recording this change and the final proof links, `npm run specs:validate`
  — PASS (114 Markdown files, 18 feature specs, 21 ADRs, 175 local links), and
  `git diff --check` — PASS.
- After provisioning the mirrored server's declared dependency,
  `node --test cli/dashboard/server/app.test.js` — PASS (13/13); canonical route
  tests also passed 13/13.
- OpenCode 1.18.35 isolated checks discovered setup-only and configured commands,
  project/global agents under XDG roots, and project-over-global model fallback.
  No provider/model invocation was made.
- Independent worker-verify `ses_ee34bd63fffedhz1AzXY8VJ3NQ` — PASS (7/7
  acceptance criteria); criterion evidence is recorded in the feature spec.

Full proof, including the two repaired verification findings and final pass, is
in [advisor-flow.md](../features/orchestrator/advisor-flow.md).
