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

## Acceptance criteria
1. V2 and legacy properties-shaped session.created, session.status, and session.idle fixtures retain actual sessionID, explicit parentID, and agent identity where supplied.
2. A busy/running child is represented as active in /api/telemetry/summary and in the Activity fixture without changing the existing API or UI contract.
3. An idle or terminal child appears in collapsed completed history with its observed timestamp; idle is not relabeled completed unless the runtime explicitly supplies completed status.
4. A V2 evt_* event id is never emitted as a session ID, and unidentified lifecycle events do not create fake runs.
5. The orchestrator recognizes a child session and does not inject the parent workflow into it.
6. Sensitive prompt, output, hidden-reasoning, and task-title sentinels are absent from lifecycle telemetry and Activity output.
7. Focused lifecycle and Activity tests, npm test, build, check-cli, and specs validation pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS for all 7 written acceptance criteria from source/fixtures. V2 data and legacy properties parsing; actual child IDs, parent, agent, and status preserved; evt_* never used as session IDs and missing IDs skipped; lifecycle allowlist excludes prompts, outputs, reasoning, and task titles; memory lifecycle uses the real session ID; V2 child receives no parent workflow injection while root remains injected; summary and Activity fixtures render active busy/running children and collapsed idle/terminal history with observed timestamp.; Focused command node --test plugin/guarana-telemetry.test.mjs plugin/guarana-memory.test.mjs plugin/guarana-orchestrator.test.mjs dashboard/server/lib/telemetry.test.js dashboard/web/src/components/Activity.test.mjs PASS (80/80).; npm test PASS (466/466; one non-failing WebSocket port-in-use warning); npm run build PASS; npm run check-cli PASS; guarana specs validate . --json PASS (175 files, 0 issues); git diff --check PASS.; Proof paths: plugin/* and tests; dashboard/server/lib/telemetry.js and its test; dashboard/web/src/components/Activity.jsx and Activity.test.mjs; CLI mirrors.; Live runtime smoke was not run: project .opencode/plugins is empty and installed global plugin hashes differ from the source patch; reloading would test stale global copies, so do not claim live runtime or imply the currently loaded plugin is updated.
Change: none
<!-- guarana:record:end -->
