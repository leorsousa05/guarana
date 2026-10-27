# Dashboard Workflow current parallel subtasks — 2026-10-27

**Status: VALIDATED, not SHIPPED.** Fresh independent `worker-verify` returned
overall PASS, 6/6 criteria. It independently reproduced responsive proof with
Chromium 156.0.8078.4 using a synthetic SSR fixture, the actual current Workflow
component, and built CSS. At CDP viewport 375×812, document/body
clientWidth=375 and scrollWidth=375; Workflow/panel descendants had
clientWidth=scrollWidth=351 at x=12..363; `overflowing=[]` and `wide=[]`.
Independent proof: `/tmp/opencode/dashboard-workflow-viewport/independent-proof-375.json`.
No real project session data or Task-host smoke test was used.

Validation: `node --test dashboard/server/lib/workflow.test.js dashboard/server/app.test.js dashboard/web/src/components/Workflow.test.mjs`
PASS (44/44); `npm test` PASS (704/704; non-failing Vite WebSocket port
24678-in-use warnings); `npm run build` PASS (Dashboard production build and
CLI sync); `npm run check-cli` PASS; pre-record `npm run specs:validate` PASS
(252 Markdown files, 99 features, 46 ADRs, 287 local links, 0 issues);
`git diff --check` PASS.

Changed behavior: `dashboard/server/lib/workflow.js`,
`dashboard/server/lib/workflow.test.js`, `dashboard/server/app.test.js`,
`dashboard/web/src/components/Workflow.jsx`,
`dashboard/web/src/components/Workflow.test.mjs`,
`dashboard/web/src/style.css`, regenerated `dashboard/web/dist/**`, synchronized
`cli/dashboard/server/**` and `cli/dashboard/web/dist/**`, and root `README.md`.
The projection is an additive allowlisted field on the selected-project current
Workflow GET, limited to the current run after the latest task/abort boundary;
it is read-only, returns null when unbound and bounded unavailable when a bound
sidecar is uncertain, and exposes no private manifest fields. Primary-only
sidecar write ownership is unchanged.

Repository context supplied for this closeout: `/home/arch/codes/Guarana`,
branch `main`, HEAD `a742d7cf7459ba1a0f006ba54e309180505b8dda`; the working tree
is intentionally dirty with the TASKED planning records plus this implementation
and generated CLI/Dashboard assets. No version/release-file diff. No commit,
push, tag, publication, or release was requested or performed; no shipping is
claimed.

## Source shipment addendum — 2026-10-27

The implementation validation checkpoint above remains historical: fresh independent `worker-verify` overall PASS, 6/6 criteria, with the synthetic Chromium 375×812 proof at `/tmp/opencode/dashboard-workflow-viewport/independent-proof-375.json`; the recorded focused/full tests, Dashboard build and CLI sync, check-cli, Specs validation, and diff-check were PASS at that checkpoint.

The separately authorized source candidate was Guarana 1.5.2, unpublished and untagged. Before commit, primary reported `npm test` 704/704; `npm run build` (60 modules plus CLI sync); `npm run check-cli`; Specs validation (254 Markdown, 100 features, 46 ADRs, 292 links, zero issues); `git diff --check`; and `npm pack --dry-run --json` inventory only (`guarana@1.5.2`, 141 files, required LICENSE/CHANGELOG.md/RELEASING.md present, no `node_modules`, canonical Dashboard server and bundle included, no tarball). Fresh candidate `worker-verify` reviewed the exact 30-path candidate and passed metadata/preservation, path-scope, required pre-push checks, and prohibited-action criteria. Its overall lifecycle verdict at that checkpoint was FAIL/incomplete only because commit/push and record closeout had not yet occurred; it reported no source fix indicated and recommended the authorized normal push. That verdict is not represented as overall PASS.

Source commit `ff10f918c67ecf7c6f85287bde93bc83a9f10655` (`feat(dashboard): add current parallel-subtask view`), parent/base `a742d7cf7459ba1a0f006ba54e309180505b8dda`, was pushed normally to `https://github.com/leorsousa05/guarana.git`; push output: `a742d7c..ff10f91 main -> main`. Immediately afterward, `git ls-remote origin refs/heads/main` returned exactly `ff10f918c67ecf7c6f85287bde93bc83a9f10655`, equal to local HEAD; the worktree was clean then. This confirms source shipment only. No Git tag, npm publication/dist-tag, GitHub Release, formal package release, or smoke test occurred.
