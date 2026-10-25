# Feature spec: Dashboard Memory Map inspector stacking and selection stability follow-up

**Status: VALIDATED**

## Goal
Keep the selected-memory inspector below the full-width Memory Map and prevent selection from automatically recentering the camera or rearranging nodes in Network and Neighborhood modes.

## Requirements
- At desktop width 1440px and wider, the map and controls span the full available .mem-graph-side/workbench width; the selected-memory inspector starts directly below the map with the existing ledger-style horizontal rule and no vertical divider or adjacent layout. At 375px, retain the same map-first stacking without horizontal overflow.
- In Network and Neighborhood modes, selecting through the map, index, or relationship rows does not change camera x/y/scale or the absolute x/y centers of nodes present both before and after the selection. Shared nodes retain their coordinates; Neighborhood membership remains exactly the selected node plus its direct one-hop neighbors, with actual edges.
- Selection updates selected-node and neighbor emphasis, connected edges and labels, and inspector content. The camera stays where it is during selection; initial entry may retain its current selected-node focus. Explicit Focus selected, Fit map, zoom, and pan controls remain intentional navigation.
- Keep the Memory Map/Index display toggle, no Index sidebar in Map mode, and the existing Memory Index display layout.
- Preserve filters, qualified IDs, keyboard selection, relationship editing, global read-only/privacy behavior, and API/data contracts.
- Use existing borders and spacing without changing the visual palette or adding card surfaces.
- Preserve workflow JSON, unrelated Activity/Overview work, and the prior VALIDATED Memory Map feature spec, dated receipt, and proofs. The dashboard build regenerates `dashboard/web/dist` and `cli/dashboard/web/dist`; no API/data/privacy change is in scope. No ADR is warranted; create the dated Changes receipt only after validation.

## Assumptions and scope
- `dashboard/web/src/components/MemoryGraph.jsx` places the map before the inspector; its camera effect at lines 224-251 currently recenters when `selectionChanged`.
- The current desktop two-column rule is in dashboard/web/src/style.css:2937-2942; the inspector's left divider/padding is at 3299-3304; the existing max-width:840px rule already stacks the side and changes the inspector to a top border.
- The prior .specs/features/dashboard/memory-map-pan-zoom-inspector.md remains a historical record of its completed VALIDATED acceptance state.
- `dashboard/web/src/lib/memoryBubbleLayout.js` currently centers Network placement on the selected node at lines 105-151 and places the selected Neighborhood node at (360,220) with radial neighbors at lines 93-104; both must use selection-independent coordinates.
- The TASKED follow-up included desktop inspector stacking; the completed implementation also makes Network and Neighborhood selection position-stable while retaining Neighborhood membership semantics.
- Preserve unrelated changes, including Activity/Overview styling. No Memory API, data, privacy, or workflow JSON changes were made. The build regenerated `dashboard/web/dist` and `cli/dashboard/web/dist`; the dated Changes receipt is created after validation.

## Acceptance criteria
1. At 1440px, browser geometry shows the inspector below the map; map and controls fill the workbench width; a horizontal rule separates them; and no vertical divider remains. At 375px, the same order remains without horizontal overflow. Map/Index mode and Index display are unchanged.
2. In Network and Neighborhood, selection through map, index, and relationship rows leaves camera x/y/scale unchanged and preserves absolute x/y centers for every node present before and after selection. Neighborhood shows exactly the selected node plus immediate neighbors and actual edges; entering/leaving nodes is allowed, but shared nodes retain their coordinates. Initial selected-node focus on first entry and explicit Focus selected, Fit map, zoom, and pan remain functional.
3. Selection updates selected and neighbor emphasis, connected edges/labels, and inspector content. Filters, qualified IDs, keyboard selection, relationship editing, global read-only/privacy behavior, and API/data contracts remain unchanged.
4. Focused layout/component regression tests and synthetic-browser checks at 1440x900 and 375x812 verify stacking geometry, no overflow/errors, stable camera and shared-node centers after map/index/relationship selection in both modes, and explicit navigation controls. Then `npm test`, build plus CLI sync, `npm run check-cli`, specs validation, and `git diff --check` pass. No API/data/privacy changes or shipping claim.

## Final validation — 2026-10-24

The follow-up is **VALIDATED, not SHIPPED**. Fresh independent `worker-verify` returned overall PASS and independently inspected source/tests and verified all acceptance criteria and browser behavior at 1440x900 and 375x812. No repository edits or workflow transition were made by the verifier.

At 1440px, the map and inspector each span the 1116.8px workbench width; the inspector follows the map with a 1px horizontal top rule and no left divider. At 375px, both span 351px, the map remains first, and the page has no horizontal overflow. The Map/Index toggle and hidden Index sidebar in Map mode remain intact. Network and Neighborhood selection through the map, Index, and relationship rows leaves camera position/scale unchanged and does not move shared nodes. Neighborhood membership updates to the selected memory and immediate one-hop neighbors connected by actual edges; shared nodes retain their absolute positions. Selection emphasis, edges, labels, and inspector update together. Initial-entry focus and explicit Focus selected, Fit map, zoom, and pan remain available.

Primary checks passed: `node --test dashboard/web/src/lib/memoryBubbleLayout.test.js dashboard/web/src/components/Memory.test.mjs` (21/21); `npm test` (622/622, zero failures; nonfatal Vite WebSocket port 24678 and standard Node module-type warnings); `npm run build` (Vite passed and CLI sync succeeded); `npm run check-cli` (bundle matches canonical sources); `npm run specs:validate` (225 Markdown files, 88 feature specs, 39 ADRs, 248 local links, zero issues); and `git diff --check`.

Synthetic-only built-app browser proof: `guarana-memory-map-pan-zoom-inspector.json`; script `memory-map-pan-zoom-inspector-proof.mjs`; screenshots `guarana-memory-map-camera-1440.png`, `guarana-memory-map-camera-375.png`, `guarana-memory-map-selected-1440.png`, and `guarana-memory-map-selected-375.png`. These artifacts were temporary local synthetic-fixture evidence and are not included in the repository. The latest report passed with no browser errors using 84 fake memory nodes and 26 fake typed edges, no real vault data. It verifies responsive stacking/zero overflow, stable camera and shared-node centers for each selection source and both modes, Neighborhood membership, synchronized selection details, explicit camera controls, and preservation of existing Network/Neighborhood/keyboard/privacy/API behavior.

Changed implementation scope: `dashboard/web/src/components/MemoryGraph.jsx`, `dashboard/web/src/lib/memoryBubbleLayout.js`, `dashboard/web/src/lib/memoryBubbleLayout.test.js`, `dashboard/web/src/components/Memory.test.mjs`, Memory-specific styling in `dashboard/web/src/style.css`, and build-generated `dashboard/web/dist` and `cli/dashboard/web/dist`. Unrelated Activity/Overview styling was preserved. No API/data/privacy change, deployment, or shipping occurred.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify returned overall PASS and independently inspected source/tests and verified all acceptance criteria and browser behavior at 1440x900 and 375x812.; node --test dashboard/web/src/lib/memoryBubbleLayout.test.js dashboard/web/src/components/Memory.test.mjs — PASS, 21/21; npm test — PASS, 622/622 with zero failures and nonfatal Vite WebSocket port 24678 and standard Node module-type warnings.; npm run build — PASS, Vite build and CLI sync succeeded; npm run check-cli — PASS, bundle matches canonical sources; npm run specs:validate — PASS, 225 Markdown, 88 feature specs, 39 ADRs, 248 local links, 0 issues; git diff --check — PASS.; Synthetic built-app browser report `guarana-memory-map-pan-zoom-inspector.json` and script `memory-map-pan-zoom-inspector-proof.mjs` — latest proof PASS with no browser errors, 84 fake nodes and 26 fake typed edges; no real vault data. Screenshots: `guarana-memory-map-camera-1440.png`, `guarana-memory-map-camera-375.png`, `guarana-memory-map-selected-1440.png`, `guarana-memory-map-selected-375.png`. The report, script, and screenshots were temporary local synthetic-fixture evidence and are not included in the repository. Verified responsive stacking/no overflow, unchanged camera and shared-node positions by each selection source in both modes, Neighborhood membership, synchronized selection UI, and explicit camera controls.; No API/data/privacy change, deployment, or shipping occurred.
Change: .specs/changes/2026-10-24-dashboard-memory-map-selection-stability.md
<!-- guarana:record:end -->
