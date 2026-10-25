# Dashboard Overview operational workbench

**Status: VALIDATED, not SHIPPED.**

## Goal and change

Replace the Overview's former summary content with a no-document-scroll operational workbench: compact workflow context, current same-origin worker projection and observed Advisor runtime, the latest injection for the active root, and a read-only memory graph that emphasizes injected memories. The graph uses actual scope-qualified nodes/edges and supports selected-node/direct-neighbor detail. The initial graph viewport is locally centered once after the first nonempty graph; selection, refresh, resize, and user navigation do not recenter it or move stable node centers.

## Bounded source attribution

The feature-attributed source paths are `dashboard/web/src/App.jsx`, `dashboard/web/src/components/Overview.jsx`, `dashboard/web/src/components/Overview.test.mjs`, `dashboard/web/src/components/Workflow.test.mjs` (the CSS section-boundary test follows the renamed Overview CSS marker), and `dashboard/web/src/style.css`. Shared style and the worktree contain extensive unrelated Activity, Memory, and plugin changes; these are not attributed to this feature. The build regenerated `dist` files from the entire dirty source tree, so their mixed contents are not claimed as exclusively Overview changes. Existing APIs, data/schema, plugins, and other pages were not changed for this work.

## Primary gates

- Focused Overview + Workflow tests: **PASS, 17/17**. A nonfatal Vite WebSocket port-in-use warning occurred; tests passed.
- `npm test`: **PASS, 622/622**.
- `npm run build`: **PASS**, including Dashboard build and CLI sync.
- `npm run check-cli`: **PASS**.
- Pre-record `npm run specs:validate`: **PASS** — 227 Markdown files, 89 feature specs, 39 ADRs, 249 local links, 0 issues.
- `git diff --check`: **PASS**.
- Standard nonfatal Node module-type warnings occurred in the full-suite/build context; the checks were not warning-free.

## Independent verification

Fresh independent `worker-verify` returned **overall PASS, all 8 acceptance criteria**, and reran each listed gate with PASS. Independent report: `overview-independent-verify.json`; verifier script: `overview-independent-verify.mjs`. These were temporary local synthetic-fixture evidence and are not included in the repository.

## Synthetic browser evidence

Primary browser proof used synthetic response interception only; no live or real session/memory data. Script: `overview-browser-proof.mjs`; screenshots: `overview-1440x900.png` and `overview-375x812.png`. These were temporary local synthetic-fixture evidence and are not included in the repository.

- At 1440x900, document/body sizes were 1440x900 and 1440x870, all 7/7 graph nodes were initially visible, and workflow context stayed within bounds.
- At 375x812, document/body sizes were 375x812 and 375x808, with 4/7 nodes initially visible after local centering at scroll `[86,196]`.
- Graph and injection-list selection preserved viewport scroll and absolute node centers. Actual relation neighbors, injected marks, project/global same-ID scope collisions, keyboard focus/selection, reduced motion, privacy canaries, and loading/no-root/no-injection/error states passed.
- The browser observed only GET endpoints and no writes; there were zero runtime exceptions.

## Known-issue resolution and limits

The temporary finding `2026-10-24 — Overview mobile graph opens on blank canvas` is **RESOLVED**: the one-time local-scroll centering makes the existing graph cluster visible on mobile while preserving selection/navigation stability. The incident, original evidence, and mitigation remain in `.specs/state/known-issues.md`; final synthetic proof is recorded there and in the independent report above.

This is a source/UI validation only. No real session or memory data, live runtime, deployment, API/data/schema/plugin change, commit, push, release, or shipping is claimed. Status remains **VALIDATED, not SHIPPED**.
