# Change — Advisor runtime model and variant proof

**Status:** VALIDATED · source/API/UI and live child trace verified

Added a runtime trace so the dashboard distinguishes the Advisor model/variant
that OpenCode actually used from the values currently configured in the Models
form. A missing runtime variant is clearly reported rather than inferred.

## Implementation

- `plugin/guarana-telemetry.js` — records one sanitized completed
  `guarana-advisor` assistant execution with child/parent session IDs, observed
  provider/model/variant when present, timestamp, and outcome; deduplicates plugin
  copies and repeated completion events.
- `dashboard/server/routes/models.js` — `GET /api/models/runtime` returns only the
  newest allowlisted event or `{execution:null}`.
- `dashboard/web/src/components/Models.jsx`, `App.jsx`, and `style.css` — display
  current configured values separately from the last runtime observation, refresh
  via telemetry SSE, and distinguish loading/error/no-run/failed/unreported-
  variant states.
- Tests: `plugin/guarana-telemetry.test.mjs`, `dashboard/server/app.test.js`,
  and `dashboard/web/src/components/Models.test.mjs`.
- Decision: [ADR-027](../decisions/ADR-027-advisor-runtime-execution-proof.md).

## Independent evidence

- Worker-verify `ses_ee1a78643ffeTDB1oMY2PqtjLS` passed telemetry/API/UI criteria
  1–3: event sanitization and correlation, latest API execution/empty state, and
  configured-vs-observed UI states.
- Worker-verify `ses_ee1a0759fffeX2fsAzVTzrRuN1` passed criterion 4 from tagged
  OpenCode v1.18.35 source. Task selects the configured Advisor model;
  SessionPrompt resolves the profile variant against supported model variants,
  writes it to child user-message metadata, and the assistant message carries it.
- Source/API/UI verification used fixtures; the separate live Advisor Task is
  recorded below. No credentials or prompt/output text were inspected.
- Independent worker-verify `ses_ee1937079ffespVrM5TQ0uW15h` rendered the new
  Dashboard Models runtime panel at 375×812 with matching observed `openai /
  gpt-6-luna / xhigh`, missing-variant and HTTP-503 states. The missing variant
  remained explicitly unreported; the fetch error was not mislabeled as an empty
  execution state. All document/body widths were 375px, with no page errors.
  Screenshot: `/tmp/opencode/advisor-runtime-375.png`.

## Validation

- `node --test plugin/guarana-telemetry.test.mjs dashboard/server/app.test.js dashboard/web/src/components/Models.test.mjs` — PASS (33/33).
- `npm test` — PASS (259/259).
- `rtk npm run build` — PASS; dashboard built and CLI mirrors synchronized.
- `rtk npm run check-cli` — PASS; CLI bundle matches canonical sources.
- `rtk npm run specs:validate` — PASS (123 Markdown files, 18 feature specs,
  27 ADRs, 193 local links).
- `rtk git diff --check` — PASS.

## Live configured Advisor check

- Project configuration/profile status reported Primary `openai/gpt-6-luna`
  (`medium`) and Advisor `openai/gpt-5.6-luna` (`xhigh`), all managed profiles up
  to date.
- Initial calls showed token usage for `openai/gpt-5.6-luna` but no Advisor runtime
  event because project telemetry/orchestrator plugins were stale. `guarana plugin
  install --project` refreshed the plugins; `guarana plugin status --project` then
  reported them up to date. After OpenCode reload, a native Advisor Task completed
  in child session `ses_ee18381a9ffe1ZVwyYLf4B7FVu`, parent
  `ses_ee39ce5c0ffeA5wDL8irBmzskV`. The telemetry file contains completed
  `advisor-execution` events with observed `providerID=openai`,
  `modelID=gpt-5.6-luna`, and `variant=xhigh`, matching the configured profile.
- Multiple assistant turns in this child session emitted separate completion
  events, all reporting the same provider/model/variant. This proves the OpenCode
  child assistant metadata; it is not a separate provider-side attestation.
