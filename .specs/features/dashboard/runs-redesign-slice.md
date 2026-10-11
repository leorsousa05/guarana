# Feature spec: Dashboard Runs redesign slice

**Status: VALIDATED**

## Goal
Redesign the bounded Runs view as a restrained operational folio while preserving its telemetry semantics, data, and interactions.

## Requirements
- Preserve the exact data semantics of /api/telemetry/summary and the existing /api/telemetry/events?session=id fetch; make no endpoint or pagination API changes.
- Keep every run-row field: sessionID, project (including untagged legacy runs), status, start, duration, toolCalls, tokens, and errors.
- Preserve the project filter and per-project counts, plus the existing 25-row show-all/collapse behavior; changing the filter resets the expanded/collapsed row state.
- Run rows open the event modal on click, Enter, or Space. Preserve modal close control, backdrop and Escape closing, focus containment, and focus restoration.
- Preserve event ordering, metadata, and errors, together with loading and empty states.
- Use the approved restrained operational-folio hierarchy and table styling. If horizontal scrolling remains at 375px, contain it within the existing intentional scroller, label the region accessibly, and prevent page-level overflow.
- Add SSR/regression tests for row fields, filtering, pagination, and modal behavior. Verify focus and overflow and capture screenshots at 375px and 1440px; run npm test and the dashboard build.
- Make no backend changes.

## Assumptions and scope
- This is a planning/tasking handoff only; it contains no implementation or independent verification result.
- The overall dashboard redesign remains TASKED and is not claimed shipped.
- Bounded redesign of the dashboard Runs view and its associated regression/browser tests.
- No backend, endpoint, telemetry-data semantics, or pagination API changes.

## Acceptance criteria
1. The Runs view preserves exact /api/telemetry/summary semantics and uses the existing /api/telemetry/events?session=id fetch without endpoint or pagination API changes.
2. Every row retains sessionID, project including untagged legacy runs, status, start, duration, toolCalls, tokens, and errors; the project filter and per-project counts remain available.
3. The existing 25-row show-all/collapse behavior is preserved, and changing the project filter resets the expanded/collapsed state.
4. Click, Enter, and Space on a run row open the event modal; its close control, backdrop, Escape, focus containment, and focus restoration work. Event ordering, metadata, errors, loading states, and empty states are preserved.
5. The Runs hierarchy/table follows the restrained operational-folio direction. At 375px, any remaining horizontal scroll is contained in the existing intentional scroller with an accessible region label and no page-level overflow.
6. SSR/regression tests cover all row fields, filtering, pagination, and modal behavior. Browser checks at 375px and 1440px cover focus and overflow and record screenshots; npm test and the dashboard build pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS (6/6); validates only the bounded Runs redesign slice.; Telemetry endpoints remain unchanged at server/routes/telemetry.js:11-26; App and event-fetch behavior are unchanged.; Runs component and SSR tests preserve all row fields, project filtering/counts, 25-row show/collapse/filter-reset behavior, modal click/Enter/Space/close/Escape/backdrop/focus containment/restoration, and event order/content.; CSS retains restrained ledger styling and a labelled contained scroller.; Playwright fixture with 32 runs at 375x812 and 1440x900: page/body widths 375/1440; contained scroller dimensions 351/1018 and 1117/1117; visible 2px focus and reduced motion confirmed.; Screenshots: /tmp/opencode/runs-redesign-375.png and /tmp/opencode/runs-redesign-1440.png.; Focused tests PASS (4/4); npm test PASS (431/431); dashboard build PASS; specs validation PASS (151 files, 206 links, 0 issues); git diff --check PASS.; CLI bundle synchronization was deferred to the final build; no shipping is claimed.
Change: none
<!-- guarana:record:end -->
