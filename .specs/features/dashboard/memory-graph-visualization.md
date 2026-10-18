# Feature spec: Guarana dashboard Memory Graph bubble visualization

**Status: VALIDATED**

## Goal
Add a real, readable, interactive node-and-edge bubble map to the dashboard Memory Graph while retaining its complete readable index, selected-memory details, and plain-language relationship rows.

## Requirements
- Add a clearly visible interactive bubble map synchronized with the readable index, selected-memory details, and relationship rows. The map is visible on first entry to Graph.
- Provide Network as the default map mode, showing every node and actual edge matching active filters, and Neighborhood mode, showing the selected node and its immediate matching neighbors and their actual connecting edges.
- Keep index and search navigation for isolated or dense nodes. The bounded API result currently contains 84 nodes (72 project and 12 global), 24 edges, 31 connected nodes, and maximum degree 6; do not render a blank field with tiny anonymous circles.
- Use a compact deterministic automatic bubble layout with no manual drag, no position sessionStorage reads or writes, and no reset-layout control. Do not touch, clear, or overwrite any existing stored browser key.
- Differentiate real node bubbles visually by memory type and scope, and emphasize the selected node and its immediate neighbors. Display only edges present in the payload, use arrowheads for direction, and show relation types in the focused or active graph view.
- Keep node intent, scope, type, and summary inspectable through the readable index and selected-memory details; prevent map-label collisions and preserve unambiguous plain-language incoming and outgoing relationship rows.
- Map bubbles, index entries, and relationship-neighbor controls synchronize selection and details. Preserve keyboard-accessible selection and focus, and use scope-qualified identities so identical raw IDs in project and global scopes remain distinct.
- Text, type, scope, and relationship filters affect index and map consistently. Preserve first-visible selection, selection fallback when filtered out, and clear empty behavior.
- Preserve confirmed project and global graph nodes and edges; global data remains read-only. Project relationship creation and exact deletion remain confirmed-project-only, typed, explicitly confirmed, and cannot create cross-scope edges.
- Preserve local confirmed-project TF-IDF suggestions excluding the selected and already-linked nodes; a person chooses the relation type and explicitly confirms before any write. Make no external-service calls.
- Make no API, payload, backend, memory-vault, or schema changes. Do not put memory text in telemetry or external services.
- At 375px and desktop widths, the map fits or scrolls inside its own labelled, focusable contained viewport with no page-level horizontal overflow. Preserve the Guarana palette, typography, rule-led styling, reduced-motion behavior, and visible focus.

## Assumptions and scope
- Use existing project conventions and no D3, added dependency, external model, or new backend capability.
- The new bubble-map follow-up is separate from the historical validated relationship-management and index/relationship-row presentation records; both historical statuses and proofs remain unchanged.
- The user authorizes the implementation design choice; the supplied Network and Neighborhood modes and automatic deterministic placement define that choice.
- Dashboard Memory Graph presentation, pure automatic-layout tests, component tests, and browser verification for Network and Neighborhood modes.
- No source implementation, workflow JSON, version, commit, push, tag, publish, or shipping action is included in this planning/specification task.

## Acceptance criteria
1. The Graph view retains the readable all-node index, selected-memory details, and plain-language incoming/outgoing relationship rows while adding a visible interactive node-and-edge bubble map whose selection stays synchronized with all three surfaces.
2. Network is the default and first-visible map mode and represents every node and actual payload edge that matches active filters, including isolated nodes; edges use directional arrowheads and focused or active edges expose their actual relation types.
3. Neighborhood mode displays only the selected node, its immediate matching neighbors, and their actual connecting payload edges; choosing another node from the map, index, or relationship controls updates the selected details and neighborhood.
4. Map bubbles visibly distinguish memory type and project/global scope and emphasize the selected node and immediate neighbors. Node intent, scope, type, and summary remain readable in the index/details; map labels do not collide and the rendering is not a field of tiny anonymous circles.
5. Automatic placement is deterministic and compact. The Graph exposes no drag or reset-layout action, reads and writes no position sessionStorage, and does not touch, clear, or overwrite any existing browser key.
6. Keyboard-operable map selection and visible focus are present; project/global duplicate raw IDs remain distinct through scope-qualified identity.
7. Text, type, scope, and relationship filters yield consistent index and map results; filtering the selected node selects the first visible result or displays the defined empty state.
8. All prior relationship privacy and editing rules remain intact: global graph data is read-only; only confirmed project nodes can be endpoints for typed project relation creation or exact deletion; removal and creation require explicit confirmation; and no cross-scope edge is possible.
9. Suggestions remain local confirmed-project TF-IDF candidates excluding the selected node and existing links; no write occurs before a person chooses a relation type and explicitly confirms. No external service is called and no memory text enters telemetry.
10. Existing API contracts, payloads, backend behavior, memory data/schema, and telemetry privacy remain unchanged.
11. At 375px and desktop widths, the labelled focusable map viewport fits or scrolls within its own bounds without page-level horizontal overflow; the established palette, typography, rule-led treatment, reduced motion, and visible focus remain intact.
12. Pure layout tests and component/browser checks cover both modes, complete Network node/edge representation, Neighborhood membership, edge direction and relation labels, selection synchronization, filtering and scoped ID collisions, keyboard use, privacy invariants, and responsive rendering. Focused tests, npm test, npm run build and CLI sync, npm run check-cli, specs validation, git diff --check, and browser checks at 375px and desktop pass; independent verification reports each criterion.

## Current Graph behavior clarification

Current behavior is Network by default, showing every node and actual payload edge matching the active filters. Neighborhood is the selected-memory focus, showing only that node, its immediate matching neighbors, and their actual connecting edges. This later current-behavior note supplements but does not rewrite the historical validation proof below.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS, 12/12 criteria.; First and final guarana specs validate . --json: ok:true, 183 files, 0 issues.; Network is the default and represents all 84 filtered nodes and actual edges; Neighborhood is exactly the selected node plus its one-hop set. Deterministic scope-aware layout; every displayed edge shows direction; selected and neighbor emphasis; type colors and project/global ring styles; plain-language relationship direction/type rows; synchronized index, map, and details selection. Layout tests: memoryBubbleLayout.test.js:23–96; component source and tests as summarized by worker-verify.; Browser checked Network and Neighborhood at 375×812 and 1440×900, related bubbles/edges/labels, map/index selection, arrow/Enter keyboard behavior, type/scope styling, no label collisions, no page-level horizontal overflow, and contained map scrolling. Seeded old storage key unchanged. Screenshots are external/ephemeral artifacts: `memory-graph-{375,1440}-{network,neighborhood}.png`; report: `memory-graph-browser-report.json`.; Privacy/edit/search checks passed: project-only explicit typed create and exact-timestamp delete; global read-only; same-origin local confirmed-project suggestions with no write until relation selection and confirmation; duplicate scope IDs; filter fallback and empty state. Existing API tests intact.; Bubble follow-up changes only dashboard UI/styles/tests/helper and package test script; no API/backend/schema/telemetry/external-service changes attributable to this feature.; Focused component/helper tests PASS (18/18); focused component/helper/API run PASS (44/44); npm test PASS (485/485); npm run build PASS; npm run check-cli PASS (CLI bundle matches canonical sources); git diff --check PASS; final specs validation PASS (183 files, 0 issues). Build dist outputs regenerated.; No staged changes, commit, push, tag, or publish. Existing dirty release-candidate work preserved; pending 1.3.0 push remains unperformed. Status is VALIDATED, not SHIPPED.
Change: none
<!-- guarana:record:end -->
