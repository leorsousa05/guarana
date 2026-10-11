# Feature spec: Models settings density redesign

**Status: VALIDATED**

## Goal
Redesign Models to make Primary/Advisor settings, inheritance, and model discovery less dense without changing established behavior.

## Requirements
- The completed Models behavior/visual acceptance recorded in .specs/features/dashboard/models-page-overhaul.md remains authoritative and closed; retain its interactions.
- Preserve exact model IDs, project/global override semantics, explicit manual-ID acceptance, variant semantics, Advisor behavior, and the OpenCode-managed credential boundary.
- Make no API or data-model changes.

## Assumptions and scope
- Limit implementation to Models JSX, scoped CSS, and tests.

## Acceptance criteria
1. The Models layout reduces visual density across Primary/Advisor settings, inheritance, and model discovery while retaining existing interactions; established behavior and visual acceptance remain as recorded in .specs/features/dashboard/models-page-overhaul.md.
2. Focused tests preserve exact model IDs, project/global override behavior, explicit manual-ID acceptance, variant behavior, Advisor behavior, and the OpenCode-managed credential boundary.
3. No API or data-model changes are made; implementation changes are limited to Models JSX, scoped CSS, and tests.

## Implementation milestone — before code_complete

- Worker-code changed `Models.jsx`, Models-scoped `style.css`, and `Models.test.mjs`; the explainer was shortened, Primary and optional Advisor were clarified, and project/global source indicators were compacted.
- The milestone report states that exact model IDs, inheritance, exact payload behavior, manual-ID commit, variant behavior, Advisor behavior, API semantics, and accessibility semantics were preserved.
- Worker-reported checks: focused Models test PASS; `npm test` PASS (438/438); dashboard build PASS; diff-check PASS. Exact commands for the focused test, build, and diff-check were not supplied.
- No CLI bundle synchronization or rendered 375px browser check was performed. No independent verification result was supplied for this milestone.
- The overall redesign remains TASKED; this milestone is recorded before `code_complete`.

## Corrected-scope independent verification

- Independent worker-verify returned PASS for the Models settings density redesign after applying the intended slice scope: `Models.jsx`, Models-scoped `style.css`, and `Models.test.mjs`. API/data logic was unchanged. The previous criterion-3 FAIL came from including preexisting backend Advisor transaction files outside this UI slice.
- The UI diff shortens guidance, clarifies role labels, and adjusts source spacing. Playwright at 375x812 and 1440x900 confirmed document/body widths equal the viewport (375px/1440px), Models content width of 351px on mobile, and two 556px role columns on desktop. Screenshots: `/tmp/opencode/models-ui-verify/models-375x812.png` and `/tmp/opencode/models-ui-verify/models-1440x900.png`.
- Mocked API checks confirmed inherited-only `PUT {settings:{}}`, typed search query does not commit, Use this ID commits, global restore, exact model ID, independent variants, and the Advisor enable payload. No credential fields or endpoints were introduced. Focused test coverage is in `Models.test.mjs:12-282`.
- Specs were clean; `npm test` passed 438/438; `npm run build` and CLI synchronization passed.
- This slice is VALIDATED. The overall dashboard remains TASKED; shipping was not confirmed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify corrected-scope PASS for this Models redesign slice; prior criterion-3 FAIL was a scope mismatch caused by preexisting backend Advisor transaction files outside this UI slice.; Scope is only Models.jsx, Models-scoped style.css, and Models.test.mjs; API/data logic unchanged.; UI diff shortens guidance, clarifies role labels, and adjusts source spacing.; Playwright at 375x812 and 1440x900 confirmed document/body widths equal viewport (375px/1440px), Models content width 351px mobile, and two 556px role columns desktop. Screenshots: /tmp/opencode/models-ui-verify/models-375x812.png and /tmp/opencode/models-ui-verify/models-1440x900.png.; Mocked API checks confirm inherited-only PUT {settings:{}}, typed query not commit, Use this ID commits, global restore, exact model ID, independent variants, and Advisor enable payload. No credential fields/endpoints; focused assertions are in Models.test.mjs:12-282.; Specs clean; npm test PASS (438/438); npm run build PASS; CLI synchronization PASS.; This slice is VALIDATED; overall dashboard remains TASKED. Shipping was not confirmed.
Change: none
<!-- guarana:record:end -->
