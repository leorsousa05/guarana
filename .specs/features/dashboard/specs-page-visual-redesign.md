# Feature spec: Dashboard Specs page visual redesign

**Status: VALIDATED**

## Goal
Reorganize the entire Specs page visually so project progress, implementation status, roadmap attention, project context, and curated documents have a clear hierarchy while retaining the existing data contracts and behavior.

## Requirements
- Keep the Overview and Documents tabs and the existing document reader.
- Present a clear project progress/status strip derived only from tracker rows.
- On desktop, organize Overview into a two-column implementation register and attention/roadmap rail containing pending decisions and blocked, next, and done items; show project state and known issues as paired context panels.
- Preserve tracker data contract {schema,rows,DONE,NEXT,BLOCKED}, state data contract {projectState,knownIssues}, and pending decision data contract {file,statement}; do not change APIs, backend behavior, or schemas.
- Keep all record, read, and action content reachable, including the unknown-schema fallback and the existing pending-decision resolution action and behavior.
- Preserve modal links and focus behavior, and Documents category, search, and accessibility behavior.
- Retain the paper/ink ledger style and avoid a generic KPI/card grid.

## Assumptions and scope
- Visual-only reorganization of the dashboard Specs page; no backend, API, or schema changes.
- Existing tracker, state, pending-decision, Documents tree/file, and resolve-action contracts remain authoritative.

## Acceptance criteria
1. At 1440px, the Specs Overview shows the progress/status strip, implementation register, attention/roadmap hierarchy, and paired project-state/known-issues context panels.
2. Progress/status counts and labels are derived only from tracker rows, and tests verify that source of truth.
3. At 375px, sections stack without page-level horizontal overflow; tracker overflow remains intentionally contained in its existing scroll region.
4. Overview and Documents content, existing data contracts, unknown-schema fallback, pending-decision resolution behavior, document categories/search, modal links, focus behavior, and accessibility interactions remain usable.
5. Focused tests cover tracker-derived counts and preserved Specs interactions/contracts; dashboard build and Playwright checks pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify passed desktop 1440px hierarchy and status-count criteria, 375px no-overflow, unknown-schema fallback, roadmap, pending-decision acceptance, and Documents search/categories/modal links/focus; API unchanged.; Separate independent fix verification confirmed project-state and known-issues Read full text renders the supplied title/body without /api/specs/file requests; tracker and Documents links still use the file API.; Focused Specs tests passed 9/9; npm test passed 449/449; npm run build succeeded and synced the CLI; npm run check-cli passed.; Playwright against the actual server at 4201 confirmed asset index-BxhoKyUJ.js, .spec-status-strip, two-column desktop layout, 69 tracker rows, and no overflow.; guarana specs validate . --json passed: 169 files scanned, 0 issues.
Change: none
<!-- guarana:record:end -->
