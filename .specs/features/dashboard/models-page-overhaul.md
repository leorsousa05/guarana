# Feature spec: Models page-wide UX/UI/DX overhaul

**Status: VALIDATED**

## Goal
Overhaul the Models page so project and global model settings, draft selection, Advisor activation, and save behavior are clear, accessible, and safe without silently converting inherited values into project overrides.

## Requirements
- Reorganize the page into clear Primary/default and Advisor/optional sections. Primary settings are profile defaults, not overrides to an existing OpenCode session; Advisor is an optional read-only consultant.
- Show effective Provider and Model values, including inherited global values even when no project override exists, and identify the source per field as project or global.
- Provide explicit per-field override and restore/use-global semantics. The existing API merges project/global values per field, and PUT /api/models stores only nonblank project overrides; inherited values must not be silently written into project settings.
- Allow a valid draft Provider/Model to enable Advisor and save enablement/configuration in one save when complete draft or effective values exist; server-side validation remains authoritative.
- Keep provider/model search text separate from selected and saved IDs. Commit exact catalog IDs only on selection; support manual IDs only through an explicit Use this ID action.
- Clarify save/apply scope and errors, and prevent or preserve edits made while a save is in flight.
- Preserve independent Primary/Advisor state, one variant input per role, blank-means-model-default semantics, exact model IDs, keyboard/accessibility behavior, ledger styling, reduced-motion support, and a 375px layout without horizontal overflow.
- No provider credentials are handled by this page; credentials remain OpenCode-managed.

## Assumptions and scope
- Reuse the existing settings API and project/global merge contract unless implementation demonstrates the API contract itself must change.
- A catalog display name cannot become a manual ID merely by typing; users must explicitly accept manual text through Use this ID.
- The supplied existing record and API facts are authoritative; no requirements questions remain open.
- Limit product changes to the Models page component and styles, a relevant helper/API only if the existing contract requires it, generated bundle, focused tests, related docs, and this specification/plan.
- Do not broaden changes to other dashboard pages or change the underlying settings data model unless the existing contract makes that necessary.
- Do not handle, display, or store provider credentials.

## Acceptance criteria
1. Primary/default and Advisor/optional work areas explain their different roles; copy states that Primary values are profile defaults rather than existing-session overrides and that Advisor is optional and read-only.
2. For each Provider/Model field, the effective value remains visible when inherited globally and its source is explicitly identified. A global-only value is absent from the project PUT payload until the user explicitly enables that field's project override; restoring/using global clears the override and effective inheritance resumes.
3. Advisor can be enabled and saved in one submission when valid complete draft values or valid effective values are available; no preliminary save is required, and invalid/incomplete values are still rejected by authoritative server validation with an accessible error.
4. Typing in provider/model search changes only the query/display state, never the saved ID. Selecting a catalog result commits its exact ID; manually entered text changes settings only after explicit Use this ID acceptance.
5. Primary and Advisor edits remain independent; each role retains one variant input, blank uses the model default, and custom variants remain safe through save and reload.
6. Save copy identifies what is applied and at what scope. Save/validation failures are accessible and actionable, and edits made during a pending save are either prevented clearly or preserved rather than silently lost.
7. Focused interaction/regression tests reject inherited-value payload writes, implicit search-text commits, extra-save Advisor activation, role/variant cross-contamination, and edit loss during save.
8. At a rendered 375px viewport the page remains keyboard/accessibility usable with visible focus/status, reduced-motion behavior, and no horizontal overflow; the flat rule-ledger identity is preserved.
9. Focused tests and the full npm test, npm run build, npm run check-cli, and npm run specs:validate checks pass; independent verification records criterion-level outcomes before validation is claimed.

## Debug milestone — provider/model inheritance mismatch

- Worker-debug confirmed a concrete functional defect: changing the project Provider clears the project Model, while `effectiveFieldValue` falls back to the old global Model. The UI/API can then submit and persist a provider/model pair across providers. The debug-matrix classification is `unclassified`; no repeated action loop was observed.

## Corrective implementation milestone

- Worker-code changed `dashboard/web/src/components/Models.jsx` and `Models.test.mjs`, and regenerated the dashboard and CLI bundles. Worker-code made no `.specs` edits and did not commit.
- A committed project Provider override that differs from the effective Provider and has no project Model now shows the actionable “choose a model for this provider” validation, disables Save, and is blocked by the submit handler. A same-provider inherited Model remains allowed.
- Explicit catalog selection or manual-ID confirmation supplies a project Model and clears the guard. Query/commit helpers are now called by the event handlers; tests assert that typing changes only the query, catalog selection commits the exact selected ID, and manual IDs commit only after explicit confirmation.
- No backend compatibility check or API schema change was made.
- Worker-reported checks: focused test PASS (command not provided), `npm test` PASS (293/293), build PASS, check-cli PASS, specs validate PASS, and diff-check PASS. Exact commands for the focused test, build, check-cli, specs validate, and diff-check were not provided.
- Historical note, superseded by the rendered independent verification below: browser tooling was unavailable at this implementation milestone; the responsive media query was checked in tests/source, with no rendered 375px proof available at that time.
- Historical verifier result, superseded by the final independent PASS below: the earlier worker-verify verdict had criteria 1, 2, and 4 PASS and criteria 3, 5, and 6 FAIL. That failure history is retained; it is not the latest outcome.

## Final independent verification milestone — 2026-10-09

- Independent worker-verify passed all nine acceptance criteria. This reverses only the earlier criterion-8 failure after actual browser proof; no source changes were made since code review.
- Live Playwright 1.64.0 / Chromium 156.0.8078.4 loaded `http://127.0.0.1:4200/#/models` at 375x812. The loaded catalog announcement is `role=status` with polite live behavior. `document` and `body` `scrollWidth` are 375; `.app-content`, `#models`, `.models-roles`, both `.models-section` elements, and both `.models-discovery` elements each measure 351px client width and 351px scroll width. Role and discovery grids stack, and no Models descendant is clipped.
- Keyboard Tab shows a visible focus outline on the Primary provider. Reduced-motion emulation reduces relevant animation and transition durations to approximately 0.00001s. The global navigation intentionally scrolls horizontally, with a trailing item beyond the initial viewport; the Models tab remains visible/reachable, and page content has no horizontal overflow.
- Screenshots: `/tmp/opencode/models-page-375-812.png` and `/tmp/opencode/models-page-375-focus.png`.
- The earlier provider/model mismatch correction remains covered: a different project Provider with no explicit project Model blocks save; a same-provider inherited Model is allowed; explicit catalog selection or manual-ID confirmation clears the guard (`Models.jsx:47-69,337-356,400`; `Models.test.mjs:84-124,150-176`).
- The independent verifier reports all nine criteria PASS. Prior check results remain: focused test PASS (exact command not supplied), `npm test` PASS (293/293), `npm run build`, `npm run check-cli`, `npm run specs:validate`, and `git diff --check` PASS. The current independent specs validation command also passed with zero issues. No shipping confirmation was supplied; status is VALIDATED, not SHIPPED.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS for all 9 acceptance criteria; the earlier criterion-8 failure is superseded by actual browser proof, and historical failure details remain preserved.; Live independent Playwright 1.64.0 / Chromium 156.0.8078.4 at http://127.0.0.1:4200/#/models, viewport 375x812; loaded catalog announcement is role=status with polite behavior.; Browser metrics: document and body scrollWidth 375px; .app-content, #models, .models-roles, both .models-section, and both .models-discovery each have 351px client and scroll width; grids stack; no Models descendant is clipped.; Keyboard Tab displays visible focus on Primary provider; reduced-motion emulation reduces relevant animation/transition durations to approximately 0.00001s.; Global navigation has intentional horizontal scrolling and a trailing item beyond the initial viewport; Models tab remains visible/reachable and page content has no horizontal overflow.; Screenshots: /tmp/opencode/models-page-375-812.png and /tmp/opencode/models-page-375-focus.png.; Corrective guard: different project Provider without explicit project Model blocks save; same-provider inherited Model is allowed; explicit catalog selection or manual-ID confirmation clears the guard. Source: Models.jsx:47-69,337-356,400; tests: Models.test.mjs:84-124,150-176.; No source changes since code review; no API change.; Focused test PASS, exact command not supplied; npm test PASS (293/293); npm run build PASS; npm run check-cli PASS; npm run specs:validate PASS; git diff --check PASS.; Current independent node bin/guarana.js specs validate /home/arch/codes/Guarana --json PASS with zero issues.; Status is VALIDATED; shipping was not confirmed and no SHIPPED claim is made.
Change: .specs/changes/2026-10-09-models-page-overhaul.md
<!-- guarana:record:end -->
