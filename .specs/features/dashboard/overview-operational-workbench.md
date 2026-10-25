# Feature spec: Dashboard Overview operational workbench

**Status: VALIDATED**

## Goal
Reformulate Dashboard Overview as a no-document-scroll operational dashboard showing active subagents, safe worker references, observed Advisor runtime, memory injected into the active root session, and a read-only interactive memory graph tied to that injection.

## Requirements
- At 1440x900 and 375x812, the document/body has no vertical or horizontal scrolling; contain necessary scrolling within a bounded active-worker list and keep graph navigation local to its viewport, with no clipped graph controls or workflow strip.
- Retain the actual workflow phase, task, and goal when available in a compact header/context strip, with truthful loading, empty, and unavailable states.
- Source active workers only from the existing same-origin GET /api/opencode/active-subagents projection. Display only its allowlisted agent, observed busy/running status, and opaque existing worker selection alias/reference. Preserve its aggregate/count behavior. Never expose actual OpenCode titles, IDs, parent IDs, prompts, messages, outputs, reasoning, raw payloads, credentials, or raw errors.
- Reflect observed Advisor runtime using existing Activity rootSessionFrom/latestAdvisorForRoot semantics and /api/telemetry/advisor-history or existing active telemetry; do not infer runtime from enabled configuration alone.
- Show only the latest injection for the active root session with observed busy/running status. Filter GET /api/memory/injections?limit=40 to that root without exposing session IDs in Overview DOM. Distinguish no active root, no injection for that root, loading, and unavailable/error states; never substitute another session's injection.
- Render a compact read-only graph from existing GET /api/memory/graph data, using scope-qualified IDs, confirmed project/global nodes, existing actual edges, existing project/global scope styling, and privacy rules. Visually distinguish every memory in the active root's latest injection.
- Graph node selection updates selected-node detail/summary and its actual direct relationships/neighbors. Injected memories remain visibly synchronized with the injected set. Selection does not recenter the camera or rearrange shared node coordinates, consistent with the existing Memory Map selection decision. Graph navigation remains local to its viewport; provide no relationship editing, suggestions, or graph mutation controls/API writes. Global memory remains read-only.
- Replace Runs, Decisions, memory-count summary, and Roadmap content on the main Overview with the operational workbench. Keep the current workflow phase and task/goal only as a compact header/context strip. Do not change Specs Roadmap, other pages, or the historical VALIDATED .specs/features/dashboard/overview-roadmap-bottom-section.md record and its dated receipt.
- Preserve Dashboard ledger styling and semantic/accessibility conventions, keyboard operation, visible focus, and reduced-motion behavior. Use existing same-origin routes and current projections only; make no API/backend/data/schema/plugin/profile/runtime/deployment changes.
- Use ADR-005 default budgets: main thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, and worker-debug 6k tokens per dispatch; per-run hard cap 32k tokens and 15 minutes.

## Assumptions and scope
- The user explicitly chose to preserve the existing privacy rule after initially requesting titles and short IDs; no actual worker title or ID may be displayed.
- The user explicitly chose the existing privacy/data contracts; no ADR is required.
- Main Overview component and focused regression coverage: dashboard/web/src/components/Overview.jsx and dashboard/web/src/components/Overview.test.mjs.
- Overview and responsive shell styles in dashboard/web/src/style.css, preserving ledger, accessibility, focus, and reduced-motion conventions.
- Use existing Activity and memory route/projection semantics, including dashboard/web/src/components/Activity.jsx, dashboard/server/routes/opencode.js, dashboard/server/lib/memory.js, and dashboard/web/src/components/MemoryGraph.jsx; these APIs, routes, payloads, and projections are not to be broadened or changed.
- Do not change Specs Roadmap or other pages, APIs/backend/data/schema, plugin/profile/runtime/deployment state, workflow JSON, known-issues, historical change receipts, unrelated specs, or pre-existing work. Preserve the prior VALIDATED Overview Roadmap placement record and dated receipt verbatim.
- Create this TASKED feature record and tracker and update project-state current step before implementation. No shipping/deployment claim; create any dated change receipt only after validated delivery.

## Acceptance criteria
1. At 1440x900 and 375x812, Overview creates no document/body vertical or horizontal scrolling; dynamic content is contained in bounded internal regions, responsive layout remains usable, and graph controls and workflow strip are not clipped.
2. The compact workflow strip shows actual phase/task/goal when available and truthful empty/loading/unavailable states.
3. Active workers use the existing validated projection and show only allowlisted agent, observed busy/running status, and opaque alias/reference, with explicit unavailable/no-active states; no title, real ID, prompt, or private payload is exposed and no data is fabricated.
4. Advisor status reflects observed running/non-running/unavailable runtime from existing history/active telemetry, not configuration enablement alone.
5. Injection is filtered to the latest active root session; every memory in that injection is marked in the graph. Missing active root, missing root injection, loading, and error/unavailable states are truthful and distinct. No other session's injection is shown as active.
6. The read-only graph shows scope-qualified confirmed project/global nodes and actual existing edges; emphasizes the injected set; and supports keyboard/pointer selection that updates selected detail and actual direct neighbors without moving the camera or rearranging positions. It has no graph mutation controls, no scope-ID collisions, and global remains read-only.
7. Ledger visual identity, keyboard accessibility, visible focus, and reduced-motion conventions are preserved. Existing Activity/Memory routes and APIs/payloads, privacy contracts, Specs Roadmap, data, plugin, settings, and deployment state remain unchanged.
8. Focused regression tests and synthetic browser geometry/interactions at 1440x900 and 375x812, using no real memory/session data, pass; npm test, npm run build (including CLI sync), npm run check-cli, npm run specs:validate, and git diff --check pass. No shipping/deployment claim is made.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify: overall PASS, all 8 acceptance criteria; report `overview-independent-verify.json` and script `overview-independent-verify.mjs`.; Primary focused Overview+Workflow tests: PASS 17/17; npm test: PASS 622/622; npm run build: PASS including CLI sync; npm run check-cli: PASS; pre-record npm run specs:validate: PASS (227 Markdown files, 89 feature specs, 39 ADRs, 249 local links, zero issues); git diff --check: PASS.; Synthetic browser proof from `overview-browser-proof.mjs`: 1440x900 document/body 1440x900 and 1440x870, 7/7 nodes initially visible, workflow context within bounds; 375x812 document/body 375x812 and 375x808, 4/7 nodes initially visible after local centering at scroll [86,196]. Graph/list selection preserves scroll and absolute node centers; privacy, accessibility, reduced-motion, status/error states, and read-only GET-only behavior passed using synthetic fixtures.; Primary synthetic browser script and screenshots: `overview-browser-proof.mjs`, `overview-1440x900.png`, and `overview-375x812.png`; independent proof report/script: `overview-independent-verify.json` and `overview-independent-verify.mjs`. These were temporary local synthetic-fixture evidence and are not included in the repository. No real session or memory data was used.
Change: .specs/changes/2026-10-24-dashboard-overview-operational-workbench.md
<!-- guarana:record:end -->
