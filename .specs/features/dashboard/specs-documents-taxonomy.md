# Feature spec: Dashboard Specs Documents taxonomy

**Status: VALIDATED**

## Goal
Organize the Specs Documents reader from the actual /api/specs/tree document inventory so categories are unique, useful, complete, and ordered for discovery without changing API behavior.

## Requirements
- Baseline evidence supplied: /api/specs/tree contains 169 paths, including 64 changes, 30 decisions, and 67 features; archive/ contains only archive/README.md with an empty Index.
- Existing buildGroups hardcodes an empty Archive category and catches deep feature paths such as features/guarana/audits/* and proofs/* into a second duplicate Features group.
- Derive unique categories from the actual document tree. Group features by folder hierarchy with clear, distinct labels and no duplicate Features category.
- Group changes by month from dated filenames, ordering newest months and files first; place unclassifiable and index files in a clear general group.
- Order decisions with the most recent ADR first.
- Hide the unused Archive category when only its empty index exists, while keeping archive/README.md findable in an index/foundations group; show Archive when real archive artifacts exist.
- Every non-state document appears exactly once and no empty category is rendered.
- Preserve search and path matching, active-category expansion, the docs reader, local links, ARIA navigation and buttons, API contracts, and no-overflow layout at 375px.
- Limit implementation to frontend Documents.jsx, tests, and styles; make no API changes.
- Preserve the parent Specs visual redesign's VALIDATED status and make no shipping claim.

## Assumptions and scope
- Frontend Documents.jsx, related tests, and related styles only.
- No API changes.

## Acceptance criteria
1. Tests assert grouping by actual document type and folder hierarchy, distinct feature labels without duplicate Features categories, and exactly-once coverage of every non-state document with no empty categories.
2. Tests verify changes are grouped by filename month with newest months and files first and unclassifiable or index files in a clear general group; decisions are ordered with the most recent ADR first.
3. Tests cover archive behavior for the empty-index-only tree and for a tree containing real archive artifacts; archive/README.md remains findable in an index/foundations group in the empty-index case.
4. Tests preserve search/path matching and selected-document reader behavior, including local document links and active-category expansion.
5. ARIA navigation and buttons, existing API contracts, and 375px no-overflow behavior remain intact.
6. Playwright checks and the dashboard build pass.
7. The parent Specs visual redesign remains VALIDATED; no SHIPPED status is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS for all taxonomy criteria using the live tree and Playwright: 168 non-state paths appear exactly once, with 18 unique nonempty categories; Features are unique and hierarchical.; No Archive group is rendered for the empty index; README is under Foundations. Changes are newest month first; ADRs are newest first, including the corrected test assertion.; Search, reader, local links, and the 375px stacked layout pass. The parent Specs visual redesign remains VALIDATED.; Focused Documents+Specs tests PASS (12/12; exact command not supplied). Dashboard build PASS (55 modules; exact command not supplied). npm run check-cli PASS from the previous full build.
Change: none
<!-- guarana:record:end -->
