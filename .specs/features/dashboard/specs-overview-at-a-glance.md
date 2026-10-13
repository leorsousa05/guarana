# Feature spec: Dashboard Specs Overview at-a-glance redesign

**Status: VALIDATED**

## Goal
Replace the tracker-first dense Specs Overview with an at-a-glance view of current project state, actual implementation progress, pending human decisions, blockers and next roadmap actions, and working context.

## Requirements
- Use the existing /api/specs/tracker, /api/decisions/pending, and /api/specs/state data sources; do not add or change API or schema behavior.
- The live tracker has 73 rows. Statuses include VALIDATED, SHIPPED, IMPLEMENTED, TASKED, and some long descriptive status text; BLOCKED, NEXT, and DONE each have one row. Pending decisions were 0 at inspection. These are source facts, not hard-coded display values.
- Current project state and known-issues Read actions must remain available.
- Keep all existing data and actions, leave the Documents tab and its hierarchy/API untouched, and retain the Guarana paper, ink, and rule ledger identity.
- Limit implementation to the Specs component, its tests, and styles; do not change dashboard/server.

## Assumptions and scope
- The user approved focusing the Overview on current project state and next actions while preserving all existing data and actions.
- Planning is confirmed. The Roadmap Read callback correction is implemented with worker-reported regression and focused checks; independent verification remains pending.
- Specs Overview presentation in dashboard/web/src/components/Specs.jsx, related Specs tests, and styles only.
- No API or schema change, no dashboard/server change, and no Documents tab or hierarchy change.

## Acceptance criteria
1. Provide a compact at-a-glance tracker rollup that reflects actual row and status counts, with no inferred percentages or fabricated statuses. Long descriptive statuses may roll up by their final recognized lifecycle stage, while their raw values remain available in the full register.
2. Present BLOCKED and NEXT roadmap items and pending decisions clearly near the top. Preserve Accept, Reject, and Read actions, roadmap Read actions, loading/error/empty feedback, and reachability of every DONE row.
3. Keep the full four-column implementation table and proof/change Markdown links available, including when the table is collapsed by default. Preserve state and known-issues excerpts and their functional full-text reader.
4. Leave the Documents hierarchy and API untouched and make no changes to dashboard/server.
5. Preserve ARIA semantics, keyboard focus, and reduced-motion behavior, and ensure no horizontal overflow at 375px. Focused tests, npm test, build, check-cli, and specs validate pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS for .specs/features/dashboard/specs-overview-at-a-glance.md.; guarana specs validate . --json — PASS: 174 files, 57 features, 30 ADRs, 205 links, 0 issues.; node --test dashboard/web/src/components/Specs.test.mjs dashboard/web/src/components/Documents.test.js — PASS: 13/13.; npm test — PASS: 462/462.; npm run build — PASS; npm run check-cli — PASS; git diff --check — PASS.; Live /api/specs/tracker and UI matched 74 rows: SPECIFIED 0, TASKED 4, IMPLEMENTED 4, VALIDATED 56, SHIPPED 10, Unspecified 0, Other 0; no percent or bar was shown.; Live Roadmap BLOCKED, NEXT, and DONE Read actions each showed the exact text inline; no Roadmap file request or HTTP 400 occurred.; Tracker was closed by default and opened with all 74 raw rows, four columns, and 34 links; a real proof link loaded HTTP 200.; State readers worked. Documents search and reader worked.; At 1440x900 and 375x812, content stayed within viewport widths; keyboard tabs and reduced-motion checks passed; no console, page, or API errors occurred.; Screenshots: /tmp/opencode/specs-overview-at-a-glance-final-1440x900.png and /tmp/opencode/specs-overview-at-a-glance-final-375x812.png.; Pre-existing dirty Docs/server/CLI/Activity/Workflow changes were not attributed to this feature; the build regenerated synced bundles.
Change: none
<!-- guarana:record:end -->
