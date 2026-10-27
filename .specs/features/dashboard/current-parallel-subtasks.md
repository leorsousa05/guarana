# Feature spec: Dashboard Workflow current parallel subtasks

**Status: VALIDATED**

## Goal
Add a read-only current parallel-subtask view to the Dashboard Workflow screen and document it in the root README.

## Requirements
- Add an additive projection to the existing project-scoped GET /api/workflow/current; do not add a mutation API or dispatch Tasks from the Dashboard.
- Show only the current workflow's bound DAG: the latest run_start after the latest new_task or abort. After completion it may remain current until the next task or abort; do not browse historical runs.
- Return run status and update time plus task id, mode, status, and dependsOn. The UI does not require runId.
- Return parallelRun: null when no DAG is bound. When a DAG is bound but its manifest is missing, malformed, locked, unreadable, or otherwise uncertain, return a bounded unavailable state without raw filesystem errors and do not claim there is no DAG.
- Never return or render ownedPaths, absolute worktree paths, baseCommit, evidence refs, goals or conditions, prompts, worker output, raw errors, or lock identities. The sidecar remains primary-only writable.
- Add an accessible, responsive, read-only Parallel subtasks section to Workflow showing run/task status, mode, and dependency relationships, with no create/retry/cancel controls; preserve existing Workflow monitor behavior and ledger styling.
- The primary documents the current-run, read-only Dashboard projection and its boundaries in root README.md.

## Assumptions and scope
- Implementation budgets follow ADR-005 defaults: main-thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, and worker-debug 6k per dispatch; per-run hard cap 32k tokens and 15 minutes.
- Project-scoped GET /api/workflow/current projection for the current bound DAG only.
- Dashboard Workflow read-only rendering, privacy-safe unavailable/null states, and focused API/UI regression tests.
- Root README.md documentation, edited by the primary.
- No Dashboard run creation, dispatch, retry, cancel, historical browsing, workflow.json v1 change, Task-host smoke/runtime deployment, version bump, release, or push.

## Acceptance criteria
1. Route tests prove current-run binding, state-boundary behavior, no-DAG null, valid projection, and safe unavailable response for corrupt/missing bound sidecar, all under the selected project root.
2. API privacy tests seed private sentinels into every omitted manifest field/error and prove none appear in the JSON response.
3. Workflow SSR/component tests render run/task statuses, modes, dependency relationships, null and unavailable states, while proving no mutation controls or private fields are rendered.
4. Dashboard layout retains existing palette/type/rule styling, has accessible names/semantic task relations, keyboard-visible focus for any interactive elements, reduced-motion behavior, and no unintended overflow at 375px.
5. Root README.md documents the current-run read-only Dashboard projection and does not claim controls, historical browsing, or path exposure.
6. Focused API/UI tests, npm test, npm run build, npm run check-cli, Specs validation, git diff --check, and fresh independent worker-verify pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS, 6/6 criteria. It independently reproduced responsive proof with Chromium 156.0.8078.4 using a synthetic SSR fixture, the actual current Workflow component, and built CSS: CDP viewport 375x812; document/body clientWidth=375 and scrollWidth=375; Workflow/panel descendants clientWidth=scrollWidth=351 at x=12..363; overflowing=[] and wide=[]. Evidence: /tmp/opencode/dashboard-workflow-viewport/independent-proof-375.json. No real project session data or Task-host smoke test.; Focused tests: node --test dashboard/server/lib/workflow.test.js dashboard/server/app.test.js dashboard/web/src/components/Workflow.test.mjs PASS 44/44. npm test PASS 704/704 (non-failing Vite WebSocket port 24678-in-use warnings); npm run build PASS (Dashboard production build and CLI sync); npm run check-cli PASS; pre-record npm run specs:validate PASS (252 Markdown files, 99 features, 46 ADRs, 287 local links, 0 issues); git diff --check PASS.; Changed behavior paths: dashboard/server/lib/workflow.js, dashboard/server/lib/workflow.test.js, dashboard/server/app.test.js, dashboard/web/src/components/Workflow.jsx, dashboard/web/src/components/Workflow.test.mjs, dashboard/web/src/style.css, regenerated dashboard/web/dist/**, synchronized cli/dashboard/server/** and cli/dashboard/web/dist/**, and root README.md. Projection is additive and allowlisted on selected-project GET /api/workflow/current, current-run-only after the latest new_task/abort boundary, read-only, null when unbound, bounded unavailable when a bound sidecar is uncertain, and excludes private manifest fields; primary-only sidecar write ownership is unchanged.; Supplied repository facts: /home/arch/codes/Guarana, branch main, HEAD a742d7cf7459ba1a0f006ba54e309180505b8dda; working tree intentionally dirty with the TASKED planning records plus this implementation and generated CLI/Dashboard assets; no version/release-file diff. No commit, push, tag, publication, or release was requested or performed; feature is VALIDATED, not SHIPPED.
Change: .specs/changes/2026-10-27-dashboard-current-parallel-subtasks.md
<!-- guarana:record:end -->
