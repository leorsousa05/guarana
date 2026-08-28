# Known Issues

Open problems and material failures from the build. Entry format: title / symptom / reproduction trigger / effective or possible mitigation / status.

## 2026-08-22 — dashboard: token totals absent, NOW goal hidden, specs missing goal field
- **Symptom:** Telemetry summary always reported `tokens: 0`; the NOW panel never showed the open goal; newly scaffolded project-state lacked a `Goal:` checkpoint line.
- **Reproduction trigger:** Run the dashboard with real telemetry produced by `plugin/guarana-telemetry.js` (writes `tokens` as an object), or view the NOW panel with no runs / a freshly scaffolded `.specs/`.
- **Mitigation:** Plugin now emits a numeric token total; NOW panel renders the parsed goal even when telemetry is empty; `guarana:plan` and `guarana:remember` instructions explicitly require a `- Goal:` line in the project-state checkpoint.
- **Status:** Fixed (plugin + dashboard UI + skill instructions updated 2026-08-22); worker-verify PASS.

## 2026-08-21 — plan session skipped remember restore steps 2–3 and end-of-task state write
- **Symptom:** During the CLI feature run, the main thread restored only `.specs/README.md` (step 1) and skipped `state/project-state.md` and the ADRs; it also closed the task without the mandatory end-of-task write to `project-state.md`.
- **Reproduction trigger:** A run that starts from a tracker that looks "all done" — temptation to treat steps 2–4 as skippable.
- **Mitigation:** Restore order is "always, in this exact order" — no short-circuit even when the tracker says DONE. Detected via human audit question; state and checkpoint backfilled same day.
- **Status:** Fixed (state backfilled 2026-08-21); watch for recurrence on "green board" sessions.
