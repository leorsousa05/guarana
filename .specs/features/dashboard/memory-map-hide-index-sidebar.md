# Feature spec: Dashboard Memory Map hide index sidebar follow-up

**Status: VALIDATED**

## Goal
Hide the Memory Index sidebar in Memory Map mode and let the map plus selected details and relationship controls use the full workbench width.

## Requirements
- In Memory map mode, hide the left Memory Index section from the visible and accessibility-exposed interface; let the map and selected details/relationship area fill the full workbench width, with the map as the primary and only visualization.
- Keep selected-memory details and relationship controls below the map so the focused memory remains inspectable and editable under the existing detail contracts.
- Keep the Memory display toggle visible. Memory index mode retains the record list and details as before.
- Keep map controls, filters, Network/Neighborhood mode, selection, and graph behavior unchanged.
- Preserve the four top-level Memory tabs and existing privacy, global read-only, relationship, and API behavior; make no API, backend, data, schema, or privacy changes.

## Assumptions and scope
- This is a follow-up clarification to the already VALIDATED Memory Index/Map switch; its historical feature record and change proof remain unchanged.
- The accepted adjustment is a reversible display/layout-only change and does not warrant an ADR.
- Dashboard Memory map presentation in dashboard/web/src/components/MemoryGraph.jsx and dashboard/web/src/style.css, with regression coverage in dashboard/web/src/components/Memory.test.mjs.
- After validation, a dated Changes receipt records the independent PASS; no deployment or shipping claim is made.

## Acceptance criteria
1. Map mode has no visible or accessibility-exposed Memory Index sidebar; map and selected details use full workbench width. The map is the primary/only visualization, and the Memory index button remains available for switching.
2. Index mode remains unchanged: readable full-width filtered records, selected details and relationship controls beneath, and switching preserves filters, selected memory, and Network/Neighborhood mode.
3. Existing map interactions, privacy, global read-only, relationship semantics, top-level tab behavior, and API remain unchanged.
4. Focused Memory tests, full npm test, Dashboard build/CLI sync, check-cli, specs validation, git diff check, and desktop/375px browser proof pass; browser proof verifies no index sidebar in Map mode and width/overflow.
5. No deployment or shipping claim is made.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify returned overall PASS on all criteria; its earlier FAIL was a preservation-evidence gap only and was superseded by a fresh PASS after additional evidence.; The prior .specs/features/dashboard/memory-index-map-switch.md record was left unchanged during this follow-up, based on prior mtime/ctime 2026-10-24 12:21:17 -0300, follow-up spec creation mtime/ctime 12:57:20, and non-overlapping handoffs listing no modification to the prior record. It remains untracked; no byte-for-byte comparison to HEAD or historical Git was possible. The prior toggle record remains VALIDATED.; node --test dashboard/web/src/components/Memory.test.mjs PASS 14/14; npm test PASS 619/619 with nonfatal Vite port 24678-in-use and Node module-type warnings.; Primary npm run build PASS including Dashboard build and CLI sync; independent verifier did not rerun build under read-only constraint. npm run check-cli PASS. Pre-closeout npm run specs:validate PASS: 221 Markdown, 86 feature specs, 39 ADRs, 245 local links, 0 issues; verifier reran specs validation with the same counts and PASS. Primary and verifier git diff --check PASS.; Browser report /tmp/opencode/guarana-memory-map-hide-index-sidebar.json, aggregate synthetic UI/API fixtures only, PASS at 1440px and 375px: Map-mode index absent from accessibility tree, map/details full width, Index mode available/full width, keyboard switching, filters/selection/Neighborhood retention and synchronization, no overflow, and zero page errors. No tablet-specific proof.; Screenshots: /tmp/opencode/guarana-memory-map-no-index-{375,1440}.png, /tmp/opencode/guarana-memory-map-no-index-selected-{375,1440}.png, and /tmp/opencode/guarana-memory-index-{375,1440}-sidebar-followup.png.; Changed source paths dashboard/web/src/components/MemoryGraph.jsx, dashboard/web/src/style.css, and dashboard/web/src/components/Memory.test.mjs; only Memory CSS rules are attributed because style.css also contains unrelated pre-existing Activity/Overview modifications. No API/backend/data/schema/privacy change, deployment, or shipping occurred.
Change: .specs/changes/2026-10-24-dashboard-memory-map-hide-index-sidebar.md
<!-- guarana:record:end -->
