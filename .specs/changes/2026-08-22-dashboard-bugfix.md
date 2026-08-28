# 2026-08-22 — Dashboard bugfix: token totals, NOW-panel goal, spec goal field

**Status:** Validated (worker-verify PASS)

## Defects reported
1. Token tracking always reported `tokens: 0`.
2. The NOW panel did not show the current goal.
3. Skill instructions did not mandate a `- Goal:` line in `project-state.md` checkpoints.

## Root causes
- The telemetry plugin wrote `tokens` as an object (`{input, output, reasoning, cache}`), but `dashboard/server/index.js` only aggregated a numeric `ev.tokens`.
- `NowPanel` returned an early empty-state component that discarded the parsed goal.
- `guarana:plan` and `guarana:remember` skill instructions mentioned the goal abstractly but did not prescribe the concrete `- Goal:` checkpoint format the dashboard parser expects.

## Fixes
- `plugin/guarana-telemetry.js` and `cli/plugin/guarana-telemetry.js`: `recordTokens` now emits a numeric total.
- `dashboard/server/index.js` and `cli/dashboard/server/index.js`: unchanged, but now receive numeric token events.
- `dashboard/web/src/App.jsx` and rebuilt bundles: `NowPanel` renders the parsed goal in both empty and populated states.
- `skills/guarana/skills/plan/SKILL.md`, `skills/guarana/skills/remember/SKILL.md`, and CLI mirror copies: explicitly require a `- Goal:` checkpoint line.
- `.specs/state/project-state.md` and `.specs/state/known-issues.md` updated to record the fix.

## Verification
- Simulated token events produced correct totals in `/api/telemetry/summary` (2800 and 500 tokens in fixture runs).
- Headless snapshots confirmed the NOW panel renders the goal with telemetry present and in the empty-telemetry state.
- Confirmed skill instructions and current `project-state.md` contain a `- Goal:` line.

## Notes
- Legacy object-form token events (if any exist) still report `0` because the server only aggregates numeric `tokens`; new telemetry writes numeric totals.
- No human gate re-run performed; this is a bugfix of an already-shipped feature, validated by worker-verify.
