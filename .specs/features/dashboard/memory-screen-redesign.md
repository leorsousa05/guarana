# Feature spec: Guarana dashboard Memory screen redesign

**Status: VALIDATED**

## Goal
Record independent validation of the full Memory screen redesign and close its outstanding visual verification without changing the status of the overall dashboard redesign.

## Requirements
- Preserve the four existing ARIA tabs and panels, Injected default, and ArrowLeft/ArrowRight/Home/End tab navigation.
- Preserve summary values, project/global scopes, and existing loading, error, and empty semantics.
- Preserve project-only confirmed search, existing type filter, endpoint, and type, intent, summary, score, and timestamp fields.
- Preserve project/global graph nodes and edges, scope-qualified identity, selection, neighbors, lineage, keyboard selection, drag without selection, sessionStorage layout persistence, and reset.
- Preserve injected history selection, project/global map and details, unavailable-node identity, reference-only telemetry, and correct vault hydration/privacy.
- Keep draft/review controls CLI/API-only and make no API, backend, payload, or data-schema changes.
- Preserve restrained folio presentation, visible focus, reduced-motion behavior, and no page-level horizontal overflow at 375x812 and 1440x900.
- Focused tests, production dashboard build, and specs validation pass; browser verification covers all four tabs and records screenshots and responsive/accessibility evidence.

## Assumptions and scope
- The overall dashboard redesign remains TASKED; shipping was not confirmed.
- This validation applies to the full Memory screen redesign only, not the overall dashboard redesign.
- Browser API responses were mocked; existing API endpoints and fields were exercised without backend changes.

## Acceptance criteria
1. All four existing ARIA tabs and associated panels remain; Injected is default and arrow/Home/End keyboard navigation works.
2. Summary retains project/global scope counts and existing values and state semantics.
3. Search remains project-only and uses the existing endpoint, confirmed-only behavior, type filter, and result fields.
4. Graph distinguishes same-ID project/global nodes by scope and preserves selection, neighbors, lineage, keyboard interaction, drag without selection, sessionStorage persistence, and reset.
5. Injected history selection, missing-node identity, project/global nodes and details, and privacy/reference-only telemetry behavior are preserved.
6. No dashboard draft/review UI or API was added and there are no API, backend, payload, or schema changes.
7. At 375x812 and 1440x900 document/body width equals viewport; visual focus is visible and reduced-motion transitions are disabled; injection panels are transparent/unboxed with history separated by a 1px rule and scrolling contained.
8. Independent worker-verify reports PASS; focused Memory/graph tests, production dashboard build, and specs validation pass; screenshots cover Injected, Graph, Summary, and Search at both viewports.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify PASS for the full Memory screen redesign; this closes its outstanding visual verification and validates only Memory, not the overall dashboard.; Specs validation PASS: 153 files, 37 feature specs, 30 ADRs, 206 links, 0 issues; focused Memory/graph tests PASS (11/11); production dashboard build PASS. Exact focused-test, build, and specs-validation commands were not supplied.; Playwright at 375x812 and 1440x900: document/body width equals viewport; injected panels are transparent and unboxed with history separated by a 1px rule; history scrolling contains 750px content in 223px/463px viewports.; Visible focus verified: history focus 3px/2px and selected node 3.5px. Reduced-motion emulation yields transition none.; Mocked-browser API checks cover selected history, unavailable-node identity, project/global nodes and details; graph same-ID scope distinction, keyboard/neighbor/lineage, drag without select, sessionStorage and reset; summary/search existing endpoint and fields; and absence of draft/review UI/API.; Screenshots: /tmp/opencode/memory-375-injected.png, /tmp/opencode/memory-1440-injected.png, /tmp/opencode/memory-375-graph.png, /tmp/opencode/memory-1440-graph.png, /tmp/opencode/memory-375-summary.png, /tmp/opencode/memory-1440-summary.png, /tmp/opencode/memory-375-search.png, /tmp/opencode/memory-1440-search.png.; Implementation/test references: MemoryInjections.jsx:100-112,144-191; MemoryGraph.jsx:40-50,82-139,188-221,226-299; memoryGraphLayout.js:1-25; style.css:2276-2285,2438-2450,2471-2474,2497-2517,2592-2603; Memory.test.mjs:47-65,96-190,192-240.; Overall dashboard redesign remains TASKED and not shipped; no shipping confirmation was supplied.
Change: none
<!-- guarana:record:end -->
