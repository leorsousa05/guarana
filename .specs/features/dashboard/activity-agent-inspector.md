# Feature spec: Dashboard activity agent inspector

**Status: VALIDATED**

## Goal
Design the authorized /now dashboard interaction as a visual inspector for how Guarana subagents work, with an agent-tree overview and selected-session detail rather than a metrics-first dashboard.

## Requirements
- Group parent and child sessions as an agent tree and clearly count currently running subagents.
- Show each agent/session's observed status, observed activity/tool events, and elapsed time or start time; order active agents first and keep completed agents visible.
- Show terminal completion time only when telemetry has an explicit terminal-status timestamp; otherwise label the time as last observed and never infer a finish time.
- Do not capture or show a separate task title or prompt; derive current activity solely from observed events/tools.
- Selecting an agent/session shows its session-specific safe activity timeline.
- Keep memory history out of the normal overview. Provide a control on selected-agent detail that is closed and hides history initially; on demand, show only that session's memory-injection history, timestamps, and hydrated referenced nodes.
- Use the existing MemoryInjections component and existing /api/memory/injections API; do not change API payloads.
- Do not expose hidden reasoning, raw prompts or outputs, raw errors, credentials, or memory payloads in the global feed; show hydrated memory text only in explicit selected-session detail.
- Preserve existing telemetry refresh/SSE behavior, Advisor data, ledger styling, accessible keyboard operation and visible focus, and avoid horizontal overflow at 375px.
- Focused tests, build, and Playwright checks pass.

## Assumptions and scope
- Frontend-only interaction design for the authorized /now dashboard view, using existing APIs.
- No telemetry/API payload changes.

## Acceptance criteria
1. Parent and child sessions render as an agent tree, with an accurate count of currently running subagents.
2. Statuses are evidence-based and active-first; completed agents remain visible, with explicit terminal completion time when supplied by telemetry and otherwise a clearly labeled last-observed time without inferred finish times.
3. Each agent/session shows observed start or elapsed time and activity/tool events; current activity is derived solely from observed events/tools, with no separate task title or prompt.
4. Selecting an agent/session reveals its session-scoped safe activity timeline.
5. The memory-history control and history are closed/hidden by default; activating it for a selected session reveals only that session's injection history, timestamps, and hydrated referenced nodes via the existing MemoryInjections component/API, with no payload changes.
6. The global feed excludes hidden reasoning, raw prompts/outputs/errors, credentials, and memory payloads; hydrated memory text is available only in explicit selected-session detail.
7. Existing telemetry refresh/SSE and Advisor data are preserved; ledger styling, accessible keyboard/focus behavior, and 375px no-horizontal-overflow are maintained.
8. Focused tests, build, and Playwright checks pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS: at 1440px the parent-child tree is correct; running-child count is 1 and excludes the busy parent; completed worker-debug time matches statusTs.; Selected session shows safe tool activity and elapsed time; no prompts or private data are exposed.; Memory API makes 0 calls until click, then one request for the selected session; history shows timestamp and memory reference.; SSE refresh and Advisor are retained; keyboard focus works; controls are operable.; At 375px document and body widths are both 375px.; Screenshots: /tmp/opencode/activity-agent-inspector-1440-normal.png, /tmp/opencode/activity-agent-inspector-1440-memory.png, /tmp/opencode/activity-agent-inspector-375.png.; Focused Activity tests passed 8/8; web suite passed 33/33; dashboard build passed with 54 modules.; Specs validation passed: 167 files, 0 issues.; Supplemental served-bundle recovery evidence: dashboard server initially served a stale bundle; primary ran npm run build from dashboard/. Independent verifier confirmed the HTTP 4201 root references /assets/index-OP6HCSko.js; served JS byte-matches dashboard/web/dist/assets/index-OP6HCSko.js and contains Agent sessions and Injected memory history; Playwright shows .activity-inspector and controls; HTTP 200 and no page errors. This supplemental record does not change VALIDATED status or claim SHIPPED.
Change: none
<!-- guarana:record:end -->
