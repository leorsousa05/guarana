# Feature spec: Dashboard activity active-sessions visibility

**Status: VALIDATED**

## Goal
Do not display the Agent sessions active panel when no subagents are running, while retaining completed subagents in a separate history.

## Requirements
- The current inspector shows all 948 historical runs by default even when runningSubagents is 0.
- Render the active Agent sessions panel only when a child session has observed busy/running status. It contains only active subagents and necessary parent context; it excludes old completed sessions. The running count counts child subagents only, not the parent.
- When there are no running subagents, omit the Agent sessions header and list, show a no-running status, and show no default selected root detail.
- Preserve completed subagents separately in a collapsed Recently completed subagents (N) history when any exist. History entries show explicit terminal time or last observed time and can be selected to inspect their timeline and memory.
- Use current APIs and observed statuses only; do not infer statuses.
- Keep the experience responsive and accessible.

## Assumptions and scope
- Dashboard Activity Agent sessions active panel and its separate recently completed subagents history.
- No API or data-schema changes.

## Acceptance criteria
1. With a busy/running child session, SSR renders the Agent sessions active panel with only active subagents and necessary parent context, and the running count excludes the parent.
2. With no busy/running child session, SSR omits the Agent sessions header/list and default selected root detail, shows a no-running status, and keeps any completed history separate and collapsed.
3. Completed history entries display terminal time when observed or last-observed time otherwise; selecting an entry allows inspection of its timeline and memory without inferring status.
4. Focused SSR tests cover the active-panel-visible and active-panel-hidden states and collapsed completed history with times.
5. At a live 375px viewport, the Activity view has no horizontal overflow; history and selection controls remain accessible and keyboard-operable.
6. Focused Activity tests and the dashboard build pass; current API behavior is preserved.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS for all criteria: the active panel appears only for busy/running child agents; with zero children there is no Agent sessions header/tree or root detail and a no-active status is shown.; Completed history is collapsed, shows the 20 latest entries with observed time, and allows selecting a completed child to inspect its timeline and memory.; Playwright at 375px reported widths 375/375/375 across states; keyboard controls passed.; Activity SSR tests PASS (9/9); API compatibility tests PASS (23/23); dashboard build PASS (54 modules).; This task makes no API change; the pre-existing optional telemetry limit belongs to the parent feature. Shipping was not confirmed; status remains VALIDATED, not SHIPPED.
Change: none
<!-- guarana:record:end -->
