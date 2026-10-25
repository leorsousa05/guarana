# 2026-10-24 — Dashboard Memory Map pan-zoom and inspector redesign

## Status

VALIDATED, not SHIPPED. Fresh independent `worker-verify` returned overall PASS for all five acceptance criteria.

## Validated change

Memory Map is an enlarged no-scroll viewport without the Index sidebar in map mode, with a Map/Index toggle and a contextual inspector beside the broad desktop map and stacked on mobile. Network/Neighborhood and filters remain. Named Zoom in/out, Fit map, and Focus selected controls work; selection is centered at natural scale, Fit bounds the graph, background pan does not move nodes, and map/Index/relationship-row selection synchronizes. Readable labels/disclosures and the inspector show memory identity and typed directed relationships. Deterministic layout, keyboard navigation and selection, privacy, global read-only behavior, project relationship editing, and API/data contracts remain intact.

Wheel zoom uses a native `{ passive: false }` listener on the map viewport only, allowing cancellation of the native wheel default there while preserving ordinary page scrolling outside the map. No global wheel blocker was added. No deployment or shipping occurred.

## Proof

- Focused layout/component tests — PASS, 20/20.
- `npm test` — PASS, 621/621 (0 failures; nonfatal Vite WebSocket port-in-use warnings only).
- `npm run build` — PASS; Vite build and canonical-source-to-CLI sync completed.
- `npm run check-cli` — PASS; bundle matches canonical source.
- Pre-record `npm run specs:validate` — PASS: 223 Markdown files, 87 feature specs, 39 ADRs, 246 local links.
- `git diff --check` — PASS.
- Fresh independent `worker-verify` — overall PASS for all five criteria; independently reran focused tests 20/20 and `npm test` 621/621.
- Built-app Chromium proof at 1440×900 and 375×812 used synthetic fixtures only (84 fake memory nodes and 26 fake typed edges; no real vault data). The report is `guarana-memory-map-pan-zoom-inspector.json`; screenshots are `guarana-memory-map-camera-1440.png`, `guarana-memory-map-camera-375.png`, `guarana-memory-map-selected-1440.png`, and `guarana-memory-map-selected-375.png`. The report and screenshots were temporary local synthetic-fixture evidence and are not included in the repository.
- Browser proof confirms enlarged clipped viewports and zero horizontal page overflow; no programmatic map scroll; fit, zoom, and focus; cancelable wheel zoom without page/map scrolling; normal outside-map wheel scrolling; background pan with immovable nodes; readable labels, inspector, and typed relationship rows; selection synchronization; Neighborhood and filters; keyboard focus/selection; reduced motion; scope-qualified IDs and privacy boundaries; and no browser errors.

The independent verifier confirmed no Memory route/payload or server/data changes attributable to this feature. Unrelated existing Activity/Overview worktree changes are excluded; no API, vault schema/data, or privacy change is claimed.
