# Feature spec: Dashboard Overview memory scope graphs

**Status: SHIPPED**

## Goal
Update Dashboard Overview to present independent Project knowledge and User preferences memory graphs from their existing scope-filtered graph endpoints while retaining active-root injection highlights.

## Requirements
- Show two distinct Overview graphs named Project knowledge and User preferences, using GET /api/memory/graph?scope=project and GET /api/memory/graph?scope=global respectively; global scope represents confirmed global preferences.
- Each read-only map offers Network and Neighborhood modes, with Network as the default and showing all nodes and actual edges in that scope; Neighborhood shows exactly the selected node, its immediate connected nodes in that scope, and their actual connecting edges. Indicate edge direction and type, and use the existing deterministic bubble layout and scope-qualified IDs.
- Keep selection and mode independent per scope. Map, index, and injection selection remains scoped; active-root injected IDs highlight only their matching graph. Initial selection prefers an injected node in that scope and then the first available node. A root or injection change safely resets the relevant selection.
- Provide truthful loading, error, and empty states independently per scope. Do not expose private session identifiers or raw errors. Retain the existing injection list and provide no mutation controls.
- Preserve Overview no-document-scroll, ledger styling, accessibility, keyboard, focus, and reduced-motion behavior; verify no page overflow at 1440x900 and 375x812.
- Add tests for scoped graph data, edge filtering, mode and selection synchronization, injection highlights, endpoint contracts, and per-scope states.

## Assumptions and scope
- Dashboard Overview UI, client tests, and styles.
- The new Dashboard Overview memory-scope feature record, its .specs/README.md tracker entry, and the active TASKED pointer in .specs/state/project-state.md.
- Do not change API, server, or data contracts; do not change the previously validated historical Overview artifact or its change/proof record. Source shipment to GitHub `origin/main` is confirmed; no tag, npm publication, GitHub Release, or package release occurred.

## Acceptance criteria
1. Overview renders distinct Project knowledge and User preferences graphs backed by their exact scope-filtered endpoints, with confirmed global preferences in the global graph.
2. Each read-only graph defaults to Network with all scoped nodes and actual edges and offers Neighborhood containing exactly the selected node, immediate connected scoped nodes, and actual connecting edges; direction and type are indicated, with deterministic bubble layout and scope-qualified identities.
3. Each graph retains independent selection and mode. All selection sources remain scoped, injected IDs highlight only matching-scope nodes, initial selection prefers a scope-matching injected node then the first available node, and root/injection changes safely reset relevant selection.
4. Each scope has truthful loading, error, and empty states; private session identifiers and raw errors are absent; the existing injection list remains; no mutation controls are present.
5. Overview preserves no-document-scroll, ledger, accessibility, keyboard, focus, and reduced-motion behavior, with no page overflow at 1440x900 and 375x812.
6. Tests cover scoped data, edge filtering, mode/selection synchronization, injection highlights, endpoint contracts, and per-scope states. No API/server/data-contract change or alteration to the previous validated Overview artifact occurs.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: Fresh independent worker-verify overall PASS (6/6). Real Chromium against synthetic fixtures at 1440x900 and 375x812: document/body dimensions exactly matched each viewport with no overflow; verified scoped requests, separate maps, complete Network, exact Neighborhood, injection/selection, privacy and no mutation requests, keyboard/focus, and reduced motion. Evidence: /tmp/opencode/overview-memory-scope-graphs-verify-20261026/results.json, preflight.json, synthetic-server.log, desktop.png, mobile.png, browser-check.cjs. No real vault/provider data or external-font production rendering.; node --test dashboard/web/src/components/Overview.test.mjs PASS (16/16); npm test PASS (658/658); npm run build PASS (Dashboard assets rebuilt and synchronized to CLI); npm run check-cli PASS; npm run specs:validate PASS (246 Markdown, 97 feature specs, 44 ADRs, 278 local links, 0 issues), independently rerun by verifier with same result; git diff --check exit 0 with no output.; No API/server/schema changes.; Independent worker-verify PASS confirms origin/main advertises exactly 037a315a4fcdf302a8dabcfe08d2e823d35a54d3, commit subject feat(dashboard): split Overview memory graphs, parent c623ade558de87073fdb5c871b2f3680c9ae8bbf, and all reviewed changes included. origin/main reflog shows prior c623ade before this update. Exact normal push output: c623ade..037a315 main -> main. Candidate /home/arch/codes/Guarana was on branch main at that HEAD; its working tree immediately after push was clean (no staged, unstaged, or untracked paths). The user explicitly authorized all pending changes. No tag, npm publish, GitHub Release, or package release occurred.
Change: .specs/changes/2026-10-26-dashboard-overview-memory-scope-graphs.md
<!-- guarana:record:end -->
