# Feature spec: Dashboard Overview roadmap bottom section

**Status: VALIDATED**

## Goal
Move the main Dashboard Overview Roadmap into a dedicated full-width final section at the bottom of the page, after the complete Memory and Decisions area.

## Requirements
- In the main Overview DOM, Roadmap is the final section under .ov-ledger, is not a child of .ov-supporting, and follows Memory and Decisions.
- At desktop, tablet, and mobile widths, Roadmap spans the full available page content width rather than one .ov-supporting grid column.
- Remove obsolete roadmap-in-supporting grid placement CSS.
- Preserve BLOCKED, NEXT, DONE order; exact tracker Markdown; one NEXT/workflow-goal display; no-items empty state; and loading state.
- Keep Memory and Decisions together in the supporting area and preserve all tracker items, current Markdown, API/data contracts, and other page sections.
- Use current ledger rules, colors, and types; do not introduce generic cards.
- Do not change Specs.jsx Roadmap or other pages. No API change is needed.

## Assumptions and scope
- This is a reversible placement-only UI change with no data or API contract change.
- Main Overview component: dashboard/web/src/components/Overview.jsx.
- Overview layout styles in dashboard/web/src/style.css.
- Focused regression coverage in dashboard/web/src/components/Overview.test.mjs.
- Exclude Specs.jsx Roadmap, other pages, API/data contract changes, and deployment or shipping.

## Acceptance criteria
1. In rendered main Overview DOM, Roadmap is the final section under .ov-ledger, is not a child of .ov-supporting, and follows Memory and Decisions. At desktop, tablet, and mobile widths it spans the full available page content width.
2. Roadmap contents and behavior remain unchanged: BLOCKED, NEXT, DONE order; exact tracker Markdown; a single NEXT/workflow-goal display; no-items empty state; and loading state. Memory and Decisions remain together in the supporting area.
3. Focused Overview tests and the full root suite pass; production Dashboard build and CLI sync, npm run check-cli, specs validation, and git diff --check pass.
4. Browser checks at desktop and 375px verify final-section placement, full-width bounds, and no horizontal overflow.
5. No deployment or shipping is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS on all 3 criteria; reran focused Overview tests 3/3, npm test 619/619, npm run check-cli, npm run specs:validate, and git diff --check; all PASS.; Primary gates: node --test dashboard/web/src/components/Overview.test.mjs PASS 3/3; npm test PASS 619/619 with nonfatal existing Vite WebSocket port 24678-in-use and Node module-type warning; npm run build PASS with Dashboard bundle and CLI sync; npm run check-cli PASS; npm run specs:validate PASS at 217 Markdown, 84 feature specs, 39 ADRs, 243 local links, 0 issues; git diff --check PASS.; Browser report `guarana-overview-roadmap-bottom-section.json`, mode 0600 and aggregate-only synthetic-fixture evidence, PASS at 1440px and 375px for final direct-child position, outside .ov-supporting, Memory and Decisions together, Roadmap full ledger width, BLOCKED/NEXT/DONE and single workflow-goal display, no horizontal overflow, and zero page errors. Screenshots: `guarana-overview-roadmap-1440.png` and `guarana-overview-roadmap-375.png`. The report and screenshots were temporary local synthetic-fixture evidence and are not included in the repository. Tablet behavior is inferred from responsive CSS; no tablet screenshot was captured.; No API/data/schema changes; Specs.jsx Roadmap untouched; no deployment or shipping occurred.; Final post-record validation after all task records were written: npm run specs:validate — PASS: 218 Markdown files, 84 feature specs, 39 ADRs, 244 local links, 0 issues; npm run check-cli — PASS; git diff --check — PASS.
Change: .specs/changes/2026-10-24-dashboard-overview-roadmap-bottom-section.md
<!-- guarana:record:end -->
