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

## 2026-09-09 — multiline task Markdown flattened in roadmap
- **Symptom:** Large AI-created goals and `NEXT` entries rendered as one paragraph, exposing inline `#` headings instead of separate Markdown blocks.
- **Reproduction trigger:** Bootstrap specs from a task containing multiline Markdown, or view specs created before multiline preservation was added.
- **Mitigation:** Preserve task newlines when generating specs, collect multiline tracker flags, and recover heading boundaries in the Markdown renderer for legacy one-line content.
- **Status:** Fixed in `orchestrator/specs.js`, `dashboard/server/lib/specs.js`, and `dashboard/web/src/lib/markdown.jsx`; regression coverage added to the orchestrator and dashboard parser tests.

## 2026-09-27 — workflow entered debugging after successful verification command
- **Symptom:** Workflow transitioned from `verifying` to `debugging` after a successful `git diff --check`; attempting `verify_pass` was then rejected as an illegal transition.
- **Reproduction trigger:** Run `git diff --check` during verification when the tool returns no output.
- **Mitigation:** Re-read persisted workflow state before applying transitions; investigate workflow auto-routing if reproducible.
- **Status:** Unclassified; no implementation/test failure observed (`node --test orchestrator/workflow.test.js` passed 29/29).

## 2026-09-27 — completion-memory removal initially missed workflow_tick call site
- **Symptom:** The orchestrator determinism test failed because `workflow_tick` still called the removed `saveCompletionMemory` helper.
- **Reproduction trigger:** Remove the helper and chat-driven completion call while leaving the workflow-tool completion call.
- **Mitigation:** Remove both completion call sites; regression test now asserts workflow completion leaves existing memory unchanged.
- **Status:** Unclassified and fixed; `plugin/guarana-orchestrator.test.mjs` and full `npm test` both pass after removing both completion call sites.

## 2026-09-28 — memory tool test read the real user's global preference vault
- **Symptom:** The context-size assertion saw two extra user preference nodes when `memory_get_context_for_task` defaulted to both scopes.
- **Reproduction trigger:** Run the scoped memory tool tests with the real `HOME`; the global vault contains durable preferences used by production retrieval.
- **Mitigation:** Give the test suite a temporary home directory and restore `HOME` after each test; count all typed context groups.
- **Status:** Unclassified and fixed; full `npm test` passes after isolating test HOME.

## 2026-09-28 — API test fixture omitted isolated HOME declarations
- **Symptom:** The memory API test setup referenced `oldHome` and `projectMemory` without declaring them.
- **Reproduction trigger:** Run `node --test dashboard/server/app.test.js` after adding the injection fixture.
- **Mitigation:** Declare fixture-scoped bindings, isolate HOME for the global vault, and restore it in teardown.
- **Status:** Unclassified and fixed; `dashboard/server/app.test.js` passes 7/7.

## 2026-09-28 — specs validator self-test used the parent directory as project root
- **Symptom:** The current-repository validator test reported all required `.specs` paths missing.
- **Reproduction trigger:** Resolve the repository root with one extra `..` from `cli/commands/specs.test.js`.
- **Mitigation:** Resolve the project root as two parent directories from the test file.
- **Status:** Unclassified and fixed; full `npm test` passes 179/179.

## 2026-09-28 — global graph test assumed reversed project edge direction
- **Symptom:** The scope graph test expected the seeded project edge to originate at the selected decision, but the fixture stores it as an incoming dependency.
- **Reproduction trigger:** Run `node --test dashboard/server/lib/memory.test.js` after adding global graph coverage.
- **Mitigation:** Assert that the expected project node is either endpoint of the correctly scoped edge.
- **Status:** Unclassified and fixed; focused graph test rerun pending.
