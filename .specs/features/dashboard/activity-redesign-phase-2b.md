# Feature spec: Dashboard Activity redesign Phase 2b

**Status: VALIDATED**

## Goal
Independently validate the bounded Phase 2b Activity redesign while preserving root-session, Advisor history, memory injection, privacy, keyboard, and API behavior.

## Requirements
- Keep root-session selection and busy evidence, safe Activity and Advisor-history and memory display, and their privacy boundaries.
- Preserve Advisor history keyboard operation and its existing focus behavior.
- Keep Activity usable at 375px without unintended horizontal page overflow.
- Leave existing API, data, and telemetry contracts unchanged.

## Assumptions and scope
- This verification validates only the bounded Activity redesign Phase 2b, not the complete dashboard redesign.
- Browser verification used mocked fixture APIs through current Vite source, not live telemetry.
- No CLI bundle sync or shipping was performed or verified.

## Acceptance criteria
1. The Activity view redesign is limited to Activity.jsx and scoped Activity styles and tests; unrelated views and the shared shell are not part of this slice.
2. Existing root-session selection and busy evidence, safe Activity and Advisor-history and memory display, and their privacy boundaries are preserved.
3. Advisor history remains keyboard-operable, with its existing focus behavior preserved.
4. At 375px, Activity remains usable without unintended horizontal page overflow.
5. Existing API, data, and telemetry contracts remain unchanged.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS (5/5); Activity root selection, matching, and rendering are at Activity.jsx:9-17,32-49,70-88,114-125.; SSR coverage is at Activity.test.mjs:13-50,98-174; MemoryInjections root filtering is at lines 25-27,100-105.; Advisor modal focus and Escape coverage is at Activity.test.mjs:176-208; modal implementation is at Activity.jsx:11-39.; Independent browser verification used current Vite source and fixture APIs at #/now at 375x812 and 1440x900; document/body scroll widths were 375/375 and 1440/1440.; Browser checks covered root, Advisor, workflow, events, and memory ordering, contained injection history, no sensitive sentinels, no-root, reason fallback, 503, and reduced-motion states.; Screenshots: /tmp/opencode/activity-phase2b-375x812.png and /tmp/opencode/activity-phase2b-1440x900.png.; Requests match App, Activity, and MemoryInjections source; no API changes. Browser fixtures were mocked, not live telemetry; no CLI bundle sync was performed.; Focused Activity tests PASS (4/4); npm test PASS (431/431); dashboard build PASS; specs validation PASS (149 files, 0 issues). Exact focused-test, build, and specs-validation commands were not supplied.
Change: none
<!-- guarana:record:end -->
