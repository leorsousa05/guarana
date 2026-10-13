# Feature spec: Activity monitor event coverage

**Status: VALIDATED**

## Goal
Ensure the Activity live global feed represents every telemetry event category emitted by the current Guarana plugins.

## Requirements
- Render each currently emitted telemetry event category with a concise, safe display label and status.
- Preserve the existing global event limit and event payload/API contracts.
- Never expose raw error strings, prompts or outputs, workflow task/note content, todo payloads, memory bodies, or credentials.
- Keep the change within the Activity UI and its tests.

## Known event categories
- `plugin/guarana-telemetry.js`: `tool`, `tokens`, `session`, `todo`, `advisor-dispatch`, `advisor-execution`, `telemetry-error`.
- `plugin/guarana-memory.js`: `memory-error`, `memory-session`.
- `plugin/guarana-orchestrator.js`: `workflow`, `memory-injected`, `orchestrator-error`.
- Current `Activity.jsx` `EVENT_LABELS` includes `tool`, `session`, `workflow`, `advisor-dispatch`, `advisor-execution`, `memory-injected`, `tokens`, and `error`; the remaining categories are omitted.

## Acceptance criteria
1. Tests enumerate every listed emitted event type and assert that it renders in the Activity feed.
2. Secret-shaped values and sensitive payloads (raw errors, prompts/outputs, workflow task/notes, todo payloads, memory bodies, credentials) are absent from rendered output.
3. No event payload/API contract changes are made, and the existing global feed limit is preserved.
4. Focused tests and dashboard build pass.
5. The 375px responsive layout remains intact without overflow.

## Assumption and scope
- “Everything happening” means all event categories currently instrumented by Guarana.
- Scope is Activity UI and tests only; no API changes.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent verifier PASS (5/5): all 12 actual telemetry categories labeled.; Sensitive payloads hidden by tests; Playwright privateLeak=false.; Current event-coverage fix has no API edits; parent optional limit accepted.; Focused Activity tests PASS (6/6); dashboard build PASS.; 375px Playwright scrollWidth=clientWidth=375 and one-column workbench.; Screenshots: /tmp/activity-monitor-desktop.png; /tmp/activity-monitor-mobile.png
Change: none
<!-- guarana:record:end -->
