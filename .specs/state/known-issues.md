# Known Issues

Open problems and material failures from the build. Entry format: title / symptom / reproduction trigger / effective or possible mitigation / status.

## 2026-08-22 — dashboard: token totals absent, NOW goal hidden, specs missing goal field
- **Symptom:** Telemetry summary always reported `tokens: 0`; the NOW panel never showed the open goal; newly scaffolded project-state lacked a `Goal:` checkpoint line.
- **Reproduction trigger:** Run the dashboard with real telemetry produced by `plugin/guarana-telemetry.js` (writes `tokens` as an object), or view the NOW panel with no runs / a freshly scaffolded `.specs/`.
- **Mitigation:** Plugin now emits a numeric token total; NOW panel renders the parsed goal even when telemetry is empty; `guarana:plan` and `guarana:remember` instructions explicitly require a `- Goal:` line in the project-state checkpoint.
- **Status:** Fixed (plugin + dashboard UI + skill instructions updated 2026-08-22); worker-verify PASS.

## 2026-08-31 — installed memory plugin can never load the engine (memory_* tools error)
- **Symptom:** Every `memory_*` tool (`memory_search`, `memory_save_decision`, `memory_get_context_for_task`, `memory_review_draft`) returns `memory engine not available` in a live session. Telemetry logs the call as `ok:true` (handler returns an error string, does not throw).
- **Reproduction trigger:** Run the memory plugin as actually installed by `guarana plugin install` — a **standalone copy** at `~/.config/opencode/plugins/guarana-memory.js`. Its `loadEngine()` resolves `../memory` relative to that file → `~/.config/opencode/memory` and `~/.config/memory`, neither of which exists, so it returns `null`. Slice-3 tool tests passed only because they ran the plugin **in-repo** (`plugin/../memory` exists). Exposed by the final-gate end-to-end resume scenario.
- **Secondary finding:** the installed copy is **stale** — an older 11.1K version missing the Slice-4 `compact` integration present in the repo `plugin/guarana-memory.js` (12.1K). Install was performed before the compact change; nothing re-syncs installed copies to the repo.
- **Mitigation:** make the plugin self-contained (the installer copies `memory/` alongside the plugin and resolves from there), or have the installer place the engine at `~/.config/opencode/memory`, or re-run `guarana plugin update` after syncing the bundle. Must not hardcode project paths (ADR-004/no project-specific facts).
- **Fix (2026-08-31):** `cli/commands/plugin.js`, `cli/constants.js`, `cli/lib/paths.js` — the installer now deploys the `memory/` engine to `<pluginsParent>/memory` (`~/.config/opencode/memory` global, `./.opencode/memory` project), which the plugin's existing `../memory` resolution locates. New regression test `plugin/guarana-memory.deploy.test.mjs`. `npm run sync-cli` re-synced the bundle.
- **Verification (2026-08-31):** independent worker-verify PASS (5/5): install deploys engine; stale copies refresh via marker guard; installed-copy `memory_save_decision` writes a confirmed node (no "memory engine not available") and `memory_get_context_for_task` returns a bounded subgraph; no env-specific paths; `npm test` 94/94 + `check-cli` pass. Deployed to real env: `guarana plugin install` → `updated memory engine -> ~/.config/opencode/memory`, plugin byte-identical to bundle.
- **Status:** **RESOLVED.** Fix applied/verified/deployed; final gate re-run in a fresh session **PASSED** (2026-08-31): `memory_save_decision` persisted confirmed nodes, `memory_get_context_for_task` recovered decisions/rejected alternatives/bug from the live installed plugin. Memory feature closed. Remaining only version bump + commit.

## 2026-08-21 — plan session skipped remember restore steps 2–3 and end-of-task state write
- **Symptom:** During the CLI feature run, the main thread restored only `.specs/README.md` (step 1) and skipped `state/project-state.md` and the ADRs; it also closed the task without the mandatory end-of-task write to `project-state.md`.
- **Reproduction trigger:** A run that starts from a tracker that looks "all done" — temptation to treat steps 2–4 as skippable.
- **Mitigation:** Restore order is "always, in this exact order" — no short-circuit even when the tracker says DONE. Detected via human audit question; state and checkpoint backfilled same day.
- **Status:** Fixed (state backfilled 2026-08-21); watch for recurrence on "green board" sessions.

## 2026-09-09 — verifier treated successful diff prose as a failed tool result
- **Symptom:** While the workflow was in `verifying`, a successful `git diff` was classified as a failed tool result because changed documentation contained ordinary words such as "failed" and "failure".
- **Reproduction trigger:** Run a successful text-producing command during verification whose output contains failure vocabulary in prose.
- **Mitigation:** Match error-shaped output lines (`Error:`, `not ok`, `FAIL`, `failed` at line start, process exit errors, or JSON error fields) instead of arbitrary occurrences inside prose.
- **Status:** Fixed in `orchestrator/decide.js`; regression coverage added to `orchestrator/workflow.test.js`.
