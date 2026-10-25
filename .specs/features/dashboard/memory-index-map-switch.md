# Feature spec: Dashboard Memory Index/Map switch

**Status: VALIDATED**

## Goal
Add an accessible Memory Index / Memory Map switch in the dashboard Graph view, keeping the existing map as the default and unchanged.

## Requirements
- Inside the existing Graph panel, add an accessible toggle group labelled Memory display with buttons Memory map and Memory index. Memory map is initially selected and retains the current view; Memory index hides the map and expands the readable index to full width.
- In Memory index mode, retain the selected-memory details and relationship controls in readable form beneath the index. Keep record rows' scope, type, intent, and summary visible and preserve keyboard-operable record selection and visible focus.
- Switching views preserves query/type/scope/relation filters, selected memory, Network/Neighborhood mode, graph state, and all data. Selecting an index record updates selected details and map selection when returning to Memory map.
- Preserve all four existing top-level Memory tabs, their default and roving Arrow/Home/End keyboard semantics, and existing map behavior, layout, and appearance when Memory map is selected.
- Preserve project/global scope qualification, global read-only rules, relationships, privacy, current theme, and contained mobile layout. Make no API, backend, schema, data, or telemetry changes.
- Use ADR-005 default budgets: worker-code 8k tokens per dispatch, worker-verify 4k tokens per dispatch, and 32k tokens / 15 minutes per run.

## Assumptions and scope
- The accepted low-risk UX is a second accessible toggle group within the existing Graph panel, labelled Memory display, with Memory map and Memory index buttons; Memory map is the default.
- Memory index mode expands the existing filtered, scope-qualified record index to full width, hides the map, and keeps selected-memory details and relationship controls beneath the index.
- Dashboard Graph view presentation and its component tests in dashboard/web/src/components/Memory.jsx, dashboard/web/src/components/MemoryGraph.jsx, dashboard/web/src/style.css, and dashboard/web/src/components/Memory.test.mjs as applicable.
- Maintain the existing map markup/layout/behavior equivalently in Memory map mode and preserve all existing filters, selection, modes, graph data, relationships, privacy, and scope semantics.
- No API, backend, schema, data, telemetry, top-level Memory tab, relationship/privacy, or map redesign changes.
- No dated Changes receipt until validation; no ADR is warranted because this is a reversible UI-only view toggle with no data/API change.
- No deployment or shipping claim.

## Acceptance criteria
1. Inside the existing Graph tab, an accessible two-button Memory map/Memory index switch appears. Memory map is initially selected and retains existing view; switching to Memory index hides map and expands the readable record index full-width; switching back restores the map.
2. Toggle is native keyboard-operable with accessible group/name, pressed state and visible focus. Switching does not lose search/type/scope/relationship filters, selected memory, or Network/Neighborhood mode; selecting a record in index updates selected details and map selection when returning.
3. Preserve all four top-level tab semantics/default/keyboard behavior, map behavior, record fields, relationships, privacy and scope semantics; no API/schema/data change.
4. Focused Memory tests, full root suite, production dashboard build/CLI sync, check-cli, specs validation and git diff check pass. Browser checks at desktop and 375px exercise both views, selection/focus, and verify no page horizontal overflow.
5. This is implementation only; no deployment/shipping claim.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify returned overall PASS. Criterion 1 PASS: default Map, accessible toggle, full-width index, map hidden/restored, and details retained.; Criterion 2 PASS: keyboard Space switching, visible focus, filter/query/scope and Neighborhood mode retention, index selection updates details and selected map bubble, and responsive 375px no-overflow; type/relationship filter persistence was source-confirmed through controlled state in the mounted component.; Criterion 3 PASS: top-level tabs, map, record/privacy/relationship and API contracts preserved; no API route changes and no deployment claim.; node --test dashboard/web/src/components/Memory.test.mjs — PASS 14/14; npm test — PASS 619/619, with nonfatal Vite WebSocket port 24678-in-use and Node module-type warnings.; Primary npm run build — PASS including dashboard bundle and CLI sync; npm run check-cli — PASS; npm run specs:validate before this write — PASS (219 Markdown, 85 feature specs, 39 ADRs, 244 links, 0 issues); git diff --check — PASS. The verifier did not rerun build because it writes generated assets.; Browser report `guarana-memory-index-map-switch.json` (mode 0600, aggregate-only synthetic UI/API fixtures) — PASS at 1440px and 375px: default Map; keyboard switching and visible focus; Index expands and map hides; details remain full-width; text/scope filters, Neighborhood mode, selection and selected bubble persist/synchronize; no document/body overflow or page errors.; Screenshots: `guarana-memory-index-375.png`, `guarana-memory-map-375.png`, and corresponding 1440px files. Browser evidence uses synthetic fixtures only; the report and screenshots were temporary local synthetic-fixture evidence and are not included in the repository. Tablet was not specifically browser-tested.; No deployment or shipping occurred. Final post-record validation after all task records were written: `npm run specs:validate` — PASS: 220 Markdown files, 85 feature specs, 39 ADRs, 245 local links, 0 issues; `npm run check-cli` — PASS; `git diff --check` — PASS.
Change: .specs/changes/2026-10-24-dashboard-memory-index-map-switch.md
<!-- guarana:record:end -->
