# Change 2026-10-07 — native Task worker dispatch

## Change

Implemented OpenCode-native Task subagents for `worker-code`, `worker-verify`,
and failure-only `worker-debug`. The installer generates worker-agent profiles
from canonical skill bodies, installs/uninstalls them safely in project and
global scopes, and reports their health. The primary prompt and build skill now
dispatch and wait for workers; the primary retains ownership of workflow state.
The orchestrator recognizes Task child sessions, excludes them from parent
workflow prompts/transitions, rejects child `workflow_tick`, and deduplicates
parent message handling across current global/project plugin instances.

## Verification

- `node --test plugin/guarana-orchestrator.test.mjs cli/lib/agents.test.js` — PASS, 25 tests.
- `node --test orchestrator/workflow.test.js` — PASS, 35/35.
- `node --test cli/commands/plugin.test.js cli/lib/agents.test.js` — PASS, 6/6.
- `node --test cli/orchestrator/workflow.test.js cli/orchestrator/prompt.test.js` — PASS, 35/35.
- `npm test` — PASS, 213/213 tests across 43 suites.
- `npm run build` — PASS; dashboard production build and CLI synchronization.
- `npm run check-cli` — PASS.
- `npm run specs:validate` — PASS; 107 Markdown files, 16 feature specs, 20 ADRs, and 157 local links after the final proof/index links.
- OpenCode 1.18.35 project-install smoke with a clean temporary HOME — PASS. Parent `ses_ee78ad8e9ffe8G6hnVzDwBUBNM` dispatched worker-code child `ses_ee78a56acffeIhlLsZeTb64Pqq`, then worker-verify child `ses_ee789d74affeKo5qbAuJog9Y57`. The first verify surfaced a malformed temporary tracker; the parent repaired it and retried. The independent retry passed. Parent workflow history contained `new_task → plan_complete → run_start → code_complete → verify_pass` with no child-induced re-plan. The exact output file was 14 bytes (`TASK_WORKER_OK`) with no newline; specs validation returned `ok: true`, no issues. Structured Task call/result excerpts with parent/child IDs are retained in `features/orchestrator/subagent-dispatch-smoke.jsonl`.
- OpenCode `--pure` failure-path Task smoke — PASS. worker-code created an isolated fixture, worker-verify returned FAIL with byte-level evidence, then worker-debug ran only afterward, classified the unmatched symptom as `unclassified`, and appended the issue. All three operations used distinct Task child sessions; structured results are retained in the same JSONL evidence file.
- Independent worker-verify — PASS, all 6/6 acceptance criteria after re-reading the retained Task call records and rerunning all commands. It confirmed profile discovery, install safety, parent/child separation, failure-only debug, actual session IDs, 213/213 tests, production build, CLI parity, specs validation, and `git diff --check`.
