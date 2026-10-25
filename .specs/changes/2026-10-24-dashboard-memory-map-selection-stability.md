# Dashboard Memory Map stacking and selection stability follow-up

**Status: VALIDATED, not SHIPPED.** Fresh independent `worker-verify` returned overall PASS after independently inspecting source/tests and verifying all acceptance criteria and browser behavior at 1440x900 and 375x812.

## Goal and verified behavior

Keep the Memory Map inspector below the full-width map and prevent selection from automatically recentering the camera or repositioning nodes in Network and Neighborhood modes. At 1440px, map and inspector each span the 1116.8px workbench width; the inspector follows the map with a 1px horizontal top rule and no left divider. At 375px, both span 351px, the map is first, and the page has no horizontal overflow. Map/Index toggle and the hidden Index sidebar in Map mode remain intact.

The user-selected stable absolute positions are preserved in both modes. Selection through Network or Neighborhood map, Index, or relationship row keeps camera x/y/scale unchanged and preserves the positions of shared nodes. Neighborhood membership remains the selected memory plus its immediate one-hop neighbors with actual edges; shared nodes keep their positions. Selection emphasis, edges, labels, and inspector update together. Initial-entry focus and explicit Focus selected, Fit map, zoom, and pan remain available.

## Validation

- `node --test dashboard/web/src/lib/memoryBubbleLayout.test.js dashboard/web/src/components/Memory.test.mjs` — PASS, 21/21.
- `npm test` — PASS, 622/622, zero failures; nonfatal Vite WebSocket port 24678 and standard Node module-type warnings.
- `npm run build` — PASS; Vite build and CLI sync succeeded.
- `npm run check-cli` — PASS; bundle matches canonical sources.
- `npm run specs:validate` — PASS, 225 Markdown files, 88 feature specs, 39 ADRs, 248 local links, zero issues.
- `git diff --check` — PASS.
- Built-app synthetic browser proof — PASS, no browser errors. Report: `guarana-memory-map-pan-zoom-inspector.json`; script: `memory-map-pan-zoom-inspector-proof.mjs`; screenshots: `guarana-memory-map-camera-1440.png`, `guarana-memory-map-camera-375.png`, `guarana-memory-map-selected-1440.png`, `guarana-memory-map-selected-375.png`. The report, script, and screenshots were temporary local synthetic-fixture evidence and are not included in the repository. The fixture contains 84 fake memory nodes and 26 fake typed edges, with no real vault data. Proof covers responsive geometry and overflow, stable camera and shared-node positions for selection by map/Index/relationship row in both modes, Neighborhood membership, synchronized selection details, and explicit camera controls.

Implementation scope: `dashboard/web/src/components/MemoryGraph.jsx`, `dashboard/web/src/lib/memoryBubbleLayout.js`, `dashboard/web/src/lib/memoryBubbleLayout.test.js`, `dashboard/web/src/components/Memory.test.mjs`, Memory-specific styling in `dashboard/web/src/style.css`, and build-generated `dashboard/web/dist` and `cli/dashboard/web/dist`. Unrelated Activity/Overview styling was preserved. No API/data/privacy change, deployment, or shipping occurred.
