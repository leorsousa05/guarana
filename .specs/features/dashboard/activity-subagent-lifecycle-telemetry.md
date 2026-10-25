# Feature spec: Dashboard Activity subagent lifecycle telemetry

**Status: VALIDATED**

## Goal
Make observed Task subagents show accurate real-time running and terminal lifecycle state in Dashboard Activity by extracting OpenCode lifecycle events with their actual session and parent identities.

## Requirements
- Extract OpenCode v2 lifecycle events from the data envelope: session.created carries sessionID and info, session.status carries sessionID and status, and session.idle carries sessionID; preserve equivalent legacy properties-shaped lifecycle records.
- Preserve the actual sessionID, explicit parentID, and agent identity from lifecycle records; never use the event id as a session ID or infer parent-child links from timing.
- Apply consistent lifecycle extraction in canonical and CLI mirror implementations for telemetry, memory, and orchestrator so child sessions are recognized correctly and are not treated as primary workflow sessions.
- Use observed busy/running and idle/terminal lifecycle evidence for Activity state; retain observed timestamps and do not infer completion times.
- Do not capture or expose prompts, outputs, hidden reasoning, or task titles through lifecycle telemetry.
- Preserve existing Activity API and UI contracts; do not redesign the schema or API.
- Coordinate with the existing [Dashboard activity agent inspector](activity-agent-inspector.md) and [Dashboard activity active-sessions visibility](activity-active-sessions-visibility.md) contracts.

## Assumptions and scope
- session.idle is displayed as observed idle or terminal state and is not relabeled completed unless the runtime explicitly supplies completed status.
- No API or data-schema redesign is in scope.
- Lifecycle extraction and identity handling across canonical and CLI mirror telemetry, memory, and orchestrator implementations, with focused regression tests.
- The related Activity feature records define the existing parent-child presentation, active-child visibility, and collapsed terminal-history behavior.

## Active follow-up — late Task-child lifecycle metadata
- A read-only live reproduction found the same native Task child in the OpenCode session API with parent and worker-agent identity, while telemetry contained only created events without parent/agent identity and no busy/running or terminal event; the dashboard summary omitted the child. The source audit found Activity filtering correct when identity and status arrive. This observation is not live runtime proof: the raw runtime envelope was not captured and remains unresolved.
- The late-metadata source and fixture fix is complete; independent `worker-verify` passed all 13 criteria for this source/fixture slice. Criterion 10's V2 `data` busy-to-metadata and legacy `properties` running-to-metadata end-to-end fixtures pass through telemetry recording into `summarize`, retaining the actual child session identity, parent, agent, status, and `statusTs` while emitting no metadata status. An older idle event does not replace newer running status in canonical or CLI summary tests.
- Metadata projection excludes event IDs, decoy IDs, titles, prompts, outputs, and reasoning, and skips unidentified updates. Canonical and CLI telemetry and summary tests match. No UI or API schema change was made.
- This source/fixture slice is **VALIDATED, not SHIPPED**. Actual runtime envelope and live Activity behavior remain unverified; the raw envelope remains unresolved. No raw runtime capture, global install, or restart occurred. Global installation and reload are pending authorization.
- Final post-record validator result from primary: `npm run specs:validate` PASS — 209 Markdown files, 80 feature specs, 39 ADRs, 239 local links, 0 issues.

## Accepted follow-up — V2 telemetry setup-boundary regression

Add a local V2 telemetry setup-boundary integration regression through the public `ctx.event.subscribe({ signal })` path, using synthetic full V2 Session records and event `properties` shapes. The installed plugin's V2 Event type imports `@opencode-ai/sdk/v2/types`; complete shapes were validated against `@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts`. The installed plugin API exposes `ctx.event.subscribe({ signal })` as an async iterable. The prior setup-path telemetry fixture covered only `message.updated`; existing lifecycle tests called the lower-level hook. Telemetry persists allowlisted lifecycle records; Dashboard `summarize()` merges session metadata/status, and Activity requires a parent link plus running status for active children.

Use private sentinels only to assert exclusion from persisted telemetry. Do not capture or report live envelopes. Preserve the existing Activity/API contract. Production code may change only if this setup-path test demonstrates a defect; a passing setup-path test requires no production fix. Scope is local source/tests only. Live reproduction, raw event capture, global installation, reload, profile changes, commit, and push are not authorized. This regression is not proof of live runtime event delivery. The existing source/fixture proof above remains historical and the separate global live deployment blocker remains unresolved.

### Follow-up acceptance criteria
1. `TelemetryPlugin.setup` consumes installed-SDK-shaped `properties` lifecycle fixtures through `ctx.event.subscribe()` and produces a child summary linked to its parent, identified by its agent, and carrying observed running status, plus observed idle/terminal summary where applicable.
2. Lifecycle event IDs and private sentinels are absent from persisted telemetry.
3. Production changes occur only if the setup-path test demonstrates a defect; the existing Activity/API behavior remains unchanged.
4. Focused setup-path and lifecycle/Activity regressions and all required full checks are run and reported; no result implies live runtime proof.

### Independent verification result (2026-10-23)
- Fresh independent `worker-verify` returned overall PASS for all four setup-boundary follow-up criteria. The exact local test change is `plugin/plugin-v2-compat.test.mjs`; it exercises created/status-busy/late-updated parent and agent metadata plus a separate created/idle case through public `ctx.event.subscribe({ signal })`, using synthetic complete V2 Session records and event `properties` shapes.
- Persisted telemetry contains no synthetic event IDs or title, prompt, output, or reasoning sentinels. `summarize()` returns the expected parent-linked busy and idle summaries. Complete event shapes were validated against the installed SDK type declarations noted above.
- Exact focused command `node --test plugin/plugin-v2-compat.test.mjs plugin/guarana-telemetry.test.mjs dashboard/server/lib/telemetry.test.js cli/dashboard/server/lib/telemetry.test.js dashboard/web/src/components/Activity.test.mjs` passed 66/66. `npm test` passed 612/612 with non-fatal WebSocket port-in-use warnings. `npm run build` passed, including dashboard build and CLI sync; `npm run check-cli` passed with the bundle matching canonical sources; `git diff --check` passed.
- `guarana specs validate . --json` passed before and after independent review: 209 files, 80 features, 39 ADRs, 239 links, 0 issues.
- Existing Activity/API production source behavior was unchanged by this follow-up; no new production defect was demonstrated and no production change was made. This local fixture/setup proof does not establish runtime event delivery or rendered live Activity visibility. No live reproduction Task, raw event/SSE capture, global install, reload, profile change, commit, or push occurred as part of this follow-up. The older source/fixture proof above remains intact, and the separate global deployment/live proof remains blocked and unverified. This follow-up is VALIDATED, not SHIPPED.

## Historical initial lifecycle proof

An earlier independent `worker-verify` PASS covered all 7 then-written source/fixture criteria: V2 `data` and legacy `properties` parsing; actual child IDs, parent, agent, and status; no `evt_*` session IDs and skipping missing IDs; lifecycle allowlist exclusions; memory lifecycle using the real session ID; V2 child isolation from parent workflow injection while root injection remained; and active busy/running plus collapsed idle/terminal Activity fixtures with observed timestamps. Its focused command `node --test plugin/guarana-telemetry.test.mjs plugin/guarana-memory.test.mjs plugin/guarana-orchestrator.test.mjs dashboard/server/lib/telemetry.test.js dashboard/web/src/components/Activity.test.mjs` passed 80/80; `npm test` passed 466/466 with one non-failing WebSocket port-in-use warning; build, check-cli, specs validation (175 files, 0 issues), and diff-check passed. Live runtime smoke was not run because project `.opencode/plugins` was empty and installed global plugin hashes differed from that source patch; reloading would have tested stale global copies. These results remain historical and are not live-runtime proof for the late-metadata slice.

## Acceptance criteria
1. V2 and legacy properties-shaped session.created, session.status, and session.idle fixtures retain actual sessionID, explicit parentID, and agent identity where supplied.
2. A busy/running child is represented as active in /api/telemetry/summary and in the Activity fixture without changing the existing API or UI contract.
3. An idle or terminal child appears in collapsed completed history with its observed timestamp; idle is not relabeled completed unless the runtime explicitly supplies completed status.
4. A V2 evt_* event id is never emitted as a session ID, and unidentified lifecycle events do not create fake runs.
5. The orchestrator recognizes a child session and does not inject the parent workflow into it.
6. Sensitive prompt, output, hidden-reasoning, and task-title sentinels are absent from lifecycle telemetry and Activity output.
7. Focused lifecycle and Activity tests, npm test, build, check-cli, and specs validation pass.
8. A late parent/agent metadata fixture merges identity into the child identified by its actual `sessionID`, and the summary represents that child as parent-linked while retaining its newer observed busy/running status.
9. A late/stale lifecycle status fixture does not replace a newer observed busy/running status.
10. The late-metadata and status-ordering fixtures pass for both V2 `data` and legacy `properties` envelopes.
11. Late-metadata telemetry contains only allowlisted sessionID, parentID, agent, status, and timestamps; event IDs are not session IDs and task/prompt/output/reasoning content is absent.
12. Canonical and CLI plugin implementations and regression tests agree, and the existing Activity API/UI contracts remain unchanged.
13. Focused regression tests, `npm test`, the dashboard build, `npm run check-cli`, and specs validation pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS for follow-up criteria 1–4.; node --test plugin/plugin-v2-compat.test.mjs plugin/guarana-telemetry.test.mjs dashboard/server/lib/telemetry.test.js cli/dashboard/server/lib/telemetry.test.js dashboard/web/src/components/Activity.test.mjs PASS 66/66.; npm test PASS 612/612 with non-fatal WebSocket port-in-use warnings.; npm run build PASS including dashboard build and CLI sync; npm run check-cli PASS with bundle matching canonical sources; git diff --check PASS.; guarana specs validate . --json PASS before and after independent review: 209 files, 80 features, 39 ADRs, 239 links, 0 issues.; No live reproduction Task, raw event/SSE capture, global install, reload, profile change, commit, or push occurred as part of this follow-up; no shipping confirmation.
Change: .specs/changes/2026-10-23-dashboard-activity-setup-boundary.md
<!-- guarana:record:end -->
