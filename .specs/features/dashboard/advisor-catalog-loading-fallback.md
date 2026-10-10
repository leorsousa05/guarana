# Feature spec: Advisor catalog discovery timeout and dashboard loading feedback

**Status: VALIDATED**

## Goal
Make OpenCode model catalog discovery tolerate the approved command duration and make dashboard catalog failures and loading state clear, accessible, and safe while preserving manual model entry and a distinct empty-catalog state.

## Requirements
- Set the timeout for each OpenCode catalog discovery command to 15000 ms.
- Display safe body.error text from the dashboard catalog response instead of collapsing it to a generic error; keep manual model-ID entry available.
- Keep a successful empty catalog with no error distinct from a catalog discovery error.
- Make catalog loading visibly explicit with an icon or spinner and the existing visible status text, exposed through role=status; honor prefers-reduced-motion and reuse the variant loading style if appropriate.
- Preserve the catalog API schema and existing authentication/model parsing behavior, and do not expose unsafe command output or secrets.
- Add focused CLI timeout and dashboard error/loading tests; build and synchronize/check the CLI bundle as applicable.

## Assumptions and scope
- The dashboard /api/models/catalog route returned HTTP 200 with the safe discovery error: OpenCode discovery timed out. Try again or enter model IDs manually.
- A safe instrumented reproduction measured auth list at 2931 ms and opencode models killed at about 5075 ms under COMMAND_TIMEOUT_MS=5000; another invocation returned 403 models, demonstrating intermittent timeout. No raw output or secrets were captured.
- The user approved a 15000 ms timeout per OpenCode discovery command and displaying the safe underlying error.
- Limit this follow-up to model catalog discovery timeout handling, dashboard catalog error/loading presentation, focused tests, and required build/bundle synchronization.
- Preserve existing catalog API schema, authentication/model parsing, manual model entry, secret-safety boundary, and no-error empty-catalog behavior.

## Acceptance criteria
1. Catalog discovery command timeout options are verified as 15000 ms for each command.
2. The safe body.error appears in the dashboard UI rather than a generic message, unsafe output is not displayed, and manual model entry remains available.
3. A genuinely empty catalog without an error remains distinct from discovery failure.
4. Catalog loading includes a visible indicator and visible status text with role=status, and reduced-motion preferences are respected.
5. Focused CLI timeout and dashboard error/loading tests, build, CLI synchronization/check, and specs validation pass; independent verification records criterion-level results before validation is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS (5/5). Catalog command timeout is 15000 ms at cli/lib/opencode-model-catalog.js:5,158,193,206; cli/lib/opencode-model-catalog.test.js:20-43 asserts exactly 15000 and that every exec call receives it.; Safe body.error is preserved/displayed, manual model-ID entry remains available, and successful empty results remain distinct: dashboard/web/src/components/Models.jsx:137-150; Models.test.mjs:147-159.; Static safe failure messages prevent raw command output or credentials from being exposed: cli/lib/opencode-model-catalog.js:158-181; cli/lib/opencode-model-catalog.test.js:140-194.; Visible spinner, role=status with polite announcement, and reduced-motion support: Models.jsx:188-190; style.css:1122-1132,1329-1331; Models.test.mjs:161-174.; Existing behaviors, keyboard handling, responsive source, and CLI bundle sync were verified. Focused tests PASS 14/14; exact focused test command was not supplied.; npm test PASS (293/293).; npm run build PASS.; npm run check-cli PASS (CLI bundle matches canonical sources).; node bin/guarana.js specs validate . --json PASS (ok:true, issues:[]).; git diff --check PASS.; 375px browser rendering was unavailable; responsive source was inspected, including stack below 600px. Commands can still exceed 15000 ms; safe error and manual fallback remain available.; Status is VALIDATED, not SHIPPED; no shipping confirmation was supplied.
Change: .specs/changes/2026-10-09-advisor-catalog-loading-fallback.md
<!-- guarana:record:end -->
